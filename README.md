# TypeQuest ⚡ Gotta type them all!

A Pokemon-themed typing adventure for kids: catch Pokemon, dig through
Mt. Moon, score goals, battle gym-style bosses like Team Rocket and a
sleeping Snorlax — and secretly learn real touch typing along the way.

(Fan-made for home use. All art is plain emoji — no copyrighted images;
Pokemon names appear as practice text only.)

No installs, no internet, no accounts. **Just open `index.html` in a browser.**

## How to run

- Double-click `index.html` (Chrome, Safari, Edge or Firefox), **or**
- run a tiny local server from this folder if you prefer:

  ```bash
  python3 -m http.server 8642
  # then open http://localhost:8642
  ```

Progress saves automatically in the browser (localStorage), so use the same
browser on the same computer to keep the save.

**Multiple players:** the title screen asks "Who is playing today?" — up to 8
players, each with their own worlds, creatures, trophies and streaks. Click
the player name in the top bar (⇄) any time to switch. Deleting or erasing a
player never touches the others.

## The journey (the hidden curriculum)

Each world secretly teaches the next set of keys with proper finger placement,
and every word in a world only uses keys already learned:

| World | Theme | Keys learned |
|---|---|---|
| 🌳 1. Pallet Meadow | first catches | home row: A S D F · J K L ; |
| ⛏️ 2. Mt. Moon Caves | dig for Moon Stones | E I R U |
| ⚽ 3. Battle Stadium | score goals | T O W N G H |
| 🐉 4. Dragon's Den | Pokemon moves | M P Y B + space phrases |
| 🌲 5. Eterna Forest | expert moves | C V X Z Q (full alphabet) |
| 👑 6. Hall of Fame | final test | Shift, capitals, full sentences |

Wild Pokemon are matched to each world so their names mostly use the keys
already learned; any not-yet-taught letter adds bonus catch time and lights
up on the on-screen keyboard, so early catches double as a sneak preview.

Each world = 5 levels + a **boss fight**. Beating the boss unlocks the next world.

## What keeps kids coming back

- **48 catchable Pokemon** — from Magikarp to Arceus. Finish a level, then
  type the wild Pokemon's name fast enough to catch it. Replay levels to
  complete the Pokedex. 3-star levels can catch ✨ **shiny** versions.
- **Combos** — 25 correct keys in a row triggers SUPER MODE.
- **XP, levels and titles** — from Rookie all the way to Typing Legend.
- **22 trophies**, daily play streaks, and a personal-best speed chart.
- **🥷 Ninja Mode** — hide the on-screen keyboard for 1.5× XP (this is the
  real goal: typing without looking!).

## Tips for parents

- Short sessions beat long ones: **10–15 minutes a day** is the sweet spot
  (the streak counter rewards exactly this).
- Watch their hands at the start: index fingers rest on **F** and **J**
  (the bumpy keys). The on-screen keyboard shows which finger to use,
  color-coded per finger.
- Don't rush past world 1 — slow and accurate first, speed comes by itself.
- Around 10–20 WPM is great for a 9-year-old; the Stats page shows progress
  and which keys need practice.
- Esc pauses. The 🔊 button mutes. "Erase everything" lives at the bottom of
  Stats (double confirmation).

## Tech notes

Plain HTML/CSS/JavaScript — no dependencies, no build step, works offline.
Sounds are synthesized with WebAudio (no audio files). All art is emoji.
A debug handle is exposed at `window.TQ` if you want to tinker.
