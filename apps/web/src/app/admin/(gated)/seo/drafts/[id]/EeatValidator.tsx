'use client'

/**
 * EeatValidator — sidebar de validation EEAT live.
 *
 * Affiche les 4 critères (anecdote, chiffres, citation expert, photo) avec
 * coche verte ou conseil rouge si manquant.
 *
 * Score = 3 + 3 + 2 + 2 = 10 max (cf. computeEeatScore).
 *
 * Avatar SOBRE : pas d'emoji, vocabulaire "rapport / critère", chiffres
 * Instrument Serif italic (pattern v5 Synthex).
 */

import { Card } from '@/components/ui/card'
import { Check, X } from 'lucide-react'
import type { EeatValidations } from '../../actions'

interface EeatValidatorProps {
  validations: EeatValidations
  score: number
}

interface Criterion {
  key: keyof EeatValidations
  label: string
  weight: number
  ok: string
  ko: string
}

const CRITERIA: readonly Criterion[] = [
  {
    key: 'hasAnecdote',
    label: 'Anecdote terrain',
    weight: 3,
    ok: 'Première personne et contexte concret détectés.',
    ko: "Ajoutez une anecdote terrain (« J'ai récemment réalisé… ») d'au moins 50 mots.",
  },
  {
    key: 'hasFigures',
    label: 'Chiffres sourcés',
    weight: 3,
    ok: 'Au moins 3 chiffres avec unité reconnue (%, €, m², ans, kWh).',
    ko: 'Ajoutez 3 chiffres précis avec unité (ADEME, INSEE, fourchettes de prix).',
  },
  {
    key: 'hasExpertQuote',
    label: 'Citation d’expert',
    weight: 2,
    ok: 'Citation avec attribution Prénom Nom détectée.',
    ko: 'Ajoutez 1 citation entre guillemets attribuée à un expert (Prénom Nom, fonction).',
  },
  {
    key: 'hasPhoto',
    label: 'Photo / illustration',
    weight: 2,
    ok: 'Image Markdown détectée.',
    ko: 'Ajoutez 1 image au format Markdown : ![alt](url).',
  },
]

function scoreClass(score: number): string {
  if (score >= 7) return 'text-[#2D4015]'
  if (score >= 4) return 'text-[#7C3F0A]'
  return 'text-[#8B1414]'
}

function scoreBgClass(score: number): string {
  if (score >= 7) return 'bg-lime-mist'
  if (score >= 4) return 'bg-orange-mist'
  return 'bg-coral-mist'
}

export function EeatValidator({ validations, score }: EeatValidatorProps) {
  return (
    <Card variant="opaque" padding="default" className="space-y-5 sticky top-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          Score EEAT
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`font-serif italic font-normal text-5xl leading-none ${scoreClass(score)}`}>
            {score}
          </span>
          <span className="text-ink-faint text-sm">/ 10</span>
        </div>
        <p className={`inline-block mt-3 rounded-pill px-2.5 py-0.5 text-[11px] font-mono font-semibold ${scoreBgClass(score)} ${scoreClass(score)}`}>
          {score >= 7 ? 'Publiable' : score >= 4 ? 'À enrichir' : 'Insuffisant'}
        </p>
      </div>

      <div className="space-y-3 border-t border-rule pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          Critères
        </p>
        {CRITERIA.map((c) => {
          const ok = validations[c.key]
          return (
            <div
              key={c.key}
              className="flex items-start gap-2.5 rounded-md border border-rule bg-paper px-3 py-2.5"
            >
              <span
                className={`mt-0.5 inline-flex size-5 items-center justify-center rounded-full shrink-0 ${
                  ok ? 'bg-lime-mist text-[#2D4015]' : 'bg-coral-mist text-[#8B1414]'
                }`}
                aria-hidden
              >
                {ok ? <Check className="size-3" /> : <X className="size-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-ink leading-tight">
                  {c.label}{' '}
                  <span className="font-mono text-[10px] text-ink-faint font-normal">
                    +{c.weight}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-ink-mute leading-snug">{ok ? c.ok : c.ko}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-rule pt-4">
        <p className="text-[11px] text-ink-faint leading-relaxed">
          Le score EEAT est recalculé en direct à chaque modification du markdown. Cible minimale
          pour publication : <span className="font-semibold text-ink-mute">7/10</span>.
        </p>
      </div>
    </Card>
  )
}
