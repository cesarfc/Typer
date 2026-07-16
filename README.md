# TypeQuest ⚡ Gotta type them all!

A Pokemon-themed typing adventure for kids: catch Pokemon, dig through
Mt. Moon, win gym battles, and face bosses like Team Rocket and a
sleeping Snorlax — and secretly learn real touch typing along the way.

(Fan-made for home use. All art is plain emoji — no copyrighted images;
Pokemon names appear as practice text only.)

No installs, no internet, no accounts. **Just open `index.html` in a browser.**

## Requirements (Windows & Mac)

- **Any modern browser**: Chrome, Edge, Firefox or Safari.
- **A physical keyboard** (the on-screen finger guide assumes QWERTY).
- **Nothing to install for the game itself** — it is plain HTML/JS/CSS.
- *Optional, one-time:* **Node.js 14+** to download the Pokemon artwork
  (`node tools/get-sprites.mjs`); without it the game shows emoji instead.
  - Mac: `brew install node` or the installer from [nodejs.org](https://nodejs.org)
  - Windows: install **Node.js LTS** from [nodejs.org](https://nodejs.org)

## How to run on a Mac

1. **Simplest:** double-click `index.html` — it opens in your browser.
2. **Recommended** (enables automatic restore from `typequest-save.json`):
   open Terminal in this folder and run

   ```bash
   python3 -m http.server 8642   # python3 ships with macOS
   ```

   then visit <http://localhost:8642>.

## How to run on Windows

1. **Simplest:** double-click `index.html`.
2. **Recommended server:** install Python from the Microsoft Store (or
   python.org), then in this folder run

   ```powershell
   py -m http.server 8642        # or: python -m http.server 8642
   ```

   and visit <http://localhost:8642>. (Node alternative: `npx serve .`)

**Note:** when opened by double-click (a `file://` address), browsers block
the automatic save-file restore — use the title screen's
"💾 restore from a backup file" link instead. Everything else works the same.

Progress saves automatically in the browser (localStorage), so use the same
browser on the same computer to keep the save.

## How to run on an iPad or iPhone

The repo includes a native iOS app — a thin shell that bundles the whole
game (artwork included, if downloaded) so it works fully offline with its
own home-screen icon. Building it requires a **Mac with Xcode** (free on
the App Store) and a **free Apple ID**:

1. *Optional but recommended:* download the Pokemon artwork first
   (`node tools/get-sprites.mjs`) — whatever is on disk gets bundled
   into the app automatically.
2. Open `ios/TypeQuest.xcodeproj` in Xcode.
3. Select the **TypeQuest** target → **Signing & Capabilities** → set
   **Team** to your Apple ID (add it under Xcode ▸ Settings ▸ Accounts
   if it's not listed).
4. Plug in the iPad, pick it as the run destination, and press **Run** (▶).
5. First time only, on the iPad: **Settings ▸ General ▸ VPN & Device
   Management** → trust your developer certificate.

Notes:

- With a **free** Apple ID the install expires after **7 days** — just
  press Run again to refresh it (saves are kept; they live on the iPad).
  A paid developer account ($99/yr) extends this to a year.
- **A hardware keyboard (Smart/Magic Keyboard or Bluetooth) is strongly
  recommended** — finger placement is the whole point! Without one, the
  game brings up the on-screen iOS keyboard during play, which works but
  can't teach real finger technique.
- Game saves live inside the app on the iPad. The Stats ▸ backup/restore
  flow works there too (backups land in the Files app), so progress can
  move between iPad and computer.

## Real Pokemon artwork (one-time setup)

```bash
node tools/get-sprites.mjs
```

This downloads the official-artwork images (normal + shiny + bosses,
~14 MB) from the community [PokeAPI sprites](https://github.com/PokeAPI/sprites)
repository into `img/pokemon/`. That folder is **gitignored on purpose** —
the artwork belongs to Nintendo/The Pokemon Company, so it stays on your
computer rather than in the repository. If you skip this step the game
still works and shows emoji instead.

## Developer tools

The game is plain script-tag JavaScript — no build step. A few Node scripts
(no npm install needed) keep it healthy:

```bash
node --test tools/test.mjs        # unit tests for the pure game logic
node tools/validate-content.mjs   # check the curriculum/puzzles/roster data
node tools/bump-cache.mjs         # bump every ?v=N in index.html after a deploy
```

- **`tools/test.mjs`** loads the real `js/data.js` + `js/save.js` + `js/puzzle.js`
  and tests trades, save migration/backup, XP math, and the trophy table.
  (`node --test tools/` scans a directory only on newer Node builds; the
  explicit path above always works, as does `node --test` from the repo root.)
- **`tools/validate-content.mjs`** mechanically verifies the content promises —
  every word is typeable with the keys taught so far, every Puzzle Lab stage is
  solvable for 3 stars within budget (checked with the real interpreter), and
  the roster/trophy/README counts line up. Exits non-zero on any violation.
- **`tools/bump-cache.mjs`** rewrites the `?v=N` cache-busters in `index.html`
  (bump all to N+1, or `--set N`; `--dry` previews). Run it whenever you change
  CSS/JS so the iPad web-app fetches the new files instead of a stale cache.

## Never lose progress (backup → commit)

Progress autosaves in the browser, but browsers can lose it (cache clears,
different browser, new computer). To make it permanent:

1. Open **Stats → 💾 Save data → ⬇ Download backup**.
2. Move the downloaded `typequest-save.json` into this game folder
   (replacing the old one if present).
3. Commit it: `git add typequest-save.json && git commit -m "Save progress"`

On any fresh browser or computer, the game **finds that file automatically**
and restores everyone's progress (when run via the local server; with
`file://` use the "💾 restore from a backup file" link on the title screen).
Restoring is always safe: it merges by player and keeps whichever copy has
more XP, so an old backup never erases newer progress. Repeat the backup
once in a while — like saving at a Pokemon Center. 

**Multiple players:** the title screen asks "Who is playing today?" — up to 8
players, each with their own worlds, creatures, trophies and streaks. Click
the player name in the top bar (⇄) any time to switch. Deleting or erasing a
player never touches the others.

**Difficulty (per player):** chosen when creating a player and changeable any
time with the 🐢/🙂/🔥 button in the top bar:

- 🐢 **Chill** — 45% more time on every word. Great for starting out.
- 🙂 **Normal** — the standard challenge.
- 🔥 **Turbo** — 30% less time, but every level pays **+25% XP**.

## The journey (the hidden curriculum)

Each world secretly teaches the next set of keys with proper finger placement,
and every word in a world only uses keys already learned:

| World | Theme | Keys learned |
|---|---|---|
| 🌳 1. Pallet Meadow | first catches | home row: A S D F · J K L ; |
| ⛏️ 2. Mt. Moon Caves | dig for Moon Stones | E I R U |
| 🏟️ 3. Battle Stadium | gym battles | T O W N G H |
| 🐉 4. Dragon's Den | Pokemon moves | M P Y B + space phrases |
| 🌲 5. Eterna Forest | expert moves | C V X Z Q (full alphabet) |
| 👑 6. Hall of Fame | final test | Shift, capitals, full sentences |

Each world is **8 levels + a boss**, with extra practice levels between new
keys so the difficulty climbs gently. The world map is a pannable region —
drag (or scroll) to explore towns, terrain and the winding route; your
avatar stands at your next challenge, and wild Pokemon appear along the
route (silhouettes until you catch them).

Wild Pokemon are matched to each world so their names mostly use the keys
already learned; any not-yet-taught letter adds bonus catch time and lights
up on the on-screen keyboard, so early catches double as a sneak preview.
Catch rounds open with a wobbling Pokeball that bursts open to reveal the
mystery Pokemon — then the clock starts.

## What keeps kids coming back

- **130 Pokemon to collect** — from Magikarp to Arceus. Finish a level, then
  type the wild Pokemon's name fast enough to catch it. Rarer Pokemon only
  appear after better runs (common 1★ · rare 2★ · epic 3★), and 3-star
  catches can be ✨ **shiny**.
- **Evolution!** Once a region's wild Pokemon are all caught, catch rounds
  offer duplicates that earn 🍬 candy. Three candy lets you EVOLVE from the
  Pokedex by typing the evolved name — Bulbasaur→Ivysaur→Venusaur,
  Magikarp→Gyarados, and Eevee gets to choose between four evolutions.
  Evolving into something you already own upgrades it to ✨ shiny.
- **Wild encounters on the map** — every day, 4 patches of 🌿 tall grass
  rustle somewhere in your unlocked regions: click one, weaken the wild
  Pokemon with two words, then type its name to catch it. 🎣 Fishing spots
  (the Fishing Pier lake and more as you progress) give 3 casts a day — wait
  for the bite, type fast to reel, and see what's on the hook. Wild catches
  pay +15 XP and can be shiny.
- **Mystery Eggs** — the first level you finish each day grants a 🥚.
  Finish 3 more levels to warm it, then hatch it on the map: wobble,
  crack, flash... and type the hatchling's name to welcome it (no timer —
  hatching is a gift). Longer daily streaks hatch rarer Pokemon and raise
  the shiny chance up to 25%, so playing every day really pays.
- **Your party of 6** — star (★) caught Pokemon in the Pokedex to add them
  to your party, shown at the bottom of the map (click a member to make it
  your lead). Your lead fights beside you: it delivers your attacks in
  battle, and in boss and legendary fights its **power meter charges from
  your typing** — every correct key adds charge, combo streaks charge
  faster, flawless words add a burst. At full charge your partner unleashes
  its move and wipes out an enemy word on its own.
- **Roaming legendary** — once a week a legendary appears somewhere on the
  island with a golden aura (after reaching the Battle Stadium). One
  attempt per week: three battle words at a faster pace, then its name.
  Catch it for the Legend Catcher trophy; a duplicate legendary turns
  your copy ✨ shiny.
- **🏫 Trainer School (practice mode)** — tap the **🏫 Practice** chip on the
  map to enter a building with **no countdown at all**: a stopwatch counts up
  (only while you type) and you race your own best time and best WPM. Four
  difficulties — Easy, Medium, Hard, Expert — unlock alongside the story worlds
  and keep separate records. New records pay bonus XP; relaxed practice, real
  progress. **Race a sibling's ghost:** once another family member has set a
  record, a little "🏁 Race:" picker under each drill lets you chase their
  👻 ghost instead of your own — the marker shows their name and the results
  card cheers "You beat Maya's ghost by 3.2s!" (earning the 🏁 Family Race
  trophy the first time).
- **📚 My Words (custom spelling packs)** — inside the Trainer School, parents
  can add weekly spelling lists (one word per line) that run as their own
  stopwatch drills, with best times, ghost racing, and the 📚 Word Collector
  trophy. Edit or delete a pack any time — deleting drops its best times but
  keeps the XP and trophies already earned.
- **📖 Story Typing** — also inside the Trainer School, unlocked once you reach
  the 👑 Hall of Fame (you'll need your capitals and punctuation). Type a whole
  short story as flowing prose — ten to choose from — with no countdown: the
  stopwatch counts up while you type and you race your own best WPM (or a
  sibling's ghost, with the same 🏁 Race picker as the speed drills).
- **🪪 Typing License** — the end-game number-row course, unlocked in the
  Trainer School once you become the 👑 Champion. Four tiers — Learner 🔰,
  Bronze 🥉, Silver 🥈, Gold 🥇 — take you from bare digits and years, through
  numbers inside words and shifted punctuation, up to full sentences with both.
  The on-screen keyboard grows the number row just for these drills, and typing
  a tier at 90%+ accuracy earns its stamp; collect all four for the 🪪 Licensed
  Typist trophy.
- **🧩 Puzzle Isles (block coding + math)** — a flight perch beside the Trainer
  School, opening once you reach Mt. Moon. Tap it and a bird sweeps you off to
  one of two islands you **fly to**: **💻 Circuit Isle** or **🔢 Counting Isle**.
  Each isle is a painted islet with its puzzles laid out as a winding **trail of
  nodes** (starred, numbered, padlocked) and landmarks marking each chapter.
  **No keyboard needed to play:** snap code blocks together to guide a Pokemon
  through grid puzzles, then catch a new friend the usual way — by typing its
  name (the only typing here). Circuit Isle teaches walking, loops, ifs,
  AND/OR/NOT logic and a capstone **Inventions** chapter across six chapters (24
  stages); **Counting Isle is fully independent** — reachable from the very first
  flight, no coding required — with counting, times-tables, number-line hops and
  a **Sharing** (division) chapter across five chapters (19 stages). Tap **⏭
  Step** to walk your plan one block at a time, pick a 🐢/🐇/⚡ playback speed, and
  tap **💡 Hint** for a gentle ladder of tips (with a "Watch a bit" demo on the
  very first stages). Flying is a delight and never blocks you — it's instant
  under reduced-motion and skippable with a tap. **34 new Pokemon live only
  here** — solving stages is the one way to catch them. No clocks, no fail
  states: hints teach, they never scold.
- **🔨 The Maker Hut** — a little workshop on each isle (it opens once you've
  earned a ⭐ on every Chapter 1 puzzle there, so you know the blocks). Inside,
  kids **design their own walk-grid stages** entirely by tapping: pick a grid
  size (4×4, 5×4 or 5×5), paint paths, trees, water, berries, a start (tap it
  again to turn the arrow) and a flag, then choose which blocks the solver gets
  (walk and turn are always on; collect switches on when you place berries;
  repeat, if, if/else and AND/OR logic are yours to toggle). The heart of it is
  the **proof rule**: before you can publish, you must **solve your own stage**
  in the normal playfield — your winning block count becomes the record to beat,
  which guarantees every published stage is solvable and teaches that designers
  test their work. Name it (the only typing), and it lands on your **My stages**
  shelf; every other family trainer sees it under **Family stages** and can play
  it. Beat the creator's own record and you get a delighted callout. Maker plays
  pay a little XP but **never catch Pokemon** (the dex stays honest) and never
  touch anyone else's save. Trophies: 🔨 Stage Designer (publish your first) and
  🏗️ Master Builder (publish 5). Up to 8 stages per kid.
- **🤝 Family Trading Post** — a market stall on the south shore where two
  family trainers swap Pokemon one-for-one on the shared device. Pick a
  sibling, each side offers one Pokemon from their Pokedex, then a big
  both-agree ritual ("Do you BOTH agree to trade X for Y?") seals it — two
  pokeballs arc across and both trainers earn the 🤝 Best Friends trophy on
  their first trade. Shinies can be traded (the sparkle travels with the
  Pokemon); candy stays home; and every trade is undoable, since trading back
  is free and wild, egg, roamer and Puzzle Lab Pokemon all become catchable
  again once they leave your dex. Cancel is always one tap — no pressure, ever.
- **Create your own trainer** — pick skin tone, hair style and color, hat
  and shirt when making a player (🎲 randomizes). Your trainer appears in
  the top bar, standing on the map, and in every battle. Existing players
  can redesign theirs with the 👤 button on the "Who is playing" screen.
- **DS-style presentation** — the island map is a tilted 3D view with the
  horizon in the distance and trees, towns and Pokemon standing upright on
  the ground, and battles stage your trainer and partner on a near platform
  facing the enemy on a far one, with a message-box prompt panel. Towns and
  forests mix original vector art with openly licensed pixel tiles by
  Kelvin Shadewing (via the Tuxemon project — see CREDITS.md).
- **Seasons on the island** — the map quietly dresses for the real time of
  year: a snowy dusting and snow-capped trees in winter, blossoms and drifting
  petals in spring, amber leaves falling in autumn, extra butterflies and pond
  fireflies in summer — plus fireworks on New Year's Day and the Fourth of July
  and a couple of pumpkins near town at Halloween. It's decoration only (no
  timed rewards, nothing to miss) and the particles rest under reduced-motion.
- **Combos** — 25 correct keys in a row triggers SUPER MODE.
- **XP, levels and titles** — from Rookie all the way to Typing Legend.
- **🗼 The Battle Tower** — a tower near the Battle Stadium (opens once you
  reach it) offers an endless typing climb: each floor is four battle words
  drawn from every world you've unlocked, and the clock tightens a little each
  floor. Three hearts last the whole climb and a missed word costs one. Rewards
  bank every 5 floors — XP, a candy voucher at floor 10, and from floor 15 a
  small chance to shiny-upgrade one of your Pokemon — and they are **never
  lost**: quitting or running out of hearts keeps everything already earned.
  Your best floor is saved. Trophies: 🗼 Tower Challenger (floor 5) and
  🏯 Tower Master (floor 15).
- **🎓 Printable diplomas** — the Museum's Diplomas tab lists the biggest
  milestones (Champion, Puzzle Master Coder, Number Wizard, Licensed Typist,
  Pokedex Master). Each earned one prints a landscape certificate with the
  trainer's name, avatar, party lineup and the date earned — ready to hang on
  a real wall. Unearned ones show a kind "how to earn it" note.
- **52 trophies**, daily play streaks, and a personal-best speed chart.
- **🥷 Ninja Mode** — hide the on-screen keyboard for 1.5× XP (this is the
  real goal: typing without looking!).

## Tips for parents

- Short sessions beat long ones: **10–15 minutes a day** is the sweet spot
  (the streak counter rewards exactly this).
- New players get **Klefki's typing lesson** automatically: posture, the
  F/J bumps, and placing every finger on its home key, one guided press
  at a time. Replay it any time with the 🎓 button in the top bar.
- During play, two **hand guides** flank the on-screen keyboard — the
  finger that should press the next key lifts and glows, color-matched
  to the keys. Watch their hands at the start: index fingers rest on
  **F** and **J** (the bumpy keys).
- Don't rush past world 1 — slow and accurate first, speed comes by itself.
- Around 10–20 WPM is great for a 9-year-old; the Stats page shows progress
  and which keys need practice.
- Esc pauses. The 🔊 button mutes. "Erase everything" lives at the bottom of
  Stats (double confirmation).

## Tech notes

Plain HTML/CSS/JavaScript — no dependencies, no build step, works offline.
Sounds are synthesized with WebAudio (no audio files). All art is emoji.
A debug handle is exposed at `window.TQ` if you want to tinker.
