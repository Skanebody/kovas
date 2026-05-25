'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { submitStep2Plan } from '../actions'

type PlanCode = 'solo_light' | 'solo_pro' | 'cabinet' | 'cabinet_plus'

const PLANS: {
  code: PlanCode
  name: string
  price: number
  description: string
  features: string[]
  recommended?: boolean
}[] = [
  {
    code: 'solo_light',
    name: 'Solo',
    price: 29,
    description: "Démarrage progressif (jusqu'à 40 missions/mois)",
    features: ['1 utilisateur', '20 Go stockage', 'Tous les exports', 'Surplus 0,99 €/mission'],
  },
  {
    code: 'solo_pro',
    name: 'Pro',
    price: 79,
    description: "Solopreneur standard (jusqu'à 100 missions/mois)",
    features: [
      '1 utilisateur',
      '50 Go stockage',
      'Tous les exports',
      'Surplus 0,79 €/mission',
      'Support prioritaire',
    ],
    recommended: true,
  },
  {
    code: 'cabinet',
    name: 'Cabinet',
    price: 199,
    description: "Petit cabinet (jusqu'à 300 missions/mois)",
    features: [
      "Jusqu'à 5 utilisateurs",
      '100 Go stockage',
      'Branding cabinet',
      'Surplus 0,59 €/mission',
    ],
  },
  {
    code: 'cabinet_plus',
    name: 'Cabinet+',
    price: 499,
    description: "Cabinet structuré (jusqu'à 1000 missions/mois)",
    features: [
      "Jusqu'à 15 utilisateurs",
      '500 Go stockage',
      'API + intégrations',
      'Surplus 0,29 €/mission',
    ],
  },
]

export function Step2PlanForm() {
  const [state, formAction, pending] = useActionState(submitStep2Plan, undefined)
  const [selected, setSelected] = useState<PlanCode>('solo_pro')

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Étape 2 sur 7 — Choix de la formule
        </p>
        <h1 className="font-serif italic text-3xl text-[#0F1419] leading-tight">
          Choisissez votre formule.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70">
          <span className="font-semibold text-[#0F1419]">Essai gratuit 30 jours</span> pour toutes
          les formules. Aucun débit avant J+30. Carte bancaire collectée (Setup Intent Stripe) pour
          vérifier l&apos;authenticité.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="sr-only">Sélectionnez une formule</legend>
          {PLANS.map((plan) => (
            <label
              key={plan.code}
              className={cn(
                'relative cursor-pointer rounded-2xl border-2 p-4 transition-all',
                selected === plan.code
                  ? 'border-[#0F1419] bg-[#F5F7F4]'
                  : 'border-[#0F1419]/[0.08] bg-white hover:border-[#0F1419]/30',
              )}
            >
              <input
                type="radio"
                name="plan"
                value={plan.code}
                checked={selected === plan.code}
                onChange={() => setSelected(plan.code)}
                className="sr-only"
                required
              />
              {plan.recommended && (
                <span className="absolute -top-2 left-4 text-[10px] font-mono uppercase tracking-[0.08em] bg-[#D4F542] text-[#0F1419] px-2 py-0.5 rounded-full font-semibold">
                  Recommandé
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-[15px] text-[#0F1419]">{plan.name}</span>
                <span className="font-serif italic text-2xl text-[#0F1419]">{plan.price} €</span>
              </div>
              <p className="text-[12px] text-[#0F1419]/60 mt-1">{plan.description}</p>
              <ul className="mt-3 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-[12px] text-[#0F1419]/75 flex items-start gap-1.5">
                    <span className="text-[#0F1419]/40 mt-0.5">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </label>
          ))}
        </fieldset>

        {state?.error && (
          <p className="text-[13px] text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Continuer avec {PLANS.find((p) => p.code === selected)?.name}
        </Button>

        <p className="text-center text-[11px] text-[#0F1419]/55">
          La carte bancaire sera demandée à la fin du parcours. Vous pouvez changer de formule à
          tout moment.
        </p>
      </form>
    </div>
  )
}
