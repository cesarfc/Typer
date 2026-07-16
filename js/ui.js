// ============================================================
// TypeQuest — UI core: the `UI` global plus its shared surface —
// boot/init, the screen router (show), title + trainer builder,
// topbar, feature-intro spotlights, toasts, particles, small helpers
// ($, esc, pokeHtml, avatarHtml, trainerSvg) and button wiring.
// Sibling files (ui-map, ui-game, ui-cards, ui-screens) Object.assign
// their methods onto this same UI object; all load before main.js.
// ============================================================

const UI = {
  current: "title",
  kbHidden: false,
  fx: { canvas: null, ctx: null, parts: [] },
  selectedAvatar: AVATARS[0],
  selectedDiff: "normal",
  spritesOk: false, // true once local Pokemon artwork is found (see tools/get-sprites.mjs)

  $(id) { return document.getElementById(id); },

  // one probe at boot decides images vs emoji for the whole session
  probeSprites() {
    const img = new Image();
    img.onload = () => { this.spritesOk = true; };
    img.src = spriteUrl(25, false);
  },

  // big visual spots use real artwork when available, emoji otherwise
  pokeHtml(id, emoji, { shiny = false, cls = "poke-img" } = {}) {
    if (!this.spritesOk || !id) return emoji;
    return `<img class="${cls}" src="${spriteUrl(id, shiny)}" alt="" draggable="false">`;
  },

  ballHtml() {
    return this.spritesOk
      ? `<img class="ball-img" src="img/pokemon/poke-ball.png" alt="" draggable="false">`
      : "🔴";
  },

  init() {
    // load() self-heals a corrupt blob (repair + quarantine), but if it still
    // throws for any reason we show a calm error card instead of a blank game.
    try {
      SAVE.load();
    } catch (e) {
      try { if (typeof Hiccups !== "undefined") Hiccups.log("save load failed: " + (e && e.message), "save.js", 0); } catch (_) {}
      this.showLoadError();
      return;
    }
    this.probeSprites();
    this.kbHidden = SAVE.state ? !SAVE.state.settings.hints : false;
    this.buildTitle();
    this.buildKeyboard();
    this.bindButtons();
    this.startFx();
    this.renderTitle();
    this.show("title");
    if (!SAVE.players().length) this.autoRestore();
  },

  // A last-resort kind screen when the save couldn't even be loaded. Kept
  // dead simple (inline styles, no dependence on the rest of UI wiring) so it
  // works even when init bailed early. A Reload button is the one action.
  showLoadError() {
    try {
      const app = document.getElementById("app") || document.body;
      const box = document.createElement("div");
      box.setAttribute("style", "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#12203a;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px;z-index:9999");
      box.innerHTML =
        `<div style="max-width:340px">` +
        `<div style="font-size:52px">🌈</div>` +
        `<h2 style="margin:.4em 0">One sec!</h2>` +
        `<p style="opacity:.85;line-height:1.5">We hit a little hiccup opening your adventure. Your progress is safe — let's try again.</p>` +
        `<button id="tq-reload" style="margin-top:14px;font-size:18px;padding:12px 22px;border:0;border-radius:14px;background:#ffcb05;color:#12203a;font-weight:700;cursor:pointer">🔄 Reload</button>` +
        `</div>`;
      app.appendChild(box);
      const btn = document.getElementById("tq-reload");
      if (btn) btn.addEventListener("click", () => location.reload());
    } catch (e) { /* nothing more we can safely do */ }
  },

  // ---------- save backup / restore ----------
  // a typequest-save.json checked into the game folder restores
  // progress automatically on any fresh browser or computer
  autoRestore() {
    fetch("typequest-save.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        const res = SAVE.importData(data);
        if (res.ok && res.imported) {
          this.kbHidden = SAVE.state ? !SAVE.state.settings.hints : this.kbHidden;
          this.applyKbVisibility();
          this.renderTitle();
          this.toast("💾 Progress restored from the backup file!", "gold");
          if (res.skipped) {
            this.toast(`💛 ${res.skipped} trainer${res.skipped === 1 ? "" : "s"} looked scrambled and ${res.skipped === 1 ? "was" : "were"} skipped.`);
          }
        }
      })
      .catch(() => { /* no backup file — that's fine */ });
  },

  async downloadBackup() {
    if (SAVE.state && SAVE.state.flags) {
      SAVE.state.flags.lastBackupXp = SAVE.state.xp;
      SAVE.save();
    }
    const data = SAVE.exportData();
    const fname = "typequest-save.json";

    // On an iPad/iPhone — and especially the installed home-screen app — a
    // plain <a download> saves nothing (there's no Safari download tray), so
    // the file just vanishes. The native share sheet works: it offers
    // "Save to Files", AirDrop, Mail, etc. Use it on touch/standalone devices.
    const standalone = navigator.standalone === true ||
      matchMedia("(display-mode: standalone)").matches ||
      matchMedia("(display-mode: fullscreen)").matches;
    const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if ((iOS || standalone) && navigator.canShare) {
      const file = new File([data], fname, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "TypeQuest backup" });
          this.toast("💾 In the share sheet, tap <b>Save to Files</b> to keep your backup.", "gold");
        } catch (e) {
          if (e && e.name === "AbortError") return; // tapped cancel — fine
          this.saveBackupLink(data, fname); // share failed — try the old way
        }
        return;
      }
    }
    this.saveBackupLink(data, fname);
  },

  // classic browser download: a Blob behind a clicked <a download>
  saveBackupLink(data, fname) {
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.toast("💾 Backup downloaded! Move <b>typequest-save.json</b> into the game folder to keep it safe.", "gold");
  },

  restoreFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let res = { ok: false };
      try { res = SAVE.importData(JSON.parse(reader.result)); } catch (e) { /* bad json */ }
      if (!res.ok) { alert("That file does not look like a TypeQuest backup."); return; }
      const skip = res.skipped
        ? ` ${res.skipped} trainer${res.skipped === 1 ? "" : "s"} looked scrambled and ${res.skipped === 1 ? "was" : "were"} skipped.`
        : "";
      alert(`Restored! ${res.imported} trainer(s) brought in from the backup.${skip}`);
      location.reload();
    };
    reader.readAsText(file);
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
        <span class="pc-avatar">${this.avatarHtml(p)}</span>
        <div class="pc-info">
          <div class="pc-name">${this.esc(p.name)}</div>
          <div class="pc-sub">Lv ${p.level} ${titleForLevel(p.level)} · 🐾 ${p.creatures} · 🏆 ${p.trophies} · ${DIFFICULTY[p.difficulty].e} ${DIFFICULTY[p.difficulty].label}</div>
        </div>
        <button class="pc-edit" data-editt="${p.id}" title="Edit trainer look">👤</button>
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
    // the puzzle playfield is a full-screen mode like the game; the lab picker
    // keeps the topbar like the practice picker
    if (name === "title" || name === "game" || name === "tutorial" || name === "puzzle") bar.classList.add("hidden");
    else bar.classList.remove("hidden");
    document.querySelectorAll(".navbtn").forEach(b =>
      b.classList.toggle("active", b.dataset.nav === name));
    if (name === "map") this.renderMap();
    if (name === "dex") this.renderDex();
    if (name === "trophies") this.renderTrophies();
    if (name === "journal") this.renderJournal();
    if (name === "stats") this.renderStats();
    if (name === "practice") this.renderPractice();
    if (name === "lab") Puzzle.renderIsle(Puzzle.currentPack);
    if (name !== "title" && name !== "game") this.renderTopbar();
    this.touchKeyboard(name);
    if (name === "map") this.maybeDayCard();
  },

  // on touch devices the on-screen keyboard only appears while an input is
  // focused — focus our invisible catcher during play, release it elsewhere.
  // (focus() summons the keyboard only inside a user gesture, which is why
  // main.js also re-focuses on taps within the game screens.)
  _coarse: matchMedia("(pointer: coarse)").matches,

  touchKeyboard(screen) {
    if (!this._coarse) return;
    const c = this.$("kb-catcher");
    if (!c) return;
    if (screen === "game" || screen === "tutorial") c.focus({ preventScroll: true });
    else if (document.activeElement === c) c.blur();
  },

  // ---------- trainer character (layered SVG) ----------
  trainerSvg(t, cls = "trainer-svg") {
    const skin = TRAINER_OPTS.skin[t.skin] || TRAINER_OPTS.skin[0];
    const hairC = TRAINER_OPTS.hairColor[t.hairColor] || TRAINER_OPTS.hairColor[0];
    const shirt = TRAINER_OPTS.shirt[t.shirt] || TRAINER_OPTS.shirt[1];
    const hatC = TRAINER_OPTS.hatColor[t.hatColor] || TRAINER_OPTS.hatColor[0];
    const hat = TRAINER_OPTS.hat[t.hat] || "none";
    const hair = TRAINER_OPTS.hair[t.hair] || "spiky";

    let hairBack = "", hairFront = "";
    if (hair === "spiky") {
      hairFront = `<path d="M27 40 L31 20 L38 28 L45 14 L52 27 L60 16 L68 28 L73 40 Q50 26 27 40 Z" fill="${hairC}"/>`;
    } else if (hair === "bowl") {
      hairFront = `<path d="M27 42 Q27 13 50 13 Q73 13 73 42 Q66 30 50 30 Q34 30 27 42 Z" fill="${hairC}"/>`;
    } else if (hair === "long") {
      hairBack = `<path d="M29 28 Q26 66 33 76 L67 76 Q74 66 71 28 Z" fill="${hairC}"/>`;
      hairFront = `<path d="M27 40 Q27 13 50 13 Q73 13 73 40 Q50 24 27 40 Z" fill="${hairC}"/>`;
    } else if (hair === "curls") {
      hairFront = `<g fill="${hairC}"><circle cx="31" cy="26" r="9"/><circle cx="41" cy="18" r="9"/>
        <circle cx="50" cy="15" r="9"/><circle cx="59" cy="18" r="9"/><circle cx="69" cy="26" r="9"/>
        <circle cx="27" cy="35" r="7"/><circle cx="73" cy="35" r="7"/></g>`;
    } else if (hair === "mohawk") {
      // shaved sides, a bold crest of spikes running over the middle
      hairFront = `<path d="M42 36 L44 9 L48 24 L50 5 L52 24 L56 9 L58 36 Q50 30 42 36 Z" fill="${hairC}"/>`;
    } else if (hair === "ponytail") {
      // a rounded fringe up front with a tail swept out behind on one side
      hairBack = `<path d="M67 24 Q88 32 83 58 Q80 72 71 67 Q80 50 69 33 Z" fill="${hairC}"/>
        <rect x="64" y="27" width="9" height="7" rx="3" fill="#1d2030" opacity=".55"/>`;
      hairFront = `<path d="M28 40 Q28 14 50 14 Q72 14 72 40 Q50 26 28 40 Z" fill="${hairC}"/>`;
    }

    let hatSvg = "";
    if (hat === "cap") {
      hatSvg = `<path d="M28 29 Q28 11 50 11 Q72 11 72 29 Q50 21 28 29 Z" fill="${hatC}"/>
        <ellipse cx="58" cy="28" rx="21" ry="4.5" fill="${hatC}"/>
        <circle cx="50" cy="19" r="4" fill="#fff"/>`;
    } else if (hat === "beanie") {
      hatSvg = `<path d="M28 33 Q28 9 50 9 Q72 9 72 33 L72 35 L28 35 Z" fill="${hatC}"/>
        <rect x="28" y="31" width="44" height="6" rx="3" fill="#fff" opacity=".35"/>
        <circle cx="50" cy="9" r="4.5" fill="#fff" opacity=".8"/>`;
    } else if (hat === "crown") {
      // five points on a jewelled band
      hatSvg = `<path d="M29 26 L33 10 L41 21 L50 6 L59 21 L67 10 L71 26 Z" fill="${hatC}"/>
        <rect x="29" y="23" width="42" height="7" rx="2" fill="${hatC}"/>
        <circle cx="50" cy="26" r="2.2" fill="#fff"/><circle cx="38" cy="27" r="1.7" fill="#fff"/>
        <circle cx="62" cy="27" r="1.7" fill="#fff"/>
        <circle cx="50" cy="9" r="2" fill="#fff"/><circle cx="33" cy="12" r="1.6" fill="#fff"/>
        <circle cx="67" cy="12" r="1.6" fill="#fff"/>`;
    } else if (hat === "visor") {
      // a sun visor: a headband strap with an open top and a curved brim
      hatSvg = `<path d="M25 31 Q50 23 75 31 Q75 36 69 36 L31 36 Q25 36 25 31 Z" fill="${hatC}"/>
        <rect x="27" y="25" width="46" height="6" rx="3" fill="${hatC}"/>
        <rect x="27" y="25" width="46" height="3" rx="1.5" fill="#fff" opacity=".3"/>`;
    }

    // Champion's cape: a flowing red drape with gold trim and a gold clasp,
    // drawn BEHIND the body/arms so it flares out past the shoulders. Old
    // saves have no `cape` key, so treat a missing value as "none".
    let capeSvg = "";
    if ((t.cape || 0) === 1) {
      capeSvg = `<path d="M33 55 Q15 78 15 104 Q24 98 32 104 Q41 98 50 104 Q59 98 68 104 Q76 98 85 104 Q85 78 67 55 Q50 61 33 55 Z"
          fill="#c62828" stroke="#f5c518" stroke-width="2" stroke-linejoin="round"/>
        <path d="M33 55 Q15 78 15 104 Q23 99 31 103 L42 57 Z" fill="#9c1616" opacity=".5"/>
        <rect x="41" y="53" width="18" height="5" rx="2.5" fill="#f5c518"/>
        <circle cx="50" cy="55.5" r="3.1" fill="#ffd34d" stroke="#b8901f" stroke-width="1"/>`;
    }

    // thick charcoal-brown linework so trainers sit in the Lost Legends
    // world; a group stroke wraps every part (elements with their own
    // stroke — the cape trim, mouth — keep it and override).
    return `<svg class="${cls}" viewBox="0 0 100 118" aria-hidden="true">
      <g stroke="#3a3130" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
      ${hairBack}
      ${capeSvg}
      <rect x="38" y="88" width="9" height="21" rx="4" fill="#27314f"/>
      <rect x="53" y="88" width="9" height="21" rx="4" fill="#27314f"/>
      <ellipse cx="42" cy="111" rx="8" ry="4.5" fill="#1b2142"/>
      <ellipse cx="58" cy="111" rx="8" ry="4.5" fill="#1b2142"/>
      <rect x="31" y="56" width="38" height="36" rx="13" fill="${shirt}"/>
      <rect x="23" y="58" width="10" height="25" rx="5" fill="${shirt}"/>
      <rect x="67" y="58" width="10" height="25" rx="5" fill="${shirt}"/>
      <circle cx="28" cy="85" r="4.5" fill="${skin}"/>
      <circle cx="72" cy="85" r="4.5" fill="${skin}"/>
      <circle cx="50" cy="36" r="22" fill="${skin}"/>
      ${hairFront}
      ${hatSvg}
      <circle cx="42" cy="39" r="2.6" fill="#1d2030" stroke="none"/>
      <circle cx="58" cy="39" r="2.6" fill="#1d2030" stroke="none"/>
      <path d="M44 48 Q50 53 56 48" stroke="#1d2030" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`;
  },

  avatarHtml(p, cls = "") {
    if (p && p.trainer) return this.trainerSvg(p.trainer, `trainer-svg ${cls}`);
    return `<span class="avatar-emoji ${cls}">${p && p.avatar ? p.avatar : "🧢"}</span>`;
  },

  // ---------- title ----------
  buildTitle() {
    this.builder = defaultTrainer();
    this.renderBuilder();
    this.$("trainer-opts").addEventListener("click", e => {
      const b = e.target.closest(".swatch");
      if (!b) return;
      if (b.dataset.lk) {
        SFX.error();
        this.toast(`🔒 ${b.dataset.lk}`);
        return;
      }
      this.builder[b.dataset.k] = +b.dataset.i;
      SFX.click();
      this.renderBuilder();
    });
    this.$("btn-random-trainer").addEventListener("click", e => {
      e.preventDefault();
      // randomTrainer only rolls among unlocked pieces for every part now,
      // so 🎲 can never land on a locked hair / hat / color / skin
      this.builder = randomTrainer();
      SFX.combo();
      this.renderBuilder();
    });

    const dgrid = this.$("diff-grid");
    dgrid.innerHTML = DIFF_ORDER.map(d => `
      <button class="diff-opt${d === this.selectedDiff ? " sel" : ""}" data-diff="${d}">
        <span class="diff-e">${DIFFICULTY[d].e}</span>
        <span class="diff-name">${DIFFICULTY[d].label}</span>
        <span class="diff-desc">${DIFFICULTY[d].desc}</span>
      </button>`).join("");
    dgrid.addEventListener("click", e => {
      const b = e.target.closest(".diff-opt");
      if (!b) return;
      dgrid.querySelectorAll(".diff-opt").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      this.selectedDiff = b.dataset.diff;
      SFX.click();
    });
  },

  renderBuilder() {
    const t = this.builder;
    this.$("trainer-preview").innerHTML = this.trainerSvg(t, "trainer-svg preview");
    const row = (label, inner) =>
      `<div class="opt-row"><span>${label}</span><div class="opt-swatches">${inner}</div></div>`;
    const colorSw = (key, colors) => colors.map((c, i) => {
      const lk = SAVE.wardrobeOk(key, i);
      return lk.ok
        ? `<button class="swatch ${t[key] === i ? "sel" : ""}" data-k="${key}" data-i="${i}" style="background:${c}"></button>`
        : `<button class="swatch locked-sw" data-lk="${this.esc(lk.label)}" title="🔒 ${this.esc(lk.label)}" style="background:${c}">🔒</button>`;
    }).join("");
    // shape swatches (hair / hat) show a mini trainer preview, or a 🔒 when locked
    const shapeSw = (key, mods) => TRAINER_OPTS[key].map((h, i) => {
      const lk = SAVE.wardrobeOk(key, i);
      if (!lk.ok) {
        return `<button class="swatch hair-sw locked-sw" data-lk="${this.esc(lk.label)}" title="🔒 ${this.esc(lk.label)}">🔒</button>`;
      }
      const inner = h === "none" ? "✖" : this.trainerSvg({ ...t, ...mods(i) }, "trainer-svg mini");
      // (t[key] || 0) so a save missing this part (e.g. old saves without a
      // cape) still shows the "none" option as selected
      return `<button class="swatch hair-sw ${(t[key] || 0) === i ? "sel" : ""}" data-k="${key}" data-i="${i}">${inner}</button>`;
    }).join("");
    let html = row("Skin", colorSw("skin", TRAINER_OPTS.skin));
    html += row("Hair", shapeSw("hair", i => ({ hair: i, hat: 0 })));
    html += row("Hair color", colorSw("hairColor", TRAINER_OPTS.hairColor));
    html += row("Hat", shapeSw("hat", i => ({ hat: i })));
    if (TRAINER_OPTS.hat[t.hat] !== "none") html += row("Hat color", colorSw("hatColor", TRAINER_OPTS.hatColor));
    html += row("Shirt", colorSw("shirt", TRAINER_OPTS.shirt));
    html += row("Cape", shapeSw("cape", i => ({ cape: i })));
    this.$("trainer-opts").innerHTML = html;
  },

  startGameFromTitle() {
    if (this._editTrainer) {
      SAVE.setTrainer(this._editTrainer, { ...this.builder });
      this._editTrainer = null;
      this.$("name-input").parentNode.classList.remove("editing-trainer");
      this.$("btn-start").textContent = "▶ Start Adventure";
      this.toast("👤 Trainer updated!", "gold");
      this.renderTitle();
      return;
    }
    const name = this.$("name-input").value.trim() || "Hero";
    if (!SAVE.createPlayer(name, "🧢", this.selectedDiff, { ...this.builder })) { this.renderTitle(); return; }
    this.$("name-input").value = "";
    this.enterGame();
  },

  enterGame() {
    SFX.init();
    SFX.setEnabled(SAVE.state.settings.sound);
    this.kbHidden = !SAVE.state.settings.hints;
    this.applyKbVisibility();
    const streak = SAVE.touchStreak();
    if (streak && streak.rested) {
      this.toast(`🛏 Your streak rested at the Pokemon Center while you were away! 🔥 ${streak.count}`, "gold");
    } else if (streak && streak.sprouted) {
      this.toast(`🌱 A fresh streak sprouts today!${streak.best > 1 ? ` Old best: <b>${streak.best} days</b> — beat it!` : ""}`);
    }
    if (!SAVE.state.tutorialDone) { Tutorial.start(); return; }
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
    this.$("chip-avatar").innerHTML = this.avatarHtml(p);
    this.$("chip-name").textContent = p.name;
    this.$("chip-title").textContent = `${titleForLevel(lv.level)} · Lv ${lv.level}`;
    this.$("chip-xpfill").style.width = `${Math.round(100 * lv.into / lv.need)}%`;
    const tokens = SAVE.state.streak.tokens || 0;
    this.$("streak-chip").textContent = `🔥 ${SAVE.state.streak.count || 0}${"🛏".repeat(tokens)}`;
    this.$("streak-chip").title = tokens
      ? `Daily play streak — ${tokens} rest token${tokens > 1 ? "s" : ""} banked (a rest covers a missed day)`
      : "Daily play streak";
    this.$("sound-btn").textContent = SAVE.state.settings.sound ? "🔊" : "🔇";
    const d = DIFFICULTY[SAVE.state.settings.difficulty] || DIFFICULTY.normal;
    const db = this.$("diff-btn");
    db.textContent = `${d.e} ${d.label}`;
    db.title = `Difficulty: ${d.label} — click to change`;
    db.setAttribute("aria-label", `Difficulty ${d.label}, click to change`);
    const band = BANDS[SAVE.state.band] || BANDS.trainer;
    const bb = this.$("band-btn");
    bb.textContent = `${band.e} ${band.label}`;
    bb.title = `Challenge level: ${band.label} — ${band.desc}. Tap to make words easier or harder for your age.`;
    bb.setAttribute("aria-label", `Challenge level ${band.label}, tap to change`);
  },

  // ---------- Professor's Letters: features introduce themselves ----------
  pendingIntro() {
    if (this._introDoneThisSession || !SAVE.state) return null;
    const seen = SAVE.state.flags.intros || {};
    return FEATURE_INTROS.find(f => !seen[f.id] && f.when(SAVE)) || null;
  },

  startIntro(intro, replay) {
    this._intro = { def: intro, page: 0, replay: !!replay };
    this.$("letter-icon").textContent = intro.icon;
    this.$("letter-title").textContent = intro.title;
    this.renderLetterPage();
    this.$("letter-overlay").classList.remove("hidden");
    SFX.word();
  },

  renderLetterPage() {
    const it = this._intro;
    this.$("letter-page").innerHTML = it.def.pages[it.page];
    this.$("letter-dots").innerHTML = it.def.pages.map((_, i) =>
      `<i class="${i === it.page ? "on" : ""}"></i>`).join("");
    this.$("letter-next").textContent =
      it.page < it.def.pages.length - 1 ? "Next ▶"
        : (it.replay || !it.def.spotlight ? "✔ Done" : "Show me! ▶");
  },

  letterNext() {
    const it = this._intro;
    if (!it) return;
    if (it.page < it.def.pages.length - 1) {
      it.page++;
      this.renderLetterPage();
      SFX.click();
      return;
    }
    this.$("letter-overlay").classList.add("hidden");
    this._intro = null;
    if (!it.replay) {
      SAVE.state.flags.intros = SAVE.state.flags.intros || {};
      SAVE.state.flags.intros[it.def.id] = true;
      SAVE.save();
      this._introDoneThisSession = true;
      if (this.current === "map") this.renderMap(); // the parcel is collected
      if (it.def.spotlight) this.runSpotlight(it.def.spotlight, 0);
    }
  },

  runSpotlight(steps, i) {
    this._teardownStep();
    clearTimeout(this._spotHideT); // a restart cancels any pending fade-out hide
    if (i >= steps.length) { this._endSpotlight(); return; }
    const st = steps[i];
    if (st.nav) this.show(st.nav);
    if (st.tab) { this._museumTab = st.tab; this.renderTrophies(); }

    const sp = this.$("spotlight");
    sp.classList.remove("hidden");
    setTimeout(() => sp.classList.add("show"), 10);

    const el = document.querySelector(st.sel);
    if (!el || !el.getClientRects().length) { this.runSpotlight(steps, i + 1); return; } // missing/hidden -> skip

    el.classList.add("spot-target");
    el.classList.toggle("spot-small", el.getBoundingClientRect().width < 60);
    this._spotEl = el;
    // topbar is its own z-index:50 stacking context — lift the whole bar
    // above the overlay so a topbar icon (e.g. #band-btn) can actually light
    const bar = el.closest("#topbar");
    if (bar) { this._liftedBar = bar; bar.style.zIndex = "141"; el.style.pointerEvents = "none"; this._liftedEl = el; }

    const total = steps.length;
    this.$("spot-text").textContent = st.text;
    const count = this.$("spot-count");
    count.textContent = `${i + 1} of ${total}`;
    count.classList.toggle("hidden", total < 2);
    this.$("spot-next").textContent = i === total - 1 ? "Got it! ✓" : "Next ▶";

    const tall = el.getBoundingClientRect().height > innerHeight - 120;
    el.scrollIntoView({ block: tall ? "start" : "nearest", behavior: "auto" });

    // place AFTER nav/tab/scroll layout settles (setTimeout, not rAF, so it
    // still fires when frames are throttled — scrollIntoView is synchronous)
    setTimeout(() => {
      if (this._spotEl !== el) return;
      this._placeCaption(el.getBoundingClientRect());
      this.$("spot-caption").classList.add("spot-in");
    }, 40);

    this._spotReflow = () => { if (this._spotEl) this._placeCaption(this._spotEl.getBoundingClientRect()); };
    addEventListener("resize", this._spotReflow);
    addEventListener("scroll", this._spotReflow, true);
    this._spotNext = () => this.runSpotlight(steps, i + 1);
  },

  _placeCaption(r) {
    const cap = this.$("spot-caption");
    const vw = innerWidth, vh = innerHeight, GAP = 16, M = 12;
    const cw = cap.offsetWidth, ch = cap.offsetHeight;
    const spaceBelow = vh - r.bottom, spaceAbove = r.top;
    let side, top, left;
    if (r.bottom < vh * 0.45 && spaceBelow > ch + GAP + M) side = "below";
    else if (r.top > vh * 0.55 && spaceAbove > ch + GAP + M) side = "above";
    else if (spaceBelow >= spaceAbove && spaceBelow > ch + GAP + M) side = "below";
    else if (spaceAbove > ch + GAP + M) side = "above";
    else side = "beside";

    if (side === "below") { top = r.bottom + GAP; left = r.left + r.width / 2 - cw / 2; }
    else if (side === "above") { top = r.top - GAP - ch; left = r.left + r.width / 2 - cw / 2; }
    else {
      if (r.left > vw - r.right) { side = "left"; left = r.left - GAP - cw; }
      else { side = "right"; left = r.right + GAP; }
      top = Math.max(M, Math.min(r.top + r.height / 2 - ch / 2, vh - ch - M));
    }
    left = Math.max(M, Math.min(left, vw - cw - M));
    top = Math.max(M, Math.min(top, vh - ch - M));
    cap.style.top = `${Math.round(top)}px`;
    cap.style.left = `${Math.round(left)}px`;
    this._positionArrow(side, left, top, cw, ch, r.left + r.width / 2, r.top + r.height / 2);
  },

  _positionArrow(side, capLeft, capTop, cw, ch, tcx, tcy) {
    const a = this.$("spot-arrow");
    a.style.cssText = "";
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    if (side === "below") { a.style.top = "-8px"; a.style.left = `${clamp(tcx - capLeft, 14, cw - 14)}px`; a.dataset.dir = "up"; }
    else if (side === "above") { a.style.bottom = "-8px"; a.style.left = `${clamp(tcx - capLeft, 14, cw - 14)}px`; a.dataset.dir = "down"; }
    else if (side === "right") { a.style.left = "-8px"; a.style.top = `${clamp(tcy - capTop, 14, ch - 14)}px`; a.dataset.dir = "left"; }
    else { a.style.right = "-8px"; a.style.top = `${clamp(tcy - capTop, 14, ch - 14)}px`; a.dataset.dir = "right"; }
  },

  _teardownStep() {
    if (this._spotEl) { this._spotEl.classList.remove("spot-target", "spot-small"); this._spotEl = null; }
    if (this._liftedBar) { this._liftedBar.style.zIndex = ""; this._liftedBar = null; }
    if (this._liftedEl) { this._liftedEl.style.pointerEvents = ""; this._liftedEl = null; }
    const cap = this.$("spot-caption");
    cap.classList.remove("spot-in");
    if (this._spotReflow) {
      removeEventListener("resize", this._spotReflow);
      removeEventListener("scroll", this._spotReflow, true);
      this._spotReflow = null;
    }
  },

  _endSpotlight() {
    const sp = this.$("spotlight");
    sp.classList.remove("show");
    this._spotNext = null;
    clearTimeout(this._spotHideT);
    this._spotHideT = setTimeout(() => sp.classList.add("hidden"), 200);
  },

  // skip/escape: tear down the current step and close
  endSpotlight() {
    this._teardownStep();
    this._endSpotlight();
  },

  spotlightOpen() {
    return !this.$("spotlight").classList.contains("hidden");
  },

  // Enter/Space advance, Escape skips (routed from main.js so it never
  // double-fires with the game/map key handlers)
  spotlightKey(e) {
    if (e.key === "Escape") { e.preventDefault(); this.endSpotlight(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (this._advanceSpot) this._advanceSpot(); }
  },

  museumShowMe(kind) {
    if (kind !== "dex") return;
    const worldsMissing = [];
    for (let w = 0; w < WORLDS.length; w++) {
      if (CREATURES[w].some((c, i) => !SAVE.state.dex[`${w}-${i}`])) worldsMissing.push(w);
    }
    if (!worldsMissing.length) return;
    const w = worldsMissing.find(x => SAVE.worldUnlocked(x));
    this.show("map");
    this.openAreaPanel(w === undefined ? worldsMissing[0] : w);
  },

  // ---------- toasts (queued: kids read slowly — max 2 at once, ~5s) ----------
  _toastQ: [],
  _toastsShowing: 0,

  toast(html, cls = "") {
    this._toastQ.push({ html, cls });
    this._pumpToasts();
  },

  // announce any wardrobe pieces the player just earned (once each) — points
  // them at the 👤 redesign entry on the player screen
  flashWardrobeUnlocks() {
    const newly = SAVE.newlyUnlockedWardrobe();
    newly.forEach((u, i) => setTimeout(() =>
      this.toast(`👗 New outfit unlocked — ${this.esc(u.label)}! Tap 👤 on the player screen to redesign.`, "gold"),
      1200 + i * 900));
    return newly.length;
  },

  _pumpToasts() {
    if (this._toastsShowing >= 2 || !this._toastQ.length) return;
    const { html, cls } = this._toastQ.shift();
    this._toastsShowing++;
    const box = this.$("toasts");
    const t = document.createElement("div");
    t.className = `toast ${cls}`;
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 4800);
    setTimeout(() => {
      t.remove();
      this._toastsShowing--;
      this._pumpToasts();
    }, 5300);
  },

  trophyToast(t) {
    SFX.trophy();
    if (SAVE.state && SAVE.state.flags) {
      SAVE.state.flags.newTrophies = SAVE.state.flags.newTrophies || {};
      SAVE.state.flags.newTrophies[t.id] = true;
      SAVE.save();
    }
    // trophies deserve a moment, not just a toast
    if (!this._splashBusy) {
      this._splashBusy = true;
      this.$("ts-emoji").textContent = t.e;
      this.$("ts-name").textContent = t.name;
      const sp = this.$("trophy-splash");
      sp.classList.remove("hidden");
      setTimeout(() => {
        sp.classList.add("hidden");
        this._splashBusy = false;
      }, 1800);
    } else {
      this.toast(`🏆 Trophy unlocked: <b>${t.e} ${t.name}</b>`, "gold");
    }
  },

  // erasing progress is a grown-up action: typing the player's name is a
  // higher bar than clicking through confirm dialogs (fitting for a typing game)
  guardErase(name) {
    const typed = window.prompt(`Grown-up check — to erase ${name}'s progress forever, type their name:`);
    return typed !== null && typed.trim().toLowerCase() === String(name).toLowerCase();
  },

  pauseOverlay(on) {
    this.$("pause-overlay").classList.toggle("hidden", !on);
    // wild battles, hatches and evolutions have nothing to restart
    const S = Engine.session;
    const canRestart = !!S && (S.practice || S.s >= 0);
    this.$("btn-restart").classList.toggle("hidden", !canRestart);
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

  _reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,

  burst(x, y, colors, n = 12, speed = 4) {
    if (this._reducedMotion) return;
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
    if (this._reducedMotion) return;
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
      this.selectedDiff = "normal";
      const dgrid = this.$("diff-grid");
      dgrid.querySelectorAll(".diff-opt").forEach(x =>
        x.classList.toggle("sel", x.dataset.diff === "normal"));
      this.$("player-select").classList.add("hidden");
      this.$("title-new").classList.remove("hidden");
      this.$("name-input").focus();
    });
    this.$("btn-backtoselect").addEventListener("click", () => {
      this._editTrainer = null;
      this.$("title-new").classList.remove("editing-trainer");
      this.$("btn-start").textContent = "▶ Start Adventure";
      this.renderTitle();
    });

    this.$("player-list").addEventListener("click", e => {
      const ed = e.target.closest(".pc-edit");
      if (ed) {
        e.stopPropagation();
        SFX.click();
        const p = SAVE.players().find(x => x.id === ed.dataset.editt);
        this._editTrainer = ed.dataset.editt;
        this.builder = p && p.trainer ? { cape: 0, ...p.trainer } : defaultTrainer();
        this.renderBuilder();
        this.$("player-select").classList.add("hidden");
        const form = this.$("title-new");
        form.classList.remove("hidden");
        form.classList.add("editing-trainer");
        this.$("btn-start").textContent = "✔ Save my trainer";
        this.$("btn-backtoselect").classList.remove("hidden");
        return;
      }
      const del = e.target.closest(".pc-del");
      if (del) {
        e.stopPropagation();
        const p = SAVE.players().find(x => x.id === del.dataset.del);
        if (p && this.guardErase(p.name)) {
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
    this.$("player-chip").addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.$("player-chip").click();
      }
    });

    document.querySelectorAll(".navbtn").forEach(b =>
      b.addEventListener("click", () => { SFX.click(); this.show(b.dataset.nav); }));

    this.bindMapPan();

    this.$("tutorial-btn").addEventListener("click", () => {
      SFX.click();
      Tutorial.start(true);
    });

    this.$("diff-btn").addEventListener("click", () => {
      if (!SAVE.state) return;
      const cur = SAVE.state.settings.difficulty || "normal";
      const next = DIFF_ORDER[(DIFF_ORDER.indexOf(cur) + 1) % DIFF_ORDER.length];
      SAVE.state.settings.difficulty = next;
      SAVE.save();
      SFX.click();
      this.renderTopbar();
      const d = DIFFICULTY[next];
      this.toast(`${d.e} Difficulty: <b>${d.label}</b> — ${d.desc}`);
    });

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
      if (this._raidNext === "claim") Engine.startRaidClaim();
      else if (this._raidNext === "attack") Engine.startRaid();
      else if (this._rematchNext) Engine.startRematch(this._rematchNext.w, this._rematchNext.tierId);
      else if (this._paragraphNext) Engine.startParagraph(this._paragraphNext, this._paragraphGhostPid);
      else if (this._practiceNext) Engine.startPractice(this._practiceNext, this._practiceGhostPid);
      else if (this._nextTarget) {
        const [w, s] = this._nextTarget;
        Engine.startStage(w, s);
      } else this.show("map");
    });
    this.$("btn-replay").addEventListener("click", () => {
      if (this._towerReplay) Engine.startTower();
      else if (this._rematchNext) Engine.startRematch(this._rematchNext.w, this._rematchNext.tierId);
      else if (this._practiceMode) this.show("practice");
      else if (this._lastStage) {
        const [w, s] = this._lastStage;
        Engine.startStage(w, s);
      }
    });
    this.$("btn-tomap").addEventListener("click", () => this.show("map"));

    // evolution: EVOLVE! buttons in the dex + the chooser modal
    this.$("dex-list").addEventListener("click", e => {
      const vb = e.target.closest(".btn-voucher");
      if (vb) {
        const r = SAVE.useVoucher(vb.dataset.vbase);
        if (r) {
          SFX.catchJingle();
          this.toast(`🎟 Voucher spent! 🍬 ${r.count}/${CANDY_COST} candy`, "gold");
          this.renderDex();
        }
        return;
      }
      const pb = e.target.closest(".btn-party");
      if (pb) {
        SFX.click();
        const r = SAVE.toggleParty(pb.dataset.pkey);
        if (r.full) {
          this.toast("🎽 Your party is full (6)! Tap a ★ to remove someone first.");
        } else if (r.added) {
          const c = SAVE.creatureByKey(pb.dataset.pkey);
          this.toast(`🎽 ${c.n} joined your party!`);
          (r.newTrophies || []).forEach(t => this.trophyToast(t));
        }
        this.renderDex();
        return;
      }
      const b = e.target.closest(".btn-evolve");
      if (!b) return;
      SFX.click();
      const baseKey = b.dataset.base;
      const targets = SAVE.evoTargetsFor(baseKey);
      if (!targets.length) return;
      if (targets.length === 1) Engine.startEvolution(baseKey, targets[0]);
      else this.evoChooser(baseKey, targets);
    });
    this.$("evo-chooser").addEventListener("click", e => {
      const opt = e.target.closest(".evo-opt");
      if (opt) {
        SFX.click();
        this.$("evo-chooser").classList.add("hidden");
        Engine.startEvolution(opt.dataset.base, opt.dataset.target);
        return;
      }
      if (e.target.closest("#evo-cancel") || e.target.id === "evo-chooser") {
        this.$("evo-chooser").classList.add("hidden");
      }
    });
    this.$("area-panel").addEventListener("click", e => {
      if (e.target.closest("#area-close") || e.target.id === "area-panel") {
        SFX.click();
        this.closeAreaPanel();
      }
    });

    this.$("perch-panel").addEventListener("click", e => {
      if (e.target.closest("#perch-close") || e.target.id === "perch-panel") {
        SFX.click(); this.closePerchCard(); return;
      }
      const cont = e.target.closest(".perch-continue");
      if (cont) { SFX.init(); this.flyToIsleContinue(cont.dataset.continue); return; }
      const dest = e.target.closest(".perch-dest");
      if (dest) { SFX.init(); this.flyToIsle(dest.dataset.fly); }
    });

    this.$("trade-panel").addEventListener("click", e => {
      const T = this._trade;
      if (e.target.closest("#trade-close") || e.target.id === "trade-panel") {
        SFX.click(); this.closeTradePanel(); return;
      }
      if (!T) return;
      const partner = e.target.closest(".trade-partner");
      if (partner) {
        SFX.click();
        T.partnerPid = partner.dataset.pid; T.mine = T.theirs = null; T.stage = "offer";
        this.renderTrade(); return;
      }
      const mon = e.target.closest(".trade-mon");
      if (mon) {
        SFX.click();
        T[mon.dataset.side] = T[mon.dataset.side] === mon.dataset.key ? null : mon.dataset.key;
        this.renderTrade(); return;
      }
      if (e.target.closest("#trade-back")) { SFX.click(); T.stage = "partner"; T.mine = T.theirs = null; this.renderTrade(); return; }
      if (e.target.closest("#trade-next")) {
        if (!(T.mine && T.theirs)) { SFX.error(); return; }
        SFX.click(); T.stage = "confirm"; this.renderTrade(); return;
      }
      if (e.target.closest("#trade-cancel")) { SFX.click(); T.stage = "offer"; this.renderTrade(); return; }
      if (e.target.closest("#trade-go")) { this.doTrade(); return; }
      if (e.target.closest("#trade-done-ok")) { SFX.click(); this.closeTradePanel(); return; }
    });

    this.$("museum-tabs").addEventListener("click", e => {
      const b = e.target.closest(".mtab");
      if (!b) return;
      SFX.click();
      this._museumTab = b.dataset.tab;
      this.renderTrophies();
    });
    this.$("diploma-wing").addEventListener("click", e => {
      const pr = e.target.closest(".dip-print");
      if (pr) { SFX.click(); this.printDiploma(pr.dataset.diploma); }
    });
    this.$("museum-ledger").addEventListener("click", e => {
      const link = e.target.closest(".ledger-link");
      if (link) { SFX.click(); this.museumShowMe(link.dataset.link); return; }
      const chip = e.target.closest(".letter-chip");
      if (chip) {
        const f = FEATURE_INTROS.find(x => x.id === chip.dataset.letter);
        if (f) { SFX.click(); this.startIntro(f, true); }
      }
    });
    this.$("letter-next").addEventListener("click", () => this.letterNext());
    const advanceSpot = () => {
      if (!this._spotNext) return;
      SFX.click();
      const fn = this._spotNext;
      this._spotNext = null;
      fn();
    };
    this._advanceSpot = advanceSpot;
    this.$("spot-next").addEventListener("click", e => { e.stopPropagation(); advanceSpot(); });
    this.$("spot-skip").addEventListener("click", e => { e.stopPropagation(); SFX.click(); this.endSpotlight(); });
    // tapping the dim area is a secondary accelerator; the button is primary
    this.$("spotlight").addEventListener("click", e => { if (e.target.id === "spotlight") advanceSpot(); });

    this.$("band-btn").addEventListener("click", () => {
      const next = BAND_ORDER[(BAND_ORDER.indexOf(SAVE.state.band) + 1) % BAND_ORDER.length];
      SAVE.state.band = next;
      SAVE.save();
      SFX.click();
      this.renderTopbar();
      const bd = BANDS[next];
      this.toast(`${bd.e} Challenge: <b>${bd.label}</b> — ${bd.desc}`);
    });
    this.$("day-chip").addEventListener("click", () => { SFX.click(); this.maybeDayCard(true); });
    this.$("school-chip").addEventListener("click", () => { SFX.click(); this.show("practice"); });
    this.$("day-card").addEventListener("click", e => {
      if (e.target.closest("#dc-done")) {
        SFX.click();
        this.$("day-card").classList.add("hidden");
        this.toast("🌙 Wonderful adventuring today. See you tomorrow, Trainer!", "gold");
        return;
      }
      if (e.target.closest("#dc-more") || e.target.id === "day-card") {
        SFX.click();
        this.$("day-card").classList.add("hidden");
      }
    });
    this.$("journal-wrap").addEventListener("click", e => {
      const cl = e.target.closest(".task-claim");
      if (cl) {
        const r = SAVE.claimTask(cl.dataset.claim);
        if (r) {
          SFX.fanfare();
          this.toast(`🔬 Research complete! +${r.xp} XP · +1 📮 stamp${r.allDone ? " · ALL THREE: +1 🎟 voucher!" : ""}`, "gold");
          this.renderJournal();
          this.renderTopbar();
        }
        return;
      }
      if (e.target.closest("#btn-daily")) { SFX.click(); Engine.startDaily(); return; }
      if (e.target.closest("#btn-elite")) { SFX.click(); Engine.startElite(); return; }
      // one handler for attack and claim — startRaid routes to claim when down
      if (e.target.closest("#btn-raid")) { SFX.init(); Engine.startRaid(); return; }
      const rm = e.target.closest(".rematch-go");
      if (rm) { SFX.init(); Engine.startRematch(+rm.dataset.rw, rm.dataset.tier); }
    });
    this.$("results-offer").addEventListener("click", e => {
      const up = e.target.closest("#btn-bandup");
      if (up) {
        SAVE.state.band = up.dataset.band;
        SAVE.save();
        SFX.fanfare();
        const bd = BANDS[SAVE.state.band];
        this.$("results-offer").className = "hidden";
        this.toast(`${bd.e} <b>${bd.label}</b> band ON! ${bd.desc}`, "gold");
        this.renderTopbar();
        return;
      }
      const as = e.target.closest("#btn-assist");
      if (as) {
        SFX.click();
        this.$("results-offer").className = "hidden";
        Engine.startStage(+as.dataset.w, +as.dataset.s, { assist: true });
      }
    });
    this.$("ceremony").addEventListener("click", e => {
      if (!e.target.closest("#cer-continue")) return;
      SFX.click();
      this.$("ceremony").classList.add("hidden");
      this.show("map");
      this.renderTopbar();
      this.toast("🏆 YOU ARE THE CHAMPION! Your photo hangs in the Museum Gallery.", "gold");
      (this._cerTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 600 + i * 900));
    });

    this.$("results-catch").addEventListener("click", e => {
      const b = e.target.closest("#btn-party-add");
      if (!b) return;
      SFX.click();
      const r = SAVE.toggleParty(b.dataset.key);
      if (r.added) {
        const c = SAVE.creatureByKey(b.dataset.key);
        b.outerHTML = `<div class="in-party-note">🎽 ${c ? this.esc(c.n) : ""} is in your party!</div>`;
        (r.newTrophies || []).forEach(t => this.trophyToast(t));
      } else if (r.full) {
        this.toast("🎽 Party is full (6)! Swap someone out in the Pokedex.");
      }
    });

    this.$("btn-backup").addEventListener("click", () => { SFX.click(); this.downloadBackup(); });
    const pickRestore = () => { SFX.click(); this.$("restore-input").click(); };
    this.$("btn-restore").addEventListener("click", pickRestore);
    this.$("btn-restore-title").addEventListener("click", pickRestore);
    this.$("restore-input").addEventListener("change", e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (file) this.restoreFromFile(file);
    });

    this.$("btn-reset").addEventListener("click", () => {
      const name = SAVE.state ? SAVE.state.profile.name : "";
      if (this.guardErase(name)) {
        SAVE.resetCurrent();
        location.reload();
      }
    });
  },
};
