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

  startStage(w, s, opts = {}) {
    const world = WORLDS[w];
    const isBoss = s === world.levels.length;
    const lvl = isBoss ? null : world.levels[s];
    // skill band: Explorer faces shorter words and softer bosses, Ace the
    // opposite — orthogonal to the time-based difficulty setting
    const band = BANDS[opts.band || SAVE.state.band] ? (opts.band || SAVE.state.band) : "trainer";
    // boss runs have no level object, so the count comes from the boss HP +
    // band before we filter the pool (bosses get band-length filtering too)
    const rawPool = isBoss ? world.bossPool : lvl.pool;
    const count = isBoss ? Math.max(6, world.boss.hp + BANDS[band].bossHp) : lvl.count;
    const pool = bandPool(rawPool, band, count);

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
      baseTime: (isBoss ? world.boss.time : lvl.time) * BANDS[band].time,
      band,
      timeScale: opts.assist ? 1.45 : 1, // one-run "more time" rescue
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
    // Gym Rematch: same boss, a tighter clock — stash the tier so finishStage
    // routes to the medal path instead of normal progression
    if (opts.rematch) {
      this.session.rematch = opts.rematch;
      this.session.baseTime *= opts.rematch.timeMul;
    }
    UI.gameStart(this.session);
    this.nextPrompt();
  },

  // refight an already-beaten boss for a Silver/Gold rematch medal
  startRematch(w, tierId) {
    const tier = REMATCH_TIERS.find(t => t.id === tierId);
    const bossS = WORLDS[w].levels.length;
    if (!tier || SAVE.stageStars(w, bossS) <= 0) return; // only beaten bosses
    this.startStage(w, bossS, { rematch: tier });
  },

  nextPrompt() {
    const S = this.session;
    if (!S || S.state === "done") return;
    // a raid attempt ends the instant the family drops the boss to 0 HP
    if (S.raid && S.raidDealt >= S.raid.hp) { this.finishStage(); return; }
    S.idx++;
    if (S.idx >= S.prompts.length) { this.finishStage(); return; }
    S.state = "play";
    S.pos = 0;
    S.errorsThisPrompt = 0;
    const p = S.prompts[S.idx];
    S.text = promptAnswer(p);
    UI.showPrompt(S);

    if (S.practice || S.paragraph) { this.startTimer(Infinity); return; }

    // typing-only budget (the clock measures fluency, never thinking)
    let ms = (S.baseTime + S.text.length * 0.6) * this.difficulty().time * 1000 * (S.timeScale || 1);
    if (S.idx === 0 && isFinite(ms)) ms += 700; // reading time for the announce

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

    const key = normalizeKey(e.key);
    const expected = S.text[S.pos];
    SAVE.recordKey(expected, key === expected);

    if (key === expected) {
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
      // Story Typing ghost: a paragraph is one long prompt, so we can't wait
      // for promptComplete — snapshot the cumulative typing time each time a
      // word lands (the char just typed was a space) and once at the very end.
      // typingMs + this prompt's elapsed stays correct across pause()/resume().
      if (S.paragraphMode && S.wordTimes && (expected === " " || S.pos >= S.text.length)) {
        S.wordTimes.push(S.typingMs + (performance.now() - S.promptStart));
      }
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
    // Practice Ghost: snapshot cumulative typing time as each word lands
    if (S.practice && S.wordTimes) S.wordTimes.push(S.typingMs);

    if (S.state === "welcome") { S.puzzleCatch ? this.finishPuzzleCatch() : this.finishHatch(); return; }
    if (S.state === "evolve") { this.evolveSuccess(); return; }
    if (S.state === "catch") { this.catchSuccess(); return; }

    S.state = "between";
    const perfect = S.errorsThisPrompt === 0;
    // Flawless daily mutator: a missed word returns for another go
    if (S.requeueMissed && !perfect && (S.requeued || 0) < 4) {
      S.prompts.push(S.text);
      S.requeued = (S.requeued || 0) + 1;
    }
    S.score += perfect ? 5 : 2;
    if (perfect) this.addCharge(S, 5); // flawless words charge the partner extra
    UI.updateHud(S);

    // Weekly Raid: each finished word deals its letters as damage to the
    // shared boss. Show the number, chip the bar, and end the moment it drops.
    if (S.raid) {
      const dmg = S.text.length;
      S.raidDealt = (S.raidDealt || 0) + dmg;
      UI.raidHit(S, dmg);
      SFX.bossHit();
      setTimeout(() => { this.paused ? this.pendingNext = true : this.nextPrompt(); }, 850);
      return;
    }

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

    // Practice Ghost: race the per-word pace of your best-TIME run so far.
    // Old saves (or a first attempt) simply have no ghost yet.
    const rec = SAVE.state.practice[tierId] || {};
    const ghost = rec.ghost && rec.ghost.length ? rec.ghost : null;

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
      wordTimes: [], ghost, // cumulative ms per word; ghost = best run's snapshots
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false, meterOn: false,
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    UI.practiceScene(this.session);
    this.nextPrompt();
  },

  // Story Typing: one long paragraph, count-up stopwatch, race your own wpm
  startParagraph(id) {
    const def = PARAGRAPHS.find(p => p.id === id);
    if (!def || !SAVE.worldUnlocked(def.need)) return;
    // Story Ghost: race the per-word pace of your best-WPM run (guard old saves)
    const rec = (SAVE.state.paragraphs || {})[id] || {};
    const ghost = rec.ghost && rec.ghost.length ? rec.ghost : null;
    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w: def.need, s: -7, isBoss: false,
      world: {
        name: "Story Typing", gradient: ["#142233", "#2d3a6e"], accent: "#7ee787",
        targets: ["📖"], projectile: "✨",
        hitText: ["The End!", "Bravo!", "Beautiful!", "Word perfect!"],
        sceneEmojis: ["📖", "✨", "📚", "🪶"], levels: [],
      },
      paragraph: { id, def }, paragraphMode: true,
      prompts: [def.text], idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 0, state: "play",
      wordTimes: [], ghost, // cumulative ms per word; ghost = best run's snapshots
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false, meterOn: false,
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    UI.practiceScene(this.session);
    this.nextPrompt();
  },

  finishStage() {
    const S = this.session;
    this.stopTimer();
    if (S.raid) { this.finishRaid(false); return; }
    if (S.practice) {
      S.state = "done";
      const total = S.hits + S.errors;
      const acc = total ? S.hits / total : 1;
      const timeMs = Math.round(Math.max(1000, S.typingMs));
      const wpm = Math.round((S.hits / 5) / (timeMs / 60000));
      // Practice Ghost: how did this run stack up against the ghost we raced?
      let ghost = null;
      if (S.ghost && S.ghost.length) {
        const ghostFinal = S.ghost[S.ghost.length - 1];
        ghost = { beat: timeMs < ghostFinal, deltaMs: Math.abs(timeMs - ghostFinal) };
      }
      const applied = SAVE.applyPractice(S.practice.id, timeMs, wpm, acc, S.bestCombo, S.wordTimes);
      UI.showPracticeResults({
        tier: S.practice, timeMs, wpm, acc, bestCombo: S.bestCombo, ghost, ...applied,
      });
      return;
    }
    if (S.paragraph) {
      S.state = "done";
      const total = S.hits + S.errors;
      const acc = total ? S.hits / total : 1;
      const timeMs = Math.round(Math.max(1000, S.typingMs));
      const wpm = Math.round((S.hits / 5) / (timeMs / 60000));
      // Story Ghost verdict: did you out-race the ghost of your best run?
      let ghost = null;
      if (S.ghost && S.ghost.length) {
        const ghostFinal = S.ghost[S.ghost.length - 1];
        ghost = { beat: timeMs < ghostFinal, deltaMs: Math.abs(timeMs - ghostFinal) };
      }
      const applied = SAVE.applyParagraph(S.paragraph.id, timeMs, wpm, acc, S.wordTimes);
      UI.showParagraphResults({ def: S.paragraph.def, timeMs, wpm, acc, ghost, ...applied });
      return;
    }
    if (S.daily) { this.finishDaily(); return; }
    if (S.elite) { this.finishEliteRound(); return; }
    if (S.wild) { S.state = "between"; this.startWildCatch(); return; }
    S.state = "done";

    const total = S.hits + S.errors;
    const acc = total ? S.hits / total : 1;
    const minutes = Math.max(S.typingMs, 1000) / 60000;
    const wpm = Math.round((S.hits / 5) / minutes);

    let stars;
    if (S.isBoss) stars = S.hearts === 3 ? 3 : S.hearts === 2 ? 2 : 1;
    else stars = (S.timeouts === 0 && acc >= 0.95) ? 3 : (acc >= 0.85 && S.timeouts <= 1) ? 2 : 1;

    // a rematch reuses the boss star rule but never rewrites progression
    if (S.rematch) { this.finishRematch(S, stars, acc, wpm); return; }

    const ninja = S.ninjaEligible && UI.kbHidden;
    const diff = this.difficulty();
    let xp = S.isBoss ? 50 + 15 * stars : 20 + 10 * stars;
    if (acc >= 1 && total > 0) xp += 10;
    xp += Math.min(20, wpm);
    if (ninja) xp = Math.round(xp * 1.5);
    if (diff.xp > 1) xp = Math.round(xp * diff.xp);
    xp = Math.round(xp * (BANDS[S.band] ? BANDS[S.band].xp : 1));

    const res = {
      w: S.w, s: S.s, isBoss: S.isBoss, stars, acc, wpm, xp,
      score: S.score, bestCombo: S.bestCombo, errors: S.errors, timeouts: S.timeouts,
      ninja, turbo: diff.xp > 1, xpBefore: SAVE.state.xp,
      band: S.band || "trainer",
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

  // ---- Gym Rematch finish: grant XP + a medal, leave stars/medals/unlocks
  // untouched. Losing (too few hearts) simply keeps the boss beaten. ----
  finishRematch(S, stars, acc, wpm) {
    S.state = "done";
    const tier = S.rematch;
    const diff = this.difficulty();
    const xpBefore = SAVE.state.xp;
    let xp = 40 + 15 * stars + Math.min(20, wpm);
    if (diff.xp > 1) xp = Math.round(xp * diff.xp);
    SAVE.state.xp += xp;
    const res = {
      w: S.w, s: S.s, isBoss: true, stars, acc, wpm, xp,
      score: S.score, bestCombo: S.bestCombo, errors: S.errors, timeouts: S.timeouts,
      ninja: false, turbo: diff.xp > 1, xpBefore,
      band: S.band || "trainer", firstClear: false,
      rematch: tier, trophies: [],
    };
    if (stars >= tier.needStars) {
      const applied = SAVE.applyRematch(S.w, tier); // also persists the XP
      res.rematchMedal = applied;
      res.trophies = applied.newTrophies;
    } else {
      SAVE.save(); // no medal — still bank the XP
    }
    UI.superMode(false);
    UI.showResults(res);
  },

  startCatch(creature, res) {
    const S = this.session;
    S.state = "reveal";
    S.pendingRes = res;
    S.catchCreature = creature;
    // decide shininess up front so the ball-reveal can pop out the shiny
    // sprite (and twinkle) live, instead of springing it on the results card
    S.catchShiny = !creature.duplicate && res.stars === 3 && Math.random() < SAVE.shinyOdds().catch3;
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
      // a wild already revealed its shininess on the field; a post-level catch
      // decided it at the ball-reveal (S.catchShiny) — either way it's locked in
      const shiny = res.wild ? !!S.wild.shiny : !!S.catchShiny;
      res.caught = { ...c, shiny };
      more = SAVE.addCreature(c.w, c.i, shiny).concat(SAVE.bumpCombo(S.bestCombo));
      if (S.wild && S.wild.source === "legendary") SAVE.award("legend-1", more);
    }
    res.trophies = (res.trophies || []).concat(more);
    SFX.catchJingle();
    this.maybePartyToast();
    if (res.wild) {
      const raidClaim = S.wild.source === "raid";
      SAVE.bump(S.wild.source === "fish" ? "fishCatches" : raidClaim ? "raidClaims" : "wildCatches");
      SAVE.state.xp += 15;
      SAVE.save();
      UI.catchAnim(S, true, () => {
        this.session = null;
        UI.superMode(false);
        UI.show("map");
        UI.renderTopbar();
        const legendary = S.wild.source === "legendary";
        const raidXp = raidClaim ? (S.raidClaim.bonusXp + 15) : 15;
        const msg = raidClaim
          ? (res.caught
              ? `⚔️ RAID REWARD! You caught${res.caught.shiny ? " a ✨ SHINY" : ""} <b>${res.caught.n}</b>! +${raidXp} XP`
              : res.candy
                ? `⚔️ Raid reward! Another ${res.candy.creature.n} shared 🍬 +1 candy (${res.candy.count}/${CANDY_COST})! +${raidXp} XP`
                : `⚔️ Raid reward claimed! +${raidXp} XP`)
          : res.legendShiny
            ? `🌟 Your ${res.legendShiny.n} turned <b>✨ SHINY</b>! +15 XP`
            : res.caught
              ? `${legendary ? "🌟 LEGENDARY!" : "🎉"} Caught a wild${res.caught.shiny ? " ✨ SHINY" : ""} <b>${res.caught.n}</b>! +15 XP`
              : res.candy
                ? `🍬 Wild ${res.candy.creature.n} gave +1 candy (${res.candy.count}/${CANDY_COST})! +15 XP`
                : `✨ +${res.dupXp ? res.dupXp.xp + 15 : 15} XP!`;
        UI.toast(msg, "gold");
        if ((legendary && res.caught) || raidClaim) UI.confetti();
        res.trophies.forEach((t, i) => setTimeout(() => UI.trophyToast(t), 700 + i * 800));
        // a shiny catch or a raid win can cross a wardrobe gate (shinies / raidWins)
        UI.flashWardrobeUnlocks();
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
    // shiny is decided the moment the wild Pokemon appears — so the trainer
    // discovers it sparkling during the battle, not only at the catch. Only a
    // brand-new (non-duplicate) catch can shine.
    if (!wild.creature.duplicate && Math.random() < SAVE.shinyOdds().wild) wild.shiny = true;
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

  // ---- Weekly Raid Boss: an attempt is a wave of battle words; each finished
  // word deals its letters as damage to the family's shared HP bar ----
  startRaid() {
    const raid = SAVE.raidNow();
    if (!raid) return;
    if (raid.defeated) { this.startRaidClaim(); return; } // already down — go claim
    let wMax = 0;
    for (let w = 0; w < WORLDS.length; w++) if (SAVE.worldUnlocked(w)) wMax = w;
    this.paused = false;
    this.pendingNext = false;
    const S = this.session = {
      w: raid.w, s: -5, world: WORLDS[raid.w], isBoss: true, raid,
      prompts: this.battleWords(wMax, RAID_WORDS), idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 5, state: "play", raidDealt: 0,
      ninjaEligible: false, pendingRes: null, catchCreature: null,
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false, meterOn: false,
    };
    UI.raidScene(S);
    this.nextPrompt();
  },

  // ---- Raid finish: bank the damage dealt (win or run out of hearts). When
  // the family drops the boss, contributors get a claim prize back on the map ----
  finishRaid(lostHearts) {
    const S = this.session;
    this.stopTimer();
    S.state = "done";
    const dealt = S.raidDealt || 0;
    const xp = 10 + dealt;                 // a little XP for every attempt
    SAVE.state.xp += xp;
    const info = SAVE.raidDamage(dealt);   // subtract from the shared bar (also saves)
    UI.superMode(false);
    UI.showRaidResults(S, { ...info, dealt, xp, lostHearts });
  },

  // ---- Raid claim: a contributor's reward once the boss is down — big XP and
  // a guaranteed, generous-timer catch of the raid legendary (boosted shiny) ----
  startRaidClaim() {
    const claim = SAVE.claimRaid();
    if (!claim.ok) {
      if (claim.reason === "nocontrib") {
        UI.toast("💪 Land at least one hit on the raid boss first — then claim your prize!", "gold");
      } else if (claim.reason === "claimed") {
        UI.toast("✅ You already claimed this week's raid reward. A new boss appears next week!");
      } else {
        UI.toast("The raid boss is still standing — chip away at it first!");
      }
      UI.show("map");
      return;
    }
    const raid = SAVE.raidNow();
    const c = { ...CREATURES[HALL_W][raid.i], w: HALL_W, i: raid.i,
      duplicate: !!SAVE.state.dex[`${HALL_W}-${raid.i}`] };
    const bonusXp = 100;
    SAVE.state.xp += bonusXp;              // big XP for finishing the raid
    SAVE.save();
    // boosted shiny odds for a brand-new raid legendary
    const shiny = !c.duplicate && Math.random() < (SAVE.shinyOdds().wild + 0.15);
    this.paused = false;
    this.pendingNext = false;
    const res = { wild: true, stars: 0, bestCombo: 0, raidClaim: true,
      trophies: (claim.newTrophies || []).slice() };
    const S = this.session = {
      w: HALL_W, s: -6, world: WORLDS[HALL_W], isBoss: false,
      wild: { creature: c, source: "raid", shiny },
      raidClaim: { bonusXp, contrib: claim.contrib },
      prompts: [], idx: 0, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 0, state: "reveal", relaxedCatch: true, // guaranteed reward — no clock
      pendingRes: res, catchCreature: c, ninjaEligible: false,
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false, meterOn: false,
    };
    S.text = worldProperNames(HALL_W) ? c.n : c.n.toLowerCase();
    UI.raidClaimScene(S);
    UI.catchReveal(S, c, () => {
      if (this.session !== S || S.state !== "reveal") return;
      S.state = "catch";
      UI.showCatch(S, c);
      UI.announce("🎉 Type its name to add it to your Pokedex!", 2000);
    });
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

  // ---- Puzzle Lab catch: the reward for first-solving a lab stage. A clone of
  // startHatch — a synthetic session (sentinel s:-8), award at the ball reveal,
  // then the no-clock "type its name" ceremony (state "welcome"). ----
  startPuzzleCatch(creature, stageId) {
    const shiny = !creature.duplicate && Math.random() < SAVE.shinyOdds().catch3;
    this.paused = false;
    this.pendingNext = false;
    const S = this.session = {
      w: creature.w, s: -8, world: WORLDS[creature.w], isBoss: false,
      prompts: [], idx: 0,
      text: worldProperNames(creature.w) ? creature.n : creature.n.toLowerCase(),
      pos: 0, score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 0, state: "reveal",
      puzzleCatch: true, catchStageId: stageId,
      pcatch: { creature, shiny, trophies: [] },
      ninjaEligible: false, pendingRes: null, catchCreature: null,
    };
    UI.puzzleCatchReveal(S, () => {
      if (this.session !== S || S.state !== "reveal") return;
      // award at the reveal so nothing can be lost afterwards
      const trophies = SAVE.addCreature(creature.w, creature.i, shiny);
      if (stageId) SAVE.markPuzzleCaught(stageId);
      this.maybePartyToast();
      S.pcatch.trophies = trophies;
      S.state = "welcome"; // type its name — no timer, no way to fail
      UI.showWelcomePrompt(S);
    });
  },

  finishPuzzleCatch() {
    const S = this.session;
    S.state = "done";
    const { creature, shiny, trophies } = S.pcatch;
    SAVE.bump("puzzleCatches");
    SAVE.save();
    UI.confetti();
    SFX.fanfare();
    setTimeout(() => {
      this.session = null;
      UI.superMode(false);
      UI.show("lab");
      UI.renderTopbar();
      UI.toast(`🧩 You caught${shiny ? " a ✨ SHINY" : ""} <b>${creature.n}</b> in the Puzzle Lab!`, "gold");
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
    if (S && S.elite) { this.eliteDefeat(); return; }
    // a raid attempt that runs out of hearts still banks the damage it dealt —
    // the family's effort is never wasted
    if (S && S.raid) { this.finishRaid(true); return; }
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
    if (S.paragraph) { this.startParagraph(S.paragraph.id); return; }
    if (S.raid || S.raidClaim) { this.startRaid(); return; }
    if (S.rematch) { this.startStage(S.w, S.s, { rematch: S.rematch }); return; }
    if (S.s >= 0) { this.startStage(S.w, S.s); return; }
    this.session = null;
    UI.show("map");
  },

  quitToMap() {
    this.cleanupSpecial();
    this.stopTimer();
    this.paused = false;
    this.pendingNext = false;
    if (this.session) this.session.state = "done";
    this.session = null;
    UI.pauseOverlay(false);
    UI.superMode(false);
    UI.show("map");
  },

  // restore anything a special session changed (forced ninja, gauntlet state)
  cleanupSpecial() {
    const S = this.session;
    if (S && S.forceNinja) {
      UI.kbHidden = !!this._kbBefore;
      UI.applyKbVisibility();
    }
    this._elite = null;
  },

  // ============ Professor's Daily Drill (one seeded run a day) ============
  startDaily() {
    const d = SAVE.dailyInfo();
    if (d.done) return;
    const muts = d.mutators.map(id => DAILY_MUTATORS.find(m => m.id === id)).filter(Boolean);

    // words from every world the player has opened up
    let pool = [];
    WORLDS.forEach((w, wi) => {
      if (!SAVE.worldUnlocked(wi)) return;
      w.levels.forEach(l => l.pool.forEach(p => { if (p.length >= 3) pool.push(p); }));
    });
    pool = [...new Set(pool)];

    let timeScale = 1, xpScale = 1, forceNinja = false, requeue = false;
    for (const m of muts) {
      if (m.id === "weakkey") {
        const worst = Object.entries(SAVE.state.stats.perKey)
          .map(([k, v]) => ({ k, total: v.ok + v.miss, acc: v.ok / (v.ok + v.miss) }))
          .filter(e => e.total >= 8)
          .sort((a, b) => a.acc - b.acc)
          .slice(0, 3).map(e => e.k);
        if (worst.length) {
          const f = pool.filter(wd => [...wd.toLowerCase()].some(ch => worst.includes(ch)));
          if (f.length >= 12) pool = f;
        }
      }
      if (m.id === "long") {
        const f = pool.filter(x => x.length >= 6);
        pool = f.length >= 12 ? f : pool.slice().sort((a, b) => b.length - a.length).slice(0, 20);
      }
      if (m.id === "caps") pool = pool.map(x => x[0].toUpperCase() + x.slice(1));
      if (m.id === "turbo") timeScale = m.time;
      if (m.id === "lights") { forceNinja = true; xpScale = m.xp; }
      if (m.id === "flawless") requeue = true;
    }

    let prompts = [];
    while (prompts.length < 12) prompts = prompts.concat(shuffle(pool.slice()));
    prompts = prompts.slice(0, 12);

    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w: 0, s: -6, isBoss: false,
      world: {
        name: "Daily Drill", emoji: "📋",
        gradient: ["#1b2142", "#3b2d6b"], accent: "#9b59d6",
        targets: ["🎯", "⭐", "🎈", "🪙"], projectile: "⚡",
        hitText: ["Nice!", "Sharp!", "Clean!", "Quick!"],
        sceneEmojis: ["📋", "⭐", "⚡", "🎯"], levels: [],
      },
      daily: { muts, xpScale },
      prompts, idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0, hearts: 3,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime: 4.6, timeScale, requeueMissed: requeue, forceNinja,
      state: "play",
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false, meterOn: false,
      ninjaEligible: UI.kbHidden || forceNinja, pendingRes: null, catchCreature: null,
    };
    if (forceNinja) {
      this._kbBefore = UI.kbHidden;
      UI.kbHidden = true;
    }
    UI.specialScene(this.session, `📋 Daily Drill · ${muts.map(m => m.e + " " + m.name).join(" + ")}`);
    this.nextPrompt();
  },

  finishDaily() {
    const S = this.session;
    this.stopTimer();
    S.state = "done";
    const total = S.hits + S.errors;
    const acc = total ? S.hits / total : 1;
    const minutes = Math.max(S.typingMs, 1000) / 60000;
    const wpm = Math.round((S.hits / 5) / minutes);
    const xp = Math.round((40 + Math.min(20, wpm)) * S.daily.xpScale);
    this.cleanupSpecial();
    const r = SAVE.completeDaily(xp);
    this.session = null;
    UI.superMode(false);
    UI.show("map");
    UI.renderTopbar();
    UI.toast(`📋 Daily Drill done! <b>+${xp} XP</b> · +1 🎟 candy voucher (${Math.round(acc * 100)}% at ${wpm} wpm)`, "gold");
    if (r && r.eggBonus) {
      setTimeout(() => UI.toast("🥚 FIVE drills this week — the Professor sent a special Mystery Egg!", "gold"), 1200);
    }
  },

  // ============ The Elite Four & the Champion ============
  eliteUnlocked() {
    return SAVE.stageStars(HALL_W, WORLDS[HALL_W].levels.length) > 0
      && SAVE.medalPoints() >= ELITE_NEED_MEDALS;
  },

  startElite() {
    if (!this.eliteUnlocked()) return;
    this._elite = { round: 0, hearts: 3, wpmSum: 0, accSum: 0, rounds: 0 };
    this.startEliteRound();
  },

  startEliteRound() {
    const E = this._elite;
    const r = ELITE[E.round];

    let pool = [];
    r.worlds.forEach(wi => WORLDS[wi].levels.forEach(l =>
      l.pool.forEach(p => { if (p.length >= 3) pool.push(p); })));
    pool = [...new Set(pool)];
    let prompts = [];
    while (prompts.length < r.hp) prompts = prompts.concat(shuffle(pool.slice()));
    prompts = prompts.slice(0, r.hp);

    // the Champion is YOU — paced from your own recent speed, always
    // stretchy but beatable on any difficulty
    let baseTime = r.time;
    if (r.champion) {
      const hist = SAVE.state.stats.history.slice(-7);
      const avg = hist.length ? hist.reduce((a, h) => a + h.wpm, 0) / hist.length : 12;
      baseTime = Math.max(2.4, Math.min(5.5, 50 / Math.max(8, avg)));
    }

    this.paused = false;
    this.pendingNext = false;
    this.session = {
      w: HALL_W, s: -5, isBoss: true,
      world: {
        name: `Elite ${E.round + 1} of ${ELITE.length}`, emoji: r.e,
        gradient: ["#171130", "#3d1d52"], accent: "#c77bff",
        targets: ["⚔️"], projectile: "⚡",
        hitText: ["Hit!", "Sharp!", "Fierce!", "Champion-like!"],
        sceneEmojis: [r.e, "⚔️", "✨", "🏟️"], levels: [],
        boss: { name: r.name, emoji: r.e, id: r.aceId || null, hp: r.hp, time: baseTime, taunt: r.taunt },
      },
      elite: { round: E.round, def: r },
      prompts, idx: -1, text: "", pos: 0,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, errors: 0, errorsThisPrompt: 0, timeouts: 0,
      hearts: E.hearts,
      typingMs: 0, promptStart: 0, timerMs: 0, timerRemaining: 0,
      baseTime, state: "play",
      partner: SAVE.leadCreature(), charge: 0, partnerReady: false,
      ninjaEligible: UI.kbHidden, pendingRes: null, catchCreature: null,
    };
    this.session.meterOn = !!this.session.partner;
    UI.gameStart(this.session);
    this.nextPrompt();
  },

  finishEliteRound() {
    const S = this.session;
    this.stopTimer();
    S.state = "done";
    const E = this._elite;
    const total = S.hits + S.errors;
    const minutes = Math.max(S.typingMs, 1000) / 60000;
    E.wpmSum += Math.round((S.hits / 5) / minutes);
    E.accSum += total ? S.hits / total : 1;
    E.rounds++;
    E.round++;
    E.hearts = Math.min(3, S.hearts + 1); // a breather between rounds

    const el = SAVE.state.elite || (SAVE.state.elite = { bestRound: 0, clears: 0 });
    el.bestRound = Math.max(el.bestRound, E.round);
    SAVE.save();

    if (E.round >= ELITE.length) { this.eliteVictory(); return; }
    const nxt = ELITE[E.round];
    UI.announce(`${nxt.e} Round ${E.round + 1}: ${nxt.name}!`, 1600);
    SFX.fanfare();
    setTimeout(() => {
      if (this._elite === E) this.startEliteRound();
    }, 1700);
  },

  eliteDefeat() {
    const S = this.session;
    this.stopTimer();
    S.state = "done";
    const E = this._elite;
    const reached = E ? E.round + 1 : 1;
    const xp = 15 * reached;
    SAVE.state.xp += xp;
    const el = SAVE.state.elite || (SAVE.state.elite = { bestRound: 0, clears: 0 });
    el.bestRound = Math.max(el.bestRound, E ? E.round : 0);
    SAVE.save();
    this.cleanupSpecial();
    this.session = null;
    SFX.defeat();
    UI.superMode(false);
    UI.show("map");
    UI.renderTopbar();
    UI.toast(`⚔️ The Elite Four won this time — you fought to <b>Round ${reached}</b>! +${xp} XP. Train and return!`);
  },

  eliteVictory() {
    const E = this._elite;
    const entry = {
      date: new Date().toISOString().slice(0, 10),
      party: SAVE.state.party.slice(),
      wpm: Math.round(E.wpmSum / Math.max(1, E.rounds)),
      acc: Math.round(100 * E.accSum / Math.max(1, E.rounds)),
    };
    const el = SAVE.state.elite || (SAVE.state.elite = { bestRound: 0, clears: 0 });
    el.bestRound = ELITE.length;
    el.clears = (el.clears || 0) + 1;
    SAVE.state.hof.push(entry);
    SAVE.state.xp += 150;
    const newTrophies = [];
    SAVE.award("champion", newTrophies);
    SAVE.collectTrophies(newTrophies);
    SAVE.save();
    this.cleanupSpecial();
    this.session = null;
    UI.superMode(false);
    UI.hofCeremony(entry, newTrophies);
  },
};
