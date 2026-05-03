// Run once: node generate-icons.js
// Requires: npm install sharp

import sharp from 'sharp';
import { mkdir } from 'fs/promises';

await mkdir('icons', { recursive: true });

const sizes = [16, 32, 48, 128];

// Design: Handstands brand — balance scale in line style
// Light background (#F8FAFC), navy lines (#0F172A), emerald pivot point (#059669)
// Mirrors Handstands logo style: geometric lines + single green accent element
function makeSvg(size) {
  const cx = size / 2;
  const rx = Math.round(size * 0.2);

  const sw  = Math.max(1.5, size * 0.052);   // main stroke width
  const csw = Math.max(1,   size * 0.036);   // chain stroke width
  const pr  = Math.max(2.5, size * 0.058);   // pivot circle radius

  // Vertical post
  const postTop    = size * 0.22;
  const postBottom = size * 0.88;

  // Horizontal beam
  const beamY  = postTop;
  const beamL  = size * 0.14;
  const beamR  = size * 1 - size * 0.14;

  // Hanging chains (straight down from beam ends)
  const chainBottom = size * 0.70;

  // Scale pans (short horizontal lines)
  const panInset = size * 0.09;
  const leftPanL  = beamL - panInset;
  const leftPanR  = beamL + panInset;
  const rightPanL = beamR - panInset;
  const rightPanR = beamR + panInset;

  // Base (short horizontal line at bottom of post)
  const baseY = postBottom;
  const baseInset = size * 0.17;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${rx}" fill="#F8FAFC"/>
    <!-- Post -->
    <line x1="${cx}" y1="${postTop}" x2="${cx}" y2="${postBottom}"
      stroke="#0F172A" stroke-width="${sw}" stroke-linecap="round"/>
    <!-- Beam -->
    <line x1="${beamL}" y1="${beamY}" x2="${beamR}" y2="${beamY}"
      stroke="#0F172A" stroke-width="${sw}" stroke-linecap="round"/>
    <!-- Pivot point (green accent — like the head in the Handstands logo) -->
    <circle cx="${cx}" cy="${beamY}" r="${pr}" fill="#059669"/>
    <!-- Left chain -->
    <line x1="${beamL}" y1="${beamY}" x2="${beamL}" y2="${chainBottom}"
      stroke="#0F172A" stroke-width="${csw}" stroke-linecap="round"/>
    <!-- Left pan -->
    <line x1="${leftPanL}" y1="${chainBottom}" x2="${leftPanR}" y2="${chainBottom}"
      stroke="#0F172A" stroke-width="${sw}" stroke-linecap="round"/>
    <!-- Right chain -->
    <line x1="${beamR}" y1="${beamY}" x2="${beamR}" y2="${chainBottom}"
      stroke="#0F172A" stroke-width="${csw}" stroke-linecap="round"/>
    <!-- Right pan -->
    <line x1="${rightPanL}" y1="${chainBottom}" x2="${rightPanR}" y2="${chainBottom}"
      stroke="#0F172A" stroke-width="${sw}" stroke-linecap="round"/>
    <!-- Base -->
    <line x1="${baseInset}" y1="${baseY}" x2="${size - baseInset}" y2="${baseY}"
      stroke="#0F172A" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}

for (const size of sizes) {
  await sharp(Buffer.from(makeSvg(size))).png().toFile(`icons/icon${size}.png`);
  console.log(`icons/icon${size}.png`);
}

console.log('Done.');
