import { useContext, useEffect, useRef, useState } from 'react'
import { GalleryContext } from './galleryContext.js'
import { iconHref } from './icons.js'

/**
 * One masonry cell, i.e. what `<figure class="root">` is in natural-gallery:
 * the thumbnail, the label sliding up on hover, and the heart.
 *
 * Masonic hands us the width of the column and measures the height we end up
 * taking. The photos come with their dimensions, so the height is set from the
 * aspect ratio rather than left to the image: the cell is then measured at its
 * final size on the very first pass, whether or not the thumbnail has arrived,
 * and the grid never reflows around a loading image.
 */
export default function GalleryItem({ index, data, width }) {
  const { elements, onZoom, onToggleLike } = useContext(GalleryContext)
  const figureRef = useRef(null)
  const imageRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  const ratio = data.enlargedWidth / data.enlargedHeight || 1
  const height = Math.round(width / ratio)

  // Photoswipe zooms out of the figure it was opened from, so it needs the
  // element behind an index. Virtual scroll unmounts cells, hence the cleanup:
  // a photo scrolled out of view simply gets no zoom transition.
  useEffect(() => {
    const element = figureRef.current
    elements.set(index, element)

    return () => {
      if (elements.get(index) === element) {
        elements.delete(index)
      }
    }
  }, [elements, index])

  // A cached thumbnail can be complete before React attaches onLoad, which
  // would leave the figure at opacity 0 for good.
  useEffect(() => {
    if (imageRef.current?.complete) {
      setLoaded(true)
    }
  }, [data.thumbnailSrc])

  function zoomOnKey(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onZoom(index)
    }
  }

  return (
    <figure
      ref={figureRef}
      role="group"
      className={loaded ? 'figure loaded' : 'figure'}
      style={{ height }}
    >
      <img
        ref={imageRef}
        className="image"
        src={data.thumbnailSrc}
        alt={data.alt}
        width={width}
        height={height}
        loading="lazy"
        tabIndex={0}
        role="button"
        aria-label="zoom"
        onLoad={() => setLoaded(true)}
        onClick={() => onZoom(index)}
        onKeyDown={zoomOnKey}
      />

      <figcaption className="title hover link">
        <a href={data.link} target={data.linkTarget || '_blank'} rel="noreferrer">
          {data.title}
        </a>
      </figcaption>

      <button
        type="button"
        aria-label="Like"
        className={data.likeId ? 'heart-like-button liked' : 'heart-like-button'}
        onClick={(event) => {
          // The image underneath opens the lightbox when clicked
          event.preventDefault()
          event.stopPropagation()
          onToggleLike(data)
        }}
      >
        <svg className="icon">
          <use href={iconHref('heart')} />
        </svg>
      </button>
    </figure>
  )
}
