// ============================================================
// TypeQuest — core game engine: prompts, typing, timers,
// combos, boss fights and creature catching.
// ============================================================

const Engine = {
  session: null,
  paused: false,
  pendingNext: false,
  timerRAF: null,

  difficulty() {
    const d = SAVE.state && SAVE.state.settings.difficulty;
    return DIFFICULTY[d] || DIFFICULTY.normal;
  },

  startStage(w, s) {
    const world = WORLDS[w];
    const isBoss = s === world.levels.length;
    const lvl = isBoss ? null : world.levels[s];
    const pool = isBoss ? world.bossPool : lvl.pool;
    const count = isBoss ? world.boss.hp : lvl.count;

    let prompts = [];
    while (prompts.length < count) prompts = prompts.concat(shuffle(pool.slice()));
    prompts = prompts.slice(0, count);

    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w, s, world, isBoss,
      prompts, idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0,
      hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: isBoss ? world.boss.time : lvl.time,
      state: "play",
      ninjaEligible: UI.kbHidden,
      pendingRes: null,
      catchCreature: null,
    };
    UI.gameStart(this.session);
    this.nextPrompt();
  },

  nextPrompt() {
    const S = this.session;
    if (!S || S.state === "done") return;
    S.idx++;
    if (S.idx >= S.prompts.length) { this.finishStage(); return; }
    S.state = "play";
    S.pos = 0;
    S.errorsThisPrompt = 0;
    S.text = S.prompts[S.idx];
    UI.showPrompt(S);
    const ms = (S.baseTime + S.text.length * 0.6) * this.difficulty().time * 1000;
    this.startTimer(ms);
  },

  startTimer(ms) {
    this.stopTimer();
    const S = this.session;
    S.timerMs = ms;
    S.promptStart = performance.now();
    const tick = () => {
      const el = performance.now() - S.promptStart;
      const frac = 1 - el / S.timerMs;
      UI.setTimer(Math.max(0, frac));
      if (frac <= 0) { this.timerRAF = null; this.onTimeout(); return; }
      this.timerRAF = requestAnimationFrame(tick);
    };
    this.timerRAF = requestAnimationFrame(tick);
  },

  stopTimer() {
    if (this.timerRAF) { cancelAnimationFrame(this.timerRAF); this.timerRAF = null; }
  },

  onTimeout() {
    const S = this.session;
    if (!S || this.paused) return;
    S.typingMs += S.timerMs;

    if (S.state === "catch") { this.catchFail(); return; }

    S.timeouts++;
    S.combo = 0;
    UI.superMode(false);
    S.state = "between";
    SFX.flee();

    if (S.isBoss) {
      S.hearts--;
      UI.bossAttack(S);
      SFX.hurt();
      if (S.hearts <= 0) { this.defeat(); return; }
    } else {
      UI.targetFlee(S);
    }
    UI.updateHud(S);
    setTimeout(() => { this.paused ? this.pendingNext = true : this.nextPrompt(); }, 800);
  },

  handleKey(e) {
    const S = this.session;
    if (UI.current !== "game" || !S) return;

    if (e.key === "Escape") { e.preventDefault(); this.paused ? this.resume() : this.pause(); return; }
    if (this.paused) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (S.state !== "play" && S.state !== "catch") return;

    UI.capsCheck(e);
    if (!UI.kbHidden) S.ninjaEligible = false;

    const expected = S.text[S.pos];
    SAVE.recordKey(expected, e.key === expected);

    if (e.key === expected) {
      S.pos++;
      S.hits++;
      S.combo++;
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.score += 1 + Math.floor(S.combo / 10);
      SFX.click(S.combo);
      UI.charDone(S);
      if (S.combo === 10) { UI.announce("Combo x10! 🔥"); SFX.combo(); }
      if (S.combo === 25) { UI.announce("SUPER MODE! ⚡"); SFX.combo(); UI.superMode(true); }
      if (S.combo === 50) { UI.announce("UNSTOPPABLE! 🌟"); SFX.combo(); }
      if (S.pos >= S.text.length) this.promptComplete();
    } else {
      S.errors++;
      S.errorsThisPrompt++;
      S.combo = 0;
      UI.superMode(false);
      SFX.error();
      UI.charError(S);
    }
    UI.updateHud(S);
  },

  promptComplete() {
    const S = this.session;
    this.stopTimer();
    S.typingMs += performance.now() - S.promptStart;

    if (S.state === "catch") { this.catchSuccess(); return; }

    S.state = "between";
    const perfect = S.errorsThisPrompt === 0;
    S.score += perfect ? 5 : 2;
    UI.updateHud(S);

    if (S.isBoss) { UI.bossHit(S); SFX.bossHit(); }
    else { UI.targetHit(S); SFX.word(); }

    setTimeout(() => { this.paused ? this.pendingNext = true : this.nextPrompt(); }, 800);
  },

  finishStage() {
    const S = this.session;
    this.stopTimer();
    S.state = "done";

    const total = S.hits + S.errors;
    const acc = total ? S.hits / total : 1;
    const minutes = Math.max(S.typingMs, 1000) / 60000;
    const wpm = Math.round((S.hits / 5) / minutes);

    let stars;
    if (S.isBoss) stars = S.hearts === 3 ? 3 : S.hearts === 2 ? 2 : 1;
    else stars = (S.timeouts === 0 && acc >= 0.95) ? 3 : (acc >= 0.85 && S.timeouts <= 1) ? 2 : 1;

    const ninja = S.ninjaEligible && UI.kbHidden;
    const diff = this.difficulty();
    let xp = S.isBoss ? 50 + 15 * stars : 20 + 10 * stars;
    if (acc >= 1 && total > 0) xp += 10;
    xp += Math.min(20, wpm);
    if (ninja) xp = Math.round(xp * 1.5);
    if (diff.xp > 1) xp = Math.round(xp * diff.xp);

    const res = {
      w: S.w, s: S.s, isBoss: S.isBoss, stars, acc, wpm, xp,
      score: S.score, bestCombo: S.bestCombo, errors: S.errors, timeouts: S.timeouts,
      ninja, turbo: diff.xp > 1, xpBefore: SAVE.state.xp,
      firstClear: SAVE.stageStars(S.w, S.s) === 0,
    };
    const applied = SAVE.applyResult(res);
    res.trophies = applied.newTrophies;
    res.levelUp = applied.levelUps;

    if (!S.isBoss && stars >= 1) {
      const c = SAVE.nextUncaught(S.w);
      if (c) { this.startCatch(c, res); return; }
    }
    UI.superMode(false);
    UI.showResults(res);
  },

  startCatch(creature, res) {
    const S = this.session;
    S.state = "reveal";
    S.pendingRes = res;
    S.catchCreature = creature;
    S.text = S.w === WORLDS.length - 1 ? creature.n : creature.n.toLowerCase();
    S.pos = 0;
    S.errorsThisPrompt = 0;
    // Pokemon names may use a few letters the player hasn't learned yet —
    // give bonus time for each so hunting them on the keyboard stays fun
    const taught = taughtKeys(S.w);
    const untaught = [...S.text.toLowerCase()].filter(c => !taught.has(c)).length;
    const ms = (3.5 + S.text.length * 0.7 + untaught * 1.2) * this.difficulty().time * 1000;
    // the ball wobbles, bursts open and the Pokemon pops out — only then
    // does the name prompt appear and the clock start
    UI.catchReveal(S, creature, () => {
      if (this.session !== S || S.state !== "reveal") return;
      S.state = "catch";
      UI.showCatch(S, creature);
      if (this.paused) S.timerRemaining = ms;
      else this.startTimer(ms);
    });
  },

  catchSuccess() {
    const S = this.session;
    S.state = "done";
    const res = S.pendingRes;
    const shiny = res.stars === 3 && Math.random() < 0.25;
    res.caught = { ...S.catchCreature, shiny };
    res.bestCombo = Math.max(res.bestCombo, S.bestCombo);
    const more = SAVE.addCreature(S.catchCreature.w, S.catchCreature.i, shiny)
      .concat(SAVE.bumpCombo(S.bestCombo));
    res.trophies = (res.trophies || []).concat(more);
    SFX.catchJingle();
    UI.catchAnim(S, true, () => { UI.superMode(false); UI.showResults(res); });
  },

  catchFail() {
    const S = this.session;
    S.state = "done";
    const res = S.pendingRes;
    res.fled = S.catchCreature;
    res.bestCombo = Math.max(res.bestCombo, S.bestCombo);
    res.trophies = (res.trophies || []).concat(SAVE.bumpCombo(S.bestCombo));
    SFX.flee();
    UI.catchAnim(S, false, () => { UI.superMode(false); UI.showResults(res); });
  },

  defeat() {
    const S = this.session;
    this.stopTimer();
    S.state = "done";
    SAVE.state.xp += 8; // consolation "training XP"
    SAVE.save();
    SFX.defeat();
    UI.superMode(false);
    UI.showDefeat(S);
  },

  pause() {
    const S = this.session;
    if (!S || S.state === "done") return;
    this.paused = true;
    if (this.timerRAF) {
      S.timerRemaining = S.timerMs - (performance.now() - S.promptStart);
      S.typingMs += performance.now() - S.promptStart;
      this.stopTimer();
    } else {
      S.timerRemaining = 0;
    }
    UI.pauseOverlay(true);
  },

  resume() {
    const S = this.session;
    this.paused = false;
    UI.pauseOverlay(false);
    if (!S || S.state === "done") return;
    if (this.pendingNext) {
      this.pendingNext = false;
      this.nextPrompt();
    } else if (S.timerRemaining > 0 && (S.state === "play" || S.state === "catch")) {
      this.startTimer(S.timerRemaining);
    }
  },

  restart() {
    const S = this.session;
    this.paused = false;
    this.pendingNext = false;
    UI.pauseOverlay(false);
    UI.superMode(false);
    if (S) this.startStage(S.w, S.s);
  },

  quitToMap() {
    this.stopTimer();
    this.paused = false;
    this.pendingNext = false;
    if (this.session) this.session.state = "done";
    this.session = null;
    UI.pauseOverlay(false);
    UI.superMode(false);
    UI.show("map");
  },
};
