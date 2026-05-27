'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

/**
 * Étape 1 — Vérification SIRET (refonte Doctolib 2026-05-27).
 *
 * Match exact contre INSEE Recherche Entreprises (déjà câblé via la route
 * `/api/diagnosticians/[id]/claim/verify-siret`).
 *
 * Si SIRET trouvé + match → status='siret_verified', claim_id retourné.
 * Si mismatch → support contact.
 */
interface Props {
  diagnosticianId: string
  maskedSiret: string | null
  onDone: (claimId: string) => void
}

export function Step1Siret({ diagnosticianId, maskedSiret, onDone }: Props) {
  const [siret, setSiret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagnosticians/${diagnosticianId}/claim/verify-siret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siret }),
      })
      const data = (await res.json()) as { ok?: boolean; claimId?: string; error?: string }
      if (!res.ok || !data.ok || !data.claimId) {
        setError(data.error ?? 'SIRET invalide ou non concordant.')
        return
      }
      onDone(data.claimId)
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink leading-relaxed">
        Saisis le SIRET du cabinet déclaré dans l&apos;annuaire DHUP.
      </p>

      {maskedSiret && (
        <p className="text-[12px] text-ink-mute">
          SIRET attendu&nbsp;: <span className="font-mono">{maskedSiret}</span>
        </p>
      )}

      <div>
        <Label htmlFor="siret-input">SIRET (14 chiffres)</Label>
        <Input
          id="siret-input"
          inputMode="numeric"
          maxLength={20}
          placeholder="12345678900012"
          value={siret}
          onChange={(e) => setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))}
          className="mt-2 font-mono"
          autoFocus
        />
      </div>

      {error && (
        <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
          {error}
          {error.includes('correspond') && (
            <>
              {' '}
              Si tu penses qu&apos;il s&apos;agit d&apos;une erreur, contacte{' '}
              <a href="mailto:contact@kovas.fr" className="underline font-medium">
                contact@kovas.fr
              </a>
              .
            </>
          )}
        </div>
      )}

      <Button type="button" onClick={handleSubmit} disabled={siret.length !== 14 || loading}>
        {loading ? 'Vérification…' : 'Vérifier mon SIRET'}
      </Button>
    </div>
  )
}
