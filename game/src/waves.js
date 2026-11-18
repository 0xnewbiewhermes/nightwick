// The night's schedule: ten waves, each a list of what comes and how fast it trickles in,
// and the table of upgrades the keeper chooses between when a wave is cleared.

import { UPGRADES, WAVES } from './config.js';
import { shuffle } from './util.js';

export class Waves {
  constructor(game) {
    this.game = game;
    this.index = -1;
    this.queue = [];
    this.spawnTimer = 0;
    this.remaining = 0;
    this.spawned = 0;
    this.total = 0;
    this.running = false;
    this.banner = 0;
    this.bannerName = '';
    this.bannerNote = '';
  }

  get count() {
    return WAVES.length;
  }

  get current() {
    return WAVES[Math.max(0, this.index)];
  }

  begin(index) {
    this.index = index;
    const wave = WAVES[index];
    this.queue = [];
    for (const [type, count] of wave.spawns) {
      for (let i = 0; i < count; i++) this.queue.push(type);
    }
    this.queue = shuffle(this.queue, this.game.rng);
    if (index >= 5) {
      // Later waves are heavier: a few extra moths pad the horde.
      for (let i = 0; i < Math.min(6, Math.floor(index / 2)); i++) this.queue.push('moth');
    }
    this.remaining = this.queue.length;
    this.total = this.queue.length;
    this.spawned = 0;
    this.running = true;
    this.spawnTimer = 0.7;
    this.banner = 2.6;
    this.bannerName = `Wave ${index + 1} — ${wave.name}`;
    this.bannerNote = wave.note;
  }

  update(dt) {
    if (this.banner > 0) this.banner -= dt;
    if (!this.running) return;

    this.spawnTimer -= dt;
    if (this.queue.length > 0 && this.spawnTimer <= 0 && this.game.enemies.length < 26) {
      const type = this.queue.shift();
      this.game.spawnEnemy(type);
      this.spawned++;
      const base = WAVES[this.index].trickle;
      this.spawnTimer = base * (0.55 + this.game.rng() * 0.9);
    }

    if (this.queue.length === 0 && this.game.enemies.length === 0) {
      this.running = false;
      this.game.onWaveCleared(this.index);
    }
  }
}

export function rollUpgrades(game, count = 3) {
  const player = game.player;
  const pool = UPGRADES.filter((u) => {
    if (u.id === 'wick' && player.maxWicks >= 5) return false;
    if (u.id === 'thick' && game.tuning.oil.max > 190) return false;
    return true;
  });
  const picked = shuffle(pool, game.rng).slice(0, count);
  return picked.map((u) => ({ ...u }));
}

export function applyUpgrade(game, upgrade) {
  const t = game.tuning;
  t.maxWicks = game.player.maxWicks;
  t.wicks = game.player.wicks;
  upgrade.apply(t);
  game.player.maxWicks = t.maxWicks;
  game.player.wicks = Math.max(game.player.wicks, t.wicks);
  game.player.oil = Math.min(game.player.oil, t.oil.max);
  game.upgrades.push(upgrade.id);
  game.player.maxOil = t.oil.max;
}
