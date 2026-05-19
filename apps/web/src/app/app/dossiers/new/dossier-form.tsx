'use client'

import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Briefcase, Building2, Home, Info, Loader2, MapPin, Phone, User } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
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

// Types client UI — mapping vers enum DB client_type (SCI → entreprise)
const CLIENT_TYPE_PILLS = [
  { value: 'particulier', label: 'Particulier', dbType: 'particulier', icon: User },
  { value: 'sci', label: 'SCI', dbType: 'entreprise', icon: Briefcase, isBusiness: true },
  { value: 'syndic', label: 'Syndic', dbType: 'syndic', icon: Building2, isBusiness: true },
  { value: 'agence', label: 'Agence', dbType: 'agence', icon: Home, isBusiness: true },
] as const

type ClientPillValue = (typeof CLIENT_TYPE_PILLS)[number]['value']

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

  // Présélection d'un créneau standard à +24h, 9h00 (pratique au tél)
  const tomorrowAt9 = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    // datetime-local format YYYY-MM-DDTHH:MM
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()

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
            />
            {fieldErrors.address && (
              <p className="text-sm text-accent-red" role="alert">
                {fieldErrors.address}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <FormField
                label="Année de construction"
                htmlFor="yearBuilt"
                hint="Permet de suggérer plomb / amiante"
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

      {/* 5. DATE RDV — présélectionnée à demain 9h00 (gain de temps tél) */}
      <section className="space-y-2.5">
        <label
          htmlFor="scheduledAt"
          className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5"
        >
          <Phone className="size-3.5" /> Créneau RDV (optionnel — laisse en brouillon sinon)
        </label>
        <Input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          defaultValue={tomorrowAt9}
        />
        <p className="text-[11px] text-ink-mute">
          Pré-rempli pour demain 9h — change selon ce que dit le prospect. Le créneau sera ajoutable
          au calendrier (.ics) une fois le dossier créé.
        </p>
      </section>

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
