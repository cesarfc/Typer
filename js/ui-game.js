// ============================================================
// TypeQuest — UI (game scenes): on-screen keyboard + hand guides,
// the battle/practice/raid/wild/tower/special scenes, HUD, prompt,
// target and partner animations, stopwatch and ghost.
// Extends the UI object from ui.js (loaded first). Mechanical split.
// ============================================================
Object.assign(UI, {

  // ---------- keyboard + hand guides ----------
  // a stylized hand; each finger is tinted with its keyboard color and
  // lights up / lifts when it is that finger's turn to press
  handSvg(side) {
    const fs = side === "l"
      ? [{ f: 0, h: 34 }, { f: 1, h: 46 }, { f: 2, h: 52 }, { f: 3, h: 44 }]
      : [{ f: 4, h: 44 }, { f: 5, h: 52 }, { f: 6, h: 46 }, { f: 7, h: 34 }];
    let svg = `<rect class="hand-palm" x="6" y="58" width="86" height="46" rx="20"/>`;
    fs.forEach((d, i) => {
      const x = 8 + i * 22;
      svg += `<rect class="hand-finger f${d.f}" data-f="${d.f}" x="${x}" y="${60 - d.h}" width="18" height="${d.h + 16}" rx="9"/>`;
    });
    const tx = side === "l" ? 88 : 10;
    const cx = side === "l" ? 97 : 19;
    const rot = side === "l" ? 38 : -38;
    svg += `<rect class="hand-finger f8" data-f="8" x="${tx}" y="60" width="18" height="38" rx="9" transform="rotate(${rot} ${cx} 70)"/>`;
    return `<svg class="hand" viewBox="0 0 116 112" aria-hidden="true">${svg}</svg>`;
  },

  // upper-case legends that sit in the corner of a key for shifted symbols
  _shiftLegend(base) {
    const m = { "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^",
      "7": "&", "8": "*", "9": "(", "0": ")", "-": "_", "=": "+",
      "[": "{", "]": "}", "'": "\"", ";": ":", ",": "<", ".": ">", "/": "?", "\\": "|" };
    return m[base] || null;
  },

  // Build the key HTML for a given row layout. KB_ROWS is the everyday layout;
  // KB_ROWS_FULL adds the number row + "/" for Typing License sessions.
  kbHtml(rows) {
    const shiftRowIdx = rows.length - 2; // the row that gets the ⇧ keys
    let html = "";
    rows.forEach((row, ri) => {
      html += `<div class="kb-row">`;
      if (ri === shiftRowIdx) html += `<div class="key wide shift" data-key="shift-l">⇧</div>`;
      row.forEach(k => {
        const home = "fj".includes(k) ? " home" : "";
        const leg = this._shiftLegend(k);
        const disp = k === "'" ? "&#39;" : k === "\\" ? "\\" : k;
        html += `<div class="key f${KEY_FINGER[k] ?? 0}${home}" data-key="${this.esc(k)}">${
          leg ? `<small class="shift-legend">${this.esc(leg)}</small>` : ""}${disp}</div>`;
      });
      if (ri === shiftRowIdx) html += `<div class="key wide shift" data-key="shift-r">⇧</div>`;
      html += `</div>`;
    });
    html += `<div class="kb-row"><div class="key space f8" data-key=" ">space</div></div>`;
    return html;
  },

  buildKeyboard() {
    const html = this.kbHtml(KB_ROWS);
    // one keyboard + hands for the game screen, one set for the tutorial
    this._kbFull = false;
    this.$("kb").innerHTML = html;
    this.$("tut-kb").innerHTML = html;
    this.$("hand-left").innerHTML = this.handSvg("l");
    this.$("hand-right").innerHTML = this.handSvg("r");
    this.$("tut-hand-left").innerHTML = this.handSvg("l");
    this.$("tut-hand-right").innerHTML = this.handSvg("r");
    this.applyKbVisibility();
  },

  // Swap the GAME keyboard between the everyday layout and the full number-row
  // layout (Typing License only). The tutorial keyboard is left untouched. Hands
  // are shared and don't change. Only rebuilds when the layout actually flips.
  setGameKeyboard(full) {
    if (!!full === !!this._kbFull) return;
    this._kbFull = !!full;
    this.$("kb").innerHTML = this.kbHtml(full ? KB_ROWS_FULL : KB_ROWS);
  },

  applyKbVisibility() {
    this.$("kb-flex").classList.toggle("ninja", this.kbHidden);
    this.$("btn-ninja").textContent = this.kbHidden ? "🥷 Ninja Mode: ON (+50% XP)" : "🥷 Ninja Mode: OFF";
    this.$("btn-ninja").classList.toggle("on", this.kbHidden);
  },

  highlightKey(ch) {
    document.querySelectorAll(".key.hl, .key.hl-shift").forEach(k => k.classList.remove("hl", "hl-shift"));
    document.querySelectorAll(".hand-finger.on").forEach(f => f.classList.remove("on"));
    const hint = this.$("finger-hint");
    if (!ch) { hint.innerHTML = "&nbsp;"; return; }

    // shifted symbols (parens, quotes, +, etc.) press a base key + Shift
    const shifted = SHIFT_MAP[ch];
    const base = shifted || ch.toLowerCase();
    const lowerLetter = ch.toLowerCase();
    const isUpper = !shifted && ch !== lowerLetter && /[a-z]/.test(lowerLetter);
    const needShift = isUpper || !!shifted;

    document.querySelectorAll(`.key[data-key="${CSS.escape(base)}"]`).forEach(el =>
      el.classList.add(shifted ? "hl-shift" : "hl"));
    const f = KEY_FINGER[base];
    let txt = f === undefined ? "" : FINGER_NAMES[f];
    if (f !== undefined) {
      document.querySelectorAll(`.hand-finger[data-f="${f}"]`).forEach(el => el.classList.add("on"));
    }
    // name the symbol so kids learn "parenthesis", "quotes", etc.
    const SYM_NAMES = { "(": "open paren (", ")": "close paren )", "\"": "quote \"",
      "{": "open brace {", "}": "close brace }", ";": "semicolon ;", ":": "colon :",
      "+": "plus +", "=": "equals =", "-": "minus -", "/": "slash /", "_": "under_score",
      "#": "hash #", "@": "at @", "<": "less than <", ">": "greater than >" };
    if (SYM_NAMES[ch]) txt = `${SYM_NAMES[ch]} — ${txt}`;
    if (needShift) {
      const leftHand = f <= 3;
      document.querySelectorAll(`.key[data-key="${leftHand ? "shift-r" : "shift-l"}"]`).forEach(el => el.classList.add("hl"));
      document.querySelectorAll(`.hand-finger[data-f="${leftHand ? 7 : 0}"]`).forEach(el => el.classList.add("on"));
      txt = `hold ⇧ Shift + ${txt}`;
    }
    // Caps Lock is the #1 kid keyboard accident — warn where they look
    if (this._capsOn) {
      hint.innerHTML = "⚠️ Turn off CAPS LOCK!";
      hint.classList.add("warn");
    } else {
      hint.classList.remove("warn");
      hint.innerHTML = txt ? `👆 ${txt}` : "&nbsp;";
    }
  },

  // ---------- game screen ----------
  gameStart(S) {
    this.show("game");
    this.$("screen-game").classList.remove("paragraph-mode");
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.setGameKeyboard(false); // adventure levels use the everyday layout
    this.applyKbVisibility();
    this.practiceTimerUI(false);

    this.$("hud-stage").textContent = S.isBoss
      ? `${w.emoji} ${w.name} · BOSS`
      : `${w.emoji} ${w.name} · ${w.levels[S.s].name}`;
    // the boss HP bar already shows progress inverted — one meter is enough
    this.$("hud-progress").classList.toggle("hidden", S.isBoss);
    this.$("hud-progress-fill").style.width = "0%";
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);

    const arena = this.$("arena");
    arena.style.background = `linear-gradient(160deg, ${w.gradient[0]}, ${w.gradient[1]})`;
    arena.style.setProperty("--wa", w.accent);

    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const e = document.createElement("span");
      e.textContent = w.sceneEmojis[i % w.sceneEmojis.length];
      e.style.left = `${5 + Math.random() * 90}%`;
      e.style.top = `${5 + Math.random() * 80}%`;
      e.style.fontSize = `${14 + Math.random() * 22}px`;
      e.style.animationDelay = `${Math.random() * 3}s`;
      scene.appendChild(e);
    }

    this.showPartner(S);
    this.partnerMeter(S);
    const hearts = this.$("hud-hearts");
    const bossBar = this.$("boss-bar");
    this.$("target-label").classList.add("hidden");
    if (S.isBoss) {
      hearts.classList.remove("hidden");
      this.renderHearts(S);
      bossBar.classList.remove("hidden");
      this.$("boss-bar-name").textContent = `${w.boss.emoji} ${w.boss.name}`;
      this.$("boss-hp-fill").style.width = "100%";
      this.speech(w.boss.taunt, 2400);
    } else {
      hearts.classList.add("hidden");
      bossBar.classList.add("hidden");
      const lvl = w.levels[S.s];
      if (lvl.keys) {
        this.announce(`✨ New keys: ${lvl.keys.toUpperCase().split("").join(" ")}`, 1800);
      } else {
        this.announce(S.s === w.levels.length - 1 ? "⚡ SPEED RUN! Go go go!" : "Go! 🚀", 1300);
      }
    }
    this.updateHud(S);
  },

  renderHearts(S) {
    this.$("hud-hearts").textContent = "❤️".repeat(S.hearts) + "🖤".repeat(3 - S.hearts);
  },

  speech(text, ms) {
    const label = this.$("target-label");
    label.textContent = text;
    label.classList.remove("hidden");
    clearTimeout(this._speechT);
    this._speechT = setTimeout(() => label.classList.add("hidden"), ms);
  },

  showPrompt(S) {
    const target = this.$("target");
    const wrap = this.$("target-wrap");
    if (S.raid) {
      // the raid legendary looms for the whole attempt
      target.innerHTML = this.pokeHtml(S.raid.id, S.raid.e);
      target.className = "boss-size";
    } else if (S.isBoss) {
      if (S.elite && S.elite.def.champion) {
        // the Champion is the player's own rival — their trainer, mirrored
        target.innerHTML = `<span class="rival">${this.avatarHtml(SAVE.state.profile)}</span>`;
      } else {
        target.innerHTML = this.pokeHtml(S.world.boss.id, S.world.boss.emoji);
      }
      target.className = "boss-size";
    } else if (S.wild) {
      // the wild Pokemon stays on screen for the whole battle
      const c = S.wild.creature;
      const shiny = !!S.wild.shiny;
      target.innerHTML = this.pokeHtml(c.id, c.e, { shiny });
      target.className = "catch-size" + (shiny ? " shiny-poke" : "");
      // for fishing the fish appears at the bite (here), not in wildScene
      if (shiny && !S._shinyRevealed && S.state === "play") this.shinyReveal(S);
    } else {
      // levels shoot neutral targets — Pokemon are caught, not shot at
      target.textContent = S.world.targets[S.idx % S.world.targets.length];
      target.className = "";
      wrap.classList.remove("enter");
      void wrap.offsetWidth;
      wrap.classList.add("enter");
    }
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    this.renderPromptText(S);
    this.$("hud-progress-fill").style.width = `${Math.round(100 * S.idx / S.prompts.length)}%`;
    // the ghost racer belongs to any run that loaded one (drills or Story
    // Typing); updateGhost re-shows it each stopwatch frame, so only hide it
    // up front when this run has no ghost to race
    const gm = this.$("ghost-marker");
    if (gm && !(S.ghost && S.ghost.length)) gm.classList.add("hidden");
  },

  renderPromptText(S) {
    const pw = this.$("prompt-word");
    // Story Typing: the whole paragraph as flowing prose — chars are grouped
    // into non-breaking words so lines wrap at spaces, never mid-word
    if (S.paragraphMode) {
      pw.className = "paragraph";
      const chs = [...S.text];
      const chSpan = i => `<span class="ch ${i < S.pos ? "done" : i === S.pos ? "cur" : ""}">${this.esc(chs[i])}</span>`;
      let html = "", i = 0;
      while (i < chs.length) {
        if (chs[i] === " ") {
          html += `<span class="ch sp ${i < S.pos ? "done" : i === S.pos ? "cur" : ""}"> </span>`;
          i++;
        } else {
          html += `<span class="pword">`;
          while (i < chs.length && chs[i] !== " ") { html += chSpan(i); i++; }
          html += `</span>`;
        }
      }
      pw.innerHTML = html;
      this.highlightKey(S.text[S.pos]);
      return;
    }
    pw.className = "";
    if (S.text.length > 30) pw.classList.add("xlong");
    else if (S.text.length > 16) pw.classList.add("long");
    pw.innerHTML = [...S.text].map((c, i) => {
      const typed = i < S.pos;
      const cur = i === S.pos;
      const glyph = c === " " ? "·" : this.esc(c);
      return `<span class="ch ${typed ? "done" : cur ? "cur" : ""} ${c === " " ? "sp" : ""}">${glyph}</span>`;
    }).join("");
    this.highlightKey(S.text[S.pos]);
  },

  charDone(S) {
    const pw = this.$("prompt-word");
    // paragraph chars are nested inside .pword groups, so index the flat .ch list
    const spans = S.paragraphMode ? pw.querySelectorAll(".ch") : pw.children;
    if (spans[S.pos - 1]) {
      spans[S.pos - 1].classList.remove("cur", "mystery");
      spans[S.pos - 1].classList.add("done", "pop");
      // reveal the real character now that the slot is filled (paragraph
      // mode keeps real spaces; the battle word shows · for a space)
      const c = S.text[S.pos - 1];
      if (!S.paragraphMode) spans[S.pos - 1].textContent = c === " " ? "·" : c;
    }
    if (spans[S.pos]) spans[S.pos].classList.add("cur");
    this.highlightKey(S.text[S.pos]);
    if (S.paragraphMode) {
      // keep the cursor line in view as the story scrolls
      if (spans[S.pos]) spans[S.pos].scrollIntoView({ block: "nearest", inline: "nearest" });
      return; // skip the particle burst — it'd fire on every keystroke
    }
    const r = pw.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top, [S.world.accent], 3, 2.2);
  },

  charError(S) {
    const pw = this.$("prompt-word");
    const spans = S.paragraphMode ? pw.querySelectorAll(".ch") : pw.children;
    const el = spans[S.pos];
    if (el) {
      el.classList.add("err");
      setTimeout(() => el.classList.remove("err"), 260);
    }
    pw.classList.remove("shake");
    void pw.offsetWidth;
    pw.classList.add("shake");
  },

  setTimer(frac) {
    const fill = this.$("timer-fill");
    fill.style.width = `${frac * 100}%`;
    fill.classList.toggle("low", frac < 0.3);
  },

  updateHud(S) {
    const combo = this.$("hud-combo");
    combo.textContent = S.combo >= 10 ? `🔥 x${S.combo}` : `x${S.combo}`;
    combo.classList.toggle("hot", S.combo >= 10);
    this.$("hud-score").textContent = `⭐ ${S.score}`;
    if (S.isBoss) this.renderHearts(S);
  },

  announce(text, ms = 1400) {
    const a = this.$("announce");
    a.textContent = text;
    a.classList.remove("hidden", "zoom");
    void a.offsetWidth;
    a.classList.add("zoom");
    clearTimeout(this._announceT);
    this._announceT = setTimeout(() => a.classList.add("hidden"), ms);
  },

  superMode(on) {
    document.body.classList.toggle("super-mode", on);
  },

  capsCheck(e) {
    const on = !!(e.getModifierState && e.getModifierState("CapsLock"));
    this._capsOn = on;
    this.$("capslock-warn").classList.toggle("hidden", !on);
  },

  // ---------- target animations ----------
  projHtml(S) {
    return S.world.projectile === "🔴" ? this.ballHtml() : S.world.projectile;
  },

  projectile(html, cb) {
    const arena = this.$("arena");
    // attacks come from your partner Pokemon when one stands with you
    const spot = this.$("partner-spot");
    const fromEl = spot && spot.firstChild ? spot : this.$("player-avatar");
    const from = fromEl.getBoundingClientRect();
    const to = this.$("target").getBoundingClientRect();
    const ar = arena.getBoundingClientRect();
    const p = document.createElement("div");
    p.className = "projectile";
    p.innerHTML = html;
    p.style.left = `${from.left - ar.left + from.width / 2}px`;
    p.style.top = `${from.top - ar.top}px`;
    arena.appendChild(p);
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - from.top;
    const anim = p.animate(
      [{ transform: "translate(0,0) scale(.8) rotate(0deg)" },
       { transform: `translate(${dx}px,${dy}px) scale(1.25) rotate(360deg)` }],
      { duration: 320, easing: "cubic-bezier(.2,.6,.4,1)" });
    anim.onfinish = () => p.remove();
    // game flow must not depend on animation events (they stall in
    // hidden/throttled tabs) — advance on a plain timer instead
    setTimeout(() => { p.remove(); cb && cb(); }, 340);
  },

  floatText(text, refEl, cls = "") {
    const arena = this.$("arena");
    const ar = arena.getBoundingClientRect();
    const r = refEl.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = `float-text ${cls}`;
    d.textContent = text;
    d.style.left = `${r.left - ar.left + r.width / 2}px`;
    d.style.top = `${r.top - ar.top - 6}px`;
    arena.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  },

  targetHit(S) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    this.projectile(this.projHtml(S), () => {
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, [S.world.accent, "#fff", "#ffd34d"], 18, 5);
      const txt = S.world.hitText[Math.floor(Math.random() * S.world.hitText.length)];
      this.floatText(txt, wrap, "big");
      wrap.classList.remove("hit");
      void wrap.offsetWidth;
      wrap.classList.add("hit");
      // wild battles keep the Pokemon visible — it flinches, not vanishes
      if (!S.wild) setTimeout(() => { wrap.style.opacity = 0; }, 320);
    });
  },

  targetFlee(S) {
    const wrap = this.$("target-wrap");
    this.floatText("💨 too slow!", wrap, "");
    wrap.classList.remove("flee");
    void wrap.offsetWidth;
    wrap.classList.add("flee");
    setTimeout(() => { wrap.style.opacity = 0; wrap.classList.remove("flee"); }, 600);
  },

  bossHit(S) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    this.projectile(this.projHtml(S), () => {
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffd34d", "#ff5e7a"], 24, 6);
      const txt = S.world.hitText[Math.floor(Math.random() * S.world.hitText.length)];
      this.floatText(txt, wrap, "big");
      wrap.classList.remove("boss-flash");
      void wrap.offsetWidth;
      wrap.classList.add("boss-flash");
      const done = S.idx + 1;
      const frac = Math.max(0, 1 - done / S.prompts.length);
      this.$("boss-hp-fill").style.width = `${frac * 100}%`;
      this.$("target").classList.toggle("angry", frac <= 0.5 && frac > 0);
    });
  },

  bossAttack(S) {
    const wrap = this.$("target-wrap");
    wrap.classList.remove("lunge");
    void wrap.offsetWidth;
    wrap.classList.add("lunge");
    this.renderHearts(S);
    this.floatText("💔", this.$("player-avatar"), "big");
    const flash = document.createElement("div");
    flash.className = "red-flash";
    this.$("arena").appendChild(flash);
    setTimeout(() => flash.remove(), 450);
  },

  // ---------- partner (lead party Pokemon) ----------
  showPartner(S) {
    const spot = this.$("partner-spot");
    spot.innerHTML = S && S.partner
      ? this.pokeHtml(S.partner.id, S.partner.e, { shiny: S.partner.shiny })
      : "";
  },

  partnerMeter(S) {
    const bar = this.$("partner-bar");
    if (!S || !S.meterOn) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    this.$("partner-bar-name").innerHTML =
      `${this.pokeHtml(S.partner.id, S.partner.e, { shiny: S.partner.shiny, cls: "poke-img partner-mini" })} <span>${this.esc(S.partner.n)}</span>`;
    this.$("partner-fill").style.width = `${S.charge}%`;
    bar.classList.toggle("ready", !!S.partnerReady);
  },

  partnerAttack(S) {
    const move = PARTNER_MOVES[S.partner.r] || "Tackle";
    this.announce(`${S.partner.n} used ${move}! 💥`, 1400);
    SFX.bossHit();
    this.projectile(`<span class="partner-proj">⭐</span>`, () => {
      const target = this.$("target");
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#ffd34d", "#fff", "#c77bff"], 28, 6);
      const wrap = this.$("target-wrap");
      wrap.classList.remove("boss-flash");
      void wrap.offsetWidth;
      wrap.classList.add("boss-flash");
      if (S.isBoss) {
        const frac = Math.max(0, 1 - (S.idx + 1) / S.prompts.length);
        this.$("boss-hp-fill").style.width = `${frac * 100}%`;
        target.classList.toggle("angry", frac <= 0.5 && frac > 0);
      }
    });
    this.partnerMeter(S);
  },

  renderPartyBar() {
    const bar = this.$("party-bar");
    const party = SAVE.state ? SAVE.state.party : [];
    let html = "";
    for (let i = 0; i < PARTY_MAX; i++) {
      const key = party[i];
      if (key) {
        const c = SAVE.creatureByKey(key);
        html += `<button class="party-slot filled ${i === 0 ? "lead" : ""}" data-key="${key}"
          title="${this.esc(c.n)}${i === 0 ? " — your lead" : " — click to make lead"}">
          ${this.pokeHtml(c.id, c.e, { shiny: c.shiny, cls: "poke-img party-img" })}${i === 0 ? `<span class="lead-mark">★</span>` : ""}</button>`;
      } else {
        html += `<span class="party-slot empty">＋</span>`;
      }
    }
    bar.innerHTML = html + `<span class="party-label">${party.length ? "your party" : "add Pokemon from the Pokedex!"}</span>`;
  },

  // ---------- Trainer School practice ----------
  fmtTime(ms) {
    const s = ms / 1000;
    if (s >= 60) {
      const m = Math.floor(s / 60);
      return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
    }
    return `${s.toFixed(1)}s`;
  },

  // swap the countdown bar for the count-up stopwatch (and back)
  practiceTimerUI(on) {
    this.$("timer-bar").classList.toggle("hidden", on);
    this.$("stopwatch").classList.toggle("hidden", !on);
  },

  setStopwatch(S) {
    const ms = S.typingMs + (performance.now() - S.promptStart);
    this.$("stopwatch-time").textContent = this.fmtTime(ms);
    const wpm = ms > 2000 ? Math.round((S.hits / 5) / (ms / 60000)) : 0;
    this.$("stopwatch-wpm").textContent = `${wpm} wpm`;
    this.updateGhost(S, ms);
  },

  // Practice Ghost: slide the 👻 along the progress bar to where your best
  // run had reached by this elapsed time; green glow while you're ahead of it.
  updateGhost(S, ms) {
    const marker = this.$("ghost-marker");
    if (!marker) return;
    if (!S.ghost || !S.ghost.length) { marker.classList.add("hidden"); return; }
    marker.classList.remove("hidden");
    let done = 0;
    while (done < S.ghost.length && S.ghost[done] <= ms) done++;
    if (S.paragraphMode) {
      // one long prompt: units are words. Player progress = spaces already
      // passed (words fully typed); ghost progress = word times <= elapsed.
      const total = S.text.trim().split(/\s+/).length || 1;
      let typed = 0;
      for (let i = 0; i < S.pos; i++) if (S.text[i] === " ") typed++;
      marker.style.left = `${Math.min(100, 100 * done / total)}%`;
      marker.classList.toggle("ahead", typed > done);
    } else {
      marker.style.left = `${Math.min(100, 100 * done / S.prompts.length)}%`;
      marker.classList.toggle("ahead", S.idx > done); // you've cleared more words than the ghost
    }
  },

  practiceScene(S) {
    this.show("game");
    // Story Typing is a pure typing test — no battle arena up top
    this.$("screen-game").classList.toggle("paragraph-mode", !!S.paragraph);
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.setGameKeyboard(!!S.fullKb); // License drills show the number row
    this.applyKbVisibility();
    this.practiceTimerUI(true);
    this.$("hud-stage").textContent = S.paragraph
      ? `📖 Story · ${S.paragraph.def.title}` : `🏫 Practice · ${S.practice.label}`;
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "0%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    // Practice Ghost marker — drills AND Story Typing race their best run
    // (or, when racing a sibling, their recorded ghost: tinted + name-labelled)
    const ghost = this.$("ghost-marker");
    const hasGhost = !!(S.ghost && S.ghost.length);
    if (ghost) {
      ghost.classList.toggle("hidden", !hasGhost);
      ghost.classList.remove("ahead");
      ghost.classList.toggle("sibling", !!S.ghostName);
      ghost.style.left = "0%";
      const owner = this.$("ghost-owner");
      if (owner) {
        owner.textContent = S.ghostName ? `${S.ghostName}'s ghost` : "";
        owner.classList.toggle("hidden", !(hasGhost && S.ghostName));
      }
    }
    this.showPartner(S);
    this.partnerMeter(S);
    const arena = this.$("arena");
    arena.style.background = `linear-gradient(160deg, ${w.gradient[0]}, ${w.gradient[1]})`;
    arena.style.setProperty("--wa", w.accent);
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    w.sceneEmojis.forEach((e2, i) => {
      const sp = document.createElement("span");
      sp.textContent = e2;
      sp.style.left = `${12 + i * 24}%`;
      sp.style.top = `${15 + (i % 2) * 55}%`;
      sp.style.fontSize = "20px";
      scene.appendChild(sp);
    });
    this.$("target-label").classList.add("hidden");
    const wrap = this.$("target-wrap");
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    this.$("stopwatch-time").textContent = "0.0s";
    this.$("stopwatch-wpm").textContent = "0 wpm";
    this.announce(`⏱ No countdown — beat your record!`, 1800);
    // no ghost to race yet (first drill / first read) — invite them to make one
    if (!hasGhost) {
      setTimeout(() => this.toast("👻 Set a record to unlock your ghost racer — then race it next time!", "gold"), 900);
    }
  },

  renderPractice() {
    const list = this.$("practice-tiers");
    list.innerHTML = PRACTICE_TIERS.map(t => {
      const open = SAVE.worldUnlocked(t.need);
      const pb = SAVE.state.practice[t.id];
      const pbHtml = pb
        ? `⏱ best ${this.fmtTime(pb.time)} · ⚡ best ${pb.wpm} wpm`
        : `no record yet — set one!`;
      const card = `<button class="tier-card ${open ? "" : "locked"}" data-tier="${t.id}">
        <span class="tier-e">${t.e}</span>
        <span class="tier-info">
          <b>${t.label}</b>
          <i>${open ? t.desc : `Reach ${WORLDS[t.need].emoji} ${WORLDS[t.need].name} to unlock`}</i>
          <em>${open ? `${t.count} words · ${pbHtml}` : "🔒"}</em>
        </span>
      </button>`;
      return `<div class="tier-wrap">${card}${open ? this.ghostRaceHtml("practice", t.id, pb) : ""}</div>`;
    }).join("");

    this.$("paragraph-list").innerHTML = PARAGRAPHS.map(p => {
      const open = SAVE.worldUnlocked(p.need);
      const pb = (SAVE.state.paragraphs || {})[p.id];
      const pbHtml = pb ? `⚡ best ${pb.wpm} wpm · ${Math.round(pb.acc * 100)}%` : "no record yet — set one!";
      const words = p.text.trim().split(/\s+/).length;
      const card = `<button class="para-card ${open ? "" : "locked"}" data-para="${p.id}">
        <span class="tier-e">${p.e}</span>
        <span class="tier-info">
          <b>${this.esc(p.title)}</b>
          <i>${open ? `“${this.esc(p.text.slice(0, 46))}…”` : `Reach ${WORLDS[p.need].emoji} ${WORLDS[p.need].name} to unlock`}</i>
          <em>${open ? `${words} words · ${pbHtml}` : "🔒 capitals & punctuation"}</em>
        </span>
      </button>`;
      return `<div class="tier-wrap">${card}${open ? this.ghostRaceHtml("paragraph", p.id, pb) : ""}</div>`;
    }).join("");

    this.renderWordPacks();
    this.renderLicense();
  },

  // Sibling ghost selector shown under a tier/story card when at least one
  // OTHER profile has a recorded ghost for it. Default pick is your own ghost
  // ("mine"); tapping a chip chooses whose ghost to race on the next run. The
  // choice lives in memory only (per-launch, never persisted). Hidden entirely
  // when no sibling ghosts exist (single-player stays clean).
  ghostRaceHtml(kind, id, myRec) {
    const sibs = SAVE.siblingGhosts(kind, id);
    if (!sibs.length) return "";
    const sel = (this._raceGhost && this._raceGhost[`${kind}:${id}`]) || "mine";
    const chip = (pid, label, on) =>
      `<button class="ghost-pick ${on ? "on" : ""}" data-gkind="${kind}" data-gid="${id}" data-gpid="${pid}">👻 ${label}</button>`;
    const mineLabel = myRec && myRec.ghost
      ? (kind === "paragraph" ? `mine (${myRec.wpm} wpm)` : `mine (${this.fmtTime(myRec.time)})`)
      : "mine";
    let html = `<div class="ghost-race"><span class="gr-label">🏁 Race:</span>` + chip("mine", mineLabel, sel === "mine");
    sibs.forEach(s => {
      const lab = kind === "paragraph"
        ? `${this.esc(s.name)} (${s.wpm} wpm)`
        : `${this.esc(s.name)} (${this.fmtTime(s.time)})`;
      html += chip(s.pid, lab, sel === s.pid);
    });
    return html + `</div>`;
  },

  // remember which ghost this card will race next (per-launch, in memory only)
  pickRaceGhost(chip) {
    SFX.click();
    if (!this._raceGhost) this._raceGhost = {};
    this._raceGhost[`${chip.dataset.gkind}:${chip.dataset.gid}`] = chip.dataset.gpid;
    this.renderPractice();
  },

  // ---------- Weekly Raid Boss scene ----------
  // a boss-style arena, but the HP bar shows the family's SHARED raid HP and
  // each finished word chips it with a floating damage number
  raidScene(S) {
    this.show("game");
    this.setGameKeyboard(false);
    this.$("screen-game").classList.remove("paragraph-mode");
    const raid = S.raid;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();
    this.practiceTimerUI(false);
    this.$("hud-stage").textContent = "⚔️ RAID BATTLE!";
    this.$("hud-progress").classList.add("hidden"); // the boss HP bar is the meter
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    const arena = this.$("arena");
    arena.style.background = "linear-gradient(160deg, #2a0d33, #7d1d5a)";
    arena.style.setProperty("--wa", "#ff5ec7");
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    ["🌟", "💥", "✨", "⚔️"].forEach((e2, i) => {
      const sp = document.createElement("span");
      sp.textContent = e2;
      sp.style.left = `${10 + i * 24 + Math.random() * 8}%`;
      sp.style.top = `${15 + Math.random() * 65}%`;
      sp.style.fontSize = `${16 + Math.random() * 18}px`;
      scene.appendChild(sp);
    });
    this.showPartner(S);
    this.partnerMeter(S);
    this.$("hud-hearts").classList.remove("hidden");
    this.renderHearts(S);
    const bossBar = this.$("boss-bar");
    bossBar.classList.remove("hidden");
    this.$("boss-bar-name").textContent = `🌟 ${raid.n} · Raid`;
    this.updateRaidBar(S);
    const target = this.$("target");
    const wrap = this.$("target-wrap");
    target.className = "boss-size";
    target.innerHTML = this.pokeHtml(raid.id, raid.e);
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    this.$("target-label").classList.add("hidden");
    this.updateHud(S);
    this.announce(`🌟 The whole family is fighting ${raid.n}!`, 2000);
    this.speech("Only your teamwork can wear me down!", 2600);
  },

  // paint the shared raid HP bar from how much has been dealt this attempt
  updateRaidBar(S) {
    const remaining = Math.max(0, S.raid.hp - (S.raidDealt || 0));
    const frac = S.raid.maxHp ? remaining / S.raid.maxHp : 0;
    this.$("boss-hp-fill").style.width = `${frac * 100}%`;
    this.$("target").classList.toggle("angry", frac <= 0.5 && frac > 0);
  },

  // a finished word lands on the raid boss: projectile, damage number, HP chip
  raidHit(S, dmg) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    this.projectile(this.projHtml(S), () => {
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#fff", "#ffd34d", "#ff5ec7"], 22, 6);
      this.floatText(`-${dmg}`, wrap, "big");
      wrap.classList.remove("boss-flash");
      void wrap.offsetWidth;
      wrap.classList.add("boss-flash");
      this.updateRaidBar(S);
    });
  },

  // a celebration arena for claiming the raid legendary (a guaranteed catch)
  raidClaimScene(S) {
    this.show("game");
    this.$("screen-game").classList.remove("paragraph-mode");
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();
    this.practiceTimerUI(false);
    this.$("hud-stage").textContent = "⚔️ RAID REWARD!";
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "100%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    this.showPartner(S);
    this.partnerMeter(S);
    const arena = this.$("arena");
    arena.style.background = "linear-gradient(160deg, #1c1030, #8a6d1d)";
    arena.style.setProperty("--wa", "#ffd34d");
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    ["🌟", "✨", "🎉", "🌟"].forEach((e2, i) => {
      const sp = document.createElement("span");
      sp.textContent = e2;
      sp.style.left = `${10 + i * 24 + Math.random() * 8}%`;
      sp.style.top = `${15 + Math.random() * 65}%`;
      sp.style.fontSize = `${16 + Math.random() * 18}px`;
      scene.appendChild(sp);
    });
    this.$("target-label").classList.add("hidden");
    this.updateHud(S);
  },

  // ---------- wild encounter scene (grass + fishing + legendary) ----------
  wildScene(S) {
    this.show("game");
    this.setGameKeyboard(false);
    this.$("screen-game").classList.remove("paragraph-mode");
    const w = S.world;
    const c = S.wild.creature;
    const fishing = S.wild.source === "fish";
    const legendary = S.wild.source === "legendary";
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();
    this.practiceTimerUI(false);
    this.$("hud-stage").textContent = fishing ? "🎣 Gone fishing..."
      : legendary ? "🌟 LEGENDARY BATTLE!"
      : `🌿 ${w.name} · Wild encounter!`;
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "0%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    this.showPartner(S);
    this.partnerMeter(S);
    const arena = this.$("arena");
    arena.style.background = fishing
      ? "linear-gradient(160deg, #14344d, #2e6e9d)"
      : legendary
        ? "linear-gradient(160deg, #1c1030, #8a6d1d)"
        : `linear-gradient(160deg, ${w.gradient[0]}, ${w.gradient[1]})`;
    arena.style.setProperty("--wa", legendary ? "#ffd34d" : w.accent);
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    (fishing ? ["🌊", "💧", "🫧", "🌊"] : legendary ? ["🌟", "✨", "⚡", "🌟"] : ["🌿", "🌱", "🍃", "🌾"]).forEach((e2, i) => {
      const sp = document.createElement("span");
      sp.textContent = e2;
      sp.style.left = `${10 + i * 24 + Math.random() * 8}%`;
      sp.style.top = `${15 + Math.random() * 65}%`;
      sp.style.fontSize = `${16 + Math.random() * 18}px`;
      scene.appendChild(sp);
    });
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    this.$("target-label").classList.add("hidden");
    this.updateHud(S);
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter", "hit", "flee", "wobble");
    if (fishing) {
      // just a bobber for now... what is down there?
      target.className = "";
      target.innerHTML = `<span class="bobber">🎣</span>`;
      this.$("prompt-word").innerHTML = `<span class="ch mystery">.</span><span class="ch mystery">.</span><span class="ch mystery">.</span>`;
      this.$("timer-fill").style.width = "100%";
      this.$("timer-fill").classList.remove("low");
      this.highlightKey(null);
      this.announce("Wait for it...", 1500);
    } else {
      const shiny = !!S.wild.shiny;
      target.className = "catch-size" + (shiny ? " shiny-poke" : "");
      target.innerHTML = `<span class="poke-pop">${this.pokeHtml(c.id, c.e, { shiny })}</span>`;
      if (shiny) {
        this.shinyReveal(S);
      } else {
        this.announce(legendary ? `The legendary ${c.n} appeared!` : `A wild ${c.n} jumped out!`, 1900);
        SFX.pop();
        if (legendary) SFX.fanfare();
      }
      this.speech(legendary ? "Pass my trial of three words!" : "Weaken me with words first!", 2600);
    }
  },


  // ---------- special scene (Daily Drill & friends: countdown, no boss) ----------
  specialScene(S, label) {
    this.show("game");
    this.setGameKeyboard(false);
    this.$("screen-game").classList.remove("paragraph-mode");
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();
    this.practiceTimerUI(false);
    this.$("hud-stage").textContent = label;
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "0%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.$("target-label").classList.add("hidden");
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    this.showPartner(S);
    this.partnerMeter(S);
    const arena = this.$("arena");
    arena.style.background = `linear-gradient(160deg, ${w.gradient[0]}, ${w.gradient[1]})`;
    arena.style.setProperty("--wa", w.accent);
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const e = document.createElement("span");
      e.textContent = w.sceneEmojis[i % w.sceneEmojis.length];
      e.style.left = `${5 + Math.random() * 90}%`;
      e.style.top = `${5 + Math.random() * 80}%`;
      e.style.fontSize = `${14 + Math.random() * 22}px`;
      e.style.animationDelay = `${Math.random() * 3}s`;
      scene.appendChild(e);
    }
    this.announce(label, 2200);
    this.updateHud(S);
  },

  // ---------- Battle Tower ----------
  towerScene(S, floor) {
    this.show("game");
    this.setGameKeyboard(false);
    this.$("screen-game").classList.remove("paragraph-mode");
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();
    this.practiceTimerUI(false);
    this.$("hud-stage").textContent = `🗼 Battle Tower · Floor ${floor}`;
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "0%";
    this.$("hud-hearts").classList.remove("hidden");   // the 3 hearts last the whole climb
    this.renderHearts(S);
    this.$("boss-bar").classList.add("hidden");
    this.$("target-label").classList.add("hidden");
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
    this.showPartner(S);
    this.partnerMeter(S);
    const arena = this.$("arena");
    arena.style.background = `linear-gradient(160deg, ${w.gradient[0]}, ${w.gradient[1]})`;
    arena.style.setProperty("--wa", w.accent);
    const scene = this.$("scene-emojis");
    scene.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const e = document.createElement("span");
      e.textContent = w.sceneEmojis[i % w.sceneEmojis.length];
      e.style.left = `${5 + Math.random() * 90}%`;
      e.style.top = `${5 + Math.random() * 80}%`;
      e.style.fontSize = `${14 + Math.random() * 22}px`;
      e.style.animationDelay = `${Math.random() * 3}s`;
      scene.appendChild(e);
    }
    this.announce(`🗼 Floor ${floor} — climb!`, 1500);
    this.updateHud(S);
  },

  // a 2-second breather between floors
  towerBreather(floor, reward, cb) {
    const el = this.$("tower-breather");
    let rewardHtml = "";
    if (reward) {
      const bits = [`+${reward.xp} XP`];
      if (reward.voucher) bits.push("🎟 candy voucher");
      if (reward.shiny) bits.push(`✨ ${this.esc(reward.shiny.n)} turned shiny!`);
      rewardHtml = `<div class="tb-reward">🎁 Banked: ${bits.join(" · ")}</div>`;
    }
    el.innerHTML = `<div class="tb-card">
      <div class="tb-floor">Floor ${floor} cleared! 🗼</div>
      ${rewardHtml}
      <div class="tb-next">Next floor coming up…</div>
    </div>`;
    el.classList.remove("hidden");
    SFX.fanfare();
    clearTimeout(this._tbT);
    this._tbT = setTimeout(() => { el.classList.add("hidden"); cb(); }, 2000);
  },
});
