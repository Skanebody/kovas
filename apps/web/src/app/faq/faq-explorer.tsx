'use client'

import { useMemo, useState } from 'react'

import { FaqAnswer } from '@/components/faq-answer'
import { Card } from '@/components/ui/card'
import {
  FAQ_CHIPS,
  type FaqChipId,
  buildCategorizedFaq,
  countByChip,
} from '@/lib/institutional/faq-data'
import { cn } from '@/lib/utils'

/**
 * Explorer FAQ avec filtres par chips (Lot #147 SITE-ANNEXES).
 *
 * Le filtrage est calculé côté client à partir du dataset complet (déjà
 * embarqué dans le bundle via buildCategorizedFaq). Sélection de chip
 * réinitialise l'état d'ouverture des accordéons (chaque <details> reste
 * indépendant via state local de l'élément).
 */
export function FaqExplorer() {
  const [activeChip, setActiveChip] = useState<FaqChipId>('all')

  const categorizedFaq = useMemo(() => buildCategorizedFaq(), [])
  const counts = useMemo(() => countByChip(), [])

  const filtered = useMemo(() => {
    if (activeChip === 'all') return categorizedFaq
    return categorizedFaq.filter((q) => q.chips.includes(activeChip))
  }, [activeChip, categorizedFaq])

  return (
    <div className="space-y-8">
      {/* Chips */}
      <div className="space-y-3">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
          Filtrer par catégorie
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Catégories FAQ">
          {FAQ_CHIPS.map((chip) => {
            const isActive = chip.id === activeChip
            const count = counts[chip.id]
            return (
              <button
                key={chip.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveChip(chip.id)}
                className={cn(
                  'rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#0F1419] text-paper border-[#0F1419]'
                    : 'bg-paper/70 text-[#0F1419]/72 border-[#0F1419]/[0.12] hover:border-[#0F1419]/40 hover:text-[#0F1419]',
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    'ml-2 font-mono text-[11px]',
                    isActive ? 'text-paper/72' : 'text-[#0F1419]/40',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Liste filtrée */}
      {filtered.length === 0 ? (
        <Card variant="opaque" padding="default" className="text-sm text-[#0F1419]/72">
          Aucune question dans cette catégorie. Réessayez avec un autre filtre.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <FaqItem key={q.id} id={q.id} question={q.question} answer={q.answer} />
          ))}
        </div>
      )}
    </div>
  )
}

function FaqItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  return (
    <Card variant="opaque" padding="none" className="overflow-hidden">
      <details className="group">
        <summary
          id={id}
          className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-3 hover:bg-[#0F1419]/[0.04] transition-colors scroll-mt-24"
        >
          <h3 className="text-base font-semibold flex-1 min-w-0">{question}</h3>
          <span
            aria-hidden
            className="text-[#0F1419]/55 shrink-0 transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="px-5 pb-5 pt-1 border-t border-[#0F1419]/[0.08]">
          <FaqAnswer markdown={answer} />
        </div>
      </details>
    </Card>
  )
}
