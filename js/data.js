// ============================================================
// TypeQuest — game data: curriculum, worlds, Pokemon, trophies
// Curriculum: home row first, then reaching up/down, then words,
// phrases, and finally capitals + sentences. Every word in a world
// only uses keys that have been taught by that point.
// Catchable Pokemon are matched to worlds so their names use mostly
// taught keys; the few untaught letters get extra catch time.
// ============================================================

const AVATARS = ["🧢", "🦊", "🐱", "🐉", "🥷", "⚡", "⚽", "🦖", "🐼", "🚀"];

const TITLES = [
  [1, "New Trainer"], [3, "Trainer"], [5, "Gym Challenger"], [7, "Badge Collector"],
  [9, "Ace Trainer"], [12, "Gym Leader"], [15, "Elite Four"], [18, "Champion"], [22, "Pokemon Master"],
];

// On-screen keyboard layout
const KB_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", "."],
];

// key -> finger (0..3 left pinky..left index, 4..7 right index..right pinky, 8 thumb)
const KEY_FINGER = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
  y: 4, h: 4, n: 4, u: 4, j: 4, m: 4,
  i: 5, k: 5, ",": 5,
  o: 6, l: 6, ".": 6,
  p: 7, ";": 7, "'": 7, "/": 7,
  " ": 8,
};

const FINGER_NAMES = [
  "left pinky", "left ring", "left middle", "left index",
  "right index", "right middle", "right ring", "right pinky", "thumb",
];

const WORLDS = [
  {
    name: "Pallet Meadow",
    tagline: "Your journey begins! Learn the home row.",
    emoji: "🌳",
    gradient: ["#123c26", "#2e7d4f"],
    accent: "#7ee787",
    targets: ["🦭", "🐍", "💫", "🥄", "🦕", "🦔", "🐹", "🗝️"],
    projectile: "🔴",
    hitText: ["Gotcha!", "Caught!", "Nice throw!", "Great ball!"],
    sceneEmojis: ["🌸", "🌿", "🍄", "🦋"],
    boss: { name: "Snorlax", emoji: "😴", id: 143, hp: 9, time: 5.5, taunt: "Zzz... WHO dares wake me?!" },
    levels: [
      { name: "F and J", keys: "fj", time: 6,
        pool: ["f", "j", "ff", "jj", "fj", "jf", "fjf", "jfj", "jjf", "ffj", "fjj", "jff"], count: 10 },
      { name: "D and K", keys: "dk", time: 6,
        pool: ["d", "k", "dd", "kk", "dk", "kd", "dkd", "kdk", "fdk", "jkd", "fkd", "jdk", "dfk", "kjd"], count: 10 },
      { name: "S and L", keys: "sl", time: 6,
        pool: ["s", "l", "ss", "ll", "sl", "ls", "sls", "lsl", "skl", "lds", "fls", "jls", "sdl", "lks"], count: 10 },
      { name: "A and friends", keys: "a;", time: 6,
        pool: ["a", "aa", "as", "la", "ka", "fa", "da", "sa", "ja", ";", "a;", "ask", "lad", "sad", "dad", "fad", "add"], count: 12 },
      { name: "First Words", keys: "", time: 5,
        pool: ["dad", "sad", "lad", "all", "fall", "ask", "asks", "add", "salad", "flask", "alas", "dads",
               "falls", "lads", "a sad lad", "ask dad", "all fall", "a salad"], count: 12 },
    ],
    bossPool: ["dad", "sad", "lad", "fall", "ask", "salad", "flask", "all", "add", "asks", "lads", "falls"],
  },
  {
    name: "Mt. Moon Caves",
    tagline: "Dig for Moon Stones with your new keys: E I R U!",
    emoji: "⛏️",
    gradient: ["#2a2440", "#52447e"],
    accent: "#b39df1",
    targets: ["🪨", "🌑", "💎", "🟫", "⬜", "🦇"],
    projectile: "⛏️",
    hitText: ["Mined!", "Moon Stone!", "Fossil found!", "Sparkle!"],
    sceneEmojis: ["💎", "🕯️", "🪨", "🦇"],
    boss: { name: "Onix", emoji: "🪨", id: 95, hp: 10, time: 5, taunt: "I am ROCK SOLID. You cannot beat me!" },
    levels: [
      { name: "E and I", keys: "ei", time: 5.5,
        pool: ["e", "i", "ee", "ii", "ei", "ie", "die", "lie", "like", "side", "idea", "aide", "ladies",
               "slide", "desk", "seal", "deal", "leaf", "lake", "kid", "kids", "jade", "skill"], count: 12 },
      { name: "R and U", keys: "ru", time: 5.5,
        pool: ["r", "u", "ru", "ur", "fur", "rude", "rule", "ruler", "sure", "user", "lure", "dare",
               "rare", "fair", "raise", "rise"], count: 12 },
      { name: "Word Builder", keys: "", time: 5,
        pool: ["fire", "ride", "side", "slide", "like", "lake", "leaf", "real", "rule", "sail", "rail",
               "fail", "jail", "deal", "dear", "rise", "raise", "dare", "fries", "skill", "drill",
               "field", "fields", "rider"], count: 12 },
      { name: "Long Words", keys: "", time: 5.5,
        pool: ["raiders", "sliders", "fielders", "skills", "drills", "leaders", "sailed", "derailed",
               "failure", "fairies", "jailers", "dealers", "ladders", "riddles", "saddles", "fiddles"], count: 10 },
      { name: "Speed Run", keys: "", time: 3.2,
        pool: ["as", "is", "if", "us", "all", "like", "ride", "fire", "dad", "kid", "sale", "idea",
               "red", "led", "fed", "seek", "feel", "fuel", "life", "isle"], count: 14 },
    ],
    bossPool: ["fire", "slide", "skill", "drill", "field", "raise", "ruler", "fries", "leader", "sailed", "riddle", "ladder"],
  },
  {
    name: "Battle Stadium",
    tagline: "Score goals with T O W N G H!",
    emoji: "⚽",
    gradient: ["#0c3d2e", "#1e7d5c"],
    accent: "#5dff9d",
    targets: ["🥅", "🥅", "🧤", "🥅"],
    projectile: "⚽",
    hitText: ["GOOOAL!", "Top corner!", "What a shot!", "Screamer!"],
    sceneEmojis: ["🏟️", "📣", "🎉", "⚽"],
    boss: { name: "Team Rocket", emoji: "😼", id: 52, hp: 10, time: 4.5, taunt: "Prepare for trouble! NO goals for you!" },
    levels: [
      { name: "T and O", keys: "to", time: 5,
        pool: ["t", "o", "to", "too", "tot", "lot", "dot", "tool", "took", "look", "foot", "food",
               "door", "toad", "toast", "total", "tools", "roost"], count: 12 },
      { name: "W and N", keys: "wn", time: 5,
        pool: ["w", "n", "now", "win", "won", "new", "news", "down", "town", "snow", "wind", "want",
               "went", "know", "noon", "winter", "window"], count: 12 },
      { name: "G and H", keys: "gh", time: 5,
        pool: ["g", "h", "go", "goal", "goat", "high", "hot", "hat", "the", "that", "this", "then",
               "light", "night", "right", "fight", "ghost", "laugh", "huge", "hero"], count: 12 },
      { name: "Match Day", keys: "", time: 4.5,
        pool: ["goal", "goals", "shoot", "shot", "win", "winner", "net", "goalie", "striker", "strike",
               "header", "star", "stars", "fast", "faster", "run", "turn", "the great goal", "we win",
               "go go go", "she shoots", "nine goals"], count: 12 },
      { name: "Speed Run", keys: "", time: 3,
        pool: ["go", "win", "net", "hot", "ten", "the", "and", "got", "not", "out", "run", "sun", "fun",
               "dog", "log", "wing", "king", "ring", "song", "long", "goal"], count: 14 },
    ],
    bossPool: ["goal", "shoot", "winner", "striker", "header", "strike", "fast", "goalie", "the goal", "we win", "go go go", "net"],
  },
  {
    name: "Dragon's Den",
    tagline: "Learn M P Y B and unleash mighty Pokemon moves!",
    emoji: "🐉",
    gradient: ["#4a1d10", "#a4461c"],
    accent: "#ffb454",
    targets: ["🌪️", "🪨", "🔥", "👊"],
    projectile: "💥",
    hitText: ["KA-BOOM!", "Super effective!", "MEGA HIT!", "Over 9000!"],
    sceneEmojis: ["⛰️", "🔥", "☁️", "⚡"],
    boss: { name: "Garchomp", emoji: "🐲", id: 445, hp: 11, time: 4.5, taunt: "No trainer escapes my den!" },
    levels: [
      { name: "M and P", keys: "mp", time: 4.5,
        pool: ["m", "p", "map", "mop", "team", "jump", "lamp", "pump", "more", "time", "game", "make",
               "poem", "stamp", "metal", "item", "palm", "damp", "romp"], count: 12 },
      { name: "Y and B", keys: "yb", time: 4.5,
        pool: ["y", "b", "by", "my", "boy", "buy", "baby", "body", "yes", "yet", "year", "blue", "bye",
               "berry", "happy", "maybe", "money", "funny", "burst", "yellow"], count: 12 },
      { name: "Battle Moves", keys: "", time: 4.5,
        pool: ["ember", "surf", "fly", "bite", "slam", "pound", "growl", "stomp", "thunder",
               "water gun", "psybeam", "body slam", "iron tail", "fire blast", "hyper beam",
               "dragon rage", "thunderbolt", "flamethrower", "mega drain", "tail whip"], count: 12 },
      { name: "Trainer Talk", keys: "", time: 4.5,
        pool: ["gotta type them all", "use thunderbolt", "use hyper beam", "use fire blast",
               "a wild dragon appeared", "the gym leader awaits", "the battle begins",
               "power up now", "the dragon roars", "i am the dragon master"], count: 10 },
      { name: "Speed Run", keys: "", time: 3,
        pool: ["up", "my", "by", "yes", "map", "jump", "mega", "beam", "fly", "blue", "bomb", "palm",
               "pump", "my team", "big jump", "use surf", "go mega"], count: 14 },
    ],
    bossPool: ["thunderbolt", "hyper beam", "fire blast", "dragon rage", "flamethrower", "iron tail",
               "body slam", "mega drain", "water gun", "psybeam", "thunder", "power up"],
  },
  {
    name: "Eterna Forest",
    tagline: "Master the last letters C V X Z Q in the spooky forest!",
    emoji: "🌲",
    gradient: ["#1c1030", "#5e1f3d"],
    accent: "#ff6e9c",
    targets: ["👻", "🦇", "🕸️", "🌑"],
    projectile: "🗡️",
    hitText: ["Slash!", "Super effective!", "Critical hit!", "Stay calm!"],
    sceneEmojis: ["🌲", "🍃", "🏮", "🌫️"],
    boss: { name: "Darkrai", emoji: "😈", id: 491, hp: 12, time: 4, taunt: "Welcome to your NIGHTMARE!" },
    levels: [
      { name: "C and V", keys: "cv", time: 4.5,
        pool: ["c", "v", "cave", "cut", "cool", "nice", "voice", "very", "give", "love", "have",
               "cover", "victory", "brave", "crush", "catch", "kick", "score", "civic"], count: 12 },
      { name: "X Z and Q", keys: "xzq", time: 4.5,
        pool: ["x", "z", "q", "box", "fox", "six", "zoo", "zap", "zoom", "quiz", "quick", "quest",
               "exact", "extra", "zigzag", "queen", "squad", "prize", "zero", "sixty"], count: 12 },
      { name: "Expert Moves", keys: "", time: 4,
        pool: ["quick attack", "shadow ball", "night slash", "razor leaf", "ice beam", "solar beam",
               "dark pulse", "shadow claw", "focus blast", "aqua jet", "fire punch", "close combat",
               "giga impact", "x scissor"], count: 12 },
      { name: "Tall Grass", keys: "", time: 4,
        pool: ["it is super effective", "a critical hit", "use shadow ball", "use quick attack",
               "the forest is quiet", "beware the tall grass", "a shiny appeared",
               "gotta catch them all", "the dark forest calls", "never look back"], count: 10 },
      { name: "Speed Run", keys: "", time: 2.8,
        pool: ["cut", "zap", "box", "fox", "mix", "zoom", "quick", "quiz", "jazz", "quest", "blaze",
               "craze", "pixel", "vivid", "squad", "crazy"], count: 14 },
    ],
    bossPool: ["dark pulse", "dark void", "shadow ball", "night slash", "quick attack", "stay calm",
               "focus", "courage", "ice beam", "silent forest", "never give up", "final slash"],
  },
  {
    name: "Hall of Fame",
    tagline: "Capital letters and full sentences. Become the Champion!",
    emoji: "👑",
    gradient: ["#241a4f", "#8a6d1d"],
    accent: "#ffd34d",
    targets: ["👾", "🤖", "🛸"],
    projectile: "⭐",
    hitText: ["Legendary!", "Critical hit!", "Masterful!", "One in a million!"],
    sceneEmojis: ["🏆", "✨", "👑", "🎆"],
    boss: { name: "MissingNo", emoji: "👾", id: null, hp: 10, time: 4, taunt: "I corrupted the Pokedex. The world is MINE!" },
    levels: [
      { name: "Big Letters", keys: "", time: 4.5,
        pool: ["Ash", "Red", "Blue", "Misty", "Brock", "Leon", "May", "Dawn", "Ash and Brock",
               "Professor Oak", "Team Rocket", "Pikachu and Ash"], count: 10 },
      { name: "Sentences", keys: "", time: 4,
        pool: ["I choose you.", "The gym battle begins.", "Pikachu used thunderbolt.",
               "It is super effective.", "The wild Eevee fled.", "I got a gym badge."], count: 6 },
      { name: "Hero Lines", keys: "", time: 4,
        pool: ["I want to be the very best.", "Gotta catch them all.", "A shiny Charizard appeared.",
               "The Elite Four are waiting.", "Team Rocket is up to no good.",
               "My Pikachu never gives up."], count: 6 },
      { name: "Master Lines", keys: "", time: 4,
        pool: ["Practice makes perfect.", "Type like the wind.", "Speed comes from calm focus.",
               "A true Pokemon Master never stops learning.",
               "The quick brown fox jumps over the lazy dog."], count: 5 },
      { name: "Speed Run", keys: "", time: 3,
        pool: ["Go.", "Run.", "Catch it.", "Throw the ball.", "I choose you.", "Use surf.",
               "We are champions.", "Catch Mewtwo.", "Be brave.", "Stay calm."], count: 10 },
    ],
    bossPool: ["I am MissingNo.", "I corrupted the Pokedex.", "You cannot type fast.",
               "My glitch power is unlimited.", "The keyboard obeys me.", "You are too fast for me.",
               "No. Not my glitches.", "You type like a true master.", "The Pokedex is saved.",
               "Long live the Pokemon Master."],
  },
];

// 8 catchable Pokemon per world, matched so names use mostly-taught keys.
// Names with a few untaught letters get bonus catch time (see taughtKeys).
// r: rarity 1 common, 2 rare, 3 epic, 4 legendary
const CREATURES = [
  [
    { n: "Seel", e: "🦭", id: 86, r: 1 }, { n: "Ekans", e: "🐍", id: 23, r: 1 }, { n: "Dedenne", e: "🐹", id: 702, r: 1 },
    { n: "Sandslash", e: "🦔", id: 28, r: 1 }, { n: "Abra", e: "💫", id: 63, r: 2 }, { n: "Lapras", e: "🦕", id: 131, r: 2 },
    { n: "Alakazam", e: "🥄", id: 65, r: 2 }, { n: "Klefki", e: "🗝️", id: 707, r: 3 },
  ],
  [
    { n: "Eevee", e: "🦊", id: 133, r: 1 }, { n: "Furret", e: "🦦", id: 162, r: 1 }, { n: "Raichu", e: "🐭", id: 26, r: 1 },
    { n: "Dratini", e: "🐉", id: 147, r: 1 }, { n: "Arcanine", e: "🐕", id: 59, r: 2 }, { n: "Greninja", e: "🐸", id: 658, r: 2 },
    { n: "Raikou", e: "🐯", id: 243, r: 2 }, { n: "Lucario", e: "🐺", id: 448, r: 3 },
  ],
  [
    { n: "Growlithe", e: "🐶", id: 58, r: 1 }, { n: "Hoothoot", e: "🦉", id: 163, r: 1 }, { n: "Wooloo", e: "🐑", id: 831, r: 1 },
    { n: "Togepi", e: "🥚", id: 175, r: 1 }, { n: "Girafarig", e: "🦒", id: 203, r: 2 }, { n: "Gengar", e: "👻", id: 94, r: 2 },
    { n: "Dragonite", e: "🐲", id: 149, r: 2 }, { n: "Charizard", e: "🔥", id: 6, r: 3 },
  ],
  [
    { n: "Magikarp", e: "🐟", id: 129, r: 1 }, { n: "Piplup", e: "🐧", id: 393, r: 1 }, { n: "Mudkip", e: "🦎", id: 258, r: 1 },
    { n: "Gyarados", e: "🐋", id: 130, r: 2 }, { n: "Mew", e: "💗", id: 151, r: 2 }, { n: "Lugia", e: "🕊️", id: 249, r: 2 },
    { n: "Pikachu", e: "⚡", id: 25, r: 3 }, { n: "Mewtwo", e: "🧬", id: 150, r: 3 },
  ],
  [
    { n: "Bulbasaur", e: "🌱", id: 1, r: 1 }, { n: "Charmander", e: "🕯️", id: 4, r: 1 }, { n: "Squirtle", e: "🐢", id: 7, r: 1 },
    { n: "Vulpix", e: "❄️", id: 37, r: 1 }, { n: "Umbreon", e: "🐈‍⬛", id: 197, r: 2 }, { n: "Absol", e: "🌙", id: 359, r: 2 },
    { n: "Scizor", e: "🦂", id: 212, r: 2 }, { n: "Zoroark", e: "🌑", id: 571, r: 3 },
  ],
  [
    { n: "Suicune", e: "💠", id: 245, r: 2 }, { n: "Zacian", e: "⚔️", id: 888, r: 2 }, { n: "Zekrom", e: "🌩️", id: 644, r: 2 },
    { n: "Reshiram", e: "☄️", id: 643, r: 2 }, { n: "Giratina", e: "🌀", id: 487, r: 3 }, { n: "Rayquaza", e: "🌌", id: 384, r: 3 },
    { n: "Koraidon", e: "🦖", id: 1007, r: 3 }, { n: "Arceus", e: "✨", id: 493, r: 4 },
  ],
];

// Local sprite files (downloaded once by tools/get-sprites.mjs, see README).
// The game silently falls back to emoji when the images are not present.
function spriteUrl(id, shiny) {
  return `img/pokemon/${shiny ? "shiny-" : ""}${id}.png`;
}

const RARITY = {
  1: { label: "Common", color: "#9aa3d0" },
  2: { label: "Rare", color: "#4dc3ff" },
  3: { label: "Epic", color: "#c77bff" },
  4: { label: "LEGENDARY", color: "#ffd34d" },
};

const TROPHIES = [
  { id: "first-level", e: "👣", name: "First Steps", desc: "Finish your first level" },
  { id: "first-catch", e: "🎯", name: "First Catch", desc: "Catch your first Pokemon" },
  { id: "combo-10", e: "🔥", name: "On Fire", desc: "Reach a 10 combo" },
  { id: "combo-25", e: "⚡", name: "Super Mode", desc: "Reach a 25 combo" },
  { id: "combo-50", e: "🌟", name: "Unstoppable", desc: "Reach a 50 combo" },
  { id: "wpm-15", e: "🚲", name: "Quick Fingers", desc: "Type 15 WPM in a level" },
  { id: "wpm-25", e: "🏎️", name: "Speed Machine", desc: "Type 25 WPM in a level" },
  { id: "wpm-35", e: "🚀", name: "Rocket Hands", desc: "Type 35 WPM in a level" },
  { id: "perfect", e: "💯", name: "Perfect!", desc: "Finish a level with 100% accuracy" },
  { id: "ninja", e: "🥷", name: "Keyboard Ninja", desc: "Beat a level in Ninja Mode (hidden keyboard)" },
  { id: "collect-10", e: "📦", name: "Collector", desc: "Catch 10 Pokemon" },
  { id: "collect-25", e: "🧺", name: "Big Collector", desc: "Catch 25 Pokemon" },
  { id: "collect-all", e: "👑", name: "Gotta Catch Them All", desc: "Catch all 48 Pokemon" },
  { id: "shiny", e: "✨", name: "Shiny Hunter", desc: "Catch a shiny Pokemon" },
  { id: "streak-3", e: "📅", name: "Hat Trick", desc: "Play 3 days in a row" },
  { id: "streak-7", e: "🗓️", name: "Legend Week", desc: "Play 7 days in a row" },
  { id: "boss-0", e: "🏆", name: "Rise and Shine", desc: "Wake the giant Snorlax" },
  { id: "boss-1", e: "🏆", name: "Rock Smasher", desc: "Defeat the wild Onix" },
  { id: "boss-2", e: "🏆", name: "Blasting Off", desc: "Send Team Rocket blasting off again" },
  { id: "boss-3", e: "🏆", name: "Dragon Tamer", desc: "Defeat Garchomp" },
  { id: "boss-4", e: "🏆", name: "Dream Defender", desc: "Defeat Darkrai" },
  { id: "boss-5", e: "🏆", name: "POKEMON MASTER", desc: "Defeat MissingNo and save the Pokedex" },
];

const ENCOURAGE = [
  "You almost had it!", "So close! Try again!", "Even Ash lost his first battles!",
  "Your Pokemon believe in you!", "Every Master was once a Rookie!", "One more try, Trainer!",
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// all keys taught up to and including world w (drill levels carry `keys`)
function taughtKeys(w) {
  const set = new Set([" "]);
  for (let i = 0; i <= Math.min(w, WORLDS.length - 1); i++) {
    for (const lvl of WORLDS[i].levels) {
      for (const k of lvl.keys) set.add(k);
    }
  }
  return set;
}

function xpNeededFor(level) {
  return 60 + (level - 1) * 45;
}

function levelFromXp(xp) {
  let level = 1, rest = xp;
  while (rest >= xpNeededFor(level)) { rest -= xpNeededFor(level); level++; }
  return { level, into: rest, need: xpNeededFor(level) };
}

function titleForLevel(level) {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) t = name;
  return t;
}
