'use client'

import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/useDebounce'
import type { QuotaWarning } from '@/lib/admin/dpe-quota-tracker'
import type { Alternative } from '@/lib/scheduling/alternative-generator'
import type { ClusteringOpportunity } from '@/lib/scheduling/clustering-suggester'
import type { ConflictResult } from '@/lib/scheduling/conflict-detector'
import type { DurationEstimate } from '@/lib/scheduling/duration-estimator'
import type {
  SchedulingOwnership,
  SchedulingPropertyType,
} from '@/lib/scheduling/duration-schemas'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { type DossierFormState, createQuickDossierAction } from '../actions'
import { Step1PropertyClient } from './step-1-property-client'
import { Step2DiagnosticsRdv } from './step-2-diagnostics-rdv'
import { Step3Confirm } from './step-3-confirm'
import { WizardProgress } from './wizard-progress'

// ============================================================
// Types partagés des 3 étapes
// ============================================================

export type PropertyTypePill = 'maison' | 'appartement' | 'immeuble' | 'autre'

export type ClientPillValue = 'particulier' | 'sci' | 'syndic' | 'agence'

export interface PropertyOption {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  year_built: number | null
}

export interface ClientOption {
  id: string
  display_name: string
}

export interface DossierWizardProps {
  properties: PropertyOption[]
  clients: ClientOption[]
  defaultPropertyId?: string
  defaultClientId?: string
}

/**
 * Données collectées par le wizard à travers les 3 étapes.
 *
 * Tout est dans un seul objet pour pouvoir le passer au sub-component
 * récap (étape 3) et le sérialiser dans FormData au submit.
 *
 * Step 1 → property + client
 * Step 2 → diagnostics + RDV
 * Step 3 → notes + scheduling helpers (estimate, etc.)
 */
export interface DossierFormData {
  // ── Step 1 : Bien
  mode: 'quick' | 'existing'
  propertyId: string
  address: {
    label: string
    street?: string
    postalCode?: string
    city?: string
    insee?: string
    longitude?: number
    latitude?: number
  } | null
  propertyType: PropertyTypePill | ''
  yearBuilt: string
  surface: string
  aptDetailsOpen: boolean
  buildingLetter: string
  floorNumber: string
  lotNumber: string
  apartmentDetail: string

  // ── Step 1 : Client
  clientMode: 'inline' | 'existing'
  clientId: string
  clientPill: ClientPillValue
  clientName: string
  clientCompanyName: string
  clientPhone: string
  clientEmail: string

  // ── Step 2 : Diagnostics
  selected: Set<string>

  // ── Step 2 : Scheduling
  schedulingPropertyType: SchedulingPropertyType
  ownership: SchedulingOwnership
  hasGarage: boolean
  hasSousSol: boolean
  hasComblesAmenagees: boolean

  // ── Step 2 : RDV slot
  scheduledDate: string
  scheduledTime: string | null
  forcedDurationMin: number | null
  forcedOriginal: boolean

  // ── Step 3 : Notes
  notes: string
}

// ============================================================
// Constantes et helpers partagés
// ============================================================

// Mapping UI diag -> DiagnosticType backend (estimateur attend les 8 codes canoniques)
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

export function makeIsoFromYmdHm(ymd: string, hm: string): string | null {
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

export function toParisYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function toParisHm(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

// ============================================================
// Wizard component — state machine 3 étapes
// ============================================================

export function DossierWizard({
  properties,
  clients,
  defaultPropertyId,
  defaultClientId,
}: DossierWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [state, formAction, pending] = useActionState<DossierFormState, FormData>(
    createQuickDossierAction,
    undefined,
  )

  const [data, setData] = useState<DossierFormData>(() => ({
    mode: defaultPropertyId ? 'existing' : 'quick',
    propertyId: defaultPropertyId ?? '',
    address: null,
    propertyType: '',
    yearBuilt: '',
    surface: '',
    aptDetailsOpen: false,
    buildingLetter: '',
    floorNumber: '',
    lotNumber: '',
    apartmentDetail: '',
    clientMode: defaultClientId ? 'existing' : 'inline',
    clientId: defaultClientId ?? '',
    clientPill: 'particulier',
    clientName: '',
    clientCompanyName: '',
    clientPhone: '',
    clientEmail: '',
    selected: new Set<string>(['dpe_vente']),
    schedulingPropertyType: 'appartement',
    ownership: 'individuel',
    hasGarage: false,
    hasSousSol: false,
    hasComblesAmenagees: false,
    scheduledDate: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return toParisYmd(d)
    })(),
    scheduledTime: null,
    forcedDurationMin: null,
    forcedOriginal: false,
    notes: '',
  }))

  function patch(p: Partial<DossierFormData>) {
    setData((prev) => ({ ...prev, ...p }))
  }

  // ============================================================
  // Intelligence RDV — calculs partagés (cross-step)
  // Doit vivre ici pour persister entre Step 2 et Step 3.
  // ============================================================

  const selectedProperty = properties.find((p) => p.id === data.propertyId)
  const effectiveYear =
    data.mode === 'existing'
      ? (selectedProperty?.year_built ?? null)
      : data.yearBuilt
        ? Number(data.yearBuilt)
        : null

  // Auto-cochage diagnostics obligatoires selon année
  const requiredByYear: string[] = ['dpe_vente', 'erp']
  if (effectiveYear) {
    if (effectiveYear < 1997) requiredByYear.push('amiante_vente')
    if (effectiveYear < 1949) requiredByYear.push('plomb_crep')
  }

  const lastYearRef = useRef<number | null>(null)
  useEffect(() => {
    if (lastYearRef.current === effectiveYear) return
    lastYearRef.current = effectiveYear
    setData((prev) => {
      const next = new Set(prev.selected)
      for (const t of requiredByYear) next.add(t)
      return { ...prev, selected: next }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYear])

  // Diagnostics backend dédupliqués
  const backendDiagnostics = useMemo(() => {
    const set = new Set<string>()
    for (const v of data.selected) {
      const mapped = DIAG_VALUE_TO_TYPE[v]
      if (mapped) set.add(mapped)
    }
    return Array.from(set)
  }, [data.selected])

  const hasDpeSelected = useMemo(() => {
    for (const v of data.selected) if (DPE_VALUES.has(v)) return true
    return false
  }, [data.selected])

  // États API
  const [estimate, setEstimate] = useState<DurationEstimate | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null)
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [alternativesLoading, setAlternativesLoading] = useState(false)
  const [clusterOpportunity, setClusterOpportunity] = useState<ClusteringOpportunity | null>(null)
  const [dpeQuota, setDpeQuota] = useState<QuotaWarning | null>(null)

  const coords = useMemo(() => {
    if (
      data.address &&
      typeof data.address.latitude === 'number' &&
      typeof data.address.longitude === 'number'
    ) {
      return { lat: data.address.latitude, lng: data.address.longitude }
    }
    return null
  }, [data.address])

  const effectiveDurationMin = useMemo(() => {
    if (data.forcedDurationMin !== null) return data.forcedDurationMin
    if (estimate?.totalRounded) return estimate.totalRounded
    return 0
  }, [data.forcedDurationMin, estimate])

  // Debounce inputs pour estimate-duration
  const debouncedDiagnostics = useDebounce(backendDiagnostics, 500)
  const debouncedSurface = useDebounce(data.surface, 500)
  const debouncedPropertyType = useDebounce(data.schedulingPropertyType, 500)
  const debouncedOwnership = useDebounce(data.ownership, 500)
  const debouncedGarage = useDebounce(data.hasGarage, 500)
  const debouncedSousSol = useDebounce(data.hasSousSol, 500)
  const debouncedCombles = useDebounce(data.hasComblesAmenagees, 500)

  // 1. estimate-duration
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
      .then((res: DurationEstimate | { error?: string }) => {
        if ('totalRounded' in res) setEstimate(res)
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

  // 2. quota DPE
  useEffect(() => {
    if (!hasDpeSelected) {
      setDpeQuota(null)
      return
    }
    const controller = new AbortController()
    fetch('/api/scheduling/my-dpe-quota', { signal: controller.signal })
      .then((r) => r.json())
      .then((res: QuotaWarning | { status: 'ok' } | { error?: string }) => {
        if ('severity' in res) setDpeQuota(res)
        else setDpeQuota(null)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setDpeQuota(null)
      })
    return () => controller.abort()
  }, [hasDpeSelected])

  // 3. conflit + alternatives + clustering
  useEffect(() => {
    if (
      !data.scheduledDate ||
      !data.scheduledTime ||
      !coords ||
      effectiveDurationMin <= 0 ||
      data.forcedOriginal
    ) {
      setConflictResult(null)
      setAlternatives([])
      setClusterOpportunity(null)
      return
    }
    const startAtIso = makeIsoFromYmdHm(data.scheduledDate, data.scheduledTime)
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
  }, [
    data.scheduledDate,
    data.scheduledTime,
    coords,
    effectiveDurationMin,
    data.forcedOriginal,
  ])

  function handleAcceptAlternative(alt: Alternative): void {
    const d = alt.startAt instanceof Date ? alt.startAt : new Date(alt.startAt)
    patch({
      scheduledDate: toParisYmd(d),
      scheduledTime: toParisHm(d),
      forcedOriginal: false,
    })
  }

  function handleForceOriginal(): void {
    patch({ forcedOriginal: true })
    setConflictResult(null)
    setAlternatives([])
  }

  // ============================================================
  // Validation par étape
  // ============================================================

  const step1Valid = useMemo(() => {
    if (data.mode === 'existing') return data.propertyId.length > 0
    // mode quick : adresse non vide + propertyType + surface valide
    if (!data.address || !data.address.label) return false
    if (!data.propertyType) return false
    const s = Number.parseFloat(data.surface)
    if (!Number.isFinite(s) || s <= 0) return false
    return true
  }, [data.mode, data.propertyId, data.address, data.propertyType, data.surface])

  const step2Valid = useMemo(() => {
    if (data.selected.size === 0) return false
    if (!data.scheduledDate || !data.scheduledTime) return false
    if (effectiveDurationMin <= 0) return false
    return true
  }, [data.selected, data.scheduledDate, data.scheduledTime, effectiveDurationMin])

  function goNext() {
    if (step === 1 && !step1Valid) return
    if (step === 2 && !step2Valid) return
    setStep((s) => (s === 3 ? s : ((s + 1) as 1 | 2 | 3)))
  }

  function goPrev() {
    setStep((s) => (s === 1 ? s : ((s - 1) as 1 | 2 | 3)))
  }

  // ============================================================
  // Submit handler — construit le FormData attendu par l'action existante
  // (createQuickDossierAction). Préserve 100% de la logique métier serveur.
  // ============================================================

  async function handleSubmit() {
    const fd = new FormData()

    if (data.mode === 'existing') {
      fd.set('propertyId', data.propertyId)
    } else if (data.address) {
      fd.set('address', data.address.label)
      fd.set('address_postcode', data.address.postalCode ?? '')
      fd.set('address_city', data.address.city ?? '')
      fd.set('address_insee', data.address.insee ?? '')
      if (typeof data.address.longitude === 'number') {
        fd.set('address_lng', String(data.address.longitude))
      }
      if (typeof data.address.latitude === 'number') {
        fd.set('address_lat', String(data.address.latitude))
      }
      if (data.yearBuilt) fd.set('yearBuilt', data.yearBuilt)
      if (data.propertyType) fd.set('propertyType', data.propertyType)
      if (data.apartmentDetail) fd.set('apartmentDetail', data.apartmentDetail)
      if (data.buildingLetter) fd.set('buildingLetter', data.buildingLetter)
      if (data.floorNumber) fd.set('floorNumber', data.floorNumber)
      if (data.lotNumber) fd.set('lotNumber', data.lotNumber)
      if (data.surface) fd.set('surfaceTotal', data.surface)
    }

    if (data.clientMode === 'existing' && data.clientId) {
      fd.set('clientId', data.clientId)
    } else if (data.clientMode === 'inline') {
      const pillToDb: Record<ClientPillValue, string> = {
        particulier: 'particulier',
        sci: 'entreprise',
        syndic: 'syndic',
        agence: 'agence',
      }
      fd.set('clientType', pillToDb[data.clientPill])
      if (data.clientName) fd.set('clientName', data.clientName)
      if (data.clientCompanyName) fd.set('clientCompanyName', data.clientCompanyName)
      if (data.clientPhone) fd.set('clientPhone', data.clientPhone)
      if (data.clientEmail) fd.set('clientEmail', data.clientEmail)
    }

    for (const t of data.selected) {
      fd.append('types', t)
    }

    if (data.scheduledDate && data.scheduledTime) {
      const iso = makeIsoFromYmdHm(data.scheduledDate, data.scheduledTime)
      if (iso) fd.set('scheduledAt', iso)
    }

    if (data.notes) fd.set('notes', data.notes)

    formAction(fd)
  }

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <div className="space-y-4">
      <WizardProgress current={step} />

      {/* Container animé : transitions douces entre étapes */}
      <div key={step} className="animate-in fade-in-0 slide-in-from-right-2 duration-300">
        {step === 1 && (
          <Step1PropertyClient
            data={data}
            patch={patch}
            properties={properties}
            clients={clients}
            fieldErrors={fieldErrors}
          />
        )}

        {step === 2 && (
          <Step2DiagnosticsRdv
            data={data}
            patch={patch}
            effectiveYear={effectiveYear}
            requiredByYear={requiredByYear}
            estimate={estimate}
            estimateLoading={estimateLoading}
            effectiveDurationMin={effectiveDurationMin}
            dpeQuota={dpeQuota}
            conflictResult={conflictResult}
            alternatives={alternatives}
            alternativesLoading={alternativesLoading}
            clusterOpportunity={clusterOpportunity}
            onAcceptAlternative={handleAcceptAlternative}
            onForceOriginal={handleForceOriginal}
            fieldErrors={fieldErrors}
          />
        )}

        {step === 3 && (
          <Step3Confirm
            data={data}
            patch={patch}
            properties={properties}
            clients={clients}
            effectiveDurationMin={effectiveDurationMin}
          />
        )}
      </div>

      {/* Erreur serveur (visible toutes étapes après submit) */}
      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      {/* Footer navigation sticky */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 pt-2 sticky bottom-4 z-10',
          'bg-sage/95 backdrop-blur-sm rounded-xl border border-rule px-4 py-3 shadow-glass',
        )}
      >
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button type="button" variant="ghost" size="sm" onClick={goPrev} disabled={pending}>
              <ArrowLeft className="size-4" /> Modifier
            </Button>
          )}
        </div>

        <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute hidden sm:block">
          Étape {step} / 3
        </p>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <Button
              type="button"
              variant="accent"
              size="lg"
              onClick={goNext}
              disabled={
                pending || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
              }
            >
              Continuer <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="accent"
              size="lg"
              onClick={handleSubmit}
              disabled={pending || data.selected.size === 0}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Créer le dossier
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
