// ============================================================
// TypeQuest — boot & global input
// ============================================================

window.addEventListener("DOMContentLoaded", () => {
  UI.init();
  SFX.setEnabled(SAVE.state.settings.sound);

  window.addEventListener("keydown", e => {
    if (UI.current === "game") {
      Engine.handleKey(e);
    } else if (UI.current === "results" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      UI.$("btn-next").classList.contains("hidden")
        ? UI.show("map")
        : UI.$("btn-next").click();
    }
  });

  // Browsers require a user gesture before audio can play
  window.addEventListener("pointerdown", () => SFX.init(), { once: true });

  // Debug / tinkering handle
  window.TQ = { SAVE, Engine, UI, WORLDS, CREATURES };
});
