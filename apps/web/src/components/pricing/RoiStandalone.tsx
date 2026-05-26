'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { LOGICIEL_PLANS, type LogicielPlan } from '@/lib/pricing-plans'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const DEFAULT_MISSIONS = 60
/** Coût annuel cumulé moyen d'un diagnostiqueur indépendant FR (Liciel +
 *  modules export ADEME + petits outils). Source : 50 entretiens découverte
 *  M0-M5 (cf. CLAUDE.md §17). */
const LICIEL_STACK_ANNUAL_EUR = 1500

interface PayablePlan {
  plan: LogicielPlan
  annualCostMonthlyBilled: number // euros (monthly × 12)
  annualCostBilledAnnual: number // euros (annual price)
  fitsCap: boolean
  capMissions: number
}

function formatEuros(amount: number): string {
  return `${Math.round(amount)} €`
}

function formatEurosPrecise(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`
}

/**
 * Section ROI standalone — refonte V3 dual track 2026-05-21.
 *
 * Modèle KOVAS prix fixe : on compare directement le coût annuel KOVAS
 * (tier optimal pour le volume) à l'empilement Liciel + outils annexes
 * (~1500 €/an sur 50 entretiens découverte).
 *
 * Le tier recommandé est le plus petit dont le cap fair-use couvre le volume.
 */
export function RoiStandalone() {
  const [missions, setMissions] = useState(DEFAULT_MISSIONS)
  const billing: 'monthly' | 'annual' = 'monthly'

  const result = useMemo(() => {
    const safe = Math.max(0, Number.isFinite(missions) ? missions : 0)

    const payablePlans: PayablePlan[] = LOGICIEL_PLANS.filter(
      (p) => p.code !== 'logiciel_free',
    ).map((p: LogicielPlan) => {
      const monthlyEuros = Math.round(p.monthlyPrice / 100)
      const annualEuros = Math.round(p.annualPrice / 100)
      const capMissions = p.code === 'logiciel_enterprise' ? 999_999 : p.caps.missions
      return {
        plan: p,
        annualCostMonthlyBilled: monthlyEuros * 12,
        annualCostBilledAnnual: annualEuros,
        fitsCap: safe <= capMissions,
        capMissions,
      }
    })

    const optimal = payablePlans.find((c) => c.fitsCap) ?? payablePlans[payablePlans.length - 1]

    const annualCostBilled = optimal?.annualCostBilledAnnual ?? 0
    const savingsVsLiciel = LICIEL_STACK_ANNUAL_EUR - annualCostBilled

    return {
      safe,
      optimal,
      annualCostBilled,
      savingsVsLiciel,
    }
  }, [missions])

  // Re-saisie économisée (1h30/mission selon CLAUDE.md §2)
  const minutesSavedPerMission = 80
  const totalMinutesSaved = result.safe * minutesSavedPerMission
  const totalHoursSaved = Math.round(totalMinutesSaved / 60)

  if (!result.optimal) return null

  return (
    <section className="bg-[#0F1419] text-white rounded-[24px] p-6 sm:p-10 my-20">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-bold mb-3">
            Calculateur ROI
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
            À votre volume,{' '}
            <span className="font-serif italic font-normal text-chartreuse">
              ça coûte combien ?
            </span>
          </h2>
          <p className="text-base text-white/72 mt-4 max-w-xl mx-auto">
            Comparaison directe avec l'empilement Liciel + modules ADEME + outils annexes (~1 500 €
            / an sur la base de 50 entretiens diagnostiqueurs).
          </p>
        </div>

        <div className="max-w-md mx-auto mb-10">
          <label
            htmlFor="roi-missions-standalone"
            className="block font-mono text-[11px] uppercase tracking-[0.15em] text-white/72 mb-3 text-center"
          >
            Je fais combien de missions par mois ?
          </label>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setMissions((v) => Math.max(0, v - 5))}
              className="size-10 rounded-full bg-white/[0.08] hover:bg-white/15 text-white text-xl font-medium transition-colors"
              aria-label="Diminuer de 5"
            >
              −
            </button>
            <input
              id="roi-missions-standalone"
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              value={missions}
              onChange={(e) => setMissions(Number.parseInt(e.target.value, 10) || 0)}
              className="bg-white text-[#0F1419] border-0 rounded-[12px] px-4 py-3 text-[28px] font-semibold w-[120px] text-center focus:outline focus:outline-[3px] focus:outline-chartreuse tabular-nums"
            />
            <button
              type="button"
              onClick={() => setMissions((v) => Math.min(500, v + 5))}
              className="size-10 rounded-full bg-white/[0.08] hover:bg-white/15 text-white text-xl font-medium transition-colors"
              aria-label="Augmenter de 5"
            >
              +
            </button>
          </div>
          <p className="text-center text-[11px] text-white/72 mt-2 font-mono">missions / mois</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/15 rounded-[16px] overflow-hidden">
          <div className="bg-[#0F1419] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/72 mb-3">
              Votre tier recommandé
            </p>
            <p className="font-serif italic font-normal text-3xl sm:text-4xl text-chartreuse leading-tight tracking-tight">
              {result.optimal.plan.name}
            </p>
            <p className="text-[13px] text-white/72 mt-3 leading-snug">
              {result.safe === 0
                ? 'Indiquez votre volume pour voir la recommandation.'
                : result.optimal.fitsCap
                  ? `${result.safe} missions / mois, dans la zone fair-use ${result.optimal.capMissions === 999_999 ? 'illimité' : result.optimal.capMissions}.`
                  : `Au-delà de ${result.optimal.capMissions}/mois, on en discute au cas par cas.`}
            </p>
          </div>

          <div className="bg-[#0F1419] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/72 mb-3">
              Coût KOVAS / an
            </p>
            <p className="font-serif italic font-normal text-5xl sm:text-6xl text-white leading-none tracking-tight">
              {formatEuros(result.annualCostBilled)}
            </p>
            <p className="text-[13px] text-white/72 mt-3 leading-snug">
              Forfait fixe annuel (2 mois offerts). Pas de surplus, pas de seconde saisie de CB, pas
              de surprise.
            </p>
          </div>

          <div className="bg-[#0F1419] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/72 mb-3">
              Économie vs Liciel + outils
            </p>
            <p className="font-serif italic font-normal text-5xl sm:text-6xl text-chartreuse leading-none tracking-tight">
              {result.savingsVsLiciel > 0 ? `−${formatEuros(result.savingsVsLiciel)}` : '—'}
            </p>
            <p className="text-[13px] text-white/72 mt-3 leading-snug">
              {result.savingsVsLiciel > 0
                ? `Économie annuelle vs l'empilement Liciel (~1 500 €/an). Sans compter les ${totalHoursSaved}h de re-saisie évitées.`
                : `KOVAS reste plus cher que votre stack actuelle. Mais vous gagnez ${totalHoursSaved}h chaque mois.`}
            </p>
            <p className="text-[11px] text-white/72 mt-2 font-mono">
              Volume saisie : {formatEurosPrecise(result.annualCostBilled / 12)} / mois
            </p>
          </div>
        </div>

        {result.safe > 0 && (
          <div className="mt-10 text-center">
            <Link
              href={`/api/stripe/checkout?plan=${result.optimal.plan.code}&cycle=${billing}`}
              aria-label={`Démarrer en ${result.optimal.plan.name}`}
              className="inline-flex items-center gap-2 bg-chartreuse text-[#0F1419] px-7 py-4 rounded-full text-base font-semibold hover:bg-chartreuse-deep hover:-translate-y-px transition-all duration-150"
            >
              Démarrer en {result.optimal.plan.name}
              <ArrowRight className="size-4" />
            </Link>
            <p className="text-[12px] text-white/72 mt-3 font-mono">
              Essai 30 jours · CB enregistrée mais pas débitée · annulation en 2 clics avant J+30
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
