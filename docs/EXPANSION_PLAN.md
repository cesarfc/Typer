# TypeQuest Expansion Plan — Endgame + The Scholar Archipelago

**Status: Parts 1-3 shipped and live** (June 2026). The endgame (medals, Museum, Daily Drill, Research, Elite Four, Hall of Fame), feature onboarding, and per-level skill bands are all in the game today.

**Part 4 — the Scholar Archipelago (Phases 4-6: the math/coding/CS islands with concept lessons) — shipped, then was removed in `c5f0a17`.** The islands were cut from the game (they didn't fit the typing-first focus), so the Part 4 sections below no longer describe the live build. The full text is preserved as an **archived design record** of how the islands were designed and built, in case they ever return.

Synthesized from two specialist designs: a game-design pass (retention systems,
learning-region mechanics, engine/save groundwork) and a UI/UX pass
(celebration architecture, healthy-play guardrails, prompt/screen designs).
Both worked from the live codebase; every proposal below is grounded in what
`engine.js` / `save.js` / `ui.js` / `data.js` actually do today.

**The player:** a 9-year-old who has nearly cleared all 6 worlds and caught
most of the 96 Pokemon. He can type. The goals:
1. Make finishing the game the *beginning* — endgame systems that reward
   mastery, collection, and showing up (healthily). (Part 1)
2. Every new feature introduces itself when it unlocks — onboarding is part
   of the feature, not an afterthought. (Part 2)
3. One game for every age and skill level: per-level **skill bands** so
   siblings of different ages play the same worlds at the right challenge.
   (Part 3)
4. New islands that teach **math, coding, and computer-science basics**
   through the same typing-battle core, each also expanding keyboard
   territory (number row, symbols) like the worlds taught letters — with
   **concept lessons that assume the trainer is brand-new to the subject**.
   (Part 4)

---

## Design laws (apply to everything below)

**Healthy compulsion — the parent-facing contract**
- Bounded days: every daily system has a natural stopping point. No infinite grind.
- Absence is never punished: nothing earned ever decays; streaks forgive
  (rest tokens); unfinished weeklies roll over without shame.
- Mastery over grind: reward gates are skill gates (accuracy, ninja mode,
  sustained performance), never time-spent gates.
- Banked, visible, finite rewards: medals on the map, cosmetics on the
  trainer, photos in the Museum. No loot boxes, no countdowns, no FOMO.
- The Grown-ups corner sees everything: each new system adds one parent line.

**Celebration budget — the fanfare ladder**
Celebration intensity must correlate with rarity or everything becomes noise.
T0 keypress → T1 word → T2 level win → T3 catch/evolve/shiny (confetti starts
here) → T4 trophy / **mastery medal** (splash) → T5 **Ceremony** (full-screen,
~10-15 per save: region mastered, regional dex 100%, new island) → T6
**Legend** (~3 per save, ever: full dex, all-medals, Champion — the Hall of
Fame induction sequence with a permanent framed photo). T0–T3 already exist
and do not change. One T4+ moment at a time (splash queue); ceremonies defer
until the results card is dismissed; every tier has a reduced-motion variant.

**Technical landmines (hard-won)**
- New map elements join the billboard block at the END of style.css; pins
  never get transform/filter/animation changes on hover — paint-only.
- `WORLDS.length - 1` means "Hall of Fame" in ~7 places (roamer pool, name
  capitalization, spawn chips, results). Extract `HALL_W = 5` before
  appending any world.
- Saves: new top-level fields via `defaults()` are auto-safe
  (`normalizePlayers` Object.assigns). Append-only WORLDS/CREATURES contract
  holds. No `v` bump needed for any of this plan.
- iPad: iOS smart punctuation can deliver curly quotes/em-dashes through
  `beforeinput` — add a `CHAR_EQUIV` normalization map before the coding
  island ships.

---

## Part 1 — Endgame & retention (ranked by impact-per-effort)

### 1. World Mastery Medals — Bronze / Silver / Gold / Crown (S–M)
Turn the 54 cleared stages back into goals. Per world:
- **Bronze**: every stage 3-starred (mostly already true → day-one payoff).
- **Silver**: every stage's best ≥ 95% accuracy and ≥ 15 WPM.
- **Gold**: ≥ 97% and ≥ 22 WPM (a real stretch at age 9).
- **Crown** = New Game+ as a medal: every stage cleared in **Ninja Mode**
  (guide hidden, ≥ 95% acc) — "typing without looking" becomes the endgame.
Per-metric bests are independent; medals are computed from `stageBest`,
never stored. **UX:** medal drops into the results card at 1600ms (after the
star stagger) with a ribbon, over-rotation settle, shine sweep, and a new
struck-fifth `SFX.medal()`; the map node gains a permanent gold ring
(paint-only); copy says "MASTERED! This level is yours forever."

### 2. Professor's Daily Drill — seeded mutator run (M)
One special run per day (date-hash seeded, like grass spots): ~12 words from
cleared worlds transformed by two mutators — *Lights Out* (forced ninja),
**Weak Key Day** (pool biased to the player's 3 worst keys from
`stats.perKey` — the game quietly assigns exactly the practice he needs),
*Long Words*, *Capital Day*, *Flawless* (errored words gently re-queue),
*Turbo Taste*. Reward: XP + a **candy voucher** (kid picks which family —
self-directed evolution progress). 5 dailies in any week → boosted-odds
Mystery Egg (5-of-7 so a missed day never breaks anything).

### 3. Elite Four & Champion gauntlet (M)
Entry gate: 9+ world medals (so #1 feeds it). Four themed boss rounds over
curriculum slices (Home-Row Hana, Cave Sage, Dragon Duchess, The Glitch
Heir), **hearts carry across rounds** (3 max, +1 between) — the game's only
sustained-performance test. **The Champion is the player's own rival**: his
trainer SVG palette-inverted, speed tuned from his recent WPM history —
always stretchy-but-beatable. Victory = T6 Hall of Fame induction: party on
pedestals, camera flash, a **framed dated photo that hangs in the Museum
forever**, plus a monument pin on the island and Champion cape/crown
wardrobe unlocks. Re-challengeable; every clear adds a new HOF entry.

### 4. Shiny Dex & Shiny Charm (S — cheapest big win)
Surface the existing shiny loop: dex shiny counter (`12✨/96`), per-world
dots, and **Shiny Charm I/II/III** at 10/25/50 shinies that bump shiny odds
game-wide. Mostly UI + consolidating scattered odds literals into one
`SHINY_ODDS(charmTier)` helper.

### 5. Professor's Research Tasks — weekly quest board (M)
3 tasks/week drawn from a pool weighted toward neglected systems ("Hatch 2
eggs", "Set a Hard practice record", "Win any level at 100%", "Clear a stage
in Ninja Mode"). Progress fills from normal play via new `stats.counters`.
Rewards: wardrobe stamps + XP; all three → candy voucher. Unfinished boards
roll over silently.

**Bench (do as appetite allows):** gym rematch tiers (S); weekly Raid Boss
with HP that persists across sessions all week (M); wardrobe unlock layer
woven through everything (S, do early — rewards land on the kid's own
avatar); Practice Ghost — race your own best run's cursor (M); postgame
"Professor's letter" map beat (S, do FIRST — the endgame needs a door).

**New surfaces:** the Trophy Room becomes the **Museum** (tabs: Trophies |
Medals | Gallery) — segmented completion meters that flip to countdown
framing at ≥90% ("only 2 to find!") and deep-link into the existing spawn
guide; medal wall laid out as a mini-map of the island; shiny showcase
shelves with visible empty pedestals; HOF photos. A **Journal** nav tab
holds active goals (daily drill, research board, Elite record). If five
tabs crowd the nav, Journal can fold into the Museum as a fourth tab.

**Daily rhythm UX:** a "Today's Adventure" card with three gentle stamps
(finish 3 levels / visit the wild / school or catch) → on completion, the
next results-dismiss shows a calm dusk recap card with a **tomorrow hook
generated from real state** ("one more level hatches your egg!") and a
`🌙 Done for today` primary button — suggests, never traps; no XP changes
either way. **Streak rest tokens:** every 7 days banks one 🛏 token (max 2)
that silently absorbs a missed day ("Your streak rested at the Pokemon
Center!"); true resets show a sprout 🌱 and "new streak" framing, never a
dead flame; old best kept as a record to beat.

---

## Part 2 — Feature onboarding: every unlock teaches itself

New systems are worthless if a 9-year-old never notices them. Every feature
in this plan ships with a **discovery moment**, built on one reusable
framework instead of ad-hoc toasts.

**The Professor's Letter system.** A `FEATURE_INTROS` registry in data.js:
`{ id, trigger(saveState), tier, letter, spotlight }`.
- **Trigger:** a predicate checked at map render (the `mapHints` slot —
  feature intros take priority over generic hints). Examples: medals intro
  when `stageBest` first has 3 worthy entries; daily-drill intro the first
  morning the podium spawns; Elite intro at 9 medals; ferry intro when the
  archipelago unlocks.
- **The letter:** a 📬 parcel pin drops near the player's map marker
  (billboard-safe, inner-span bob). Clicking opens a calm 2–3 panel
  overlay — Professor Oak's letter, one idea per panel, big type, a single
  Continue. Letters are warm fiction, not tooltips: "My research shows your
  Pallet Meadow runs are nearly perfect. I've sent you a Medal Case…"
- **Guided first use:** after the letter, a **spotlight step** (max 2-3):
  a fixed dim layer with the target element lifted above it (z-index +
  box-shadow cutout — pure DOM), a short caption, advance on tap. E.g.
  medals: spotlight the Museum tab → the medal wall → the Bronze row
  already partly earned. Daily drill: spotlight the podium node, then
  start the first run with its explainer card.
- **Rules:** one intro per session, ever (queued otherwise); skippable at
  every step; replayable from the Journal ("how does this work?" link on
  each panel); never two new systems in the same session; stored in
  `flags.intros`. The existing tutorial (Klefki) and island tutors handle
  *skills*; letters handle *systems*.

---

## Part 3 — Skill bands: one game, every age

Players are different ages with different skills. Today's difficulty
(🐢 Chill / 🙂 Normal / 🔥 Turbo) only scales **time**. Bands scale
**content**. The two axes stay orthogonal and combine freely:

> **Band = what you face. Difficulty = how fast you must be.**

**Three bands, named for pride, not age** (age guidance appears only in the
parent-facing creation hint): 🌱 **Explorer** (~5-7, early readers),
⚡ **Trainer** (~8-10, today's game), 👑 **Ace** (~11+, or a confident
younger kid).

**What a band changes, per area:**
| Area | 🌱 Explorer | ⚡ Trainer | 👑 Ace |
|---|---|---|---|
| Story words | ≤4-letter words from the same taught keys, +20% base time | current pools | longer words + phrases earlier, capitals from world 4 |
| Boss HP | 8 | 10 | 12 |
| Math | counts & +/− within 20; ×2/×5/×10 only; answers ≤2 digits | the Part 4 ramp as written | full fact mix, missing-factor forms, 3-digit carrying earlier |
| Coding | copy-only, ≤10-char lines, no shift symbols until C3 | as written | fill-the-blank earlier, 2-line blocks sooner |
| CS | ≤3-bit binary, AND only, ±1 ciphers | as written | 6-bit binary, NAND teasers, ±3 ciphers |

Bands are mostly **filters and parameter ranges** over the same pools
(word-length filters; number ranges; line caps) plus authored variants
where it matters (math levels carry per-band generators). Creature/dex
content is identical across bands — collection is never gated by age.

**How it's chosen:**
- **Player default** set at creation (alongside difficulty) and changeable
  any time from the same topbar cluster — a band chip next to the
  difficulty chip.
- **Per-level override:** clicking a map node opens a slim **level card**
  (name, your stars, medal, three band pips with the default pre-selected,
  Start). Enter / double-click skips straight in at the default — zero
  added friction for normal play. The card is also where replays choose a
  band deliberately.
- **The game coaches the band, gently:** two flawless 3-star runs at a band
  → results card offers "Ready for 👑 Ace? It's tougher — and pays more!"
  Two failures of the same level → the existing warm-failure pattern offers
  "Want more time this once?" (one-run Chill assist, no penalty, no nag).
  Offers, never automatic switches — the kid stays in charge.

**Progress & fairness rules:** stars are earned at whatever band you play —
a 6-year-old's 3 stars are as real as anyone's. `stageBest` records the
band; **Silver/Gold medals require Trainer band or above** (Bronze and
Crown are band-agnostic — Crown's ninja constraint is hard at any band);
Ace runs pay +15% XP. Nothing ever has to be replayed after a band change
(the `V3_STAGE_MAP` mercy philosophy).

**Save:** `profileBand`, `stageBest[key].band` — additive, no migration.

---

## Part 4 — The Scholar Archipelago (math · coding · CS)

**Fiction:** the Ferry Dock finally sells tickets. Professor Oak's fleet
found a new island chain — but MissingNo (the world-6 villain) escaped into
the islands' machines. Three islands, three subjects, one returning villain.
Implemented as appended `WORLDS[6..8]` / `CREATURES[6..8]` (save-safe);
same dex, XP, candy, eggs, grass/fishing; one new currency — **Gold Coins**
from math wins, feeding the canon chase: *Gimmighoul evolves into Gholdengo
at 30 coins*.

### The engine change everything hinges on: display ≠ answer
Prompt pools gain object entries `{ d: "7 × 6 = ?", a: "42", think: 6 }`.
`S.text` becomes the **answer** (everything downstream — validation, WPM,
per-char rendering — keeps working); new `S.display` carries the question.
- Question card renders above the answer slots in the message box (rounded
  display font — math is read, not transcribed; real `× ÷ −` glyphs live in
  display only, never expected from the keyboard).
- Answer slots reuse the catch-round mystery-box treatment: `_` slots show
  digit count (deliberate scaffold), per-char gold caret / green done / red
  error states unchanged.
- **Leak fix:** the keyboard/finger guide would literally light up the
  answer's next digit — suppress it in answer mode, then **re-enable after
  2 errors as the rescue hint**.
- Stats honesty: answer-mode sessions go to a separate `statsLane: "facts"`
  (correct answers/min), never polluting `bestWpm`/history/medal math.
- iPad: `#kb-catcher` flips to `inputmode="numeric"` during math answers.

### Think vs. type — "the clock only runs while you type"
New `think` state before each answer prompt: **no timer**; bar breathes at
35% opacity with a `🤔 think it through…` pill. First keypress flips to
`⌨️ go!` and starts a short **typing-only** budget (~1.2s + 0.9s/char ×
difficulty). Turbo never compresses think time; Chill is fully untimed.
**Combo mercy:** the first wrong attempt per math prompt doesn't reset the
combo (arithmetic errors are thinking, not typing). Speed pressure on facts
exists only as an opt-in "⚡ Lightning Round" level type.

### The support ladder (never "WRONG")
1st miss: red flash + "Not quite — check it again! ✋" (a chance to
self-correct). 2nd: the **helper card** slides in — skip-count strip for ×,
fact-family triangle for ÷, number-line hops for +/− (introduced by the
tutor beforehand as "trainer's notes" so it never reads as failure). 3rd or
timeout: the answer **ghost-types itself** in blue (shown, not earned), the
kid echoes it once to continue, and the same problem silently re-queues 2-3
prompts later — solving the re-meet pays "🧠 You remembered! +5".

### Island 1 — Gimmighoul Coast (MATH, grade 4-5)
Treasure-coast bank fiction (Meowth, coin stacks, vault doors). New keys:
the **number row** (taught index-fingers-first, with "reach UP from J to 7,
then come home" anchoring), then `+ - = /`.

| # | Level | Keys | Prompts look like |
|---|-------|------|-------------------|
| 1 | 4 and 7 | `47` | drills: `4`, `47`, `7447` |
| 2 | 3 and 8 | `38` | drills + count-the-berries answers |
| 3 | 2 and 9 | `29` | "two hundred forty-seven" → `247` |
| 4 | 1 0 5 6 | `1056` | place value: "300 + 40 + 7 = ?" → `347` |
| 5 | Times Tables I | — | "7 × 3 = ?" → `21` (facts 2-5, 10) |
| 6 | Times & Divide | — | "42 ÷ 6 = ?" → `7` (always exact) |
| 7 | Equation Builder | `+-=` | typed fact families `6+7=13`; "356 + 248 = ?" → `604` |
| 8 | Treasure Math | `/` | "1/2 of 8 = ?" → `4`; "2 + 3 × 4 = ?" → `14` |

Boss: **Gholdengo, "The Vault"** — mixed facts, double partner charge on
perfect answers. 16 new creatures (Meowth, Gimmighoul→Gholdengo by coins,
Sableye, Carbink, Luvdisc for fishing…), all real PokeAPI ids; names stay
alphabet-only so catch rounds never need digits.

### Island 2 — Circuit Town (CODING)
Neon PC-box city run by Porygon; Rotom guides; MissingNo glitches it. ~80%
verbatim typing (cheapest island — but sequenced second so math proves the
answer engine first). New keys: `( ) ; " { } < >` via a `SHIFT_MAP` with
correct finger hints; dual-legend keycaps (shift symbol in the corner, gold
when targeted).

Ramp: `()` → camelCase → `jump()`, `pikachu.attack()` → strings
`say("hi")` → variables `let hp = 10;` → conditionals `if (hp < 5) heal();`
→ loops `repeat(4) { step(); }` → predict-the-output answers ("x = ?" →
`5`) and fix-the-bug (type the corrected line). **The run effect:** every
completed code prompt *executes* — a console strip typewriters the output
(`print("pika")` → `> pika`). Monospace inset block, 2-line cap (3 absolute
max), indentation as dim middle-dots, NO syntax highlighting during typing
(it would fight the correct/incorrect colors — color belongs to the output
moment). Error hints name the symbol: "needs ( — hold ⇧ Shift + 9"; bracket
pairs glow gold when the caret sits on one.

Boss: **MissingNo.EXE possessing Porygon-Z** — "I live in the code now.
Debug THIS." Creatures: Porygon line, Rotom, Joltik/Galvantula,
Grubbin→Vikavolt, Beldum, Genesect, Magearna…

### Island 3 — The Old Power Plant (CS / ENGINEERING)
Canon Kanto Power Plant, half-dead; restore it system by system to summon
**Zapdos**. By the end the kid can type a hex color, a file path, and an
email address. New keys: `# @ _ : [ ]`.

Ramp: machine vocab (`cpu`, `circuit`) → hex colors with live swatch
(`#ffd34d` — the game's own palette) → binary with 8-4-2-1 dot helper
("0101 = ?" → `5`, ≤4 bits) → logic gates ("true AND false = ?" → `false`)
→ file paths (`img/zapdos.png`) → addresses (`prof.oak@lab.kanto`) →
Caesar ciphers ±1/2 ("shift back 1: dbu" → `cat`) → boot-sequence precision
strings (`power: 0x2f`). Relief valve: answer prompts repeatedly missed
mutate into copy prompts ("Magnemite shows you: 0101 = 5 — type 5").

Boss: **Reboot the Generator** — each perfect word lights a generator lamp;
clearing makes Zapdos catchable and adds it to the weekly roamer pool.

### Travel — the Sea Chart
Not tabs, not one mega-map: a flat DS-style **town-map modal** (like the
area panel — animations safe there) reached via the Ferry Dock pin, a HUD
button, or auto-open on unlock. Islands as SVG blobs with name banners and
conic-gradient completion rings; ferry animates along dashed routes with a
two-tone horn; each island is its own pannable map (island-parametrized
renderMap; stage keys namespaced). **Locked islands tease:** dark
silhouettes under drifting clouds, weekly rumor lines ("Sailors hear
counting in the fog…"), explicit unlock requirements — zero countdowns.

### Subject onboarding
Ferry horn → Sea Chart opens, clouds part (T5 Ceremony "A NEW ISLAND
APPEARS") → arrival at the pier, everything fogged except the tutor →
Klefki-pattern lesson (Alakazam teaches math; Porygon teaches code) that
demos the think/type rule in words and **deliberately shows the helper card**
("that's not cheating, that's training") → optional untimed **Captain's
Quiz** placement: passing auto-credits levels 1-3 with stars (a master
typist never grinds "press 4") → first three levels: short answers, combo
mercy, plain T2 celebration (no condescending fanfare for easy content).
First clears pay trophies "First Numbers" and **"Hello, World!"**.

### Concept lessons — assume the trainer is NEW to the subject
The island tutor teaches the *mechanics* (think/type, helper cards). But a
kid meeting multiplication or variables for the first time needs the
**concept taught from zero** — so every level that introduces a new idea
opens with an interactive mini-lesson, built by generalizing tutorial.js
into a data-driven `LESSONS` registry.

**Lesson anatomy (4-8 steps, 60-90 seconds, Klefki pacing):** steps are
typed `{say}` (tutor bubble), `{show}` (a visual board), `{guide}` (one
expected keypress/answer with the full hint stack), `{try}` (an untimed
real prompt). Pedagogy is strict **concrete → pictorial → abstract**:
- *Times Tables:* "3 × 4 means 3 GROUPS of 4" → three berry clusters pop
  in → "count them… type the total!" → the skip-count strip appears
  (4·8·12) → two untimed practice facts → level starts.
- *Division:* 12 berries shared into 3 bowls, one by one → the fact-family
  triangle → "÷ just asks: how many in each group?"
- *Variables:* a labeled box visual — `hp` written on a crate, a `10`
  dropped in → "the name remembers the number" → type `let hp = 10;` and
  the crate fills.
- *Loops:* Porygon walks 4 steps as `repeat(4)` highlights each pass.
- *Binary:* a row of four lamps labeled 8-4-2-1; the kid toggles them by
  typing `1`/`0` and watches the total change — then reads `0101` cold.
- *Logic gates:* two switches and a door — AND needs both, OR needs one.

**Entry rules:** a lesson auto-plays the first time its level is entered
(one tap on "🎓 Teach me!" vs "I know this — skip"); Explorer band defaults
into the lesson, Ace gets the skip pre-selected; passing the Captain's Quiz
marks early lessons seen. Every lesson is replayable forever: from the
level card, and from the 🎓 button which becomes the island-aware
**Professor's Notebook** — the full lesson list with ✓ marks. The in-play
helper card's third step ("ghost-type the answer") gains a "want the
lesson again?" link, closing the loop: struggle → offer the teaching, not
just the answer. Seen-markers in `flags.lessons`; lesson completion pays a
small one-time XP nibble (learning is rewarded, skipping is never
punished).

### Parent analytics (Grown-ups corner)
Per-key accuracy heatmap rendered on the actual keyboard layout; a 12×12
times-table heatmap once math lands (`recordFact(op,a,b,ok)`); 14-day
time-played chart with a dashed 15-minute "sweet spot" line (time data is
parent-only — kids never see a clock); weekly digest line.

---

## Part 5 — Engine & save changes (ordered by what unblocks what)

1. **Prompt-object layer** — `promptAnswer(p)`/`promptLen(p)` helpers;
   `nextPrompt` sets `S.text = answer`, `S.display = question`, adds
   `think` seconds inside the timer parenthesis; guide suppression +
   2-error rescue; `CHAR_EQUIV` input normalization. Unblocks all of Part 4.
2. **`HALL_W` constant + per-world flags** (`unlockAfter`, `properNames`,
   `kb`, `statsLane`). Unblocks appending worlds at all.
3. **`stageBest` + `stats.counters` recording** — ship FIRST chronologically;
   data accrues silently so medals/research have history on day one.
4. **Session options** (`timeScale`, `forceNinja`, `requeueOnError`,
   `startTimerOnFirstKey`, `statsLane`, `xpScale`, `noStageWrite`).
   Unblocks daily/elite/rematches/scholar timing.
5. **Keyboard layout registry** — `KB_LAYOUTS`, digit/symbol `KEY_FINGER`
   entries, `SHIFT_MAP`, `buildKeyboard(layoutId)`, dual-legend keycaps.
6. **Island/map registry** — wrap current map constants into `ISLANDS[0]`;
   `renderMap(island)`; ferry + Sea Chart. Largest pure refactor; schedule
   with the first region, not before.
7. **Skill-band plumbing** — `profileBand` on the player; `bandParams(area,
   band)` in data.js (word-length filters, number ranges, line caps, boss
   HP); per-band generators on math levels; the level card UI (band pips,
   Enter quick-start); step-up/assist offers on results/defeat;
   `stageBest[key].band`; medal gates check band. Unblocks Part 3
   everywhere; the math generators land with Part 4's island.
8. **Onboarding framework** — `FEATURE_INTROS` registry + parcel map pin +
   letter overlay + spotlight component (`flags.intros`); intros claim the
   mapHints priority slot. Ships with the first feature that needs it
   (medals) and every later feature registers an entry.
9. **LESSONS framework** — generalize tutorial.js into data-driven steps
   (`say/show/guide/try`) with visual boards (berry groups, number line,
   crate-variable, binary lamps, logic door); lesson ids on levels;
   `flags.lessons`; Professor's Notebook list view on the 🎓 button.
10. **New save fields** (all additive via `defaults()`, no version bump):
   `stageBest` (incl. `band`), `stats.counters`, `daily`, `dailyWeek`,
   `vouchers`, `elite`, `hof`, `research`, `rematch`, `raid`, `unlocks`,
   `coins`, `island`, `scholar`, `streak.tokens`, `stats.days`,
   `profileBand`, `flags.intros`, `flags.lessons`. Plus appended TROPHIES/
   WORLDS/CREATURES/EVOLUTIONS/WATER_POKEMON rows. Only bespoke logic:
   Gholdengo's coin evolution.
11. **Journal/Museum surfaces** — UI-only, can trail each feature.

---

## Part 6 — Phased roadmap

| Phase | Scope | Why this order |
|---|---|---|
| **0** (half-day) | C2 + C3 (constants, flags, stageBest/counters recording) + postgame "Professor's letter" map beat | Zero-risk groundwork; bests start accruing now; the endgame gets a door |
| **1** (3-5 days) | Mastery Medals + Shiny Charm + Museum v1 + **onboarding framework with the medals letter as its first entry** | Answers "what now" within a week using content he already owns; instant Bronzes on day one; every later feature reuses the letter/spotlight system |
| **2** (4-6 days) | Daily Drill + Research board + wardrobe layer + Today's-Adventure card + streak rest tokens + **skill bands v1** (band chip, level card, story-world filters, step-up/assist offers) | Establishes the healthy daily/weekly rhythm and the reward sink; bands open the game to siblings before the islands arrive; session options double as the scholar-timing dress rehearsal |
| **3** (~1 week) | Elite Four & Champion (+ rematch tiers) + Hall of Fame T6 ceremony | The emotional summit, fed by Phase-1 medals |
| **4** (1.5-2.5 weeks) | C1+C5+C6 dark, then **Gimmighoul Coast** (math) + Sea Chart + think/type + helper cards + Captain's Quiz + **LESSONS framework with the math concept lessons** + per-band math generators | Math first: smallest keyboard delta, proves the answer engine on one-line content, highest home value; the ferry IS the marketing beat; lessons ship with the first subject that needs them |
| **5** (~1 week) | **Circuit Town** (coding) + run-effect console + SHIFT_MAP keycaps + coding concept lessons | ~80% verbatim typing — cheapest island; reuses hardened answer machinery and the lesson framework; verify quote normalization on iPad here |
| **6** (1-2 weeks) | **Old Power Plant** (CS) + CS concept lessons (binary lamps, logic door) + Zapdos roamer + bench items (Raid, Practice Ghost) as appetite allows | Most novel content lands when answer-mode experience is deepest |

Cross-cutting: append-only data; every new field through `defaults()`; one
parent-corner line per system; **each phase ends with the kid playing for a
week before the next starts — his behavior is the real telemetry.**

---

## The hard "do NOT" list

- No streak-loss threats, expiry countdowns, or "play now or lose it".
- No appointment guilt ("your Pokemon misses you"); absence costs nothing;
  nothing earned ever decays.
- No near-miss gambling framing; shiny odds stay invisible until they hit.
- No red badge counters, escalating login chests, or limited-time anything.
- No leaderboards against strangers — the only ghost to race is yourself.
- No session-extension bribes and no post-goal XP nerfs.
- Never compress think time with difficulty; Turbo buys typing pressure only.
- Never break combo on a first arithmetic error; never display "WRONG";
  the helper card is a tool (the tutor introduces it), never a penalty.
- Year one never requires typing `×`, `÷`, tab, or >3 code lines.
- Map pins: paint-only hover, transforms only in the end-of-file billboard
  block; celebration overlays respect reduced-motion, the Enter debounce,
  and the one-splash-at-a-time queue.
