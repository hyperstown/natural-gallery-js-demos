import { Navigation } from '@skeletonlabs/skeleton-react'
import { ArchiveIcon, GitBranchIcon, ImageIcon, ImagesIcon } from 'lucide-react'
import DisclaimerDialog from './components/DisclaimerDialog.jsx'

const links = [
  { label: 'Old', href: 'https://example.com', icon: ArchiveIcon },
  { label: 'First Version', href: 'https://example.com', icon: ImageIcon },
  { label: 'Second Version', href: 'https://example.com', icon: ImagesIcon },
  { label: 'Upstream', href: 'https://example.com', icon: GitBranchIcon },
]

function App() {
  return (
    <>
      <div className="grid h-dvh grid-rows-[1fr_auto] md:grid-cols-[auto_1fr] md:grid-rows-1">
        {/* Desktop: navigation rail */}
        <aside className="hidden md:block">
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

        <main className="space-y-4 overflow-y-auto p-6 md:p-10">
          <h1 className="h1">Natural Gallery Demo</h1>
          <p className="opacity-70">The gallery will go here.</p>
        </main>

        {/* Mobile: navigation bar */}
        <div className="md:hidden">
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

      <DisclaimerDialog />
    </>
  )
}

export default App
