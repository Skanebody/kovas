'use client'

import { AlternativeSuggestions } from '@/components/scheduling/AlternativeSuggestions'
import { ClusteringOpportunity as ClusteringOpportunityCard } from '@/components/scheduling/ClusteringOpportunity'
import { ConflictWarning } from '@/components/scheduling/ConflictWarning'
import { DpeQuotaWarning } from '@/components/scheduling/DpeQuotaWarning'
import { DurationEstimator } from '@/components/scheduling/DurationEstimator'
import { SlotSelector } from '@/components/scheduling/SlotSelector'
import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDebounce } from '@/hooks/useDebounce'
import type { QuotaWarning } from '@/lib/admin/dpe-quota-tracker'
import type { Alternative } from '@/lib/scheduling/alternative-generator'
import type { ClusteringOpportunity } from '@/lib/scheduling/clustering-suggester'
import type { ConflictResult } from '@/lib/scheduling/conflict-detector'
import type { DurationEstimate } from '@/lib/scheduling/duration-estimator'
import type { SchedulingOwnership, SchedulingPropertyType } from '@/lib/scheduling/duration-schemas'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Home,
  Info,
  Loader2,
  MapPin,
  Phone,
  User,
} from 'lucide-react'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { type DossierFormState, createQuickDossierAction } from '../actions'

interface DossierFormProps {
  properties: {
    id: string
    address: string
    city: string | null
    postal_code: string | null
    year_built: number | null
  }[]
  clients: { id: string; display_name: string }[]
  defaultPropertyId?: string
  defaultClientId?: string
}

interface DiagOption {
  value: string
  label: string
  hint?: string
  group: 'dpe' | 'amiante' | 'autres'
}

const DIAG_OPTIONS: DiagOption[] = [
  {
    value: 'dpe_vente',
    label: 'DPE vente',
    group: 'dpe',
    hint: 'Performance énergétique pour mise en vente',
  },
  {
    value: 'dpe_location',
    label: 'DPE location',
    group: 'dpe',
    hint: 'Performance énergétique pour mise en location',
  },
  {
    value: 'copropriete',
    label: 'DPE copropriété',
    group: 'dpe',
    hint: "DPE à l'échelle de l'immeuble",
  },
  { value: 'amiante_vente', label: 'Amiante vente', group: 'amiante', hint: 'Bâti < 1997' },
  { value: 'amiante_avant_travaux', label: 'Amiante avant travaux', group: 'amiante' },
  { value: 'plomb_crep', label: 'Plomb CREP', group: 'autres', hint: 'Bâti < 1949' },
  { value: 'gaz', label: 'Gaz', group: 'autres', hint: 'Installation > 15 ans' },
  { value: 'electricite', label: 'Électricité', group: 'autres', hint: 'Installation > 15 ans' },
  { value: 'termites', label: 'Termites', group: 'autres', hint: 'Zone à risque préfectoral' },
  { value: 'carrez_boutin', label: 'Carrez / Boutin', group: 'autres', hint: 'Mesurage légal' },
  { value: 'erp', label: 'ERP', group: 'autres', hint: 'État des risques (gratuit Géorisques)' },
]

const GROUP_LABELS = {
  dpe: 'DPE',
  amiante: 'Amiante',
  autres: 'Autres diagnostics',
}

// Types de bien — DB enum property_type_enum
// Si appartement/immeuble → on déplie auto le bloc « étage / bâtiment »
const PROPERTY_TYPE_PILLS = [
  { value: 'maison', label: 'Maison', icon: Home, needsApt: false },
  { value: 'appartement', label: 'Appartement', icon: Building2, needsApt: true },
  { value: 'immeuble', label: 'Immeuble', icon: Building2, needsApt: true },
  { value: 'autre', label: 'Autre', icon: Briefcase, needsApt: false },
] as const

type PropertyTypePill = (typeof PROPERTY_TYPE_PILLS)[number]['value']

// Types client UI — mapping vers enum DB client_type (SCI → entreprise)
const CLIENT_TYPE_PILLS = [
  { value: 'particulier', label: 'Particulier', dbType: 'particulier', icon: User },
  { value: 'sci', label: 'SCI', dbType: 'entreprise', icon: Briefcase, isBusiness: true },
  { value: 'syndic', label: 'Syndic', dbType: 'syndic', icon: Building2, isBusiness: true },
  { value: 'agence', label: 'Agence', dbType: 'agence', icon: Home, isBusiness: true },
] as const

type ClientPillValue = (typeof CLIENT_TYPE_PILLS)[number]['value']

// Options scheduling : type granular pour estimation durée (CLAUDE.md scheduling)
const SCHEDULING_PROPERTY_OPTIONS: { value: SchedulingPropertyType; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison_1_niveau', label: 'Maison plain-pied' },
  { value: 'maison_2_niveaux', label: 'Maison R+1' },
  { value: 'maison_3_plus', label: 'Maison R+2 ou plus' },
  { value: 'local', label: 'Local / bureau' },
]

const OWNERSHIP_OPTIONS: { value: SchedulingOwnership; label: string }[] = [
  { value: 'individuel', label: 'Individuel' },
  { value: 'copropriete', label: 'Copropriété' },
  { value: 'monopropriete', label: 'Monopropriété' },
]

// Mapping UI diag -> DiagnosticType backend (l'estimateur attend les 8 codes canoniques)
const DIAG_VALUE_TO_TYPE: Record<string, string> = {
  dpe_vente: 'DPE',
  dpe_location: 'DPE',
  copropriete: 'DPE',
  amiante_vente: 'AMIANTE',
  amiante_avant_travaux: 'AMIANTE',
  plomb_crep: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ELEC',
  termites: 'TERMITES',
  carrez_boutin: 'CARREZ',
  erp: 'ERP',
}

const DPE_VALUES = new Set(['dpe_vente', 'dpe_location', 'copropriete'])

/**
 * Convertit (ymd YYYY-MM-DD, hm HH:MM) Europe/Paris → ISO UTC.
 * Utilise l'offset Paris au moment de la date pour gérer la bascule CET/CEST.
 */
function makeIsoFromYmdHm(ymd: string, hm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}:\d{2}$/.test(hm)) return null
  const probe = new Date(`${ymd}T12:00:00Z`)
  if (Number.isNaN(probe.getTime())) return null
  const offsetParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'longOffset',
  }).formatToParts(probe)
  const raw = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = raw.match(/([+-])(\d{1,2})(?::(\d{2}))?/)
  const sign = m?.[1] ?? '+'
  const hh = (m?.[2] ?? '01').padStart(2, '0')
  const mm = (m?.[3] ?? '00').padStart(2, '0')
  return new Date(`${ymd}T${hm}:00${sign}${hh}:${mm}`).toISOString()
}

function toParisYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function toParisHm(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

// Packs rapides — choix en 1 clic pendant l'appel téléphonique
const QUICK_PACKS = [
  {
    id: 'vente_avant_1949',
    label: 'Vente · avant 1949',
    types: ['dpe_vente', 'amiante_vente', 'plomb_crep'],
  },
  {
    id: 'vente_1949_1997',
    label: 'Vente · 1949-1997',
    types: ['dpe_vente', 'amiante_vente'],
  },
  {
    id: 'vente_recent',
    label: 'Vente · récent',
    types: ['dpe_vente'],
  },
  {
    id: 'location',
    label: 'Location',
    types: ['dpe_location'],
  },
  {
    id: 'complet',
    label: 'Pack complet',
    types: ['dpe_vente', 'amiante_vente', 'plomb_crep', 'gaz', 'electricite'],
  },
]

export function DossierForm({
  properties,
  clients,
  defaultPropertyId,
  defaultClientId,
}: DossierFormProps) {
  const [state, formAction, pending] = useActionState<DossierFormState, FormData>(
    createQuickDossierAction,
    undefined,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set(['dpe_vente']))

  // Mode 'quick' = saisie inline (par défaut, optimisé phone RDV)
  // Mode 'existing' = sélecteur bien existant (basculement opt-in)
  const [mode, setMode] = useState<'quick' | 'existing'>(defaultPropertyId ? 'existing' : 'quick')
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? '')

  // Année construction pour suggestions automatiques de diagnostics
  const [yearBuilt, setYearBuilt] = useState<string>('')
  // Type de bien — détermine si on déplie auto le bloc étage/bâtiment
  const [propertyType, setPropertyType] = useState<PropertyTypePill | ''>('')
  const needsAptDetails =
    PROPERTY_TYPE_PILLS.find((p) => p.value === propertyType)?.needsApt ?? false
  // Compléments adresse — repliés par défaut (uniquement si pertinent)
  const [aptDetailsOpen, setAptDetailsOpen] = useState(false)
  const selectedProperty = properties.find((p) => p.id === propertyId)
  const effectiveYear =
    mode === 'existing'
      ? (selectedProperty?.year_built ?? null)
      : yearBuilt
        ? Number(yearBuilt)
        : null

  // Mode client : inline (par défaut) ou existant
  const [clientMode, setClientMode] = useState<'inline' | 'existing'>(
    defaultClientId ? 'existing' : 'inline',
  )
  const [clientPill, setClientPill] = useState<ClientPillValue>('particulier')
  const activeClientPill =
    CLIENT_TYPE_PILLS.find((p) => p.value === clientPill) ?? CLIENT_TYPE_PILLS[0]
  const clientIsBusiness = 'isBusiness' in activeClientPill && activeClientPill.isBusiness === true

  // ============================================================
  // Intelligence RDV — state local (Phase B UI)
  // ============================================================

  // Inputs scheduling — pas envoyés au server (utilisés uniquement pour estimer)
  const [schedulingPropertyType, setSchedulingPropertyType] =
    useState<SchedulingPropertyType>('appartement')
  const [ownership, setOwnership] = useState<SchedulingOwnership>('individuel')
  const [surface, setSurface] = useState<string>('')
  const [hasGarage, setHasGarage] = useState(false)
  const [hasSousSol, setHasSousSol] = useState(false)
  const [hasComblesAmenagees, setHasComblesAmenagees] = useState(false)

  // Géolocalisation (issue de AddressAutocomplete onSelect)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Estimation durée
  const [estimate, setEstimate] = useState<DurationEstimate | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [forcedDurationMin, setForcedDurationMin] = useState<number | null>(null)

  // Slot sélectionné (date YMD + heure HH:MM). Pré-positionne sur demain Paris
  // (gain de temps tél) — l'heure reste null pour forcer le choix d'un slot.
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return toParisYmd(d)
  })
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)

  // Conflits + alternatives
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null)
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [alternativesLoading, setAlternativesLoading] = useState(false)
  const [forcedOriginal, setForcedOriginal] = useState(false)

  // Clustering opportunity
  const [clusterOpportunity, setClusterOpportunity] = useState<ClusteringOpportunity | null>(null)

  // Quota DPE
  const [dpeQuota, setDpeQuota] = useState<QuotaWarning | null>(null)

  // Calcul de la durée effective (forcée prioritaire, sinon estimée)
  const effectiveDurationMin = useMemo(() => {
    if (forcedDurationMin !== null) return forcedDurationMin
    if (estimate?.totalRounded) return estimate.totalRounded
    return 0
  }, [forcedDurationMin, estimate])

  // Liste des DiagnosticType backend dédupliqués depuis la sélection UI
  const backendDiagnostics = useMemo(() => {
    const set = new Set<string>()
    for (const v of selected) {
      const mapped = DIAG_VALUE_TO_TYPE[v]
      if (mapped) set.add(mapped)
    }
    return Array.from(set)
  }, [selected])

  const hasDpeSelected = useMemo(() => {
    for (const v of selected) if (DPE_VALUES.has(v)) return true
    return false
  }, [selected])

  // Debounce inputs pour fetch estimate-duration (500ms)
  const debouncedDiagnostics = useDebounce(backendDiagnostics, 500)
  const debouncedSurface = useDebounce(surface, 500)
  const debouncedPropertyType = useDebounce(schedulingPropertyType, 500)
  const debouncedOwnership = useDebounce(ownership, 500)
  const debouncedGarage = useDebounce(hasGarage, 500)
  const debouncedSousSol = useDebounce(hasSousSol, 500)
  const debouncedCombles = useDebounce(hasComblesAmenagees, 500)

  // 1. Fetch estimate-duration quand les inputs changent
  useEffect(() => {
    const surfaceNum = Number.parseFloat(debouncedSurface)
    if (!debouncedDiagnostics.length || !Number.isFinite(surfaceNum) || surfaceNum <= 0) {
      setEstimate(null)
      return
    }
    const controller = new AbortController()
    setEstimateLoading(true)
    fetch('/api/scheduling/estimate-duration', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        diagnostics: debouncedDiagnostics,
        surface: surfaceNum,
        propertyType: debouncedPropertyType,
        ownership: debouncedOwnership,
        hasGarage: debouncedGarage,
        hasSousSol: debouncedSousSol,
        hasComblesAmenagees: debouncedCombles,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: DurationEstimate | { error?: string }) => {
        if ('totalRounded' in data) setEstimate(data)
        else setEstimate(null)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setEstimate(null)
      })
      .finally(() => setEstimateLoading(false))
    return () => controller.abort()
  }, [
    debouncedDiagnostics,
    debouncedSurface,
    debouncedPropertyType,
    debouncedOwnership,
    debouncedGarage,
    debouncedSousSol,
    debouncedCombles,
  ])

  // 2. Fetch quota DPE quand au moins un DPE est sélectionné
  useEffect(() => {
    if (!hasDpeSelected) {
      setDpeQuota(null)
      return
    }
    const controller = new AbortController()
    fetch('/api/scheduling/my-dpe-quota', { signal: controller.signal })
      .then((r) => r.json())
      .then((data: QuotaWarning | { status: 'ok' } | { error?: string }) => {
        if ('severity' in data) setDpeQuota(data)
        else setDpeQuota(null)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setDpeQuota(null)
      })
    return () => controller.abort()
  }, [hasDpeSelected])

  // 3. Fetch detect-conflict + suggest-alternatives + clustering-opportunity
  // dès qu'on a date + time + coords + durée effective
  useEffect(() => {
    if (
      !scheduledDate ||
      !scheduledTime ||
      !coords ||
      effectiveDurationMin <= 0 ||
      forcedOriginal
    ) {
      setConflictResult(null)
      setAlternatives([])
      setClusterOpportunity(null)
      return
    }
    const startAtIso = makeIsoFromYmdHm(scheduledDate, scheduledTime)
    if (!startAtIso) return

    const controller = new AbortController()
    setAlternativesLoading(true)

    fetch('/api/scheduling/detect-conflict', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        newMission: {
          geoLat: coords.lat,
          geoLng: coords.lng,
          startAt: startAtIso,
          estimatedDurationMin: effectiveDurationMin,
        },
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then(async (result: ConflictResult | { error?: string }) => {
        if (!('hasConflict' in result)) {
          setConflictResult(null)
          setAlternatives([])
          return
        }
        setConflictResult(result)
        if (result.hasConflict) {
          // Fetch alternatives en parallèle
          const altRes = await fetch('/api/scheduling/suggest-alternatives', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              newMission: {
                geoLat: coords.lat,
                geoLng: coords.lng,
                startAt: startAtIso,
                estimatedDurationMin: effectiveDurationMin,
              },
              conflicts: result.conflicts,
            }),
            signal: controller.signal,
          })
          const alts = (await altRes.json()) as Alternative[] | { error?: string }
          setAlternatives(Array.isArray(alts) ? alts : [])
        } else {
          setAlternatives([])
          // Pas de conflit → tenter de détecter une opportunité de clustering
          const oppRes = await fetch('/api/scheduling/clustering-opportunity', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              newMission: {
                geoLat: coords.lat,
                geoLng: coords.lng,
                startAt: startAtIso,
              },
            }),
            signal: controller.signal,
          })
          const opp = (await oppRes.json()) as ClusteringOpportunity | null | { error?: string }
          if (opp && typeof opp === 'object' && 'recommendation' in opp) {
            setClusterOpportunity(opp)
          } else {
            setClusterOpportunity(null)
          }
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setConflictResult(null)
        setAlternatives([])
        setClusterOpportunity(null)
      })
      .finally(() => setAlternativesLoading(false))

    return () => controller.abort()
  }, [scheduledDate, scheduledTime, coords, effectiveDurationMin, forcedOriginal])

  // Callback de sélection d'une alternative — bascule date/time
  function handleAcceptAlternative(alt: Alternative): void {
    const d = alt.startAt instanceof Date ? alt.startAt : new Date(alt.startAt)
    setScheduledDate(toParisYmd(d))
    setScheduledTime(toParisHm(d))
    setForcedOriginal(false)
  }

  // Callback "Forcer le créneau original" — bypass le warning
  function handleForceOriginal(): void {
    setForcedOriginal(true)
    setConflictResult(null)
    setAlternatives([])
  }

  // Callback AddressAutocomplete onSelect — alimente coords + surface si BAN les fournit
  function handleAddressSelected(addr: AddressValue): void {
    if (typeof addr.latitude === 'number' && typeof addr.longitude === 'number') {
      setCoords({ lat: addr.latitude, lng: addr.longitude })
    } else {
      setCoords(null)
    }
  }

  function toggleDiag(value: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function applyPack(types: string[]) {
    setSelected(new Set(types))
  }

  // Diagnostics obligatoires déduits de l'année de construction (vente).
  // Légal FR (art. L271-4 CCH) :
  //  - amiante : permis de construire avant le 01/07/1997
  //  - plomb CREP : permis de construire avant le 01/01/1949
  //  - DPE : toujours
  //  - ERP : toujours (gratuit Géorisques)
  // Gaz/élec : seulement si installation > 15 ans → impossible à déterminer
  //  juste avec l'année du bien, on laisse en suggestion non auto-cochée.
  const requiredByYear: string[] = ['dpe_vente', 'erp']
  if (effectiveYear) {
    if (effectiveYear < 1997) requiredByYear.push('amiante_vente')
    if (effectiveYear < 1949) requiredByYear.push('plomb_crep')
  }

  // Quand le type devient appartement/immeuble, on déplie automatiquement le
  // bloc compléments adresse pour gagner du temps au téléphone
  useEffect(() => {
    if (needsAptDetails) setAptDetailsOpen(true)
  }, [needsAptDetails])

  // Auto-cochage à chaque changement d'année — cumule avec sélection user
  // (on coche les obligatoires, on ne décoche jamais ce que l'utilisateur a ajouté)
  const lastYearRef = useRef<number | null>(null)
  useEffect(() => {
    // Skip si l'année n'a pas changé
    if (lastYearRef.current === effectiveYear) return
    lastYearRef.current = effectiveYear
    setSelected((prev) => {
      const next = new Set(prev)
      for (const t of requiredByYear) next.add(t)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYear])

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6">
      {/* 1. ADRESSE — priorité absolue : saisie BAN inline par défaut */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label
            htmlFor="address"
            className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5"
          >
            <MapPin className="size-3.5" /> Adresse du bien{' '}
            <span className="text-accent-red">*</span>
          </label>
          {properties.length > 0 && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'quick' ? 'existing' : 'quick'))}
              className="text-[11px] text-ink-mute hover:text-ink underline-offset-4 hover:underline transition-colors"
            >
              {mode === 'quick'
                ? `↻ Choisir un bien existant (${properties.length})`
                : '↻ Saisir une nouvelle adresse'}
            </button>
          )}
        </div>

        {mode === 'quick' ? (
          <>
            <AddressAutocomplete
              name="address"
              placeholder="12 rue de Rivoli, 75001 Paris"
              required
              onSelect={handleAddressSelected}
            />
            {fieldErrors.address && (
              <p className="text-sm text-accent-red" role="alert">
                {fieldErrors.address}
              </p>
            )}

            {/* Type de bien — pillules. Auto-déplie compléments si appart/immeuble */}
            <div className="flex flex-wrap gap-2 mt-2">
              {PROPERTY_TYPE_PILLS.map((p) => {
                const isActive = propertyType === p.value
                const Icon = p.icon
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPropertyType(isActive ? '' : p.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors border',
                      isActive
                        ? 'bg-navy text-paper border-navy'
                        : 'bg-paper text-ink border-rule hover:border-navy/40 hover:bg-cream-deep/40',
                    )}
                  >
                    <Icon className="size-3.5" /> {p.label}
                  </button>
                )
              })}
            </div>
            {propertyType && <input type="hidden" name="propertyType" value={propertyType} />}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <FormField
                label="Année de construction"
                htmlFor="yearBuilt"
                hint="Pré-coche plomb / amiante automatiquement"
              >
                <Input
                  id="yearBuilt"
                  name="yearBuilt"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  max={2100}
                  placeholder="1975"
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt(e.target.value)}
                />
              </FormField>
              <FormField
                label="Surface (m²)"
                htmlFor="surfaceTotal"
                hint="Sert à l'estimation durée"
              >
                <Input
                  id="surfaceTotal"
                  name="surfaceTotal"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100000}
                  step={0.01}
                  placeholder="72"
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                />
              </FormField>
            </div>

            {/* COMPLÉMENTS ADRESSE — collapsible, auto-déplié si appart/immeuble */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAptDetailsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-mute hover:text-ink underline-offset-4 hover:underline transition-colors"
              >
                {aptDetailsOpen ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                {aptDetailsOpen ? 'Masquer' : 'Préciser'} étage · bâtiment · n° appartement
              </button>
              {aptDetailsOpen && (
                <div className="rounded-lg border border-rule bg-paper/40 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="Bâtiment / entrée" htmlFor="buildingLetter">
                      <Input
                        id="buildingLetter"
                        name="buildingLetter"
                        maxLength={10}
                        placeholder="Bât. A"
                      />
                    </FormField>
                    <FormField label="Étage" htmlFor="floorNumber" hint="0 = RDC, -1 = sous-sol">
                      <Input
                        id="floorNumber"
                        name="floorNumber"
                        type="number"
                        inputMode="numeric"
                        min={-5}
                        max={60}
                        placeholder="3"
                      />
                    </FormField>
                    <FormField label="Lot (optionnel)" htmlFor="lotNumber">
                      <Input id="lotNumber" name="lotNumber" maxLength={20} placeholder="Lot 24" />
                    </FormField>
                  </div>
                  <FormField
                    label="N° appartement / porte"
                    htmlFor="apartmentDetail"
                    hint="« Apt 12B », « porte gauche », « local 204 »"
                  >
                    <Input
                      id="apartmentDetail"
                      name="apartmentDetail"
                      maxLength={120}
                      placeholder="Apt 12B"
                    />
                  </FormField>
                  <p className="text-[11px] text-ink-mute italic">
                    Ces infos pré-remplissent automatiquement le dossier et l&apos;adresse affichée
                    le jour de la visite — pas besoin de les redemander au client.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <FormField label="Bien concerné" htmlFor="propertyId" error={fieldErrors.propertyId}>
            <Select
              id="propertyId"
              name="propertyId"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
            >
              <option value="" disabled>
                — Sélectionnez un bien —
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                  {p.city ? ` · ${p.postal_code ?? ''} ${p.city}`.trim() : ''}
                  {p.year_built ? ` · ${p.year_built}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </section>

      {/* 2. CLIENT — nom + téléphone inline (rappel, SMS J-1) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5">
            <User className="size-3.5" /> Client (optionnel)
          </span>
          {clients.length > 0 && (
            <button
              type="button"
              onClick={() => setClientMode((m) => (m === 'inline' ? 'existing' : 'inline'))}
              className="text-[11px] text-ink-mute hover:text-ink underline-offset-4 hover:underline transition-colors"
            >
              {clientMode === 'inline'
                ? `↻ Lier à un client existant (${clients.length})`
                : '↻ Saisir nouveau contact'}
            </button>
          )}
        </div>

        {clientMode === 'inline' ? (
          <div className="space-y-3">
            {/* Pillules de type client */}
            <div className="flex flex-wrap gap-2">
              {CLIENT_TYPE_PILLS.map((p) => {
                const isActive = clientPill === p.value
                const Icon = p.icon
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setClientPill(p.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors border',
                      isActive
                        ? 'bg-navy text-paper border-navy'
                        : 'bg-paper text-ink border-rule hover:border-navy/40 hover:bg-cream-deep/40',
                    )}
                  >
                    <Icon className="size-3.5" /> {p.label}
                  </button>
                )
              })}
            </div>
            <input type="hidden" name="clientType" value={activeClientPill.dbType} />

            {clientIsBusiness ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label={
                      clientPill === 'sci'
                        ? 'Raison sociale SCI'
                        : clientPill === 'syndic'
                          ? 'Nom du syndic / cabinet'
                          : "Nom de l'agence"
                    }
                    htmlFor="clientCompanyName"
                    hint="Pour facturation"
                  >
                    <Input
                      id="clientCompanyName"
                      name="clientCompanyName"
                      placeholder={
                        clientPill === 'sci'
                          ? 'SCI Martin Immobilier'
                          : clientPill === 'syndic'
                            ? 'Cabinet Foncia'
                            : 'Century 21 Paris 8e'
                      }
                      autoComplete="organization"
                    />
                  </FormField>
                  <FormField
                    label="Contact (optionnel)"
                    htmlFor="clientName"
                    hint="Gestionnaire / interlocuteur"
                  >
                    <Input
                      id="clientName"
                      name="clientName"
                      placeholder="M. Durand (gestionnaire)"
                      autoComplete="name"
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Téléphone" htmlFor="clientPhone" hint="Pour SMS J-1">
                    <Input
                      id="clientPhone"
                      name="clientPhone"
                      type="tel"
                      inputMode="tel"
                      placeholder="01 23 45 67 89"
                      autoComplete="tel"
                    />
                  </FormField>
                  <FormField label="Email (optionnel)" htmlFor="clientEmail">
                    <Input
                      id="clientEmail"
                      name="clientEmail"
                      type="email"
                      inputMode="email"
                      placeholder="contact@cabinet.fr"
                      autoComplete="email"
                    />
                  </FormField>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Nom" htmlFor="clientName">
                  <Input
                    id="clientName"
                    name="clientName"
                    placeholder="M. Martin"
                    autoComplete="name"
                  />
                </FormField>
                <FormField label="Téléphone" htmlFor="clientPhone" hint="Pour SMS J-1">
                  <Input
                    id="clientPhone"
                    name="clientPhone"
                    type="tel"
                    inputMode="tel"
                    placeholder="06 12 34 56 78"
                    autoComplete="tel"
                  />
                </FormField>
                <FormField label="Email (optionnel)" htmlFor="clientEmail">
                  <Input
                    id="clientEmail"
                    name="clientEmail"
                    type="email"
                    inputMode="email"
                    placeholder="martin@example.fr"
                    autoComplete="email"
                  />
                </FormField>
              </div>
            )}
          </div>
        ) : (
          <FormField label="Client donneur d'ordre" htmlFor="clientId">
            <Select id="clientId" name="clientId" defaultValue={defaultClientId ?? ''}>
              <option value="">— Aucun client lié —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </section>

      {/* 3. PACK 1-CLIC */}
      <section className="space-y-2.5">
        <label
          htmlFor="quick-packs"
          className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute"
        >
          Pack rapide — 1 clic
        </label>
        <div id="quick-packs" className="flex flex-wrap gap-2">
          {QUICK_PACKS.map((p) => {
            const isActive =
              p.types.length === selected.size && p.types.every((t) => selected.has(t))
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPack(p.types)}
                className={cn(
                  'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors border',
                  isActive
                    ? 'bg-navy text-paper border-navy'
                    : 'bg-paper text-ink border-rule hover:border-navy/40 hover:bg-cream-deep/40',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 4. DIAGNOSTICS DÉTAILLÉS — replié par défaut visuellement */}
      <fieldset className="space-y-3">
        <legend className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
          Diagnostics à effectuer <span className="text-accent-red">*</span>
        </legend>
        {fieldErrors.types && (
          <p className="text-sm text-accent-red" role="alert">
            {fieldErrors.types}
          </p>
        )}

        {effectiveYear && requiredByYear.length > 2 && (
          <div className="rounded-md border border-accent-green/40 bg-accent-green/10 p-3 flex items-start gap-2 text-sm">
            <Info className="size-4 mt-0.5 text-accent-green shrink-0" />
            <span>
              Bâti {effectiveYear} — diagnostics obligatoires cochés automatiquement :{' '}
              <strong>
                {requiredByYear
                  .map((s) => DIAG_OPTIONS.find((d) => d.value === s)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </strong>
              .
            </span>
          </div>
        )}

        {(['dpe', 'amiante', 'autres'] as const).map((group) => (
          <div key={group} className="space-y-1.5">
            <h3 className="text-[11px] uppercase tracking-wider text-ink-mute font-semibold">
              {GROUP_LABELS[group]}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DIAG_OPTIONS.filter((d) => d.group === group).map((d) => {
                const isChecked = selected.has(d.value)
                const isRequired = requiredByYear.includes(d.value)
                return (
                  <label
                    key={d.value}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors',
                      isChecked ? 'border-navy/40 bg-navy/5' : 'border-rule hover:bg-ink/5',
                      isRequired && !isChecked && 'border-accent-red/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      name="types"
                      value={d.value}
                      checked={isChecked}
                      onChange={() => toggleDiag(d.value)}
                      className="mt-0.5 accent-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{d.label}</span>
                        {isRequired && (
                          <Badge variant="green" className="text-[10px]">
                            Obligatoire
                          </Badge>
                        )}
                      </div>
                      {d.hint && <p className="text-xs text-ink-mute">{d.hint}</p>}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <p className="text-xs text-ink-mute">
          {selected.size} diagnostic{selected.size > 1 ? 's' : ''} sélectionné
          {selected.size > 1 ? 's' : ''}.
        </p>
      </fieldset>

      {/* 5. INTELLIGENCE RDV — estimation durée + sélection créneau + conflits */}

      {/* 5a. Quota DPE — banner si DPE sélectionné */}
      {dpeQuota && <DpeQuotaWarning warning={dpeQuota} sticky />}

      {/* 5b. Caractéristiques bien pour estimer la durée */}
      <section className="space-y-2.5">
        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
          Caractéristiques pour estimation durée
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Type de bien (granular)" htmlFor="schedulingPropertyType">
            <Select
              id="schedulingPropertyType"
              value={schedulingPropertyType}
              onChange={(e) => setSchedulingPropertyType(e.target.value as SchedulingPropertyType)}
            >
              {SCHEDULING_PROPERTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Régime de propriété" htmlFor="ownership">
            <Select
              id="ownership"
              value={ownership}
              onChange={(e) => setOwnership(e.target.value as SchedulingOwnership)}
            >
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px] text-ink">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasGarage}
              onChange={(e) => setHasGarage(e.target.checked)}
              className="accent-foreground"
            />
            Garage
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasSousSol}
              onChange={(e) => setHasSousSol(e.target.checked)}
              className="accent-foreground"
            />
            Sous-sol
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasComblesAmenagees}
              onChange={(e) => setHasComblesAmenagees(e.target.checked)}
              className="accent-foreground"
            />
            Combles aménagées
          </label>
        </div>
      </section>

      {/* 5c. Carte estimation durée signature */}
      <DurationEstimator
        estimate={estimate}
        loading={estimateLoading}
        forcedMinutes={forcedDurationMin}
        onForcedChange={setForcedDurationMin}
      />

      {/* 5d. Sélection date + créneau */}
      <section className="space-y-2.5">
        <label
          htmlFor="scheduledDate"
          className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5"
        >
          <Phone className="size-3.5" /> Date du RDV
        </label>
        <Input
          id="scheduledDate"
          type="date"
          value={scheduledDate}
          onChange={(e) => {
            setScheduledDate(e.target.value)
            setScheduledTime(null)
            setForcedOriginal(false)
          }}
        />
      </section>

      {scheduledDate && effectiveDurationMin > 0 && (
        <SlotSelector
          date={scheduledDate}
          durationMin={effectiveDurationMin}
          selectedTime={scheduledTime}
          onSelect={(t) => {
            setScheduledTime(t)
            setForcedOriginal(false)
          }}
        />
      )}

      {/* 5e. Conflit + alternatives, ou clustering opportunity si pas de conflit */}
      {conflictResult?.hasConflict && (
        <ConflictWarning result={conflictResult} onForceOriginal={handleForceOriginal} />
      )}

      {conflictResult?.hasConflict && (
        <AlternativeSuggestions
          alternatives={alternatives}
          loading={alternativesLoading}
          onAcceptAlternative={handleAcceptAlternative}
        />
      )}

      {!conflictResult?.hasConflict && clusterOpportunity && (
        <ClusteringOpportunityCard opportunity={clusterOpportunity} />
      )}

      {/* Hidden field : ISO UTC envoyée au server action (pour ne pas casser le flow) */}
      {scheduledDate && scheduledTime ? (
        <input
          type="hidden"
          name="scheduledAt"
          value={makeIsoFromYmdHm(scheduledDate, scheduledTime) ?? ''}
        />
      ) : (
        <input type="hidden" name="scheduledAt" value="" />
      )}

      <FormField label="Notes internes (étage, code, instructions)" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Code immeuble 1234B · Sonner Martin · Stationnement parking visiteurs"
        />
      </FormField>

      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 sticky bottom-4 z-10 bg-sage/95 backdrop-blur-sm rounded-xl border border-rule px-4 py-3 shadow-glass">
        <p className="text-xs text-ink-mute">
          {selected.size} diag · {mode === 'quick' ? 'nouveau bien' : 'bien existant'}
          {clientMode === 'inline' ? ' · contact inline' : ''}
        </p>
        <Button type="submit" disabled={pending || selected.size === 0} variant="accent" size="lg">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Créer le RDV
        </Button>
      </div>
    </form>
  )
}
