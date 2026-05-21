'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { LOGICIEL_PLANS, type LogicielPlan } from '@/lib/pricing-plans'
import { useMemo, useState } from 'react'

interface RoiCalculatorProps {
  billing: 'monthly' | 'annual'
}

interface PlanParam {
  code: string
  label: string
  monthly: number
  annual: number
  fairUseCap: number
}

const PLAN_PARAMS: readonly PlanParam[] = LOGICIEL_PLANS.filter(
  (p) => p.code !== 'logiciel_free',
).map((p: LogicielPlan) => ({
  code: p.code,
  label: p.name,
  monthly: Math.round(p.monthlyPrice / 100),
  annual: Math.round(p.annualPrice / 12 / 100),
  fairUseCap: p.code === 'logiciel_enterprise' ? 999_999 : p.caps.missions,
}))

function formatEurosPrecise(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`
}

function formatRoundedEuros(amount: number): string {
  return `${Math.round(amount)} €`
}

/**
 * Calculateur ROI compact — adapté V3 dual track (focus track Logiciel KOVAS 360).
 *
 * L'utilisateur saisit son volume mensuel de missions. On compare au tier
 * `logiciel_active` (recommandé, 59 €/mo) et on suggère le tier optimal selon
 * son volume (Starter 60 / Active 150 / Cabinet 400 / Enterprise illimité).
 *
 * Pas de surplus à calculer (modèle prix fixe). Le coût par mission diminue
 * mécaniquement avec le volume.
 */
export function RoiCalculator({ billing }: RoiCalculatorProps) {
  const [missions, setMissions] = useState(60)

  const result = useMemo(() => {
    const safeMissions = Number.isFinite(missions) ? Math.max(0, missions) : 0

    const feeKey = billing === 'annual' ? 'annual' : 'monthly'
    const activePlan = PLAN_PARAMS.find((p) => p.code === 'logiciel_active')
    if (!activePlan) {
      return {
        safeMissions,
        activeFee: 0,
        perMissionActive: 0,
        optimal: PLAN_PARAMS[0],
      }
    }
    const activeFee = activePlan[feeKey]
    const perMissionActive = safeMissions > 0 ? activeFee / safeMissions : 0

    const optimal =
      PLAN_PARAMS.find((p) => safeMissions <= p.fairUseCap) ??
      PLAN_PARAMS[PLAN_PARAMS.length - 1]

    return { safeMissions, activeFee, perMissionActive, optimal }
  }, [missions, billing])

  let detail: string
  if (result.safeMissions === 0) {
    detail = 'Indiquez votre volume mensuel pour voir le calcul.'
  } else if (result.activeFee === 0) {
    detail = 'Configuration des plans indisponible.'
  } else {
    detail = `${formatRoundedEuros(result.activeFee)} forfait Active ÷ ${result.safeMissions} missions = ${formatEurosPrecise(
      result.perMissionActive,
    )} par mission. Pas de surplus, pas de seconde facture.`
  }

  let adviceTitle = ''
  let adviceBody = ''
  if (result.safeMissions > 0 && result.optimal) {
    if (result.optimal.code === 'logiciel_active') {
      adviceTitle = 'KOVAS 360 Active est votre tier.'
      adviceBody =
        "Vous êtes dans la zone d'usage confortable du fair-use 150 missions / mois."
    } else if (result.safeMissions < 50) {
      adviceTitle = `À ce volume, regardez ${result.optimal.label}.`
      adviceBody = `${formatRoundedEuros(result.optimal.monthly)} / mois suffisent pour un volume sous ${result.optimal.fairUseCap} missions. On préfère vous le dire.`
    } else {
      adviceTitle = `Au-delà du cap Active, regardez ${result.optimal.label}.`
      adviceBody = `Le cap fair-use Active est à 150 missions / mois. À ${result.safeMissions}, ${result.optimal.label} (${formatRoundedEuros(result.optimal.monthly)} / mois) est plus tranquille.`
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
          {result.safeMissions === 0 ? '—' : formatEurosPrecise(result.perMissionActive)}
          <span className="font-sans not-italic font-medium text-[16px] text-white/72 ml-1">
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
