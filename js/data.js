// ============================================================
// TypeQuest — game data: curriculum, worlds, creatures, trophies
// Curriculum: home row first, then reaching up/down, then words,
// phrases, and finally capitals + sentences. Every word in a world
// only uses keys that have been taught by that point.
// ============================================================

const AVATARS = ["🦊", "🐱", "🐉", "🥷", "⚡", "⚽", "🦖", "🐼", "🦁", "🚀"];

const TITLES = [
  [1, "Rookie"], [3, "Trainer"], [5, "Block Miner"], [7, "Striker"],
  [9, "Super Typer"], [12, "Slayer"], [15, "Champion"], [18, "Key Master"], [22, "Typing Legend"],
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
    name: "Pixel Meadow",
    tagline: "Learn the home row and catch your first creatures!",
    emoji: "🌳",
    gradient: ["#123c26", "#2e7d4f"],
    accent: "#7ee787",
    targets: ["🦊", "🐰", "🐍", "🦌", "🐿️", "🐐", "🕊️", "🐺"],
    projectile: "🔴",
    hitText: ["Gotcha!", "Caught!", "Nice!", "Wow!"],
    sceneEmojis: ["🌸", "🌿", "🍄", "🦋"],
    boss: { name: "Grumpy Bear", emoji: "🐻", hp: 9, time: 5.5, taunt: "Grrr! Nobody types in MY meadow!" },
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
    name: "Blocky Caves",
    tagline: "Mine blocks with your new keys: E I R U!",
    emoji: "⛏️",
    gradient: ["#2a2440", "#52447e"],
    accent: "#b39df1",
    targets: ["🪨", "🟫", "🧱", "💎", "🟪", "⬜"],
    projectile: "⛏️",
    hitText: ["Mined!", "Block get!", "Crafted!", "Diamond!"],
    sceneEmojis: ["💎", "🕯️", "🪨", "🦇"],
    boss: { name: "Cave Golem", emoji: "🗿", hp: 10, time: 5, taunt: "I am made of stone. You cannot beat me!" },
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
    name: "Champion Stadium",
    tagline: "Score goals with T O W N G H!",
    emoji: "⚽",
    gradient: ["#0c3d2e", "#1e7d5c"],
    accent: "#5dff9d",
    targets: ["🥅", "🥅", "🧤", "🥅"],
    projectile: "⚽",
    hitText: ["GOOOAL!", "Top corner!", "What a shot!", "Screamer!"],
    sceneEmojis: ["🏟️", "📣", "🎉", "⚽"],
    boss: { name: "Robo Keeper", emoji: "🤖", hp: 10, time: 4.5, taunt: "Beep boop. NO goals allowed!" },
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
    name: "Dragon Peaks",
    tagline: "Power up with M P Y B and unleash energy blasts!",
    emoji: "🐉",
    gradient: ["#4a1d10", "#a4461c"],
    accent: "#ffb454",
    targets: ["🌪️", "🪨", "🔥", "👊"],
    projectile: "💥",
    hitText: ["KA-BOOM!", "Power up!", "MEGA HIT!", "Over 9000!"],
    sceneEmojis: ["⛰️", "🔥", "☁️", "⚡"],
    boss: { name: "Shadow Dragon", emoji: "🐲", hp: 11, time: 4.5, taunt: "My power level is OVER 9000!" },
    levels: [
      { name: "M and P", keys: "mp", time: 4.5,
        pool: ["m", "p", "map", "mop", "team", "jump", "lamp", "pump", "more", "time", "game", "make",
               "poem", "stamp", "metal", "item", "palm", "damp", "romp"], count: 12 },
      { name: "Y and B", keys: "yb", time: 4.5,
        pool: ["y", "b", "by", "my", "boy", "buy", "baby", "body", "yes", "yet", "year", "blue", "bye",
               "berry", "happy", "maybe", "money", "funny", "burst", "yellow"], count: 12 },
      { name: "Power Up", keys: "", time: 4.5,
        pool: ["power", "blast", "super", "mega", "beam", "fury", "jump", "fly", "energy", "mighty",
               "storm", "flame", "thunder", "monkey", "golden", "dragon", "warrior", "fireball",
               "power up", "mega blast"], count: 12 },
      { name: "Epic Phrases", keys: "", time: 4.5,
        pool: ["the dragon roars", "power up now", "we are strong", "feel the power", "jump higher",
               "mega dragon mode", "the storm is here", "golden warrior", "energy beam",
               "super dragon fist", "the mighty hero", "blast the storm"], count: 10 },
      { name: "Speed Run", keys: "", time: 3,
        pool: ["up", "my", "by", "yes", "map", "jump", "mega", "beam", "fly", "blue", "bomb", "palm",
               "pump", "my team", "big jump", "go mega"], count: 14 },
    ],
    bossPool: ["power", "blast", "super", "mega beam", "dragon fist", "energy", "thunder", "golden fury",
               "mighty storm", "fireball", "power up", "warrior"],
  },
  {
    name: "Demon Forest",
    tagline: "Master the last letters: C V X Z Q. Total focus!",
    emoji: "⚔️",
    gradient: ["#1c1030", "#5e1f3d"],
    accent: "#ff6e9c",
    targets: ["👺", "🧟", "👻", "🦇"],
    projectile: "🗡️",
    hitText: ["Slash!", "Demon down!", "Full focus!", "Breathe!"],
    sceneEmojis: ["🌑", "🎋", "🏮", "🌫️"],
    boss: { name: "Oni King", emoji: "👹", hp: 12, time: 4, taunt: "No slayer has EVER defeated me!" },
    levels: [
      { name: "C and V", keys: "cv", time: 4.5,
        pool: ["c", "v", "cave", "cut", "cool", "nice", "voice", "very", "give", "love", "have",
               "cover", "victory", "brave", "crush", "catch", "kick", "score", "civic"], count: 12 },
      { name: "X Z and Q", keys: "xzq", time: 4.5,
        pool: ["x", "z", "q", "box", "fox", "six", "zoo", "zap", "zoom", "quiz", "quick", "quest",
               "exact", "extra", "zigzag", "queen", "squad", "prize", "zero", "sixty"], count: 12 },
      { name: "Slayer Training", keys: "", time: 4,
        pool: ["blade", "slash", "demon", "water", "breath", "quick", "crush", "voice", "focus", "calm",
               "sword", "shadow", "silent", "strike", "courage", "thunder breath", "water blade",
               "flame slash", "quick attack", "stay calm"], count: 12 },
      { name: "Final Forms", keys: "", time: 4,
        pool: ["the silent blade", "cut the shadow", "breathe and focus", "never look back",
               "the demon runs away", "full focus mode", "water dragon slash", "quick as thunder",
               "brave and calm", "the blade of light"], count: 10 },
      { name: "Speed Run", keys: "", time: 2.8,
        pool: ["cut", "zap", "box", "fox", "mix", "zoom", "quick", "quiz", "jazz", "quest", "blaze",
               "craze", "pixel", "vivid", "squad", "crazy"], count: 14 },
    ],
    bossPool: ["slash", "blade", "demon", "quick strike", "water blade", "thunder breath", "focus",
               "courage", "silent blade", "crush", "victory", "final slash"],
  },
  {
    name: "Key Master Arena",
    tagline: "Capital letters and full sentences. The final test!",
    emoji: "👑",
    gradient: ["#241a4f", "#8a6d1d"],
    accent: "#ffd34d",
    targets: ["👾", "🤖", "🛸"],
    projectile: "⭐",
    hitText: ["Legendary!", "Critical hit!", "Masterful!", "Incredible!"],
    sceneEmojis: ["🏆", "✨", "👑", "🎆"],
    boss: { name: "The Glitch King", emoji: "👾", hp: 10, time: 4, taunt: "I corrupted the keyboard. The world is MINE!" },
    levels: [
      { name: "Big Letters", keys: "", time: 4.5,
        pool: ["Max", "Leo", "Kai", "Rex", "Sam", "Ace", "Zoe", "Sky", "Max and Leo", "Kai the Brave",
               "Queen Zoe", "King Rex"], count: 10 },
      { name: "Sentences", keys: "", time: 4,
        pool: ["The sun is hot.", "I like my team.", "We won the game.", "My dog is fast.",
               "The cat can jump.", "I am a super typer."], count: 6 },
      { name: "Hero Lines", keys: "", time: 4,
        pool: ["The dragon flies high.", "I will catch them all.", "Never give up.",
               "Train hard every day.", "The hero saves the day.", "Power comes from focus."], count: 6 },
      { name: "Master Lines", keys: "", time: 4,
        pool: ["Practice makes perfect.", "Type like the wind.", "Speed comes from calm focus.",
               "A true master never stops learning.", "The quick brown fox jumps over the lazy dog."], count: 5 },
      { name: "Speed Run", keys: "", time: 3,
        pool: ["Go.", "Win.", "Jump.", "Run fast.", "Type fast.", "I am quick.", "We are champions.",
               "Catch the dragon.", "Be brave.", "Stay calm."], count: 10 },
    ],
    bossPool: ["I am the Glitch King.", "You cannot type fast.", "My power is unlimited.",
               "The keyboard obeys me.", "You are too fast for me.", "No. Not my glitches.",
               "You type like a master.", "The crown is yours now.", "Long live the Key Master.", "GG"],
  },
];

// 8 catchable creatures per world. Names only use keys taught in that world.
// r: rarity 1 common, 2 rare, 3 epic, 4 legendary
const CREATURES = [
  [
    { n: "Flaka", e: "🦊", r: 1 }, { n: "Salsa", e: "🐍", r: 1 }, { n: "Laska", e: "🐰", r: 1 },
    { n: "Skaff", e: "🐿️", r: 1 }, { n: "Dalla", e: "🦌", r: 2 }, { n: "Fjall", e: "🐐", r: 2 },
    { n: "Jakal", e: "🐺", r: 2 }, { n: "Alka", e: "🕊️", r: 3 },
  ],
  [
    { n: "Kira", e: "🐱", r: 1 }, { n: "Slider", e: "🦎", r: 1 }, { n: "Jellie", e: "🪼", r: 1 },
    { n: "Riddle", e: "🦝", r: 1 }, { n: "Ursa", e: "🐻", r: 2 }, { n: "Firefur", e: "🦁", r: 2 },
    { n: "Skarr", e: "🦅", r: 2 }, { n: "Drake", e: "🐲", r: 3 },
  ],
  [
    { n: "Hoot", e: "🦉", r: 1 }, { n: "Otter", e: "🦦", r: 1 }, { n: "Shello", e: "🐢", r: 1 },
    { n: "Tango", e: "🦩", r: 1 }, { n: "Night", e: "🦇", r: 2 }, { n: "Stinger", e: "🦂", r: 2 },
    { n: "Growl", e: "🐯", r: 2 }, { n: "Goalio", e: "🐸", r: 3 },
  ],
  [
    { n: "Boomer", e: "🐗", r: 1 }, { n: "Bolt", e: "🐎", r: 1 }, { n: "Mambo", e: "🦜", r: 1 },
    { n: "Puma", e: "🐆", r: 1 }, { n: "Pyro", e: "🦎", r: 2 }, { n: "Yeti", e: "🦍", r: 2 },
    { n: "Mysti", e: "🦄", r: 2 }, { n: "Magma", e: "🦖", r: 3 },
  ],
  [
    { n: "Cobra", e: "🐍", r: 1 }, { n: "Vixen", e: "🦊", r: 1 }, { n: "Echo", e: "🔮", r: 1 },
    { n: "Zigzag", e: "⚡", r: 1 }, { n: "Quartz", e: "💎", r: 2 }, { n: "Zephyr", e: "👻", r: 2 },
    { n: "Vexor", e: "👺", r: 2 }, { n: "Crusher", e: "🦈", r: 3 },
  ],
  [
    { n: "King Leo", e: "🦁", r: 2 }, { n: "Queen Zoe", e: "🐈‍⬛", r: 2 }, { n: "Sir Pounce", e: "🐯", r: 2 },
    { n: "Doctor Hoot", e: "🦉", r: 2 }, { n: "Captain Blaze", e: "🔥", r: 3 }, { n: "Lord Drago", e: "🐉", r: 3 },
    { n: "Champ Rex", e: "🦖", r: 3 }, { n: "Master Key", e: "🗝️", r: 4 },
  ],
];

const RARITY = {
  1: { label: "Common", color: "#9aa3d0" },
  2: { label: "Rare", color: "#4dc3ff" },
  3: { label: "Epic", color: "#c77bff" },
  4: { label: "LEGENDARY", color: "#ffd34d" },
};

const TROPHIES = [
  { id: "first-level", e: "👣", name: "First Steps", desc: "Finish your first level" },
  { id: "first-catch", e: "🎯", name: "First Catch", desc: "Catch your first creature" },
  { id: "combo-10", e: "🔥", name: "On Fire", desc: "Reach a 10 combo" },
  { id: "combo-25", e: "⚡", name: "Super Mode", desc: "Reach a 25 combo" },
  { id: "combo-50", e: "🌟", name: "Unstoppable", desc: "Reach a 50 combo" },
  { id: "wpm-15", e: "🚲", name: "Quick Fingers", desc: "Type 15 WPM in a level" },
  { id: "wpm-25", e: "🏎️", name: "Speed Machine", desc: "Type 25 WPM in a level" },
  { id: "wpm-35", e: "🚀", name: "Rocket Hands", desc: "Type 35 WPM in a level" },
  { id: "perfect", e: "💯", name: "Perfect!", desc: "Finish a level with 100% accuracy" },
  { id: "ninja", e: "🥷", name: "Keyboard Ninja", desc: "Beat a level in Ninja Mode (hidden keyboard)" },
  { id: "collect-10", e: "📦", name: "Collector", desc: "Catch 10 creatures" },
  { id: "collect-25", e: "🧺", name: "Big Collector", desc: "Catch 25 creatures" },
  { id: "collect-all", e: "👑", name: "Caught Them All", desc: "Catch all 48 creatures" },
  { id: "shiny", e: "✨", name: "Shiny Hunter", desc: "Catch a shiny creature" },
  { id: "streak-3", e: "📅", name: "Hat Trick", desc: "Play 3 days in a row" },
  { id: "streak-7", e: "🗓️", name: "Legend Week", desc: "Play 7 days in a row" },
  { id: "boss-0", e: "🏆", name: "Meadow Champion", desc: "Defeat Grumpy Bear" },
  { id: "boss-1", e: "🏆", name: "Cave Champion", desc: "Defeat the Cave Golem" },
  { id: "boss-2", e: "🏆", name: "Stadium Champion", desc: "Defeat the Robo Keeper" },
  { id: "boss-3", e: "🏆", name: "Peak Champion", desc: "Defeat the Shadow Dragon" },
  { id: "boss-4", e: "🏆", name: "Forest Champion", desc: "Defeat the Oni King" },
  { id: "boss-5", e: "🏆", name: "KEY MASTER", desc: "Defeat the Glitch King" },
];

const ENCOURAGE = [
  "You almost had it!", "So close! Try again!", "Every master was once a beginner!",
  "Your fingers are getting stronger!", "One more try — you got this!",
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
