<script>
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte'
  import { fade, scale } from 'svelte/transition'

  const STORAGE_KEY = 'hidePhotoDisclaimer'

  let open = $state(localStorage.getItem(STORAGE_KEY) !== 'true')
  let dontShowAgain = $state(false)
  let bouncing = $state(false)
  let bounceTimer

  function onOpenChange(details) {
    open = details.open
    if (!details.open && dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }

  // Vuetify persistent-dialog bounce on dismissed close attempts
  function bounce() {
    clearTimeout(bounceTimer)
    bouncing = false
    requestAnimationFrame(() => (bouncing = true))
    bounceTimer = setTimeout(() => (bouncing = false), 250)
  }
</script>

<Dialog
  {open}
  {onOpenChange}
  closeOnInteractOutside={false}
  closeOnEscape={false}
  onInteractOutside={bounce}
  onEscapeKeyDown={bounce}
>
  <Portal>
    <Dialog.Backdrop>
      {#snippet element(attributes)}
        {#if open}
          <div
            {...attributes}
            hidden={false}
            class="bg-surface-50-950/50 fixed inset-0 z-[400000]"
            transition:fade={{ duration: 200 }}
          ></div>
        {/if}
      {/snippet}
    </Dialog.Backdrop>
    <Dialog.Positioner class="fixed inset-0 z-[400000] flex items-center justify-center p-4">
      <Dialog.Content>
        {#snippet element(attributes)}
          {#if open}
            <!-- Vuetify-like dialog-transition: fade + scale from 90% -->
            <div
              {...attributes}
              hidden={false}
              class="card bg-surface-100-900 w-full max-w-md space-y-4 p-6 shadow-xl {bouncing
                ? 'animate-dialog-bounce'
                : ''}"
              transition:scale={{ start: 0.9, duration: 200 }}
            >
              <Dialog.Title class="h4">Disclaimer</Dialog.Title>
              <Dialog.Description class="opacity-80">
                I do not own anything shown in this demo. The pictures come from the API testing
                tool
                <a class="anchor" href="https://picsum.photos" target="_blank" rel="noreferrer">
                  picsum.photos
                </a>, from
                <a
                  class="anchor"
                  href="https://commons.wikimedia.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikimedia Commons
                </a>
                and from the open access collection of the
                <a
                  class="anchor"
                  href="https://www.clevelandart.org/open-access"
                  target="_blank"
                  rel="noreferrer"
                >
                  Cleveland Museum of Art
                </a>. Pick a source with the buttons at the bottom of the screen; every caption
                links back to where its picture came from.
              </Dialog.Description>
              <label class="flex items-center gap-2">
                <input type="checkbox" class="checkbox" bind:checked={dontShowAgain} />
                <span>Don't show this again</span>
              </label>
              <footer class="flex justify-end">
                <Dialog.CloseTrigger class="btn preset-filled">Got it</Dialog.CloseTrigger>
              </footer>
            </div>
          {/if}
        {/snippet}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
