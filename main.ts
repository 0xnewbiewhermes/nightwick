// Nightwick's hand-in: build the entry's /output from this repository.
//
// The bounty's gate runs this file twice in a sandbox with Node 22 and compares the two runs
// byte for byte, then checks the output against the same caps buildDossier is given here. So
// this program does four things, in order, and nothing else:
//   1. resolve where the output goes (MAKEFUN_OUTPUT_DIR stands in for /output outside the gate)
//   2. start from an empty output directory, so a second run cannot see the first one's files
//   3. refuse, with a sentence naming the rule, anything the gate would refuse anyway
//   4. copy game/ and screenshots/, then write dossier.json — the summary the AI judge reads
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and play the game itself with:
//   node serve.ts          (serves game/ on http://localhost:8080)

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, copied from the kit's reference/gate.json. The dossier writer uses them to
// refuse an entry the scorer would refuse, and to cap how much source text it carries.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Every file under a directory, as paths relative to it. */
function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`game/ may hold no symlink: ${relative(base, full)}`);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Check the built output against the scorer's caps before the dossier is written. */
function verifyGame(outDir) {
  const gameDir = join(outDir, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
  const files = walk(gameDir);
  if (files.length > CAPS.game_max_files) {
    throw new Error(`game/ holds ${files.length} files; the cap is ${CAPS.game_max_files}`);
  }
  let bytes = 0;
  for (const file of files) {
    const rel = relative(outDir, file).split(sep).join('/');
    if (Buffer.byteLength(rel) > CAPS.game_path_max_bytes) throw new Error(`path too long: ${rel}`);
    bytes += statSync(file).size;
  }
  if (bytes > CAPS.game_max_bytes) {
    throw new Error(`game/ is ${bytes} bytes; the cap is ${CAPS.game_max_bytes}`);
  }
  return { files: files.length, bytes };
}

/** Check the screenshots the entry ships: three or four, each inside the byte cap. */
function verifyScreenshots(outDir) {
  const dir = join(outDir, 'screenshots');
  const names = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort()
    : [];
  if (names.length < 3 || names.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/ holds ${names.length} images; the entry needs 3 or 4`);
  }
  let bytes = 0;
  for (const name of names) {
    const size = statSync(join(dir, name)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error(`${name} is ${size} bytes; the cap is ${CAPS.screenshots.max_bytes}`);
    }
    bytes += size;
  }
  return { names, bytes };
}

// 1. Where the output goes, and 2. an empty directory to build it in.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

// 3. The source folders this entry is made of, then 4. the copy.
const gameSource = join(here, 'game');
const screenshotSource = join(here, 'screenshots');
if (!existsSync(gameSource)) throw new Error('game/ is missing beside main.ts');
if (!existsSync(screenshotSource)) throw new Error('screenshots/ is missing beside main.ts');

cpSync(gameSource, join(output, 'game'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
for (const name of readdirSync(screenshotSource)) {
  if (name.startsWith('.')) continue;
  copyFileSync(join(screenshotSource, name), join(output, 'screenshots', name));
}

const game = verifyGame(output);
const shots = verifyScreenshots(output);

// The dossier: the screenshots and the game's own source, in the form the judge reads.
writeFileSync(join(output, 'dossier.json'), buildDossier(output, CAPS));

const dossierBytes = statSync(join(output, 'dossier.json')).size;
console.log(`nightwick: ${game.files} game files (${game.bytes} bytes), ${shots.names.length} screenshots (${shots.bytes} bytes)`);
console.log(`nightwick: wrote ${join(output, 'dossier.json')} (${dossierBytes} bytes)`);
console.log(`nightwick: cover is ${shots.names[0]}`);
