'use client'

import Link from 'next/link'

interface DossierArianeItem {
  label: string
  href?: string
}

interface DossierArianeProps {
  items: DossierArianeItem[]
}

/**
 * Fil d'ariane discret sous le context bar.
 * Police mono uppercase, lien cliquable sur items navigables.
 *
 * Format attendu :
 *   Dossier · Mme Dupont · 12 rue République · DPE en cours
 */
export function DossierAriane({ items }: DossierArianeProps) {
  return (
    <div className="px-6 py-2 bg-paper-deep/70 border-b border-rule/40">
      <nav
        aria-label="Fil d'ariane"
        className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex flex-wrap items-center gap-x-1.5 gap-y-1"
      >
        {items.map((item, i) => {
          const sep =
            i > 0 ? (
              <span aria-hidden className="text-ink-mute/50">
                ·
              </span>
            ) : null
          const content = item.href ? (
            <Link href={item.href} className="hover:text-ink transition-colors duration-fast">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: items length is bounded and order stable
            <span key={i} className="flex items-center gap-1.5 truncate">
              {sep}
              {content}
            </span>
          )
        })}
      </nav>
    </div>
  )
}
