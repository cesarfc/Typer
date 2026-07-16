// ============================================================
// TypeQuest — pure-logic test harness. Runs the REAL shipping code
// (js/data.js + js/save.js + js/puzzle.js) under node:test:
//
//   node --test tools/
//
// Each test loads a fresh, isolated game env (own vm context + own
// localStorage) via tools/_gameEnv.mjs, so nothing bleeds between tests.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadGame, JS } from "./_gameEnv.mjs";

// Objects returned from the vm context carry that realm's prototypes, so
// node:assert deepStrictEqual (used by assert/strict) rejects them against
// host-realm literals. JSON-normalize the vm side back into this realm first.
const norm = v => JSON.parse(JSON.stringify(v));

// ---- shared fixtures -------------------------------------------------------

// A player with every world unlocked (each world's boss stage cleared) so the
// wild/egg/roamer/raid pools are all fully populated for pool-integrity tests.
function unlockAllWorlds(S, WORLDS) {
  for (let w = 0; w < WORLDS.length; w++) {
    // worldUnlocked(w+1) checks stageStars(w, WORLDS[w].levels.length) — the
    // boss stage sits at index levels.length. Clear every boss.
    S.state.stages[`${w}-${WORLDS[w].levels.length}`] = 3;
  }
}

function freshPlayer(game, name = "Tester") {
  const { SAVE } = game;
  SAVE.load();
  const pid = SAVE.createPlayer(name, "🦊", "normal", null);
  return pid;
}

// ---- Trade semantics -------------------------------------------------------

test("trade: distinct-species swap moves the shiny with its Pokemon", () => {
  const g = loadGame();
  const { SAVE } = g;
  const a = freshPlayer(g, "Ada");
  SAVE.state.dex["0-2"] = { shiny: true };   // Ada owns a SHINY 0-2
  SAVE.state.party = ["0-2"];
  const b = SAVE.createPlayer("Bo", "🐢", "normal", null);
  SAVE.state.dex["0-3"] = { shiny: false };  // Bo owns a plain 0-3
  SAVE.state.party = ["0-3"];
  SAVE.root.active = a; SAVE.state = SAVE.root.players[a];

  const r = SAVE.executeTrade(b, "0-2", "0-3");
  assert.equal(r.ok, true);
  // Ada gave away shiny 0-2, received plain 0-3
  assert.equal(SAVE.root.players[a].dex["0-2"], undefined);
  assert.deepEqual(norm(SAVE.root.players[a].dex["0-3"]), { shiny: false });
  // Bo gave away plain 0-3, received the SHINY 0-2 (sparkle travelled)
  assert.equal(SAVE.root.players[b].dex["0-3"], undefined);
  assert.deepEqual(norm(SAVE.root.players[b].dex["0-2"]), { shiny: true });
});

test("trade: SAME-species swap exchanges shiny flags and deletes nothing", () => {
  // The historical bug: set-then-delete on identical keys erased the Pokemon
  // from BOTH dexes. executeTrade deletes before setting to prevent it.
  const g = loadGame();
  const { SAVE } = g;
  const a = freshPlayer(g, "Ada");
  SAVE.state.dex["0-2"] = { shiny: true };
  SAVE.state.party = ["0-2"];
  const b = SAVE.createPlayer("Bo", "🐢", "normal", null);
  SAVE.state.dex["0-2"] = { shiny: false };
  SAVE.state.party = ["0-2"];
  SAVE.root.active = a; SAVE.state = SAVE.root.players[a];

  const r = SAVE.executeTrade(b, "0-2", "0-2");
  assert.equal(r.ok, true);
  // BOTH still own 0-2 — nothing deleted — and the shiny flags swapped.
  assert.deepEqual(norm(SAVE.root.players[a].dex["0-2"]), { shiny: false });
  assert.deepEqual(norm(SAVE.root.players[b].dex["0-2"]), { shiny: true });
});

test("trade: a traded-away lead is replaced, never leaving a trainer partnerless", () => {
  const g = loadGame();
  const { SAVE } = g;
  const a = freshPlayer(g, "Ada");
  SAVE.state.dex["0-2"] = { shiny: false }; // Ada's ONLY Pokemon and lead
  SAVE.state.party = ["0-2"];
  const b = SAVE.createPlayer("Bo", "🐢", "normal", null);
  SAVE.state.dex["0-5"] = { shiny: false };
  SAVE.state.party = ["0-5"];
  SAVE.root.active = a; SAVE.state = SAVE.root.players[a];

  SAVE.executeTrade(b, "0-2", "0-5");
  const pa = SAVE.root.players[a];
  // Ada's party dropped the traded-away key and adopted the received one
  assert.equal(pa.party.length, 1);
  assert.equal(pa.party[0], "0-5");
  assert.ok(pa.dex[pa.party[0]], "lead must be an owned Pokemon");
});

test("trade: a self-trade is rejected", () => {
  const g = loadGame();
  const { SAVE } = g;
  const a = freshPlayer(g, "Ada");
  SAVE.state.dex["0-2"] = { shiny: false };
  const r = SAVE.executeTrade(a, "0-2", "0-2");
  assert.equal(r.ok, false);
});

test("trade: counters bump every trade but Best Friends is awarded once", () => {
  const g = loadGame();
  const { SAVE } = g;
  const a = freshPlayer(g, "Ada");
  SAVE.state.dex["0-2"] = { shiny: false };
  SAVE.state.dex["0-3"] = { shiny: false };
  const b = SAVE.createPlayer("Bo", "🐢", "normal", null);
  SAVE.state.dex["0-5"] = { shiny: false };
  SAVE.state.dex["0-6"] = { shiny: false };
  SAVE.root.active = a; SAVE.state = SAVE.root.players[a];

  const r1 = SAVE.executeTrade(b, "0-2", "0-5");
  assert.equal(r1.myTrophies.length, 1, "first trade awards Best Friends");
  const r2 = SAVE.executeTrade(b, "0-3", "0-6");
  assert.equal(r2.myTrophies.length, 0, "second trade re-awards nothing");
  assert.equal(SAVE.root.players[a].counters.trades, 2, "counter bumps each trade");
  assert.equal(SAVE.root.players[b].counters.trades, 2);
  assert.equal(SAVE.root.players[a].trophies["trade-1"], true);
  assert.equal(SAVE.root.players[b].trophies["trade-1"], true);
});

// ---- Pool integrity --------------------------------------------------------

test("pools: no puzzle-only or evo-only creature ever appears in a wild pool", () => {
  const g = loadGame();
  const { SAVE, WORLDS, CREATURES } = g;
  freshPlayer(g, "Rich");
  unlockAllWorlds(SAVE, WORLDS);
  // start from an empty dex so pools always have uncaught candidates to offer
  const forbidden = c => c && (c.puzzle || c.evoOnly);
  const flat = c => (c ? CREATURES[c.w][c.i] : null);

  const N = 500;
  for (let n = 0; n < N; n++) {
    for (let w = 0; w < WORLDS.length; w++) {
      assert.ok(!forbidden(flat(SAVE.pickCatch(w, 3))), `pickCatch W${w}`);
      assert.ok(!forbidden(flat(SAVE.wildPick(w))), `wildPick W${w}`);
    }
    assert.ok(!forbidden(flat(SAVE.eggPick())), "eggPick");
    assert.ok(!forbidden(flat(SAVE.fishPick())), "fishPick");
  }

  // roamerNow uses this.weekKey() internally — vary it to sweep the pool
  const realWeekKey = SAVE.weekKey.bind(SAVE);
  for (let n = 0; n < N; n++) {
    SAVE.weekKey = () => "w" + n;
    SAVE.state.roamer = null; // force a fresh pick for the mocked week
    const r = SAVE.roamerNow();
    if (r) assert.ok(!forbidden(CREATURES[r.w][r.i]), "roamerNow");
  }
  SAVE.weekKey = realWeekKey;

  // raidPick(wk) takes the week directly — sweep 500 weeks
  for (let n = 0; n < N; n++) {
    const i = SAVE.raidPick("w" + n);
    assert.ok(!forbidden(CREATURES[g.HALL_W][i]), "raidPick");
  }
});

// ---- Save robustness -------------------------------------------------------

test("save: normalizePlayers backfills every defaults() key on a minimal v2 save", () => {
  const g = loadGame();
  const { SAVE } = g;
  // a bare v2-era player: just a profile and a couple of fields
  const minimal = { v: 2, profile: { name: "Old", avatar: "🐛" }, xp: 40, dex: { "0-1": { shiny: false } } };
  SAVE.root = { active: "p1", players: { p1: minimal } };
  SAVE.normalizePlayers();
  const p = SAVE.root.players.p1;
  for (const key of Object.keys(SAVE.defaults())) {
    assert.ok(key in p, `normalized player is missing default key: ${key}`);
  }
  // pre-existing data survives the backfill
  assert.equal(p.xp, 40);
  assert.deepEqual(p.dex["0-1"], { shiny: false });
});

test("save: corrupted JSON loads a clean empty root instead of throwing", () => {
  const g = loadGame({ seed: { typequest_save_v2: "{ this is not valid json" } });
  const { SAVE } = g;
  const state = SAVE.load();
  assert.equal(state, null, "no active player after a corrupt load");
  assert.deepEqual(norm(SAVE.root), { active: null, players: {} });
});

test("save: a player with settings:null boots and is repaired, never throwing", () => {
  const root = { active: "p1", players: { p1: { v: 3, profile: { name: "Nil", avatar: "🦊" }, xp: 10, settings: null } } };
  const g = loadGame({ seed: { typequest_save_v2: JSON.stringify(root) } });
  const { SAVE } = g;
  const state = SAVE.load();
  assert.ok(state, "the player boots despite settings:null");
  assert.equal(typeof state.settings, "object");
  assert.equal(state.settings.difficulty, "normal", "difficulty repaired to a valid value");
  assert.equal(state.settings.sound, true, "the rest of settings backfills from defaults");
});

test("save: dex:null and a garbage party are coerced to their safe defaults", () => {
  const root = { active: "p1", players: { p1: { v: 3, profile: { name: "Junk", avatar: "🐛" }, xp: 5, dex: null, party: { nope: 1 } } } };
  const g = loadGame({ seed: { typequest_save_v2: JSON.stringify(root) } });
  const { SAVE } = g;
  const state = SAVE.load();
  assert.ok(state);
  assert.deepEqual(norm(state.dex), {}, "null dex becomes an empty object");
  assert.ok(Array.isArray(state.party), "an object where the party array belongs is replaced");
  assert.equal(state.party.length, 0);
});

test("save: a string where the party array belongs is replaced, not spread into letters", () => {
  const root = { active: "p1", players: { p1: { v: 3, profile: { name: "Str", avatar: "🐢" }, dex: { "0-1": { shiny: false } }, party: "0-1" } } };
  const g = loadGame({ seed: { typequest_save_v2: JSON.stringify(root) } });
  const { SAVE } = g;
  const state = SAVE.load();
  assert.ok(Array.isArray(state.party));
  assert.equal(state.party.length, 0, "the string is dropped for [], never iterated as chars");
});

test("save: a nested default sub-field backfills via deep-merge (future-field safety)", () => {
  // an old save whose `stats` predates several sub-fields present in defaults()
  const root = { active: "p1", players: { p1: { v: 3, profile: { name: "Old", avatar: "🦊" }, stats: { keys: 99 } } } };
  const g = loadGame({ seed: { typequest_save_v2: JSON.stringify(root) } });
  const { SAVE } = g;
  const state = SAVE.load();
  assert.equal(state.stats.keys, 99, "the existing sub-field survives the merge");
  assert.equal(state.stats.correct, 0, "a missing sub-field is filled from defaults");
  assert.equal(state.stats.bestWpm, 0);
  assert.deepEqual(norm(state.stats.perKey), {});
  assert.ok(Array.isArray(state.stats.history));
});

test("save: an unparseable player is quarantined without harming its siblings", () => {
  const root = { active: "good", players: {
    good: { v: 3, profile: { name: "Good", avatar: "🦊" }, xp: 200, dex: { "0-1": { shiny: true } } },
    bad: "totally not a player object",
  } };
  const g = loadGame({ seed: { typequest_save_v2: JSON.stringify(root) } });
  const { SAVE } = g;
  const state = SAVE.load();
  assert.ok(state, "the good sibling still boots");
  assert.equal(state.profile.name, "Good");
  assert.equal(state.xp, 200, "the good sibling is untouched");
  assert.equal(SAVE.root.players.bad, undefined, "the scrambled player is dropped from the roster");
  assert.ok(SAVE.root._quarantine && SAVE.root._quarantine.bad, "and set aside in _quarantine, never deleted");
});

test("save: export → import round-trips a player exactly", () => {
  const src = loadGame();
  const { SAVE: A } = src;
  const a = freshPlayer(src, "Champ");
  A.state.xp = 1234;
  A.state.dex = { "0-2": { shiny: true }, "1-3": { shiny: false } };
  A.state.party = ["0-2"];
  A.state.stages = { "0-0": 3, "0-8": 2 };
  A.state.trophies = { "first-catch": true, shiny: true };
  A.save();
  const blob = A.exportData();

  const dst = loadGame();
  const { SAVE: B } = dst;
  B.load();
  const res = B.importData(JSON.parse(blob));
  assert.equal(res.ok, true);
  const imported = B.root.players[a];
  assert.ok(imported, "player landed in the fresh save");
  assert.equal(imported.xp, 1234);
  assert.deepEqual(norm(imported.dex), { "0-2": { shiny: true }, "1-3": { shiny: false } });
  assert.deepEqual(norm(imported.party), ["0-2"]);
  assert.deepEqual(norm(imported.stages), { "0-0": 3, "0-8": 2 });
  assert.deepEqual(norm(imported.trophies), { "first-catch": true, shiny: true });
});

test("save: import keeps the higher-XP copy so a stale backup never erases progress", () => {
  const g = loadGame();
  const { SAVE } = g;
  const a = freshPlayer(g, "Ace");
  SAVE.state.xp = 500;
  SAVE.save();
  // a stale backup of the SAME player with less XP must not overwrite
  const stale = { active: a, players: { [a]: { v: 3, profile: { name: "Ace", avatar: "🦊" }, xp: 50, dex: {} } } };
  SAVE.importData(stale);
  assert.equal(SAVE.root.players[a].xp, 500, "live higher-XP copy is kept");
});

// ---- XP / reward math ------------------------------------------------------

test("reward: applyPractice pays XP and never lowers a stored best on a worse replay", () => {
  const g = loadGame();
  const { SAVE } = g;
  freshPlayer(g, "Speedy");
  const first = SAVE.applyPractice("easy", 20000, 30, 1, 12, [1000, 1000]);
  assert.ok(first.xp > 0);
  const best = { ...SAVE.state.practice.easy };
  // a worse replay: slower time, lower wpm
  SAVE.applyPractice("easy", 40000, 10, 0.8, 3, [2000, 2000]);
  assert.equal(SAVE.state.practice.easy.time, best.time, "best time is preserved");
  assert.equal(SAVE.state.practice.easy.wpm, best.wpm, "best wpm is preserved");
});

test("reward: applyPuzzle scales XP by stars and never lowers stars/blocks on replay", () => {
  const g = loadGame();
  const { SAVE, PUZZLE_STAGES } = g;
  freshPlayer(g, "Coder");
  const stage = PUZZLE_STAGES.find(s => s.id === "c1-1");
  const r3 = SAVE.applyPuzzle(stage.id, 3, 3);
  // XP = 15 + 10*stars + firstClear(10)  (c1-1 is not a capstone)
  assert.equal(r3.xp, 15 + 10 * 3 + 10);
  const rec = { ...SAVE.state.puzzle[stage.id] };
  // a sloppier replay: fewer stars, more blocks
  SAVE.applyPuzzle(stage.id, 1, 9);
  assert.equal(SAVE.state.puzzle[stage.id].stars, rec.stars, "stars never regress");
  assert.equal(SAVE.state.puzzle[stage.id].bestBlocks, rec.bestBlocks, "fewest blocks kept");
});

test("reward: applyTowerFloor grants milestone XP and a voucher at floor 10", () => {
  const g = loadGame();
  const { SAVE } = g;
  freshPlayer(g, "Climber");
  const xp0 = SAVE.state.xp;
  const f5 = SAVE.applyTowerFloor(5);
  assert.equal(f5.xp, 20 + 5 * 1);           // 25 at floor 5
  const f10 = SAVE.applyTowerFloor(10);
  assert.equal(f10.xp, 20 + 5 * 2);           // 30 at floor 10
  assert.equal(f10.voucher, true, "a candy voucher drops at floor 10");
  assert.equal(SAVE.state.vouchers, 1);
  assert.equal(SAVE.state.xp, xp0 + 25 + 30);
});

// ---- Trophy table sanity ---------------------------------------------------

test("trophies: all ids are unique", () => {
  const g = loadGame();
  const ids = g.TROPHIES.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate trophy id present");
});

test("trophies: every award() call site in js/ references a real trophy id", () => {
  const g = loadGame();
  const ids = new Set(g.TROPHIES.map(t => t.id));
  // dynamic boss-N ids are generated as `boss-${res.w}` — enumerate the range
  for (let w = 0; w < g.WORLDS.length; w++) ids.add(`boss-${w}`);

  const files = fs.readdirSync(JS).filter(f => f.endsWith(".js"));
  const literal = /\.award(?:For)?\(\s*(?:[A-Za-z_$][\w$.]*\s*,\s*)?["'`]([a-z0-9-]+)["'`]/g;
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(JS, f), "utf8");
    let m;
    while ((m = literal.exec(src))) {
      if (!ids.has(m[1])) bad.push(`${f}: award("${m[1]}")`);
    }
  }
  assert.deepEqual(bad, [], "award() calls reference non-existent trophy ids");
});
