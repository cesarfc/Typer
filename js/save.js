// @ts-check
// ============================================================
// TypeQuest — save data (localStorage), XP, trophies, streaks
// ============================================================

const SAVE = {
  KEY: "typequest_save_v2",
  OLD_KEY: "typequest_save_v1",
  MAX_PLAYERS: 8,
  // Typed as always-present because every method below runs only once a player
  // is active (load() populates both). The null sentinels are a pre-load
  // transient the game never operates on, so a non-null cast keeps the checker
  // honest about field names without drowning real code in null guards.
  /** @type {SaveRoot} */
  root: /** @type {any} */ (null),   // { active: id|null, players: { id: state } }
  /** @type {PlayerState} */
  state: /** @type {any} */ (null),  // the active player's state (everything below operates on it)

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
      wordPacks: [],               // My Words: [{ id, name, words: [] }] custom spelling drills
      makerStages: [],             // Maker Hut: [{ id, name, grid, start, goal, need, blocks, logic, optimal, budget, created }]
      rematch: {},                 // world index -> best rematch tier (1 silver, 2 gold)
      paragraphs: {},              // story id -> { wpm, acc } personal bests
      puzzle: {},                  // Puzzle Lab: stageId -> { stars, caught, bestBlocks }
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
      diplomas: {},                // diploma id -> YYYY-MM-DD first earned (stored lazily)
      tower: null,                 // Battle Tower { best, climbs }
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
    // Weekly Raid Boss lives on the shared root (not per-player) so the whole
    // family chips the same bar. Spin it up / reset it for the current week.
    if (this.state && this.worldUnlocked(3)) this.raidNow();
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
    const pool = CREATURES[W6].map((c, i) => ({ c, i })).filter(x => catchable(x.c));
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

  // ---- Weekly Raid Boss: one giant legendary the whole family fights ----
  // The HP pool lives on root.raid (shared), so every player's attempts chip
  // the same bar. A new week resets it with a fresh boss.
  raidNow() {
    if (!this.worldUnlocked(3)) return null; // opens once Dragon's Den is reached
    const wk = this.weekKey();
    let R = this.root.raid;
    if (!R || R.week !== wk) {
      R = this.root.raid = {
        week: wk, ci: this.raidPick(wk), hp: RAID_HP, maxHp: RAID_HP,
        defeated: false, contrib: {}, claimed: {},
      };
      this.save();
    }
    const c = CREATURES[HALL_W][R.ci];
    return {
      ...c, w: HALL_W, i: R.ci,
      week: R.week, hp: R.hp, maxHp: R.maxHp, defeated: R.defeated,
      contrib: R.contrib, claimed: R.claimed,
    };
  },

  // deterministic weekly pick, offset from the roamer's hash so the raid boss
  // and the roaming legendary are (almost) never the same creature in a week
  raidPick(wk) {
    const pool = CREATURES[HALL_W].map((c, i) => ({ c, i })).filter(x => catchable(x.c));
    if (!pool.length) return 0;
    let h = 0;
    for (const ch of wk) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const roamerBase = h % pool.length;      // roamerNow starts from this bucket
    let idx = (h + 5) % pool.length;         // shift so the raid usually differs
    if (pool.length > 1 && idx === roamerBase) idx = (idx + 1) % pool.length;
    return pool[idx].i;
  },

  // bank damage dealt this attempt into the shared bar; record the active
  // player's contribution; mark defeated at 0. A losing player still banks.
  raidDamage(dmg) {
    const raid = this.raidNow();
    const R = this.root.raid;
    if (!raid || !R) return { defeated: false, remaining: 0, maxHp: 0, dealt: 0, justDefeated: false };
    const d = Math.max(0, Math.round(dmg) || 0);
    const before = R.hp;
    R.hp = Math.max(0, R.hp - d);
    const pid = this.root.active;
    if (pid && d > 0) R.contrib[pid] = (R.contrib[pid] || 0) + d;
    const justDefeated = !R.defeated && R.hp <= 0;
    if (R.hp <= 0) R.defeated = true;
    this.save();
    return {
      defeated: R.defeated, justDefeated, remaining: R.hp, maxHp: R.maxHp,
      dealt: before - R.hp,
      canClaim: R.defeated && !!pid && (R.contrib[pid] || 0) > 0 && !R.claimed[pid],
    };
  },

  // once the boss is down, each contributor may claim their prize a single
  // time. Records the win (counter + trophy); the catch itself is in engine.
  claimRaid() {
    const R = this.root.raid;
    const pid = this.root.active;
    if (!R || !R.defeated) return { ok: false, reason: "alive" };
    if (!pid || !(R.contrib[pid] > 0)) return { ok: false, reason: "nocontrib" };
    if (R.claimed[pid]) return { ok: false, reason: "claimed" };
    R.claimed[pid] = true;
    this.bump("raidWins");
    const newTrophies = [];
    this.award("raid-1", newTrophies);
    this.save();
    return { ok: true, newTrophies, contrib: R.contrib[pid] };
  },

  // has the active player already claimed this week's raid?
  raidClaimedByMe() {
    const R = this.root.raid;
    const pid = this.root.active;
    return !!(R && pid && R.claimed[pid]);
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
    if (lock.need === "shinies") {
      return { ok: this.shinyCount() >= lock.n, label: lock.label };
    }
    if (lock.need === "raidWins") {
      return { ok: (this.state.counters.raidWins || 0) >= lock.n, label: lock.label };
    }
    if (lock.need === "rematchGold") {
      const golds = Object.values(this.state.rematch || {}).filter(v => v >= 2).length;
      return { ok: golds >= lock.n, label: lock.label };
    }
    if (lock.need === "trophies") {
      return { ok: Object.keys(this.state.trophies).length >= lock.n, label: lock.label };
    }
    return { ok: true };
  },

  // wardrobe pieces that just became available and haven't been announced yet.
  // Marks them seen so each unlock only ever toasts once.
  newlyUnlockedWardrobe() {
    if (!this.state) return [];
    const seen = this.state.flags.unlockSeen || (this.state.flags.unlockSeen = {});
    const newly = [];
    for (const key of Object.keys(TRAINER_LOCKS)) {
      const [part, idxStr] = key.split(":");
      if (!seen[key] && this.wardrobeOk(part, +idxStr).ok) {
        seen[key] = true;
        newly.push({ part, idx: +idxStr, label: TRAINER_LOCKS[key].label });
      }
    }
    if (newly.length) this.save();
    return newly;
  },

  medalPoints() {
    let n = 0;
    WORLDS.forEach((w, wi) => { n += this.worldMedal(wi); });
    return n;
  },

  award(id, list) {
    return this.awardFor(this.state, id, list);
  },

  // award a trophy to an arbitrary player object (used by the Trading Post,
  // where both trainers earn Best Friends). Same first-time semantics as award.
  awardFor(p, id, list) {
    if (!p.trophies[id]) {
      p.trophies[id] = true;
      const t = TROPHIES.find(t => t.id === id);
      if (t && list) list.push(t);
      return true;
    }
    return false;
  },

  // ---- Diplomas: the date a certificate was earned, stored lazily. Existing
  // saves that already earned one simply stamp "today" the first time it's
  // shown — good enough for a printed keepsake, and never blocks anything. ----
  diplomaDate(id) {
    if (!this.state.diplomas) this.state.diplomas = {};
    if (!this.state.diplomas[id]) {
      this.state.diplomas[id] = new Date().toISOString().slice(0, 10);
      this.save();
    }
    return this.state.diplomas[id];
  },

  // award the "print your first diploma" trophy (fires once, on print)
  awardDiplomaPrint() {
    const list = [];
    this.award("diploma-1", list);
    if (list.length) this.save();
    return list;
  },

  // ---- Battle Tower: an endless climb. Rewards bank every 5 floors and are
  // NEVER lost — quitting or losing keeps everything already earned. ----
  towerState() {
    if (!this.state.tower) this.state.tower = { best: 0, climbs: 0 };
    return this.state.tower;
  },

  // milestone rewards for clearing a 5th floor; applied + saved immediately
  applyTowerFloor(floor) {
    const st = this.state;
    const out = { floor, xp: 0, voucher: false, shiny: null, trophies: [] };
    out.xp = 20 + 5 * Math.floor(floor / 5);   // 25 at 5, 30 at 10, 35 at 15...
    st.xp += out.xp;
    if (floor === 10) { st.vouchers++; out.voucher = true; }   // a candy voucher at floor 10
    // floor 15+ : a small chance to shiny-upgrade a random owned Pokemon (delight)
    if (floor >= 15) {
      const dull = Object.keys(st.dex).filter(k => !st.dex[k].shiny);
      if (dull.length && Math.random() < 0.2) {
        const key = dull[Math.floor(Math.random() * dull.length)];
        st.dex[key].shiny = true;
        out.shiny = this.creatureByKey(key);
        this.award("shiny", out.trophies);
        const n = this.shinyCount();
        if (n >= 10) this.award("shiny-10", out.trophies);
        if (n >= 25) this.award("shiny-25", out.trophies);
        if (n >= 50) this.award("shiny-50", out.trophies);
      }
    }
    this.save();
    return out;
  },

  // record reaching a floor: milestone trophies + best floor (caller saves)
  towerReach(floor) {
    const t = this.towerState();
    const trophies = [];
    if (floor >= 5) this.award("tower-5", trophies);
    if (floor >= 15) this.award("tower-15", trophies);
    t.best = Math.max(t.best || 0, floor);
    return trophies;
  },

  // the climb is over (hearts out or quit): lock in the best floor + tally
  towerFinish(floorReached) {
    const t = this.towerState();
    t.best = Math.max(t.best || 0, floorReached);
    t.climbs = (t.climbs || 0) + 1;
    this.save();
    return t;
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
    const pool = CREATURES[w].map((c, i) => ({ c, i })).filter(x => catchable(x.c));
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
    const pool = CREATURES[w].map((c, i) => ({ c, i })).filter(x => catchable(x.c));
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
    // a Typing License stamp, once earned, is permanent — carry it across runs
    if (prev.stamp) st.practice[tierId].stamp = true;

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

  // ---- My Words: parent-entered spelling lists that run as practice drills ----
  wordPacks() {
    return this.state.wordPacks || (this.state.wordPacks = []);
  },

  wordPackById(id) {
    return this.wordPacks().find(p => p.id === id) || null;
  },

  // Validate a name + raw textarea (one word per line). Returns
  // { ok:true, name, words } or { ok:false, error } with a kind message.
  // `existingId` is the pack being edited (so its own slot doesn't count toward
  // the 10-pack cap). Curly quotes/dashes are folded to plain ASCII first.
  validateWordPack(rawName, rawText, existingId) {
    const name = (rawName || "").trim();
    if (!name) return { ok: false, error: "Give your word pack a name first! 📛" };
    if (name.length > WORDPACK_NAME_MAXLEN) {
      return { ok: false, error: `That name is a bit long — keep it under ${WORDPACK_NAME_MAXLEN} letters.` };
    }
    const words = [];
    for (let line of (rawText || "").split("\n")) {
      const word = Array.from(line.trim()).map(normalizeKey).join("");
      if (!word) continue; // blank lines are fine — just skipped
      if (word.length > WORDPACK_WORD_MAXLEN) {
        return { ok: false, error: `“${word.slice(0, 12)}…” is too long — keep each word under ${WORDPACK_WORD_MAXLEN} letters.` };
      }
      for (const ch of word) {
        if (!WORDPACK_ALLOWED.test(ch)) {
          return { ok: false, error: `Oops — “${word}” has ${charName(ch)}, which we can’t teach yet. Try letters, spaces, or . , ' ! ?` };
        }
      }
      words.push(word);
      if (words.length > WORDPACK_WORDS_MAX) {
        return { ok: false, error: `That’s a lot of words! A pack holds up to ${WORDPACK_WORDS_MAX}. ✂️` };
      }
    }
    if (!words.length) return { ok: false, error: "Add at least one word to practice! ✏️" };
    if (!existingId && this.wordPacks().length >= WORDPACK_MAX) {
      return { ok: false, error: `You already have ${WORDPACK_MAX} word packs — delete one to make room.` };
    }
    return { ok: true, name, words };
  },

  // create (existingId null) or update a pack after validation. Returns
  // { ok, pack } or the validation error object.
  saveWordPack(existingId, rawName, rawText) {
    const v = this.validateWordPack(rawName, rawText, existingId);
    if (!v.ok) return v;
    let pack;
    if (existingId && (pack = this.wordPackById(existingId))) {
      pack.name = v.name;
      pack.words = v.words;
    } else {
      pack = { id: "wp" + Date.now().toString(36) + Math.floor(Math.random() * 100), name: v.name, words: v.words };
      this.wordPacks().push(pack);
    }
    this.save();
    return { ok: true, pack };
  },

  // delete a pack and its records/ghost. XP + trophies already earned stay.
  deleteWordPack(id) {
    const packs = this.wordPacks();
    const i = packs.findIndex(p => p.id === id);
    if (i < 0) return false;
    packs.splice(i, 1);
    delete this.state.practice["custom-" + id];
    this.save();
    return true;
  },

  // finishing a My Words drill for the first time earns 📚 Word Collector
  awardWordCollector() {
    const list = [];
    this.award("words-1", list);
    if (list.length) this.save();
    return list;
  },

  // ---- Typing License: the post-Champion number-row exam ----
  // A license tier is open once you're Champion; tiers unlock in order — the next
  // opens after the previous one has been completed at least once (a gentle gate,
  // not a stamp gate, so a kid can keep advancing even before nailing 90%).
  licenseTierOpen(index) {
    if (!this.state.trophies.champion) return false;
    if (index <= 0) return true;
    const prev = LICENSE_TIERS[index - 1];
    return !!(prev && this.state.practice["license-" + prev.id]);
  },

  // Award the stamp for a completed license run when accuracy clears 90%.
  // Collecting all four stamps earns 🪪 Licensed Typist. Returns
  // { earned, already, newTrophies } so the results card can pick its copy.
  applyLicenseStamp(tierId, acc) {
    const key = "license-" + tierId;
    const rec = this.state.practice[key] || (this.state.practice[key] = {});
    const already = !!rec.stamp;
    const earned = acc >= 0.90;
    const newTrophies = [];
    if (earned && !already) {
      rec.stamp = true;
      if (LICENSE_TIERS.every(t => this.state.practice["license-" + t.id] && this.state.practice["license-" + t.id].stamp)) {
        this.award("license-1", newTrophies);
      }
      this.save();
    }
    return { earned, already, newTrophies };
  },

  // ---- Story Typing: personal bests per paragraph ----
  applyParagraph(id, timeMs, wpm, acc, wordTimes) {
    const st = this.state;
    const prev = st.paragraphs[id] || {};
    const betterWpm = !prev.wpm || wpm > prev.wpm;
    const betterAcc = prev.acc === undefined || acc > prev.acc;
    if (betterWpm || betterAcc) this.bump("records");
    this.dayInfo().school = true;
    // the Story Ghost belongs to the best-WPM run — keep the old one otherwise
    const ghost = betterWpm && wordTimes && wordTimes.length ? wordTimes : (prev.ghost || null);
    st.paragraphs[id] = { wpm: Math.max(wpm, prev.wpm || 0), acc: Math.max(acc, prev.acc || 0) };
    if (ghost) st.paragraphs[id].ghost = ghost;

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

  // ---- Sibling ghost racing ----
  // Every OTHER profile that has a recorded ghost for this practice tier
  // ("practice") or story paragraph ("paragraph"), with their best time and
  // best WPM so the picker can label them. Read-only.
  siblingGhosts(kind, id) {
    const activePid = this.root.active;
    const out = [];
    for (const pid of Object.keys(this.root.players)) {
      if (pid === activePid) continue;
      const p = this.root.players[pid];
      const rec = this._ghostRec(p, kind, id);
      if (!rec || !rec.ghost || !rec.ghost.length) continue;
      out.push({ pid, name: p.profile.name, time: rec.time || null, wpm: rec.wpm || null });
    }
    return out;
  },

  // resolve a player's ghost record for a kind/id. "pack" matches a custom word
  // pack by NAME (case-insensitive) since pack ids differ per player; the other
  // kinds share ids across players and look up directly.
  _ghostRec(p, kind, id) {
    if (kind === "pack") {
      const pk = (p.wordPacks || []).find(w => w.name.toLowerCase() === String(id).toLowerCase());
      return pk && p.practice && p.practice["custom-" + pk.id];
    }
    return kind === "paragraph"
      ? (p.paragraphs && p.paragraphs[id])
      : (p.practice && p.practice[id]);
  },

  // Load a specific profile's ghost for a tier/story (read-only — racing a
  // sibling's ghost never touches their save). Returns { ghost, name } or null
  // when that profile was deleted or no longer has a ghost recorded.
  ghostFrom(kind, id, pid) {
    const p = this.root.players[pid];
    if (!p) return null;
    const rec = this._ghostRec(p, kind, id);
    if (!rec || !rec.ghost || !rec.ghost.length) return null;
    return { ghost: rec.ghost, name: p.profile.name };
  },

  // Beat a sibling's ghost — the one-time Family Race trophy (active player).
  awardSiblingRace() {
    const list = [];
    this.award("race-sibling", list);
    if (list.length) this.save();
    return list;
  },

  // ---- Family Trading Post: swap Pokemon 1-for-1 between two profiles ----
  // eligible trade partners = every OTHER profile that owns at least one
  // Pokemon (you can never trade with yourself, and both sides must have a
  // Pokemon to offer). Rebuilt on every open, so deleting a player elsewhere
  // can never corrupt a half-built trade.
  tradePartners() {
    const activePid = this.root.active;
    const out = [];
    for (const pid of Object.keys(this.root.players)) {
      if (pid === activePid) continue;
      const p = this.root.players[pid];
      if (!p.profile || !p.profile.name) continue;
      if (!Object.keys(p.dex).length) continue;
      out.push({ pid, name: p.profile.name, avatar: p.profile.avatar, trainer: p.profile.trainer || null,
        count: Object.keys(p.dex).length });
    }
    return out;
  },

  // owned creatures for a player id, as full objects the trade panels need
  // (sprite id + emoji + name + shiny flag), in dex-key order
  dexList(pid) {
    const p = this.root.players[pid];
    if (!p) return [];
    return Object.keys(p.dex).map(key => {
      const [w, i] = key.split("-").map(Number);
      const c = CREATURES[w] && CREATURES[w][i];
      return c ? { ...c, w, i, key, shiny: !!p.dex[key].shiny } : null;
    }).filter(Boolean);
  },

  // execute a confirmed 1-for-1 trade between the active player and a partner.
  // The {shiny} value travels with each Pokemon. Party arrays are fixed up
  // exactly like normalizePlayers (a traded-away Pokemon leaves the party; the
  // lead falls back safely, and a trainer is never left partner-less). Candy
  // does NOT move — it stays keyed to each player's own base creatures. Both
  // players' trade counters bump and both earn Best Friends on their first
  // trade. All dex writes land inside one save() call (atomic on disk).
  executeTrade(partnerPid, myKey, theirKey) {
    const me = this.state;
    const you = this.root.players[partnerPid];
    if (!me || !you || partnerPid === this.root.active) return { ok: false };
    const myEntry = me.dex[myKey];
    const yourEntry = you.dex[theirKey];
    if (!myEntry || !yourEntry) return { ok: false };

    // swap the dex entries — the sparkle travels with each Pokemon.
    // Delete BEFORE setting: when both kids trade the same species
    // (shiny Pikachu for plain Pikachu) the keys are identical, and
    // set-then-delete would erase the Pokemon from both dexes.
    delete me.dex[myKey];
    delete you.dex[theirKey];
    me.dex[theirKey] = { shiny: !!yourEntry.shiny };
    you.dex[myKey] = { shiny: !!myEntry.shiny };

    // party fixups: drop keys no longer owned; never leave a trainer partnerless
    me.party = (me.party || []).filter(k => me.dex[k]).slice(0, PARTY_MAX);
    you.party = (you.party || []).filter(k => you.dex[k]).slice(0, PARTY_MAX);
    if (!me.party.length && me.dex[theirKey]) me.party.push(theirKey);
    if (!you.party.length && you.dex[myKey]) you.party.push(myKey);

    // counters + first-trade trophy for BOTH trainers
    me.counters.trades = (me.counters.trades || 0) + 1;
    you.counters.trades = (you.counters.trades || 0) + 1;
    const myTrophies = [];
    this.awardFor(me, "trade-1", myTrophies);
    this.awardFor(you, "trade-1", null); // the partner sees it next time they play

    this.save();
    return { ok: true, myTrophies };
  },

  // ---- Puzzle Lab: bank a solved stage (best stars & fewest blocks only) ----
  // Light pattern like applyPractice: Math.max the record, award XP, count the
  // day's school stamp. The catch itself is a separate ceremony (startPuzzleCatch),
  // so this never touches the dex. Returns what the win card needs to show.
  applyPuzzle(stageId, stars, blocks) {
    const st = this.state;
    if (!st.puzzle) st.puzzle = {};
    const stage = PUZZLE_STAGES.find(s => s.id === stageId);
    const prev = st.puzzle[stageId];
    const firstClear = !prev || !prev.stars;
    const rec = st.puzzle[stageId] = {
      stars: Math.max(stars, prev ? prev.stars || 0 : 0),
      caught: !!(prev && prev.caught),
      bestBlocks: prev && prev.bestBlocks ? Math.min(prev.bestBlocks, blocks) : blocks,
    };
    // XP scaled like applyPractice/applyParagraph: a solve pays, mastery pays
    // more, and the first clear (plus capstones) gets a bonus.
    let xp = 15 + 10 * stars + (firstClear ? 10 : 0);
    if (stage && stage.capstone) xp += 15;
    st.xp += xp;
    this.dayInfo().school = true; // a lab solve counts for the day's third stamp
    const newTrophies = [];
    this.award("puzzle-1", newTrophies);                                  // 🧩 first solve ever
    if (this.allCodingStagesSolved()) this.award("puzzle-code", newTrophies); // 💻 all 24 coding stages
    if (this.allMathStagesSolved()) this.award("puzzle-math", newTrophies);   // 🔢 all 19 math stages
    if (this.allStagesThreeStars()) this.award("puzzle-stars", newTrophies);  // 🌟 3★ on every stage
    this.collectTrophies(newTrophies); // harmless now; catches add the real dex growth
    this.save();
    return { xp, newTrophies, firstClear, record: rec };
  },

  // ---- Puzzle Lab gating helpers ----
  // a chapter opens once EVERY stage of the chapter before it has >=1 star
  puzzleChapterComplete(pack, ch) {
    const list = PUZZLE_STAGES.filter(s => s.pack === pack && s.chapter === ch);
    return list.length > 0 && list.every(s => {
      const r = this.state.puzzle[s.id];
      return !!(r && r.stars > 0);
    });
  },
  // Master Coder: a star on all 24 coding stages
  allCodingStagesSolved() {
    return PUZZLE_STAGES.filter(s => s.pack === "code").every(s => {
      const r = this.state.puzzle[s.id];
      return !!(r && r.stars > 0);
    });
  },
  // Number Wizard: a star on all 19 math stages
  allMathStagesSolved() {
    return PUZZLE_STAGES.filter(s => s.pack === "math").every(s => {
      const r = this.state.puzzle[s.id];
      return !!(r && r.stars > 0);
    });
  },
  // Puzzle Perfect: three stars on EVERY stage (both packs). All these
  // completion checks look up records by stage id, so bookkeeping keys like
  // `_speed` on state.puzzle are never mistaken for a stage record.
  allStagesThreeStars() {
    return PUZZLE_STAGES.every(s => {
      const r = this.state.puzzle[s.id];
      return !!(r && r.stars >= 3);
    });
  },

  // ---- Puzzle Lab playback speed (🐢/🐇/⚡) — one setting per player, stored on
  // the puzzle save object under an underscore key so it never collides with a
  // stage id. Persists across reloads; defaults to medium. ----
  puzzleSpeed() {
    // `_speed` is a lone number tucked into the same map as the PuzzleRec
    // stage records (underscore key can't collide with a stage id), so it's
    // cast at these two sites rather than widening every stage record's type.
    const s = this.state.puzzle && /** @type {number} */ (/** @type {any} */ (this.state.puzzle)._speed);
    return (s === 0 || s === 1 || s === 2) ? s : 1;
  },
  setPuzzleSpeed(idx) {
    if (!this.state.puzzle) this.state.puzzle = {};
    /** @type {any} */ (this.state.puzzle)._speed = idx;
    this.save();
  },

  // mark a lab reward as caught once its ceremony awards it (bookkeeping so the
  // record schema stays honest; the dex is the real source of truth)
  markPuzzleCaught(stageId) {
    if (this.state.puzzle && this.state.puzzle[stageId]) {
      this.state.puzzle[stageId].caught = true;
      this.save();
    }
  },

  // build the creature object the catch ceremony needs from a "w-i" dex key
  puzzleCatchPick(key) {
    const [w, i] = key.split("-").map(Number);
    const c = CREATURES[w] && CREATURES[w][i];
    if (!c) return null;
    return { ...c, w, i, key, duplicate: !!this.state.dex[key] };
  },

  // ---- Maker Hut: kids design their own walk-grid puzzle stages ----
  // Custom stages live per-player under state.makerStages (NEVER in the shared
  // PUZZLE_STAGES list), and playing one is banked by applyMakerPlay — which
  // only adds XP. Nothing here ever touches state.puzzle, the dex, or the pack
  // trophy/counter checks (they all iterate PUZZLE_STAGES by pack), so a maker
  // stage can never pollute Master Coder / Number Wizard / Puzzle Perfect.
  makerStages() {
    return this.state.makerStages || (this.state.makerStages = []);
  },

  makerStageById(id) {
    return this.makerStages().find(s => s.id === id) || null;
  },

  // Validate a stage name — same charset + fold as word packs, its own 24-char
  // cap, and the 8-stage-per-kid cap (a stage being edited doesn't count).
  validateMakerName(rawName, existingId) {
    const name = (rawName || "").trim();
    if (!name) return { ok: false, error: "Give your stage a name first! 🔨" };
    const folded = Array.from(name).map(normalizeKey).join("");
    if (folded.length > MAKER_NAME_MAXLEN) {
      return { ok: false, error: `That name is a bit long — keep it under ${MAKER_NAME_MAXLEN} letters.` };
    }
    for (const ch of folded) {
      if (!WORDPACK_ALLOWED.test(ch)) {
        return { ok: false, error: `Oops — the name has ${charName(ch)}, which we can’t use. Try letters, spaces, or . , ' ! ?` };
      }
    }
    if (!existingId && this.makerStages().length >= MAKER_STAGES_MAX) {
      return { ok: false, error: `You already have ${MAKER_STAGES_MAX} stages — delete one to build another.` };
    }
    return { ok: true, name: folded };
  },

  // Create (existingId null) or update a published stage. The editor has already
  // proved it solvable and set optimal/budget; we defensively re-check the name,
  // the cell cap and that a flag exists. Awards 🔨/🏗️ on a NEW publish only.
  saveMakerStage(existingId, data) {
    const v = this.validateMakerName(data.name, existingId);
    if (!v.ok) return v;
    const cells = data.grid.reduce((n, row) => n + row.length, 0);
    if (cells > MAKER_GRID_MAX) return { ok: false, error: "That grid is too big — keep it 25 squares or fewer." };
    if (!data.grid.some(row => row.includes("o"))) {
      return { ok: false, error: "Add a flag 🏁 for your Pokemon to reach!" };
    }
    const stages = this.makerStages();
    const newTrophies = [];
    let stage;
    if (existingId && (stage = this.makerStageById(existingId))) {
      Object.assign(stage, {
        name: v.name, grid: data.grid, start: data.start, goal: data.goal,
        need: data.need, blocks: data.blocks, logic: !!data.logic,
        optimal: data.optimal, budget: data.budget,
      });
    } else {
      if (stages.length >= MAKER_STAGES_MAX) return { ok: false, error: `You already have ${MAKER_STAGES_MAX} stages — delete one to build another.` };
      stage = {
        id: "mk" + Date.now().toString(36) + Math.floor(Math.random() * 100),
        name: v.name, grid: data.grid, start: data.start, goal: data.goal,
        need: data.need, blocks: data.blocks, logic: !!data.logic,
        optimal: data.optimal, budget: data.budget, created: Date.now(),
      };
      stages.push(stage);
      this.award("maker-1", newTrophies);                 // 🔨 first published stage
      if (stages.length >= 5) this.award("maker-5", newTrophies); // 🏗️ five published
    }
    this.save();
    return { ok: true, stage, newTrophies };
  },

  deleteMakerStage(id) {
    const stages = this.makerStages();
    const i = stages.findIndex(s => s.id === id);
    if (i < 0) return false;
    stages.splice(i, 1);
    this.save();
    return true;
  },

  // Every OTHER profile's published stages, tagged with the creator's name, so
  // the "Family stages" shelf can list them read-only (like sibling ghosts).
  familyMakerStages() {
    const activePid = this.root.active;
    const out = [];
    for (const pid of Object.keys(this.root.players)) {
      if (pid === activePid) continue;
      const p = this.root.players[pid];
      if (!p.profile || !p.profile.name) continue;
      for (const s of (p.makerStages || [])) out.push({ pid, name: p.profile.name, stage: s });
    }
    return out;
  },

  // Bank a solved maker stage: a small XP treat and NOTHING else — no dex catch,
  // no puzzle record, no trophies, no counters. Keeps dex integrity and leaves
  // the creator's save completely untouched when a sibling plays their stage.
  applyMakerPlay(stars) {
    const xp = 10 + 5 * (stars || 0);
    this.state.xp += xp;
    this.save();
    return { xp };
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
      list.forEach((c, i) => { if (catchable(c) && !this.state.dex[`${w}-${i}`]) avail.push({ c, w, i }); });
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
      if (catchable(c) && this.state.dex[`${w}-${i}`] && EVOLUTIONS.some(f => f.base === `${w}-${i}`)) {
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
