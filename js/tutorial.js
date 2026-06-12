// ============================================================
// TypeQuest — onboarding lesson: Klefki the Key Keeper teaches
// posture, the F/J bumps, and walks every finger to its home key.
// Auto-runs once per player; replayable from the 🎓 button.
// ============================================================

const Tutorial = {
  steps: [],
  idx: 0,
  wordPos: 0,

  bind() {
    UI.$("tut-next").addEventListener("click", () => { SFX.click(); this.advance(); });
    UI.$("tut-skip").addEventListener("click", () => this.finish(true));
  },

  start(replay = false) {
    const name = SAVE.state && SAVE.state.profile ? SAVE.state.profile.name : "Trainer";
    this.steps = [
      { text: `Hi ${name}! I am Klefki, the Key Keeper. I will teach you the secret of SUPER fast typing!`,
        btn: "Let's go! ▶" },
      { text: "First, the trainer pose: sit up tall, feet on the floor, shoulders relaxed. 🧘",
        btn: "Ready! ▶" },
      { text: "Here is the secret: every finger has its own HOME key. Your pointer fingers live on F and J — touch those keys and feel the little BUMPS!",
        btn: "Found the bumps! ▶" },
      { text: "Press F with your LEFT pointer finger.", key: "f" },
      { text: "Press J with your RIGHT pointer finger.", key: "j" },
      { text: "Press D with your LEFT middle finger.", key: "d" },
      { text: "Press K with your RIGHT middle finger.", key: "k" },
      { text: "Press S with your LEFT ring finger.", key: "s" },
      { text: "Press L with your RIGHT ring finger.", key: "l" },
      { text: "Press A with your LEFT pinky.", key: "a" },
      { text: "Press ; with your RIGHT pinky. Pinkies are small but mighty!", key: ";" },
      { text: "Tap the SPACE bar with your thumb.", key: " " },
      { text: "Wow! Now type a whole word. Keep every finger on its home key and stretch only the one you need:",
        word: "flask" },
      { text: "PERFECT! Remember: eyes on the SCREEN, fingers on their homes, and the glowing hand shows which finger to use. Now go catch them all! 🎉",
        btn: "Start my adventure! 🚀", last: true },
    ];
    this.idx = 0;
    UI.$("tut-guide-img").innerHTML = UI.pokeHtml(707, "🗝️", { cls: "poke-img tut-img" });
    UI.show("tutorial");
    this.render();
  },

  step() { return this.steps[this.idx]; },

  render() {
    const s = this.step();
    UI.$("tut-bubble").textContent = s.text;
    UI.$("tut-next").classList.toggle("hidden", !s.btn);
    if (s.btn) UI.$("tut-next").textContent = s.btn;
    const word = UI.$("tut-word");
    if (s.word) {
      this.wordPos = 0;
      word.classList.remove("hidden");
      this.renderWord();
    } else {
      word.classList.add("hidden");
      UI.highlightKey(s.key || null);
    }
    UI.$("tut-progress").innerHTML = this.steps.map((_, i) =>
      `<span class="tut-dot${i === this.idx ? " cur" : i < this.idx ? " done" : ""}"></span>`).join("");
  },

  renderWord() {
    const s = this.step();
    UI.$("tut-word").innerHTML = [...s.word].map((c, i) =>
      `<span class="ch ${i < this.wordPos ? "done" : i === this.wordPos ? "cur" : ""}">${c}</span>`).join("");
    UI.highlightKey(s.word[this.wordPos] || null);
  },

  handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    e.preventDefault();
    const s = this.step();
    if (!s) return;
    if (s.key) {
      if (e.key === s.key) { SFX.word(); this.celebrate(); this.advance(); }
      else this.oops();
    } else if (s.word) {
      if (e.key === s.word[this.wordPos]) {
        SFX.click(this.wordPos * 5);
        this.wordPos++;
        this.renderWord();
        if (this.wordPos >= s.word.length) {
          SFX.word();
          this.celebrate();
          setTimeout(() => this.advance(), 550);
        }
      } else this.oops();
    }
  },

  celebrate() {
    const r = UI.$("tut-bubble").getBoundingClientRect();
    UI.burst(r.left + r.width / 2, r.bottom, ["#ffd34d", "#43e97b", "#fff"], 14, 4);
  },

  oops() {
    SFX.error();
    const b = UI.$("tut-bubble");
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
  },

  advance() {
    const s = this.step();
    if (!s || s.last || this.idx + 1 >= this.steps.length) { this.finish(false); return; }
    this.idx++;
    this.render();
  },

  finish(skipped) {
    UI.highlightKey(null);
    const first = !SAVE.state.tutorialDone;
    SAVE.state.tutorialDone = true;
    if (first && !skipped) SAVE.state.xp += 20;
    SAVE.save();
    UI.show("map");
    if (!skipped) {
      UI.confetti();
      SFX.fanfare();
      UI.toast(`🎓 Lesson complete!${first ? " +20 XP" : ""} Fingers on F and J, Trainer!`, "gold");
    }
  },
};
