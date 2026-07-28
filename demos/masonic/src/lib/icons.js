/**
 * The symbols in public/icons.svg. Only inherited properties reach a sprite
 * symbol, so the drawing itself is done by `.icon` in assets/gallery.css.
 * BASE_URL keeps the reference right when the demo is served from a subpath.
 */
export const iconHref = (name) => `${import.meta.env.BASE_URL}icons.svg#${name}-icon`

/** Same icon as a string, for photoswipe, which builds its buttons itself. */
export const icon = (name) => `<svg class="icon"><use href="${iconHref(name)}"/></svg>`
