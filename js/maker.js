// ============================================================
// TypeQuest — The Maker Hut: kids design their OWN walk-grid puzzle stages and
// publish them for the family. Everything is tap-only except naming the stage.
//
// The design heart is the PROOF RULE: before a stage can be published its author
// must solve it in the normal playfield ("Prove it works!"). Their winning block
// count becomes the stage's `optimal` (and budget = optimal + 3), which both
// guarantees the stage is solvable and teaches that designers test their work.
//
// A draft grid is a 2D array of tile chars ('.', '#', '~', '*', 'o') plus a
// separate start {x,y,dir}; the start cell is always kept a plain path. On
// publish it serializes to the same string-row schema as PUZZLE_STAGES (with 'S'
// written at the start cell), but a maker stage is NEVER added to PUZZLE_STAGES —
// it lives per-player under SAVE.makerStages and is mounted directly.
// ============================================================

const Maker = {
  view: "hut",    // "hut" (shelf) | "editor"
  draft: null,    // the working stage being built/edited
  tool: "wall",   // the currently selected paint tool
  _error: null,   // a kind validation message to show in the editor

  $(id) { return document.getElementById(id); },

  // grid sizes offered (all within the 25-cell cap)
  SIZES: [
    { id: "4x4", w: 4, h: 4 },
    { id: "5x4", w: 5, h: 4 },
    { id: "5x5", w: 5, h: 5 },
  ],

  // paint tools; `start` places/rotates the trainer, `goal` the single flag
  TOOLS: [
    { id: "path",  e: "🟩", label: "path" },
    { id: "wall",  e: "🌳", label: "tree" },
    { id: "water", e: "💧", label: "water" },
    { id: "berry", e: "🍒", label: "berry" },
    { id: "start", e: "🧍", label: "start" },
    { id: "goal",  e: "🏁", label: "flag" },
  ],

  TILE_OF: { path: ".", wall: "#", water: "~", berry: "*" },
  DIR_ARROW: { up: "⬆️", right: "➡️", down: "⬇️", left: "⬅️" },

  init() {
    const body = this.$("maker-body");
    if (body) body.addEventListener("click", e => this.onClick(e));
  },

  // ================= the shelf (My stages + Family stages) =================
  openHut() {
    this.view = "hut";
    this.draft = null;
    this._error = null;
    this.renderHut();
    UI.show("maker");
  },

  // a short human summary of a stored stage's objective
  objectiveText(need) {
    return need > 0 ? `Grab ${need} 🍒 &amp; reach 🏁` : "Reach the flag 🏁";
  },

  renderHut() {
    const mine = SAVE.makerStages();
    const fam = SAVE.familyMakerStages();

    const myCards = mine.length ? mine.map(s => {
      const size = `${s.grid[0].length}×${s.grid.length}`;
      return `<div class="mk-shelf-item">
        <div class="mk-shelf-info">
          <b>${UI.esc(s.name)}</b>
          <i>${size} · ${this.objectiveText(s.need)} · ⭐ best ${s.optimal}</i>
        </div>
        <div class="mk-shelf-btns">
          <button class="mid-btn" data-mkplay="${UI.esc(s.id)}">▶ Play</button>
          <button class="mk-mini" data-mkedit="${UI.esc(s.id)}" title="Edit this stage">✏️</button>
          <button class="mk-mini" data-mkdel="${UI.esc(s.id)}" title="Delete this stage">🗑️</button>
        </div>
      </div>`;
    }).join("") : `<p class="mk-empty">No stages yet — tap <b>Build a new stage</b> to make your first!</p>`;

    const newCard = mine.length < MAKER_STAGES_MAX
      ? `<button class="mk-newstage" data-act="mk-new">
          <span class="mk-new-e">➕</span>
          <span class="mk-new-l"><b>Build a new stage</b><i>Design a puzzle, then challenge your family</i></span>
        </button>`
      : `<p class="mk-empty">🔨 You have all ${MAKER_STAGES_MAX} stages — delete one to build more.</p>`;

    const famCards = fam.length ? fam.map(f => {
      const s = f.stage;
      const size = `${s.grid[0].length}×${s.grid.length}`;
      return `<div class="mk-shelf-item fam">
        <div class="mk-shelf-info">
          <b>${UI.esc(s.name)}</b>
          <i>by ${UI.esc(f.name)} · ${size} · ⭐ ${s.optimal} to beat</i>
        </div>
        <div class="mk-shelf-btns">
          <button class="mid-btn" data-famplay="${UI.esc(f.pid)}|${UI.esc(s.id)}">▶ Play</button>
        </div>
      </div>`;
    }).join("") : `<p class="mk-empty">No family stages yet. When a sibling publishes one, it shows up here to play!</p>`;

    this.$("maker-body").innerHTML = `<div class="mk-hut">
      <div class="mk-topbar">
        <button class="mk-back" data-act="mk-toisle">← Isle</button>
        <b class="mk-etitle">🔨 The Maker Hut</b>
      </div>
      <p class="mk-blurb">Build your own puzzle stages, prove they work, and share them with the family!</p>

      <div class="mk-shelf">
        <h3 class="mk-shelf-h">🧱 My stages <span>${mine.length}/${MAKER_STAGES_MAX}</span></h3>
        ${myCards}
        ${newCard}
      </div>

      <div class="mk-shelf">
        <h3 class="mk-shelf-h">👨‍👩‍👧 Family stages</h3>
        ${famCards}
      </div>
    </div>`;
  },

  // ================= the editor =================
  blankTiles(w, h) {
    return Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
  },

  newDraft() {
    const s = this.SIZES.find(z => z.id === "5x4");
    const tiles = this.blankTiles(s.w, s.h);
    tiles[s.h - 1][s.w - 1] = "o"; // a friendly default flag in the far corner
    this.draft = {
      id: null, name: "", size: s.id, tiles,
      start: { x: 0, y: 0, dir: "right" },
      blocks: { repeat: false, if: false, ifElse: false, logic: false },
      proven: false, optimal: null, budget: null,
    };
    this.tool = "wall";
    this._error = null;
    this.showEditor();
  },

  editStage(id) {
    const rec = SAVE.makerStageById(id);
    if (!rec) return;
    const tiles = rec.grid.map(row => Array.from(row).map(ch => (ch === "S" ? "." : ch)));
    this.draft = {
      id: rec.id, name: rec.name, size: `${rec.grid[0].length}x${rec.grid.length}`,
      tiles,
      start: { x: rec.start.x, y: rec.start.y, dir: rec.start.dir },
      blocks: {
        repeat: rec.blocks.includes("repeat"),
        if: rec.blocks.includes("if"),
        ifElse: rec.blocks.includes("ifElse"),
        logic: !!rec.logic,
      },
      // editing a published stage requires re-proving before it can be re-published
      proven: false, optimal: rec.optimal, budget: rec.budget,
    };
    this.tool = "wall";
    this._error = null;
    this.showEditor();
  },

  showEditor() {
    this.view = "editor";
    this.renderEditor();
    UI.show("maker");
  },

  // read the name field back into the draft before any re-render (so a re-render
  // never loses what the kid typed)
  syncName() {
    const el = this.$("mk-name");
    if (el && this.draft) this.draft.name = el.value;
  },

  invalidateProof() {
    if (!this.draft) return;
    this.draft.proven = false;
    this.draft.optimal = null;
    this.draft.budget = null;
  },

  size() { return this.SIZES.find(z => z.id === this.draft.size) || this.SIZES[1]; },
  berryCount() { return this.draft.tiles.reduce((n, row) => n + row.filter(c => c === "*").length, 0); },
  goalCount() { return this.draft.tiles.reduce((n, row) => n + row.filter(c => c === "o").length, 0); },

  // the palette the SOLVER (proof + play) receives
  solverBlocks() {
    const b = this.draft.blocks;
    const list = ["walk", "turnLeft", "turnRight"];
    if (this.berryCount() > 0) list.push("collect");
    if (b.repeat) list.push("repeat");
    if (b.if) list.push("if");
    if (b.ifElse) list.push("ifElse");
    return list;
  },

  // draft tiles -> string rows, with 'S' written at the start cell
  serializeGrid() {
    const st = this.draft.start;
    return this.draft.tiles.map((row, y) =>
      row.map((ch, x) => (st.x === x && st.y === y ? "S" : ch)).join(""));
  },

  renderEditor() {
    const t = this.draft;
    // derive dimensions from the actual tiles so the render can never desync
    // from the size id (also robust to any legacy stage dims on edit)
    const h = t.tiles.length, w = t.tiles[0].length;
    const need = this.berryCount();

    // ---- grid cells ----
    let cells = "";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const isStart = t.start.x === x && t.start.y === y;
        const ch = t.tiles[y][x];
        let cls = "path", glyph = "";
        if (isStart) { cls = "path start"; glyph = `<span class="mk-start">${this.DIR_ARROW[t.start.dir]}</span>`; }
        else if (ch === "#") cls = "wall";
        else if (ch === "~") cls = "water";
        else if (ch === "*") { cls = "path berry"; glyph = `<span class="ptile-g">🍒</span>`; }
        else if (ch === "o") { cls = "path goal"; glyph = `<span class="ptile-g">🏁</span>`; }
        cells += `<button class="ptile mk-cell ${cls}" data-x="${x}" data-y="${y}">${glyph}</button>`;
      }
    }

    // ---- tool + size + block toggles ----
    const sizeBtns = this.SIZES.map(z =>
      `<button class="mk-size ${t.size === z.id ? "on" : ""}" data-size="${z.id}">${z.w}×${z.h}</button>`).join("");
    const toolBtns = this.TOOLS.map(tl =>
      `<button class="mk-tool ${this.tool === tl.id ? "on" : ""}" data-tool="${tl.id}">
        <span class="mk-tool-e">${tl.e}</span><span class="mk-tool-l">${tl.label}</span></button>`).join("");

    const lockChip = (e, label) => `<span class="mk-block on locked">${e} ${label}</span>`;
    const autoChip = (on) => `<span class="mk-block ${on ? "on" : ""} locked">🍒 collect ${on ? "(auto)" : "(add berries)"}</span>`;
    const toggle = (key, e, label) =>
      `<button class="mk-block ${t.blocks[key] ? "on" : ""}" data-block="${key}">${e} ${label}</button>`;

    const objective = need > 0
      ? `🎯 Grab all ${need} 🍒 and reach the flag 🏁`
      : `🎯 Reach the flag 🏁`;

    const canPublish = t.proven;
    const proveNote = t.proven
      ? `✅ Proved in <b>${t.optimal}</b> block${t.optimal === 1 ? "" : "s"} — ready to publish!`
      : "Solve your own stage to unlock Publish. Designers always test their work! 🔧";

    const errHtml = this._error
      ? `<div class="mk-error">${UI.esc(this._error)}</div>` : "";

    this.$("maker-body").innerHTML = `<div class="mk-editor">
      <div class="mk-topbar">
        <button class="mk-back" data-act="mk-tohut">← Hut</button>
        <b class="mk-etitle">${t.id ? "✏️ Edit stage" : "🔨 Build a stage"}</b>
      </div>
      ${errHtml}
      <div class="mk-cols">
        <div class="mk-gridwrap">
          <div class="mk-grid" style="--cols:${w};--rows:${h}">${cells}</div>
          <div class="mk-objective">${objective}</div>
          <p class="mk-hint2">Pick a tool, then tap squares. Tap 🧍 start again to turn it.</p>
        </div>
        <div class="mk-panel">
          <div class="mk-section">
            <div class="mk-label">Grid size</div>
            <div class="mk-sizes">${sizeBtns}</div>
          </div>
          <div class="mk-section">
            <div class="mk-label">Paint</div>
            <div class="mk-tools">${toolBtns}</div>
          </div>
          <div class="mk-section">
            <div class="mk-label">Blocks the solver gets</div>
            <div class="mk-blocks">
              ${lockChip("👣", "walk")}
              ${lockChip("↰↱", "turn")}
              ${autoChip(need > 0)}
              ${toggle("repeat", "🔁", "repeat")}
              ${toggle("if", "❓", "if")}
              ${toggle("ifElse", "🔀", "if / else")}
              ${toggle("logic", "🔗", "AND / OR")}
            </div>
          </div>
          <div class="mk-section">
            <label class="mk-namefield">
              <span>Stage name</span>
              <input id="mk-name" type="text" maxlength="${MAKER_NAME_MAXLEN}" placeholder="e.g. Berry Maze" value="${UI.esc(t.name)}">
            </label>
          </div>
          <div class="mk-actions">
            <button class="big-btn" data-act="mk-prove">▶ Prove it works!</button>
            <button class="big-btn mk-publish ${canPublish ? "" : "disabled"}" data-act="mk-publish">📢 Publish</button>
          </div>
          <div class="mk-provenote">${proveNote}</div>
        </div>
      </div>
    </div>`;
  },

  // ================= click routing =================
  onClick(e) {
    const act = e.target.closest("[data-act]");
    if (act) return this.doAct(act.dataset.act);

    const cell = e.target.closest(".mk-cell");
    if (cell) { SFX.click(); this.paint(+cell.dataset.x, +cell.dataset.y); return; }

    const tool = e.target.closest("[data-tool]");
    if (tool) { SFX.click(); this.tool = tool.dataset.tool; this.renderEditor(); return; }

    const size = e.target.closest("[data-size]");
    if (size) { SFX.click(); this.setSize(size.dataset.size); return; }

    const block = e.target.closest("[data-block]");
    if (block) { SFX.click(); this.toggleBlock(block.dataset.block); return; }

    const play = e.target.closest("[data-mkplay]");
    if (play) { SFX.init(); this.playMine(play.dataset.mkplay); return; }

    const edit = e.target.closest("[data-mkedit]");
    if (edit) { SFX.click(); this.editStage(edit.dataset.mkedit); return; }

    const del = e.target.closest("[data-mkdel]");
    if (del) { SFX.click(); this.deleteFlow(del.dataset.mkdel); return; }

    const fam = e.target.closest("[data-famplay]");
    if (fam) { SFX.init(); const [pid, id] = fam.dataset.famplay.split("|"); this.playFamily(pid, id); return; }
  },

  doAct(act) {
    SFX.click();
    if (act === "mk-toisle") { UI.show("lab"); return; }
    if (act === "mk-tohut") { this.openHut(); return; }
    if (act === "mk-new") { this.newDraft(); return; }
    if (act === "mk-prove") { this.prove(); return; }
    if (act === "mk-publish") { this.publish(); return; }
  },

  // ================= painting =================
  setSize(id) {
    this.syncName();
    this._error = null;
    const z = this.SIZES.find(s => s.id === id);
    if (!z) return;
    const t = this.draft, old = t.tiles;
    const nt = this.blankTiles(z.w, z.h);
    for (let y = 0; y < z.h; y++)
      for (let x = 0; x < z.w; x++)
        if (old[y] && old[y][x] != null) nt[y][x] = old[y][x];
    t.tiles = nt;
    t.size = id;
    if (t.start.x >= z.w) t.start.x = z.w - 1;
    if (t.start.y >= z.h) t.start.y = z.h - 1;
    nt[t.start.y][t.start.x] = "."; // start always stands on solid ground
    this.invalidateProof();
    this.renderEditor();
  },

  toggleBlock(key) {
    this.syncName();
    this._error = null;
    this.draft.blocks[key] = !this.draft.blocks[key];
    this.invalidateProof();
    this.renderEditor();
  },

  paint(x, y) {
    this.syncName();
    this._error = null;
    const t = this.draft;
    const isStart = t.start.x === x && t.start.y === y;
    const tool = this.tool;

    if (tool === "start") {
      if (isStart) { t.start.dir = Puzzle.CW[t.start.dir]; }  // tap again to rotate
      else if (t.tiles[y][x] === "o") { this._error = "The start and the flag need their own squares!"; }
      else { t.start = { x, y, dir: t.start.dir }; t.tiles[y][x] = "."; }
    } else if (tool === "goal") {
      if (isStart) { this._error = "The start and the flag need their own squares!"; }
      else {
        // exactly one flag: clear any existing goal first
        for (let gy = 0; gy < t.tiles.length; gy++)
          for (let gx = 0; gx < t.tiles[gy].length; gx++)
            if (t.tiles[gy][gx] === "o") t.tiles[gy][gx] = ".";
        t.tiles[y][x] = "o";
      }
    } else {
      // path / wall / water / berry
      if (isStart && tool !== "path") { this._error = "Your trainer stands here — keep it a path!"; }
      else { t.tiles[y][x] = this.TILE_OF[tool]; }
    }

    this.invalidateProof();
    this.renderEditor();
  },

  // ================= prove / publish =================
  showError(msg) {
    this._error = msg;
    SFX.error();
    if (this.view !== "editor") this.showEditor();
    else this.renderEditor();
  },

  // build a runnable stage def from the current draft
  buildDef(id, opts) {
    const t = this.draft;
    const need = this.berryCount();
    return {
      id, maker: true,
      name: t.name || "Your stage", concept: "your own stage",
      grid: this.serializeGrid(),
      start: { x: t.start.x, y: t.start.y, dir: t.start.dir },
      goal: need > 0 ? "collect" : "reach", need,
      blocks: this.solverBlocks(),
      logic: !!t.blocks.logic, compare: false,
      optimal: opts.optimal, budget: opts.budget,
    };
  },

  prove() {
    this.syncName();
    if (this.goalCount() !== 1) {
      this.showError("Add a flag 🏁 for your Pokemon to reach — tap the 🏁 tool, then a square.");
      return;
    }
    this._error = null;
    // during proof the target is unknown; placeholders keep the HUD/stars happy
    const def = this.buildDef("mk-proof", { optimal: 999, budget: 999 });
    Puzzle.openMakerStage(def, { mode: "prove" });
  },

  // the creator solved their stage — `blocks` is the winning count. Lock it in as
  // the record; publish straight away, or drop back into the editor.
  afterProof(blocks, doPublish) {
    const t = this.draft;
    if (!t) { this.openHut(); return; }
    t.optimal = blocks;
    t.budget = blocks + 3;
    t.proven = true;
    this._error = null;
    if (doPublish) {
      const res = this.publish();
      if (res && res.ok) return;   // published → already at the Hut
      return;                      // publish failed → publish() left us in the editor with the reason
    }
    this.showEditor();
  },

  publish() {
    this.syncName();
    const t = this.draft;
    if (!t.proven) { this.showError("Prove your stage first — solve it, then publish! ▶"); return { ok: false }; }
    if (this.goalCount() !== 1) { this.showError("Add a flag 🏁 for your Pokemon to reach!"); return { ok: false }; }
    const need = this.berryCount();
    const data = {
      name: t.name,
      grid: this.serializeGrid(),
      start: { x: t.start.x, y: t.start.y, dir: t.start.dir },
      goal: need > 0 ? "collect" : "reach", need,
      blocks: this.solverBlocks(),
      logic: !!t.blocks.logic,
      optimal: t.optimal, budget: t.budget,
    };
    const res = SAVE.saveMakerStage(t.id, data);
    if (!res.ok) { this.showError(res.error); return { ok: false }; }
    const wasEdit = !!t.id;
    SFX.word();
    UI.confetti();
    this.openHut();
    UI.toast(wasEdit
      ? `🔨 Updated “${UI.esc(res.stage.name)}”!`
      : `🔨 Published “${UI.esc(res.stage.name)}” — your family can play it now!`, "gold");
    (res.newTrophies || []).forEach((tr, i) => setTimeout(() => UI.trophyToast(tr), 700 + i * 800));
    return { ok: true };
  },

  deleteFlow(id) {
    const rec = SAVE.makerStageById(id);
    if (!rec) return;
    if (!confirm(`Delete “${rec.name}”? Your family won’t be able to play it anymore. Any XP you earned stays yours. 💛`)) return;
    SAVE.deleteMakerStage(id);
    this.renderHut();
    UI.toast(`🔨 “${UI.esc(rec.name)}” removed.`);
  },

  // ================= playing published stages =================
  // Mount a stored stage as a maker PLAY run. `ctx.mine` decides the win copy and
  // whether the beat-the-record callout can fire.
  mountPlay(rec, ctx) {
    const def = {
      id: ctx.mkId, maker: true,
      name: rec.name, concept: ctx.mine ? "your own stage" : `by ${ctx.creatorName}`,
      grid: rec.grid,
      start: { x: rec.start.x, y: rec.start.y, dir: rec.start.dir },
      goal: rec.goal, need: rec.need,
      blocks: rec.blocks,
      logic: !!rec.logic, compare: false,
      optimal: rec.optimal, budget: rec.budget,
    };
    Puzzle.openMakerStage(def, ctx);
  },

  playMine(id) {
    const rec = SAVE.makerStageById(id);
    if (!rec) return;
    this.mountPlay(rec, { mode: "play", mine: true, mkId: "mk-" + id });
  },

  playFamily(pid, id) {
    const fam = SAVE.familyMakerStages().find(f => f.pid === pid && f.stage.id === id);
    if (!fam) return;
    this.mountPlay(fam.stage, {
      mode: "play", mine: false, mkId: `mk-${pid}-${id}`,
      creatorName: fam.name, creatorOptimal: fam.stage.optimal,
    });
  },
};
