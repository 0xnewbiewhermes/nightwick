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
