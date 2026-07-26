# Svelte + Vite

This template should help get you started developing with Svelte in Vite.

## Upstream natural-gallery-js

This demo runs the **upstream** `@ecodev/natural-gallery-js` at its latest
`master` commit, not the npm release. Upstream ships no build in its repository
— its root `package.json` is a template that `tsdown` copies into `dist/`, where
the `exports` finally resolve — so `pnpm add github:Ecodev/natural-gallery-js`
installs a package whose entry points do not exist. It has to be built locally.

```bash
pnpm install              # builds upstream on first run, no-ops afterwards
pnpm upstream:update      # pull the newest master and rebuild

# build a different branch, tag or commit
node scripts/build-upstream.mjs --ref 11.1.3 && pnpm install
NG_UPSTREAM_REPO=https://github.com/you/fork.git pnpm upstream:update
```

Requires `git` and `pnpm` on PATH. **pnpm only**: the dependency uses the
`link:` protocol, which npm does not support.

### How it works

- `scripts/build-upstream.mjs` clones the repo into `vendor/checkout`
  (gitignored), runs upstream's own `pnpm build`, and records the built commit
  in `vendor/.built-ref`. It is a full clone because the build stamps its
  version with `git describe --tags`.
- `vendor/package.json` is a committed stub whose `exports` point into
  `vendor/checkout/dist`, the same folder upstream publishes to npm. Deleting
  `vendor/` is harmless: every run of the script writes the stub back when it is
  missing, so `pnpm install` and `pnpm dev` both recover on their own.
- The dependency is `link:vendor` rather than `file:vendor`. With `file:` pnpm
  packs the folder during resolution, i.e. before `preinstall` has built
  anything, and only the stub itself gets installed.
- `dev` and `build` first run the script with `--if-missing`. It returns
  immediately when a build is present, without touching the network, and
  otherwise restores the commit in `vendor/.built-ref` — pnpm skips lifecycle
  scripts when the lockfile is already satisfied, so `pnpm install` alone
  cannot be relied on to bring a deleted checkout back.

Because `vendor` is symlinked into `node_modules`, rebuilding upstream is picked
up without reinstalling. Note that `vendor/.built-ref` is gitignored, so a fresh
clone always gets the newest `master`; commit it or pass `--ref <sha>` if you
want the comparison pinned to a fixed commit.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Need an official Svelte framework?

Check out [SvelteKit](https://github.com/sveltejs/kit#readme), which is also powered by Vite. Deploy anywhere with its serverless-first approach and adapt to various platforms, with out of the box support for TypeScript, SCSS, and Less, and easily-added support for mdsvex, GraphQL, PostCSS, Tailwind CSS, and more.

## Technical considerations

**Why use this over SvelteKit?**

- It brings its own routing solution which might not be preferable for some users.
- It is first and foremost a framework that just happens to use Vite under the hood, not a Vite app.

This template contains as little as possible to get started with Vite + Svelte, while taking into account the developer experience with regards to HMR and intellisense. It demonstrates capabilities on par with the other `create-vite` templates and is a good starting point for beginners dipping their toes into a Vite + Svelte project.

Should you later need the extended capabilities and extensibility provided by SvelteKit, the template has been structured similarly to SvelteKit so that it is easy to migrate.

**Why include `.vscode/extensions.json`?**

Other templates indirectly recommend extensions via the README, but this file allows VS Code to prompt the user to install the recommended extension upon opening the project.

**Why enable `checkJs` in the JS template?**

It is likely that most cases of changing variable types in runtime are likely to be accidental, rather than deliberate. This provides advanced typechecking out of the box. Should you like to take advantage of the dynamically-typed nature of JavaScript, it is trivial to change the configuration.

**Why is HMR not preserving my local component state?**

HMR state preservation comes with a number of gotchas! It has been disabled by default in both `svelte-hmr` and `@sveltejs/vite-plugin-svelte` due to its often surprising behavior. You can read the details [here](https://github.com/sveltejs/svelte-hmr/tree/master/packages/svelte-hmr#preservation-of-local-state).

If you have state that's important to retain within a component, consider creating an external store which would not be replaced by HMR.

```js
// store.js
// An extremely simple external store
import { writable } from 'svelte/store'
export default writable(0)
```
