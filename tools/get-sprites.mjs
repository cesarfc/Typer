// ============================================================
// One-time sprite downloader for TypeQuest.
//
//   node tools/get-sprites.mjs
//
// Fetches the official-artwork PNGs for every catchable Pokemon
// (normal + shiny), the boss Pokemon, and a Poke Ball item sprite
// from the community PokeAPI sprites repository into img/pokemon/.
// That folder is gitignored on purpose: the artwork is Nintendo's,
// so it stays on your computer instead of in the repository.
// Without the images the game simply falls back to emoji.
//
// Works on Node 14+ (uses https, not fetch).
// ============================================================

import { readFileSync, mkdirSync, existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "img", "pokemon");
mkdirSync(outDir, { recursive: true });

// reuse the game's own data so this never goes stale
const data = readFileSync(join(root, "js", "data.js"), "utf8");
const { CREATURES, WORLDS } = new Function(`${data}; return { CREATURES, WORLDS };`)();

const ART = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
const jobs = new Map(); // filename -> url

for (const world of CREATURES) {
  for (const c of world) {
    jobs.set(`${c.id}.png`, `${ART}/${c.id}.png`);
    jobs.set(`shiny-${c.id}.png`, `${ART}/shiny/${c.id}.png`);
  }
}
for (const w of WORLDS) {
  if (w.boss.id) jobs.set(`${w.boss.id}.png`, `${ART}/${w.boss.id}.png`);
}
jobs.set("poke-ball.png",
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png");

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("too many redirects"));
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

let done = 0, skipped = 0, failed = 0;
const entries = [...jobs.entries()];

async function grab([file, url]) {
  const path = join(outDir, file);
  if (existsSync(path)) { skipped++; return; }
  try {
    writeFileSync(path, await download(url));
    done++;
    process.stdout.write(`\r  downloaded ${done}/${entries.length - skipped}   `);
  } catch (e) {
    failed++;
    console.error(`\n  FAILED ${file}: ${e.message}`);
  }
}

console.log(`Fetching ${entries.length} sprites into img/pokemon/ ...`);
// modest concurrency to be polite to the host
const POOL = 8;
for (let i = 0; i < entries.length; i += POOL) {
  await Promise.all(entries.slice(i, i + POOL).map(grab));
}
console.log(`\nDone. ${done} downloaded, ${skipped} already present, ${failed} failed.`);
if (failed) process.exit(1);
