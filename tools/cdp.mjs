// A tiny Chrome DevTools Protocol driver (Node 22+, no dependencies) for testing Nightwick and
// taking its screenshots: launch headless Chrome, open a page, evaluate JS, capture the canvas.
// Usage:
//   node tools/cdp.mjs shot <url> <out.png> [--size=1280x800] [--wait=1500]
//   node tools/cdp.mjs play <url> [--seconds=600] [--speed=4]   (polls the page title)
//   node tools/cdp.mjs eval <url> "<expression>"
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

const [mode, url, extra] = process.argv.slice(2);
const flags = Object.fromEntries(
  process.argv.slice(4).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? true];
  }),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function launch(size) {
  const port = 9200 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'nightwick-chrome-'));
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${size}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let info = null;
  for (let i = 0; i < 60 && !info; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      info = await res.json();
    } catch {
      /* not up yet */
    }
  }
  if (!info) throw new Error('chrome did not start');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Number(size.split('x')[0]),
    height: Number(size.split('x')[1]),
    deviceScaleFactor: 1,
    mobile: false,
  }, sessionId);
  return { cdp, sessionId, child, kill: () => child.kill() };
}

async function navigate(cdp, sessionId, target) {
  const loaded = new Promise((resolve) => {
    const check = setInterval(() => {
      const ev = cdp.events.find((e) => e.method === 'Page.loadEventFired');
      if (ev) {
        clearInterval(check);
        resolve();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 15000);
  });
  await cdp.send('Page.navigate', { url: target }, sessionId);
  await loaded;
}

async function evaluate(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception?.description || ''));
  return res.result.value;
}

function errorsOf(cdp) {
  return cdp.events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
}

const size = String(flags.size || '1280x800');
const { cdp, sessionId, kill } = await launch(size);

try {
  await navigate(cdp, sessionId, url);
  await sleep(Number(flags.wait || 1200));

  if (mode === 'shot') {
    const png = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    const dir = extra.slice(0, extra.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(extra, Buffer.from(png.data, 'base64'));
    console.log(`wrote ${extra}`);
  } else if (mode === 'interact') {
    // A human-ish session: click to start, move the pointer, hold the beam, press keys, and take
    // a screenshot at the end. This is the only path that exercises the real DOM input pipeline.
    const width = Number(size.split('x')[0]);
    const height = Number(size.split('x')[1]);
    const mouse = (type, x, y, buttons = 0) =>
      cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0 }, sessionId);
    const key = (type, code, keyCode, text) =>
      cdp.send('Input.dispatchKeyEvent', { type, code, key: text ?? code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, sessionId);

    await mouse('mousePressed', width / 2, height / 2, 1);
    await mouse('mouseReleased', width / 2, height / 2, 0);
    await sleep(600);
    const started = await evaluate(cdp, sessionId, 'window.__nightwick.state');

    await mouse('mousePressed', width * 0.7, height * 0.4, 1);
    const startedAt = Date.now();
    let i = 0;
    while (Date.now() - startedAt < Number(flags.seconds || 20) * 1000) {
      i++;
      const x = width / 2 + Math.cos(i * 0.21) * width * 0.28;
      const y = height / 2 + Math.sin(i * 0.17) * height * 0.24;
      await mouse('mouseMoved', x, y, 1);
      if (i % 7 === 0) await key('keyDown', 'KeyD', 68, 'd');
      if (i % 7 === 3) await key('keyUp', 'KeyD', 68, 'd');
      if (i % 11 === 0) {
        await key('keyDown', 'Space', 32, ' ');
        await key('keyUp', 'Space', 32, ' ');
      }
      if (i % 13 === 0) {
        await key('keyDown', 'KeyW', 87, 'w');
        await key('keyUp', 'KeyW', 87, 'w');
      }
      await sleep(90);
    }
    await mouse('mouseReleased', width * 0.6, height * 0.5, 0);
    const state = await evaluate(cdp, sessionId, 'JSON.stringify({state:window.__nightwick.state, wave:window.__nightwick.waves.index+1, score:Math.round(window.__nightwick.score), kills:window.__nightwick.stats.kills, oil:Math.round(window.__nightwick.player.oil), enemies:window.__nightwick.enemies.length})');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(extra, Buffer.from(shot.data, 'base64'));
    console.log('started from title:', started);
    console.log('after interaction:', state);
    console.log(`wrote ${extra}`);
  } else if (mode === 'eval') {
    console.log(JSON.stringify(await evaluate(cdp, sessionId, extra), null, 1));
  } else if (mode === 'play') {
    const seconds = Number(flags.seconds || 300);
    let lastTitle = '';
    const started = Date.now();
    while ((Date.now() - started) / 1000 < seconds) {
      await sleep(1000);
      const title = await evaluate(cdp, sessionId, 'document.title');
      if (title !== lastTitle) {
        console.log(title);
        lastTitle = title;
      }
      if (/TITLE-|ERROR|"state":"victory"|"state":"defeat"/.test(title)) break;
      await evaluate(
        cdp,
        sessionId,
        `(() => { const g = window.__nightwick; if (g && g.state === 'upgrade') { const c = g.upgradeCards[0]; if (c) { window.__pick = true; } } return g ? g.state : 'none'; })()`,
      );
    }
    const errs = errorsOf(cdp);
    if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
    console.log('title:', await evaluate(cdp, sessionId, 'document.title'));
  }
  const errs = errorsOf(cdp);
  if (errs.length) {
    console.log('PAGE ERRORS:');
    for (const e of errs) console.log(' -', e.split('\n')[0]);
    process.exitCode = 1;
  }
} finally {
  kill();
  await sleep(300);
}
