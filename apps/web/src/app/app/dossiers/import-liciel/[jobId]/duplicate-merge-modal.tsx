'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { FieldChoice, FieldChoiceMap } from '@/lib/import/types'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'

/**
 * Définition d'un champ candidat à fusion — affiché en 2 colonnes
 * (existant ↔ nouveau) avec radio buttons « existant / nouveau / éditer ».
 */
export interface MergeFieldDefinition {
  /** Clé technique côté field_choices (ex: 'email', 'phone', 'display_name') */
  key: string
  /** Libellé visible utilisateur (ex: 'Email', 'Téléphone', 'Nom affiché') */
  label: string
  /** Valeur côté prod */
  existing: string | null
  /** Valeur côté staging (à importer) */
  newValue: string | null
}

interface DuplicateMergeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: MergeFieldDefinition[]
  /** Choix précédemment enregistrés (réouverture après fusion partielle) */
  initialChoices?: FieldChoiceMap
  /** Submit : appelé avec field_choices final + ferme la modal */
  onSubmit: (choices: FieldChoiceMap) => Promise<void> | void
}

type ChoiceKind = 'existing' | 'new' | 'edited'

interface PerFieldState {
  kind: ChoiceKind
  edited: string
}

function initialState(field: MergeFieldDefinition, prior?: FieldChoice): PerFieldState {
  if (prior === undefined || prior === null) {
    // Par défaut : si existant a une valeur, on la garde ; sinon on prend new.
    return {
      kind: field.existing ? 'existing' : field.newValue ? 'new' : 'existing',
      edited: '',
    }
  }
  if (prior === 'existing') return { kind: 'existing', edited: '' }
  if (prior === 'new') return { kind: 'new', edited: '' }
  if (typeof prior === 'object' && 'edited' in prior) {
    return { kind: 'edited', edited: prior.edited }
  }
  return { kind: 'existing', edited: '' }
}

/**
 * Modal de fusion par champ. Affiche EXISTANT ↔ NOUVEAU côte à côte, avec
 * pour chaque champ un sélecteur « ● Existant / ○ Nouveau / ○ Éditer (input) ».
 *
 * Lorsque l'utilisateur valide, on POST `/api/import/liciel/dedupe/[jobId]/resolution`
 * avec `resolution=merge` et `field_choices=...`.
 */
export function DuplicateMergeModal({
  open,
  onOpenChange,
  title,
  fields,
  initialChoices,
  onSubmit,
}: DuplicateMergeModalProps) {
  const initial = useMemo(() => {
    const result: Record<string, PerFieldState> = {}
    for (const f of fields) {
      result[f.key] = initialState(f, initialChoices?.[f.key])
    }
    return result
  }, [fields, initialChoices])

  const [state, setState] = useState<Record<string, PerFieldState>>(initial)
  const [submitting, setSubmitting] = useState(false)

  // Reset à chaque réouverture (sinon l'état précédent fuit entre modales)
  useEffect(() => {
    if (open) setState(initial)
  }, [open, initial])

  function setKind(key: string, kind: ChoiceKind) {
    setState((prev) => ({
      ...prev,
      [key]: { kind, edited: prev[key]?.edited ?? '' },
    }))
  }
  function setEdited(key: string, value: string) {
    setState((prev) => ({
      ...prev,
      [key]: { kind: 'edited', edited: value },
    }))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      const choices: FieldChoiceMap = {}
      for (const f of fields) {
        const s = state[f.key]
        if (!s) continue
        if (s.kind === 'existing') choices[f.key] = 'existing'
        else if (s.kind === 'new') choices[f.key] = 'new'
        else if (s.kind === 'edited') choices[f.key] = { edited: s.edited }
      }
      await onSubmit(choices)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif italic font-normal text-xl text-ink">
            {title}
          </DialogTitle>
          <DialogDescription>
            Pour chaque champ, choisissez la valeur à conserver. La fusion modifie
            l&apos;enregistrement existant en prod ; le nouveau staging est marqué « fusionné ».
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[7rem_1fr_1fr_5rem] gap-x-3 gap-y-2 items-center text-xs">
          <div />
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
            Existant
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
            Nouveau (à importer)
          </div>
          <div />
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {fields.map((f) => {
            const s = state[f.key] ?? { kind: 'existing', edited: '' }
            return (
              <div
                key={f.key}
                className="grid grid-cols-[7rem_1fr_1fr_5rem] gap-x-3 gap-y-1 items-start rounded-lg border border-rule/60 bg-paper/50 px-3 py-2.5"
              >
                <div className="text-xs font-medium text-ink pt-1">{f.label}</div>
                <label
                  className={cn(
                    'cursor-pointer rounded-md border px-2 py-1.5 text-xs',
                    s.kind === 'existing'
                      ? 'border-navy bg-navy/5 text-ink'
                      : 'border-rule bg-paper text-ink-mute hover:border-navy/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`field-${f.key}`}
                    className="sr-only"
                    checked={s.kind === 'existing'}
                    onChange={() => setKind(f.key, 'existing')}
                  />
                  <span className="block truncate font-mono">
                    {f.existing || <span className="italic text-ink-mute/70">(vide)</span>}
                  </span>
                </label>
                <label
                  className={cn(
                    'cursor-pointer rounded-md border px-2 py-1.5 text-xs',
                    s.kind === 'new'
                      ? 'border-chartreuse-deep bg-chartreuse/15 text-ink'
                      : 'border-rule bg-paper text-ink-mute hover:border-chartreuse-deep/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`field-${f.key}`}
                    className="sr-only"
                    checked={s.kind === 'new'}
                    onChange={() => setKind(f.key, 'new')}
                  />
                  <span className="block truncate font-mono">
                    {f.newValue || <span className="italic text-ink-mute/70">(vide)</span>}
                  </span>
                </label>
                <div>
                  <button
                    type="button"
                    onClick={() => setKind(f.key, 'edited')}
                    className={cn(
                      'rounded-pill border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider',
                      s.kind === 'edited'
                        ? 'border-ink bg-ink text-paper'
                        : 'border-rule bg-paper text-ink-mute hover:border-navy/40',
                    )}
                  >
                    Éditer
                  </button>
                </div>
                {s.kind === 'edited' && (
                  <div className="col-span-4">
                    <Input
                      value={s.edited}
                      onChange={(e) => setEdited(f.key, e.target.value)}
                      placeholder={`Saisir une valeur pour ${f.label.toLowerCase()}`}
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="accent" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Fusion…' : 'Fusionner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
