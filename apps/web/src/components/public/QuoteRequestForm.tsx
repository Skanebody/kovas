'use client'

/**
 * KOVAS — Formulaire B2C "Demande de devis diagnostiqueur" (3 étapes wizard).
 *
 * Smart defaults :
 *  - Géolocalisation auto avec consentement utilisateur (reverse-geocoding BAN)
 *  - Auto-détection diagnostics requis (situation + année + type bien)
 *  - Validation temps réel email (syntax) + téléphone (libphonenumber-js)
 *  - Honeypot caché anti-bot
 *
 * Design system v2 : Card flat opaque + Button navy CTA, pastels catégoriels sur tags diags.
 * Ton SOBRE PROFESSIONNEL (cf. CLAUDE.md §9 / avatar-client.md), pas d'émojis fun.
 */

import { Check, ChevronLeft, Loader2, MapPin, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  RecaptchaV3Provider,
  useRecaptcha,
} from '@/components/anti-spam/RecaptchaV3'
import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  computeRequiredDiagnostics,
  DIAGNOSTIC_LABEL,
  type DiagnosticCode,
  type DiagnosticSuggestion,
  type PropertySituation,
  type PropertyType,
} from '@/lib/quote-request/diagnostics'
import {
  validateEmailSyntax,
  validatePhone,
  validateSurface,
  validateYearBuilt,
} from '@/lib/quote-request/validation'
import { cn } from '@/lib/utils'

interface QuoteRequestFormProps {
  diagnosticianId: string
  diagnosticianName: string
  /** Ville fiche, future utilisation (placeholder UI / pré-fill). */
  diagnosticianCity?: string
}

interface PropertyState {
  type: PropertyType | ''
  situation: PropertySituation | ''
  address: string
  postalCode: string
  city: string
  surface: string
  yearBuilt: string
  geoLat: number | null
  geoLng: number | null
}

interface ContactState {
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
  honeypot: string
}

type Step = 1 | 2 | 3

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'local_commercial', label: 'Local commercial' },
  { value: 'autre', label: 'Autre' },
]

const SITUATIONS: { value: PropertySituation; label: string; help: string }[] = [
  { value: 'vente', label: 'Vente', help: 'Vente d’un bien immobilier' },
  { value: 'location', label: 'Location', help: 'Mise en location' },
  { value: 'travaux', label: 'Travaux', help: 'Avant rénovation ou démolition' },
  { value: 'audit', label: 'Audit', help: 'Audit énergétique / pré-rénovation' },
]

const DIAG_PASTEL_CLASS: Record<DiagnosticCode, string> = {
  DPE: 'bg-pastel-butter',
  AMIANTE: 'bg-pastel-peach',
  PLOMB: 'bg-pastel-lavender',
  GAZ: 'bg-pastel-sky',
  ELEC: 'bg-pastel-lime',
  TERMITES: 'bg-pastel-peach',
  CARREZ: 'bg-pastel-sky',
  BOUTIN: 'bg-pastel-sky',
  ERP: 'bg-pastel-butter',
}

export function QuoteRequestForm(props: QuoteRequestFormProps) {
  return (
    <RecaptchaV3Provider>
      <QuoteRequestFormInner {...props} />
    </RecaptchaV3Provider>
  )
}

function QuoteRequestFormInner(props: QuoteRequestFormProps) {
  const { diagnosticianId, diagnosticianName } = props
  const formId = useId()
  const router = useRouter()
  const { getToken: getRecaptchaToken } = useRecaptcha('quote_request_submit')
  const [step, setStep] = useState<Step>(1)
  const [property, setProperty] = useState<PropertyState>({
    type: '',
    situation: '',
    address: '',
    postalCode: '',
    city: '',
    surface: '',
    yearBuilt: '',
    geoLat: null,
    geoLng: null,
  })
  const [contact, setContact] = useState<ContactState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
    honeypot: '',
  })
  const [selectedDiags, setSelectedDiags] = useState<Set<DiagnosticCode>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [geolocStatus, setGeolocStatus] = useState<'idle' | 'pending' | 'done' | 'denied'>('idle')

  // --- Smart default : géolocalisation au mount ---
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return
    if (property.address) return // user déjà saisi
    setGeolocStatus('pending')
    const timer = setTimeout(() => {
      // si on n'a pas eu de réponse dans 6s, on abandonne silencieusement
      setGeolocStatus((curr) => (curr === 'pending' ? 'denied' : curr))
    }, 6000)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(timer)
        const { latitude, longitude } = position.coords
        try {
          const res = await fetch(
            `https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}`,
          )
          if (!res.ok) {
            setGeolocStatus('denied')
            return
          }
          const data = (await res.json()) as {
            features?: Array<{
              properties?: { label?: string; city?: string; postcode?: string }
            }>
          }
          const props = data.features?.[0]?.properties
          if (props) {
            setProperty((prev) => ({
              ...prev,
              address: props.label ?? prev.address,
              city: props.city ?? prev.city,
              postalCode: props.postcode ?? prev.postalCode,
              geoLat: latitude,
              geoLng: longitude,
            }))
          }
          setGeolocStatus('done')
        } catch {
          setGeolocStatus('denied')
        }
      },
      () => {
        clearTimeout(timer)
        setGeolocStatus('denied')
      },
      { timeout: 5000, maximumAge: 60_000 },
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Auto-détection diagnostics requis quand on passe à l'étape 2 ---
  const suggestedDiags: DiagnosticSuggestion[] = useMemo(() => {
    if (!property.type || !property.situation) return []
    const year = property.yearBuilt ? parseInt(property.yearBuilt, 10) : null
    return computeRequiredDiagnostics({
      property_type: property.type,
      property_situation: property.situation,
      property_year_built: year,
    })
  }, [property.type, property.situation, property.yearBuilt])

  // Auto-cocher les diagnostics suggérés à l'entrée dans l'étape 2
  useEffect(() => {
    if (step !== 2) return
    if (selectedDiags.size > 0) return
    setSelectedDiags(new Set(suggestedDiags.map((d) => d.type)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // --- Validations temps réel ---
  const emailValidation = useMemo(
    () => validateEmailSyntax(contact.email),
    [contact.email],
  )
  const phoneValidation = useMemo(() => validatePhone(contact.phone), [contact.phone])
  const surfaceValidation = useMemo(
    () => validateSurface(property.surface),
    [property.surface],
  )
  const yearValidation = useMemo(
    () => validateYearBuilt(property.yearBuilt),
    [property.yearBuilt],
  )

  // --- Validity gates ---
  const canStep1Next: boolean =
    property.type !== '' &&
    property.situation !== '' &&
    property.address.trim().length >= 4 &&
    (surfaceValidation.kind === 'idle' || surfaceValidation.kind === 'valid') &&
    (yearValidation.kind === 'idle' || yearValidation.kind === 'valid')

  const canStep2Next: boolean = selectedDiags.size > 0

  const canSubmit: boolean =
    contact.firstName.trim().length > 0 &&
    contact.lastName.trim().length > 0 &&
    emailValidation.kind === 'valid' &&
    (phoneValidation.kind === 'idle' || phoneValidation.kind === 'valid') &&
    canStep2Next

  // --- Address select handler ---
  const handleAddressSelect = useCallback((value: AddressValue) => {
    setProperty((prev) => ({
      ...prev,
      address: value.label,
      postalCode: value.postalCode ?? prev.postalCode,
      city: value.city ?? prev.city,
      geoLat: value.latitude ?? prev.geoLat,
      geoLng: value.longitude ?? prev.geoLng,
    }))
  }, [])

  // --- Toggle diagnostic ---
  const toggleDiag = useCallback((code: DiagnosticCode) => {
    setSelectedDiags((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }, [])

  // --- Submit ---
  const handleSubmit = useCallback(async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const phoneE164 =
        phoneValidation.kind === 'valid' ? phoneValidation.e164 : null

      // Récupère un token reCAPTCHA v3 (silent challenge)
      const recaptchaToken = await getRecaptchaToken()

      const payload = {
        requester_first_name: contact.firstName.trim(),
        requester_last_name: contact.lastName.trim(),
        requester_email: contact.email.trim(),
        requester_phone: phoneE164,
        property_type: property.type as PropertyType,
        property_situation: property.situation as PropertySituation,
        property_address: property.address || null,
        property_postal_code: property.postalCode || null,
        property_city: property.city || null,
        property_surface_m2:
          surfaceValidation.kind === 'valid' ? surfaceValidation.value : null,
        property_year_built:
          yearValidation.kind === 'valid' ? yearValidation.value : null,
        property_geo_lat: property.geoLat,
        property_geo_lng: property.geoLng,
        diagnostics_requested: Array.from(selectedDiags),
        diagnostics_suggested: suggestedDiags,
        message: contact.message.trim() || null,
        honeypot: contact.honeypot,
        recaptcha_token: recaptchaToken,
      }

      const res = await fetch(`/api/diagnosticians/${diagnosticianId}/quote-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        requestId?: string
        trackingToken?: string
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Erreur lors de l’envoi')
      }

      // Redirect vers page de vérification email
      if (data.trackingToken) {
        router.push(`/verifier-mon-email/${data.trackingToken}`)
        return
      }

      // Fallback (cas spam silencieux) : on garde l'écran succès actuel
      setSuccessMessage(data.message ?? 'Votre demande a bien été transmise.')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSubmitting(false)
    }
  }, [
    contact,
    property,
    selectedDiags,
    suggestedDiags,
    diagnosticianId,
    phoneValidation,
    surfaceValidation,
    yearValidation,
    getRecaptchaToken,
    router,
  ])

  // --- Modal succès ---
  if (successMessage) {
    return (
      <Card variant="opaque" padding="lg" className="text-center">
        <div className="mx-auto size-12 rounded-full bg-pastel-lime flex items-center justify-center mb-4">
          <Check className="size-6 text-ink" aria-hidden />
        </div>
        <h3 className="text-[18px] font-bold text-ink mb-2">Demande envoyée</h3>
        <p className="text-[13px] text-ink-mute leading-relaxed mb-4">{successMessage}</p>
        <p className="text-[12px] text-ink-faint">
          Un email de confirmation vient de t'être envoyé.
        </p>
      </Card>
    )
  }

  return (
    <Card variant="opaque" padding="default" className="relative" aria-labelledby={`${formId}-title`}>
      <h2
        id={`${formId}-title`}
        className="text-[18px] font-bold text-ink mb-1"
      >
        Demander un devis
      </h2>
      <p className="text-[12px] text-ink-mute mb-5">
        Réponse de {diagnosticianName} sous 24-48 heures.
      </p>

      <StepIndicator current={step} />

      {step === 1 && (
        <StepProperty
          property={property}
          setProperty={setProperty}
          onAddressSelect={handleAddressSelect}
          surfaceValidation={surfaceValidation}
          yearValidation={yearValidation}
          geolocStatus={geolocStatus}
          canNext={canStep1Next}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepDiagnostics
          suggestedDiags={suggestedDiags}
          selectedDiags={selectedDiags}
          toggleDiag={toggleDiag}
          canNext={canStep2Next}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepContact
          contact={contact}
          setContact={setContact}
          emailValidation={emailValidation}
          phoneValidation={phoneValidation}
          canSubmit={canSubmit}
          submitting={submitting}
          submitError={submitError}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
        />
      )}
    </Card>
  )
}

// ============================================
// Step indicator (3 dots)
// ============================================
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={3}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={cn(
            'h-1.5 rounded-pill transition-all duration-base ease-spring',
            n === current ? 'w-8 bg-navy' : n < current ? 'w-4 bg-navy/60' : 'w-4 bg-rule',
          )}
        />
      ))}
    </div>
  )
}

// ============================================
// Step 1 — Property
// ============================================
interface StepPropertyProps {
  property: PropertyState
  setProperty: (fn: (prev: PropertyState) => PropertyState) => void
  onAddressSelect: (value: AddressValue) => void
  surfaceValidation: ReturnType<typeof validateSurface>
  yearValidation: ReturnType<typeof validateYearBuilt>
  geolocStatus: 'idle' | 'pending' | 'done' | 'denied'
  canNext: boolean
  onNext: () => void
}

function StepProperty({
  property,
  setProperty,
  onAddressSelect,
  surfaceValidation,
  yearValidation,
  geolocStatus,
  canNext,
  onNext,
}: StepPropertyProps) {
  return (
    <div className="space-y-5">
      <p className="text-[11px] tracking-wider uppercase text-ink-faint font-medium">
        Étape 1 — Le bien
      </p>

      {/* Property type */}
      <div className="space-y-1.5">
        <Label htmlFor="property-type">Type de bien</Label>
        <Select
          id="property-type"
          value={property.type}
          onChange={(e) =>
            setProperty((prev) => ({ ...prev, type: e.target.value as PropertyType | '' }))
          }
        >
          <option value="">Sélectionner…</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Situation */}
      <div className="space-y-1.5">
        <Label htmlFor="property-situation">Situation</Label>
        <Select
          id="property-situation"
          value={property.situation}
          onChange={(e) =>
            setProperty((prev) => ({
              ...prev,
              situation: e.target.value as PropertySituation | '',
            }))
          }
        >
          <option value="">Sélectionner…</option>
          {SITUATIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} — {s.help}
            </option>
          ))}
        </Select>
      </div>

      {/* Adresse */}
      <div className="space-y-1.5">
        <Label htmlFor="property-address">
          Adresse du bien
          {geolocStatus === 'pending' && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-ink-faint font-normal">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Géolocalisation en cours…
            </span>
          )}
          {geolocStatus === 'done' && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-ink-mute font-normal">
              <MapPin className="size-3" aria-hidden />
              Adresse pré-remplie
            </span>
          )}
        </Label>
        <AddressAutocomplete
          name="property-address"
          defaultValue={property.address}
          onSelect={onAddressSelect}
          placeholder="12 rue de Rivoli, 75001 Paris"
          required
        />
      </div>

      {/* Surface + Année */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="property-surface">Surface (m²)</Label>
          <Input
            id="property-surface"
            type="number"
            min={1}
            max={9999}
            inputMode="numeric"
            value={property.surface}
            onChange={(e) => setProperty((prev) => ({ ...prev, surface: e.target.value }))}
            placeholder="80"
          />
          {surfaceValidation.kind === 'invalid' && (
            <p className="text-[11px] text-danger">{surfaceValidation.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="property-year">Année de construction</Label>
          <Input
            id="property-year"
            type="number"
            min={1800}
            max={2026}
            inputMode="numeric"
            value={property.yearBuilt}
            onChange={(e) => setProperty((prev) => ({ ...prev, yearBuilt: e.target.value }))}
            placeholder="1985"
          />
          {yearValidation.kind === 'invalid' && (
            <p className="text-[11px] text-danger">{yearValidation.message}</p>
          )}
        </div>
      </div>

      <Button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="w-full"
        size="lg"
      >
        Suivant
      </Button>
    </div>
  )
}

// ============================================
// Step 2 — Diagnostics (auto-detection)
// ============================================
interface StepDiagnosticsProps {
  suggestedDiags: DiagnosticSuggestion[]
  selectedDiags: Set<DiagnosticCode>
  toggleDiag: (code: DiagnosticCode) => void
  canNext: boolean
  onBack: () => void
  onNext: () => void
}

function StepDiagnostics({
  suggestedDiags,
  selectedDiags,
  toggleDiag,
  canNext,
  onBack,
  onNext,
}: StepDiagnosticsProps) {
  // Liste de tous les diagnostics possibles (suggérés + autres)
  const allCodes: DiagnosticCode[] = useMemo(() => {
    const suggested = suggestedDiags.map((d) => d.type)
    const allDiagCodes: DiagnosticCode[] = [
      'DPE',
      'AMIANTE',
      'PLOMB',
      'GAZ',
      'ELEC',
      'TERMITES',
      'CARREZ',
      'BOUTIN',
      'ERP',
    ]
    const others: DiagnosticCode[] = allDiagCodes.filter((c) => !suggested.includes(c))
    return [...suggested, ...others]
  }, [suggestedDiags])

  const suggestionMap = useMemo(() => {
    const m = new Map<DiagnosticCode, DiagnosticSuggestion>()
    for (const s of suggestedDiags) m.set(s.type, s)
    return m
  }, [suggestedDiags])

  return (
    <div className="space-y-5">
      <p className="text-[11px] tracking-wider uppercase text-ink-faint font-medium">
        Étape 2 — Diagnostics requis
      </p>

      {suggestedDiags.length > 0 && (
        <div className="rounded-md bg-pastel-butter/40 border border-rule/40 p-3 text-[12px] text-ink-soft leading-relaxed">
          <strong className="text-ink">{suggestedDiags.filter((d) => d.required).length}</strong>{' '}
          diagnostic{suggestedDiags.filter((d) => d.required).length > 1 ? 's sont' : ' est'}{' '}
          requis pour ta situation. Tu peux les modifier ci-dessous.
        </div>
      )}

      <ul className="space-y-2">
        {allCodes.map((code) => {
          const suggestion = suggestionMap.get(code)
          const isSelected = selectedDiags.has(code)
          return (
            <li key={code}>
              <button
                type="button"
                onClick={() => toggleDiag(code)}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-all duration-fast ease-spring min-h-[44px]',
                  isSelected
                    ? 'border-navy bg-paper shadow-glass-sm'
                    : 'border-rule bg-paper/50 hover:bg-paper hover:border-rule',
                )}
                aria-pressed={isSelected}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 size-5 rounded shrink-0 border flex items-center justify-center',
                      isSelected ? 'bg-navy border-navy' : 'bg-paper border-rule',
                    )}
                  >
                    {isSelected && <Check className="size-3.5 text-paper" aria-hidden />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'inline-block size-2 rounded-full',
                          DIAG_PASTEL_CLASS[code],
                        )}
                        aria-hidden
                      />
                      <span className="text-[13px] font-semibold text-ink">
                        {DIAGNOSTIC_LABEL[code]}
                      </span>
                      {suggestion?.required && (
                        <span className="text-[10px] tracking-wider uppercase font-semibold text-navy bg-pastel-butter rounded-pill px-2 py-0.5">
                          Obligatoire
                        </span>
                      )}
                      {suggestion && !suggestion.required && (
                        <span className="text-[10px] tracking-wider uppercase font-semibold text-ink-mute bg-cream-deep rounded-pill px-2 py-0.5">
                          Conseillé
                        </span>
                      )}
                    </div>
                    {suggestion && (
                      <p className="text-[11px] text-ink-mute mt-1">{suggestion.reason}</p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="shrink-0" size="lg">
          <ChevronLeft className="size-4" aria-hidden />
          Retour
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex-1"
          size="lg"
        >
          Suivant
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Step 3 — Contact
// ============================================
interface StepContactProps {
  contact: ContactState
  setContact: (fn: (prev: ContactState) => ContactState) => void
  emailValidation: ReturnType<typeof validateEmailSyntax>
  phoneValidation: ReturnType<typeof validatePhone>
  canSubmit: boolean
  submitting: boolean
  submitError: string | null
  onBack: () => void
  onSubmit: () => void
}

function StepContact({
  contact,
  setContact,
  emailValidation,
  phoneValidation,
  canSubmit,
  submitting,
  submitError,
  onBack,
  onSubmit,
}: StepContactProps) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] tracking-wider uppercase text-ink-faint font-medium">
        Étape 3 — Vos coordonnées
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={contact.firstName}
            onChange={(e) =>
              setContact((prev) => ({ ...prev, firstName: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            type="text"
            autoComplete="family-name"
            value={contact.lastName}
            onChange={(e) => setContact((prev) => ({ ...prev, lastName: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={contact.email}
            onChange={(e) => setContact((prev) => ({ ...prev, email: e.target.value }))}
            required
            placeholder="jean.dupont@exemple.fr"
            aria-invalid={emailValidation.kind === 'invalid'}
          />
          {emailValidation.kind === 'valid' && (
            <Check
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-success"
              aria-hidden
            />
          )}
          {emailValidation.kind === 'invalid' && (
            <X
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-danger"
              aria-hidden
            />
          )}
        </div>
        {emailValidation.kind === 'invalid' && (
          <p className="text-[11px] text-danger">{emailValidation.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Téléphone (optionnel)</Label>
        <div className="relative">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={contact.phone}
            onChange={(e) => setContact((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="06 12 34 56 78"
            aria-invalid={phoneValidation.kind === 'invalid'}
          />
          {phoneValidation.kind === 'valid' && (
            <Check
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-success"
              aria-hidden
            />
          )}
          {phoneValidation.kind === 'invalid' && (
            <X
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-danger"
              aria-hidden
            />
          )}
        </div>
        {phoneValidation.kind === 'invalid' && (
          <p className="text-[11px] text-danger">{phoneValidation.message}</p>
        )}
        {phoneValidation.kind === 'valid' && (
          <p className="text-[11px] text-ink-faint">{phoneValidation.formatted}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Message (optionnel)</Label>
        <Textarea
          id="message"
          value={contact.message}
          onChange={(e) => setContact((prev) => ({ ...prev, message: e.target.value }))}
          placeholder="Précisions sur le bien, contraintes d’accès, créneaux préférés…"
          rows={3}
        />
      </div>

      {/* Honeypot anti-bot — caché */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="website">Site web (laissez vide)</Label>
        <Input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={contact.honeypot}
          onChange={(e) => setContact((prev) => ({ ...prev, honeypot: e.target.value }))}
        />
      </div>

      {submitError && (
        <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-[12px] text-danger">
          {submitError}
        </div>
      )}

      <p className="text-[11px] text-ink-faint leading-relaxed">
        En envoyant cette demande, vous acceptez que vos coordonnées soient transmises au
        diagnostiqueur sélectionné. KOVAS n’utilisera pas vos données à des fins commerciales.
      </p>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="shrink-0"
          size="lg"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Retour
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Envoi en cours…
            </>
          ) : (
            'Envoyer la demande'
          )}
        </Button>
      </div>
    </div>
  )
}
