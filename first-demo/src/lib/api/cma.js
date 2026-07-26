/**
 * Data source for the Cleveland Museum of Art open access collection.
 *
 * Same three keys as picsum — see picsum.js for the contract — against the
 * 41'000 artworks the museum has released under CC0. No key, no attribution
 * required, commercial use included.
 *
 * Two things make it a useful counterpart to the photo sources:
 *
 *   - the aspect ratios are extreme, roughly 1:3 to 3:1, which is a far harder
 *     masonry layout than a folder of 3:2 photographs.
 *   - it serves each image at fixed sizes only, so it leaves `resizeThumbnail`
 *     out. That is the optional part of the contract, and this is the source
 *     that exercises the gallery without it.
 */

const ENDPOINT = 'https://openaccess-api.clevelandart.org/api/artworks/';

/**
 * The api answers up to 1000 records, but every one of them carries its whole
 * curatorial file — provenance, exhibitions, citations — and there is no way to
 * ask for fewer fields, so 100 records are already better than 2 MB of json.
 */
const MAX_LIMIT = 50;

/**
 * Creators read "John Singleton Copley (American, born The Thirteen Colonies,
 * 1738–1815)". The chips in the details panel only want the name.
 */
function creatorName(description) {
  return String(description || '')
    .split(' (')[0]
    .trim();
}

/**
 * Turn one artwork into what the gallery consumes. Returns null for a record
 * whose image is missing, which the caller drops.
 */
function toModel(artwork) {
  const image = artwork.images?.web;
  if (!image?.url) return null;

  const width = Number(image.width);
  const height = Number(image.height);
  if (!width || !height) return null;

  const creators = (artwork.creators || []).map(creator => creatorName(creator.description));
  const artists = creators.filter(Boolean);

  return {
    id: artwork.id,
    thumbnailSrc: image.url,
    // The `print` rendition is 3400px of jpeg, around 6 MB, which is too much
    // to open a lightbox with. The 900px one is shown enlarged as well, and the
    // big file is offered as the download instead.
    enlargedSrc: image.url,
    enlargedWidth: width,
    enlargedHeight: height,
    title: artwork.title || 'Untitled',
    alt: [artwork.title, artists[0]].filter(Boolean).join(' — ') || 'Artwork',
    link: artwork.url,
    linkTarget: '_blank',

    // likes
    likeId: null,

    // extra
    board: 'cma',
    downloadLink: artwork.images?.print?.url || image.url,
    // The details panel splits on ' & ' to get one chip per artist
    artists: artists.join(' & '),
    copyright: artwork.share_license_status || 'CC0',
    characters: [],
    tags: [artwork.type, artwork.technique, ...(artwork.culture || []), artwork.creation_date]
      .filter(Boolean)
      .map(tag => String(tag)),
  };
}

export const cma = {
  name: 'cma',
  pageSize: MAX_LIMIT,

  async fetchItems({page = 1, limit = MAX_LIMIT, signal} = {}) {
    const wanted = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const skip = (page - 1) * wanted;
    const parameters = new URLSearchParams({
      // Only the records that have an image, and only the ones we are allowed
      // to show
      has_image: '1',
      cc0: '1',
      limit: String(wanted),
      skip: String(skip),
    });

    const response = await fetch(`${ENDPOINT}?${parameters}`, {signal});

    if (!response.ok) {
      throw new Error(`cleveland museum of art responded ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const artworks = payload.data ?? [];
    const items = artworks.map(toModel).filter(Boolean);
    const total = payload.info?.total ?? 0;

    return {
      items,
      lastId: items.length ? items[items.length - 1].id : null,
      // A short page, or a full one that reaches the end of the collection
      hasMore: artworks.length === wanted && skip + artworks.length < total,
    };
  },
};
