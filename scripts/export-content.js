#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const contentBundle = require('../lib/content-bundle');

const ROOT = path.join(__dirname, '..');
const PATHS = contentBundle.createPaths(ROOT);
const outArg = process.argv[2];
const outDir = outArg ? path.resolve(outArg) : path.join(ROOT, 'exports');
const outFile = path.join(outDir, contentBundle.exportFilename());

async function main() {
  await fs.promises.mkdir(outDir, { recursive: true });
  const stream = fs.createWriteStream(outFile);
  const meta = await contentBundle.exportContentBundle(PATHS, stream, process.env.APP_ENV || 'local');
  console.log(`Exported ${meta.fileCount} media files to ${outFile}`);
  console.log(`Manifest: ${meta.imageCount} images, ${meta.videoCount} videos`);
  console.log(`Events: ${meta.eventCount}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
