'use server'

import { reviewSignal } from '@/lib/fraud-detection/alert-manager'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ReviewOutcome = 'confirmed_fraud' | 'false_positive' | 'inconclusive'

export async function markSignalReviewed(formData: FormData): Promise<void> {
  const signalId = formData.get('signalId')
  const outcome = formData.get('outcome')
  const notes = formData.get('notes')

  if (typeof signalId !== 'string' || signalId.length === 0) {
    throw new Error('signalId requis')
  }
  const outcomeStr = typeof outcome === 'string' ? outcome : ''
  if (!['confirmed_fraud', 'false_positive', 'inconclusive'].includes(outcomeStr)) {
    throw new Error('outcome invalide')
  }
  const notesStr = typeof notes === 'string' && notes.length > 0 ? notes : undefined

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Authentification requise')
  }

  await reviewSignal(supabase, {
    signalId,
    reviewerId: user.id,
    outcome: outcomeStr as ReviewOutcome,
    ...(notesStr !== undefined ? { notes: notesStr } : {}),
  })

  revalidatePath('/admin/audit/fraude-dpe')
}
