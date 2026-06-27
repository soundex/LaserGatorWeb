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

## Production password (Railway)

```bash
npm run hash-password -- your-strong-password
```

On Railway, set these variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD_HASH` | Full 60-char bcrypt hash from the command above |
| `TOKEN_SECRET` | Long random string |

**Do not** set `ADMIN_PASSWORD` on Railway — remove it if Railway auto-added it.

**Railway bcrypt tip:** Hashes contain `$` characters. Paste the entire hash as one value (e.g. `$2a$12$abcdef...`). If login still fails, wrap the value in double quotes in the Railway UI.

After changing variables, redeploy and check deploy logs for:
`Admin auth: bcrypt hash (60 chars)` — if you see `development plaintext` or the warning, the hash did not load.

## Project structure

| Path | Purpose |
|---|---|
| `public/` | Static HTML, CSS, JS served to browsers |
| `public/media/` | Uploaded images and videos (gitignored) |
| `data/` | `media-manifest.json` and `events.json` |
| `server.js` | Express server, upload API, auth |

## Adding media

1. Go to `/admin` and sign in
2. Drag a file onto the upload zone
3. Fill in title, category, and optional event tag
4. Click Upload — the gallery updates on next page load

## Contact form

Submissions are logged to `data/contact-log.json`. Wire up SMTP or a transactional email provider in `server.js` when ready for production email delivery.

## Deployment

Run behind HTTPS (Caddy, Cloudflare, or nginx). Keep the process alive with pm2 or NSSM on Windows:

```bash
pm2 start server.js --name lasergator
pm2 save
```

Back up `public/media/` and `data/` regularly — they are not in git.
