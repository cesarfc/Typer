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
      const wing = e.target.closest(".pz-wing.locked, .pz-wing.ready");
      if (wing) {
        SFX.error();
        UI.toast(wing.classList.contains("ready")
          ? "🔢 The Math Wing is unlocked — its number puzzles arrive very soon!"
          : "🔢 The Math Wing opens after you finish the Loops chapter — keep coding!");
      }
    });
  },

  // ---------- picker ----------
  CH_NAMES: { 1: "Chapter 1 · Moves", 2: "Chapter 2 · Loops", 3: "Chapter 3 · Ifs", 4: "Chapter 4 · Else", 5: "Chapter 5 · Logic" },
  chapterName(pack, ch) { return pack === "code" ? (this.CH_NAMES[ch] || `Chapter ${ch}`) : `Chapter ${ch}`; },

  // a chapter opens once every stage of the chapter before it has >=1 star
  chapterUnlocked(ch) { return ch === 1 || SAVE.puzzleChapterComplete("code", ch - 1); },

  stageUnlocked(idx, list) {
    if (idx === 0) return true;
    const prev = list[idx - 1];
    const rec = SAVE.state.puzzle[prev.id];
    return !!(rec && rec.stars > 0);
  },

  renderPicker() {
    const host = this.$("lab-body");
    const code = PUZZLE_STAGES.filter(s => s.pack === "code");
    const chapters = [];
    code.forEach(s => {
      let g = chapters.find(c => c.ch === s.chapter);
      if (!g) chapters.push(g = { ch: s.chapter, stages: [] });
      g.stages.push(s);
    });

    let html = `<div class="pz-wing coding"><span class="pz-wing-e">💻</span>
      <div class="pz-wing-info"><b>Coding Wing</b><i>Guide Pokemon with blocks — walk, loop, and decide!</i></div></div>`;

    chapters.forEach(g => {
      const chOpen = this.chapterUnlocked(g.ch);
      html += `<h3 class="pz-chapter">${this.chapterName("code", g.ch)}${chOpen ? "" : " 🔒"}</h3>`;
      if (!chOpen) {
        html += `<div class="pz-chapter-lock">Finish ${this.chapterName("code", g.ch - 1).split("· ")[1] || "the chapter before"} to open these puzzles</div>`;
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

    // Math wing — its gate is coding chapter 2 (Loops). It flips to "ready" the
    // moment Loops is finished; the number puzzles themselves ship in Phase 3.
    const mathReady = SAVE.puzzleChapterComplete("code", 2);
    html += `<h3 class="pz-chapter">More Wings</h3>
      <div class="pz-wing ${mathReady ? "ready" : "locked"}"><span class="pz-wing-e">🔢</span>
      <div class="pz-wing-info"><b>Math Wing</b><i>${mathReady
        ? "✅ Unlocked! Number puzzles arrive soon"
        : "🔒 Finish the Loops chapter to open"}</i></div></div>`;

    host.innerHTML = html;
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
    const goalText = stage.goal === "collect"
      ? `Grab all ${stage.need} 🍒 and reach the flag 🏁`
      : "Reach the flag 🏁";
    this.$("puzzle-title").innerHTML = `<b>${UI.esc(stage.name)}</b><i>${goalText}</i>`;
    this.$("puzzle-goal").textContent = goalText;
    this.hideMsg();
    this.renderGrid();
    this.renderPalette();
    this.renderProgram();
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

  renderGrid() {
    const host = this.$("puzzle-grid");
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
    html += `<div id="puzzle-sprite" class="pz-sprite nomove">
      <span class="pz-shadow"></span>
      <span id="puzzle-face" class="pz-face">▲</span>
      <span class="pz-body">${this.guideGlyph()}</span></div>`;
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
  renderPalette() {
    this.$("puzzle-palette").innerHTML = this.stage.blocks.map(key => {
      const b = PUZZLE_BLOCKS[key];
      return `<button class="pz-pal cat-${b.cat}" data-block="${key}" style="--pc:${b.c}">
        <span class="pz-pal-e">${b.e}</span><span class="pz-pal-l">${b.label}</span></button>`;
    }).join("");
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
    const b = PUZZLE_BLOCKS[key];
    if (!b) return;
    if (this.countBlocks(this.program) >= 40) { UI.toast("That's a very long plan! Try removing a few blocks."); return; }
    const arr = this.getContainer(this.caret.cont);
    arr.splice(this.caret.idx, 0, JSON.parse(JSON.stringify(b.node)));
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
    let h = `<span class="pz-card-e">${b.e}</span><span class="pz-card-l">${b.label}</span>`;
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
  condText(c) {
    if (!c) return "?";
    if (c.op === "not") return "NOT " + this.condText(c.a);
    if (c.op === "and") return this.condText(c.a) + " AND " + this.condText(c.b);
    if (c.op === "or")  return this.condText(c.a) + " OR "  + this.condText(c.b);
    return this.sensorLabel(c.sensor);
  },
  // condition object <-> flat working model {a:{sensor,not}, join, b:{sensor,not}}
  parseCond(c) {
    const one = x => (x && x.op === "not")
      ? { sensor: x.a.sensor, not: true }
      : { sensor: (x && x.sensor) || "pathAhead", not: false };
    if (c && (c.op === "and" || c.op === "or")) return { a: one(c.a), join: c.op, b: one(c.b) };
    return { a: one(c), join: null, b: { sensor: "wallAhead", not: false } };
  },
  buildCond(m) {
    const one = s => s.not ? { op: "not", a: { sensor: s.sensor } } : { sensor: s.sensor };
    return m.join ? { op: m.join, a: one(m.a), b: one(m.b) } : one(m.a);
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
  renderCondPicker() {
    const m = this._cond;
    const logic = !!this.stage.logic;
    const sensorBtns = slot => Object.entries(PUZZLE_SENSORS).map(([k, v]) =>
      `<button class="pz-cp-sensor ${m[slot].sensor === k ? "on" : ""}" data-cpsensor="${k}" data-cpslot="${slot}">
        <span class="pz-cp-e">${v.e}</span>${v.label}</button>`).join("");
    let html = `<div class="pz-cp-card">
      <div class="pz-cp-title">When should it happen?</div>
      <div class="pz-cp-row">${sensorBtns("a")}</div>
      <button class="pz-cp-not ${m.a.not ? "on" : ""}" data-cpnot="a">🔄 NOT (flip it)</button>`;
    if (logic) {
      html += `<div class="pz-cp-join">
        <button class="${!m.join ? "on" : ""}" data-cpjoin="none">just this</button>
        <button class="${m.join === "and" ? "on" : ""}" data-cpjoin="and">AND</button>
        <button class="${m.join === "or" ? "on" : ""}" data-cpjoin="or">OR</button></div>`;
      if (m.join) {
        html += `<div class="pz-cp-row">${sensorBtns("b")}</div>
          <button class="pz-cp-not ${m.b.not ? "on" : ""}" data-cpnot="b">🔄 NOT (flip it)</button>`;
      }
    }
    html += `<div class="pz-cp-preview">if <b>${UI.esc(this.condText(this.buildCond(m)))}</b></div>
      <button class="big-btn" data-cpdone>Done 👍</button></div>`;
    this.condPicker.innerHTML = html;
  },

  // ---------- interpreter: build a trace, then animate it ----------
  simulate() {
    const st = this.stage;
    const self = this;
    let x = st.start.x, y = st.start.y, dir = st.start.dir;
    const collected = new Set();
    let berries = 0;
    const need = st.goal === "collect" ? (st.need || 0) : 0;
    const frames = [];
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
          for (let r = 0; r < times; r++) {
            // count each loop pass so runaway loops still hit the budget
            if (++steps > BUDGET) { outcome = "overbudget"; return false; }
            if (!exec(node.body, `${path}.body`)) return false;
          }
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
    return { frames, outcome, blocks, stars };
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
      if (f.type === "bonk") { this._timer = setTimeout(() => this.endRun(sim, f), 560); return; }
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
    if (f.type === "move") SFX.click();
    else if (f.type === "turn") SFX.click(3);
    else if (f.type === "collect" && f.got) {
      SFX.word();
      const t = this.tileEl(f.x, f.y);
      if (t) t.classList.add("picked");
      spr.classList.remove("phop"); void spr.offsetWidth; spr.classList.add("phop");
    } else if (f.type === "bonk") {
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
    if (sim.outcome === "bonk") {
      if (f) {
        const card = this.$("puzzle-program").querySelector(`.pz-card[data-path="${f.path}"]`);
        if (card) card.classList.add("pz-bonkcard");
      }
      this.showHintMsg(this.WALL_MSGS[this._bonkIdx++ % this.WALL_MSGS.length]);
      return;
    }
    if (sim.outcome === "overbudget") {
      this.showHintMsg("Phew! Your Pokemon got dizzy going in circles — let's try a shorter plan! 🌀");
      return;
    }
    const st = this.stage;
    const msg = st.goal === "collect"
      ? "So close! Grab every 🍒 berry AND land on the flag 🏁. Add a few more blocks! 💪"
      : "So close! Your Pokemon didn't reach the flag 🏁 yet — add a few more blocks! 💪";
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
  },

  stopPlayback() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.playing = false;
    const scr = this.$("screen-puzzle");
    if (scr) scr.classList.remove("playing");
  },
};
