// ============================================================
// TypeQuest — shared type shapes for // @ts-check
//
// This is a *global* (non-module) ambient declaration file: it has no
// import/export, so every interface below is visible to all the script-tag
// JS files without importing anything. It carries only DATA shapes.
//
// The cross-file globals themselves (SAVE, Engine, Puzzle, UI, SFX, Maker,
// Tutorial, and the data.js consts) are NOT redeclared here — jsconfig.json
// includes every js/*.js file, so TypeScript reads each `const Foo = {…}`
// from its own source and infers the real object shape. That means a typo
// like `SFX.correct()` or `UI.showResluts()` fails the check against the
// actual audio.js / ui.js surface, with zero hand-maintained duplication.
// ============================================================

/** A creature's fixed catalog entry (one cell of the CREATURES[world][i] grid). */
interface Creature {
  /** display name */
  n: string;
  /** emoji fallback glyph */
  e: string;
  /** national dex number (drives the sprite url) */
  id: number;
  /** rarity: 1 common · 2 rare · 3 epic · 4 legendary */
  r: number;
  /** only obtainable by evolving, never caught in the wild */
  evoOnly?: boolean;
  /** only obtainable as a Puzzle Lab reward */
  puzzle?: boolean;
}

/** A creature enriched with its runtime location/ownership (creatureByKey, wildPick, …). */
interface CaughtCreature extends Creature {
  w: number;
  i: number;
  key?: string;
  shiny?: boolean;
  duplicate?: boolean;
  spot?: number;
}

/** Who the kid is: name, avatar and a customizable trainer look. */
interface Profile {
  name: string;
  avatar: string;
  trainer?: Trainer | null;
}

/** The trainer-builder wardrobe selection (see TRAINER_OPTS / defaultTrainer). */
interface Trainer {
  body?: string;
  hair?: string;
  hairColor?: string;
  outfit?: string;
  hat?: string;
  [part: string]: string | undefined;
}

/** A Story Typing personal best (SAVE.state.paragraphs[id]). */
interface ParagraphRec {
  wpm?: number;
  acc?: number;
  /** per-word pace of the best run, for the Story Ghost */
  ghost?: number[];
}

/** A Puzzle Lab per-stage record (SAVE.state.puzzle[stageId]). */
interface PuzzleRec {
  stars?: number;
  caught?: boolean;
  bestBlocks?: number;
}

/** Per-player persisted state — the shape returned by SAVE.defaults(). */
interface PlayerState {
  v: number;
  profile: Profile | null;
  tutorialDone: boolean;
  xp: number;
  /** "w-s" -> best stars */
  stages: Record<string, number>;
  /** "w-i" -> { shiny } */
  dex: Record<string, { shiny?: boolean } | undefined>;
  /** base "w-i" -> candy count */
  candy: Record<string, number>;
  egg: { date: string; progress: number; boost?: boolean } | null;
  eggDate: string | null;
  /** up to 6 dex keys; first is the lead partner */
  party: string[];
  roamer: { week: string; done: boolean } | null;
  /** tier id -> best run record */
  practice: Record<string, any>;
  wordPacks: Array<{ id: string; name: string; words: string[] }>;
  makerStages: any[];
  /** world index -> best rematch tier (1 silver, 2 gold) */
  rematch: Record<string, number>;
  /** story id -> personal best */
  paragraphs: Record<string, ParagraphRec>;
  /** Puzzle Lab: stageId -> record. Also stores a `_speed` number under an
   *  underscore key (see puzzleSpeed) — that one slot is cast at its use site. */
  puzzle: Record<string, PuzzleRec>;
  flags: Record<string, any>;
  trophies: Record<string, boolean>;
  settings: { sound: boolean; hints: boolean; difficulty: string };
  /** `tokens` (Pokemon-Center rest tokens) and `best` accrue lazily, guarded by `|| 0`. */
  streak: { last: string | null; count: number; tokens?: number; best?: number };
  stats: {
    keys: number;
    correct: number;
    bestWpm: number;
    bestCombo: number;
    history: any[];
    perKey: Record<string, any>;
    /** lifetime evolution count, added lazily (guarded by `|| 0`) */
    evolutions?: number;
  };
  stageBest: Record<string, { wpm?: number; acc?: number; ninja?: boolean }>;
  counters: Record<string, number>;
  band: string;
  vouchers: number;
  daily: { date: string; done: boolean; mutators: string[] } | null;
  dailyWeek: { week: string; count: number } | null;
  research: { week: string; tasks: Array<{ id: string; base: number; claimed: boolean }> } | null;
  unlocks: { stamps: number };
  day: { date: string; levels?: number; wild?: boolean; school?: boolean; shown?: boolean } | null;
  elite: { bestRound?: number; clears?: number } | null;
  hof: Array<{ date: string; party: any; wpm: number }>;
  diplomas: Record<string, string>;
  tower: { best?: number; climbs?: number } | null;
  /** lazily-created daily wild-encounter bookkeeping (not part of defaults()) */
  wild?: { date: string; grassUsed: string[]; casts: number };
}

/** The multi-player save root persisted under SAVE.KEY. */
interface SaveRoot {
  active: string | null;
  players: Record<string, PlayerState>;
  /** shared Weekly Raid Boss bar (lives on the root, not per-player) */
  raid?: any;
  /** scrambled player blobs set aside by normalizePlayers so nothing is ever
   *  silently deleted (see quarantinePlayer). */
  _quarantine?: Record<string, any>;
}

/** A Puzzle Lab stage definition (one PUZZLE_STAGES entry). Grid stages carry
 *  `grid`; number-line (math) stages carry `line`/`hops`. Variant-specific
 *  fields are optional so one interface covers every stage kind. */
interface Stage {
  id?: string;
  pack?: string;
  chapter?: number;
  name?: string;
  concept?: string;
  /** grid stages: rows of the map ("S" start, "o" goal, "#"/"~" walls) */
  grid?: string[];
  /** number-line stages: the highest cell index */
  line?: number;
  start?: { x: number; y: number; dir: string };
  goal?: string;
  need?: number;
  blocks?: string[];
  optimal?: number;
  budget?: number;
  solution?: any[];
  hints?: string[];
  reward?: { catch?: string };
  logic?: any;
  /** number-line stages: the jump sizes offered */
  hops?: number[];
  /** condition stages compare a berry count rather than a yes/no sensor */
  compare?: boolean;
  /** math stages that frame the goal as division */
  divide?: boolean;
  sensors?: any;
}

/** The live game session (Engine.session). One flat interface with lots of
 *  optional fields: each start*() path lights up a different subset (a raid
 *  run sets `raid`/`raidDealt`, a practice run sets `practice`, etc.). Typing
 *  it this way catches field typos on the always-present core (idx, text,
 *  hearts, combo…) while staying pragmatic about the mode-specific payloads. */
interface Session {
  // Every field is optional: each start*() path lights up a different subset,
  // so an optional-everywhere shape accepts all the literals while still
  // rejecting access to any field name that isn't declared here.
  // --- core, set by every run ---
  state?: string;
  prompts?: any[];
  idx?: number;
  text?: string;
  pos?: number;
  score?: number;
  combo?: number;
  bestCombo?: number;
  hits?: number;
  errors?: number;
  errorsThisPrompt?: number;
  timeouts?: number;
  hearts?: number;
  typingMs?: number;
  promptStart?: number;
  timerMs?: number;
  timerRemaining?: number;
  baseTime?: number;
  band?: string;
  timeScale?: number;
  ninjaEligible?: boolean;
  pendingRes?: any;
  // --- stage runs ---
  w?: number;
  s?: number;
  world?: any;
  isBoss?: boolean;
  partner?: CaughtCreature | null;
  charge?: number;
  partnerReady?: boolean;
  meterOn?: boolean;
  rematch?: any;
  catchCreature?: CaughtCreature | null;
  catchShiny?: boolean;
  requeueMissed?: boolean;
  /** count of missed-word requeues so far (Flawless mutator) */
  requeued?: number;
  forceNinja?: boolean;
  fullKb?: boolean;
  relaxedCatch?: boolean;
  wordTimes?: number[];
  /** custom word-pack run: the pack name shown in the announce */
  packName?: string;
  /** Puzzle Lab catch run: which stage the catch belongs to */
  catchStageId?: string;
  /** Battle Tower: the current floor def */
  towerFloor?: any;
  // --- special modes (each set by its own start*()) ---
  practice?: any;
  paragraph?: any;
  paragraphMode?: boolean;
  license?: any;
  daily?: any;
  elite?: any;
  tower?: any;
  raid?: any;
  raidDealt?: number;
  raidClaim?: any;
  /** set once the raid legendary has been granted at the reveal, so
   *  catchSuccess never adds it a second time */
  raidGranted?: boolean;
  wild?: any;
  hatch?: any;
  evo?: any;
  custom?: any;
  pcatch?: any;
  puzzleCatch?: any;
  ghost?: number[] | null;
  ghostName?: string;
  ghostPid?: string;
  /** set by ui.js during the shiny reveal */
  _shinyRevealed?: boolean;
}
