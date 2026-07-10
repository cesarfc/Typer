// ============================================================
// TypeQuest — original map sprites: structures and objects drawn
// in a chunky, DS-inspired style (layered SVG, soft outlines).
// All art here is hand-made for this game.
// ============================================================

const MAP_SPRITES = (() => {
  const O = 'stroke="rgba(16,24,42,.55)" stroke-width="2.5" stroke-linejoin="round"';
  const svg = (vw, vh, s, inner) =>
    `<svg class="msprite" width="${s}" height="${Math.round(s * vh / vw)}" viewBox="0 0 ${vw} ${vh}" aria-hidden="true">${inner}</svg>`;

  return {
    tree: s => svg(64, 78, s, `
      <rect x="28" y="50" width="8" height="22" rx="3" fill="#6c4426" ${O}/>
      <ellipse cx="32" cy="32" rx="25" ry="23" fill="#2a7437" ${O}/>
      <ellipse cx="32" cy="27" rx="20" ry="18" fill="#3a9b44"/>
      <ellipse cx="25" cy="19" rx="10" ry="8" fill="#58c24f"/>`),

    pine: s => svg(56, 80, s, `
      <rect x="24" y="58" width="8" height="16" rx="3" fill="#6c4426" ${O}/>
      <polygon points="28,26 54,62 2,62" fill="#2a7437" ${O}/>
      <polygon points="28,12 48,42 8,42" fill="#3a9b44" ${O}/>
      <polygon points="28,2 44,26 12,26" fill="#58c24f" ${O}/>`),

    flower: (s, c = "#ff8ab5") => svg(40, 44, s, `
      <path d="M20 28 q-2 9 -5 13" stroke="#3a9b44" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="20" cy="8" rx="6.5" ry="6.5" fill="${c}" ${O}/>
      <ellipse cx="29" cy="14" rx="6.5" ry="6.5" fill="${c}" ${O}/>
      <ellipse cx="26" cy="24" rx="6.5" ry="6.5" fill="${c}" ${O}/>
      <ellipse cx="14" cy="24" rx="6.5" ry="6.5" fill="${c}" ${O}/>
      <ellipse cx="11" cy="14" rx="6.5" ry="6.5" fill="${c}" ${O}/>
      <circle cx="20" cy="17" r="5.5" fill="#ffd34d" ${O}/>`),

    mushroom: s => svg(44, 44, s, `
      <rect x="17" y="22" width="10" height="15" rx="4" fill="#f3e9d2" ${O}/>
      <path d="M4 24 Q22 -6 40 24 Z" fill="#e3492f" ${O}/>
      <circle cx="15" cy="15" r="3.5" fill="#fff"/>
      <circle cx="27" cy="10" r="3" fill="#fff"/>
      <circle cx="32" cy="18" r="2.5" fill="#fff"/>`),

    grasstuft: s => svg(48, 44, s, `
      <path d="M10 42 Q8 22 2 16 Q14 20 16 40 Z" fill="#2a7437" ${O}/>
      <path d="M18 42 Q16 14 10 6 Q24 12 24 40 Z" fill="#3a9b44" ${O}/>
      <path d="M26 42 Q26 10 24 2 Q34 12 32 40 Z" fill="#58c24f" ${O}/>
      <path d="M34 42 Q36 16 44 8 Q40 24 40 40 Z" fill="#3a9b44" ${O}/>
      <path d="M40 42 Q44 26 46 22 Q46 32 44 41 Z" fill="#2a7437" ${O}/>`),

    wheat: s => svg(44, 46, s, `
      <path d="M12 44 Q10 20 6 12 Q18 18 18 42 Z" fill="#c89a2e" ${O}/>
      <path d="M22 44 Q22 12 20 4 Q30 14 28 42 Z" fill="#f5c84c" ${O}/>
      <path d="M30 44 Q34 20 40 14 Q36 28 36 42 Z" fill="#c89a2e" ${O}/>`),

    rock: s => svg(56, 40, s, `
      <ellipse cx="38" cy="29" rx="16" ry="10" fill="#6f7a8e" ${O}/>
      <ellipse cx="20" cy="25" rx="17" ry="13" fill="#9aa4b5" ${O}/>
      <ellipse cx="15" cy="20" rx="8" ry="5" fill="#c2cad8"/>`),

    crystal: s => svg(48, 48, s, `
      <polygon points="14,44 6,28 14,12 22,28" fill="#7fd4ff" ${O}/>
      <polygon points="30,46 20,26 30,4 40,26" fill="#b39df1" ${O}/>
      <polygon points="40,44 35,32 40,22 45,32" fill="#dff1ff" ${O}/>`),

    mountain: s => svg(96, 78, s, `
      <polygon points="48,4 92,74 4,74" fill="#8d97a9" ${O}/>
      <polygon points="48,4 92,74 48,74" fill="#6f7a8e"/>
      <polygon points="48,4 62,26 54,22 48,30 40,21 34,26" fill="#eef3fa" ${O}/>`),

    house: (s, roof = "#e3492f") => svg(76, 70, s, `
      <rect x="10" y="32" width="56" height="34" rx="3" fill="#f3e9d2" ${O}/>
      <rect x="10" y="54" width="56" height="12" rx="3" fill="#e0d2b4"/>
      <polygon points="4,34 38,6 72,34" fill="${roof}" ${O}/>
      <rect x="31" y="44" width="14" height="22" rx="3" fill="#8a5a33" ${O}/>
      <rect x="50" y="40" width="11" height="10" rx="2" fill="#9fd8ff" ${O}/>
      <rect x="15" y="40" width="11" height="10" rx="2" fill="#9fd8ff" ${O}/>`),

    school: s => svg(108, 78, s, `
      <rect x="6" y="34" width="88" height="38" rx="4" fill="#f3e9d2" ${O}/>
      <polygon points="2,36 50,8 98,36" fill="#3a6fd8" ${O}/>
      <circle cx="50" cy="28" r="8" fill="#fff" ${O}/>
      <path d="M50 23 L50 28 L54 30" stroke="#1a2433" stroke-width="2" fill="none" stroke-linecap="round"/>
      <rect x="42" y="50" width="16" height="22" rx="3" fill="#8a5a33" ${O}/>
      <rect x="14" y="44" width="12" height="11" rx="2" fill="#9fd8ff" ${O}/>
      <rect x="74" y="44" width="12" height="11" rx="2" fill="#9fd8ff" ${O}/>
      <rect x="96" y="12" width="3" height="22" fill="#6c4426"/>
      <polygon points="99,12 108,16 99,21" fill="#e3492f" ${O}/>`),

    lab: s => svg(108, 80, s, `
      <rect x="6" y="34" width="88" height="40" rx="4" fill="#eae3f6" ${O}/>
      <polygon points="2,36 50,8 98,36" fill="#7b46d8" ${O}/>
      <rect x="42" y="52" width="16" height="22" rx="3" fill="#5a3aa0" ${O}/>
      <rect x="14" y="44" width="12" height="11" rx="2" fill="#a7f0d1" ${O}/>
      <rect x="74" y="44" width="12" height="11" rx="2" fill="#a7f0d1" ${O}/>
      <path d="M45 16 L45 24 L38 33 Q36 37 41 37 L59 37 Q64 37 62 33 L55 24 L55 16 Z" fill="#7fd4ff" ${O}/>
      <rect x="43" y="13" width="14" height="4" rx="2" fill="#fff" ${O}/>
      <ellipse cx="50" cy="33" rx="6" ry="3" fill="#43e97b"/>
      <circle cx="96" cy="16" r="4" fill="#ffd34d" ${O}/>
      <rect x="94" y="20" width="4" height="14" fill="#6c4426"/>`),

    gym: s => svg(104, 76, s, `
      <rect x="8" y="42" width="88" height="30" rx="6" fill="#e8e3d6" ${O}/>
      <path d="M8 46 Q52 2 96 46 Z" fill="#ff9b3d" ${O}/>
      <path d="M22 44 Q52 14 82 44 Z" fill="#ffd34d"/>
      <rect x="42" y="52" width="20" height="20" rx="9" fill="#3a4a66" ${O}/>
      <rect x="2" y="28" width="3" height="20" fill="#6c4426"/>
      <polygon points="5,28 16,31 5,35" fill="#3a6fd8" ${O}/>
      <rect x="99" y="28" width="3" height="20" fill="#6c4426"/>
      <polygon points="102,28 91,31 102,35" fill="#e3492f" ${O}/>`),

    mine: s => svg(84, 64, s, `
      <path d="M6 60 Q4 18 42 10 Q80 18 78 60 Z" fill="#8d97a9" ${O}/>
      <path d="M24 60 Q24 30 42 28 Q60 30 60 60 Z" fill="#262d42" ${O}/>
      <rect x="20" y="26" width="6" height="36" fill="#8a5a33" ${O}/>
      <rect x="58" y="26" width="6" height="36" fill="#8a5a33" ${O}/>
      <rect x="18" y="21" width="48" height="7" rx="2" fill="#a06a3d" ${O}/>
      <circle cx="42" cy="40" r="3" fill="#ffd34d"/>`),

    volcano: s => svg(92, 72, s, `
      <polygon points="46,8 88,68 4,68" fill="#8a5a3a" ${O}/>
      <polygon points="46,8 88,68 46,68" fill="#6c4426"/>
      <path d="M34 12 Q46 20 58 12 L52 26 Q46 30 40 26 Z" fill="#ff7b2f" ${O}/>
      <path d="M41 14 Q46 18 51 14 L49 36 Q46 40 43 36 Z" fill="#ffd34d"/>`),

    lanternpost: s => svg(40, 80, s, `
      <rect x="17" y="8" width="6" height="68" rx="2" fill="#3a2d24" ${O}/>
      <rect x="8" y="6" width="24" height="5" rx="2" fill="#3a2d24" ${O}/>
      <rect x="11" y="15" width="18" height="26" rx="8" fill="#ff5340" ${O}/>
      <rect x="14" y="12" width="12" height="5" rx="2" fill="#ffd34d" ${O}/>
      <rect x="14" y="40" width="12" height="4" rx="2" fill="#ffd34d" ${O}/>
      <ellipse cx="20" cy="28" rx="5" ry="8" fill="#ffae54" opacity=".85"/>`),

    hall: s => svg(104, 76, s, `
      <rect x="10" y="64" width="84" height="9" rx="2" fill="#cdb878" ${O}/>
      <rect x="16" y="30" width="72" height="36" fill="#efe6c8" ${O}/>
      <rect x="24" y="33" width="8" height="31" rx="3" fill="#fdf6dd" ${O}/>
      <rect x="42" y="33" width="8" height="31" rx="3" fill="#fdf6dd" ${O}/>
      <rect x="60" y="33" width="8" height="31" rx="3" fill="#fdf6dd" ${O}/>
      <rect x="78" y="33" width="8" height="31" rx="3" fill="#fdf6dd" ${O}/>
      <polygon points="8,32 52,8 96,32" fill="#f5c84c" ${O}/>
      <circle cx="52" cy="24" r="4" fill="#fff" ${O}/>`),

    pier: s => svg(92, 60, s, `
      <polygon points="8,22 50,22 62,56 2,56" fill="#a06a3d" ${O}/>
      <polygon points="8,22 50,22 52,28 6,28" fill="#c08850"/>
      <rect x="8" y="26" width="5" height="18" fill="#6c4426"/>
      <rect x="48" y="26" width="5" height="20" fill="#6c4426"/>
      <path d="M62 36 Q76 31 88 36 L84 46 Q73 50 66 46 Z" fill="#e3492f" ${O}/>
      <polygon points="75,12 75,33 88,31" fill="#fdf6dd" ${O}/>
      <rect x="74" y="10" width="3" height="26" fill="#6c4426"/>`),

    berrybush: s => svg(56, 46, s, `
      <ellipse cx="28" cy="28" rx="25" ry="17" fill="#3a9b44" ${O}/>
      <ellipse cx="20" cy="22" rx="12" ry="8" fill="#58c24f"/>
      <circle cx="16" cy="30" r="4.5" fill="#e3492f" ${O}/>
      <circle cx="30" cy="34" r="4.5" fill="#3a6fd8" ${O}/>
      <circle cx="40" cy="26" r="4.5" fill="#ff8ab5" ${O}/>`),

    flag: (s, c = "#e3492f") => svg(36, 64, s, `
      <rect x="8" y="4" width="4" height="56" rx="2" fill="#6c4426" ${O}/>
      <polygon points="12,6 32,12 12,20" fill="${c}" ${O}/>`),

    sign: s => svg(48, 52, s, `
      <rect x="21" y="24" width="6" height="24" rx="2" fill="#6c4426" ${O}/>
      <rect x="6" y="8" width="36" height="18" rx="4" fill="#a06a3d" ${O}/>
      <line x1="12" y1="14" x2="36" y2="14" stroke="#6c4426" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="12" y1="20" x2="30" y2="20" stroke="#6c4426" stroke-width="2.5" stroke-linecap="round"/>`),

    wave: s => svg(60, 22, s, `
      <path d="M4 16 Q12 4 20 14 M24 18 Q34 4 44 14 M46 16 Q52 8 56 14"
        stroke="#dff1ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>`),

    // Family Trading Post — a little market stall: striped awning over a
    // wooden counter with two pokeballs waiting to be swapped
    trade: s => svg(96, 80, s, `
      <rect x="10" y="34" width="6" height="40" rx="2" fill="#8a5a33" ${O}/>
      <rect x="80" y="34" width="6" height="40" rx="2" fill="#8a5a33" ${O}/>
      <rect x="12" y="46" width="72" height="28" rx="3" fill="#f3e9d2" ${O}/>
      <rect x="12" y="46" width="72" height="8" rx="3" fill="#e0d2b4"/>
      <polygon points="6,34 90,34 84,14 12,14" fill="#e3492f" ${O}/>
      <polygon points="12,34 26,14 40,34" fill="#fdf6dd"/>
      <polygon points="40,34 54,14 68,34" fill="#fdf6dd"/>
      <polygon points="68,34 82,14 90,34 90,34" fill="#fdf6dd"/>
      <path d="M6 34 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 12 0 L84 34 Z" fill="#e3492f" ${O}/>
      <circle cx="34" cy="60" r="7" fill="#fff" ${O}/>
      <path d="M27.2 58.5 a7 7 0 0 1 13.6 0 Z" fill="#e3492f"/>
      <circle cx="34" cy="60" r="2.3" fill="#fff" ${O}/>
      <circle cx="62" cy="60" r="7" fill="#fff" ${O}/>
      <path d="M55.2 58.5 a7 7 0 0 1 13.6 0 Z" fill="#3a6fd8"/>
      <circle cx="62" cy="60" r="2.3" fill="#fff" ${O}/>`),
  };
})();

function mapSprite(name, size, opt) {
  const f = MAP_SPRITES[name];
  return f ? f(size, opt) : "";
}

// A chunky Lost Legends flight bird — charcoal outline, cream belly, a warm
// wing and a little beak. Hand-drawn inline SVG (no billed art). Used under
// the trainer avatar for the "fly to the isles" animation. `size` is the
// on-screen width; height follows the 96×70 art aspect.
function birdSvg(size = 120, cls = "fly-bird") {
  const O = 'stroke="#3a3130" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  return `<svg class="${cls}" width="${Math.round(size)}" height="${Math.round(size * 70 / 96)}"
    viewBox="0 0 96 70" aria-hidden="true">
    <!-- far wing sweeping up behind -->
    <path class="fly-wing-back" d="M52 34 Q34 6 8 14 Q30 22 40 40 Z" fill="#e08a3a" ${O}/>
    <!-- plump body -->
    <ellipse cx="52" cy="42" rx="30" ry="20" fill="#5aa9d6" ${O}/>
    <!-- cream belly -->
    <path d="M30 46 Q52 66 76 46 Q70 58 52 60 Q34 58 30 46 Z" fill="#fff3d6" ${O}/>
    <!-- tail -->
    <path d="M80 40 Q96 34 94 48 Q86 48 80 46 Z" fill="#3f7fa8" ${O}/>
    <!-- head + beak + eye -->
    <circle cx="30" cy="30" r="14" fill="#5aa9d6" ${O}/>
    <polygon points="16,30 2,34 16,38" fill="#ffb24d" ${O}/>
    <circle cx="27" cy="27" r="3.2" fill="#3a3130" stroke="none"/>
    <circle cx="28.2" cy="26" r="1" fill="#fff" stroke="none"/>
    <!-- near wing flapping over the body -->
    <path class="fly-wing-front" d="M50 40 Q40 10 66 6 Q60 26 72 40 Z" fill="#ffc93c" ${O}/>
  </svg>`;
}

// ============================================================
// Pixel tiles cut from openly licensed tilesheets (see CREDITS.md):
// buildings.png and setpieces.png by Kelvin Shadewing, via the
// Tuxemon project. Rendered as CSS sprites, scaled and pixelated.
// ============================================================

const TILE_DEFS = {
  // sheet, x, y, w, h (source pixels)
  centerRed:  ["buildings", 0, 96, 64, 48],
  martBlue:   ["buildings", 80, 96, 72, 48],
  rowBrown:   ["buildings", 0, 152, 64, 56],
  fountain:   ["buildings", 272, 336, 48, 56],
  bushPair:   ["buildings", 272, 86, 32, 28],
  pine:       ["setpieces", 16, 416, 16, 32],
  pineBig:    ["setpieces", 32, 400, 32, 48],
  mushroomT:  ["setpieces", 96, 432, 16, 16],
  rocksT:     ["setpieces", 352, 480, 32, 16],
  bench:      ["setpieces", 536, 480, 48, 16],
};

function tileSprite(name, scale = 2.5) {
  const d = TILE_DEFS[name];
  if (!d) return "";
  const [sheet, x, y, w, h] = d;
  return `<span class="tile" style="width:${w * scale}px;height:${h * scale}px;` +
    `background-image:url('img/tiles/${sheet}.png');` +
    `background-position:${-x * scale}px ${-y * scale}px;` +
    `background-size:${(sheet === "buildings" ? 320 : 720) * scale}px auto"></span>`;
}

// ============================================================
// ART layer — "Lost Legends" flat-cartoon PNGs, our own generated
// pipeline (see CREDITS.md). Manifest-driven: each id maps to a
// transparent PNG with its natural pixel size. artSprite(id, size)
// returns an <img> sized to a target on-map WIDTH (height follows the
// art's aspect), rendered feet-down like the old SVG mapSprites so the
// existing map coordinates keep working. Falls back to "" if the id is
// unknown, letting callers drop back to the legacy SVG/tile.
// ============================================================

const ART_ASSETS = {
  "tq-crossed-swords": { f: "icons/tq-crossed-swords.png", w: 102, h: 99 },
  "tq-egg": { f: "icons/tq-egg.png", w: 94, h: 108 },
  "tq-encyclopedia": { f: "icons/tq-encyclopedia.png", w: 101, h: 106 },
  "tq-fishing-rod": { f: "icons/tq-fishing-rod.png", w: 101, h: 108 },
  "tq-grad-cap": { f: "icons/tq-grad-cap.png", w: 114, h: 95 },
  "tq-journal": { f: "icons/tq-journal.png", w: 96, h: 111 },
  "tq-map": { f: "icons/tq-map.png", w: 108, h: 97 },
  "tq-museum-column": { f: "icons/tq-museum-column.png", w: 90, h: 99 },
  "tq-padlock": { f: "icons/tq-padlock.png", w: 88, h: 107 },
  "tq-star": { f: "icons/tq-star.png", w: 109, h: 103 },
  "tq-stats-chart": { f: "icons/tq-stats-chart.png", w: 100, h: 106 },
  "tq-trophy": { f: "icons/tq-trophy.png", w: 110, h: 111 },
  "tq-berry-bush": { f: "props/tq-berry-bush.png", w: 64, h: 62 },
  "tq-bubbly-tree": { f: "props/tq-bubbly-tree.png", w: 66, h: 73 },
  "tq-cauldron": { f: "props/tq-cauldron.png", w: 59, h: 68 },
  "tq-cliff-rocks": { f: "props/tq-cliff-rocks.png", w: 61, h: 73 },
  "tq-clocktower": { f: "props/tq-clocktower.png", w: 89, h: 137 },
  "tq-flower-patch": { f: "props/tq-flower-patch.png", w: 64, h: 65 },
  "tq-grass-tuft": { f: "props/tq-grass-tuft.png", w: 56, h: 70 },
  "tq-gym-arena": { f: "props/tq-gym-arena.png", w: 121, h: 117 },
  "tq-hall-monument": { f: "props/tq-hall-monument.png", w: 117, h: 132 },
  "tq-lantern-post": { f: "props/tq-lantern-post.png", w: 53, h: 68 },
  "tq-market-stall": { f: "props/tq-market-stall.png", w: 64, h: 71 },
  "tq-mine-entrance": { f: "props/tq-mine-entrance.png", w: 121, h: 118 },
  "tq-mossy-boulder": { f: "props/tq-mossy-boulder.png", w: 69, h: 69 },
  "tq-mushroom-cluster": { f: "props/tq-mushroom-cluster.png", w: 62, h: 65 },
  "tq-pier-hut": { f: "props/tq-pier-hut.png", w: 120, h: 127 },
  "tq-puzzle-lab": { f: "props/tq-puzzle-lab.png", w: 117, h: 128 },
  "tq-raid-den": { f: "props/tq-raid-den.png", w: 125, h: 120 },
  "tq-rock-cluster": { f: "props/tq-rock-cluster.png", w: 60, h: 63 },
  "tq-rope-bridge": { f: "props/tq-rope-bridge.png", w: 70, h: 64 },
  "tq-signpost": { f: "props/tq-signpost.png", w: 57, h: 73 },
  "tq-sparkle-pond": { f: "props/tq-sparkle-pond.png", w: 68, h: 55 },
  "tq-stone-well": { f: "props/tq-stone-well.png", w: 65, h: 73 },
  "tq-tall-pine": { f: "props/tq-tall-pine.png", w: 108, h: 135 },
  "tq-town-house": { f: "props/tq-town-house.png", w: 122, h: 118 },
  "tq-trainer-school": { f: "props/tq-trainer-school.png", w: 131, h: 120 },
  "tq-volcano-lair": { f: "props/tq-volcano-lair.png", w: 131, h: 127 },
  // ---- Isle-biome props (Circuit Isle tech-meadow + Counting Isle orchard) ----
  "tq-gear-clocktower": { f: "props/tq-gear-clocktower.png", w: 96, h: 128 },
  "tq-antenna-workshop": { f: "props/tq-antenna-workshop.png", w: 108, h: 130 },
  "tq-robot-statue": { f: "props/tq-robot-statue.png", w: 96, h: 137 },
  "tq-copper-lantern": { f: "props/tq-copper-lantern.png", w: 46, h: 72 },
  "tq-circuit-flowerbed": { f: "props/tq-circuit-flowerbed.png", w: 66, h: 66 },
  "tq-generator-box": { f: "props/tq-generator-box.png", w: 59, h: 72 },
  "tq-cable-spool": { f: "props/tq-cable-spool.png", w: 55, h: 66 },
  "tq-orchard-tree": { f: "props/tq-orchard-tree.png", w: 64, h: 70 },
  "tq-abacus-stand": { f: "props/tq-abacus-stand.png", w: 63, h: 70 },
  "tq-pie-cart": { f: "props/tq-pie-cart.png", w: 69, h: 74 },
  "tq-haystack": { f: "props/tq-haystack.png", w: 61, h: 62 },
  "tq-stepping-stone": { f: "props/tq-stepping-stone.png", w: 68, h: 58 },
  "tq-windmill": { f: "props/tq-windmill.png", w: 104, h: 132 },
  "tq-apple-basket": { f: "props/tq-apple-basket.png", w: 64, h: 64 },
};

const ART_BASE = "img/art/";

// on a missing/broken art file, swap in the legacy SVG kept in data-fb
// (or just remove the image) so a kid never sees a broken-image icon
function artFail(img) {
  const fb = img.getAttribute("data-fb");
  if (fb) { try { img.outerHTML = decodeURIComponent(fb); return; } catch (e) {} }
  img.remove();
}

// an <img> sized to a target WIDTH in px; height follows the art aspect.
// `extra` carries an optional data-fb="<uri-encoded svg>" for graceful
// fallback when the PNG itself fails to load.
function artSprite(id, size, extra = "") {
  const a = ART_ASSETS[id];
  if (!a) return "";
  const h = Math.round(size * a.h / a.w);
  return `<img class="asprite" src="${ART_BASE}${a.f}" width="${Math.round(size)}" height="${h}" alt="" aria-hidden="true" onerror="artFail(this)"${extra}>`;
}

// a bare UI/HUD icon <img> (square-ish, drawn centered — not grounded)
function artIcon(id, size = 20) {
  const a = ART_ASSETS[id];
  if (!a) return "";
  const h = Math.round(size * a.h / a.w);
  return `<img class="aicon" src="${ART_BASE}${a.f}" width="${Math.round(size)}" height="${h}" alt="" aria-hidden="true">`;
}

// ---- legacy sprite/tile name -> Lost Legends art id ----
// map structures & props (mapSprite names). Anything absent falls back
// to the original hand-drawn SVG so nothing ever renders blank.
const SPRITE_ART = {
  tree: "tq-bubbly-tree",
  pine: "tq-tall-pine",
  flower: "tq-flower-patch",
  mushroom: "tq-mushroom-cluster",
  grasstuft: "tq-grass-tuft",
  rock: "tq-rock-cluster",
  house: "tq-town-house",
  school: "tq-trainer-school",
  lab: "tq-puzzle-lab",
  gym: "tq-gym-arena",
  mine: "tq-mine-entrance",
  volcano: "tq-volcano-lair",
  lanternpost: "tq-lantern-post",
  hall: "tq-hall-monument",
  pier: "tq-pier-hut",
  berrybush: "tq-berry-bush",
  sign: "tq-signpost",
  trade: "tq-market-stall",
  // crystal, mountain, wheat, flag, wave: no art equivalent — keep SVG
};

// pixel tiles (tileSprite names) -> art. Every tile is remapped so the
// clashing Tuxemon pixel art is no longer displayed (see CREDITS.md).
// value = [artId, widthScale] where the on-map width = srcW * scale * k.
const TILE_ART = {
  centerRed: "tq-town-house",
  martBlue: "tq-town-house",
  rowBrown: "tq-town-house",
  fountain: "tq-stone-well",
  bushPair: "tq-berry-bush",
  pine: "tq-tall-pine",
  pineBig: "tq-tall-pine",
  mushroomT: "tq-mushroom-cluster",
  rocksT: "tq-rock-cluster",
  bench: "tq-flower-patch",
};

// unified helpers the map renderer calls: prefer art, else legacy.
// the legacy SVG/tile is also carried in data-fb so a broken PNG still
// degrades to the hand-drawn art rather than a broken-image icon.
function worldSprite(name, size, opt) {
  const id = SPRITE_ART[name];
  if (id && ART_ASSETS[id]) {
    const svg = mapSprite(name, size, opt);
    const fb = svg ? ` data-fb="${encodeURIComponent(svg)}"` : "";
    return artSprite(id, size, fb);
  }
  return mapSprite(name, size, opt);
}
function worldTile(name, scale = 2.5) {
  const id = TILE_ART[name];
  const d = TILE_DEFS[name];
  if (id && d && ART_ASSETS[id]) {
    // reproduce the tile's on-map footprint: srcWidth * scale
    const tile = tileSprite(name, scale);
    const fb = tile ? ` data-fb="${encodeURIComponent(tile)}"` : "";
    return artSprite(id, d[3] * scale, fb);
  }
  return tileSprite(name, scale);
}
