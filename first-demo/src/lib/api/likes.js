/**
 * Likes, stored in IndexedDB.
 *
 * This module wears two hats:
 *
 *   - the store behind the heart buttons: `add`, `remove`, `hydrate`, `count`
 *   - a board the gallery can browse, implementing the same three keys as
 *     `picsum`: `name`, `pageSize`, `fetchItems`
 *
 * A record keeps the whole gallery model, so the likes board renders without
 * touching the network. Paging walks the auto incremented primary key
 * backwards, newest first: this is the source the `lastId` cursor in the data
 * source contract was meant for.
 */

import {picsum} from './picsum.js';

/** Sources able to rebuild a thumbnail url for a model that came from them. */
const SOURCES = {[picsum.name]: picsum};

const DB_NAME = 'natural-gallery-demo';
const DB_VERSION = 1;
const STORE = 'likes';

/** Index over `[board, id]`: one like per photo, and how we find it again. */
const BY_PHOTO = 'board_id';

/** Likes per page. The data never leaves the machine, so this can be generous. */
const PAGE_SIZE = 200;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, {
          keyPath: 'likeId',
          autoIncrement: true,
        });
        store.createIndex(BY_PHOTO, ['board', 'id'], {unique: true});
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

/** Wrap one IndexedDB request in a promise. */
function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function objectStore(mode) {
  const db = await openDb();
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Key of the like for `model`, or null when the photo is not liked. */
async function keyFor(model) {
  const store = await objectStore('readonly');
  const key = await done(store.index(BY_PHOTO).getKey([model.board, model.id]));

  return key ?? null;
}

/** Read at most `limit` records, walking the keys backwards from `range`. */
function readPage(store, range, limit) {
  return new Promise((resolve, reject) => {
    const records = [];
    const request = store.openCursor(range, 'prev');

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(records);
        return;
      }

      records.push(cursor.value);
      records.length >= limit ? resolve(records) : cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

function toModel(record, thumbnailSize) {
  const model = {...record.model, likeId: record.likeId, likedAt: record.likedAt};
  const source = SOURCES[model.board];

  // The stored thumbnail url was sized for whatever gallery size was current
  // when the photo was liked, so let its source size it again.
  return thumbnailSize && source?.resizeThumbnail
    ? source.resizeThumbnail(model, thumbnailSize)
    : model;
}

export const likes = {
  name: 'likes',
  pageSize: PAGE_SIZE,

  async fetchItems({limit = PAGE_SIZE, lastId = null, thumbnailSize} = {}) {
    const wanted = Math.max(limit, 1);
    const store = await objectStore('readonly');

    // 'prev' walks the likeIds downwards, so the newest likes come first. The
    // cursor is the last key served, and the range starts just below it.
    const range = lastId === null ? null : IDBKeyRange.upperBound(lastId, true);
    const records = await readPage(store, range, wanted);
    const items = records.map(record => toModel(record, thumbnailSize));

    return {
      items,
      lastId: items.length ? items[items.length - 1].likeId : lastId,
      hasMore: records.length === wanted,
    };
  },

  resizeThumbnail(model, thumbnailSize) {
    const source = SOURCES[model.board];

    return source?.resizeThumbnail ? source.resizeThumbnail(model, thumbnailSize) : model;
  },

  /** Like a photo. Returns the id of the like, which marks the model as liked. */
  async add(model) {
    const existing = await keyFor(model);
    if (existing !== null) return existing;

    const store = await objectStore('readwrite');

    return done(
      store.add({
        board: model.board,
        id: model.id,
        likedAt: Date.now(),
        // Enough to show the photo again without asking the source for it.
        model: {...model, likeId: null},
      }),
    );
  },

  /** Unlike a photo. Returns null, the value `likeId` takes when not liked. */
  async remove(model) {
    const key = model.likeId ?? (await keyFor(model));
    if (key === null || key === undefined) return null;

    const store = await objectStore('readwrite');
    await done(store.delete(key));

    return null;
  },

  /**
   * Fill in `likeId` on freshly fetched models, so a photo shows as liked
   * whichever board it was reached from.
   */
  async hydrate(models) {
    if (!models.length) return models;

    const store = await objectStore('readonly');
    const index = store.index(BY_PHOTO);

    // Every request is issued before the first await, otherwise the read only
    // transaction would commit while we are still queueing lookups.
    const keys = await Promise.all(
      models.map(model => done(index.getKey([model.board, model.id]))),
    );
    models.forEach((model, i) => (model.likeId = keys[i] ?? null));

    return models;
  },

  async count() {
    const store = await objectStore('readonly');

    return done(store.count());
  },
};
