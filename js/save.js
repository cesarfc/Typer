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
      practice: {},                // tier id -> { time: bestMs, wpm: best, ghost: [ms...] }
      rematch: {},                 // world index -> best rematch tier (1 silver, 2 gold)
      paragraphs: {},              // story id -> { wpm, acc } personal bests
      flags: {},                   // one-time hints / NEW badges bookkeeping
      trophies: {},                // id -> true
      settings: { sound: true, hints: true, difficulty: "normal" },
      streak: { last: null, count: 0 },
      stats: { keys: 0, correct: 0, bestWpm: 0, bestCombo: 0, history: [], perKey: {} },
      stageBest: {},               // "w-s" -> { wpm, acc, ninja } personal bests
      counters: {},                // lifetime tallies (hatches, wildCatches, ...)
      band: "trainer",             // skill band: explorer | trainer | ace
      vouchers: 0,                 // 🎟 candy vouchers (daily drill / research)
      daily: null,                 // { date, done, mutators: [id, id] }
      dailyWeek: null,             // { week, count } — dailies finished this week
      research: null,              // { week, tasks: [{id, base, claimed}] }
      unlocks: { stamps: 0 },      // wardrobe currency from research
      day: null,                   // today's adventure stamps { date, levels, wild, school, shown }
      elite: null,                 // { bestRound, clears }
      hof: [],                     // Hall of Fame entries { date, party, wpm }
    };
  },

  bump(counter, n = 1) {
    this.state.counters[counter] = (this.state.counters[counter] || 0) + n;
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
    const W6 = HALL_W;
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

  // ---- daily streak with Pokemon Center rest tokens: every 7 straight
  // days banks one 🛏 token (max 2); a token silently absorbs a single
  // missed day, and a true reset sprouts fresh — never a dead flame ----
  touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const st = this.state.streak;
    if (st.last === today) return null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    let rested = false, sprouted = false;
    if (st.last === yesterday) {
      st.count++;
    } else if (st.last === dayBefore && (st.tokens || 0) > 0) {
      st.tokens--;
      st.count++;
      rested = true;
    } else {
      if (st.count > 1) sprouted = true;
      st.best = Math.max(st.best || 0, st.count || 0);
      st.count = 1;
    }
    st.last = today;
    if (st.count > 0 && st.count % 7 === 0) st.tokens = Math.min(2, (st.tokens || 0) + 1);
    const bonusXp = st.count > 1 ? Math.min(25 * st.count, 100) : 0;
    if (bonusXp) this.state.xp += bonusXp;
    const newTrophies = [];
    if (st.count >= 3) this.award("streak-3", newTrophies);
    if (st.count >= 7) this.award("streak-7", newTrophies);
    this.save();
    return { count: st.count, bonusXp, newTrophies, rested, sprouted, best: st.best || 0 };
  },

  // ---- Today's Adventure: three gentle daily stamps ----
  dayInfo() {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.state.day || this.state.day.date !== today) {
      this.state.day = { date: today, levels: 0, wild: false, school: false, shown: false };
    }
    return this.state.day;
  },

  dayStamps() {
    const d = this.dayInfo();
    return [
      { e: "🗺️", text: "Finish 3 levels", done: d.levels >= 3, now: Math.min(3, d.levels), need: 3 },
      { e: "🌿", text: "Visit the wild", done: d.wild },
      { e: "🏫", text: "School or a catch", done: d.school },
    ];
  },

  // ---- Professor's Daily Drill ----
  dailyInfo() {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.state.daily || this.state.daily.date !== today) {
      let h = 0;
      for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = DAILY_MUTATORS.filter(m =>
        !m.needHall || this.stageStars(HALL_W, WORLDS[HALL_W].levels.length) > 0);
      const a = pool[h % pool.length];
      const rest = pool.filter(m => m !== a);
      const b = rest[(h >> 3) % rest.length];
      this.state.daily = { date: today, done: false, mutators: [a.id, b.id] };
      this.save();
    }
    return this.state.daily;
  },

  completeDaily(xp) {
    const d = this.dailyInfo();
    if (d.done) return null;
    d.done = true;
    this.bump("dailies");
    this.state.xp += xp;
    this.state.vouchers++;
    const wk = this.weekKey();
    if (!this.state.dailyWeek || this.state.dailyWeek.week !== wk) {
      this.state.dailyWeek = { week: wk, count: 0 };
    }
    this.state.dailyWeek.count++;
    let eggBonus = false;
    if (this.state.dailyWeek.count === 5 && !this.state.egg) {
      const today = new Date().toISOString().slice(0, 10);
      this.state.egg = { date: today, progress: 0, boost: true };
      this.state.eggDate = today;
      eggBonus = true;
    }
    this.save();
    return { xp, voucher: true, eggBonus, weekCount: this.state.dailyWeek.count };
  },

  // ---- Professor's Research: 3 weekly tasks, weighted to neglected systems ----
  researchNow() {
    const wk = this.weekKey();
    if (!this.state.research || this.state.research.week !== wk) {
      let h = 0;
      for (const ch of wk) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const c = this.state.counters;
      // least-practiced systems first, hash breaks ties for variety
      const ranked = RESEARCH_TASKS.slice().sort((a, b) =>
        ((c[a.counter] || 0) - (c[b.counter] || 0)) || (((h >> 2) % 7) - 3));
      const picks = ranked.slice(0, 5);
      const tasks = [];
      for (let i = 0; tasks.length < 3 && i < picks.length; i++) {
        const t = picks[(i + h) % picks.length];
        if (!tasks.some(x => x.id === t.id)) {
          tasks.push({ id: t.id, base: c[t.counter] || 0, claimed: false });
        }
      }
      this.state.research = { week: wk, tasks };
      this.save();
    }
    return this.state.research;
  },

  taskProgress(task) {
    const def = RESEARCH_TASKS.find(t => t.id === task.id);
    const now = (this.state.counters[def.counter] || 0) - task.base;
    return { def, now: Math.max(0, Math.min(def.need, now)), done: now >= def.need };
  },

  claimTask(id) {
    const r = this.researchNow();
    const task = r.tasks.find(t => t.id === id);
    if (!task || task.claimed || !this.taskProgress(task).done) return null;
    task.claimed = true;
    this.state.unlocks.stamps++;
    this.state.xp += 30;
    const allDone = r.tasks.every(t => t.claimed);
    if (allDone) this.state.vouchers++;
    this.save();
    return { xp: 30, stamp: true, allDone };
  },

  useVoucher(baseKey) {
    if (this.state.vouchers <= 0 || !this.familyFor(baseKey)) return null;
    this.state.vouchers--;
    const count = this.addCandy(baseKey);
    return { count };
  },

  // ---- wardrobe locks ----
  wardrobeOk(part, idx) {
    const lock = TRAINER_LOCKS[`${part}:${idx}`];
    if (!lock) return { ok: true };
    if (!this.state) return { ok: false, label: lock.label }; // new-player builder
    if (lock.need === "stamps") {
      return { ok: this.state.unlocks.stamps >= lock.n, label: lock.label };
    }
    if (lock.need === "champion") {
      return { ok: !!this.state.trophies.champion, label: lock.label };
    }
    return { ok: true };
  },

  medalPoints() {
    let n = 0;
    WORLDS.forEach((w, wi) => { n += this.worldMedal(wi); });
    return n;
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
    if (w === 0) return true;
    // islands may unlock after an earlier world than their predecessor
    const prev = WORLDS[w].unlockAfter === undefined ? w - 1 : WORLDS[w].unlockAfter;
    return this.stageStars(prev, WORLDS[prev].levels.length) > 0;
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
    this.dayInfo().school = true; // any catch counts for the day's third stamp
    this.state.dex[`${w}-${i}`] = { shiny: !!shiny };
    // a trainer is never partner-less: the first catch joins the party
    if (this.state.party.length === 0) {
      this.state.party.push(`${w}-${i}`);
      this._justAutoPartied = `${w}-${i}`;
    }
    this.award("first-catch", newTrophies);
    if (shiny) {
      this.award("shiny", newTrophies);
      const n = this.shinyCount();
      if (n >= 10) this.award("shiny-10", newTrophies);
      if (n >= 25) this.award("shiny-25", newTrophies);
      if (n >= 50) this.award("shiny-50", newTrophies);
    }
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
    this.dayInfo().wild = true;
    this.save();
  },

  useCast() {
    this.wildToday().casts++;
    this.dayInfo().wild = true;
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
    this.bump("evolutions");
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
  applyPractice(tierId, timeMs, wpm, acc, bestCombo, wordTimes) {
    const st = this.state;
    const prev = st.practice[tierId] || {};
    const betterTime = !prev.time || timeMs < prev.time;
    const betterWpm = !prev.wpm || wpm > prev.wpm;
    if (betterTime || betterWpm) this.bump("records");
    this.dayInfo().school = true;
    const result = { betterTime, betterWpm, prevTime: prev.time || null, prevWpm: prev.wpm || null };
    // the ghost belongs to the best-TIME run — keep the old one otherwise
    const ghost = betterTime && wordTimes && wordTimes.length ? wordTimes : (prev.ghost || null);
    st.practice[tierId] = {
      time: betterTime ? timeMs : prev.time,
      wpm: betterWpm ? wpm : prev.wpm,
    };
    if (ghost) st.practice[tierId].ghost = ghost;

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

  // ---- Story Typing: personal bests per paragraph ----
  applyParagraph(id, timeMs, wpm, acc) {
    const st = this.state;
    const prev = st.paragraphs[id] || {};
    const betterWpm = !prev.wpm || wpm > prev.wpm;
    const betterAcc = prev.acc === undefined || acc > prev.acc;
    if (betterWpm || betterAcc) this.bump("records");
    this.dayInfo().school = true;
    st.paragraphs[id] = { wpm: Math.max(wpm, prev.wpm || 0), acc: Math.max(acc, prev.acc || 0) };

    const newTrophies = [];
    this.award("storyteller", newTrophies);
    if (wpm >= 15) this.award("wpm-15", newTrophies);
    if (wpm >= 25) this.award("wpm-25", newTrophies);
    if (wpm >= 35) this.award("wpm-35", newTrophies);
    if (acc >= 1) this.award("perfect", newTrophies);
    st.stats.bestWpm = Math.max(st.stats.bestWpm, wpm);

    const xp = 15 + Math.min(20, wpm) + (betterWpm ? 10 : 0);
    st.xp += xp;
    this.collectTrophies(newTrophies);
    this.save();
    return { xp, betterWpm, betterAcc, prevWpm: prev.wpm || null, newTrophies };
  },

  // ---- Mystery Egg: what hatches depends on streak (better odds when
  // playing daily) and the current dex; duplicates hatch into 3 candy ----
  eggPick() {
    let streak = this.state.streak.count || 1;
    if (this.state.egg && this.state.egg.boost) streak = Math.max(streak, 7);
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
    const cap = 0.25 + 0.02 * this.charmTier();
    return Math.min(0.10 + (this.state.streak.count || 1) * 0.02, cap);
  },

  // ---- apply a finished level/boss result; returns {newTrophies, levelUps} ----
  applyResult(res) {
    const st = this.state;
    const newTrophies = [];
    const before = levelFromXp(st.xp);

    const key = `${res.w}-${res.s}`;
    const medalBefore = this.worldMedal(res.w);
    st.stages[key] = Math.max(st.stages[key] || 0, res.stars);
    st.xp += res.xp;

    st.stats.bestCombo = Math.max(st.stats.bestCombo, res.bestCombo);
    st.stats.bestWpm = Math.max(st.stats.bestWpm, res.wpm);
    st.stats.history.push({ d: new Date().toISOString().slice(0, 10), wpm: res.wpm, acc: res.acc });
    if (st.stats.history.length > 30) st.stats.history = st.stats.history.slice(-30);

    // personal bests per stage — the raw material of mastery medals.
    // Explorer-band runs count for stars and Crown, but Silver/Gold speed
    // and accuracy bests must be earned at Trainer band or above.
    const b = st.stageBest[key] || (st.stageBest[key] = {});
    const best = {};
    if (res.band !== "explorer") {
      if (res.wpm > (b.wpm || 0)) { b.wpm = res.wpm; best.wpm = true; }
      if (res.acc > (b.acc || 0)) { b.acc = res.acc; best.acc = true; }
    }
    if (res.ninja && res.acc >= 0.95 && !b.ninja) { b.ninja = true; best.ninja = true; }
    this.bump("levelsFinished");
    this.dayInfo().levels++;

    if (res.acc >= 1 && res.errors === 0) this.bump("perfectLevels");
    if (res.ninja) this.bump("ninjaClears");

    const medalAfter = this.worldMedal(res.w);
    const medalUp = medalAfter > medalBefore ? medalAfter : 0;
    if (medalAfter >= 2) this.award("medal-silver-1", newTrophies);
    if (medalAfter >= 3) this.award("medal-gold-1", newTrophies);
    if (medalAfter >= 4) this.award("crown-1", newTrophies);

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
      best,
      medalUp,
      levelUps: after.level > before.level ? { from: before.level, to: after.level, title: titleForLevel(after.level) } : null,
    };
  },

  // ---- Gym Rematch: bank the best medal earned refighting a boss ----
  // Only ever climbs (best-tier semantics): a Gold win banks Gold even if
  // the trainer never took Silver first. Never touches stage stars or
  // medals, so normal progression is left exactly as it was.
  applyRematch(w, tier) {
    const st = this.state;
    if (!st.rematch) st.rematch = {};
    const tierN = tier.id === "gold" ? 2 : 1;
    const prev = st.rematch[w] || 0;
    const upgraded = tierN > prev;
    if (upgraded) st.rematch[w] = tierN;
    const newTrophies = [];
    // trophies stack like the region medals: a Gold also proves the Silver
    if (st.rematch[w] >= 1) this.award("rematch-silver", newTrophies);
    if (st.rematch[w] >= 2) this.award("rematch-gold", newTrophies);
    this.bump("rematchWins");
    this.save();
    return { tier, newTrophies, upgraded, best: st.rematch[w] };
  },

  // ---- World Mastery Medals (computed; tier 0..4 = none..crown) ----
  // Does every stage of world w meet the requirement for `tier`?
  medalStageOk(w, s, tier) {
    const stars = this.stageStars(w, s);
    const b = this.state.stageBest[`${w}-${s}`] || {};
    if (tier === 1) return stars === 3;
    if (tier === 2) return stars === 3 && (b.acc || 0) >= 0.95 && (b.wpm || 0) >= 15;
    if (tier === 3) return stars === 3 && (b.acc || 0) >= 0.97 && (b.wpm || 0) >= 22;
    if (tier === 4) return this.medalStageOk(w, s, 3) && !!b.ninja;
    return false;
  },

  medalProgress(w, tier) {
    const total = WORLDS[w].levels.length + 1;
    let ok = 0;
    for (let s = 0; s < total; s++) if (this.medalStageOk(w, s, tier)) ok++;
    return { ok, total };
  },

  worldMedal(w) {
    let tier = 0;
    for (let t = 1; t <= 4; t++) {
      const p = this.medalProgress(w, t);
      if (p.ok === p.total) tier = t;
      else break;
    }
    return tier;
  },

  // ---- Shiny Charm: more shinies caught -> better shiny odds everywhere ----
  shinyCount() {
    return Object.values(this.state.dex).filter(d => d.shiny).length;
  },

  charmTier() {
    const n = this.shinyCount();
    return n >= 50 ? 3 : n >= 25 ? 2 : n >= 10 ? 1 : 0;
  },

  shinyOdds() {
    const t = this.charmTier();
    return {
      catch3: 0.25 + 0.04 * t,  // 3-star post-level catch
      wild: 0.12 + 0.03 * t,    // grass / fishing / legendary
    };
  },
};
