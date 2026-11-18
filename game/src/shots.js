// Deterministic scenes for the entry's screenshots: ?shot=play and friends build a moment by
// hand — same positions, same score, same light every time — and then freeze the clock so the
// frame can be captured. Nothing here runs in a normal game.

import { PALETTE } from './config.js';
import { Enemy } from './enemies.js';
import { input } from './input.js';
import { makeRng } from './util.js';

function moth(game, x, y, rng) {
  const e = new Enemy('moth', x, y, rng);
  e.age = 1;
  return e;
}

function place(game, type, x, y, hp, rng) {
  const e = new Enemy(type, x, y, rng);
  e.age = 1;
  if (hp !== undefined) e.hp = hp;
  e.burn = 0.6;
  game.enemies.push(e);
  return e;
}

export function setupShot(game, name, seed = 1) {
  const rng = makeRng(seed * 7919 + 13);
  game.rng = rng;
  game.particles.clear();
  game.enemies.length = 0;
  game.globs.length = 0;
  game.pickups.length = 0;
  game.notices.length = 0;
  if (game.decals) game.decals.length = 0;
  game.hurtFlash = 0;
  game.hintAlpha = 0;
  game.time = 0;
  game.combo = 1;
  game.comboTimer = 0;
  game.stats = { kills: 0, bestCombo: 1 };

  if (name === 'start') {
    game.state = 'title';
    game.bestScore = 7410;
    game.bestWave = 10;
    game.player.x = 640;
    game.player.y = 500;
    game.player.aim = -Math.PI / 2;
    game.player.beaming = false;
    game.player.trail = [];
    const spots = [
      [170, 300],
      [1120, 270],
      [190, 640],
      [1110, 660],
    ];
    for (const [x, y] of spots) {
      const m = moth(game, x, y, rng);
      m.burn = 0.55;
      m.vx = 24;
      m.vy = -9;
      game.enemies.push(m);
    }
    for (let i = 0; i < 26; i++) {
      game.particles.spawn({
        x: 200 + rng() * 880,
        y: 200 + rng() * 460,
        vx: rng.range(-16, 16),
        vy: rng.range(-26, -6),
        life: rng.range(0.8, 2.4),
        size: rng.range(1, 2.6),
        color: PALETTE.ember,
        drag: 0.8,
        gravity: -8,
      });
    }
    return;
  }

  if (name === 'play') {
    game.state = 'playing';
    game.time = 173;
    game.score = 4180;
    game.combo = 2.4;
    game.comboTimer = 2.4;
    game.waves.index = 3;
    game.waves.total = 11;
    game.waves.queue = ['moth', 'grub'];
    game.waves.running = true;
    game.waves.banner = 0;
    game.player.x = 556;
    game.player.y = 486;
    game.player.aim = Math.atan2(372 - 486, 766 - 556);
    game.aim = { x: 766, y: 372 };
    input.mouseX = 766;
    input.mouseY = 372;
    game.player.oil = 62;
    game.player.wicks = 2;
    game.player.maxWicks = 3;
    game.player.beaming = true;
    game.player.beamHeat = 1;
    game.player.trail = [];
    for (let i = 0; i < 6; i++) game.player.trail.push({ x: 556 - i * 7, y: 486 + i * 2, a: game.player.aim });

    place(game, 'grub', 766, 372, 38, rng);
    place(game, 'moth', 872, 300, 8, rng);
    place(game, 'moth', 430, 336, 10, rng);
    place(game, 'spitter', 946, 494, 22, rng);
    place(game, 'moth', 352, 566, 9, rng);
    place(game, 'grub', 700, 622, 52, rng);
    place(game, 'shade', 282, 430, 1, rng);
    place(game, 'moth', 476, 302, 11, rng);
    place(game, 'moth', 842, 596, 9, rng);
    place(game, 'grub', 330, 512, 60, rng);
    for (let i = 0; i < 4; i++) {
      game.decals.push({ x: 660 + rng.range(-60, 220), y: 520 + rng.range(-40, 140), r: rng.range(10, 22), seed: rng() * 6 });
    }

    game.globs.push({ x: 906, y: 452, vx: -120, vy: 60, life: 3 });
    for (let i = 0; i < 3; i++) {
      game.pickups.push({ x: 620 + i * 26, y: 610 - i * 14, seed: i * 2.1, oil: 4, life: 9 });
    }

    // Sparks in the beam and embers rising off the burned.
    for (let i = 0; i < 26; i++) {
      const t = rng();
      const d = 70 + t * 250;
      const a = game.player.aim + rng.range(-0.3, 0.3);
      game.particles.spawn({
        x: game.player.x + Math.cos(a) * d,
        y: game.player.y + Math.sin(a) * d,
        vx: Math.cos(a) * rng.range(40, 130),
        vy: Math.sin(a) * rng.range(40, 130) - 30,
        life: rng.range(0.2, 0.7),
        size: rng.range(1, 2.4),
        color: rng() < 0.3 ? PALETTE.flame : PALETTE.ember,
        drag: 2.4,
        gravity: -30,
      });
    }
    for (let i = 0; i < 26; i++) {
      game.particles.spawn({
        x: 700 + rng.range(-60, 90),
        y: 380 + rng.range(-50, 60),
        vx: rng.range(-30, 30),
        vy: rng.range(-70, -20),
        life: rng.range(0.5, 1.4),
        size: rng.range(1, 3),
        color: PALETTE.ember,
        drag: 1.1,
        gravity: -24,
      });
    }
    game.particles.word(880, 330, '+24', PALETTE.ember, 15);
    return;
  }

  if (name === 'upgrade') {
    game.state = 'upgrade';
    game.time = 214;
    game.score = 6120;
    game.waves.index = 4;
    game.waves.total = 9;
    game.waves.queue = [];
    game.waves.running = false;
    game.player.x = 640;
    game.player.y = 470;
    game.player.aim = -Math.PI / 2;
    game.player.oil = 74;
    game.player.beaming = false;
    game.player.wicks = 3;
    game.player.maxWicks = 4;
    game.upgrades = ['bright', 'thrifty', 'wide', 'reach'];
    game.upgradeCards = [
      { id: 'wick', name: 'New Wick', note: 'One more try at the dark.' },
      { id: 'bright', name: 'Brighter Wick', note: 'The flame bites deeper.' },
      { id: 'magnet', name: 'Ember Draw', note: 'Embers find you from farther.' },
    ];
    for (let i = 0; i < 18; i++) {
      game.particles.spawn({
        x: 300 + rng() * 680,
        y: 560 + rng() * 120,
        vx: rng.range(-12, 12),
        vy: rng.range(-24, -8),
        life: rng.range(1, 2.4),
        size: rng.range(1, 2.4),
        color: PALETTE.ember,
        drag: 0.7,
        gravity: -10,
      });
    }
    return;
  }

  if (name === 'dawn') {
    game.state = 'victory';
    game.time = 402;
    game.score = 18960;
    game.stats = { kills: 146, bestCombo: 3.4 };
    game.bestScore = 18960;
    game.bestWave = 10;
    game.waves.index = 9;
    game.waves.total = 20;
    game.waves.queue = [];
    game.player.x = 640;
    game.player.y = 470;
    game.player.aim = -Math.PI / 2;
    game.player.beaming = false;
    for (let i = 0; i < 40; i++) {
      game.particles.spawn({
        x: rng.range(320, 960),
        y: rng.range(340, 620),
        vx: rng.range(-18, 18),
        vy: rng.range(-42, -12),
        life: rng.range(1.2, 3),
        size: rng.range(1, 3),
        color: i % 5 === 0 ? PALETTE.flame : PALETTE.ember,
        drag: 0.6,
        gravity: -10,
      });
    }
    return;
  }
}
