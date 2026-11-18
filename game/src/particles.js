// Particles and floating words: embers that drift up from the flame, ink that splashes when
// something dies, sparks where the beam bites, and the small rising numbers that tell the
// player what a kill was worth. Everything is a plain object in a capped array.

import { TAU, withAlpha } from './util.js';
import { PALETTE } from './config.js';

const MAX = 900;

export class Particles {
  constructor(rng) {
    this.rng = rng;
    this.items = [];
    this.words = [];
  }

  spawn(opts) {
    if (this.items.length >= MAX) this.items.shift();
    this.items.push({
      x: opts.x,
      y: opts.y,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      life: opts.life ?? 1,
      maxLife: opts.life ?? 1,
      size: opts.size ?? 2,
      drag: opts.drag ?? 1.6,
      gravity: opts.gravity ?? 0,
      color: opts.color ?? PALETTE.ember,
      glow: opts.glow ?? true,
      kind: opts.kind ?? 'ember',
      spin: opts.spin ?? 0,
      angle: opts.angle ?? 0,
    });
  }

  ember(x, y, count = 1, spread = 60, color = PALETTE.ember) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * TAU;
      const s = this.rng() * spread;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 12,
        life: 0.5 + this.rng() * 0.9,
        size: 1.1 + this.rng() * 2.2,
        color,
        drag: 1.1,
        gravity: -26,
      });
    }
  }

  ink(x, y, count = 6, spread = 90) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * TAU;
      const s = this.rng() * spread;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + this.rng() * 0.6,
        size: 1.5 + this.rng() * 3.4,
        color: '#0b1219',
        drag: 2.4,
        glow: false,
        kind: 'ink',
      });
    }
  }

  spark(x, y, dir, count = 2) {
    for (let i = 0; i < count; i++) {
      const a = dir + (this.rng() - 0.5) * 1.6;
      const s = 70 + this.rng() * 150;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.16 + this.rng() * 0.22,
        size: 1 + this.rng() * 1.6,
        color: this.rng() < 0.3 ? PALETTE.flame : PALETTE.ember,
        drag: 3,
        gravity: -40,
      });
    }
  }

  ring(x, y, radius, color = PALETTE.ember, life = 0.4) {
    this.spawn({ x, y, life, size: radius, color, kind: 'ring', glow: true });
  }

  word(x, y, text, color = PALETTE.paper, size = 15) {
    this.words.push({ x, y, text, color, size, life: 1.1, maxLife: 1.1, vy: -34 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      if (p.kind === 'ring') {
        p.size += dt * 300;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.angle += p.spin * dt;
    }
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.life -= dt;
      w.y += w.vy * dt;
      w.vy *= 0.94;
      if (w.life <= 0) this.words.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.items) {
      const t = p.life / p.maxLife;
      if (p.kind === 'ring') {
        ctx.strokeStyle = withAlpha(p.color, t * 0.5);
        ctx.lineWidth = 2 + t * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
        continue;
      }
      const alpha = p.kind === 'ink' ? t * 0.75 : t;
      const color = withAlpha(p.color, alpha);
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.7), 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.8), 0, TAU);
        ctx.fill();
      }
    }
    for (const w of this.words) {
      const t = w.life / w.maxLife;
      ctx.font = `600 ${w.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = withAlpha(w.color, Math.min(1, t * 1.6));
      ctx.fillText(w.text, w.x, w.y);
    }
    ctx.restore();
  }

  clear() {
    this.items.length = 0;
    this.words.length = 0;
  }
}
