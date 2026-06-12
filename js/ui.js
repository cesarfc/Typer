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
          <div class="pc-sub">Lv ${p.level} ${titleForLevel(p.level)} · 🐾 ${p.creatures} · 🏆 ${p.trophies} · ${DIFFICULTY[p.difficulty].e} ${DIFFICULTY[p.difficulty].label}</div>
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
    if (name === "title" || name === "game" || name === "tutorial") bar.classList.add("hidden");
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

  startGameFromTitle() {
    const name = this.$("name-input").value.trim() || "Hero";
    if (!SAVE.createPlayer(name, this.selectedAvatar, this.selectedDiff)) { this.renderTitle(); return; }
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
    this.$("chip-avatar").textContent = p.avatar;
    this.$("chip-name").textContent = p.name;
    this.$("chip-title").textContent = `${titleForLevel(lv.level)} · Lv ${lv.level}`;
    this.$("chip-xpfill").style.width = `${Math.round(100 * lv.into / lv.need)}%`;
    this.$("streak-chip").textContent = `🔥 ${SAVE.state.streak.count || 0}`;
    this.$("sound-btn").textContent = SAVE.state.settings.sound ? "🔊" : "🔇";
    const d = DIFFICULTY[SAVE.state.settings.difficulty] || DIFFICULTY.normal;
    const db = this.$("diff-btn");
    db.textContent = d.e;
    db.title = `Difficulty: ${d.label} — click to change`;
  },

  // ---------- region map (pannable live map) ----------
  MAP_W: 2900,
  MAP_H: 1560,
  mapX: 0,
  mapY: 0,
  // route anchor per world + final endpoint; stages snake between them
  mapAnchors: [[230, 1190], [660, 640], [1210, 1010], [1730, 430], [2140, 1030], [2480, 560], [2680, 300]],

  MAP_CITIES: [
    { x: 180, y: 1330, e: "🏘️", n: "Pallet Town" },
    { x: 545, y: 455, e: "⛏️", n: "Moonstone City" },
    { x: 1340, y: 1165, e: "🏟️", n: "Goal City" },
    { x: 1905, y: 290, e: "🌋", n: "Ember Town" },
    { x: 2010, y: 1190, e: "🏮", n: "Lantern Village" },
    { x: 2625, y: 425, e: "🏛️", n: "Hall of Fame" },
    { x: 905, y: 1300, e: "⛵", n: "Ferry Dock" },
    { x: 1565, y: 690, e: "🍓", n: "Berry Farm" },
  ],
  MAP_DECOR: [
    { x: 95, y: 1115, e: "🌳", s: 36 }, { x: 335, y: 1005, e: "🌲", s: 30 }, { x: 470, y: 1265, e: "🌸", s: 22 },
    { x: 150, y: 950, e: "🌳", s: 26 }, { x: 420, y: 1125, e: "🍄", s: 20 }, { x: 300, y: 1330, e: "🌼", s: 20 },
    { x: 560, y: 835, e: "🪨", s: 26 }, { x: 770, y: 515, e: "⛰️", s: 46 }, { x: 855, y: 720, e: "🗻", s: 42 },
    { x: 595, y: 575, e: "💎", s: 18 }, { x: 930, y: 555, e: "🪨", s: 22 }, { x: 720, y: 390, e: "⛰️", s: 34 },
    { x: 1085, y: 860, e: "🌾", s: 24 }, { x: 1345, y: 885, e: "🌳", s: 30 }, { x: 1145, y: 1190, e: "🎉", s: 20 },
    { x: 1430, y: 1065, e: "⚽", s: 18 }, { x: 1240, y: 1280, e: "📣", s: 20 },
    { x: 1605, y: 555, e: "⛰️", s: 46 }, { x: 1835, y: 555, e: "🔥", s: 22 }, { x: 1955, y: 515, e: "⚡", s: 18 },
    { x: 1690, y: 220, e: "🗻", s: 40 }, { x: 1840, y: 140, e: "☁️", s: 30 },
    { x: 2015, y: 895, e: "🌲", s: 38 }, { x: 2245, y: 1185, e: "🌲", s: 30 }, { x: 2085, y: 1125, e: "🏮", s: 18 },
    { x: 2305, y: 905, e: "🌫️", s: 30 }, { x: 2200, y: 1320, e: "🌲", s: 26 },
    { x: 2385, y: 680, e: "✨", s: 18 }, { x: 2565, y: 645, e: "🏆", s: 20 }, { x: 2705, y: 485, e: "👑", s: 22 },
    { x: 705, y: 1185, e: "🌊", s: 30 }, { x: 825, y: 1245, e: "🌊", s: 26 }, { x: 1005, y: 1335, e: "🌊", s: 30 },
  ],

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
    let html = `<svg id="route-svg" width="${this.MAP_W}" height="${this.MAP_H}" viewBox="0 0 ${this.MAP_W} ${this.MAP_H}"><path d="${d}"/></svg>`;

    html += [0, 1, 2, 3].map(i =>
      `<span class="map-cloud" style="top:${110 + i * 340}px;animation-duration:${70 + i * 24}s;animation-delay:-${i * 19}s">☁️</span>`).join("");
    html += this.MAP_DECOR.map(o =>
      `<span class="map-decor" style="left:${o.x}px;top:${o.y}px;font-size:${o.s}px">${o.e}</span>`).join("");
    html += this.MAP_CITIES.map(c =>
      `<div class="map-city" style="left:${c.x}px;top:${c.y}px"><span>${c.e}</span><b>${c.n}</b></div>`).join("");

    WORLDS.forEach((w, wi) => {
      const ns = nodes[wi];
      const unlocked = SAVE.worldUnlocked(wi);
      const maxStars = (w.levels.length + 1) * 3;
      const mid = ns[Math.floor(ns.length / 2)];
      html += `<div class="region-label" style="left:${mid.x}px;top:${mid.y - 138}px">
        <b>${w.emoji} ${w.name}</b><span>★ ${SAVE.worldStars(wi)}/${maxStars}</span></div>`;

      // wild Pokemon living on the map: color when caught, silhouette when not
      [[1, 1, -100], [4, 4, 105], [6, 7, -110]].forEach(([ci, ni, off], k) => {
        const c = CREATURES[wi][ci];
        const got = SAVE.state && SAVE.state.dex[`${wi}-${ci}`];
        const p = ns[ni];
        const ox = k === 1 ? off : 0, oy = k === 1 ? 26 : off;
        html += `<span class="map-poke ${got ? "" : "unknown"}" title="${got ? this.esc(c.n) : "???"}"
          style="left:${p.x + ox}px;top:${p.y + oy}px">${this.pokeHtml(c.id, c.e, { shiny: got && got.shiny, cls: "poke-img map-poke-img" })}</span>`;
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
          style="left:${p.x}px;top:${p.y}px" data-w="${wi}" data-s="${s}" ${open ? "" : "disabled"}
          title="${isBoss ? `BOSS: ${this.esc(w.boss.name)}` : this.esc(w.levels[s].name)}">
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

    // the player stands at their next challenge
    const f = this.mapFrontier();
    const fp = nodes[f.w][f.s];
    const avatar = SAVE.state && SAVE.state.profile ? SAVE.state.profile.avatar : "🧢";
    html += `<div class="map-marker" style="left:${fp.x}px;top:${fp.y - 62}px">${avatar}<i>▼</i></div>`;

    map.innerHTML = html;

    // soft terrain tint per region
    const blobs = WORLDS.map((w, i) => {
      const [ax, ay] = this.mapAnchors[i], [bx, by] = this.mapAnchors[i + 1];
      const cx = Math.round((ax + bx) / 2), cy = Math.round((ay + by) / 2);
      return `radial-gradient(740px 580px at ${cx}px ${cy}px, ${w.gradient[1]}59, transparent 72%)`;
    }).join(",");
    map.style.backgroundImage = `${blobs}, linear-gradient(180deg, #0d1830, #0c1a14)`;

    this.centerMapOn(fp.x, fp.y);
  },

  centerMapOn(x, y) {
    const vp = this.$("region-viewport").getBoundingClientRect();
    this.setMapPos(vp.width / 2 - x, vp.height / 2 - y);
  },

  setMapPos(x, y) {
    const vp = this.$("region-viewport").getBoundingClientRect();
    this.mapX = Math.min(0, Math.max(vp.width - this.MAP_W, x));
    this.mapY = Math.min(0, Math.max(vp.height - this.MAP_H, y));
    this.$("region-map").style.transform = `translate(${this.mapX}px, ${this.mapY}px)`;
  },

  bindMapPan() {
    const vp = this.$("region-viewport");
    let drag = null;
    vp.addEventListener("pointerdown", e => {
      drag = { sx: e.clientX, sy: e.clientY, ox: this.mapX, oy: this.mapY, moved: false };
      vp.classList.add("dragging");
      try { vp.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    });
    vp.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
      this.setMapPos(drag.ox + dx, drag.oy + dy);
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
      this.setMapPos(this.mapX - e.deltaX, this.mapY - e.deltaY);
    }, { passive: false });
    vp.addEventListener("click", e => {
      if (this._mapDragged) return;
      const b = e.target.closest(".mnode");
      if (b && !b.classList.contains("locked")) {
        SFX.init();
        Engine.startStage(+b.dataset.w, +b.dataset.s);
      }
    });
    this.$("btn-findme").addEventListener("click", e => {
      e.stopPropagation();
      SFX.click();
      const f = this.mapFrontier();
      const p = this.mapNodes()[f.w][f.s];
      this.centerMapOn(p.x, p.y);
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
    const on = e.getModifierState && e.getModifierState("CapsLock");
    this.$("capslock-warn").classList.toggle("hidden", !on);
  },

  // ---------- target animations ----------
  projHtml(S) {
    return S.world.projectile === "🔴" ? this.ballHtml() : S.world.projectile;
  },

  projectile(html, cb) {
    const arena = this.$("arena");
    const from = this.$("player-avatar").getBoundingClientRect();
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
    this.projectile(this.projHtml(S), () => {
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
        if (!got) return `<div class="dex-card unknown"><div class="dex-emoji">${this.pokeHtml(c.id, c.e)}</div><div class="dex-name">???</div></div>`;
        return `<div class="dex-card ${got.shiny ? "shiny" : ""}" style="--rc:${rar.color}">
          <div class="dex-emoji">${this.pokeHtml(c.id, c.e, { shiny: got.shiny })}</div>
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
      <div class="stat-card"><div class="stat-v">${SAVE.caughtCount()}</div><div class="stat-l">Pokemon</div></div>
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
      this.selectedDiff = "normal";
      const dgrid = this.$("diff-grid");
      dgrid.querySelectorAll(".diff-opt").forEach(x =>
        x.classList.toggle("sel", x.dataset.diff === "normal"));
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
