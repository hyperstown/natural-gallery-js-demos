# natural-gallery-js demos

The same photo gallery — infinite scroll, lightbox, likes stored in IndexedDB, four photo
sources — built four ways, to compare how each one scrolls, lays out and loads.

| demo | what it is |
|---|---|
| [`demos/old`](demos/old) | `@ecodev/natural-gallery-js@11.1.3`, as released — no virtual scroll |
| [`demos/first-demo`](demos/first-demo) | the fork, with its `virtualScroll` option |
| [`demos/masonic`](demos/masonic) | no natural-gallery at all: React + `masonic` + photoswipe |
| [`demos/upstream`](demos/upstream) | upstream master, built from a checkout in `vendor/` |

## Running

```bash
pnpm --dir demos/first-demo install   # once per demo
pnpm --dir demos/first-demo dev       # one demo on its own

pnpm build                            # all four into dist/, plus the landing page
pnpm preview                          # serve dist/ (--host to expose it, --port to move it)
```

`pnpm build` puts each demo under its own path (`/old`, `/first-demo`, `/masonic`,
`/upstream`) with `site/index.html` as the index, so `dist/` can be dropped on any static host.

## Notes

Photos come from [picsum.photos](https://picsum.photos), [Wikimedia
Commons](https://commons.wikimedia.org) and the [Cleveland Museum of
Art](https://openaccess-api.clevelandart.org). None of them are mine.
