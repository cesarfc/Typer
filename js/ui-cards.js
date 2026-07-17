// ============================================================
// TypeQuest — UI (result cards & ceremonies): battle/practice/
// paragraph/tower results, defeat, the catch/hatch/evolve/shiny
// ceremonies, the day card and Hall of Fame induction.
// Extends the UI object from ui.js (loaded first). Mechanical split.
// ============================================================
Object.assign(UI, {

  // ---------- catch round ----------
  // suspense intro: the ball drops in, wobbles three times, then bursts
  // open in a white flash and the Pokemon pops out — like the show
  catchReveal(S, creature, done) {
    // names can use not-yet-taught letters: always show the glowing keyboard
    this.$("kb-flex").classList.remove("ninja");
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    // a wild knows its shininess from the field; a post-level catch decided it
    // in startCatch — show the shiny sprite the instant the ball bursts open
    const isShiny = S.wild ? !!S.wild.shiny : !!S.catchShiny;
    this.$("hud-progress-fill").style.width = "100%";
    this.$("target-label").classList.add("hidden");
    // one mystery "?" per letter of the hidden name
    this.$("prompt-word").innerHTML = [...S.text].map(() => `<span class="ch mystery">?</span>`).join("");
    const tf = this.$("timer-fill");
    tf.style.width = "100%";
    tf.classList.remove("low");
    this.highlightKey(null);
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    target.className = "catch-size";
    target.innerHTML = `<span class="ball-reveal drop">${this.ballHtml()}</span>`;
    SFX.thump();
    this.announce("Who is that... ?", 1300);
    const alive = () => Engine.session === S && S.state === "reveal";
    setTimeout(() => {
      if (!alive()) return;
      const ball = target.querySelector(".ball-reveal");
      if (ball) ball.classList.add("wobbling");
      SFX.tick();
    }, 520);
    setTimeout(() => { if (alive()) SFX.tick(); }, 980);
    setTimeout(() => { if (alive()) SFX.tick(); }, 1440);
    setTimeout(() => {
      if (!alive()) return;
      SFX.pop();
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffd34d", S.world.accent], 28, 6);
      const flash = document.createElement("div");
      flash.className = "poke-flash";
      wrap.appendChild(flash);
      setTimeout(() => flash.remove(), 550);
      target.className = "catch-size" + (isShiny ? " shiny-poke" : "");
      target.innerHTML = `<span class="poke-pop">${this.pokeHtml(creature.id, creature.e, { shiny: isShiny })}</span>`;
      if (isShiny) this.shinyReveal(S);
    }, 1780);
    setTimeout(() => {
      if (!alive()) return;
      this.announce(isShiny ? `✨ A SHINY ${creature.n}! ✨` : `A wild ${creature.n} appeared!`, 1600);
      SFX.combo();
      done();
    }, 2380);
  },

  showCatch(S, creature) {
    this.$("target-wrap").style.opacity = 1;
    // relaxed catches (Chill / first world) have no clock at all
    this.$("timer-bar").classList.toggle("hidden", !!S.relaxedCatch);
    this.speech(S.relaxedCatch ? "No rush — type my name!" : "Type my name to catch me!", 2600);
    this.renderPromptText(S);
  },

  catchAnim(S, success, done) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    if (success) {
      this.projectile(this.ballHtml(), () => {
        const r = target.getBoundingClientRect();
        this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#ffd34d", "#fff", S.world.accent], 30, 6);
        target.innerHTML = this.ballHtml();
        wrap.classList.add("wobble");
        this.floatText("CAUGHT!", wrap, "big");
        setTimeout(() => { wrap.classList.remove("wobble"); done(); }, 1300);
      });
    } else {
      this.floatText("💨 it fled!", wrap, "");
      wrap.classList.add("flee");
      setTimeout(() => { wrap.classList.remove("flee"); wrap.style.opacity = 0; done(); }, 900);
    }
  },

  // ---------- results ----------
  showResults(res) {
    this.show("results");
    this.renderTopbar();
    this._lastStage = [res.w, res.s];
    this._practiceNext = null;
    this._paragraphNext = null;
    this._rematchNext = res.rematch ? { w: res.w, tierId: res.rematch.id } : null;
    this._raidNext = null;
    this._towerReplay = false;
    this._practiceMode = false;
    this._resultsAt = performance.now();
    this.$("btn-replay").textContent = res.rematch ? "↻ Try Again" : "↻ Replay";
    this.$("btn-replay").classList.remove("hidden");
    this.$("results-stars").classList.remove("hidden");
    const w = WORLDS[res.w];
    const title = this.$("results-title");
    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", w.accent);

    title.textContent = res.rematch
      ? (res.rematchMedal ? `${res.rematchMedal.tier.e} REMATCH WON!` : `${w.boss.emoji} Rematch Complete`)
      : res.isBoss
        ? `${w.boss.emoji} BOSS DEFEATED!`
        : `${w.emoji} ${res.s === 4 ? "Speed Run" : "Level"} Complete!`;

    // stars
    const stars = this.$("results-stars");
    stars.classList.remove("hidden");
    const starEls = stars.querySelectorAll(".star");
    starEls.forEach(s => s.classList.remove("on", "bounce"));
    for (let i = 0; i < res.stars; i++) {
      setTimeout(() => {
        starEls[i].classList.add("on", "bounce");
        SFX.star(i);
      }, 350 + i * 380);
    }

    // stats grid
    this.$("results-grid").innerHTML = `
      <div class="rstat"><div class="rstat-v">${res.wpm}</div><div class="rstat-l">words/min</div></div>
      <div class="rstat"><div class="rstat-v">${Math.round(res.acc * 100)}%</div><div class="rstat-l">accuracy</div></div>
      <div class="rstat"><div class="rstat-v">x${res.bestCombo}</div><div class="rstat-l">best combo</div></div>
      <div class="rstat"><div class="rstat-v">${res.score}</div><div class="rstat-l">score</div></div>`;

    // xp bar animation
    const before = levelFromXp(res.xpBefore);
    const after = levelFromXp(SAVE.state.xp);
    this.$("xp-gained").textContent = `+${res.xp} XP${res.ninja ? " 🥷" : ""}${res.turbo ? " 🔥" : ""}`;
    this.$("xp-level").textContent = `Lv ${after.level} · ${titleForLevel(after.level)}`;
    const fill = this.$("results-xpfill");
    fill.style.transition = "none";
    fill.style.width = `${100 * before.into / before.need}%`;
    setTimeout(() => {
      fill.style.transition = "width 1s ease";
      fill.style.width = after.level > before.level ? "100%" : `${100 * after.into / after.need}%`;
      setTimeout(() => {
        if (after.level > before.level) {
          fill.style.transition = "none"; fill.style.width = "0%";
          setTimeout(() => {
            fill.style.transition = "width .7s ease";
            fill.style.width = `${100 * after.into / after.need}%`;
          }, 60);
        }
      }, 1050);
    }, 350);

    // catch section
    const catchBox = this.$("results-catch");
    if (res.caught) {
      const rar = RARITY[res.caught.r];
      const ckey = `${res.caught.w}-${res.caught.i}`;
      const inParty = SAVE.state.party.includes(ckey);
      const partyBit = inParty
        ? `<div class="in-party-note">🎽 In your party!</div>`
        : SAVE.state.party.length < PARTY_MAX
          ? `<button id="btn-party-add" class="mid-btn" data-key="${ckey}">🎽 Add to party</button>`
          : "";
      catchBox.className = "catch-result";
      catchBox.innerHTML = `
        <div class="caught-card ${res.caught.shiny ? "shiny" : ""}" style="--rc:${rar.color}">
          <div class="caught-emoji">${this.pokeHtml(res.caught.id, res.caught.e, { shiny: res.caught.shiny })}</div>
          <div class="caught-name">${res.caught.shiny ? "✨ SHINY " : ""}${this.esc(res.caught.n)}</div>
          <div class="caught-rar">${rar.label} · added to your Pokedex!</div>
          ${partyBit}
        </div>`;
      setTimeout(() => this.confetti(), 600);
    } else if (res.candy) {
      const c = res.candy.creature;
      catchBox.className = "catch-result";
      catchBox.innerHTML = `
        <div class="caught-card candy-card">
          <div class="caught-emoji">${this.pokeHtml(c.id, c.e)}</div>
          <div class="caught-name">${this.esc(c.n)} again!</div>
          <div class="caught-rar">🍬 +1 candy (${res.candy.count}/${CANDY_COST})</div>
          ${res.candy.ready ? `<div class="evo-ready">🧬 Ready to EVOLVE — open your Pokedex!</div>` : ""}
        </div>`;
    } else if (res.dupXp) {
      const c = res.dupXp.creature;
      catchBox.className = "catch-result";
      catchBox.innerHTML = `<div class="fled-note">${c.e} Another ${this.esc(c.n)}! It waves and gives you +${res.dupXp.xp} XP.</div>`;
    } else if (res.fled) {
      catchBox.className = "catch-result";
      catchBox.innerHTML = `<div class="fled-note">💨 The wild ${this.esc(res.fled.n)} ${res.fled.e} got away... catch it next time!</div>`;
    } else {
      catchBox.className = "hidden";
      catchBox.innerHTML = "";
    }

    // mystery egg status
    const eggBox = this.$("results-egg");
    if (res.egg && res.egg.granted) {
      eggBox.className = "egg-note";
      eggBox.innerHTML = `🥚 <b>You found a Mystery Egg!</b> Finish 3 levels to hatch it.`;
    } else if (res.egg && res.egg.ready) {
      eggBox.className = "egg-note ready";
      eggBox.innerHTML = `🐣 <b>Your egg is ready to hatch!</b> Find it on the map.`;
    } else if (res.egg && res.egg.progress) {
      eggBox.className = "egg-note";
      eggBox.innerHTML = `🥚 Egg warming: <b>${res.egg.progress}/3</b>`;
    } else {
      eggBox.className = "hidden";
      eggBox.innerHTML = "";
    }

    // personal bests + the mastery-medal moment
    const medalBox = this.$("results-medal");
    medalBox.className = "hidden";
    medalBox.innerHTML = "";
    if (res.best && (res.best.wpm || res.best.acc || res.best.ninja)) {
      const bits = [];
      if (res.best.wpm) bits.push(`${res.wpm} wpm`);
      if (res.best.acc) bits.push(`${Math.round(res.acc * 100)}% accuracy`);
      if (res.best.ninja) bits.push("🥷 ninja clear");
      medalBox.className = "best-only";
      medalBox.innerHTML = `<span class="best-note">⭐ New personal best: <b>${bits.join(" · ")}</b>!</span>`;
    }
    if (res.medalUp) {
      const m = MEDAL_TIERS[res.medalUp - 1];
      setTimeout(() => {
        medalBox.className = "medal-on";
        medalBox.innerHTML = `<span class="medal-drop">${m.e}</span>
          <span class="medal-text"><b>${WORLDS[res.w].name} — ${m.name.toUpperCase()} MEDAL!</b>
          <i>Mastered. This region's medal is yours forever.</i></span>`;
        SFX.medal();
      }, 1600);
    }
    // Gym Rematch medal moment (reuses the mastery-medal card styling)
    if (res.rematch) {
      if (res.rematchMedal) {
        const m = res.rematchMedal.tier;
        medalBox.className = "medal-on";
        medalBox.innerHTML = `<span class="medal-drop">${m.e}</span>
          <span class="medal-text"><b>${this.esc(WORLDS[res.w].boss.name)} — ${m.label.toUpperCase()} REMATCH MEDAL!</b>
          <i>${res.rematchMedal.upgraded ? "A new tier for your Journal!" : "You matched your best — still sharp!"}</i></span>`;
        setTimeout(() => SFX.medal(), 500);
        if (res.rematchMedal.upgraded) this.confetti();
      } else {
        const needHearts = res.rematch.needStars === 3 ? "all 3 hearts" : "2 or more hearts";
        medalBox.className = "best-only";
        medalBox.innerHTML = `<span class="best-note">${res.rematch.e} So close! Finish with <b>${needHearts}</b> to earn the ${res.rematch.label} medal.</span>`;
      }
    }

    // big moments
    if (res.isBoss && res.firstClear) {
      this.confetti();
      if (res.w < HALL_W) {
        setTimeout(() => this.toast(`🌍 New world unlocked: ${WORLDS[res.w + 1].emoji} ${WORLDS[res.w + 1].name}!`, "gold"), 800);
      } else {
        setTimeout(() => this.toast(`👑 YOU ARE THE KEY MASTER! You beat the whole game!`, "gold"), 800);
      }
    }
    if (res.levelUp) {
      setTimeout(() => {
        SFX.levelup();
        this.toast(`⬆️ LEVEL UP! You are now Lv ${res.levelUp.to} — ${res.levelUp.title}!`, "gold");
      }, 1300);
    }
    const trophyAt = res.medalUp ? 2600 : 1800; // a medal beat owns its moment
    (res.trophies || []).forEach((t, i) =>
      setTimeout(() => this.trophyToast(t), trophyAt + i * 900));

    // band coaching: offer a step up after flawless mastery — never automatic
    delete this._failCount[`${res.w}-${res.s}`];
    const offer = this.$("results-offer");
    offer.className = "hidden";
    offer.innerHTML = "";
    const bi = BAND_ORDER.indexOf(res.band);
    if (!res.rematch && res.stars === 3 && res.acc >= 0.98 && bi >= 0 && bi < BAND_ORDER.length - 1) {
      const up = BANDS[BAND_ORDER[bi + 1]];
      offer.className = "band-offer";
      offer.innerHTML = `<button id="btn-bandup" data-band="${BAND_ORDER[bi + 1]}">
        ${up.e} That looked easy... try <b>${up.label}</b> band? ${up.desc}</button>`;
    }

    // buttons
    const next = this.$("btn-next");
    const lastWorld = HALL_W;
    next.classList.remove("hidden");
    let nextLabel = null;
    // a rematch has no "next" — you replay the tier or head back to the map
    if (res.rematch) nextLabel = null;
    else if (!res.isBoss) nextLabel = res.s === WORLDS[res.w].levels.length - 1 ? "Boss Fight! 👊" : "Next Level ▶";
    else if (res.w < lastWorld) nextLabel = `Next World: ${WORLDS[res.w + 1].emoji} ▶`;
    if (nextLabel) next.innerHTML = `${nextLabel} <small class="key-hint">Enter</small>`;
    else next.classList.add("hidden");
    this._nextTarget = res.rematch ? null : !res.isBoss ? [res.w, res.s + 1] : res.w < lastWorld ? [res.w + 1, 0] : null;
    SFX.fanfare();
    // a win can push trophies / gold rematches past a wardrobe gate
    this.flashWardrobeUnlocks();
  },

  showDefeat(S) {
    this.show("results");
    this.renderTopbar();
    this._lastStage = [S.w, S.s];
    this._practiceNext = null;
    this._paragraphNext = null;
    // a lost rematch retries the rematch, not a plain boss fight
    this._rematchNext = S.rematch ? { w: S.w, tierId: S.rematch.id } : null;
    this._raidNext = null;
    this._towerReplay = false;
    this._practiceMode = false;
    this._resultsAt = performance.now();
    this.$("results-egg").className = "hidden";          // no stale egg note
    this.$("results-medal").className = "hidden";        // no stale medal beat
    this.$("btn-replay").classList.add("hidden");        // same as Try Again
    // a second stumble earns a gentle one-run time assist — offered, never forced
    const fk = `${S.w}-${S.s}`;
    this._failCount[fk] = (this._failCount[fk] || 0) + 1;
    const offer = this.$("results-offer");
    offer.className = "hidden";
    offer.innerHTML = "";
    if (this._failCount[fk] >= 2 && S.s >= 0) {
      offer.className = "band-offer";
      offer.innerHTML = `<button id="btn-assist" data-w="${S.w}" data-s="${S.s}">
        🐢 Tough one! Want <b>extra time</b>, just for this try?</button>`;
    }
    this.$("btn-replay").textContent = "↻ Replay";
    const card = this.$("results-card");
    card.classList.add("defeat");
    this.$("results-title").textContent = `${S.world.boss.emoji} ${S.world.boss.name} wins this round...`;
    this.$("results-stars").classList.add("hidden");
    this.$("results-grid").innerHTML = `
      <div class="defeat-msg">${ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]}</div>`;
    this.$("xp-gained").textContent = "+8 training XP";
    const lv = levelFromXp(SAVE.state.xp);
    this.$("xp-level").textContent = `Lv ${lv.level} · ${titleForLevel(lv.level)}`;
    this.$("results-xpfill").style.width = `${100 * lv.into / lv.need}%`;
    this.$("results-catch").className = "hidden";
    const next = this.$("btn-next");
    next.classList.remove("hidden");
    next.innerHTML = `⚔️ Try Again! <small class="key-hint">Enter</small>`;
    this._nextTarget = S.rematch ? null : [S.w, S.s];
  },

  showPracticeResults(res) {
    this.show("results");
    this.renderTopbar();
    this._practiceNext = res.tier.id;
    this._practiceGhostPid = res.ghostPid || null; // rematch the same ghost on Try Again
    this._paragraphNext = null;
    this._rematchNext = null;
    this._raidNext = null;
    this._towerReplay = false;
    this._practiceMode = true;
    this._nextTarget = null;
    this._lastStage = null;
    this._resultsAt = performance.now();
    this.$("btn-replay").classList.remove("hidden");
    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", "#4dc3ff");
    this.$("results-title").textContent = res.custom
      ? `📚 My Words · ${res.tier.label}`
      : res.license
        ? `🪪 License · ${res.tier.label}`
        : `🏫 Practice · ${res.tier.label}`;
    this.$("results-stars").classList.add("hidden");
    this.$("results-grid").innerHTML = `
      <div class="rstat"><div class="rstat-v">${this.fmtTime(res.timeMs)}</div><div class="rstat-l">your time</div></div>
      <div class="rstat"><div class="rstat-v">${res.wpm}</div><div class="rstat-l">words/min</div></div>
      <div class="rstat"><div class="rstat-v">${Math.round(res.acc * 100)}%</div><div class="rstat-l">accuracy</div></div>
      <div class="rstat"><div class="rstat-v">x${res.bestCombo}</div><div class="rstat-l">best combo</div></div>`;

    const record = res.betterTime || res.betterWpm;
    const lines = [];
    if (res.betterTime) lines.push(`⏱ <b>NEW BEST TIME!</b>${res.prevTime ? ` (was ${this.fmtTime(res.prevTime)})` : ""}`);
    if (res.betterWpm) lines.push(`⚡ <b>NEW BEST SPEED!</b>${res.prevWpm ? ` (was ${res.prevWpm} wpm)` : ""}`);
    if (!record) lines.push(`Your records: ⏱ ${this.fmtTime(res.prevTime)} · ⚡ ${res.prevWpm} wpm — so close!`);
    // Practice Ghost verdict: did you out-race the ghost you raced?
    if (res.ghost) {
      const secs = (res.ghost.deltaMs / 1000).toFixed(1);
      const who = res.ghost.name ? `${this.esc(res.ghost.name)}'s ghost` : "your ghost";
      const Who = res.ghost.name ? `${this.esc(res.ghost.name)}'s ghost` : "Your ghost";
      lines.push(res.ghost.beat
        ? `🏁 You beat ${who} by <b>${secs}s</b>!`
        : `👻 ${Who} won by <b>${secs}s</b> — rematch?`);
    }
    // Typing License stamp verdict — the gentle 90% gate, never a "fail"
    const st = res.license && res.stamp;
    const newStamp = st && st.earned && !st.already;
    if (st) {
      if (newStamp) lines.push(`🪪 <b>STAMP EARNED!</b> ${Math.round(res.acc * 100)}% accuracy — nice steady fingers!`);
      else if (st.earned) lines.push(`🪪 Stamped again — ${Math.round(res.acc * 100)}% accuracy, still sharp!`);
      else lines.push(`So close — steady fingers earn the stamp! (need 90%, you had ${Math.round(res.acc * 100)}%)`);
    }
    const catchBox = this.$("results-catch");
    catchBox.className = "catch-result";
    catchBox.innerHTML = `<div class="record-note ${record || newStamp ? "gold" : ""}">${lines.join("<br>")}</div>`;
    this.$("results-egg").className = "hidden";
    this.$("results-medal").className = "hidden";
    this.$("results-offer").className = "hidden";

    this.$("xp-gained").textContent = `+${res.xp} XP`;
    const lv = levelFromXp(SAVE.state.xp);
    this.$("xp-level").textContent = `Lv ${lv.level} · ${titleForLevel(lv.level)}`;
    this.$("results-xpfill").style.width = `${100 * lv.into / lv.need}%`;

    const next = this.$("btn-next");
    next.classList.remove("hidden");
    next.innerHTML = `⏱ Try Again <small class="key-hint">Enter</small>`;
    this.$("btn-replay").textContent = "🎚 Difficulty";
    (res.newTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 900 + i * 800));
    if (record || newStamp) {
      this.confetti();
      SFX.fanfare();
      const msg = newStamp
        ? `🪪 ${res.tier.label} stamp earned — one step to your license!`
        : `🏫 New ${res.tier.label} record! Can you beat it?`;
      setTimeout(() => this.toast(msg, "gold"), 700);
    } else {
      SFX.word();
    }
  },

  showParagraphResults(res) {
    this.show("results");
    this.renderTopbar();
    this._paragraphNext = res.def.id;
    this._paragraphGhostPid = res.ghostPid || null; // rematch the same ghost on Read Again
    this._practiceNext = null;
    this._rematchNext = null;
    this._raidNext = null;
    this._towerReplay = false;
    this._practiceMode = true; // btn-replay returns to the Trainer School
    this._nextTarget = null;
    this._lastStage = null;
    this._resultsAt = performance.now();
    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", "#7ee787");
    this.$("results-title").textContent = `📖 ${res.def.title}`;
    this.$("results-stars").classList.add("hidden");
    this.$("results-grid").innerHTML = `
      <div class="rstat"><div class="rstat-v">${res.wpm}</div><div class="rstat-l">words/min</div></div>
      <div class="rstat"><div class="rstat-v">${Math.round(res.acc * 100)}%</div><div class="rstat-l">accuracy</div></div>
      <div class="rstat"><div class="rstat-v">${this.fmtTime(res.timeMs)}</div><div class="rstat-l">your time</div></div>`;

    const record = res.betterWpm;
    const lines = [];
    if (res.betterWpm) lines.push(`⚡ <b>NEW BEST SPEED!</b>${res.prevWpm ? ` (was ${res.prevWpm} wpm)` : ""}`);
    else lines.push(`Your best: ⚡ ${res.prevWpm} wpm — read it again to beat it!`);
    // Story Ghost verdict: did you out-read the ghost you raced?
    if (res.ghost) {
      const secs = (res.ghost.deltaMs / 1000).toFixed(1);
      const who = res.ghost.name ? `${this.esc(res.ghost.name)}'s ghost` : "your ghost";
      const Who = res.ghost.name ? `${this.esc(res.ghost.name)}'s ghost` : "Your ghost";
      lines.push(res.ghost.beat
        ? `🏁 You beat ${who} by <b>${secs}s</b>!`
        : `👻 ${Who} won by <b>${secs}s</b> — rematch?`);
    }
    const catchBox = this.$("results-catch");
    catchBox.className = "catch-result";
    catchBox.innerHTML = `<div class="record-note ${record ? "gold" : ""}">${lines.join("<br>")}</div>`;
    this.$("results-egg").className = "hidden";
    this.$("results-medal").className = "hidden";
    this.$("results-offer").className = "hidden";

    this.$("xp-gained").textContent = `+${res.xp} XP`;
    const lv = levelFromXp(SAVE.state.xp);
    this.$("xp-level").textContent = `Lv ${lv.level} · ${titleForLevel(lv.level)}`;
    this.$("results-xpfill").style.width = `${100 * lv.into / lv.need}%`;

    const next = this.$("btn-next");
    next.classList.remove("hidden");
    next.innerHTML = `📖 Read Again <small class="key-hint">Enter</small>`;
    this.$("btn-replay").classList.remove("hidden");
    this.$("btn-replay").textContent = "🏫 Trainer School";
    (res.newTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 900 + i * 800));
    if (record) { this.confetti(); SFX.fanfare(); }
    else SFX.word();
  },

  // ---- Raid attempt results: how much the family chipped, what's left, and
  // whether the boss is down (claim!) or still standing (attack again) ----
  showRaidResults(S, info) {
    this.show("results");
    this.renderTopbar();
    this._practiceNext = null;
    this._paragraphNext = null;
    this._rematchNext = null;
    this._practiceMode = false;
    this._nextTarget = null;
    this._lastStage = null;
    this._towerReplay = false;
    this._resultsAt = performance.now();
    const down = !!info.defeated;
    const canClaim = !!info.canClaim; // this player contributed and hasn't claimed
    // btn-next drives the raid: claim the prize, or launch another attempt
    this._raidNext = down ? (canClaim ? "claim" : null) : "attack";
    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", "#ff5ec7");
    this.$("results-title").textContent = down
      ? (info.justDefeated ? "🌟 RAID BOSS DOWN!" : "⚔️ Raid Boss defeated!")
      : "⚔️ Raid Attack!";
    this.$("results-stars").classList.add("hidden");
    const remaining = Math.max(0, info.remaining);
    this.$("results-grid").innerHTML = `
      <div class="rstat"><div class="rstat-v">${info.dealt}</div><div class="rstat-l">damage dealt</div></div>
      <div class="rstat"><div class="rstat-v">${remaining}</div><div class="rstat-l">boss HP left</div></div>
      <div class="rstat"><div class="rstat-v">${info.maxHp}</div><div class="rstat-l">total HP</div></div>`;

    const lines = [];
    if (info.lostHearts) lines.push(`💔 You ran out of hearts — but your <b>${info.dealt}</b> damage still counts!`);
    if (down) {
      lines.push(canClaim
        ? `🎁 The boss is down! <b>Claim your prize</b> — a guaranteed catch and big XP!`
        : (this.raidClaimedMsg()));
    } else {
      lines.push(`The family has knocked off <b>${info.maxHp - remaining}/${info.maxHp}</b> HP. Keep attacking to finish it!`);
    }
    const catchBox = this.$("results-catch");
    catchBox.className = "catch-result";
    catchBox.innerHTML = `<div class="record-note ${down ? "gold" : ""}">${lines.join("<br>")}</div>`;
    this.$("results-egg").className = "hidden";
    this.$("results-medal").className = "hidden";
    this.$("results-offer").className = "hidden";

    this.$("xp-gained").textContent = `+${info.xp} XP`;
    const lv = levelFromXp(SAVE.state.xp);
    this.$("xp-level").textContent = `Lv ${lv.level} · ${titleForLevel(lv.level)}`;
    this.$("results-xpfill").style.width = `${100 * lv.into / lv.need}%`;

    const next = this.$("btn-next");
    if (this._raidNext === "claim") {
      next.classList.remove("hidden");
      next.innerHTML = `🎁 Claim Prize! <small class="key-hint">Enter</small>`;
    } else if (this._raidNext === "attack") {
      next.classList.remove("hidden");
      next.innerHTML = `⚔️ Attack Again <small class="key-hint">Enter</small>`;
    } else {
      next.classList.add("hidden");
    }
    this.$("btn-replay").classList.add("hidden");
    (info.newTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 900 + i * 800));
    if (info.justDefeated) { this.confetti(); SFX.fanfare(); }
    else SFX.word();
  },

  raidClaimedMsg() {
    return SAVE.raidClaimedByMe()
      ? `✅ You've claimed this raid. A new boss appears next week!`
      : `🌟 The boss is down! Only trainers who landed a hit can claim the prize.`;
  },

  // the moment a shiny wild Pokemon is revealed: sparkles, a twinkle, a shout
  shinyReveal(S) {
    if (S._shinyRevealed) return;
    S._shinyRevealed = true;
    const wrap = this.$("target-wrap");
    // a white→gold flash behind the Pokemon
    const flash = document.createElement("div");
    flash.className = "shiny-flash";
    wrap.appendChild(flash);
    setTimeout(() => flash.remove(), 700);
    // a burst of ✨ around it
    for (let i = 0; i < 9; i++) {
      const s = document.createElement("span");
      s.className = "shiny-spark";
      s.textContent = "✨";
      s.style.left = `${15 + Math.random() * 70}%`;
      s.style.top = `${5 + Math.random() * 80}%`;
      s.style.animationDelay = `${Math.random() * 0.35}s`;
      wrap.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
    const r = this.$("target").getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffd34d", "#ffe9a8"], 22, 5.5);
    SFX.shiny();
    this.announce(`✨ A SHINY ${S.wild.creature.n}!! ✨`, 2400);
  },

  // ---------- Mystery Egg hatching ----------
  hatchReveal(S, done) {
    this.show("game");
    const c = S.hatch.creature;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.$("kb-flex").classList.remove("ninja");
    this.$("hud-stage").textContent = "🥚 The egg is hatching!";
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "100%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.practiceTimerUI(false);
    this.$("timer-bar").classList.add("hidden"); // "no rush" should look like no rush
    this.showPartner(S);
    this.partnerMeter(S);
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    this.updateHud(S);
    const arena = this.$("arena");
    arena.style.background = "linear-gradient(160deg, #2d2545, #8a6d1d)";
    arena.style.setProperty("--wa", "#ffd34d");
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    ["✨", "🌟", "✨", "💫"].forEach((e2, i) => {
      const sp = document.createElement("span");
      sp.textContent = e2;
      sp.style.left = `${12 + i * 24}%`;
      sp.style.top = `${15 + (i % 2) * 50}%`;
      sp.style.fontSize = "20px";
      scene.appendChild(sp);
    });
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    this.$("target-label").classList.add("hidden");
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    target.className = "catch-size";
    target.innerHTML = `<span class="ball-reveal drop"><span class="egg-emoji">🥚</span></span>`;
    this.$("prompt-word").innerHTML = [...S.text].map(() => `<span class="ch mystery">?</span>`).join("");
    const tf = this.$("timer-fill");
    tf.style.width = "100%";
    tf.classList.remove("low");
    this.highlightKey(null);
    SFX.thump();
    this.announce("Who is in there... ?", 1400);
    const alive = () => Engine.session === S && S.state === "hatchwait";
    const crack = () => {
      if (!alive()) return;
      SFX.tick();
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffe28a"], 8, 3);
    };
    setTimeout(() => {
      if (!alive()) return;
      const egg = target.querySelector(".ball-reveal");
      if (egg) egg.classList.add("wobbling");
      crack();
    }, 520);
    setTimeout(crack, 1000);
    setTimeout(crack, 1460);
    setTimeout(() => {
      if (!alive()) return;
      SFX.pop();
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffd34d", "#ffe28a"], 30, 6);
      const flash = document.createElement("div");
      flash.className = "poke-flash";
      wrap.appendChild(flash);
      setTimeout(() => flash.remove(), 550);
      target.innerHTML = `<span class="poke-pop">${this.pokeHtml(c.id, c.e, { shiny: S.hatch.shiny })}</span>`;
    }, 1820);
    setTimeout(() => {
      if (!alive()) return;
      this.announce(`It's ${c.n}!${S.hatch.shiny ? " ✨" : ""}`, 1800);
      SFX.catchJingle();
      done();
    }, 2420);
  },

  showWelcomePrompt(S) {
    this.speech("Welcome me! Type my name — no rush!", 3200);
    this.renderPromptText(S);
    this.$("timer-fill").style.width = "100%";
  },

  // Puzzle Lab catch: a Poke Ball wobbles open to reveal the puzzle's reward.
  // Modeled on hatchReveal (same "no rush" staging), then hands off to the
  // welcome-state "type its name" ceremony.
  puzzleCatchReveal(S, done) {
    this.show("game");
    this.$("screen-game").classList.remove("paragraph-mode");
    const c = S.pcatch.creature;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.$("kb-flex").classList.remove("ninja");
    this.$("hud-stage").textContent = "🧩 Puzzle solved — a new friend appears!";
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "100%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.practiceTimerUI(false);
    this.$("timer-bar").classList.add("hidden"); // "no rush" should look like no rush
    this.showPartner(S);
    this.partnerMeter(S);
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    this.updateHud(S);
    const arena = this.$("arena");
    arena.style.background = "linear-gradient(160deg, #2a1f4a, #3aa06a)";
    arena.style.setProperty("--wa", "#43e97b");
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    ["🧩", "✨", "🍃", "💫"].forEach((e2, i) => {
      const sp = document.createElement("span");
      sp.textContent = e2;
      sp.style.left = `${12 + i * 24}%`;
      sp.style.top = `${15 + (i % 2) * 50}%`;
      sp.style.fontSize = "20px";
      scene.appendChild(sp);
    });
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    this.$("target-label").classList.add("hidden");
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    target.className = "catch-size";
    target.innerHTML = `<span class="ball-reveal drop">${this.ballHtml()}</span>`;
    this.$("prompt-word").innerHTML = [...S.text].map(() => `<span class="ch mystery">?</span>`).join("");
    const tf = this.$("timer-fill");
    tf.style.width = "100%";
    tf.classList.remove("low");
    this.highlightKey(null);
    SFX.thump();
    this.announce("Who did you guide home... ?", 1400);
    const alive = () => Engine.session === S && S.state === "reveal";
    setTimeout(() => {
      if (!alive()) return;
      const ball = target.querySelector(".ball-reveal");
      if (ball) ball.classList.add("wobbling");
      SFX.tick();
    }, 520);
    setTimeout(() => { if (alive()) SFX.tick(); }, 1000);
    setTimeout(() => { if (alive()) SFX.tick(); }, 1460);
    setTimeout(() => {
      if (!alive()) return;
      SFX.pop();
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#43e97b", "#7fd4ff"], 30, 6);
      const flash = document.createElement("div");
      flash.className = "poke-flash";
      wrap.appendChild(flash);
      setTimeout(() => flash.remove(), 550);
      target.className = "catch-size" + (S.pcatch.shiny ? " shiny-poke" : "");
      target.innerHTML = `<span class="poke-pop">${this.pokeHtml(c.id, c.e, { shiny: S.pcatch.shiny })}</span>`;
      if (S.pcatch.shiny) this.shinyReveal(S);
    }, 1820);
    setTimeout(() => {
      if (!alive()) return;
      this.announce(`It's ${c.n}!${S.pcatch.shiny ? " ✨" : ""}`, 1800);
      SFX.catchJingle();
      done();
    }, 2420);
  },

  // ---------- evolution scene ----------
  evolutionScene(S) {
    this.show("game");
    this.$("screen-game").classList.remove("paragraph-mode");
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.$("kb-flex").classList.remove("ninja");
    this.$("hud-stage").textContent = `🧬 Evolution time!`;
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "100%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.practiceTimerUI(false);
    this.showPartner(S);
    this.partnerMeter(S);
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    const arena = this.$("arena");
    arena.style.background = `linear-gradient(160deg, ${w.gradient[0]}, ${w.gradient[1]})`;
    arena.style.setProperty("--wa", w.accent);
    this.$("scene-emojis").innerHTML = "";
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    target.className = "catch-size";
    target.innerHTML = `<span class="evolving">${this.pokeHtml(S.evo.base.id, S.evo.base.e)}</span>`;
    this.updateHud(S);
    this.announce(`What? ${S.evo.base.n} is evolving!`, 2000);
    this.speech("Type my new name!", 2800);
    this.renderPromptText(S);
    SFX.combo();
  },

  evolveAnim(S, outcome, done) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    SFX.pop();
    const r = target.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffd34d", S.world.accent], 34, 7);
    const flash = document.createElement("div");
    flash.className = "poke-flash";
    wrap.appendChild(flash);
    setTimeout(() => flash.remove(), 550);
    const shiny = outcome === "shiny";
    target.innerHTML = `<span class="poke-pop">${this.pokeHtml(S.evo.target.id, S.evo.target.e, { shiny })}</span>`;
    this.announce(`${S.evo.base.n} evolved into ${S.evo.target.n}!`, 2200);
    this.confetti();
    SFX.fanfare();
    setTimeout(done, 2300);
  },

  showTowerResults(res) {
    this.show("results");
    this.renderTopbar();
    this._practiceNext = null;
    this._paragraphNext = null;
    this._rematchNext = null;
    this._raidNext = null;
    this._towerReplay = false;
    this._practiceMode = false;
    this._nextTarget = null;
    this._lastStage = null;
    this._resultsAt = performance.now();

    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", "#c8a24a");
    this.$("results-title").textContent = res.floor > 0
      ? `🗼 Reached Floor ${res.floor}!`
      : "🗼 The Battle Tower";
    this.$("results-stars").classList.add("hidden");

    const best = (SAVE.state.tower && SAVE.state.tower.best) || 0;
    this.$("results-grid").innerHTML = `
      <div class="rstat"><div class="rstat-v">${res.floor}</div><div class="rstat-l">floors climbed</div></div>
      <div class="rstat"><div class="rstat-v">x${res.bestCombo}</div><div class="rstat-l">best combo</div></div>
      <div class="rstat"><div class="rstat-v">${best}</div><div class="rstat-l">best floor ever</div></div>`;

    // banked rewards recap — always kept, win or quit
    const b = res.banked || { xp: 0, vouchers: 0, shinies: [] };
    const lines = [];
    if (b.xp) lines.push(`+${b.xp} XP banked`);
    if (b.vouchers) lines.push(`🎟 ${b.vouchers} candy voucher${b.vouchers > 1 ? "s" : ""}`);
    (b.shinies || []).forEach(c => lines.push(`✨ ${this.esc(c.n)} turned shiny`));
    const catchBox = this.$("results-catch");
    catchBox.className = "catch-result";
    catchBox.innerHTML = `<div class="record-note ${lines.length ? "gold" : ""}">
      ${res.quit ? "🗼 The tower will be waiting — great climb!" : "💛 Out of hearts — what a climb!"}
      ${lines.length ? `<br>🎁 Rewards kept: <b>${lines.join(" · ")}</b>` : "<br>Reach floor 5 to start banking rewards!"}
    </div>`;
    this.$("results-egg").className = "hidden";
    this.$("results-medal").className = "hidden";
    this.$("results-offer").className = "hidden";

    const lv = levelFromXp(SAVE.state.xp);
    this.$("xp-gained").textContent = b.xp ? `+${b.xp} XP` : "";
    this.$("xp-level").textContent = `Lv ${lv.level} · ${titleForLevel(lv.level)}`;
    this.$("results-xpfill").style.transition = "none";
    this.$("results-xpfill").style.width = `${100 * lv.into / lv.need}%`;

    this.$("btn-next").classList.add("hidden");
    this.$("btn-replay").classList.remove("hidden");
    this.$("btn-replay").textContent = "🗼 Climb Again";
    this._towerReplay = true;
    if (res.floor >= 5) { this.confetti(); SFX.fanfare(); }
    else SFX.word();
  },

  // ---------- Today's Adventure: three stamps and a soft landing ----------
  maybeDayCard(force) {
    if (!SAVE.state) return;
    const d = SAVE.dayInfo();
    const stamps = SAVE.dayStamps();
    const all = stamps.every(x => x.done);
    if (!force && (!all || d.shown)) return;
    if (!force && all) { d.shown = true; SAVE.save(); }
    const egg = SAVE.state.egg;
    let hook;
    if (egg && egg.progress >= 3) hook = "your Mystery Egg is ready to hatch!";
    else if (egg) hook = `${3 - egg.progress} more level${3 - egg.progress > 1 ? "s" : ""} will hatch your Mystery Egg!`;
    else hook = "fresh tall grass will rustle somewhere new!";
    const lead = SAVE.leadCreature();
    this.$("day-card").innerHTML = `<div class="dc-card">
      <div class="dc-partner">${lead
        ? this.pokeHtml(lead.id, lead.e, { shiny: lead.shiny, cls: "poke-img dc-img" })
        : "🎒"}<span class="dc-zzz">💤</span></div>
      <h3>${all ? "Today's Adventure — complete! 🌟" : "Today's Adventure"}</h3>
      <div class="dc-stamps">${stamps.map(x =>
        `<div class="dc-stamp ${x.done ? "on" : ""}">${x.done ? "✅" : "⬜"} ${x.e} ${this.esc(x.text)}${
          x.need ? ` <b>${x.now}/${x.need}</b>` : ""}</div>`).join("")}</div>
      <p class="dc-hook">🌅 Tomorrow: ${this.esc(hook)} The streak grows to 🔥 ${(SAVE.state.streak.count || 0) + 1}.</p>
      <div class="dc-buttons">
        <button id="dc-done" class="big-btn">🌙 Done for today</button>
        <button id="dc-more" class="link-btn">keep exploring</button>
      </div>
    </div>`;
    this.$("day-card").classList.remove("hidden");
  },

  // ---------- Hall of Fame induction (the once-per-save ceremony) ----------
  hofCeremony(entry, trophies) {
    const party = (entry.party || []).slice(0, 6);
    this.$("ceremony").innerHTML = `<div class="cer-room">
      <h2 class="cer-title">🏛️ HALL OF FAME</h2>
      <div class="cer-pedestals">${party.length ? party.map((k, i) => {
        const c = SAVE.creatureByKey(k);
        return `<div class="cer-slot" style="animation-delay:${i * 0.35}s">
          ${c ? this.pokeHtml(c.id, c.e, { shiny: c.shiny, cls: "poke-img cer-img" }) : "⭐"}<i></i></div>`;
      }).join("") : `<div class="cer-slot">🎒<i></i></div>`}</div>
      <div class="cer-trainer">${this.avatarHtml(SAVE.state.profile)}</div>
      <div class="cer-flash"></div>
      <div class="cer-photo">
        <b>${this.esc(SAVE.state.profile.name)} — CHAMPION</b>
        <span>${entry.date} · ${entry.wpm} wpm · ${entry.acc}% accuracy</span>
        <i>✨ Framed forever in the Museum Gallery</i>
      </div>
      <button id="cer-continue" class="big-btn">✔ Continue</button>
    </div>`;
    this.$("ceremony").classList.remove("hidden");
    SFX.fanfare();
    setTimeout(() => SFX.medal(), 900);
    this.confetti();
    this._cerTrophies = trophies || [];
  },
});
