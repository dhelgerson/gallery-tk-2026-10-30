#!/usr/bin/env node
/**
 * scripts/previews.mjs — generate web-sized preview images for the gallery.
 *
 * Requires sharp, installed on demand (it is NOT a repo dependency, so CI stays
 * dependency-free):   npm i -D sharp   (first time only)
 *
 * Usage:
 *   node scripts/previews.mjs <originals-dir> <collection-dir-name> [--max 1800] [--q 82]
 *
 * Example:
 *   node scripts/previews.mjs ~/Pictures/chen-wedding/fullres portraits
 *
 * Output goes to src/photos/<collection-dir-name>/ keeping the ORIGINAL
 * filenames (extension becomes .jpg) so they match the release assets you
 * upload with scripts/deliver.mjs — that match is what lights up the
 * per-photo "Download full-res" buttons.
 *
 * Metadata (EXIF/GPS) is stripped from previews on purpose.
 * Note: sharp's prebuilt binaries decode HEIC only on some platforms — if HEIC
 * files are skipped, export JPEGs from Lightroom/Camera Raw first.
 */
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".heif", ".avif"]);
const naturalSort = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const [inDir, collName] = positional;
if (!inDir || !collName) {
  console.error("usage: node scripts/previews.mjs <originals-dir> <collection-name> [--max 1800] [--q 82]");
  process.exit(1);
}
const maxEdge = Number(flag("max", 1800));
const quality = Number(flag("q", 82));
const outDir = path.join(ROOT, "src", "photos", collName);

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. Run:  npm i -D sharp");
  process.exit(1);
}

const entries = (await readdir(inDir, { withFileTypes: true }))
  .filter((e) => e.isFile() && SOURCES.has(path.extname(e.name).toLowerCase()))
  .map((e) => e.name)
  .sort(naturalSort.compare);

if (entries.length === 0) {
  console.error(`no images found in ${inDir}`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
let done = 0;
let skipped = 0;
let bytesOut = 0;

for (const name of entries) {
  const target = path.join(outDir, path.parse(name).name + ".jpg");
  try {
    const info = await sharp(path.join(inDir, name))
      .rotate() // honor orientation
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toFile(target);
    bytesOut += (await stat(target)).size;
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${entries.length} …`);
  } catch (err) {
    skipped++;
    console.warn(`  skipped ${name}: ${err.message.split("\n")[0]}`);
  }
}

console.log(
  `\n[previews] ${done} written to src/photos/${collName}/ (~${(bytesOut / 1024 / 1024).toFixed(1)} MB), ${skipped} skipped`
);
console.log(`[previews] add the collection to src/config.json (dir: "${collName}"), then: git add src/photos && git commit && git push`);
