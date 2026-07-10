// ============================================================
// TypeQuest — UI: screens, world map, keyboard, effects,
// results, dex, trophies and stats.
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
    SAVE.load();
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

  // ---------- save backup / restore ----------
  // a typequest-save.json checked into the game folder restores
  // progress automatically on any fresh browser or computer
  autoRestore() {
    fetch("typequest-save.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        const res = SAVE.importData(data);
        if (res.ok && (res.added || res.updated)) {
          this.kbHidden = SAVE.state ? !SAVE.state.settings.hints : this.kbHidden;
          this.applyKbVisibility();
          this.renderTitle();
          this.toast("💾 Progress restored from the backup file!", "gold");
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
      alert(`Restored! ${res.added} player(s) added, ${res.updated} updated, ${res.kept} already up to date.`);
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

  // ---------- region map (pannable, DS-style tilted view) ----------
  MAP_W: 2900,
  MAP_H: 1560,
  TILT: 34 * Math.PI / 180, // matches --tilt in CSS
  mapX: 0,
  mapY: 0,
  // route anchor per world + final endpoint; stages snake between them
  mapAnchors: [[230, 1190], [660, 640], [1210, 1010], [1730, 430], [2140, 1030], [2480, 560], [2680, 300]],

  MAP_CITIES: [
    { x: 180, y: 1330, t: "centerRed", sc: 1.9, n: "Pallet Town" },
    { x: 545, y: 455, sp: "mine", s: 100, n: "Moonstone City" },
    { x: 1340, y: 1165, t: "martBlue", sc: 1.9, n: "Victory City" },
    { x: 1905, y: 290, sp: "volcano", s: 108, n: "Ember Town" },
    { x: 2010, y: 1190, sp: "lanternpost", s: 46, n: "Lantern Village" },
    { x: 2625, y: 425, sp: "hall", s: 104, n: "Hall of Fame" },
    { x: 905, y: 1300, sp: "pier", s: 98, n: "Fishing Pier" },
    { x: 1565, y: 690, sp: "berrybush", s: 56, n: "Berry Farm" },
  ],
  MAP_DECOR: [
    // Pallet Meadow
    { x: 95, y: 1115, sp: "tree", s: 54 }, { x: 335, y: 1005, t: "pine", sc: 2 }, { x: 470, y: 1265, sp: "flower", s: 26 },
    { x: 150, y: 950, sp: "tree", s: 44 }, { x: 420, y: 1125, t: "mushroomT", sc: 1.8 }, { x: 300, y: 1330, sp: "flower", s: 24, c: "#ffd34d" },
    { x: 640, y: 1090, sp: "tree", s: 48 }, { x: 250, y: 1180, sp: "sign", s: 26 }, { x: 255, y: 1290, sp: "house", s: 46, c: "#3a6fd8" },
    { x: 360, y: 1135, t: "bushPair", sc: 1.8 }, { x: 530, y: 1190, t: "pine", sc: 1.8 }, { x: 120, y: 1255, t: "pineBig", sc: 1.7 },
    // Mt. Moon
    { x: 560, y: 835, sp: "rock", s: 36 }, { x: 770, y: 515, sp: "mountain", s: 86 }, { x: 855, y: 720, sp: "mountain", s: 66 },
    { x: 595, y: 575, sp: "crystal", s: 28 }, { x: 930, y: 555, t: "rocksT", sc: 2 }, { x: 720, y: 390, sp: "mountain", s: 58 },
    { x: 640, y: 700, t: "rocksT", sc: 1.8 }, { x: 845, y: 480, t: "pine", sc: 1.7 },
    // Stadium plains
    { x: 1085, y: 860, sp: "wheat", s: 30 }, { x: 1345, y: 885, sp: "tree", s: 50 }, { x: 1145, y: 1190, sp: "flag", s: 30, c: "#3a6fd8" },
    { x: 1430, y: 1065, sp: "flag", s: 30 }, { x: 1240, y: 1280, sp: "sign", s: 28 }, { x: 1500, y: 960, sp: "tree", s: 44 },
    { x: 1255, y: 1110, t: "fountain", sc: 1.6 }, { x: 1475, y: 1120, t: "rowBrown", sc: 1.5 }, { x: 1295, y: 1235, t: "bench", sc: 1.8 },
    { x: 1465, y: 1245, t: "bushPair", sc: 1.8 }, { x: 1180, y: 1020, t: "pine", sc: 1.8 },
    // Dragon's Den
    { x: 1605, y: 555, sp: "mountain", s: 82 }, { x: 1835, y: 555, t: "rocksT", sc: 2.2 }, { x: 1955, y: 515, sp: "crystal", s: 24 },
    { x: 1690, y: 220, sp: "mountain", s: 70 }, { x: 1840, y: 140, e: "☁️", s: 30 },
    // Eterna Forest
    { x: 2015, y: 895, t: "pineBig", sc: 2 }, { x: 2245, y: 1185, t: "pineBig", sc: 1.8 }, { x: 2085, y: 1125, sp: "lanternpost", s: 34 },
    { x: 2305, y: 905, e: "☁️", s: 26 }, { x: 2200, y: 1320, t: "pine", sc: 2 }, { x: 2450, y: 980, t: "pineBig", sc: 1.7 },
    { x: 2120, y: 1010, t: "pine", sc: 2.1 }, { x: 2330, y: 1100, t: "pine", sc: 1.8 }, { x: 2270, y: 990, t: "mushroomT", sc: 1.8 },
    // Hall of Fame
    { x: 2385, y: 680, e: "✨", s: 18 }, { x: 2565, y: 645, sp: "flag", s: 30, c: "#f5c84c" }, { x: 2705, y: 485, e: "👑", s: 22 },
    { x: 2530, y: 540, t: "bench", sc: 1.7 },
    // water
    { x: 705, y: 1185, sp: "wave", s: 42 }, { x: 825, y: 1245, sp: "wave", s: 34 }, { x: 1005, y: 1335, sp: "wave", s: 42 },
    // Lost Legends landmark props (new art, placed directly by id)
    { x: 405, y: 1210, art: "tq-clocktower", s: 74 },   // Pallet meadow clocktower
    { x: 340, y: 1275, art: "tq-stone-well", s: 46 },
    { x: 1610, y: 640, art: "tq-sparkle-pond", s: 74 }, // Berry Farm pond
    { x: 660, y: 875, art: "tq-cliff-rocks", s: 62 },   // Mt. Moon cliffs
    { x: 800, y: 690, art: "tq-mossy-boulder", s: 52 },
    { x: 2160, y: 1180, art: "tq-mushroom-cluster", s: 40 },
    { x: 2245, y: 1050, art: "tq-cauldron", s: 44 },    // Eterna Forest cauldron
    { x: 1015, y: 1290, art: "tq-rope-bridge", s: 78 }, // over the pier lake
    { x: 1520, y: 1010, art: "tq-raid-den", s: 96 },    // the Weekly Raid den (glowing portal)
  ],

  // tall grass candidates (3 per region) and fishing spots
  GRASS_SPOTS: [
    [{ x: 350, y: 1240 }, { x: 160, y: 1060 }, { x: 520, y: 1010 }, { x: 450, y: 1160 }],
    [{ x: 560, y: 720 }, { x: 820, y: 460 }, { x: 900, y: 640 }, { x: 700, y: 560 }],
    [{ x: 1080, y: 920 }, { x: 1290, y: 1130 }, { x: 1450, y: 940 }, { x: 1190, y: 1010 }],
    [{ x: 1590, y: 470 }, { x: 1860, y: 360 }, { x: 1950, y: 560 }, { x: 1740, y: 300 }],
    [{ x: 2010, y: 950 }, { x: 2270, y: 1080 }, { x: 2150, y: 1250 }, { x: 2380, y: 1170 }],
    [{ x: 2350, y: 640 }, { x: 2600, y: 690 }, { x: 2550, y: 420 }, { x: 2450, y: 560 }],
  ],
  FISH_SPOTS: [
    { x: 945, y: 1295, need: 0 },   // Fishing Pier lake
    { x: 1530, y: 1420, need: 2 },  // south coast pier
    { x: 2245, y: 1185, need: 4 },  // Eterna pond
  ],
  CASTS_PER_DAY: 3,

  // today's rustling patches: deterministic per day, unlocked regions only
  grassSpotsToday() {
    const today = new Date().toISOString().slice(0, 10);
    let h = 0;
    for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const candidates = [];
    WORLDS.forEach((w, wi) => {
      if (!this.GRASS_SPOTS[wi] || !SAVE.worldUnlocked(wi)) return;
      this.GRASS_SPOTS[wi].forEach((p, k) => candidates.push({ id: `${wi}-${k}`, w: wi, ...p }));
    });
    const order = candidates.map((c, i) => ({ c, r: rng() })).sort((a, b) => a.r - b.r);
    return order.slice(0, Math.min(6, order.length)).map(o => o.c);
  },

  // closed smooth path through points (for the island coastline)
  smoothClosed(pts) {
    const n = pts.length;
    let d = `M ${(pts[0][0] + pts[n - 1][0]) / 2} ${(pts[0][1] + pts[n - 1][1]) / 2}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], nx = pts[(i + 1) % n];
      d += ` Q ${p[0]} ${p[1]} ${(p[0] + nx[0]) / 2} ${(p[1] + nx[1]) / 2}`;
    }
    return d + " Z";
  },

  terrainSvg() {
    const coast = this.smoothClosed([
      [150, 1140], [90, 860], [170, 560], [120, 330], [330, 170], [700, 120], [1050, 190],
      [1380, 110], [1750, 150], [2120, 100], [2430, 170], [2700, 120], [2820, 330],
      [2760, 620], [2840, 900], [2700, 1180], [2480, 1290], [2200, 1380], [1800, 1465],
      [1350, 1390], [950, 1460], [560, 1390], [260, 1300],
    ]);
    const forest = (cx, cy, s) => [[0, 0], [s, -s * .3], [-s * .9, s * .4], [s * .7, s * .6], [-s * .2, -s * .8]]
      .map(([dx, dy], i) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="${s * (0.9 - i * 0.1)}" />`).join("");
    const mt = (x, y, s) =>
      `<polygon points="${x},${y} ${x - s},${y + s * 1.25} ${x + s},${y + s * 1.25}" fill="#8fa06a"/>` +
      `<polygon points="${x},${y} ${x - s * .38},${y + s * .5} ${x + s * .38},${y + s * .5}" fill="#f4f7e6"/>`;
    // sandy path/clearing blobs scattered along the route (organic patches)
    const sand = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2ddb0"/>`;
    return `<svg id="terrain-svg" width="${this.MAP_W}" height="${this.MAP_H}" viewBox="0 0 ${this.MAP_W} ${this.MAP_H}">
      <!-- bright teal sea beyond the island -->
      <rect width="100%" height="100%" fill="#6fcfe0"/>
      <path d="${coast}" fill="none" stroke="#bfeef4" stroke-width="34" opacity=".5"/>
      <path d="${coast}" fill="none" stroke="#f2ddb0" stroke-width="20" opacity=".9"/>
      <!-- the island: lively lime-green grass -->
      <path d="${coast}" fill="#8fd14f"/>
      <path d="${coast}" fill="#9ad95a" opacity=".55" transform="translate(0,-14)"/>
      <!-- warm sandy clearings along the trail -->
      <g opacity=".85">
        ${sand(230, 1190, 150, 90)}${sand(660, 640, 130, 80)}${sand(1210, 1010, 150, 90)}
        ${sand(1730, 430, 130, 80)}${sand(2140, 1030, 150, 90)}${sand(2480, 560, 130, 80)}
        ${sand(2680, 300, 110, 70)}${sand(430, 1330, 120, 66)}
      </g>
      <!-- a sandy trail hugging the winding route -->
      <path d="M230,1190 Q450,900 660,640 Q940,820 1210,1010 Q1470,720 1730,430 Q1940,730 2140,1030 Q2310,800 2480,560 L2680,300" fill="none"
        stroke="#f2ddb0" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
      <!-- fishing lakes & pond: bright teal water -->
      <path d="M700,620 C 770,810 850,930 890,1080 C 910,1170 930,1240 945,1295" fill="none"
        stroke="#3fb5cf" stroke-width="24" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="945" cy="1310" rx="175" ry="78" fill="#3fb5cf"/>
      <ellipse cx="915" cy="1295" rx="80" ry="26" fill="#a7e6f0" opacity=".6"/>
      <ellipse cx="2245" cy="1195" rx="95" ry="46" fill="#3fb5cf"/>
      <ellipse cx="2228" cy="1186" rx="42" ry="14" fill="#a7e6f0" opacity=".6"/>
      <!-- soft darker-green woodland shading (kept subtle & bright) -->
      <g fill="#79c247" opacity=".38">
        ${forest(265, 1075, 62)}${forest(470, 1180, 48)}${forest(1115, 800, 52)}
        ${forest(2120, 930, 66)}${forest(2330, 1110, 52)}${forest(2520, 470, 46)}
      </g>
      ${mt(700, 360, 78)}${mt(820, 430, 56)}${mt(610, 450, 48)}
      ${mt(1700, 200, 72)}${mt(1830, 280, 52)}${mt(1600, 290, 44)}
    </svg>`;
  },

  // seeded scatter groups: lots of extra greenery/rubble without
  // hand-placing every item (deterministic, so the map never shifts)
  MAP_SCATTER: [
    { t: "pine", n: 7, x: 2180, y: 1060, r: 240, smin: 1.4, smax: 2.1 },
    { t: "pineBig", n: 4, x: 2080, y: 950, r: 190, smin: 1.5, smax: 2 },
    { t: "mushroomT", n: 3, x: 2280, y: 1120, r: 140, smin: 1.4, smax: 1.8 },
    { sp: "tree", n: 6, x: 340, y: 1100, r: 200, smin: 36, smax: 54 },
    { sp: "flower", n: 8, x: 430, y: 1240, r: 190, smin: 18, smax: 26, cs: ["#ff8ab5", "#ffd34d", "#fff", "#b39df1"] },
    { t: "bushPair", n: 3, x: 560, y: 1070, r: 140, smin: 1.4, smax: 1.8 },
    { sp: "rock", n: 4, x: 700, y: 690, r: 160, smin: 24, smax: 36 },
    { sp: "crystal", n: 3, x: 640, y: 545, r: 110, smin: 18, smax: 26 },
    { t: "rocksT", n: 5, x: 1770, y: 470, r: 190, smin: 1.5, smax: 2.2 },
    { sp: "tree", n: 5, x: 1230, y: 970, r: 200, smin: 36, smax: 50 },
    { t: "pine", n: 4, x: 1680, y: 640, r: 170, smin: 1.4, smax: 1.9 },
    { sp: "wave", n: 5, x: 1300, y: 1505, r: 170, smin: 30, smax: 42 },
    { sp: "wave", n: 3, x: 60, y: 720, r: 110, smin: 26, smax: 36 },
  ],

  scatterDecor() {
    if (this._scatter) return this._scatter;
    let h = 1337;
    const rng = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const out = [];
    this.MAP_SCATTER.forEach(g => {
      for (let i = 0; i < g.n; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * g.r;
        const x = Math.round(g.x + Math.cos(a) * d);
        const y = Math.round(g.y + Math.sin(a) * d * 0.7);
        const k = g.smin + rng() * (g.smax - g.smin);
        const c = g.cs ? g.cs[Math.floor(rng() * g.cs.length)] : g.c;
        out.push(g.t
          ? { x, y, t: g.t, sc: Math.round(k * 10) / 10 }
          : { x, y, sp: g.sp, s: Math.round(k), c });
      }
    });
    this._scatter = out;
    return out;
  },

  mapNodes() {
    if (this._mapNodes) return this._mapNodes;
    const A = this.mapAnchors;
    this._mapNodes = WORLDS.map((w, wi) => {
      const [ax, ay] = A[wi], [bx, by] = A[wi + 1];
      const n = w.levels.length + 1;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len;
      return Array.from({ length: n }, (_, i) => {
        const t = 0.05 + (i / (n - 1)) * 0.8;
        const wig = Math.sin(i * 1.9) * 64;
        return { x: Math.round(ax + dx * t + px * wig), y: Math.round(ay + dy * t + py * wig) };
      });
    });
    return this._mapNodes;
  },

  mapFrontier() {
    for (let w = 0; w < WORLDS.length; w++) {
      for (let s = 0; s <= WORLDS[w].levels.length; s++) {
        if (SAVE.stageUnlocked(w, s) && SAVE.stageStars(w, s) === 0) return { w, s };
      }
    }
    return { w: HALL_W, s: WORLDS[HALL_W].levels.length };
  },

  renderMap() {
    const map = this.$("region-map");
    const nodes = this.mapNodes();

    // winding dashed route through every stage
    const pts = nodes.flat();
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;

    // painted island terrain + per-region color tints
    let html = this.terrainSvg();
    const blobs = WORLDS.map((w, i) => {
      const [ax, ay] = this.mapAnchors[i], [bx, by] = this.mapAnchors[i + 1];
      return `radial-gradient(740px 580px at ${Math.round((ax + bx) / 2)}px ${Math.round((ay + by) / 2)}px, ${w.gradient[1]}33, transparent 72%)`;
    }).join(",");
    html += `<div class="region-tints" style="background-image:${blobs}"></div>`;

    html += `<svg id="route-svg" width="${this.MAP_W}" height="${this.MAP_H}" viewBox="0 0 ${this.MAP_W} ${this.MAP_H}"><path d="${d}"/></svg>`;

    html += [0, 1, 2, 3].map(i =>
      `<span class="map-cloud" style="top:${110 + i * 340}px;animation-duration:${70 + i * 24}s;animation-delay:-${i * 19}s">☁️</span>`).join("");

    // little lives: birds, butterflies, fireflies, volcano smoke, water sparkle
    html += `<span class="map-bird" style="top:380px;animation-duration:34s">🐦</span>
      <span class="map-bird" style="top:760px;animation-duration:46s;animation-delay:-18s">🕊️</span>
      <span class="map-butterfly" style="left:300px;top:1150px">🦋</span>
      <span class="map-butterfly" style="left:460px;top:1060px;animation-delay:-1.2s">🦋</span>
      <span class="map-smoke" style="left:1895px;top:240px">💨</span>
      <span class="map-smoke" style="left:1925px;top:255px;animation-delay:-2.2s">💨</span>
      <span class="map-sparkle" style="left:880px;top:1300px">✨</span>
      <span class="map-sparkle" style="left:1010px;top:1330px;animation-delay:-1s">✨</span>
      <span class="map-sparkle" style="left:2225px;top:1185px;animation-delay:-.6s">✨</span>` +
      [[2080, 900], [2190, 1010], [2300, 880], [2150, 1120], [2380, 990], [2260, 940]].map(([x, y], i) =>
        `<i class="firefly" style="left:${x}px;top:${y}px;animation-delay:-${i * .45}s"></i>`).join("");

    // daily wild encounters: rustling grass + fishing spots
    const wild = SAVE.wildToday();
    const patches = this.grassSpotsToday().filter(s => !wild.grassUsed.includes(s.id));
    html += patches.map(s =>
      `<button class="map-grass" data-spot="${s.id}" data-w="${s.w}" style="left:${s.x}px;top:${s.y}px" title="Something is rustling in the grass!"><span class="g-rustle">${worldSprite("grasstuft", 40)}</span></button>`).join("");
    const castsLeft = Math.max(0, this.CASTS_PER_DAY - wild.casts);
    this.FISH_SPOTS.filter(f => SAVE.worldUnlocked(f.need)).forEach(f => {
      html += `<button class="map-fish ${castsLeft ? "" : "spent"}" style="left:${f.x}px;top:${f.y}px" title="${castsLeft ? "Fishing spot — cast a line!" : "No more bites today"}"><span class="f-rod">🎣</span></button>`;
    });
    const chip = this.$("wild-chip");
    if (chip) chip.textContent = `🌿 ${patches.length} · 🎣 ${castsLeft}`;
    // one-time discovery hint the first time grass appears
    this._hintedThisRender = false;
    if (patches.length && SAVE.state && SAVE.state.flags && !SAVE.state.flags.grassHint) {
      SAVE.state.flags.grassHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🌿 See the rustling grass? A wild Pokemon hides there — click it!", "gold");
    }
    html += this.MAP_DECOR.concat(this.scatterDecor()).map(o =>
      `<span class="map-decor" style="left:${o.x}px;top:${o.y}px;${o.e ? `font-size:${o.s}px` : ""}">${o.art ? artSprite(o.art, o.s) : o.t ? worldTile(o.t, o.sc) : o.sp ? worldSprite(o.sp, o.s, o.c) : o.e}</span>`).join("");
    html += this.MAP_CITIES.map(c =>
      `<div class="map-city" style="left:${c.x}px;top:${c.y}px"><span class="city-art">${c.t ? worldTile(c.t, c.sc) : worldSprite(c.sp, c.s)}</span><b>${c.n}</b></div>`).join("");

    // Trainer School: practice with no countdown, any time
    html += `<button class="map-school" style="left:430px;top:1330px" title="Trainer School — no countdown, race your records!">
      <span>${worldSprite("school", 90)}</span><b>Trainer School</b></button>`;

    // Puzzle Lab: now a flight perch — tap it to fly off to the Circuit &
    // Counting isles. Opens once Mt. Moon is reached (worldUnlocked(1)), so a
    // brand-new trainer never sees it.
    if (SAVE.worldUnlocked(1)) {
      html += `<button class="map-lab" style="left:238px;top:1392px" title="Flight perch — fly to the puzzle isles!">
        <span>${worldSprite("lab", 84)}</span><b>🧩 Puzzle Isles</b></button>`;
    }

    // Professor's Daily Drill podium beside the school
    const daily = SAVE.dailyInfo();
    html += `<button class="map-podium ${daily.done ? "done" : ""}"
      style="left:585px;top:1372px" title="${daily.done ? "Daily Drill done — back tomorrow!" : "Professor's Daily Drill — one special run a day!"}">
      <span class="${daily.done ? "" : "podium-glow"}">${daily.done ? "✅" : "📋"}</span><b>Daily Drill</b></button>`;

    // Family Trading Post: a market stall on the south shore where two family
    // trainers swap Pokemon 1-for-1
    html += `<button class="map-trade" style="left:770px;top:1418px" title="Trading Post — swap Pokemon with your family!">
      <span>${worldSprite("trade", 84)}</span><b>🤝 Trading Post</b></button>`;

    WORLDS.forEach((w, wi) => {
      const ns = nodes[wi];
      const unlocked = SAVE.worldUnlocked(wi);
      const maxStars = (w.levels.length + 1) * 3;
      const mid = ns[Math.floor(ns.length / 2)];
      const medal = SAVE.worldMedal(wi);
      html += `<div class="region-label" data-rw="${wi}" role="button"
        title="Who lives in ${this.esc(w.name)}?" style="left:${mid.x}px;top:${mid.y - 138}px">
        <b>${w.emoji} ${w.name}</b><span>★ ${SAVE.worldStars(wi)}/${maxStars}${medal ? ` ${MEDAL_E[medal]}` : ""}</span></div>`;

      // wild Pokemon living on the map: color when caught, silhouette when not
      [[0, 0, -90, -20], [2, 2, 95, 14], [4, 4, -105, 0], [6, 6, 100, 22], [7, 7, -100, 0]].forEach(([ci, ni, ox, oy]) => {
        const c = CREATURES[wi][ci];
        const got = SAVE.state && SAVE.state.dex[`${wi}-${ci}`];
        const p = ns[ni];
        html += `<button class="map-poke ${got ? "" : "unknown"}" data-pw="${wi}" data-pi="${ci}"
          title="${got ? this.esc(c.n) : "??? — who could it be?"}"
          style="left:${p.x + ox}px;top:${p.y + oy}px">${this.pokeHtml(c.id, c.e, { shiny: got && got.shiny, cls: "poke-img map-poke-img" })}</button>`;
      });

      ns.forEach((p, s) => {
        const isBoss = s === w.levels.length;
        const st = SAVE.stageStars(wi, s);
        const open = SAVE.stageUnlocked(wi, s);
        const next = open && st === 0;
        // a beaten boss also shows its best Gym Rematch medal, if any
        const rmBest = (SAVE.state && SAVE.state.rematch && SAVE.state.rematch[wi]) || 0;
        const rmGlyph = rmBest === 2 ? "🥇" : rmBest === 1 ? "🥈" : "";
        const starsHtml = isBoss
          ? (st > 0 ? `<span class="mini-stars">🏆${rmGlyph}</span>` : "")
          : `<span class="mini-stars">${"★".repeat(st)}<span class="off">${"★".repeat(Math.max(0, 3 - st))}</span></span>`;
        html += `<button class="mnode ${isBoss ? "boss" : ""} ${open ? "" : "locked"} ${next ? "next" : ""} ${st > 0 ? "done" : ""} ${SAVE.medalStageOk(wi, s, 3) ? "gilded" : ""}"
          style="left:${p.x}px;top:${p.y}px" data-w="${wi}" data-s="${s}"
          title="${open ? (isBoss ? `BOSS: ${this.esc(w.boss.name)}` : this.esc(w.levels[s].name)) : "Locked"}">
          ${isBoss ? this.pokeHtml(w.boss.id, w.boss.emoji, { cls: "poke-img stage-img" }) : `<span>${s + 1}</span>`}${starsHtml}
        </button>`;
      });

      if (!unlocked) {
        const xs = ns.map(p => p.x), ys = ns.map(p => p.y);
        const x0 = Math.min(...xs) - 140, y0 = Math.min(...ys) - 160;
        const fw = Math.max(...xs) - x0 + 140, fh = Math.max(...ys) - y0 + 160;
        html += `<div class="map-fog" style="left:${x0}px;top:${y0}px;width:${fw}px;height:${fh}px">
          <span>🔒 Defeat ${this.esc(WORLDS[wi - 1].boss.name)} ${WORLDS[wi - 1].boss.emoji}</span></div>`;
      }
    });

    // the player stands at their next challenge (carrying any egg)
    const f = this.mapFrontier();
    const fp = nodes[f.w][f.s];
    const egg = SAVE.state && SAVE.state.egg;
    html += `<div class="map-marker" style="left:${fp.x}px;top:${fp.y - 30}px">
      <span class="mk-bob">${this.avatarHtml(SAVE.state && SAVE.state.profile)}${egg ? `<span class="marker-egg">🥚</span>` : ""}</span><i>▼</i></div>`;

    // a Professor's Letter waits when a new feature has unlocked
    const intro = this.pendingIntro();
    if (intro) {
      html += `<button class="map-parcel" title="${this.esc(intro.title)}"
        style="left:${fp.x + 84}px;top:${fp.y + 30}px"><span class="parcel-bob">📬</span></button>`;
      this._hintedThisRender = true; // the letter is today's one teaching moment
    }

    const dayChip = this.$("day-chip");
    const stamps = SAVE.dayStamps();
    const dayDone = stamps.filter(x => x.done).length;
    dayChip.textContent = `📜 ${dayDone}/3`;
    dayChip.classList.toggle("ready", dayDone === 3);

    const eggChip = this.$("egg-chip");
    eggChip.classList.toggle("hidden", !egg);
    if (egg) {
      const ready = egg.progress >= 3;
      eggChip.textContent = ready ? "🐣 Hatch the egg!" : `🥚 ${egg.progress}/3`;
      eggChip.classList.toggle("ready", ready);
      eggChip.title = ready ? "Click to hatch your Mystery Egg!" : "Finish levels to warm the egg";
    }

    // the weekly roaming legendary
    const roamer = SAVE.roamerNow();
    if (roamer) {
      const spots = [[760, 295], [2185, 855], [1320, 760], [2615, 300]];
      const [rx, ry] = spots[roamer.spot];
      html += `<button class="map-roamer" style="left:${rx}px;top:${ry}px" title="A legendary presence... one chance this week!">
        <span class="roamer-aura"></span>${this.pokeHtml(roamer.id, roamer.e, { cls: "poke-img roamer-img" })}<span class="roamer-mark">🌟</span>
      </button>`;
    }

    // the Weekly Raid Boss den — a shared legendary the whole family chips at
    const raid = SAVE.raidNow();
    if (raid) {
      const hpFrac = raid.maxHp ? Math.max(0, raid.hp) / raid.maxHp : 0;
      const myContrib = (SAVE.root.active && raid.contrib[SAVE.root.active]) || 0;
      const claimedByMe = SAVE.raidClaimedByMe();
      let state, label;
      if (!raid.defeated) { state = "alive"; label = `⚔️ Raid: ${this.esc(raid.n)}`; }
      else if (myContrib > 0 && !claimedByMe) { state = "claim"; label = "🎁 Claim your prize!"; }
      else { state = "resting"; label = "😴 Resting till next week"; }
      html += `<button class="map-raid ${state}" style="left:1520px;top:990px"
        title="Weekly Raid Boss — the whole family fights together!">
        <span class="raid-aura"></span>${this.pokeHtml(raid.id, raid.e, { cls: "poke-img raid-img" })}
        <span class="raid-mark">${raid.defeated ? (state === "claim" ? "🎁" : "😴") : "⚔️"}</span>
        <div class="raid-hpbar"><div class="raid-hpfill" style="width:${hpFrac * 100}%"></div></div>
        <b>${label}</b></button>`;
    }

    map.innerHTML = html;
    this.renderPartyBar();
    this._mapSel = null; // keyboard nav selection resets with the map
    this.mapHints();

    this.centerMapOn(fp.x, fp.y);
  },

  // one gentle discovery hint per map visit, spread across sessions
  mapHints() {
    if (this._hintedThisRender || !SAVE.state || !SAVE.state.flags) return;
    const f = SAVE.state.flags;
    if (!f.grassHint) return; // the grass intro always goes first
    if (!f.schoolHint) {
      f.schoolHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🏫 The Trainer School near Pallet Town has NO countdown — race your own records!");
      return;
    }
    if (SAVE.state.egg && !f.eggHint) {
      f.eggHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🥚 You carry a Mystery Egg! Finish levels to warm it, then hatch it from the chip up top.");
      return;
    }
    if (!f.areaHint) {
      f.areaHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🗺️ Click an area's name sign to see every Pokemon that lives there — and how to catch them!");
    }
  },

  // ---------- area spawn guide (who lives here + how to catch them) ----------
  whereLine(w, i) {
    const chips = spawnSources(w, i).map(s =>
      `<span title="${this.esc(s.title)}">${s.icon}</span>`).join("");
    return chips ? `<div class="dex-where" title="Where to find it">${chips}</div>` : "";
  },

  openAreaPanel(w, hiKey) {
    const panel = this.$("area-panel");
    const rows = CREATURES[w].map((c, i) => {
      const key = `${w}-${i}`;
      const got = SAVE.state.dex[key];
      const chips = spawnSources(w, i).map(s =>
        `<span class="src-chip" title="${this.esc(s.title)}">${s.icon} ${this.esc(s.label)}</span>`).join("");
      return `<div class="area-row ${key === hiKey ? "hi" : ""}">
        <span class="area-sprite ${got ? "" : "silh"}">${this.pokeHtml(c.id, c.e, { shiny: got && got.shiny })}</span>
        <div class="area-info">
          <b>${got ? `${got.shiny ? "✨ " : ""}${this.esc(c.n)}` : "???"}</b>
          <div class="area-srcs">${chips}</div>
        </div>
        ${got ? `<span class="area-got">✔ caught</span>` : `<span class="area-miss">not yet!</span>`}
      </div>`;
    }).join("");
    const caught = CREATURES[w].filter((c, i) => SAVE.state.dex[`${w}-${i}`]).length;
    panel.innerHTML = `<div class="area-card">
      <button id="area-close" aria-label="Close">✕</button>
      <h3>${WORLDS[w].emoji} ${this.esc(WORLDS[w].name)}</h3>
      <p class="area-sub">Pokemon living here · ${caught}/${CREATURES[w].length} caught</p>
      <div class="area-list">${rows}</div>
    </div>`;
    panel.classList.remove("hidden");
    if (hiKey) {
      // offsetTop math instead of scrollIntoView: the card's pop-in
      // animation is mid-scale right now and would skew the measurement
      const list = panel.querySelector(".area-list");
      const el = panel.querySelector(".area-row.hi");
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    }
  },

  closeAreaPanel() {
    this.$("area-panel").classList.add("hidden");
  },

  // ---------- the flying isles: perch card + bird flight ----------
  // Tapping the Puzzle Lab building (the flight perch) opens a destination card;
  // picking an isle plays a short bird sweep, then lands on the isle scene.
  // Reduced-motion players skip the sweep entirely. The overlay is always
  // skippable by tap, with a safety timeout so input can never be trapped.

  // per-isle progress: total stars earned and Pokemon caught there
  perchProgress(pack) {
    const stages = PUZZLE_STAGES.filter(s => s.pack === pack);
    const puz = (SAVE.state && SAVE.state.puzzle) || {};
    const dex = (SAVE.state && SAVE.state.dex) || {};
    const stars = stages.reduce((n, s) => n + (((puz[s.id] || {}).stars) || 0), 0);
    const catchStages = stages.filter(s => s.reward && s.reward.catch);
    const caught = catchStages.filter(s => dex[s.reward.catch]).length;
    return { stars, maxStars: stages.length * 3, caught, catchTotal: catchStages.length };
  },

  openPerchCard() {
    const panel = this.$("perch-panel");
    const dest = (pack, e, name, blurb) => {
      const p = this.perchProgress(pack);
      return `<button class="perch-dest ${pack}" data-fly="${pack}">
        <span class="pd-e">${e}</span>
        <span class="pd-info"><b>${name}</b><i>${blurb}</i>
          <span class="pd-prog">⭐ ${p.stars}/${p.maxStars}${p.catchTotal ? ` · 🐾 ${p.caught}/${p.catchTotal}` : ""}</span></span>
        <span class="pd-go">Fly ✈️</span></button>`;
    };
    panel.innerHTML = `<div class="perch-card">
      <button id="perch-close" aria-label="Close">✕</button>
      <h3>🕊️ Where to, trainer?</h3>
      <p class="perch-sub">Hop on and pick an isle to fly to!</p>
      <div class="perch-dests">
        ${dest("code", "💻", "Circuit Isle", "Walk, loop &amp; decide with code blocks")}
        ${dest("math", "🔢", "Counting Isle", "Counting, times-tables &amp; number hops")}
      </div>
    </div>`;
    panel.classList.remove("hidden");
  },

  closePerchCard() {
    this.$("perch-panel").classList.add("hidden");
  },

  // the rider: the trainer avatar sitting on the chunky bird
  flyRiderHtml() {
    const t = SAVE.state && SAVE.state.profile;
    return `<div class="fly-rider">
      ${birdSvg(150)}
      <span class="fly-trainer">${this.avatarHtml(t)}</span>
    </div>`;
  },

  // fly OUT to an isle: sweep up-and-across, then show the isle scene
  flyToIsle(pack) {
    Puzzle.currentPack = pack;
    this.closePerchCard();
    if (this._reducedMotion) { this.show("lab"); return; }
    this._runFlight("out", () => this.show("lab"));
  },

  // fly HOME: sweep back down, then the map centred on the perch
  flyHome() {
    const done = () => {
      this.show("map");
      this.centerMapOn(238, 1392);
    };
    if (this._reducedMotion) { done(); return; }
    this._runFlight("home", done);
  },

  // shared flight animation. `dir` is "out" or "home". Always resolves once:
  // on animationend, on a skip tap, or on a safety timeout — whichever is first.
  _runFlight(dir, then) {
    const ov = this.$("fly-overlay");
    if (this._flyTimer) { clearTimeout(this._flyTimer); this._flyTimer = null; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (this._flyTimer) { clearTimeout(this._flyTimer); this._flyTimer = null; }
      ov.classList.add("hidden");
      ov.innerHTML = "";
      ov.onclick = null;
      then();
    };
    ov.className = `fly-${dir}`; // removes "hidden", sets the sweep direction
    ov.innerHTML = `${this.flyRiderHtml()}<div class="fly-say">🕊️ Hold on tight!</div>`;
    ov.onclick = finish; // tap to skip
    const rider = ov.querySelector(".fly-rider");
    if (rider) rider.addEventListener("animationend", finish, { once: true });
    SFX.combo();
    this._flyTimer = setTimeout(finish, 1400); // safety: never trap input
  },

  // ---------- Family Trading Post ----------
  // Two family trainers swap one Pokemon each on a single shared device. The
  // whole trade is rebuilt from live save data on open, so deleting a profile
  // elsewhere can never corrupt a half-built swap. Nothing is written until the
  // both-agree confirm; cancelling is always free.
  openTradePost() {
    if (!Object.keys(SAVE.state.dex).length) {
      this.toast("🤝 Catch a Pokemon first — then you'll have something to trade!");
      return;
    }
    const partners = SAVE.tradePartners();
    if (!partners.length) {
      this.toast("🤝 Ask a family member to make a trainer and catch a Pokemon — then you can trade together!");
      return;
    }
    this._trade = { partnerPid: null, mine: null, theirs: null, stage: "partner" };
    this.renderTrade();
  },

  closeTradePanel() {
    this._trade = null;
    this.$("trade-panel").classList.add("hidden");
  },

  // one owned Pokemon as a selectable tile in an offer column
  tradeMonTile(c, side, sel) {
    return `<button class="trade-mon ${sel ? "sel" : ""}" data-side="${side}" data-key="${c.key}"
      title="${this.esc(c.n)}">
      <span class="tm-sprite">${this.pokeHtml(c.id, c.e, { shiny: c.shiny })}</span>
      <span class="tm-name">${c.shiny ? "✨" : ""}${this.esc(c.n)}</span></button>`;
  },

  renderTrade() {
    const panel = this.$("trade-panel");
    const T = this._trade;
    if (!T) { panel.classList.add("hidden"); return; }
    panel.classList.remove("hidden");
    const close = `<button id="trade-close" aria-label="Close">✕</button>`;

    // --- stage 1: pick a family trainer to trade with (rebuilt every open) ---
    if (T.stage === "partner") {
      const partners = SAVE.tradePartners();
      if (!partners.length) { this.closeTradePanel(); return; }
      const cards = partners.map(p => `<button class="trade-partner" data-pid="${p.pid}">
        <span class="tp-av">${this.avatarHtml({ avatar: p.avatar, trainer: p.trainer })}</span>
        <span class="tp-info"><b>${this.esc(p.name)}</b><i>🐾 ${p.count}</i></span></button>`).join("");
      panel.innerHTML = `<div class="trade-card">${close}
        <h3>🤝 Trading Post</h3>
        <p class="trade-sub">Pick a family trainer to trade with:</p>
        <div class="trade-partners">${cards}</div></div>`;
      return;
    }

    const partner = SAVE.root.players[T.partnerPid];
    // a partner deleted mid-trade drops us safely back to the picker
    if (!partner) { T.stage = "partner"; T.partnerPid = T.mine = T.theirs = null; this.renderTrade(); return; }
    const myName = SAVE.state.profile.name;

    // --- stage 3: the both-agree ritual ---
    if (T.stage === "confirm") {
      const mine = SAVE.creatureByKey(T.mine);
      const theirs = (() => { const [w, i] = T.theirs.split("-").map(Number); const c = CREATURES[w][i];
        return { ...c, w, i, key: T.theirs, shiny: !!partner.dex[T.theirs].shiny }; })();
      panel.innerHTML = `<div class="trade-card">${close}
        <div class="trade-ritual">
          <div class="tr-face"><span class="tr-av">${this.avatarHtml(SAVE.state.profile)}</span><b>${this.esc(myName)}</b></div>
          <span class="tr-hands">🤝</span>
          <div class="tr-face"><span class="tr-av">${this.avatarHtml(partner.profile)}</span><b>${this.esc(partner.profile.name)}</b></div>
        </div>
        <p class="trade-ask">Do you <b>BOTH</b> agree to trade<br>
          <span class="tr-mon">${this.pokeHtml(mine.id, mine.e, { shiny: mine.shiny })} ${mine.shiny ? "✨" : ""}${this.esc(mine.n)}</span>
          for
          <span class="tr-mon">${this.pokeHtml(theirs.id, theirs.e, { shiny: theirs.shiny })} ${theirs.shiny ? "✨" : ""}${this.esc(theirs.n)}</span>?</p>
        <button id="trade-go" class="big-btn trade-go">✅ Yes — trade!</button>
        <button id="trade-cancel" class="link-btn">not yet — go back</button></div>`;
      return;
    }

    // --- stage 4: the celebration after a completed swap ---
    if (T.stage === "done") {
      const got = T.gotCreature, gave = T.gaveCreature;
      panel.innerHTML = `<div class="trade-card trade-done-card">${close}
        <div class="trade-balls"><span class="trade-ball tb-l">${this.ballHtml()}</span><span class="trade-ball tb-r">${this.ballHtml()}</span></div>
        <h3>🤝 Trade complete!</h3>
        <div class="trade-done">
          <div class="td-mon"><span>${this.pokeHtml(got.id, got.e, { shiny: got.shiny })}</span>
            <b>${got.shiny ? "✨" : ""}${this.esc(got.n)}</b><i>joined your team!</i></div>
        </div>
        <p class="trade-sub">You sent ${this.esc(gave.n)} to ${this.esc(partner.profile.name)}. Best friends! 🤝</p>
        <button id="trade-done-ok" class="big-btn">🎉 Yay!</button></div>`;
      return;
    }

    // --- stage 2: each side picks exactly one Pokemon to offer ---
    const myList = SAVE.dexList(SAVE.root.active);
    const theirList = SAVE.dexList(T.partnerPid);
    const col = (title, list, side, selKey) => `<div class="trade-col">
      <h4>${this.esc(title)}</h4>
      <div class="trade-grid">${list.map(c => this.tradeMonTile(c, side, c.key === selKey)).join("")}</div></div>`;
    const ready = T.mine && T.theirs;
    const chosen = (key, list) => { const c = list.find(x => x.key === key); return c
      ? `${this.pokeHtml(c.id, c.e, { shiny: c.shiny })} ${c.shiny ? "✨" : ""}${this.esc(c.n)}` : "<i>pick one</i>"; };
    panel.innerHTML = `<div class="trade-card trade-offer-card">${close}
      <h3>🤝 ${this.esc(myName)} &amp; ${this.esc(partner.profile.name)}</h3>
      <p class="trade-sub">Each trainer picks ONE Pokemon to offer.</p>
      <div class="trade-cols">
        ${col("Your offer", myList, "mine", T.mine)}
        ${col(`${partner.profile.name}'s offer`, theirList, "theirs", T.theirs)}
      </div>
      <div class="trade-summary">
        <span class="ts-side">${chosen(T.mine, myList)}</span>
        <span class="ts-swap">🔁</span>
        <span class="ts-side">${chosen(T.theirs, theirList)}</span>
      </div>
      <div class="trade-actions">
        <button id="trade-back" class="link-btn">← partners</button>
        <button id="trade-next" class="big-btn ${ready ? "" : "disabled"}" ${ready ? "" : "disabled"}>Trade ▶</button>
      </div></div>`;
  },

  // run the confirmed swap, then celebrate
  doTrade() {
    const T = this._trade;
    if (!T || !T.partnerPid || !T.mine || !T.theirs) return;
    const partner = SAVE.root.players[T.partnerPid];
    if (!partner) { T.stage = "partner"; this.renderTrade(); return; }
    // capture display info BEFORE the swap moves the shiny flags around
    const gave = SAVE.creatureByKey(T.mine);
    const [tw, ti] = T.theirs.split("-").map(Number);
    const got = { ...CREATURES[tw][ti], id: CREATURES[tw][ti].id, key: T.theirs, shiny: !!partner.dex[T.theirs].shiny };
    const res = SAVE.executeTrade(T.partnerPid, T.mine, T.theirs);
    if (!res.ok) { this.toast("🤝 That trade could not be completed — nothing changed."); this.closeTradePanel(); return; }
    T.stage = "done";
    T.gotCreature = got;
    T.gaveCreature = gave;
    this.renderTrade();
    SFX.catchJingle();
    this.confetti();
    this.toast(`🤝 You traded <b>${this.esc(gave.n)}</b> and got <b>${got.shiny ? "✨" : ""}${this.esc(got.n)}</b>!`, "gold");
    (res.myTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 700 + i * 800));
    // refresh everything the trade touched so it's fresh when the panel closes
    this.renderPartyBar();
    if (this.current === "map") this.renderMap();
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

  // ---------- keyboard map navigation (arrows walk the route, Enter starts) ----------
  mapKeyNav(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // while the area guide is open, Escape closes it and arrows stay put
    if (!this.$("area-panel").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closeAreaPanel(); }
      return;
    }
    // the Trading Post overlay owns keys while it's open
    if (!this.$("trade-panel").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closeTradePanel(); }
      return;
    }
    // the flight-perch destination card owns keys while it's open
    if (!this.$("perch-panel").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closePerchCard(); }
      return;
    }
    if (!this.$("day-card").classList.contains("hidden")) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        this.$("day-card").classList.add("hidden");
      }
      return;
    }
    const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Enter"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const flat = [];
    WORLDS.forEach((w, wi) => { for (let s = 0; s <= w.levels.length; s++) flat.push({ w: wi, s }); });
    if (this._mapSel === null || this._mapSel === undefined) {
      const f = this.mapFrontier();
      this._mapSel = flat.findIndex(n => n.w === f.w && n.s === f.s);
      if (this._mapSel < 0) this._mapSel = 0;
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      this._mapSel = Math.min(flat.length - 1, this._mapSel + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      this._mapSel = Math.max(0, this._mapSel - 1);
    }
    const n = flat[this._mapSel];
    const node = document.querySelector(`.mnode[data-w="${n.w}"][data-s="${n.s}"]`);
    if (!node) return;
    if (e.key === "Enter") { node.click(); return; }
    document.querySelectorAll(".mnode.kbsel").forEach(x => x.classList.remove("kbsel"));
    node.classList.add("kbsel");
    SFX.click();
    const p = this.mapNodes()[n.w][n.s];
    this.centerMapOn(p.x, p.y);
  },

  centerMapOn(x, y, tries = 0) {
    const vp = this.$("region-viewport").getBoundingClientRect();
    if (!vp.width || !vp.height) {
      // not laid out yet — retry a few frames, then wait for a resize
      if (tries < 10) requestAnimationFrame(() => this.centerMapOn(x, y, tries + 1));
      else this._pendingCenter = { x, y };
      return;
    }
    this._pendingCenter = null;
    // 0.446 calibrated for the orthographic tilt (screen-y slope = cos(tilt))
    this.setMapPos(vp.width / 2 - x, vp.height * 0.446 - y);
  },

  setMapPos(x, y) {
    const vp = this.$("region-viewport").getBoundingClientRect();
    const slack = 560; // the tilted plane shows past its edges; allow over-pan
    this.mapX = Math.min(slack, Math.max(vp.width - this.MAP_W - slack, x));
    this.mapY = Math.min(slack, Math.max(vp.height - this.MAP_H - slack, y));
    this.$("region-map").style.transform = `translate(${this.mapX}px, ${this.mapY}px)`;
  },

  bindMapPan() {
    const vp = this.$("region-viewport");
    let drag = null;
    vp.addEventListener("pointerdown", e => {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: this.mapX, oy: this.mapY, moved: false };
    });
    vp.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 7) {
        drag.moved = true;
        vp.classList.add("dragging");
        // capture only once a real drag starts — capturing on pointerdown
        // would steal the click from the stage buttons
        try { vp.setPointerCapture(drag.id); } catch (_) { /* ok */ }
      }
      // vertical screen distance is foreshortened on the tilted plane
      if (drag.moved) this.setMapPos(drag.ox + dx, drag.oy + dy / Math.cos(this.TILT));
    });
    const end = () => {
      if (drag && drag.moved) {
        this._mapDragged = true;
        setTimeout(() => { this._mapDragged = false; }, 60);
      }
      drag = null;
      vp.classList.remove("dragging");
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
    vp.addEventListener("wheel", e => {
      e.preventDefault();
      this.setMapPos(this.mapX - e.deltaX, this.mapY - e.deltaY / Math.cos(this.TILT));
    }, { passive: false });
    vp.addEventListener("click", e => {
      if (this._mapDragged) return;
      const b = e.target.closest(".mnode");
      if (b) {
        SFX.init();
        if (!b.classList.contains("locked")) {
          // tap = play, straight away (at the player's challenge setting)
          Engine.startStage(+b.dataset.w, +b.dataset.s);
        } else {
          // locked: never answer a click with silence
          SFX.error();
          b.classList.remove("denied");
          void b.offsetWidth;
          b.classList.add("denied");
          const w = +b.dataset.w, s = +b.dataset.s;
          this.toast(!SAVE.worldUnlocked(w)
            ? `🔒 Defeat ${WORLDS[w - 1].boss.name} ${WORLDS[w - 1].boss.emoji} to enter ${WORLDS[w].name}!`
            : `🔒 Beat ${WORLDS[w].name} level ${s} first!`);
        }
        return;
      }
      const g = e.target.closest(".map-grass");
      if (g) {
        SFX.init();
        Engine.startWildGrass(+g.dataset.w, g.dataset.spot);
        return;
      }
      const f = e.target.closest(".map-fish");
      if (f) {
        SFX.init();
        if (SAVE.wildToday().casts >= this.CASTS_PER_DAY) {
          this.toast("🎣 The Pokemon are not biting anymore — come back tomorrow!");
        } else {
          Engine.startFishing();
        }
        return;
      }
      const ro = e.target.closest(".map-roamer");
      if (ro) {
        SFX.init();
        Engine.startLegendary();
        return;
      }
      const rd = e.target.closest(".map-raid");
      if (rd) {
        SFX.init();
        const raid = SAVE.raidNow();
        if (!raid) return;
        if (!raid.defeated) { Engine.startRaid(); return; } // any trainer can attack
        const myContrib = (SAVE.root.active && raid.contrib[SAVE.root.active]) || 0;
        if (SAVE.raidClaimedByMe()) {
          this.toast("✅ You've claimed this week's raid reward. A fresh boss appears next week!");
        } else if (myContrib > 0) {
          Engine.startRaidClaim();
        } else {
          this.toast("💪 This boss is already down — but only trainers who fought it can claim the prize!");
        }
        return;
      }
      const sc = e.target.closest(".map-school");
      if (sc) {
        SFX.init();
        this.show("practice");
        return;
      }
      const lab = e.target.closest(".map-lab");
      if (lab) {
        SFX.init();
        this.openPerchCard();
        return;
      }
      const pd = e.target.closest(".map-podium");
      if (pd) {
        SFX.init();
        if (SAVE.dailyInfo().done) this.toast("✅ Today's drill is done — the Professor preps a new one overnight!");
        else Engine.startDaily();
        return;
      }
      const tr = e.target.closest(".map-trade");
      if (tr) {
        SFX.init();
        this.openTradePost();
        return;
      }
      // wild Pokemon living on the map: say hi (caught) or open the
      // area guide so the mystery shows how it can be caught
      const pk = e.target.closest(".map-poke");
      if (pk) {
        SFX.init();
        const w = +pk.dataset.pw, i = +pk.dataset.pi;
        const c = CREATURES[w][i];
        const got = SAVE.state.dex[`${w}-${i}`];
        pk.classList.remove("greet");
        void pk.offsetWidth;
        pk.classList.add("greet");
        if (got) {
          SFX.word();
          this.toast(`${got.shiny ? "✨ " : ""}<b>${this.esc(c.n)}</b> says hi! It lives near ${WORLDS[w].emoji} ${WORLDS[w].name}.`);
        } else {
          SFX.combo();
          this.openAreaPanel(w, `${w}-${i}`);
        }
        return;
      }
      // area name signs open the spawn guide for that region
      const rl = e.target.closest(".region-label");
      if (rl) {
        SFX.init();
        SFX.word();
        this.openAreaPanel(+rl.dataset.rw);
        return;
      }
      const pc = e.target.closest(".map-parcel");
      if (pc) {
        SFX.init();
        const f2 = this.pendingIntro();
        if (f2) this.startIntro(f2, false);
      }
    });

    this.$("practice-tiers").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const t = e.target.closest(".tier-card");
      if (!t) return;
      SFX.init();
      if (!t.classList.contains("locked")) {
        const sel = this._raceGhost && this._raceGhost[`practice:${t.dataset.tier}`];
        Engine.startPractice(t.dataset.tier, sel && sel !== "mine" ? sel : null);
      } else {
        SFX.error();
        t.classList.remove("denied");
        void t.offsetWidth;
        t.classList.add("denied");
        const tier = PRACTICE_TIERS.find(x => x.id === t.dataset.tier);
        if (tier) this.toast(`🔒 Reach ${WORLDS[tier.need].emoji} ${WORLDS[tier.need].name} to unlock ${tier.label} practice!`);
      }
    });

    this.$("paragraph-list").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const c = e.target.closest(".para-card");
      if (!c) return;
      SFX.init();
      if (!c.classList.contains("locked")) {
        const sel = this._raceGhost && this._raceGhost[`paragraph:${c.dataset.para}`];
        Engine.startParagraph(c.dataset.para, sel && sel !== "mine" ? sel : null);
      } else {
        SFX.error();
        c.classList.remove("denied");
        void c.offsetWidth;
        c.classList.add("denied");
        this.toast(`🔒 Story Typing unlocks at ${WORLDS[5].emoji} ${WORLDS[5].name} — you'll need your capital letters!`);
      }
    });

    this.$("wordpack-list").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const edit = e.target.closest(".wp-edit");
      if (edit) { this.openWordPackForm(edit.dataset.pack); return; }
      const del = e.target.closest(".wp-del");
      if (del) { this.deleteWordPackFlow(del.dataset.pack); return; }
      if (e.target.closest(".wordpack-new")) { this.openWordPackForm(null); return; }
      const card = e.target.closest(".wordpack-card");
      if (!card) return;
      SFX.init();
      const pack = SAVE.wordPackById(card.dataset.pack);
      const sel = pack && this._raceGhost && this._raceGhost[`pack:${pack.name}`];
      Engine.startPractice(`custom-${card.dataset.pack}`, sel && sel !== "mine" ? sel : null);
    });

    this.$("license-list").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const card = e.target.closest(".license-card");
      if (!card || card.classList.contains("locked")) return;
      SFX.init();
      const sel = this._raceGhost && this._raceGhost[`practice:license-${card.dataset.license}`];
      Engine.startPractice(`license-${card.dataset.license}`, sel && sel !== "mine" ? sel : null);
    });

    this.$("party-bar").addEventListener("click", e => {
      const slot = e.target.closest(".party-slot.filled");
      if (!slot) return;
      SFX.click();
      if (SAVE.makeLead(slot.dataset.key)) {
        const c = SAVE.creatureByKey(slot.dataset.key);
        this.toast(`⭐ ${c.n} is now your lead partner!`);
        this.renderPartyBar();
      }
    });
    this.$("btn-findme").addEventListener("click", e => {
      e.stopPropagation();
      SFX.click();
      const f = this.mapFrontier();
      const p = this.mapNodes()[f.w][f.s];
      this.centerMapOn(p.x, p.y);
    });
    addEventListener("resize", () => {
      if (this._pendingCenter) this.centerMapOn(this._pendingCenter.x, this._pendingCenter.y);
    });

    this.$("wild-chip").addEventListener("click", e => {
      e.stopPropagation();
      SFX.click();
      this.toast("🌿 Rustling grass hides wild Pokemon — click a patch to battle! 🎣 shows fishing casts left today.", "gold");
    });

    this.$("egg-chip").addEventListener("click", e => {
      e.stopPropagation();
      const egg = SAVE.state && SAVE.state.egg;
      if (!egg) return;
      SFX.click();
      if (egg.progress >= 3) Engine.startHatch();
      else this.toast(`🥚 Keep playing! ${3 - egg.progress} more level${egg.progress === 2 ? "" : "s"} and it will hatch.`);
    });
  },

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

  // ---------- dex ----------
  renderDex() {
    const total = CREATURES.flat().length;
    this.$("dex-count").textContent = `${SAVE.caughtCount()} / ${total}`;
    this.$("dex-list").innerHTML = WORLDS.map((w, wi) => {
      const cards = CREATURES[wi].map((c, ci) => {
        const key = `${wi}-${ci}`;
        const got = SAVE.state.dex[key];
        const rar = RARITY[c.r];
        if (!got) {
          // evolution-only Pokemon hint at how to get them
          const fam = c.evoOnly ? EVOLUTIONS.find(f =>
            (f.chain || f.choices || []).includes(key)) : null;
          const hint = fam ? `evolves from ${this.esc(CREATURES[fam.base.split("-")[0]][fam.base.split("-")[1]].n)}` : "???";
          return `<div class="dex-card unknown"><div class="dex-emoji">${this.pokeHtml(c.id, c.e)}</div>
            <div class="dex-name ${fam ? "evo-hint" : ""}">${hint}</div>${fam ? "" : this.whereLine(wi, ci)}</div>`;
        }
        const candy = SAVE.state.candy[key] || 0;
        const fam = SAVE.familyFor(key);
        const targets = SAVE.evoTargetsFor(key);
        const candyHtml = fam
          ? `<div class="dex-candy">🍬 ${candy}/${CANDY_COST}${
              SAVE.state.vouchers > 0 ? ` <button class="btn-voucher" data-vbase="${key}" title="Spend a candy voucher here">🎟+1</button>` : ""
            }</div>` : "";
        const evoBtn = targets.length
          ? `<button class="btn-evolve" data-base="${key}">EVOLVE!</button>` : "";
        const inParty = SAVE.state.party.includes(key);
        const partyBtn = `<button class="btn-party ${inParty ? "on" : ""}" data-pkey="${key}"
          title="${inParty ? "Remove from party" : "Add to party"}">${inParty ? "✔ Party" : "+ Party"}</button>`;
        return `<div class="dex-card ${got.shiny ? "shiny" : ""}" style="--rc:${rar.color}">${partyBtn}
          <div class="dex-emoji">${this.pokeHtml(c.id, c.e, { shiny: got.shiny })}</div>
          <div class="dex-name">${got.shiny ? "✨" : ""}${this.esc(c.n)}</div>
          <div class="dex-rar">${rar.label}</div>${this.whereLine(wi, ci)}${candyHtml}${evoBtn}</div>`;
      }).join("");
      const caught = CREATURES[wi].filter((c, ci) => SAVE.state.dex[`${wi}-${ci}`]).length;
      return `<div class="dex-world"><h3>${w.emoji} ${w.name} <span>${caught}/${CREATURES[wi].length}</span></h3><div class="dex-grid">${cards}</div></div>`;
    }).join("");
  },

  // pick which evolution (only Eevee has a real choice)
  evoChooser(baseKey, targets) {
    const box = this.$("evo-chooser");
    const base = CREATURES[baseKey.split("-")[0]][baseKey.split("-")[1]];
    box.innerHTML = `<div class="pause-box">
      <h2>🧬 Evolve ${this.esc(base.n)} into...</h2>
      <div class="evo-options">${targets.map(k => {
        const [tw, ti] = k.split("-").map(Number);
        const t = CREATURES[tw][ti];
        const owned = SAVE.state.dex[k];
        return `<button class="evo-opt" data-base="${baseKey}" data-target="${k}">
          <span class="evo-opt-img ${owned ? "" : "unknown"}">${this.pokeHtml(t.id, t.e)}</span>
          <b>${this.esc(t.n)}</b>${owned ? `<i>${owned.shiny ? "make it stronger" : "make it ✨ shiny"}</i>` : ""}
        </button>`;
      }).join("")}</div>
      <button id="evo-cancel" class="link-btn">never mind</button>
    </div>`;
    box.classList.remove("hidden");
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

  // ---- My Words: list custom spelling packs as playable tier-cards, each with
  // edit/delete, plus a "New word pack" card that opens the form. ----
  renderWordPacks() {
    const list = this.$("wordpack-list");
    if (!list) return;
    const packs = SAVE.wordPacks();
    let html = packs.map(pk => {
      const pb = SAVE.state.practice["custom-" + pk.id];
      const pbHtml = pb
        ? `⏱ best ${this.fmtTime(pb.time)} · ⚡ best ${pb.wpm} wpm`
        : `no record yet — set one!`;
      const card = `<button class="tier-card wordpack-card" data-pack="${this.esc(pk.id)}">
        <span class="tier-e">📚</span>
        <span class="tier-info">
          <b>${this.esc(pk.name)}</b>
          <i>${pk.words.length} word${pk.words.length === 1 ? "" : "s"}</i>
          <em>${pbHtml}</em>
        </span>
      </button>`;
      const actions = `<div class="wp-actions">
        <button class="wp-edit" data-pack="${this.esc(pk.id)}" title="Edit this pack">✏️ Edit</button>
        <button class="wp-del" data-pack="${this.esc(pk.id)}" title="Delete this pack">🗑️</button>
      </div>`;
      return `<div class="tier-wrap"><div class="wordpack-row">${card}${actions}</div>${this.ghostRaceHtml("pack", pk.name, pb)}</div>`;
    }).join("");

    if (packs.length < WORDPACK_MAX) {
      html += `<button class="tier-card wordpack-new" data-newpack="1">
        <span class="tier-e">➕</span>
        <span class="tier-info"><b>New word pack</b><i>Turn a spelling list into a drill</i></span>
      </button>`;
    } else {
      html += `<p class="wordpack-full">📚 You have all ${WORDPACK_MAX} word packs — delete one to add more.</p>`;
    }
    list.innerHTML = html;
  },

  // open the create/edit form. packId null → create; otherwise prefill for edit.
  openWordPackForm(packId) {
    SFX.click();
    const form = this.$("wordpack-form");
    const pack = packId ? SAVE.wordPackById(packId) : null;
    const name = pack ? pack.name : "";
    const words = pack ? pack.words.join("\n") : "";
    form.dataset.editing = packId || "";
    form.innerHTML = `
      <div class="wp-form-inner">
        <h4>${pack ? "✏️ Edit word pack" : "📚 New word pack"}</h4>
        <label class="wp-field">
          <span>Pack name</span>
          <input id="wp-name" type="text" maxlength="${WORDPACK_NAME_MAXLEN}" placeholder="e.g. Week 12 Spelling" value="${this.esc(name)}">
        </label>
        <label class="wp-field">
          <span>Words — one per line (up to ${WORDPACK_WORDS_MAX})</span>
          <textarea id="wp-words" rows="7" placeholder="friend\nbecause\nlittle\n...">${this.esc(words)}</textarea>
        </label>
        <p class="wp-hint">Letters, spaces, and . , ' ! ? are welcome. Capitals are fine!</p>
        <div id="wp-error" class="wp-error hidden"></div>
        <div class="wp-form-btns">
          <button id="wp-save" class="btn primary">💾 Save pack</button>
          <button id="wp-cancel" class="btn">Cancel</button>
        </div>
      </div>`;
    form.classList.remove("hidden");
    this.$("wp-save").addEventListener("click", () => this.saveWordPackForm());
    this.$("wp-cancel").addEventListener("click", () => this.closeWordPackForm());
    const nameEl = this.$("wp-name");
    nameEl.focus();
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  closeWordPackForm() {
    SFX.click();
    const form = this.$("wordpack-form");
    form.classList.add("hidden");
    form.innerHTML = "";
    form.dataset.editing = "";
  },

  saveWordPackForm() {
    const form = this.$("wordpack-form");
    const editing = form.dataset.editing || null;
    const name = this.$("wp-name").value;
    const words = this.$("wp-words").value;
    const res = SAVE.saveWordPack(editing, name, words);
    if (!res.ok) {
      SFX.error();
      const err = this.$("wp-error");
      err.textContent = res.error;
      err.classList.remove("hidden");
      return;
    }
    SFX.correct();
    this.closeWordPackForm();
    this.renderWordPacks();
    this.toast(editing ? `📚 Updated “${res.pack.name}”!` : `📚 New pack “${res.pack.name}” ready — go practice!`, "gold");
  },

  deleteWordPackFlow(packId) {
    const pack = SAVE.wordPackById(packId);
    if (!pack) return;
    if (!confirm(`Delete “${pack.name}”? Its best times go too, but any XP and trophies you earned stay yours. 💛`)) return;
    SAVE.deleteWordPack(packId);
    SFX.click();
    this.closeWordPackForm();
    this.renderWordPacks();
    this.toast(`📚 “${pack.name}” removed.`);
  },

  // ---- Typing License: post-Champion number-row exam. Shows a locked teaser
  // until you're Champion; then four stamp-collectible tiers that unlock in
  // order. License records live under practice["license-"+id] and share ghosts
  // across profiles via the "practice" kind (ids match, unlike word packs). ----
  renderLicense() {
    const list = this.$("license-list");
    if (!list) return;
    if (!SAVE.state.trophies.champion) {
      list.innerHTML = `<div class="license-teaser">🔒 Become the 👑 Champion first — then your Typing License opens!</div>`;
      return;
    }
    list.innerHTML = LICENSE_TIERS.map((t, i) => {
      const key = "license-" + t.id;
      const pb = SAVE.state.practice[key];
      const open = SAVE.licenseTierOpen(i);
      const stamped = !!(pb && pb.stamp);
      const pbHtml = pb
        ? `⏱ best ${this.fmtTime(pb.time)} · ⚡ best ${pb.wpm} wpm`
        : (open ? `no stamp yet — earn 90%!` : `🔒 finish the last tier to unlock`);
      const card = `<button class="tier-card license-card ${open ? "" : "locked"} ${stamped ? "stamped" : ""}" data-license="${t.id}" ${open ? "" : "disabled"}>
        <span class="tier-e">${t.e}</span>
        <span class="tier-info">
          <b>${t.label}${stamped ? " <span class=\"license-stamp\">🪪 STAMPED</span>" : ""}</b>
          <i>${this.esc(t.desc)}</i>
          <em>${pbHtml}</em>
        </span>
      </button>`;
      const race = open ? this.ghostRaceHtml("practice", key, pb) : "";
      return `<div class="tier-wrap">${card}${race}</div>`;
    }).join("");
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

  showPracticeResults(res) {
    this.show("results");
    this.renderTopbar();
    this._practiceNext = res.tier.id;
    this._practiceGhostPid = res.ghostPid || null; // rematch the same ghost on Try Again
    this._paragraphNext = null;
    this._rematchNext = null;
    this._raidNext = null;
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

  // ---------- trophies ----------
  _museumTab: "trophies",
  _failCount: {},

  renderTrophies() {
    const got = SAVE.state.trophies;
    const fresh = (SAVE.state.flags && SAVE.state.flags.newTrophies) || {};
    this.$("trophy-count").textContent = `${Object.keys(got).length} / ${TROPHIES.length}`;

    // ---- ledger: every long-term collection at a glance ----
    const dexGot = SAVE.caughtCount(), dexAll = CREATURES.flat().length;
    const shiny = SAVE.shinyCount();
    let medals = 0;
    WORLDS.forEach((w, wi) => { medals += SAVE.worldMedal(wi); });
    const fams = EVOLUTIONS.filter(f => {
      if (!SAVE.state.dex[f.base]) return false;
      const links = f.chain || f.choices;
      return f.choices ? links.some(k => SAVE.state.dex[k]) : links.every(k => SAVE.state.dex[k]);
    }).length;
    const rows = [
      { e: "🏆", label: "Trophies", n: Object.keys(got).length, max: TROPHIES.length },
      { e: "🎖", label: "Medals", n: medals, max: WORLDS.length * 4 },
      { e: "📕", label: "Pokedex", n: dexGot, max: dexAll, link: "dex" },
      { e: "✨", label: "Shinies", n: shiny, max: dexAll },
      { e: "🧬", label: "Families", n: fams, max: EVOLUTIONS.length },
    ];
    this.$("museum-ledger").innerHTML = rows.map(r => {
      const pct = r.n / r.max;
      const segs = 20, fill = Math.round(pct * segs);
      const closing = pct >= 0.9 && r.n < r.max;
      return `<div class="ledger-row">
        <span class="ledger-label">${r.e} ${r.label}</span>
        <span class="ledger-meter">${Array.from({ length: segs }, (_, i) =>
          `<i class="${i < fill ? "on" : ""}"></i>`).join("")}</span>
        <span class="ledger-count ${closing ? "closing" : ""}">${closing
          ? `${r.max - r.n} to find! ${r.link ? `<button class="ledger-link" data-link="${r.link}">show me</button>` : ""}`
          : `${r.n} / ${r.max}`}</span>
      </div>`;
    }).join("");

    // ---- tabs ----
    document.querySelectorAll("#museum-tabs .mtab").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === this._museumTab));
    this.$("trophy-grid").classList.toggle("hidden", this._museumTab !== "trophies");
    this.$("medal-wing").classList.toggle("hidden", this._museumTab !== "medals");
    this.$("gallery-wing").classList.toggle("hidden", this._museumTab !== "gallery");

    // ---- trophies wing ----
    this.$("trophy-grid").innerHTML = TROPHIES.map(t => `
      <div class="trophy-card ${got[t.id] ? "on" : ""}">
        ${fresh[t.id] ? `<span class="new-chip">NEW</span>` : ""}
        <div class="trophy-emoji">${t.e}</div>
        <div class="trophy-name">${t.name}</div>
        <div class="trophy-desc">${t.desc}</div>
      </div>`).join("");
    if (this._museumTab === "trophies" && SAVE.state.flags && Object.keys(fresh).length) {
      SAVE.state.flags.newTrophies = {};
      SAVE.save();
    }

    // ---- medal wing: per region, what the next medal needs ----
    this.$("medal-wing").innerHTML = WORLDS.map((w, wi) => {
      const tier = SAVE.worldMedal(wi);
      const unlocked = SAVE.worldUnlocked(wi);
      let nextLine = "";
      if (!unlocked) nextLine = `<i class="medal-next dim">🔒 Reach this region first</i>`;
      else if (tier >= 4) nextLine = `<i class="medal-next done">Fully mastered. Legendary work!</i>`;
      else {
        const t = MEDAL_TIERS[tier]; // the next tier up
        const p = SAVE.medalProgress(wi, t.tier);
        const req = t.tier === 1 ? "3-star every level"
          : t.tier === 4 ? "clear every level in 🥷 Ninja Mode (95%+ accuracy)"
          : `best ≥ ${Math.round(t.acc * 100)}% accuracy and ≥ ${t.wpm} wpm on every level`;
        nextLine = `<i class="medal-next">${t.e} ${t.name}: <b>${p.ok}/${p.total}</b> levels — ${req}</i>`;
      }
      return `<div class="medal-card ${tier ? "has" : ""}">
        <span class="medal-big">${tier ? MEDAL_E[tier] : "⚪"}</span>
        <div class="medal-info"><b>${w.emoji} ${this.esc(w.name)}</b>${nextLine}</div>
      </div>`;
    }).join("");

    // ---- gallery wing: Hall of Fame photos, then the shiny showcase ----
    const hof = (SAVE.state.hof || []).map(h => `
      <div class="hof-photo">
        <div class="hof-party">${(h.party || []).slice(0, 6).map(k => {
          const c = SAVE.creatureByKey(k);
          return c ? `<span>${this.pokeHtml(c.id, c.e, { shiny: c.shiny, cls: "poke-img hof-img" })}</span>` : "";
        }).join("")}</div>
        <div class="hof-plate">🏆 Hall of Fame — ${this.esc(SAVE.state.profile.name)}, ${h.date} · ${h.wpm} wpm</div>
      </div>`).join("");
    const hofShelf = hof ? `<div class="shelf"><div class="shelf-title">🏛️ Hall of Fame</div>${hof}</div>` : "";
    this.$("gallery-wing").innerHTML = hofShelf + WORLDS.map((w, wi) => {
      const shelf = CREATURES[wi].map((c, ci) => {
        const d = SAVE.state.dex[`${wi}-${ci}`];
        return `<span class="pedestal ${d && d.shiny ? "lit" : ""}" title="${d && d.shiny ? `✨ ${this.esc(c.n)}` : "Still to shine..."}">
          ${d && d.shiny ? this.pokeHtml(c.id, c.e, { shiny: true, cls: "poke-img shelf-img" }) : `<i>?</i>`}
        </span>`;
      }).join("");
      const n = CREATURES[wi].filter((c, ci) => {
        const d = SAVE.state.dex[`${wi}-${ci}`];
        return d && d.shiny;
      }).length;
      return `<div class="shelf"><div class="shelf-title">${w.emoji} ${this.esc(w.name)} <span>✨ ${n}/${CREATURES[wi].length}</span></div>
        <div class="shelf-row">${shelf}</div></div>`;
    }).join("");

    // received Professor's letters, replayable
    const letters = FEATURE_INTROS.filter(f => SAVE.state.flags.intros && SAVE.state.flags.intros[f.id]);
    if (letters.length) {
      this.$("museum-ledger").innerHTML += `<div class="letters-row">📬 Letters:
        ${letters.map(f => `<button class="letter-chip" data-letter="${f.id}">${f.icon} ${this.esc(f.title)}</button>`).join("")}</div>`;
    }
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
      <div class="stat-card"><div class="stat-v">${SAVE.caughtCount()}</div><div class="stat-l">Pokemon</div></div>
      <div class="stat-card"><div class="stat-v">${s.evolutions || 0}</div><div class="stat-l">evolutions</div></div>
      <div class="stat-card"><div class="stat-v">${SAVE.state.streak.count || 0}</div><div class="stat-l">day streak</div></div>`;

    const hist = s.history.slice(-12);
    const max = Math.max(10, ...hist.map(h => h.wpm));
    this.$("stats-chart").innerHTML = hist.length
      ? hist.map(h => `<div class="bar-wrap" title="${h.wpm} wpm · ${Math.round(h.acc * 100)}%">
          <div class="bar" style="height:${Math.max(6, 100 * h.wpm / max)}%"></div><span>${h.wpm}</span></div>`).join("")
      : `<p class="dim">Play some levels to see your speed grow! 📈</p>`;

    // grown-ups corner: recent form + backup nudge
    const ps = this.$("parent-stats");
    if (ps) {
      const recent = s.history.slice(-7);
      const avgW = recent.length ? Math.round(recent.reduce((a, h) => a + h.wpm, 0) / recent.length) : 0;
      const avgA = recent.length ? Math.round(100 * recent.reduce((a, h) => a + h.acc, 0) / recent.length) : 0;
      let totalStars = 0;
      WORLDS.forEach((w, wi) => { totalStars += SAVE.worldStars(wi); });
      const sinceBackup = SAVE.state.xp - ((SAVE.state.flags && SAVE.state.flags.lastBackupXp) || 0);
      ps.innerHTML = recent.length
        ? `Recent form (last ${recent.length === 1 ? "game" : `${recent.length} games`}): <b>${avgW} wpm</b> at <b>${avgA}%</b> accuracy.<br>
           Total stars: <b>${totalStars}</b> · Pokemon: <b>${SAVE.caughtCount()}</b> · Day streak: <b>${SAVE.state.streak.count || 0}</b>.
           ${sinceBackup > 150 ? `<br><span class="backup-nudge">📥 Lots of new progress since the last backup — a download is wise!</span>` : ""}`
        : `No games played yet — the trend will appear here.`;
    }

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

  // ---------- Journal: daily drill, research board, Elite Four ----------
  renderJournal() {
    const d = SAVE.dailyInfo();
    const muts = d.mutators.map(id => DAILY_MUTATORS.find(m => m.id === id)).filter(Boolean);
    const wk = SAVE.state.dailyWeek && SAVE.state.dailyWeek.week === SAVE.weekKey()
      ? SAVE.state.dailyWeek.count : 0;
    this.$("jr-daily").innerHTML = `
      <h3>📋 Daily Drill</h3>
      <div class="jr-muts">${muts.map(m =>
        `<span class="src-chip" title="${this.esc(m.desc)}">${m.e} ${m.name}</span>`).join("")}</div>
      <p class="jr-note">${d.done
        ? "✅ Done today! The Professor preps a fresh drill overnight."
        : "One special run — 12 words under today's rules."}</p>
      <p class="jr-note">This week: <b>${Math.min(5, wk)}/5</b> drills ${wk >= 5
        ? "— bonus egg sent! 🥚" : "<span class=\"dim\">(5 earns a special Mystery Egg)</span>"}</p>
      ${d.done ? "" : `<button id="btn-daily" class="mid-btn">▶ Start today's drill</button>`}
      <p class="jr-note">🎟 Candy vouchers: <b>${SAVE.state.vouchers}</b> — spend them in the Pokedex.</p>`;

    const r = SAVE.researchNow();
    this.$("jr-research").innerHTML = `
      <h3>🔬 Research Tasks <span class="jr-sub">fresh every week</span></h3>
      ${r.tasks.map(t => {
        const p = SAVE.taskProgress(t);
        return `<div class="task-row ${t.claimed ? "claimed" : p.done ? "ready" : ""}">
          <span class="task-e">${p.def.e}</span>
          <div class="task-info"><b>${this.esc(p.def.text)}</b>
            <div class="task-meter"><i style="width:${Math.round(100 * p.now / p.def.need)}%"></i></div></div>
          ${t.claimed ? `<span class="task-done">✔</span>`
            : p.done ? `<button class="task-claim" data-claim="${t.id}">CLAIM</button>`
            : `<span class="task-count">${p.now}/${p.def.need}</span>`}
        </div>`;
      }).join("")}
      <p class="jr-note">📮 Stamps: <b>${SAVE.state.unlocks.stamps}</b> — they unlock trainer outfits in the builder!</p>`;

    const el = SAVE.state.elite || { bestRound: 0, clears: 0 };
    const pts = SAVE.medalPoints();
    const open = Engine.eliteUnlocked();
    const hof = SAVE.state.hof || [];
    this.$("jr-elite").innerHTML = `
      <h3>⚔️ The Elite Four</h3>
      ${open
        ? `<p class="jr-note">${el.clears > 0
            ? `🏆 Champion ×${el.clears}! Your photos hang in the Museum Gallery.`
            : el.bestRound > 0
              ? `Best run so far: <b>Round ${el.bestRound} of ${ELITE.length}</b>. They remember you...`
              : "Four masters back to back — your hearts carry between rounds. Then... someone is waiting."}</p>
           <button id="btn-elite" class="mid-btn">⚔️ ${el.clears ? "Challenge again" : "Begin the challenge"}</button>`
        : `<p class="jr-note">🔒 Opens when the story is complete and you hold
            <b>${ELITE_NEED_MEDALS} medal points</b> (you have <b>${pts}</b> — grow them in the Museum's Medal Case).</p>`}
      ${hof.length ? `<p class="jr-note">📸 Hall of Fame entries: <b>${hof.length}</b></p>` : ""}`;

    // Gym Rematches: refight beaten bosses on a faster clock for medals
    const rms = SAVE.state.rematch || {};
    const beaten = [];
    for (let w = 0; w <= HALL_W; w++) {
      if (SAVE.stageStars(w, WORLDS[w].levels.length) > 0) beaten.push(w);
    }
    this.$("jr-rematch").innerHTML = `
      <h3>🥊 Gym Rematches</h3>
      ${beaten.length ? `
        <p class="jr-note">Refight a boss you've beaten — the clock runs faster! Finish with
          <b>2+ hearts</b> for 🥈 Silver, a <b>flawless 3</b> for 🥇 Gold.</p>
        <div class="rematch-list">${beaten.map(w => {
          const b = WORLDS[w].boss;
          const best = rms[w] || 0;
          const bestHtml = best === 2 ? "🥇 <b>Gold</b>"
            : best === 1 ? "🥈 <b>Silver</b>"
            : `<span class="dim">no medal yet</span>`;
          return `<div class="rematch-row">
            <span class="rematch-boss">${this.pokeHtml(b.id, b.emoji, { cls: "poke-img rematch-img" })}<b>${this.esc(b.name)}</b></span>
            <span class="rematch-best">${bestHtml}</span>
            <span class="rematch-btns">
              <button class="rematch-go ${best >= 1 ? "won" : ""}" data-rw="${w}" data-tier="silver" title="Silver rematch — a faster clock">🥈</button>
              <button class="rematch-go ${best >= 2 ? "won" : ""}" data-rw="${w}" data-tier="gold" title="Gold rematch — much faster!">🥇</button>
            </span>
          </div>`;
        }).join("")}</div>`
        : `<p class="jr-note">🔒 Beat a Gym boss first — then come back to refight them for shiny medals!</p>`}`;

    // Weekly Raid contribution board: who chipped the family boss, for how much
    const raid = SAVE.raidNow();
    if (!raid) {
      this.$("jr-raid").innerHTML = `
        <h3>⚔️ Weekly Raid</h3>
        <p class="jr-note">🔒 Reach the ${WORLDS[3].emoji} ${WORLDS[3].name} to join the weekly family raid!</p>`;
    } else {
      const active = SAVE.root.active;
      const myContrib = (active && raid.contrib[active]) || 0;
      const claimedByMe = SAVE.raidClaimedByMe();
      const rows = Object.keys(raid.contrib)
        .map(pid => ({ pid, dmg: raid.contrib[pid] || 0 }))
        .filter(r => r.dmg > 0)
        .sort((a, b) => b.dmg - a.dmg);
      const topDmg = rows.length ? rows[0].dmg : 0;
      const nameOf = pid => {
        const p = (SAVE.root.players || {})[pid];
        return p && p.profile && p.profile.name ? p.profile.name : "A trainer";
      };
      const board = rows.length
        ? `<div class="raid-board">${rows.map(r => {
            const status = raid.defeated
              ? (raid.claimed[r.pid]
                  ? `<span class="raid-status claimed">✓ claimed</span>`
                  : `<span class="raid-status waiting">🎁 prize waiting</span>`)
              : "";
            return `<div class="raid-row${r.pid === active ? " me" : ""}">
              <span class="raid-who">${r.dmg === topDmg ? "👑 " : ""}${this.esc(nameOf(r.pid))}</span>
              <span class="raid-dmg">${r.dmg} dmg</span>
              ${status}
            </div>`;
          }).join("")}</div>`
        : `<p class="jr-note">No hits yet this week — be the first! ⚔️</p>`;
      const hpFrac = raid.maxHp ? Math.max(0, raid.hp) / raid.maxHp : 0;
      const head = raid.defeated
        ? `<div class="raid-head down">${this.pokeHtml(raid.id, raid.e, { cls: "poke-img rematch-img" })}
             <b>${this.esc(raid.n)}</b><span class="raid-downtag">DOWN! 🎉</span></div>`
        : `<div class="raid-head">${this.pokeHtml(raid.id, raid.e, { cls: "poke-img rematch-img" })}
             <b>${this.esc(raid.n)}</b>
             <div class="raid-hpbar jr-raid-hp"><div class="raid-hpfill" style="width:${hpFrac * 100}%"></div></div></div>`;
      const canClaim = raid.defeated && myContrib > 0 && !claimedByMe;
      const btn = !raid.defeated
        ? `<button id="btn-raid" class="mid-btn">⚔️ To battle!</button>`
        : canClaim ? `<button id="btn-raid" class="mid-btn">🎁 Claim your prize!</button>` : "";
      this.$("jr-raid").innerHTML = `
        <h3>⚔️ Weekly Raid <span class="jr-sub">the whole family fights together</span></h3>
        ${head}
        ${board}
        ${btn}`;
    }
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
      if (this._rematchNext) Engine.startRematch(this._rematchNext.w, this._rematchNext.tierId);
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
