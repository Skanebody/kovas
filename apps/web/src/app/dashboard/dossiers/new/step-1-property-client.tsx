'use client'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Home,
  MapPin,
  User,
} from 'lucide-react'
import { useEffect } from 'react'
import type {
  ClientOption,
  ClientPillValue,
  DossierFormData,
  PropertyOption,
  PropertyTypePill,
} from './dossier-wizard'

interface Step1Props {
  data: DossierFormData
  patch: (p: Partial<DossierFormData>) => void
  properties: PropertyOption[]
  clients: ClientOption[]
  fieldErrors: Record<string, string>
}

const PROPERTY_TYPE_PILLS: {
  value: PropertyTypePill
  label: string
  icon: typeof Home
  needsApt: boolean
}[] = [
  { value: 'maison', label: 'Maison', icon: Home, needsApt: false },
  { value: 'appartement', label: 'Appartement', icon: Building2, needsApt: true },
  { value: 'immeuble', label: 'Immeuble', icon: Building2, needsApt: true },
  { value: 'autre', label: 'Autre', icon: Briefcase, needsApt: false },
]

const CLIENT_TYPE_PILLS: {
  value: ClientPillValue
  label: string
  icon: typeof User
  isBusiness: boolean
}[] = [
  { value: 'particulier', label: 'Particulier', icon: User, isBusiness: false },
  { value: 'sci', label: 'SCI', icon: Briefcase, isBusiness: true },
  { value: 'syndic', label: 'Syndic', icon: Building2, isBusiness: true },
  { value: 'agence', label: 'Agence', icon: Home, isBusiness: true },
]

/**
 * Étape 1 — Bien & Client.
 *
 * Champs : adresse BAN OU bien existant + type bien + surface + année +
 * client inline OU client existant. Validation propagée au wizard via `data`.
 */
export function Step1PropertyClient({
  data,
  patch,
  properties,
  clients,
  fieldErrors,
}: Step1Props) {
  const activeClientPill =
    CLIENT_TYPE_PILLS.find((p) => p.value === data.clientPill) ?? CLIENT_TYPE_PILLS[0]
  const clientIsBusiness = activeClientPill.isBusiness
  const needsAptDetails =
    PROPERTY_TYPE_PILLS.find((p) => p.value === data.propertyType)?.needsApt ?? false

  // Auto-déplie compléments adresse si appart/immeuble
  useEffect(() => {
    if (needsAptDetails && !data.aptDetailsOpen) {
      patch({ aptDetailsOpen: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAptDetails])

  function handleAddressSelected(addr: AddressValue): void {
    patch({ address: { ...addr } })
  }

  return (
    <div className="space-y-6">
      {/* 1. ADRESSE */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5">
            <MapPin className="size-3.5" /> Adresse du bien <span className="text-accent-red">*</span>
          </span>
          {properties.length > 0 && (
            <button
              type="button"
              onClick={() => patch({ mode: data.mode === 'quick' ? 'existing' : 'quick' })}
              className="text-[11px] text-ink-mute hover:text-ink underline-offset-4 hover:underline transition-colors"
            >
              {data.mode === 'quick'
                ? `↻ Choisir un bien existant (${properties.length})`
                : '↻ Saisir une nouvelle adresse'}
            </button>
          )}
        </div>

        {data.mode === 'quick' ? (
          <>
            <AddressAutocomplete
              name="address"
              placeholder="12 rue de Rivoli, 75001 Paris"
              defaultValue={data.address?.label ?? ''}
              onSelect={handleAddressSelected}
            />
            {fieldErrors.address && (
              <p className="text-sm text-accent-red" role="alert">
                {fieldErrors.address}
              </p>
            )}

            {/* Type de bien — pillules */}
            <div className="flex flex-wrap gap-2 mt-2">
              {PROPERTY_TYPE_PILLS.map((p) => {
                const isActive = data.propertyType === p.value
                const Icon = p.icon
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => patch({ propertyType: isActive ? '' : p.value })}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors border',
                      isActive
                        ? 'bg-[#0F1419] text-paper border-[#0F1419]'
                        : 'bg-paper text-ink border-rule hover:border-[#0F1419]/40 hover:bg-sage-alt/40',
                    )}
                  >
                    <Icon className="size-3.5" /> {p.label}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <FormField
                label="Année de construction"
                htmlFor="yearBuilt"
                hint="Pré-coche plomb / amiante"
              >
                <Input
                  id="yearBuilt"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  max={2100}
                  placeholder="1975"
                  value={data.yearBuilt}
                  onChange={(e) => patch({ yearBuilt: e.target.value })}
                />
              </FormField>
              <FormField
                label="Surface (m²)"
                htmlFor="surfaceTotal"
                hint="Pour estimation durée"
              >
                <Input
                  id="surfaceTotal"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100000}
                  step={0.01}
                  placeholder="72"
                  value={data.surface}
                  onChange={(e) => patch({ surface: e.target.value })}
                />
              </FormField>
            </div>

            {/* Compléments adresse — collapsible */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => patch({ aptDetailsOpen: !data.aptDetailsOpen })}
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-mute hover:text-ink underline-offset-4 hover:underline transition-colors"
              >
                {data.aptDetailsOpen ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                {data.aptDetailsOpen ? 'Masquer' : 'Préciser'} étage · bâtiment · n° appartement
              </button>
              {data.aptDetailsOpen && (
                <div className="rounded-lg border border-rule bg-paper/40 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="Bâtiment / entrée" htmlFor="buildingLetter">
                      <Input
                        id="buildingLetter"
                        maxLength={10}
                        placeholder="Bât. A"
                        value={data.buildingLetter}
                        onChange={(e) => patch({ buildingLetter: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Étage" htmlFor="floorNumber" hint="0 = RDC, -1 = sous-sol">
                      <Input
                        id="floorNumber"
                        type="number"
                        inputMode="numeric"
                        min={-5}
                        max={60}
                        placeholder="3"
                        value={data.floorNumber}
                        onChange={(e) => patch({ floorNumber: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Lot (optionnel)" htmlFor="lotNumber">
                      <Input
                        id="lotNumber"
                        maxLength={20}
                        placeholder="Lot 24"
                        value={data.lotNumber}
                        onChange={(e) => patch({ lotNumber: e.target.value })}
                      />
                    </FormField>
                  </div>
                  <FormField
                    label="N° appartement / porte"
                    htmlFor="apartmentDetail"
                    hint="« Apt 12B », « porte gauche », « local 204 »"
                  >
                    <Input
                      id="apartmentDetail"
                      maxLength={120}
                      placeholder="Apt 12B"
                      value={data.apartmentDetail}
                      onChange={(e) => patch({ apartmentDetail: e.target.value })}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </>
        ) : (
          <FormField label="Bien concerné" htmlFor="propertyId" error={fieldErrors.propertyId}>
            <Select
              id="propertyId"
              value={data.propertyId}
              onChange={(e) => patch({ propertyId: e.target.value })}
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

      {/* 2. CLIENT */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5">
            <User className="size-3.5" /> Client (optionnel)
          </span>
          {clients.length > 0 && (
            <button
              type="button"
              onClick={() =>
                patch({ clientMode: data.clientMode === 'inline' ? 'existing' : 'inline' })
              }
              className="text-[11px] text-ink-mute hover:text-ink underline-offset-4 hover:underline transition-colors"
            >
              {data.clientMode === 'inline'
                ? `↻ Lier à un client existant (${clients.length})`
                : '↻ Saisir nouveau contact'}
            </button>
          )}
        </div>

        {data.clientMode === 'inline' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CLIENT_TYPE_PILLS.map((p) => {
                const isActive = data.clientPill === p.value
                const Icon = p.icon
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => patch({ clientPill: p.value })}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors border',
                      isActive
                        ? 'bg-[#0F1419] text-paper border-[#0F1419]'
                        : 'bg-paper text-ink border-rule hover:border-[#0F1419]/40 hover:bg-sage-alt/40',
                    )}
                  >
                    <Icon className="size-3.5" /> {p.label}
                  </button>
                )
              })}
            </div>

            {clientIsBusiness ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label={
                      data.clientPill === 'sci'
                        ? 'Raison sociale SCI'
                        : data.clientPill === 'syndic'
                          ? 'Nom du syndic / cabinet'
                          : "Nom de l'agence"
                    }
                    htmlFor="clientCompanyName"
                    hint="Pour facturation"
                  >
                    <Input
                      id="clientCompanyName"
                      placeholder={
                        data.clientPill === 'sci'
                          ? 'SCI Martin Immobilier'
                          : data.clientPill === 'syndic'
                            ? 'Cabinet Foncia'
                            : 'Century 21 Paris 8e'
                      }
                      autoComplete="organization"
                      value={data.clientCompanyName}
                      onChange={(e) => patch({ clientCompanyName: e.target.value })}
                    />
                  </FormField>
                  <FormField
                    label="Contact (optionnel)"
                    htmlFor="clientName"
                    hint="Gestionnaire / interlocuteur"
                  >
                    <Input
                      id="clientName"
                      placeholder="M. Durand"
                      autoComplete="name"
                      value={data.clientName}
                      onChange={(e) => patch({ clientName: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Téléphone" htmlFor="clientPhone" hint="Pour SMS J-1">
                    <Input
                      id="clientPhone"
                      type="tel"
                      inputMode="tel"
                      placeholder="01 23 45 67 89"
                      autoComplete="tel"
                      value={data.clientPhone}
                      onChange={(e) => patch({ clientPhone: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Email (optionnel)" htmlFor="clientEmail">
                    <Input
                      id="clientEmail"
                      type="email"
                      inputMode="email"
                      placeholder="contact@cabinet.fr"
                      autoComplete="email"
                      value={data.clientEmail}
                      onChange={(e) => patch({ clientEmail: e.target.value })}
                    />
                  </FormField>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Nom" htmlFor="clientName">
                  <Input
                    id="clientName"
                    placeholder="M. Martin"
                    autoComplete="name"
                    value={data.clientName}
                    onChange={(e) => patch({ clientName: e.target.value })}
                  />
                </FormField>
                <FormField label="Téléphone" htmlFor="clientPhone" hint="Pour SMS J-1">
                  <Input
                    id="clientPhone"
                    type="tel"
                    inputMode="tel"
                    placeholder="06 12 34 56 78"
                    autoComplete="tel"
                    value={data.clientPhone}
                    onChange={(e) => patch({ clientPhone: e.target.value })}
                  />
                </FormField>
                <FormField label="Email (optionnel)" htmlFor="clientEmail">
                  <Input
                    id="clientEmail"
                    type="email"
                    inputMode="email"
                    placeholder="martin@example.fr"
                    autoComplete="email"
                    value={data.clientEmail}
                    onChange={(e) => patch({ clientEmail: e.target.value })}
                  />
                </FormField>
              </div>
            )}
          </div>
        ) : (
          <FormField label="Client donneur d'ordre" htmlFor="clientId">
            <Select
              id="clientId"
              value={data.clientId}
              onChange={(e) => patch({ clientId: e.target.value })}
            >
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
    </div>
  )
}
