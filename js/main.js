// ============================================================
// TypeQuest — boot & global input
// ============================================================

// ---- Kind error net (for the iPad) -------------------------------------
// Runtime errors shouldn't scare a kid or look like a crash. We keep a small
// rolling log of the last few hiccups in its OWN localStorage key (never
// inside a player's save), show one gentle, reassuring toast per session, and
// surface the details only in the grown-ups' Stats corner. No stack traces
// ever reach the child — just the message, file, and line for a parent.
const Hiccups = {
  KEY: "typequest_hiccups",
  MAX: 20,
  _toastedThisSession: false,

  list() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  },

  log(msg, src, line) {
    const entry = {
      msg: String(msg || "Something went wrong").slice(0, 300),
      src: String(src || "").replace(/^.*\//, "").slice(0, 80), // basename only
      line: Number(line) || 0,
      time: new Date().toISOString(),
    };
    try {
      const arr = this.list();
      arr.push(entry);
      while (arr.length > this.MAX) arr.shift();
      localStorage.setItem(this.KEY, JSON.stringify(arr));
    } catch (e) { /* private mode / quota — the net is best-effort */ }
    this.reassureOnce();
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ }
  },

  // one calm toast per session — never a wall of errors
  reassureOnce() {
    if (this._toastedThisSession) return;
    this._toastedThisSession = true;
    try {
      if (typeof UI !== "undefined" && UI.toast && document.getElementById("toasts")) {
        UI.toast("🌈 Oops, a little hiccup — your progress is safe!", "gold");
      }
    } catch (e) { /* toast is optional comfort, never a second failure point */ }
  },
};
window.Hiccups = Hiccups;

window.addEventListener("error", e => {
  // ignore resource-load errors (e.g. a missing sprite falls back to emoji) —
  // those arrive with no `message`; only log real script errors.
  if (!e || !e.message) return;
  Hiccups.log(e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", e => {
  const r = e && e.reason;
  const msg = r && r.message ? r.message : (typeof r === "string" ? r : "A promise was rejected");
  Hiccups.log(msg, "", 0);
});

window.addEventListener("DOMContentLoaded", () => {
  UI.init();
  SFX.setEnabled(SAVE.state ? SAVE.state.settings.sound : true);

  Tutorial.bind();
  Puzzle.init();
  Maker.init();

  // one routing point for keys, whether they arrive from a real keyboard
  // (keydown) or from a touch device's on-screen keyboard (beforeinput)
  const routeKey = e => {
    // the spotlight coach-mark owns Enter/Space/Escape while open
    if (UI.spotlightOpen && UI.spotlightOpen()) {
      UI.spotlightKey(e);
      return;
    }
    if (UI.current === "game") {
      Engine.handleKey(e);
    } else if (UI.current === "tutorial") {
      Tutorial.handleKey(e);
    } else if (UI.current === "map") {
      UI.mapKeyNav(e);
    } else if (UI.current === "results" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      // a trailing keystroke from fast typing must not skip the rewards
      if (performance.now() - (UI._resultsAt || 0) < 800) return;
      UI.$("btn-next").classList.contains("hidden")
        ? UI.show("map")
        : UI.$("btn-next").click();
    }
  };

  const catcher = document.getElementById("kb-catcher");

  window.addEventListener("keydown", e => {
    // while the catcher is focused, printables arrive via beforeinput —
    // letting keydown through too would double-type every letter
    if (document.activeElement === catcher && e.key.length === 1) return;
    routeKey(e);
  });

  // the on-screen keyboard types into the invisible catcher: convert each
  // insertion into game keys and keep the input permanently empty
  catcher.addEventListener("beforeinput", e => {
    e.preventDefault();
    if (e.inputType === "insertText" || e.inputType === "insertCompositionText") {
      for (const ch of e.data || "") {
        routeKey({ key: ch, preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
      }
    } else if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
      routeKey({ key: "Enter", preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
    }
  });
  catcher.addEventListener("input", () => { catcher.value = ""; });

  // iOS shows the keyboard for focus() only inside a user gesture — taps on
  // the play screens re-summon it whenever it was dismissed
  if (UI._coarse) {
    ["screen-game", "screen-tutorial"].forEach(id => {
      document.getElementById(id).addEventListener("pointerup", () => {
        UI.touchKeyboard(UI.current);
      });
    });
  }

  // Browsers require a user gesture before audio can play
  window.addEventListener("pointerdown", () => SFX.init(), { once: true });

  // Debug / tinkering handle
  window.TQ = {
    SAVE, Engine, UI, SFX, Tutorial, Puzzle, Maker, WORLDS, CREATURES, routeKey,
    debugSeason: name => UI.debugSeason(name),
  };
});
