#!/usr/bin/env node
/**
 * build/hash-code.mjs — generate (and optionally install) the client access code hash.
 *
 *   node build/hash-code.mjs "sunny-beach-42"          # print the SHA-256 hash
 *   node build/hash-code.mjs --set "sunny-beach-42"    # write it into src/config.json
 *
 * The gallery page checks codes client-side with WebCrypto (SHA-256 of the
 * typed code, plain, no salt). Only the hash is committed — never the code.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "src", "config.json");

const args = process.argv.slice(2);
const doSet = args.includes("--set");
const code = args.find((a) => !a.startsWith("--"));

if (!code) {
  console.error('usage: node build/hash-code.mjs [--set] "<access code>"');
  process.exit(1);
}

const hash = createHash("sha256").update(code).digest("hex");

if (!doSet) {
  console.log(hash);
  process.exit(0);
}

const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
config.gate = { ...(config.gate ?? {}), enabled: true, codeHash: hash };
await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
console.log(`[hash-code] gate.codeHash set to ${hash}`);
console.log("[hash-code] commit config.json — the code itself is never stored in the repo.");
