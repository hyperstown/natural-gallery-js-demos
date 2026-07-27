import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from '@skeletonlabs/skeleton-react'
import {
  ArchiveIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GitBranchIcon,
  ImageIcon,
  ImagesIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from 'lucide-react'
import DisclaimerDialog from './components/DisclaimerDialog.jsx'
import ImageDetails from '@lib/ImageDetails.jsx'
import MasonryGallery from '@lib/MasonryGallery.jsx'
import { GalleryContext } from '@lib/galleryContext.js'
import { useLightbox } from '@lib/useLightbox.js'
import { picsum } from '@api/picsum.js'
import { commons } from '@api/commons.js'
import { cma } from '@api/cma.js'
import { likes } from '@api/likes.js'
import '@assets/gallery.css'

const DEFAULT_SIZE = 400

/** Wanted thumbnail size, in pixels. Masonry only, so this is a column width. */
const GALLERY_SIZES = [
  { label: 'S', size: 250 },
  { label: 'M', size: 400 },
  { label: 'L', size: 600 },
]

const DEFAULT_BOARD = 'picsum'
const API_LIST = {
  picsum,
  commons,
  cma,
  likes,
}

/**
 * The boards that browse a collection. Likes is a board too, but it is rendered
 * on its own because it carries a count.
 */
const BOARDS = [
  { name: 'picsum', label: 'Picsum', title: 'picsum.photos, about 1000 photos' },
  { name: 'commons', label: 'Commons', title: 'Wikimedia Commons quality images, about 450 000 photos' },
  { name: 'cma', label: 'Art', title: 'Cleveland Museum of Art, about 41 000 CC0 artworks' },
]

const links = [
  { label: 'Old', href: 'https://example.com', icon: ArchiveIcon },
  { label: 'First Version', href: 'https://example.com', icon: ImageIcon },
  { label: 'Second Version', href: 'https://example.com', icon: ImagesIcon },
  { label: 'Upstream', href: 'https://example.com', icon: GitBranchIcon },
]

function App() {
  /**
   * Every model fetched so far. The ref is the source of truth, because the
   * fetch loop and photoswipe read it from callbacks that outlive the render
   * they were created in; the state is the copy the grid renders. Both are
   * written at once, through `commitItems`.
   */
  const itemsRef = useRef([])
  const [items, setItems] = useState(itemsRef.current)
  const commitItems = useCallback((next) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  /**
   * Pagination bookkeeping: mutable fields rather than state, because they are
   * read and written from async callbacks and none of them is rendered.
   *
   *   pending     a page that was asked for while a fetch was already running
   *   generation  bumped whenever the collection is reset, to discard in-flight
   *               fetches
   *   started     guards the first page against React's development remount
   */
  const control = useRef({
    page: 1,
    lastId: null,
    loading: false,
    exhausted: false,
    pending: false,
    generation: 0,
    controller: null,
    started: false,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exhausted, setExhausted] = useState(false)
  const [likedCount, setLikedCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  /** Small screens only: whether the folded away controls are showing. */
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [board, setBoard] = useState(DEFAULT_BOARD)
  const [size, setSize] = useState(DEFAULT_SIZE)
  /** Bumped to make the grid throw the layout it has measured away. */
  const [resetKey, setResetKey] = useState(0)
  /** Index of the photo the lightbox is on, or null while it is closed. */
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [imageOpen, setImageOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // The same values, for the callbacks that cannot wait for a re-render
  const boardRef = useRef(board)
  const sizeRef = useRef(size)
  const imageOpenRef = useRef(false)
  /** True while the history entry we pushed for the lightbox still exists. */
  const pushedHistoryEntry = useRef(false)

  /** index -> figure element, filled in by the cells, read by photoswipe. */
  const elements = useMemo(() => new Map(), [])

  /**
   * Model shown in the lightbox, and therefore in the details panel. Looked up
   * by index rather than held, so that liking the photo — which replaces its
   * model — is picked up here as well.
   */
  const selectedPost = selectedIndex === null ? null : (items[selectedIndex] ?? null)

  const status = error
    ? `Failed to load: ${error}`
    : loading
      ? 'Loading…'
      : exhausted && items.length === 0
        ? board === 'likes'
          ? 'No likes yet'
          : 'Nothing here'
        : exhausted
          ? `Currently loaded: ${items.length} photos, that's all of them`
          : `Currently loaded: ${items.length} photos`

  const addImages = useCallback(
    async function addImages(replaceAll = false) {
      const c = control.current

      if (c.loading) {
        c.pending = true
        return
      }

      if (c.exhausted && !replaceAll) return

      const api = API_LIST[boardRef.current]
      const token = c.generation
      c.loading = true
      c.controller = new AbortController()
      setLoading(true)
      setError(null)

      try {
        const result = await api.fetchItems({
          page: c.page,
          limit: api.pageSize,
          lastId: c.lastId,
          thumbnailSize: sizeRef.current,
          signal: c.controller.signal,
        })

        if (token !== c.generation) return

        // Hearts have to be right the moment a figure shows up, so like state
        // is resolved before the models reach the grid. A broken IndexedDB must
        // not keep the photos from loading, though.
        await likes.hydrate(result.items).catch(() => {})
        if (token !== c.generation) return

        c.page += 1
        c.lastId = result.lastId ?? c.lastId
        c.exhausted = !result.hasMore
        setExhausted(c.exhausted)
        commitItems(replaceAll ? result.items : itemsRef.current.concat(result.items))
      } catch (e) {
        if (token === c.generation && e.name !== 'AbortError') {
          setError(e.message || String(e))
        }
      } finally {
        if (token === c.generation) {
          c.loading = false
          c.controller = null
          setLoading(false)
        }
      }

      // A page asked for while this fetch was running was dropped, so it is
      // picked up here rather than on the next scroll.
      if (token === c.generation && c.pending) {
        c.pending = false
        addImages()
      }
    },
    [commitItems],
  )

  /**
   * Like or unlike a photo. `likeId` on the model is the single source of
   * truth: IndexedDB decides it, the hearts follow.
   */
  const toggleLike = useCallback(
    async (model) => {
      try {
        const likeId = model.likeId ? await likes.remove(model) : await likes.add(model)

        // A new model rather than a mutated one: masonic memoizes the element
        // it builds for a cell on the identity of its data, so this is what
        // re-renders the heart that changed, and only that one.
        commitItems(
          itemsRef.current.map((candidate) =>
            candidate === model ? { ...candidate, likeId } : candidate,
          ),
        )

        setLikedCount(await likes.count())
      } catch (e) {
        setError(e.message || String(e))
      }
    },
    [commitItems],
  )

  const { open: openLightbox, close: closeLightbox } = useLightbox({
    items: itemsRef,
    elements,
    liked: Boolean(selectedPost?.likeId),
    onOpen: () => {
      if (!imageOpenRef.current) {
        // An extra history entry meaning "an image is open", so that the
        // browser back button closes the image instead of leaving the gallery.
        window.history.pushState({ image: true }, '', '#img')
        pushedHistoryEntry.current = true
      }

      imageOpenRef.current = true
      setImageOpen(true)
    },
    onClose: () => {
      imageOpenRef.current = false
      setImageOpen(false)

      // Closed from the UI (escape, close button, swipe down): drop the entry
      // we pushed. When the close came from a back navigation instead, the
      // entry is already gone and pushedHistoryEntry has been cleared.
      const pushed = pushedHistoryEntry.current
      pushedHistoryEntry.current = false
      if (pushed && window.location.hash === '#img') {
        window.history.back()
      }
    },
    onChange: setSelectedIndex,
    onNeedMore: () => addImages(),
    onToggleDetails: () => setShowDetails((open) => !open),
    onToggleLike: () => {
      if (selectedPost) toggleLike(selectedPost)
    },
  })

  /** Start over from the first page. */
  const reload = useCallback(() => {
    const c = control.current
    c.generation += 1
    c.controller?.abort()
    c.controller = null
    c.loading = false
    c.pending = false
    c.page = 1
    c.lastId = null
    c.exhausted = false

    setLoading(false)
    setError(null)
    setExhausted(false)
    // Empty the grid right away rather than on arrival: `items` and the
    // measured layout have to stay in step even if the fetch below fails,
    // otherwise a retry would append page 1 to the photos still on screen.
    // Both updates land in one render, which matters: masonic refuses an
    // `items` array shorter than the layout it has already measured.
    commitItems([])
    setResetKey(c.generation)

    addImages(true)
  }, [addImages, commitItems])

  /**
   * Boards are just data sources, so switching one is a reload against the
   * other. Likes are read straight from IndexedDB, picsum from the network.
   */
  const switchBoard = useCallback(
    (nextBoard) => {
      if (nextBoard === boardRef.current) return
      boardRef.current = nextBoard
      setBoard(nextBoard)
      reload()
    },
    [reload],
  )

  const switchGallerySize = useCallback(
    (nextSize) => {
      if (nextSize === sizeRef.current) return
      sizeRef.current = nextSize
      setSize(nextSize)

      // Ask the source for thumbnails matching the new display size, so that
      // growing the gallery does not simply upscale the ones we already
      // downloaded.
      const api = API_LIST[boardRef.current]
      if (api.resizeThumbnail) {
        commitItems(itemsRef.current.map((model) => api.resizeThumbnail(model, nextSize)))
      }
    },
    [commitItems],
  )

  const goToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [])

  // The grid hands the range it wants loaded to its callback, and the first of
  // those arguments would land on `replaceAll`.
  const loadMore = useCallback(() => addImages(), [addImages])

  const gallery = useMemo(
    () => ({ elements, onZoom: openLightbox, onToggleLike: toggleLike }),
    [elements, openLightbox, toggleLike],
  )

  useEffect(() => {
    // A reload with a leftover "#img" would leave us with a history entry that
    // means "image open" while nothing is open.
    if (window.location.hash === '#img') {
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    }

    likes
      .count()
      .then(setLikedCount)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400)
    const onPopState = () => {
      if (!imageOpenRef.current || window.location.hash === '#img') return

      pushedHistoryEntry.current = false
      closeLightbox()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('popstate', onPopState)
    }
  }, [closeLightbox])

  // The first page. The grid only asks for more once it has rendered
  // something, so the collection has to be started by hand.
  useEffect(() => {
    if (control.current.started) return
    control.current.started = true
    addImages()
  }, [addImages])

  return (
    <>
      <div className="grid min-h-dvh md:grid-cols-[auto_1fr]">
        {/* Desktop: navigation rail. Sticky, because here the window is what
            scrolls, which is what masonic is built around. */}
        <aside className="sticky top-0 hidden h-dvh md:block">
          <Navigation layout="rail" className="h-full">
            <Navigation.Content>
              <Navigation.Menu>
                {links.map((link) => {
                  const Icon = link.icon
                  return (
                    <Navigation.TriggerAnchor key={link.label} href={link.href}>
                      <Icon className="size-8" />
                      <Navigation.TriggerText>{link.label}</Navigation.TriggerText>
                    </Navigation.TriggerAnchor>
                  )
                })}
              </Navigation.Menu>
            </Navigation.Content>
          </Navigation>
        </aside>

        {/* Padded on mobile to clear the navigation bar below it */}
        <main id="gallery-container" className="pb-24 md:pb-0">
          <GalleryContext.Provider value={gallery}>
            {/* Keyed on the size: when the column width changes, masonic keeps
                the heights it has measured and re-measures only what is on
                screen, so a fresh grid is the way to a layout that is right
                everywhere. The other demos rebuild their gallery for the same
                reason. */}
            <MasonryGallery
              key={size}
              items={items}
              size={size}
              resetKey={resetKey}
              onLoadMore={loadMore}
            />
          </GalleryContext.Provider>
        </main>

        {/* Mobile: navigation bar, fixed for the same reason the rail is
            sticky */}
        <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
          <Navigation layout="bar">
            <Navigation.Menu className="grid grid-cols-4 gap-2">
              {links.map((link) => {
                const Icon = link.icon
                return (
                  <Navigation.TriggerAnchor key={link.label} href={link.href}>
                    <Icon className="size-5" />
                    <Navigation.TriggerText>{link.label}</Navigation.TriggerText>
                  </Navigation.TriggerAnchor>
                )
              })}
            </Navigation.Menu>
          </Navigation>
        </div>
      </div>

      {!imageOpen && (
        <div className={toolbarOpen ? 'footer-buttons expanded' : 'footer-buttons'}>
          {/* Everything marked collapsible folds away on a small screen, leaving
              the three buttons at the end of this list. An error stays put: it is
              the one thing that must not hide behind the toggle. */}
          <span className={error ? 'fab' : 'fab collapsible'} aria-live="polite">
            {loading && <LoaderCircleIcon className="size-4 animate-spin" />}
            {status}
          </span>

          {error && (
            <button className="fab" onClick={() => addImages()}>
              Retry
            </button>
          )}

          <div className="fab-group collapsible">
            {BOARDS.map((entry) => (
              <button
                key={entry.name}
                className={board === entry.name ? 'fab active' : 'fab'}
                title={entry.title}
                onClick={() => switchBoard(entry.name)}
              >
                {entry.label}
              </button>
            ))}
            <button
              className={board === 'likes' ? 'fab active' : 'fab'}
              onClick={() => switchBoard('likes')}
            >
              Likes ({likedCount})
            </button>
          </div>

          <div className="fab-group collapsible">
            {GALLERY_SIZES.map((preset) => (
              <button
                key={preset.size}
                className={size === preset.size ? 'fab active' : 'fab'}
                title={`${preset.size}px thumbnails`}
                onClick={() => switchGallerySize(preset.size)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            className="fab toolbar-toggle"
            onClick={() => setToolbarOpen((open) => !open)}
            title={toolbarOpen ? 'Hide the controls' : 'Show the controls'}
            aria-label={toolbarOpen ? 'Hide the controls' : 'Show the controls'}
            aria-expanded={toolbarOpen}
          >
            {toolbarOpen ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronUpIcon className="size-4" />
            )}
          </button>

          <button
            className="fab"
            onClick={reload}
            title="Load the first page again"
            aria-label="Reload"
          >
            <RefreshCwIcon className="size-4" />
          </button>

          {scrolled && (
            <button className="fab" onClick={goToTop}>
              <ArrowUpIcon className="size-4" />
              <span>Back to Top</span>
            </button>
          )}
        </div>
      )}

      <ImageDetails post={selectedPost} open={imageOpen && showDetails} />

      <DisclaimerDialog />
    </>
  )
}

export default App
