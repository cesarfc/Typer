// ============================================================
// TypeQuest — UI (world map): terrain, seasons, decoration, region
// nodes, area panels, the flying isles and keyboard map navigation.
// Extends the UI object from ui.js (loaded first). Mechanical split.
// ============================================================
Object.assign(UI, {

  // ---------- region map (pannable, DS-style tilted view) ----------
  MAP_W: 2900,
  MAP_H: 1560,
  TILT: 34 * Math.PI / 180, // matches --tilt in CSS
  mapX: 0,
  mapY: 0,
  // route anchor per world + final endpoint; stages snake between them
  mapAnchors: [[230, 1190], [660, 640], [1210, 1010], [1730, 430], [2140, 1030], [2480, 560], [2680, 300]],
  // hand-tuned region-label anchors (bottom-centre) placed in each world's
  // clearest gap so the name pill never lands on a stage node, city or wild
  // Pokemon at default zoom. Fall back to the mid-node if a world is missing.
  MAP_LABELS: [[326, 907], [809, 974], [1356, 714], [1980, 706], [2426, 972], [2697, 598]],

  MAP_CITIES: [
    { x: 152, y: 1298, t: "centerRed", sc: 1.9, n: "Pallet Town" },
    { x: 545, y: 455, sp: "mine", s: 100, n: "Moonstone City" },
    { x: 1340, y: 1165, t: "martBlue", sc: 1.9, n: "Victory City" },
    { x: 1905, y: 290, sp: "volcano", s: 108, n: "Ember Town" },
    { x: 2010, y: 1190, sp: "lanternpost", s: 46, n: "Lantern Village" },
    { x: 2625, y: 425, sp: "hall", s: 104, n: "Hall of Fame" },
    { x: 905, y: 1300, sp: "pier", s: 98, n: "Fishing Pier" },
    { x: 1565, y: 690, sp: "berrybush", s: 56, n: "Berry Farm" },
  ],
  MAP_DECOR: [
    // Pallet Meadow
    { x: 95, y: 1115, sp: "tree", s: 54 }, { x: 335, y: 1005, t: "pine", sc: 2 }, { x: 470, y: 1265, sp: "flower", s: 26 },
    { x: 150, y: 950, sp: "tree", s: 44 }, { x: 420, y: 1125, t: "mushroomT", sc: 1.8 }, { x: 300, y: 1330, sp: "flower", s: 24, c: "#ffd34d" },
    { x: 640, y: 1090, sp: "tree", s: 48 }, { x: 250, y: 1180, sp: "sign", s: 26 }, { x: 238, y: 1248, sp: "house", s: 46, c: "#3a6fd8" },
    { x: 360, y: 1135, t: "bushPair", sc: 1.8 }, { x: 530, y: 1190, t: "pine", sc: 1.8 }, { x: 120, y: 1255, t: "pineBig", sc: 1.7 },
    // Mt. Moon
    { x: 560, y: 835, sp: "rock", s: 36 }, { x: 770, y: 515, sp: "mountain", s: 86 }, { x: 855, y: 720, sp: "mountain", s: 66 },
    { x: 595, y: 575, sp: "crystal", s: 28 }, { x: 930, y: 555, t: "rocksT", sc: 2 }, { x: 720, y: 390, sp: "mountain", s: 58 },
    { x: 640, y: 700, t: "rocksT", sc: 1.8 }, { x: 845, y: 480, t: "pine", sc: 1.7 },
    // Stadium plains
    { x: 1085, y: 860, sp: "wheat", s: 30 }, { x: 1345, y: 885, sp: "tree", s: 50 }, { x: 1145, y: 1190, sp: "flag", s: 30, c: "#3a6fd8" },
    { x: 1430, y: 1065, sp: "flag", s: 30 }, { x: 1240, y: 1280, sp: "sign", s: 28 }, { x: 1500, y: 960, sp: "tree", s: 44 },
    { x: 1255, y: 1110, t: "fountain", sc: 1.6 }, { x: 1475, y: 1120, t: "rowBrown", sc: 1.5 }, { x: 1295, y: 1235, t: "bench", sc: 1.8 },
    { x: 1465, y: 1245, t: "bushPair", sc: 1.8 }, { x: 1180, y: 1020, t: "pine", sc: 1.8 },
    // Dragon's Den
    { x: 1605, y: 555, sp: "mountain", s: 82 }, { x: 1835, y: 555, t: "rocksT", sc: 2.2 }, { x: 1955, y: 515, sp: "crystal", s: 24 },
    { x: 1690, y: 220, sp: "mountain", s: 70 }, { x: 1840, y: 140, e: "☁️", s: 30 },
    // Eterna Forest
    { x: 2015, y: 895, t: "pineBig", sc: 2 }, { x: 2245, y: 1185, t: "pineBig", sc: 1.8 }, { x: 2085, y: 1125, sp: "lanternpost", s: 34 },
    { x: 2305, y: 905, e: "☁️", s: 26 }, { x: 2200, y: 1320, t: "pine", sc: 2 }, { x: 2450, y: 980, t: "pineBig", sc: 1.7 },
    { x: 2120, y: 1010, t: "pine", sc: 2.1 }, { x: 2330, y: 1100, t: "pine", sc: 1.8 }, { x: 2270, y: 990, t: "mushroomT", sc: 1.8 },
    // Hall of Fame
    { x: 2385, y: 680, e: "✨", s: 18 }, { x: 2565, y: 645, sp: "flag", s: 30, c: "#f5c84c" }, { x: 2705, y: 485, e: "👑", s: 22 },
    { x: 2530, y: 540, t: "bench", sc: 1.7 },
    // water
    { x: 705, y: 1185, sp: "wave", s: 42 }, { x: 825, y: 1245, sp: "wave", s: 34 }, { x: 1005, y: 1335, sp: "wave", s: 42 },
    // Lost Legends landmark props (new art, placed directly by id)
    { x: 405, y: 1210, art: "tq-clocktower", s: 74 },   // Pallet meadow clocktower
    { x: 340, y: 1275, art: "tq-stone-well", s: 46 },
    { x: 1610, y: 640, art: "tq-sparkle-pond", s: 74 }, // Berry Farm pond
    { x: 660, y: 875, art: "tq-cliff-rocks", s: 62 },   // Mt. Moon cliffs
    { x: 800, y: 690, art: "tq-mossy-boulder", s: 52 },
    { x: 2160, y: 1180, art: "tq-mushroom-cluster", s: 40 },
    { x: 2245, y: 1050, art: "tq-cauldron", s: 44 },    // Eterna Forest cauldron
    { x: 1015, y: 1290, art: "tq-rope-bridge", s: 78 }, // over the pier lake
    { x: 1520, y: 1010, art: "tq-raid-den", s: 96 },    // the Weekly Raid den (glowing portal)
  ],

  // tall grass candidates (3 per region) and fishing spots
  GRASS_SPOTS: [
    [{ x: 350, y: 1240 }, { x: 160, y: 1060 }, { x: 520, y: 1010 }, { x: 450, y: 1160 }],
    [{ x: 560, y: 720 }, { x: 820, y: 460 }, { x: 900, y: 640 }, { x: 700, y: 560 }],
    [{ x: 1080, y: 920 }, { x: 1290, y: 1130 }, { x: 1450, y: 940 }, { x: 1190, y: 1010 }],
    [{ x: 1590, y: 470 }, { x: 1860, y: 360 }, { x: 1950, y: 560 }, { x: 1740, y: 300 }],
    [{ x: 2010, y: 950 }, { x: 2270, y: 1080 }, { x: 2150, y: 1250 }, { x: 2380, y: 1170 }],
    [{ x: 2350, y: 640 }, { x: 2600, y: 690 }, { x: 2550, y: 420 }, { x: 2450, y: 560 }],
  ],
  FISH_SPOTS: [
    { x: 945, y: 1295, need: 0 },   // Fishing Pier lake
    { x: 1530, y: 1420, need: 2 },  // south coast pier
    { x: 2245, y: 1185, need: 4 },  // Eterna pond
  ],
  CASTS_PER_DAY: 3,

  // today's rustling patches: deterministic per day, unlocked regions only
  grassSpotsToday() {
    const today = new Date().toISOString().slice(0, 10);
    let h = 0;
    for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const candidates = [];
    WORLDS.forEach((w, wi) => {
      if (!this.GRASS_SPOTS[wi] || !SAVE.worldUnlocked(wi)) return;
      this.GRASS_SPOTS[wi].forEach((p, k) => candidates.push({ id: `${wi}-${k}`, w: wi, ...p }));
    });
    const order = candidates.map((c, i) => ({ c, r: rng() })).sort((a, b) => a.r - b.r);
    return order.slice(0, Math.min(6, order.length)).map(o => o.c);
  },

  // closed smooth path through points (for the island coastline)
  smoothClosed(pts) {
    const n = pts.length;
    let d = `M ${(pts[0][0] + pts[n - 1][0]) / 2} ${(pts[0][1] + pts[n - 1][1]) / 2}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], nx = pts[(i + 1) % n];
      d += ` Q ${p[0]} ${p[1]} ${(p[0] + nx[0]) / 2} ${(p[1] + nx[1]) / 2}`;
    }
    return d + " Z";
  },

  terrainSvg() {
    const coast = this.smoothClosed([
      [150, 1140], [90, 860], [170, 560], [120, 330], [330, 170], [700, 120], [1050, 190],
      [1380, 110], [1750, 150], [2120, 100], [2430, 170], [2700, 120], [2820, 330],
      [2760, 620], [2840, 900], [2700, 1180], [2480, 1290], [2200, 1380], [1800, 1465],
      [1350, 1390], [950, 1460], [560, 1390], [260, 1300],
    ]);
    const forest = (cx, cy, s) => [[0, 0], [s, -s * .3], [-s * .9, s * .4], [s * .7, s * .6], [-s * .2, -s * .8]]
      .map(([dx, dy], i) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="${s * (0.9 - i * 0.1)}" />`).join("");
    const mt = (x, y, s) =>
      `<polygon points="${x},${y} ${x - s},${y + s * 1.25} ${x + s},${y + s * 1.25}" fill="#8fa06a"/>` +
      `<polygon points="${x},${y} ${x - s * .38},${y + s * .5} ${x + s * .38},${y + s * .5}" fill="#f4f7e6"/>`;
    // sandy path/clearing blobs scattered along the route (organic patches)
    const sand = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2ddb0"/>`;
    return `<svg id="terrain-svg" width="${this.MAP_W}" height="${this.MAP_H}" viewBox="0 0 ${this.MAP_W} ${this.MAP_H}">
      <!-- bright teal sea beyond the island -->
      <rect width="100%" height="100%" fill="#6fcfe0"/>
      <path d="${coast}" fill="none" stroke="#bfeef4" stroke-width="34" opacity=".5"/>
      <path d="${coast}" fill="none" stroke="#f2ddb0" stroke-width="20" opacity=".9"/>
      <!-- the island: lively lime-green grass -->
      <path d="${coast}" fill="#8fd14f"/>
      <path d="${coast}" fill="#9ad95a" opacity=".55" transform="translate(0,-14)"/>
      <!-- warm sandy clearings along the trail -->
      <g opacity=".85">
        ${sand(230, 1190, 150, 90)}${sand(660, 640, 130, 80)}${sand(1210, 1010, 150, 90)}
        ${sand(1730, 430, 130, 80)}${sand(2140, 1030, 150, 90)}${sand(2480, 560, 130, 80)}
        ${sand(2680, 300, 110, 70)}${sand(430, 1330, 120, 66)}
      </g>
      <!-- a sandy trail hugging the winding route: a soft, narrow footpath
           rather than a wide ribbon (which read like a light-beam under the
           map tilt). Two strokes = soft halo + crisp core, so the edges taper. -->
      <path d="M230,1190 Q450,900 660,640 Q940,820 1210,1010 Q1470,720 1730,430 Q1940,730 2140,1030 Q2310,800 2480,560 Q2600,410 2680,300" fill="none"
        stroke="#f2ddb0" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" opacity=".3"/>
      <path d="M230,1190 Q450,900 660,640 Q940,820 1210,1010 Q1470,720 1730,430 Q1940,730 2140,1030 Q2310,800 2480,560 Q2600,410 2680,300" fill="none"
        stroke="#f7e6bd" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
      <!-- fishing lakes & pond: bright teal water -->
      <path d="M700,620 C 770,810 850,930 890,1080 C 910,1170 930,1240 945,1295" fill="none"
        stroke="#3fb5cf" stroke-width="24" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="945" cy="1310" rx="175" ry="78" fill="#3fb5cf"/>
      <ellipse cx="915" cy="1295" rx="80" ry="26" fill="#a7e6f0" opacity=".6"/>
      <ellipse cx="2245" cy="1195" rx="95" ry="46" fill="#3fb5cf"/>
      <ellipse cx="2228" cy="1186" rx="42" ry="14" fill="#a7e6f0" opacity=".6"/>
      <!-- soft darker-green woodland shading (kept subtle & bright) -->
      <g fill="#79c247" opacity=".38">
        ${forest(265, 1075, 62)}${forest(470, 1180, 48)}${forest(1115, 800, 52)}
        ${forest(2120, 930, 66)}${forest(2330, 1110, 52)}${forest(2520, 470, 46)}
      </g>
      ${mt(700, 360, 78)}${mt(820, 430, 56)}${mt(610, 450, 48)}
      ${mt(1700, 200, 72)}${mt(1830, 280, 52)}${mt(1600, 290, 44)}
    </svg>`;
  },

  // seeded scatter groups: lots of extra greenery/rubble without
  // hand-placing every item (deterministic, so the map never shifts)
  MAP_SCATTER: [
    { t: "pine", n: 7, x: 2180, y: 1060, r: 240, smin: 1.4, smax: 2.1 },
    { t: "pineBig", n: 4, x: 2080, y: 950, r: 190, smin: 1.5, smax: 2 },
    { t: "mushroomT", n: 3, x: 2280, y: 1120, r: 140, smin: 1.4, smax: 1.8 },
    { sp: "tree", n: 6, x: 340, y: 1100, r: 200, smin: 36, smax: 54 },
    { sp: "flower", n: 8, x: 430, y: 1240, r: 190, smin: 18, smax: 26, cs: ["#ff8ab5", "#ffd34d", "#fff", "#b39df1"] },
    { t: "bushPair", n: 3, x: 560, y: 1070, r: 140, smin: 1.4, smax: 1.8 },
    { sp: "rock", n: 4, x: 700, y: 690, r: 160, smin: 24, smax: 36 },
    { sp: "crystal", n: 3, x: 640, y: 545, r: 110, smin: 18, smax: 26 },
    { t: "rocksT", n: 5, x: 1770, y: 470, r: 190, smin: 1.5, smax: 2.2 },
    { sp: "tree", n: 5, x: 1230, y: 970, r: 200, smin: 36, smax: 50 },
    { t: "pine", n: 4, x: 1680, y: 640, r: 170, smin: 1.4, smax: 1.9 },
    { sp: "wave", n: 5, x: 1300, y: 1505, r: 170, smin: 30, smax: 42 },
    { sp: "wave", n: 3, x: 60, y: 720, r: 110, smin: 26, smax: 36 },
  ],

  scatterDecor() {
    if (this._scatter) return this._scatter;
    let h = 1337;
    const rng = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const out = [];
    this.MAP_SCATTER.forEach(g => {
      for (let i = 0; i < g.n; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * g.r;
        const x = Math.round(g.x + Math.cos(a) * d);
        const y = Math.round(g.y + Math.sin(a) * d * 0.7);
        const k = g.smin + rng() * (g.smax - g.smin);
        const c = g.cs ? g.cs[Math.floor(rng() * g.cs.length)] : g.c;
        out.push(g.t
          ? { x, y, t: g.t, sc: Math.round(k * 10) / 10 }
          : { x, y, sp: g.sp, s: Math.round(k), c });
      }
    });
    this._scatter = out;
    return out;
  },

  // ---------- Seasonal map dressing (pure decoration — never a reward) ----------
  // Driven by the real calendar; a debug override (window.TQ.debugSeason) lets
  // us preview any season. Winter/spring/autumn/summer each add a gentle tint,
  // a handful of drifting particles, and season-flavored decor. Two single-day
  // touches: fireworks on Jan 1 / Jul 4, pumpkins in the last week of October.
  seasonNow() {
    if (this._debugSeason && this._debugSeason !== "fireworks") return this._debugSeason;
    const m = new Date().getMonth();          // 0 = January
    return (m === 11 || m <= 1) ? "winter"
      : m <= 4 ? "spring"
      : m <= 7 ? "summer" : "autumn";
  },

  seasonSpecials() {
    const s = { fireworks: false, pumpkins: false };
    if (this._debugSeason === "fireworks") { s.fireworks = true; return s; }
    const now = new Date();
    const m = now.getMonth(), day = now.getDate();
    if ((m === 0 && day === 1) || (m === 6 && day === 4)) s.fireworks = true;  // Jan 1 / Jul 4
    if (m === 9 && day >= 25) s.pumpkins = true;                               // last week of Oct
    return s;
  },

  // preview any season live from the console: TQ.debugSeason("winter"|"spring"|
  // "summer"|"autumn"|"fireworks"|null-to-clear)
  debugSeason(name) {
    this._debugSeason = name || null;
    if (this.current === "map") this.renderMap();
    return this._debugSeason || "(live calendar)";
  },

  // the seasonal overlay HTML: a tint plane, a few light CSS particles, and
  // season-flavored decor appended over the existing map (all decoration).
  seasonLayer(decor) {
    const season = this.seasonNow();
    const sp = this.seasonSpecials();
    let html = `<div class="season-tint season-${season}"></div>`;
    // deterministic scatter so the dressing never jitters between renders
    let h = 20240101;
    const rng = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const rx = () => Math.round(rng() * this.MAP_W);
    const ry = () => Math.round(rng() * this.MAP_H);
    const trees = decor.filter(o => o.sp === "tree" || o.t === "pine" || o.t === "pineBig");

    if (season === "winter") {
      // snowy caps atop about half the trees
      trees.forEach((o, i) => {
        if (i % 2) return;
        const lift = (o.s || o.sc * 20) * 0.7;
        html += `<span class="snow-cap" style="left:${o.x}px;top:${o.y - lift}px">❄️</span>`;
      });
      for (let i = 0; i < 12; i++)
        html += `<span class="snowflake" style="left:${rx()}px;top:${ry()}px;font-size:${10 + Math.round(rng() * 10)}px;animation-delay:-${(rng() * 8).toFixed(1)}s;animation-duration:${(7 + rng() * 6).toFixed(1)}s">❄️</span>`;
    } else if (season === "spring") {
      trees.forEach((o, i) => { if (i % 3 === 0) html += `<span class="season-decor" style="left:${o.x + 10}px;top:${o.y - 8}px">🌸</span>`; });
      for (let i = 0; i < 12; i++)
        html += `<span class="petal" style="left:${rx()}px;top:${ry()}px;animation-delay:-${(rng() * 8).toFixed(1)}s;animation-duration:${(8 + rng() * 6).toFixed(1)}s">🌸</span>`;
    } else if (season === "autumn") {
      trees.forEach((o, i) => { if (i % 2) html += `<span class="season-decor" style="left:${o.x}px;top:${o.y - 6}px">🍂</span>`; });
      for (let i = 0; i < 12; i++)
        html += `<span class="leaf-fall" style="left:${rx()}px;top:${ry()}px;animation-delay:-${(rng() * 8).toFixed(1)}s;animation-duration:${(7 + rng() * 6).toFixed(1)}s">🍁</span>`;
    } else { // summer — extra butterflies + fireflies around the ponds
      [[905, 1285], [960, 1330], [1005, 1300], [2245, 1170]].forEach(([x, y], i) =>
        html += `<span class="map-butterfly" style="left:${x}px;top:${y}px;animation-delay:-${(i * 0.6).toFixed(1)}s">🦋</span>`);
      for (let i = 0; i < 6; i++)
        html += `<i class="firefly" style="left:${920 + Math.round(rng() * 140)}px;top:${1270 + Math.round(rng() * 70)}px;animation-delay:-${(rng() * 2).toFixed(1)}s"></i>`;
    }

    if (sp.pumpkins)
      html += `<span class="season-decor pumpkin" style="left:230px;top:1300px">🎃</span>
        <span class="season-decor pumpkin" style="left:305px;top:1355px">🎃</span>`;
    if (sp.fireworks)
      [[520, 360], [1200, 300], [2000, 340]].forEach(([x, y], i) =>
        html += `<span class="firework" style="left:${x}px;top:${y}px;animation-delay:-${(i * 0.8).toFixed(1)}s">🎆</span>`);
    return html;
  },

  mapNodes() {
    if (this._mapNodes) return this._mapNodes;
    const A = this.mapAnchors;
    this._mapNodes = WORLDS.map((w, wi) => {
      const [ax, ay] = A[wi], [bx, by] = A[wi + 1];
      const n = w.levels.length + 1;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len;
      return Array.from({ length: n }, (_, i) => {
        const t = 0.05 + (i / (n - 1)) * 0.8;
        const wig = Math.sin(i * 1.9) * 64;
        return { x: Math.round(ax + dx * t + px * wig), y: Math.round(ay + dy * t + py * wig) };
      });
    });
    return this._mapNodes;
  },

  mapFrontier() {
    for (let w = 0; w < WORLDS.length; w++) {
      for (let s = 0; s <= WORLDS[w].levels.length; s++) {
        if (SAVE.stageUnlocked(w, s) && SAVE.stageStars(w, s) === 0) return { w, s };
      }
    }
    return { w: HALL_W, s: WORLDS[HALL_W].levels.length };
  },

  renderMap() {
    const map = this.$("region-map");
    const nodes = this.mapNodes();

    // winding dashed route through every stage
    const pts = nodes.flat();
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;

    // painted island terrain + per-region color tints
    let html = this.terrainSvg();
    const blobs = WORLDS.map((w, i) => {
      const [ax, ay] = this.mapAnchors[i], [bx, by] = this.mapAnchors[i + 1];
      return `radial-gradient(740px 580px at ${Math.round((ax + bx) / 2)}px ${Math.round((ay + by) / 2)}px, ${w.gradient[1]}33, transparent 72%)`;
    }).join(",");
    html += `<div class="region-tints" style="background-image:${blobs}"></div>`;

    html += `<svg id="route-svg" width="${this.MAP_W}" height="${this.MAP_H}" viewBox="0 0 ${this.MAP_W} ${this.MAP_H}"><path d="${d}"/></svg>`;

    html += [0, 1, 2, 3].map(i =>
      `<span class="map-cloud" style="top:${110 + i * 340}px;animation-duration:${70 + i * 24}s;animation-delay:-${i * 19}s">☁️</span>`).join("");

    // little lives: birds, butterflies, fireflies, volcano smoke, water sparkle
    html += `<span class="map-bird" style="top:380px;animation-duration:34s">🐦</span>
      <span class="map-bird" style="top:760px;animation-duration:46s;animation-delay:-18s">🕊️</span>
      <span class="map-butterfly" style="left:300px;top:1150px">🦋</span>
      <span class="map-butterfly" style="left:460px;top:1060px;animation-delay:-1.2s">🦋</span>
      <span class="map-smoke" style="left:1895px;top:240px">💨</span>
      <span class="map-smoke" style="left:1925px;top:255px;animation-delay:-2.2s">💨</span>
      <span class="map-sparkle" style="left:880px;top:1300px">✨</span>
      <span class="map-sparkle" style="left:1010px;top:1330px;animation-delay:-1s">✨</span>
      <span class="map-sparkle" style="left:2225px;top:1185px;animation-delay:-.6s">✨</span>` +
      [[2080, 900], [2190, 1010], [2300, 880], [2150, 1120], [2380, 990], [2260, 940]].map(([x, y], i) =>
        `<i class="firefly" style="left:${x}px;top:${y}px;animation-delay:-${i * .45}s"></i>`).join("");

    // daily wild encounters: rustling grass + fishing spots
    const wild = SAVE.wildToday();
    const patches = this.grassSpotsToday().filter(s => !wild.grassUsed.includes(s.id));
    html += patches.map(s =>
      `<button class="map-grass" data-spot="${s.id}" data-w="${s.w}" style="left:${s.x}px;top:${s.y}px" title="Something is rustling in the grass!"><span class="g-rustle">${worldSprite("grasstuft", 40)}</span></button>`).join("");
    const castsLeft = Math.max(0, this.CASTS_PER_DAY - wild.casts);
    this.FISH_SPOTS.filter(f => SAVE.worldUnlocked(f.need)).forEach(f => {
      html += `<button class="map-fish ${castsLeft ? "" : "spent"}" style="left:${f.x}px;top:${f.y}px" title="${castsLeft ? "Fishing spot — cast a line!" : "No more bites today"}"><span class="f-rod">🎣</span></button>`;
    });
    const chip = this.$("wild-chip");
    if (chip) chip.textContent = `🌿 ${patches.length} · 🎣 ${castsLeft}`;
    // one-time discovery hint the first time grass appears
    this._hintedThisRender = false;
    if (patches.length && SAVE.state && SAVE.state.flags && !SAVE.state.flags.grassHint) {
      SAVE.state.flags.grassHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🌿 See the rustling grass? A wild Pokemon hides there — click it!", "gold");
    }
    const allDecor = this.MAP_DECOR.concat(this.scatterDecor());
    html += allDecor.map(o =>
      `<span class="map-decor" style="left:${o.x}px;top:${o.y}px;${o.e ? `font-size:${o.s}px` : ""}">${o.art ? artSprite(o.art, o.s) : o.t ? worldTile(o.t, o.sc) : o.sp ? worldSprite(o.sp, o.s, o.c) : o.e}</span>`).join("");
    // seasonal dressing rides on top of the base decor (pure decoration)
    html += this.seasonLayer(allDecor);
    html += this.MAP_CITIES.map(c =>
      `<div class="map-city" style="left:${c.x}px;top:${c.y}px"><span class="city-art">${c.t ? worldTile(c.t, c.sc) : worldSprite(c.sp, c.s)}</span><b>${c.n}</b></div>`).join("");

    // Trainer School: practice with no countdown, any time
    html += `<button class="map-school" style="left:430px;top:1330px" title="Trainer School — no countdown, race your records!">
      <span>${worldSprite("school", 90)}</span><b>Trainer School</b></button>`;

    // Puzzle Lab: now a flight perch — tap it to fly off to the Circuit &
    // Counting isles. Opens once Mt. Moon is reached (worldUnlocked(1)), so a
    // brand-new trainer never sees it.
    if (SAVE.worldUnlocked(1)) {
      html += `<button class="map-lab" style="left:324px;top:1372px" title="Flight perch — fly to the puzzle isles!">
        <span>${worldSprite("lab", 84)}</span><b>🧩 Puzzle Isles</b></button>`;
    }

    // Professor's Daily Drill podium beside the school
    const daily = SAVE.dailyInfo();
    html += `<button class="map-podium ${daily.done ? "done" : ""}"
      style="left:585px;top:1372px" title="${daily.done ? "Daily Drill done — back tomorrow!" : "Professor's Daily Drill — one special run a day!"}">
      <span class="${daily.done ? "" : "podium-glow"}">${daily.done ? "✅" : "📋"}</span><b>Daily Drill</b></button>`;

    // Family Trading Post: a market stall on the south shore where two family
    // trainers swap Pokemon 1-for-1
    html += `<button class="map-trade" style="left:770px;top:1418px" title="Trading Post — swap Pokemon with your family!">
      <span>${worldSprite("trade", 84)}</span><b>🤝 Trading Post</b></button>`;

    // the Battle Tower rises near the Battle Stadium — an endless typing climb.
    // Opens once the trainer reaches the Stadium (worldUnlocked(2)).
    if (SAVE.worldUnlocked(2)) {
      const tb = SAVE.state.tower && SAVE.state.tower.best;
      html += `<button class="map-tower" style="left:1158px;top:848px"
        title="Battle Tower — an endless typing climb${tb ? ` · best floor ${tb}` : ""}!">
        <span class="tower-art">${artSprite("tq-clocktower", 92)}</span><b>🗼 Battle Tower</b></button>`;
    }

    WORLDS.forEach((w, wi) => {
      const ns = nodes[wi];
      const unlocked = SAVE.worldUnlocked(wi);
      const maxStars = (w.levels.length + 1) * 3;
      const mid = ns[Math.floor(ns.length / 2)];
      const lp = this.MAP_LABELS[wi] || [mid.x, mid.y - 138];
      const medal = SAVE.worldMedal(wi);
      html += `<div class="region-label" data-rw="${wi}" role="button"
        title="Who lives in ${this.esc(w.name)}?" style="left:${lp[0]}px;top:${lp[1]}px">
        <b>${w.emoji} ${w.name}</b><span>★ ${SAVE.worldStars(wi)}/${maxStars}${medal ? ` ${MEDAL_E[medal]}` : ""}</span></div>`;

      // wild Pokemon living on the map: color when caught, silhouette when not
      [[0, 0, -90, -20], [2, 2, 95, 14], [4, 4, -105, 0], [6, 6, 100, 22], [7, 7, -100, 0]].forEach(([ci, ni, ox, oy]) => {
        const c = CREATURES[wi][ci];
        const got = SAVE.state && SAVE.state.dex[`${wi}-${ci}`];
        const p = ns[ni];
        html += `<button class="map-poke ${got ? "" : "unknown"}" data-pw="${wi}" data-pi="${ci}"
          title="${got ? this.esc(c.n) : "??? — who could it be?"}"
          style="left:${p.x + ox}px;top:${p.y + oy}px">${this.pokeHtml(c.id, c.e, { shiny: got && got.shiny, cls: "poke-img map-poke-img" })}</button>`;
      });

      ns.forEach((p, s) => {
        const isBoss = s === w.levels.length;
        const st = SAVE.stageStars(wi, s);
        const open = SAVE.stageUnlocked(wi, s);
        const next = open && st === 0;
        // a beaten boss also shows its best Gym Rematch medal, if any
        const rmBest = (SAVE.state && SAVE.state.rematch && SAVE.state.rematch[wi]) || 0;
        const rmGlyph = rmBest === 2 ? "🥇" : rmBest === 1 ? "🥈" : "";
        const starsHtml = isBoss
          ? (st > 0 ? `<span class="mini-stars">🏆${rmGlyph}</span>` : "")
          : `<span class="mini-stars">${"★".repeat(st)}<span class="off">${"★".repeat(Math.max(0, 3 - st))}</span></span>`;
        html += `<button class="mnode ${isBoss ? "boss" : ""} ${open ? "" : "locked"} ${next ? "next" : ""} ${st > 0 ? "done" : ""} ${SAVE.medalStageOk(wi, s, 3) ? "gilded" : ""}"
          style="left:${p.x}px;top:${p.y}px" data-w="${wi}" data-s="${s}"
          title="${open ? (isBoss ? `BOSS: ${this.esc(w.boss.name)}` : this.esc(w.levels[s].name)) : "Locked"}">
          ${isBoss ? this.pokeHtml(w.boss.id, w.boss.emoji, { cls: "poke-img stage-img" }) : `<span>${s + 1}</span>`}${starsHtml}
        </button>`;
      });

      if (!unlocked) {
        const xs = ns.map(p => p.x), ys = ns.map(p => p.y);
        const x0 = Math.min(...xs) - 140, y0 = Math.min(...ys) - 160;
        const fw = Math.max(...xs) - x0 + 140, fh = Math.max(...ys) - y0 + 160;
        html += `<div class="map-fog" style="left:${x0}px;top:${y0}px;width:${fw}px;height:${fh}px">
          <span>🔒 Defeat ${this.esc(WORLDS[wi - 1].boss.name)} ${WORLDS[wi - 1].boss.emoji}</span></div>`;
      }
    });

    // the player stands at their next challenge (carrying any egg)
    const f = this.mapFrontier();
    const fp = nodes[f.w][f.s];
    const egg = SAVE.state && SAVE.state.egg;
    html += `<div class="map-marker" style="left:${fp.x}px;top:${fp.y - 30}px">
      <span class="mk-bob">${this.avatarHtml(SAVE.state && SAVE.state.profile)}${egg ? `<span class="marker-egg">🥚</span>` : ""}</span><i>▼</i></div>`;

    // a Professor's Letter waits when a new feature has unlocked
    const intro = this.pendingIntro();
    if (intro) {
      html += `<button class="map-parcel" title="${this.esc(intro.title)}"
        style="left:${fp.x + 84}px;top:${fp.y + 30}px"><span class="parcel-bob">📬</span></button>`;
      this._hintedThisRender = true; // the letter is today's one teaching moment
    }

    const dayChip = this.$("day-chip");
    const stamps = SAVE.dayStamps();
    const dayDone = stamps.filter(x => x.done).length;
    dayChip.textContent = `📜 ${dayDone}/3`;
    dayChip.classList.toggle("ready", dayDone === 3);

    const eggChip = this.$("egg-chip");
    eggChip.classList.toggle("hidden", !egg);
    if (egg) {
      const ready = egg.progress >= 3;
      eggChip.textContent = ready ? "🐣 Hatch the egg!" : `🥚 ${egg.progress}/3`;
      eggChip.classList.toggle("ready", ready);
      eggChip.title = ready ? "Click to hatch your Mystery Egg!" : "Finish levels to warm the egg";
    }

    // the weekly roaming legendary
    const roamer = SAVE.roamerNow();
    if (roamer) {
      const spots = [[760, 295], [2185, 855], [1320, 760], [2615, 300]];
      const [rx, ry] = spots[roamer.spot];
      html += `<button class="map-roamer" style="left:${rx}px;top:${ry}px" title="A legendary presence... one chance this week!">
        <span class="roamer-aura"></span>${this.pokeHtml(roamer.id, roamer.e, { cls: "poke-img roamer-img" })}<span class="roamer-mark">🌟</span>
      </button>`;
    }

    // the Weekly Raid Boss den — a shared legendary the whole family chips at
    const raid = SAVE.raidNow();
    if (raid) {
      const hpFrac = raid.maxHp ? Math.max(0, raid.hp) / raid.maxHp : 0;
      const myContrib = (SAVE.root.active && raid.contrib[SAVE.root.active]) || 0;
      const claimedByMe = SAVE.raidClaimedByMe();
      let state, label;
      if (!raid.defeated) { state = "alive"; label = `⚔️ Raid: ${this.esc(raid.n)}`; }
      else if (myContrib > 0 && !claimedByMe) { state = "claim"; label = "🎁 Claim your prize!"; }
      else { state = "resting"; label = "😴 Resting till next week"; }
      html += `<button class="map-raid ${state}" style="left:1520px;top:990px"
        title="Weekly Raid Boss — the whole family fights together!">
        <span class="raid-aura"></span>${this.pokeHtml(raid.id, raid.e, { cls: "poke-img raid-img" })}
        <span class="raid-mark">${raid.defeated ? (state === "claim" ? "🎁" : "😴") : "⚔️"}</span>
        <div class="raid-hpbar"><div class="raid-hpfill" style="width:${hpFrac * 100}%"></div></div>
        <b>${label}</b></button>`;
    }

    map.dataset.season = this.seasonNow();
    map.innerHTML = html;
    this.renderPartyBar();
    this._mapSel = null; // keyboard nav selection resets with the map
    this.mapHints();

    this.centerMapOn(fp.x, fp.y);
  },

  // one gentle discovery hint per map visit, spread across sessions
  mapHints() {
    if (this._hintedThisRender || !SAVE.state || !SAVE.state.flags) return;
    const f = SAVE.state.flags;
    if (!f.grassHint) return; // the grass intro always goes first
    if (!f.schoolHint) {
      f.schoolHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🏫 The Trainer School near Pallet Town has NO countdown — race your own records!");
      return;
    }
    if (SAVE.state.egg && !f.eggHint) {
      f.eggHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🥚 You carry a Mystery Egg! Finish levels to warm it, then hatch it from the chip up top.");
      return;
    }
    if (!f.areaHint) {
      f.areaHint = true;
      SAVE.save();
      this._hintedThisRender = true;
      this.toast("🗺️ Click an area's name sign to see every Pokemon that lives there — and how to catch them!");
    }
  },

  // ---------- area spawn guide (who lives here + how to catch them) ----------
  whereLine(w, i) {
    const chips = spawnSources(w, i).map(s =>
      `<span title="${this.esc(s.title)}">${s.icon}</span>`).join("");
    return chips ? `<div class="dex-where" title="Where to find it">${chips}</div>` : "";
  },

  openAreaPanel(w, hiKey) {
    const panel = this.$("area-panel");
    const rows = CREATURES[w].map((c, i) => {
      const key = `${w}-${i}`;
      const got = SAVE.state.dex[key];
      const chips = spawnSources(w, i).map(s =>
        `<span class="src-chip" title="${this.esc(s.title)}">${s.icon} ${this.esc(s.label)}</span>`).join("");
      return `<div class="area-row ${key === hiKey ? "hi" : ""}">
        <span class="area-sprite ${got ? "" : "silh"}">${this.pokeHtml(c.id, c.e, { shiny: got && got.shiny })}</span>
        <div class="area-info">
          <b>${got ? `${got.shiny ? "✨ " : ""}${this.esc(c.n)}` : "???"}</b>
          <div class="area-srcs">${chips}</div>
        </div>
        ${got ? `<span class="area-got">✔ caught</span>` : `<span class="area-miss">not yet!</span>`}
      </div>`;
    }).join("");
    const caught = CREATURES[w].filter((c, i) => SAVE.state.dex[`${w}-${i}`]).length;
    panel.innerHTML = `<div class="area-card">
      <button id="area-close" aria-label="Close">✕</button>
      <h3>${WORLDS[w].emoji} ${this.esc(WORLDS[w].name)}</h3>
      <p class="area-sub">Pokemon living here · ${caught}/${CREATURES[w].length} caught</p>
      <div class="area-list">${rows}</div>
    </div>`;
    panel.classList.remove("hidden");
    if (hiKey) {
      // offsetTop math instead of scrollIntoView: the card's pop-in
      // animation is mid-scale right now and would skew the measurement
      const list = panel.querySelector(".area-list");
      const el = panel.querySelector(".area-row.hi");
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    }
  },

  closeAreaPanel() {
    this.$("area-panel").classList.add("hidden");
  },

  // ---------- the flying isles: perch card + bird flight ----------
  // Tapping the Puzzle Lab building (the flight perch) opens a destination card;
  // picking an isle plays a short bird sweep, then lands on the isle scene.
  // Reduced-motion players skip the sweep entirely. The overlay is always
  // skippable by tap, with a safety timeout so input can never be trapped.

  // per-isle progress: total stars earned and Pokemon caught there
  perchProgress(pack) {
    const stages = PUZZLE_STAGES.filter(s => s.pack === pack);
    const puz = (SAVE.state && SAVE.state.puzzle) || {};
    const dex = (SAVE.state && SAVE.state.dex) || {};
    const stars = stages.reduce((n, s) => n + (((puz[s.id] || {}).stars) || 0), 0);
    const catchStages = stages.filter(s => s.reward && s.reward.catch);
    const caught = catchStages.filter(s => dex[s.reward.catch]).length;
    return { stars, maxStars: stages.length * 3, caught, catchTotal: catchStages.length };
  },

  openPerchCard() {
    const panel = this.$("perch-panel");
    const dest = (pack, e, name, blurb) => {
      const p = this.perchProgress(pack);
      const cont = p.stars > 0 ? "Continue ▶" : "Start ▶";
      return `<div class="perch-dest-row">
        <button class="perch-dest ${pack}" data-fly="${pack}">
          <span class="pd-e">${e}</span>
          <span class="pd-info"><b>${name}</b><i>${blurb}</i>
            <span class="pd-prog">⭐ ${p.stars}/${p.maxStars}${p.catchTotal ? ` · 🐾 ${p.caught}/${p.catchTotal}` : ""}</span></span>
          <span class="pd-go">Fly ✈️</span></button>
        <button class="perch-continue" data-continue="${pack}" title="Fly there and jump straight into your next puzzle">${cont}</button>
      </div>`;
    };
    panel.innerHTML = `<div class="perch-card">
      <button id="perch-close" aria-label="Close">✕</button>
      <h3>🕊️ Where to, trainer?</h3>
      <p class="perch-sub">Hop on and pick an isle to fly to!</p>
      <div class="perch-dests">
        ${dest("code", "💻", "Circuit Isle", "Walk, loop &amp; decide with code blocks")}
        ${dest("math", "🔢", "Counting Isle", "Counting, times-tables &amp; number hops")}
      </div>
    </div>`;
    panel.classList.remove("hidden");
  },

  closePerchCard() {
    this.$("perch-panel").classList.add("hidden");
  },

  // the rider: the trainer avatar sitting on the chunky bird
  flyRiderHtml() {
    const t = SAVE.state && SAVE.state.profile;
    return `<div class="fly-rider">
      ${birdSvg(150)}
      <span class="fly-trainer">${this.avatarHtml(t)}</span>
    </div>`;
  },

  // fly OUT to an isle: sweep up-and-across, then show the isle scene
  flyToIsle(pack) {
    Puzzle.currentPack = pack;
    this.closePerchCard();
    if (this._reducedMotion) { this.show("lab"); return; }
    this._runFlight("out", () => this.show("lab"));
  },

  // fly OUT and drop straight into the frontier puzzle (perch "Continue ▶").
  // If the isle is already all-clear there is no frontier, so just land on it.
  flyToIsleContinue(pack) {
    Puzzle.currentPack = pack;
    this.closePerchCard();
    const land = () => { if (!Puzzle.openFrontierStage(pack)) this.show("lab"); };
    if (this._reducedMotion) { land(); return; }
    this._runFlight("out", land);
  },

  // fly HOME: sweep back down, then the map centred on the perch
  flyHome() {
    const done = () => {
      this.show("map");
      this.centerMapOn(324, 1372);
    };
    if (this._reducedMotion) { done(); return; }
    this._runFlight("home", done);
  },

  // shared flight animation. `dir` is "out" or "home". Always resolves once:
  // on animationend, on a skip tap, or on a safety timeout — whichever is first.
  _runFlight(dir, then) {
    const ov = this.$("fly-overlay");
    if (this._flyTimer) { clearTimeout(this._flyTimer); this._flyTimer = null; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (this._flyTimer) { clearTimeout(this._flyTimer); this._flyTimer = null; }
      ov.classList.add("hidden");
      ov.innerHTML = "";
      ov.onclick = null;
      then();
    };
    ov.className = `fly-${dir}`; // removes "hidden", sets the sweep direction
    ov.innerHTML = `${this.flyRiderHtml()}<div class="fly-say">🕊️ Hold on tight!</div>`;
    ov.onclick = finish; // tap to skip
    const rider = ov.querySelector(".fly-rider");
    if (rider) rider.addEventListener("animationend", finish, { once: true });
    SFX.combo();
    this._flyTimer = setTimeout(finish, 1400); // safety: never trap input
  },

  // ---------- keyboard map navigation (arrows walk the route, Enter starts) ----------
  mapKeyNav(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // while the area guide is open, Escape closes it and arrows stay put
    if (!this.$("area-panel").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closeAreaPanel(); }
      return;
    }
    // the Trading Post overlay owns keys while it's open
    if (!this.$("trade-panel").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closeTradePanel(); }
      return;
    }
    // the flight-perch destination card owns keys while it's open
    if (!this.$("perch-panel").classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); this.closePerchCard(); }
      return;
    }
    if (!this.$("day-card").classList.contains("hidden")) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        this.$("day-card").classList.add("hidden");
      }
      return;
    }
    const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Enter"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const flat = [];
    WORLDS.forEach((w, wi) => { for (let s = 0; s <= w.levels.length; s++) flat.push({ w: wi, s }); });
    if (this._mapSel === null || this._mapSel === undefined) {
      const f = this.mapFrontier();
      this._mapSel = flat.findIndex(n => n.w === f.w && n.s === f.s);
      if (this._mapSel < 0) this._mapSel = 0;
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      this._mapSel = Math.min(flat.length - 1, this._mapSel + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      this._mapSel = Math.max(0, this._mapSel - 1);
    }
    const n = flat[this._mapSel];
    const node = document.querySelector(`.mnode[data-w="${n.w}"][data-s="${n.s}"]`);
    if (!node) return;
    if (e.key === "Enter") { node.click(); return; }
    document.querySelectorAll(".mnode.kbsel").forEach(x => x.classList.remove("kbsel"));
    node.classList.add("kbsel");
    SFX.click();
    const p = this.mapNodes()[n.w][n.s];
    this.centerMapOn(p.x, p.y);
  },

  centerMapOn(x, y, tries = 0) {
    const vp = this.$("region-viewport").getBoundingClientRect();
    if (!vp.width || !vp.height) {
      // not laid out yet — retry a few frames, then wait for a resize
      if (tries < 10) requestAnimationFrame(() => this.centerMapOn(x, y, tries + 1));
      else this._pendingCenter = { x, y };
      return;
    }
    this._pendingCenter = null;
    // 0.446 calibrated for the orthographic tilt (screen-y slope = cos(tilt))
    this.setMapPos(vp.width / 2 - x, vp.height * 0.446 - y);
  },

  setMapPos(x, y) {
    const vp = this.$("region-viewport").getBoundingClientRect();
    const slack = 560; // the tilted plane shows past its edges; allow over-pan
    this.mapX = Math.min(slack, Math.max(vp.width - this.MAP_W - slack, x));
    this.mapY = Math.min(slack, Math.max(vp.height - this.MAP_H - slack, y));
    this.$("region-map").style.transform = `translate(${this.mapX}px, ${this.mapY}px)`;
  },

  bindMapPan() {
    const vp = this.$("region-viewport");
    let drag = null;
    vp.addEventListener("pointerdown", e => {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: this.mapX, oy: this.mapY, moved: false };
    });
    vp.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 7) {
        drag.moved = true;
        vp.classList.add("dragging");
        // capture only once a real drag starts — capturing on pointerdown
        // would steal the click from the stage buttons
        try { vp.setPointerCapture(drag.id); } catch (_) { /* ok */ }
      }
      // vertical screen distance is foreshortened on the tilted plane
      if (drag.moved) this.setMapPos(drag.ox + dx, drag.oy + dy / Math.cos(this.TILT));
    });
    const end = () => {
      if (drag && drag.moved) {
        this._mapDragged = true;
        setTimeout(() => { this._mapDragged = false; }, 60);
      }
      drag = null;
      vp.classList.remove("dragging");
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
    vp.addEventListener("wheel", e => {
      e.preventDefault();
      this.setMapPos(this.mapX - e.deltaX, this.mapY - e.deltaY / Math.cos(this.TILT));
    }, { passive: false });
    vp.addEventListener("click", e => {
      if (this._mapDragged) return;
      const b = e.target.closest(".mnode");
      if (b) {
        SFX.init();
        if (!b.classList.contains("locked")) {
          // tap = play, straight away (at the player's challenge setting)
          Engine.startStage(+b.dataset.w, +b.dataset.s);
        } else {
          // locked: never answer a click with silence
          SFX.error();
          b.classList.remove("denied");
          void b.offsetWidth;
          b.classList.add("denied");
          const w = +b.dataset.w, s = +b.dataset.s;
          this.toast(!SAVE.worldUnlocked(w)
            ? `🔒 Defeat ${WORLDS[w - 1].boss.name} ${WORLDS[w - 1].boss.emoji} to enter ${WORLDS[w].name}!`
            : `🔒 Beat ${WORLDS[w].name} level ${s} first!`);
        }
        return;
      }
      const g = e.target.closest(".map-grass");
      if (g) {
        SFX.init();
        Engine.startWildGrass(+g.dataset.w, g.dataset.spot);
        return;
      }
      const f = e.target.closest(".map-fish");
      if (f) {
        SFX.init();
        if (SAVE.wildToday().casts >= this.CASTS_PER_DAY) {
          this.toast("🎣 The Pokemon are not biting anymore — come back tomorrow!");
        } else {
          Engine.startFishing();
        }
        return;
      }
      const ro = e.target.closest(".map-roamer");
      if (ro) {
        SFX.init();
        Engine.startLegendary();
        return;
      }
      const rd = e.target.closest(".map-raid");
      if (rd) {
        SFX.init();
        const raid = SAVE.raidNow();
        if (!raid) return;
        if (!raid.defeated) { Engine.startRaid(); return; } // any trainer can attack
        const myContrib = (SAVE.root.active && raid.contrib[SAVE.root.active]) || 0;
        if (SAVE.raidClaimedByMe()) {
          this.toast("✅ You've claimed this week's raid reward. A fresh boss appears next week!");
        } else if (myContrib > 0) {
          Engine.startRaidClaim();
        } else {
          this.toast("💪 This boss is already down — but only trainers who fought it can claim the prize!");
        }
        return;
      }
      const sc = e.target.closest(".map-school");
      if (sc) {
        SFX.init();
        this.show("practice");
        return;
      }
      const lab = e.target.closest(".map-lab");
      if (lab) {
        SFX.init();
        this.openPerchCard();
        return;
      }
      const pd = e.target.closest(".map-podium");
      if (pd) {
        SFX.init();
        if (SAVE.dailyInfo().done) this.toast("✅ Today's drill is done — the Professor preps a new one overnight!");
        else Engine.startDaily();
        return;
      }
      const tr = e.target.closest(".map-trade");
      if (tr) {
        SFX.init();
        this.openTradePost();
        return;
      }
      const tw = e.target.closest(".map-tower");
      if (tw) {
        SFX.init();
        Engine.startTower();
        return;
      }
      // wild Pokemon living on the map: say hi (caught) or open the
      // area guide so the mystery shows how it can be caught
      const pk = e.target.closest(".map-poke");
      if (pk) {
        SFX.init();
        const w = +pk.dataset.pw, i = +pk.dataset.pi;
        const c = CREATURES[w][i];
        const got = SAVE.state.dex[`${w}-${i}`];
        pk.classList.remove("greet");
        void pk.offsetWidth;
        pk.classList.add("greet");
        if (got) {
          SFX.word();
          this.toast(`${got.shiny ? "✨ " : ""}<b>${this.esc(c.n)}</b> says hi! It lives near ${WORLDS[w].emoji} ${WORLDS[w].name}.`);
        } else {
          SFX.combo();
          this.openAreaPanel(w, `${w}-${i}`);
        }
        return;
      }
      // area name signs open the spawn guide for that region
      const rl = e.target.closest(".region-label");
      if (rl) {
        SFX.init();
        SFX.word();
        this.openAreaPanel(+rl.dataset.rw);
        return;
      }
      const pc = e.target.closest(".map-parcel");
      if (pc) {
        SFX.init();
        const f2 = this.pendingIntro();
        if (f2) this.startIntro(f2, false);
      }
    });

    this.$("practice-tiers").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const t = e.target.closest(".tier-card");
      if (!t) return;
      SFX.init();
      if (!t.classList.contains("locked")) {
        const sel = this._raceGhost && this._raceGhost[`practice:${t.dataset.tier}`];
        Engine.startPractice(t.dataset.tier, sel && sel !== "mine" ? sel : null);
      } else {
        SFX.error();
        t.classList.remove("denied");
        void t.offsetWidth;
        t.classList.add("denied");
        const tier = PRACTICE_TIERS.find(x => x.id === t.dataset.tier);
        if (tier) this.toast(`🔒 Reach ${WORLDS[tier.need].emoji} ${WORLDS[tier.need].name} to unlock ${tier.label} practice!`);
      }
    });

    this.$("paragraph-list").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const c = e.target.closest(".para-card");
      if (!c) return;
      SFX.init();
      if (!c.classList.contains("locked")) {
        const sel = this._raceGhost && this._raceGhost[`paragraph:${c.dataset.para}`];
        Engine.startParagraph(c.dataset.para, sel && sel !== "mine" ? sel : null);
      } else {
        SFX.error();
        c.classList.remove("denied");
        void c.offsetWidth;
        c.classList.add("denied");
        this.toast(`🔒 Story Typing unlocks at ${WORLDS[5].emoji} ${WORLDS[5].name} — you'll need your capital letters!`);
      }
    });

    this.$("wordpack-list").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const edit = e.target.closest(".wp-edit");
      if (edit) { this.openWordPackForm(edit.dataset.pack); return; }
      const del = e.target.closest(".wp-del");
      if (del) { this.deleteWordPackFlow(del.dataset.pack); return; }
      if (e.target.closest(".wordpack-new")) { this.openWordPackForm(null); return; }
      const card = e.target.closest(".wordpack-card");
      if (!card) return;
      SFX.init();
      const pack = SAVE.wordPackById(card.dataset.pack);
      const sel = pack && this._raceGhost && this._raceGhost[`pack:${pack.name}`];
      Engine.startPractice(`custom-${card.dataset.pack}`, sel && sel !== "mine" ? sel : null);
    });

    this.$("license-list").addEventListener("click", e => {
      const gp = e.target.closest(".ghost-pick");
      if (gp) { this.pickRaceGhost(gp); return; }
      const card = e.target.closest(".license-card");
      if (!card || card.classList.contains("locked")) return;
      SFX.init();
      const sel = this._raceGhost && this._raceGhost[`practice:license-${card.dataset.license}`];
      Engine.startPractice(`license-${card.dataset.license}`, sel && sel !== "mine" ? sel : null);
    });

    this.$("party-bar").addEventListener("click", e => {
      const slot = e.target.closest(".party-slot.filled");
      if (!slot) return;
      SFX.click();
      if (SAVE.makeLead(slot.dataset.key)) {
        const c = SAVE.creatureByKey(slot.dataset.key);
        this.toast(`⭐ ${c.n} is now your lead partner!`);
        this.renderPartyBar();
      }
    });
    this.$("btn-findme").addEventListener("click", e => {
      e.stopPropagation();
      SFX.click();
      const f = this.mapFrontier();
      const p = this.mapNodes()[f.w][f.s];
      this.centerMapOn(p.x, p.y);
    });
    addEventListener("resize", () => {
      if (this._pendingCenter) this.centerMapOn(this._pendingCenter.x, this._pendingCenter.y);
    });

    this.$("wild-chip").addEventListener("click", e => {
      e.stopPropagation();
      SFX.click();
      this.toast("🌿 Rustling grass hides wild Pokemon — click a patch to battle! 🎣 shows fishing casts left today.", "gold");
    });

    this.$("egg-chip").addEventListener("click", e => {
      e.stopPropagation();
      const egg = SAVE.state && SAVE.state.egg;
      if (!egg) return;
      SFX.click();
      if (egg.progress >= 3) Engine.startHatch();
      else this.toast(`🥚 Keep playing! ${3 - egg.progress} more level${egg.progress === 2 ? "" : "s"} and it will hatch.`);
    });
  },
});
