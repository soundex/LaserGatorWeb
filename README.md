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

## Production password

```bash
npm run hash-password -- your-strong-password
```

Add the output hash to `.env` as `ADMIN_PASSWORD_HASH` and remove `ADMIN_PASSWORD`.

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
