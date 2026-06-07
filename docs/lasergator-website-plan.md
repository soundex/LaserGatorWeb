# LaserGator Website — Rebuild Plan

> **Target location:** `D:\Repos\LaserGator\LaserGatorWeb\` (this repo)
> **Date:** June 2026 | **Replacing:** Wix-hosted site at laser-gator.com

---

## 1. Current Site Analysis

### What exists today

| Page | Status | Issues |
|---|---|---|
| Home | Minimal — logo + a couple of images | No hero, no CTA, nothing compelling |
| Services | 4 service cards, one quote, two CTAs | Small images, weak layout, no icons |
| Gallery / About | Combined — videos, team bios, photo grid, testimonials | Overcrowded; gallery is just a flat grid |
| Contact | Phone, email, basic form | No map, no social links |
| Events | **Completely empty** | The whole page is blank |

### Core problems

1. **Built on Wix** — no control over code, hosting, or performance
2. **Gallery and About crammed together** — navigation is confusing
3. **Events page is dead** — a missed opportunity for recurring traffic
4. **Media is static** — adding a photo or video requires logging into Wix and redeploying
5. **Design is dated** — generic template with no personality matching a laser show company
6. **No mobile-first thinking** evident in layout
7. **No SEO foundation** — Wix meta, no structured data for events or services

### What to keep / carry forward

- Brand name: **LaserGator**
- Logo asset (the gator + text)
- All four services: Live Events, Strategy & Concept, Music Services, Live Streaming
- Team bios: Paul Mehner (CEO / Laserist) and Milo Matthews (Manager / Laserist)
- Contact info: phones, paul@ and milo@ emails
- Testimonial: Lance McKay / Epic Queen quote
- All existing video and photo content (to be re-imported)

---

## 2. Design Direction

### Theme: **Dark Electric**

This is a laser show company. The site should feel like walking into a concert in progress — dramatic, immersive, alive.

| Element | Choice | Rationale |
|---|---|---|
| Background | Near-black (`#050508`) with subtle noise grain | Mimics a dark venue |
| Primary accent | Electric cyan `#00FFEE` | Laser beam color |
| Secondary accent | Hot magenta `#FF0080` | Second laser color |
| Tertiary | Neon lime `#AAFF00` | Third beam color used sparingly |
| Surfaces | Dark charcoal `#10121A` with semi-transparent overlays | Layered depth |
| Display font | **Bebas Neue** — condensed, technical, dramatic | Concert posters aesthetic |
| Body font | **DM Sans** — clean, readable at any size | Modern, not generic |
| Motion | Glow pulses, scan-line hovers, staggered fade-ins | Matches laser light behavior |

> **Accessibility note:** Cyan/magenta on near-black can fail WCAG contrast for body text. Use accents for headlines, borders, and icons; keep body copy in high-contrast white/off-white. Honor `prefers-reduced-motion` by disabling beam animations and staggered fades.

### Visual signature

- The **LaserGator logo glows** — a subtle CSS pulse animation on the logo mark
- **Scanline hover effect** on cards — a thin bright line sweeps across on hover
- **Section separators** are diagonal cuts, not horizontal lines
- Hero has a **slow-moving beam animation** built in pure CSS SVG

---

## 3. Site Structure

### Pages

```
Home          /index.html
Services      /services.html
Gallery       /gallery.html          ← Split out from About
About         /about.html            ← Team + story only
Events        /events.html           ← Populated from events.json
Contact       /contact.html
Admin         /admin.html            ← Password-protected, not in nav
```

### Navigation

```
[LOGO]   Home   Services   Gallery   About   Events   Contact   [BOOK NOW →]
```

**BOOK NOW** links to `/contact.html` with a `#book` anchor (or pre-filled subject via query string).

---

## 4. Folder Structure

```
D:\Repos\LaserGator\LaserGatorWeb\

├── server.js                    # Node.js/Express server entry point
├── package.json                 # Dependencies
├── .env                         # Secrets — never committed to git
├── .env.example                 # Committed template for required env vars
├── .gitignore

├── public/                      # All files served to the browser
│   ├── index.html
│   ├── services.html
│   ├── gallery.html
│   ├── about.html
│   ├── events.html
│   ├── contact.html
│   ├── admin.html               # Upload panel (auth-gated)
│   ├── robots.txt
│   ├── sitemap.xml              # Static or generated at deploy
│   │
│   ├── css/
│   │   ├── variables.css        # All CSS custom properties / design tokens
│   │   ├── main.css             # Global layout, nav, footer, typography
│   │   ├── home.css
│   │   ├── services.css
│   │   ├── gallery.css
│   │   ├── about.css
│   │   ├── events.css
│   │   ├── contact.css
│   │   └── admin.css
│   │
│   ├── js/
│   │   ├── main.js              # Nav toggle, scroll effects, shared utils
│   │   ├── gallery.js           # Fetches manifest, renders media, lightbox
│   │   ├── events.js            # Fetches events.json, renders cards
│   │   └── admin.js             # Upload UI, auth, manifest refresh
│   │
│   ├── assets/                  # Static brand assets — committed to git
│   │   ├── logo.svg             # Vector logo
│   │   ├── logo-glow.png        # Pre-rendered glow version
│   │   ├── favicon.ico
│   │   └── og-image.jpg         # Social share card (1200×630)
│   │
│   └── media/                   # ← USER-UPLOADED content — gitignored
│       ├── images/
│       │   └── (uploaded .jpg/.png/.webp files land here)
│       └── videos/
│           └── (uploaded .mp4/.webm files land here)

└── data/                        # JSON data files — server reads/writes these
    ├── media-manifest.json      # Auto-updated on every upload/delete
    └── events.json              # Events data (add/edit via admin panel)
```

> **Why gitignore `public/media/`?** Git is for code, not binary media.
> Large video files bloat the repo. The admin upload system manages these
> files independently of deployments.
>
> **Backup requirement:** Because media lives outside git, schedule regular backups of `public/media/` and `data/` (see Section 13).

---

## 5. Backend — Node.js / Express Server

The server has two responsibilities:

1. **Serve static files** from `public/`
2. **Provide an upload API** that writes files to `public/media/` and updates `data/media-manifest.json`

### Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "multer": "^1.4.x",
    "dotenv": "^16.x",
    "sharp": "^0.33.x",
    "helmet": "^7.x",
    "express-rate-limit": "^7.x"
  },
  "optionalDependencies": {
    "fluent-ffmpeg": "^2.x",
    "@ffmpeg-installer/ffmpeg": "^1.x"
  }
}
```

| Package | Purpose |
|---|---|
| `express` | HTTP server + routing |
| `multer` | Handles multipart file uploads |
| `dotenv` | Loads `.env` for admin password, port |
| `sharp` | Auto-generates thumbnails for uploaded images |
| `helmet` | Security headers (CSP, HSTS when behind HTTPS) |
| `express-rate-limit` | Brute-force protection on `/api/admin/login` |
| `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` | *(Optional)* Extract video poster frames and duration |

### API Routes

| Method | Path | Auth | Action |
|---|---|---|---|
| `GET` | `/` | Public | Serves `index.html` |
| `GET` | `/admin` | Public | Redirects to `/admin.html` |
| `GET` | `/health` | Public | Returns `{ status: "ok" }` for uptime checks |
| `GET` | `/data/media-manifest.json` | Public | Returns media manifest |
| `GET` | `/data/events.json` | Public | Returns events list |
| `POST` | `/api/contact` | Public | *(Phase 2+)* Sends contact form email |
| `POST` | `/api/admin/login` | — | Validates password, returns session token |
| `POST` | `/api/upload` | Token | Saves file, generates thumbnail, updates manifest |
| `DELETE` | `/api/media/:filename` | Token | Removes file, updates manifest |
| `POST` | `/api/events` | Token | Adds or updates an event |
| `DELETE` | `/api/events/:id` | Token | Removes an event |

### Authentication

Simple token-based auth — no database required:

1. Admin visits `/admin` (redirects to `/admin.html`)
2. Enters password from `.env` → `ADMIN_PASSWORD=your-secret-here`
3. Server compares against a **bcrypt hash** stored in `.env` (`ADMIN_PASSWORD_HASH=...`), returns a **signed HMAC token** (8hr TTL)
4. Token is stored in `sessionStorage` on the browser
5. Every upload request sends `Authorization: Bearer <token>`
6. On server restart, all tokens expire (acceptable for this use case)
7. Login endpoint is rate-limited (e.g. 5 attempts per 15 minutes per IP)

> **Do not** store the plaintext password in `.env` on the production machine long-term. Generate the hash once locally, commit only `.env.example`, and deploy the hash.

### `.env` file (never commit this)

```env
PORT=3000
ADMIN_PASSWORD_HASH=$2b$12$...   # bcrypt hash, not plaintext
TOKEN_SECRET=random-256-bit-secret-here
MAX_UPLOAD_MB=500
NODE_ENV=production
```

### Data write safety

JSON updates (`media-manifest.json`, `events.json`) must use **atomic writes**: write to a temp file, then rename. Optionally snapshot the previous version to `data/backups/` before overwriting. Prevents corruption if the process crashes mid-write.

### Upload validation

- Whitelist extensions **and** verify MIME type
- Sanitize filenames (strip path segments, normalize to safe ASCII)
- Reject `DELETE` targets outside `public/media/`
- For videos: accept upload even if ffmpeg is unavailable; poster generation becomes a manual admin step or a background job

---

## 6. Media Manifest Format

`data/media-manifest.json` is the bridge between uploads and the frontend gallery. It's auto-maintained by the server.

```json
{
  "lastUpdated": "2026-06-01T20:00:00Z",
  "images": [
    {
      "id": "img_1717200000_abc123",
      "filename": "epic-queen-show-2026.jpg",
      "thumbnail": "thumb_epic-queen-show-2026.jpg",
      "title": "Epic Queen — April 2026",
      "category": "Live Show",
      "eventTag": "Epic Queen",
      "uploadedAt": "2026-04-30T22:00:00Z",
      "width": 4000,
      "height": 3000
    }
  ],
  "videos": [
    {
      "id": "vid_1717200001_def456",
      "filename": "anthem-rush-tribute-2025.mp4",
      "poster": "poster_anthem-rush-tribute-2025.jpg",
      "title": "Anthem — Nothing Shocking",
      "duration": 62,
      "category": "Live Show",
      "eventTag": "Anthem",
      "uploadedAt": "2025-11-15T20:00:00Z"
    }
  ]
}
```

---

## 7. Events Data Format

`data/events.json` — edited via admin panel or directly.

```json
{
  "events": [
    {
      "id": "evt_001",
      "title": "LaserGator Festival 2026",
      "startAt": "2026-08-15T19:00:00-07:00",
      "venue": "TBD — Pacific Northwest",
      "description": "The third annual LaserGator Festival. Full laser show with live bands.",
      "ticketUrl": "https://example.com/tickets",
      "isFeatured": true,
      "status": "upcoming"
    }
  ]
}
```

> **Change from original plan:** Use a single ISO 8601 `startAt` field (with timezone) instead of separate `date` + `time` strings. Avoids sorting bugs and simplifies JSON-LD `Event` schema.

---

## 8. Page-by-Page Specifications

### 8.1 Home (`index.html`)

**Sections:**
1. **Full-viewport hero** — animated laser beam SVG background, headline fades in, "Book Your Show" CTA
2. **3-stat bar** — "13+ years", "Laser Safety Certified", "FDA Variance Approved" — scanline hover
3. **Services teaser** — 4 cards with SVG icons (not emoji), links to `/services.html`
4. **Video reel** — one featured video from manifest (most recent), autoplay muted loop with poster fallback
5. **Testimonial** — Lance McKay / Epic Queen quote, large with electric accent
6. **Footer CTA** — "Ready to light up your event?" + Book button

### 8.2 Services (`services.html`)

**Sections:**
1. **Page hero** — "OUR SERVICES" headline, diagonal background cut
2. **4 service cards** — full descriptions, relevant SVG icons, glow on hover:
   - Live Events — Custom indoor/outdoor laser shows
   - Strategy & Concept — Logo integration, setlist choreography
   - Music Services — Entertainers catalog connection
   - Live Streaming — Multi-camera, social broadcast, edited copy
3. **Quote block** — the "We believe a laser show..." paragraph
4. **CTA row** — "Let's Talk" + "See Our Gallery"

### 8.3 Gallery (`gallery.html`)

**Sections:**
1. **Filter bar** — All | Images | Videos | [dynamic event tags from manifest]
2. **Masonry grid** — images and video thumbnails load from manifest
3. **Lightbox** — click any item opens full-screen viewer (images zoom, videos play); keyboard Esc/arrow support
4. **Load more pagination** — 24 items per page (prefer over infinite scroll for performance)
5. **Upload hint** — small note: "New media added regularly — check back soon"

**Key behavior:** On page load, `gallery.js` fetches `/data/media-manifest.json`, builds the grid dynamically. Filter buttons filter client-side. Images use `loading="lazy"`. No page reload needed.

### 8.4 About (`about.html`)

**Sections:**
1. **Company story** — Paul's origin story (8th grade, Laserium, 1980s), condensed timeline
2. **Certifications callout** — LSO certified, FDA Variance, ILDA standards
3. **Team cards** — Paul Mehner + Milo Matthews with photos, titles, short bios
4. **Testimonials carousel** — Lance McKay + space for more

### 8.5 Events (`events.html`)

**Sections:**
1. **Upcoming events** — loaded from `events.json`, cards with date/venue/ticket link
2. **Past events** — collapsed section with past event list
3. **Empty state** — if no events: "Check back soon — we're always booking new shows"

**Key behavior:** `events.js` fetches `/data/events.json`, separates upcoming vs past by `startAt`, renders the two lists. Admin can add events without touching code.

### 8.6 Contact (`contact.html`)

**Sections:**
1. **Split layout** — left: contact info + social links; right: form
2. **Contact info** — Milo: 907-343-9163 / Paul: 360-789-4424, both emails as clickable links
3. **Contact form** — Name, Email, Event Date, Venue, Message, Submit
4. **Form handling** — `POST /api/contact` via Nodemailer or a transactional provider (Resend, SendGrid). Avoid `mailto:` as the primary path — it breaks on mobile and has no spam protection.
5. **Mailing list signup** — defer until a provider is chosen (Buttondown, Mailchimp, etc.); placeholder UI only in v1 if needed

### 8.7 Admin Panel (`admin.html`)

**Sections:**
1. **Login gate** — password field, enter to unlock the panel
2. **Upload area** — drag-and-drop zone + file picker; accepts `.jpg`, `.png`, `.webp`, `.mp4`, `.webm`
3. **Metadata form** — appears after file select: Title, Category, Event Tag
4. **Upload progress** — progress bar, success/error state
5. **Media library** — lists current manifest entries with delete buttons
6. **Events editor** — form to add/edit events in events.json
7. **Access** — URL is `/admin` — not linked in nav, shared privately with Paul and Milo

---

## 9. Implementation Phases

### Phase 0 — Content inventory (before Week 1)

- [ ] Crawl/export all assets from the current Wix site (images, videos, copy)
- [ ] Document social profile URLs to include on Contact
- [ ] Confirm which certifications/stat claims are accurate and citable
- [ ] Decide hosting target: home Windows box, VPS, or PaaS (Railway, Fly.io)

### Phase 1 — Foundation (Week 1)

- [ ] Set up `package.json`, install dependencies
- [ ] Write `server.js` — static file serving + `/health` route
- [ ] Create `variables.css` with full design token set
- [ ] Build shared nav and footer (included via JS template literals)
- [ ] Scaffold all 7 HTML pages with correct `<head>` blocks (title, description, OG tags per page)

### Phase 2 — Static Pages (Week 2)

- [ ] Build and style `index.html` — hero animation, stats bar, service teaser, testimonial
- [ ] Build and style `services.html` — full service cards
- [ ] Build and style `about.html` — story, team, certifications
- [ ] Build and style `contact.html` — form + contact info
- [ ] Add `POST /api/contact` endpoint (or integrate Formspree as a zero-backend interim)

### Phase 3 — Dynamic Gallery & Events (Week 3)

- [ ] Import Wix media into `public/media/` and seed `media-manifest.json`
- [ ] Write `gallery.js` — fetch, render, filter, lightbox
- [ ] Build and style `gallery.html`
- [ ] Seed `events.json` with any known shows
- [ ] Write `events.js` — fetch, sort, render upcoming vs past
- [ ] Build and style `events.html`

### Phase 4 — Admin Upload System (Week 4)

- [ ] Write upload API routes in `server.js` (multer, sharp thumbnails)
- [ ] Write auth routes + token validation middleware
- [ ] Write manifest update logic (add/remove entries, atomic writes)
- [ ] Write events CRUD API
- [ ] Build and style `admin.html` — login, drag-drop upload, media library, events editor
- [ ] Write `admin.js` — all client-side admin interactions

### Phase 5 — Polish & Deploy (Week 5)

- [ ] Cross-browser testing (Chrome, Firefox, Edge, Safari)
- [ ] Mobile responsive audit (320px to 1440px)
- [ ] Lighthouse audit — target 90+ on Performance, Accessibility, SEO
- [ ] Add JSON-LD (`LocalBusiness`, `Event`), `sitemap.xml`, `robots.txt`
- [ ] HTTPS + reverse proxy (Caddy or Cloudflare in front of Node)
- [ ] DNS cutover plan from Wix → new host (lower TTL 24h before switch)
- [ ] Write deployment / startup docs (`README.md`)
- [ ] Set up process manager (pm2 or NSSM on Windows) + backup script for `data/` and `public/media/`

---

## 10. Running the Site

Once built, the site runs with:

```bash
cd D:\Repos\LaserGator\LaserGatorWeb
npm install
node server.js
# → Listening on http://localhost:3000
```

For production (always-on without a terminal open):

```bash
# Option A: pm2 (cross-platform)
npm install -g pm2
pm2 start server.js --name lasergator
pm2 startup
pm2 save

# Option B: NSSM (often more reliable on Windows Server)
# Wrap node server.js as a Windows Service via nssm install lasergator ...
```

Put **Caddy** or **nginx** in front for automatic HTTPS if the box is internet-facing.

---

## 11. Adding Media Without Deployment

Once the site is running, Paul or Milo can add new photos or videos by:

1. Navigating to `http://localhost:3000/admin` (or the live domain `/admin`)
2. Entering the admin password
3. Dragging and dropping image or video files onto the upload zone
4. Filling in a title, category, and optional event tag
5. Clicking **Upload**

The server will:
- Save the file to `public/media/images/` or `public/media/videos/`
- Generate a compressed thumbnail automatically (via `sharp` for images)
- Append the new entry to `data/media-manifest.json`

The gallery page will immediately show the new media on next load — **no code change, no Git push, no redeployment required.**

---

## 12. Technology Summary

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript | No build step, easy to maintain, fast |
| Server | Node.js 20 LTS + Express 4 | Lightweight, runs on Windows, widely known |
| File upload | Multer | De-facto standard for Node multipart |
| Image processing | Sharp | Fast native thumbnail generation |
| Video processing | ffmpeg *(optional)* | Poster frames and duration metadata |
| Auth | HMAC token (no DB) | Simple, stateless, no extra services |
| Media storage | Local filesystem | No cloud cost, files stay on your machine |
| Process manager | pm2 or NSSM | Keeps site running after terminal closes |
| Fonts | Google Fonts (Bebas Neue + DM Sans) | CDN-served, reliable, zero setup |
| HTTPS | Caddy / Cloudflare / nginx | Required for production; enables HSTS |

---

## 13. Plan Revisions & Recommendations

*Reviewed June 2026. Items below adjust the original Claude draft based on repo alignment, production readiness, and maintainability.*

### Repo & path alignment

| Original | Revised |
|---|---|
| `D:\Repos\LaserGator\WebSite\` | `D:\Repos\LaserGator\LaserGatorWeb\` (this repo) |

Build here unless there is a deliberate reason to keep a separate `WebSite` folder.

### What was already strong

- **Dark Electric** design direction fits the brand well
- **Splitting Gallery from About** fixes the biggest IA problem on the Wix site
- **JSON manifest + admin upload** is the right complexity level for a two-person team
- **Vanilla stack** avoids build tooling overhead for a mostly-static marketing site
- **Phased delivery** is realistic

### High-priority adjustments (incorporated above)

1. **Phase 0 content inventory** — don't wait until Week 5 to pull Wix assets; gallery and home video reel depend on them
2. **Video poster generation** — `sharp` only handles images; add ffmpeg (or manual poster upload in admin) for video thumbnails
3. **Atomic JSON writes + backups** — file-based storage needs crash-safe writes and a backup cadence
4. **Security hardening** — bcrypt password hash, rate-limited login, `helmet`, upload MIME validation, path traversal checks
5. **Contact form** — replace `mailto:` with a server endpoint or Formspree early in Phase 2
6. **ISO event dates** — single `startAt` field with timezone for sorting and schema.org
7. **SEO as a first-class task** — per-page meta, JSON-LD, sitemap, and robots.txt in Phase 5 (ideally scaffolded in Phase 1)
8. **HTTPS / DNS cutover** — plan for TLS and Wix migration before go-live

### Medium-priority recommendations

| Topic | Recommendation |
|---|---|
| **Hosting** | If the site must stay up while traveling, consider a $5–7/mo VPS or Railway instead of a home PC. Local hosting is fine for dev/staging. |
| **Media backup** | Weekly robocopy or restic job for `public/media/` + `data/` to external drive or cloud bucket |
| **Mailing list** | Don't ship a non-functional subscribe button — either wire a provider or omit until ready |
| **Social links** | Inventory Facebook/Instagram/YouTube/etc. from Wix and add to Contact + footer |
| **Service icons** | Use inline SVGs matching the laser aesthetic instead of emoji |
| **Gallery pagination** | Prefer "load more" over infinite scroll — simpler and lighter with large video collections |
| **Video streaming** | Ensure Express serves video with range-request support (built into `express.static`) |
| **Shared nav/footer** | JS template literals work; if duplication becomes painful, a 20-line build script or `<fetch>` partial is enough — no need for React |
| **Analytics** | Add privacy-friendly analytics (Plausible, Fathom, or GA4) before DNS cutover to measure traffic drop during migration |

### Lower priority / future enhancements

- Cloud object storage (S3/R2) if media volume outgrows local disk
- WebP/AVIF conversion pipeline on image upload (sharp can do this)
- CMS-style markdown for blog posts or news (only if you plan to publish regularly)
- Calendar feed (iCal) generated from `events.json`
- Staging subdomain (`staging.laser-gator.com`) for preview before cutover

### Risks to watch

1. **Single-server filesystem** — disk full, no redundancy; mitigate with monitoring and backups
2. **Admin password in browser sessionStorage** — acceptable for two trusted users; don't share the URL publicly
3. **500 MB upload limit** — fine for short show reels; document max recommended length/resolution
4. **Contrast / motion accessibility** — test with Lighthouse and real devices; cyan body text will fail audits

---

*Plan prepared June 2026. Revised after technical review. Ready to begin implementation on any phase.*
