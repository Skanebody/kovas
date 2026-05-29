'use client'

import { type ReplyToReviewState, replyToReview } from '@/app/dashboard/annuaire/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { Loader2 } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'

const REPLY_MAX = 1000

/**
 * Formulaire de réponse à un avis annuaire (server action replyToReview).
 *
 * Compact par défaut (bouton "Répondre") → déplié en zone de saisie.
 * La server action vérifie l'ownership ; on s'appuie sur RLS côté DB.
 */
export function ReviewReplyForm({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [state, formAction, pending] = useActionState<ReplyToReviewState, FormData>(
    replyToReview,
    undefined,
  )

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success('Réponse publiée.')
      // La page est revalidée côté serveur (revalidatePath) → la réponse
      // s'affichera après le refresh RSC. On referme le formulaire local.
      setOpen(false)
      setReply('')
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="default" size="sm" onClick={() => setOpen(true)}>
          Répondre
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="reviewId" value={reviewId} />
      <div className="space-y-1.5">
        <Textarea
          name="reply"
          value={reply}
          onChange={(e) => setReply(e.target.value.slice(0, REPLY_MAX))}
          placeholder="Remercie ton client et reste sobre et professionnel…"
          rows={3}
          maxLength={REPLY_MAX}
          disabled={pending}
          required
        />
        <p className="text-right font-mono text-[10px] text-ink-faint tabular-nums">
          {reply.length} / {REPLY_MAX}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Publication…
            </>
          ) : (
            'Publier la réponse'
          )}
        </Button>
      </div>
    </form>
  )
}
