// Keyboard and pointer state, translated from window pixels into the game's virtual scene
// coordinates. Nothing else in the game reads a DOM event: every other module asks here.

import { VIEW } from './config.js';

const KEYS = new Set();
const PRESSED = new Set();

export const input = {
  mouseX: VIEW.w / 2,
  mouseY: VIEW.h / 2,
  aiming: false,
  down: false,
  pressed: false,
  anyInput: false,
  hitX: 0,
  hitY: 0,
};

let view = { scale: 1, offsetX: 0, offsetY: 0 };

export function setViewTransform(scale, offsetX, offsetY) {
  view = { scale, offsetX, offsetY };
}

export function toWorld(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * VIEW.w;
  const y = ((clientY - rect.top) / rect.height) * VIEW.h;
  return { x, y };
}

export function bindInput(canvas) {
  const move = (e) => {
    const p = toWorld(e.clientX, e.clientY, canvas);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.aiming = true;
  };

  window.addEventListener('pointermove', move, { passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    move(e);
    if (e.button === 0) {
      input.down = true;
      input.pressed = true;
      input.hitX = input.mouseX;
      input.hitY = input.mouseY;
    }
    input.anyInput = true;
    canvas.setPointerCapture?.(e.pointerId);
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) input.down = false;
  });

  window.addEventListener('blur', () => {
    input.down = false;
    KEYS.clear();
  });

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
    if (!KEYS.has(code)) PRESSED.add(code);
    KEYS.add(code);
    input.anyInput = true;
  });

  window.addEventListener('keyup', (e) => {
    KEYS.delete(e.code);
  });
}

export function keyDown(...codes) {
  return codes.some((c) => KEYS.has(c));
}

export function keyPressed(...codes) {
  return codes.some((c) => PRESSED.has(c));
}

export function clearPressed() {
  PRESSED.clear();
  input.pressed = false;
}

export function moveAxis() {
  let x = 0;
  let y = 0;
  if (keyDown('KeyA', 'ArrowLeft')) x -= 1;
  if (keyDown('KeyD', 'ArrowRight')) x += 1;
  if (keyDown('KeyW', 'ArrowUp')) y -= 1;
  if (keyDown('KeyS', 'ArrowDown')) y += 1;
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}
