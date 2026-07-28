import { createContext } from 'react'

/**
 * What a cell needs from the gallery around it.
 *
 * Masonic memoizes the element it builds for a cell on the identity of the
 * component passed as `render`, so that component has to be defined once, at
 * the top level of a module. A context is how the callbacks reach it without
 * being props.
 *
 *   elements     index -> figure element, kept for photoswipe's zoom
 *                transition. Only the cells currently rendered are in it.
 *   onZoom       open the lightbox on a cell
 *   onToggleLike like or unlike the photo of a cell
 */
export const GalleryContext = createContext({
  elements: new Map(),
  onZoom: () => {},
  onToggleLike: () => {},
})
