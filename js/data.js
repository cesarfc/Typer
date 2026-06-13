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
  hairColor: ["#2d2a33", "#6b4226", "#d8a13c", "#b8453a", "#4a7fd6", "#9b59d6", "#2eea9c"],
  hat: ["none", "cap", "beanie"],
  hatColor: ["#e3350d", "#2a6df0", "#2eaf5b", "#f5c518", "#8e44ad", "#ffd34d"],
  shirt: ["#e3350d", "#2a6df0", "#2eaf5b", "#f5c518", "#8e44ad", "#16a2b8", "#ffd34d", "#1a1d2e"],
};

// wardrobe pieces earned through play ("part:index" -> requirement)
const TRAINER_LOCKS = {
  "hairColor:6": { need: "stamps", n: 6, label: "Earn 6 research stamps" },
  "hatColor:5": { need: "champion", label: "Become the Champion" },
  "shirt:6": { need: "champion", label: "Become the Champion" },
  "shirt:7": { need: "stamps", n: 3, label: "Earn 3 research stamps" },
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

// ---- extra finger assignments for the number row and symbols (Scholar
// Archipelago). Standard touch-typing reaches: index fingers take two
// columns, pinkies the far edges. ----
Object.assign(KEY_FINGER, {
  "1": 0, "2": 1, "3": 2, "4": 3, "5": 3,
  "6": 4, "7": 4, "8": 5, "9": 6, "0": 7,
  "-": 7, "=": 7, "[": 7, "]": 7, "\\": 7,
});

// A target symbol -> the physical (base) key you press, so the keyboard
// guide lights the right key and the Shift logic knows when Shift is held.
// Keys NOT in this map are typed without Shift (digits, - = etc).
const SHIFT_MAP = {
  "(": "9", ")": "0", "_": "-", "+": "=",
  "\"": "'", "<": ",", ">": ".", "?": "/",
  "{": "[", "}": "]", "|": "\\",
  "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8",
  "!": "1", ":": ";",
};

// keyboard layouts a world can request (world.kb). "letters" keeps the
// original 3-row board; "full" adds the number row for the math/CS islands.
const KB_LAYOUTS = {
  letters: KB_ROWS,
  full: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
    ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
  ],
};

// ---- prompt objects: a prompt is either a plain string (display == typed)
// or { d: question, a: answer, think: seconds } where the player reads `d`
// and types `a`. These helpers let the whole engine treat both alike. ----
function promptAnswer(p) { return typeof p === "string" ? p : p.a; }
function promptDisplay(p) { return typeof p === "string" ? null : (p.d || null); }
function promptThink(p) { return typeof p === "string" ? 0 : (p.think || 0); }
function promptLen(p) { return promptAnswer(p).length; }
function promptOut(p) { return typeof p === "string" ? null : (p.out || null); }  // code run result
function promptCode(p) { return typeof p === "object" && !!p.code; }              // monospace prompt
function promptSwatch(p) { return typeof p === "string" ? null : (p.swatch || null); } // hex color preview

// iOS "smart punctuation" can deliver curly quotes / long dashes through
// the on-screen keyboard — fold them to the plain ASCII we validate against.
const CHAR_EQUIV = {
  "‘": "'", "’": "'", "“": "\"", "”": "\"",
  "–": "-", "—": "-", "×": "x", "÷": "/",
};
function normalizeKey(ch) { return CHAR_EQUIV[ch] || ch; }

// ---- Concept lessons: each new-idea level opens with a short, interactive
// lesson that assumes the trainer is brand-new to the subject. Steps:
//   { say }            tutor speech only
//   { say, board,arg } show a visual board (see UI.lessonBoard)
//   { say, guide }     wait for ONE specific keypress (full hint stack)
//   { say, try }       one untimed real prompt {d, a}
// concrete -> pictorial -> abstract throughout. ----
const LESSONS = {
  numrow: { e: "🥄", title: "The Number Row", steps: [
    { say: "Welcome to Gimmighoul Coast! Here we count treasure with NUMBERS." },
    { say: "Number keys sit in a row ABOVE the letters. The rule: reach up, then come back home!", board: "numrow", arg: null },
    { say: "Find the 4 — your left index finger reaches up.", board: "numrow", arg: "4", guide: "4" },
    { say: "Now the 7 — right index finger reaches up.", board: "numrow", arg: "7", guide: "7" },
    { say: "On this island the clock only runs while you TYPE. Take all the time you need to think!" },
  ]},
  place: { e: "🥄", title: "Big Numbers", steps: [
    { say: "Big numbers are made of parts. 347 = 300 + 40 + 7." },
    { say: "Three hundreds, four tens, seven ones — type the digits in order: 3, 4, 7.", board: "place", arg: 347 },
    { say: "Try it: what is 300 + 40 + 7?", try: { d: "300 + 40 + 7 = ?", a: "347" } },
  ]},
  times: { e: "🥄", title: "Times Tables", steps: [
    { say: "Multiplication is fast adding! '3 × 4' means 3 GROUPS of 4." },
    { say: "Three groups, four berries each. Count them all up!", board: "groups", arg: [3, 4] },
    { say: "A trick: skip-count by 4s — 4, 8, 12!", board: "skip", arg: [4, 3] },
    { say: "Your turn — how many berries? Type the total.", try: { d: "3 × 4 = ?", a: "12" } },
    { say: "One more: 2 groups of 5.", try: { d: "2 × 5 = ?", a: "10" } },
  ]},
  divide: { e: "🥄", title: "Division", steps: [
    { say: "Division shares things into equal groups. '12 ÷ 3' asks: share 12 into 3 bowls — how many each?" },
    { say: "12 berries, 3 bowls... 4 in each bowl!", board: "groups", arg: [3, 4] },
    { say: "Multiplication and division are best friends: 3 × 4 = 12, so 12 ÷ 3 = 4.", board: "triangle", arg: [12, 3, 4] },
    { say: "Try it: share 12 into 3 groups.", try: { d: "12 ÷ 3 = ?", a: "4" } },
  ]},
  equation: { e: "🥄", title: "Equations", steps: [
    { say: "An equation balances both sides of an = sign. 6 + 7 = 13." },
    { say: "The + key and the = key are on the right edge of the number row — right pinky reaches!", board: "numrow", arg: "=" },
    { say: "Type the whole equation: 6+7=13", guide: "6", typeWord: "6+7=13" },
  ]},
  fractions: { e: "🥄", title: "Fractions", steps: [
    { say: "A fraction is part of a whole. '1/2' means one of two equal parts — a half!" },
    { say: "1/2 of 8 means split 8 into 2 halves: 4 and 4. Each half is 4.", board: "pie", arg: [1, 2] },
    { say: "Try it: what is 1/2 of 8?", try: { d: "1/2 of 8 = ?", a: "4" } },
  ]},

  // ---- Circuit Town (coding) ----
  parens: { e: "🖥️", title: "Parentheses", steps: [
    { say: "Welcome to Circuit Town! Here we type real CODE. Code makes things happen." },
    { say: "Code uses ( ) — parentheses. The ( is Shift + 9, the ) is Shift + 0. Hold Shift with your pinky!", board: "pair", arg: ["(", ")"] },
    { say: "When you finish a line of code, it RUNS — watch the screen! Type: run()", guide: "r", typeWord: "run()" },
  ]},
  camel: { e: "🖥️", title: "camelCase", steps: [
    { say: "Programmers join words with NO spaces, and a Capital starts each new word. It's called camelCase! 🐫" },
    { say: "'move up' becomes 'moveUp' — lowercase m, then capital U. Use Shift for the capital.", board: "camel", arg: "moveUp" },
    { say: "Try it: type jumpHigh (capital H!)", guide: "j", typeWord: "jumpHigh" },
  ]},
  strings: { e: "🖥️", title: "Strings", steps: [
    { say: "Words that the computer SAYS go inside \" \" — double quotes. The \" is Shift + the ' key." },
    { say: "say(\"hi\") tells the computer to say hi. The quotes wrap the message.", board: "pair", arg: ["\"", "\""] },
    { say: "Type it and watch it run: say(\"hi\")", guide: "s", typeWord: "say(\"hi\")" },
  ]},
  variables: { e: "🖥️", title: "Variables", steps: [
    { say: "A variable is a labeled box that remembers a number. 'let hp = 10;' puts 10 in a box called hp." },
    { say: "The name remembers the number. A line of code ends with a ; — semicolon (it's on home row!).", board: "crate", arg: ["hp", 10] },
    { say: "Type it: let hp = 10;", guide: "l", typeWord: "let hp = 10;" },
  ]},
  predict: { e: "🖥️", title: "Predict the Output", steps: [
    { say: "Real coders PREDICT what their code does before running it." },
    { say: "If x = 3, then 'x = x + 2' makes x bigger by 2. So x becomes 5!", board: "crate", arg: ["x", 5] },
    { say: "Your turn — think it through, then type the answer.", try: { d: "x = 3, then x = x + 2. What is x?", a: "5" } },
  ]},

  // ---- Old Power Plant (computer science) ----
  hex: { e: "🔌", title: "Hex Colors", steps: [
    { say: "Welcome to the Power Plant! Computers make colors with HEX codes — a # and six digits." },
    { say: "#ff0000 is bright red: ff red, 00 green, 00 blue. The # is Shift + 3.", board: "hexswatch", arg: "#ff0000" },
    { say: "Type a color and watch the swatch! #ffd34d (TypeQuest gold!)", guide: "#", typeWord: "#ffd34d" },
  ]},
  binary: { e: "🔌", title: "Binary", steps: [
    { say: "Computers count with just 0 and 1 — that's BINARY! Each spot is worth double the one to its right." },
    { say: "Four lamps: 8, 4, 2, 1. A 1 means ON. So 0101 = 4 + 1 = 5!", board: "lamps", arg: "0101" },
    { say: "Try one: what is 0110? (the 4 and the 2 are ON)", try: { d: "🔢 0110 = ?", a: "6" } },
  ]},
  logic: { e: "🔌", title: "Logic Gates", steps: [
    { say: "Computers think with LOGIC. AND needs BOTH things true. OR needs just ONE." },
    { say: "Two switches and a light: AND only lights up when both are ON.", board: "gate", arg: "AND" },
    { say: "Try it: is 'true AND false' true or false?", try: { d: "true AND false = ?", a: "false" } },
  ]},
  cipher: { e: "🔌", title: "Secret Codes", steps: [
    { say: "Spies hide messages with CIPHERS. 'Shift back 1' moves each letter back one: b→a, c→b!" },
    { say: "So 'dbu' shifts back to 'cat': d→c, b→a, u→t.", board: "cipher", arg: "dbu" },
    { say: "Your turn — shift 'eph' back one letter each.", try: { d: "🔐 shift back 1: eph", a: "dog" } },
  ]},
};

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

  // ============================================================
  // SCHOLAR ARCHIPELAGO — island 1. Reached by ferry from the dock.
  // These worlds teach school subjects: math, coding, computer science,
  // while also opening new keyboard territory. Prompts may be
  // { d: question, a: answer } objects (display != typed).
  // ============================================================
  {
    name: "Gimmighoul Coast",
    tagline: "Treasure math! The number row, +, -, and times tables.",
    emoji: "🪙",
    island: 1, kb: "full", statsLane: "facts", subject: "math",
    tutor: { name: "Alakazam", id: 65, e: "🥄" },
    gradient: ["#3a2c10", "#a9852f"],
    accent: "#ffd34d",
    targets: ["🪙", "💰", "💎", "🗝️"],
    projectile: "🪙",
    hitText: ["Cha-ching!", "Treasure!", "Counted!", "Solved!"],
    sceneEmojis: ["🪙", "💰", "🏝️", "⛵"],
    boss: { name: "Gholdengo", emoji: "🪙", id: 1000, hp: 11, time: 7, taunt: "You'll never count past my coins!" },
    levels: [
      { name: "4 and 7", keys: "47", time: 7, lesson: "numrow",
        pool: ["4", "7", "44", "77", "47", "74", "474", "747", "447", "774", "7447", "4774"], count: 10 },
      { name: "3 and 8", keys: "38", time: 7,
        pool: ["3", "8", "38", "83", "338", "883", "3838", "8383",
               { d: "🍓🍓🍓 berries — how many?", a: "3", think: 3 },
               { d: "🍓🍓🍓🍓🍓🍓🍓🍓 berries — how many?", a: "8", think: 3 }], count: 10 },
      { name: "2 and 9", keys: "29", time: 7,
        pool: ["2", "9", "29", "92", "229", "992", "2929",
               { d: "type the number: two hundred ninety-two", a: "292", think: 4 },
               { d: "type the number: nine hundred twenty-nine", a: "929", think: 4 }], count: 10 },
      { name: "Full Number Row", keys: "1056", time: 7, lesson: "place",
        pool: ["1", "0", "5", "6", "105", "560", "1056", "90210", "5060",
               { d: "300 + 40 + 7 = ?", a: "347", think: 5 },
               { d: "500 + 60 + 1 = ?", a: "561", think: 5 }], count: 11 },
      { name: "Times Tables I", keys: "", time: 6, lesson: "times",
        pool: [{ d: "2 × 5 = ?", a: "10", think: 5 }, { d: "3 × 4 = ?", a: "12", think: 5 },
               { d: "5 × 5 = ?", a: "25", think: 5 }, { d: "7 × 3 = ?", a: "21", think: 6 },
               { d: "4 × 4 = ?", a: "16", think: 5 }, { d: "10 × 6 = ?", a: "60", think: 5 },
               { d: "2 × 9 = ?", a: "18", think: 5 }, { d: "5 × 8 = ?", a: "40", think: 6 },
               { d: "3 × 6 = ?", a: "18", think: 6 }, { d: "4 × 7 = ?", a: "28", think: 6 }], count: 8 },
      { name: "Times & Divide", keys: "", time: 6, lesson: "divide",
        pool: [{ d: "12 ÷ 3 = ?", a: "4", think: 5 }, { d: "42 ÷ 6 = ?", a: "7", think: 6 },
               { d: "6 × 7 = ?", a: "42", think: 6 }, { d: "8 × 8 = ?", a: "64", think: 6 },
               { d: "63 ÷ 9 = ?", a: "7", think: 6 }, { d: "9 × 7 = ?", a: "63", think: 6 },
               { d: "56 ÷ 8 = ?", a: "7", think: 6 }, { d: "48 ÷ 6 = ?", a: "8", think: 6 },
               { d: "7 × 8 = ?", a: "56", think: 6 }, { d: "72 ÷ 9 = ?", a: "8", think: 6 }], count: 8 },
      { name: "Equation Builder", keys: "+-=", time: 7, lesson: "equation",
        pool: ["6+7=13", "9+8=17", "13-7=6", "15-8=7", "4+9=13", "12-5=7",
               { d: "356 + 248 = ?", a: "604", think: 7 }, { d: "473 + 159 = ?", a: "632", think: 7 },
               { d: "602 - 247 = ?", a: "355", think: 7 }], count: 9 },
      { name: "Treasure Math", keys: "/", time: 7, lesson: "fractions",
        pool: [{ d: "🥧 1/2 of 8 = ?", a: "4", think: 6 }, { d: "🥧 1/4 of 12 = ?", a: "3", think: 6 },
               { d: "🥧 1/2 of 14 = ?", a: "7", think: 6 }, { d: "2 + 3 × 4 = ?", a: "14", think: 7 },
               { d: "10 - 2 × 3 = ?", a: "4", think: 7 }, { d: "🥧 1/3 of 9 = ?", a: "3", think: 6 },
               { d: "5 × 2 + 6 = ?", a: "16", think: 7 }, { d: "🥧 1/4 of 20 = ?", a: "5", think: 6 }], count: 8 },
    ],
    bossPool: [{ d: "8 × 7 = ?", a: "56", think: 6 }, { d: "54 ÷ 6 = ?", a: "9", think: 6 },
               { d: "9 × 9 = ?", a: "81", think: 6 }, { d: "7 × 6 = ?", a: "42", think: 6 },
               { d: "🥧 1/2 of 18 = ?", a: "9", think: 6 }, { d: "248 + 367 = ?", a: "615", think: 7 },
               { d: "3 × 4 + 8 = ?", a: "20", think: 7 }, { d: "63 ÷ 7 = ?", a: "9", think: 6 },
               { d: "6 × 8 = ?", a: "48", think: 6 }, { d: "100 - 45 = ?", a: "55", think: 7 },
               { d: "9 × 8 = ?", a: "72", think: 6 }],
  },
  {
    name: "Circuit Town",
    tagline: "Type real code! Symbols, camelCase, and lines that RUN.",
    emoji: "💾",
    island: 1, kb: "full", statsLane: "facts", subject: "code",
    tutor: { name: "Porygon", id: 137, e: "🖥️" },
    gradient: ["#0a1c2e", "#1d6b7a"],
    accent: "#2eea9c",
    targets: ["💾", "🖲️", "🔌", "💡"],
    projectile: "⚡",
    hitText: ["Compiled!", "It runs!", "Clean code!", "No bugs!"],
    sceneEmojis: ["💾", "🖥️", "🔌", "💡"],
    boss: { name: "Porygon-Z", emoji: "🤖", id: 474, hp: 11, time: 8, taunt: "I live in the code now. Debug THIS!" },
    levels: [
      { name: "Open & Close", keys: "()", time: 8, lesson: "parens",
        pool: [{ a: "()", code: true }, { a: "(4)", code: true }, { a: "run()", code: true, out: "run!" },
               { a: "go()", code: true, out: "go!" }, { a: "(7)", code: true }, { a: "win()", code: true, out: "you win!" },
               { a: "jump()", code: true, out: "boing!" }, { a: "(9)", code: true }], count: 8 },
      { name: "camelCase", keys: "", time: 8, lesson: "camel",
        pool: [{ a: "moveUp", code: true }, { a: "jumpHigh", code: true }, { a: "goLeft", code: true },
               { a: "wildPokemon", code: true }, { a: "useItem", code: true }, { a: "runFast", code: true },
               { a: "catchEm", code: true }, { a: "levelUp", code: true }], count: 8 },
      { name: "Commands", keys: "", time: 8,
        pool: [{ a: "jump()", code: true, out: "boing!" }, { a: "heal()", code: true, out: "+20 HP" },
               { a: "pikachu.run()", code: true, out: "zoom!" }, { a: "usePotion()", code: true, out: "healed!" },
               { a: "attack()", code: true, out: "POW!" }, { a: "eevee.jump()", code: true, out: "hop!" }], count: 7 },
      { name: "Strings", keys: "\"", time: 9, lesson: "strings",
        pool: [{ a: "say(\"hi\")", code: true, out: "hi" }, { a: "say(\"go\")", code: true, out: "go" },
               { a: "print(\"pika\")", code: true, out: "pika" }, { a: "say(\"win\")", code: true, out: "win" },
               { a: "print(\"yes\")", code: true, out: "yes" }, { a: "say(\"hello\")", code: true, out: "hello" }], count: 7 },
      { name: "Variables", keys: ";", time: 9, lesson: "variables",
        pool: [{ a: "let hp = 10;", code: true, out: "hp is 10" }, { a: "let lvl = 5;", code: true, out: "lvl is 5" },
               { a: "let name = \"Ash\";", code: true, out: "name is Ash" }, { a: "let coins = 30;", code: true, out: "coins is 30" },
               { a: "let win = 1;", code: true, out: "win is 1" }], count: 6 },
      { name: "If & Else", keys: "<>", time: 10,
        pool: [{ a: "if (hp < 5) heal();", code: true, out: "healed!" }, { a: "if (lvl > 9) evolve();", code: true, out: "evolving!" },
               { a: "if (wild) run();", code: true, out: "ran away!" }, { a: "if (hp > 0) fight();", code: true, out: "fighting!" },
               { a: "if (coins > 9) buy();", code: true, out: "bought!" }], count: 6 },
      { name: "Loops", keys: "{}", time: 10,
        pool: [{ a: "repeat(3) { step(); }", code: true, out: "step step step" }, { a: "repeat(2) { jump(); }", code: true, out: "jump jump" },
               { a: "while (wild) { run(); }", code: true, out: "running..." }, { a: "repeat(4) { spin(); }", code: true, out: "spin x4" }], count: 5 },
      { name: "Predict & Fix", keys: "", time: 9, lesson: "predict",
        pool: [{ d: "x = 3, then x = x + 2. What is x?", a: "5", think: 7 },
               { d: "let n = 10; n = n - 4. What is n?", a: "6", think: 7 },
               { d: "type the fixed line: say(\"hi)  →", a: "say(\"hi\")", code: true, think: 6 },
               { d: "x = 2, then x = x × 3. What is x?", a: "6", think: 7 },
               { d: "type the fixed line: run(  →", a: "run()", code: true, think: 5 }], count: 6 },
    ],
    bossPool: [{ a: "print(\"win\")", code: true, out: "win" }, { d: "x = 5, x = x + 5. What is x?", a: "10", think: 7 },
               { a: "if (hp < 1) heal();", code: true, out: "saved!" }, { a: "repeat(3) { go(); }", code: true, out: "go go go" },
               { d: "type the fixed line: say(\"ok)  →", a: "say(\"ok\")", code: true, think: 6 },
               { a: "let bug = 0;", code: true, out: "fixed!" }, { d: "n = 8, n = n - 3. What is n?", a: "5", think: 7 },
               { a: "pikachu.win()", code: true, out: "CHAMPION!" }, { a: "evolve()", code: true, out: "✨" },
               { a: "debug()", code: true, out: "all clear!" }, { a: "reboot()", code: true, out: "online!" }],
  },
  {
    name: "Old Power Plant",
    tagline: "Computer science! Hex colors, binary, logic, and secret codes.",
    emoji: "⚡",
    island: 1, kb: "full", statsLane: "facts", subject: "cs",
    tutor: { name: "Rotom", id: 479, e: "🔌" },
    gradient: ["#1a1208", "#5a4a1a"],
    accent: "#ffe066",
    targets: ["⚡", "🔋", "💡", "🔧"],
    projectile: "⚡",
    hitText: ["Powered!", "Online!", "Charged!", "Decoded!"],
    sceneEmojis: ["⚡", "🔋", "💡", "🔌"],
    boss: { name: "Zapdos", emoji: "⚡", id: 145, hp: 11, time: 8, taunt: "BZZZT! Reboot me if you can, human!" },
    levels: [
      { name: "Machine Words", keys: "", time: 7,
        pool: ["cpu", "ram", "chip", "wire", "volt", "watt", "byte", "pixel", "robot", "sensor", "circuit", "battery"], count: 10 },
      { name: "Paint with Hex", keys: "#", time: 9, lesson: "hex",
        pool: [{ a: "#ff0000", code: true, swatch: "#ff0000" }, { a: "#00ff00", code: true, swatch: "#00ff00" },
               { a: "#0000ff", code: true, swatch: "#0000ff" }, { a: "#ffd34d", code: true, swatch: "#ffd34d" },
               { a: "#00ff99", code: true, swatch: "#00ff99" }, { a: "#ff00ff", code: true, swatch: "#ff00ff" }], count: 6 },
      { name: "Robot Language", keys: "", time: 8, lesson: "binary",
        pool: ["0101", "1010", "1100", "0011",
               { d: "🔢 0001 = ?", a: "1", think: 6 }, { d: "🔢 0010 = ?", a: "2", think: 6 },
               { d: "🔢 0100 = ?", a: "4", think: 6 }, { d: "🔢 0101 = ?", a: "5", think: 7 },
               { d: "🔢 0110 = ?", a: "6", think: 7 }, { d: "🔢 1000 = ?", a: "8", think: 7 }], count: 9 },
      { name: "Logic Gates", keys: "", time: 7, lesson: "logic",
        pool: [{ d: "true AND true = ?", a: "true", think: 6 }, { d: "true AND false = ?", a: "false", think: 7 },
               { d: "false OR true = ?", a: "true", think: 7 }, { d: "false OR false = ?", a: "false", think: 7 },
               { d: "NOT true = ?", a: "false", think: 6 }, { d: "NOT false = ?", a: "true", think: 6 },
               { d: "true AND false = ?", a: "false", think: 7 }], count: 7 },
      { name: "Secret Wires", keys: "_/", time: 9,
        pool: [{ a: "img/zapdos.png", code: true }, { a: "save/slot_1.json", code: true },
               { a: "plant/gen_2/coil", code: true }, { a: "data/power_on.txt", code: true },
               { a: "img/pikachu.png", code: true }, { a: "code/main_loop.js", code: true }], count: 6 },
      { name: "Addresses", keys: "@", time: 9,
        pool: [{ a: "dex.poke.com", code: true }, { a: "ash@pallet.town", code: true },
               { a: "oak@lab.kanto", code: true }, { a: "wiki.poke.com", code: true },
               { a: "misty@gym.cerulean", code: true }, { a: "shop.poke.com", code: true }], count: 6 },
      { name: "Cipher Lab", keys: "", time: 9, lesson: "cipher",
        pool: [{ d: "🔐 shift back 1: dbu", a: "cat", think: 8 }, { d: "🔐 shift back 1: eph", a: "dog", think: 8 },
               { d: "🔐 shift back 1: tvo", a: "sun", think: 8 }, { d: "🔐 shift back 1: cju", a: "bit", think: 8 },
               { d: "🔐 shift back 1: dpef", a: "code", think: 9 }], count: 5 },
      { name: "Boot Sequence", keys: ":[]", time: 9,
        pool: [{ a: "boot: ok", code: true, out: "booting..." }, { a: "load [ok]", code: true, out: "loaded!" },
               { a: "power: on", code: true, out: "⚡ ONLINE" }, { a: "fans [3/3]", code: true, out: "cooling" },
               { a: "check: pass", code: true, out: "all good" }, { a: "start [go]", code: true, out: "running!" }], count: 6 },
    ],
    bossPool: [{ d: "🔢 0111 = ?", a: "7", think: 7 }, { d: "true AND true = ?", a: "true", think: 6 },
               { d: "🔢 1001 = ?", a: "9", think: 7 }, { d: "🔐 shift back 1: abqept", a: "zapdos", think: 9 },
               { d: "NOT false = ?", a: "true", think: 6 }, { a: "power: on", code: true, out: "⚡" },
               { d: "🔢 1010 = ?", a: "10", think: 7 }, { d: "false OR true = ?", a: "true", think: 7 },
               { a: "reboot [go]", code: true, out: "ONLINE!" }, { d: "🔢 0011 = ?", a: "3", think: 7 },
               { a: "zapdos: free", code: true, out: "⚡⚡⚡" }],
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
  [ // 6 — Gimmighoul Coast (math)
    { n: "Meowth", e: "🐱", id: 52, r: 1 }, { n: "Skwovet", e: "🐿️", id: 819, r: 1 }, { n: "Numel", e: "🐫", id: 322, r: 1 },
    { n: "Chingling", e: "🔔", id: 433, r: 1 }, { n: "Sableye", e: "💎", id: 302, r: 2 }, { n: "Carbink", e: "💍", id: 703, r: 2 },
    { n: "Gimmighoul", e: "🪙", id: 999, r: 3 }, { n: "Mawile", e: "🪤", id: 303, r: 2 },
    { n: "Persian", e: "🐈", id: 53, r: 2, evoOnly: true }, { n: "Greedent", e: "🐿️", id: 820, r: 2, evoOnly: true },
    { n: "Camerupt", e: "🌋", id: 323, r: 2, evoOnly: true }, { n: "Chimecho", e: "🎐", id: 358, r: 2, evoOnly: true },
    { n: "Gholdengo", e: "🪙", id: 1000, r: 4, evoOnly: true }, { n: "Luvdisc", e: "💗", id: 370, r: 1 },
    { n: "Smeargle", e: "🎨", id: 235, r: 2 }, { n: "Chatot", e: "🎵", id: 441, r: 1 },
  ],
  [ // 7 — Circuit Town (coding)
    { n: "Porygon", e: "🖥️", id: 137, r: 2 }, { n: "Rotom", e: "🔌", id: 479, r: 2 }, { n: "Joltik", e: "🕷️", id: 595, r: 1 },
    { n: "Grubbin", e: "🐛", id: 736, r: 1 }, { n: "Beldum", e: "🔩", id: 374, r: 2 }, { n: "Blipbug", e: "🐞", id: 824, r: 1 },
    { n: "Trubbish", e: "🗑️", id: 568, r: 1 }, { n: "Varoom", e: "🛵", id: 965, r: 2 },
    { n: "Porygon2", e: "🖲️", id: 233, r: 2, evoOnly: true }, { n: "PorygonZ", e: "🤖", id: 474, r: 3, evoOnly: true },
    { n: "Galvantula", e: "🕸️", id: 596, r: 2, evoOnly: true }, { n: "Charjabug", e: "🔋", id: 737, r: 2, evoOnly: true },
    { n: "Vikavolt", e: "🪲", id: 738, r: 3, evoOnly: true }, { n: "Metang", e: "🛠️", id: 375, r: 2, evoOnly: true },
    { n: "Genesect", e: "🤖", id: 649, r: 3 }, { n: "Magearna", e: "⚙️", id: 801, r: 3 },
  ],
  [ // 8 — Old Power Plant (computer science)
    { n: "Magnemite", e: "🧲", id: 81, r: 1 }, { n: "Voltorb", e: "🔴", id: 100, r: 1 }, { n: "Klink", e: "⚙️", id: 599, r: 1 },
    { n: "Elekid", e: "🔌", id: 239, r: 1 }, { n: "Bronzor", e: "🪞", id: 436, r: 2 }, { n: "Togedemaru", e: "⚡", id: 777, r: 2 },
    { n: "Helioptile", e: "🦎", id: 694, r: 1 }, { n: "Plusle", e: "➕", id: 311, r: 2 },
    { n: "Magneton", e: "🧲", id: 82, r: 2, evoOnly: true }, { n: "Magnezone", e: "🛸", id: 462, r: 3, evoOnly: true },
    { n: "Electrode", e: "🔴", id: 101, r: 2, evoOnly: true }, { n: "Klang", e: "⚙️", id: 600, r: 2, evoOnly: true },
    { n: "Klinklang", e: "⚙️", id: 601, r: 3, evoOnly: true }, { n: "Electivire", e: "⚡", id: 466, r: 3, evoOnly: true },
    { n: "Bronzong", e: "🔔", id: 437, r: 2, evoOnly: true }, { n: "Zapdos", e: "⚡", id: 145, r: 4 },
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
  { base: "6-0", chain: ["6-8"] },                          // Meowth → Persian
  { base: "6-1", chain: ["6-9"] },                          // Skwovet → Greedent
  { base: "6-2", chain: ["6-10"] },                         // Numel → Camerupt
  { base: "6-3", chain: ["6-11"] },                         // Chingling → Chimecho
  { base: "6-6", chain: ["6-12"], coins: 30 },              // Gimmighoul → Gholdengo (30 coins!)
  { base: "7-0", chain: ["7-8", "7-9"] },                   // Porygon → Porygon2 → PorygonZ
  { base: "7-2", chain: ["7-10"] },                         // Joltik → Galvantula
  { base: "7-3", chain: ["7-11", "7-12"] },                 // Grubbin → Charjabug → Vikavolt
  { base: "7-4", chain: ["7-13"] },                         // Beldum → Metang
  { base: "8-0", chain: ["8-8", "8-9"] },                   // Magnemite → Magneton → Magnezone
  { base: "8-1", chain: ["8-10"] },                         // Voltorb → Electrode
  { base: "8-2", chain: ["8-11", "8-12"] },                 // Klink → Klang → Klinklang
  { base: "8-3", chain: ["8-13"] },                         // Elekid → Electivire
  { base: "8-4", chain: ["8-14"] },                         // Bronzor → Bronzong
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
    id: "journal",
    icon: "📔",
    title: "The Professor's Journal",
    when: S => (S.state.counters.levelsFinished || 0) >= 1,
    pages: [
      "I've started a <b>Journal</b> for you, Trainer! It tracks two new things.",
      "The 📋 <b>Daily Drill</b>: one special run a day at the podium near the Trainer School, with surprise rules — finish it for XP and a 🎟 <b>candy voucher</b> (spend vouchers on any family in the Pokedex!).",
      "And 🔬 <b>Research Tasks</b>: three missions each week that fill up as you play. Each one earns a <b>stamp</b> — collect stamps to unlock new trainer outfits!",
    ],
    spotlight: [
      { nav: "journal", sel: "#jr-daily", text: "The Daily Drill: today's special rules live here." },
      { sel: "#jr-research", text: "This week's research — claim rewards when a mission fills up!" },
    ],
  },
  {
    id: "bands",
    icon: "🎚",
    title: "Set your challenge level",
    when: S => (S.state.counters.levelsFinished || 0) >= 3,
    pages: [
      "Every trainer is different — so you can set how hard the words are, up at the top!",
      "🌱 <b>Explorer</b> has shorter words and extra time. ⚡ <b>Trainer</b> is the classic. 👑 <b>Ace</b> gets longer words, tougher bosses and <b>+15% XP</b>.",
      "Tap the challenge button any time to switch — great for sharing with a younger or older player. Stars count the same at every level!",
    ],
    spotlight: [
      { nav: "map", sel: "#band-btn", text: "Set your challenge here — easier or harder words for your age. Tap any time." },
    ],
  },
  {
    id: "elite",
    icon: "⚔️",
    title: "A challenge from the Elite Four",
    when: S => S.stageStars(HALL_W, WORLDS[HALL_W].levels.length) > 0 && S.medalPoints() >= ELITE_NEED_MEDALS,
    pages: [
      "Word travels fast, Champion-in-waiting. The <b>Elite Four</b> have seen your medals... and they're waiting.",
      "Four masters, back to back, sharing ONE pool of hearts — and then a final opponent I won't spoil. 😏",
      "When you're ready, the challenge waits in your 📔 Journal. Make the whole island proud!",
    ],
    spotlight: [
      { nav: "journal", sel: "#jr-elite", text: "The Elite Four await — challenge them from here!" },
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

// ---- Skill bands: content difficulty, orthogonal to the time-based
// difficulty. Band = what you face; Difficulty = how fast you must be. ----
const BANDS = {
  explorer: { label: "Explorer", e: "🌱", time: 1.2, bossHp: -2, xp: 1,
              desc: "Shorter words, calmer pace" },
  trainer:  { label: "Trainer", e: "⚡", time: 1, bossHp: 0, xp: 1,
              desc: "The classic adventure" },
  ace:      { label: "Ace", e: "👑", time: 1, bossHp: 2, xp: 1.15,
              desc: "Longer words, tougher bosses, +15% XP" },
};
const BAND_ORDER = ["explorer", "trainer", "ace"];

// filter a story pool for a band; never returns fewer than `count` prompts
function bandPool(pool, band, count) {
  let p;
  if (band === "explorer") p = pool.filter(x => x.length <= 4);
  else if (band === "ace") p = pool.filter(x => x.length >= 5);
  else return pool;
  if (p.length >= Math.min(count, 4)) return p;
  // not enough words in range: take the closest-length ones instead
  const sorted = pool.slice().sort((a, b) =>
    band === "explorer" ? a.length - b.length : b.length - a.length);
  return sorted.slice(0, Math.max(4, Math.ceil(pool.length / 2)));
}

// ---- Professor's Daily Drill: one seeded run a day, two mutators ----
const DAILY_MUTATORS = [
  { id: "lights", e: "🥷", name: "Lights Out", desc: "Keyboard guide hidden — type by feel! +50% XP", xp: 1.5 },
  { id: "weakkey", e: "🎯", name: "Weak Key Day", desc: "Words full of YOUR trickiest keys" },
  { id: "long", e: "🐍", name: "Long Words", desc: "Only the big ones today" },
  { id: "caps", e: "🔠", name: "Capital Day", desc: "Every word starts with a capital", needHall: true },
  { id: "flawless", e: "💎", name: "Flawless", desc: "Missed words come back for another go" },
  { id: "turbo", e: "🌀", name: "Turbo Taste", desc: "A little less time on the clock", time: 0.85 },
];

// ---- Professor's Research: three tasks a week, progress from normal play ----
const RESEARCH_TASKS = [
  { id: "levels5", counter: "levelsFinished", need: 5, e: "🗺️", text: "Finish 5 levels" },
  { id: "perfect1", counter: "perfectLevels", need: 1, e: "💯", text: "Win a level with 100% accuracy" },
  { id: "ninja1", counter: "ninjaClears", need: 1, e: "🥷", text: "Clear a level in Ninja Mode" },
  { id: "wild2", counter: "wildCatches", need: 2, e: "🌿", text: "Catch 2 Pokemon in the wild" },
  { id: "fish1", counter: "fishCatches", need: 1, e: "🎣", text: "Catch a Pokemon by fishing" },
  { id: "hatch1", counter: "hatches", need: 1, e: "🥚", text: "Hatch a Mystery Egg" },
  { id: "evolve1", counter: "evolutions", need: 1, e: "🧬", text: "Evolve a Pokemon" },
  { id: "record1", counter: "records", need: 1, e: "⏱", text: "Set a new Trainer School record" },
  { id: "daily2", counter: "dailies", need: 2, e: "📋", text: "Finish 2 Daily Drills" },
];

// ---- The Elite Four & the Champion (entry: story done + 9 medal points) ----
const ELITE_NEED_MEDALS = 9;
const ELITE = [
  { name: "Home-Row Hana", e: "🌸", aceId: 702, aceE: "🐹", worlds: [0, 1], hp: 10, time: 4.6,
    taunt: "Welcome, challenger! My Dedenne and I never leave home row... or lose!" },
  { name: "Cave Sage", e: "⛰️", aceId: 95, aceE: "🪨", worlds: [1, 2], hp: 10, time: 4.3,
    taunt: "I trained in the deepest caves. Show me your foundation!" },
  { name: "Dragon Duchess", e: "🐉", aceId: 149, aceE: "🐲", worlds: [3, 4], hp: 11, time: 4.1,
    taunt: "My dragons devour slow fingers. Type like a storm!" },
  { name: "The Glitch Heir", e: "👾", aceId: 474, aceE: "🤖", worlds: [5], hp: 11, time: 3.9,
    taunt: "MissingNo taught me everything. I live between the pixels!" },
  { name: "The Champion", e: "🏆", champion: true, worlds: [0, 1, 2, 3, 4, 5], hp: 12,
    taunt: "I've watched every battle you ever typed. I AM you... but faster!" },
];

// dex keys of water Pokemon that can be hooked at fishing spots
const WATER_POKEMON = ["0-0", "0-5", "3-0", "3-1", "3-2", "3-3", "4-2", "5-0", "6-13"];

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
  { id: "champion", e: "🏆", name: "CHAMPION", desc: "Defeat the Elite Four and the Champion" },
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
