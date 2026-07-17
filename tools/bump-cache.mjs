// ============================================================
// TypeQuest — cache-buster bumper. Every asset in index.html is tagged
// with `?v=N`; bumping N forces browsers (and the iPad web-app) to fetch
// fresh CSS/JS after a deploy instead of serving a stale cache.
//
//   node tools/bump-cache.mjs           bump every ?v=N to N+1
//   node tools/bump-cache.mjs --set 70  set every ?v=N to exactly 70
//   node tools/bump-cache.mjs --dry     show what would change, write nothing
//
// All tags are kept in lock-step: the new version is (max existing N) + 1,
// so a single stray tag can never be left behind.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "index.html");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const setIdx = args.indexOf("--set");
const setTo = setIdx >= 0 ? Number(args[setIdx + 1]) : null;
if (setIdx >= 0 && !Number.isInteger(setTo)) {
  console.error("--set needs an integer, e.g. --set 70");
  process.exit(1);
}

const html = fs.readFileSync(INDEX, "utf8");
const tags = [...html.matchAll(/\?v=(\d+)/g)];
if (!tags.length) {
  console.error(`No ?v=N cache tags found in ${path.relative(ROOT, INDEX)}`);
  process.exit(1);
}

const versions = tags.map(m => Number(m[1]));
const current = Math.max(...versions);
const next = setTo != null ? setTo : current + 1;
const distinct = [...new Set(versions)].sort((a, b) => a - b);

const updated = html.replace(/\?v=\d+/g, `?v=${next}`);
const changed = tags.length;

console.log(`index.html: ${changed} cache tag${changed === 1 ? "" : "s"}` +
  (distinct.length > 1 ? ` (were v=${distinct.join(", v=")})` : ` (were v=${current})`) +
  ` → v=${next}`);

if (dry) {
  console.log("--dry: no file written.");
} else {
  fs.writeFileSync(INDEX, updated);
  console.log(`Wrote ${path.relative(ROOT, INDEX)}. Commit it so the deploy ships v=${next}.`);
}
