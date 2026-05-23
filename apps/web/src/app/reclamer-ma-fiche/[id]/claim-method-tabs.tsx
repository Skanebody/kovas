'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, FileText, Mail, MessageSquare, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Composant claim — FIX-FF refonte (mai 2026).
 *
 * 3 méthodes principales affichées en **3 colonnes côte à côte** (responsive
 * 1 colonne sur mobile, 3 sur desktop) :
 *
 *   1. Email pro (badge Recommandé) — magic code 6 chiffres envoyé à l'email
 *      officiel masqué stocké sur la fiche.
 *   2. SIRET     (badge Automatique) — match exact + audit, valide immédiat.
 *   3. SMS OTP   (badge Manuel)      — code 6 chiffres envoyé au mobile officiel.
 *
 * 4e méthode "Justificatif manuel" disponible en **lien escape discret en bas**
 * pour les cas où aucune des 3 méthodes principales ne fonctionne (CNI +
 * attestation cert, review humaine sous 24-48h).
 *
 * Quand une méthode passe en mode "code_sent" (Email/SMS) ou validée (SIRET),
 * elle prend tout l'écran avec un panel détaillé.
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
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null)
  const [step, setStep] = useState<Step>('choose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimId, setClaimId] = useState<string | null>(null)
  const router = useRouter()

  const apiBase = `/api/diagnosticians/${diagnosticianId}/claim`

  function reset() {
    setSelectedMethod(null)
    setStep('choose')
    setError(null)
    setClaimId(null)
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
        setError(data.error ?? "Échec de l'envoi du code.")
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
        setError(data.error ?? "Échec de l'envoi du SMS.")
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
    if (!claimId || !selectedMethod) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          method: selectedMethod === 'email' ? 'email_official' : 'sms_official',
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
        setError(data.error ?? "Échec de l'envoi.")
        return
      }
      setStep('manual_submitted')
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Vues "succès" overlay ──────────────────────────────────────
  if (step === 'verified') {
    return (
      <Card variant="flat" padding="lg" className="text-center">
        <CheckCircle2 className="size-12 text-ink mx-auto mb-3" aria-hidden />
        <h3 className="text-[19px] font-semibold text-ink mb-1">Vérification réussie</h3>
        <p className="text-[13px] text-ink-mute">Redirection vers la création de compte&hellip;</p>
      </Card>
    )
  }

  if (step === 'manual_submitted') {
    return (
      <Card variant="flat" padding="lg" className="text-center">
        <CheckCircle2 className="size-12 text-ink mx-auto mb-3" aria-hidden />
        <h3 className="text-[19px] font-semibold text-ink mb-1">Demande envoyée</h3>
        <p className="text-[13px] text-ink-mute max-w-md mx-auto">
          Nous vérifions vos justificatifs. Vous recevrez une réponse sous 24 à 48 heures à
          l&apos;adresse email indiquée.
        </p>
      </Card>
    )
  }

  // ─── Vue détail méthode active ──────────────────────────────────
  if (selectedMethod) {
    return (
      <Card variant="flat" padding="lg">
        <button
          type="button"
          onClick={reset}
          className="text-[11px] font-mono uppercase tracking-wider text-ink-mute hover:text-ink mb-4 underline underline-offset-4"
        >
          ← Choisir une autre méthode
        </button>

        {selectedMethod === 'email' && (
          <EmailPanel
            maskedEmail={maskedEmail}
            step={step}
            loading={loading}
            onSendCode={handleSendEmailCode}
            onVerifyCode={handleVerifyCode}
          />
        )}
        {selectedMethod === 'sms' && (
          <SmsPanel
            maskedPhone={maskedPhone}
            step={step}
            loading={loading}
            onSendCode={handleSendSmsCode}
            onVerifyCode={handleVerifyCode}
          />
        )}
        {selectedMethod === 'siret' && (
          <SiretPanel
            maskedSiret={maskedSiret}
            companyName={companyName}
            loading={loading}
            onVerifySiret={handleVerifySiret}
          />
        )}
        {selectedMethod === 'manual' && (
          <ManualPanel loading={loading} onSubmit={handleUploadManual} />
        )}

        {error && (
          <div className="mt-4 p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
            {error}
          </div>
        )}
      </Card>
    )
  }

  // ─── Vue par défaut : 3 colonnes méthodes claim ─────────────────
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MethodColumn
          icon={Mail}
          title="Email professionnel"
          description="Recevez un code à 6 chiffres sur l'email officiel enregistré pour cette fiche."
          badge="Recommandé"
          badgeTone="info"
          available={!!maskedEmail}
          unavailableHint="Aucun email officiel"
          onSelect={() => setSelectedMethod('email')}
        />
        <MethodColumn
          icon={ShieldCheck}
          title="Numéro SIRET"
          description="Saisissez le SIRET du cabinet. Vérification immédiate par match exact."
          badge="Automatique"
          badgeTone="success"
          available={!!maskedSiret}
          unavailableHint="Pas de SIRET enregistré"
          onSelect={() => setSelectedMethod('siret')}
        />
        <MethodColumn
          icon={MessageSquare}
          title="OTP par SMS"
          description="Code à 6 chiffres envoyé au mobile officiel enregistré pour cette fiche."
          badge="Manuel"
          badgeTone="neutral"
          available={!!maskedPhone}
          unavailableHint="Pas de mobile FR"
          onSelect={() => setSelectedMethod('sms')}
        />
      </div>

      {/* Lien escape : justificatif manuel */}
      <Card variant="flat" padding="default">
        <div className="flex items-start gap-4">
          <FileText className="size-5 text-ink-mute shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-ink mb-1">
              Aucune de ces méthodes ne fonctionne&nbsp;?
            </h3>
            <p className="text-[13px] text-ink-mute mb-3 leading-relaxed">
              Si vos coordonnées officielles sont obsolètes (changement d&apos;email, de cabinet, de
              téléphone), transmettez votre pièce d&apos;identité et votre attestation de
              certification. Vérification manuelle sous 24 à 48 heures.
            </p>
            <button
              type="button"
              onClick={() => setSelectedMethod('manual')}
              className="text-[13px] underline underline-offset-4 text-ink hover:text-ink-mute font-medium"
            >
              Soumettre un justificatif manuel
            </button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
          {error}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

interface MethodColumnProps {
  icon: typeof Mail
  title: string
  description: string
  badge: string
  badgeTone: 'info' | 'success' | 'neutral'
  available: boolean
  unavailableHint: string
  onSelect: () => void
}

function MethodColumn({
  icon: Icon,
  title,
  description,
  badge,
  badgeTone,
  available,
  unavailableHint,
  onSelect,
}: MethodColumnProps) {
  const badgeClasses =
    badgeTone === 'info'
      ? 'bg-pastel-sky text-ink'
      : badgeTone === 'success'
        ? 'bg-pastel-lime text-ink'
        : 'bg-rule/40 text-ink-mute'

  return (
    <Card
      variant="flat"
      padding="default"
      className={`flex flex-col gap-3 transition-all ${available ? 'hover:shadow-glass-lg cursor-pointer' : 'opacity-60'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="size-5 text-ink" aria-hidden />
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-pill ${badgeClasses}`}
        >
          {badge}
        </span>
      </div>
      <h3 className="text-[15px] font-semibold text-ink leading-snug">{title}</h3>
      <p className="text-[12px] text-ink-mute leading-relaxed flex-1">{description}</p>
      {available ? (
        <Button type="button" size="sm" onClick={onSelect} className="w-full">
          Choisir cette méthode
        </Button>
      ) : (
        <p className="text-[11px] text-ink-faint italic">{unavailableHint}</p>
      )}
    </Card>
  )
}

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
        <h3 className="text-[17px] font-semibold text-ink">Vérification email</h3>
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
      <h3 className="text-[17px] font-semibold text-ink">Vérification par email professionnel</h3>
      <p className="text-[14px] text-ink">
        Nous allons envoyer un code à 6 chiffres à l&apos;adresse email enregistrée sur votre fiche
        professionnelle&nbsp;:
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
        Vous ne reconnaissez pas cet email&nbsp;? Choisissez la méthode <em>SIRET</em> ou{' '}
        <em>Justificatif manuel</em>.
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
        <h3 className="text-[17px] font-semibold text-ink">Vérification SMS</h3>
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
      <h3 className="text-[17px] font-semibold text-ink">Vérification par SMS</h3>
      <p className="text-[14px] text-ink">
        Nous allons envoyer un code à 6 chiffres par SMS au numéro mobile enregistré sur votre
        fiche&nbsp;:
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
      <h3 className="text-[17px] font-semibold text-ink">Vérification par SIRET</h3>
      <p className="text-[14px] text-ink">
        Saisissez le SIRET de votre cabinet pour confirmer votre identité.
        {props.companyName && (
          <>
            {' '}
            Cabinet enregistré&nbsp;: <strong>{props.companyName}</strong>.
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
      <h3 className="text-[17px] font-semibold text-ink">Justificatif manuel</h3>
      <p className="text-[14px] text-ink">
        Si aucune autre méthode ne fonctionne, transmettez votre pièce d&apos;identité et votre
        attestation de certification. Nous vérifions manuellement sous 24 à 48 heures.
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
