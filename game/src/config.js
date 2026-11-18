// Tuning and palette for Nightwick: every number a designer would want to touch lives here,
// so the rules of the game are readable in one place. The scene is drawn at a fixed virtual
// size and letterboxed to the window, which keeps the arena and the artwork consistent.

export const VIEW = { w: 1280, h: 800 };

export const SCENE = { zoom: 1.15 };

export const WORLD = {
  cx: 640,
  cy: 434,
  radius: 296, // the chalk ring the keeper may not leave
};

export const PALETTE = {
  void: '#05080b',
  night: '#080c11',
  ground: '#0e161d',
  groundLit: '#1b2833',
  chalk: '#8a7a63',
  chalkDim: '#4a4238',
  ink: '#04080c',
  inkSoft: '#0d151d',
  paper: '#f3e7d3',
  paperDim: '#b9ab94',
  ember: '#ffb45c',
  flame: '#ffe3b0',
  deep: '#ff7a2f',
  blood: '#e2564a',
  shadeTint: '#a99bc9',
  oil: '#ffcd7a',
  oilEmpty: '#5d4a34',
};

export const PLAYER = {
  radius: 13,
  accel: 2400,
  maxSpeed: 200,
  drag: 8.5,
  invulnOnHit: 1.7,
  hitKnockback: 260,
};

export const BEAM = {
  halfAngle: 0.40, // radians, so a ~46 degree cone
  range: 306,
  dps: 44,
  falloffNear: 0.55, // fraction of range under which damage is full
  falloffFar: 0.35, // damage multiplier at max range
  push: 128,
  oilDrain: 27,
  oilRegen: 15,
  regenDelay: 0.34,
  sputterOil: 4, // below this the beam stutters
};

export const FLARE = {
  cost: 34,
  radius: 152,
  damage: 70,
  cooldown: 0.7,
  knockback: 330,
  invuln: 0.3,
};

export const OIL = { max: 100, start: 100 };

export const WICKS = { start: 3, max: 5 };

export const WAVES = [
  { name: 'First Ink', spawns: [['moth', 5]], trickle: 0.85, note: 'They come to the flame.' },
  { name: 'Flutter', spawns: [['moth', 9]], trickle: 0.62, note: 'Hold the beam. Let it drink.' },
  { name: 'Spit and Soot', spawns: [['moth', 7], ['spitter', 1]], trickle: 0.7, note: 'Something watches from the edge.' },
  { name: 'Grubwork', spawns: [['grub', 3], ['moth', 5]], trickle: 0.9, note: 'Armour is only patience.' },
  { name: 'The Eater', spawns: [['eater', 1], ['moth', 4]], trickle: 1.1, note: 'It is hungry for the lantern.' },
  { name: 'Cold Company', spawns: [['shade', 3], ['spitter', 2]], trickle: 1.0, note: 'Light barely touches the shades.' },
  { name: 'Long Night', spawns: [['grub', 3], ['moth', 8], ['shade', 2]], trickle: 0.7, note: 'Breathe. Then burn.' },
  { name: 'Second Eater', spawns: [['eater', 1], ['grub', 3], ['spitter', 2]], trickle: 1.0, note: 'Two hungers answer one flame.' },
  { name: 'The Pressing Dark', spawns: [['moth', 12], ['shade', 3], ['spitter', 2]], trickle: 0.55, note: 'Do not stand still.' },
  { name: 'Last Wick', spawns: [['eater', 2], ['grub', 3], ['moth', 8]], trickle: 0.9, note: 'Hold until morning.' },
];

export const ENEMIES = {
  moth: {
    hp: 13,
    radius: 13,
    speed: 162,
    score: 10,
    damage: 1,
    color: '#0a1016',
    accent: '#2b3a45',
    drops: 1,
    name: 'Moth',
  },
  grub: {
    hp: 50,
    radius: 22,
    speed: 82,
    score: 25,
    damage: 1,
    armor: 0.55,
    color: '#0b1218',
    accent: '#33424e',
    drops: 2,
    name: 'Grub',
  },
  spitter: {
    hp: 30,
    radius: 17,
    speed: 100,
    score: 40,
    damage: 1,
    color: '#0a1218',
    accent: '#3c4b58',
    drops: 2,
    name: 'Spitter',
    ranged: true,
    fireEvery: 2.3,
    keepAway: 190,
  },
  shade: {
    hp: 26,
    radius: 15,
    speed: 168,
    score: 60,
    damage: 1,
    armor: 0.2,
    color: '#141224',
    accent: '#a99bc9',
    drops: 2,
    name: 'Shade',
  },
  eater: {
    hp: 430,
    radius: 42,
    speed: 62,
    score: 200,
    damage: 1,
    armor: 0.75,
    drainOil: 26,
    color: '#080d12',
    accent: '#4a3a2c',
    drops: 0,
    name: 'Wick-Eater',
    boss: true,
    spawnEvery: 4.2,
  },
};

export const COMBO = { window: 3.2, step: 0.1, max: 5 };

export const UPGRADES = [
  { id: 'wide', name: 'Wider Shade', note: 'The cone opens like a hand.', apply: (s) => { s.beam.halfAngle *= 1.16; } },
  { id: 'bright', name: 'Brighter Wick', note: 'The flame bites deeper.', apply: (s) => { s.beam.dps *= 1.22; } },
  { id: 'thrifty', name: 'Thrifty Oil', note: 'The same light, less spent.', apply: (s) => { s.beam.oilDrain *= 0.8; } },
  { id: 'reach', name: 'Long Reach', note: 'The beam carries farther.', apply: (s) => { s.beam.range *= 1.14; } },
  { id: 'wick', name: 'New Wick', note: 'One more try at the dark.', apply: (s) => { s.maxWicks = Math.min(WICKS.max, s.maxWicks + 1); s.wicks = s.maxWicks; } },
  { id: 'flare', name: 'Flare Root', note: 'A bigger bloom when you spend it.', apply: (s) => { s.flare.radius *= 1.25; s.flare.damage *= 1.2; } },
  { id: 'magnet', name: 'Ember Draw', note: 'Embers find you from farther.', apply: (s) => { s.pickupRadius *= 1.5; } },
  { id: 'speed', name: 'Quick Boots', note: 'A keeper who can run.', apply: (s) => { s.playerSpeed *= 1.12; } },
  { id: 'fastflare', name: 'Snap Flame', note: 'Flare comes back sooner, costs less.', apply: (s) => { s.flare.cooldown *= 0.6; s.flare.cost *= 0.8; } },
  { id: 'thick', name: 'Thick Oil', note: 'A fuller flask of light.', apply: (s) => { s.oil.max = Math.round(s.oil.max * 1.18); s.oil.value = s.oil.max; } },
  { id: 'hush', name: 'Hush', note: 'The dark moves slower near your light.', apply: (s) => { s.hush += 0.12; } },
  { id: 'spark', name: 'Spark Coat', note: 'Touching ink costs it dear.', apply: (s) => { s.thorns += 22; } },
];

export const SHOTS = {
  play: { wave: 4, score: 4180, combo: 7, oil: 62, wicks: 2 },
  start: {},
  upgrade: { wave: 5, score: 6120, cards: ['wick', 'bright', 'magnet'] },
  dawn: { score: 18960, wave: 10, bestCombo: 34, time: 402 },
};
