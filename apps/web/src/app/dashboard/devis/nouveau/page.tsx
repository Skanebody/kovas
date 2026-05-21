import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOrganizationBranding } from '@/lib/branding/get-organization-branding'
import type {
  DiagnosticPricing,
  MajorationsConfig,
  PricingDiagnosticType,
  TravelFeesConfig,
} from '@/lib/pricing/pricing-templates'
import type { QuoteDiagnosticType, QuoteOrganizationSnapshot } from '@/lib/quotes/types'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { QuoteWizard, type QuoteWizardProperty } from './wizard'

export const metadata: Metadata = { title: 'Nouveau devis' }

interface NewQuotePageProps {
  searchParams: Promise<{ clientId?: string; propertyId?: string }>
}

interface PricingConfigJson {
  diagnostics?: Partial<Record<PricingDiagnosticType, DiagnosticPricing>>
  travelFees?: TravelFeesConfig
  majorations?: MajorationsConfig
}

interface PricingConfigRow {
  vat_rate: number | null
  pricing_config: PricingConfigJson | null
}

interface PackRow {
  id: string
  name: string
  predefined_pack_id: string | null
  diagnostics: string[]
  price_ht: number
  is_active: boolean
}

interface PropertyDbRow {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  surface_total: number | null
  property_type: string | null
  client_id: string | null
  location: unknown
}

interface ClientDbRow {
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

interface OrgRow {
  name: string
  siret: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  certification_n: string | null
}

/**
 * Parse `POINT(lng lat)` ou un objet GeoJSON → `{lat, lng}` ou null.
 * Tolérant : la geography PostGIS peut être renvoyée en plusieurs formats.
 */
function parseLocation(loc: unknown): { lat: number; lng: number } | null {
  if (loc === null || loc === undefined) return null
  if (typeof loc === 'object' && 'coordinates' in (loc as Record<string, unknown>)) {
    const coords = (loc as { coordinates?: unknown }).coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0])
      const lat = Number(coords[1])
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }
  }
  if (typeof loc === 'string') {
    const m = loc.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/)
    if (m) {
      const lng = Number(m[1])
      const lat = Number(m[2])
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }
  }
  return null
}

const PROPERTY_TYPES_FOR_PRICING = new Set(['studio', 'appartement', 'maison', 'local'])

export default async function NewQuotePage({ searchParams }: NewQuotePageProps) {
  const params = await searchParams
  const { supabase, orgId, user } = await getCurrentUser()

  // Parallel fetches : clients, properties, pricing, packs, org, branding
  const [
    clientsRes,
    propertiesRes,
    pricingRes,
    packsRes,
    orgRes,
    brandingRes,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, display_name, email, phone, company_name, siret, address, city, postal_code',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name'),
    supabase
      .from('properties')
      .select(
        'id, address, city, postal_code, surface_total, property_type, client_id, location',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_pricing_config')
      .select('vat_rate, pricing_config')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('user_pricing_packs')
      .select('id, name, predefined_pack_id, diagnostics, price_ht, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('organizations')
      .select('name, siret, vat_number, address, city, postal_code, country, certification_n')
      .eq('id', orgId)
      .maybeSingle(),
    getOrganizationBranding(supabase, orgId),
  ])

  const clients = (clientsRes.data ?? []) as ClientDbRow[]
  const properties = (propertiesRes.data ?? []) as PropertyDbRow[]
  const pricingRow = (pricingRes.data ?? null) as PricingConfigRow | null
  const packs = (packsRes.data ?? []) as PackRow[]
  const org = (orgRes.data ?? null) as OrgRow | null

  // Détermine GPS organisation à partir de l'adresse (V1 : null si non géocodé)
  // On laisse null — le wizard fonctionne sans, l'utilisateur passe en mode manuel.
  const organizationLat: number | null = null
  const organizationLng: number | null = null

  const vatRate =
    pricingRow?.vat_rate !== null && pricingRow?.vat_rate !== undefined
      ? Number(pricingRow.vat_rate) * 100
      : 20

  const diagnosticsPricing: Partial<Record<QuoteDiagnosticType, DiagnosticPricing>> =
    (pricingRow?.pricing_config?.diagnostics as
      | Partial<Record<QuoteDiagnosticType, DiagnosticPricing>>
      | undefined) ?? {}

  const propertiesForWizard: QuoteWizardProperty[] = properties.map((p) => {
    const coords = parseLocation(p.location)
    const ptype = p.property_type ?? null
    return {
      id: p.id,
      address: p.address,
      city: p.city,
      postal_code: p.postal_code,
      surface_total: p.surface_total ?? null,
      property_type:
        ptype && PROPERTY_TYPES_FOR_PRICING.has(ptype)
          ? (ptype as QuoteWizardProperty['property_type'])
          : null,
      client_id: p.client_id,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    }
  })

  const organizationSnapshot: QuoteOrganizationSnapshot = {
    name: org?.name ?? 'Cabinet',
    siret: org?.siret ?? null,
    vatNumber: org?.vat_number ?? null,
    address: org?.address ?? null,
    city: org?.city ?? null,
    postalCode: org?.postal_code ?? null,
    country: org?.country ?? 'FR',
    certificationN: org?.certification_n ?? null,
  }

  return (
    <div className="space-y-6 animate-fade-in pb-32 lg:pb-12">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/devis">
          <ArrowLeft className="size-4" /> Retour aux devis
        </Link>
      </Button>

      <AppPageHeader
        title="Nouveau"
        accent="devis"
        eyebrow="DEV-2026 · BROUILLON"
        description="Composez votre devis, ajustez les prestations puis sauvegardez en brouillon ou envoyez directement au client."
      />

      <QuoteWizard
        clients={clients}
        properties={propertiesForWizard}
        packs={packs
          .filter((p) => p.is_active)
          .map((p) => ({
            id: p.id,
            name: p.name,
            diagnostics: (p.diagnostics ?? []) as PricingDiagnosticType[],
            priceHt: Number(p.price_ht),
          }))}
        pricingConfig={{
          vatRate,
          diagnostics: diagnosticsPricing,
          travelFees: pricingRow?.pricing_config?.travelFees ?? null,
          majorations: pricingRow?.pricing_config?.majorations ?? null,
          organizationLat,
          organizationLng,
        }}
        organizationSnapshot={organizationSnapshot}
        brandColorHex={brandingRes.brandColorHex}
        logoUrl={brandingRes.logoSignedUrl}
        defaultClientId={params.clientId}
        defaultPropertyId={params.propertyId}
      />
    </div>
  )
}
