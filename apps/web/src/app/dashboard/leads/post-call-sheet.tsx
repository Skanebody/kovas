'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { type LeadItem, POST_CALL_OUTCOMES, type PostCallOutcome } from './leads-types'

interface PostCallSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadItem | null
  onSubmit: (payload: { leadId: string; outcome: PostCallOutcome; note: string }) => Promise<void>
}

/**
 * BottomSheet "Compte-rendu de l'appel".
 * S'ouvre automatiquement au retour focus après un appel `tel:`.
 *
 * - 3 radios large : Devis envoyé / Pas intéressé / À rappeler
 * - Champ note optionnel
 * - Bouton enregistrer met à jour le lead et passe au suivant
 */
export function PostCallSheet({ open, onOpenChange, lead, onSubmit }: PostCallSheetProps) {
  const [outcome, setOutcome] = useState<PostCallOutcome | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit() {
    if (!lead || !outcome) return
    setPending(true)
    try {
      await onSubmit({ leadId: lead.id, outcome, note: note.trim() })
      // Reset pour le prochain lead
      setOutcome(null)
      setNote('')
    } finally {
      setPending(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setOutcome(null)
      setNote('')
    }
    onOpenChange(next)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Compte-rendu de l'appel"
      description={lead ? `${lead.clientDisplayName} · ${lead.propertyAddress}` : undefined}
    >
      <div className="space-y-4">
        <fieldset className="space-y-2" aria-label="Issue de l'appel">
          <legend className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-1">
            Quelle est l&apos;issue ?
          </legend>
          {POST_CALL_OUTCOMES.map((opt) => {
            const selected = outcome === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors duration-fast',
                  selected
                    ? 'border-chartreuse bg-chartreuse/10'
                    : 'border-rule bg-paper hover:border-rule hover:bg-ink/5',
                )}
              >
                <input
                  type="radio"
                  name="post-call-outcome"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setOutcome(opt.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 size-5 rounded-full border-2 shrink-0 flex items-center justify-center',
                    selected ? 'border-ink bg-ink' : 'border-rule bg-paper',
                  )}
                >
                  {selected ? <Check className="size-3 text-paper" strokeWidth={3} /> : null}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{opt.label}</span>
                  <span className="block text-[12px] text-ink-mute mt-0.5">{opt.hint}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <div className="space-y-1.5">
          <label
            htmlFor="post-call-note"
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
          >
            Note (optionnel)
          </label>
          <textarea
            id="post-call-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-mute/70 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
            placeholder="Ex : rappel mardi 14h, demande devis DPE + amiante…"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="default"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!outcome || pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
