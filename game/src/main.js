// Nightwick's front door: builds the game state, runs the frame loop, routes input between
// the title, play, the gift choice and the endings, and draws everything in the fixed
// 1280x800 scene. A run is ten waves; survive the tenth and dawn breaks.

import { BEAM, COMBO, FLARE, OIL, PALETTE, PLAYER, SCENE, VIEW, WAVES, WORLD } from './config.js';
import { input, bindInput, clearPressed, keyPressed, moveAxis } from './input.js';
import { Player } from './player.js';
import { Enemy, spawnPointOnRing } from './enemies.js';
import { Waves, applyUpgrade, rollUpgrades } from './waves.js';
import { Particles } from './particles.js';
import { Renderer } from './render.js';
import { drawHud } from './hud.js';
import { drawEnd, drawPause, drawTitle, drawUpgrade, upgradeCardAt } from './screens.js';
import { ensureAudio, setBurn, setDrone, sfx } from './audio.js';
import { makeRng } from './util.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
canvas.width = Math.round(VIEW.w * dpr);
canvas.height = Math.round(VIEW.h * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || 1);
const autoPlay = params.get('auto') === '1';
const speed = Math.max(1, Number(params.get('speed') || 1));
const godMode = params.get('god') === '1';

function defaultTuning() {
  return {
    beam: { halfAngle: BEAM.halfAngle, range: BEAM.range, dps: BEAM.dps, push: BEAM.push, oilDrain: BEAM.oilDrain, oilRegen: BEAM.oilRegen },
    flare: { radius: FLARE.radius, damage: FLARE.damage, cost: FLARE.cost, cooldown: FLARE.cooldown, knockback: FLARE.knockback },
    oil: { max: OIL.max },
    playerSpeed: PLAYER.maxSpeed,
    pickupRadius: 110,
    hush: 0,
    thorns: 0,
    maxWicks: 3,
    wicks: 3,
  };
}

function readBest() {
  try {
    const raw = localStorage.getItem('nightwick.best');
    if (!raw) return { score: 0, wave: 0 };
    const parsed = JSON.parse(raw);
    return { score: Number(parsed.score) || 0, wave: Number(parsed.wave) || 0 };
  } catch {
    return { score: 0, wave: 0 };
  }
}

function writeBest(score, wave) {
  try {
    localStorage.setItem('nightwick.best', JSON.stringify({ score, wave }));
  } catch {
    /* private mode: the run still counts, it just is not remembered */
  }
}

const best = readBest();
const rng = makeRng(Date.now() & 0xffff);
const particles = new Particles(rng);

const game = {
  state: 'title',
  time: 0,
  renderTime: 0,
  score: 0,
  bestScore: best.score,
  bestWave: best.wave,
  combo: 1,
  comboTimer: 0,
  stats: { kills: 0, bestCombo: 1 },
  tuning: defaultTuning(),
  enemies: [],
  globs: [],
  pickups: [],
  notices: [],
  upgrades: [],
  upgradeCards: [],
  hoveredCard: -1,
  hintAlpha: 1,
  frozen: false,
  freezeTimer: 0,
  shakeMag: 0,
  shakeTimer: 0,
  graceBeam: 0,
  aim: { x: VIEW.w / 2, y: 300 },
  moveAxis: { x: 0, y: 0 },
  wantBeam: false,
  wantFlare: false,
  rng,
  particles,
  player: new Player(WORLD.cx, WORLD.cy + 40),
  waves: null,
  godMode,
};

game.waves = new Waves(game);
const renderer = new Renderer(rng);
bindInput(canvas);

// ---------------------------------------------------------------- run control

function startRun() {
  game.tuning = defaultTuning();
  game.particles.clear();
  game.enemies.length = 0;
  game.globs.length = 0;
  game.pickups.length = 0;
  game.notices.length = 0;
  game.upgrades = [];
  game.upgradeCards = [];
  game.hoveredCard = -1;
  game.score = 0;
  game.combo = 1;
  game.comboTimer = 0;
  game.time = 0;
  game.hintAlpha = 1;
  game.stats = { kills: 0, bestCombo: 1 };
  game.freezeTimer = 0;
  game.graceBeam = 0.25;
  game.rng = makeRng((Date.now() & 0xffffff) ^ 0x5f3a1);

  const p = game.player;
  p.x = WORLD.cx;
  p.y = WORLD.cy + 40;
  p.vx = 0;
  p.vy = 0;
  p.aim = -Math.PI / 2;
  p.oil = game.tuning.oil.max;
  p.maxOil = game.tuning.oil.max;
  p.wicks = game.tuning.maxWicks;
  p.maxWicks = game.tuning.maxWicks;
  p.invuln = 1.2;
  p.beaming = false;
  p.beamHeat = 0;
  p.sputter = 0;
  p.regenWait = 0;
  p.trail = [];

  game.waves = new Waves(game);
  game.waves.begin(0);
  game.state = 'playing';
  ensureAudio();
  setDrone(1);
  sfx.wave();
}

function endRun(victory) {
  game.state = victory ? 'victory' : 'defeat';
  game.player.beaming = false;
  setBurn(0);
  setDrone(0.35);
  game.stats.bestCombo = Math.max(game.stats.bestCombo, game.combo);
  const waveReached = Math.min(WAVES.length, game.waves.index + 1);
  if (game.score > game.bestScore) {
    game.bestScore = game.score;
    writeBest(game.score, waveReached);
  }
  game.bestWave = Math.max(game.bestWave, waveReached);
  if (victory) sfx.win();
  else sfx.lose();
}

function chooseUpgrade(index) {
  const card = game.upgradeCards[index];
  if (!card) return;
  applyUpgrade(game, card);
  game.upgradeCards = [];
  game.hoveredCard = -1;
  game.player.maxOil = game.tuning.oil.max;
  game.player.invuln = Math.max(game.player.invuln, 1);
  game.waves.begin(game.waves.index + 1);
  game.state = 'playing';
  setDrone(1);
  sfx.wave();
}

// ---------------------------------------------------------------- the world

game.notify = (text, color = PALETTE.paper) => {
  game.notices.push({ text, color, life: 1 });
  if (game.notices.length > 3) game.notices.shift();
};

game.shake = (mag, time) => {
  game.shakeMag = Math.max(game.shakeMag, mag);
  game.shakeTimer = Math.max(game.shakeTimer, time);
};

game.hitstop = (t) => {
  game.freezeTimer = Math.max(game.freezeTimer, t);
};

game.spawnEnemy = (type) => {
  const pt = spawnPointOnRing(game.rng, type === 'eater' ? 6 : 40);
  const e = new Enemy(type, pt.x, pt.y, game.rng);
  game.enemies.push(e);
  if (type === 'eater') {
    game.notify('The Wick-Eater surfaces', PALETTE.blood);
    game.shake(6, 0.6);
  }
  return e;
};

game.spawnMothNear = (x, y) => {
  const a = game.rng() * Math.PI * 2;
  const e = new Enemy('moth', x + Math.cos(a) * 34, y + Math.sin(a) * 34, game.rng);
  game.enemies.push(e);
};

game.spawnGlob = (x, y, tx, ty) => {
  const a = Math.atan2(ty - y, tx - x);
  game.globs.push({ x, y, vx: Math.cos(a) * 232, vy: Math.sin(a) * 232, life: 4.2, spin: game.rng() * 6 });
};

game.flareBlast = (x, y, radius, damage, knockback) => {
  for (const e of game.enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius + e.radius) {
      const armor = e.def.armor ?? 1;
      e.takeDamage(damage * armor, game, 'flare');
      const a = Math.atan2(e.y - y, e.x - x);
      e.vx += Math.cos(a) * knockback;
      e.vy += Math.sin(a) * knockback;
      e.hitFlash = 1;
    }
  }
  for (let i = game.globs.length - 1; i >= 0; i--) {
    const g = game.globs[i];
    if (Math.hypot(g.x - x, g.y - y) < radius) {
      game.particles.ink(g.x, g.y, 5, 60);
      game.globs.splice(i, 1);
    }
  }
};

game.onEnemyKilled = (e, source) => {
  const def = e.def;
  game.combo = Math.min(COMBO.max, game.combo + COMBO.step);
  game.comboTimer = COMBO.window;
  game.stats.bestCombo = Math.max(game.stats.bestCombo, game.combo);
  const gain = Math.round(def.score * game.combo);
  game.score += gain;
  game.stats.kills += 1;
  game.particles.word(e.x, e.y - e.radius - 6, `+${gain}`, def.boss ? PALETTE.flame : PALETTE.paper, def.boss ? 22 : 14);
  game.particles.ink(e.x, e.y, def.boss ? 34 : 8, def.boss ? 260 : 90);
  game.particles.ember(e.x, e.y, def.boss ? 30 : 6, def.boss ? 240 : 90);
  game.particles.ring(e.x, e.y, def.boss ? 26 : 8, PALETTE.ember, def.boss ? 0.9 : 0.35);
  game.shake(def.boss ? 10 : 2.4, def.boss ? 0.5 : 0.12);
  if (def.boss) {
    sfx.bigKill();
    game.hitstop(0.06);
  } else {
    sfx.kill();
  }
  for (let i = 0; i < def.drops; i++) {
    const a = game.rng() * Math.PI * 2;
    game.pickups.push({
      x: e.x + Math.cos(a) * 12,
      y: e.y + Math.sin(a) * 12,
      seed: game.rng() * 6,
      oil: 4,
      life: 12,
    });
  }
  if (def.boss) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      game.pickups.push({ x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 26, seed: i, oil: 6, life: 14 });
    }
    game.notify('The Eater comes apart', PALETTE.ember);
  }
};

game.onWaveCleared = (index) => {
  game.particles.ember(game.player.x, game.player.y, 10, 90);
  game.player.oil = Math.min(game.tuning.oil.max, game.player.oil + 16);
  if (index >= WAVES.length - 1) {
    endRun(true);
    return;
  }
  game.upgradeCards = rollUpgrades(game, 3);
  game.state = 'upgrade';
  game.player.beaming = false;
  setBurn(0);
  setDrone(0.45);
  sfx.upgrade();
};

// ---------------------------------------------------------------- update

function updatePlaying(dt) {
  const p = game.player;
  game.time += dt;
  game.graceBeam = Math.max(0, game.graceBeam - dt);
  game.wantBeam = input.down && game.graceBeam <= 0;
  game.wantFlare = keyPressed('Space') || game.autoFlare === true;
  game.autoFlare = false;
  game.moveAxis = moveAxis();

  p.update(dt, game);
  if (game.wantFlare) game.wantFlare = false;

  const beamOn = p.beaming;
  let anyBeam = 0;
  if (beamOn) {
    for (const e of game.enemies) {
      const f = p.beamFalloff(e.x, e.y, e.radius);
      if (f > 0) {
        anyBeam = Math.max(anyBeam, f);
        const armor = e.def.armor ?? 1;
        const dmg = game.tuning.beam.dps * f * dt * armor;
        e.takeDamage(dmg, game, 'beam');
        e.burn = Math.min(1, e.burn + dt * 5);
        e.vx += Math.cos(p.aim) * game.tuning.beam.push * f * dt;
        e.vy += Math.sin(p.aim) * game.tuning.beam.push * f * dt;
        if (game.rng() < f * dt * 26) {
          game.particles.spark(e.x - Math.cos(p.aim) * e.radius, e.y - Math.sin(p.aim) * e.radius, p.aim + Math.PI, 1);
        }
      }
    }
    for (let i = game.globs.length - 1; i >= 0; i--) {
      const g = game.globs[i];
      if (p.beamFalloff(g.x, g.y, 6) > 0) {
        game.particles.ink(g.x, g.y, 5, 70);
        game.particles.ember(g.x, g.y, 3, 50);
        game.globs.splice(i, 1);
      }
    }
  }
  setBurn(beamOn ? 1 : 0, anyBeam);

  for (const e of game.enemies) e.update(dt, game);

  // combat contact
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < e.radius + PLAYER.radius - 1) {
      if (game.tuning.thorns > 0) e.takeDamage(game.tuning.thorns * dt, game, 'thorns');
      const knocked = p.hurt(game);
      if (knocked) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        p.vx += Math.cos(a) * PLAYER.hitKnockback;
        p.vy += Math.sin(a) * PLAYER.hitKnockback;
        e.vx -= Math.cos(a) * 80;
        e.vy -= Math.sin(a) * 80;
        if (game.state !== 'playing') return;
      }
    }
  }

  // ink globs
  for (let i = game.globs.length - 1; i >= 0; i--) {
    const g = game.globs[i];
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.life -= dt;
    if (g.life <= 0) {
      game.globs.splice(i, 1);
      continue;
    }
    if (Math.hypot(g.x - p.x, g.y - p.y) < 9 + PLAYER.radius) {
      p.hurt(game);
      game.particles.ink(g.x, g.y, 8, 90);
      game.globs.splice(i, 1);
      if (game.state !== 'playing') return;
    }
  }

  // embers
  const magnet = game.tuning.pickupRadius;
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pickup = game.pickups[i];
    pickup.life -= dt;
    const d = Math.hypot(pickup.x - p.x, pickup.y - p.y);
    if (d < magnet) {
      const pull = (1 - d / magnet) * 420 + 60;
      pickup.x += ((p.x - pickup.x) / (d || 1)) * pull * dt;
      pickup.y += ((p.y - pickup.y) / (d || 1)) * pull * dt;
    }
    if (d < 18) {
      p.oil = Math.min(game.tuning.oil.max, p.oil + pickup.oil);
      game.score += 5;
      game.particles.ember(pickup.x, pickup.y, 3, 40, PALETTE.flame);
      sfx.pickup();
      game.pickups.splice(i, 1);
      continue;
    }
    if (pickup.life <= 0) game.pickups.splice(i, 1);
  }

  // combo decay
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
  } else if (game.combo > 1) {
    game.combo = Math.max(1, game.combo - dt * 0.55);
  }

  game.waves.update(dt);

  for (let i = game.enemies.length - 1; i >= 0; i--) {
    if (game.enemies[i].dead) game.enemies.splice(i, 1);
  }

  game.particles.update(dt);

  for (const n of game.notices) n.life -= dt * 0.8;
  for (let i = game.notices.length - 1; i >= 0; i--) if (game.notices[i].life <= 0) game.notices.splice(i, 1);

  if (game.waves.index >= 1) game.hintAlpha = Math.max(0, game.hintAlpha - dt * 0.6);
}

function updateAmbient(dt) {
  for (const e of game.enemies) {
    e.age += dt;
    e.wobble += dt * 1.3;
    e.x += (e.vx || 20) * dt;
    e.y += Math.sin(game.renderTime * 0.7 + e.wobble) * 8 * dt;
    const dx = e.x - WORLD.cx;
    const dy = e.y - WORLD.cy;
    if (Math.hypot(dx, dy) > WORLD.radius - 20) {
      e.x -= (dx / Math.hypot(dx, dy)) * 0.6;
      e.y -= (dy / Math.hypot(dx, dy)) * 0.6;
      e.vx = -(e.vx || 20);
    }
  }
  game.particles.update(dt);
}

function update(dt) {
  game.renderTime += dt;
  game.shakeTimer = Math.max(0, game.shakeTimer - dt);
  if (game.shakeTimer <= 0) game.shakeMag *= Math.exp(-dt * 8);

  if (game.freezeTimer > 0) {
    game.freezeTimer -= dt;
    return;
  }

  // The scene is drawn zoomed about the ring's centre, so the pointer is mapped back into it.
  game.aim.x = WORLD.cx + (input.mouseX - WORLD.cx) / SCENE.zoom;
  game.aim.y = WORLD.cy + (input.mouseY - WORLD.cy) / SCENE.zoom;

  switch (game.state) {
    case 'title': {
      updateAmbient(dt);
      if (input.pressed || keyPressed('Enter', 'Space', 'KeyR')) {
        input.pressed = false;
        startRun();
      }
      break;
    }
    case 'playing': {
      updatePlaying(dt);
      if (game.state !== 'playing') break;
      if (keyPressed('KeyP', 'Escape')) {
        game.state = 'paused';
        game.player.beaming = false;
        setBurn(0);
        sfx.ui();
      } else if (keyPressed('KeyR')) {
        startRun();
      }
      break;
    }
    case 'paused': {
      game.particles.update(dt * 0.2);
      if (keyPressed('KeyP', 'Escape') || input.pressed) {
        input.pressed = false;
        game.state = 'playing';
        sfx.ui();
      } else if (keyPressed('KeyR')) {
        startRun();
      }
      break;
    }
    case 'upgrade': {
      game.particles.update(dt * 0.6);
      game.hoveredCard = upgradeCardAt(input.mouseX, input.mouseY);
      let pick = -1;
      if (keyPressed('Digit1', 'Numpad1')) pick = 0;
      else if (keyPressed('Digit2', 'Numpad2')) pick = 1;
      else if (keyPressed('Digit3', 'Numpad3')) pick = 2;
      else if (input.pressed && game.hoveredCard >= 0) pick = game.hoveredCard;
      if (pick >= 0) {
        input.pressed = false;
        chooseUpgrade(pick);
      }
      break;
    }
    case 'defeat':
    case 'victory': {
      game.particles.update(dt);
      if (keyPressed('KeyR', 'Enter', 'Space') || input.pressed) {
        input.pressed = false;
        startRun();
      }
      break;
    }
    default:
      break;
  }

  clearPressed();
}

// ---------------------------------------------------------------- render

function render() {
  ctx.save();
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const shake = game.shakeTimer > 0 ? game.shakeMag : 0;
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  ctx.translate(sx, sy);

  renderer.draw({ ctx, game, time: game.renderTime, dt: game.lastDt || 0 });

  if (game.state === 'playing' || game.state === 'paused' || game.state === 'defeat' || game.state === 'victory') {
    drawHud(ctx, game, game.renderTime);
  }
  if (game.state === 'title') drawTitle(ctx, game, game.renderTime);
  if (game.state === 'upgrade') drawUpgrade(ctx, game, game.renderTime, game.hoveredCard);
  if (game.state === 'paused') drawPause(ctx, game, game.renderTime);
  if (game.state === 'victory') drawEnd(ctx, game, true, game.renderTime);
  if (game.state === 'defeat') drawEnd(ctx, game, false, game.renderTime);

  ctx.restore();
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) || 0;
  last = now;
  game.lastDt = dt;
  if (!game.frozen) {
    if (autoPlay) driveBot();
    update(dt * speed);
    if (autoPlay) reportBot();
  }
  render();
  requestAnimationFrame(frame);
}

// A smoke test, not part of play: ?auto=1 walks the keeper in a slow circle, aims at the nearest
// ink and burns it, then writes the run's state into the page title so a headless browser can
// play a whole night without hands.
let botClock = 0;
function driveBot() {
  if (game.state === 'upgrade') {
    chooseUpgrade(Math.floor(game.rng() % 3));
    return;
  }
  if (game.state !== 'playing') return;
  const p = game.player;
  botClock += game.lastDt;

  let nearest = null;
  let nd = Infinity;
  for (const e of game.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd) {
      nd = d;
      nearest = e;
    }
  }
  let near = 0;
  for (const e of game.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 120) near++;

  if (nearest) {
    // Aim a little ahead of where the target is going, as a player would.
    input.mouseX = nearest.x + nearest.vx * 0.12;
    input.mouseY = nearest.y + nearest.vy * 0.12;
  }
  input.down = !!nearest && nd < 290 && p.oil > 10;

  // Stand and burn; back off only to refill the oil or when something is on top of us.
  const retreat = (p.oil < 24 && nd < 200) || nd < 66;
  const mx = p.x - (nearest ? nearest.x : WORLD.cx);
  const my = p.y - (nearest ? nearest.y : WORLD.cy);
  const ml = Math.hypot(mx, my) || 1;
  const toward = nd > 250 ? 1 : -0.35;
  const dirX = retreat ? mx / ml : (nearest ? -mx / ml : 0) * toward;
  const dirY = retreat ? my / ml : (nearest ? -my / ml : 0) * toward;
  const wobble = Math.sin(botClock * 2.3) * 0.5;
  p.vx += (dirX + wobble * 0.3) * 900 * game.lastDt;
  p.vy += (dirY - wobble * 0.3) * 900 * game.lastDt;

  if (near >= 2 && p.oil > 55) game.autoFlare = true;
}

function reportBot() {
  if (game.lastReport && game.renderTime - game.lastReport < 0.5) return;
  game.lastReport = game.renderTime;
  const status = {
    state: game.state,
    wave: game.waves.index + 1,
    waveName: WAVES[Math.min(WAVES.length - 1, Math.max(0, game.waves.index))].name,
    score: Math.round(game.score),
    enemies: game.enemies.length,
    queue: game.waves.queue.length,
    wicks: game.player.wicks,
    oil: Math.round(game.player.oil),
    kills: game.stats.kills,
    upgrades: game.upgrades.length,
    time: Math.round(game.time),
    error: game.lastError || null,
    nd: Math.round(Math.min(...game.enemies.map((e) => Math.hypot(e.x - game.player.x, e.y - game.player.y)), Infinity)),
    down: input.down,
    wb: game.wantBeam,
    grace: +game.graceBeam.toFixed(2),
  };
  document.title = `BOT ${JSON.stringify(status)}`;
  const el = document.getElementById('bot-status');
  if (el) el.textContent = JSON.stringify(status);
}

window.addEventListener('error', (e) => {
  game.lastError = String(e.message || e.error);
  document.title = `BOT-ERROR ${game.lastError}`;
  window.__nightwickError = game.lastError;
});

// A shot is a hand-built moment: set it up, then hold the world still so the frame is repeatable.
if (shotName) {
  setupShot(game, shotName, shotSeed);
  game.frozen = true;
  game.renderTime = 12;
}
if (autoPlay) startRun();

window.__nightwick = game;
window.__startRun = startRun;
window.__input = input;
window.__nightwickRenderer = renderer;
requestAnimationFrame(frame);
