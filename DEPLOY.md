# DEPLOY.md — free hosting

The build is fully static (`apps/web/dist`) with a relative base path, so it works on any
static host including subpath hosting (GitHub Pages) without configuration changes.

## Option A — Vercel (recommended: clean URL, zero config)

One-time setup:

```powershell
npm i -g vercel
vercel login            # opens browser
```

Deploy (run from the repo root):

```powershell
npm run build
vercel deploy apps/web/dist --prod --yes
```

That's it — Vercel prints the production URL. Subsequent deploys are the same two commands.

## Option B — GitHub Pages

One-time setup: create a GitHub repo and push, then enable Pages with the "GitHub Actions"
source (repo Settings ▸ Pages ▸ Source: GitHub Actions). A ready workflow is committed at
`.github/workflows/deploy.yml` — it builds and publishes on every push to `main`.

```powershell
git remote add origin https://github.com/<you>/daily-logic.git
git push -u origin main
```

The site appears at `https://<you>.github.io/daily-logic/` after the first action run.
Because the app uses hash-free internal navigation (single page, no routes), no 404 fallback
is needed.

## After deploying

1. Open the URL on your phone, play a puzzle, then turn on airplane mode and reload —
   it must keep working (service worker).
2. Optional: update the share-card URL in `apps/web/src/lib/share.ts`
   (`https://daily-logic.app`) to your real URL and redeploy.
