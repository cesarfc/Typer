// ============================================================
// TypeQuest — content validator. Mechanically checks the curriculum's
// promises against the REAL game data + interpreter:
//
//   node tools/validate-content.mjs        (exit 1 on any violation)
//
// Checks:
//   1. Curriculum keys — every pool word is spelled with keys taught so far.
//   2. Typeability     — every typed string is coverable by the keyboard.
//   3. Puzzle stages   — every stage is 3-star-achievable within its budget,
//                        proved with the SHIPPING interpreter (Puzzle.simulate).
//   4. Roster          — creature ids/names/append-only/evolution invariants.
//   5. Trophy/README   — TROPHIES count matches the README claim.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { loadGame, runPuzzle, ROOT } from "./_gameEnv.mjs";

const g = loadGame();
const problems = [];
const notes = [];
const fail = (check, msg) => problems.push(`[${check}] ${msg}`);
const note = msg => notes.push(msg);

// ============================================================
// 1. Curriculum keys
// ------------------------------------------------------------
// The drills teach LETTERS progressively via each level's `keys` field
// (world 0 also teaches ';' via keys "a;"). Beyond letters the game's own
// contract (WORDPACK_ALLOWED + its comment: "letters, spaces, and the taught
// punctuation . , ' ! ?") declares which punctuation the finger guide can
// teach — those, plus space, are always allowed. Capital letters are allowed
// only in a `properNames` world (world 5). Every char of every pool word (per
// level, accumulating keys "so far") must fall inside that set.
// ============================================================
function checkCurriculum() {
  const { WORLDS, worldProperNames } = g;
  const TAUGHT_PUNCT = new Set([" ", ".", ",", "'", "!", "?"]);
  const taught = new Set();           // raw keys taught so far (letters + ';')
  for (let w = 0; w < WORLDS.length; w++) {
    const proper = worldProperNames(w);
    const levels = WORLDS[w].levels;
    const check = (word, where) => {
      for (const ch of word) {
        if (TAUGHT_PUNCT.has(ch)) continue;
        const lc = ch.toLowerCase();
        if (/[a-z]/.test(lc)) {
          if (!taught.has(lc)) fail("curriculum", `W${w} "${where}": letter "${ch}" used before it is taught — in "${word}"`);
          else if (/[A-Z]/.test(ch) && !proper) fail("curriculum", `W${w} "${where}": capital "${ch}" in a non-properNames world — in "${word}"`);
        } else if (!taught.has(ch)) {
          // a non-letter symbol is fine only if a `keys` field taught it (e.g. ';')
          fail("curriculum", `W${w} "${where}": untaught character "${ch}" (U+${ch.codePointAt(0).toString(16)}) — in "${word}"`);
        }
      }
    };
    for (const lvl of levels) {
      for (const k of lvl.keys) taught.add(k.toLowerCase());
      for (const word of lvl.pool) check(word, lvl.name);
    }
    for (const word of WORLDS[w].bossPool) check(word, "boss pool");
  }
}

// ============================================================
// 2. Typeability
// ------------------------------------------------------------
// Every typed string must be reachable on the modeled keyboard: KB_ROWS_FULL
// (letters + number row + "/"), letters in either case (Shift), SHIFT_MAP for
// shifted punctuation, space, and CHAR_EQUIV folding for iOS smart punctuation.
// ============================================================
function checkTypeability() {
  const { KB_ROWS_FULL, SHIFT_MAP, normalizeKey, WORLDS, PARAGRAPHS, LICENSE_TIERS, CREATURES } = g;
  const base = new Set(KB_ROWS_FULL.flat());
  const typeable = ch => {
    const c = normalizeKey(ch);
    if (c === " ") return true;
    if (/[a-zA-Z]/.test(c)) return true;      // letters via Shift for capitals
    if (/[0-9]/.test(c)) return true;         // number row
    if (base.has(c)) return true;             // punctuation printed on a key
    if (SHIFT_MAP[c]) return true;            // shifted punctuation
    return false;
  };
  const scan = (str, where) => {
    for (const ch of str) if (!typeable(ch)) {
      fail("typeability", `${where}: char "${ch}" (U+${ch.codePointAt(0).toString(16)}) is not typeable — in "${str}"`);
    }
  };
  for (let w = 0; w < WORLDS.length; w++) {
    for (const lvl of WORLDS[w].levels) for (const p of lvl.pool) scan(p, `W${w} pool "${lvl.name}"`);
    for (const p of WORLDS[w].bossPool) scan(p, `W${w} boss pool`);
  }
  for (const para of PARAGRAPHS) scan(para.text, `paragraph ${para.id}`);
  for (const tier of LICENSE_TIERS) for (const p of tier.prompts) scan(p, `license ${tier.id}`);
  for (let w = 0; w < CREATURES.length; w++) for (const c of CREATURES[w]) scan(c.n, `creature ${c.n}`);
}

// ============================================================
// 3. Puzzle stages
// ------------------------------------------------------------
// For every stage prove a 3-star program exists (blocks <= optimal, which is
// <= budget, so solvable within budget too). Two engines, both judged by the
// SHIPPING interpreter Puzzle.simulate:
//   (a) flat config-space BFS over the stage's primitive blocks — if the
//       shortest flat win is <= optimal, done (a flat program is buildable).
//   (b) bounded program synthesis over the full palette (walk/turn/collect/
//       hop + repeat n<=10 + if/ifElse with the game's sensors, incl. AND/OR),
//       for stages whose optimal relies on loops/branches to compress the path.
// "optimal is achievable" is an existence claim (a 3-star run is possible), not
// a minimality claim — several concept stages (e.g. compare/ifElse) have a
// shorter raw path than `optimal`, which is intentional.
// ============================================================
const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const CW = { up: "right", right: "down", down: "left", left: "up" };
const CCW = { up: "left", left: "down", down: "right", right: "up" };
const REPEAT_MAX = 10;   // the game clamps repeat n to 2..10 (puzzle.js)

function tileAt(grid, x, y) {
  return (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) ? "#" : grid[y][x];
}
const passable = (grid, x, y) => { const t = tileAt(grid, x, y); return t !== "#" && t !== "~"; };

// Shortest flat program (count of primitive blocks) that wins, respecting the
// stage palette. Returns Infinity if none within the state cap.
function flatMin(st) {
  if (st.line != null) {
    const N = st.line, need = st.need, hops = st.hops || [];
    const dist = new Map([[st.start.x, 0]]);
    const q = [st.start.x];
    while (q.length) {
      const p = q.shift(), d = dist.get(p);
      if (p === need && d > 0) return d;
      for (const v of hops) { const np = p + v; if (np >= 0 && np <= N && !dist.has(np)) { dist.set(np, d + 1); q.push(np); } }
    }
    return Infinity;
  }
  const grid = st.grid, need = st.goal === "collect" ? (st.need || 0) : 0;
  const blocks = new Set(st.blocks);
  const key = s => `${s.x},${s.y},${s.dir},${s.got}`;
  const gotN = str => (str ? str.split("|").filter(Boolean).length : 0);
  const start = { x: st.start.x, y: st.start.y, dir: st.start.dir, got: "" };
  const q = [[start, 0]]; const seen = new Set([key(start)]);
  let guard = 0;
  while (q.length) {
    const [s, d] = q.shift();
    if (tileAt(grid, s.x, s.y) === "o" && gotN(s.got) >= need) return d;
    if (++guard > 50000) return Infinity;   // berry-heavy rings explode; synth handles them
    const succ = [];
    if (blocks.has("walk")) { const [dx, dy] = DIRS[s.dir]; const nx = s.x + dx, ny = s.y + dy; if (passable(grid, nx, ny)) succ.push({ x: nx, y: ny, dir: s.dir, got: s.got }); }
    if (blocks.has("turnLeft")) succ.push({ x: s.x, y: s.y, dir: CCW[s.dir], got: s.got });
    if (blocks.has("turnRight")) succ.push({ x: s.x, y: s.y, dir: CW[s.dir], got: s.got });
    if (blocks.has("collect")) { const c = `${s.x},${s.y}`; if (tileAt(grid, s.x, s.y) === "*" && !s.got.includes(`|${c}|`)) succ.push({ x: s.x, y: s.y, dir: s.dir, got: `${s.got}|${c}|` }); }
    for (const ns of succ) { const k = key(ns); if (!seen.has(k)) { seen.add(k); q.push([ns, d + 1]); } }
  }
  return Infinity;
}

function paletteFor(st) {
  const blocks = new Set(st.blocks);
  const leaves = [];
  if (blocks.has("walk")) leaves.push({ t: "walk" });
  if (blocks.has("turnLeft")) leaves.push({ t: "turn", d: "left" });
  if (blocks.has("turnRight")) leaves.push({ t: "turn", d: "right" });
  if (blocks.has("collect")) leaves.push({ t: "collect" });
  for (const v of (st.hops || [])) leaves.push({ t: "hop", v });
  const conds = [];
  if (blocks.has("if") || blocks.has("ifElse")) {
    const S = ["pathAhead", "wallAhead", "waterAhead", "berryAhead", "onBerry"];
    if (st.compare) for (const cmp of [">=", ">", "<", "=="]) for (let v = 0; v <= (st.need || 3); v++) conds.push({ sensor: "berries", cmp, val: v });
    for (const s of S) { conds.push({ sensor: s }); conds.push({ op: "not", a: { sensor: s } }); }
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      conds.push({ op: "or", a: { sensor: S[i] }, b: { sensor: S[j] } });
      conds.push({ op: "and", a: { sensor: S[i] }, b: { sensor: S[j] } });
    }
  }
  const maxN = st.line != null ? Math.min(st.line + 1, REPEAT_MAX) : REPEAT_MAX;
  return { leaves, canRepeat: blocks.has("repeat"), canIf: blocks.has("if"), canIfElse: blocks.has("ifElse"), conds, maxN };
}

// Generate every program with EXACT total block count `c` over the palette;
// `depth` bounds nesting (2 covers the deepest shipped stage: loop-in-loop).
function* gen(pal, c, depth) {
  if (c <= 0) { if (c === 0) yield []; return; }
  for (const leaf of pal.leaves) for (const rest of gen(pal, c - 1, depth)) yield [leaf, ...rest];
  if (depth <= 0) return;
  if (pal.canRepeat) for (let bc = 1; bc <= c - 1; bc++) for (const body of gen(pal, bc, depth - 1)) {
    if (!body.length) continue;
    for (let n = 2; n <= pal.maxN; n++) for (const rest of gen(pal, c - 1 - bc, depth)) yield [{ t: "repeat", n, body }, ...rest];
  }
  if (pal.canIf) for (let bc = 1; bc <= c - 1; bc++) for (const body of gen(pal, bc, depth - 1)) {
    if (!body.length) continue;
    for (const cond of pal.conds) for (const rest of gen(pal, c - 1 - bc, depth)) yield [{ t: "if", cond, body }, ...rest];
  }
  if (pal.canIfElse) for (let bc = 1; bc <= c - 2; bc++) for (let ec = 1; ec <= c - 1 - bc; ec++)
    for (const body of gen(pal, bc, depth - 1)) { if (!body.length) continue;
      for (const els of gen(pal, ec, depth - 1)) { if (!els.length) continue;
        for (const cond of pal.conds) for (const rest of gen(pal, c - 1 - bc - ec, depth)) yield [{ t: "ifElse", cond, body, else: els }, ...rest];
      }
    }
}

function synth(st, cap = 20000000) {
  const pal = paletteFor(st);
  let calls = 0;
  for (let c = 1; c <= st.optimal; c++) for (const prog of gen(pal, c, 2)) {
    if (++calls > cap) return { ok: false, reason: "search cap reached" };
    const sim = runPuzzle(g, st, prog);
    if (sim.outcome === "win" && sim.blocks <= st.optimal) return { ok: true, blocks: sim.blocks };
  }
  return { ok: false, reason: "no 3-star program found within optimal" };
}

function checkPuzzles() {
  const { PUZZLE_STAGES, PUZZLE_BLOCKS, CREATURES } = g;
  const seenReward = new Map();
  const seenId = new Set();
  for (const st of PUZZLE_STAGES) {
    // ids unique
    if (seenId.has(st.id)) fail("puzzle", `duplicate stage id "${st.id}"`);
    seenId.add(st.id);

    // budget sanity
    if (!(st.optimal <= st.budget)) fail("puzzle", `${st.id}: optimal ${st.optimal} exceeds budget ${st.budget}`);

    // grid stages: exactly one goal, a passable in-bounds start, and — when a
    // literal 'S' is drawn — it sits under start.{x,y}. (Ring stages legitimately
    // omit 'S': the start coincides with the 'o' goal, which you leave and return
    // to once the berries are collected, so the S-count itself is not invariant.)
    if (st.line == null) {
      const flat = st.grid.join("");
      const sCount = (flat.match(/S/g) || []).length;
      const oCount = (flat.match(/o/g) || []).length;
      if (oCount !== 1) fail("puzzle", `${st.id}: grid has ${oCount} goal tiles (expected 1)`);
      if (sCount > 1) fail("puzzle", `${st.id}: grid has ${sCount} 'S' tiles (expected at most 1)`);
      const startTile = tileAt(st.grid, st.start.x, st.start.y);
      if (startTile === "#" || startTile === "~") fail("puzzle", `${st.id}: start ${st.start.x},${st.start.y} is on an impassable "${startTile}" tile`);
      if (sCount === 1 && startTile !== "S") fail("puzzle", `${st.id}: grid draws an 'S' but start ${st.start.x},${st.start.y} is on "${startTile}"`);
    }

    // reward integrity: exists, is puzzle:true, and unique across stages
    if (st.reward && st.reward.catch) {
      const k = st.reward.catch;
      const [w, i] = k.split("-").map(Number);
      const c = CREATURES[w] && CREATURES[w][i];
      if (!c) fail("puzzle", `${st.id}: reward "${k}" is not a real creature`);
      else if (!c.puzzle) fail("puzzle", `${st.id}: reward "${k}" (${c.n}) is not flagged puzzle:true`);
      if (seenReward.has(k)) fail("puzzle", `${st.id}: reward "${k}" already given by stage "${seenReward.get(k)}"`);
      else seenReward.set(k, st.id);
    }

    // palette honesty: every block key names a real palette block
    for (const b of st.blocks) if (!PUZZLE_BLOCKS[b]) fail("puzzle", `${st.id}: unknown palette block "${b}"`);

    // solvability + optimal achievability
    const fm = flatMin(st);
    if (fm <= st.optimal) continue;   // a flat program already earns 3 stars
    const r = synth(st);
    if (!r.ok) fail("puzzle", `${st.id}: ${r.reason} (optimal ${st.optimal}, budget ${st.budget})`);
  }
}

// ============================================================
// 4. Roster invariants
// ============================================================
function checkRoster() {
  const { CREATURES, EVOLUTIONS } = g;
  const names = new Map();
  for (let w = 0; w < CREATURES.length; w++) {
    for (let i = 0; i < CREATURES[w].length; i++) {
      const c = CREATURES[w][i];
      if (!(Number.isInteger(c.id) && c.id >= 1 && c.id <= 1025)) fail("roster", `${w}-${i} ${c.n}: id ${c.id} out of 1..1025`);
      if (names.has(c.n)) fail("roster", `duplicate name "${c.n}" (${w}-${i} and ${names.get(c.n)})`);
      else names.set(c.n, `${w}-${i}`);
      // append-only convention: the original roster is the first 16 of each
      // world; everything appended at index >= 16 is a Puzzle Lab reward.
      if (i >= 16 && !c.puzzle) fail("roster", `${w}-${i} ${c.n}: appended entry (index >= 16) is not flagged puzzle:true`);
    }
  }
  for (const f of EVOLUTIONS) {
    for (const k of [f.base, ...(f.chain || []), ...(f.choices || [])]) {
      const [w, i] = k.split("-").map(Number);
      if (!CREATURES[w] || !CREATURES[w][i]) fail("roster", `EVOLUTION references missing creature "${k}" (family base ${f.base})`);
    }
  }
}

// ============================================================
// 5. Trophy / README consistency
// ============================================================
function checkReadme() {
  const { TROPHIES, PUZZLE_STAGES, CREATURES } = g;
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const claim = (label, re, actual, src = readme, where = "README") => {
    const m = src.match(re);
    if (!m) { note(`${where}: no "${label}" count claim found to check (actual ${actual})`); return; }
    if (Number(m[1]) !== actual) fail("readme", `${where} claims ${m[1]} ${label}, data has ${actual}`);
  };
  claim("trophies", /(\d+)\s+trophies/i, TROPHIES.length);
  claim("Pokemon", /(\d+)\s+Pokemon\b/, CREATURES.flat().length);
  // The "all 24 coding stages" / "all 19 math stages" counts are asserted in
  // save.js comments beside the pack-completion trophy checks; keep them honest.
  const save = fs.readFileSync(path.join(ROOT, "js", "save.js"), "utf8");
  claim("coding stages", /all\s+(\d+)\s+coding stages/i, PUZZLE_STAGES.filter(s => s.pack === "code").length, save, "save.js");
  claim("math stages", /all\s+(\d+)\s+math stages/i, PUZZLE_STAGES.filter(s => s.pack === "math").length, save, "save.js");
}

// ---- run everything --------------------------------------------------------
const started = Date.now();
checkCurriculum();
checkTypeability();
checkPuzzles();
checkRoster();
checkReadme();

console.log("TypeQuest content validation");
console.log("  curriculum keys   · typeability · puzzle solvability · roster · README");
console.log(`  ${g.PUZZLE_STAGES.length} puzzle stages, ${g.CREATURES.flat().length} creatures, ${g.TROPHIES.length} trophies checked in ${((Date.now() - started) / 1000).toFixed(1)}s`);
for (const n of notes) console.log(`  note: ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} violation(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\n✓ All content checks passed.");
