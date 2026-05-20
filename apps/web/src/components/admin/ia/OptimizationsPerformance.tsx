/**
 * Récapitulatif des optimisations IA actives + impact estimé.
 *
 * Source : CLAUDE.md §6 (UX paiement + IA-first) + §7bis (stratégie autonomisation).
 * Bloc purement informatif côté admin pour rappeler à Benjamin où sont les leviers
 * de marge brute (cible : 77% M12 → 85%+ M36).
 */

import { Card } from '@/components/ui/card'
import { CheckCircle2, Sparkles } from 'lucide-react'

interface Optimization {
  id: string
  label: string
  description: string
  impact: string
}

const OPTIMIZATIONS: Optimization[] = [
  {
    id: 'prompt-cache',
    label: 'Prompt caching Anthropic (1h TTL)',
    description: 'Système prompts + contexte stable cachés sur 60 min',
    impact: '-30 à -50% tokens input',
  },
  {
    id: 'model-adapted',
    label: 'Modèles adaptés par opération',
    description: 'Haiku 4.5 voice/chat · Sonnet 4.6 vision uniquement',
    impact: '×8 ratio coût Haiku vs Sonnet',
  },
  {
    id: 'skip-blurry',
    label: 'Skip photos floues avant Vision IA',
    description: 'Détection blur OpenCV-wasm côté client + filtre serveur',
    impact: '-15% appels Vision Phase 2',
  },
  {
    id: 'batch',
    label: 'Batching requêtes Vision multi-photos',
    description: "Une seule requête Sonnet pour N photos d'un même équipement",
    impact: '-40% calls Vision multi-photos',
  },
  {
    id: 'hybrid-parser',
    label: 'Parser hybride 80% JS / 20% Haiku',
    description: 'Regex + heuristiques pour structuration voix simple',
    impact: '0,01€/mission vs 0,15€ pur Claude',
  },
]

export function OptimizationsPerformance() {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <Sparkles className="size-4 text-chartreuse-deep" aria-hidden />
          Optimisations IA actives
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Levers · marge brute
        </span>
      </div>

      <ul className="space-y-3" aria-label="Optimisations actives sur le pipeline IA">
        {OPTIMIZATIONS.map((opt) => (
          <li
            key={opt.id}
            className="flex items-start gap-3 rounded-md border border-rule/50 bg-paper/60 px-3 py-2.5"
          >
            <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-ink">{opt.label}</p>
              <p className="text-[11px] text-ink-mute mt-0.5">{opt.description}</p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-chartreuse-deep shrink-0 self-center">
              {opt.impact}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] text-ink-faint italic">
        Cible marge brute : 77% (M12) → 85%+ (M36) via baisse progressive dépendance Claude /
        Whisper. Détails : <span className="font-mono">docs/ai-autonomy-strategy.md</span>.
      </p>
    </Card>
  )
}
