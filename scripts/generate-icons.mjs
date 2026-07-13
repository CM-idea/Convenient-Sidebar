import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');

async function renderSvgToPng(svgPath, pngPath, size) {
  const svg = readFileSync(svgPath);
  const png = await sharp(svg, { density: Math.max(256, size * 16) })
    .ensureAlpha()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ force: true })
    .toBuffer();
  writeFileSync(pngPath, png);
}

const sizes = [16, 48, 128];
for (const size of sizes) {
  await renderSvgToPng(join(iconsDir, 'plugin-icon.svg'), join(iconsDir, `icon${size}.png`), size);
  await renderSvgToPng(join(iconsDir, 'plugin-icon-dark.svg'), join(iconsDir, `icon-dark${size}.png`), size);
}

console.log('Transparent PNG icons generated from SVG.');
