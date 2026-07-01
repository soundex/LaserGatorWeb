const path = require('path');
const sharp = require('sharp');

const assetsDir = path.join(__dirname, '..', 'public', 'assets');
const srcPath = path.join(assetsDir, 'spokesgator.png');
const outPath = path.join(assetsDir, 'logo-icon.png');
const size = 256;
const cx = size / 2;
const innerRadius = cx - 6;

async function generateLogoIcon() {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cx}" r="${innerRadius}" fill="#fff"/></svg>`
  );

  const ring = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cx}" r="${cx - 2}" fill="none" stroke="url(#g)" stroke-width="4"/>
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00E8FF"/>
          <stop offset="50%" stop-color="#39FF14"/>
          <stop offset="100%" stop-color="#FF0080"/>
        </linearGradient>
      </defs>
    </svg>`
  );

  const face = await sharp(srcPath)
    .resize(size, size, { fit: 'cover', position: 'top' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 12, g: 14, b: 24, alpha: 1 },
    },
  })
    .composite([
      { input: face, top: 0, left: 0 },
      { input: ring, top: 0, left: 0 },
    ])
    .png()
    .toFile(outPath);

  console.log(`Wrote ${outPath}`);
}

generateLogoIcon().catch((err) => {
  console.error(err);
  process.exit(1);
});
