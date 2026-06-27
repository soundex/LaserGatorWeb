'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const multer = require('multer');
const sharp = require('sharp');

dotenv.config();

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const MEDIA_IMAGES = path.join(PUBLIC_DIR, 'media', 'images');
const MEDIA_VIDEOS = path.join(PUBLIC_DIR, 'media', 'videos');
const MANIFEST_PATH = path.join(DATA_DIR, 'media-manifest.json');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');
const CONTACT_LOG_PATH = path.join(DATA_DIR, 'contact-log.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const PORT = Number(process.env.PORT) || 3000;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 500;
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.webm']);

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));

ensureDirs();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const isVideo = VIDEO_TYPES.has(file.mimetype);
    cb(null, isVideo ? MEDIA_VIDEOS : MEDIA_IMAGES);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, `${safe}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = isAllowedImage(file, ext);
    const isVideo = VIDEO_TYPES.has(file.mimetype) && VIDEO_EXT.has(ext);
    if (isImage || isVideo) return cb(null, true);
    cb(new Error('Only .jpg, .png, .webp, .avif, .mp4, and .webm files are allowed.'));
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

app.use('/data', express.static(DATA_DIR, {
  fallthrough: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.use(express.static(PUBLIC_DIR));

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required.' });
    }

    const valid = await verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const token = createToken();
    res.json({ token, expiresIn: TOKEN_TTL_MS });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { title, category, eventTag } = req.body;
    if (!title?.trim()) {
      await safeUnlink(req.file.path);
      return res.status(400).json({ error: 'Title is required.' });
    }

    const isVideo = VIDEO_TYPES.has(req.file.mimetype);
    const manifest = await readJson(MANIFEST_PATH, { lastUpdated: null, images: [], videos: [] });
    const id = `${isVideo ? 'vid' : 'img'}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const entry = {
      id,
      filename: req.file.filename,
      title: title.trim(),
      category: (category || 'Live Show').trim(),
      eventTag: (eventTag || '').trim(),
      uploadedAt: new Date().toISOString(),
    };

    if (isVideo) {
      entry.poster = null;
      entry.duration = null;
      manifest.videos.unshift(entry);
    } else {
      const thumbName = `thumb_${req.file.filename.replace(/\.[^.]+$/, '.webp')}`;
      const thumbPath = path.join(MEDIA_IMAGES, thumbName);
      const meta = await sharp(req.file.path)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(thumbPath);

      entry.thumbnail = thumbName;
      entry.width = meta.width;
      entry.height = meta.height;
      manifest.images.unshift(entry);
    }

    manifest.lastUpdated = new Date().toISOString();
    await writeJsonAtomic(MANIFEST_PATH, manifest);

    res.json({ success: true, entry });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.file?.path) await safeUnlink(req.file.path);
    res.status(500).json({ error: err.message || 'Upload failed.' });
  }
});

app.delete('/api/media/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const manifest = await readJson(MANIFEST_PATH, { images: [], videos: [] });

    let removed = removeFromManifest(manifest.images, id, MEDIA_IMAGES, true);
    if (!removed) {
      removed = removeFromManifest(manifest.videos, id, MEDIA_VIDEOS, false);
    }

    if (!removed) {
      return res.status(404).json({ error: 'Media item not found.' });
    }

    manifest.lastUpdated = new Date().toISOString();
    await writeJsonAtomic(MANIFEST_PATH, manifest);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

app.post('/api/events', requireAuth, async (req, res) => {
  try {
    const event = normalizeEventInput(req.body);
    const data = await readJson(EVENTS_PATH, { events: [] });

    const idx = data.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      data.events[idx] = event;
    } else {
      data.events.unshift(event);
    }

    await writeJsonAtomic(EVENTS_PATH, data);
    res.json({ success: true, event });
  } catch (err) {
    console.error('Save event error:', err);
    res.status(400).json({ error: err.message || 'Save failed.' });
  }
});

app.delete('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const data = await readJson(EVENTS_PATH, { events: [] });
    const before = data.events.length;
    data.events = data.events.filter((e) => e.id !== req.params.id);

    if (data.events.length === before) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    await writeJsonAtomic(EVENTS_PATH, data);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Delete failed.' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, eventDate, venue, message } = req.body;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const entry = {
      name: name.trim(),
      email: email.trim(),
      eventDate: (eventDate || '').trim(),
      venue: (venue || '').trim(),
      message: message.trim(),
      submittedAt: new Date().toISOString(),
    };

    const log = await readJson(CONTACT_LOG_PATH, []);
    log.unshift(entry);
    await writeJsonAtomic(CONTACT_LOG_PATH, log.slice(0, 200));

    res.json({ success: true, message: 'Thank you! We will be in touch soon.' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Could not send message. Please call us directly.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${MAX_UPLOAD_MB}MB limit.` : err.message });
  }
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Request failed.' });
  }
  next();
});

app.listen(PORT, () => {
  logAuthMode();
  console.log(`LaserGator site running at http://localhost:${PORT}`);
});

function ensureDirs() {
  for (const dir of [DATA_DIR, BACKUP_DIR, MEDIA_IMAGES, MEDIA_VIDEOS]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ lastUpdated: null, images: [], videos: [] }, null, 2));
  }
  if (!fs.existsSync(EVENTS_PATH)) {
    fs.writeFileSync(EVENTS_PATH, JSON.stringify({ events: [] }, null, 2));
  }
}

function getPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || '';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function logAuthMode() {
  const hash = getPasswordHash();
  if (hash) {
    console.log(`Admin auth: bcrypt hash (${hash.length} chars)`);
    return;
  }
  if (isProduction()) {
    console.warn('WARNING: ADMIN_PASSWORD_HASH is not set — admin login is disabled.');
    return;
  }
  console.log('Admin auth: development plaintext (ADMIN_PASSWORD or changeme)');
}

async function verifyPassword(password) {
  const hash = getPasswordHash();
  if (hash) {
    return bcrypt.compare(password, hash);
  }
  if (isProduction()) {
    return false;
  }
  const devPassword = process.env.ADMIN_PASSWORD?.trim() || 'changeme';
  return password === devPassword;
}

function createToken() {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp: expires })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp && Date.now() < data.exp;
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, data) {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  if (fs.existsSync(filePath)) {
    const backupName = `${path.basename(filePath, '.json')}-${Date.now()}.json`;
    await fsp.copyFile(filePath, path.join(BACKUP_DIR, backupName));
  }

  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, filePath);
}

function isAllowedImage(file, ext) {
  if (!IMAGE_EXT.has(ext)) return false;
  if (IMAGE_TYPES.has(file.mimetype)) return true;
  // Windows / some browsers report AVIF as octet-stream
  if (file.mimetype === 'application/octet-stream' && ext === '.avif') return true;
  return false;
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'upload';
}

function removeFromManifest(list, id, mediaDir, isImage) {
  const idx = list.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  const item = list[idx];
  list.splice(idx, 1);

  const files = [path.join(mediaDir, item.filename)];
  if (isImage && item.thumbnail) files.push(path.join(mediaDir, item.thumbnail));
  if (!isImage && item.poster) files.push(path.join(mediaDir, item.poster));

  for (const file of files) safeUnlink(file);
  return item;
}

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch {
    /* ignore */
  }
}

function normalizeEventInput(body) {
  const title = body.title?.trim();
  const startAt = body.startAt?.trim();
  if (!title || !startAt) throw new Error('Title and start date/time are required.');

  return {
    id: body.id?.trim() || `evt_${Date.now()}`,
    title,
    startAt,
    venue: (body.venue || '').trim(),
    description: (body.description || '').trim(),
    ticketUrl: (body.ticketUrl || '').trim(),
    isFeatured: Boolean(body.isFeatured),
    status: body.status === 'past' ? 'past' : 'upcoming',
  };
}
