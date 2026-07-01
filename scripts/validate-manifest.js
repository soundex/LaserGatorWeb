#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const contentBundle = require('../lib/content-bundle');

const ROOT = path.join(__dirname, '..');
const PATHS = contentBundle.createPaths(ROOT);
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');

async function writeJsonAtomic(filePath, data) {
  await contentBundle.writeJsonAtomic(filePath, data, BACKUP_DIR);
}

async function main() {
  const { removed } = await contentBundle.validateAndPruneManifest(PATHS, writeJsonAtomic);
  console.log(removed > 0
    ? `Removed ${removed} manifest entries with missing media files.`
    : 'Manifest integrity OK — no orphaned entries found.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
