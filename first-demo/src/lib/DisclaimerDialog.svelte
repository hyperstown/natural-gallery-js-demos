<script>
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte'

  const STORAGE_KEY = 'hidePhotoDisclaimer'

  let open = $state(localStorage.getItem(STORAGE_KEY) !== 'true')
  let dontShowAgain = $state(false)

  function onOpenChange(details) {
    open = details.open
    if (!details.open && dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }
</script>

<Dialog {open} {onOpenChange}>
  <Portal>
    <Dialog.Backdrop class="bg-surface-50-950/50 fixed inset-0 z-50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card bg-surface-100-900 w-full max-w-md space-y-4 p-6 shadow-xl">
        <Dialog.Title class="h4">Disclaimer</Dialog.Title>
        <Dialog.Description class="opacity-80">
          I do not own the photos shown in this demo. All photos are fetched from the API testing
          tool
          <a class="anchor" href="https://picsum.photos" target="_blank" rel="noreferrer">
            picsum.photos
          </a>.
        </Dialog.Description>
        <label class="flex items-center gap-2">
          <input type="checkbox" class="checkbox" bind:checked={dontShowAgain} />
          <span>Don't show this again</span>
        </label>
        <footer class="flex justify-end">
          <Dialog.CloseTrigger class="btn preset-filled">Got it</Dialog.CloseTrigger>
        </footer>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
