import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { GuideType } from '@/lib/guides/types'
import { ArrowRight, Calculator } from 'lucide-react'
import Link from 'next/link'

interface GuideCalculatorCTAProps {
  readonly type: GuideType
  readonly shortTitle: string
}

/**
 * CTA "Estimer votre [type] en 2 minutes" inséré 2× dans chaque guide :
 *  - après la section "Quelles sont les règles 2026" (engagement précoce)
 *  - avant la FAQ (dernière chance de conversion)
 *
 * Cible Phase 1 : `/calculateur-dpe-gratuit` existant. Pour les types non-DPE,
 * fallback vers la page calculateur (qui pré-remplit le type). Cette page
 * peut être étoffée plus tard avec des calculateurs spécifiques par type.
 */
export function GuideCalculatorCTA({ type, shortTitle }: GuideCalculatorCTAProps) {
  // Phase 1 : seul le calculateur DPE est en production. Pour les autres
  // diagnostics, on renvoie aussi vers `/calculateur-dpe-gratuit` qui sert
  // de point d'entrée annuaire (formulaire devis). Évolution V2 :
  // calculateurs spécifiques par type.
  const href = type === 'dpe' ? '/calculateur-dpe-gratuit' : '/calculateur-dpe-gratuit'

  return (
    <Card variant="warm" padding="lg" className="my-12">
      <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-paper"
          >
            <Calculator className="size-5" />
          </span>
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
              Outil gratuit
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-ink md:text-2xl">
              Estimez votre {shortTitle} en 2 minutes
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
              Réponse instantanée, sans inscription et sans engagement.
            </p>
          </div>
        </div>
        <Button asChild size="lg" variant="accent" className="shrink-0">
          <Link href={href}>
            Calculer gratuitement
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
