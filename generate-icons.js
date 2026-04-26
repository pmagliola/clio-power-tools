// Run once: node generate-icons.js
// Requires: npm install sharp

import sharp from 'sharp';
import { mkdir } from 'fs/promises';

await mkdir('icons', { recursive: true });

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  // Blue rounded square background
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#2563eb"/>
      <text
        x="50%" y="54%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="white"
        font-family="Arial, sans-serif"
        font-weight="800"
        font-size="${Math.round(size * 0.42)}px"
        letter-spacing="-0.5"
      >CP</text>
    </svg>`,
  );

  await sharp(bg).png().toFile(`icons/icon${size}.png`);
  console.log(`icons/icon${size}.png`);
}

console.log('Done.');
