'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface CriterionProgressProps {
  label: string
  current: number
  needed: number
  unit?: string
  /** Délai d'animation pour stagger visuel */
  delay?: number
}

/**
 * Ligne unitaire d'un critère avec barre de progression animée.
 *
 * Pattern sobre : label + valeur courante / cible + barre + reste OU "Critère atteint".
 * Format strict V5 : font-mono pour valeurs numériques, navy uni pour barre.
 */
export function CriterionProgress({
  label,
  current,
  needed,
  unit = '',
  delay = 0,
}: CriterionProgressProps) {
  const pct = Math.min(100, Math.round((current / Math.max(needed, 1)) * 100))
  const remaining = Math.max(0, needed - current)
  const isReached = remaining === 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="font-mono text-[12px] text-ink-mute tabular-nums">
          {current}
          {unit} / {needed}
          {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-rule/40 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: 0.15 + delay, ease: [0.22, 1, 0.36, 1] }}
          className={cn('h-full rounded-full', isReached ? 'bg-chartreuse-deep' : 'bg-navy')}
        />
      </div>
      <div
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.06em]',
          isReached ? 'text-chartreuse-deep' : 'text-ink-faint',
        )}
      >
        {isReached ? 'Critère atteint' : `Reste ${remaining}${unit}`}
      </div>
    </div>
  )
}
