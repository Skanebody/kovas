'use client'

/**
 * KOVAS — Wizard `Nouveau devis` (Qonto-style single-page).
 *
 * Layout :
 *   - Sections empilées : Client / Bien / Prestations / Frais / Majorations / Notes-Paiement
 *   - Sidebar sticky droite (desktop ≥ lg) avec totaux + aperçu PDF live
 *   - Bottom sheet (mobile) avec totaux + bouton "Voir aperçu"
 *
 * Submit :
 *   - Sauvegarder brouillon → redirect `/dashboard/devis/<id>`
 *   - Envoyer au client → enchaîne createDraft + sendQuote
 */

import { QuoteCatalogPicker } from '@/components/quotes/QuoteCatalogPicker'
import type { PricingPackOption } from '@/components/quotes/QuoteCatalogPicker'
import { QuoteLineItemRow } from '@/components/quotes/QuoteLineItemRow'
import { QuoteLivePreview } from '@/components/quotes/QuoteLivePreview'
import { QuoteLiveTotals } from '@/components/quotes/QuoteLiveTotals'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  DiagnosticPricing,
  MajorationsConfig,
  PropertyType,
  TravelFeesConfig,
} from '@/lib/pricing/pricing-templates'
import { calculateTravelFees } from '@/lib/pricing/travel-fees-calculator'
import { buildMajorationLine, buildTravelLine, haversineKm } from '@/lib/quotes/build-pricing-line'
import type {
  QuoteClientSnapshot,
  QuoteDiagnosticType,
  QuoteLineItem,
  QuoteOrganizationSnapshot,
  QuotePaymentMethod,
} from '@/lib/quotes/types'
import {
  QUOTE_PAYMENT_METHOD_LABELS,
  QUOTE_PAYMENT_TERMS_OPTIONS,
  computeQuoteTotals,
  formatEur,
} from '@/lib/quotes/types'
import { cn } from '@/lib/utils'
import { ArrowLeft, Eye, Loader2, Plus, Save, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  type CreateQuoteInput,
  createQuickClientAction,
  createQuoteDraftAction,
  sendQuoteAction,
  updateQuoteAction,
} from '../actions'

// ============================================
// Types props (server-fed)
// ============================================

export interface QuoteWizardClient {
  id: string
  display_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  siret: string | null
  address: string | null
  city: string | null
  postal_code: string | null
}

export interface QuoteWizardProperty {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  surface_total: number | null
  property_type: PropertyType | null
  client_id: string | null
  latitude: number | null
  longitude: number | null
}

export interface QuoteWizardPricingConfig {
  vatRate: number
  diagnostics: Partial<Record<QuoteDiagnosticType, DiagnosticPricing>>
  travelFees: TravelFeesConfig | null
  majorations: MajorationsConfig | null
  /** GPS organisation (pour calcul Haversine distance). Null si inconnu. */
  organizationLat: number | null
  organizationLng: number | null
}

/**
 * Données d'un devis brouillon existant pour pré-remplir le wizard en mode édition.
 * Champs alignés sur l'état du wizard et sur ce que `updateQuoteAction` attend.
 */
export interface QuoteWizardInitial {
  clientId: string
  propertyId: string | null
  lines: QuoteLineItem[]
  notes: string | null
  paymentMethod: QuotePaymentMethod
  paymentTermsDays: number
  expiresInDays: number
}

export interface QuoteWizardProps {
  clients: QuoteWizardClient[]
  properties: QuoteWizardProperty[]
  packs: PricingPackOption[]
  pricingConfig: QuoteWizardPricingConfig
  organizationSnapshot: QuoteOrganizationSnapshot
  brandColorHex: string
  logoUrl: string | null
  defaultClientId?: string
  defaultPropertyId?: string
  /** Si fourni avec `editQuoteId` : pré-remplit toutes les étapes (mode édition). */
  initialQuote?: QuoteWizardInitial
  /** Id du brouillon en cours d'édition. Présent → mode édition (sinon création). */
  editQuoteId?: string
}

// ============================================
// State machine simplifiée (single page)
// ============================================

interface WizardState {
  clientId: string
  propertyId: string
  lines: QuoteLineItem[]
  notes: string
  paymentMethod: QuotePaymentMethod
  paymentTermsDays: number
  expiresInDays: number
  applyUrgency: boolean
  applyWeekend: boolean
  applyEvening: boolean
  manualTravelOverride: number | null
}

function hasMajorationLine(
  lines: QuoteLineItem[],
  kind: 'urgency' | 'weekend' | 'evening',
): boolean {
  return lines.some((l) => l.kind === 'majoration' && l.majorationKind === kind)
}

function makeInitial(props: QuoteWizardProps): WizardState {
  // Mode édition : pré-remplit toutes les étapes depuis le devis existant.
  if (props.initialQuote) {
    const init = props.initialQuote
    return {
      clientId: init.clientId,
      propertyId: init.propertyId ?? '',
      lines: init.lines,
      notes: init.notes ?? '',
      paymentMethod: init.paymentMethod,
      paymentTermsDays: init.paymentTermsDays,
      expiresInDays: init.expiresInDays,
      applyUrgency: hasMajorationLine(init.lines, 'urgency'),
      applyWeekend: hasMajorationLine(init.lines, 'weekend'),
      applyEvening: hasMajorationLine(init.lines, 'evening'),
      manualTravelOverride: null,
    }
  }
  return {
    clientId: props.defaultClientId ?? '',
    propertyId: props.defaultPropertyId ?? '',
    lines: [],
    notes: '',
    paymentMethod: 'virement',
    paymentTermsDays: 30,
    expiresInDays: 30,
    applyUrgency: false,
    applyWeekend: false,
    applyEvening: false,
    manualTravelOverride: null,
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ============================================
// Wizard
// ============================================

export function QuoteWizard(props: QuoteWizardProps) {
  const router = useRouter()
  const isEditMode = Boolean(props.editQuoteId)
  const [state, setState] = useState<WizardState>(() => makeInitial(props))
  const [pending, startTransition] = useTransition()
  const [intent, setIntent] = useState<'draft' | 'send' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [quickClientOpen, setQuickClientOpen] = useState(false)

  const selectedClient = props.clients.find((c) => c.id === state.clientId) ?? null
  const selectedProperty = props.properties.find((p) => p.id === state.propertyId) ?? null

  // Snapshot client live (pour aperçu)
  const clientSnapshot: QuoteClientSnapshot = useMemo(() => {
    if (!selectedClient) {
      return {
        displayName: 'Client à sélectionner',
        email: null,
        phone: null,
        companyName: null,
        siret: null,
        address: null,
        city: null,
        postalCode: null,
      }
    }
    return {
      displayName: selectedClient.display_name,
      email: selectedClient.email,
      phone: selectedClient.phone,
      companyName: selectedClient.company_name,
      siret: selectedClient.siret,
      address: selectedClient.address,
      city: selectedClient.city,
      postalCode: selectedClient.postal_code,
    }
  }, [selectedClient])

  // Distance Haversine si dispo (km arrondi)
  const distanceKm = useMemo(() => {
    if (
      props.pricingConfig.organizationLat === null ||
      props.pricingConfig.organizationLng === null
    ) {
      return null
    }
    if (
      !selectedProperty ||
      selectedProperty.latitude === null ||
      selectedProperty.longitude === null
    ) {
      return null
    }
    return Math.round(
      haversineKm(
        {
          lat: props.pricingConfig.organizationLat,
          lng: props.pricingConfig.organizationLng,
        },
        { lat: selectedProperty.latitude, lng: selectedProperty.longitude },
      ),
    )
  }, [props.pricingConfig.organizationLat, props.pricingConfig.organizationLng, selectedProperty])

  // Estimation frais déplacement
  const travelEstimate = useMemo(() => {
    if (!props.pricingConfig.travelFees || distanceKm === null) return null
    return calculateTravelFees(props.pricingConfig.travelFees, distanceKm)
  }, [props.pricingConfig.travelFees, distanceKm])

  function patchState(p: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...p }))
  }

  function addLine(line: QuoteLineItem) {
    setState((prev) => ({ ...prev, lines: [...prev.lines, line] }))
  }

  function updateLine(id: string, patch: Partial<QuoteLineItem>) {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }

  function removeLine(id: string) {
    setState((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }))
  }

  function autoAddTravelFromEstimate() {
    if (!travelEstimate) return
    if (travelEstimate.amountHt <= 0) {
      toast.info('Bien situé dans la zone incluse — pas de frais.')
      return
    }
    addLine(
      buildTravelLine({
        amountHt: travelEstimate.amountHt,
        description: travelEstimate.description,
        tvaRate: props.pricingConfig.vatRate,
      }),
    )
  }

  function toggleMajoration(kind: 'urgency' | 'weekend' | 'evening', enabled: boolean) {
    const cfg = props.pricingConfig.majorations
    if (!cfg) {
      toast.error('Configure tes majorations dans Compte → Tarifs avant de les utiliser.')
      return
    }
    if (enabled) {
      const amount =
        kind === 'urgency' ? cfg.urgency48h : kind === 'weekend' ? cfg.weekend : cfg.evening
      addLine(buildMajorationLine({ kind, amountHt: amount, tvaRate: props.pricingConfig.vatRate }))
    } else {
      setState((prev) => ({
        ...prev,
        lines: prev.lines.filter((l) => !(l.kind === 'majoration' && l.majorationKind === kind)),
      }))
    }
    if (kind === 'urgency') patchState({ applyUrgency: enabled })
    if (kind === 'weekend') patchState({ applyWeekend: enabled })
    if (kind === 'evening') patchState({ applyEvening: enabled })
  }

  function buildPayload(): CreateQuoteInput | null {
    if (!state.clientId) {
      toast.error('Veuillez sélectionner un client.')
      return null
    }
    if (state.lines.length === 0) {
      toast.error('Ajoutez au moins une prestation.')
      return null
    }
    return {
      clientId: state.clientId,
      propertyId: state.propertyId || null,
      missionId: null,
      lines: state.lines,
      notes: state.notes,
      paymentMethod: state.paymentMethod,
      paymentTermsDays: state.paymentTermsDays,
      expiresInDays: state.expiresInDays,
    }
  }

  function submitDraft() {
    const payload = buildPayload()
    if (!payload) return
    setIntent('draft')
    startTransition(async () => {
      const res = await createQuoteDraftAction(payload)
      if (!res.success || !res.quoteId) {
        toast.error(res.error ?? 'Création impossible.')
        setIntent(null)
        return
      }
      toast.success('Brouillon créé.')
      router.push(`/dashboard/devis/${res.quoteId}`)
    })
  }

  function submitSend() {
    const payload = buildPayload()
    if (!payload) return
    if (!selectedClient?.email) {
      toast.error('Le client doit avoir un email pour recevoir le devis.')
      return
    }
    setIntent('send')
    startTransition(async () => {
      const draft = await createQuoteDraftAction(payload)
      if (!draft.success || !draft.quoteId) {
        toast.error(draft.error ?? 'Création impossible.')
        setIntent(null)
        return
      }
      const sent = await sendQuoteAction(draft.quoteId)
      if (!sent.success) {
        toast.error(sent.error ?? 'Envoi impossible.')
        // On laisse le brouillon créé, l'user peut retenter depuis le détail
        router.push(`/dashboard/devis/${draft.quoteId}`)
        return
      }
      toast.success('Devis envoyé au client.')
      router.push(`/dashboard/devis/${draft.quoteId}`)
    })
  }

  function submitUpdate() {
    const payload = buildPayload()
    if (!payload || !props.editQuoteId) return
    const editId = props.editQuoteId
    setIntent('draft')
    startTransition(async () => {
      const res = await updateQuoteAction({ id: editId, ...payload })
      if (!res.success) {
        toast.error(res.error ?? 'Mise à jour impossible.')
        setIntent(null)
        return
      }
      toast.success('Modifications enregistrées.')
      router.push(`/dashboard/devis/${editId}`)
    })
  }

  // Filtre properties par client si client sélectionné
  const filteredProperties = useMemo(() => {
    if (!state.clientId) return props.properties
    return props.properties.filter((p) => p.client_id === null || p.client_id === state.clientId)
  }, [props.properties, state.clientId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Colonne gauche : sections */}
      <div className="space-y-6">
        <Section title="1. Client" eyebrow="DESTINATAIRE">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="quote-client">Client</Label>
              <Select
                id="quote-client"
                value={state.clientId}
                onChange={(e) => patchState({ clientId: e.target.value })}
              >
                <option value="">— Sélectionner un client —</option>
                {props.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => setQuickClientOpen(true)}
              className="mt-6 sm:mt-6"
            >
              <Plus className="size-4" /> Créer client
            </Button>
          </div>
          {selectedClient ? (
            <p className="text-[12px] text-ink-mute mt-2">
              {selectedClient.email ?? 'Aucun email'} · {selectedClient.phone ?? 'Aucun téléphone'}
              {selectedClient.siret ? ` · SIRET ${selectedClient.siret}` : ''}
            </p>
          ) : null}
        </Section>

        <Section title="2. Bien (optionnel)" eyebrow="LOCALISATION">
          <Label htmlFor="quote-property">Bien</Label>
          <Select
            id="quote-property"
            value={state.propertyId}
            onChange={(e) => patchState({ propertyId: e.target.value })}
          >
            <option value="">— Aucun bien —</option>
            {filteredProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
                {p.city ? `, ${p.city}` : ''}
              </option>
            ))}
          </Select>
          {selectedProperty && distanceKm !== null ? (
            <p className="text-[12px] text-ink-mute mt-2">
              Distance estimée : {distanceKm} km depuis l&apos;adresse cabinet.
            </p>
          ) : null}
        </Section>

        <Section title="3. Prestations" eyebrow="LIGNES DU DEVIS">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] text-ink-mute">
              {state.lines.length} ligne{state.lines.length > 1 ? 's' : ''}
            </p>
            <QuoteCatalogPicker
              diagnosticsPricing={props.pricingConfig.diagnostics}
              packs={props.packs}
              propertyType={selectedProperty?.property_type ?? null}
              surface={selectedProperty?.surface_total ?? null}
              tvaRate={props.pricingConfig.vatRate}
              onAdd={addLine}
            />
          </div>
          {state.lines.length === 0 ? (
            <p className="text-[13px] text-ink-faint italic text-center py-6">
              Aucune prestation — utilisez le bouton ci-dessus pour ajouter un diagnostic, un pack
              ou une ligne libre.
            </p>
          ) : (
            <ul className="space-y-2">
              {state.lines.map((line) => (
                <QuoteLineItemRow
                  key={line.id}
                  line={line}
                  onChange={(patch) => updateLine(line.id, patch)}
                  onRemove={() => removeLine(line.id)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="4. Frais de déplacement" eyebrow="LOGISTIQUE">
          {!props.pricingConfig.travelFees ? (
            <p className="text-[13px] text-ink-mute">
              Configure tes frais de déplacement dans{' '}
              <Link href="/dashboard/compte/tarifs" className="text-ink underline">
                Compte → Tarifs
              </Link>{' '}
              pour un calcul automatique.
            </p>
          ) : !selectedProperty ? (
            <p className="text-[13px] text-ink-mute">
              Sélectionne un bien (étape 2) pour calculer automatiquement les frais, ou ajoute une
              ligne libre.
            </p>
          ) : distanceKm === null ? (
            <p className="text-[13px] text-ink-mute">
              Coordonnées GPS du bien indisponibles — saisis manuellement via « Ligne libre » dans
              les prestations.
            </p>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[13px] text-ink-soft">{travelEstimate?.description ?? '—'}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoAddTravelFromEstimate}
                disabled={!travelEstimate || travelEstimate.amountHt <= 0}
              >
                <Plus className="size-3.5" /> Ajouter au devis
              </Button>
            </div>
          )}
        </Section>

        <Section title="5. Majorations (optionnel)" eyebrow="CONTEXTE INTERVENTION">
          {!props.pricingConfig.majorations ? (
            <p className="text-[13px] text-ink-mute">
              Configure tes majorations dans Compte → Tarifs.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <MajorationToggle
                label={`Urgence 48h (+${props.pricingConfig.majorations.urgency48h} €)`}
                checked={state.applyUrgency}
                onChange={(v) => toggleMajoration('urgency', v)}
              />
              <MajorationToggle
                label={`Weekend (+${props.pricingConfig.majorations.weekend} €)`}
                checked={state.applyWeekend}
                onChange={(v) => toggleMajoration('weekend', v)}
              />
              <MajorationToggle
                label={`Soirée (+${props.pricingConfig.majorations.evening} €)`}
                checked={state.applyEvening}
                onChange={(v) => toggleMajoration('evening', v)}
              />
            </div>
          )}
        </Section>

        <Section title="6. Conditions de paiement" eyebrow="PAIEMENT & NOTES">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Moyen de paiement</Label>
              <Select
                id="payment-method"
                value={state.paymentMethod}
                onChange={(e) =>
                  patchState({ paymentMethod: e.target.value as QuotePaymentMethod })
                }
              >
                {(Object.keys(QUOTE_PAYMENT_METHOD_LABELS) as QuotePaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {QUOTE_PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-terms">Délai de paiement</Label>
              <Select
                id="payment-terms"
                value={state.paymentTermsDays}
                onChange={(e) =>
                  patchState({ paymentTermsDays: Number.parseInt(e.target.value, 10) })
                }
              >
                {QUOTE_PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            <Label htmlFor="quote-notes">Notes (visibles sur le PDF)</Label>
            <Textarea
              id="quote-notes"
              rows={3}
              value={state.notes}
              onChange={(e) => patchState({ notes: e.target.value })}
              placeholder="Mentions complémentaires, conditions d'accès, observations…"
            />
          </div>
          <div className="space-y-1.5 mt-3 max-w-[200px]">
            <Label htmlFor="expires-in">Validité du devis</Label>
            <Select
              id="expires-in"
              value={state.expiresInDays}
              onChange={(e) => patchState({ expiresInDays: Number.parseInt(e.target.value, 10) })}
            >
              <option value={15}>15 jours</option>
              <option value={30}>30 jours</option>
              <option value={45}>45 jours</option>
              <option value={60}>60 jours</option>
              <option value={90}>90 jours</option>
            </Select>
          </div>
        </Section>

        {/* Footer actions desktop */}
        <div className="hidden lg:flex items-center justify-between gap-3 pt-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/devis">
              <ArrowLeft className="size-4" /> Annuler
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => setPreviewOpen(true)}
              type="button"
            >
              <Eye className="size-4" /> Aperçu plein écran
            </Button>
            {isEditMode ? (
              <Button
                variant="accent"
                size="default"
                onClick={submitUpdate}
                type="button"
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Enregistrer les modifications
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="default"
                  onClick={submitDraft}
                  type="button"
                  disabled={pending}
                >
                  {pending && intent === 'draft' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Sauvegarder brouillon
                </Button>
                <Button
                  variant="accent"
                  size="default"
                  onClick={submitSend}
                  type="button"
                  disabled={pending}
                >
                  {pending && intent === 'send' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Envoyer au client
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Colonne droite : aperçu sticky desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <QuoteLiveTotals
            lines={state.lines}
            reference="DEV-2026-Nouveau"
            issuedAt={todayIso()}
            expiresAt={addDays(todayIso(), state.expiresInDays)}
          />
          <Card variant="opaque" padding="sm">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
              Aperçu PDF
            </p>
            <div className="scale-[0.65] origin-top-left -mb-[36%] -mr-[35%]">
              <QuoteLivePreview
                reference="DEV-2026-Nouveau"
                issuedAt={todayIso()}
                expiresAt={addDays(todayIso(), state.expiresInDays)}
                organization={props.organizationSnapshot}
                client={clientSnapshot}
                lines={state.lines}
                notes={state.notes}
                paymentMethod={state.paymentMethod}
                paymentTermsDays={state.paymentTermsDays}
                brandColorHex={props.brandColorHex}
                logoUrl={props.logoUrl}
              />
            </div>
          </Card>
        </div>
      </aside>

      {/* Footer mobile (sticky bottom) */}
      <div
        className={cn(
          'lg:hidden fixed bottom-0 inset-x-0 z-40',
          'bg-paper border-t border-rule/60 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
          'shadow-glass-sm',
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
              Total TTC
            </p>
            <p className="font-serif italic text-[22px] text-ink leading-none">
              {formatEur(computeQuoteTotals(state.lines).totalTtc)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} type="button">
            <Eye className="size-4" /> Aperçu
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <Button
              variant="accent"
              size="sm"
              onClick={submitUpdate}
              type="button"
              disabled={pending}
              className="flex-1"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Enregistrer
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={submitDraft}
                type="button"
                disabled={pending}
                className="flex-1"
              >
                {pending && intent === 'draft' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Brouillon
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={submitSend}
                type="button"
                disabled={pending}
                className="flex-1"
              >
                {pending && intent === 'send' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Envoyer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Modal aperçu plein écran */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aperçu PDF</DialogTitle>
          </DialogHeader>
          <QuoteLivePreview
            reference="DEV-2026-Nouveau"
            issuedAt={todayIso()}
            expiresAt={addDays(todayIso(), state.expiresInDays)}
            organization={props.organizationSnapshot}
            client={clientSnapshot}
            lines={state.lines}
            notes={state.notes}
            paymentMethod={state.paymentMethod}
            paymentTermsDays={state.paymentTermsDays}
            brandColorHex={props.brandColorHex}
            logoUrl={props.logoUrl}
          />
        </DialogContent>
      </Dialog>

      {/* Modal création rapide client */}
      <QuickClientDialog
        open={quickClientOpen}
        onOpenChange={setQuickClientOpen}
        onCreated={(client) => {
          // Le SR component a la liste figée — pour V1 on stocke l'id et on attendra
          // un router.refresh, ou on update local. Ici on push dans la liste via patch state.
          patchState({ clientId: client.id })
          router.refresh()
        }}
      />
    </div>
  )
}

// ============================================
// Section helper
// ============================================

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <Card variant="opaque" padding="default">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-1">{eyebrow}</p>
      <h2 className="font-sans font-medium text-[18px] text-ink mb-4">{title}</h2>
      <div>{children}</div>
    </Card>
  )
}

// ============================================
// Toggle majoration (UI sobre)
// ============================================

function MajorationToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-pill border cursor-pointer transition-colors',
        checked
          ? 'border-navy bg-navy/[0.04] text-ink'
          : 'border-rule bg-paper text-ink-soft hover:bg-ink/[0.03]',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-navy"
      />
      <span className="text-[13px] font-medium">{label}</span>
    </label>
  )
}

// ============================================
// QuickClientDialog
// ============================================

function QuickClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (client: { id: string; displayName: string }) => void
}) {
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    companyName: '',
    siret: '',
  })
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!form.displayName.trim()) {
      toast.error('Nom requis.')
      return
    }
    startTransition(async () => {
      const res = await createQuickClientAction({
        displayName: form.displayName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        companyName: form.companyName.trim() || null,
        siret: form.siret.trim() || null,
      })
      if (!res.success || !res.clientId) {
        toast.error(res.error ?? 'Création impossible.')
        return
      }
      toast.success('Client créé.')
      onCreated({ id: res.clientId, displayName: res.displayName ?? form.displayName })
      onOpenChange(false)
      setForm({ displayName: '', email: '', phone: '', companyName: '', siret: '' })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">Nom *</Label>
            <Input
              id="qc-name"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-email">Email</Label>
              <Input
                id="qc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-phone">Téléphone</Label>
              <Input
                id="qc-phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-company">Société (optionnel)</Label>
            <Input
              id="qc-company"
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-siret">SIRET (optionnel)</Label>
            <Input
              id="qc-siret"
              value={form.siret}
              onChange={(e) => setForm((p) => ({ ...p, siret: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="accent" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
