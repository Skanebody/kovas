'use client'

import { CheckCircle2, FileText, Mail, MessageSquare, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Client component : 4 onglets de vérification (Email / SMS / SIRET / Manuel).
 * On affiche uniquement les onglets disponibles selon les données du diag.
 *
 * UX choice (cf. spec) : tabs visibles d'un coup (pas de drawer ni de stepper)
 * pour que l'utilisateur voit immédiatement les options qu'il a et choisisse.
 */

type Method = 'email' | 'sms' | 'siret' | 'manual'
type Step = 'choose' | 'code_sent' | 'verified' | 'manual_submitted'

interface Props {
  diagnosticianId: string
  maskedEmail: string | null
  maskedPhone: string | null
  maskedSiret: string | null
  companyName: string | null
}

export function ClaimMethodTabs({
  diagnosticianId,
  maskedEmail,
  maskedPhone,
  maskedSiret,
  companyName,
}: Props) {
  // Auto-pick le 1er onglet dispo
  const initialMethod: Method = maskedEmail
    ? 'email'
    : maskedPhone
      ? 'sms'
      : maskedSiret || companyName
        ? 'siret'
        : 'manual'

  const [method, setMethod] = useState<Method>(initialMethod)
  const [step, setStep] = useState<Step>('choose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimId, setClaimId] = useState<string | null>(null)
  const router = useRouter()

  const apiBase = `/api/diagnosticians/${diagnosticianId}/claim`

  const availableTabs: { key: Method; label: string; icon: typeof Mail; available: boolean }[] = [
    { key: 'email', label: 'Email', icon: Mail, available: !!maskedEmail },
    { key: 'sms', label: 'SMS', icon: MessageSquare, available: !!maskedPhone },
    { key: 'siret', label: 'SIRET', icon: ShieldCheck, available: !!(maskedSiret || companyName) },
    { key: 'manual', label: 'Justificatif', icon: FileText, available: true },
  ]

  function switchTab(newMethod: Method) {
    setMethod(newMethod)
    setStep('choose')
    setError(null)
  }

  // ─── Envoi code email ────────────────────────────────────────────
  async function handleSendEmailCode() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/send-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean; claimId?: string; error?: string }
      if (!res.ok || !data.ok || !data.claimId) {
        setError(data.error ?? 'Échec de l\'envoi du code.')
        return
      }
      setClaimId(data.claimId)
      setStep('code_sent')
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Envoi code SMS ──────────────────────────────────────────────
  async function handleSendSmsCode() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/send-sms-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean; claimId?: string; error?: string }
      if (!res.ok || !data.ok || !data.claimId) {
        setError(data.error ?? 'Échec de l\'envoi du SMS.')
        return
      }
      setClaimId(data.claimId)
      setStep('code_sent')
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Vérification code ───────────────────────────────────────────
  async function handleVerifyCode(code: string) {
    if (!claimId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          method: method === 'email' ? 'email_official' : 'sms_official',
          claimId,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        redirect?: string
        error?: string
        attemptsLeft?: number
      }
      if (!res.ok || !data.ok) {
        const suffix =
          typeof data.attemptsLeft === 'number'
            ? ` (${data.attemptsLeft} essai${data.attemptsLeft > 1 ? 's' : ''} restant${data.attemptsLeft > 1 ? 's' : ''})`
            : ''
        setError(`${data.error ?? 'Code invalide.'}${suffix}`)
        return
      }
      setStep('verified')
      // Auto-redirect après 1s
      setTimeout(() => {
        router.push(data.redirect ?? `/signup?claim_id=${claimId}`)
      }, 1000)
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Vérification SIRET ──────────────────────────────────────────
  async function handleVerifySiret(siret: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/verify-siret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siret }),
      })
      const data = (await res.json()) as { ok?: boolean; redirect?: string; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'SIRET invalide.')
        return
      }
      setStep('verified')
      setTimeout(() => {
        router.push(data.redirect ?? '/signup')
      }, 1000)
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Upload manuel ───────────────────────────────────────────────
  async function handleUploadManual(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/upload-manual`, {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Échec de l\'envoi.')
        return
      }
      setStep('manual_submitted')
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="flat" padding="default">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-rule pb-3">
        {availableTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = method === tab.key
          const disabled = !tab.available
          return (
            <button
              key={tab.key}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && switchTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium transition-colors ${
                isActive
                  ? 'bg-navy text-paper'
                  : disabled
                    ? 'text-ink-ghost cursor-not-allowed'
                    : 'text-ink-mute hover:text-ink hover:bg-ink/5'
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Status verified — overlay sur tous les onglets */}
      {step === 'verified' && (
        <div className="text-center py-8">
          <CheckCircle2 className="size-12 text-success mx-auto mb-3" aria-hidden />
          <h3 className="text-[17px] font-semibold text-ink mb-1">Vérification réussie</h3>
          <p className="text-[13px] text-ink-mute">Redirection vers la création de compte&hellip;</p>
        </div>
      )}

      {step === 'manual_submitted' && (
        <div className="text-center py-8">
          <CheckCircle2 className="size-12 text-success mx-auto mb-3" aria-hidden />
          <h3 className="text-[17px] font-semibold text-ink mb-1">Demande envoyée</h3>
          <p className="text-[13px] text-ink-mute max-w-md mx-auto">
            Nous vérifions vos justificatifs. Vous recevrez une réponse sous 24 à 48 heures
            à l&apos;adresse email indiquée.
          </p>
        </div>
      )}

      {/* Tab content : choose ou code_sent */}
      {step !== 'verified' && step !== 'manual_submitted' && (
        <>
          {method === 'email' && (
            <EmailPanel
              maskedEmail={maskedEmail}
              step={step}
              loading={loading}
              onSendCode={handleSendEmailCode}
              onVerifyCode={handleVerifyCode}
            />
          )}
          {method === 'sms' && (
            <SmsPanel
              maskedPhone={maskedPhone}
              step={step}
              loading={loading}
              onSendCode={handleSendSmsCode}
              onVerifyCode={handleVerifyCode}
            />
          )}
          {method === 'siret' && (
            <SiretPanel
              maskedSiret={maskedSiret}
              companyName={companyName}
              loading={loading}
              onVerifySiret={handleVerifySiret}
            />
          )}
          {method === 'manual' && (
            <ManualPanel loading={loading} onSubmit={handleUploadManual} />
          )}
        </>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
          {error}
        </div>
      )}
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────
// Panels
// ────────────────────────────────────────────────────────────────────

function EmailPanel(props: {
  maskedEmail: string | null
  step: Step
  loading: boolean
  onSendCode: () => void
  onVerifyCode: (code: string) => void
}) {
  const [code, setCode] = useState('')

  if (!props.maskedEmail) {
    return (
      <div className="text-[13px] text-ink-mute py-4">
        Aucun email officiel n&apos;est associé à cette fiche. Utilisez une autre méthode.
      </div>
    )
  }

  if (props.step === 'code_sent') {
    return (
      <div className="space-y-4">
        <p className="text-[14px] text-ink">
          Un code à 6 chiffres a été envoyé à <strong>{props.maskedEmail}</strong>.
        </p>
        <div>
          <Label htmlFor="email-code">Code de vérification</Label>
          <Input
            id="email-code"
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
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => props.onVerifyCode(code)}
            disabled={code.length !== 6 || props.loading}
          >
            Vérifier
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => props.onSendCode()}
            disabled={props.loading}
          >
            Renvoyer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink">
        Nous allons envoyer un code à 6 chiffres à l&apos;adresse email enregistrée
        sur votre fiche professionnelle&nbsp;:
      </p>
      <p className="text-[15px] font-mono text-ink bg-cream-deep rounded-md px-3 py-2 inline-block">
        {props.maskedEmail}
      </p>
      <div>
        <Button type="button" onClick={props.onSendCode} disabled={props.loading}>
          {props.loading ? 'Envoi en cours…' : 'Envoyer le code par email'}
        </Button>
      </div>
      <p className="text-[12px] text-ink-mute">
        Vous ne reconnaissez pas cet email&nbsp;? Utilisez la méthode <em>SIRET</em> ou{' '}
        <em>Justificatif</em>.
      </p>
    </div>
  )
}

function SmsPanel(props: {
  maskedPhone: string | null
  step: Step
  loading: boolean
  onSendCode: () => void
  onVerifyCode: (code: string) => void
}) {
  const [code, setCode] = useState('')

  if (!props.maskedPhone) {
    return (
      <div className="text-[13px] text-ink-mute py-4">
        Aucun mobile FR n&apos;est associé à cette fiche. Utilisez une autre méthode.
      </div>
    )
  }

  if (props.step === 'code_sent') {
    return (
      <div className="space-y-4">
        <p className="text-[14px] text-ink">
          Un code à 6 chiffres a été envoyé par SMS au <strong>{props.maskedPhone}</strong>.
        </p>
        <div>
          <Label htmlFor="sms-code">Code de vérification</Label>
          <Input
            id="sms-code"
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
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => props.onVerifyCode(code)}
            disabled={code.length !== 6 || props.loading}
          >
            Vérifier
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => props.onSendCode()}
            disabled={props.loading}
          >
            Renvoyer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink">
        Nous allons envoyer un code à 6 chiffres par SMS au numéro mobile enregistré
        sur votre fiche&nbsp;:
      </p>
      <p className="text-[15px] font-mono text-ink bg-cream-deep rounded-md px-3 py-2 inline-block">
        {props.maskedPhone}
      </p>
      <div>
        <Button type="button" onClick={props.onSendCode} disabled={props.loading}>
          {props.loading ? 'Envoi en cours…' : 'Envoyer le code par SMS'}
        </Button>
      </div>
    </div>
  )
}

function SiretPanel(props: {
  maskedSiret: string | null
  companyName: string | null
  loading: boolean
  onVerifySiret: (siret: string) => void
}) {
  const [siret, setSiret] = useState('')

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink">
        Saisissez le SIRET de votre cabinet pour confirmer votre identité.
        {props.companyName && (
          <>
            {' '}Cabinet enregistré&nbsp;: <strong>{props.companyName}</strong>.
          </>
        )}
      </p>
      {props.maskedSiret && (
        <p className="text-[12px] text-ink-mute">
          SIRET attendu&nbsp;: <span className="font-mono">{props.maskedSiret}</span>
        </p>
      )}
      <div>
        <Label htmlFor="siret">Votre SIRET (14 chiffres)</Label>
        <Input
          id="siret"
          inputMode="numeric"
          maxLength={20}
          placeholder="12345678900012"
          value={siret}
          onChange={(e) => setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))}
          className="mt-2 font-mono"
        />
      </div>
      <Button
        type="button"
        onClick={() => props.onVerifySiret(siret)}
        disabled={siret.length !== 14 || props.loading}
      >
        {props.loading ? 'Vérification…' : 'Vérifier mon SIRET'}
      </Button>
    </div>
  )
}

function ManualPanel(props: {
  loading: boolean
  onSubmit: (fd: FormData) => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        props.onSubmit(fd)
      }}
      className="space-y-4"
    >
      <p className="text-[14px] text-ink">
        Si aucune autre méthode ne fonctionne, transmettez votre pièce d&apos;identité
        et votre attestation de certification. Nous vérifions manuellement sous 24 à 48 heures.
      </p>

      <div>
        <Label htmlFor="contactEmail">Votre email professionnel</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          required
          placeholder="pierre.dupont@cabinet.fr"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="contactPhone">Téléphone (optionnel)</Label>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          placeholder="+33 6 12 34 56 78"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="idDocument">Pièce d&apos;identité (CNI / passeport)</Label>
        <Input
          id="idDocument"
          name="idDocument"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="mt-2"
        />
        <p className="text-[11px] text-ink-faint mt-1">
          PDF ou image. 10 Mo max. Conservée 30 jours puis supprimée.
        </p>
      </div>

      <div>
        <Label htmlFor="certDocument">Attestation de certification</Label>
        <Input
          id="certDocument"
          name="certDocument"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="mt-2"
        />
        <p className="text-[11px] text-ink-faint mt-1">
          Attestation Cofrac / I.Cert / Bureau Veritas / DEKRA / etc.
        </p>
      </div>

      <Button type="submit" disabled={props.loading}>
        {props.loading ? 'Envoi en cours…' : 'Envoyer pour vérification manuelle'}
      </Button>
    </form>
  )
}
