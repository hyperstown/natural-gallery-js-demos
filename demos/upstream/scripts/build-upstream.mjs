/**
 * Builds @ecodev/natural-gallery-js straight from GitHub.
 *
 * Upstream does not publish a build to its repository: the root `package.json`
 * is a template that `tsdown` copies into `dist/`, where its `exports` finally
 * point at real files. So a plain `npm i github:Ecodev/natural-gallery-js`
 * installs an unusable package. Instead we clone the repo into
 * `vendor/checkout`, run its own build, and depend on `file:vendor`, a small
 * committed stub whose `exports` point into `vendor/checkout/dist` — the exact
 * same folder upstream publishes to npm.
 *
 * Runs from `preinstall` and no-ops while the checkout already matches the
 * remote tip.
 *
 * Usage:
 *   node scripts/build-upstream.mjs [--force] [--ref <branch|tag|sha>]
 *   node scripts/build-upstream.mjs --if-missing
 *   NG_UPSTREAM_REPO=… NG_UPSTREAM_REF=… node scripts/build-upstream.mjs
 *
 * `--if-missing` guards `dev` and `build`: pnpm skips lifecycle scripts when
 * the lockfile is already satisfied, so an install alone cannot be trusted to
 * restore a checkout that was deleted by hand. It returns immediately when a
 * build is present and never touches the network in that case, and otherwise
 * rebuilds the commit last recorded rather than whatever is newest.
 */

import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const vendor = join(root, 'vendor');
const checkout = join(vendor, 'checkout');
const dist = join(checkout, 'dist');
const stamp = join(vendor, '.built-ref');
const manifest = join(vendor, 'package.json');

/**
 * `vendor/package.json` is committed, but it sits next to a gitignored checkout
 * and is easy to wipe along with it — after which pnpm links a folder with no
 * manifest and vite fails to resolve the gallery. Cheap to write it back.
 */
const stub = {
    name: '@ecodev/natural-gallery-js',
    description:
        'Stub that exposes the upstream build in ./checkout/dist as a package. Committed on purpose: pnpm resolves local dependencies before it runs the root preinstall, so this file must exist before ../scripts/build-upstream.mjs has had a chance to run. The root depends on it through `link:`, which symlinks the folder as-is — with `file:` pnpm packs it during resolution, i.e. before checkout/dist exists. The version is static to keep lockfiles stable, the real one is in checkout/dist/package.json.',
    version: '0.0.0-upstream',
    license: 'MIT',
    type: 'module',
    exports: {
        '.': './checkout/dist/natural-gallery.js',
        './natural-gallery.css': './checkout/dist/natural-gallery.css',
    },
    typings: './checkout/dist/natural-gallery.d.ts',
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const ifMissing = args.includes('--if-missing');
const refArg = args.indexOf('--ref');
const repo = process.env.NG_UPSTREAM_REPO ?? 'https://github.com/Ecodev/natural-gallery-js.git';
const ref = refArg === -1 ? (process.env.NG_UPSTREAM_REF ?? 'master') : args[refArg + 1];

/**
 * We are called from a lifecycle script, so the environment is full of
 * `npm_config_*` and `npm_lifecycle_*` variables belonging to *this* install.
 * Upstream's build shells out to pnpm, which would read them as its own
 * settings, so hand the child a clean environment.
 */
const env = Object.fromEntries(
    Object.entries(process.env).filter(
        ([key]) => !/^(npm_|pnpm_|PNPM_|NODE_ENV$|NODE_OPTIONS$|INIT_CWD$)/.test(key),
    ),
);

const run = (cmd, cmdArgs, cwd = root) =>
    execFileSync(cmd, cmdArgs, {cwd, env, stdio: 'inherit', shell: process.platform === 'win32'});

const capture = (cmd, cmdArgs, cwd = root) =>
    execFileSync(cmd, cmdArgs, {
        cwd,
        env,
        encoding: 'utf8',
        shell: process.platform === 'win32',
    }).trim();

/** The commit `ref` currently points to on the remote, without cloning. */
function remoteSha() {
    const lines = capture('git', ['ls-remote', repo, ref, `refs/tags/${ref}`]);
    if (lines) {
        return lines.split('\n')[0].split('\t')[0];
    }

    // Not a branch or tag, so assume `ref` is already a commit sha.
    return ref;
}

// Before any early exit: a present build is worthless without the manifest that
// exposes it.
if (!existsSync(manifest)) {
    mkdirSync(vendor, {recursive: true});
    writeFileSync(manifest, `${JSON.stringify(stub, null, 4)}\n`);
    console.log('natural-gallery-js: restored the missing vendor/package.json stub');
}

const isBuilt = () => existsSync(join(dist, 'natural-gallery.js'));
const built = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null;

if (ifMissing && isBuilt()) {
    process.exit(0);
}

// Restoring a deleted checkout should reproduce what was there, not silently
// move the demo to a newer commit.
const wanted = ifMissing && built ? built : remoteSha();

if (!force && built === wanted && isBuilt()) {
    console.log(`natural-gallery-js: ${ref} @ ${wanted.slice(0, 8)} already built, skipping`);
    process.exit(0);
}

console.log(`natural-gallery-js: building ${repo} ${ref} @ ${wanted.slice(0, 8)}`);
rmSync(stamp, {force: true});

if (!existsSync(join(checkout, '.git'))) {
    rmSync(checkout, {recursive: true, force: true});
    // A full clone on purpose: the build stamps the version with
    // `git describe --tags`, which needs the tag history.
    run('git', ['clone', repo, checkout]);
} else {
    run('git', ['fetch', '--tags', '--force', 'origin'], checkout);
}

run('git', ['checkout', '--force', '--detach', wanted], checkout);
run('git', ['clean', '-xdff', '--exclude=node_modules'], checkout);

// Upstream is a pnpm project (see its `packageManager` field) and its build
// script shells out to `pnpm version`, so pnpm it is.
run('pnpm', ['install', '--no-frozen-lockfile'], checkout);
run('pnpm', ['run', 'build'], checkout);

writeFileSync(stamp, `${wanted}\n`);

const {version} = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8'));
console.log(`natural-gallery-js: built ${version} into ${dist}`);
