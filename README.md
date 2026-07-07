# LaserGator Website

Marketing site for [laser-gator.com](https://laser-gator.com) with an admin panel for uploading gallery media and managing events.

## Quick start

```bash
npm install
cp .env.example .env   # edit password and secrets
npm start
```

Open [http://localhost:3000](http://localhost:3000).

- **Admin panel:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Default dev password:** `changeme` (set in `.env`)

## Environments and data boundaries

| Environment | Code source | Gallery media & events source |
|---|---|---|
| **Local** | Your workspace | Local `data/` + `public/media/` only — never committed to git |
| **Staging** | Git CI/CD deploy | Staging Railway volumes + admin upload or import |
| **Production** | Git CI/CD deploy | Production Railway volumes + admin upload or import from staging |

**Git promotes code only.** Runtime JSON (`data/media-manifest.json`, `data/events.json`) and uploaded media (`public/media/`) are environment-local.

Committed seed templates (safe to deploy):

- `data/media-manifest.example.json`
- `data/events.example.json`

On first boot, the server copies these to runtime files if missing.

## Production password (Railway)

```bash
npm run hash-password -- your-strong-password
```

On Railway, set these variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ENV` | `staging` or `production` (used in export metadata) |
| `ADMIN_PASSWORD_HASH` | Full 60-char bcrypt hash from the command above |
| `TOKEN_SECRET` | Long random string |

**Do not** set `ADMIN_PASSWORD` on Railway — remove it if Railway auto-added it.

After changing variables, redeploy and check deploy logs for:
`Admin auth: bcrypt hash (60 chars)`

## Railway volumes (staging and production)

Attach **separate volumes** to each Railway service so uploads survive redeploys:

| Mount path | Purpose |
|---|---|
| `/data` | `media-manifest.json`, `events.json`, `contact-log.json`, backups |
| `/public/media` | Uploaded images and videos |

Set these Railway **variables** to match the mount paths:

```
DATA_DIR=/data
MEDIA_ROOT=/public/media
```

Without `DATA_DIR`, the app writes to `./data` inside the container (not the volume), which can fail on Railway or lose submissions on redeploy.

Staging and production must use **different volumes** so staging experiments never overwrite live content.

## Content promotion workflow

### Staging → Production (primary path)

1. Curate gallery media and events on **staging** (admin upload or import).
2. On staging admin, open **Export / Import** → **Download Content Bundle**.
3. On production admin, **Import Content Bundle** (merge or replace).
4. Verify gallery and events on production.

### Local → Staging (optional, intentional only)

Local dev data must not reach staging via git. When needed:

```bash
npm run export-content              # writes to exports/lasergator-content-YYYY-MM-DD.zip
# Upload the zip to staging admin → Import (merge)
```

Or copy the zip manually and run on a machine with staging access:

```bash
npm run import-content -- path/to/bundle.zip merge
```

### Import modes

| Mode | Behavior |
|---|---|
| **merge** | Add new manifest/events entries; skip duplicates by `id`; copy new media files |
| **replace** | Overwrite manifest and events; copy all media files (requires `REPLACE` confirmation in admin) |

## NPM scripts

| Script | Purpose |
|---|---|
| `npm start` | Run the site |
| `npm run hash-password -- <password>` | Generate bcrypt hash for Railway |
| `npm run export-content [dir]` | Export content bundle zip (default: `exports/`) |
| `npm run import-content -- <file.zip> [merge\|replace]` | Import content bundle via CLI |
| `npm run validate-manifest` | Remove manifest entries whose media files are missing |

## Project structure

| Path | Purpose |
|---|---|
| `public/` | Static HTML, CSS, JS served to browsers |
| `public/media/` | Uploaded images and videos (gitignored, volume on Railway) |
| `data/*.example.json` | Seed templates committed to git |
| `data/media-manifest.json` | Runtime gallery metadata (gitignored) |
| `data/events.json` | Runtime events data (gitignored) |
| `lib/content-bundle.js` | Export/import and manifest integrity logic |
| `server.js` | Express server, upload API, auth |

## Adding media

1. Go to `/admin` and sign in
2. Drag a file onto the upload zone
3. Fill in title, category, and optional event tag
4. Click Upload — the gallery updates on next page load

Team headshots belong in `public/assets/` for the About page, not the gallery upload.

## Manifest integrity

On every server start, entries referencing missing media files are automatically pruned. Run manually:

```bash
npm run validate-manifest
```

## Contact form

Submissions are always logged to `data/contact-log.json`. When SMTP is configured, the server also emails the team via nodemailer (same pattern as Gigigator and ShowMageddon).

Set these environment variables on Railway (or in `.env` locally):

| Variable | Example | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Google SMTP host |
| `SMTP_PORT` | `587` | Use `465` with `SMTP_SECURE=true` for SSL |
| `SMTP_SECURE` | `false` | `true` for port 465 |
| `SMTP_USER` | `your-account@laser-gator.com` | Google account used to send |
| `SMTP_PASSWORD` | *(app password)* | Google App Password — not your login password |
| `SMTP_FROM_EMAIL` | `paul@laser-gator.com` | From address shown to recipients |
| `SMTP_FROM_NAME` | `LaserGator Website` | Display name in inbox |
| `CONTACT_TO` | `paul@laser-gator.com,milo@laser-gator.com` | Comma-separated recipients |

`SMTP_PASS` is also accepted as an alias for `SMTP_PASSWORD` (ShowMageddon compatibility). `SMTP_FROM` is accepted as an alias for `SMTP_FROM_EMAIL`.

### Google setup

1. Enable 2-Step Verification on the Google account.
2. Create an [App Password](https://myaccount.google.com/apppasswords) for “Mail”.
3. Use `smtp.gmail.com`, port `587`, and the app password as `SMTP_PASSWORD`.

If SMTP is not configured, the form still accepts submissions and logs them locally. In production, the server logs a startup warning until SMTP is set.

### Email diagnostics (admin)

After deploying, open **Admin → Email** to confirm SMTP is wired correctly:

1. **Status** — shows whether required env vars are set, masked SMTP user, from address, and `CONTACT_TO` recipients.
2. **Run SMTP Verify** — checks the server can connect and authenticate to your SMTP host (no email sent).
3. **Send Test Email** — delivers a test message to `CONTACT_TO` (or an optional address you enter).
4. **Email Log** — recent events (startup checks, contact sends, verifications, test emails) stored in `data/email-log.json` on the Railway volume.

Use this tab after each deploy or when changing SMTP credentials on Railway.

## Deployment

Run behind HTTPS (Caddy, Cloudflare, or nginx). Keep the process alive with pm2 or NSSM on Windows:

```bash
pm2 start server.js --name lasergator
pm2 save
```

Back up Railway volumes (or run regular export bundles) — runtime data is not in git.

## CI guard

GitHub Actions fails the build if `data/media-manifest.json` or `data/events.json` are accidentally committed.
