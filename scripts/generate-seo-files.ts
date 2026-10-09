/**
 * Write robots.txt, sitemap.xml and llms.txt into public/.
 * Run with: bun scripts/generate-seo-files.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
} from "../src/lib/seo-documents.ts";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public");

writeFileSync(join(publicDir, "robots.txt"), buildRobotsTxt());
writeFileSync(join(publicDir, "sitemap.xml"), buildSitemapXml());
writeFileSync(join(publicDir, "llms.txt"), buildLlmsTxt());

console.log("Wrote public/robots.txt, public/sitemap.xml, public/llms.txt");
