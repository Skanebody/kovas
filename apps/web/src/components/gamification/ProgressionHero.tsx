'use client'

import type { LevelId } from '@/lib/gamification/levels'
import { motion } from 'framer-motion'
import { LevelBadgeShield } from './LevelBadgeShield'

interface ProgressionHeroProps {
  level: LevelId
  label: string
  unlockedAt: string | null
  description: string
  progressPercent: number
  nextLabel: string | null
}

/**
 * Hero progression — badge XL + nom du statut en Instrument Serif italic +
 * dates clés + barre globale vers le prochain palier.
 *
 * Responsive :
 *   - mobile (< sm) : badge 160×192 + texte centré
 *   - tablet+desktop (>= sm) : badge 220×264 + texte aligné gauche
 */
export function ProgressionHero({
  level,
  label,
  unlockedAt,
  description,
  progressPercent,
  nextLabel,
}: ProgressionHeroProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-10 sm:text-left">
      <div className="shrink-0">
        <div className="sm:hidden">
          <LevelBadgeShield level={level} unlocked size="xl" current animate />
        </div>
        <div className="hidden sm:block">
          <LevelBadgeShield level={level} unlocked size="hero" current animate />
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Statut professionnel
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-sans font-light text-[44px] sm:text-[56px] md:text-[64px] tracking-tight text-ink leading-[1.02]"
        >
          <span className="font-serif italic font-normal">{label}</span>
        </motion.h2>

        {description ? (
          <p className="text-sm text-ink-mute leading-relaxed max-w-xl mx-auto sm:mx-0">
            {description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-faint sm:justify-start">
          {unlockedAt ? (
            <span className="font-mono">
              Atteint le <span className="text-ink-mute">{formatDate(unlockedAt)}</span>
            </span>
          ) : null}
        </div>

        {nextLabel ? (
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-mono uppercase tracking-[0.08em] text-ink-mute">
                Vers {nextLabel}
              </span>
              <span className="font-mono text-ink tabular-nums">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-rule/40">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-navy to-chartreuse-deep"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
