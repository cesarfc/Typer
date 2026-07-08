// ============================================================
// TypeQuest — Puzzle Lab: a no-keyboard side building. Snap code blocks to
// guide a Pokemon through a grid, then catch it with the type-its-name
// ceremony. Phase 1 = Coding Chapter 1 (walk / turn / collect).
//
// The program is a nested array of nodes ([{t:"walk"},{t:"turn",d:"right"},
// {t:"collect"}]); the renderer and interpreter are both recursive over
// `node.body`, so repeat/if slot in cleanly in Phase 2 without a rewrite.
// ============================================================

const Puzzle = {
  stage: null,       // the mounted stage def
  program: [],       // the current plan (nodes)
  caret: 0,          // insertion index into the top-level program
  hintIdx: 0,        // which escalating hint to show next
  playing: false,    // a run is animating
  _timer: null,      // active playback timeout
  _bonkIdx: 0,       // rotate the kind wall messages

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
  ],

  init() {
    // palette: tap a block to drop it at the glowing caret
    this.$("puzzle-palette").addEventListener("click", e => {
      const b = e.target.closest(".pz-pal");
      if (!b || this.playing) return;
      SFX.init();
      this.insertBlock(b.dataset.block);
    });

    // program: ✕ deletes; tapping a block moves the caret after it
    this.$("puzzle-program").addEventListener("click", e => {
      if (this.playing) return;
      const del = e.target.closest(".pz-del");
      if (del) { SFX.init(); this.deleteBlock(+del.dataset.del); return; }
      const card = e.target.closest(".pz-card");
      if (card) { SFX.click(); this.caret = +card.dataset.path + 1; this.renderProgram(); return; }
      const caret = e.target.closest(".pz-caret");
      if (caret && caret.dataset.at !== undefined) { SFX.click(); this.caret = +caret.dataset.at; this.renderProgram(); }
    });

    this.$("puzzle-run").addEventListener("click", () => { if (!this.playing) { SFX.init(); this.run(); } });
    this.$("puzzle-reset").addEventListener("click", () => { if (!this.playing) { SFX.click(); this.resetRun(); } });
    this.$("puzzle-hint").addEventListener("click", () => { SFX.click(); this.showHint(); });
    this.$("puzzle-back").addEventListener("click", () => { SFX.click(); this.stopPlayback(); UI.show("lab"); });

    // the picker (wings + chapters + stage cards)
    this.$("lab-body").addEventListener("click", e => {
      const card = e.target.closest(".pz-stage");
      if (card) {
        SFX.init();
        if (card.classList.contains("locked")) {
          card.classList.remove("denied"); void card.offsetWidth; card.classList.add("denied");
          SFX.error();
          UI.toast("🔒 Finish the puzzle before it to open this one!");
        } else {
          this.openStage(card.dataset.stage);
        }
        return;
      }
      const wing = e.target.closest(".pz-wing.locked");
      if (wing) { SFX.error(); UI.toast("🔢 The Math Wing opens after you finish the Loops chapter — coming soon!"); }
    });

    // win/hint card actions
    this.$("puzzle-msg").addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      SFX.init();
      const act = btn.dataset.act;
      if (act === "lab") { UI.show("lab"); }
      else if (act === "replay") { this.hideMsg(); this.resetRun(); }
      else if (act === "catch") {
        const c = SAVE.puzzleCatchPick(btn.dataset.catch);
        if (c) Engine.startPuzzleCatch(c, this.stage.id);
        else UI.show("lab");
      }
    });
  },

  // ---------- picker ----------
  chapterName(pack, ch) {
    return pack === "code" ? ({ 1: "Chapter 1 · Moves" }[ch] || `Chapter ${ch}`) : `Chapter ${ch}`;
  },

  stageUnlocked(idx, list) {
    if (idx === 0) return true;
    const prev = list[idx - 1];
    const rec = SAVE.state.puzzle[prev.id];
    return !!(rec && rec.stars > 0);
  },

  renderPicker() {
    const host = this.$("lab-body");
    const code = PUZZLE_STAGES.filter(s => s.pack === "code");
    // group by chapter (P1 only has chapter 1)
    const chapters = [];
    code.forEach(s => {
      let g = chapters.find(c => c.ch === s.chapter);
      if (!g) chapters.push(g = { ch: s.chapter, stages: [] });
      g.stages.push(s);
    });

    let html = `<div class="pz-wing coding"><span class="pz-wing-e">💻</span>
      <div class="pz-wing-info"><b>Coding Wing</b><i>Guide Pokemon with blocks — walk, turn and collect!</i></div></div>`;

    chapters.forEach(g => {
      html += `<h3 class="pz-chapter">${this.chapterName("code", g.ch)}</h3><div class="pz-stage-grid">`;
      g.stages.forEach((s, i) => {
        const rec = SAVE.state.puzzle[s.id];
        const stars = rec ? rec.stars || 0 : 0;
        const open = this.stageUnlocked(i, g.stages);
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
          : `<span class="pz-locknote">Finish the one before to open</span>`;
        html += `<button class="pz-stage ${open ? "" : "locked"} ${stars > 0 ? "done" : ""} ${s.capstone ? "capstone" : ""}" data-stage="${s.id}">
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

    // Math wing — a locked teaser (no math stages ship in Phase 1)
    html += `<h3 class="pz-chapter">More Wings</h3>
      <div class="pz-wing locked"><span class="pz-wing-e">🔢</span>
      <div class="pz-wing-info"><b>Math Wing</b><i>🔒 Finish the Loops chapter to open</i></div></div>`;

    host.innerHTML = html;
  },

  // ---------- mount a stage ----------
  openStage(stageId) {
    const stage = PUZZLE_STAGES.find(s => s.id === stageId);
    if (!stage) return;
    this.stage = stage;
    this.program = [];
    this.caret = 0;
    this.hintIdx = 0;
    this.playing = false;
    this._bonkIdx = 0;
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

  // ---------- palette + program editor ----------
  renderPalette() {
    this.$("puzzle-palette").innerHTML = this.stage.blocks.map(key => {
      const b = PUZZLE_BLOCKS[key];
      return `<button class="pz-pal cat-${b.cat}" data-block="${key}" style="--pc:${b.c}">
        <span class="pz-pal-e">${b.e}</span><span class="pz-pal-l">${b.label}</span></button>`;
    }).join("");
  },

  insertBlock(key) {
    const b = PUZZLE_BLOCKS[key];
    if (!b) return;
    if (this.program.length >= 40) { UI.toast("That's a very long plan! Try removing a few blocks."); return; }
    this.program.splice(this.caret, 0, JSON.parse(JSON.stringify(b.node)));
    this.caret++;
    this.hideMsg();
    this.renderProgram();
  },

  deleteBlock(idx) {
    if (idx < 0 || idx >= this.program.length) return;
    this.program.splice(idx, 1);
    if (this.caret > idx) this.caret--;
    this.hideMsg();
    this.renderProgram();
  },

  caretEl(at) {
    const d = document.createElement("div");
    d.className = "pz-caret";
    d.dataset.at = at;
    return d;
  },

  cardEl(node, path) {
    const key = puzzleBlockKey(node);
    const b = PUZZLE_BLOCKS[key];
    const div = document.createElement("div");
    div.className = `pz-card cat-${b.cat}`;
    div.dataset.path = path;
    div.style.setProperty("--pc", b.c);
    div.innerHTML = `<span class="pz-card-e">${b.e}</span><span class="pz-card-l">${b.label}</span>
      <button class="pz-del" data-del="${path}" title="Remove this block" aria-label="Remove block">✕</button>`;
    return div;
  },

  renderProgram() {
    const host = this.$("puzzle-program");
    host.innerHTML = "";
    const nodes = this.program;
    host.classList.toggle("empty", nodes.length === 0);
    for (let i = 0; i <= nodes.length; i++) {
      host.appendChild(this.caretEl(i));
      if (i < nodes.length) host.appendChild(this.cardEl(nodes[i], String(i)));
    }
    if (nodes.length === 0) {
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
    for (const node of nodes) { n++; if (node.body) n += this.countBlocks(node.body); }
    return n;
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
        } else if (node.body) {
          // recursive containers (repeat/if) arrive in Phase 2
          const times = node.t === "repeat" ? (node.n || 1) : 1;
          for (let r = 0; r < times; r++) { if (!exec(node.body, `${path}.body`)) return false; }
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
    // incomplete — ran out of blocks before reaching the goal
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
  },

  // ---------- hint + messages ----------
  showHint() {
    const hints = this.stage.hints || [];
    if (!hints.length) return;
    // escalate one step each tap, then hold on the most explicit hint
    const msg = hints[Math.min(this.hintIdx, hints.length - 1)];
    this.hintIdx = Math.min(this.hintIdx + 1, hints.length - 1);
    this.showHintMsg("💡 " + msg);
  },

  showHintMsg(text) {
    const box = this.$("puzzle-msg");
    box.className = "pz-msg hint";
    box.innerHTML = `<div class="pz-hint-text">${text}</div>
      <button class="pz-hint-close" data-act="replay" title="Got it">Got it 👍</button>`;
  },

  hideMsg() {
    const box = this.$("puzzle-msg");
    box.className = "hidden";
    box.innerHTML = "";
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
