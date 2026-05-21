'use client'

import { PRICING_PLANS } from '@/lib/pricing-plans'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const DEFAULT_MISSIONS = 60
/** Coût annuel cumulé moyen d'un diagnostiqueur indépendant FR (Liciel +
 *  modules export ADEME + petits outils). Source : 50 entretiens découverte
 *  M0-M5 (cf. CLAUDE.md §17). */
const LICIEL_STACK_ANNUAL_EUR = 1500

function formatEuros(amount: number): string {
  return `${Math.round(amount)} €`
}

function formatEurosPrecise(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`
}

/**
 * Section ROI standalone — refonte P9 2026-05-28.
 *
 * Modèle all-you-can-eat : plus de calcul "coût + surplus". On compare
 * directement KOVAS (forfait fixe) à l'empilement Liciel + outils annexes
 * (1500 €/an en moyenne sur 50 entretiens découverte).
 *
 * Le tier recommandé est calculé par rapport au volume × cap fair-use : on
 * suggère le plus petit tier qui couvre le volume confortablement, pas le
 * plus cher.
 */
export function RoiStandalone() {
  const [missions, setMissions] = useState(DEFAULT_MISSIONS)
  const [billing] = useState<'monthly' | 'annual'>('monthly')

  const result = useMemo(() => {
    const safe = Math.max(0, Number.isFinite(missions) ? missions : 0)

    // Pour chaque plan : prix annuel + capacité fair-use
    const candidates = PRICING_PLANS.map((p) => {
      const annualCost = p.monthlyPrice * 12
      const annualCostBilledAnnual = p.annualPrice
      const fitsCap = safe <= p.caps.missions
      return { plan: p, annualCost, annualCostBilledAnnual, fitsCap }
    })

    // Tier optimal : le plus petit dont le cap couvre le volume mensuel.
    // À volume 0 : Essential (le moins cher). Si rien ne couvre : Cabinet.
    const optimal =
      candidates.find((c) => c.fitsCap) ?? candidates[candidates.length - 1]!

    const annualCostMonthly = optimal.annualCost
    const annualCostBilled = optimal.annualCostBilledAnnual
    const savingsVsLiciel = LICIEL_STACK_ANNUAL_EUR - annualCostBilled

    return {
      safe,
      candidates,
      optimal,
      annualCostMonthly,
      annualCostBilled,
      savingsVsLiciel,
    }
  }, [missions, billing])

  // Re-saisie économisée (1h30/mission selon CLAUDE.md §2)
  const minutesSavedPerMission = 80
  const totalMinutesSaved = result.safe * minutesSavedPerMission
  const totalHoursSaved = Math.round(totalMinutesSaved / 60)

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
          <p className="text-base text-white/70 mt-4 max-w-xl mx-auto">
            Comparaison directe avec l'empilement Liciel + modules ADEME + outils annexes
            (~1 500 € / an sur la base de 50 entretiens diagnostiqueurs).
          </p>
        </div>

        {/* INPUT */}
        <div className="max-w-md mx-auto mb-10">
          <label
            htmlFor="roi-missions-standalone"
            className="block font-mono text-[11px] uppercase tracking-[0.15em] text-white/60 mb-3 text-center"
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
          <p className="text-center text-[11px] text-white/50 mt-2 font-mono">missions / mois</p>
        </div>

        {/* RÉSULTATS — 3 panneaux côte à côte */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/15 rounded-[16px] overflow-hidden">
          {/* PANNEAU 1 : Tier recommandé */}
          <div className="bg-[#0F1419] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 mb-3">
              Votre tier recommandé
            </p>
            <p className="font-serif italic font-normal text-3xl sm:text-4xl text-chartreuse leading-tight tracking-tight">
              {result.optimal.plan.name}
            </p>
            <p className="text-[13px] text-white/70 mt-3 leading-snug">
              {result.safe === 0
                ? 'Indiquez votre volume pour voir la recommandation.'
                : result.optimal.fitsCap
                  ? `${result.safe} missions / mois, dans la zone fair-use ${result.optimal.plan.caps.missions}.`
                  : `Au-delà de ${result.optimal.plan.caps.missions}/mois, on en discute au cas par cas.`}
            </p>
          </div>

          {/* PANNEAU 2 : Coût annuel KOVAS 360 */}
          <div className="bg-[#0F1419] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 mb-3">
              Coût KOVAS 360 / an
            </p>
            <p className="font-serif italic font-normal text-5xl sm:text-6xl text-white leading-none tracking-tight">
              {formatEuros(result.annualCostBilled)}
            </p>
            <p className="text-[13px] text-white/70 mt-3 leading-snug">
              Forfait fixe annuel (2 mois offerts). Pas de surplus, pas de seconde saisie de CB,
              pas de surprise.
            </p>
          </div>

          {/* PANNEAU 3 : Économie vs Liciel stack */}
          <div className="bg-[#0F1419] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 mb-3">
              Économie vs Liciel + outils
            </p>
            <p className="font-serif italic font-normal text-5xl sm:text-6xl text-chartreuse leading-none tracking-tight">
              {result.savingsVsLiciel > 0
                ? `−${formatEuros(result.savingsVsLiciel)}`
                : '—'}
            </p>
            <p className="text-[13px] text-white/70 mt-3 leading-snug">
              {result.savingsVsLiciel > 0
                ? `Économie annuelle vs l'empilement Liciel (~1 500 €/an). Sans compter les ${totalHoursSaved}h de re-saisie évitées.`
                : `KOVAS 360 reste plus cher que votre stack actuelle. Mais vous gagnez ${totalHoursSaved}h chaque mois.`}
            </p>
            <p className="text-[11px] text-white/40 mt-2 font-mono">
              Volume saisie : {formatEurosPrecise(result.annualCostBilled / 12)} / mois
            </p>
          </div>
        </div>

        {/* CTA vers le tier optimal */}
        {result.safe > 0 && (
          <div className="mt-10 text-center">
            <Link
              href={`/pricing/checkout?plan=${result.optimal.plan.code}&billing=${billing}`}
              className="inline-flex items-center gap-2 bg-chartreuse text-[#0F1419] px-7 py-4 rounded-full text-base font-semibold hover:bg-chartreuse-deep hover:-translate-y-px transition-all duration-150"
            >
              Démarrer en {result.optimal.plan.name}
              <ArrowRight className="size-4" />
            </Link>
            <p className="text-[12px] text-white/50 mt-3 font-mono">
              Essai 14 jours · résiliable à tout moment
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
