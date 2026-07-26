import { useCallback, useEffect, useRef } from 'react'
import PhotoSwipe from 'photoswipe'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import 'photoswipe/style.css'
import { icon } from './icons.js'

/**
 * Photoswipe, wired the way natural-gallery wires it: no `dataSource` and no
 * `gallery` selector, the slides are answered from `items` through the
 * `numItems` and `itemData` filters. That is what makes it work with virtual
 * scroll at all — the lightbox sees the whole collection while only a window of
 * it is in the DOM.
 *
 * @param options.items      ref holding every model fetched so far. A ref
 *                           because the array is replaced, not mutated.
 * @param options.elements   the index -> figure element map, for the zoom
 *                           transition
 * @param options.liked      like state of the photo currently on screen. The
 *                           heart in the top bar is an element photoswipe
 *                           built, so it is updated by hand.
 * @param options.onOpen     an image is about to be shown
 * @param options.onClose    the lightbox closed
 * @param options.onChange   another image is on screen, with its index
 * @param options.onNeedMore the end of the collection is in reach
 * @param options.onToggleDetails / onToggleLike  the two buttons we add
 */
export function useLightbox(options) {
  // Photoswipe holds its callbacks for as long as it lives, and the lightbox is
  // built once, so they read the current render through this ref instead.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const lightboxRef = useRef(null)
  /** The heart photoswipe puts in its top bar, created by `registerElement`. */
  const likeButtonRef = useRef(null)

  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      pswpModule: PhotoSwipe,
      // bgOpacity: 0.2,
      // wheelToZoom: true,
      loop: false,
    })

    lightbox.addFilter('numItems', () => optionsRef.current.items.current.length)

    lightbox.addFilter('itemData', (itemData, index) => {
      const model = optionsRef.current.items.current[index]
      if (!model) return itemData

      return {
        id: index,
        // A source that cannot offer a larger rendition than the thumbnail gets
        // the thumbnail blown up, which beats an empty lightbox.
        src: model.enlargedSrc || model.thumbnailSrc,
        width: model.enlargedWidth,
        height: model.enlargedHeight,
        msrc: model.thumbnailSrc,
        // Missing for a photo that has been scrolled out of the DOM, which
        // costs that photo its zoom transition and nothing else.
        element: optionsRef.current.elements.get(index) ?? undefined,
        thumbCropped: true,
        alt: model.alt || model.title,
      }
    })

    lightbox.on('beforeOpen', () => optionsRef.current.onOpen?.())
    lightbox.on('close', () => optionsRef.current.onClose?.())

    // Which photo is on screen drives both the details panel and the heart in
    // the top bar. Lightbox listeners are attached before the ui is built, so
    // this runs before photoswipe's own 'change' handlers.
    lightbox.on('change', () => {
      const index = lightbox.pswp?.currIndex ?? 0
      optionsRef.current.onChange?.(index)

      // Walking towards the end of the collection loads one more page, so the
      // lightbox can be browsed past what has been fetched.
      if (index > optionsRef.current.items.current.length - 10) {
        optionsRef.current.onNeedMore?.()
      }
    })

    lightbox.on('destroy', () => {
      likeButtonRef.current = null
      // With accessibility :focus usage, figures tend to stay sticky on focused
      // state. This returns to wanted behavior, as natural-gallery does.
      document.activeElement?.blur?.()
    })

    // The top bar only exists once photoswipe opens, hence 'uiRegister'.
    lightbox.on('uiRegister', () => {
      lightbox.pswp?.ui?.registerElement({
        name: 'details-button',
        ariaLabel: 'Toggle details',
        order: 8,
        isButton: true,
        className: 'details-toggle icon-shadow',
        html: icon('panel-right'),
        onClick: () => optionsRef.current.onToggleDetails?.(),
      })

      lightbox.pswp?.ui?.registerElement({
        name: 'like-button',
        ariaLabel: 'Like',
        order: 7,
        isButton: true,
        className: 'heart-like-icon icon-shadow',
        html: icon('heart'),
        onInit: (element) => {
          likeButtonRef.current = element
          element.classList.toggle('liked', Boolean(optionsRef.current.liked))
        },
        onClick: () => optionsRef.current.onToggleLike?.(),
      })
    })

    lightbox.init()
    lightboxRef.current = lightbox

    return () => {
      lightbox.destroy()
      lightboxRef.current = null
    }
  }, [])

  useEffect(() => {
    likeButtonRef.current?.classList.toggle('liked', Boolean(options.liked))
  }, [options.liked])

  const open = useCallback((index) => lightboxRef.current?.loadAndOpen(index), [])
  const close = useCallback(() => lightboxRef.current?.pswp?.close(), [])

  return { open, close }
}
