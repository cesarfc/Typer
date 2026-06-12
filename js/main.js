// ============================================================
// TypeQuest — boot & global input
// ============================================================

window.addEventListener("DOMContentLoaded", () => {
  UI.init();
  SFX.setEnabled(SAVE.state ? SAVE.state.settings.sound : true);

  Tutorial.bind();

  window.addEventListener("keydown", e => {
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
  });

  // Browsers require a user gesture before audio can play
  window.addEventListener("pointerdown", () => SFX.init(), { once: true });

  // Debug / tinkering handle
  window.TQ = { SAVE, Engine, UI, SFX, Tutorial, WORLDS, CREATURES };
});
