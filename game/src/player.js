// The keeper: walking, the lantern beam, the flare, oil and wicks. The beam is a cone query
// other systems ask about, so every enemy, projectile and ember is burned by the same rule.

import { BEAM, FLARE, OIL, PALETTE, PLAYER, WORLD } from './config.js';
import { TAU, angleDelta, clamp, dist, lerp } from './util.js';
import { input } from './input.js';
import { sfx } from './audio.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.aim = -Math.PI / 2;
    this.oil = OIL.start;
    this.maxOil = OIL.start;
    this.wicks = 3;
    this.maxWicks = 3;
    this.invuln = 0;
    this.beaming = false;
    this.beamHeat = 0;
    this.flareCd = 0;
    this.regenWait = 0;
    this.sputter = 0;
    this.moving = 0;
    this.trail = [];
    this.aimAssist = 0;
  }

  get active() {
    return this.beaming;
  }

  update(dt, game) {
    const cfg = game.tuning;
    this.range = cfg.beam.range;
    this.halfAngle = cfg.beam.halfAngle;
    this.dps = cfg.beam.dps;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flareCd = Math.max(0, this.flareCd - dt);

    const move = game.moveAxis;
    const accel = PLAYER.accel * (cfg.playerSpeed / PLAYER.maxSpeed);
    this.vx += move.x * accel * dt;
    this.vy += move.y * accel * dt;

    const drag = Math.exp(-PLAYER.drag * dt);
    this.vx *= drag;
    this.vy *= drag;

    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = cfg.playerSpeed;
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // The keeper cannot cross the chalk ring.
    const dx = this.x - WORLD.cx;
    const dy = this.y - WORLD.cy;
    const d = Math.hypot(dx, dy);
    const limit = WORLD.radius - PLAYER.radius - 4;
    if (d > limit) {
      const nx = dx / d;
      const ny = dy / d;
      this.x = WORLD.cx + nx * limit;
      this.y = WORLD.cy + ny * limit;
      const outward = this.vx * nx + this.vy * ny;
      if (outward > 0) {
        this.vx -= outward * nx * 1.4;
        this.vy -= outward * ny * 1.4;
      }
    }

    this.moving = clamp(speed / 120, 0, 1);

    // Aim at the pointer, eased a little so the cone sweeps instead of snapping.
    const target = Math.atan2(game.aim.y - this.y, game.aim.x - this.x);
    const turn = 22 * dt;
    this.aim += clamp(angleDelta(this.aim, target), -turn, turn);

    this.trail.push({ x: this.x, y: this.y, a: this.aim });
    if (this.trail.length > 10) this.trail.shift();

    this.updateBeam(dt, game);
    this.updateFlare(dt, game);
  }

  updateBeam(dt, game) {
    const cfg = game.tuning;
    const wants = game.wantBeam && this.oil > (this.sputter > 0 ? 12 : 0.5);
    this.beaming = wants && game.state === 'playing';

    if (this.beaming) {
      this.oil = Math.max(0, this.oil - cfg.beam.oilDrain * dt);
      this.regenWait = BEAM.regenDelay;
      this.beamHeat = Math.min(1, this.beamHeat + dt * 6);
      this.sputter = this.oil < BEAM.sputterOil ? 1 : 0;
    } else {
      this.beamHeat = Math.max(0, this.beamHeat - dt * 4);
      this.regenWait = Math.max(0, this.regenWait - dt);
      if (this.regenWait <= 0) {
        this.oil = Math.min(cfg.oil.max, this.oil + cfg.beam.oilRegen * dt);
        if (this.oil > 14) this.sputter = 0;
      }
    }
  }

  updateFlare(dt, game) {
    if (!game.wantFlare) return;
    const cfg = game.tuning;
    if (this.flareCd > 0 || this.oil < cfg.flare.cost) {
      if (this.oil < cfg.flare.cost) game.notify('Not enough oil', PALETTE.blood);
      return;
    }
    this.oil -= cfg.flare.cost;
    this.flareCd = cfg.flare.cooldown;
    this.invuln = Math.max(this.invuln, FLARE.invuln);
    game.flareBlast(this.x, this.y, cfg.flare.radius, cfg.flare.damage, cfg.flare.knockback);
    game.particles.ring(this.x, this.y, 18, PALETTE.flame, 0.5);
    game.particles.ring(this.x, this.y, 34, PALETTE.deep, 0.65);
    game.particles.ember(this.x, this.y, 26, 220, PALETTE.ember);
    game.shake(7, 0.28);
    game.hitstop(0.035);
    sfx.flare();
  }

  // The cone query: is this circle inside the lantern light, and how strongly?
  beamFalloff(x, y, radius = 0) {
    if (!this.beaming) return 0;
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    const range = this.range ?? BEAM.range;
    if (d > range + radius) return 0;
    if (d < 1) return 1;
    const angle = Math.atan2(dy, dx);
    const half = (this.halfAngle ?? BEAM.halfAngle) + (radius ? Math.atan2(radius, Math.max(1, d)) : 0);
    if (Math.abs(angleDelta(this.aim, angle)) > half) return 0;
    const t = clamp(d / range, 0, 1);
    const near = BEAM.falloffNear;
    const fall = t < near ? 1 : lerp(1, BEAM.falloffFar, (t - near) / (1 - near));
    return fall;
  }

  hurt(game) {
    if (game.godMode || this.invuln > 0 || game.state !== 'playing') return false;
    this.wicks -= 1;
    this.invuln = PLAYER.invulnOnHit;
    game.combo = 0;
    game.comboTimer = 0;
    game.hurtFlash = 1;
    game.shake(11, 0.5);
    game.hitstop(0.09);
    game.particles.ink(this.x, this.y, 16, 180);
    game.particles.ember(this.x, this.y, 12, 140, PALETTE.blood);
    sfx.hurt();
    if (this.wicks <= 0) game.endRun(false);
    return true;
  }

  drawLantern(ctx, time) {
    // A small brass cradle with a living core.
    const flicker = 0.82 + Math.sin(time * 13.7) * 0.07 + Math.sin(time * 31.3) * 0.04;
    const r = 22 * flicker;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    g.addColorStop(0, 'rgba(255, 236, 196, 0.95)');
    g.addColorStop(0.3, 'rgba(255, 176, 92, 0.5)');
    g.addColorStop(1, 'rgba(255, 122, 47, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
