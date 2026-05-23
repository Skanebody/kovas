'use client'

/**
 * KOVAS — Suggestions de prompts pour le Coach IA.
 *
 * 6 prompts pré-rédigés couvrant : productivité, pricing,
 * réglementation, optimisation business.
 * Au clic, le prompt est injecté via `onSelect` dans le chat.
 *
 * Ton SOBRE PROFESSIONNEL — vouvoiement, pas d'emoji.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const SUGGESTIONS: readonly string[] = [
  'Comment optimiser mes DPE en hiver ?',
  'Quels diagnostics se vendent le mieux dans ma région ?',
  "Comment réduire mes coûts d'IA ?",
  'Quel tier est le plus rentable pour moi ?',
  'Top 3 erreurs à éviter sur les diagnostics amiante',
  'Ma productivité ce mois vs M-1',
]

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void
}

export function PromptSuggestions({ onSelect }: PromptSuggestionsProps) {
  return (
    <Card variant="flat" padding="sm">
      <h3 className="text-[13px] font-semibold text-ink mb-3">Suggestions de questions</h3>
      <ul className="space-y-2">
        {SUGGESTIONS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onSelect(prompt)}
              className={cn(
                'w-full text-left rounded-md border border-rule/60 bg-paper/85 px-3 py-2',
                'text-[12.5px] text-ink hover:border-navy/30 hover:bg-sage-alt transition-colors',
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
