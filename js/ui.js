// ============================================================
// TypeQuest — UI: screens, world map, keyboard, effects,
// results, dex, trophies and stats.
// ============================================================

const UI = {
  current: "title",
  kbHidden: false,
  fx: { canvas: null, ctx: null, parts: [] },
  selectedAvatar: AVATARS[0],

  $(id) { return document.getElementById(id); },

  init() {
    SAVE.load();
    this.kbHidden = SAVE.state ? !SAVE.state.settings.hints : false;
    this.buildTitle();
    this.buildKeyboard();
    this.bindButtons();
    this.startFx();
    this.renderTitle();
    this.show("title");
  },

  // title shows the player list when players exist, else the create form
  renderTitle() {
    const players = SAVE.players();
    const hasPlayers = players.length > 0;
    this.$("player-select").classList.toggle("hidden", !hasPlayers);
    this.$("title-new").classList.toggle("hidden", hasPlayers);
    this.$("btn-backtoselect").classList.toggle("hidden", !hasPlayers);
    this.$("btn-addplayer").classList.toggle("hidden", players.length >= SAVE.MAX_PLAYERS);
    if (!hasPlayers) return;
    this.$("player-list").innerHTML = players.map(p => `
      <div class="player-card" data-id="${p.id}">
        <span class="pc-avatar">${p.avatar}</span>
        <div class="pc-info">
          <div class="pc-name">${this.esc(p.name)}</div>
          <div class="pc-sub">Lv ${p.level} ${titleForLevel(p.level)} · 🐾 ${p.creatures} · 🏆 ${p.trophies}</div>
        </div>
        <button class="pc-del" data-del="${p.id}" title="Delete this player">✕</button>
      </div>`).join("");
  },

  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  // ---------- screens ----------
  show(name) {
    this.current = name;
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    this.$(`screen-${name}`).classList.remove("hidden");
    const bar = this.$("topbar");
    if (name === "title" || name === "game") bar.classList.add("hidden");
    else bar.classList.remove("hidden");
    document.querySelectorAll(".navbtn").forEach(b =>
      b.classList.toggle("active", b.dataset.nav === name));
    if (name === "map") this.renderMap();
    if (name === "dex") this.renderDex();
    if (name === "trophies") this.renderTrophies();
    if (name === "stats") this.renderStats();
    if (name !== "title" && name !== "game") this.renderTopbar();
  },

  // ---------- title ----------
  buildTitle() {
    const grid = this.$("avatar-grid");
    grid.innerHTML = AVATARS.map((a, i) =>
      `<button class="avatar-opt${i === 0 ? " sel" : ""}" data-av="${a}">${a}</button>`).join("");
    grid.addEventListener("click", e => {
      const b = e.target.closest(".avatar-opt");
      if (!b) return;
      grid.querySelectorAll(".avatar-opt").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      this.selectedAvatar = b.dataset.av;
      SFX.click();
    });
  },

  startGameFromTitle() {
    const name = this.$("name-input").value.trim() || "Hero";
    if (!SAVE.createPlayer(name, this.selectedAvatar)) { this.renderTitle(); return; }
    this.$("name-input").value = "";
    this.enterGame();
  },

  enterGame() {
    SFX.init();
    SFX.setEnabled(SAVE.state.settings.sound);
    this.kbHidden = !SAVE.state.settings.hints;
    this.applyKbVisibility();
    const streak = SAVE.touchStreak();
    this.show("map");
    if (streak && streak.count > 1) {
      this.toast(`🔥 ${streak.count} day streak! +${streak.bonusXp} XP`, "gold");
      (streak.newTrophies || []).forEach(t => this.trophyToast(t));
    }
  },

  // ---------- topbar ----------
  renderTopbar() {
    const p = SAVE.state && SAVE.state.profile;
    if (!p) return;
    const lv = levelFromXp(SAVE.state.xp);
    this.$("chip-avatar").textContent = p.avatar;
    this.$("chip-name").textContent = p.name;
    this.$("chip-title").textContent = `${titleForLevel(lv.level)} · Lv ${lv.level}`;
    this.$("chip-xpfill").style.width = `${Math.round(100 * lv.into / lv.need)}%`;
    this.$("streak-chip").textContent = `🔥 ${SAVE.state.streak.count || 0}`;
    this.$("sound-btn").textContent = SAVE.state.settings.sound ? "🔊" : "🔇";
  },

  // ---------- world map ----------
  renderMap() {
    const list = this.$("world-list");
    list.innerHTML = WORLDS.map((w, wi) => {
      const unlocked = SAVE.worldUnlocked(wi);
      const stars = SAVE.worldStars(wi);
      const stages = [0, 1, 2, 3, 4, 5].map(s => {
        const isBoss = s === 5;
        const st = SAVE.stageStars(wi, s);
        const open = SAVE.stageUnlocked(wi, s);
        const next = open && st === 0;
        const starsHtml = isBoss
          ? (st > 0 ? "🏆" : "")
          : "<span class='mini-stars'>" + "★".repeat(st) + "<span class='off'>" + "★".repeat(Math.max(0, 3 - st)) + "</span></span>";
        return `<button class="stage ${isBoss ? "boss" : ""} ${open ? "" : "locked"} ${next ? "next" : ""} ${st > 0 ? "done" : ""}"
          data-w="${wi}" data-s="${s}" ${open ? "" : "disabled"}>
          <span class="stage-num">${isBoss ? w.boss.emoji : s + 1}</span>${starsHtml}
        </button>`;
      }).join("");
      const lockMsg = wi > 0 ? `Defeat ${WORLDS[wi - 1].boss.name} ${WORLDS[wi - 1].boss.emoji} to unlock!` : "";
      return `<div class="world-card ${unlocked ? "" : "locked"}" style="--wg1:${w.gradient[0]};--wg2:${w.gradient[1]};--wa:${w.accent}">
        <div class="world-head">
          <span class="world-emoji">${w.emoji}</span>
          <div class="world-info">
            <h3>${wi + 1}. ${w.name}</h3>
            <p>${unlocked ? w.tagline : lockMsg}</p>
          </div>
          <span class="world-stars">★ ${stars}/18</span>
        </div>
        ${unlocked ? `<div class="stage-row">${stages}</div>` : `<div class="world-lock">🔒</div>`}
      </div>`;
    }).join("");

    list.querySelectorAll(".stage").forEach(b => {
      b.addEventListener("click", () => {
        SFX.init();
        Engine.startStage(+b.dataset.w, +b.dataset.s);
      });
    });
  },

  // ---------- keyboard ----------
  buildKeyboard() {
    const kb = this.$("kb");
    let html = "";
    KB_ROWS.forEach((row, ri) => {
      html += `<div class="kb-row">`;
      if (ri === 2) html += `<div class="key wide shift" data-key="shift-l">⇧</div>`;
      row.forEach(k => {
        const home = "fj".includes(k) ? " home" : "";
        html += `<div class="key f${KEY_FINGER[k] ?? 0}${home}" data-key="${this.esc(k)}">${k === "'" ? "&#39;" : k}</div>`;
      });
      if (ri === 2) html += `<div class="key wide shift" data-key="shift-r">⇧</div>`;
      html += `</div>`;
    });
    html += `<div class="kb-row"><div class="key space f8" data-key=" ">space</div></div>`;
    kb.innerHTML = html;
    this.applyKbVisibility();
  },

  applyKbVisibility() {
    this.$("kb").classList.toggle("ninja", this.kbHidden);
    this.$("btn-ninja").textContent = this.kbHidden ? "🥷 Ninja Mode: ON (+50% XP)" : "🥷 Ninja Mode: OFF";
    this.$("btn-ninja").classList.toggle("on", this.kbHidden);
  },

  highlightKey(ch) {
    document.querySelectorAll(".key.hl").forEach(k => k.classList.remove("hl"));
    const hint = this.$("finger-hint");
    if (!ch) { hint.innerHTML = "&nbsp;"; return; }
    const lower = ch.toLowerCase();
    const isUpper = ch !== lower && /[a-z]/.test(lower);
    const el = document.querySelector(`.key[data-key="${CSS.escape(lower === " " ? " " : lower)}"]`);
    if (el) el.classList.add("hl");
    const f = KEY_FINGER[lower];
    let txt = f === undefined ? "" : FINGER_NAMES[f];
    if (isUpper) {
      const leftHand = f <= 3;
      const shiftEl = document.querySelector(`.key[data-key="${leftHand ? "shift-r" : "shift-l"}"]`);
      if (shiftEl) shiftEl.classList.add("hl");
      txt = `hold ⇧ Shift + ${txt}`;
    }
    hint.innerHTML = txt ? `👆 ${txt}` : "&nbsp;";
  },

  // ---------- game screen ----------
  gameStart(S) {
    this.show("game");
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();

    this.$("hud-stage").textContent = S.isBoss
      ? `${w.emoji} ${w.name} · BOSS`
      : `${w.emoji} ${w.name} · ${w.levels[S.s].name}`;
    this.$("hud-progress-fill").style.width = "0%";
    this.$("player-avatar").textContent = SAVE.state.profile.avatar;

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
        this.announce(S.s === 4 ? "⚡ SPEED RUN! Go go go!" : "Go! 🚀", 1300);
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
    if (S.isBoss) {
      target.textContent = S.world.boss.emoji;
      target.className = "boss-size";
    } else {
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
  },

  renderPromptText(S) {
    const pw = this.$("prompt-word");
    pw.classList.remove("long", "xlong");
    if (S.text.length > 30) pw.classList.add("xlong");
    else if (S.text.length > 16) pw.classList.add("long");
    pw.innerHTML = [...S.text].map((c, i) =>
      `<span class="ch ${i < S.pos ? "done" : i === S.pos ? "cur" : ""} ${c === " " ? "sp" : ""}">${c === " " ? "·" : this.esc(c)}</span>`
    ).join("");
    this.highlightKey(S.text[S.pos]);
  },

  charDone(S) {
    const spans = this.$("prompt-word").children;
    if (spans[S.pos - 1]) {
      spans[S.pos - 1].classList.remove("cur");
      spans[S.pos - 1].classList.add("done", "pop");
    }
    if (spans[S.pos]) spans[S.pos].classList.add("cur");
    this.highlightKey(S.text[S.pos]);
    const r = this.$("prompt-word").getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top, [S.world.accent], 3, 2.2);
  },

  charError(S) {
    const spans = this.$("prompt-word").children;
    const el = spans[S.pos];
    if (el) {
      el.classList.add("err");
      setTimeout(() => el.classList.remove("err"), 260);
    }
    const pw = this.$("prompt-word");
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
    const on = e.getModifierState && e.getModifierState("CapsLock");
    this.$("capslock-warn").classList.toggle("hidden", !on);
  },

  // ---------- target animations ----------
  projectile(emoji, cb) {
    const arena = this.$("arena");
    const from = this.$("player-avatar").getBoundingClientRect();
    const to = this.$("target").getBoundingClientRect();
    const ar = arena.getBoundingClientRect();
    const p = document.createElement("div");
    p.className = "projectile";
    p.textContent = emoji;
    p.style.left = `${from.left - ar.left + from.width / 2}px`;
    p.style.top = `${from.top - ar.top}px`;
    arena.appendChild(p);
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - from.top;
    const anim = p.animate(
      [{ transform: "translate(0,0) scale(.8) rotate(0deg)" },
       { transform: `translate(${dx}px,${dy}px) scale(1.25) rotate(360deg)` }],
      { duration: 320, easing: "cubic-bezier(.2,.6,.4,1)" });
    anim.onfinish = () => { p.remove(); cb && cb(); };
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
    this.projectile(S.world.projectile, () => {
      const r = target.getBoundingClientRect();
      this.burst(r.left + r.width / 2, r.top + r.height / 2, [S.world.accent, "#fff", "#ffd34d"], 18, 5);
      const txt = S.world.hitText[Math.floor(Math.random() * S.world.hitText.length)];
      this.floatText(txt, wrap, "big");
      wrap.classList.remove("hit");
      void wrap.offsetWidth;
      wrap.classList.add("hit");
      setTimeout(() => { wrap.style.opacity = 0; }, 320);
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
    this.projectile(S.world.projectile, () => {
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

  // ---------- catch round ----------
  showCatch(S, creature) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    target.textContent = creature.e;
    target.className = "catch-size";
    wrap.style.opacity = 1;
    wrap.style.transform = "none";
    wrap.classList.remove("enter");
    void wrap.offsetWidth;
    wrap.classList.add("enter");
    this.announce(`A wild ${creature.n} appeared!`, 1700);
    this.speech(`Type my name to catch me!`, 2600);
    this.$("hud-progress-fill").style.width = "100%";
    this.renderPromptText(S);
    SFX.combo();
  },

  catchAnim(S, success, done) {
    const wrap = this.$("target-wrap");
    const target = this.$("target");
    if (success) {
      this.projectile("🔴", () => {
        const r = target.getBoundingClientRect();
        this.burst(r.left + r.width / 2, r.top + r.height / 2, ["#ffd34d", "#fff", S.world.accent], 30, 6);
        target.textContent = "🔴";
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
    const w = WORLDS[res.w];
    const title = this.$("results-title");
    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", w.accent);

    title.textContent = res.isBoss
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
    this.$("xp-gained").textContent = `+${res.xp} XP${res.ninja ? " 🥷" : ""}`;
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
      catchBox.className = "catch-result";
      catchBox.innerHTML = `
        <div class="caught-card ${res.caught.shiny ? "shiny" : ""}" style="--rc:${rar.color}">
          <div class="caught-emoji">${res.caught.e}</div>
          <div class="caught-name">${res.caught.shiny ? "✨ SHINY " : ""}${this.esc(res.caught.n)}</div>
          <div class="caught-rar">${rar.label} · added to your Dex!</div>
        </div>`;
      setTimeout(() => this.confetti(), 600);
    } else if (res.fled) {
      catchBox.className = "catch-result";
      catchBox.innerHTML = `<div class="fled-note">💨 The wild ${this.esc(res.fled.n)} ${res.fled.e} got away... catch it next time!</div>`;
    } else {
      catchBox.className = "hidden";
      catchBox.innerHTML = "";
    }

    // big moments
    if (res.isBoss && res.firstClear) {
      this.confetti();
      if (res.w < 5) {
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
    (res.trophies || []).forEach((t, i) =>
      setTimeout(() => this.trophyToast(t), 1800 + i * 900));

    // buttons
    const next = this.$("btn-next");
    next.classList.remove("hidden");
    if (!res.isBoss) next.textContent = res.s === 4 ? "Boss Fight! 👊" : "Next Level ▶";
    else if (res.w < 5) next.textContent = `Next World: ${WORLDS[res.w + 1].emoji} ▶`;
    else next.classList.add("hidden");
    this._nextTarget = !res.isBoss ? [res.w, res.s + 1] : res.w < 5 ? [res.w + 1, 0] : null;
    SFX.fanfare();
  },

  showDefeat(S) {
    this.show("results");
    this.renderTopbar();
    this._lastStage = [S.w, S.s];
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
    next.textContent = "⚔️ Try Again!";
    this._nextTarget = [S.w, S.s];
  },

  // ---------- dex ----------
  renderDex() {
    this.$("dex-count").textContent = `${SAVE.caughtCount()} / 48`;
    this.$("dex-list").innerHTML = WORLDS.map((w, wi) => {
      const cards = CREATURES[wi].map((c, ci) => {
        const got = SAVE.state.dex[`${wi}-${ci}`];
        const rar = RARITY[c.r];
        if (!got) return `<div class="dex-card unknown"><div class="dex-emoji">${c.e}</div><div class="dex-name">???</div></div>`;
        return `<div class="dex-card ${got.shiny ? "shiny" : ""}" style="--rc:${rar.color}">
          <div class="dex-emoji">${c.e}</div>
          <div class="dex-name">${got.shiny ? "✨" : ""}${this.esc(c.n)}</div>
          <div class="dex-rar">${rar.label}</div></div>`;
      }).join("");
      const caught = CREATURES[wi].filter((c, ci) => SAVE.state.dex[`${wi}-${ci}`]).length;
      return `<div class="dex-world"><h3>${w.emoji} ${w.name} <span>${caught}/8</span></h3><div class="dex-grid">${cards}</div></div>`;
    }).join("");
  },

  // ---------- trophies ----------
  renderTrophies() {
    const got = SAVE.state.trophies;
    this.$("trophy-count").textContent = `${Object.keys(got).length} / ${TROPHIES.length}`;
    this.$("trophy-grid").innerHTML = TROPHIES.map(t => `
      <div class="trophy-card ${got[t.id] ? "on" : ""}">
        <div class="trophy-emoji">${t.e}</div>
        <div class="trophy-name">${t.name}</div>
        <div class="trophy-desc">${t.desc}</div>
      </div>`).join("");
  },

  // ---------- stats ----------
  renderStats() {
    const s = SAVE.state.stats;
    const acc = s.keys ? Math.round(100 * s.correct / s.keys) : 100;
    this.$("stats-cards").innerHTML = `
      <div class="stat-card"><div class="stat-v">${s.bestWpm}</div><div class="stat-l">best words/min</div></div>
      <div class="stat-card"><div class="stat-v">${acc}%</div><div class="stat-l">accuracy</div></div>
      <div class="stat-card"><div class="stat-v">x${s.bestCombo}</div><div class="stat-l">best combo</div></div>
      <div class="stat-card"><div class="stat-v">${s.keys.toLocaleString()}</div><div class="stat-l">keys pressed</div></div>
      <div class="stat-card"><div class="stat-v">${SAVE.caughtCount()}</div><div class="stat-l">creatures</div></div>
      <div class="stat-card"><div class="stat-v">${SAVE.state.streak.count || 0}</div><div class="stat-l">day streak</div></div>`;

    const hist = s.history.slice(-12);
    const max = Math.max(10, ...hist.map(h => h.wpm));
    this.$("stats-chart").innerHTML = hist.length
      ? hist.map(h => `<div class="bar-wrap" title="${h.wpm} wpm · ${Math.round(h.acc * 100)}%">
          <div class="bar" style="height:${Math.max(6, 100 * h.wpm / max)}%"></div><span>${h.wpm}</span></div>`).join("")
      : `<p class="dim">Play some levels to see your speed grow! 📈</p>`;

    const entries = Object.entries(s.perKey)
      .map(([k, v]) => ({ k, total: v.ok + v.miss, acc: v.ok / (v.ok + v.miss) }))
      .filter(e => e.total >= 8);
    entries.sort((a, b) => b.acc - a.acc);
    const best = entries.slice(0, 3);
    const worst = entries.filter(e => e.acc < 0.97 && !best.includes(e)).slice(-3).reverse();
    this.$("stats-keys").innerHTML = entries.length
      ? `<div class="key-list"><h4>💪 Power keys</h4>${best.map(e =>
          `<span class="key-pill good">${this.esc(e.k)} ${Math.round(e.acc * 100)}%</span>`).join("")}</div>
         <div class="key-list"><h4>🎯 Train these</h4>${worst.length ? worst.map(e =>
          `<span class="key-pill bad">${this.esc(e.k)} ${Math.round(e.acc * 100)}%</span>`).join("")
          : `<span class="dim">No tricky keys — amazing! 🌟</span>`}</div>`
      : `<p class="dim">Type more to discover your power keys! 🔑</p>`;
  },

  // ---------- toasts ----------
  toast(html, cls = "") {
    const box = this.$("toasts");
    const t = document.createElement("div");
    t.className = `toast ${cls}`;
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 3400);
    setTimeout(() => t.remove(), 3900);
  },

  trophyToast(t) {
    SFX.trophy();
    this.toast(`🏆 Trophy unlocked: <b>${t.e} ${t.name}</b>`, "gold");
  },

  pauseOverlay(on) {
    this.$("pause-overlay").classList.toggle("hidden", !on);
  },

  // ---------- particles ----------
  startFx() {
    const c = this.$("fx-canvas");
    this.fx.canvas = c;
    this.fx.ctx = c.getContext("2d");
    const fit = () => { c.width = innerWidth; c.height = innerHeight; };
    fit();
    addEventListener("resize", fit);
    const loop = () => {
      const { ctx, parts } = this.fx;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.life -= 1;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.color;
        if (p.rect) ctx.fillRect(p.x, p.y, p.size, p.size * 1.6);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  burst(x, y, colors, n = 12, speed = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.fx.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
        grav: 0.12, life: 28 + Math.random() * 22,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  },

  confetti() {
    const colors = ["#ffd34d", "#43e97b", "#4dc3ff", "#ff5e7a", "#c77bff", "#fff"];
    for (let i = 0; i < 120; i++) {
      this.fx.parts.push({
        x: Math.random() * innerWidth, y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 2.5, vy: 1.5 + Math.random() * 3,
        grav: 0.05, life: 90 + Math.random() * 70,
        size: 3 + Math.random() * 4, rect: true,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  },

  // ---------- buttons ----------
  bindButtons() {
    this.$("btn-start").addEventListener("click", () => this.startGameFromTitle());
    this.$("name-input").addEventListener("keydown", e => {
      if (e.key === "Enter") this.startGameFromTitle();
    });

    this.$("btn-addplayer").addEventListener("click", () => {
      SFX.click();
      this.$("player-select").classList.add("hidden");
      this.$("title-new").classList.remove("hidden");
      this.$("name-input").focus();
    });
    this.$("btn-backtoselect").addEventListener("click", () => this.renderTitle());

    this.$("player-list").addEventListener("click", e => {
      const del = e.target.closest(".pc-del");
      if (del) {
        e.stopPropagation();
        const p = SAVE.players().find(x => x.id === del.dataset.del);
        if (p && confirm(`Delete player ${p.name}? All their progress, creatures and trophies will be gone!`)
              && confirm("Are you really, really sure?")) {
          SAVE.deletePlayer(p.id);
          this.renderTitle();
        }
        return;
      }
      const card = e.target.closest(".player-card");
      if (card && SAVE.switchTo(card.dataset.id)) {
        SFX.click();
        this.enterGame();
      }
    });

    this.$("player-chip").addEventListener("click", () => {
      SFX.click();
      this.renderTitle();
      this.show("title");
    });

    document.querySelectorAll(".navbtn").forEach(b =>
      b.addEventListener("click", () => { SFX.click(); this.show(b.dataset.nav); }));

    this.$("sound-btn").addEventListener("click", () => {
      SAVE.state.settings.sound = !SAVE.state.settings.sound;
      SAVE.save();
      SFX.setEnabled(SAVE.state.settings.sound);
      SFX.click();
      this.renderTopbar();
    });

    this.$("btn-pause").addEventListener("click", () => Engine.pause());
    this.$("btn-resume").addEventListener("click", () => Engine.resume());
    this.$("btn-restart").addEventListener("click", () => Engine.restart());
    this.$("btn-quit").addEventListener("click", () => Engine.quitToMap());

    this.$("btn-ninja").addEventListener("click", () => {
      this.kbHidden = !this.kbHidden;
      SAVE.state.settings.hints = !this.kbHidden;
      SAVE.save();
      this.applyKbVisibility();
      SFX.click();
    });

    this.$("btn-next").addEventListener("click", () => {
      if (this._nextTarget) Engine.startStage(this._nextTarget[0], this._nextTarget[1]);
      else this.show("map");
    });
    this.$("btn-replay").addEventListener("click", () => {
      if (this._lastStage) Engine.startStage(this._lastStage[0], this._lastStage[1]);
    });
    this.$("btn-tomap").addEventListener("click", () => this.show("map"));

    this.$("btn-reset").addEventListener("click", () => {
      const name = SAVE.state ? SAVE.state.profile.name : "";
      if (confirm(`Erase ALL of ${name}'s progress, creatures and trophies? (Other players are safe.)`)
          && confirm("Are you really, really sure?")) {
        SAVE.resetCurrent();
        location.reload();
      }
    });
  },
};
