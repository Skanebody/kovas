'use client'

import { useTransition } from 'react'
import { approveAnomalyAction, rejectAnomalyAction } from './actions'

interface Props {
  trialId: string
  disabled?: boolean
}

/**
 * Boutons "Approuver" / "Rejeter" pour une ligne d'anomalie SIRET.
 *
 * Approuver → retire le flag, le cabinet continue son essai.
 * Rejeter   → définit `blocked_reason='siret_naf_invalid'`, le cabinet
 *              ne peut plus créer d'essai avec ce SIRET.
 */
export function AnomalyRowActions({ trialId, disabled = false }: Props) {
  const [pending, startTransition] = useTransition()

  const onApprove = (): void => {
    if (pending || disabled) return
    if (!confirm("Approuver cette inscription ? L'essai continuera normalement.")) return
    startTransition(async () => {
      const res = await approveAnomalyAction(trialId)
      if (!res.ok) alert(`Erreur : ${res.error ?? 'inconnue'}`)
    })
  }

  const onReject = (): void => {
    if (pending || disabled) return
    if (
      !confirm(
        'Rejeter cette inscription ? Le SIRET sera marqué comme bloqué (signup_naf_invalid).',
      )
    )
      return
    startTransition(async () => {
      const res = await rejectAnomalyAction(trialId)
      if (!res.ok) alert(`Erreur : ${res.error ?? 'inconnue'}`)
    })
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onApprove}
        disabled={pending || disabled}
        className="inline-flex items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
      >
        {pending ? '…' : 'Approuver'}
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={pending || disabled}
        className="inline-flex items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
      >
        {pending ? '…' : 'Rejeter'}
      </button>
    </div>
  )
}
