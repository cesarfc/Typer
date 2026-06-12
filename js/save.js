// ============================================================
// TypeQuest — save data (localStorage), XP, trophies, streaks
// ============================================================

const SAVE = {
  KEY: "typequest_save_v2",
  OLD_KEY: "typequest_save_v1",
  MAX_PLAYERS: 8,
  root: null,   // { active: id|null, players: { id: state } }
  state: null,  // the active player's state (everything below operates on it)

  // v2 saves had 5 levels + boss(5) per world; v3 has 8 levels + boss(8).
  // Old cleared stages map to their new spots, and the new in-between
  // practice levels are credited with the same stars (the player already
  // proved those keys) so no progress or unlocks are ever lost.
  V3_STAGE_MAP: [
    { 0: [0, 1], 1: [2, 3], 2: [4], 3: [5], 4: [6, 7], 5: [8] },     // Pallet Meadow
    { 0: [0, 1], 1: [2, 3], 2: [4], 3: [5, 6], 4: [7], 5: [8] },     // Mt. Moon Caves
    { 0: [0, 1], 1: [2], 2: [3, 4], 3: [5, 6], 4: [7], 5: [8] },     // Battle Stadium
    { 0: [0], 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7], 5: [8] },     // Dragon's Den
    { 0: [0, 1], 1: [2, 3], 2: [4, 5], 3: [6], 4: [7], 5: [8] },     // Eterna Forest
    { 0: [0, 1], 1: [2, 3], 2: [4, 5], 3: [6], 4: [7], 5: [8] },     // Hall of Fame
  ],

  migratePlayer(p) {
    if ((p.v || 2) >= 3) return;
    const old = p.stages || {};
    const next = {};
    for (const key of Object.keys(old)) {
      const [w, s] = key.split("-").map(Number);
      const map = this.V3_STAGE_MAP[w] && this.V3_STAGE_MAP[w][s];
      if (!map) continue;
      for (const n of map) {
        const nk = `${w}-${n}`;
        next[nk] = Math.max(next[nk] || 0, old[key]);
      }
    }
    p.stages = next;
    p.v = 3;
  },

  defaults() {
    return {
      v: 3,
      profile: null,               // {name, avatar}
      tutorialDone: false,
      xp: 0,
      stages: {},                  // "w-s" -> best stars
      dex: {},                     // "w-i" -> {shiny:bool}
      candy: {},                   // base "w-i" -> candy count (from duplicate catches)
      egg: null,                   // { date, progress 0..3 } — hatches after 3 levels
      eggDate: null,               // last day an egg was granted (one per day)
      party: [],                   // up to 6 dex keys; first one is the lead partner
      roamer: null,                // { week, done } — weekly legendary attempt
      practice: {},                // tier id -> { time: bestMs, wpm: best }
      trophies: {},                // id -> true
      settings: { sound: true, hints: true, difficulty: "normal" },
      streak: { last: null, count: 0 },
      stats: { keys: 0, correct: 0, bestWpm: 0, bestCombo: 0, history: [], perKey: {} },
    };
  },

  load() {
    this.root = null;
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.root = JSON.parse(raw);
    } catch (e) { /* corrupted save */ }

    if (!this.root || !this.root.players) {
      this.root = { active: null, players: {} };
      // migrate a single-player v1 save into the first slot
      try {
        const old = localStorage.getItem(this.OLD_KEY);
        if (old) {
          const st = JSON.parse(old);
          if (st && st.profile) {
            this.root.players.p1 = st;
            this.root.active = "p1";
          }
          localStorage.removeItem(this.OLD_KEY);
        }
      } catch (e) { /* ignore broken v1 data */ }
      this.save();
    }

    this.normalizePlayers();
    this.save();
    this.state = this.root.active ? this.root.players[this.root.active] || null : null;
    return this.state;
  },

  normalizePlayers() {
    for (const id of Object.keys(this.root.players)) {
      const raw = this.root.players[id];
      const p = this.root.players[id] = Object.assign(this.defaults(), raw, { v: raw.v || 2 });
      if (!DIFFICULTY[p.settings.difficulty]) p.settings.difficulty = "normal";
      p.party = (p.party || []).filter(k => p.dex[k]).slice(0, PARTY_MAX);
      this.migratePlayer(p);
    }
  },

  // ---- party of 6 ----
  toggleParty(key) {
    if (!this.state.dex[key]) return { ok: false };
    const i = this.state.party.indexOf(key);
    if (i >= 0) {
      this.state.party.splice(i, 1);
      this.save();
      return { removed: true };
    }
    if (this.state.party.length >= PARTY_MAX) return { full: true };
    const newTrophies = [];
    this.state.party.push(key);
    if (this.state.party.length === PARTY_MAX) this.award("party-6", newTrophies);
    this.save();
    return { added: true, newTrophies };
  },

  makeLead(key) {
    const i = this.state.party.indexOf(key);
    if (i <= 0) return false;
    this.state.party.splice(i, 1);
    this.state.party.unshift(key);
    this.save();
    return true;
  },

  creatureByKey(key) {
    const [w, i] = key.split("-").map(Number);
    const c = CREATURES[w] && CREATURES[w][i];
    return c ? { ...c, w, i, key, shiny: !!(this.state.dex[key] && this.state.dex[key].shiny) } : null;
  },

  leadCreature() {
    const k = this.state.party[0];
    return k ? this.creatureByKey(k) : null;
  },

  // ---- weekly roaming legendary ----
  weekKey() {
    return "w" + Math.floor((Date.now() / 86400000 + 4) / 7);
  },

  roamerNow() {
    if (!this.worldUnlocked(2)) return null; // appears once the Stadium is reached
    const wk = this.weekKey();
    if (!this.state.roamer || this.state.roamer.week !== wk) {
      this.state.roamer = { week: wk, done: false };
      this.save();
    }
    if (this.state.roamer.done) return null;
    let h = 0;
    for (const ch of wk) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const W6 = WORLDS.length - 1;
    const pool = CREATURES[W6].map((c, i) => ({ c, i })).filter(x => !x.c.evoOnly);
    const un = pool.filter(x => !this.state.dex[`${W6}-${x.i}`]);
    const list = un.length ? un : pool;
    const x = list[h % list.length];
    return { ...x.c, w: W6, i: x.i, duplicate: !!this.state.dex[`${W6}-${x.i}`], spot: h % 4 };
  },

  markRoamerDone() {
    if (this.state.roamer) {
      this.state.roamer.done = true;
      this.save();
    }
  },

  // ---- backup file (typequest-save.json): keep it in the game folder
  // and commit it — the game auto-restores from it on a fresh browser ----
  exportData() {
    return JSON.stringify({ ...this.root, exportedAt: new Date().toISOString() }, null, 2);
  },

  // merge policy: new players are added; a player that exists in both
  // places keeps whichever copy has more XP, so a stale backup can
  // never erase newer live progress
  importData(data) {
    if (!data || typeof data !== "object" || !data.players || typeof data.players !== "object") {
      return { ok: false };
    }
    let added = 0, updated = 0, kept = 0;
    for (const [id, p] of Object.entries(data.players)) {
      if (!p || !p.profile || !p.profile.name) continue;
      const mine = this.root.players[id];
      if (!mine) { this.root.players[id] = p; added++; }
      else if ((p.xp || 0) > (mine.xp || 0)) { this.root.players[id] = p; updated++; }
      else kept++;
    }
    if (!this.root.active && data.active && this.root.players[data.active]) {
      this.root.active = data.active;
    }
    this.normalizePlayers();
    this.state = this.root.active ? this.root.players[this.root.active] || null : null;
    this.save();
    return { ok: true, added, updated, kept };
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.root)); } catch (e) { /* private mode */ }
  },

  players() {
    return Object.entries(this.root.players).map(([id, s]) => ({
      id,
      name: s.profile.name,
      avatar: s.profile.avatar,
      trainer: s.profile.trainer || null,
      level: levelFromXp(s.xp).level,
      creatures: Object.keys(s.dex).length,
      trophies: Object.keys(s.trophies).length,
      difficulty: s.settings.difficulty || "normal",
    }));
  },

  setTrainer(id, trainer) {
    const p = this.root.players[id];
    if (!p) return false;
    p.profile.trainer = trainer;
    this.save();
    return true;
  },

  createPlayer(name, avatar, difficulty, trainer) {
    if (Object.keys(this.root.players).length >= this.MAX_PLAYERS) return null;
    const id = "p" + Date.now().toString(36) + Math.floor(Math.random() * 100);
    const st = this.defaults();
    st.profile = { name, avatar, trainer: trainer || null };
    if (DIFFICULTY[difficulty]) st.settings.difficulty = difficulty;
    this.root.players[id] = st;
    this.root.active = id;
    this.state = st;
    this.save();
    return id;
  },

  switchTo(id) {
    if (!this.root.players[id]) return false;
    this.root.active = id;
    this.state = this.root.players[id];
    this.save();
    return true;
  },

  deletePlayer(id) {
    delete this.root.players[id];
    if (this.root.active === id) {
      this.root.active = null;
      this.state = null;
    }
    this.save();
  },

  // erase the current player's progress but keep their name and avatar
  resetCurrent() {
    if (!this.state || !this.root.active) return;
    const profile = this.state.profile;
    const fresh = this.defaults();
    fresh.profile = profile;
    this.root.players[this.root.active] = fresh;
    this.state = fresh;
    this.save();
  },

  // ---- daily streak: returns {count, bonusXp} when today extends/starts a streak ----
  touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const st = this.state.streak;
    if (st.last === today) return null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    st.count = st.last === yesterday ? st.count + 1 : 1;
    st.last = today;
    const bonusXp = st.count > 1 ? Math.min(25 * st.count, 100) : 0;
    if (bonusXp) this.state.xp += bonusXp;
    const newTrophies = [];
    if (st.count >= 3) this.award("streak-3", newTrophies);
    if (st.count >= 7) this.award("streak-7", newTrophies);
    this.save();
    return { count: st.count, bonusXp, newTrophies };
  },

  award(id, list) {
    if (!this.state.trophies[id]) {
      this.state.trophies[id] = true;
      const t = TROPHIES.find(t => t.id === id);
      if (t && list) list.push(t);
      return true;
    }
    return false;
  },

  recordKey(expected, ok) {
    const s = this.state.stats;
    s.keys++;
    if (ok) s.correct++;
    if (expected && expected !== " ") {
      const k = expected.toLowerCase();
      if (!s.perKey[k]) s.perKey[k] = { ok: 0, miss: 0 };
      s.perKey[k][ok ? "ok" : "miss"]++;
    }
  },

  stageStars(w, s) {
    return this.state.stages[`${w}-${s}`] || 0;
  },

  worldUnlocked(w) {
    return w === 0 || this.stageStars(w - 1, WORLDS[w - 1].levels.length) > 0;
  },

  stageUnlocked(w, s) {
    if (!this.worldUnlocked(w)) return false;
    return s === 0 || this.stageStars(w, s - 1) > 0;
  },

  worldStars(w) {
    let n = 0;
    for (let s = 0; s <= WORLDS[w].levels.length; s++) n += this.stageStars(w, s);
    return n;
  },

  caughtCount() {
    return Object.keys(this.state.dex).length;
  },

  // pick the wild Pokemon for the post-level catch round.
  // Rarity is star-gated (common 1★, rare 2★, epic+ 3★); when nothing
  // new is available the round offers a duplicate, which earns candy.
  pickCatch(w, stars) {
    const pool = CREATURES[w].map((c, i) => ({ c, i })).filter(x => !x.c.evoOnly);
    const gate = r => (r <= 1 ? 1 : r === 2 ? 2 : 3);
    const pickFrom = list => {
      const x = list[Math.floor(Math.random() * list.length)];
      return { ...x.c, w, i: x.i };
    };
    const uncaught = pool.filter(x => !this.state.dex[`${w}-${x.i}`] && stars >= gate(x.c.r));
    if (uncaught.length) return { ...pickFrom(uncaught), duplicate: false };
    const caught = pool.filter(x => this.state.dex[`${w}-${x.i}`]);
    if (!caught.length) return null;
    const withFamily = caught.filter(x => EVOLUTIONS.some(f => f.base === `${w}-${x.i}`));
    return { ...pickFrom(withFamily.length ? withFamily : caught), duplicate: true };
  },

  addCreature(w, i, shiny) {
    const newTrophies = [];
    this.state.dex[`${w}-${i}`] = { shiny: !!shiny };
    this.award("first-catch", newTrophies);
    if (shiny) this.award("shiny", newTrophies);
    this.collectTrophies(newTrophies);
    this.save();
    return newTrophies;
  },

  collectTrophies(list) {
    const n = this.caughtCount();
    if (n >= 10) this.award("collect-10", list);
    if (n >= 25) this.award("collect-25", list);
    if (n >= 50) this.award("collect-50", list);
    if (n >= CREATURES.flat().length) this.award("collect-all", list);
  },

  // ---- daily wild encounters: grass patches + fishing casts ----
  wildToday() {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.state.wild || this.state.wild.date !== today) {
      this.state.wild = { date: today, grassUsed: [], casts: 0 };
      this.save();
    }
    return this.state.wild;
  },

  useGrass(id) {
    this.wildToday().grassUsed.push(id);
    this.save();
  },

  useCast() {
    this.wildToday().casts++;
    this.save();
  },

  // weighted wild pick for a region: uncaught first (common-heavy odds),
  // duplicates (candy) once the region is complete
  wildPick(w) {
    const weight = r => (r <= 1 ? 6 : r === 2 ? 3 : 1);
    const pickW = list => {
      let t = 0;
      const acc = list.map(x => (t += weight(x.c.r)));
      const roll = Math.random() * t;
      const x = list[acc.findIndex(a => roll < a)];
      return { ...x.c, w: x.w !== undefined ? x.w : w, i: x.i };
    };
    const pool = CREATURES[w].map((c, i) => ({ c, i })).filter(x => !x.c.evoOnly);
    const un = pool.filter(x => !this.state.dex[`${w}-${x.i}`]);
    if (un.length) return { ...pickW(un), duplicate: false };
    const caught = pool.filter(x => this.state.dex[`${w}-${x.i}`]);
    if (!caught.length) return null;
    const fam = caught.filter(x => EVOLUTIONS.some(f => f.base === `${w}-${x.i}`));
    return { ...pickW(fam.length ? fam : caught), duplicate: true };
  },

  fishPick() {
    const weight = r => (r <= 1 ? 6 : r === 2 ? 3 : 1);
    const avail = WATER_POKEMON
      .map(k => { const [w, i] = k.split("-").map(Number); return { k, w, i, c: CREATURES[w][i] }; })
      .filter(x => this.worldUnlocked(x.w));
    if (!avail.length) return null;
    const un = avail.filter(x => !this.state.dex[x.k]);
    const list = un.length ? un : avail;
    let t = 0;
    const acc = list.map(x => (t += weight(x.c.r)));
    const roll = Math.random() * t;
    const x = list[acc.findIndex(a => roll < a)];
    return { ...x.c, w: x.w, i: x.i, duplicate: !un.length };
  },

  addCandy(baseKey) {
    this.state.candy[baseKey] = (this.state.candy[baseKey] || 0) + 1;
    this.save();
    return this.state.candy[baseKey];
  },

  familyFor(baseKey) {
    return EVOLUTIONS.find(f => f.base === baseKey) || null;
  },

  // which evolutions this base can do right now (caught + enough candy);
  // chains unlock in order, choice families offer everything (uncaught first)
  evoTargetsFor(baseKey) {
    const fam = this.familyFor(baseKey);
    if (!fam || !this.state.dex[baseKey]) return [];
    if ((this.state.candy[baseKey] || 0) < CANDY_COST) return [];
    if (fam.choices) {
      const un = fam.choices.filter(k => !this.state.dex[k]);
      return un.length ? un : fam.choices;
    }
    for (const k of fam.chain) if (!this.state.dex[k]) return [k];
    return [fam.chain[fam.chain.length - 1]];
  },

  applyEvolution(baseKey, targetKey) {
    const newTrophies = [];
    this.state.candy[baseKey] = Math.max(0, (this.state.candy[baseKey] || 0) - CANDY_COST);
    const t = this.state.dex[targetKey];
    let outcome;
    if (!t) { this.state.dex[targetKey] = { shiny: false }; outcome = "new"; }
    else if (!t.shiny) { t.shiny = true; outcome = "shiny"; this.award("shiny", newTrophies); }
    else { this.state.xp += 15; outcome = "xp"; }
    this.state.stats.evolutions = (this.state.stats.evolutions || 0) + 1;
    this.award("evolve-1", newTrophies);
    if (this.state.stats.evolutions >= 5) this.award("evolve-5", newTrophies);
    this.collectTrophies(newTrophies);
    this.save();
    return { outcome, newTrophies };
  },

  // ---- combos earned during the bonus catch round still count ----
  bumpCombo(combo) {
    const newTrophies = [];
    this.state.stats.bestCombo = Math.max(this.state.stats.bestCombo, combo);
    if (combo >= 10) this.award("combo-10", newTrophies);
    if (combo >= 25) this.award("combo-25", newTrophies);
    if (combo >= 50) this.award("combo-50", newTrophies);
    this.save();
    return newTrophies;
  },

  // ---- Trainer School practice: personal bests per tier ----
  applyPractice(tierId, timeMs, wpm, acc, bestCombo) {
    const st = this.state;
    const prev = st.practice[tierId] || {};
    const betterTime = !prev.time || timeMs < prev.time;
    const betterWpm = !prev.wpm || wpm > prev.wpm;
    const result = { betterTime, betterWpm, prevTime: prev.time || null, prevWpm: prev.wpm || null };
    st.practice[tierId] = {
      time: betterTime ? timeMs : prev.time,
      wpm: betterWpm ? wpm : prev.wpm,
    };

    const newTrophies = [];
    st.stats.bestWpm = Math.max(st.stats.bestWpm, wpm);
    st.stats.bestCombo = Math.max(st.stats.bestCombo, bestCombo);
    st.stats.history.push({ d: new Date().toISOString().slice(0, 10), wpm, acc });
    if (st.stats.history.length > 30) st.stats.history = st.stats.history.slice(-30);
    if (bestCombo >= 10) this.award("combo-10", newTrophies);
    if (bestCombo >= 25) this.award("combo-25", newTrophies);
    if (bestCombo >= 50) this.award("combo-50", newTrophies);
    if (wpm >= 15) this.award("wpm-15", newTrophies);
    if (wpm >= 25) this.award("wpm-25", newTrophies);
    if (wpm >= 35) this.award("wpm-35", newTrophies);
    if (acc >= 1) this.award("perfect", newTrophies);

    result.xp = 10 + Math.min(15, wpm) + (betterTime || betterWpm ? 10 : 0);
    st.xp += result.xp;
    result.newTrophies = newTrophies;
    this.save();
    return result;
  },

  // ---- Mystery Egg: what hatches depends on streak (better odds when
  // playing daily) and the current dex; duplicates hatch into 3 candy ----
  eggPick() {
    const streak = this.state.streak.count || 1;
    const wEpic = streak >= 7 ? 30 : streak >= 3 ? 15 : 6;
    const wRare = streak >= 7 ? 40 : streak >= 3 ? 35 : 25;
    const weight = r => (r <= 1 ? 100 - wEpic - wRare : r === 2 ? wRare : wEpic);
    const avail = [];
    CREATURES.forEach((list, w) => {
      if (!this.worldUnlocked(w)) return;
      list.forEach((c, i) => { if (!c.evoOnly && !this.state.dex[`${w}-${i}`]) avail.push({ c, w, i }); });
    });
    const pickW = list => {
      let t = 0;
      const acc = list.map(x => (t += weight(x.c.r)));
      const roll = Math.random() * t;
      const x = list[acc.findIndex(a => roll < a)];
      return { ...x.c, w: x.w, i: x.i };
    };
    if (avail.length) return { ...pickW(avail), duplicate: false };
    const caught = [];
    CREATURES.forEach((list, w) => list.forEach((c, i) => {
      if (!c.evoOnly && this.state.dex[`${w}-${i}`] && EVOLUTIONS.some(f => f.base === `${w}-${i}`)) {
        caught.push({ c, w, i });
      }
    }));
    if (!caught.length) return null;
    return { ...pickW(caught), duplicate: true };
  },

  eggShinyChance() {
    return Math.min(0.10 + (this.state.streak.count || 1) * 0.02, 0.25);
  },

  // ---- apply a finished level/boss result; returns {newTrophies, levelUps} ----
  applyResult(res) {
    const st = this.state;
    const newTrophies = [];
    const before = levelFromXp(st.xp);

    const key = `${res.w}-${res.s}`;
    st.stages[key] = Math.max(st.stages[key] || 0, res.stars);
    st.xp += res.xp;

    st.stats.bestWpm = Math.max(st.stats.bestWpm, res.wpm);
    st.stats.bestCombo = Math.max(st.stats.bestCombo, res.bestCombo);
    st.stats.history.push({ d: new Date().toISOString().slice(0, 10), wpm: res.wpm, acc: res.acc });
    if (st.stats.history.length > 30) st.stats.history = st.stats.history.slice(-30);

    this.award("first-level", newTrophies);
    if (res.bestCombo >= 10) this.award("combo-10", newTrophies);
    if (res.bestCombo >= 25) this.award("combo-25", newTrophies);
    if (res.bestCombo >= 50) this.award("combo-50", newTrophies);
    if (res.wpm >= 15) this.award("wpm-15", newTrophies);
    if (res.wpm >= 25) this.award("wpm-25", newTrophies);
    if (res.wpm >= 35) this.award("wpm-35", newTrophies);
    if (res.acc >= 1 && res.errors === 0) this.award("perfect", newTrophies);
    if (res.ninja) this.award("ninja", newTrophies);
    if (res.isBoss && res.stars > 0) this.award(`boss-${res.w}`, newTrophies);

    // Mystery Egg: warm the one you carry, or find today's egg
    const today = new Date().toISOString().slice(0, 10);
    let egg = null;
    if (st.egg && st.egg.progress < 3) {
      st.egg.progress++;
      egg = st.egg.progress >= 3 ? { ready: true } : { progress: st.egg.progress };
    } else if (!st.egg && st.eggDate !== today) {
      st.egg = { date: today, progress: 0 };
      st.eggDate = today;
      egg = { granted: true };
    } else if (st.egg && st.egg.progress >= 3) {
      egg = { ready: true };
    }

    const after = levelFromXp(st.xp);
    this.save();
    return {
      newTrophies,
      egg,
      levelUps: after.level > before.level ? { from: before.level, to: after.level, title: titleForLevel(after.level) } : null,
    };
  },
};
