<script>
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { Navigation } from "@skeletonlabs/skeleton-svelte";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import ImageIcon from "@lucide/svelte/icons/image";
  import ImagesIcon from "@lucide/svelte/icons/images";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import DisclaimerDialog from "./lib/DisclaimerDialog.svelte";
  import ImageDetails from "./lib/ImageDetails.svelte";
  import * as NaturalGallery from "@ecodev/natural-gallery-js";
  import { picsum } from "@api/picsum.js";
  import { commons } from "@api/commons.js";
  import { cma } from "@api/cma.js";
  import { likes } from "@api/likes.js";
  import { image } from "@store/image.js";
  import "@ecodev/natural-gallery-js/natural-gallery.css";
  import "@assets/natural-gallery.css";

  const DEFAULT_GALLERY_SETTINGS = {
    size: 400,
    type: "Natural",
  };

  const GALLERY_TYPES = ["Natural", "Masonry", "Square"];

  /**
   * How close the rendered window may come to the end of the collection before
   * another page is fetched, in items.
   */
  const LOAD_MORE_BUFFER = 40;

  /** Wanted thumbnail size, in pixels. */
  const GALLERY_SIZES = [
    { label: "S", size: 250 },
    { label: "M", size: 400 },
    { label: "L", size: 600 },
  ];

  const DEFAULT_BOARD = "picsum";
  const API_LIST = {
    picsum,
    commons,
    cma,
    likes,
  };

  /**
   * The boards that browse a collection. Likes is a board too, but it is
   * rendered on its own because it carries a count.
   */
  const BOARDS = [
    { name: "picsum", label: "Picsum", title: "picsum.photos, about 1000 photos" },
    {
      name: "commons",
      label: "Commons",
      title: "Wikimedia Commons quality images, about 450 000 photos",
    },
    { name: "cma", label: "Art", title: "Cleveland Museum of Art, about 41 000 CC0 artworks" },
  ];

  /**
   * Markup for one of the symbols in public/icons.svg. Photoswipe builds its
   * buttons itself and so do the hearts on the figures, so both need icons as a
   * string rather than as a component. BASE_URL keeps the reference right when
   * the demo is served from a subpath.
   */
  const icon = name =>
    `<svg class="icon"><use href="${import.meta.env.BASE_URL}icons.svg#${name}-icon"/></svg>`;

  // refs
  let naturalGalleryRef = $state(null);
  let scrollerRef = $state(null);
  /** The heart photoswipe puts in its top bar, created by `registerElement`. */
  let pswpLikeButton = null;

  // objs
  let naturalGalleryObj = null;

  // vars
  let lastId = null;
  let loading = $state(false);
  let page = 1;
  let board = $state(DEFAULT_BOARD);
  let type = $state(DEFAULT_GALLERY_SETTINGS.type);
  let size = $state(DEFAULT_GALLERY_SETTINGS.size);
  let loadedCount = $state(0);
  let likedCount = $state(0);
  let exhausted = $state(false);
  let error = $state(null);
  let scrolled = $state(false);
  /** Small screens only: whether the folded away controls are showing. */
  let toolbarOpen = $state(false);
  /**
   * Model shown in the lightbox, and therefore in the details panel. Raw state:
   * the gallery owns these objects and we compare them by identity, which a
   * deep `$state` proxy would break.
   */
  let selectedPost = $state.raw(null);
  let showDetails = $state(false);
  /** Changing it makes Svelte hand us a brand new gallery container. */
  let galleryKey = $state(0);

  /** The board buttons pick which data source the gallery pulls from. */
  const api = $derived(API_LIST[board]);

  /** Every model fetched so far, kept so the gallery can be rebuilt for free. */
  let models = [];
  let abortController = null;
  /** Bumped whenever the collection is reset, to discard in-flight fetches. */
  let generation = 0;
  /** True while the history entry we pushed for the lightbox still exists. */
  let pushedHistoryEntry = false;

  const status = $derived(
    error
      ? `Failed to load: ${error}`
      : loading
        ? "Loading…"
        : exhausted && loadedCount === 0
          ? board === "likes"
            ? "No likes yet"
            : "Nothing here"
          : exhausted
            ? `Currently loaded: ${loadedCount} photos, that's all of them`
            : `Currently loaded: ${loadedCount} photos`,
  );

  function galleryOptions() {
    const options = {
      lightbox: true,
      labelVisibility: "hover",
      virtualScroll: true,
      virtualScrollOverscanRows: 2,
      // activable: true,
      // selectable: true,
      // rowsPerPage: 2,
      photoSwipeOptions: {
        // bgOpacity: 0.2,
        // wheelToZoom: true,
        loop: false,
      },
      infiniteScrollOffset: -1000,
    };

    if (type === "Masonry") {
      return { ...options, columnWidth: size };
    }

    // Square lays out by column count instead of pixels, so turn the wanted
    // thumbnail size into the number of columns that fits the scroller.
    if (type === "Square") {
      const width = scrollerRef?.clientWidth || size * 3;
      return { ...options, itemsPerRow: Math.max(1, Math.round(width / size)) };
    }

    return { ...options, rowHeight: size };
  }

  /**
   * Like or unlike a photo. `likeId` on the model is the single source of
   * truth: IndexedDB decides it, the hearts follow.
   */
  async function toggleLike(model) {
    try {
      model.likeId = model.likeId ? await likes.remove(model) : await likes.add(model);
      likedCount = await likes.count();
    } catch (e) {
      error = e.message || String(e);
    }

    refreshHearts(model);
  }

  /** Push `model.likeId` back into the two places a heart can be showing. */
  function refreshHearts(model) {
    const liked = Boolean(model.likeId);
    const item = naturalGalleryObj?.collection.find(candidate => candidate.model === model);
    item?.rootElement?.querySelector(".heart-like-button")?.classList.toggle("liked", liked);

    if (selectedPost === model) {
      pswpLikeButton?.classList.toggle("liked", liked);
    }
  }

  function createHeart(model) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "heart-like-button";
    button.setAttribute("aria-label", "Like");
    button.innerHTML = icon("heart");
    button.classList.toggle("liked", Boolean(model.likeId));

    button.addEventListener("click", event => {
      // The figure underneath opens the lightbox when clicked
      event.preventDefault();
      event.stopPropagation();
      toggleLike(model);
    });

    return button;
  }

  /**
   * True once the rendered window comes within LOAD_MORE_BUFFER items of the
   * end of the collection.
   *
   * The gallery keeps items it has not rendered yet, and with virtual scroll
   * `domCollection` is the window on screen rather than everything shown so
   * far, so the last item in it says how far the user has walked into the
   * collection. Its 'pagination' event is no use for this: it fires every time
   * the gallery tops up the DOM, which is far more often than we want a page.
   */
  function needsMoreImages() {
    if (!naturalGalleryObj) return false;

    const collection = naturalGalleryObj.collection;
    const lastVisible = naturalGalleryObj.domCollection.at(-1);
    if (!collection.length || !lastVisible) return false;

    for (let i = Math.max(0, collection.length - LOAD_MORE_BUFFER); i < collection.length; i++) {
      if (collection[i] === lastVisible) return true;
    }

    return false;
  }

  /** Fetch another page, but only once the buffer is nearly walked through. */
  function maybeLoadMore() {
    if (loading || exhausted || error) return;
    if (!needsMoreImages()) return;

    addImages();
  }

  function initNaturalGallery() {
    naturalGalleryObj = new NaturalGallery[type](
      naturalGalleryRef,
      galleryOptions(),
      scrollerRef, // scroller ref.
    );

    bindLightbox(naturalGalleryObj);

    const instance = naturalGalleryObj;

    // Each figure gets its own heart. Virtual scroll detaches and re-attaches
    // the same element, so the event fires once per item and the heart rides
    // along; the guard only covers the unexpected. Subscribed before setItems
    // below, which fills the DOM synchronously.
    instance.addEventListener("item-added-to-dom", event => {
      if (instance !== naturalGalleryObj) return;

      const item = event.detail;
      if (!item?.rootElement) {
        console.warn("Item has no element!");
        return;
      }

      if (!item.rootElement.querySelector(".heart-like-button")) {
        item.rootElement.appendChild(createHeart(item.model));
      }

      // The window that is being rendered right now is only assigned to
      // domCollection once this render pass is over, so check after it.
      queueMicrotask(maybeLoadMore);
    });

    // Hand back what we already downloaded, so that a rebuild reuses the pages
    // we have in memory instead of fetching them again.
    if (models.length) {
      instance.setItems(models);
    }
  }

  function bindLightbox(instance) {
    const lightbox = instance.photoSwipe;
    if (!lightbox) return;

    lightbox.on("beforeOpen", () => {
      if (!get(image)) {
        // An extra history entry meaning "an image is open", so that the
        // browser back button closes the image instead of leaving the gallery.
        window.history.pushState({ image: true }, "", "#img");
        pushedHistoryEntry = true;
      }

      image.set(true);
    });

    lightbox.on("close", () => {
      image.set(false);

      // Closed from the UI (escape, close button, swipe down): drop the entry
      // we pushed. When the close came from a back navigation instead, the
      // entry is already gone and pushedHistoryEntry has been cleared.
      const pushed = pushedHistoryEntry;
      pushedHistoryEntry = false;
      if (pushed && window.location.hash === "#img") {
        window.history.back();
      }
    });

    // Which photo is on screen drives both the details panel and the heart in
    // the top bar. Lightbox listeners are attached before the ui is built, so
    // this runs before photoswipe's own 'change' handlers.
    lightbox.on("change", () => {
      selectedPost = instance.photoSwipeCurrentItem;
      pswpLikeButton?.classList.toggle("liked", Boolean(selectedPost?.likeId));
    });

    lightbox.on("destroy", () => {
      pswpLikeButton = null;
    });

    // The top bar only exists once photoswipe opens, hence 'uiRegister'.
    lightbox.on("uiRegister", () => {
      lightbox.pswp.ui.registerElement({
        name: "details-button",
        ariaLabel: "Toggle details",
        order: 8,
        isButton: true,
        className: "details-toggle icon-shadow",
        html: icon("panel-right"),
        onClick: () => (showDetails = !showDetails),
      });

      lightbox.pswp.ui.registerElement({
        name: "like-button",
        ariaLabel: "Like",
        order: 7,
        isButton: true,
        className: "heart-like-icon icon-shadow",
        html: icon("heart"),
        onInit: element => {
          pswpLikeButton = element;
          element.classList.toggle("liked", Boolean(selectedPost?.likeId));
        },
        onClick: () => {
          if (selectedPost) toggleLike(selectedPost);
        },
      });
    });
  }

  function onPopState() {
    if (!get(image) || window.location.hash === "#img") return;

    pushedHistoryEntry = false;
    naturalGalleryObj?.photoSwipe?.pswp?.close();
  }

  async function addImages(replaceAll = false) {
    if (loading) return;
    if (exhausted && !replaceAll) return;

    const token = generation;
    loading = true;
    error = null;
    abortController = new AbortController();

    try {
      const result = await api.fetchItems({
        page,
        limit: api.pageSize,
        lastId,
        thumbnailSize: size,
        signal: abortController.signal,
      });

      if (token !== generation) return;

      // Hearts have to be right the moment a figure shows up, so like state is
      // resolved before the models reach the gallery. A broken IndexedDB must
      // not keep the photos from loading, though.
      await likes.hydrate(result.items).catch(() => {});
      if (token !== generation) return;

      page += 1;
      lastId = result.lastId ?? lastId;
      exhausted = !result.hasMore;
      models = replaceAll ? result.items : models.concat(result.items);
      loadedCount = models.length;

      if (replaceAll) {
        naturalGalleryObj.setItems(models);
      } else if (result.items.length) {
        naturalGalleryObj.addItems(result.items);
      }
    } catch (e) {
      if (token === generation && e.name !== "AbortError") {
        error = e.message || String(e);
      }
    } finally {
      if (token === generation) {
        loading = false;
        abortController = null;
      }
    }
  }

  /** Start over from the first page. */
  function reload() {
    generation += 1;
    abortController?.abort();
    abortController = null;
    loading = false;
    page = 1;
    lastId = null;
    exhausted = false;
    error = null;
    models = [];
    loadedCount = 0;
    // Empty the gallery right away rather than on arrival: `models` and the
    // gallery collection have to stay in step even if the fetch below fails,
    // otherwise a retry would append page 1 to the photos still on screen.
    naturalGalleryObj?.setItems([]);

    addImages(true);
  }

  function goToTop() {
    // 11.1.3 has no scrollToTop(), so the scroller is moved directly
    scrollerRef?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function rebuildGallery() {
    // There is no destroy(), so we drop the container the gallery owns and let
    // Svelte give us a fresh one. The old instance keeps its scroll listeners
    // but from now on works on a detached element, and its events are ignored.
    naturalGalleryObj?.photoSwipe?.destroy();
    naturalGalleryObj = null;

    galleryKey += 1;
    await tick();

    initNaturalGallery();
  }

  /**
   * Boards are just data sources, so switching one is a reload against the
   * other. Likes are read straight from IndexedDB, picsum from the network.
   */
  function switchBoard(nextBoard) {
    if (nextBoard === board) return;
    board = nextBoard;
    reload();
  }

  function switchGalleryType(nextType) {
    if (nextType === type) return;
    type = nextType;
    rebuildGallery();
  }

  function switchGallerySize(nextSize) {
    if (nextSize === size) return;
    size = nextSize;

    // Ask the source for thumbnails matching the new display size, so growing
    // the gallery does not simply upscale the ones we already downloaded.
    if (api.resizeThumbnail) {
      models = models.map(model => api.resizeThumbnail(model, size));
    }

    rebuildGallery();
  }

  /**
   * Home/End/PageUp/PageDown scroll whatever the focused element sits inside,
   * and the page itself does not scroll here — the gallery is its own scroll
   * container. So it has to hold focus for those keys to do anything: it takes
   * focus on mount when nothing else wants it, and again on a click that did
   * not land on a control. tabindex="-1" keeps it out of the tab order.
   */
  function focusScroller(event) {
    if (event?.target?.closest?.("a, button, input, select, textarea, [tabindex]")) return;

    scrollerRef?.focus({ preventScroll: true });
  }

  function onScroll() {
    scrolled = (scrollerRef?.scrollTop ?? 0) > 400;

    // Covers scrolling back down over items the gallery has rendered before,
    // which raises no 'item-added-to-dom'.
    maybeLoadMore();
  }

  onMount(() => {
    // A reload with a leftover "#img" would leave us with a history entry that
    // means "image open" while nothing is open.
    if (window.location.hash === "#img") {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }

    initNaturalGallery();
    // Nothing asks for the first page: from here on, loading follows the
    // rendered window (see maybeLoadMore).
    addImages();

    // Only when nothing else has it, so the disclaimer keeps its focus trap
    if (document.activeElement === document.body) {
      scrollerRef?.focus({ preventScroll: true });
    }

    likes
      .count()
      .then(count => (likedCount = count))
      .catch(() => {});

    scrollerRef?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);

    return () => {
      scrollerRef?.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      abortController?.abort();
      naturalGalleryObj?.photoSwipe?.destroy();
    };
  });

  /**
   * Which demo this build is, and where the others live. The hrefs hang off
   * BASE_URL so they keep working under a subpath: /first-demo/../old/ resolves
   * to /old/, and /repo/first-demo/../old/ to /repo/old/.
   */
  const DEMO = "old";
  const site = `${import.meta.env.BASE_URL}../`;

  const links = [
    { label: "Old", demo: "old", href: `${site}old/`, icon: ArchiveIcon },
    { label: "First Version", demo: "first-demo", href: `${site}first-demo/`, icon: ImageIcon },
    { label: "Masonic", demo: "masonic", href: `${site}masonic/`, icon: ImagesIcon },
    { label: "Upstream", demo: "upstream", href: `${site}upstream/`, icon: GitBranchIcon },
  ];
</script>

<div
  class="grid h-dvh grid-rows-[1fr_auto] md:grid-rows-1 md:grid-cols-[auto_1fr]"
>
  <!-- Desktop: navigation rail -->
  <aside class="hidden md:block">
    <Navigation layout="rail" class="h-full">
      <Navigation.Content>
        <Navigation.Menu>
          {#each links as link (link.label)}
            {@const Icon = link.icon}
            <Navigation.TriggerAnchor
              href={link.href}
              aria-current={link.demo === DEMO ? "page" : undefined}
            >
              <Icon class="size-8" />
              <Navigation.TriggerText>{link.label}</Navigation.TriggerText>
            </Navigation.TriggerAnchor>
          {/each}
        </Navigation.Menu>
      </Navigation.Content>
    </Navigation>
  </aside>

  <main
    bind:this={scrollerRef}
    id="gallery-container"
    tabindex="-1"
    onpointerdown={focusScroller}
    style="overflow:auto; min-height:100%; height:100%;"
  >
    {#key galleryKey}
      <div id="gallery" bind:this={naturalGalleryRef}></div>
    {/key}
  </main>

  <!-- Mobile: navigation bar -->
  <div class="md:hidden">
    <Navigation layout="bar">
      <Navigation.Menu class="grid grid-cols-4 gap-2">
        {#each links as link (link.label)}
          {@const Icon = link.icon}
          <Navigation.TriggerAnchor
            href={link.href}
            aria-current={link.demo === DEMO ? "page" : undefined}
          >
            <Icon class="size-5" />
            <Navigation.TriggerText>{link.label}</Navigation.TriggerText>
          </Navigation.TriggerAnchor>
        {/each}
      </Navigation.Menu>
    </Navigation>
  </div>
</div>

{#if !$image}
  <div class="footer-buttons" class:expanded={toolbarOpen}>
    <!-- Everything marked collapsible folds away on a small screen, leaving the
         three buttons at the end of this list. An error stays put: it is the
         one thing that must not hide behind the toggle. -->
    <span class="fab" class:collapsible={!error} aria-live="polite">
      {#if loading}
        <LoaderCircleIcon class="size-4 animate-spin" />
      {/if}
      {status}
    </span>

    {#if error}
      <button class="fab" onclick={() => addImages()}>Retry</button>
    {/if}

    <div class="fab-group collapsible">
      {#each BOARDS as entry (entry.name)}
        <button
          class="fab"
          class:active={board === entry.name}
          title={entry.title}
          onclick={() => switchBoard(entry.name)}
        >
          {entry.label}
        </button>
      {/each}
      <button class="fab" class:active={board === "likes"} onclick={() => switchBoard("likes")}>
        Likes ({likedCount})
      </button>
    </div>

    <div class="fab-group collapsible">
      {#each GALLERY_TYPES as galleryType (galleryType)}
        <button
          class="fab"
          class:active={type === galleryType}
          onclick={() => switchGalleryType(galleryType)}
        >
          {galleryType}
        </button>
      {/each}
    </div>

    <div class="fab-group collapsible">
      {#each GALLERY_SIZES as preset (preset.size)}
        <button
          class="fab"
          class:active={size === preset.size}
          title="{preset.size}px thumbnails"
          onclick={() => switchGallerySize(preset.size)}
        >
          {preset.label}
        </button>
      {/each}
    </div>

    <button
      class="fab toolbar-toggle"
      onclick={() => (toolbarOpen = !toolbarOpen)}
      title={toolbarOpen ? "Hide the controls" : "Show the controls"}
      aria-label={toolbarOpen ? "Hide the controls" : "Show the controls"}
      aria-expanded={toolbarOpen}
    >
      {#if toolbarOpen}
        <ChevronDownIcon class="size-4" />
      {:else}
        <ChevronUpIcon class="size-4" />
      {/if}
    </button>

    <button class="fab" onclick={reload} title="Load the first page again" aria-label="Reload">
      <RefreshCwIcon class="size-4" />
    </button>

    {#if scrolled}
      <button class="fab" onclick={goToTop}>
        <ArrowUpIcon class="size-4" />
        <span>Back to Top</span>
      </button>
    {/if}
  </div>
{/if}

<ImageDetails post={selectedPost} open={$image && showDetails} />

<DisclaimerDialog />
