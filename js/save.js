// ============================================================
// TypeQuest — save data (localStorage), XP, trophies, streaks
// ============================================================

const SAVE = {
  KEY: "typequest_save_v1",
  state: null,

  defaults() {
    return {
      v: 1,
      profile: null,               // {name, avatar}
      xp: 0,
      stages: {},                  // "w-s" -> best stars (s 0..4 levels, 5 boss)
      dex: {},                     // "w-i" -> {shiny:bool}
      trophies: {},                // id -> true
      settings: { sound: true, hints: true },
      streak: { last: null, count: 0 },
      stats: { keys: 0, correct: 0, bestWpm: 0, bestCombo: 0, history: [], perKey: {} },
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.state = raw ? Object.assign(this.defaults(), JSON.parse(raw)) : this.defaults();
    } catch (e) {
      this.state = this.defaults();
    }
    return this.state;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.state)); } catch (e) { /* private mode */ }
  },

  reset() {
    this.state = this.defaults();
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
    return w === 0 || this.stageStars(w - 1, 5) > 0;
  },

  stageUnlocked(w, s) {
    if (!this.worldUnlocked(w)) return false;
    return s === 0 || this.stageStars(w, s - 1) > 0;
  },

  worldStars(w) {
    let n = 0;
    for (let s = 0; s <= 5; s++) n += this.stageStars(w, s);
    return n;
  },

  caughtCount() {
    return Object.keys(this.state.dex).length;
  },

  nextUncaught(w) {
    const pool = CREATURES[w];
    const order = shuffle(pool.map((c, i) => i));
    for (const i of order) if (!this.state.dex[`${w}-${i}`]) return { ...pool[i], w, i };
    return null;
  },

  addCreature(w, i, shiny) {
    const newTrophies = [];
    this.state.dex[`${w}-${i}`] = { shiny: !!shiny };
    this.award("first-catch", newTrophies);
    if (shiny) this.award("shiny", newTrophies);
    const n = this.caughtCount();
    if (n >= 10) this.award("collect-10", newTrophies);
    if (n >= 25) this.award("collect-25", newTrophies);
    if (n >= 48) this.award("collect-all", newTrophies);
    this.save();
    return newTrophies;
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

    const after = levelFromXp(st.xp);
    this.save();
    return {
      newTrophies,
      levelUps: after.level > before.level ? { from: before.level, to: after.level, title: titleForLevel(after.level) } : null,
    };
  },
};
