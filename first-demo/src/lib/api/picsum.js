/**
 * Data source for https://picsum.photos
 *
 * A data source is a plain object with:
 *
 *   name        identifier, used as the key in `API_LIST`
 *   pageSize    how many items one `fetchItems()` call returns at most
 *   fetchItems  ({page, limit, lastId, thumbnailSize, signal}) => Promise<Page>
 *
 * A `Page` is `{items, lastId, hasMore}`:
 *
 *   items       gallery models (natural-gallery `ModelAttributes`)
 *   lastId      id of the last item served. It is handed back as `lastId` on
 *               the next call, so a cursor based API can ask for "the items
 *               after / below this id" instead of a page number.
 *   hasMore     false once the source has nothing left to give
 *
 * Picsum only paginates by page number (`?page=&limit=`, limit capped at 100,
 * ~10 pages of content in total), so it reports `lastId` but ignores the one it
 * receives. Swapping in a cursor based API means writing another object with
 * the same three keys, nothing in App.svelte changes.
 */

const BASE_URL = 'https://picsum.photos';

/** Picsum silently caps `limit` at 100 items per page. */
const MAX_LIMIT = 100;

/** Longest side of a thumbnail, in pixels, when the caller has no preference. */
const DEFAULT_THUMBNAIL_SIZE = 600;

/** Longest side of the version opened in the lightbox. */
const ENLARGED_SIZE = 1600;

/**
 * Scale `width`/`height` down until its longest side is `longestSide`.
 * Never upscales, so small originals are served untouched.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} longestSide
 * @returns {[number, number]}
 */
function fit(width, height, longestSide) {
  const ratio = Math.min(longestSide / Math.max(width, height), 1);
  return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
}

/**
 * Thumbnails are requested at the size they are displayed at, accounting for
 * high density screens. Snapped to 100px steps to keep the URLs (and therefore
 * the picsum/browser caches) shared between similar gallery sizes.
 *
 * @param {number | undefined} hint longest side the gallery wants, in CSS pixels
 * @returns {number}
 */
function thumbnailSizeFor(hint) {
  const density = Math.min(globalThis.devicePixelRatio || 1, 2);
  const wanted = (hint || DEFAULT_THUMBNAIL_SIZE) * density;
  return Math.min(Math.max(Math.round(wanted / 100) * 100, 200), 1200);
}

/**
 * One entry of the picsum list endpoint.
 *
 * @typedef {object} PicsumPhoto
 * @property {string} id
 * @property {string} author
 * @property {number} width
 * @property {number} height
 * @property {string} url page of the photo on unsplash
 */

/**
 * What the gallery consumes: natural-gallery `ModelAttributes`, plus the id of
 * the source photo.
 *
 * @typedef {object} GalleryModel
 * @property {string} id
 * @property {string} thumbnailSrc
 * @property {string} enlargedSrc
 * @property {number} enlargedWidth
 * @property {number} enlargedHeight
 * @property {string} title
 * @property {string} alt
 * @property {string} link
 * @property {'_blank'} linkTarget
 */

/**
 * @param {PicsumPhoto} photo
 * @param {number} thumbnailSize
 * @returns {GalleryModel}
 */
function toModel(photo, thumbnailSize) {
  const [thumbnailWidth, thumbnailHeight] = fit(photo.width, photo.height, thumbnailSize);
  const [enlargedWidth, enlargedHeight] = fit(photo.width, photo.height, ENLARGED_SIZE);

  return {
    id: photo.id,
    thumbnailSrc: `${BASE_URL}/id/${photo.id}/${thumbnailWidth}/${thumbnailHeight}`,
    // Photoswipe needs the real dimensions of the enlarged image, and picsum
    // serves exactly the size asked for, so both come from the same numbers.
    enlargedSrc: `${BASE_URL}/id/${photo.id}/${enlargedWidth}/${enlargedHeight}`,
    enlargedWidth,
    enlargedHeight,
    title: photo.author,
    alt: `Photo by ${photo.author}`,
    link: photo.url,
    linkTarget: '_blank',
  };
}

export const picsum = {
  name: 'picsum',
  pageSize: MAX_LIMIT,

  /**
   * @param {object} [request]
   * @param {number} [request.page] 1 based page number
   * @param {number} [request.limit] items wanted, clamped to `pageSize`
   * @param {string | null} [request.lastId] cursor, unused by picsum
   * @param {number} [request.thumbnailSize] longest thumbnail side, in CSS pixels
   * @param {AbortSignal} [request.signal]
   */
  async fetchItems({page = 1, limit = MAX_LIMIT, thumbnailSize, signal} = {}) {
    const wanted = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const response = await fetch(`${BASE_URL}/v2/list?page=${page}&limit=${wanted}`, {signal});

    if (!response.ok) {
      throw new Error(`picsum responded ${response.status} ${response.statusText}`);
    }

    const photos = /** @type {PicsumPhoto[]} */ (await response.json());
    const size = thumbnailSizeFor(thumbnailSize);
    const items = photos.map(photo => toModel(photo, size));

    return {
      items,
      lastId: items.length ? items[items.length - 1].id : null,
      // A short page means we reached the end of the list. Picsum answers with
      // an empty array past the last page, which lands here as well.
      hasMore: photos.length === wanted,
    };
  },

  /**
   * Point an already fetched model at a thumbnail of a different size, so that
   * growing the gallery re-downloads instead of upscaling what we have.
   *
   * Optional part of the contract: a source serving fixed size thumbnails just
   * leaves it out.
   *
   * @param {GalleryModel} model
   * @param {number} thumbnailSize longest thumbnail side, in CSS pixels
   * @returns {GalleryModel}
   */
  resizeThumbnail(model, thumbnailSize) {
    const [width, height] = fit(
      model.enlargedWidth,
      model.enlargedHeight,
      thumbnailSizeFor(thumbnailSize),
    );

    return {...model, thumbnailSrc: `${BASE_URL}/id/${model.id}/${width}/${height}`};
  },
};
