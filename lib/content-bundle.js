'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');

const archiver = require('archiver');
const unzipper = require('unzipper');

function createPaths(root) {
  const publicDir = path.join(root, 'public');
  return {
    root,
    dataDir: path.join(root, 'data'),
    mediaImages: path.join(publicDir, 'media', 'images'),
    mediaVideos: path.join(publicDir, 'media', 'videos'),
    manifestPath: path.join(root, 'data', 'media-manifest.json'),
    manifestExamplePath: path.join(root, 'data', 'media-manifest.example.json'),
    eventsPath: path.join(root, 'data', 'events.json'),
    eventsExamplePath: path.join(root, 'data', 'events.example.json'),
  };
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, data, backupDir) {
  if (backupDir) {
    await fsp.mkdir(backupDir, { recursive: true });
    if (fs.existsSync(filePath)) {
      const backupName = `${path.basename(filePath, '.json')}-${Date.now()}.json`;
      await fsp.copyFile(filePath, path.join(backupDir, backupName));
    }
  }

  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, filePath);
}

async function seedRuntimeFile(targetPath, examplePath, fallback) {
  if (fs.existsSync(targetPath)) return false;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(examplePath)) {
    await fsp.copyFile(examplePath, targetPath);
  } else {
    await fsp.writeFile(targetPath, JSON.stringify(fallback, null, 2), 'utf8');
  }
  return true;
}

function entryFiles(item, isImage, paths) {
  const files = [];
  const mediaDir = isImage ? paths.mediaImages : paths.mediaVideos;
  if (item.filename) files.push(path.join(mediaDir, item.filename));
  if (isImage && item.thumbnail) files.push(path.join(paths.mediaImages, item.thumbnail));
  if (!isImage && item.poster) files.push(path.join(paths.mediaImages, item.poster));
  return files;
}

function isManifestEntryValid(item, isImage, paths) {
  const files = entryFiles(item, isImage, paths);
  return files.length > 0 && files.every(fileExists);
}

async function validateAndPruneManifest(paths, writeJsonFn) {
  const manifest = await readJson(paths.manifestPath, { lastUpdated: null, images: [], videos: [] });
  const beforeImages = manifest.images?.length || 0;
  const beforeVideos = manifest.videos?.length || 0;

  manifest.images = (manifest.images || []).filter((item) => isManifestEntryValid(item, true, paths));
  manifest.videos = (manifest.videos || []).filter((item) => isManifestEntryValid(item, false, paths));

  const removed = (beforeImages - manifest.images.length) + (beforeVideos - manifest.videos.length);
  if (removed > 0) {
    manifest.lastUpdated = new Date().toISOString();
    await writeJsonFn(paths.manifestPath, manifest);
  }

  return { removed, manifest };
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

function collectManifestMediaFiles(manifest, paths) {
  const files = new Map();

  for (const item of manifest.images || []) {
    for (const filePath of entryFiles(item, true, paths)) {
      if (fileExists(filePath)) {
        const rel = path.relative(path.join(paths.root, 'public'), filePath).split(path.sep).join('/');
        files.set(rel, filePath);
      }
    }
  }

  for (const item of manifest.videos || []) {
    for (const filePath of entryFiles(item, false, paths)) {
      if (fileExists(filePath)) {
        const rel = path.relative(path.join(paths.root, 'public'), filePath).split(path.sep).join('/');
        files.set(rel, filePath);
      }
    }
  }

  return files;
}

async function buildExportMeta(manifest, events, mediaFiles, sourceEnv) {
  const checksums = {};
  for (const [rel, abs] of mediaFiles.entries()) {
    checksums[rel] = await sha256File(abs);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceEnv: sourceEnv || process.env.NODE_ENV || 'development',
    imageCount: manifest.images?.length || 0,
    videoCount: manifest.videos?.length || 0,
    eventCount: events.events?.length || 0,
    fileCount: mediaFiles.size,
    checksums,
  };
}

async function exportContentBundle(paths, outputStream, sourceEnv) {
  const manifest = await readJson(paths.manifestPath, { lastUpdated: null, images: [], videos: [] });
  const events = await readJson(paths.eventsPath, { events: [] });
  const mediaFiles = collectManifestMediaFiles(manifest, paths);
  const exportMeta = await buildExportMeta(manifest, events, mediaFiles, sourceEnv);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(outputStream);

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.append(JSON.stringify(events, null, 2), { name: 'events.json' });
  archive.append(JSON.stringify(exportMeta, null, 2), { name: 'export-meta.json' });

  for (const [rel, abs] of mediaFiles.entries()) {
    archive.file(abs, { name: rel });
  }

  await archive.finalize();
  return exportMeta;
}

async function extractBundleToDir(bundlePath, destDir) {
  await fsp.mkdir(destDir, { recursive: true });
  const directory = await unzipper.Open.file(bundlePath);
  await directory.extract({ path: destDir });
}

async function readExtractedJson(extractDir, name, fallback) {
  const filePath = path.join(extractDir, name);
  if (!fileExists(filePath)) return fallback;
  return readJson(filePath, fallback);
}

async function copyMediaFromExtract(extractDir, paths, replaceMode) {
  const mediaRoot = path.join(extractDir, 'media');
  if (!fs.existsSync(mediaRoot)) return { copied: 0, skipped: 0 };

  let copied = 0;
  let skipped = 0;

  async function walk(relDir) {
    const absDir = path.join(mediaRoot, relDir);
    const entries = await fsp.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(rel);
        continue;
      }
      const src = path.join(mediaRoot, rel);
      const dest = path.join(paths.root, 'public', 'media', rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      if (!replaceMode && fileExists(dest)) {
        skipped += 1;
        continue;
      }
      await fsp.copyFile(src, dest);
      copied += 1;
    }
  }

  await walk('');
  return { copied, skipped };
}

function mergeManifestEntries(existing, incoming) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let skipped = 0;

  for (const item of incoming) {
    if (byId.has(item.id)) {
      skipped += 1;
      continue;
    }
    byId.set(item.id, item);
    added += 1;
  }

  return {
    merged: [...byId.values()],
    added,
    skipped,
  };
}

function mergeEvents(existing, incoming) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let skipped = 0;

  for (const item of incoming) {
    if (byId.has(item.id)) {
      skipped += 1;
      continue;
    }
    byId.set(item.id, item);
    added += 1;
  }

  return {
    merged: [...byId.values()],
    added,
    skipped,
  };
}

async function verifyExtractChecksums(extractDir, exportMeta) {
  const missing = [];
  const mismatched = [];

  if (!exportMeta?.checksums) return { missing, mismatched };

  for (const [rel, expected] of Object.entries(exportMeta.checksums)) {
    const filePath = path.join(extractDir, rel);
    if (!fileExists(filePath)) {
      missing.push(rel);
      continue;
    }
    const actual = await sha256File(filePath);
    if (actual !== expected) mismatched.push(rel);
  }

  return { missing, mismatched };
}

async function importContentBundle(paths, bundlePath, mode, writeJsonFn) {
  const replaceMode = mode === 'replace';
  const extractDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lg-import-'));

  try {
    await extractBundleToDir(bundlePath, extractDir);

    const incomingManifest = await readExtractedJson(extractDir, 'manifest.json', { images: [], videos: [] });
    const incomingEvents = await readExtractedJson(extractDir, 'events.json', { events: [] });
    const exportMeta = await readExtractedJson(extractDir, 'export-meta.json', null);
    const checksumReport = await verifyExtractChecksums(extractDir, exportMeta);

    const mediaReport = await copyMediaFromExtract(extractDir, paths, replaceMode);

    let manifest;
    let events;
    let manifestStats = { added: 0, skipped: 0 };
    let eventStats = { added: 0, skipped: 0 };

    if (replaceMode) {
      manifest = incomingManifest;
      events = incomingEvents;
      manifest.lastUpdated = new Date().toISOString();
    } else {
      const currentManifest = await readJson(paths.manifestPath, { lastUpdated: null, images: [], videos: [] });
      const currentEvents = await readJson(paths.eventsPath, { events: [] });

      const imageMerge = mergeManifestEntries(currentManifest.images || [], incomingManifest.images || []);
      const videoMerge = mergeManifestEntries(currentManifest.videos || [], incomingManifest.videos || []);
      manifest = {
        lastUpdated: new Date().toISOString(),
        images: imageMerge.merged,
        videos: videoMerge.merged,
      };
      manifestStats = {
        added: imageMerge.added + videoMerge.added,
        skipped: imageMerge.skipped + videoMerge.skipped,
      };

      const eventsMerge = mergeEvents(currentEvents.events || [], incomingEvents.events || []);
      events = { events: eventsMerge.merged };
      eventStats = { added: eventsMerge.added, skipped: eventsMerge.skipped };
    }

    await writeJsonFn(paths.manifestPath, manifest);
    await writeJsonFn(paths.eventsPath, events);

    const pruneReport = await validateAndPruneManifest(paths, writeJsonFn);

    return {
      mode,
      mediaReport,
      manifestStats,
      eventStats,
      checksumReport,
      pruneReport,
      exportMeta,
    };
  } finally {
    await fsp.rm(extractDir, { recursive: true, force: true });
  }
}

function exportFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `lasergator-content-${date}.zip`;
}

module.exports = {
  createPaths,
  seedRuntimeFile,
  validateAndPruneManifest,
  exportContentBundle,
  importContentBundle,
  exportFilename,
  readJson,
  writeJsonAtomic,
};
