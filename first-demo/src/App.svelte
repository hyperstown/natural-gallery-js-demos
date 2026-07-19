<script>
  import { Navigation } from '@skeletonlabs/skeleton-svelte'
  import ArchiveIcon from '@lucide/svelte/icons/archive'
  import ImageIcon from '@lucide/svelte/icons/image'
  import ImagesIcon from '@lucide/svelte/icons/images'
  import GitBranchIcon from '@lucide/svelte/icons/git-branch'
  import DisclaimerDialog from './lib/DisclaimerDialog.svelte'

  const links = [
    { label: 'Old', href: 'https://example.com', icon: ArchiveIcon },
    { label: 'First Version', href: 'https://example.com', icon: ImageIcon },
    { label: 'Second Version', href: 'https://example.com', icon: ImagesIcon },
    { label: 'Upstream', href: 'https://example.com', icon: GitBranchIcon },
  ]
</script>

<div class="grid h-dvh grid-rows-[1fr_auto] md:grid-rows-1 md:grid-cols-[auto_1fr]">
  <!-- Desktop: navigation rail -->
  <aside class="hidden md:block">
    <Navigation layout="rail" class="h-full">
      <Navigation.Content>
        <Navigation.Menu>
          {#each links as link (link.label)}
            {@const Icon = link.icon}
            <Navigation.TriggerAnchor href={link.href}>
              <Icon class="size-5" />
              <Navigation.TriggerText>{link.label}</Navigation.TriggerText>
            </Navigation.TriggerAnchor>
          {/each}
        </Navigation.Menu>
      </Navigation.Content>
    </Navigation>
  </aside>

  <main class="space-y-4 overflow-y-auto p-6 md:p-10">
    <h1 class="h1">Natural Gallery Demo</h1>
    <p class="opacity-70">The gallery will go here.</p>
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

<DisclaimerDialog />
