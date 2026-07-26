/**
 * Data source for https://commons.wikimedia.org
 *
 * Same three keys as picsum — see picsum.js for the contract — against
 * `Category:Quality images`, a peer reviewed pool of some 450'000 photos. This
 * is the source to point the demo at when a thousand pictures are not enough.
 *
 * It differs from picsum in two ways that are worth having covered:
 *
 *   - it paginates by cursor, not by page number. The api hands back a
 *     `gcmcontinue` token, which is what the `lastId` field of the contract was
 *     meant for.
 *   - the size of a thumbnail is not ours to choose, so it leaves
 *     `resizeThumbnail` out — the optional part of the contract. See
 *     `enlargedUrl` below for why.
 *
 * No key and no account: mediawiki answers cross origin requests as long as
 * `origin=*` is part of the query string. The files themselves are under
 * various free licences (mostly CC BY-SA, some CC0 or public domain), so each
 * model carries its author and licence, and links to the file page where the
 * full credit lives.
 */

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

const CATEGORY = 'Category:Quality images';

/**
 * `prop=imageinfo` is resolved for at most 50 titles per request, however many
 * the generator returns, so asking for more only produces items without any
 * image to show.
 */
const MAX_LIMIT = 50;

/** Longest side of a thumbnail, in pixels, when the caller has no preference. */
const DEFAULT_THUMBNAIL_SIZE = 600;

/** Longest side of the version opened in the lightbox. */
const ENLARGED_SIZE = 1600;

/**
 * Scale `width`/`height` down until its longest side is `longestSide`.
 * Never upscales, so small originals are served untouched.
 */
function fit(width, height, longestSide) {
  const ratio = Math.min(longestSide / Math.max(width, height), 1);
  return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
}

/**
 * Thumbnails are requested at the size they are displayed at, accounting for
 * high density screens. Snapped to 100px steps to keep the URLs (and therefore
 * the wikimedia/browser caches) shared between similar gallery sizes.
 */
function thumbnailSizeFor(hint) {
  const density = Math.min(globalThis.devicePixelRatio || 1, 2);
  const wanted = (hint || DEFAULT_THUMBNAIL_SIZE) * density;
  return Math.min(Math.max(Math.round(wanted / 100) * 100, 200), 1200);
}

/**
 * Url of `title` rendered `width` pixels wide.
 *
 * Thumbnail urls look guessable — `…/<hash>/<file>/<width>px-<file>` — but they
 * are not: upload.wikimedia.org only serves the widths it has already
 * generated, and answers 400 with an html error page for any other, which the
 * browser then refuses as a non-image response. Which widths exist differs from
 * file to file, so the only two urls that can be trusted are the one the api
 * hands out and this one: `Special:FilePath` has mediawiki render the size asked
 * for and redirects to it.
 *
 * That redirect is not cached, so it is worth one request per photo opened in
 * the lightbox and would not be worth one in front of every thumbnail in the
 * grid — hence no `resizeThumbnail` on this source. Thumbnails are instead
 * requested at the current gallery size when their page is fetched.
 */
function enlargedUrl(title, width) {
  const file = encodeURIComponent(title.replace(/^File:/, '').replace(/ /g, '_'));

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=${width}`;
}

/** `extmetadata` values are html fragments, the gallery wants text. */
function plainText(html) {
  if (!html) return '';

  // Parsed into an inert document: no scripts run and no images are fetched.
  const parsed = new DOMParser().parseFromString(String(html), 'text/html');

  return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/** "File:Pretty sunset over Bergen.jpg" -> "Pretty sunset over Bergen" */
function readableName(title) {
  return title
    .replace(/^File:/, '')
    .replace(/\.\w+$/, '')
    .replace(/_/g, ' ');
}

/**
 * Turn one page of the query result into what the gallery consumes. Returns
 * null for a file mediawiki could not render a thumbnail for, which the caller
 * drops.
 */
function toModel(page) {
  const info = page.imageinfo?.[0];
  if (!info?.thumburl) return null;

  const metadata = info.extmetadata || {};
  const author = plainText(metadata.Artist?.value);
  const licence = plainText(metadata.LicenseShortName?.value);
  const description = plainText(metadata.ImageDescription?.value);
  const name = readableName(page.title);
  const [enlargedWidth, enlargedHeight] = fit(info.width, info.height, ENLARGED_SIZE);

  return {
    id: page.pageid,
    // The width mediawiki picked itself rather than the one asked for: it snaps
    // to the sizes it keeps rendered, which are the ones already in its caches.
    thumbnailSrc: info.thumburl,
    enlargedSrc: enlargedUrl(page.title, enlargedWidth),
    enlargedWidth,
    enlargedHeight,
    title: author || name,
    alt: description || name,
    // The file page, which carries the licence and the full credit
    link: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    linkTarget: '_blank',

    // likes
    likeId: null,

    // extra
    board: 'commons',
    downloadLink: info.url,
    artists: author,
    copyright: licence,
    characters: [],
    tags: [
      'quality image',
      ...(Math.max(info.width, info.height) > 3000 ? ['high res'] : []),
      (page.title.split('.').pop() || '').toLowerCase(),
    ].filter(Boolean),
  };
}

export const commons = {
  name: 'commons',
  pageSize: MAX_LIMIT,

  async fetchItems({limit = MAX_LIMIT, lastId = null, thumbnailSize, signal} = {}) {
    const wanted = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const parameters = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      // Asks mediawiki for the CORS header, which is what makes this callable
      // from a browser without a key.
      origin: '*',
      generator: 'categorymembers',
      gcmtitle: CATEGORY,
      gcmtype: 'file',
      gcmlimit: String(wanted),
      // Most recently promoted photos first, which beats the alphabetical order
      // the category is stored in.
      gcmsort: 'timestamp',
      gcmdir: 'descending',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription',
      iiurlwidth: String(thumbnailSizeFor(thumbnailSize)),
    });

    // The cursor of the previous page. Absent on the first one.
    if (lastId) {
      parameters.set('gcmcontinue', lastId);
    }

    const response = await fetch(`${ENDPOINT}?${parameters}`, {signal});

    if (!response.ok) {
      throw new Error(`commons responded ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();

    // Mediawiki reports its own errors with a 200
    if (payload.error) {
      throw new Error(`commons: ${payload.error.info || payload.error.code}`);
    }

    const items = (payload.query?.pages ?? []).map(toModel).filter(Boolean);
    const cursor = payload.continue?.gcmcontinue ?? null;

    return {
      items,
      // Handed back as `lastId` on the next call
      lastId: cursor,
      // No cursor means the category has been walked to its end
      hasMore: Boolean(cursor),
    };
  },

  // No resizeThumbnail: see enlargedUrl above. The thumbnail urls commons hands
  // out cannot be rewritten to another width, so growing the gallery keeps the
  // thumbnails already downloaded and only asks for the following pages at the
  // new size. Reload fetches the whole collection again at the current one.
};
