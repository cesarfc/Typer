// ============================================================
// TypeQuest — boot & global input
// ============================================================

window.addEventListener("DOMContentLoaded", () => {
  UI.init();
  SFX.setEnabled(SAVE.state ? SAVE.state.settings.sound : true);

  Tutorial.bind();

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
  window.TQ = { SAVE, Engine, UI, SFX, Tutorial, WORLDS, CREATURES, routeKey };
});
