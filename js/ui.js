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

  downloadBackup() {
    if (SAVE.state && SAVE.state.flags) {
      SAVE.state.flags.lastBackupXp = SAVE.state.xp;
      SAVE.save();
    }
    const blob = new Blob([SAVE.exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "typequest-save.json";
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
    if (name === "title" || name === "game" || name === "tutorial") bar.classList.add("hidden");
    else bar.classList.remove("hidden");
    document.querySelectorAll(".navbtn").forEach(b =>
      b.classList.toggle("active", b.dataset.nav === name));
    if (name === "map") this.renderMap();
    if (name === "island") this.renderIsland();
    if (name === "dex") this.renderDex();
    if (name === "trophies") this.renderTrophies();
    if (name === "journal") this.renderJournal();
    if (name === "stats") this.renderStats();
    if (name === "practice") this.renderPractice();
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
    }

    return `<svg class="${cls}" viewBox="0 0 100 118" aria-hidden="true">
      ${hairBack}
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
      <circle cx="42" cy="39" r="2.6" fill="#1d2030"/>
      <circle cx="58" cy="39" r="2.6" fill="#1d2030"/>
      <path d="M44 48 Q50 53 56 48" stroke="#1d2030" stroke-width="2.2" fill="none" stroke-linecap="round"/>
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
      this.builder = randomTrainer();
      for (const part of ["hairColor", "hatColor", "shirt"]) {
        if (!SAVE.wardrobeOk(part, this.builder[part]).ok) this.builder[part] = 0;
      }
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
    let html = row("Skin", colorSw("skin", TRAINER_OPTS.skin));
    html += row("Hair", TRAINER_OPTS.hair.map((h, i) =>
      `<button class="swatch hair-sw ${t.hair === i ? "sel" : ""}" data-k="hair" data-i="${i}">${this.trainerSvg({ ...t, hair: i, hat: 0 }, "trainer-svg mini")}</button>`).join(""));
    html += row("Hair color", colorSw("hairColor", TRAINER_OPTS.hairColor));
    html += row("Hat", TRAINER_OPTS.hat.map((h, i) =>
      `<button class="swatch hair-sw ${t.hat === i ? "sel" : ""}" data-k="hat" data-i="${i}">${h === "none" ? "✖" : this.trainerSvg({ ...t, hat: i }, "trainer-svg mini")}</button>`).join(""));
    if (TRAINER_OPTS.hat[t.hat] !== "none") html += row("Hat color", colorSw("hatColor", TRAINER_OPTS.hatColor));
    html += row("Shirt", colorSw("shirt", TRAINER_OPTS.shirt));
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
    bb.textContent = band.e;
    bb.title = `Skill band: ${band.label} — ${band.desc} (click to change)`;
    bb.setAttribute("aria-label", `Skill band ${band.label}, click to change`);
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
    { x: 545, y: 455, sp: "mine", s: 64, n: "Moonstone City" },
    { x: 1340, y: 1165, t: "martBlue", sc: 1.9, n: "Victory City" },
    { x: 1905, y: 290, sp: "volcano", s: 72, n: "Ember Town" },
    { x: 2010, y: 1190, sp: "lanternpost", s: 48, n: "Lantern Village" },
    { x: 2625, y: 425, sp: "hall", s: 80, n: "Hall of Fame" },
    { x: 905, y: 1300, sp: "pier", s: 66, n: "Ferry Dock" },
    { x: 1565, y: 690, sp: "berrybush", s: 48, n: "Berry Farm" },
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
    { x: 2305, y: 905, e: "🌫️", s: 30 }, { x: 2200, y: 1320, t: "pine", sc: 2 }, { x: 2450, y: 980, t: "pineBig", sc: 1.7 },
    { x: 2120, y: 1010, t: "pine", sc: 2.1 }, { x: 2330, y: 1100, t: "pine", sc: 1.8 }, { x: 2270, y: 990, t: "mushroomT", sc: 1.8 },
    // Hall of Fame
    { x: 2385, y: 680, e: "✨", s: 18 }, { x: 2565, y: 645, sp: "flag", s: 30, c: "#f5c84c" }, { x: 2705, y: 485, e: "👑", s: 22 },
    { x: 2530, y: 540, t: "bench", sc: 1.7 },
    // water
    { x: 705, y: 1185, sp: "wave", s: 42 }, { x: 825, y: 1245, sp: "wave", s: 34 }, { x: 1005, y: 1335, sp: "wave", s: 42 },
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
    { x: 945, y: 1295, need: 0 },   // Ferry Dock lake
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
      if (w.island || !this.GRASS_SPOTS[wi] || !SAVE.worldUnlocked(wi)) return;
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
      `<polygon points="${x},${y} ${x - s},${y + s * 1.25} ${x + s},${y + s * 1.25}" fill="#566077"/>` +
      `<polygon points="${x},${y} ${x - s * .38},${y + s * .5} ${x + s * .38},${y + s * .5}" fill="#e8edf7"/>`;
    return `<svg id="terrain-svg" width="${this.MAP_W}" height="${this.MAP_H}" viewBox="0 0 ${this.MAP_W} ${this.MAP_H}">
      <rect width="100%" height="100%" fill="#0d2a40"/>
      <path d="${coast}" fill="none" stroke="#7fb2d9" stroke-width="34" opacity=".14"/>
      <path d="${coast}" fill="none" stroke="#d9c081" stroke-width="16" opacity=".55"/>
      <path d="${coast}" fill="#17301f"/>
      <path d="M700,620 C 770,810 850,930 890,1080 C 910,1170 930,1240 945,1295" fill="none"
        stroke="#2e6e9d" stroke-width="22" stroke-linecap="round" opacity=".85"/>
      <ellipse cx="945" cy="1310" rx="175" ry="78" fill="#2e6e9d"/>
      <ellipse cx="915" cy="1295" rx="80" ry="26" fill="#5d9ec9" opacity=".5"/>
      <ellipse cx="2245" cy="1195" rx="95" ry="46" fill="#2e6e9d"/>
      <ellipse cx="2228" cy="1186" rx="42" ry="14" fill="#5d9ec9" opacity=".5"/>
      <g fill="#0f3d24" opacity=".85">
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

  // the main island only holds the story worlds; Scholar islands (world.island)
  // live on their own route screens reached via the Sea Chart
  mainWorldCount() {
    let n = 0;
    while (WORLDS[n] && !WORLDS[n].island) n++;
    return n;
  },

  mapNodes() {
    if (this._mapNodes) return this._mapNodes;
    const A = this.mapAnchors;
    this._mapNodes = WORLDS.slice(0, this.mainWorldCount()).map((w, wi) => {
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
      if (WORLDS[w].island) continue; // the marker stays on the main island
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
    const blobs = WORLDS.slice(0, this.mainWorldCount()).map((w, i) => {
      const [ax, ay] = this.mapAnchors[i], [bx, by] = this.mapAnchors[i + 1];
      return `radial-gradient(740px 580px at ${Math.round((ax + bx) / 2)}px ${Math.round((ay + by) / 2)}px, ${w.gradient[1]}59, transparent 72%)`;
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
      `<button class="map-grass" data-spot="${s.id}" data-w="${s.w}" style="left:${s.x}px;top:${s.y}px" title="Something is rustling in the grass!"><span class="g-rustle">${mapSprite("grasstuft", 38)}</span></button>`).join("");
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
      `<span class="map-decor" style="left:${o.x}px;top:${o.y}px;${o.e ? `font-size:${o.s}px` : ""}">${o.t ? tileSprite(o.t, o.sc) : o.sp ? mapSprite(o.sp, o.s, o.c) : o.e}</span>`).join("");
    html += this.MAP_CITIES.map(c =>
      `<div class="map-city" style="left:${c.x}px;top:${c.y}px"><span class="city-art">${c.t ? tileSprite(c.t, c.sc) : mapSprite(c.sp, c.s)}</span><b>${c.n}</b></div>`).join("");

    // Trainer School: practice with no countdown, any time
    html += `<button class="map-school" style="left:430px;top:1330px" title="Trainer School — no countdown, race your records!">
      <span>${mapSprite("school", 68)}</span><b>Trainer School</b></button>`;

    // Professor's Daily Drill podium beside the school
    const daily = SAVE.dailyInfo();
    html += `<button class="map-podium ${daily.done ? "done" : ""}"
      style="left:585px;top:1372px" title="${daily.done ? "Daily Drill done — back tomorrow!" : "Professor's Daily Drill — one special run a day!"}">
      <span class="${daily.done ? "" : "podium-glow"}">${daily.done ? "✅" : "📋"}</span><b>Daily Drill</b></button>`;

    WORLDS.forEach((w, wi) => {
      if (w.island) return; // Scholar islands render on their own route screen
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
        const starsHtml = isBoss
          ? (st > 0 ? `<span class="mini-stars">🏆</span>` : "")
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

    // the ferry to the Scholar Archipelago appears once it's unlocked
    this.$("chart-chip").classList.toggle("hidden", !this.archUnlocked());

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

  // ---------- Scholar Archipelago: Sea Chart + island route screens ----------
  ARCH_ISLANDS: [
    { w: 6, name: "Gimmighoul Coast", emoji: "🪙", subject: "Math", blurb: "Number row · times tables · fractions", x: 26, y: 58, rumor: "Sailors hear counting in the fog…" },
    { w: 7, name: "Circuit Town", emoji: "💾", subject: "Coding", blurb: "Symbols · real code that runs", x: 54, y: 34, rumor: "Strange glowing words flicker offshore…" },
    { w: 8, name: "Power Plant", emoji: "⚡", subject: "Computer Science", blurb: "Binary · logic gates · secret codes", x: 80, y: 60, rumor: "A low electric hum rolls across the water…" },
  ],

  archUnlocked() {
    return SAVE.worldUnlocked(6); // the whole chain opens with the first island
  },

  openSeaChart() {
    const sc = this.$("sea-chart");
    const kbDone = SAVE.medalPoints();
    const islandCard = isl => {
      const exists = !!WORLDS[isl.w];
      const open = exists && SAVE.worldUnlocked(isl.w);
      const stars = exists ? SAVE.worldStars(isl.w) : 0;
      const maxStars = exists ? (WORLDS[isl.w].levels.length + 1) * 3 : 0;
      const ring = open ? Math.round(100 * stars / maxStars) : 0;
      if (!exists || !open) {
        return `<div class="chart-isle locked" style="left:${isl.x}%;top:${isl.y}%">
          <div class="isle-blob locked"><span class="isle-cloud">☁️</span><span class="isle-cloud c2">☁️</span></div>
          <b>???</b><i class="isle-rumor">${this.esc(isl.rumor)}</i>
          <span class="isle-lock">🔒 Beat the Hall of Fame to sail here</span></div>`;
      }
      return `<button class="chart-isle" data-isle="${isl.w}" style="left:${isl.x}%;top:${isl.y}%">
        <div class="isle-blob" style="--ring:${ring}%"><span class="isle-emoji">${isl.emoji}</span></div>
        <b>${this.esc(isl.name)}</b><i>${this.esc(isl.subject)} · ★ ${stars}/${maxStars}</i>
        <span class="isle-blurb">${this.esc(isl.blurb)}</span></button>`;
    };
    sc.innerHTML = `<div class="chart-card">
      <button id="chart-close" aria-label="Close">✕</button>
      <h2>🗺️ Sea Chart</h2>
      <p class="chart-sub">Sail the Scholar Archipelago — new islands that teach real skills!</p>
      <div class="chart-sea">
        <button class="chart-isle home" data-isle="home" style="left:8%;top:30%">
          <div class="isle-blob home"><span class="isle-emoji">⌨️</span></div>
          <b>Keyboard Island</b><i>Home · ${kbDone} medals</i></button>
        ${this.ARCH_ISLANDS.map(islandCard).join("")}
        <svg class="chart-routes" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M14,33 Q30,45 28,56" /><path d="M32,56 Q45,42 54,37" /><path d="M58,37 Q72,44 80,58" />
        </svg>
      </div>
    </div>`;
    sc.classList.remove("hidden");
  },

  closeSeaChart() { this.$("sea-chart").classList.add("hidden"); },

  sailTo(w) {
    this.closeSeaChart();
    if (w === "home") { this.show("map"); return; }
    this._islandW = +w;
    SFX.fanfare();
    this.show("island");
  },

  renderIsland(w) {
    if (w == null) w = this._islandW;
    if (w == null || !WORLDS[w]) { this.show("map"); return; }
    this._islandW = w;
    const world = WORLDS[w];
    const route = this.$("island-route");
    const n = world.levels.length + 1; // + boss
    // a gentle winding column of nodes from bottom (start) to top (boss)
    let html = `<div class="isle-header"><h2>${world.emoji} ${this.esc(world.name)}</h2>
      <p>${this.esc(world.tagline)}</p>
      ${world.subject === "math" ? `<span class="coin-count">🪙 ${SAVE.state.coins || 0} Gold Coins</span>` : ""}</div>`;
    // tutor building at the pier
    html += `<button class="isle-tutor" data-lesson="intro" title="${this.esc(world.tutor ? world.tutor.name : "Tutor")}'s lesson">
      ${this.pokeHtml(world.tutor && world.tutor.id, world.tutor ? world.tutor.e : "🎓", { cls: "poke-img tutor-img" })}
      <b>${this.esc(world.tutor ? world.tutor.name : "Tutor")}'s School</b></button>`;
    for (let s = 0; s < n; s++) {
      const isBoss = s === world.levels.length;
      const open = SAVE.stageUnlocked(w, s);
      const st = SAVE.stageStars(w, s);
      const next = open && st === 0;
      const side = s % 2 === 0 ? "left" : "right";
      const stars = isBoss ? (st > 0 ? "🏆" : "") : `${"★".repeat(st)}<span class="off">${"★".repeat(3 - st)}</span>`;
      const label = isBoss ? `BOSS: ${world.boss.name}` : world.levels[s].name;
      html += `<button class="isle-node ${side} ${isBoss ? "boss" : ""} ${open ? "" : "locked"} ${next ? "next" : ""} ${st > 0 ? "done" : ""}"
        data-w="${w}" data-s="${s}" title="${this.esc(open ? label : "Locked")}">
        <span class="node-num">${isBoss ? this.pokeHtml(world.boss.id, world.boss.emoji, { cls: "poke-img" }) : s + 1}</span>
        <span class="node-label">${this.esc(label)}</span>
        <span class="node-stars">${stars}</span></button>`;
    }
    route.innerHTML = html;
    route.scrollTop = route.scrollHeight; // start at the pier (bottom)
  },

  // ---------- concept lessons (assume the trainer is new to the subject) ----------
  // play a level's lesson first if it hasn't been seen, then start the level
  startLevelWithLesson(w, s, opts) {
    const world = WORLDS[w];
    const isBoss = s === world.levels.length;
    const lid = !isBoss && world.levels[s].lesson;
    const seen = SAVE.state.flags.lessons || {};
    if (lid && LESSONS[lid] && !seen[lid] && !(opts && opts.skipLesson)) {
      this.startLesson(lid, world, () => Engine.startStage(w, s, opts));
      return;
    }
    Engine.startStage(w, s, opts);
  },

  startLesson(id, world, onDone) {
    const def = LESSONS[id];
    if (!def) { onDone && onDone(); return; }
    this.lesson = { id, def, step: 0, world, onDone, guideOk: false };
    this.$("lesson-tutor").innerHTML = world && world.tutor
      ? this.pokeHtml(world.tutor.id, world.tutor.e, { cls: "poke-img" }) : def.e;
    this.$("lesson-overlay").classList.remove("hidden");
    this.lessonShow();
  },

  lessonShow() {
    const L = this.lesson;
    const st = L.def.steps[L.step];
    this.$("lesson-bubble").innerHTML = st.say || "";
    this.$("lesson-board").innerHTML = st.board ? this.lessonBoard(st.board, st.arg) : "";
    this.$("lesson-board").classList.toggle("hidden", !st.board);
    const tryBox = this.$("lesson-try");
    const next = this.$("lesson-next");
    L.guideOk = false;
    L.typed = "";
    if (st.guide || st.try || st.typeWord) {
      // a guided keypress, a whole guided word, or an untimed practice prompt
      const target = st.try ? promptAnswer(st.try) : (st.typeWord || st.guide);
      L.target = target;
      L.tryQuestion = st.try ? promptDisplay(st.try) : null;
      tryBox.classList.remove("hidden");
      tryBox.innerHTML = `${L.tryQuestion ? `<div class="lt-q">${this.esc(L.tryQuestion)}</div>` : ""}
        <div class="lt-slots ${target.length > 6 ? "mono" : ""}">${[...target].map((c, i) =>
          `<span class="lt-ch ${i === 0 ? "cur" : ""}">${c === " " ? "·" : this.esc(c)}</span>`).join("")}</div>
        <div class="lt-hint">⌨️ type it to continue</div>`;
      next.classList.add("hidden");
      this.highlightKey(target[0]);
    } else {
      tryBox.classList.add("hidden");
      tryBox.innerHTML = "";
      next.classList.remove("hidden");
      this.highlightKey(null);
    }
    next.textContent = L.step < L.def.steps.length - 1 ? "Next ▶" : "Start the level! ▶";
  },

  // keystrokes during a guide/try lesson step
  lessonKey(e) {
    const L = this.lesson;
    if (!L || !L.target) return;
    if (e.key && e.key.length === 1) {
      e.preventDefault();
      const key = normalizeKey(e.key);
      const pos = L.typed.length;
      if (key === L.target[pos]) {
        L.typed += key;
        const slots = this.$("lesson-try").querySelectorAll(".lt-ch");
        if (slots[pos]) { slots[pos].classList.remove("cur"); slots[pos].classList.add("done"); }
        if (slots[pos + 1]) slots[pos + 1].classList.add("cur");
        SFX.click(pos + 1);
        if (L.typed.length >= L.target.length) {
          this.highlightKey(null);
          SFX.word();
          setTimeout(() => this.lessonNext(), 350);
        } else {
          this.highlightKey(L.target[L.typed.length]);
        }
      } else {
        SFX.error();
        const slots = this.$("lesson-try").querySelectorAll(".lt-ch");
        if (slots[pos]) { slots[pos].classList.add("err"); setTimeout(() => slots[pos].classList.remove("err"), 250); }
      }
    }
  },

  lessonNext() {
    const L = this.lesson;
    if (!L) return;
    if (L.step < L.def.steps.length - 1) {
      L.step++;
      this.lessonShow();
      SFX.click();
    } else {
      this.lessonFinish(false);
    }
  },

  lessonFinish(skipped) {
    const L = this.lesson;
    if (!L) return;
    this.$("lesson-overlay").classList.add("hidden");
    this.highlightKey(null);
    SAVE.state.flags.lessons = SAVE.state.flags.lessons || {};
    if (!SAVE.state.flags.lessons[L.id]) {
      SAVE.state.flags.lessons[L.id] = true;
      if (!skipped) SAVE.state.xp += 5; // a small thank-you for learning
      SAVE.save();
    }
    this.lesson = null;
    if (L.onDone) L.onDone();
  },

  // visual boards: concrete -> pictorial -> abstract
  lessonBoard(type, arg) {
    if (type === "numrow") {
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
      return `<div class="lb-numrow">${keys.map(k =>
        `<span class="lb-key ${k === arg ? "hot" : ""}">${k}</span>`).join("")}</div>`;
    }
    if (type === "place") {
      const s = String(arg).split("");
      const places = ["", "", "ones", "tens", "hundreds", "thousands"];
      return `<div class="lb-place">${s.map((d, i) => {
        const mag = Math.pow(10, s.length - 1 - i);
        return `<div class="lb-digit"><b>${+d * mag}</b><i>${places[s.length - i] || ""}</i></div>`;
      }).join("<span class='lb-plus'>+</span>")}</div>`;
    }
    if (type === "groups") {
      const [g, m] = arg;
      return `<div class="lb-groups">${Array.from({ length: g }, () =>
        `<div class="lb-group">${"🍓".repeat(m)}</div>`).join("")}</div>`;
    }
    if (type === "skip") {
      const [by, times] = arg;
      return `<div class="lb-skip">${Array.from({ length: times }, (_, i) =>
        `<span class="lb-step">${by * (i + 1)}</span>`).join("<i>→</i>")}</div>`;
    }
    if (type === "triangle") {
      const [top, a, b] = arg;
      return `<div class="lb-tri"><span class="tri-top">${top}</span><div class="tri-bot"><span>${a}</span><span>${b}</span></div></div>`;
    }
    if (type === "pie") {
      const [, parts] = arg;
      return `<div class="lb-pie">${Array.from({ length: parts }, (_, i) =>
        `<span class="pie-slice s${parts}" style="--i:${i}">🥧</span>`).join("")}<i>${parts} equal parts</i></div>`;
    }
    if (type === "pair") {
      const [open, close] = arg;
      return `<div class="lb-pair"><span class="pair-k">${this.esc(open)}</span><i>everything goes inside</i><span class="pair-k">${this.esc(close)}</span></div>`;
    }
    if (type === "camel") {
      const word = arg;
      return `<div class="lb-camel">${[...word].map(c =>
        `<span class="${/[A-Z]/.test(c) ? "cap" : ""}">${c}</span>`).join("")}</div>`;
    }
    if (type === "crate") {
      const [name, val] = arg;
      return `<div class="lb-crate"><span class="crate-name">${this.esc(name)}</span><span class="crate-box">${this.esc(String(val))}</span></div>`;
    }
    if (type === "hexswatch") {
      const hex = arg;
      return `<div class="lb-hex"><span class="hex-swatch big" style="background:${this.esc(hex)}"></span><span class="hex-code">${this.esc(hex)}</span></div>`;
    }
    if (type === "lamps") {
      const bits = arg;
      const vals = [8, 4, 2, 1].slice(-bits.length);
      const sum = [...bits].reduce((a, b, i) => a + (b === "1" ? vals[i] : 0), 0);
      return `<div class="lb-lamps">${[...bits].map((b, i) =>
        `<span class="lamp ${b === "1" ? "on" : ""}"><b>${b}</b><i>${vals[i]}</i></span>`).join("")}<span class="lamp-sum">= ${sum}</span></div>`;
    }
    if (type === "gate") {
      return `<div class="lb-gate"><span class="sw on">ON</span><span class="gate-op">${this.esc(arg)}</span><span class="sw on">ON</span><i>→</i><span class="bulb on">💡</span></div>`;
    }
    if (type === "cipher") {
      const word = arg;
      return `<div class="lb-cipher">${[...word].map(c => {
        const prev = String.fromCharCode(c.charCodeAt(0) - 1);
        return `<span class="cip"><b>${c}</b><i>↓</i><u>${prev}</u></span>`;
      }).join("")}</div>`;
    }
    return "";
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
    if (this._spotEl) { this._spotEl.classList.remove("spot-target"); this._spotEl = null; }
    if (i >= steps.length) {
      this.$("spotlight").classList.add("hidden");
      this._spotNext = null;
      return;
    }
    const st = steps[i];
    if (st.nav) this.show(st.nav);
    if (st.tab) { this._museumTab = st.tab; this.renderTrophies(); }
    this.$("spotlight").classList.remove("hidden");
    this.$("spot-caption").innerHTML = `${st.text}<br><small>tap to continue</small>`;
    const el = document.querySelector(st.sel);
    if (el) {
      el.classList.add("spot-target");
      el.scrollIntoView({ block: "center" });
      this._spotEl = el;
    }
    this._spotNext = () => this.runSpotlight(steps, i + 1);
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
    // the level card owns Enter (start) and Escape (close)
    if (!this.$("level-card").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closeLevelCard(); }
      else if (e.key === "Enter") { e.preventDefault(); this.startFromLevelCard(); }
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
    WORLDS.forEach((w, wi) => { if (w.island) return; for (let s = 0; s <= w.levels.length; s++) flat.push({ w: wi, s }); });
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
    vp.addEventListener("dblclick", e => {
      // double-click skips the level card and dives straight in
      const b = e.target.closest(".mnode");
      if (!b || b.classList.contains("locked")) return;
      this.closeLevelCard();
      Engine.startStage(+b.dataset.w, +b.dataset.s);
    });
    vp.addEventListener("click", e => {
      if (this._mapDragged) return;
      const b = e.target.closest(".mnode");
      if (b) {
        SFX.init();
        if (!b.classList.contains("locked")) {
          this.openLevelCard(+b.dataset.w, +b.dataset.s);
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
      const sc = e.target.closest(".map-school");
      if (sc) {
        SFX.init();
        this.show("practice");
        return;
      }
      const pd = e.target.closest(".map-podium");
      if (pd) {
        SFX.init();
        if (SAVE.dailyInfo().done) this.toast("✅ Today's drill is done — the Professor preps a new one overnight!");
        else Engine.startDaily();
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
      const t = e.target.closest(".tier-card");
      if (!t) return;
      SFX.init();
      if (!t.classList.contains("locked")) {
        Engine.startPractice(t.dataset.tier);
      } else {
        SFX.error();
        t.classList.remove("denied");
        void t.offsetWidth;
        t.classList.add("denied");
        const tier = PRACTICE_TIERS.find(x => x.id === t.dataset.tier);
        if (tier) this.toast(`🔒 Reach ${WORLDS[tier.need].emoji} ${WORLDS[tier.need].name} to unlock ${tier.label} practice!`);
      }
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

  _kbLayout: "letters",

  buildKeyboard(layoutId = "letters") {
    this._kbLayout = layoutId;
    const rows = KB_LAYOUTS[layoutId] || KB_ROWS;
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
    this.$("kb").classList.toggle("kb-full", layoutId === "full");
    // one keyboard + hands for the game screen, one set for the tutorial
    this.$("kb").innerHTML = html;
    this.$("tut-kb").innerHTML = html;
    this.$("hand-left").innerHTML = this.handSvg("l");
    this.$("hand-right").innerHTML = this.handSvg("r");
    this.$("tut-hand-left").innerHTML = this.handSvg("l");
    this.$("tut-hand-right").innerHTML = this.handSvg("r");
    this.applyKbVisibility();
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
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    // Scholar islands need the number row / symbols; others keep the
    // original letters board (and its tight small-screen height budget)
    const layout = w.kb || "letters";
    if (this._kbLayout !== layout) this.buildKeyboard(layout);
    this.$("question-card").classList.add("hidden");
    this.$("helper-card").classList.add("hidden");
    this.$("think-pill").classList.add("hidden");
    this.$("code-output").classList.add("hidden");
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
    if (S.isBoss) {
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
      target.innerHTML = this.pokeHtml(c.id, c.e);
      target.className = "catch-size";
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
    this.$("helper-card").classList.add("hidden"); // fresh prompt, fresh start
    this.$("code-output").classList.add("hidden");
    this.renderPromptText(S);
    this.$("hud-progress-fill").style.width = `${Math.round(100 * S.idx / S.prompts.length)}%`;
  },

  renderPromptText(S) {
    const pw = this.$("prompt-word");
    const qc = this.$("question-card");
    // the question (math problem / code-output prompt) above the answer slots
    if (S.display) {
      qc.classList.remove("hidden");
      qc.classList.toggle("long", S.display.length > 18);
      qc.innerHTML = this.esc(S.display).replace(/❓|\?$/g, m => `<span class="q-mark">${m}</span>`);
    } else if (S.swatch) {
      // hex color prompt: show the live color the code paints
      qc.classList.remove("hidden");
      qc.classList.remove("long");
      qc.innerHTML = `<span class="hex-swatch" style="background:${this.esc(S.swatch)}"></span>`;
    } else {
      qc.classList.add("hidden");
      qc.innerHTML = "";
    }
    pw.className = "";
    pw.classList.toggle("code-prompt", !!S.codeMode);
    if (S.text.length > 30) pw.classList.add("xlong");
    else if (S.text.length > 16) pw.classList.add("long");
    // answer-mode: untyped characters render as blank slots, not the answer
    pw.innerHTML = [...S.text].map((c, i) => {
      const typed = i < S.pos;
      const cur = i === S.pos;
      const hideAnswer = S.answerMode && !typed;
      const glyph = c === " " ? "·" : hideAnswer ? "_" : this.esc(c);
      return `<span class="ch ${typed ? "done" : cur ? "cur" : ""} ${c === " " ? "sp" : ""} ${hideAnswer ? "mystery" : ""}">${glyph}</span>`;
    }).join("");
    // suppress the answer guide in answer-mode until 2 errors turn it into a rescue
    if (S.answerMode && S.errorsThisPrompt < 2) this.highlightKey(null);
    else this.highlightKey(S.text[S.pos]);
  },

  charDone(S) {
    const spans = this.$("prompt-word").children;
    if (spans[S.pos - 1]) {
      spans[S.pos - 1].classList.remove("cur", "mystery");
      spans[S.pos - 1].classList.add("done", "pop");
      // reveal the real character now that the slot is filled
      const c = S.text[S.pos - 1];
      spans[S.pos - 1].textContent = c === " " ? "·" : c;
    }
    if (spans[S.pos]) spans[S.pos].classList.add("cur");
    if (S.answerMode && S.errorsThisPrompt < 2) this.highlightKey(null);
    else this.highlightKey(S.text[S.pos]);
    const r = this.$("prompt-word").getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top, [S.world.accent], 3, 2.2);
  },

  // ---------- Scholar islands: think/type, helper cards, ghost answers ----------
  thinkPhase(S, on) {
    const pill = this.$("think-pill");
    const bar = this.$("timer-bar");
    if (on) {
      pill.classList.remove("hidden");
      pill.textContent = "🤔 think it through…";
      bar.classList.add("thinking"); // dim, breathing — no countdown yet
    } else {
      pill.classList.remove("hidden");
      pill.textContent = "⌨️ go!";
      bar.classList.remove("thinking");
      setTimeout(() => { if (this.$("think-pill").textContent === "⌨️ go!") this.$("think-pill").classList.add("hidden"); }, 600);
    }
  },

  showHelper(S) {
    const card = this.$("helper-card");
    const html = this.helperContent(S);
    if (!html) return;
    card.innerHTML = `<div class="helper-inner"><span class="helper-tag">📝 trainer's notes</span>${html}</div>`;
    card.classList.remove("hidden");
  },

  // pictorial scaffolds matched to the operation in the question
  helperContent(S) {
    const d = S.display || "";
    let m;
    if ((m = d.match(/(\d+)\s*×\s*(\d+)/))) {
      const a = +m[1], b = +m[2];
      const strip = Array.from({ length: a }, (_, i) => `<span>${b * (i + 1)}</span>`).join("<i>·</i>");
      return `<div class="help-skip">count by ${b}s: ${strip}</div>`;
    }
    if ((m = d.match(/(\d+)\s*÷\s*(\d+)/))) {
      const a = +m[1], b = +m[2];
      return `<div class="help-triangle"><b>${a}</b><span>${b} × ❓ = ${a}</span></div>`;
    }
    if ((m = d.match(/1\/(\d+)\s*of\s*(\d+)/))) {
      const parts = +m[1], whole = +m[2];
      return `<div class="help-pie">split ${whole} into ${parts} equal parts: ${whole} ÷ ${parts}</div>`;
    }
    if ((m = d.match(/([01]{2,})/))) {
      // binary: show the 8-4-2-1 place values lit up
      const bits = m[1];
      const vals = [8, 4, 2, 1].slice(-bits.length);
      const cells = [...bits].map((b, i) =>
        `<span class="bin-cell ${b === "1" ? "on" : ""}">${vals[i]}<i>${b}</i></span>`).join("");
      const sum = [...bits].reduce((a, b, i) => a + (b === "1" ? vals[i] : 0), 0);
      return `<div class="help-bin">${cells}<b>= ${sum}</b></div>`;
    }
    if (/AND|OR|NOT/.test(d)) {
      return `<div class="help-line">AND needs <b>both</b> true · OR needs <b>one</b> true · NOT <b>flips</b> it</div>`;
    }
    if (/shift back/.test(d)) {
      return `<div class="help-line">move each letter back: b→a, c→b, d→c… use the alphabet!</div>`;
    }
    if ((m = d.match(/(\d+)\s*([+\-])\s*(\d+)/))) {
      return `<div class="help-line">work it out step by step — line up the ones, then the tens</div>`;
    }
    return `<div class="help-line">take your time — you've got this! 💪</div>`;
  },

  ghostAnswer(S, cb) {
    // type the answer in blue, slot by slot — shown, not earned (stays
    // a "mystery" reveal). Then the kid echoes it once to continue.
    const spans = this.$("prompt-word").children;
    let i = S.pos;
    const step = () => {
      if (i >= S.text.length) { if (cb) cb(); return; }
      const el = spans[i];
      if (el) { el.classList.add("ghost"); el.textContent = S.text[i] === " " ? "·" : S.text[i]; el.classList.remove("mystery"); }
      i++;
      setTimeout(step, 300);
    };
    this.$("finger-hint").innerHTML = "💡 Here's the answer — now type it once to go on!";
    step();
  },

  floatText(text) {
    const a = this.$("arena");
    const el = document.createElement("div");
    el.className = "float-text";
    el.textContent = text;
    a.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  },

  // the payoff on the coding island: a completed line of code runs and
  // typewriters its output into a little console
  runCode(out) {
    const box = this.$("code-output");
    box.classList.remove("hidden");
    box.innerHTML = `<span class="co-prompt">&gt; </span><span class="co-text"></span><span class="co-cursor">▋</span>`;
    const txt = box.querySelector(".co-text");
    let i = 0;
    const step = () => {
      if (i >= out.length) { SFX.word(); return; }
      txt.textContent += out[i++];
      setTimeout(step, 38);
    };
    step();
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
    // first slip on a Scholar prompt: gentle nudge, no content hint yet;
    // at 2 the guide wakes as a rescue
    if (S.scholar) {
      if (S.answerMode && S.errorsThisPrompt >= 2) this.highlightKey(S.text[S.pos]);
      const hint = this.$("finger-hint");
      if (S.errorsThisPrompt === 1) { hint.innerHTML = "Not quite — check it again! ✋"; }
    }
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
      target.innerHTML = `<span class="poke-pop">${this.pokeHtml(creature.id, creature.e)}</span>`;
    }, 1780);
    setTimeout(() => {
      if (!alive()) return;
      this.announce(`A wild ${creature.n} appeared!`, 1600);
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
    this._practiceMode = false;
    this._islandReturn = !!(WORLDS[res.w] && WORLDS[res.w].island);
    this._resultsAt = performance.now();
    this.$("btn-replay").textContent = "↻ Replay";
    this.$("btn-replay").classList.remove("hidden");
    this.$("results-stars").classList.remove("hidden");
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
    if (res.stars === 3 && res.acc >= 0.98 && bi >= 0 && bi < BAND_ORDER.length - 1) {
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
    if (!res.isBoss) nextLabel = res.s === WORLDS[res.w].levels.length - 1 ? "Boss Fight! 👊" : "Next Level ▶";
    else if (res.w < lastWorld) nextLabel = `Next World: ${WORLDS[res.w + 1].emoji} ▶`;
    if (nextLabel) next.innerHTML = `${nextLabel} <small class="key-hint">Enter</small>`;
    else next.classList.add("hidden");
    this._nextTarget = !res.isBoss ? [res.w, res.s + 1] : res.w < lastWorld ? [res.w + 1, 0] : null;
    SFX.fanfare();
  },

  showDefeat(S) {
    this.show("results");
    this.renderTopbar();
    this._lastStage = [S.w, S.s];
    this._practiceNext = null;
    this._practiceMode = false;
    this._islandReturn = !!(WORLDS[S.w] && WORLDS[S.w].island);
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
    this._nextTarget = [S.w, S.s];
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
        const candyHtml = fam ? (fam.coins
          ? `<div class="dex-candy">🪙 ${SAVE.state.coins || 0}/${fam.coins}</div>`
          : `<div class="dex-candy">🍬 ${candy}/${CANDY_COST}${
              SAVE.state.vouchers > 0 ? ` <button class="btn-voucher" data-vbase="${key}" title="Spend a candy voucher here">🎟+1</button>` : ""
            }</div>`) : "";
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
  },

  practiceScene(S) {
    this.show("game");
    const w = S.world;
    document.body.classList.remove("super-mode");
    this.$("capslock-warn").classList.add("hidden");
    this.applyKbVisibility();
    this.practiceTimerUI(true);
    this.$("hud-stage").textContent = `🏫 Practice · ${S.practice.label}`;
    this.$("hud-progress").classList.remove("hidden");
    this.$("hud-progress-fill").style.width = "0%";
    this.$("hud-hearts").classList.add("hidden");
    this.$("boss-bar").classList.add("hidden");
    this.$("player-avatar").innerHTML = this.avatarHtml(SAVE.state.profile);
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
  },

  renderPractice() {
    const list = this.$("practice-tiers");
    list.innerHTML = PRACTICE_TIERS.map(t => {
      const open = SAVE.worldUnlocked(t.need);
      const pb = SAVE.state.practice[t.id];
      const pbHtml = pb
        ? `⏱ best ${this.fmtTime(pb.time)} · ⚡ best ${pb.wpm} wpm`
        : `no record yet — set one!`;
      return `<button class="tier-card ${open ? "" : "locked"}" data-tier="${t.id}">
        <span class="tier-e">${t.e}</span>
        <span class="tier-info">
          <b>${t.label}</b>
          <i>${open ? t.desc : `Reach ${WORLDS[t.need].emoji} ${WORLDS[t.need].name} to unlock`}</i>
          <em>${open ? `${t.count} words · ${pbHtml}` : "🔒"}</em>
        </span>
      </button>`;
    }).join("");
  },

  showPracticeResults(res) {
    this.show("results");
    this.renderTopbar();
    this._practiceNext = res.tier.id;
    this._practiceMode = true;
    this._nextTarget = null;
    this._lastStage = null;
    this._resultsAt = performance.now();
    this.$("btn-replay").classList.remove("hidden");
    const card = this.$("results-card");
    card.classList.remove("defeat");
    card.style.setProperty("--wa", "#4dc3ff");
    this.$("results-title").textContent = `🏫 Practice · ${res.tier.label}`;
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
    next.innerHTML = `⏱ Try Again <small class="key-hint">Enter</small>`;
    this.$("btn-replay").textContent = "🎚 Difficulty";
    (res.newTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 900 + i * 800));
    if (record) {
      this.confetti();
      SFX.fanfare();
      setTimeout(() => this.toast(`🏫 New ${res.tier.label} record! Can you beat it?`, "gold"), 700);
    } else {
      SFX.word();
    }
  },

  // ---------- wild encounter scene (grass + fishing + legendary) ----------
  wildScene(S) {
    this.show("game");
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
      target.className = "catch-size";
      target.innerHTML = `<span class="poke-pop">${this.pokeHtml(c.id, c.e)}</span>`;
      this.announce(legendary ? `The legendary ${c.n} appeared!` : `A wild ${c.n} jumped out!`, 1900);
      this.speech(legendary ? "Pass my trial of three words!" : "Weaken me with words first!", 2600);
      SFX.pop();
      if (legendary) SFX.fanfare();
    }
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

  // ---------- evolution scene ----------
  evolutionScene(S) {
    this.show("game");
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
  },

  // ---------- level card: per-level skill band choice ----------
  openLevelCard(w, s) {
    const world = WORLDS[w];
    const isBoss = s === world.levels.length;
    this._lc = { w, s, band: SAVE.state.band };
    const stars = SAVE.stageStars(w, s);
    const b = SAVE.state.stageBest[`${w}-${s}`] || {};
    this.$("level-card").innerHTML = `<div class="lc-card">
      <button id="lc-close" aria-label="Close">✕</button>
      <h3>${world.emoji} ${this.esc(isBoss ? `BOSS: ${world.boss.name}` : world.levels[s].name)}</h3>
      <p class="lc-stats">${stars
        ? `<span class="lc-stars">${"★".repeat(stars)}<span class="off">${"★".repeat(3 - stars)}</span></span>`
        : "not cleared yet"}${b.wpm ? ` · best ${b.wpm} wpm · ${Math.round((b.acc || 0) * 100)}%` : ""}${b.ninja ? " · 🥷" : ""}</p>
      <div class="lc-bands">${BAND_ORDER.map(id => {
        const bd = BANDS[id];
        return `<button class="lc-band ${id === this._lc.band ? "sel" : ""}" data-band="${id}"
          title="${this.esc(bd.desc)}">${bd.e}<small>${bd.label}</small></button>`;
      }).join("")}</div>
      <button id="lc-start" class="big-btn">▶ Start <small class="key-hint">Enter</small></button>
    </div>`;
    this.$("level-card").classList.remove("hidden");
  },

  closeLevelCard() {
    this.$("level-card").classList.add("hidden");
  },

  startFromLevelCard() {
    if (!this._lc) return;
    const { w, s, band } = this._lc;
    this.closeLevelCard();
    // Scholar island levels teach the concept first (once)
    if (WORLDS[w].island) this.startLevelWithLesson(w, s, { band });
    else Engine.startStage(w, s, { band });
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
        this.builder = p && p.trainer ? { ...p.trainer } : defaultTrainer();
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
      if (this._practiceNext) Engine.startPractice(this._practiceNext);
      else if (this._nextTarget) {
        const [w, s] = this._nextTarget;
        if (WORLDS[w] && WORLDS[w].island) this.startLevelWithLesson(w, s, {});
        else Engine.startStage(w, s);
      } else this.show(this._islandReturn ? "island" : "map");
    });
    this.$("btn-replay").addEventListener("click", () => {
      if (this._practiceMode) this.show("practice");
      else if (this._lastStage) {
        const [w, s] = this._lastStage;
        if (WORLDS[w] && WORLDS[w].island) Engine.startStage(w, s, {});
        else Engine.startStage(w, s);
      }
    });
    this.$("btn-tomap").addEventListener("click", () => this.show(this._islandReturn ? "island" : "map"));

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
    this.$("spotlight").addEventListener("click", () => {
      if (!this._spotNext) return;
      SFX.click();
      const fn = this._spotNext;
      this._spotNext = null;
      fn();
    });

    this.$("band-btn").addEventListener("click", () => {
      const next = BAND_ORDER[(BAND_ORDER.indexOf(SAVE.state.band) + 1) % BAND_ORDER.length];
      SAVE.state.band = next;
      SAVE.save();
      SFX.click();
      this.renderTopbar();
      const bd = BANDS[next];
      this.toast(`${bd.e} Skill band: <b>${bd.label}</b> — ${bd.desc}`);
    });
    this.$("day-chip").addEventListener("click", () => { SFX.click(); this.maybeDayCard(true); });
    this.$("chart-chip").addEventListener("click", () => { SFX.click(); this.openSeaChart(); });
    this.$("island-back").addEventListener("click", () => { SFX.click(); this.openSeaChart(); });
    this.$("sea-chart").addEventListener("click", e => {
      if (e.target.closest("#chart-close") || e.target.id === "sea-chart") { SFX.click(); this.closeSeaChart(); return; }
      const isl = e.target.closest(".chart-isle");
      if (isl && isl.dataset.isle) { SFX.click(); this.sailTo(isl.dataset.isle); }
    });
    this.$("island-route").addEventListener("click", e => {
      const tut = e.target.closest(".isle-tutor");
      if (tut) {
        SFX.click();
        const world = WORLDS[this._islandW];
        // replay the first concept lesson on this island
        const firstLid = (world.levels.find(l => l.lesson) || {}).lesson;
        if (firstLid) this.startLesson(firstLid, world, null);
        return;
      }
      const node = e.target.closest(".isle-node");
      if (!node) return;
      SFX.init();
      if (node.classList.contains("locked")) {
        SFX.error();
        node.classList.remove("denied"); void node.offsetWidth; node.classList.add("denied");
        this.toast("🔒 Finish the level before this one first!");
        return;
      }
      this.openLevelCard(+node.dataset.w, +node.dataset.s);
    });
    this.$("lesson-next").addEventListener("click", () => this.lessonNext());
    this.$("lesson-skip").addEventListener("click", () => { SFX.click(); this.lessonFinish(true); });
    this.$("level-card").addEventListener("click", e => {
      if (e.target.id === "level-card" || e.target.closest("#lc-close")) {
        SFX.click();
        this.closeLevelCard();
        return;
      }
      const bp = e.target.closest(".lc-band");
      if (bp) {
        SFX.click();
        this._lc.band = bp.dataset.band;
        this.$("level-card").querySelectorAll(".lc-band").forEach(x =>
          x.classList.toggle("sel", x.dataset.band === this._lc.band));
        return;
      }
      if (e.target.closest("#lc-start")) { SFX.click(); this.startFromLevelCard(); }
    });
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
      if (e.target.closest("#btn-elite")) { SFX.click(); Engine.startElite(); }
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
