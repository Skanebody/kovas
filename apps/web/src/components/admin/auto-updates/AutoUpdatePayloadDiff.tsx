/**
 * Affichage simple avant/après pour une auto-update.
 *
 * V1 : pas de diff visuel ligne-par-ligne, on affiche les deux payloads en JSON
 * formaté côte-à-côte. Suffisant pour un admin qui examine.
 */

interface AutoUpdatePayloadDiffProps {
  proposed: Record<string, unknown> | null
  rollback: Record<string, unknown> | null
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '(non sérialisable)'
  }
}

export function AutoUpdatePayloadDiff({ proposed, rollback }: AutoUpdatePayloadDiffProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">
          Avant (rollback_payload)
        </p>
        <pre className="rounded-md border border-rule bg-cream-deep p-3 text-[11px] font-mono text-ink overflow-x-auto max-h-64">
          {rollback && Object.keys(rollback).length > 0
            ? stringify(rollback)
            : '(aucun état antérieur capturé)'}
        </pre>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">
          Après (proposed_payload)
        </p>
        <pre className="rounded-md border border-rule bg-cream-deep p-3 text-[11px] font-mono text-ink overflow-x-auto max-h-64">
          {proposed && Object.keys(proposed).length > 0
            ? stringify(proposed)
            : '(aucun changement de données capturé)'}
        </pre>
      </div>
    </div>
  )
}
