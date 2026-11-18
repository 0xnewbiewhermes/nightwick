// Every pixel of Nightwick: an ink-dark clearing with a chalk ring, fog that drifts across it,
// the keeper's lantern cone thrown in warm light, and the ink creatures drawn as silhouettes
// with a warm rim where the beam finds them. Rendering only; no game rules live here.

import { PALETTE, SCENE, WORLD } from './config.js';
import { TAU, clamp, withAlpha } from './util.js';

const RING_SEGMENTS = 220;

function makeGrain(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 255 * Math.random();
    img.data[i] = v;
    img.data[i + 1] = v * 0.95;
    img.data[i + 2] = v * 0.85;
    img.data[i + 3] = Math.random() * 26;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeMist(size, tint) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, withAlpha(tint, 0.5));
  grd.addColorStop(0.55, withAlpha(tint, 0.18));
  grd.addColorStop(1, withAlpha(tint, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

export class Renderer {
  constructor(rng) {
    this.grain = makeGrain();
    this.mist = [makeMist(420, '#243a4a'), makeMist(520, '#2a2f45'), makeMist(360, '#3a2f26')];
    this.mistLayers = [
      { x: 180, y: 210, sx: 5.2, sy: 3.1, vx: 7, vy: 3, a: 0.5, s: 1.15 },
      { x: 900, y: 560, sx: 4.1, sy: 5.5, vx: -5, vy: 4, a: 0.42, s: 1.35 },
      { x: 640, y: 660, sx: 6.4, sy: 3.4, vx: 4, vy: -3, a: 0.34, s: 1.5 },
      { x: 1080, y: 250, sx: 5.8, sy: 2.6, vx: -6, vy: 5, a: 0.3, s: 1.05 },
    ];
    // Standing stones and dead saplings outside the chalk ring: the place the night happens in.
    this.stones = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * TAU + 0.22 + rng() * 0.12;
      const r = WORLD.radius + 96 + rng() * 120;
      return {
        x: WORLD.cx + Math.cos(a) * r,
        y: WORLD.cy + Math.sin(a) * r * 0.86,
        w: 12 + rng() * 22,
        h: 26 + rng() * 62,
        tilt: (rng() - 0.5) * 0.22,
        a,
      };
    });
    this.saplings = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * TAU + 1.1 + rng() * 0.3;
      const r = WORLD.radius + 60 + rng() * 70;
      return {
        x: WORLD.cx + Math.cos(a) * r,
        y: WORLD.cy + Math.sin(a) * r * 0.9,
        h: 30 + rng() * 40,
        lean: (rng() - 0.5) * 0.5,
        seed: rng() * 100,
      };
    });
    this.dust = Array.from({ length: 90 }, () => ({
      x: rng.range(80, 1200),
      y: rng.range(60, 760),
      r: rng.range(0.5, 2.1),
      vx: rng.range(-7, 7),
      vy: rng.range(-11, -3),
      a: rng.range(0.08, 0.35),
      tw: rng.range(0, TAU),
    }));
    this.ringSeed = Array.from({ length: RING_SEGMENTS + 1 }, (_, i) => ({
      wobble: Math.sin(i * 0.7) * 2.2 + Math.sin(i * 2.3) * 1.1,
      alpha: 0.35 + (Math.sin(i * 3.1) * 0.5 + 0.5) * 0.5,
    }));
  }

  // ---------------------------------------------------------------- background

  draw(scene) {
    const { ctx, game, time } = scene;
    ctx.save();
    ctx.translate(WORLD.cx, WORLD.cy);
    ctx.scale(SCENE.zoom, SCENE.zoom);
    ctx.translate(-WORLD.cx, -WORLD.cy);
    this.drawBackdrop(ctx, game, time);
    this.drawFog(ctx, time);
    this.drawArenaFloor(ctx);
    this.drawScenery(ctx, game.player, time);
    this.drawDust(ctx, scene.dt, time);

    const withKeeper = game.state === 'playing' || game.state === 'paused' || game.state === 'upgrade';
    if (withKeeper) {
      this.drawGroundLight(ctx, game.player, time);
      this.drawBeamHalo(ctx, game.player, time);
    }

    this.drawDecals(ctx, game);
    for (const p of game.pickups) this.drawPickup(ctx, p, time);
    for (const g of game.globs) this.drawGlob(ctx, g);
    for (const e of game.enemies) this.drawEnemy(ctx, e, time, game);
    if (withKeeper) {
      this.drawPlayer(ctx, game.player, time);
    }
    game.particles.draw(ctx);
    if (withKeeper) this.drawBeam(ctx, game.player, time);
    this.drawRing(ctx, time);
    this.drawVignette(ctx);
    if (game.hurtFlash > 0.01) this.drawHurtFlash(ctx, game.hurtFlash);
    if (withKeeper) this.drawCursor(ctx, game.aim, game.player, time);
    ctx.restore();
  }

  // The clearing's furniture: standing stones and dead saplings, kept nearly black so they read
  // as the place the light is in rather than as things to fight.
  drawScenery(ctx, p, time) {
    for (const s of this.saplings) {
      const sway = Math.sin(time * 0.6 + s.seed) * 2.4;
      ctx.strokeStyle = 'rgba(3, 6, 9, 0.92)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + s.lean * 12 + sway, s.y - s.h * 0.55, s.x + s.lean * 26 + sway, s.y - s.h);
      ctx.stroke();
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) {
        const t = 0.45 + i * 0.18;
        const bx = s.x + s.lean * 26 * t * 0.6 + sway * t;
        const by = s.y - s.h * t;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (i % 2 ? 1 : -1) * (10 + s.h * 0.12), by - 8 - i * 3);
        ctx.stroke();
      }
    }

    for (const st of this.stones) {
      const d = Math.hypot(st.x - p.x, st.y - p.y);
      const rimA = clamp(1 - d / 620, 0, 1) * 0.3;
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.tilt);
      ctx.fillStyle = 'rgba(2, 5, 8, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 2, st.w * 0.8, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#05090d';
      ctx.beginPath();
      ctx.moveTo(-st.w / 2, 0);
      ctx.lineTo(-st.w / 2, -st.h * 0.82);
      ctx.quadraticCurveTo(-st.w * 0.18, -st.h * 1.04, st.w * 0.14, -st.h * 0.9);
      ctx.lineTo(st.w / 2, -st.h * 0.72);
      ctx.lineTo(st.w / 2, 0);
      ctx.closePath();
      ctx.fill();
      if (rimA > 0.01) {
        ctx.strokeStyle = withAlpha(PALETTE.ember, rimA);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Ink that has already been spilled stays on the floor for a while.
  drawDecals(ctx, game) {
    if (!game.decals || game.decals.length === 0) return;
    for (const d of game.decals) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.seed);
      ctx.fillStyle = 'rgba(2, 4, 7, 0.42)';
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * TAU + d.seed;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d.r * 0.3, Math.sin(a) * d.r * 0.22, d.r * (0.55 - i * 0.1), d.r * (0.3 - i * 0.05), a, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawHurtFlash(ctx, amount) {
    const g = ctx.createRadialGradient(640, 434, 120, 640, 434, 620);
    g.addColorStop(0, 'rgba(120, 20, 14, 0)');
    g.addColorStop(0.75, `rgba(150, 26, 16, ${0.22 * amount})`);
    g.addColorStop(1, `rgba(190, 34, 20, ${0.5 * amount})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 800);
  }

  drawBackdrop(ctx, game, time) {
    const g = ctx.createRadialGradient(WORLD.cx, WORLD.cy, 60, WORLD.cx, WORLD.cy, 760);
    g.addColorStop(0, '#16232e');
    g.addColorStop(0.45, '#0b141c');
    g.addColorStop(1, '#04070a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 800);

    // A few far-off sparks that never come close.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + time * 0.02;
      const r = 420 + Math.sin(i * 2.7) * 120;
      const x = WORLD.cx + Math.cos(a) * r;
      const y = WORLD.cy + Math.sin(a) * r * 0.7;
      const tw = 0.3 + Math.sin(time * 1.3 + i) * 0.25;
      ctx.fillStyle = withAlpha('#8fa7bd', Math.max(0, tw) * 0.25);
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFog(ctx, time) {
    ctx.save();
    for (let i = 0; i < this.mistLayers.length; i++) {
      const l = this.mistLayers[i];
      const img = this.mist[i % this.mist.length];
      const x = l.x + Math.sin(time * 0.07 + i) * 90 + time * l.vx * 0.4;
      const y = l.y + Math.cos(time * 0.05 + i * 1.7) * 50 + time * l.vy * 0.3;
      ctx.globalAlpha = l.a * 0.55;
      ctx.drawImage(img, x - img.width / 2, y - img.height / 2, img.width * l.s, img.height * l.s);
    }
    ctx.restore();
  }

  drawArenaFloor(ctx) {
    ctx.save();
    // The clearing is lighter than the ink around it, so black silhouettes read at a glance.
    const g = ctx.createRadialGradient(WORLD.cx, WORLD.cy - 20, 10, WORLD.cx, WORLD.cy, WORLD.radius + 70);
    g.addColorStop(0, 'rgba(150, 146, 132, 0.5)');
    g.addColorStop(0.5, 'rgba(92, 94, 92, 0.4)');
    g.addColorStop(0.82, 'rgba(34, 42, 48, 0.26)');
    g.addColorStop(1, 'rgba(8, 13, 18, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(WORLD.cx, WORLD.cy, WORLD.radius + 70, 0, TAU);
    ctx.fill();

    // Ash scratches and old footprints inside the ring.
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#cdc3ad';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + i * 0.37;
      const r0 = 40 + (i * 53) % 190;
      const len = 18 + (i * 31) % 60;
      ctx.beginPath();
      ctx.arc(WORLD.cx, WORLD.cy, r0, a, a + len / Math.max(50, r0));
      ctx.stroke();
    }
    ctx.restore();
  }

  // A pool of lantern light on the floor, the way a lamp actually sits in a room. This is what
  // turns the ink creatures near the keeper into black silhouettes.
  drawGroundLight(ctx, p, time) {
    const flick = 0.9 + Math.sin(time * 7.3) * 0.05 + Math.sin(time * 19.1) * 0.03;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const wide = ctx.createRadialGradient(p.x, p.y + 10, 0, p.x, p.y + 10, 380 * flick);
    wide.addColorStop(0, 'rgba(255, 196, 140, 0.10)');
    wide.addColorStop(0.5, 'rgba(255, 166, 100, 0.05)');
    wide.addColorStop(1, 'rgba(255, 130, 50, 0)');
    ctx.fillStyle = wide;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 380 * flick, 300 * flick, 0, 0, TAU);
    ctx.fill();

    const g = ctx.createRadialGradient(p.x, p.y + 8, 0, p.x, p.y + 8, 250 * flick);
    g.addColorStop(0, 'rgba(255, 214, 164, 0.30)');
    g.addColorStop(0.4, 'rgba(255, 176, 108, 0.17)');
    g.addColorStop(0.75, 'rgba(255, 146, 72, 0.07)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 250 * flick, 190 * flick, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawRing(ctx, time) {
    ctx.save();
    // One chalk circle, drawn in short overlapping strokes so it looks struck by hand.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = withAlpha('#d8bd93', 0.3);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(WORLD.cx, WORLD.cy, WORLD.radius, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#f0dcb6', 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(WORLD.cx, WORLD.cy, WORLD.radius - 4, 0, TAU);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 130; i++) {
      const a = (i / 130) * TAU + 0.01 * Math.sin(i * 5.1);
      const r = WORLD.radius + Math.sin(i * 3.7) * 3.4;
      ctx.fillStyle = withAlpha('#f4e6c8', 0.18 + 0.12 * Math.sin(i * 1.3 + time * 0.8));
      ctx.fillRect(WORLD.cx + Math.cos(a) * r - 1, WORLD.cy + Math.sin(a) * r - 1, 2.4, 2.4);
    }
    ctx.restore();
  }

  drawDust(ctx, dt, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < 40) {
        d.y = 780;
        d.x = 80 + Math.random() * 1120;
      }
      if (d.x < 40) d.x = 1240;
      if (d.x > 1240) d.x = 40;
      const tw = 0.5 + Math.sin(time * 2.2 + d.tw) * 0.5;
      ctx.fillStyle = withAlpha('#ffcf9a', d.a * tw * 0.7);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(640, 400, 240, 640, 400, 760);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.62, 'rgba(2,4,7,0.35)');
    g.addColorStop(1, 'rgba(2,4,6,0.86)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 800);

    if (!this.grainPattern) this.grainPattern = ctx.createPattern(this.grain, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, 1280, 800);
    ctx.restore();
  }

  // ---------------------------------------------------------------- light

  drawBeamHalo(ctx, p, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.82 + Math.sin(time * 9.3) * 0.06 + Math.sin(time * 23.1) * 0.04;
    const radius = (150 + Math.sin(time * 2.1) * 6) * flick;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, 'rgba(255, 214, 158, 0.20)');
    g.addColorStop(0.35, 'rgba(255, 168, 86, 0.10)');
    g.addColorStop(1, 'rgba(255, 130, 50, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawBeam(ctx, p, time) {
    if (!p.beaming) return;
    const half = p.halfAngle ?? 0.4;
    const range = p.range ?? 300;
    const sputter = p.sputter > 0 && p.oil < 6 ? 0.45 + Math.sin(time * 42) * 0.35 : 1;
    if (sputter <= 0.2) return;
    const sprite = this.beamSprite(half, range);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    ctx.globalAlpha = 0.95 * sputter;
    ctx.drawImage(sprite, -4, -this.beamH / 2);
    ctx.globalAlpha = 1;
    ctx.restore();

    // The lantern's mouth, where the light is born.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bulb = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 52 * sputter);
    bulb.addColorStop(0, `rgba(255, 250, 232, ${0.55 * sputter})`);
    bulb.addColorStop(0.3, `rgba(255, 216, 160, ${0.24 * sputter})`);
    bulb.addColorStop(1, 'rgba(255, 150, 70, 0)');
    ctx.fillStyle = bulb;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 52 * sputter, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // The cone is baked once into an offscreen sprite: the wedge stack is what makes its edge
  // soft rather than a drawn triangle, and drawing one image per frame keeps it cheap.
  beamSprite(half, range) {
    const key = `${half.toFixed(3)}|${Math.round(range)}`;
    if (this.beamKey === key) return this.beamImage;
    const H = Math.ceil(range * Math.sin(half * 1.25) * 2 + 30);
    const W = Math.ceil(range) + 12;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const sx = 4;
    const sy = H / 2;
    g.globalCompositeOperation = 'lighter';
    const spread = half * 1.28;
    const N = 150;
    const aw = (spread * 2) / N;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const a = (t * 2 - 1) * spread;
      const edge = Math.abs(t * 2 - 1);
      const profile = Math.pow(Math.cos(Math.min(1, edge * 1.02) * (Math.PI / 2)), 2.6);
      const grad = g.createRadialGradient(sx, sy, 2, sx, sy, range);
      grad.addColorStop(0, `rgba(255, 250, 232, ${0.9 * profile})`);
      grad.addColorStop(0.16, `rgba(255, 230, 188, ${0.62 * profile})`);
      grad.addColorStop(0.5, `rgba(255, 184, 116, ${0.3 * profile})`);
      grad.addColorStop(0.85, `rgba(255, 140, 64, ${0.1 * profile})`);
      grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(sx, sy);
      g.arc(sx, sy, range, a - aw * 0.62, a + aw * 0.62);
      g.closePath();
      g.fill();
    }
    this.beamImage = c;
    this.beamKey = key;
    this.beamH = H;
    return c;
  }

  // ---------------------------------------------------------------- creatures

  drawEnemy(ctx, e, time, game) {
    const t = clamp(e.age / 0.35, 0, 1);
    const scale = (0.35 + t * 0.65) * 1.55;
    ctx.save();
    // A dark halo lifts the silhouette off the lit floor.
    ctx.fillStyle = 'rgba(3, 5, 8, 0.55)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.radius * 0.85, e.radius * 1.15, e.radius * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.translate(e.x, e.y);
    ctx.scale(scale, scale);

    const lit = e.burn > 0.02 || e.hitFlash > 0.02;
    const rim = withAlpha(lit ? PALETTE.flame : e.def.accent, lit ? 0.7 + e.hitFlash * 0.3 : 0.55);

    switch (e.type) {
      case 'moth': {
        const flap = Math.sin(time * 17 + e.wobble) * 0.16;
        const ang = Math.atan2(e.vy, e.vx);
        ctx.rotate(ang + Math.PI / 2);
        ctx.fillStyle = withAlpha(PALETTE.ink, 0.97);
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.3;
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.rotate(s * (0.34 + flap));
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.quadraticCurveTo(s * 17, -15, s * 19, -3);
          ctx.quadraticCurveTo(s * 18, 7, s * 4, 7);
          ctx.quadraticCurveTo(s * 1, 3, 0, -3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#080d12';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.2, 8.4, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = withAlpha(PALETTE.ember, 0.35 + e.hitFlash * 0.5);
        ctx.lineWidth = 1;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 1.4, -7);
          ctx.quadraticCurveTo(s * 5, -13, s * 7, -15);
          ctx.stroke();
        }
        ctx.fillStyle = withAlpha(PALETTE.ember, 0.55 + e.hitFlash * 0.45);
        ctx.beginPath();
        ctx.arc(0, -5, 1.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 'grub': {
        const ang = Math.atan2(e.vy, e.vx);
        ctx.rotate(ang);
        const r = e.radius;
        ctx.fillStyle = withAlpha(PALETTE.ink, 0.97);
        // One body, four humps, then a lit outline and three segment lines.
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.92, r * 0.86, 0, 0, TAU);
        ctx.fill();
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(-i * r * 0.62, Math.sin(time * 6 + i) * 1.2, r * (0.84 - i * 0.1), r * (0.8 - i * 0.1), 0, 0, TAU);
          ctx.fill();
        }
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const cx = -i * r * 0.62;
          ctx.moveTo(cx + Math.cos(-0.55) * r * 0.8, Math.sin(-0.55) * r * 0.8);
          ctx.arc(cx, 0, r * (0.86 - i * 0.08), -0.55, 0.55);
        }
        ctx.stroke();
        ctx.strokeStyle = withAlpha(PALETTE.ember, 0.28);
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-i * r * 0.62 + r * 0.2, -r * 0.6);
          ctx.lineTo(-i * r * 0.62 + r * 0.2, r * 0.6);
          ctx.stroke();
        }
        ctx.fillStyle = withAlpha('#d9c9a8', 0.35);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(3 + i * 4.5, -4 + i * 3.6, 1.5, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'spitter': {
        const charge = clamp(1 - e.fireTimer / (e.def.fireEvery * 0.5), 0, 1);
        ctx.fillStyle = withAlpha(PALETTE.ink, 0.96);
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.radius, e.radius * 0.92, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = withAlpha(e.def.accent, 0.5);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + Math.sin(time * 2 + i) * 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * e.radius * 0.7, Math.sin(a) * e.radius * 0.7);
          ctx.quadraticCurveTo(
            Math.cos(a) * (e.radius + 6),
            Math.sin(a) * (e.radius + 6) + 3,
            Math.cos(a) * (e.radius + 12),
            Math.sin(a) * (e.radius + 4),
          );
          ctx.stroke();
        }
        ctx.fillStyle = withAlpha(charge > 0.6 ? PALETTE.deep : PALETTE.ember, 0.35 + charge * 0.6);
        ctx.beginPath();
        ctx.arc(0, -2, 3.2 + charge * 2.4, 0, TAU);
        ctx.fill();
        break;
      }
      case 'shade': {
        const sway = Math.sin(time * 2.4 + e.shadePhase) * 3;
        const g = ctx.createLinearGradient(0, -26, 0, 26);
        g.addColorStop(0, withAlpha('#0a0a14', 0));
        g.addColorStop(0.35, withAlpha('#12101f', 0.95));
        g.addColorStop(0.75, withAlpha('#0a0a12', 0.9));
        g.addColorStop(1, withAlpha('#0a0a12', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(sway * 0.4, 0, e.radius * 0.95, 26, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = withAlpha(PALETTE.shadeTint, 0.35 + Math.sin(time * 5 + e.shadePhase) * 0.12);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.ellipse(sway * 0.4, 0, e.radius * 0.95, 26, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = withAlpha('#d8d2ef', 0.8);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sway * 0.4 + s * 4.4, -6, 1.5, 2.6, 0, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'eater': {
        const pulse = 1 + Math.sin(time * 2.2) * 0.03;
        ctx.rotate(Math.sin(time * 0.7) * 0.08);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = withAlpha(PALETTE.ink, 0.98);
        ctx.strokeStyle = withAlpha('#6a4a30', 0.7);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const spikes = 11;
        for (let i = 0; i <= spikes; i++) {
          const a = (i / spikes) * TAU;
          const r = e.radius + Math.sin(i * 4.1 + time * 1.6) * 5 + (i % 2 ? 5 : -2);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // An oily core that eats the light.
        const core = ctx.createRadialGradient(0, 0, 2, 0, 0, e.radius * 0.6);
        core.addColorStop(0, 'rgba(255, 150, 70, 0.55)');
        core.addColorStop(0.5, 'rgba(120, 60, 30, 0.35)');
        core.addColorStop(1, 'rgba(20, 12, 8, 0.85)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.62, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = withAlpha('#1a120c', 0.9);
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + time * 0.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * e.radius * 0.6, Math.sin(a) * e.radius * 0.6);
          ctx.quadraticCurveTo(
            Math.cos(a + 0.3) * e.radius * 0.95,
            Math.sin(a + 0.3) * e.radius * 0.95,
            Math.cos(a + 0.15) * (e.radius + 10),
            Math.sin(a + 0.15) * (e.radius + 10),
          );
          ctx.stroke();
        }
        break;
      }
      default:
        break;
    }

    if (e.hitFlash > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = withAlpha(PALETTE.flame, e.hitFlash * 0.22);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 1.25, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (e.type !== 'eater' && e.hp < e.maxHp * 0.55 && e.maxHp > 20) {
      const w = e.radius * 1.5;
      ctx.fillStyle = 'rgba(4, 7, 10, 0.5)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 11, w, 2.6);
      ctx.fillStyle = withAlpha(PALETTE.ember, 0.75);
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 11, w * clamp(e.hp / e.maxHp, 0, 1), 2.6);
    }
  }

  drawPlayer(ctx, p, time) {
    const blink = p.invuln > 0 && Math.sin(time * 30) > 0.2 ? 0.45 : 1;
    ctx.save();
    ctx.globalAlpha = blink;

    // scarf trail
    if (p.trail.length > 2) {
      ctx.strokeStyle = withAlpha('#c0563f', 0.5);
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      p.trail.forEach((t, i) => {
        const x = t.x - Math.cos(t.a) * 9;
        const y = t.y - Math.sin(t.a) * 9 + Math.sin(time * 6 + i) * 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim + Math.PI / 2);
    ctx.scale(1.6, 1.6);

    // cloak
    const cloak = ctx.createLinearGradient(0, -22, 0, 18);
    cloak.addColorStop(0, '#3a4a58');
    cloak.addColorStop(0.45, '#1b2630');
    cloak.addColorStop(1, '#0a1118');
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(14, -11, 13, 8);
    ctx.quadraticCurveTo(6.5, 18, 0, 16);
    ctx.quadraticCurveTo(-6.5, 18, -13, 8);
    ctx.quadraticCurveTo(-14, -11, 0, -18);
    ctx.closePath();
    ctx.fill();

    // The lantern edge of the cloak catches the light.
    ctx.strokeStyle = withAlpha(PALETTE.flame, 0.85);
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(-11.6, 3);
    ctx.quadraticCurveTo(-13.4, -9, 0, -17.4);
    ctx.stroke();

    // hood, open toward the light
    ctx.fillStyle = '#0f1720';
    ctx.beginPath();
    ctx.ellipse(0, -8.5, 7.6, 8.6, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha(PALETTE.ember, 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8.5, 7.6, Math.PI * 0.08, Math.PI * 0.92, true);
    ctx.stroke();

    // lantern held ahead
    ctx.fillStyle = '#4a3520';
    ctx.beginPath();
    ctx.roundRect(-4, -27, 8, 10, 2.4);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#8a6a3f', 0.9);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = withAlpha(PALETTE.flame, 0.98);
    ctx.beginPath();
    ctx.ellipse(0, -22, 3.1, 4.3, 0, 0, TAU);
    ctx.fill();

    ctx.restore();

    // The lantern's own glow, additive.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.75 + Math.sin(time * 11.3) * 0.12 + Math.sin(time * 27.7) * 0.06;
    const gx = p.x + Math.cos(p.aim) * 16;
    const gy = p.y + Math.sin(p.aim) * 16;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 30 * flick);
    g.addColorStop(0, 'rgba(255, 236, 190, 0.85)');
    g.addColorStop(0.4, 'rgba(255, 170, 90, 0.35)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, 30 * flick, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawGlob(ctx, g) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 12);
    grd.addColorStop(0, 'rgba(150, 120, 180, 0.55)');
    grd.addColorStop(0.5, 'rgba(90, 70, 120, 0.22)');
    grd.addColorStop(1, 'rgba(60, 50, 90, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 12, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0c0a16';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 5.2, 0, TAU);
    ctx.fill();
  }

  drawPickup(ctx, p, time) {
    const hover = Math.sin(time * 3 + p.seed) * 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y + hover, 0, p.x, p.y + hover, 14);
    g.addColorStop(0, 'rgba(255, 220, 160, 0.7)');
    g.addColorStop(0.4, 'rgba(255, 160, 80, 0.28)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y + hover, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffdca6';
    ctx.beginPath();
    ctx.arc(p.x, p.y + hover, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawCursor(ctx, aim, p, time) {
    const d = Math.hypot(aim.x - p.x, aim.y - p.y);
    const spread = clamp(d / 320, 0, 1);
    ctx.save();
    ctx.strokeStyle = withAlpha(PALETTE.flame, 0.5);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 9 + spread * 5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = withAlpha(PALETTE.ember, 0.85);
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 1.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha(PALETTE.flame, 0.28);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + time * 0.6;
      ctx.beginPath();
      ctx.moveTo(aim.x + Math.cos(a) * 14, aim.y + Math.sin(a) * 14);
      ctx.lineTo(aim.x + Math.cos(a) * 19, aim.y + Math.sin(a) * 19);
      ctx.stroke();
    }
    ctx.restore();
  }
}
