<script>
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { Navigation } from "@skeletonlabs/skeleton-svelte";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import ImageIcon from "@lucide/svelte/icons/image";
  import ImagesIcon from "@lucide/svelte/icons/images";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import DisclaimerDialog from "./lib/DisclaimerDialog.svelte";
  import * as NaturalGallery from "@ecodev/natural-gallery-js";
  import { picsum } from "@api/picsum.js";
  import { image } from "@store/image.js";
  import "@ecodev/natural-gallery-js/natural-gallery.css";
  import "@assets/natural-gallery.css";

  const DEFAULT_GALLERY_SETTINGS = {
    size: 400,
    type: "Natural",
  };

  const GALLERY_TYPES = ["Natural", "Masonry", "Square"];

  /** Wanted thumbnail size, in pixels. */
  const GALLERY_SIZES = [
    { label: "S", size: 250 },
    { label: "M", size: 400 },
    { label: "L", size: 600 },
  ];

  const USE_API = "picsum";
  const API_LIST = {
    picsum,
  };
  const api = API_LIST[USE_API];

  /** @typedef {import("./lib/api/picsum.js").GalleryModel} GalleryModel */

  /** The three layouts are indexed by name, which typescript cannot follow. */
  const galleryConstructors = /** @type {Record<string, any>} */ (NaturalGallery);

  // refs
  /** @type {HTMLElement | null} */
  let naturalGalleryRef = $state(null);
  /** @type {HTMLElement | null} */
  let scrollerRef = $state(null);

  // objs
  /** @type {any} */
  let naturalGalleryObj = null;

  // vars
  /** @type {string | null} */
  let lastId = null;
  let loading = $state(false);
  let page = 1;
  let type = $state(DEFAULT_GALLERY_SETTINGS.type);
  let size = $state(DEFAULT_GALLERY_SETTINGS.size);
  let loadedCount = $state(0);
  let exhausted = $state(false);
  /** @type {string | null} */
  let error = $state(null);
  let scrolled = $state(false);
  /** Changing it makes Svelte hand us a brand new gallery container. */
  let galleryKey = $state(0);

  /**
   * Every model fetched so far, kept so the gallery can be rebuilt for free.
   *
   * @type {GalleryModel[]}
   */
  let models = [];
  /** A pagination request that came in while a fetch was already running. */
  let pendingRequest = false;
  /** @type {AbortController | null} */
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

  function initNaturalGallery() {
    naturalGalleryObj = new galleryConstructors[type](
      naturalGalleryRef,
      galleryOptions(),
      scrollerRef, // scroller ref.
    );

    bindLightbox(naturalGalleryObj);

    // Hand back what we already downloaded, before listening to pagination, so
    // that a rebuild reuses the pages we have in memory.
    if (models.length) {
      naturalGalleryObj.setItems(models);
    }

    // The gallery offers every offset exactly once: it asks for items when it
    // thinks its buffer runs low and never asks for the same offset twice. So
    // every event has to end up in a fetch (see pendingRequest), and a failed
    // fetch has to be retried by hand instead of waiting for the next scroll.
    // The flip side is that a rebuild costs one extra page, since the fresh
    // gallery counts its buffer from zero.
    const instance = naturalGalleryObj;
    instance.addEventListener("pagination", () => {
      // A replaced gallery still holds scroll listeners: ignore what it asks.
      if (instance !== naturalGalleryObj) return;
      addImages();
    });
  }

  /** @param {any} instance */
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
  }

  function onPopState() {
    if (!get(image) || window.location.hash === "#img") return;

    pushedHistoryEntry = false;
    naturalGalleryObj?.photoSwipe?.pswp?.close();
  }

  async function addImages(replaceAll = false) {
    if (loading) {
      pendingRequest = true;
      return;
    }

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
      const failure = /** @type {Error} */ (e);
      if (token === generation && failure.name !== "AbortError") {
        error = failure.message || String(e);
      }
    } finally {
      if (token === generation) {
        loading = false;
        abortController = null;
      }
    }

    if (token === generation && pendingRequest) {
      pendingRequest = false;
      addImages();
    }
  }

  /** Start over from the first page. */
  function reload() {
    generation += 1;
    abortController?.abort();
    abortController = null;
    loading = false;
    pendingRequest = false;
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
    naturalGalleryObj?.scrollToTop({ behavior: "smooth" });
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

  /** @param {string} nextType */
  function switchGalleryType(nextType) {
    if (nextType === type) return;
    type = nextType;
    rebuildGallery();
  }

  /** @param {number} nextSize */
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

  function onScroll() {
    scrolled = (scrollerRef?.scrollTop ?? 0) > 400;
  }

  onMount(() => {
    // A reload with a leftover "#img" would leave us with a history entry that
    // means "image open" while nothing is open.
    if (window.location.hash === "#img") {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }

    initNaturalGallery();

    scrollerRef?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);

    return () => {
      scrollerRef?.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      abortController?.abort();
      naturalGalleryObj?.photoSwipe?.destroy();
    };
  });

  const links = [
    { label: "Old", href: "https://example.com", icon: ArchiveIcon },
    { label: "First Version", href: "https://example.com", icon: ImageIcon },
    { label: "Second Version", href: "https://example.com", icon: ImagesIcon },
    { label: "Upstream", href: "https://example.com", icon: GitBranchIcon },
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
            <Navigation.TriggerAnchor href={link.href}>
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
          <Navigation.TriggerAnchor href={link.href}>
            <Icon class="size-5" />
            <Navigation.TriggerText>{link.label}</Navigation.TriggerText>
          </Navigation.TriggerAnchor>
        {/each}
      </Navigation.Menu>
    </Navigation>
  </div>
</div>

{#if !$image}
  <div class="footer-buttons">
    <span class="fab" aria-live="polite">
      {#if loading}
        <LoaderCircleIcon class="size-4 animate-spin" />
      {/if}
      {status}
    </span>

    {#if error}
      <button class="fab" onclick={() => addImages()}>Retry</button>
    {/if}

    <div class="fab-group">
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

    <div class="fab-group">
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

<DisclaimerDialog />
