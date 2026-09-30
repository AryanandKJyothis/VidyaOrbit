import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = join(process.cwd(), "node_modules");
const repaired = [];

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function repairSerovalPackage(dir) {
  const packageJsonPath = join(dir, "package.json");

  if (!(await exists(packageJsonPath))) {
    return;
  }

  const pkg = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (pkg.name !== "seroval" || pkg.version !== "1.5.4") {
    return;
  }

  const developmentEntry = join(dir, "dist", "esm", "development", "index.mjs");
  const productionEntry = join(dir, "dist", "esm", "production", "index.mjs");

  if (!(await exists(developmentEntry)) || (await exists(productionEntry))) {
    return;
  }

  await mkdir(dirname(productionEntry), { recursive: true });
  await copyFile(developmentEntry, productionEntry);

  const developmentMap = `${developmentEntry}.map`;
  if (await exists(developmentMap)) {
    await copyFile(developmentMap, `${productionEntry}.map`);
  }

  repaired.push(dir);
}

async function walk(dir) {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  await repairSerovalPackage(dir);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith(".") && entry.name !== ".pnpm") {
      continue;
    }

    await walk(join(dir, entry.name));
  }
}

await walk(root);

if (repaired.length > 0) {
  console.log(
    `Repaired seroval production ESM entry in ${repaired.length} package(s).`,
  );
}
