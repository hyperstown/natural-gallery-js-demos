import {writable} from 'svelte/store';

/**
 * True while an image is opened in the lightbox.
 *
 * Kept in a store rather than in App.svelte because it is written from
 * photoswipe callbacks and from the `popstate` handler, and read back by both
 * to tell "the user closed the image" apart from "the browser navigated".
 */
export const image = writable(false);
