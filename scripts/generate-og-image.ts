/**
 * Generate the 1200×630 Open Graph image for Vidya Orbit.
 * Run with: bun scripts/generate-og-image.ts
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

async function generateOGImage() {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#15202b"/>
      <stop offset="55%" stop-color="#1a2740"/>
      <stop offset="100%" stop-color="#1c1814"/>
    </linearGradient>
    <radialGradient id="glow1" cx="18%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#2eb8a8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#2eb8a8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="88%" cy="80%" r="50%">
      <stop offset="0%" stop-color="#e8a04a" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#e8a04a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <rect x="510" y="72" width="180" height="180" rx="40" fill="#f4f6f8"/>
  <text x="600" y="340" font-family="ui-sans-serif, system-ui, sans-serif" font-size="72" font-weight="800" fill="white" text-anchor="middle" letter-spacing="-2">Vidya Orbit</text>
  <text x="600" y="400" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" fill="white" fill-opacity="0.92" text-anchor="middle">Coaching &amp; tuition centre software for Kerala</text>
  <text x="600" y="455" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" fill="white" fill-opacity="0.7" text-anchor="middle">Attendance · Fees · Students · Receipts</text>
  <text x="600" y="560" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20" fill="white" fill-opacity="0.55" text-anchor="middle">Valanchery · Malappuram</text>
</svg>`;

  const logoPath = path.join(process.cwd(), "src/assets/logo-mark.png");
  const logo = await sharp(logoPath).resize(148, 148).png().toBuffer();

  const png = await sharp(Buffer.from(svg))
    .composite([{ input: logo, top: 88, left: 526 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outputPath = path.join(process.cwd(), "public", "og-image.png");
  fs.writeFileSync(outputPath, png);

  const logoOut = path.join(process.cwd(), "public", "logo.png");
  await sharp(logoPath).resize(512, 512).png().toFile(logoOut);

  const stats = fs.statSync(outputPath);
  console.log(
    `Generated OG image: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`,
  );
  console.log(`Generated logo: ${logoOut}`);
}

generateOGImage().catch((err) => {
  console.error("Failed to generate OG image:", err);
  process.exit(1);
});
