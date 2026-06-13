// ============================================================
// TypeQuest — game data: curriculum, worlds, Pokemon, trophies
// Curriculum: home row first, then reaching up/down, then words,
// phrases, and finally capitals + sentences. Every word in a world
// only uses keys that have been taught by that point.
// Catchable Pokemon are matched to worlds so their names use mostly
// taught keys; the few untaught letters get extra catch time.
// ============================================================

const AVATARS = ["🧢", "🦊", "🐱", "🐉", "🥷", "⚡", "🎒", "🦖", "🐼", "🚀"];

// build-your-own-trainer options (layered SVG character)
const TRAINER_OPTS = {
  skin: ["#ffd5b3", "#f0b186", "#c98a5c", "#9c6238", "#6e4427"],
  hair: ["spiky", "bowl", "long", "curls"],
  hairColor: ["#2d2a33", "#6b4226", "#d8a13c", "#b8453a", "#4a7fd6", "#9b59d6"],
  hat: ["none", "cap", "beanie"],
  hatColor: ["#e3350d", "#2a6df0", "#2eaf5b", "#f5c518", "#8e44ad"],
  shirt: ["#e3350d", "#2a6df0", "#2eaf5b", "#f5c518", "#8e44ad", "#16a2b8"],
};

function defaultTrainer() {
  return { skin: 0, hair: 0, hairColor: 0, hat: 1, hatColor: 0, shirt: 1 };
}

function randomTrainer() {
  const r = n => Math.floor(Math.random() * n);
  return {
    skin: r(TRAINER_OPTS.skin.length),
    hair: r(TRAINER_OPTS.hair.length),
    hairColor: r(TRAINER_OPTS.hairColor.length),
    hat: r(TRAINER_OPTS.hat.length),
    hatColor: r(TRAINER_OPTS.hatColor.length),
    shirt: r(TRAINER_OPTS.shirt.length),
  };
}

// per-player difficulty: scales every prompt/catch timer; Turbo pays bonus XP
const DIFFICULTY = {
  chill:  { label: "Chill",  e: "🐢", time: 1.45, xp: 1,    desc: "Extra time to think" },
  normal: { label: "Normal", e: "🙂", time: 1,    xp: 1,    desc: "The classic challenge" },
  turbo:  { label: "Turbo",  e: "🔥", time: 0.7,  xp: 1.25, desc: "Less time, +25% XP" },
};
const DIFF_ORDER = ["chill", "normal", "turbo"];

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
    targets: ["🎯", "🎈", "⭐", "🪨"],
    projectile: "🔴",
    hitText: ["Nice hit!", "Great aim!", "Bullseye!", "Wow!"],
    sceneEmojis: ["🌸", "🌿", "🍄", "🦋"],
    boss: { name: "Snorlax", emoji: "😴", id: 143, hp: 9, time: 5.5, taunt: "Zzz... WHO dares wake me?!" },
    levels: [
      { name: "F and J", keys: "fj", time: 6,
        pool: ["f", "j", "ff", "jj", "fj", "jf", "fjf", "jfj", "jjf", "ffj", "fjj", "jff"], count: 10 },
      { name: "F and J Combo", keys: "", time: 6,
        pool: ["fjf", "jfj", "ffjj", "jjff", "fjfj", "jfjf", "fff", "jjj", "fjj", "jff", "ffj", "jjf"], count: 10 },
      { name: "D and K", keys: "dk", time: 6,
        pool: ["d", "k", "dd", "kk", "dk", "kd", "dkd", "kdk", "fdk", "jkd", "fkd", "jdk", "dfk", "kjd"], count: 10 },
      { name: "Home Row Mix", keys: "", time: 6,
        pool: ["fdk", "jkd", "dfj", "kjf", "fdjk", "jkfd", "dkfj", "fjdk", "dd", "kk", "fkd", "jdf", "kdjf", "djkf"], count: 10 },
      { name: "S and L", keys: "sl", time: 6,
        pool: ["s", "l", "ss", "ll", "sl", "ls", "sls", "lsl", "skl", "lds", "fls", "jls", "sdl", "lks"], count: 10 },
      { name: "A and friends", keys: "a;", time: 6,
        pool: ["a", "aa", "as", "la", "ka", "fa", "da", "sa", "ja", ";", "a;", "ask", "lad", "sad", "dad", "fad", "add"], count: 12 },
      { name: "First Words", keys: "", time: 5.5,
        pool: ["dad", "sad", "lad", "all", "fall", "ask", "asks", "add", "salad", "flask", "alas", "dads",
               "falls", "lads", "a sad lad", "ask dad", "all fall", "a salad"], count: 12 },
      { name: "Word Party", keys: "", time: 5.5,
        pool: ["salad", "flask", "alas", "dads", "falls", "lads", "fads", "asks", "a sad dad",
               "a lad asks", "all salads", "dad falls"], count: 12 },
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
        pool: ["e", "i", "ee", "ii", "ei", "ie", "dei", "kei", "lei", "sei", "fie", "die", "lie", "eik"], count: 10 },
      { name: "E and I Words", keys: "", time: 5.5,
        pool: ["die", "lie", "like", "side", "idea", "aide", "slide", "desk", "seal", "deal", "leaf",
               "lake", "kid", "kids", "jade", "skill", "ladies"], count: 12 },
      { name: "R and U", keys: "ru", time: 5.5,
        pool: ["r", "u", "ru", "ur", "uru", "rur", "fur", "jur", "dur", "kur", "rud", "urk"], count: 10 },
      { name: "R and U Words", keys: "", time: 5.5,
        pool: ["fur", "rude", "rule", "ruler", "sure", "user", "lure", "dare", "rare", "fair",
               "raise", "rise", "fire", "ride", "rail", "ruse"], count: 12 },
      { name: "Word Builder", keys: "", time: 5,
        pool: ["fire", "ride", "side", "slide", "like", "lake", "leaf", "real", "rule", "sail", "rail",
               "fail", "jail", "deal", "dear", "rise", "raise", "dare", "fries", "skill", "drill",
               "field", "fields", "rider"], count: 12 },
      { name: "Long Words", keys: "", time: 5.5,
        pool: ["raiders", "sliders", "fielders", "skills", "drills", "leaders", "sailed", "derailed",
               "failure", "fairies", "jailers", "dealers", "ladders", "riddles", "saddles", "fiddles"], count: 10 },
      { name: "Little Phrases", keys: "", time: 5,
        pool: ["ride a slide", "a real deal", "fair fields", "i like fries", "like a rider",
               "raise a leaf", "dear dad", "a rare jade", "kids slide", "sure fire"], count: 10 },
      { name: "Speed Run", keys: "", time: 3.4,
        pool: ["as", "is", "if", "us", "all", "like", "ride", "fire", "dad", "kid", "sale", "idea",
               "red", "led", "fed", "seek", "feel", "fuel", "life", "isle"], count: 14 },
    ],
    bossPool: ["fire", "slide", "skill", "drill", "field", "raise", "ruler", "fries", "leader", "sailed", "riddle", "ladder"],
  },
  {
    name: "Battle Stadium",
    tagline: "Win gym battles with T O W N G H!",
    emoji: "🏟️",
    gradient: ["#0c3d2e", "#1e7d5c"],
    accent: "#5dff9d",
    targets: ["🎯", "🥊", "🛡️", "🎯"],
    projectile: "⚡",
    hitText: ["Direct hit!", "Take that!", "Nice move!", "KO!"],
    sceneEmojis: ["🏟️", "📣", "🚩", "🎉"],
    boss: { name: "Team Rocket", emoji: "😼", id: 52, hp: 10, time: 4.5, taunt: "Prepare for trouble! NO badges for you!" },
    levels: [
      { name: "T and O", keys: "to", time: 5,
        pool: ["t", "o", "to", "ot", "tot", "oto", "jot", "kot", "lot", "dot", "fot", "sot"], count: 10 },
      { name: "T and O Words", keys: "", time: 5,
        pool: ["to", "too", "lot", "dot", "tool", "took", "look", "foot", "food", "door", "toad",
               "toast", "total", "roost", "tools", "jolt"], count: 12 },
      { name: "W and N", keys: "wn", time: 5,
        pool: ["w", "n", "now", "win", "won", "new", "news", "down", "town", "snow", "wind", "want",
               "went", "know", "noon", "winter", "window"], count: 12 },
      { name: "G and H", keys: "gh", time: 5,
        pool: ["g", "h", "go", "glare", "goat", "high", "hot", "hat", "the", "that", "this", "then",
               "light", "night", "right", "fight", "ghost", "laugh", "huge", "hero"], count: 12 },
      { name: "New Words", keys: "", time: 4.8,
        pool: ["town", "snow", "wind", "want", "went", "know", "light", "night", "right", "fight",
               "ghost", "laugh", "huge", "hero", "winter", "window", "tonight", "nothing"], count: 12 },
      { name: "Gym Training", keys: "", time: 4.8,
        pool: ["growl", "leer", "glare", "harden", "sing", "roar", "gust", "swift", "rage", "dig",
               "rest", "snore", "slash", "thrash", "take down", "iron head", "strong", "trainer",
               "fight", "arena"], count: 12 },
      { name: "Crowd Roar", keys: "", time: 4.6,
        pool: ["go go go", "use take down", "use thunder", "the arena roars", "the greatest trainer",
               "i want to win", "what a great win", "the trainer wins", "the gust hits hard",
               "go go trainer"], count: 10 },
      { name: "Speed Run", keys: "", time: 3.2,
        pool: ["go", "win", "dig", "hot", "ten", "the", "and", "got", "not", "out", "run", "sun", "fun",
               "dog", "log", "wing", "king", "ring", "song", "long", "roar"], count: 14 },
    ],
    bossPool: ["take down", "thunder", "slash", "swift", "rage", "roar", "gust", "glare", "iron head",
               "leer", "fight on", "we win again"],
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
      { name: "New Words", keys: "", time: 4.7,
        pool: ["map", "team", "jump", "lamp", "pump", "time", "game", "make", "stamp", "item", "palm",
               "baby", "body", "year", "blue", "berry", "happy", "maybe", "money", "yellow"], count: 12 },
      { name: "Battle Moves", keys: "", time: 4.7,
        pool: ["ember", "surf", "fly", "bite", "slam", "pound", "growl", "stomp", "thunder",
               "psybeam", "water gun", "tail whip"], count: 12 },
      { name: "Mega Moves", keys: "", time: 4.7,
        pool: ["body slam", "iron tail", "fire blast", "hyper beam", "dragon rage", "thunderbolt",
               "flamethrower", "mega drain", "sunny day", "mud slap"], count: 10 },
      { name: "Trainer Talk", keys: "", time: 4.5,
        pool: ["gotta type them all", "use thunderbolt", "use hyper beam", "use fire blast",
               "a wild dragon appeared", "the gym leader awaits", "the battle begins",
               "power up now", "the dragon roars", "i am the dragon master"], count: 10 },
      { name: "Epic Lines", keys: "", time: 4.6,
        pool: ["the mega dragon roars", "my team is ready", "use mega drain now", "the storm is here",
               "jump higher and higher", "the gym is open today", "my dratini is happy",
               "i am not afraid", "the den is deep and dark", "big dragon big dreams"], count: 9 },
      { name: "Speed Run", keys: "", time: 3.2,
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
        pool: ["c", "v", "cv", "vc", "cav", "vic", "cuv", "vec", "civ", "vac"], count: 10 },
      { name: "C and V Words", keys: "", time: 4.6,
        pool: ["cave", "cut", "cool", "nice", "voice", "very", "give", "love", "have", "cover",
               "victory", "brave", "crush", "catch", "kick", "score", "civic", "cherry", "active",
               "cactus"], count: 12 },
      { name: "X Z and Q", keys: "xzq", time: 4.5,
        pool: ["x", "z", "q", "xz", "zq", "qx", "zax", "qiz", "xul", "zeq"], count: 10 },
      { name: "X Z Q Words", keys: "", time: 4.6,
        pool: ["box", "fox", "six", "zoo", "zap", "zoom", "quiz", "quick", "quest", "exact", "extra",
               "zigzag", "queen", "squad", "prize", "zero", "sixty", "exam", "jazz", "quiet"], count: 12 },
      { name: "Expert Moves", keys: "", time: 4.3,
        pool: ["quick attack", "shadow ball", "night slash", "razor leaf", "ice beam", "solar beam",
               "dark pulse"], count: 12 },
      { name: "Mega Expert Moves", keys: "", time: 4.3,
        pool: ["shadow claw", "focus blast", "aqua jet", "fire punch", "close combat", "giga impact",
               "x scissor", "zen headbutt", "seismic toss", "double team"], count: 10 },
      { name: "Tall Grass", keys: "", time: 4.2,
        pool: ["it is super effective", "a critical hit", "use shadow ball", "use quick attack",
               "the forest is quiet", "beware the tall grass", "a shiny appeared",
               "gotta catch them all", "the dark forest calls", "never look back"], count: 10 },
      { name: "Speed Run", keys: "", time: 3,
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
    properNames: true, // creature names keep their capital letters here
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
      { name: "Trainer Names", keys: "", time: 4.4,
        pool: ["Ash and Pikachu", "Misty and Brock", "Professor Oak", "Leon the Champion",
               "May and Dawn", "Red and Blue", "King Koraidon", "Brave Sir Piplup",
               "Captain Magikarp", "Lady Eevee"], count: 9 },
      { name: "Sentences", keys: "", time: 4,
        pool: ["I choose you.", "The gym battle begins.", "Pikachu used thunderbolt.",
               "It is super effective.", "The wild Eevee fled.", "I got a gym badge."], count: 6 },
      { name: "Gym Lines", keys: "", time: 4,
        pool: ["The gym doors are open.", "Brock uses a rock type.", "Misty loves water types.",
               "The badge shines bright.", "One more win to go.", "The crowd goes wild."], count: 6 },
      { name: "Hero Lines", keys: "", time: 4,
        pool: ["I want to be the very best.", "Gotta catch them all.", "A shiny Charizard appeared.",
               "The Elite Four are waiting.", "Team Rocket is up to no good.",
               "My Pikachu never gives up."], count: 6 },
      { name: "Legend Lines", keys: "", time: 4,
        pool: ["Arceus created the world.", "Rayquaza rules the sky.", "Suicune runs on water.",
               "Zekrom brings the thunder.", "The legends are waking up.",
               "Only a master can catch them."], count: 6 },
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

// 16 Pokemon per world. The first 8 of each world are the original
// catchable roster (NEVER reorder them — dex saves use these indexes;
// new Pokemon are appended only). evoOnly Pokemon can't be caught in
// the wild: they are unlocked through evolution.
// r: rarity 1 common, 2 rare, 3 epic, 4 legendary
const CREATURES = [
  [
    { n: "Seel", e: "🦭", id: 86, r: 1 }, { n: "Ekans", e: "🐍", id: 23, r: 1 }, { n: "Dedenne", e: "🐹", id: 702, r: 1 },
    { n: "Sandslash", e: "🦔", id: 28, r: 1 }, { n: "Abra", e: "💫", id: 63, r: 2 }, { n: "Lapras", e: "🦕", id: 131, r: 2 },
    { n: "Alakazam", e: "🥄", id: 65, r: 2 }, { n: "Klefki", e: "🗝️", id: 707, r: 3 },
    { n: "Dewgong", e: "🦭", id: 87, r: 2, evoOnly: true }, { n: "Arbok", e: "🐍", id: 24, r: 2, evoOnly: true },
    { n: "Kadabra", e: "🥄", id: 64, r: 2, evoOnly: true }, { n: "Munchlax", e: "😋", id: 446, r: 1 },
    { n: "Snorlax", e: "😴", id: 143, r: 3, evoOnly: true }, { n: "Ditto", e: "🟣", id: 132, r: 2 },
    { n: "Spearow", e: "🐦", id: 21, r: 1 }, { n: "Fearow", e: "🦅", id: 22, r: 2, evoOnly: true },
  ],
  [
    { n: "Eevee", e: "🦊", id: 133, r: 1 }, { n: "Furret", e: "🦦", id: 162, r: 1 }, { n: "Raichu", e: "🐭", id: 26, r: 1 },
    { n: "Dratini", e: "🐉", id: 147, r: 1 }, { n: "Arcanine", e: "🐕", id: 59, r: 2 }, { n: "Greninja", e: "🐸", id: 658, r: 2 },
    { n: "Raikou", e: "🐯", id: 243, r: 2 }, { n: "Lucario", e: "🐺", id: 448, r: 3 },
    { n: "Jolteon", e: "⚡", id: 135, r: 2, evoOnly: true }, { n: "Vaporeon", e: "💧", id: 134, r: 2, evoOnly: true },
    { n: "Flareon", e: "🔥", id: 136, r: 2, evoOnly: true }, { n: "Dragonair", e: "🐉", id: 148, r: 2, evoOnly: true },
    { n: "Clefairy", e: "🧚", id: 35, r: 1 }, { n: "Clefable", e: "🌙", id: 36, r: 2, evoOnly: true },
    { n: "Zubat", e: "🦇", id: 41, r: 1 }, { n: "Golbat", e: "🦇", id: 42, r: 2, evoOnly: true },
  ],
  [
    { n: "Growlithe", e: "🐶", id: 58, r: 1 }, { n: "Hoothoot", e: "🦉", id: 163, r: 1 }, { n: "Wooloo", e: "🐑", id: 831, r: 1 },
    { n: "Togepi", e: "🥚", id: 175, r: 1 }, { n: "Girafarig", e: "🦒", id: 203, r: 2 }, { n: "Gengar", e: "👻", id: 94, r: 2 },
    { n: "Dragonite", e: "🐲", id: 149, r: 2 }, { n: "Charizard", e: "🔥", id: 6, r: 3 },
    { n: "Togetic", e: "🕊️", id: 176, r: 2, evoOnly: true }, { n: "Noctowl", e: "🦉", id: 164, r: 2, evoOnly: true },
    { n: "Dubwool", e: "🐏", id: 832, r: 2, evoOnly: true }, { n: "Machop", e: "💪", id: 66, r: 1 },
    { n: "Machoke", e: "💪", id: 67, r: 2, evoOnly: true }, { n: "Doduo", e: "🐤", id: 84, r: 1 },
    { n: "Dodrio", e: "🐔", id: 85, r: 2, evoOnly: true }, { n: "Tauros", e: "🐂", id: 128, r: 2 },
  ],
  [
    { n: "Magikarp", e: "🐟", id: 129, r: 1 }, { n: "Piplup", e: "🐧", id: 393, r: 1 }, { n: "Mudkip", e: "🦎", id: 258, r: 1 },
    { n: "Gyarados", e: "🐋", id: 130, r: 2 }, { n: "Mew", e: "💗", id: 151, r: 2 }, { n: "Lugia", e: "🕊️", id: 249, r: 2 },
    { n: "Pikachu", e: "⚡", id: 25, r: 3 }, { n: "Mewtwo", e: "🧬", id: 150, r: 3 },
    { n: "Prinplup", e: "🐧", id: 394, r: 2, evoOnly: true }, { n: "Empoleon", e: "👑", id: 395, r: 3, evoOnly: true },
    { n: "Marshtomp", e: "🦎", id: 259, r: 2, evoOnly: true }, { n: "Swampert", e: "🐊", id: 260, r: 3, evoOnly: true },
    { n: "Pichu", e: "⚡", id: 172, r: 1 }, { n: "Bagon", e: "🐲", id: 371, r: 2 },
    { n: "Shelgon", e: "🛡️", id: 372, r: 2, evoOnly: true }, { n: "Salamence", e: "🐉", id: 373, r: 3, evoOnly: true },
  ],
  [
    { n: "Bulbasaur", e: "🌱", id: 1, r: 1 }, { n: "Charmander", e: "🕯️", id: 4, r: 1 }, { n: "Squirtle", e: "🐢", id: 7, r: 1 },
    { n: "Vulpix", e: "❄️", id: 37, r: 1 }, { n: "Umbreon", e: "🐈‍⬛", id: 197, r: 2 }, { n: "Absol", e: "🌙", id: 359, r: 2 },
    { n: "Scizor", e: "🦂", id: 212, r: 2 }, { n: "Zoroark", e: "🌑", id: 571, r: 3 },
    { n: "Ivysaur", e: "🌿", id: 2, r: 2, evoOnly: true }, { n: "Venusaur", e: "🌺", id: 3, r: 3, evoOnly: true },
    { n: "Charmeleon", e: "🔥", id: 5, r: 2, evoOnly: true }, { n: "Wartortle", e: "🐢", id: 8, r: 2, evoOnly: true },
    { n: "Blastoise", e: "💦", id: 9, r: 3, evoOnly: true }, { n: "Ninetales", e: "🦊", id: 38, r: 2, evoOnly: true },
    { n: "Shroomish", e: "🍄", id: 285, r: 1 }, { n: "Breloom", e: "🥊", id: 286, r: 2, evoOnly: true },
  ],
  [
    { n: "Suicune", e: "💠", id: 245, r: 2 }, { n: "Zacian", e: "⚔️", id: 888, r: 2 }, { n: "Zekrom", e: "🌩️", id: 644, r: 2 },
    { n: "Reshiram", e: "☄️", id: 643, r: 2 }, { n: "Giratina", e: "🌀", id: 487, r: 3 }, { n: "Rayquaza", e: "🌌", id: 384, r: 3 },
    { n: "Koraidon", e: "🦖", id: 1007, r: 3 }, { n: "Arceus", e: "✨", id: 493, r: 4 },
    { n: "Mimikyu", e: "👻", id: 778, r: 2 }, { n: "Shaymin", e: "🌱", id: 492, r: 2 },
    { n: "Celebi", e: "🍃", id: 251, r: 3 }, { n: "Jirachi", e: "⭐", id: 385, r: 3 },
    { n: "Victini", e: "🔥", id: 494, r: 3 }, { n: "Zamazenta", e: "🛡️", id: 889, r: 3 },
    { n: "Miraidon", e: "🐉", id: 1008, r: 3 }, { n: "Eternatus", e: "🌌", id: 890, r: 3 },
  ],
];

// Evolution families. Duplicate catches of a base earn its candy;
// CANDY_COST candy lets you evolve by typing the evolved name.
// chain: targets unlock in order. choices: pick any (Eevee!).
// A target that is already owned gets upgraded to shiny instead.
const CANDY_COST = 3;
const EVOLUTIONS = [
  { base: "0-0", chain: ["0-8"] },                          // Seel → Dewgong
  { base: "0-1", chain: ["0-9"] },                          // Ekans → Arbok
  { base: "0-4", chain: ["0-10", "0-6"] },                  // Abra → Kadabra → Alakazam
  { base: "0-11", chain: ["0-12"] },                        // Munchlax → Snorlax
  { base: "0-14", chain: ["0-15"] },                        // Spearow → Fearow
  { base: "1-0", choices: ["1-8", "1-9", "1-10", "4-4"] },  // Eevee → Jolteon/Vaporeon/Flareon/Umbreon
  { base: "1-3", chain: ["1-11", "2-6"] },                  // Dratini → Dragonair → Dragonite
  { base: "1-12", chain: ["1-13"] },                        // Clefairy → Clefable
  { base: "1-14", chain: ["1-15"] },                        // Zubat → Golbat
  { base: "2-0", chain: ["1-4"] },                          // Growlithe → Arcanine
  { base: "2-1", chain: ["2-9"] },                          // Hoothoot → Noctowl
  { base: "2-2", chain: ["2-10"] },                         // Wooloo → Dubwool
  { base: "2-3", chain: ["2-8"] },                          // Togepi → Togetic
  { base: "2-11", chain: ["2-12"] },                        // Machop → Machoke
  { base: "2-13", chain: ["2-14"] },                        // Doduo → Dodrio
  { base: "3-0", chain: ["3-3"] },                          // Magikarp → Gyarados
  { base: "3-1", chain: ["3-8", "3-9"] },                   // Piplup → Prinplup → Empoleon
  { base: "3-2", chain: ["3-10", "3-11"] },                 // Mudkip → Marshtomp → Swampert
  { base: "3-12", chain: ["3-6"] },                         // Pichu → Pikachu
  { base: "3-13", chain: ["3-14", "3-15"] },                // Bagon → Shelgon → Salamence
  { base: "4-0", chain: ["4-8", "4-9"] },                   // Bulbasaur → Ivysaur → Venusaur
  { base: "4-1", chain: ["4-10", "2-7"] },                  // Charmander → Charmeleon → Charizard
  { base: "4-2", chain: ["4-11", "4-12"] },                 // Squirtle → Wartortle → Blastoise
  { base: "4-3", chain: ["4-13"] },                         // Vulpix → Ninetales
  { base: "4-14", chain: ["4-15"] },                        // Shroomish → Breloom
];

// Local sprite files (downloaded once by tools/get-sprites.mjs, see README).
// The game silently falls back to emoji when the images are not present.
function spriteUrl(id, shiny) {
  return `img/pokemon/${shiny ? "shiny-" : ""}${id}.png`;
}

// The Hall of Fame's world index. New islands will be appended AFTER this,
// so "the legendary world" must never be computed as WORLDS.length - 1.
const HALL_W = 5;

// worlds where Pokemon names keep capitals in catch prompts
function worldProperNames(w) {
  return !!(WORLDS[w] && WORLDS[w].properNames);
}

// ---- World Mastery Medals (computed from per-stage bests, never stored) ----
// A strict ladder: each tier includes the one below.
//   Bronze: every stage 3-starred
//   Silver: + every stage's best ≥ 95% accuracy and ≥ 15 wpm
//   Gold:   + every stage's best ≥ 97% accuracy and ≥ 22 wpm
//   Crown:  + every stage cleared in Ninja Mode (guide hidden, ≥ 95% acc)
const MEDAL_TIERS = [
  { tier: 1, id: "bronze", e: "🥉", name: "Bronze" },
  { tier: 2, id: "silver", e: "🥈", name: "Silver", acc: 0.95, wpm: 15 },
  { tier: 3, id: "gold",   e: "🥇", name: "Gold",   acc: 0.97, wpm: 22 },
  { tier: 4, id: "crown",  e: "👑", name: "Crown" },
];
const MEDAL_E = ["", "🥉", "🥈", "🥇", "👑"];

// ---- Professor's Letters: features introduce themselves when they unlock.
// when(SAVE) decides if the parcel appears; pages are the letter panels;
// spotlight steps run after the letter (nav = screen to open first).
const FEATURE_INTROS = [
  {
    id: "medals",
    icon: "🎖",
    title: "A parcel from Professor Oak!",
    when: S => {
      for (let w = 0; w < WORLDS.length; w++) if (S.worldMedal(w) >= 1) return true;
      return S.stageStars(HALL_W, WORLDS[HALL_W].levels.length) > 0;
    },
    pages: [
      "Incredible work, Trainer! My research shows your levels are getting close to <b>perfect</b>.",
      "So I've sent you a <b>Medal Case</b>! Every region can earn a medal: 🥉 Bronze, 🥈 Silver, 🥇 Gold... and the legendary 👑 <b>Crown</b> — for clearing levels with the keyboard guide hidden!",
      "Replay any level to push your best speed and accuracy. Your Medal Case lives in the <b>Museum</b>. Go take a look!",
    ],
    spotlight: [
      { nav: "trophies", tab: "medals", sel: "#museum-tabs", text: "Your Trophy Room is now a Museum — with wings!" },
      { sel: "#medal-wing", text: "The Medal Case: every region shows what to do for the next medal." },
    ],
  },
  {
    id: "shiny",
    icon: "✨",
    title: "Professor Oak's shiny research",
    when: S => S.shinyCount() >= 3,
    pages: [
      "Astounding! You've found <b>several ✨ shiny Pokemon</b> — they're extraordinarily rare.",
      "Keep collecting shinies and you'll earn the <b>Shiny Charm</b> (at 10, 25 and 50): each charm makes EVERY future shiny more likely!",
      "Your shiny collection is on display in the Museum's <b>Gallery</b> wing. It's beautiful already.",
    ],
    spotlight: [
      { nav: "trophies", tab: "gallery", sel: "#gallery-wing", text: "The Gallery: every shiny you find takes a pedestal. Fill the shelves!" },
    ],
  },
];

// dex keys of water Pokemon that can be hooked at fishing spots
const WATER_POKEMON = ["0-0", "0-5", "3-0", "3-1", "3-2", "3-3", "4-2", "5-0"];

// what an evolution-only Pokemon evolves FROM (chains may cross worlds,
// e.g. Growlithe in the Stadium evolves into Arcanine on Mt. Moon)
function evoSourceFor(key) {
  for (const f of EVOLUTIONS) {
    const links = f.chain || f.choices;
    const idx = links.indexOf(key);
    if (idx === -1) continue;
    const prev = (f.choices || idx === 0) ? f.base : links[idx - 1];
    const [pw, pi] = prev.split("-").map(Number);
    return { key: prev, c: CREATURES[pw][pi] };
  }
  return null;
}

// every honest way to obtain a Pokemon — mirrors pickCatch / wildPick /
// fishPick / eggPick / roamerNow so the spawn guide never lies
function spawnSources(w, i) {
  const c = CREATURES[w][i];
  const key = `${w}-${i}`;
  if (c.evoOnly) {
    const from = evoSourceFor(key);
    return from ? [{ icon: "✨", label: `evolve ${from.c.n}`,
      title: `Catch ${from.c.n}, then feed it ${CANDY_COST} candy from duplicate catches` }] : [];
  }
  const stars = c.r <= 1 ? 1 : c.r === 2 ? 2 : 3;
  const srcs = [
    { icon: "🌿", label: "tall grass",
      title: `Click the rustling grass in ${WORLDS[w].name}` },
    { icon: "⭐".repeat(stars), label: "level win",
      title: `Win a ${WORLDS[w].name} level with ${stars} star${stars > 1 ? "s" : ""} or more` },
  ];
  if (WATER_POKEMON.includes(key)) {
    srcs.push({ icon: "🎣", label: "fishing", title: "Cast a line at any fishing spot" });
  }
  srcs.push({ icon: "🥚", label: "eggs", title: "Mystery Eggs can hatch it once this region is open" });
  if (w === HALL_W) {
    srcs.push({ icon: "🌟", label: "weekly visit", title: "Can appear as the once-a-week legendary visitor" });
  }
  // some wild Pokemon (Arcanine, Pikachu...) can ALSO be evolved into
  const from = evoSourceFor(key);
  if (from) {
    srcs.push({ icon: "✨", label: `evolve ${from.c.n}`,
      title: `Or feed ${from.c.n} ${CANDY_COST} candy from duplicate catches` });
  }
  return srcs;
}

// the move a party partner uses when its typing-charged meter fills
const PARTNER_MOVES = { 1: "Tackle", 2: "Take Down", 3: "Hyper Beam", 4: "Judgment" };
const PARTY_MAX = 6;

// Trainer School practice: no countdown, race your own records.
// Tiers draw words from story worlds and unlock with them (need = world idx).
const PRACTICE_TIERS = [
  { id: "easy",   label: "Easy",   e: "🐣", desc: "Short words · Meadow & Mt. Moon",      worlds: [0, 1], count: 12, need: 0 },
  { id: "medium", label: "Medium", e: "⭐", desc: "Words & moves · Stadium & Dragon's Den", worlds: [2, 3], count: 12, need: 2 },
  { id: "hard",   label: "Hard",   e: "🔥", desc: "Expert moves & long phrases · Eterna",  worlds: [4],    count: 10, need: 4 },
  { id: "expert", label: "Expert", e: "👑", desc: "Capitals & full sentences · Hall of Fame", worlds: [5], count: 6,  need: 5 },
];

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
  { id: "collect-10", e: "📦", name: "Collector", desc: "Collect 10 Pokemon" },
  { id: "collect-25", e: "🧺", name: "Big Collector", desc: "Collect 25 Pokemon" },
  { id: "collect-50", e: "🎒", name: "Mega Collector", desc: "Collect 50 Pokemon" },
  { id: "collect-all", e: "👑", name: "Gotta Catch Them All", desc: "Complete the whole Pokedex" },
  { id: "shiny", e: "✨", name: "Shiny Hunter", desc: "Catch a shiny Pokemon" },
  { id: "evolve-1", e: "🧬", name: "Evolver", desc: "Evolve a Pokemon for the first time" },
  { id: "evolve-5", e: "🔮", name: "Evolution Expert", desc: "Evolve 5 Pokemon" },
  { id: "medal-silver-1", e: "🥈", name: "Silver Standard", desc: "Earn a Silver region medal" },
  { id: "medal-gold-1", e: "🥇", name: "Golden Touch", desc: "Earn a Gold region medal" },
  { id: "crown-1", e: "👑", name: "Crowned", desc: "Earn a Crown: master a region in Ninja Mode" },
  { id: "shiny-10", e: "✨", name: "Shiny Charm", desc: "Collect 10 shiny Pokemon" },
  { id: "shiny-25", e: "💫", name: "Shiny Charm II", desc: "Collect 25 shiny Pokemon" },
  { id: "shiny-50", e: "🌈", name: "Shiny Charm III", desc: "Collect 50 shiny Pokemon" },
  { id: "hatch-1", e: "🐣", name: "Hatched!", desc: "Hatch a Mystery Egg" },
  { id: "party-6", e: "🎽", name: "Full Squad", desc: "Put 6 Pokemon in your party" },
  { id: "legend-1", e: "🌟", name: "Legend Catcher", desc: "Catch a roaming legendary" },
  { id: "streak-3", e: "📅", name: "Three in a Row", desc: "Play 3 days in a row" },
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
