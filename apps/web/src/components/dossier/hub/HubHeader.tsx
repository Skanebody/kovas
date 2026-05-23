'use client'

import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import {
  type DossierState,
  getPrimaryActionForState,
  getStatusPillProps,
} from '@/lib/dossier/states'
import { ArrowLeft, Phone } from 'lucide-react'
import Link from 'next/link'
import { PrimaryAction } from './PrimaryAction'

interface HubHeaderProps {
  reference: string
  clientName: string
  fullAddress: string
  state: DossierState
  dossierId: string
  clientPhone: string | null
  moreMenu?: React.ReactNode
}

/**
 * Header sticky 80px du Hub Dossier.
 * Layout : référence mono uppercase + nom client serif italic + adresse + status pill + actions.
 */
export function HubHeader({
  reference,
  clientName,
  fullAddress,
  state,
  dossierId,
  clientPhone,
  moreMenu,
}: HubHeaderProps) {
  const pill = getStatusPillProps(state)
  const primary = getPrimaryActionForState(state, dossierId)

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 border-b border-rule/70 bg-paper/85 backdrop-blur-md px-4 md:-mx-6 md:px-6">
      <div className="flex h-auto min-h-[80px] flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild aria-label="Retour aux dossiers">
            <Link href="/dashboard/dossiers">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute shrink-0">
                {reference}
              </p>
              <h1 className="font-serif italic text-[20px] md:text-[24px] tracking-tight text-ink leading-tight truncate">
                {clientName}
              </h1>
            </div>
            {fullAddress ? (
              <p className="text-[12px] text-ink-mute truncate mt-0.5">{fullAddress}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill variant={pill.variant} label={pill.label} size="sm" />
          <PrimaryAction action={primary} dossierId={dossierId} />
          {clientPhone ? (
            <Button variant="outline" size="icon" asChild aria-label={`Appeler ${clientPhone}`}>
              <a href={`tel:${clientPhone}`}>
                <Phone className="size-4" />
              </a>
            </Button>
          ) : null}
          {moreMenu}
        </div>
      </div>
    </header>
  )
}
