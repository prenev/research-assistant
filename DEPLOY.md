# Free hosting (Render + Neon)

The whole site (API, React app, admin) runs as **one** free web service on Render. The data lives in a
free Neon Postgres database. It is login-only: nothing is readable without the username and password
you choose, and there is no sign-up page. Total cost: £0, no card needed for either service.

Why this pair: Render's own free Postgres is deleted after 30 days. Neon's free database does not expire.

## 1. Database (Neon), about 3 minutes
1. Sign up at https://neon.tech and create a project (pick a region near you).
2. Copy the **connection string** (it starts with `postgresql://`). Keep it private.

## 2. Web service (Render), about 10 minutes
1. Sign up at https://render.com using your GitHub account and allow access to `prenev/research-assistant`.
2. **New → Blueprint**, choose the repository and the branch to deploy. Render reads `render.yaml`.
3. When asked, fill in the three secrets:
   - `DATABASE_URL`: the Neon connection string
   - `OWNER_USERNAME`: the username you will log in with
   - `OWNER_PASSWORD`: a long, unique password (12+ characters; a passphrase works well)
4. Apply. The first build takes about 5 minutes (installs, builds the site, creates tables, loads the
   seed data, creates your account). Then open `https://ftd-notebook.onrender.com` (or the URL Render shows)
   and log in.

Later deploys happen automatically when you push to the chosen branch.

## What to know about the free tier
- **It sleeps after 15 minutes of no visits.** The next visit takes about 30 to 60 seconds to wake up.
- **Uploaded images do not persist.** Render's free disk is wiped on every restart or deploy. All text,
  papers, findings, notes and history are safe in Postgres, but images added in the editor will break.
  Avoid image uploads on the free tier, or ask for object-storage support (e.g. Cloudflare R2's free tier).
- **Keep your own backups.** Settings → *Download full backup (JSON)* regularly. Neon's free plan has
  limited point-in-time restore.
- Neon's free database has 0.5 GB of storage, which is plenty for notes and literature.
- Free instances have a monthly hour allowance (750 h). One always-sleepy site fits easily.

## Protein background (Wikipedia)
The server fetches protein articles from Wikipedia, which the free hosts allow (outbound web access).
The first view of each protein takes a second or two; later views come from a one-day cache. The cache
is in memory, so it resets when the free instance restarts.

## Changing the password later
Log in at `/admin/`, open *Users*, and change it. It will **not** be overwritten on the next deploy.
To force-reset from the environment instead, set `OWNER_RESET_PASSWORD=1` with a new `OWNER_PASSWORD`,
deploy once, then remove `OWNER_RESET_PASSWORD`.

## Data policy
Do not put UK Biobank participant-level data on any hosted service. Only literature, plans, notes and
permitted aggregate results belong here. See the Data policy page in the site.

## Running the production build locally
```bash
export DATABASE_URL=sqlite:////tmp/ftd.sqlite3 SECRET_KEY=any-long-random-string \
       OWNER_USERNAME=me OWNER_PASSWORD=a-long-password DJANGO_SETTINGS_MODULE=config.settings.prod
./build.sh
cd backend && SECURE_SSL_REDIRECT=0 gunicorn config.wsgi --bind 127.0.0.1:8001
```
