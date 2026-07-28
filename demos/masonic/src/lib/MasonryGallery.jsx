import { useRef } from 'react'
import { useWindowSize } from '@react-hook/window-size'
import {
  MasonryScroller,
  useContainerPosition,
  useInfiniteLoader,
  usePositioner,
  useResizeObserver,
} from 'masonic'
import GalleryItem from './GalleryItem.jsx'

/** natural-gallery's default gap between two figures, in pixels. */
const GAP = 3

/**
 * Cells are keyed on the photo rather than on their index, so that liking a
 * photo re-renders one cell instead of shifting them all.
 */
const itemKey = (data) => `${data.board}:${data.id}`

/**
 * The grid, assembled from masonic's own pieces rather than from its
 * batteries-included `<Masonry>`, for one reason: `<Masonry>` derives the
 * column count from `columnWidth` as a *minimum* width, while natural-gallery
 * treats the wanted size as a target it rounds the column count up from. Doing
 * the arithmetic here is what puts both demos on the same number of columns for
 * the same S/M/L. The rest — `useContainerPosition`, `usePositioner`,
 * `useResizeObserver`, `MasonryScroller` — is what `<Masonry>` does internally.
 *
 * Scrolling is the browser window's, which is what masonic is built around.
 *
 * @param props.items      every model fetched so far
 * @param props.size       wanted thumbnail size, i.e. a column of about that
 *                         many pixels
 * @param props.resetKey   changing it throws the measured layout away and
 *                         starts over, for when the collection is replaced
 * @param props.onLoadMore the end of the collection is in reach
 */
export default function MasonryGallery({ items, size, resetKey, onLoadMore }) {
  // Opted out of the React Compiler on purpose. The positioner is a mutable
  // object: when the column width changes, masonic's ResizeObserver re-measures
  // the cells, mutates the positioner in place and calls a `setState({})` to
  // have the new positions read back. None of this component's inputs change in
  // the process — the positioner is the same object — so the compiler would
  // hand React the element it cached, React would bail out of re-rendering the
  // subtree, and the re-measured positions would never reach the DOM. The
  // symptom is a resized window laying out with the heights of the old column
  // width: gaps when the columns get narrower, overlap when they get wider,
  // until a scroll mounts new cells.
  'use no memo'

  const containerRef = useRef(null)
  const [windowWidth, windowHeight] = useWindowSize()
  const { offset, width } = useContainerPosition(containerRef, [windowWidth, windowHeight])
  // The container is only measured after the first layout pass
  const gridWidth = width || windowWidth
  const columnCount = Math.max(1, Math.ceil((gridWidth - GAP) / (size + GAP)))

  const positioner = usePositioner({ width: gridWidth, columnCount, columnGutter: GAP }, [resetKey])
  const resizeObserver = useResizeObserver(positioner)

  const maybeLoadMore = useInfiniteLoader(onLoadMore, {
    isItemLoaded: (index, loaded) => Boolean(loaded[index]),
    // Ask for the next page about three rows before running out. masonic
    // renders two windows worth of cells ahead of the viewport on its own, so
    // this is on top of a comfortable buffer already.
    threshold: 3 * columnCount,
  })

  return (
    <MasonryScroller
      containerRef={containerRef}
      positioner={positioner}
      resizeObserver={resizeObserver}
      offset={offset}
      width={gridWidth}
      height={windowHeight}
      items={items}
      itemKey={itemKey}
      // Photos are about 4:3 on average, so this is a better guess than
      // masonic's 300px default at estimating the height of what has not been
      // measured yet: it decides the scrollbar and how many cells to measure
      // in one pass.
      itemHeightEstimate={Math.round((positioner.columnWidth * 3) / 4)}
      render={GalleryItem}
      onRender={maybeLoadMore}
    />
  )
}
