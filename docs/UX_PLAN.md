# TypeQuest UI/UX Improvement Plan

Produced from a hands-on UX audit (screens driven live, viewports resized,
edge states reproduced) through the lens of a 9-year-old player and the
parent who administers the game. Strengths to preserve: the three-channel
finger guidance (glowing key + lifted hand finger + text hint), the warm
failure tone everywhere, and the map-as-progress-board with the pulsing
"next" node.

## Findings

Priorities: **P0** fix soon · **P1** high value · **P2** polish

| # | Pri | Issue | Why it matters | Fix | Files |
|---|-----|-------|----------------|-----|-------|
| 1 | P0 | Pause → "Restart Level" **crashes** every non-story session (practice, grass/fishing, evolution, hatch): `Engine.restart()` calls `startStage` with negative stage index | Game silently breaks mid-session | Branch restart by session type; hide Restart for `s < 0` | engine.js, ui.js |
| 2 | P0 | First-run title screen: difficulty picker and **Start Adventure render below the fold** at 1280×800 | The very first minute can dead-end | Compact trainer builder so name + challenge + Start fit ~750px | style.css, index.html |
| 3 | P1 | Clicking a **locked map node gives zero feedback** (53 locked buttons on screen) | Silence reads as "broken"; kids hammer-click boss nodes | Error blip + shake + toast "Beat level N first!" (also locked practice tiers) | ui.js |
| 4 | P1 | **Party system nearly undiscoverable** (tiny 17px star in dex card corner; party bar just shows "+") | The game's best retention hook may never be found | "Add to party" button on catch results; auto-add first catch; labeled "+ Party" pill in dex | ui.js, style.css |
| 5 | P1 | Difficulty control is an **unlabeled emoji icon** that cycles on click | Parent/child can't tell what it is | Icon + current label pill ("🐢 Chill") | index.html, ui.js |
| 6 | P1 | **No `prefers-reduced-motion` support** vs 30+ infinite animations + confetti | No relief for motion-sensitive kids; micro-motion competes with the prompt | Blanket reduce-motion media rule; skip confetti/bursts when matched | style.css, ui.js |
| 7 | P1 | World-1 levels use **catchable Pokemon as shooting targets** with "Caught!" hit text; partner species can equal target (Seel vs Seel) | Breaks the catch fantasy; friend-vs-foe ambiguity | Neutral targets/hit text in world 1; never pick partner's species | data.js, ui.js |
| 8 | P1 | **Toasts expire together (3.4s, no queue)**; trophies celebrated only by toast | Earned rewards vanish unread | Queue (max 2, sequential, ~5s); consider trophy splash | ui.js |
| 9 | P1 | "Erase everything" on the kid-facing Stats page, guarded only by confirm() | One impulsive moment deletes weeks | "Type the player's name to erase" guard; grown-ups section | index.html, ui.js |
| 10 | P1 | **Game screen overflows at 1024×768** (space bar/Ninja clipped; page scrolls mid-game) | Keyboard guide shifts off-screen during play | Height media query: reduce arena/prompt/key sizes | style.css |
| 11 | P2 | Results card slightly exceeds 800px with catch+egg; Enter shortcut undocumented | Buttons at bezel edge; shortcut unused | Trim paddings; "press Enter" hint on Next | style.css, ui.js |
| 12 | P2 | Defeat screen shows **stale egg note** from previous results | Misleading status | Hide `#results-egg` in `showDefeat` | ui.js |
| 13 | P2 | Defeat screen: "Try Again!" and "Replay" are identical | Redundant choice at emotional moment | Hide Replay on defeat | ui.js |
| 14 | P2 | Trainer builder swatch rows wrap orphans next to wrong labels; 11px labels | Wrong-row color picks; tiny labels | Grid swatches (≤6/row); labels above at 13px+ | style.css |
| 15 | P2 | Catch round is timed even on Chill; names contain untaught letters — loss-after-win pattern | Most frustration-prone moment | Untimed catches on Chill (or world 1) | engine.js |
| 16 | P2 | Practice mode reuses world index 0 → shows Pokemon targets instead of the school's training dummies | Repeats #7 inside the school fiction | Gate creature-target branch on `!S.practice` | ui.js |
| 17 | P2 | CapsLock warning at screen bottom, far from the prompt | #1 kid keyboard accident goes unseen | Echo warning in the finger-hint line | ui.js |
| 18 | P2 | Locked practice tiers: unlock text nearly illegible (0.45 opacity + grayscale) | Locked goals are motivation | Dim icon only; full-contrast unlock text | style.css |
| 19 | P2 | A11y gaps: no styled `:focus-visible`, player chip lacks Enter/Space activation, icon buttons title-only, no `aria-live` on toasts | It's a *keyboard* game — focus visibility is table stakes | Gold focus outline; key handler on chip; aria-labels; `aria-live="polite"` | style.css, ui.js, index.html |
| 20 | P2 | Map affordance inconsistencies (school styled like non-clickable labels; cryptic "🌿 4 · 🎣 3" chip) | "What can I touch?" is the core map question | Shared clickable-pin treatment; chip click → explainer toast; one-time grass hint | ui.js, style.css |
| 21 | P2 | Results Enter/Space fires instantly; trailing keystroke can skip screen unread | Accidental skip loses the reward review | Ignore Enter/Space ~800ms after results show | main.js, ui.js |
| 22 | P2 | First prompt's countdown runs while "New keys: F J" announce is still up | Reading the lesson costs timer | Delay first timer ~700ms | engine.js |
| 23 | P2 | Boss HUD stacks 4 meters (progress + inverse boss HP + partner + timer) | Redundant data at the hardest moment | Hide `#hud-progress` in boss fights | ui.js |
| 24 | P2 | Player delete "✕" beside edit on player cards; confirm()-only guard | Mis-click near main tap area | Separation + name-typing guard | ui.js, style.css |
| 25 | P2 | Egg-hatch welcome shows a full timer bar while saying "no rush" | Implies pressure in the pressure-free moment | Hide timer bar in welcome/hatch states | ui.js |

## Phases

### Phase A — Quick wins (≤1 day)
- [ ] #1 Restart guard for non-story sessions (+ hide button)
- [ ] #3 Locked node/tier click feedback
- [ ] #12 #13 Defeat screen: stale egg note + duplicate button
- [ ] #16 Practice uses its own targets
- [ ] #5 Difficulty pill with label
- [ ] #23 #25 Hide redundant meters (boss progress, hatch timer bar)
- [ ] #17 CapsLock warning at the prompt
- [ ] #21 #22 Enter debounce on results; first-prompt timer delay
- [ ] #6 `prefers-reduced-motion` support
- [ ] #19 Focus-visible outline, aria-live, chip keyboard activation
- [ ] #18 Locked tier text contrast

### Phase B — High value (1–3 days)
- [ ] #2 Title screen fits above the fold
- [ ] #4 Party onboarding (catch-results button, auto-add first, "+ Party" pill)
- [ ] #8 Toast queue
- [ ] #7 World-1 targets/hit-text rework + partner-species rule
- [ ] #10 #11 Small-viewport height handling; results trim
- [ ] #14 Trainer builder swatch grid
- [ ] #9 #24 Name-typing guard for destructive actions; grown-ups section
- [ ] #20 Map affordance unification + wild-chip explainer

### Phase C — Bigger bets
- [ ] #15 Pressure tuning: untimed catches on Chill / world 1; difficulty-aware catch timers
- [ ] First-session map onboarding beats (staggered one-time callouts: grass, school, egg, party)
- [ ] Trophy moment upgrade (splash + Trophy Room "NEW" badges)
- [ ] Keyboard-first map navigation (arrows walk the route, Enter starts)
- [ ] Parent corner (session summaries, WPM trend, backup nudges)
