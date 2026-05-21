'use client'

import { PRICING_PLANS } from '@/lib/pricing-plans'
import { useMemo, useState } from 'react'

interface RoiCalculatorProps {
  billing: 'monthly' | 'annual'
}

/** Référentiel local synchronisé avec PRICING_PLANS. */
const PLAN_PARAMS = PRICING_PLANS.map((p) => ({
  code: p.code,
  label: p.name,
  monthly: p.monthlyPrice,
  annual: Math.round(p.annualPrice / 12),
  fairUseCap: p.caps.missions,
}))

function formatEurosPrecise(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`
}

function formatRoundedEuros(amount: number): string {
  return `${Math.round(amount)} €`
}

/**
 * Calculateur ROI compact intégré au tier featured (Pack Pro) — refonte P9.
 *
 * Modèle all-you-can-eat : on n'a plus de "surplus à l'usage" à calculer.
 * On compare juste le coût par mission du tier Pro à votre volume.
 *
 * Si le volume dépasse confortablement le cap fair-use Pro, on suggère All
 * Inclusive ou Cabinet selon le cas. Si le volume est très faible, on suggère
 * Essential ou Découverte.
 */
export function RoiCalculator({ billing }: RoiCalculatorProps) {
  const [missions, setMissions] = useState(60)

  const result = useMemo(() => {
    const safeMissions = Number.isFinite(missions) ? Math.max(0, missions) : 0

    const feeKey = billing === 'annual' ? 'annual' : 'monthly'
    const proPlan = PLAN_PARAMS.find((p) => p.code === 'pro')!
    const proFee = proPlan[feeKey]
    const perMissionPro = safeMissions > 0 ? proFee / safeMissions : 0

    // Tier optimal : plus petit cap qui couvre le volume
    const optimal =
      PLAN_PARAMS.find((p) => safeMissions <= p.fairUseCap) ??
      PLAN_PARAMS[PLAN_PARAMS.length - 1]!

    return { safeMissions, proFee, perMissionPro, optimal }
  }, [missions, billing])

  let detail: string
  if (result.safeMissions === 0) {
    detail = 'Indiquez votre volume mensuel pour voir le calcul.'
  } else {
    detail = `${formatRoundedEuros(result.proFee)} forfait Pro ÷ ${result.safeMissions} missions = ${formatEurosPrecise(
      result.perMissionPro,
    )} par mission. Pas de surplus, pas de seconde facture.`
  }

  let adviceTitle = ''
  let adviceBody = ''
  if (result.safeMissions > 0) {
    if (result.optimal.code === 'pro') {
      adviceTitle = 'Pack Pro est votre tier.'
      adviceBody =
        "Vous êtes dans la zone d'usage confortable du fair-use 200 missions/mois."
    } else if (result.safeMissions < 50) {
      adviceTitle = `À ce volume, regardez ${result.optimal.label}.`
      adviceBody = `${formatRoundedEuros(result.optimal.monthly)} / mois suffisent pour un volume sous ${result.optimal.fairUseCap} missions. On préfère vous le dire.`
    } else {
      adviceTitle = `Au-delà du cap Pro, regardez ${result.optimal.label}.`
      adviceBody = `Le cap fair-use Pro est à 200 missions/mois. À ${result.safeMissions}, ${result.optimal.label} (${formatRoundedEuros(result.optimal.monthly)}/mois) est plus tranquille.`
    }
  }

  return (
    <div className="rounded-[16px] border border-white/15 bg-white/[0.04] p-5 my-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-bold mb-4">
        À votre volume, ça coûte combien ?
      </p>

      <div className="flex items-center gap-2.5 flex-wrap text-sm text-white/90 mb-4">
        <span>Je fais</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          value={missions}
          onChange={(e) => setMissions(Number.parseInt(e.target.value, 10) || 0)}
          aria-label="Nombre de missions par mois"
          className="bg-white text-[#0F1419] border-0 rounded-[10px] px-3 py-2 text-[17px] font-semibold w-[78px] text-center focus:outline-none focus:ring-2 focus:ring-chartreuse"
        />
        <span>missions / mois</span>
      </div>

      <div className="pt-4 border-t border-white/15">
        <div className="font-serif italic font-normal text-[48px] leading-[0.95] tracking-[-0.02em] text-chartreuse">
          {result.safeMissions === 0 ? '—' : formatEurosPrecise(result.perMissionPro)}
          <span className="font-sans not-italic font-medium text-[16px] text-white/60 ml-1">
            par mission, tout compris
          </span>
        </div>
        <p className="text-[13px] text-white/90 leading-relaxed mt-2">{detail}</p>

        {adviceTitle !== '' && (
          <div className="mt-3.5 px-3.5 py-3 bg-chartreuse/10 border-l-[3px] border-chartreuse rounded-[6px] text-[13px] text-white/90 leading-relaxed">
            <strong className="text-chartreuse font-semibold">{adviceTitle}</strong>{' '}
            {adviceBody}
          </div>
        )}
      </div>
    </div>
  )
}
