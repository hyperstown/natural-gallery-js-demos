<script>
  import HouseIcon from "@lucide/svelte/icons/house";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import DownloadIcon from "@lucide/svelte/icons/download";

  /**
   * `post` is a gallery model, or null while nothing is open. `open` slides the
   * panel in; it stays mounted either way so the transition can run.
   */
  let { post = null, open = false } = $props();

  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Only picsum's "multiple authors" photos have more than one, hence the split.
  const artists = $derived(post?.artists ? String(post.artists).split(" & ") : []);
  const copyright = $derived([post?.copyright].flat().filter(Boolean));
  const characters = $derived(post?.characters ?? []);
  const tags = $derived(post?.tags ?? []);
</script>

<aside class="overlay" class:hidden-overlay={!open} aria-hidden={!open}>
  {#if post}
    <div class="details">
      <p>
        <HouseIcon class="size-4" />
        <a class="anchor" href={post.link} target="_blank" rel="noreferrer">
          {post.board} - {post.id}
        </a>
      </p>

      {#if post.likedAt}
        <p>
          <CalendarIcon class="size-4" />
          <span>Liked {dateFormat.format(new Date(post.likedAt))}</span>
        </p>
      {/if}

      {#if post.downloadLink}
        <p>
          <DownloadIcon class="size-4" />
          <a class="anchor" href={post.downloadLink} target="_blank" rel="noreferrer">
            Download original
          </a>
          <span class="kind">({post.enlargedWidth}×{post.enlargedHeight} shown)</span>
        </p>
      {/if}

      <div class="tags-list">
        {#each characters as character (character)}
          <p>{character} <span class="kind">(character)</span></p>
        {/each}
        {#each artists as artist (artist)}
          <p>{artist} <span class="kind">(artist)</span></p>
        {/each}
        {#each copyright as owner (owner)}
          <p>{owner} <span class="kind">(copyright)</span></p>
        {/each}
      </div>

      {#if tags.length}
        <hr />
        <div class="tags-list">
          {#each tags as tag (tag)}
            <p>{tag}</p>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .overlay {
    position: fixed;
    bottom: 12px;
    right: 24px;
    /* Above photoswipe, which sits at 100000 */
    z-index: 300000;
    max-width: min(500px, calc(100vw - 48px));
    max-height: 60vh;
    overflow-y: auto;
    padding: 20px;
    border-radius: 5px;
    background-color: #0000007d;
    backdrop-filter: blur(10px);
    color: white;
    font-size: 14px;
    transition:
      transform 0.25s ease-out,
      opacity 0.25s ease-out;
  }

  .overlay.hidden-overlay {
    /* Slide out to the right rather than unmount, so it can slide back in */
    transform: translateX(calc(100% + 24px));
    opacity: 0;
    pointer-events: none;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .details p {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  hr {
    margin: 8px 0;
    border-color: #ffffff40;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .tags-list p {
    padding: 2px 8px;
    border-radius: 100px;
    background-color: #ffffff1f;
    white-space: nowrap;
  }

  .kind {
    opacity: 0.6;
  }
</style>
