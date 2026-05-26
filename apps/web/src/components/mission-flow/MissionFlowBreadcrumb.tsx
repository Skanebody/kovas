'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : breadcrumb sobre V5 (Lot B92 polish).
 *
 * Fil d'Ariane minimaliste au-dessus de l'AppPageHeader :
 *   Dossiers / DOS-XXXX / Mission flow
 *
 * - Liens cliquables vers dossiers + dossier hub
 * - font-mono uppercase tracking-wider 11px, opacité 55%
 * - Animation fade-in 0.2s au mount (respect prefers-reduced-motion)
 *
 * Authority : CLAUDE.md Design System v5 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface MissionFlowBreadcrumbProps {
  dossierId: string
  dossierReference: string
}

export function MissionFlowBreadcrumb({ dossierId, dossierReference }: MissionFlowBreadcrumbProps) {
  return (
    <nav aria-label="Fil d'Ariane" className="animate-fade-in motion-reduce:animate-none">
      <ol className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
        <li>
          <Link
            href="/dashboard/dossiers"
            className="transition-colors hover:text-[#0F1419] motion-reduce:transition-none"
          >
            Dossiers
          </Link>
        </li>
        <li aria-hidden className="flex items-center">
          <ChevronRight className="size-3 text-[#0F1419]/40" strokeWidth={1.5} />
        </li>
        <li>
          <Link
            href={`/dashboard/dossiers/${dossierId}`}
            className="transition-colors hover:text-[#0F1419] motion-reduce:transition-none"
          >
            {dossierReference}
          </Link>
        </li>
        <li aria-hidden className="flex items-center">
          <ChevronRight className="size-3 text-[#0F1419]/40" strokeWidth={1.5} />
        </li>
        <li aria-current="page" className="font-medium text-[#0F1419]/85">
          Mission flow
        </li>
      </ol>
    </nav>
  )
}
