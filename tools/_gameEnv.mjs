// ============================================================
// TypeQuest test/validation harness — load the REAL production game
// logic (js/data.js + js/save.js + js/puzzle.js) into an isolated
// Node `vm` context so tests exercise the shipping code, not copies.
//
// Why a concat + epilogue: top-level `const`/`let` in a script run via
// vm.runInContext live in the script's own lexical scope and are NOT
// reflected as properties of the contextified global. So we concatenate
// the three source files (they share one lexical scope, so their const
// cross-references resolve) and append an epilogue that hands the needed
// bindings out onto `globalThis.__game`, which we can read back.
//
// The browser-only surfaces (document, SFX, UI, ...) are stubbed with
// no-op shims. None of the logic under test touches them; they exist only
// so the files parse and load without a DOM.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");
export const JS = path.join(ROOT, "js");

const read = f => fs.readFileSync(path.join(JS, f), "utf8");

// A tiny in-memory localStorage that behaves like the browser's (string
// values, null on miss) — SAVE.load()/save() drive against this.
function makeLocalStorage(seed) {
  const store = new Map(seed ? Object.entries(seed) : []);
  return {
    _store: store,
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    get length() { return store.size; },
  };
}

// A do-nothing DOM element good enough for load-time wiring.
function stubEl() {
  const el = {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [],
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    removeChild() {}, insertBefore(c) { el.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, setAttribute() {}, getAttribute() { return null; },
    remove() {}, focus() {}, click() {}, cloneNode() { return stubEl(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; },
    set innerHTML(v) {}, get innerHTML() { return ""; },
    set textContent(v) {}, get textContent() { return ""; },
  };
  return el;
}

function makeDocument() {
  return {
    getElementById() { return stubEl(); },
    createElement() { return stubEl(); },
    createDocumentFragment() { return stubEl(); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    body: stubEl(), documentElement: stubEl(),
  };
}

// Names we hand out of the concatenated script scope. Only names that are
// actually declared at top level in the three files may appear here.
const EXPORTS = [
  "SAVE", "WORLDS", "CREATURES", "EVOLUTIONS", "TROPHIES", "PARAGRAPHS",
  "LICENSE_TIERS", "PRACTICE_TIERS", "PUZZLE_STAGES", "PUZZLE_BLOCKS",
  "PUZZLE_SENSORS", "puzzleBlockKey", "KB_ROWS", "KB_ROWS_FULL", "KEY_FINGER",
  "SHIFT_MAP", "CHAR_EQUIV", "RARITY", "DIFFICULTY", "catchable", "normalizeKey",
  "charName", "taughtKeys", "worldProperNames", "spawnSources", "WATER_POKEMON",
  "CANDY_COST", "PARTY_MAX", "HALL_W", "RAID_HP", "levelFromXp", "titleForLevel",
  "xpNeededFor", "Puzzle", "WORDPACK_ALLOWED", "MAKER_STAGES_MAX",
];

/**
 * Build a fresh, isolated game environment. Each call gets its own vm
 * context and its own localStorage, so tests never bleed into each other.
 *
 * @param {object} [opts]
 * @param {object} [opts.seed] initial localStorage entries (key -> string)
 * @param {boolean} [opts.includePuzzle=true] also load js/puzzle.js
 * @returns the exported game globals plus { localStorage, ctx }
 */
export function loadGame(opts = {}) {
  const { seed, includePuzzle = true } = opts;
  const localStorage = makeLocalStorage(seed);

  const ctx = {
    localStorage,
    performance: { now: () => Date.now() },
    console,
    document: makeDocument(),
    // no-op audio + ui shims (only touched inside methods we don't call)
    SFX: new Proxy({}, { get: () => () => {} }),
    UI: new Proxy({ toast() {} }, { get: (t, k) => t[k] || (() => {}) }),
    Tutorial: {}, Maker: {}, Engine: {},
    setTimeout: () => 0, clearTimeout: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const parts = [read("data.js"), read("save.js")];
  if (includePuzzle) parts.push(read("puzzle.js"));
  const epilogue = `;globalThis.__game = { ${EXPORTS.map(n =>
    `${n}: (typeof ${n} !== "undefined" ? ${n} : undefined)`).join(", ")} };`;
  const source = parts.join("\n;\n") + "\n" + epilogue;

  vm.runInContext(source, ctx, { filename: "typequest-bundle.js" });
  const game = ctx.__game;
  game.localStorage = localStorage;
  game.ctx = ctx;
  return game;
}

/**
 * Run one puzzle stage's program through the REAL in-game interpreter
 * (Puzzle.simulate / simulateLine). Returns the interpreter's own result
 * object { frames, outcome, blocks, stars, ... }.
 */
export function runPuzzle(game, stage, program) {
  const P = game.Puzzle;
  P.stage = stage;
  P.program = program;
  return P.simulate();
}

export { makeLocalStorage };
