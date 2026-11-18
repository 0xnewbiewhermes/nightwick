// The framed moments between play: the title with its controls, the three-gift choice after
// each wave, the pause veil, and the two endings — the wick going out, and dawn.

import { PALETTE } from './config.js';
import { TAU, clamp, formatClock, formatScore, spaced, withAlpha } from './util.js';

function veil(ctx, alpha = 0.62) {
  ctx.save();
  ctx.fillStyle = `rgba(4, 7, 10, ${alpha})`;
  ctx.fillRect(0, 0, 1280, 800);
  const g = ctx.createRadialGradient(640, 420, 160, 640, 420, 720);
  g.addColorStop(0, 'rgba(4,7,10,0)');
  g.addColorStop(1, 'rgba(2,4,6,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 800);
  ctx.restore();
}

function flameMark(ctx, x, y, size, time) {
  const pulse = 0.94 + Math.sin(time * 2.4) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.4);
  g.addColorStop(0, 'rgba(255, 210, 140, 0.5)');
  g.addColorStop(0.5, 'rgba(255, 140, 60, 0.16)');
  g.addColorStop(1, 'rgba(255, 110, 40, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size * 3.4, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createLinearGradient(0, -size, 0, size);
  body.addColorStop(0, PALETTE.flame);
  body.addColorStop(0.5, PALETTE.ember);
  body.addColorStop(1, PALETTE.deep);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.9, -size * 0.1, size * 0.55, size * 0.85, 0, size);
  ctx.bezierCurveTo(-size * 0.55, size * 0.85, -size * 0.9, -size * 0.1, 0, -size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function keyChip(ctx, x, y, text, align = 'left') {
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  const w = Math.max(28, ctx.measureText(text).width + 16);
  const px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(243, 231, 211, 0.08)';
  ctx.strokeStyle = 'rgba(243, 231, 211, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px, y - 15, w, 22, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = withAlpha(PALETTE.paper, 0.92);
  ctx.textAlign = 'center';
  ctx.fillText(text, px + w / 2, y);
  return w;
}

export function drawTitle(ctx, game, time) {
  veil(ctx, 0.55);

  ctx.textAlign = 'center';
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.ember, 0.75);
  spaced(ctx, 'A GAME OF LIGHT AGAINST INK', 640, 168, 5.5);

  flameMark(ctx, 640, 214, 15, time);

  // Title: a warm-to-paper gradient, sized to fill the width at a glance.
  const grad = ctx.createLinearGradient(420, 250, 860, 340);
  grad.addColorStop(0, '#ffe9c4');
  grad.addColorStop(0.55, '#f3e7d3');
  grad.addColorStop(1, '#d9b284');
  ctx.font = '400 96px Georgia, "Times New Roman", serif';
  ctx.fillStyle = grad;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 160, 70, 0.35)';
  ctx.shadowBlur = 42;
  spaced(ctx, 'NIGHTWICK', 640, 330, 10);
  ctx.restore();

  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.95);
  ctx.fillText('a keeper, a lantern, and ten waves of ink until morning', 640, 372);

  ctx.strokeStyle = withAlpha(PALETTE.ember, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(560, 396);
  ctx.lineTo(720, 396);
  ctx.stroke();
  ctx.fillStyle = withAlpha(PALETTE.ember, 0.8);
  ctx.beginPath();
  ctx.arc(640, 396, 2.2, 0, TAU);
  ctx.fill();

  // Controls, in two columns of key + verb.
  const rows = [
    ['W A S D', 'walk the ring'],
    ['MOUSE', 'aim the lantern'],
    ['HOLD LMB', 'burn the ink'],
    ['SPACE', 'flare (costs oil)'],
  ];
  const rows2 = [
    ['R', 'relight after a run'],
    ['P', 'pause'],
    ['1 2 3', 'choose a gift'],
    ['—', 'oil refills in the dark'],
  ];
  const drawRows = (list, x) => {
    list.forEach(([k, v], i) => {
      const y = 452 + i * 34;
      const w = keyChip(ctx, x, y, k);
      ctx.textAlign = 'left';
      ctx.font = '15px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = withAlpha(PALETTE.paper, 0.8);
      ctx.fillText(v, x + w + 14, y);
    });
  };
  drawRows(rows, 356);
  drawRows(rows2, 702);

  const pulse = 0.72 + Math.sin(time * 2.6) * 0.28;
  ctx.textAlign = 'center';
  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.ember, pulse);
  spaced(ctx, 'CLICK TO LIGHT THE WICK', 640, 632, 4.5);

  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.68);
  ctx.fillText(game.bestScore > 0 ? `best run  ${formatScore(game.bestScore)}  ·  wave ${game.bestWave}/10` : 'no run yet — the night is young', 640, 672);

  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.45);
  spaced(ctx, 'ORIGINAL GAME · NO ASSETS · ONE KEEPER', 640, 736, 3.6);
}

// ---------------------------------------------------------------- upgrade cards

export const CARD = { w: 262, h: 318, gap: 30, y: 448 };

export function cardRect(i) {
  const total = CARD.w * 3 + CARD.gap * 2;
  const x = 640 - total / 2 + i * (CARD.w + CARD.gap);
  return { x, y: CARD.y - CARD.h / 2, w: CARD.w, h: CARD.h, cx: x + CARD.w / 2, cy: CARD.y };
}

export function upgradeCardAt(mx, my) {
  for (let i = 0; i < 3; i++) {
    const r = cardRect(i);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
  }
  return -1;
}

function upgradeIcon(ctx, id, cx, cy, size, ink, accent) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  switch (id) {
    case 'wide': {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.35 + i * 0.3;
        ctx.beginPath();
        ctx.arc(0, size * 0.55, size * (0.4 + i * 0.22), -Math.PI * 0.82, -Math.PI * 0.18);
        ctx.stroke();
      }
      break;
    }
    case 'bright': {
      const g = ctx.createLinearGradient(0, -size * 0.7, 0, size * 0.6);
      g.addColorStop(0, accent);
      g.addColorStop(1, ink);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.72);
      ctx.bezierCurveTo(size * 0.6, -size * 0.1, size * 0.4, size * 0.58, 0, size * 0.66);
      ctx.bezierCurveTo(-size * 0.4, size * 0.58, -size * 0.6, -size * 0.1, 0, -size * 0.72);
      ctx.fill();
      break;
    }
    case 'thrifty': {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.6);
      ctx.bezierCurveTo(size * 0.55, size * 0.1, size * 0.3, size * 0.62, 0, size * 0.62);
      ctx.bezierCurveTo(-size * 0.3, size * 0.62, -size * 0.55, size * 0.1, 0, -size * 0.6);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(0, size * 0.22, size * 0.17, 0, TAU);
      ctx.fill();
      break;
    }
    case 'reach': {
      ctx.beginPath();
      ctx.moveTo(-size * 0.62, 0);
      ctx.lineTo(size * 0.5, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.28, -size * 0.22);
      ctx.lineTo(size * 0.52, 0);
      ctx.lineTo(size * 0.28, size * 0.22);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(-size * 0.62, 0, 3 + i * 4, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'wick': {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.6);
      ctx.bezierCurveTo(size * 0.45, -size * 0.05, size * 0.3, size * 0.5, 0, size * 0.55);
      ctx.bezierCurveTo(-size * 0.3, size * 0.5, -size * 0.45, -size * 0.05, 0, -size * 0.6);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-size * 0.62, size * 0.5);
      ctx.lineTo(size * 0.62, size * 0.5);
      ctx.stroke();
      break;
    }
    case 'flare': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.globalAlpha = 0.5 + (i % 2) * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size * 0.2, Math.sin(a) * size * 0.2);
        ctx.lineTo(Math.cos(a) * size * 0.68, Math.sin(a) * size * 0.68);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'magnet': {
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU * 1.6;
        const r = size * (0.68 - i * 0.014);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.12, 0, TAU);
      ctx.fill();
      break;
    }
    case 'speed': {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.85 - i * 0.25;
        ctx.beginPath();
        ctx.moveTo(-size * 0.4 + i * size * 0.26, -size * 0.4);
        ctx.lineTo(size * 0.05 + i * size * 0.26, 0);
        ctx.lineTo(-size * 0.4 + i * size * 0.26, size * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'fastflare': {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(size * 0.1, -size * 0.7);
      ctx.lineTo(-size * 0.34, size * 0.06);
      ctx.lineTo(size * 0.02, size * 0.06);
      ctx.lineTo(-size * 0.14, size * 0.7);
      ctx.lineTo(size * 0.4, -size * 0.08);
      ctx.lineTo(size * 0.02, -size * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'thick': {
      ctx.beginPath();
      ctx.moveTo(-size * 0.16, -size * 0.62);
      ctx.lineTo(size * 0.16, -size * 0.62);
      ctx.lineTo(size * 0.16, -size * 0.36);
      ctx.bezierCurveTo(size * 0.55, -size * 0.1, size * 0.5, size * 0.6, 0, size * 0.62);
      ctx.bezierCurveTo(-size * 0.5, size * 0.6, -size * 0.55, -size * 0.1, -size * 0.16, -size * 0.36);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.26, size * 0.3, size * 0.2, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'hush': {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(-size * 0.08, 0, size * 0.52, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#efe3cf';
      ctx.beginPath();
      ctx.arc(size * 0.14, -size * 0.08, size * 0.44, 0, TAU);
      ctx.fill();
      break;
    }
    case 'spark': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * size * 0.66, Math.sin(a) * size * 0.66);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, TAU);
      ctx.fill();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawUpgrade(ctx, game, time, hovered) {
  veil(ctx, 0.66);
  ctx.textAlign = 'center';
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.ember, 0.8);
  spaced(ctx, 'WAVE CLEARED', 640, 130, 5.5);

  ctx.font = 'italic 40px Georgia, serif';
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText('Choose a gift from the lantern', 640, 182);

  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.85);
  ctx.fillText('Every wave leaves one thing behind. Take it before the ink returns.', 640, 212);

  game.upgradeCards.forEach((card, i) => {
    const r = cardRect(i);
    const hover = hovered === i;
    const lift = hover ? -8 : 0;
    ctx.save();
    ctx.translate(r.cx, r.cy + lift);

    ctx.shadowColor = hover ? 'rgba(255, 170, 90, 0.45)' : 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = hover ? 34 : 22;
    ctx.shadowOffsetY = hover ? 10 : 8;
    ctx.fillStyle = hover ? '#f8eedb' : '#efe3cf';
    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = hover ? withAlpha(PALETTE.deep, 0.65) : 'rgba(30, 24, 18, 0.22)';
    ctx.lineWidth = hover ? 2 : 1.2;
    ctx.stroke();

    upgradeIcon(ctx, card.id, 0, -r.h / 2 + 74, 40, '#1d242c', PALETTE.deep);

    ctx.textAlign = 'center';
    ctx.font = '600 23px Georgia, serif';
    ctx.fillStyle = '#181d23';
    ctx.fillText(card.name, 0, -r.h / 2 + 158);

    ctx.font = 'italic 14px Georgia, serif';
    ctx.fillStyle = 'rgba(40, 38, 34, 0.75)';
    wrapText(ctx, card.note, 0, -r.h / 2 + 186, r.w - 48, 20);

    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(60, 48, 34, 0.55)';
    spaced(ctx, card.id === 'wick' ? 'A WICK' : 'A GIFT', 0, r.h / 2 - 46, 3.2);

    ctx.fillStyle = hover ? PALETTE.deep : 'rgba(40, 34, 26, 0.35)';
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(i + 1), 0, r.h / 2 - 20);
    ctx.restore();
  });

  ctx.textAlign = 'center';
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.7);
  ctx.fillText('press 1, 2 or 3 — or click a card', 640, 668);

  if (game.upgrades.length > 0) {
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.5);
    ctx.fillText(`gifts taken: ${game.upgrades.length}`, 640, 696);
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// ---------------------------------------------------------------- endings

export function drawPause(ctx, game, time) {
  veil(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.font = '400 54px Georgia, serif';
  ctx.fillStyle = PALETTE.paper;
  spaced(ctx, 'PAUSED', 640, 400, 12);
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.9);
  ctx.fillText('the ink waits politely', 640, 436);
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.ember, 0.6 + Math.sin(time * 2.4) * 0.2);
  ctx.fillText('P or click to continue', 640, 480);
}

function statRow(ctx, y, name, value) {
  ctx.textAlign = 'left';
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.75);
  spaced(ctx, name, 500, y, 3);
  ctx.textAlign = 'right';
  ctx.font = '600 20px Georgia, serif';
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText(value, 780, y + 2);
}

export function drawEnd(ctx, game, victory, time) {
  veil(ctx, 0.72);

  if (victory) {
    // Dawn rising behind the words: a warm floor of light and a low sun.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const horizon = ctx.createLinearGradient(0, 470, 0, 800);
    horizon.addColorStop(0, 'rgba(255, 150, 70, 0)');
    horizon.addColorStop(0.55, 'rgba(255, 160, 84, 0.14)');
    horizon.addColorStop(1, 'rgba(255, 190, 110, 0.3)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 470, 1280, 330);
    const sun = ctx.createRadialGradient(640, 690, 10, 640, 690, 520);
    sun.addColorStop(0, 'rgba(255, 214, 150, 0.22)');
    sun.addColorStop(0.5, 'rgba(255, 170, 96, 0.09)');
    sun.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 260, 1280, 540);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(640, 250, 20, 640, 250, 420);
    g.addColorStop(0, 'rgba(255, 190, 120, 0.22)');
    g.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(240, 0, 800, 520);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = withAlpha(PALETTE.ember, 0.85);
    spaced(ctx, 'WAVE 10 OF 10 SURVIVED', 640, 196, 5.5);

    const grad = ctx.createLinearGradient(440, 220, 840, 330);
    grad.addColorStop(0, '#ffe6b6');
    grad.addColorStop(0.5, '#ffd08a');
    grad.addColorStop(1, '#f3e7d3');
    ctx.font = '400 116px Georgia, serif';
    ctx.fillStyle = grad;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 160, 70, 0.45)';
    ctx.shadowBlur = 50;
    spaced(ctx, 'DAWN', 640, 320, 26);
    ctx.restore();

    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillStyle = withAlpha(PALETTE.paper, 0.92);
    ctx.fillText('The wick held. Morning finds the ring unbroken.', 640, 372);

    statRow(ctx, 452, 'SCORE', formatScore(game.score));
    statRow(ctx, 490, 'BEST COMBO', `×${game.stats.bestCombo.toFixed(1)}`);
    statRow(ctx, 528, 'KILLS', String(game.stats.kills));
    statRow(ctx, 566, 'NIGHT', formatClock(game.time));
  } else {
    ctx.textAlign = 'center';
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = withAlpha(PALETTE.blood, 0.85);
    spaced(ctx, `WAVE ${Math.min(10, game.waves.index + 1)} OF 10`, 640, 196, 5.5);

    ctx.font = '400 62px Georgia, serif';
    ctx.fillStyle = withAlpha(PALETTE.paper, 0.95);
    ctx.save();
    ctx.shadowColor = 'rgba(220, 80, 60, 0.35)';
    ctx.shadowBlur = 40;
    spaced(ctx, 'THE WICK GOES OUT', 640, 300, 6);
    ctx.restore();

    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillStyle = withAlpha(PALETTE.paperDim, 0.9);
    ctx.fillText('The dark takes the lantern, and the ring with it.', 640, 350);

    statRow(ctx, 430, 'SCORE', formatScore(game.score));
    statRow(ctx, 468, 'WAVE REACHED', `${Math.min(10, game.waves.index + 1)} / 10`);
    statRow(ctx, 506, 'BEST COMBO', `×${game.stats.bestCombo.toFixed(1)}`);
    statRow(ctx, 544, 'NIGHT', formatClock(game.time));
  }

  const pulse = 0.7 + Math.sin(time * 2.6) * 0.3;
  ctx.textAlign = 'center';
  ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = withAlpha(PALETTE.ember, pulse);
  ctx.fillText(victory ? 'R or click — walk the night again' : 'R or click — relight the wick', 640, 648);

  if (game.score >= game.bestScore && game.score > 0) {
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = withAlpha(PALETTE.ember, 0.75);
    spaced(ctx, 'A NEW BEST NIGHT', 640, 690, 4);
  }
}
