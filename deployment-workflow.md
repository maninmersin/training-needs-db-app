# Deployment Workflow

## Quick Commands for Updates

### After making changes to your code:

```bash
# 1. Add all changes to git
git add .

# 2. Commit with a descriptive message
git commit -m "Your change description here"

# 3. Push to GitHub (triggers automatic Vercel deployment)
git push origin main
```

## Examples:

```bash
# Example 1: Bug fix
git add .
git commit -m "Fix user login issue on mobile devices"
git push origin main

# Example 2: New feature
git add .
git commit -m "Add export functionality to training reports"
git push origin main

# Example 3: UI improvements
git add .
git commit -m "Update dashboard styling and improve responsiveness"
git push origin main
```

## What Happens Automatically:

1. ✅ **GitHub** receives your code changes
2. ✅ **Vercel** detects the push automatically
3. ✅ **Vercel** builds your app (`npm run build`)
4. ✅ **Vercel** deploys to your live URL
5. ✅ **Live site** updates in 2-3 minutes

## Environment Variables:

- Already configured in Vercel ✅
- No need to update unless you change Supabase settings

## Rollback (if needed):

If something breaks, you can:
- Go to Vercel dashboard → your project → Deployments
- Click "Promote to Production" on a previous working version

## Tips:

- Always test locally first: `npm run dev`
- Write clear commit messages
- Deploy small changes frequently
- Check Vercel build logs if deployment fails