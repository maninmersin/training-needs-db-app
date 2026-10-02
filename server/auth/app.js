// Auth server for the local backend, plus admin user management for both backends.
//
// Local mode: issues JWTs that PostgREST trusts (same secret), with the claims Supabase uses
// (sub, role, email) so RLS policies calling auth.uid() behave identically.
// Endpoint shapes mirror Supabase GoTrue so src/core/services/localAuthClient.js stays thin.
//
// Supabase mode: only /admin/* is used. The service-role key lives here, server-side.
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const REFRESH_TOKEN_DAYS = 30;
const MIN_PASSWORD_LENGTH = 8;
const ADMIN_ROLE_NAMES = ['admin', 'super_admin'];

const fail = (res, status, msg) => res.status(status).json({ error: msg, msg });

const toUser = (row) => ({
  id: row.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: row.email,
  email_confirmed_at: row.email_confirmed_at,
  last_sign_in_at: row.last_sign_in_at,
  app_metadata: row.raw_app_meta_data || {},
  user_metadata: row.raw_user_meta_data || {},
  created_at: row.created_at,
  updated_at: row.updated_at
});

// Simple in-memory limiter for login attempts (per IP + email)
const createLoginLimiter = ({ max = 10, windowMs = 15 * 60 * 1000 } = {}) => {
  const attempts = new Map();
  return {
    blocked(key) {
      const entry = attempts.get(key);
      if (!entry || Date.now() > entry.resetAt) return false;
      return entry.count >= max;
    },
    fail(key) {
      const entry = attempts.get(key);
      if (!entry || Date.now() > entry.resetAt) attempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
      else entry.count++;
    },
    clear(key) {
      attempts.delete(key);
    }
  };
};

/**
 * @param {object} opts
 * @param {import('pg').Pool} [opts.pool]   local DB pool (local mode)
 * @param {object} opts.config               from scripts/local/config.js
 * @param {'local'|'supabase'} opts.mode
 * @param {object} [opts.supabaseAdmin]      service-role client (supabase mode)
 * @param {object} [opts.supabaseAnon]       anon client used to verify caller tokens (supabase mode)
 */
export const createAuthApp = ({ pool, config, mode = 'local', supabaseAdmin, supabaseAnon }) => {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cors({ origin: config.allowedOrigins }));
  const limiter = createLoginLimiter();

  const signAccessToken = (user) => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + config.jwtExpirySeconds;
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp },
      config.jwtSecret,
      { algorithm: 'HS256' }
    );
    return { token, exp };
  };

  const issueSession = async (userRow) => {
    const { token, exp } = signAccessToken(userRow);
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO auth.refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, now() + $3::interval)`,
      [refreshToken, userRow.id, `${REFRESH_TOKEN_DAYS} days`]
    );
    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: config.jwtExpirySeconds,
      expires_at: exp,
      refresh_token: refreshToken,
      user: toUser(userRow)
    };
  };

  // Resolves the calling user's id from the bearer token, for either backend
  const callerId = async (req) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    if (mode === 'supabase') {
      const { data, error } = await supabaseAnon.auth.getUser(token);
      return error ? null : data.user.id;
    }
    try {
      return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }).sub;
    } catch {
      return null;
    }
  };

  const isAdmin = async (userId) => {
    if (mode === 'supabase') {
      const { data: roles } = await supabaseAdmin
        .from('auth_user_roles').select('auth_roles(name)').eq('user_id', userId);
      if ((roles || []).some((r) => ADMIN_ROLE_NAMES.includes(r.auth_roles?.name))) return true;
      const { data: u } = await supabaseAdmin.from('auth_users').select('*').eq('id', userId).maybeSingle();
      return Boolean(u?.is_super_admin);
    }
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM public.auth_user_roles ur JOIN public.auth_roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.name = ANY($2)
       ) OR EXISTS (
         SELECT 1 FROM public.auth_users u WHERE u.id = $1 AND (to_jsonb(u) ->> 'is_super_admin')::boolean
       ) AS admin`,
      [userId, ADMIN_ROLE_NAMES]
    );
    return rows[0].admin;
  };

  const requireAdmin = async (req, res, next) => {
    try {
      const id = await callerId(req);
      if (!id) return fail(res, 401, 'Not signed in');
      if (!(await isAdmin(id))) return fail(res, 403, 'Admin role required');
      req.callerId = id;
      next();
    } catch (err) {
      next(err);
    }
  };

  const validatePassword = (password) =>
    typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH
      ? null
      : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

  app.get('/health', (_req, res) => res.json({ ok: true, mode }));

  // ---- Session endpoints (local mode only) ------------------------------------------------
  if (mode === 'local') {
    app.post('/token', async (req, res, next) => {
      try {
        const grant = req.query.grant_type;

        if (grant === 'password') {
          const email = String(req.body.email || '').trim().toLowerCase();
          const password = String(req.body.password || '');
          const key = `${req.ip}|${email}`;
          if (limiter.blocked(key)) return fail(res, 429, 'Too many login attempts. Try again in 15 minutes.');

          const { rows } = await pool.query('SELECT * FROM auth.users WHERE lower(email) = $1', [email]);
          const user = rows[0];
          const ok = user?.encrypted_password && (await bcrypt.compare(password, user.encrypted_password));
          if (!ok) {
            limiter.fail(key);
            return fail(res, 400, 'Invalid login credentials');
          }
          if (user.banned_until && new Date(user.banned_until) > new Date()) return fail(res, 400, 'User is banned');

          limiter.clear(key);
          const { rows: [updated] } = await pool.query(
            'UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1 RETURNING *', [user.id]);
          return res.json(await issueSession(updated));
        }

        if (grant === 'refresh_token') {
          // Rotate: the old refresh token is consumed atomically
          const { rows } = await pool.query(
            `UPDATE auth.refresh_tokens SET revoked = true
             WHERE token = $1 AND NOT revoked AND expires_at > now()
             RETURNING user_id`,
            [String(req.body.refresh_token || '')]
          );
          if (!rows.length) return fail(res, 400, 'Invalid Refresh Token');
          const { rows: [user] } = await pool.query('SELECT * FROM auth.users WHERE id = $1', [rows[0].user_id]);
          if (!user) return fail(res, 400, 'Invalid Refresh Token');
          return res.json(await issueSession(user));
        }

        return fail(res, 400, 'Unsupported grant_type');
      } catch (err) {
        next(err);
      }
    });

    app.get('/user', async (req, res, next) => {
      try {
        const id = await callerId(req);
        if (!id) return fail(res, 401, 'Invalid or expired token');
        const { rows } = await pool.query('SELECT * FROM auth.users WHERE id = $1', [id]);
        if (!rows.length) return fail(res, 401, 'User not found');
        res.json(toUser(rows[0]));
      } catch (err) {
        next(err);
      }
    });

    app.post('/logout', async (req, res, next) => {
      try {
        const id = await callerId(req);
        if (id) await pool.query('UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = $1', [id]);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    });

    // No email in local mode: tell the operator, don't reveal whether the account exists
    app.post('/recover', (req, res) => {
      console.log(`[auth] Password reset requested for ${req.body.email} - an admin can set a new password in User Management.`);
      res.json({});
    });
  }

  // ---- Admin user management (both modes) -------------------------------------------------
  app.post('/admin/users', requireAdmin, async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const pwError = validatePassword(req.body.password);
      if (!email) return fail(res, 400, 'Email is required');
      if (pwError) return fail(res, 400, pwError);

      if (mode === 'supabase') {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: req.body.password, email_confirm: true });
        if (error) return fail(res, 400, error.message);
        return res.status(201).json({ user: { id: data.user.id, email: data.user.email } });
      }

      const hash = await bcrypt.hash(req.body.password, 10);
      const { rows } = await pool.query(
        `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES ($1, $2, now())
         ON CONFLICT (email) DO NOTHING RETURNING id, email`,
        [email, hash]
      );
      if (!rows.length) return fail(res, 409, 'A user with this email already exists');
      res.status(201).json({ user: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  app.put('/admin/users/:id', requireAdmin, async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (password !== undefined) {
        const pwError = validatePassword(password);
        if (pwError) return fail(res, 400, pwError);
      }

      if (mode === 'supabase') {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
          ...(email ? { email } : {}),
          ...(password ? { password } : {})
        });
        if (error) return fail(res, 400, error.message);
        return res.json({ ok: true });
      }

      const hash = password ? await bcrypt.hash(password, 10) : null;
      const { rowCount } = await pool.query(
        `UPDATE auth.users SET
           email = coalesce($2, email),
           encrypted_password = coalesce($3, encrypted_password),
           updated_at = now()
         WHERE id = $1`,
        [req.params.id, email ? String(email).trim().toLowerCase() : null, hash]
      );
      if (!rowCount) return fail(res, 404, 'User not found');
      // A password change signs the user out everywhere
      if (hash) await pool.query('UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      if (err.code === '23505') return fail(res, 409, 'A user with this email already exists');
      next(err);
    }
  });

  app.delete('/admin/users/:id', requireAdmin, async (req, res, next) => {
    try {
      if (req.params.id === req.callerId) return fail(res, 400, 'You cannot delete your own account');
      if (mode === 'supabase') {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
        if (error) return fail(res, 400, error.message);
        return res.json({ ok: true });
      }
      await pool.query('DELETE FROM auth.users WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/invite', requireAdmin, async (req, res, next) => {
    try {
      if (mode === 'supabase') {
        const { error } = await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email: req.body.email });
        if (error) return fail(res, 400, error.message);
        return res.json({ ok: true });
      }
      console.log(`[auth] Invite requested for ${req.body.email} - no email in local mode; share the password directly.`);
      res.json({ ok: true, emailed: false });
    } catch (err) {
      next(err);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[auth] error:', err);
    fail(res, 500, 'Internal auth server error');
  });

  return app;
};
