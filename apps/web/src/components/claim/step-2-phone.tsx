'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

/**
 * Étape 2 — Vérification téléphone pro (refonte Doctolib 2026-05-27).
 *
 * SMS OTP envoyé au numéro pro déclaré chambre/ordre (stocké en DB).
 * Max 3 tentatives par code (côté DB via MAX_VERIFICATION_ATTEMPTS),
 * rate-limit 1 SMS/min (côté `checkClaimRateLimit`).
 */
interface Props {
  diagnosticianId: string
  claimId: string
  maskedPhone: string | null
  onDone: () => void
}

type SubStep = 'request_code' | 'enter_code'

export function Step2Phone({ diagnosticianId, claimId, maskedPhone, onDone }: Props) {
  const [substep, setSubstep] = useState<SubStep>('request_code')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!maskedPhone) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-ink leading-relaxed">
          Aucun numéro mobile professionnel n&apos;est associé à cette fiche.
        </p>
        <p className="text-[12px] text-ink-mute leading-relaxed">
          Contacte{' '}
          <a href="mailto:contact@kovas.fr" className="underline font-medium">
            contact@kovas.fr
          </a>{' '}
          pour un traitement manuel — nos équipes valident ton dossier sous 24 à 48 heures.
        </p>
      </div>
    )
  }

  async function requestCode() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagnosticians/${diagnosticianId}/claim/send-sms-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Échec de l'envoi du SMS.")
        return
      }
      setSubstep('enter_code')
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagnosticians/${diagnosticianId}/claim/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          method: 'sms_official',
          claimId,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        attemptsLeft?: number
        status?: string
      }
      if (!res.ok || !data.ok) {
        const suffix =
          typeof data.attemptsLeft === 'number'
            ? ` (${data.attemptsLeft} essai${data.attemptsLeft > 1 ? 's' : ''} restant${data.attemptsLeft > 1 ? 's' : ''})`
            : ''
        setError(`${data.error ?? 'Code invalide.'}${suffix}`)
        return
      }
      onDone()
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  if (substep === 'request_code') {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-ink leading-relaxed">
          Tu vas recevoir un code à 6 chiffres par SMS sur le numéro&nbsp;:
        </p>
        <p className="text-[15px] font-mono text-ink bg-paper rounded-md px-3 py-2 inline-block border border-rule">
          {maskedPhone}
        </p>
        {error && (
          <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
            {error}
          </div>
        )}
        <Button type="button" onClick={requestCode} disabled={loading}>
          {loading ? 'Envoi en cours…' : 'Recevoir le code par SMS'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink leading-relaxed">
        Code envoyé par SMS au <strong>{maskedPhone}</strong>. Il expire dans 10 minutes.
      </p>

      <div>
        <Label htmlFor="sms-code-input">Code de vérification</Label>
        <Input
          id="sms-code-input"
          inputMode="numeric"
          maxLength={6}
          pattern="\d{6}"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="mt-2 font-mono text-[18px] tracking-[0.3em] text-center"
          autoFocus
        />
      </div>

      {error && (
        <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={verifyCode} disabled={code.length !== 6 || loading}>
          {loading ? 'Vérification…' : 'Valider le code'}
        </Button>
        <Button type="button" variant="ghost" onClick={requestCode} disabled={loading}>
          Renvoyer
        </Button>
      </div>
    </div>
  )
}
