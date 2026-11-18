// Capture the entry's screenshots: open the game at a named ?shot= scene in headless Chrome
// at the scene's own 1280x800 size and write a PNG for each. Run with: node shots.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'captures');
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

if (!chrome) {
  console.error('Chrome not found; set CHROME to its path.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const PORT = Number(process.env.PORT || 8123);
const scenes = [
  ['1-play', 'play'],
  ['2-start', 'start'],
  ['3-gift', 'upgrade'],
  ['4-dawn', 'dawn'],
];

const only = process.argv[2];
for (const [name, shot] of scenes) {
  if (only && only !== name && only !== shot) continue;
  const file = resolve(join(outDir, `${name}.png`));
  const profile = resolve(join(here, `.chrome-${name}`));
  rmSync(profile, { recursive: true, force: true });
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--user-data-dir=${profile}`,
    '--force-device-scale-factor=1',
    '--window-size=1280,800',
    `--screenshot=${file}`,
    '--virtual-time-budget=4500',
    `http://127.0.0.1:${PORT}/?shot=${shot}&seed=1`,
  ];
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    const res = spawnSync(chrome, args, { timeout: 45000, stdio: 'ignore' });
    ok = existsSync(file) && res.status !== 1;
    if (!ok) console.error(`${name}: attempt ${attempt} failed (${res.error?.message ?? res.status})`);
  }
  if (!ok) {
    console.error(`${name}: gave up`);
    process.exitCode = 1;
  } else {
    console.log(`wrote ${file}`);
  }
  rmSync(profile, { recursive: true, force: true });
}
