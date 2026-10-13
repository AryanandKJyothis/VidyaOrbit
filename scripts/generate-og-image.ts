/**
 * Generate Vidya Orbit brand raster assets from the exact kit SVGs.
 * Run with: bun scripts/generate-og-image.ts
 *
 * Writes:
 *   public/og-image.png (1200×630)
 *   public/logo.png (512)
 *   public/favicon.ico, favicon.svg, favicon-16/32
 *   public/apple-touch-icon.png
 *   public/icons/icon-192.png, icon-512.png, icon-512-maskable.png
 *   src/assets/logo-mark.png, logo-mark.webp, logo-full.png
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const SIGNAL_ORANGE = "#F05A28";
const INK = "#111111";
const PAPER = "#F8F7F2";
const SLATE = "#52545A";
const ORBIT_BLUE = "#1746E8";

const ROOT = process.cwd();
const MARK_SVG = path.join(ROOT, "brand/vidya-orbit-mark.svg");
const LOGO_SVG = path.join(ROOT, "brand/vidya-orbit-logo.svg");

function pngToIco(pngs: { size: number; buffer: Buffer }[]): Buffer {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  const blobs: Buffer[] = [];
  let offset = 6 + 16 * count;
  pngs.forEach((png, i) => {
    const entry = entries.subarray(i * 16, i * 16 + 16);
    entry.writeUInt8(png.size >= 256 ? 0 : png.size, 0);
    entry.writeUInt8(png.size >= 256 ? 0 : png.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.buffer.length;
    blobs.push(png.buffer);
  });
  return Buffer.concat([header, entries, ...blobs]);
}

/** Inner markup of the kit file — never redraw the mark geometry. */
function svgInner(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*>/i, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

function markOnPaperSvg(
  markSvg: string,
  size: number,
  paddingRatio: number,
): string {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 200 200">
    ${svgInner(markSvg)}
  </svg>
</svg>`;
}

async function rasterizeSvg(svg: string, width: number, height = width) {
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

async function generateOGImage() {
  const mark = fs.readFileSync(MARK_SVG, "utf8");
  const logoBytes = fs.readFileSync(LOGO_SVG);

  const lockupH = 52;
  const lockupW = Math.round(lockupH * (780 / 180));
  const logoPng = await sharp(logoBytes)
    .resize(lockupW, lockupH, {
      fit: "contain",
      background: { r: 248, g: 247, b: 242, alpha: 1 },
    })
    .png()
    .toBuffer();

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <ellipse cx="980" cy="90" rx="220" ry="84" fill="none" stroke="${INK}" stroke-width="2" opacity="0.18" transform="rotate(-28 980 90)"/>
  <circle cx="1094" cy="38" r="10" fill="${SIGNAL_ORANGE}"/>
  <text x="80" y="188" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="3.2" fill="${SLATE}">ONE CLEAR VIEW OF YOUR CENTRE</text>
  <rect x="80" y="220" width="1040" height="1" fill="${INK}" opacity="0.18"/>
  <text x="80" y="310" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="56" fill="${INK}">Bring your</text>
  <text x="80" y="378" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="56" fill="${ORBIT_BLUE}">centre into</text>
  <text x="80" y="446" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="56" fill="${INK}">one orbit.</text>
  <text x="80" y="500" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${SLATE}">Coaching and tuition centre software for Kerala.</text>
  <circle cx="86" cy="548" r="4" fill="${SIGNAL_ORANGE}"/>
  <text x="100" y="554" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="${INK}">Attendance</text>
  <circle cx="250" cy="548" r="4" fill="${SIGNAL_ORANGE}"/>
  <text x="264" y="554" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="${INK}">Fee tracking</text>
  <circle cx="414" cy="548" r="4" fill="${SIGNAL_ORANGE}"/>
  <text x="428" y="554" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="${INK}">Records</text>
  <rect x="80" y="580" width="1040" height="1" fill="${INK}" opacity="0.18"/>
  <text x="80" y="608" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="${SLATE}">vidyaorbit.in</text>
  <text x="1120" y="608" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="${SLATE}" text-anchor="end">Centre management, made simpler.</text>
</svg>`;

  const og = await sharp(Buffer.from(svg))
    .composite([{ input: logoPng, top: 48, left: 80 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const ogPath = path.join(ROOT, "public", "og-image.png");
  fs.writeFileSync(ogPath, og);

  const logoOut = path.join(ROOT, "public", "logo.png");
  await sharp(Buffer.from(markOnPaperSvg(mark, 512, 0.12)))
    .png({ compressionLevel: 9 })
    .toFile(logoOut);

  const assetsDir = path.join(ROOT, "src/assets");
  await sharp(Buffer.from(mark))
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(assetsDir, "logo-mark.png"));
  await sharp(Buffer.from(mark))
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92 })
    .toFile(path.join(assetsDir, "logo-mark.webp"));
  await sharp(logoBytes)
    .resize(1560, 360, {
      fit: "contain",
      background: { r: 248, g: 247, b: 242, alpha: 1 },
    })
    .png()
    .toFile(path.join(assetsDir, "logo-full.png"));

  fs.copyFileSync(MARK_SVG, path.join(ROOT, "public", "favicon.svg"));

  const iconDir = path.join(ROOT, "public", "icons");
  fs.mkdirSync(iconDir, { recursive: true });

  const fav16 = await rasterizeSvg(markOnPaperSvg(mark, 16, 0.06), 16);
  const fav32 = await rasterizeSvg(markOnPaperSvg(mark, 32, 0.08), 32);
  fs.writeFileSync(path.join(ROOT, "public", "favicon-16x16.png"), fav16);
  fs.writeFileSync(path.join(ROOT, "public", "favicon-32x32.png"), fav32);
  fs.writeFileSync(
    path.join(ROOT, "public", "favicon.ico"),
    pngToIco([
      { size: 16, buffer: fav16 },
      { size: 32, buffer: fav32 },
    ]),
  );

  const apple = await rasterizeSvg(markOnPaperSvg(mark, 180, 0.14), 180);
  fs.writeFileSync(path.join(ROOT, "public", "apple-touch-icon.png"), apple);

  const icon192 = await rasterizeSvg(markOnPaperSvg(mark, 192, 0.12), 192);
  const icon512 = await rasterizeSvg(markOnPaperSvg(mark, 512, 0.12), 512);
  const maskable = await rasterizeSvg(markOnPaperSvg(mark, 512, 0.22), 512);
  fs.writeFileSync(path.join(iconDir, "icon-192.png"), icon192);
  fs.writeFileSync(path.join(iconDir, "icon-512.png"), icon512);
  fs.writeFileSync(path.join(iconDir, "icon-512-maskable.png"), maskable);

  const ogStats = fs.statSync(ogPath);
  console.log(
    `Generated OG image: ${ogPath} (${(ogStats.size / 1024).toFixed(1)} KB)`,
  );
  console.log(`Generated logo: ${logoOut}`);
  console.log(
    "Generated favicon, apple-touch and manifest icons from exact kit SVGs",
  );
}

generateOGImage().catch((err) => {
  console.error("Failed to generate brand assets:", err);
  process.exit(1);
});
