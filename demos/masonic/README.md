# React + Vite

## The masonic demo

The same gallery as the other demos — same photos, same chrome, same hearts,
same lightbox — but laid out by [masonic](https://github.com/jaredLunde/masonic)
instead of by natural-gallery, as a reference point for what a state of the art
virtual scroll behaves like. Masonic only does masonry, so the Natural and
Square buttons are gone; S/M/L set the column width instead of the row height.

```bash
pnpm install
pnpm dev
```

Where it deliberately differs from `upstream/` and `first-demo/`:

- **The window scrolls, not a `<main>` element.** That is what masonic is built
  around (`useScroller` reads `window.scrollY`), so the navigation rail is
  sticky and the mobile bar is fixed rather than being grid rows around a
  scroller.
- **The column count is computed by hand** in `lib/MasonryGallery.jsx`, which is
  why the grid is assembled from `useContainerPosition` + `usePositioner` +
  `MasonryScroller` rather than from the batteries-included `<Masonry>`.
  Masonic reads `columnWidth` as a minimum and rounds the count *down*;
  natural-gallery reads it as a target and rounds *up*. Without this the two
  demos show a different number of columns for the same S/M/L.
- **Cell heights come from the photo's aspect ratio**, set as an inline style on
  the figure. Masonic still measures the cell, it just always measures the final
  height, so the grid never reflows around a thumbnail that arrives late.
- **The grid is remounted when S/M/L changes.** When the column width changes,
  masonic keeps the heights it has already measured and re-measures only what is
  on screen, so the layout below the viewport stays wrong until you scroll into
  it. A fresh grid is the equivalent of the `rebuildGallery()` the other demos
  do. Window resizes still take masonic's own incremental path.
- **`MasonryGallery` opts out of the React Compiler** (`'use no memo'`). Masonic
  re-measures cells into a mutable positioner and then calls a bare
  `setState({})` to have the new positions read back. No input of the component
  changes in the process, so the compiler hands React the element it cached,
  React bails out of re-rendering the subtree, and the re-measured positions
  never reach the DOM — a resized window lays out with the heights of the old
  column width until a scroll mounts new cells. Worth knowing about for any
  React wrapper around a library that keeps layout state in a mutable object.
- **Photoswipe is wired directly** (`lib/useLightbox.js`) the way
  natural-gallery wires it: no `dataSource` and no `gallery` selector, slides
  answered from the model list through the `numItems` and `itemData` filters.
  That is what lets the lightbox browse the whole collection while only a window
  of it is in the DOM.

`lib/api/` is a copy of the same folder in the other demos.

## Boards

Four data sources, switched from the button group at the bottom right. All of
them implement the contract documented at the top of `lib/api/picsum.js`, and
between them they cover every branch of it.

| Board | Source | Images | Pagination | Thumbnails |
| --- | --- | --- | --- | --- |
| Picsum | picsum.photos | ~1 000 | page number | any size |
| Commons | Wikimedia Commons, `Category:Quality images` | ~450 000 | **cursor** (`gcmcontinue` through `lastId`) | fixed per fetch — no `resizeThumbnail` |
| Art | Cleveland Museum of Art open access | ~41 000, CC0 | offset (`skip`) | fixed — no `resizeThumbnail` |
| Likes | IndexedDB | what you liked | cursor (primary key) | per originating source |

None of them needs an API key, so nothing has to be kept out of the repository.
Three details are worth knowing:

- **Commons thumbnail urls cannot be rewritten.** They look guessable —
  `…/<hash>/<file>/<width>px-<file>` — but upload.wikimedia.org only serves the
  widths it has already generated and answers any other with a 400 and an html
  error page, which the browser then rejects as a non-image response. Which
  widths exist differs per file. Only two urls can be trusted: the one the api
  hands out, used for the grid, and `Special:FilePath?width=`, which has
  mediawiki render the size asked for and redirects to it. That redirect is not
  cached, so it is worth one request per photo opened in the lightbox and not
  one in front of every thumbnail in the grid.
- **Commons pages hold 50 items**, because mediawiki resolves `prop=imageinfo`
  for at most 50 titles per request however many the generator returns.
- **The museum's records are ~22 kB each** of curatorial metadata, with no way
  to ask for fewer fields, which is what keeps its page size at 50 as well.

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
