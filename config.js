/* Tapping Legends - ALL balance numbers live here.
   Shared by the browser (guest mode), server.js (accounts) and tests/sim.js.
   Change a number here and both sides use it. */
(function (root) {
  const C = {
    VERSION: 2,
    TIMEZONE: 'Australia/Sydney', // daily quests, streaks and the weekly reset use this clock

    // ---------- TAPPING ----------
    BASE_TAP: 1,              // taps per click before pets
    HOLD_RATE: 6,             // taps per second while holding the mouse
    MAX_TAPS_PER_SEC: 15,     // CPS cap: nobody can click more than this per second (checked by the server)
    TAP_BURST: 15,            // the server never accepts more than this in any 1 second
    COMBO_MAX: 0.25,          // fast tapping gives up to +25%
    GARDEN_CLICKS: 1500,      // clicks to open the Golden Garden
    GARDEN_MULT: 2,

    // ---------- REBIRTH ----------
    REBIRTH_FIRST: 5e5,       // cost of the first rebirth
    REBIRTH_BASE: 1.4e6,      // later rebirths cost REBIRTH_BASE x GROWTH^rebirths (2nd = 4.76M, 3rd = 16M, 4th = 55M, 5th = 187M)
    REBIRTH_GROWTH: 3.4,      // each rebirth costs this many times more...
    REBIRTH_LATE_FROM: 5,     // ...until this many rebirths (all islands open by then)
    REBIRTH_LATE_GROWTH: 1.35, // ...then it only grows this much per rebirth
    REBIRTH_MULT: 0.4,        // +40% taps per rebirth
    BASE_SLOTS: 3,
    SLOTS_PER_REBIRTH: 1,
    MAX_REBIRTH_SLOTS: 4,     // rebirths give at most +4 slots
    AUTOTAP_REBIRTH: 1,       // auto-tapper unlocks after this many rebirths
    AUTOHATCH_REBIRTH: 3,     // auto-hatch unlocks after this many rebirths
    AUTOTAP_RATE: 1,          // auto taps per second (anywhere), before upgrades
    AFK_PAD_RATE: 3,          // auto taps per second while standing on the pad
    AUTOHATCH_EVERY: 3,       // seconds between auto hatches

    // ---------- PETS ----------
    // weight = chance out of 1,000,000.  keep:true = survives rebirth
    RARITIES: [
      { n: 'Common',    c: '#cfd8dc', w: 580000, m: 1 },
      { n: 'Uncommon',  c: '#5be35b', w: 270000, m: 1.8 },
      { n: 'Rare',      c: '#4aa8ff', w: 105000, m: 3.2 },
      { n: 'Epic',      c: '#c25cff', w: 35000,  m: 6 },
      { n: 'Legendary', c: '#ffcc1a', w: 9890,   m: 13 },
      { n: 'Secret',    c: '#ff2e63', w: 100,    m: 24, keep: true },  // 1 in 10,000
      { n: 'Godly',     c: '#fff6c9', w: 10,     m: 40, keep: true }   // 1 in 100,000
    ],
    LUCK_FROM: 2,             // luck boosts rarities from Rare upwards
    LUCK_CAP: 3,

    AREAS: [
      { n: 'Spawn Plains',  rb: 0, cost: 0,      egg: 'Basic Egg',  ec: 700,    b: 1,
        sky: ['#58b8ff', '#d6f0ff'], g: '#6cc04a', side: '#7a5434', tex: 'grass',
        pets: ['Dog', 'Cat', 'Bunny', 'Fox', 'Golden Dragon', 'Shadow Wolf', 'Celestial Lion'],
        e: ['🐶', '🐱', '🐰', '🦊', '🐲', '🐺', '🦁'],
        col: ['#c8915a', '#f0b56b', '#f4f4f4', '#ff8a3d', '#ffcc33', '#5a4a9a', '#fff2b3'] },
      { n: 'Candy Meadow',  rb: 0, cost: 30000,  egg: 'Candy Egg',  ec: 7000,   b: 7,
        sky: ['#ff9ad5', '#ffe6f5'], g: '#ff9fd0', side: '#c46a9c', tex: 'candy',
        pets: ['Gummy', 'Cupcake', 'Unicorn', 'Jelly Bear', 'Sugar Phoenix', 'Cotton Kraken', 'Candy Queen'],
        e: ['🍬', '🧁', '🦄', '🧸', '🐤', '🐙', '👑'],
        col: ['#ff5d8f', '#ffb3d1', '#f7e8ff', '#ff9a3d', '#ffd84a', '#ff7ac8', '#ffe0f4'] },
      { n: 'Dusty Desert',  rb: 1, cost: 3e5,    egg: 'Cactus Egg', ec: 70000,  b: 45,
        sky: ['#ffb347', '#ffecc2'], g: '#ecc878', side: '#a87c3c', tex: 'sand',
        pets: ['Scorpion', 'Camel', 'Sand Cat', 'Mummy', 'Sun Pharaoh', 'Mirage Sphinx', 'Desert Djinn'],
        e: ['🦂', '🐫', '🐈', '🧟', '☀️', '🗿', '🧞'],
        col: ['#b5651d', '#d9a35c', '#e8c48a', '#e6dcc0', '#ffcf3f', '#8ad7ff', '#4a7dff'] },
      { n: 'Magma Volcano', rb: 2, cost: 3e6,    egg: 'Magma Egg',  ec: 6e5,    b: 380,
        sky: ['#3c0d0d', '#ff7a2a'], g: '#5a4646', side: '#2e2222', tex: 'rock',
        pets: ['Ember', 'Lava Slime', 'Fire Imp', 'Magma Golem', 'Inferno Drake', 'Obsidian Hydra', 'Volcano God'],
        e: ['🔥', '🫠', '😈', '🗿', '🐉', '🐍', '🌋'],
        col: ['#ff6a00', '#ff3d1f', '#d42a5a', '#6b4a3a', '#ff2a00', '#4a3a6a', '#ffb000'] },
      { n: 'Space Station', rb: 3, cost: 3e7,    egg: 'Galaxy Egg', ec: 6e6,  b: 3200,
        sky: ['#04041a', '#2a1a6e'], g: '#9aa6c0', side: '#4d5570', tex: 'metal',
        pets: ['Alien', 'Robot', 'Comet', 'Black Hole', 'Cosmic Titan', 'Void Walker', 'Galaxy Emperor'],
        e: ['👽', '🤖', '☄️', '🌀', '🪐', '🌑', '🌌'],
        col: ['#7dff6a', '#b8c4d6', '#7ad7ff', '#2a1a4a', '#c08aff', '#3a2a70', '#ff7af0'] }
    ],

    // Secret/Godly abilities. Same-type abilities do NOT stack (only the best one counts),
    // so trading for lots of them never gets out of hand.
    ABILITIES: {
      'Shadow Wolf':    { k: 'speed',  v: 0.10, d: '+10% walk speed' },
      'Celestial Lion': { k: 'tap',    v: 0.12, d: '+12% taps' },
      'Cotton Kraken':  { k: 'luck',   v: 0.08, d: '+8% luck' },
      'Candy Queen':    { k: 'luck',   v: 0.15, d: '+15% luck' },
      'Mirage Sphinx':  { k: 'gem',    v: 0.15, d: '15% chance of a bonus gem from pickups' },
      'Desert Djinn':   { k: 'gem',    v: 0.25, d: '25% chance of a bonus gem from pickups' },
      'Obsidian Hydra': { k: 'frenzy', v: 0.25, d: '+25% taps during Frenzy' },
      'Volcano God':    { k: 'boss',   v: 5,    d: '+5 gems when a boss is beaten' },
      'Void Walker':    { k: 'hatch',  v: 0.15, d: 'Auto-hatch 15% faster' },
      'Galaxy Emperor': { k: 'tap',    v: 0.15, d: '+15% taps' }
    },

    // ---------- GEMS (hard to get on purpose) ----------
    GEM_PICKUP: 1,            // gems per pickup
    GEM_PICKUP_CAP_HOUR: 0,   // max gems per hour from pickups (0 = no limit)
    GEM_RESPAWN: 150,         // seconds before a pickup comes back (per player)
    OBBY_GEMS: 15, OBBY_GEM_COOLDOWN: 900, OBBY_MIN_SECONDS: 40, OBBY_TAP_REWARD: 800,
    CHEST_COOLDOWN: 600, CHEST_GEMS: 2, CHEST_TAP_REWARD: 150,
    WHEEL_COOLDOWN: 120,
    WHEEL: [ // [chance %, prize]  t = taps (x per-tap value), g = gems
      [45, { t: 20 }], [30, { t: 50 }], [15, { t: 120 }], [6, { t: 400 }], [3, { g: 3 }], [1, { t: 1000 }]
    ],
    ROCK_COOLDOWN: 20, ROCK_TAP_REWARD: 30,
    LAVA_TAP_REWARD: 2,       // per second in the lava zone

    // ---------- GEM SHOP ----------
    SHOP: [
      { id: 'tap',     n: 'Tap Power',       d: '+10% taps per level',              max: 10, cost: 30, grow: 1.55, ico: '👆' },
      { id: 'luck',    n: 'Lucky Charm',     d: '+6% better egg odds per level',    max: 5,  cost: 50, grow: 1.6,  ico: '🍀' },
      { id: 'speed',   n: 'Swift Shoes',     d: '+6% walk speed per level',         max: 5,  cost: 20, grow: 1.5,  ico: '👟' },
      { id: 'magnet',  n: 'Gem Magnet',      d: 'Grab gems from further away',      max: 3,  cost: 25, grow: 1.6,  ico: '🧲' },
      { id: 'autotap', n: 'Auto-Tap Turbo',  d: '+1 auto tap per second per level', max: 4,  cost: 40, grow: 1.7,  ico: '⚙️', rb: 1 },
      { id: 'slot',    n: '+1 Pet Slot',     d: 'Equip one more pet. Permanent.',   max: 2,  costs: [750, 1500],   ico: '🐾' }
    ],
    BOOSTS: [
      { id: 'x2',    n: '2x Taps',     d: 'Double taps for 10 minutes',        cost: 35, secs: 600, ico: '⚡' },
      { id: 'luck',  n: 'Super Luck',  d: '+50% luck for 10 minutes',          cost: 30, secs: 600, ico: '🌈' },
      { id: 'speed', n: 'Sugar Rush',  d: '+30% walk speed for 10 minutes',    cost: 10, secs: 600, ico: '🍭' }
    ],
    BOOST_MAX_SECS: 3600,

    // ---------- EVENTS (minute of the hour, server clock) ----------
    EVENT_SECS: 180,
    FRENZY_MINUTES: [0, 20, 40],
    BOSS_MINUTES: [10, 30, 50],
    LUCKY_MINUTES: [15, 45],
    FRENZY_MULT: 2,
    LUCKY_MULT: 2,            // multiplies luck during Lucky Eggs

    BOSS_HP: 1000,            // total clicks from everyone
    BOSS_RANGE: 26,           // you must be this close to the boss for clicks to count
    BOSS_MIN_HITS: 25,        // minimum hits to earn the win reward
    BOSS_WIN_GEMS: 12, BOSS_WIN_TAPS: 300,
    BOSS_FAIL_MIN_HITS: 10, BOSS_FAIL_GEMS: 2, BOSS_FAIL_TAPS: 60,
    BOSS_POS: [0, 0, 24],

    // ---------- DAILY ----------
    STREAK_GEMS: [2, 3, 4, 5, 6, 8, 10], // day 1..7+, taps reward = gems * 100 * per-tap
    QUESTS: [
      { id: 'tap',   n: 'Tap {g} times',            g: [800, 1500, 2500], gems: 3 },
      { id: 'hatch', n: 'Hatch {g} eggs',           g: [10, 20, 35],      gems: 4 },
      { id: 'gem',   n: 'Collect {g} gem pickups',  g: [4, 6, 8],         gems: 3 },
      { id: 'boss',  n: 'Hit the boss {g} times',   g: [40, 80, 120],     gems: 5 },
      { id: 'obby',  n: 'Clear the obby',           g: [1, 1, 1],         gems: 5 },
      { id: 'wheel', n: 'Spin the Lucky Wheel {g} times', g: [2, 3, 4],  gems: 3 },
      { id: 'chest', n: 'Open the treasure chest',  g: [1, 1, 1],         gems: 2 }
    ],
    QUESTS_PER_DAY: 3,
    QUEST_TAP_REWARD: 80,     // x per-tap value

    // ---------- WEEKLY LEADERBOARD ----------
    WEEKLY_REWARDS: [50, 30, 15], // gems for 1st, 2nd, 3rd

    // ---------- CHARACTER LOOKS ----------
    LOOK: {
      skin:  ['#f5cd2f', '#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#a8e6a1', '#9fd3ff'],
      shirt: ['#2f7de1', '#e13b3b', '#2fb34a', '#f5a623', '#9b51e0', '#ff6fae', '#1abc9c', '#333a4a', '#ffffff', '#ffd84a', '#ff7a2a', '#5ec8ff'],
      pants: ['#2a3d66', '#3a3a3a', '#5a3a20', '#1f5f2f', '#6b2b6b', '#c0c0c0', '#14284b', '#7a1a1a', '#e8e0c8', '#2b6f8a'],
      hats: [{ id: 'none', n: 'None', ico: '🚫' }, { id: 'cap', n: 'Cap', ico: '🧢' }, { id: 'crown', n: 'Crown', ico: '👑' }, { id: 'tophat', n: 'Top Hat', ico: '🎩' },
             { id: 'phones', n: 'Headphones', ico: '🎧' }, { id: 'halo', n: 'Halo', ico: '😇' }, { id: 'helmet', n: 'Space Helmet', ico: '🧑‍🚀', moon: true }]
    },

    // ---------- TITLES (earned from achievements, shown under your name) ----------
    // stat = a number in your save; need = how much of it you need
    TITLES: [
      { id: 'rookie',  n: 'Rookie',        stat: 'clicks',    need: 0,     d: 'Everyone starts here' },
      { id: 'tapper',  n: 'Tap Machine',   stat: 'clicks',    need: 20000, d: 'Click 20,000 times' },
      { id: 'egg',     n: 'Egg Goblin',    stat: 'hatched',   need: 300,   d: 'Hatch 300 eggs' },
      { id: 'titan',   n: 'Titan Slayer',  stat: 'bossWins',  need: 5,     d: 'Beat the Tap Titan 5 times' },
      { id: 'obby',    n: 'Obby Legend',   stat: 'obbies',    need: 10,    d: 'Clear the obby 10 times' },
      { id: 'reborn',  n: 'Reborn',        stat: 'rb',        need: 3,     d: 'Rebirth 3 times' },
      { id: 'hoard',   n: 'Gem Hoarder',   stat: 'gemsTotal', need: 500,   d: 'Earn 500 gems' },
      { id: 'secret',  n: 'Secret Keeper', stat: 'secrets',   need: 1,     d: 'Hatch a Secret pet' },
      { id: 'moon',    n: 'Moonwalker',    stat: 'rocketN',   need: 1,     d: 'Buy the rocket' },
      { id: 'shiny',   n: 'Shiny Hunter',  stat: 'shinies',   need: 1,     d: 'Fuse a Shiny pet' },
      { id: 'meteor',  n: 'Star Catcher',  stat: 'meteors',   need: 100,   d: 'Catch 100 meteors' },
      { id: 'collect', n: 'Collector',     stat: 'worlds',    need: 3,     d: 'Complete 3 pet collections' }
    ],

    // ---------- EMOTES (G key) ----------
    EMOTES: [{ id: 'wave', n: 'Wave', ico: '👋' }, { id: 'dance', n: 'Dance', ico: '💃' }, { id: 'flex', n: 'Flex', ico: '💪' }, { id: 'tap', n: 'Tap Spam', ico: '👆' }],

    // ---------- PET INDEX + PETS ----------
    INDEX_BONUS: 0.05,        // +5% taps for every finished world collection (Common..Legendary)
    PET_FETCH_RANGE: 8,       // your best pet fetches gem pickups this close to you

    // ---------- ROCKET + NEBULA MOON ----------
    ROCKET_RB: 5,             // rebirths needed to buy the rocket
    ROCKET_TAPS: 6e8,         // taps it costs (about the 6th rebirth). One-time, kept forever
    MOON: {
      GRAVITY: 0.38,          // fraction of normal gravity
      EGGS: [
        { n: 'Moon Egg',   cost: 220, b: 6000,
          pets: ['Moon Bunny', 'Crater Pup', 'Orbit Owl', 'Luna Lynx', 'Eclipse Dragon', 'Void Jelly', 'Moon King'],
          e: ['🐇', '🐕', '🦉', '🐆', '🐲', '🪼', '🤴'], col: ['#d8d0f0', '#b8b0d0', '#9a8cff', '#7ad7ff', '#4a3aa8', '#ff6af0', '#fff2b3'] },
        { n: 'Nebula Egg', cost: 1100, b: 20000,
          pets: ['Star Snail', 'Nebula Fox', 'Cosmo Cat', 'Pulsar Whale', 'Supernova Phoenix', 'Quasar Kraken', 'Nebula Overlord'],
          e: ['🐌', '🦊', '🐈', '🐋', '🐦‍🔥', '🦑', '🌠'], col: ['#ff9ad5', '#ff7a3a', '#c08aff', '#3ad7ff', '#ff3d6e', '#7a2aff', '#ffffff'] }
      ],
      METEOR_EVERY: 150,      // a meteor shower starts every this many seconds...
      METEOR_SECS: 45,        // ...and lasts this long
      METEORS: 14,            // meteors per shower
      METEOR_FALL: 4,         // seconds a meteor takes to fall
      CATCH_R: 2.4,           // stand this close to where it lands to catch it
      METEOR_DUST: 3,         // stardust per meteor (before upgrades)
      DUST_PICKUP: 2, DUST_RESPAWN: 120,
      OBBY_DUST: 45, OBBY_REPEAT_DUST: 8, OBBY_COOLDOWN: 600, OBBY_MIN_SECONDS: 50,
      SHOP: [
        { id: 'jump',   n: 'Moon Boots',     d: '+10% jump height per level (moon only)', max: 5, cost: 40,  grow: 1.6, ico: '🥾' },
        { id: 'magnet', n: 'Meteor Magnet',  d: 'Catch meteors from further away',        max: 3, cost: 60,  grow: 1.7, ico: '🧲' },
        { id: 'dust',   n: 'Stardust Scoop', d: '+1 Stardust per meteor per level',       max: 5, cost: 50,  grow: 1.6, ico: '🥄' },
        { id: 'helmet', n: 'Space Helmet',   d: 'A hat for your character (cosmetic)',    max: 1, cost: 150, grow: 1,   ico: '🧑‍🚀' }
      ],
      FUSE_COUNT: 5,          // same pets needed to make a Shiny
      SHINY_MULT: 2,          // Shiny power
      FUEL_QUEST: { goal: 30, gems: 6, dust: 20 } // daily "rocket fuel" quest once you own the rocket
    },

    // ---------- WORLD ----------
    GEMS_SPOTS: null // filled by logic.js (shared positions)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.TL_CONFIG = C;
})(typeof self !== 'undefined' ? self : this);
