/**
 * Builds every demo in demos/ into one directory that can be served as a
 * single site:
 *
 *   dist/index.html   the landing page, from site/index.html
 *   dist/old/         @ecodev/natural-gallery-js 11.1.3, as released
 *   dist/first-demo/  the fork, with virtual scroll
 *   dist/masonic/     react + masonic, no natural-gallery at all
 *   dist/upstream/    upstream master, built from source in demos/upstream/vendor
 *
 * Each demo is built with `--base=/<name>/` so its assets resolve under its own
 * folder, which is also what the navigation between demos hangs off (BASE_URL).
 *
 *   node scripts/build-all.mjs             build everything
 *   node scripts/build-all.mjs first-demo  build one, leaving the rest in place
 */

import {execFileSync} from 'node:child_process';
import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const demosDir = join(root, 'demos');

const DEMOS = ['old', 'first-demo', 'masonic', 'upstream'];

const wanted = process.argv.slice(2);
const demos = wanted.length ? DEMOS.filter(demo => wanted.includes(demo)) : DEMOS;

if (!demos.length) {
  console.error(`Nothing to build. Known demos: ${DEMOS.join(', ')}`);
  process.exit(1);
}

// A full run owns the whole directory; a partial one only replaces its own folder
if (!wanted.length) {
  await rm(dist, {recursive: true, force: true});
}
await mkdir(dist, {recursive: true});

for (const demo of demos) {
  console.log(`\n=== ${demo} ===`);
  execFileSync('pnpm', ['--dir', join(demosDir, demo), 'build', `--base=/${demo}/`], {
    stdio: 'inherit',
  });

  const target = join(dist, demo);
  await rm(target, {recursive: true, force: true});
  await cp(join(demosDir, demo, 'dist'), target, {recursive: true});
  console.log(`copied to dist/${demo}/`);
}

await cp(join(root, 'site'), dist, {recursive: true});
console.log('\ncopied site/ to dist/');
console.log(`\nDone. Serve it with: npx serve ${dist}`);
