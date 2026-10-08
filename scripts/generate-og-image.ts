/**
 * Generate OG image for Vidya Orbit
 * Run with: bun scripts/generate-og-image.ts
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";

const YEAR = new Date().getFullYear();

async function generateOGImage() {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(200, 15%, 10%);stop-opacity:1" />
      <stop offset="100%" style="stop-color:hsl(200, 15%, 15%);stop-opacity:1" />
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="30%" r="50%">
      <stop offset="0%" style="stop-color:hsl(175, 65%, 45%);stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:hsl(175, 65%, 45%);stop-opacity:0" />
    </radialGradient>
    <radialGradient id="glow2" cx="80%" cy="70%" r="50%">
      <stop offset="0%" style="stop-color:hsl(25, 85%, 60%);stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:hsl(25, 85%, 60%);stop-opacity:0" />
    </radialGradient>
  </defs>
  
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  
  <text 
    x="600" 
    y="280" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="80" 
    font-weight="800" 
    fill="white" 
    text-anchor="middle"
    letter-spacing="-2"
  >Vidya Orbit</text>
  
  <text 
    x="600" 
    y="360" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="36" 
    fill="white" 
    fill-opacity="0.9" 
    text-anchor="middle"
  >Coaching centre management, made calm.</text>
  
  <text 
    x="600" 
    y="520" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="24" 
    fill="white" 
    fill-opacity="0.7" 
    text-anchor="middle"
  >© ${YEAR} Vidya Orbit</text>
</svg>`;

  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, quality: 90 })
    .toBuffer();

  const outputPath = path.join(process.cwd(), "public", "og-image.png");
  fs.writeFileSync(outputPath, png);

  const stats = fs.statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log(`✓ Generated OG image: ${outputPath}`);
  console.log(`  Dimensions: 1200x630`);
  console.log(`  Size: ${sizeKB} KB`);

  return { path: outputPath, size: stats.size, width: 1200, height: 630 };
}

generateOGImage().catch((err) => {
  console.error("Failed to generate OG image:", err);
  process.exit(1);
});
