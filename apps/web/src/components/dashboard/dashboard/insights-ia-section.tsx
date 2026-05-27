import { getCurrentUser } from '@/lib/auth/current-user'
import { getUserInsights } from '@/lib/dashboard/insights'
import { Sparkles } from 'lucide-react'
import { InsightCard } from './insight-card'

/**
 * Section 5 — Insights IA contextuels.
 *
 * Server Component qui fetch 2-4 insights actionnables et les rend en stack vertical
 * (mobile + desktop ; spec autorise scroll horizontal desktop optionnel mais le pattern
 * vertical reste plus lisible pour 2-4 items). Empty state sobre si 0 insight.
 *
 * Conformément au DS v5 :
 * - En-tête section : font-mono uppercase tracking-wide
 * - Cards : paper + border rule + radius xl
 * - CTAs : primary chartreuse (Button variant="accent") + secondary ghost
 */
export async function InsightsIASection() {
  const { orgId } = await getCurrentUser()
  const insights = await getUserInsights(orgId)

  return (
    <section aria-labelledby="insights-ia-heading">
      <p
        id="insights-ia-heading"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0F1419]/72 mb-3"
      >
        INSIGHTS IA
      </p>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-[#0F1419]/[0.08] bg-sage/40 p-5 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper text-[#0F1419]"
            >
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#0F1419]">Pas d'insight aujourd'hui.</p>
              <p className="text-[13px] leading-relaxed text-[#0F1419]/72 mt-1">
                Continue sur ta lancée — ton activité est régulière et sans signal d'alerte.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </section>
  )
}
