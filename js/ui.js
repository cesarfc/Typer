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
    if (name === "dex") this.renderDex();
    if (name === "trophies") this.renderTrophies();
    if (name === "stats") this.renderStats();
    if (name === "practice") this.renderPractice();
    if (name !== "title" && name !== "game") this.renderTopbar();
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
      this.builder[b.dataset.k] = +b.dataset.i;
      SFX.click();
      this.renderBuilder();
    });
    this.$("btn-random-trainer").addEventListener("click", e => {
      e.preventDefault();
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
    const colorSw = (key, colors) => colors.map((c, i) =>
      `<button class="swatch ${t[key] === i ? "sel" : ""}" data-k="${key}" data-i="${i}" style="background:${c}"></button>`).join("");
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
    this.$("streak-chip").textContent = `🔥 ${SAVE.state.streak.count || 0}`;
    this.$("sound-btn").textContent = SAVE.state.settings.sound ? "🔊" : "🔇";
    const d = DIFFICULTY[SAVE.state.settings.difficulty] || DIFFICULTY.normal;
    const db = this.$("diff-btn");
    db.textContent = `${d.e} ${d.label}`;
    db.title = `Difficulty: ${d.label} — click to change`;
    db.setAttribute("aria-label", `Difficulty ${d.label}, click to change`);
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
      if (!SAVE.worldUnlocked(wi)) return;
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
    return { w: WORLDS.length - 1, s: WORLDS[WORLDS.length - 1].levels.length };
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
    html += this.MAP_DECOR.concat(this.scatterDecor()).map(o =>
      `<span class="map-decor" style="left:${o.x}px;top:${o.y}px;${o.e ? `font-size:${o.s}px` : ""}">${o.t ? tileSprite(o.t, o.sc) : o.sp ? mapSprite(o.sp, o.s, o.c) : o.e}</span>`).join("");
    html += this.MAP_CITIES.map(c =>
      `<div class="map-city" style="left:${c.x}px;top:${c.y}px"><span class="city-art">${c.t ? tileSprite(c.t, c.sc) : mapSprite(c.sp, c.s)}</span><b>${c.n}</b></div>`).join("");

    // Trainer School: practice with no countdown, any time
    html += `<button class="map-school" style="left:430px;top:1330px" title="Trainer School — no countdown, race your records!">
      <span>${mapSprite("school", 68)}</span><b>Trainer School</b></button>`;

    WORLDS.forEach((w, wi) => {
      const ns = nodes[wi];
      const unlocked = SAVE.worldUnlocked(wi);
      const maxStars = (w.levels.length + 1) * 3;
      const mid = ns[Math.floor(ns.length / 2)];
      html += `<div class="region-label" style="left:${mid.x}px;top:${mid.y - 138}px">
        <b>${w.emoji} ${w.name}</b><span>★ ${SAVE.worldStars(wi)}/${maxStars}</span></div>`;

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
        html += `<button class="mnode ${isBoss ? "boss" : ""} ${open ? "" : "locked"} ${next ? "next" : ""} ${st > 0 ? "done" : ""}"
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

    this.centerMapOn(fp.x, fp.y);
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
      const sc = e.target.closest(".map-school");
      if (sc) {
        SFX.init();
        this.show("practice");
        return;
      }
      // wild Pokemon living on the map: say hi (caught) or tease (mystery)
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
          this.toast(`👀 A mystery Pokemon lives near ${WORLDS[w].emoji} ${WORLDS[w].name} — finish levels there or check the tall grass to catch it!`);
        }
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

  buildKeyboard() {
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
    document.querySelectorAll(".key.hl").forEach(k => k.classList.remove("hl"));
    document.querySelectorAll(".hand-finger.on").forEach(f => f.classList.remove("on"));
    const hint = this.$("finger-hint");
    if (!ch) { hint.innerHTML = "&nbsp;"; return; }
    const lower = ch.toLowerCase();
    const isUpper = ch !== lower && /[a-z]/.test(lower);
    document.querySelectorAll(`.key[data-key="${CSS.escape(lower)}"]`).forEach(el => el.classList.add("hl"));
    const f = KEY_FINGER[lower];
    let txt = f === undefined ? "" : FINGER_NAMES[f];
    if (f !== undefined) {
      document.querySelectorAll(`.hand-finger[data-f="${f}"]`).forEach(el => el.classList.add("on"));
    }
    if (isUpper) {
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
      target.innerHTML = this.pokeHtml(S.world.boss.id, S.world.boss.emoji);
      target.className = "boss-size";
    } else if (S.wild) {
      // the wild Pokemon stays on screen for the whole battle
      const c = S.wild.creature;
      target.innerHTML = this.pokeHtml(c.id, c.e);
      target.className = "catch-size";
    } else {
      if (S.w === 0) {
        // wild Pokemon wander the meadow during levels
        const c = CREATURES[0][S.idx % CREATURES[0].length];
        target.innerHTML = this.pokeHtml(c.id, c.e);
      } else {
        target.textContent = S.world.targets[S.idx % S.world.targets.length];
      }
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
    this.speech(`Type my name to catch me!`, 2600);
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
      catchBox.className = "catch-result";
      catchBox.innerHTML = `
        <div class="caught-card ${res.caught.shiny ? "shiny" : ""}" style="--rc:${rar.color}">
          <div class="caught-emoji">${this.pokeHtml(res.caught.id, res.caught.e, { shiny: res.caught.shiny })}</div>
          <div class="caught-name">${res.caught.shiny ? "✨ SHINY " : ""}${this.esc(res.caught.n)}</div>
          <div class="caught-rar">${rar.label} · added to your Pokedex!</div>
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

    // big moments
    if (res.isBoss && res.firstClear) {
      this.confetti();
      if (res.w < WORLDS.length - 1) {
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
    const lastWorld = WORLDS.length - 1;
    next.classList.remove("hidden");
    if (!res.isBoss) next.textContent = res.s === WORLDS[res.w].levels.length - 1 ? "Boss Fight! 👊" : "Next Level ▶";
    else if (res.w < lastWorld) next.textContent = `Next World: ${WORLDS[res.w + 1].emoji} ▶`;
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
    this._resultsAt = performance.now();
    this.$("results-egg").className = "hidden";          // no stale egg note
    this.$("btn-replay").classList.add("hidden");        // same as Try Again
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
    next.textContent = "⚔️ Try Again!";
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
            <div class="dex-name ${fam ? "evo-hint" : ""}">${hint}</div></div>`;
        }
        const candy = SAVE.state.candy[key] || 0;
        const fam = SAVE.familyFor(key);
        const targets = SAVE.evoTargetsFor(key);
        const candyHtml = fam ? `<div class="dex-candy">🍬 ${candy}/${CANDY_COST}</div>` : "";
        const evoBtn = targets.length
          ? `<button class="btn-evolve" data-base="${key}">EVOLVE!</button>` : "";
        const inParty = SAVE.state.party.includes(key);
        const partyBtn = `<button class="btn-party ${inParty ? "on" : ""}" data-pkey="${key}"
          title="${inParty ? "Remove from party" : "Add to party"}">${inParty ? "★" : "☆"}</button>`;
        return `<div class="dex-card ${got.shiny ? "shiny" : ""}" style="--rc:${rar.color}">${partyBtn}
          <div class="dex-emoji">${this.pokeHtml(c.id, c.e, { shiny: got.shiny })}</div>
          <div class="dex-name">${got.shiny ? "✨" : ""}${this.esc(c.n)}</div>
          <div class="dex-rar">${rar.label}</div>${candyHtml}${evoBtn}</div>`;
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

    this.$("xp-gained").textContent = `+${res.xp} XP`;
    const lv = levelFromXp(SAVE.state.xp);
    this.$("xp-level").textContent = `Lv ${lv.level} · ${titleForLevel(lv.level)}`;
    this.$("results-xpfill").style.width = `${100 * lv.into / lv.need}%`;

    const next = this.$("btn-next");
    next.classList.remove("hidden");
    next.textContent = "⏱ Try Again";
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
      <div class="stat-card"><div class="stat-v">${SAVE.caughtCount()}</div><div class="stat-l">Pokemon</div></div>
      <div class="stat-card"><div class="stat-v">${s.evolutions || 0}</div><div class="stat-l">evolutions</div></div>
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
      else if (this._nextTarget) Engine.startStage(this._nextTarget[0], this._nextTarget[1]);
      else this.show("map");
    });
    this.$("btn-replay").addEventListener("click", () => {
      if (this._practiceMode) this.show("practice");
      else if (this._lastStage) Engine.startStage(this._lastStage[0], this._lastStage[1]);
    });
    this.$("btn-tomap").addEventListener("click", () => this.show("map"));

    // evolution: EVOLVE! buttons in the dex + the chooser modal
    this.$("dex-list").addEventListener("click", e => {
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
      if (confirm(`Erase ALL of ${name}'s progress, creatures and trophies? (Other players are safe.)`)
          && confirm("Are you really, really sure?")) {
        SAVE.resetCurrent();
        location.reload();
      }
    });
  },
};
