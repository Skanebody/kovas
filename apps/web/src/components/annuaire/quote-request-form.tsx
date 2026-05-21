'use client'

import { useEffect, useState } from 'react'
import { OtpInput } from '@/components/forms/OtpInput'

interface Props {
  diagnosticianId: string
  diagnosticianName: string
}

type Step = 'contact' | 'otp' | 'submitted' | 'silent'

interface LeadDraft {
  diagnostician_id: string
  requester_first_name: string
  requester_last_name: string
  requester_email: string
  requester_phone: string
  property_address: string
  property_postal_code: string
  property_city: string
  property_type: string
  property_situation: string
  property_surface_m2: number | null
  diagnostics_requested: string[]
  message: string | null
  honeypot: string
}

interface SendOtpResponse {
  ok: boolean
  otpId?: string
  expiresAt?: string
  devCode?: string
  error?: string
  message?: string
}

interface VerifyOtpResponse {
  ok: boolean
  verifiedAt?: string
  leadId?: string | null
  error?: string
  message?: string
  attemptsRemaining?: number
}

interface SubmitResponse {
  ok: boolean
  leadId?: string
  trackingToken?: string
  routingStrategy?: string
  recipientCount?: number
  silent?: boolean
  error?: string
  message?: string
}

const RESEND_COOLDOWN_SECONDS = 30
const OTP_DIGITS = 6

/**
 * Formulaire de demande de devis B2C avec vérification OTP par SMS (Mission E3).
 *
 * Étapes :
 *   1. 'contact' — collecte coordonnées + bien + diagnostics → call /api/leads/send-otp
 *   2. 'otp'     — saisie code 6 chiffres → call /api/leads/verify-otp
 *                → succès : call /api/leads/submit
 *   3. 'submitted' — confirmation visuelle
 *
 * Le téléphone E.164 est normalisé client-side (best-effort) puis validé serveur.
 * Honeypot caché (champ 'website') : si rempli, succès silencieux.
 */
export function QuoteRequestForm({ diagnosticianId, diagnosticianName }: Props) {
  const [step, setStep] = useState<Step>('contact')
  const [draft, setDraft] = useState<LeadDraft | null>(null)
  const [otpId, setOtpId] = useState<string | null>(null)
  const [normalizedPhone, setNormalizedPhone] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [contactError, setContactError] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)

  // Cooldown resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setContactError(null)
    setSending(true)

    const formEl = event.currentTarget
    const formData = new FormData(formEl)

    const honeypotValue = String(formData.get('website') ?? '')
    const phoneRaw = String(formData.get('phone') ?? '').trim()
    const phoneE164 = normalizePhoneE164(phoneRaw)
    if (!phoneE164) {
      setContactError(
        'Numéro de téléphone invalide. Format requis : 06XXXXXXXX, +33 6 XX XX XX XX.',
      )
      setSending(false)
      return
    }

    const surfaceRaw = String(formData.get('surface') ?? '')
    const surface = surfaceRaw ? Number.parseInt(surfaceRaw, 10) : null

    const propertyType = String(formData.get('property_type') ?? 'appartement')
    const propertySituation = String(formData.get('property_situation') ?? 'vente')

    const leadDraft: LeadDraft = {
      diagnostician_id: diagnosticianId,
      requester_first_name: String(formData.get('first_name') ?? ''),
      requester_last_name: String(formData.get('last_name') ?? ''),
      requester_email: String(formData.get('email') ?? ''),
      requester_phone: phoneE164,
      property_address: String(formData.get('property_address') ?? ''),
      property_postal_code: String(formData.get('postal_code') ?? ''),
      property_city: String(formData.get('city') ?? ''),
      property_type: propertyType,
      property_situation: propertySituation,
      property_surface_m2: Number.isFinite(surface) ? surface : null,
      diagnostics_requested: formData.getAll('diagnostics').map((d) => String(d)),
      message: (formData.get('message') as string | null) ?? null,
      honeypot: honeypotValue,
    }

    // Honeypot rempli → on simule un succès sans rien envoyer (UX bot)
    if (honeypotValue.length > 0) {
      setStep('silent')
      setSending(false)
      return
    }

    try {
      const res = await fetch('/api/leads/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneE164,
          purpose: 'lead_verification',
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as SendOtpResponse

      if (!res.ok || !payload.ok) {
        setContactError(
          payload.message ?? 'Impossible d’envoyer le code. Réessayez dans quelques instants.',
        )
        setSending(false)
        return
      }

      setDraft(leadDraft)
      setNormalizedPhone(phoneE164)
      setOtpId(payload.otpId ?? null)
      setStep('otp')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      // Affiche devCode en dev (jamais en prod : la route serveur strip ce champ)
      if (payload.devCode && process.env.NODE_ENV !== 'production') {
        console.log('[dev] code OTP =', payload.devCode)
      }
    } catch (err) {
      console.error(err)
      setContactError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setSending(false)
    }
  }

  async function handleOtpComplete(code: string) {
    if (!draft || verifying) return
    setOtpError(null)
    setVerifying(true)

    try {
      // 1. Vérifie l'OTP
      const verifyRes = await fetch('/api/leads/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          code,
          otpId,
        }),
      })
      const verifyPayload = (await verifyRes.json().catch(() => ({}))) as VerifyOtpResponse

      if (!verifyRes.ok || !verifyPayload.ok) {
        const attemptsLeft = verifyPayload.attemptsRemaining
        const baseMsg =
          verifyPayload.message ??
          'Code incorrect. Vérifiez votre SMS et ressaisissez-le.'
        setOtpError(
          typeof attemptsLeft === 'number' && attemptsLeft > 0
            ? `${baseMsg} (${attemptsLeft} tentative${attemptsLeft > 1 ? 's' : ''} restante${attemptsLeft > 1 ? 's' : ''})`
            : baseMsg,
        )
        setResetKey((k) => k + 1)
        setVerifying(false)
        return
      }

      // 2. Soumet le lead
      const submitRes = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadDraft: {
            requester_first_name: draft.requester_first_name,
            requester_last_name: draft.requester_last_name,
            requester_email: draft.requester_email,
            requester_phone: draft.requester_phone,
            property_type: draft.property_type,
            property_situation: draft.property_situation,
            property_address: draft.property_address || null,
            property_postal_code: draft.property_postal_code || null,
            property_city: draft.property_city || null,
            property_surface_m2: draft.property_surface_m2,
            diagnostics_requested: draft.diagnostics_requested,
            message: draft.message,
            honeypot: draft.honeypot,
            diagnostician_id: draft.diagnostician_id,
          },
          otpId,
          phone: normalizedPhone,
        }),
      })
      const submitPayload = (await submitRes.json().catch(() => ({}))) as SubmitResponse

      if (!submitRes.ok || !submitPayload.ok) {
        setOtpError(
          submitPayload.message ?? 'Erreur lors de l’envoi de votre demande. Réessayez.',
        )
        setVerifying(false)
        return
      }

      setRecipientCount(submitPayload.recipientCount ?? null)
      setStep('submitted')
    } catch (err) {
      console.error(err)
      setOtpError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || !normalizedPhone) return
    setOtpError(null)
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    try {
      const res = await fetch('/api/leads/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: 'lead_verification',
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as SendOtpResponse
      if (!res.ok || !payload.ok) {
        setOtpError(payload.message ?? 'Impossible de renvoyer le code.')
        setResendCooldown(0)
        return
      }
      setOtpId(payload.otpId ?? null)
      setResetKey((k) => k + 1)
      if (payload.devCode && process.env.NODE_ENV !== 'production') {
        console.log('[dev] code OTP =', payload.devCode)
      }
    } catch (err) {
      console.error(err)
      setOtpError('Erreur réseau lors du renvoi du code.')
      setResendCooldown(0)
    }
  }

  // === Render: confirmation finale (vraie ou silencieuse honeypot) ===
  if (step === 'submitted' || step === 'silent') {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
        <p className="font-semibold text-green-800">Demande envoyée.</p>
        <p className="text-sm text-green-700 mt-2">
          {step === 'submitted' && recipientCount && recipientCount > 1
            ? `${recipientCount} diagnostiqueurs proches recevront votre demande et vous recontacteront sous 48 h.`
            : `${diagnosticianName} recevra votre demande et vous recontactera sous 48 h.`}
        </p>
      </div>
    )
  }

  // === Render: étape OTP ===
  if (step === 'otp') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-semibold text-lg text-[#0B1D33]">Vérification de votre numéro</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Un code à 6 chiffres a été envoyé par SMS au{' '}
            <span className="font-mono font-medium text-[#0B1D33]">{maskPhone(normalizedPhone)}</span>.
          </p>
          <p className="text-xs text-neutral-500 mt-1">Valide 5 minutes.</p>
        </div>

        <OtpInput
          length={OTP_DIGITS}
          onComplete={handleOtpComplete}
          disabled={verifying}
          error={otpError}
          resetKey={resetKey}
          ariaLabel="Code SMS à 6 chiffres"
        />

        {verifying ? (
          <p className="text-sm text-center text-neutral-600">Vérification en cours…</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('contact')
              setOtpError(null)
            }}
            disabled={verifying}
            className="text-neutral-600 hover:text-[#0B1D33] underline-offset-2 hover:underline disabled:opacity-50"
          >
            Modifier mon numéro
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || verifying}
            className="text-[#0B1D33] font-medium hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resendCooldown > 0
              ? `Renvoyer le code (${resendCooldown}s)`
              : 'Renvoyer le code'}
          </button>
        </div>
      </div>
    )
  }

  // === Render: étape contact (par défaut) ===
  return (
    <form onSubmit={handleContactSubmit} className="space-y-4">
      <h2 className="font-semibold text-lg text-[#0B1D33]">Demander un devis</h2>
      <p className="text-sm text-neutral-600">
        Réponse sous 48 h, gratuit, sans engagement. Un code par SMS confirme votre numéro.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="first_name" label="Prénom" required />
        <Field name="last_name" label="Nom" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="email" label="Email" type="email" required />
        <Field
          name="phone"
          label="Téléphone (mobile)"
          type="tel"
          required
          placeholder="06 12 34 56 78"
          autoComplete="tel"
        />
      </div>

      <Field name="property_address" label="Adresse du bien" required />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field name="postal_code" label="Code postal" required />
        <Field name="city" label="Ville" required className="sm:col-span-2" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectField
          name="property_type"
          label="Type de bien"
          options={[
            { value: 'appartement', label: 'Appartement' },
            { value: 'maison', label: 'Maison' },
            { value: 'local_commercial', label: 'Local commercial' },
            { value: 'autre', label: 'Autre' },
          ]}
          required
        />
        <SelectField
          name="property_situation"
          label="Situation"
          options={[
            { value: 'vente', label: 'Vente' },
            { value: 'location', label: 'Location' },
            { value: 'travaux', label: 'Travaux' },
            { value: 'audit', label: 'Audit' },
          ]}
          required
        />
        <Field name="surface" label="Surface (m²)" type="number" required />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[#0B1D33]">Diagnostics souhaités</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { v: 'DPE', l: 'DPE' },
            { v: 'AMIANTE', l: 'Amiante' },
            { v: 'PLOMB', l: 'Plomb' },
            { v: 'GAZ', l: 'Gaz' },
            { v: 'ELEC', l: 'Électricité' },
            { v: 'TERMITES', l: 'Termites' },
            { v: 'CARREZ', l: 'Carrez' },
            { v: 'ERP', l: 'ERP' },
          ].map((diag) => (
            <label
              key={diag.v}
              className="inline-flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                name="diagnostics"
                value={diag.v}
                className="size-4 accent-[#0B1D33]"
              />
              <span>{diag.l}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-[#0B1D33] mb-1">
          Message complémentaire (optionnel)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/30"
        />
      </div>

      {/* Honeypot anti-bot — ne JAMAIS afficher à l'utilisateur */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Ne pas remplir</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-full bg-[#0B1D33] text-white font-medium py-3 hover:bg-[#0B1D33]/90 transition disabled:opacity-50"
      >
        {sending ? 'Envoi du code…' : 'Recevoir un code par SMS'}
      </button>

      {contactError ? (
        <p className="text-sm text-red-600" role="alert">
          {contactError}
        </p>
      ) : null}

      <p className="text-xs text-neutral-500 leading-relaxed">
        Un SMS contenant un code à 6 chiffres vous sera envoyé pour vérifier votre numéro. En
        envoyant cette demande, vous acceptez que vos coordonnées soient transmises au
        diagnostiqueur sélectionné. Cf.{' '}
        <a href="/confidentialite" className="underline">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  )
}

// ============================================
// Helpers locaux (phone normalization + masking)
// ============================================

/**
 * Normalise un numéro FR best-effort en E.164.
 * Accepte : "06 12 34 56 78", "06.12.34.56.78", "+33 6 12 34 56 78", "0033612345678"...
 * Retourne null si pas un mobile/fixe FR valide après nettoyage.
 *
 * NB : validation stricte côté serveur (regex E.164 + Brevo).
 */
function normalizePhoneE164(input: string): string | null {
  if (!input) return null
  const cleaned = input.replace(/[\s.()-]/g, '')
  if (!cleaned) return null

  // +33XXXXXXXXX (déjà E.164)
  if (/^\+[1-9]\d{1,14}$/.test(cleaned)) {
    return cleaned
  }

  // 0033XXXXXXXXX → +33XXXXXXXXX
  if (cleaned.startsWith('00')) {
    const candidate = `+${cleaned.slice(2)}`
    if (/^\+[1-9]\d{1,14}$/.test(candidate)) {
      return candidate
    }
    return null
  }

  // 0XXXXXXXXX → +33XXXXXXXXX (FR)
  if (/^0\d{9}$/.test(cleaned)) {
    return `+33${cleaned.slice(1)}`
  }

  return null
}

/**
 * Masque un téléphone E.164 pour affichage : +33612345678 → +33 6 ** ** ** 78
 */
function maskPhone(phone: string): string {
  const clean = phone.replace(/\s/g, '')
  if (clean.length < 4) return '***'
  const last2 = clean.slice(-2)
  const prefix = clean.startsWith('+33') ? '+33' : clean.slice(0, 2)
  const middle = clean.slice(prefix.length, -2)
  const masked = middle.length > 1 ? `${middle[0]}${'*'.repeat(middle.length - 1)}` : middle
  return `${prefix} ${masked.slice(0, 1)} ${masked
    .slice(1)
    .match(/.{1,2}/g)
    ?.join(' ') ?? ''} ${last2}`
    .replace(/\s+/g, ' ')
    .trim()
}

function Field({
  name,
  label,
  type = 'text',
  required,
  className,
  placeholder,
  autoComplete,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  className?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-[#0B1D33] mb-1">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/30"
      />
    </div>
  )
}

function SelectField({
  name,
  label,
  options,
  required,
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-[#0B1D33] mb-1">
        {label}
        {required ? ' *' : ''}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/30"
      >
        <option value="" disabled>
          —
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
