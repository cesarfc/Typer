// ============================================================
// TypeQuest — Puzzle Lab: a no-keyboard side building. Snap code blocks to
// guide a Pokemon through a grid, then catch it with the type-its-name
// ceremony.
//
// The program is a nested array of nodes ([{t:"walk"},{t:"repeat",n:4,body:[…]},
// {t:"if",cond:C,body:[…]},{t:"ifElse",cond:C,body:[…],else:[…]}]); the renderer
// and interpreter are BOTH recursive, so loops and ifs nest to any depth.
//
// The caret is a container path + index: {cont:"", idx:2} is the top-level plan,
// {cont:"0.body", idx:0} is inside the first block's body, {cont:"1.else", idx:1}
// inside an if/else's else lane. Palette taps insert at the caret wherever it is.
// ============================================================

const Puzzle = {
  stage: null,       // the mounted stage def
  program: [],       // the current plan (nested nodes)
  caret: { cont: "", idx: 0 }, // insertion slot: which body/else array + index
  hintIdx: 0,        // which escalating hint to show next
  playing: false,    // a run is animating
  _timer: null,      // active playback timeout
  _bonkIdx: 0,       // rotate the kind wall messages
  condPicker: null,  // the tap-only condition overlay element
  _condPath: null,   // which if/else card the picker is editing
  _cond: null,       // working condition model {a,join,b}

  $(id) { return document.getElementById(id); },

  // ---- direction maths (up=north, clockwise) ----
  DIRS: { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] },
  CW:  { up: "right", right: "down", down: "left", left: "up" },
  CCW: { up: "left", left: "down", down: "right", right: "up" },
  DEG: { up: 0, right: 90, down: 180, left: 270 },

  WALL_MSGS: [
    "Oof — a wall! 🌳 Which way should your Pokemon turn?",
    "Bonk! That's a tree in the way. Add a turn so it faces an open path.",
    "It bumped the edge of the meadow! Turn before walking that way.",
    "Splash! 💧 Water blocks the way too — turn before stepping in.",
  ],

  init() {
    // palette: tap a block to drop it at the glowing caret
    this.$("puzzle-palette").addEventListener("click", e => {
      const b = e.target.closest(".pz-pal");
      if (!b || this.playing) return;
      SFX.init();
      this.insertBlock(b.dataset.block);
    });

    // program canvas: steppers, condition chips, delete, and caret moves
    this.$("puzzle-program").addEventListener("click", e => {
      if (this.playing) return;
      const step = e.target.closest(".pz-step");
      if (step) { SFX.click(); this.stepRepeat(step.dataset.path, step.dataset.dir); return; }
      const chip = e.target.closest(".pz-cond");
      if (chip) { SFX.click(); this.openCondPicker(chip.dataset.path); return; }
      const del = e.target.closest(".pz-del");
      if (del) { SFX.init(); this.deleteBlock(del.dataset.path); return; }
      const slot = e.target.closest(".pz-caret, .pz-bodyslot");
      if (slot) { SFX.click(); this.caret = { cont: slot.dataset.cont, idx: +slot.dataset.idx }; this.renderProgram(); return; }
      const card = e.target.closest(".pz-card");
      if (card) { SFX.click(); this.caret = { cont: card.dataset.cont, idx: +card.dataset.idx + 1 }; this.renderProgram(); return; }
    });

    this.$("puzzle-run").addEventListener("click", () => { if (!this.playing) { SFX.init(); this.run(); } });
    this.$("puzzle-reset").addEventListener("click", () => { if (!this.playing) { SFX.click(); this.resetRun(); } });
    this.$("puzzle-hint").addEventListener("click", () => { SFX.click(); this.showHint(); });
    this.$("puzzle-back").addEventListener("click", () => { SFX.click(); this.stopPlayback(); this.closeCondPicker(); UI.show("lab"); });

    // the tap-only condition picker (built once, shown over the playfield)
    const cp = this.condPicker = document.createElement("div");
    cp.id = "puzzle-condpicker";
    cp.className = "hidden";
    cp.addEventListener("click", e => {
      if (e.target === cp) { this.closeCondPicker(); return; } // tap the dim backdrop
      const done = e.target.closest("[data-cpdone]");
      if (done) { SFX.click(); this.closeCondPicker(); return; }
      const sens = e.target.closest("[data-cpsensor]");
      if (sens) { SFX.click(); this._cond[sens.dataset.cpslot].sensor = sens.dataset.cpsensor; this.applyCond(); return; }
      const cmp = e.target.closest("[data-cpcmp]");
      if (cmp) { SFX.click(); this._cond[cmp.dataset.cpslot].cmp = cmp.dataset.cpcmp; this.applyCond(); return; }
      const val = e.target.closest("[data-cpval]");
      if (val) { SFX.click(); const s = this._cond[val.dataset.cpslot];
        s.val = Math.max(0, Math.min(20, s.val + (val.dataset.cpval === "inc" ? 1 : -1))); this.applyCond(); return; }
      const not = e.target.closest("[data-cpnot]");
      if (not) { SFX.click(); const s = this._cond[not.dataset.cpnot]; s.not = !s.not; this.applyCond(); return; }
      const join = e.target.closest("[data-cpjoin]");
      if (join) { SFX.click(); this._cond.join = join.dataset.cpjoin === "none" ? null : join.dataset.cpjoin; this.applyCond(); return; }
    });
    this.$("screen-puzzle").appendChild(cp);

    // the picker (wings + chapters + stage cards)
    this.$("lab-body").addEventListener("click", e => {
      const card = e.target.closest(".pz-stage");
      if (card) {
        SFX.init();
        if (card.classList.contains("locked")) {
          card.classList.remove("denied"); void card.offsetWidth; card.classList.add("denied");
          SFX.error();
          UI.toast(card.dataset.lock || "🔒 Finish the puzzle before it to open this one!");
        } else {
          this.openStage(card.dataset.stage);
        }
        return;
      }
      const wing = e.target.closest(".pz-wing.locked");
      if (wing) {
        SFX.error();
        UI.toast("🔢 The Math Wing opens after you finish the Loops chapter — keep coding!");
      }
    });
  },

  // ---------- picker ----------
  CH_NAMES: {
    code: { 1: "Chapter 1 · Moves", 2: "Chapter 2 · Loops", 3: "Chapter 3 · Ifs", 4: "Chapter 4 · Else", 5: "Chapter 5 · Logic" },
    math: { 1: "Chapter 1 · Counting", 2: "Chapter 2 · Times", 3: "Chapter 3 · Plus & Minus", 4: "Chapter 4 · Compare" },
  },
  chapterName(pack, ch) { return (this.CH_NAMES[pack] || {})[ch] || `Chapter ${ch}`; },

  // a chapter opens once every stage of the chapter before it has >=1 star
  chapterUnlocked(pack, ch) { return ch === 1 || SAVE.puzzleChapterComplete(pack, ch - 1); },
  // the whole Math Wing opens once the coding Loops chapter (ch.2) is finished
  mathWingOpen() { return SAVE.puzzleChapterComplete("code", 2); },

  stageUnlocked(idx, list) {
    if (idx === 0) return true;
    const prev = list[idx - 1];
    const rec = SAVE.state.puzzle[prev.id];
    return !!(rec && rec.stars > 0);
  },

  renderPicker() {
    const host = this.$("lab-body");
    let html = `<div class="pz-wing coding"><span class="pz-wing-e">💻</span>
      <div class="pz-wing-info"><b>Coding Wing</b><i>Guide Pokemon with blocks — walk, loop, and decide!</i></div></div>`;
    html += this.renderChapters("code");

    // Math wing — its gate is coding chapter 2 (Loops). Once Loops is finished
    // the whole wing opens and renders its own chapters right below.
    const mathOpen = this.mathWingOpen();
    html += `<div class="pz-wing math ${mathOpen ? "" : "locked"}"><span class="pz-wing-e">🔢</span>
      <div class="pz-wing-info"><b>Math Wing</b><i>${mathOpen
        ? "Numbers come alive — count, times-tables, number-line hops and comparing!"
        : "🔒 Finish the Loops chapter to open"}</i></div></div>`;
    if (mathOpen) html += this.renderChapters("math");

    host.innerHTML = html;
  },

  // render every chapter (and its stage cards) for one pack
  renderChapters(pack) {
    const chapters = [];
    PUZZLE_STAGES.filter(s => s.pack === pack).forEach(s => {
      let g = chapters.find(c => c.ch === s.chapter);
      if (!g) chapters.push(g = { ch: s.chapter, stages: [] });
      g.stages.push(s);
    });

    let html = "";
    chapters.forEach(g => {
      const chOpen = this.chapterUnlocked(pack, g.ch);
      html += `<h3 class="pz-chapter">${this.chapterName(pack, g.ch)}${chOpen ? "" : " 🔒"}</h3>`;
      if (!chOpen) {
        const prev = this.chapterName(pack, g.ch - 1).split("· ")[1] || "the chapter before";
        html += `<div class="pz-chapter-lock">Finish ${prev} to open these puzzles</div>`;
      }
      html += `<div class="pz-stage-grid">`;
      g.stages.forEach((s, i) => {
        const rec = SAVE.state.puzzle[s.id];
        const stars = rec ? rec.stars || 0 : 0;
        const open = chOpen && this.stageUnlocked(i, g.stages);
        const catchKey = s.reward && s.reward.catch;
        const uncaught = catchKey && !SAVE.state.dex[catchKey];
        let reward = "";
        if (catchKey) {
          const [w, ci] = catchKey.split("-").map(Number);
          const c = CREATURES[w][ci];
          reward = uncaught
            ? `<span class="pz-reward new" title="Solve to catch ${c.n}!">🐾 catch!</span>`
            : `<span class="pz-reward got" title="You caught ${c.n} here">✓ ${c.n}</span>`;
        }
        const badge = !open ? "🔒" : stars > 0 ? "✓" : (i + 1);
        const starRow = open
          ? `<span class="pz-stars">${"★".repeat(stars)}<span class="off">${"★".repeat(3 - stars)}</span></span>`
          : `<span class="pz-locknote">${chOpen ? "Finish the one before to open" : "Chapter locked"}</span>`;
        const lockMsg = !chOpen
          ? "🔒 Finish the chapter before it to open this one!"
          : "🔒 Finish the puzzle before it to open this one!";
        html += `<button class="pz-stage ${open ? "" : "locked"} ${stars > 0 ? "done" : ""} ${s.capstone ? "capstone" : ""}"
            data-stage="${s.id}" data-lock="${lockMsg}">
          <span class="pz-badge">${badge}</span>
          <span class="pz-info">
            <b>${UI.esc(s.name)}</b>
            <i>${UI.esc(s.concept)}</i>
            ${starRow}
          </span>
          ${reward}
        </button>`;
      });
      html += `</div>`;
    });
    return html;
  },

  // ---------- mount a stage ----------
  openStage(stageId) {
    const stage = PUZZLE_STAGES.find(s => s.id === stageId);
    if (!stage) return;
    this.stage = stage;
    this.program = [];
    this.caret = { cont: "", idx: 0 };
    this.hintIdx = 0;
    this.playing = false;
    this._bonkIdx = 0;
    this.closeCondPicker();
    UI.show("puzzle");
    const goalText = this.goalText(stage);
    this.$("puzzle-title").innerHTML = `<b>${UI.esc(stage.name)}</b><i>${goalText}</i>`;
    this.$("puzzle-goal").textContent = goalText;
    this.hideMsg();
    this.renderGrid();
    this.renderPalette();
    this.renderProgram();
    this.resetHud();
  },

  // is this a number-line stage (mechanic B) rather than a walk grid?
  isLine(st) { return (st || this.stage) && (st || this.stage).line != null; },

  goalText(st) {
    if (st.goal === "target") return `Land EXACTLY on ${st.need} 🏁`;
    if (st.goal === "collect") return `Grab all ${st.need} 🍒 and reach the flag 🏁`;
    return "Reach the flag 🏁";
  },

  // ---------- live HUD: a berry counter (A) or number-line total (B) ----------
  resetHud() {
    const st = this.stage;
    if (this.isLine(st)) this.setHud(st.start.x, 0);
    else if (st.goal === "collect") this.setHud(0, 0);
    else { this.$("puzzle-hud").className = "hidden"; this.$("puzzle-hud").innerHTML = ""; }
  },
  // for line stages pass (position); for collect stages pass (berries)
  setHud(a) {
    const st = this.stage, hud = this.$("puzzle-hud");
    if (this.isLine(st)) {
      hud.className = "pz-hud line";
      hud.innerHTML = `<span class="pz-hud-lbl">📍 On</span>
        <b class="pz-hud-num">${a}</b>
        <span class="pz-hud-sep">→ land on</span>
        <b class="pz-hud-goal">${st.need}</b>`;
    } else {
      const done = a >= st.need;
      hud.className = "pz-hud berries" + (done ? " full" : "");
      hud.innerHTML = `<span class="pz-hud-lbl">🍒 Berries</span>
        <b class="pz-hud-num">${a}</b><span class="pz-hud-sep">/</span><b class="pz-hud-goal">${st.need}</b>`;
    }
  },

  // ---------- grid + guide sprite ----------
  tileAt(x, y) {
    const g = this.stage.grid;
    if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return "#"; // edges are walls
    return g[y][x];
  },
  passable(x, y) { const t = this.tileAt(x, y); return t !== "#" && t !== "~"; },
  isGoal(x, y) { return this.tileAt(x, y) === "o"; },

  guideGlyph() {
    const catchKey = this.stage.reward && this.stage.reward.catch;
    if (catchKey) {
      const [w, i] = catchKey.split("-").map(Number);
      const c = CREATURES[w][i];
      return UI.pokeHtml(c.id, c.e, { cls: "poke-img pz-poke" });
    }
    const lead = SAVE.leadCreature();
    if (lead) return UI.pokeHtml(lead.id, lead.e, { cls: "poke-img pz-poke" });
    return `<span class="pz-poke-emoji">🐾</span>`;
  },

  spriteHtml() {
    return `<div id="puzzle-sprite" class="pz-sprite nomove">
      <span class="pz-shadow"></span>
      <span id="puzzle-face" class="pz-face">▲</span>
      <span class="pz-body">${this.guideGlyph()}</span></div>`;
  },

  renderGrid() {
    const host = this.$("puzzle-grid");
    host.classList.toggle("line", this.isLine());
    if (this.isLine()) return this.renderLine();
    const rows = this.stage.grid;
    const H = rows.length, W = rows[0].length;
    host.style.setProperty("--cols", W);
    host.style.setProperty("--rows", H);
    let html = "";
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = rows[y][x];
        let cls = "path", glyph = "";
        if (ch === "#") cls = "wall";
        else if (ch === "~") cls = "water";
        else if (ch === "*") { cls = "path berry"; glyph = `<span class="ptile-g">🍒</span>`; }
        else if (ch === "o") { cls = "path goal"; glyph = `<span class="ptile-g">🏁</span>`; }
        html += `<div class="ptile ${cls}" data-xy="${x}-${y}">${glyph}</div>`;
      }
    }
    html += this.spriteHtml();
    host.innerHTML = html;
    this.resetSpriteToStart();
  },

  // ---------- number line (mechanic B): a single row of numbered cells ----------
  renderLine() {
    const host = this.$("puzzle-grid");
    const N = this.stage.line;
    host.style.setProperty("--cols", N + 1);
    host.style.setProperty("--rows", 1);
    let html = "";
    for (let n = 0; n <= N; n++) {
      const target = n === this.stage.need;
      html += `<div class="pcell${target ? " target" : ""}" data-xy="${n}-0">
        ${target ? `<span class="pcell-flag">🏁</span>` : ""}
        <span class="pcell-num">${n}</span></div>`;
    }
    html += this.spriteHtml();
    host.innerHTML = html;
    this.resetSpriteToStart();
  },

  tileEl(x, y) { return this.$("puzzle-grid").querySelector(`.ptile[data-xy="${x}-${y}"]`); },

  setFacing(dir) {
    const face = this.$("puzzle-face");
    if (face) face.style.transform = `rotate(${this.DEG[dir]}deg)`;
  },

  resetSpriteToStart() {
    const spr = this.$("puzzle-sprite");
    if (spr) {
      spr.classList.add("nomove");
      spr.style.setProperty("--tx", this.stage.start.x);
      spr.style.setProperty("--ty", this.stage.start.y);
      this.setFacing(this.stage.start.dir);
      spr.classList.remove("pbonk", "phop");
      void spr.offsetWidth;
      spr.classList.remove("nomove");
    }
    this.$("puzzle-grid").querySelectorAll(".ptile.picked").forEach(t => t.classList.remove("picked"));
    this.clearHighlight();
  },

  // ---------- palette ----------
  signStr(v) { return (v < 0 ? "−" : "+") + Math.abs(v); },

  renderPalette() {
    const st = this.stage;
    let html = "";
    // signed hop buttons, one per value the stage offers (mechanic B)
    (st.hops || []).forEach(v => {
      const b = PUZZLE_BLOCKS.hop;
      html += `<button class="pz-pal cat-${b.cat}" data-block="hop:${v}" style="--pc:${b.c}">
        <span class="pz-pal-e">${b.e}</span><span class="pz-pal-l">hop ${this.signStr(v)}</span></button>`;
    });
    (st.blocks || []).forEach(key => {
      const b = PUZZLE_BLOCKS[key];
      html += `<button class="pz-pal cat-${b.cat}" data-block="${key}" style="--pc:${b.c}">
        <span class="pz-pal-e">${b.e}</span><span class="pz-pal-l">${b.label}</span></button>`;
    });
    this.$("puzzle-palette").innerHTML = html;
  },

  // build a fresh program node from a palette key ("hop:-3" carries its value)
  blockNode(key) {
    if (key.slice(0, 4) === "hop:") return { t: "hop", v: parseInt(key.slice(4), 10) };
    const b = PUZZLE_BLOCKS[key];
    return b ? JSON.parse(JSON.stringify(b.node)) : null;
  },

  // ---------- nested program model helpers ----------
  // parse a node path ("0.body.1") into its container path + index
  splitPath(path) {
    const dot = path.lastIndexOf(".");
    return dot === -1 ? { cont: "", idx: +path } : { cont: path.slice(0, dot), idx: +path.slice(dot + 1) };
  },
  // resolve a container path ("", "0.body", "1.else", "0.body.2.body") to its array
  getContainer(cont) {
    if (!cont) return this.program;
    const toks = cont.split(".");
    let arr = this.program;
    for (let i = 0; i < toks.length; i += 2) arr = arr[+toks[i]][toks[i + 1]];
    return arr;
  },
  nodeAt(path) { const { cont, idx } = this.splitPath(path); return this.getContainer(cont)[idx]; },

  insertBlock(key) {
    const node = this.blockNode(key);
    if (!node) return;
    if (this.countBlocks(this.program) >= 40) { UI.toast("That's a very long plan! Try removing a few blocks."); return; }
    // on comparison stages, if/ifElse default to a "berries ≥ 1" question
    if (node.cond && this.stage.compare) node.cond = { sensor: "berries", cmp: ">=", val: 1 };
    const arr = this.getContainer(this.caret.cont);
    arr.splice(this.caret.idx, 0, node);
    this.caret = { cont: this.caret.cont, idx: this.caret.idx + 1 };
    this.hideMsg();
    this.renderProgram();
  },

  deleteBlock(path) {
    const { cont, idx } = this.splitPath(path);
    const arr = this.getContainer(cont);
    if (idx < 0 || idx >= arr.length) return;
    if (this._condPath !== null) this.closeCondPicker();
    arr.splice(idx, 1);
    this.caret = { cont, idx }; // drop the caret where the block used to be
    this.hideMsg();
    this.renderProgram();
  },

  stepRepeat(path, dir) {
    const node = this.nodeAt(path);
    if (!node || node.t !== "repeat") return;
    node.n = Math.max(2, Math.min(10, (node.n || 2) + (dir === "inc" ? 1 : -1)));
    this.renderProgram();
  },

  // ---------- recursive renderer (C-shaped nesting) ----------
  caretEl(cont, idx) {
    const d = document.createElement("div");
    d.className = "pz-caret" + (this.caret.cont === cont && this.caret.idx === idx ? " on" : "");
    d.dataset.cont = cont; d.dataset.idx = idx;
    return d;
  },
  emptySlot(cont) {
    const d = document.createElement("div");
    d.className = "pz-bodyslot" + (this.caret.cont === cont && this.caret.idx === 0 ? " on" : "");
    d.dataset.cont = cont; d.dataset.idx = 0;
    d.textContent = "do this →";
    return d;
  },

  buildList(nodes, cont, isBody = false) {
    const frag = document.createDocumentFragment();
    if (nodes.length === 0) {
      frag.appendChild(isBody ? this.emptySlot(cont) : this.caretEl(cont, 0));
      return frag;
    }
    for (let i = 0; i <= nodes.length; i++) {
      frag.appendChild(this.caretEl(cont, i));
      if (i < nodes.length) frag.appendChild(this.buildCard(nodes[i], cont, i));
    }
    return frag;
  },

  buildCard(node, cont, idx) {
    const key = puzzleBlockKey(node);
    const b = PUZZLE_BLOCKS[key];
    const nodePath = cont === "" ? String(idx) : `${cont}.${idx}`;
    const card = document.createElement("div");
    card.className = `pz-card cat-${b.cat}${b.nest ? " pz-nest" : ""}`;
    card.dataset.path = nodePath;
    card.dataset.cont = cont;
    card.dataset.idx = idx;
    card.style.setProperty("--pc", b.c);

    const head = document.createElement("div");
    head.className = "pz-card-head";
    const label = node.t === "hop" ? `hop ${this.signStr(node.v)}` : b.label;
    let h = `<span class="pz-card-e">${b.e}</span><span class="pz-card-l">${label}</span>`;
    if (node.t === "repeat") {
      h += `<span class="pz-step-wrap">
        <button class="pz-step" data-path="${nodePath}" data-dir="dec" aria-label="fewer times">−</button>
        <b class="pz-step-n">${node.n}×</b>
        <button class="pz-step" data-path="${nodePath}" data-dir="inc" aria-label="more times">+</button></span>`;
    }
    if (b.hasCond) {
      h += `<button class="pz-cond" data-path="${nodePath}" title="Change the question">if ${UI.esc(this.condText(node.cond))}</button>`;
    }
    h += `<button class="pz-del" data-path="${nodePath}" title="Remove this block" aria-label="Remove block">✕</button>`;
    head.innerHTML = h;
    card.appendChild(head);

    if (b.nest) {
      const body = document.createElement("div");
      body.className = "pz-cbody";
      body.appendChild(this.buildList(node.body, `${nodePath}.body`, true));
      card.appendChild(body);
      if (b.hasElse) {
        const lbl = document.createElement("div");
        lbl.className = "pz-celse-label";
        lbl.textContent = "else";
        card.appendChild(lbl);
        const els = document.createElement("div");
        els.className = "pz-cbody";
        els.appendChild(this.buildList(node.else, `${nodePath}.else`, true));
        card.appendChild(els);
      }
    }
    return card;
  },

  renderProgram() {
    const host = this.$("puzzle-program");
    host.innerHTML = "";
    host.classList.toggle("empty", this.program.length === 0);
    host.appendChild(this.buildList(this.program, ""));
    if (this.program.length === 0) {
      const hint = document.createElement("div");
      hint.className = "pz-empty-hint";
      hint.textContent = "Tap a block above to start your plan!";
      host.appendChild(hint);
    }
    this.updateCount();
  },

  updateCount() {
    const n = this.countBlocks(this.program);
    this.$("puzzle-count").innerHTML = `🧱 ${n} block${n === 1 ? "" : "s"} · ⭐ ${this.stage.optimal} = perfect`;
  },

  countBlocks(nodes) {
    let n = 0;
    for (const node of nodes) {
      n++;
      if (node.body) n += this.countBlocks(node.body);
      if (node.else) n += this.countBlocks(node.else);
    }
    return n;
  },

  // ---------- condition picker (tap-only) ----------
  sensorLabel(s) { return (PUZZLE_SENSORS[s] || {}).label || s; },
  CMP_TEXT: { ">=": "≥", ">": ">", "<": "<", "=": "=" },
  cmpText(c) { return this.CMP_TEXT[c] || c; },
  condText(c) {
    if (!c) return "?";
    if (c.op === "not") return "NOT " + this.condText(c.a);
    if (c.op === "and") return this.condText(c.a) + " AND " + this.condText(c.b);
    if (c.op === "or")  return this.condText(c.a) + " OR "  + this.condText(c.b);
    if (c.sensor === "berries") return `berries ${this.cmpText(c.cmp || ">=")} ${c.val != null ? c.val : 1}`;
    return this.sensorLabel(c.sensor);
  },
  // condition object <-> flat working model
  // slot: {sensor, not, cmp, val}; top: {a, join, b}
  parseCond(c) {
    const one = x => {
      if (x && x.op === "not") return { sensor: x.a.sensor, not: true, cmp: ">=", val: 1 };
      if (x && x.sensor === "berries") return { sensor: "berries", not: false, cmp: x.cmp || ">=", val: x.val != null ? x.val : 1 };
      return { sensor: (x && x.sensor) || "pathAhead", not: false, cmp: ">=", val: 1 };
    };
    if (c && (c.op === "and" || c.op === "or")) return { a: one(c.a), join: c.op, b: one(c.b) };
    return { a: one(c), join: null, b: { sensor: "wallAhead", not: false, cmp: ">=", val: 1 } };
  },
  buildCond(m) {
    const one = s => {
      if (s.sensor === "berries") return { sensor: "berries", cmp: s.cmp || ">=", val: s.val };
      return s.not ? { op: "not", a: { sensor: s.sensor } } : { sensor: s.sensor };
    };
    return m.join ? { op: m.join, a: one(m.a), b: one(m.b) } : one(m.a);
  },
  // which sensors the picker offers: compare stages show only "berries",
  // everything else shows the look-ahead sensors
  pickerSensors() {
    return Object.entries(PUZZLE_SENSORS).filter(([, v]) =>
      this.stage.compare ? v.compare : !v.compare);
  },

  openCondPicker(path) {
    if (this.playing) return;
    const node = this.nodeAt(path);
    if (!node || !node.cond) return;
    this._condPath = path;
    this._cond = this.parseCond(node.cond);
    this.condPicker.classList.remove("hidden");
    this.renderCondPicker();
  },
  applyCond() {
    const node = this.nodeAt(this._condPath);
    if (node) node.cond = this.buildCond(this._cond);
    this.renderCondPicker();
    this.renderProgram();
  },
  closeCondPicker() {
    if (this.condPicker) this.condPicker.classList.add("hidden");
    this._condPath = null;
  },
  // the ≥ / > / < / = symbols + a number stepper shown for the berries sensor
  compareRow(slot) {
    const s = this._cond[slot];
    const syms = Object.keys(this.CMP_TEXT).map(c =>
      `<button class="pz-cp-sym ${s.cmp === c ? "on" : ""}" data-cpcmp="${c}" data-cpslot="${slot}">${this.cmpText(c)}</button>`).join("");
    return `<div class="pz-cp-compare">
      <div class="pz-cp-syms">${syms}</div>
      <div class="pz-cp-stepper">
        <button class="pz-step" data-cpval="dec" data-cpslot="${slot}" aria-label="fewer">−</button>
        <b class="pz-cp-val">${s.val}</b>
        <button class="pz-step" data-cpval="inc" data-cpslot="${slot}" aria-label="more">+</button>
      </div></div>`;
  },
  renderCondPicker() {
    const m = this._cond;
    const logic = !!this.stage.logic;
    const sensors = this.pickerSensors();
    const sensorBtns = slot => sensors.map(([k, v]) =>
      `<button class="pz-cp-sensor ${m[slot].sensor === k ? "on" : ""}" data-cpsensor="${k}" data-cpslot="${slot}">
        <span class="pz-cp-e">${v.e}</span>${v.label}</button>`).join("");
    // berries slot gets the compare row; other sensors get the NOT flip
    const slotCtl = slot => m[slot].sensor === "berries"
      ? this.compareRow(slot)
      : `<button class="pz-cp-not ${m[slot].not ? "on" : ""}" data-cpnot="${slot}">🔄 NOT (flip it)</button>`;
    let html = `<div class="pz-cp-card">
      <div class="pz-cp-title">${this.stage.compare ? "How many berries?" : "When should it happen?"}</div>
      <div class="pz-cp-row">${sensorBtns("a")}</div>
      ${slotCtl("a")}`;
    if (logic) {
      html += `<div class="pz-cp-join">
        <button class="${!m.join ? "on" : ""}" data-cpjoin="none">just this</button>
        <button class="${m.join === "and" ? "on" : ""}" data-cpjoin="and">AND</button>
        <button class="${m.join === "or" ? "on" : ""}" data-cpjoin="or">OR</button></div>`;
      if (m.join) {
        html += `<div class="pz-cp-row">${sensorBtns("b")}</div>
          ${slotCtl("b")}`;
      }
    }
    html += `<div class="pz-cp-preview">if <b>${UI.esc(this.condText(this.buildCond(m)))}</b></div>
      <button class="big-btn" data-cpdone>Done 👍</button></div>`;
    this.condPicker.innerHTML = html;
  },

  // ---------- interpreter: build a trace, then animate it ----------
  cmp(a, op, b) { return op === ">=" ? a >= b : op === ">" ? a > b : op === "<" ? a < b : a === b; },

  // does a body (recursively) contain a collect? used for the ×-table banner
  hasCollect(nodes) {
    for (const n of nodes) {
      if (n.t === "collect") return true;
      if (n.body && this.hasCollect(n.body)) return true;
      if (n.else && this.hasCollect(n.else)) return true;
    }
    return false;
  },
  // read the multiplication fact off the winning program: an outermost repeat
  // whose every pass collected the SAME m ≥ 2 berries → "n groups of m = n·m"
  deriveMulFact(groupings, total) {
    const valid = groupings.filter(g =>
      g.deltas.length === g.n && g.n >= 2 && g.deltas[0] >= 2 && g.deltas.every(d => d === g.deltas[0]));
    if (!valid.length) return null;
    const depth = g => g.path.split(".").length;
    valid.sort((a, b) =>
      ((a.n * a.deltas[0] === total ? 0 : 1) - (b.n * b.deltas[0] === total ? 0 : 1)) || depth(a) - depth(b));
    const g = valid[0];
    return { n: g.n, m: g.deltas[0], total: g.n * g.deltas[0] };
  },

  simulate() {
    if (this.isLine()) return this.simulateLine();
    const st = this.stage;
    const self = this;
    let x = st.start.x, y = st.start.y, dir = st.start.dir;
    const collected = new Set();
    let berries = 0;
    const need = st.goal === "collect" ? (st.need || 0) : 0;
    const frames = [];
    const groupings = []; // per-repeat berry deltas, for the multiplication banner
    let steps = 0, outcome = "incomplete";
    const BUDGET = 200;

    const met = () => self.isGoal(x, y) && berries >= need;

    const sensorTrue = name => {
      const [dx, dy] = self.DIRS[dir];
      const nx = x + dx, ny = y + dy;
      if (name === "pathAhead")  return self.passable(nx, ny);
      if (name === "wallAhead")  return self.tileAt(nx, ny) === "#";
      if (name === "waterAhead") return self.tileAt(nx, ny) === "~";
      if (name === "berryAhead") return self.tileAt(nx, ny) === "*" && !collected.has(`${nx},${ny}`);
      if (name === "onBerry")    return self.tileAt(x, y) === "*" && !collected.has(`${x},${y}`);
      return false;
    };
    const evalCond = c => {
      if (!c) return false;
      if (c.op === "not") return !evalCond(c.a);
      if (c.op === "and") return evalCond(c.a) && evalCond(c.b);
      if (c.op === "or")  return evalCond(c.a) || evalCond(c.b);
      if (c.sensor === "berries") return self.cmp(berries, c.cmp || ">=", c.val != null ? c.val : 0);
      return sensorTrue(c.sensor);
    };

    function exec(nodes, base) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const path = base === "" ? String(i) : `${base}.${i}`;
        if (++steps > BUDGET) { outcome = "overbudget"; return false; }
        if (node.t === "walk") {
          const [dx, dy] = self.DIRS[dir];
          const nx = x + dx, ny = y + dy;
          if (!self.passable(nx, ny)) {
            frames.push({ path, type: "bonk", x, y, dir, berries });
            outcome = "bonk"; return false;
          }
          x = nx; y = ny;
          const f = { path, type: "move", x, y, dir, berries };
          frames.push(f);
          if (met()) { f.win = true; outcome = "win"; return false; }
        } else if (node.t === "turn") {
          dir = node.d === "left" ? self.CCW[dir] : self.CW[dir];
          frames.push({ path, type: "turn", x, y, dir, berries });
        } else if (node.t === "collect") {
          const key = `${x},${y}`;
          let got = false;
          if (self.tileAt(x, y) === "*" && !collected.has(key)) { collected.add(key); berries++; got = true; }
          const f = { path, type: "collect", x, y, dir, berries, got };
          frames.push(f);
          if (met()) { f.win = true; outcome = "win"; return false; }
        } else if (node.t === "repeat") {
          const times = node.n || 1;
          const track = self.hasCollect(node.body);
          const deltas = [];
          for (let r = 0; r < times; r++) {
            // count each loop pass so runaway loops still hit the budget
            if (++steps > BUDGET) { outcome = "overbudget"; return false; }
            const before = berries;
            const ok = exec(node.body, `${path}.body`);
            deltas.push(berries - before);
            if (!ok) { if (track) groupings.push({ path, n: times, deltas }); return false; }
          }
          if (track) groupings.push({ path, n: times, deltas });
        } else if (node.t === "if") {
          if (evalCond(node.cond)) { if (!exec(node.body, `${path}.body`)) return false; }
        } else if (node.t === "ifElse") {
          if (evalCond(node.cond)) { if (!exec(node.body, `${path}.body`)) return false; }
          else { if (!exec(node.else, `${path}.else`)) return false; }
        }
      }
      return true;
    }

    exec(this.program, "");
    const blocks = this.countBlocks(this.program);
    let stars = 0;
    if (outcome === "win") stars = blocks <= st.optimal ? 3 : blocks <= st.budget ? 2 : 1;
    const mulFact = outcome === "win" ? this.deriveMulFact(groupings, berries) : null;
    return { frames, outcome, blocks, stars, mulFact, total: berries };
  },

  // ---------- number-line interpreter (mechanic B): signed hops ----------
  // Position clamps to 0..N — a hop that would leave the line BOUNCES (a kind
  // retry). The win is decided when the program ENDS: land exactly on `need`.
  simulateLine() {
    const st = this.stage;
    const self = this;
    const N = st.line, need = st.need;
    let p = st.start.x;
    const frames = [];
    let steps = 0, outcome = "incomplete";
    const BUDGET = 200;

    function exec(nodes, base) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const path = base === "" ? String(i) : `${base}.${i}`;
        if (++steps > BUDGET) { outcome = "overbudget"; return false; }
        if (node.t === "hop") {
          const np = p + node.v;
          if (np < 0 || np > N) {
            frames.push({ path, type: "bounce", x: p, y: 0, dir: "right", total: p, v: node.v });
            outcome = "bounce"; return false;
          }
          p = np;
          frames.push({ path, type: "hop", x: p, y: 0, dir: "right", total: p });
        } else if (node.t === "repeat") {
          const times = node.n || 1;
          for (let r = 0; r < times; r++) {
            if (++steps > BUDGET) { outcome = "overbudget"; return false; }
            if (!exec(node.body, `${path}.body`)) return false;
          }
        }
      }
      return true;
    }

    exec(this.program, "");
    if (outcome === "incomplete" && p === need) {
      outcome = "win";
      if (frames.length) frames[frames.length - 1].win = true;
    }
    const blocks = this.countBlocks(this.program);
    let stars = 0;
    if (outcome === "win") stars = blocks <= st.optimal ? 3 : blocks <= st.budget ? 2 : 1;
    return { frames, outcome, blocks, stars, mulFact: null, total: p, landed: p };
  },

  run() {
    if (this.playing || !this.stage) return;
    this.closeCondPicker();
    const sim = this.simulate();
    if (!sim.frames.length) { this.showHintMsg("Add some blocks first, then press ▶ Run!"); return; }
    this.playing = true;
    this.$("screen-puzzle").classList.add("playing");
    this.hideMsg();
    this.resetSpriteToStart();
    const STEP = 460;
    let k = 0;
    const step = () => {
      const f = sim.frames[k];
      this.highlightBlock(f.path);
      this.applyFrame(f);
      if (f.type === "bonk" || f.type === "bounce") { this._timer = setTimeout(() => this.endRun(sim, f), 560); return; }
      if (f.win) { this._timer = setTimeout(() => this.endRun(sim, f), 620); return; }
      k++;
      if (k >= sim.frames.length) { this._timer = setTimeout(() => this.endRun(sim, null), 420); return; }
      this._timer = setTimeout(step, STEP);
    };
    this._timer = setTimeout(step, 220);
  },

  applyFrame(f) {
    const spr = this.$("puzzle-sprite");
    if (!spr) return;
    spr.style.setProperty("--tx", f.x);
    spr.style.setProperty("--ty", f.y);
    this.setFacing(f.dir);
    // live HUD: number-line total (B) or berry counter (A)
    if (this.isLine()) this.setHud(f.total != null ? f.total : f.x);
    else if (this.stage.goal === "collect") this.setHud(f.berries || 0);
    if (f.type === "move") SFX.click();
    else if (f.type === "turn") SFX.click(3);
    else if (f.type === "hop") {
      SFX.click();
      spr.classList.remove("phop"); void spr.offsetWidth; spr.classList.add("phop");
    } else if (f.type === "collect" && f.got) {
      SFX.word();
      const t = this.tileEl(f.x, f.y);
      if (t) t.classList.add("picked");
      spr.classList.remove("phop"); void spr.offsetWidth; spr.classList.add("phop");
    } else if (f.type === "bonk" || f.type === "bounce") {
      SFX.error();
      spr.classList.remove("pbonk"); void spr.offsetWidth; spr.classList.add("pbonk");
    }
  },

  highlightBlock(path) {
    this.clearHighlight();
    const el = this.$("puzzle-program").querySelector(`.pz-card[data-path="${path}"]`);
    if (el) el.classList.add("pz-active");
  },
  clearHighlight() {
    this.$("puzzle-program").querySelectorAll(".pz-active, .pz-bonkcard")
      .forEach(e => e.classList.remove("pz-active", "pz-bonkcard"));
  },

  endRun(sim, f) {
    this.playing = false;
    this.$("screen-puzzle").classList.remove("playing");
    if (sim.outcome === "win") { this.onWin(sim); return; }
    if (sim.outcome === "bonk" || sim.outcome === "bounce") {
      if (f) {
        const card = this.$("puzzle-program").querySelector(`.pz-card[data-path="${f.path}"]`);
        if (card) card.classList.add("pz-bonkcard");
      }
      if (sim.outcome === "bounce") {
        this.showHintMsg("Whoa! That hop would leap right off the number line. 🦶 Try a smaller hop so you stay on the numbers!");
      } else {
        this.showHintMsg(this.WALL_MSGS[this._bonkIdx++ % this.WALL_MSGS.length]);
      }
      return;
    }
    if (sim.outcome === "overbudget") {
      this.showHintMsg("Phew! Your Pokemon got dizzy going in circles — let's try a shorter plan! 🌀");
      return;
    }
    const st = this.stage;
    let msg;
    if (this.isLine(st)) msg = `So close! You landed on <b>${sim.landed}</b>, but the flag 🏁 is on <b>${st.need}</b>. Tweak your hops to land exactly right! 🎯`;
    else if (st.goal === "collect") msg = "So close! Grab every 🍒 berry AND land on the flag 🏁. Add a few more blocks! 💪";
    else msg = "So close! Your Pokemon didn't reach the flag 🏁 yet — add a few more blocks! 💪";
    this.showHintMsg(msg);
  },

  onWin(sim) {
    const stage = this.stage;
    const res = SAVE.applyPuzzle(stage.id, sim.stars, sim.blocks);
    const catchKey = stage.reward && stage.reward.catch;
    const willCatch = catchKey && !SAVE.state.dex[catchKey];
    UI.confetti();
    SFX.fanfare();
    for (let i = 0; i < sim.stars; i++) setTimeout(() => SFX.star(i), 250 + i * 320);
    this.showWinCard(sim, res, willCatch, catchKey);
    // trophies (🧩 first solve, 💻 all-coding) toast over the win card
    (res.newTrophies || []).forEach((t, i) => setTimeout(() => UI.trophyToast(t), 950 + i * 850));
  },

  showWinCard(sim, res, willCatch, catchKey) {
    const starHtml = `<span class="pz-win-stars">${"★".repeat(sim.stars)}<span class="off">${"★".repeat(3 - sim.stars)}</span></span>`;
    // the math celebration reads straight off the program / result
    let mathBanner = "";
    if (sim.mulFact) {
      const { n, m, total } = sim.mulFact;
      mathBanner = `<div class="pz-win-math">${n} groups of ${m} = ${total}! ✨</div>`;
    } else if (this.isLine()) {
      mathBanner = `<div class="pz-win-math">You landed right on ${this.stage.need}! 🎯</div>`;
    } else if (this.stage.goal === "collect") {
      mathBanner = `<div class="pz-win-math">You collected all ${sim.total} 🍒!</div>`;
    }
    let note;
    if (sim.stars === 3) note = "Perfect! You used the fewest blocks possible! 🌟";
    else if (sim.stars === 2) note = `Nice and tidy! Solve it in <b>${this.stage.optimal}</b> blocks for 3 stars.`;
    else note = `You did it! Try a shorter plan (<b>${this.stage.optimal}</b> blocks) for more stars.`;

    let buttons;
    if (willCatch) {
      const [w, i] = catchKey.split("-").map(Number);
      const c = CREATURES[w][i];
      buttons = `<button class="big-btn" data-act="catch" data-catch="${catchKey}">🎁 Meet ${UI.esc(c.n)}! ▶</button>
        <button class="mid-btn" data-act="replay">↺ Play again</button>`;
    } else {
      buttons = `<button class="big-btn" data-act="lab">🧩 Back to Lab</button>
        <button class="mid-btn" data-act="replay">↺ Play again</button>`;
    }

    const box = this.$("puzzle-msg");
    box.className = "pz-msg win";
    box.innerHTML = `<div class="pz-win-title">🎉 Puzzle solved!</div>
      ${mathBanner}
      ${starHtml}
      <div class="pz-win-note">${note}</div>
      <div class="pz-win-xp">+${res.xp} XP</div>
      <div class="pz-win-btns">${buttons}</div>`;

    box.onclick = e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      SFX.init();
      const act = btn.dataset.act;
      if (act === "lab") UI.show("lab");
      else if (act === "replay") { this.hideMsg(); this.resetRun(); }
      else if (act === "catch") {
        const c = SAVE.puzzleCatchPick(btn.dataset.catch);
        if (c) Engine.startPuzzleCatch(c, this.stage.id);
        else UI.show("lab");
      }
    };
  },

  // ---------- hint + messages ----------
  showHint() {
    const hints = this.stage.hints || [];
    if (!hints.length) return;
    const msg = hints[Math.min(this.hintIdx, hints.length - 1)];
    this.hintIdx = Math.min(this.hintIdx + 1, hints.length - 1);
    this.showHintMsg("💡 " + msg);
  },

  showHintMsg(text) {
    const box = this.$("puzzle-msg");
    box.className = "pz-msg hint";
    box.innerHTML = `<div class="pz-hint-text">${text}</div>
      <button class="pz-hint-close" data-act="replay" title="Got it">Got it 👍</button>`;
    box.onclick = e => {
      if (e.target.closest("[data-act]")) { SFX.click(); this.hideMsg(); this.resetRun(); }
    };
  },

  hideMsg() {
    const box = this.$("puzzle-msg");
    box.className = "hidden";
    box.innerHTML = "";
    box.onclick = null;
  },

  // ---- Reset: send the Pokemon back to start (keeps the program) ----
  resetRun() {
    this.stopPlayback();
    this.hideMsg();
    this.resetSpriteToStart();
    this.resetHud();
  },

  stopPlayback() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.playing = false;
    const scr = this.$("screen-puzzle");
    if (scr) scr.classList.remove("playing");
  },
};
