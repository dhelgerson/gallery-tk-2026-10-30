#!/usr/bin/env node
/**
 * scripts/serve.mjs — tiny static server for previewing dist/ locally.
 *   npm run dev     (builds, then serves at http://localhost:8080)
 */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.OUT_DIR || path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (file.endsWith(path.sep)) file += "index.html";
  if (!file.startsWith(DIST)) return void res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}  (dist: ${DIST})`));
