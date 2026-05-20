/**
 * Helpers de formatage partagés par les composants Paliers/OKRs/Roadmap.
 */

import type { MilestoneCategory, MilestoneRow } from '@/lib/admin/milestones-types'

export function formatMilestoneValue(value: number, unit: string | null): string {
  if (unit === '€') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value)
  }
  if (unit === '%') {
    // Stockage en ratio 0-1 si target ≤ 1, sinon brut
    const pct = value <= 1 ? value * 100 : value
    return `${pct.toFixed(1)}%`
  }
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)
}

export function formatProgressLabel(milestone: {
  current_value: number | null
  target_value: number
  unit: string | null
}): string {
  const current = milestone.current_value ?? 0
  return `${formatMilestoneValue(current, milestone.unit)} / ${formatMilestoneValue(milestone.target_value, milestone.unit)}`
}

export function formatProgressPct(progress: number): string {
  return `${Math.round(progress * 100)}%`
}

export function formatAchievedAt(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const CATEGORY_COLOR_CLASS: Record<MilestoneCategory, string> = {
  mrr: 'bg-pastel-butter text-ink',
  users: 'bg-pastel-sky text-ink',
  missions: 'bg-pastel-lime text-ink',
  product: 'bg-pastel-lavender text-ink',
  business: 'bg-pastel-peach text-ink',
  tech: 'bg-orange-mist text-ink',
}

export function categoryClass(category: MilestoneRow['category']): string {
  return CATEGORY_COLOR_CLASS[category] ?? 'bg-cream-deep text-ink-mute'
}
