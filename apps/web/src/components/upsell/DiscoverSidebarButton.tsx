'use client'

import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { UserAccess } from '@/lib/upsell/access-control'
import type { PendingUpsellSuggestion } from '@/lib/upsell/load-access'
import { DiscoverDrawer } from './DiscoverDrawer'

export interface DiscoverSidebarButtonProps {
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
  /** Variant : desktop sidebar icon-only vs mobile section label. */
  variant?: 'sidebar' | 'inline'
}

/**
 * Bouton "Découvrir KOVAS" — déclenche le DiscoverDrawer.
 *
 * Variant `sidebar` : icône carrée 48px, dot chartreuse si suggestion pending.
 * Variant `inline`  : ligne pleine largeur (utilisé dans le MobileMoreSheet).
 */
export function DiscoverSidebarButton({
  access,
  suggestions,
  variant = 'sidebar',
}: DiscoverSidebarButtonProps) {
  const [open, setOpen] = useState(false)
  const hasSuggestion = suggestions.length > 0

  if (variant === 'sidebar') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex size-12 items-center justify-center rounded-md text-white/65 hover:bg-white/[0.06] hover:text-white transition-colors"
          title="Découvrir KOVAS"
          aria-label="Découvrir KOVAS"
        >
          <Sparkles className="size-5" strokeWidth={1.75} />
          {hasSuggestion ? (
            <span
              aria-hidden
              className="absolute top-2 right-2 size-2 rounded-full"
              style={{ backgroundColor: '#D4F542' }}
            />
          ) : null}
        </button>
        <DiscoverDrawer
          open={open}
          onOpenChange={setOpen}
          access={access}
          suggestions={suggestions}
        />
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex w-full items-center gap-3 rounded-[12px] bg-sage/40 hover:bg-sage p-4 transition-colors text-left"
      >
        <span
          aria-hidden
          className="size-9 rounded-md bg-chartreuse/20 flex items-center justify-center shrink-0"
        >
          <Sparkles className="size-4 text-[#0F1419]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-ink">Découvrir KOVAS</span>
          <span className="block text-[11px] text-ink-mute">
            Modules à l&apos;essai · Forfait supérieur
          </span>
        </span>
        {hasSuggestion ? (
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: '#D4F542' }}
          />
        ) : null}
      </button>
      <DiscoverDrawer
        open={open}
        onOpenChange={setOpen}
        access={access}
        suggestions={suggestions}
      />
    </>
  )
}
