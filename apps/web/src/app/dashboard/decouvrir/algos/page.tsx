/**
 * KOVAS — Catalogue diag-facing des 13 algorithmes A1.3.* (Lot B82 — Vague 3A).
 *
 * Pendant interne du `SectionAlgosCatalog` de la home publique : expose au
 * diagnostiqueur connecté ce que KOVAS calcule pour lui en permanence et
 * pointe vers la surface où chaque algo agit (quand il est exposé).
 *
 * Structure :
 *  - AppPageHeader signature wireframes V5 (eyebrow mono / titre + accent serif)
 *  - Grid 1/2/3 colonnes de 13 cards (1 par algo)
 *  - Footer mono uppercase (tests Vitest + ratio algos sans IA externe)
 *
 * Brand V5 strict : sage `#F5F7F4` (layout), paper card, navy `#0F1419`,
 * chartreuse `#D4F542` UNIQUEMENT pour le badge "EXPOSÉ" (signal positif).
 * Tutoiement strict (décision B74).
 */

import { AppPageHeader } from '@/components/app-page-header'
import {
  ALGOS_STATS,
  type AlgoCatalogEntry,
  DASHBOARD_ALGOS_CATALOG,
} from '@/data/algos/dashboard-catalog'
import { Activity, ArrowUpRight, BadgeCheck, ShieldAlert } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '13 algorithmes',
  description: 'Ce que KOVAS calcule pour toi en permanence — et où le voir dans ton dashboard.',
}

export default function AlgosCatalogPage() {
  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12 animate-fade-in motion-reduce:animate-none">
      <AppPageHeader
        eyebrow="Sous le capot"
        title="13 algorithmes"
        accent="propriétaires"
        description="Ce que KOVAS calcule en continu, et où le voir."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DASHBOARD_ALGOS_CATALOG.map((algo) => (
          <AlgoCard key={algo.code} algo={algo} />
        ))}
      </div>

      {/* Footer page : preuves chiffres */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-6 border-t border-[#0F1419]/[0.08]">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
          <BadgeCheck className="inline size-3.5 mr-1 -mt-px" aria-hidden />
          422 tests Vitest verts
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
          <Activity className="inline size-3.5 mr-1 -mt-px" aria-hidden />
          9/13 algos sans IA externe
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
          <ShieldAlert className="inline size-3.5 mr-1 -mt-px" aria-hidden />
          Données EU Paris
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55 ml-auto">
          {ALGOS_STATS.exposed}/{ALGOS_STATS.total} déjà visibles dans ton app
        </p>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* AlgoCard — sobre, paper, bordure 0.08, sans ombre                          */
/* ────────────────────────────────────────────────────────────────────────── */

function AlgoCard({ algo }: { algo: AlgoCatalogEntry }) {
  const Icon = algo.icon
  const isExposed = algo.status === 'exposed'

  return (
    <article className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-5 space-y-3 flex flex-col">
      <header className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
          {algo.code}
        </p>
        <Icon className="size-4 text-[#0F1419]/55" aria-hidden />
      </header>

      <h2 className="text-base font-semibold text-[#0F1419] tracking-tight">{algo.title}</h2>

      <p className="text-[13px] text-[#0F1419]/72 leading-relaxed flex-1">{algo.what}</p>

      <div className="pt-2 border-t border-[#0F1419]/[0.06]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55 mb-1">
          Pour toi
        </p>
        <p className="text-[13px] text-[#0F1419] font-medium leading-relaxed">{algo.forYou}</p>
      </div>

      {/* Statut d'exposition */}
      <footer className="pt-3 border-t border-[#0F1419]/[0.06] flex items-center justify-between gap-3">
        <ExposureBadge status={algo.status} />
        {isExposed && algo.exposedAt ? (
          <Link
            href={algo.exposedAt}
            className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419] hover:text-[#0F1419]/72 transition-colors inline-flex items-center gap-1"
          >
            {algo.exposedAtLabel ?? 'Voir'}
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
            Prochaine release
          </span>
        )}
      </footer>
    </article>
  )
}

function ExposureBadge({ status }: { status: 'exposed' | 'coming-soon' }) {
  if (status === 'exposed') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{ backgroundColor: '#D4F542', color: '#0F1419' }}
      >
        Exposé
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider border border-[#0F1419]/[0.12] text-[#0F1419]/55">
      Bientôt
    </span>
  )
}
