// The keeper's instrument panel: wicks at the top left, the wave and its omen at the top
// centre, score and combo at the top right, and the oil flask along the bottom. Plus the
// transient banners, boss health and the control hints that fade away after the first wave.

import { PALETTE, WAVES } from './config.js';
import { TAU, clamp, formatClock, formatScore, withAlpha } from './util.js';

export function drawFlameIcon(ctx, x, y, size, lit) {
  ctx.save();
  ctx.translate(x, y);
  if (lit) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.2);
    g.addColorStop(0, 'rgba(255, 220, 160, 0.55)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.2, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const body = ctx.createLinearGradient(0, -size, 0, size);
    body.addColorStop(0, PALETTE.flame);
    body.addColorStop(0.55, PALETTE.ember);
    body.addColorStop(1, PALETTE.deep);
    ctx.fillStyle = body;
  } else {
    ctx.fillStyle = 'rgba(80, 70, 58, 0.55)';
  }
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.85, -size * 0.15, size * 0.6, size * 0.8, 0, size * 0.95);
  ctx.bezierCurveTo(-size * 0.6, size * 0.8, -size * 0.85, -size * 0.15, 0, -size);
  ctx.closePath();
  ctx.fill();
  if (lit) {
    ctx.fillStyle = 'rgba(30, 16, 6, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.1);
    ctx.bezierCurveTo(size * 0.34, size * 0.2, size * 0.24, size * 0.72, 0, size * 0.8);
    ctx.bezierCurveTo(-size * 0.24, size * 0.72, -size * 0.34, size * 0.2, 0, -size * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function label(ctx, text, x, y, size, color, spacing = 3.2, align = 'left') {
  ctx.font = `600 ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, px, y);
    px += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
  return total;
}

export function drawHud(ctx, game, time) {
  const p = game.player;
  const top = 46;

  // --- wicks
  label(ctx, 'WICKS', 52, top - 12, 11, withAlpha(PALETTE.paperDim, 0.9), 3.4);
  for (let i = 0; i < p.maxWicks; i++) {
    const lit = i < p.wicks;
    drawFlameIcon(ctx, 60 + i * 26, top + 14, 9.5, lit);
  }

  // --- wave
  const waveNumber = Math.min(game.waves.index + 1, WAVES.length);
  label(ctx, `WAVE ${waveNumber} / ${WAVES.length}`, 640, top - 6, 13, PALETTE.paper, 4.4, 'center');
  ctx.font = `italic 15px Georgia, serif`;
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.9);
  ctx.textAlign = 'center';
  const wave = WAVES[Math.max(0, Math.min(game.waves.index, WAVES.length - 1))];
  ctx.fillText(wave ? wave.name : '', 640, top + 15);

  const remaining = game.enemies.length + game.waves.queue.length;
  const barW = 220;
  const total = Math.max(1, game.waves.total);
  const done = clamp(1 - remaining / total, 0, 1);
  ctx.fillStyle = 'rgba(255, 236, 210, 0.12)';
  ctx.fillRect(640 - barW / 2, top + 26, barW, 3);
  ctx.fillStyle = withAlpha(PALETTE.ember, 0.85);
  ctx.fillRect(640 - barW / 2, top + 26, barW * done, 3);
  label(ctx, `${remaining} LEFT`, 640 + barW / 2 + 12, top + 31, 9.5, withAlpha(PALETTE.paperDim, 0.8), 2.4);

  // --- score
  ctx.textAlign = 'right';
  label(ctx, 'SCORE', 1228, top - 12, 11, withAlpha(PALETTE.paperDim, 0.9), 3.4, 'right');
  ctx.textAlign = 'right';
  ctx.font = `600 30px Georgia, serif`;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText(formatScore(game.score), 1228, top + 18);
  if (game.combo > 1) {
    ctx.font = `600 18px Georgia, serif`;
    ctx.fillStyle = withAlpha(PALETTE.ember, 0.95);
    ctx.fillText(`×${game.combo.toFixed(1)}`, 1228, top + 44);
  }
  ctx.font = `12px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.7);
  ctx.fillText(`best ${formatScore(game.bestScore)}`, 1228, top + 62);

  // --- boss health
  const boss = game.enemies.find((e) => e.def.boss);
  if (boss) {
    const w = 330;
    label(ctx, 'THE WICK-EATER', 640, 706, 10, withAlpha(PALETTE.blood, 0.95), 3.6, 'center');
    ctx.fillStyle = 'rgba(255, 236, 210, 0.14)';
    ctx.fillRect(640 - w / 2, 714, w, 5);
    ctx.fillStyle = withAlpha(PALETTE.blood, 0.9);
    ctx.fillRect(640 - w / 2, 714, w * clamp(boss.hp / boss.maxHp, 0, 1), 5);
  }

  // --- oil
  const oilW = 300;
  const oilX = 640 - oilW / 2;
  const oilY = 752;
  const maxOil = game.tuning.oil.max;
  const frac = clamp(p.oil / maxOil, 0, 1);
  label(ctx, 'OIL', oilX - 40, oilY + 10, 11, withAlpha(PALETTE.paperDim, 0.9), 3.4, 'right');

  ctx.fillStyle = 'rgba(255, 236, 210, 0.10)';
  ctx.beginPath();
  ctx.roundRect(oilX, oilY, oilW, 9, 4.5);
  ctx.fill();
  const oilGrad = ctx.createLinearGradient(oilX, 0, oilX + oilW, 0);
  const low = frac < 0.22;
  oilGrad.addColorStop(0, low ? '#c9553f' : '#ffb45c');
  oilGrad.addColorStop(1, low ? '#e07a4a' : '#ffe3b0');
  ctx.fillStyle = oilGrad;
  ctx.beginPath();
  ctx.roundRect(oilX, oilY, Math.max(3, oilW * frac), 9, 4.5);
  ctx.fill();
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = 'rgba(5, 8, 11, 0.55)';
    ctx.fillRect(oilX + (oilW / 4) * i, oilY, 1.5, 9);
  }

  // flare readiness
  const fxc = oilX + oilW + 34;
  const ready = p.flareCd <= 0 && p.oil >= game.tuning.flare.cost;
  ctx.save();
  ctx.globalAlpha = ready ? 1 : 0.4;
  ctx.strokeStyle = withAlpha(PALETTE.ember, 0.9);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(fxc, oilY + 4.5, 9, 0, TAU);
  ctx.stroke();
  if (ready) {
    ctx.fillStyle = withAlpha(PALETTE.flame, 0.9);
    ctx.beginPath();
    ctx.arc(fxc, oilY + 4.5, 4.4, 0, TAU);
    ctx.fill();
  } else {
    const cdFrac = 1 - clamp(p.flareCd / Math.max(0.001, game.tuning.flare.cooldown), 0, 1);
    ctx.fillStyle = withAlpha(PALETTE.ember, 0.7);
    ctx.beginPath();
    ctx.moveTo(fxc, oilY + 4.5);
    ctx.arc(fxc, oilY + 4.5, 6.4, -Math.PI / 2, -Math.PI / 2 + TAU * cdFrac);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  label(ctx, 'SPACE', fxc + 16, oilY + 10, 9.5, withAlpha(PALETTE.paperDim, 0.6), 2.2);

  // --- wave banner
  if (game.waves.banner > 0) {
    const t = game.waves.banner;
    const a = Math.min(1, t / 0.5) * Math.min(1, (2.6 - t) / 0.6 + 0.2);
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = withAlpha(PALETTE.ember, 0.9);
    ctx.fillText(game.waves.bannerName.toUpperCase(), 640, 330);
    ctx.font = 'italic 17px Georgia, serif';
    ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.85);
    ctx.fillText(game.waves.bannerNote, 640, 356);
    ctx.restore();
  }

  // --- first-wave hints
  if (game.hintAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = game.hintAlpha;
    ctx.textAlign = 'center';
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.85);
    ctx.fillText('WASD to move  ·  hold the left button to burn  ·  SPACE to flare  ·  P to pause', 640, 690);
    ctx.restore();
  }

  // --- notices ("not enough oil")
  for (const n of game.notices) {
    ctx.save();
    ctx.globalAlpha = clamp(n.life, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, 640, 640 - (1 - n.life) * 16);
    ctx.restore();
  }

  // --- clock, small, bottom left
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.55);
  ctx.fillText(formatClock(game.time), 52, 770);
  ctx.textAlign = 'right';
  ctx.fillText('nightwick', 1228, 770);
}
