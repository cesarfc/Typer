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

  maybePartyToast() {
    if (!SAVE._justAutoPartied) return;
    const c = SAVE.creatureByKey(SAVE._justAutoPartied);
    SAVE._justAutoPartied = null;
    if (c) setTimeout(() => UI.toast(`🎽 ${c.n} joined your party — it will fight beside you!`, "gold"), 600);
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
    // your lead party Pokemon fights beside you; in boss battles its
    // meter charges from your typing and unleashes an extra attack
    this.session.partner = SAVE.leadCreature();
    this.session.charge = 0;
    this.session.partnerReady = false;
    this.session.meterOn = isBoss && !!this.session.partner;
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
    // practice runs have no countdown — the "timer" is a count-up stopwatch
    let ms = S.practice ? Infinity : (S.baseTime + S.text.length * 0.6) * this.difficulty().time * 1000;
    // the first prompt shares the screen with the level announcement:
    // grant reading time so the lesson never costs the clock
    if (S.idx === 0 && isFinite(ms)) ms += 700;
    this.startTimer(ms);
  },

  startTimer(ms) {
    this.stopTimer();
    const S = this.session;
    S.timerMs = ms;
    S.promptStart = performance.now();
    const tick = () => {
      const el = performance.now() - S.promptStart;
      if (!isFinite(S.timerMs)) {
        UI.setStopwatch(S);
        this.timerRAF = requestAnimationFrame(tick);
        return;
      }
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

    if (S.state === "evolve") { this.evolveFail(); return; }
    if (S.state === "catch") { this.catchFail(); return; }
    if (S.wild) { this.wildFlee(); return; }

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
    if (S.state !== "play" && S.state !== "catch" && S.state !== "evolve" && S.state !== "welcome") return;

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
      if (S.state === "play") {
        // good typing charges your partner: combo streaks charge faster
        this.addCharge(S, 3 + (S.combo >= 25 ? 2 : S.combo >= 10 ? 1 : 0));
      }
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

  addCharge(S, amt) {
    if (!S.meterOn || S.partnerReady) return;
    S.charge = Math.min(100, S.charge + amt);
    if (S.charge >= 100) {
      S.partnerReady = true;
      UI.announce(`${S.partner.n} is ready! ⚡`, 1100);
      SFX.combo();
    }
    UI.partnerMeter(S);
  },

  promptComplete() {
    const S = this.session;
    this.stopTimer();
    S.typingMs += performance.now() - S.promptStart;

    if (S.state === "welcome") { this.finishHatch(); return; }
    if (S.state === "evolve") { this.evolveSuccess(); return; }
    if (S.state === "catch") { this.catchSuccess(); return; }

    S.state = "between";
    const perfect = S.errorsThisPrompt === 0;
    S.score += perfect ? 5 : 2;
    if (perfect) this.addCharge(S, 5); // flawless words charge the partner extra
    UI.updateHud(S);

    if (S.isBoss) { UI.bossHit(S); SFX.bossHit(); }
    else { UI.targetHit(S); SFX.word(); }

    // a fully charged partner strikes too, removing one enemy word outright
    let gap = 800;
    if (S.partnerReady && S.prompts.length - (S.idx + 1) > 0) {
      S.prompts.pop();
      S.partnerReady = false;
      S.charge = 0;
      gap = 1450;
      setTimeout(() => {
        if (this.session !== S || S.state !== "between") return;
        UI.partnerAttack(S);
      }, 550);
    }
    setTimeout(() => { this.paused ? this.pendingNext = true : this.nextPrompt(); }, gap);
  },

  // ---- Trainer School: no countdown, race your own best ----
  startPractice(tierId) {
    const tier = PRACTICE_TIERS.find(t => t.id === tierId);
    if (!tier || !SAVE.worldUnlocked(tier.need)) return;
    const pool = new Set();
    tier.worlds.forEach(w => WORLDS[w].levels.forEach(l =>
      l.pool.forEach(p => { if (p.length >= 3) pool.add(p); })));
    let prompts = [];
    while (prompts.length < tier.count) prompts = prompts.concat(shuffle([...pool]));
    prompts = prompts.slice(0, tier.count);

    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w: tier.need, s: -4, isBoss: false,
      world: {
        name: "Trainer School", gradient: ["#1b2142", "#3a3f6e"], accent: "#4dc3ff",
        targets: ["🎯", "🥊", "🛡️"], projectile: "⚡",
        hitText: ["Nice!", "Sharp!", "Clean!", "Quick!"],
        sceneEmojis: ["🎯", "💪", "⭐", "🏫"], levels: [],
      },
      prompts, idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 0, state: "play", practice: tier,
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false, meterOn: false,
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    UI.practiceScene(this.session);
    this.nextPrompt();
  },

  finishStage() {
    const S = this.session;
    this.stopTimer();
    if (S.practice) {
      S.state = "done";
      const total = S.hits + S.errors;
      const acc = total ? S.hits / total : 1;
      const timeMs = Math.round(Math.max(1000, S.typingMs));
      const wpm = Math.round((S.hits / 5) / (timeMs / 60000));
      const applied = SAVE.applyPractice(S.practice.id, timeMs, wpm, acc, S.bestCombo);
      UI.showPracticeResults({
        tier: S.practice, timeMs, wpm, acc, bestCombo: S.bestCombo, ...applied,
      });
      return;
    }
    if (S.wild) { S.state = "between"; this.startWildCatch(); return; }
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
    res.egg = applied.egg;
    res.best = applied.best;
    res.medalUp = applied.medalUp;

    if (!S.isBoss && stars >= 1) {
      const c = SAVE.pickCatch(S.w, stars);
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
    S.text = worldProperNames(S.w) ? creature.n : creature.n.toLowerCase();
    S.pos = 0;
    S.errorsThisPrompt = 0;
    // Pokemon names may use a few letters the player hasn't learned yet —
    // give bonus time for each so hunting them on the keyboard stays fun
    const taught = taughtKeys(S.w);
    const untaught = [...S.text.toLowerCase()].filter(c => !taught.has(c)).length;
    const ms = (3.5 + S.text.length * 0.7 + untaught * 1.2) * this.difficulty().time * 1000;
    // catching right after winning shouldn't sting: no clock on Chill
    // or anywhere in the first world
    S.relaxedCatch = this.difficulty().time > 1 || S.w === 0;
    // the ball wobbles, bursts open and the Pokemon pops out — only then
    // does the name prompt appear and the clock start
    UI.catchReveal(S, creature, () => {
      if (this.session !== S || S.state !== "reveal") return;
      S.state = "catch";
      UI.showCatch(S, creature);
      if (S.relaxedCatch) return;
      if (this.paused) S.timerRemaining = ms;
      else this.startTimer(ms);
    });
  },

  catchSuccess() {
    const S = this.session;
    S.state = "done";
    const res = S.pendingRes;
    const c = S.catchCreature;
    res.bestCombo = Math.max(res.bestCombo, S.bestCombo);
    let more;
    if (S.wild && S.wild.source === "legendary" && c.duplicate) {
      // a duplicate legendary turns the owned one shiny (or pays XP)
      const key = `${c.w}-${c.i}`;
      const entry = SAVE.state.dex[key];
      if (entry && !entry.shiny) {
        entry.shiny = true;
        res.legendShiny = c;
        more = [];
        SAVE.award("shiny", more);
      } else {
        SAVE.state.xp += 30;
        res.dupXp = { creature: c, xp: 30 };
        more = [];
      }
      SAVE.award("legend-1", more);
      more = more.concat(SAVE.bumpCombo(S.bestCombo));
      SAVE.save();
    } else if (c.duplicate) {
      // duplicate catch: earns candy for that family (or bonus XP if it has none)
      const baseKey = `${c.w}-${c.i}`;
      if (SAVE.familyFor(baseKey)) {
        const count = SAVE.addCandy(baseKey);
        res.candy = { creature: c, count, ready: SAVE.evoTargetsFor(baseKey).length > 0 };
      } else {
        SAVE.state.xp += 12;
        SAVE.save();
        res.dupXp = { creature: c, xp: 12 };
      }
      more = SAVE.bumpCombo(S.bestCombo);
    } else {
      const odds = SAVE.shinyOdds();
      const shiny = (res.wild ? Math.random() < odds.wild : res.stars === 3 && Math.random() < odds.catch3);
      res.caught = { ...c, shiny };
      more = SAVE.addCreature(c.w, c.i, shiny).concat(SAVE.bumpCombo(S.bestCombo));
      if (S.wild && S.wild.source === "legendary") SAVE.award("legend-1", more);
    }
    res.trophies = (res.trophies || []).concat(more);
    SFX.catchJingle();
    this.maybePartyToast();
    if (res.wild) {
      SAVE.bump(S.wild.source === "fish" ? "fishCatches" : "wildCatches");
      SAVE.state.xp += 15;
      SAVE.save();
      UI.catchAnim(S, true, () => {
        this.session = null;
        UI.superMode(false);
        UI.show("map");
        UI.renderTopbar();
        const legendary = S.wild.source === "legendary";
        const msg = res.legendShiny
          ? `🌟 Your ${res.legendShiny.n} turned <b>✨ SHINY</b>! +15 XP`
          : res.caught
            ? `${legendary ? "🌟 LEGENDARY!" : "🎉"} Caught a wild${res.caught.shiny ? " ✨ SHINY" : ""} <b>${res.caught.n}</b>! +15 XP`
            : res.candy
              ? `🍬 Wild ${res.candy.creature.n} gave +1 candy (${res.candy.count}/${CANDY_COST})! +15 XP`
              : `✨ +${res.dupXp ? res.dupXp.xp + 15 : 15} XP!`;
        UI.toast(msg, "gold");
        if (legendary && res.caught) UI.confetti();
        res.trophies.forEach((t, i) => setTimeout(() => UI.trophyToast(t), 700 + i * 800));
      });
      return;
    }
    UI.catchAnim(S, true, () => { UI.superMode(false); UI.showResults(res); });
  },

  // ---- wild encounters from the map: tall grass + fishing ----
  battleWords(w, n) {
    const all = [];
    WORLDS[w].levels.forEach(l => l.pool.forEach(p => { if (p.length >= 3) all.push(p); }));
    return shuffle(all).slice(0, n);
  },

  reelWord() {
    let wMax = 0;
    for (let w = 0; w < WORLDS.length; w++) if (SAVE.worldUnlocked(w)) wMax = w;
    const pool = WORLDS[wMax].levels[WORLDS[wMax].levels.length - 1].pool;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  wildSession(w, prompts, wild) {
    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w, s: -2, world: WORLDS[w], isBoss: false,
      prompts, idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 5, state: "play", wild,
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    this.session.partner = SAVE.leadCreature();
    this.session.charge = 0;
    this.session.partnerReady = false;
    this.session.meterOn = wild.source === "legendary" && !!this.session.partner;
    return this.session;
  },

  // ---- weekly roaming legendary: one attempt, three words, the name ----
  startLegendary() {
    const r = SAVE.roamerNow();
    if (!r) return;
    SAVE.markRoamerDone(); // the attempt is spent, win or flee
    let wMax = 0;
    for (let w = 0; w < WORLDS.length; w++) if (SAVE.worldUnlocked(w)) wMax = w;
    const S = this.wildSession(r.w, this.battleWords(wMax, 3), { creature: r, source: "legendary" });
    S.baseTime = 4;
    UI.wildScene(S);
    this.nextPrompt();
  },

  startWildGrass(w, spotId) {
    const pick = SAVE.wildPick(w);
    if (!pick) return;
    SAVE.useGrass(spotId);
    const S = this.wildSession(w, this.battleWords(w, 2), { creature: pick, source: "grass" });
    UI.wildScene(S);
    this.nextPrompt();
  },

  startFishing() {
    const pick = SAVE.fishPick();
    if (!pick) return;
    SAVE.useCast();
    const S = this.wildSession(pick.w, [this.reelWord()], { creature: pick, source: "fish" });
    S.state = "wait"; // nothing is biting yet...
    S.baseTime = 3;   // when it bites, reel fast!
    UI.wildScene(S);
    setTimeout(() => {
      if (this.session !== S || S.state !== "wait") return;
      SFX.pop();
      UI.announce("❗ Something bit!", 1200);
      S.state = "play";
      if (this.paused) this.pendingNext = true;
      else this.nextPrompt();
    }, 1300 + Math.random() * 1700);
  },

  // battle words done -> the catch attempt begins
  startWildCatch() {
    const S = this.session;
    const c = S.wild.creature;
    const res = { wild: true, stars: 0, bestCombo: S.bestCombo, trophies: [] };
    S.pendingRes = res;
    S.catchCreature = c;
    S.text = worldProperNames(c.w) ? c.n : c.n.toLowerCase();
    S.pos = 0;
    S.errorsThisPrompt = 0;
    const taught = taughtKeys(S.w);
    const untaught = [...S.text.toLowerCase()].filter(ch => !taught.has(ch)).length;
    const ms = (3.5 + S.text.length * 0.7 + untaught * 1.2) * this.difficulty().time * 1000;
    // Chill trainers and first-world catches get no clock — but the
    // weekly legendary stays a real challenge
    S.relaxedCatch = (this.difficulty().time > 1 || S.w === 0) && S.wild.source !== "legendary";
    if (S.wild.source === "fish") {
      // what's on the hook?! full pokeball-style reveal
      S.state = "reveal";
      UI.catchReveal(S, c, () => {
        if (this.session !== S || S.state !== "reveal") return;
        S.state = "catch";
        UI.showCatch(S, c);
        if (S.relaxedCatch) return;
        if (this.paused) S.timerRemaining = ms;
        else this.startTimer(ms);
      });
    } else {
      // the grass Pokemon is already out and weakened — go!
      S.state = "catch";
      UI.showCatch(S, c);
      UI.announce(S.relaxedCatch ? "Type its name — no rush!" : "Now! Type its name!", 1400);
      if (S.relaxedCatch) return;
      if (this.paused) S.timerRemaining = ms;
      else this.startTimer(ms);
    }
  },

  wildFlee() {
    const S = this.session;
    this.stopTimer();
    S.state = "done";
    SFX.flee();
    UI.targetFlee(S);
    setTimeout(() => {
      this.session = null;
      UI.superMode(false);
      UI.show("map");
      UI.toast(`💨 The wild ${S.wild.creature.n} escaped into the wild!`);
    }, 1000);
  },

  // ---- Mystery Egg hatching: triggered from the map once warmed ----
  startHatch() {
    const st = SAVE.state;
    if (!st.egg || st.egg.progress < 3) return;
    const pick = SAVE.eggPick();
    if (!pick) {
      st.egg = null;
      SAVE.save();
      UI.toast("🥚 The egg was just a round rock. How embarrassing.");
      return;
    }
    const shiny = !pick.duplicate && Math.random() < SAVE.eggShinyChance();
    this.paused = false;
    this.pendingNext = false;
    const S = this.session = {
      w: pick.w, s: -3, world: WORLDS[pick.w], isBoss: false,
      prompts: [], idx: 0,
      text: worldProperNames(pick.w) ? pick.n : pick.n.toLowerCase(),
      pos: 0, score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 0, state: "hatchwait",
      hatch: { creature: pick, shiny, trophies: [] },
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    UI.hatchReveal(S, () => {
      if (this.session !== S || S.state !== "hatchwait") return;
      // award at the reveal so nothing can be lost afterwards
      const trophies = [];
      if (pick.duplicate) {
        const baseKey = `${pick.w}-${pick.i}`;
        SAVE.addCandy(baseKey);
        SAVE.addCandy(baseKey);
        S.hatch.candy = SAVE.addCandy(baseKey);
      } else {
        trophies.push(...SAVE.addCreature(pick.w, pick.i, shiny));
        this.maybePartyToast();
      }
      st.egg = null;
      SAVE.award("hatch-1", trophies);
      SAVE.save();
      S.hatch.trophies = trophies;
      S.state = "welcome"; // type its name — no timer, no way to fail
      UI.showWelcomePrompt(S);
    });
  },

  finishHatch() {
    const S = this.session;
    S.state = "done";
    const { creature, shiny, candy, trophies } = S.hatch;
    SAVE.bump("hatches");
    SAVE.save();
    UI.confetti();
    SFX.fanfare();
    setTimeout(() => {
      this.session = null;
      UI.superMode(false);
      UI.show("map");
      UI.renderTopbar();
      const msg = candy
        ? `🐣 The egg hatched a ${creature.n} — it shared 🍬 ${CANDY_COST} candy (${candy}/${CANDY_COST})!`
        : `🐣 The egg hatched into${shiny ? " a ✨ SHINY" : ""} <b>${creature.n}</b>!`;
      UI.toast(msg, "gold");
      trophies.forEach((t, i) => setTimeout(() => UI.trophyToast(t), 700 + i * 800));
    }, 1000);
  },

  // ---- evolution: triggered from the Pokedex, type the evolved name ----
  startEvolution(baseKey, targetKey) {
    const [bw, bi] = baseKey.split("-").map(Number);
    const [tw, ti] = targetKey.split("-").map(Number);
    const base = CREATURES[bw][bi];
    const target = CREATURES[tw][ti];
    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w: bw, s: -1, world: WORLDS[bw], isBoss: false,
      prompts: [], idx: 0,
      text: worldProperNames(tw) ? target.n : target.n.toLowerCase(),
      pos: 0, score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 4.5, state: "evolve",
      evo: { baseKey, targetKey, base, target },
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    UI.evolutionScene(this.session);
    const taught = taughtKeys(bw);
    const untaught = [...this.session.text.toLowerCase()].filter(ch => !taught.has(ch)).length;
    this.startTimer((4.5 + this.session.text.length * 0.75 + untaught * 1.2) * this.difficulty().time * 1000);
  },

  evolveSuccess() {
    const S = this.session;
    S.state = "done";
    const { baseKey, targetKey, base, target } = S.evo;
    const applied = SAVE.applyEvolution(baseKey, targetKey);
    SFX.catchJingle();
    UI.evolveAnim(S, applied.outcome, () => {
      this.session = null;
      UI.superMode(false);
      UI.show("dex");
      const msg = applied.outcome === "new"
        ? `🧬 ${base.n} evolved into <b>${target.n}</b>!`
        : applied.outcome === "shiny"
          ? `🧬 ${target.n} turned <b>✨ SHINY</b>!`
          : `🧬 ${target.n} grew stronger! +15 XP`;
      UI.toast(msg, "gold");
      applied.newTrophies.forEach((t, i) => setTimeout(() => UI.trophyToast(t), 600 + i * 800));
    });
  },

  evolveFail() {
    const S = this.session;
    S.state = "done";
    SFX.flee();
    UI.announce("It took a deep breath...", 1200);
    setTimeout(() => {
      this.session = null;
      UI.superMode(false);
      UI.show("dex");
      UI.toast("😮‍💨 The evolution fizzled — your candy is safe. Try again!");
    }, 1300);
  },

  catchFail() {
    const S = this.session;
    S.state = "done";
    const res = S.pendingRes;
    res.fled = S.catchCreature;
    res.bestCombo = Math.max(res.bestCombo, S.bestCombo);
    res.trophies = (res.trophies || []).concat(SAVE.bumpCombo(S.bestCombo));
    SFX.flee();
    if (res.wild) {
      UI.catchAnim(S, false, () => {
        this.session = null;
        UI.superMode(false);
        UI.show("map");
        UI.toast(`💨 The wild ${res.fled.n} got away... the grass will rustle again tomorrow!`);
      });
      return;
    }
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
    this.stopTimer();
    UI.pauseOverlay(false);
    UI.superMode(false);
    if (!S) return;
    // non-story sessions can't restart via startStage (negative stage idx)
    if (S.practice) { this.startPractice(S.practice.id); return; }
    if (S.s >= 0) { this.startStage(S.w, S.s); return; }
    this.session = null;
    UI.show("map");
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
