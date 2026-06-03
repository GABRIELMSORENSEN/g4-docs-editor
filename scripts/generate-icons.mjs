import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const dirs = [
  path.join(root, 'build'),
  path.join(root, 'build', 'icons'),
  path.join(root, 'public'),
  path.join(root, 'src', 'assets'),
];

for (const dir of dirs) {
  await fs.mkdir(dir, {recursive: true});
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="190" y1="110" x2="840" y2="930" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#42d7d0"/>
      <stop offset="0.48" stop-color="#084865"/>
      <stop offset="1" stop-color="#031536"/>
    </linearGradient>
    <linearGradient id="shine" x1="210" y1="115" x2="800" y2="525" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#d9fff7" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#5ff8df" stop-opacity="0.03"/>
    </linearGradient>
    <linearGradient id="paper" x1="250" y1="230" x2="800" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#78ffe9"/>
      <stop offset="0.55" stop-color="#1da6aa"/>
      <stop offset="1" stop-color="#063758"/>
    </linearGradient>
    <linearGradient id="text" x1="260" y1="310" x2="745" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#74fff0"/>
      <stop offset="0.42" stop-color="#2fd8cc"/>
      <stop offset="1" stop-color="#07133a"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#00152f" flood-opacity="0.55"/>
    </filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#001426" flood-opacity="0.42"/>
    </filter>
  </defs>

  <rect x="92" y="92" width="840" height="840" rx="138" fill="url(#bg)" filter="url(#shadow)"/>
  <rect x="116" y="116" width="792" height="792" rx="118" fill="none" stroke="#7dfff0" stroke-width="8" opacity="0.38"/>
  <path d="M118 136c55 305 498 362 790 214v-90c0-79-64-143-143-143H254c-55 0-104 31-128 79-7 14-11 27-8 40Z" fill="url(#shine)" opacity="0.74"/>

  <g filter="url(#soft)" opacity="0.9">
    <rect x="245" y="290" width="430" height="430" transform="rotate(-16 460 505)" fill="url(#paper)" stroke="#62ffe7" stroke-width="15"/>
    <rect x="332" y="225" width="430" height="430" transform="rotate(12 547 440)" fill="url(#paper)" stroke="#a6fff3" stroke-width="14" opacity="0.94"/>
    <rect x="358" y="305" width="430" height="430" fill="url(#paper)" stroke="#74fff0" stroke-width="14" opacity="0.9"/>
    <rect x="410" y="255" width="410" height="410" transform="rotate(45 615 460)" fill="#27c8bd" stroke="#a6fff3" stroke-width="14" opacity="0.9"/>
  </g>

  <g filter="url(#soft)">
    <path d="M494 366H348c-82 0-148 66-148 148v15c0 90 73 163 163 163h134V607H368c-42 0-76-34-76-76v-14c0-41 34-75 75-75h170l43-76h-86Z"
      fill="#071337" stroke="#7effed" stroke-width="21" stroke-linejoin="round"/>
    <path d="M610 366h112L574 608h126V485l73-119h65v331h58v87H700v-87H476v-78L610 366Z"
      fill="url(#text)" stroke="#7effed" stroke-width="21" stroke-linejoin="round"/>
    <path d="M440 565h110l-44 55h-38l-28-55Z" fill="#123653" stroke="#60f7df" stroke-width="13" stroke-linejoin="round"/>
  </g>

  <text x="512" y="838" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="112" font-weight="800" letter-spacing="4" fill="#f7ffff">G4 <tspan font-weight="300">DOCS</tspan></text>
</svg>`;

const svgPath = path.join(root, 'build', 'icon.svg');
await fs.writeFile(svgPath, svg);

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const pngs = [];
for (const size of sizes) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  const buildPath = path.join(root, 'build', `icon-${size}.png`);
  await fs.writeFile(buildPath, png);
  if ([16, 24, 32, 48, 64, 128, 256].includes(size)) pngs.push(buildPath);
  if ([16, 32, 48, 64, 128, 256, 512, 1024].includes(size)) {
    await fs.writeFile(path.join(root, 'build', 'icons', `${size}x${size}.png`), png);
  }
}

await fs.copyFile(path.join(root, 'build', 'icon-512.png'), path.join(root, 'build', 'icon.png'));
await fs.copyFile(path.join(root, 'build', 'icon-512.png'), path.join(root, 'src', 'assets', 'g4-docs-icon-512.png'));
await fs.copyFile(path.join(root, 'build', 'icon-512.png'), path.join(root, 'public', 'icon-512.png'));
await fs.copyFile(path.join(root, 'build', 'icon-1024.png'), path.join(root, 'public', 'og-image.png'));

const ico = await pngToIco(pngs);
await fs.writeFile(path.join(root, 'build', 'icon.ico'), ico);
await fs.writeFile(path.join(root, 'public', 'favicon.ico'), ico);

console.log('G4 DOCS EDITOR icons generated');
