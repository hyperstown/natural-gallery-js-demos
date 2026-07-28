import { useRef, useState } from 'react'
import { Dialog, Portal } from '@skeletonlabs/skeleton-react'

const STORAGE_KEY = 'hidePhotoDisclaimer'
const ANIM_MS = 200

// Vuetify-like dialog-transition: fade + scale from 90%. The exit animation is
// done by keeping the dialog open while `closing` applies the exit styles,
// because Firefox does not animate the `display` flip a real close causes.
export default function DisclaimerDialog() {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true')
  const [closing, setClosing] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const bounceTimer = useRef(undefined)

  function handleOpenChange(details) {
    if (details.open || closing) return
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, ANIM_MS)
  }

  // Vuetify persistent-dialog bounce on dismissed close attempts
  function bounce() {
    clearTimeout(bounceTimer.current)
    setBouncing(false)
    requestAnimationFrame(() => setBouncing(true))
    bounceTimer.current = setTimeout(() => setBouncing(false), 250)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      closeOnInteractOutside={false}
      closeOnEscape={false}
      onInteractOutside={bounce}
      onEscapeKeyDown={bounce}
    >
      <Portal>
        <Dialog.Backdrop
          className={`bg-surface-50-950/50 fixed inset-0 z-[400000] transition duration-200 starting:opacity-0 ${
            closing ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <Dialog.Positioner className="fixed inset-0 z-[400000] flex items-center justify-center p-4">
          <Dialog.Content
            className={`card bg-surface-100-900 w-full max-w-md space-y-4 p-6 shadow-xl transition duration-200 ease-out starting:scale-90 starting:opacity-0 ${
              closing ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
            } ${bouncing ? 'animate-dialog-bounce' : ''}`}
          >
            <Dialog.Title className="h4">Disclaimer</Dialog.Title>
            <Dialog.Description className="opacity-80">
              I do not own anything shown in this demo. The pictures come from the API testing
              tool{' '}
              <a className="anchor" href="https://picsum.photos" target="_blank" rel="noreferrer">
                picsum.photos
              </a>
              , from{' '}
              <a
                className="anchor"
                href="https://commons.wikimedia.org"
                target="_blank"
                rel="noreferrer"
              >
                Wikimedia Commons
              </a>{' '}
              and from the open access collection of the{' '}
              <a
                className="anchor"
                href="https://www.clevelandart.org/open-access"
                target="_blank"
                rel="noreferrer"
              >
                Cleveland Museum of Art
              </a>
              . Pick a source with the buttons at the bottom of the screen; every caption links
              back to where its picture came from.
            </Dialog.Description>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span>Don't show this again</span>
            </label>
            <footer className="flex justify-end">
              <Dialog.CloseTrigger className="btn preset-filled">Got it</Dialog.CloseTrigger>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog>
  )
}
