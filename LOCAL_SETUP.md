# Running locally without Supabase

The app can run entirely on your PC: no cloud services, no Docker and no admin rights. Your data stays on this machine.

| Piece | What it is | Where it runs |
|---|---|---|
| PostgreSQL 17 | The real database. It comes from the `embedded-postgres` npm package, so there's nothing to install. | port 54329 |
| PostgREST 12.2 | The same REST engine Supabase uses, so all the app's queries work unchanged. | port 3000 |
| Auth server (`server/auth`) | Handles login, sessions and user admin. Passwords are bcrypt-hashed. | port 4000 |
| Vite | The app itself. | port 5173 |

Security rules (RLS policies) work exactly as on Supabase. A user only sees data for the projects they belong to.

**Where the data lives:** `%LOCALAPPDATA%\training-needs-app\` (your database files plus generated secrets). It's deliberately *outside* the project folder, because the project is in OneDrive and database files must not sync to the cloud. To use another folder, set `LOCAL_DATA_DIR`.

---

## First-time setup

Run all commands in this guide from the project folder (the VS Code terminal opens there automatically):

```powershell
cd "C:\Users\Stuart\OneDrive\Desktop\training_needs_db_app_ms_access"
npm install
npm run setup:postgrest        # downloads PostgREST into tools/ (one-off)
```

### 1. Copy the schema from Supabase

This copies the table structure only, with no data. The result (`db/migrations/0001_baseline.sql`) is safe to commit.

1. In the Supabase dashboard, open **Connect**, then **Session pooler**, and copy the connection string.
2. Create a file `.env.local` in the project root (it's git-ignored) containing:
   ```
   SUPABASE_DB_URL=postgresql://postgres.syrdmvfwptkzjdwvdcae:YOUR-DB-PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
   ```
3. Run:
   ```powershell
   npm run db:pull-schema
   ```
   This needs **one** of the following:
   - **Docker Desktop running.** The script then uses the Supabase CLI.
   - **`pg_dump` version 17.** Download the PostgreSQL 17 "zip archive" from <https://www.enterprisedb.com/download-postgresql-binaries> and unzip it. Then set `$env:PG_DUMP="C:\path\pgsql\bin\pg_dump.exe"` and run the command again.

### 2. Create the local database

```powershell
npm run db:migrate
```

### 3. Choose your data

You have two options:

- **Bring your existing data across** (rows *and* logins). Everyone keeps their current password.
  ```powershell
  npm run db:pull-data
  ```
  Once you've checked everything works locally, you can delete the data from Supabase.

- **Or start empty** with a local admin login:
  ```powershell
  npm run db:seed                                   # prints a generated password
  npm run db:seed -- you@company.com YourPassword1  # or choose one
  ```
  Running this again resets that user's password.

## Day to day

```powershell
npm run local
```

This starts everything. Open <http://localhost:5173>, and press **Ctrl+C** to stop.

`npm run dev` still runs against Supabase as before.

## Switching between backends

The app reads `VITE_DB_BACKEND`:

| Setting | Behaviour |
|---|---|
| `local` | Uses local PostgreSQL. `npm run local` sets this for you. |
| `supabase` (default) | Uses the URL and anon key from `.env`. |

No application code changes either way. Everything goes through `src/core/services/supabaseClient.js`.

User management (create, edit and delete users) always goes through the auth server, which keeps privileged keys out of the browser. To use it in Supabase mode:

1. Put `SUPABASE_SERVICE_ROLE_KEY=...` in `.env`. Note there's **no** `VITE_` prefix.
2. Run `npm run auth-server` alongside `npm run dev`.

## Moving to a company server later

Any PostgreSQL 15+ server works:

1. Set `DATABASE_URL=postgresql://user:pass@server:5432/training_needs` in `.env.local`. The user needs rights to create roles and schemas.
2. Run `npm run db:migrate`, then `npm run db:pull-data` (or restore from a local `pg_dump`).
3. Run PostgREST and `server/auth` on a server next to the database (see `scripts/local/postgrest.js` for the settings).
4. Build the frontend with `VITE_DB_BACKEND=local`, `VITE_API_URL` and `VITE_AUTH_URL` pointing at them.

Before exposing this beyond your own machine:

- Put both services behind HTTPS.
- Set `AUTH_ALLOWED_ORIGINS`.
- Supply your own `LOCAL_JWT_SECRET` and `AUTHENTICATOR_PASSWORD`, rather than the auto-generated ones.

## Schema changes

Add numbered files to `db/migrations/` (e.g. `0002_add_manager_id.sql`), then run `npm run db:migrate`. Each file runs once. Don't edit a migration after it has been applied; add a new one instead.

The old ad-hoc SQL scripts are kept for reference in `archive/sql/`. They are not run.

## Tests

```powershell
npm test                    # unit tests (scheduling engine, auth client)
npm run test:local-stack    # starts a throwaway database and checks auth, RLS isolation and the data copy
```

## Troubleshooting

| Problem | What to do |
|---|---|
| "Port 3000 is already in use" | Another `npm run local` is still running. Close it, or set `POSTGREST_PORT` / `AUTH_PORT`. |
| "PostgREST not found" | Run `npm run setup:postgrest`. |
| You forgot the local admin password | Run `npm run db:seed -- that@email.com NewPassword1`. |
| You want to start completely fresh | Stop the app, then delete `%LOCALAPPDATA%\training-needs-app\pgdata`. |
