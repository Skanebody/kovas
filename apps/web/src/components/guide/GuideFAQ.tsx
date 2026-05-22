'use client'

import { cn } from '@/lib/utils'
import type { FAQItem } from '@/lib/guides/types'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface GuideFAQProps {
  readonly items: ReadonlyArray<FAQItem>
  readonly className?: string
}

/**
 * FAQ accordéon en bas de chaque guide.
 *
 * Pattern : `<details>` natifs serait + accessible, mais on contrôle l'état
 * pour permettre "ouvrir une question ferme les autres" + animation chevron.
 * SSR rendu : toutes les questions sont rendues fermées par défaut (sécurise
 * le scoring SEO + écolemobile-first sans JS).
 *
 * Le JSON-LD FAQPage est généré séparément côté serveur (cf. schema.ts).
 */
export function GuideFAQ({ items, className }: GuideFAQProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, idx) => {
        const isOpen = openIdx === idx
        return (
          <article
            key={item.question}
            className="overflow-hidden rounded-lg border border-rule/40 bg-paper"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${idx}`}
              className={cn(
                'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors',
                'hover:bg-ink/[0.03]',
              )}
            >
              <h3 className="font-display text-base font-semibold text-ink md:text-lg">
                {item.question}
              </h3>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-ink-mute transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <div
              id={`faq-answer-${idx}`}
              role="region"
              aria-hidden={!isOpen}
              className={cn(
                'overflow-hidden transition-[max-height,opacity] duration-300 ease-out',
                isOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0',
              )}
            >
              <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-soft">
                {item.answer}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
