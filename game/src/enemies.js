// The ink: four creatures and one hungry boss, each with a different answer to the lantern.
// An enemy knows how to move, how to take light, and what to leave behind when it dies.

import { ENEMIES, PALETTE, WORLD } from './config.js';
import { TAU, clamp, dist } from './util.js';

let nextId = 1;

export class Enemy {
  constructor(type, x, y, rng) {
    const def = ENEMIES[type];
    this.id = nextId++;
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.radius = def.radius;
    this.dead = false;
    this.hitFlash = 0;
    this.age = 0;
    this.burn = 0;
    this.wobble = rng() * TAU;
    this.wobbleSpeed = 1.4 + rng() * 1.4;
    this.fireTimer = (def.fireEvery ?? 2) * (0.4 + rng() * 0.6);
    this.spawnTimer = (def.spawnEvery ?? 4) * 0.5;
    this.orbit = rng() * TAU;
    this.scale = 1;
    this.deathTimer = 0;
    this.shadePhase = rng() * TAU;
  }

  update(dt, game) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.burn = Math.max(0, this.burn - dt * 2);
    const p = game.player;
    // Moths and shades cut the keeper off instead of trailing behind.
    const lead = this.type === 'moth' || this.type === 'shade' ? 0.22 : 0;
    const dx = p.x + p.vx * lead - this.x;
    const dy = p.y + p.vy * lead - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const hush = 1 - Math.min(0.5, game.tuning.hush) * clamp(1 - d / 280, 0, 1);
    // The ink grows hungrier the longer it is kept waiting, so running from a wave never works.
    const hunger = 1 + Math.min(0.65, this.age * 0.022);
    const speed = this.def.speed * hush * hunger;

    let wx = nx;
    let wy = ny;

    switch (this.type) {
      case 'moth': {
        this.wobble += dt * this.wobbleSpeed;
        const side = Math.sin(this.wobble) * 0.8;
        wx = nx - ny * side;
        wy = ny + nx * side;
        break;
      }
      case 'spitter': {
        const keep = this.def.keepAway;
        if (d > keep + 30) {
          wx = nx;
          wy = ny;
        } else if (d < keep - 30) {
          wx = -nx;
          wy = -ny;
        } else {
          wx = -ny;
          wy = nx;
        }
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && game.state === 'playing') {
          this.fireTimer = this.def.fireEvery * (0.9 + game.rng() * 0.3);
          game.spawnGlob(this.x, this.y, p.x, p.y);
        }
        break;
      }
      case 'shade': {
        this.shadePhase += dt * 3;
        const surge = 1 + Math.sin(this.shadePhase) * 0.25;
        wx = nx * surge;
        wy = ny * surge;
        break;
      }
      case 'eater': {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && game.state === 'playing') {
          this.spawnTimer = this.def.spawnEvery;
          game.spawnMothNear(this.x, this.y);
        }
        if (d < this.radius + p.radius + 8) {
          p.oil = Math.max(0, p.oil - this.def.drainOil * dt);
        }
        break;
      }
      default:
        break;
    }

    const wl = Math.hypot(wx, wy) || 1;
    const targetVx = (wx / wl) * speed * (this.type === 'shade' ? 1 + Math.sin(this.shadePhase) * 0.25 : 1);
    const targetVy = (wy / wl) * speed * (this.type === 'shade' ? 1 + Math.sin(this.shadePhase) * 0.25 : 1);
    const respond = Math.min(1, 7 * dt);
    this.vx += (targetVx - this.vx) * respond;
    this.vy += (targetVy - this.vy) * respond;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Stay inside the ring, and away from the exact centre where the keeper starts.
    const cx = this.x - WORLD.cx;
    const cy = this.y - WORLD.cy;
    const cd = Math.hypot(cx, cy);
    const limit = WORLD.radius + 30;
    if (cd > limit) {
      this.x = WORLD.cx + (cx / cd) * limit;
      this.y = WORLD.cy + (cy / cd) * limit;
    }
  }

  takeDamage(amount, game, source = 'beam') {
    if (this.type === 'shade' && source === 'beam') {
      this.hitFlash = 0.6;
      return false;
    }
    this.hp -= amount;
    this.hitFlash = Math.min(1, this.hitFlash + 0.5);
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      game.onEnemyKilled(this, source);
    }
    return true;
  }
}

export function spawnPointOnRing(rng, margin = 40) {
  const a = rng() * TAU;
  const r = WORLD.radius + 26 + margin * rng();
  return { x: WORLD.cx + Math.cos(a) * r, y: WORLD.cy + Math.sin(a) * r };
}

export { nextId as _enemyId };
