/**
 * KOVAS — Widget "Profession sur 7 jours" (Lot B82 — Vague 3A).
 *
 * Consomme l'endpoint GC4 `/api/public/v1/observatoire/profession` côté
 * server. Affiche 3 KPIs synthétiques de la profession + lien vers
 * l'observatoire complet.
 *
 * On consomme directement les helpers `getEtatProfessionSummary` plutôt que
 * l'endpoint HTTP (évite un round-trip réseau + auth public OK car données
 * 100% anonymisées).
 *
 * Server Component avec ISR 1h (revalidate hérité de la page parente).
 */

import { computeRatios, getEtatProfessionSummary } from '@/lib/observatoire/etat-profession'
import { ArrowUpRight, LineChart } from 'lucide-react'
import Link from 'next/link'

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatPct(value: number): string {
  return `${Math.round(value)} %`
}

export async function ProfessionStatsWidget() {
  let summary: Awaited<ReturnType<typeof getEtatProfessionSummary>> | null = null
  try {
    summary = await getEtatProfessionSummary()
  } catch {
    summary = null
  }

  // Fallback : pas de data → on n'affiche pas le widget (évite UI vide).
  if (!summary || summary.total === 0) {
    return null
  }

  const ratios = computeRatios(summary)

  const kpis = [
    {
      label: 'Diagnostiqueurs actifs',
      value: formatInt(summary.veryActive + summary.moderatelyActive),
      hint: `${formatPct(ratios.veryActivePct)} très actifs`,
    },
    {
      label: 'Profession FR totale',
      value: formatInt(summary.total),
      hint: `${formatPct(ratios.verifiedPct)} vérifiés`,
    },
    {
      label: 'Sync DHUP 7j',
      value: formatInt(summary.dhupSyncedLast7d),
      hint: 'fiches mises à jour',
    },
  ]

  return (
    <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="size-4 text-[#0F1419]/72" aria-hidden />
          <h2 className="text-sm font-semibold text-[#0F1419]">Profession sur 7 jours</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
          Observatoire
        </p>
      </header>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="space-y-1">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              {kpi.label}
            </dt>
            <dd className="font-serif italic font-normal text-[28px] leading-tight text-[#0F1419]">
              {kpi.value}
            </dd>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              {kpi.hint}
            </p>
          </div>
        ))}
      </dl>

      <footer className="pt-2 border-t border-[#0F1419]/[0.06]">
        <Link
          href="/observatoire"
          className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419] hover:text-[#0F1419]/72 transition-colors inline-flex items-center gap-1"
        >
          Voir l’observatoire complet
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </footer>
    </section>
  )
}
