'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'
import { CalendarCheck2, Home, MapPin, Timer, User } from 'lucide-react'
import type { ClientOption, DossierFormData, PropertyOption } from './dossier-wizard'

interface Step3Props {
  data: DossierFormData
  patch: (p: Partial<DossierFormData>) => void
  properties: PropertyOption[]
  clients: ClientOption[]
  effectiveDurationMin: number
}

const DIAG_LABELS: Record<string, string> = {
  dpe_vente: 'DPE vente',
  dpe_location: 'DPE location',
  copropriete: 'DPE copropriété',
  amiante_vente: 'Amiante vente',
  amiante_avant_travaux: 'Amiante avant travaux',
  plomb_crep: 'Plomb CREP',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez_boutin: 'Carrez / Boutin',
  erp: 'ERP',
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  autre: 'Autre',
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  sci: 'SCI',
  syndic: 'Syndic',
  agence: 'Agence',
}

function formatDateFr(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const [y, m, d] = ymd.split('-')
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${y}-${m}-${d}T12:00:00Z`))
}

function formatDuration(min: number): string {
  if (min <= 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Étape 3 — Récapitulatif + notes + bouton créer.
 *
 * Affiche un résumé visuel des choix des étapes 1 et 2 puis demande la
 * confirmation finale. Le client peut ajuster les notes ici. Le bouton
 * de submission est dans le footer du wizard (parent).
 */
export function Step3Confirm({
  data,
  patch,
  properties,
  clients,
  effectiveDurationMin,
}: Step3Props) {
  const selectedProperty = properties.find((p) => p.id === data.propertyId)
  const selectedClient = clients.find((c) => c.id === data.clientId)

  const addressLabel =
    data.mode === 'existing' && selectedProperty
      ? `${selectedProperty.address}${selectedProperty.city ? ` · ${selectedProperty.postal_code ?? ''} ${selectedProperty.city}`.trim() : ''}`
      : data.address?.label
  const yearLabel =
    data.mode === 'existing'
      ? selectedProperty?.year_built
      : data.yearBuilt
        ? Number(data.yearBuilt)
        : null

  const clientLabel =
    data.clientMode === 'existing' && selectedClient
      ? selectedClient.display_name
      : data.clientCompanyName || data.clientName || data.clientPhone || data.clientEmail || null

  const diagsArray = Array.from(data.selected)

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          Étape 3 / 3
        </p>
        <h2 className="text-2xl font-display font-bold text-ink mt-1">
          <span className="font-serif italic">Vérifiez</span> et créez le dossier
        </h2>
        <p className="text-sm text-ink-mute mt-1">
          Un coup d&apos;œil avant validation — rien n&apos;est encore enregistré.
        </p>
      </div>

      {/* Bien */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <div className="flex items-center gap-2">
          <Home className="size-4 text-ink-mute" />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Bien
          </span>
        </div>
        <div className="space-y-1.5">
          <p className="text-base text-ink font-medium flex items-start gap-2">
            <MapPin className="size-4 mt-0.5 text-ink-mute shrink-0" />
            <span>{addressLabel || '—'}</span>
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-ink-mute">
            {data.propertyType && (
              <Badge variant="outline">{PROPERTY_TYPE_LABELS[data.propertyType] ?? data.propertyType}</Badge>
            )}
            {data.surface && <span>{data.surface} m²</span>}
            {yearLabel && <span>· bâti {yearLabel}</span>}
            {data.floorNumber && <span>· étage {data.floorNumber}</span>}
            {data.apartmentDetail && <span>· {data.apartmentDetail}</span>}
          </div>
        </div>
      </Card>

      {/* Client */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="size-4 text-ink-mute" />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Client
          </span>
        </div>
        {clientLabel ? (
          <div className="space-y-1">
            <p className="text-base text-ink font-medium">{clientLabel}</p>
            <div className="flex flex-wrap gap-3 text-xs text-ink-mute">
              {data.clientMode === 'inline' && (
                <Badge variant="outline">
                  {CLIENT_TYPE_LABELS[data.clientPill] ?? data.clientPill}
                </Badge>
              )}
              {data.clientPhone && <span>{data.clientPhone}</span>}
              {data.clientEmail && <span>{data.clientEmail}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-mute italic">Aucun client lié — le RDV reste valide.</p>
        )}
      </Card>

      {/* Diagnostics */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Diagnostics ({diagsArray.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {diagsArray.length === 0 ? (
            <p className="text-sm text-accent-red">Aucun diagnostic sélectionné.</p>
          ) : (
            diagsArray.map((d) => (
              <span
                key={d}
                className="inline-flex items-center rounded-pill bg-chartreuse text-ink px-3 py-1.5 text-xs font-medium"
              >
                {DIAG_LABELS[d] ?? d}
              </span>
            ))
          )}
        </div>
      </Card>

      {/* RDV */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck2 className="size-4 text-ink-mute" />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Rendez-vous
          </span>
        </div>
        {data.scheduledDate && data.scheduledTime ? (
          <div className="space-y-1.5">
            <p className="text-base text-ink font-medium capitalize">
              {formatDateFr(data.scheduledDate)} · {data.scheduledTime}
            </p>
            <p className="text-xs text-ink-mute flex items-center gap-1.5">
              <Timer className="size-3.5" /> Durée estimée :{' '}
              <span className="font-mono">{formatDuration(effectiveDurationMin)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-accent-red">Date ou heure manquante.</p>
        )}
      </Card>

      {/* Notes */}
      <FormField
        label="Notes internes (étage, code, instructions)"
        htmlFor="notes"
        hint="Visible dans le dossier le jour de la visite"
      >
        <Textarea
          id="notes"
          rows={3}
          placeholder="Code immeuble 1234B · Sonner Martin · Stationnement parking visiteurs"
          value={data.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </FormField>
    </div>
  )
}
