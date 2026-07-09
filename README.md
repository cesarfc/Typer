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

- **120 Pokemon to collect** — from Magikarp to Arceus. Finish a level, then
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
  progress.
- **📖 Story Typing** — also inside the Trainer School, unlocked once you reach
  the 👑 Hall of Fame (you'll need your capitals and punctuation). Type a whole
  short story as flowing prose — ten to choose from — with no countdown: the
  stopwatch counts up while you type and you race your own best WPM.
- **🧩 Puzzle Lab (block coding + math)** — a second side-building beside the
  Trainer School, opening once you reach Mt. Moon. **No keyboard needed to
  play:** snap code blocks together to guide a Pokemon through grid puzzles,
  then catch a new friend the usual way — by typing its name (the only typing
  in the Lab). A **Coding Wing** teaches walking, loops, ifs and AND/OR/NOT
  logic across five chapters; a **Math Wing** (opens after the Loops chapter)
  turns counting, times-tables and number-line hops into moves. Tap **⏭ Step**
  to walk your plan one block at a time, pick a 🐢/🐇/⚡ playback speed, and tap
  **💡 Hint** for a gentle ladder of tips (with a "Watch a bit" demo on the very
  first stages). **24 new Pokemon live only here** — solving stages is the one
  way to catch them. No clocks, no fail states: hints teach, they never scold.
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
- **Combos** — 25 correct keys in a row triggers SUPER MODE.
- **XP, levels and titles** — from Rookie all the way to Typing Legend.
- **43 trophies**, daily play streaks, and a personal-best speed chart.
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
