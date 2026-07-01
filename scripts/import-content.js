#!/usr/bin/env node
'use strict';

const path = require('path');

const contentBundle = require('../lib/content-bundle');

const ROOT = path.join(__dirname, '..');
const PATHS = contentBundle.createPaths(ROOT);
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');

async function writeJsonAtomic(filePath, data) {
  await contentBundle.writeJsonAtomic(filePath, data, BACKUP_DIR);
}

async function main() {
  const bundlePath = process.argv[2];
  const mode = process.argv[3] === 'replace' ? 'replace' : 'merge';

  if (!bundlePath) {
    console.error('Usage: npm run import-content -- <bundle.zip> [merge|replace]');
    process.exit(1);
  }

  if (mode === 'replace') {
    console.warn('Replace mode: existing manifest, events, and media files may be overwritten.');
  }

  const report = await contentBundle.importContentBundle(
    PATHS,
    path.resolve(bundlePath),
    mode,
    writeJsonAtomic
  );

  console.log('Import complete.');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
