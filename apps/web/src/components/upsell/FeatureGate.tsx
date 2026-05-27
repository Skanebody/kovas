'use client'

import {
  type FeatureRequirement,
  type UserAccess,
  hasFeatureAccess,
} from '@/lib/upsell/access-control'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { UpsellEmptyState } from './UpsellEmptyState'
import { UpsellModal } from './UpsellModal'

export interface FeatureGateProps {
  /** Tier ou addons requis pour la feature. */
  feature: FeatureRequirement
  /** UserAccess chargé côté server (loadUserAccess). */
  access: UserAccess
  /**
   * Comportement quand l'utilisateur n'a pas accès :
   *   - hide          : render null
   *   - empty-state   : render <UpsellEmptyState>
   *   - show-disabled : render children avec overlay + click → modal
   */
  mode: 'hide' | 'empty-state' | 'show-disabled'
  /** Code addon / pack / tier suggéré (obligatoire pour empty-state et show-disabled). */
  upsellTarget?: string
  /** Trigger contextuel pour tracking. */
  trigger?: string
  /** Titre custom pour empty-state. */
  upsellTitle?: string
  children: ReactNode
}

/**
 * <FeatureGate> — composant gate qui contrôle l'affichage d'une zone selon
 * l'accès utilisateur.
 *
 * Usage :
 *   <FeatureGate feature={{ requiredAddons: ['pennylane_sync'] }} access={access} mode="show-disabled" upsellTarget="pennylane_sync">
 *     <PennylaneSyncButton />
 *   </FeatureGate>
 */
export function FeatureGate({
  feature,
  access,
  mode,
  upsellTarget,
  trigger,
  upsellTitle,
  children,
}: FeatureGateProps) {
  const allowed = hasFeatureAccess(access, feature)
  const [modalOpen, setModalOpen] = useState(false)

  if (allowed) {
    return <>{children}</>
  }

  if (mode === 'hide') {
    return null
  }

  if (mode === 'empty-state') {
    if (!upsellTarget) return null
    return <UpsellEmptyState target={upsellTarget} trigger={trigger} title={upsellTitle} />
  }

  // show-disabled : on rend les children avec overlay cliquable
  if (!upsellTarget) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className="relative block w-full text-left cursor-pointer group"
        onClick={() => setModalOpen(true)}
      >
        <div aria-hidden className="pointer-events-none opacity-50 saturate-50">
          {children}
        </div>
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl border border-rule/60 bg-foreground/[0.03] backdrop-blur-[1px] group-hover:bg-foreground/[0.06] transition-colors"
        />
      </button>
      <UpsellModal
        target={upsellTarget}
        trigger={trigger}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  )
}
