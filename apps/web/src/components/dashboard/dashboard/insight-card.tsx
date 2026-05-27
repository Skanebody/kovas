'use client'

import { Button } from '@/components/ui/button'
import type { DashboardInsight, InsightIconKey } from '@/lib/dashboard/insights'
import { Calendar, CloudRain, Flame, Gauge, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type { ComponentType } from 'react'

interface InsightCardProps {
  insight: DashboardInsight
}

const ICON_MAP: Record<InsightIconKey, ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  users: Users,
  gauge: Gauge,
  'trending-up': TrendingUp,
  flame: Flame,
  'cloud-rain': CloudRain,
}

type TrackAction = 'cta_primary' | 'cta_secondary' | 'dismiss'

/**
 * Best-effort tracking : silent fail si l'API est down (insights non bloquants).
 * Le tracking ne doit pas empêcher la navigation utilisateur.
 */
async function trackInteraction(insightId: string, action: TrackAction): Promise<void> {
  try {
    await fetch('/api/dashboard/insights/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight_id: insightId, action }),
      keepalive: true,
    })
  } catch {
    // silent fail
  }
}

/**
 * InsightCard — carte d'insight IA contextuel (Section 5 Home).
 *
 * Design v5 : carte paper + bord rule, icône dans badge sage, titre Manrope semibold,
 * message ink-mute, CTA primary chartreuse + CTA secondaire ghost « Plus tard ».
 *
 * Le ton est SOBRE PROFESSIONNEL (avatar canonique). Pas d'emoji, pas de gaming.
 */
export function InsightCard({ insight }: InsightCardProps) {
  const Icon = ICON_MAP[insight.iconKey]
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) {
    return null
  }

  function handlePrimary(): void {
    void trackInteraction(insight.id, 'cta_primary')
  }

  function handleSecondary(e: React.MouseEvent<HTMLAnchorElement>): void {
    // CTA secondaire « Plus tard » : pas de navigation, on masque la card.
    if (insight.ctaSecondary?.href === '#') {
      e.preventDefault()
      setDismissed(true)
    }
    void trackInteraction(insight.id, 'cta_secondary')
  }

  return (
    <article
      className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-5 sm:p-6 transition-colors hover:border-[#0F1419]/[0.12]"
      aria-labelledby={`insight-title-${insight.id}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage/60 text-[#0F1419]"
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3
            id={`insight-title-${insight.id}`}
            className="text-[15px] font-semibold leading-snug text-[#0F1419]"
          >
            {insight.title}
          </h3>
          <p className="text-[13px] leading-relaxed text-[#0F1419]/72">{insight.message}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              asChild
              variant="accent"
              size="sm"
              onClick={handlePrimary}
              className="text-[12px]"
            >
              <Link href={insight.ctaPrimary.href}>{insight.ctaPrimary.label}</Link>
            </Button>
            {insight.ctaSecondary && (
              <Button asChild variant="ghost" size="sm" className="text-[12px]">
                <Link href={insight.ctaSecondary.href} onClick={handleSecondary}>
                  {insight.ctaSecondary.label}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
