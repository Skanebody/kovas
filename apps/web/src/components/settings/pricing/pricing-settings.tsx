/**
 * KOVAS — PricingSettings (page paramètres /app/compte/tarifs)
 *
 * Server component qui fetch `user_pricing_config` + `user_pricing_packs`
 * via Supabase, puis :
 *   - Si `!has_configured` → render <TemplateSelector>
 *   - Sinon → render éditeurs (VAT, diagnostics, packs, déplacement, majo)
 *     + zone danger.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { TEMPLATE_MEDIAN } from '@/lib/pricing/pricing-templates'
import type {
  DiagnosticPricing,
  MajorationsConfig,
  PricingDiagnosticType,
  TravelFeesConfig,
} from '@/lib/pricing/pricing-templates'
import { DiagnosticPriceEditor } from './diagnostic-price-editor'
import { MajorationsEditor } from './majorations-editor'
import { PackEditor, type UserPackRow } from './pack-editor'
import { PricingDangerZone } from './pricing-danger-zone'
import { TemplateSelector } from './template-selector'
import { TravelFeesEditor } from './travel-fees-editor'
import { VatSettingsEditor } from './vat-settings-editor'

interface ConfigRow {
  vat_status: 'with_vat' | 'franchise_vat'
  vat_rate: number
  display_mode: 'ht_and_ttc' | 'ttc_only' | 'ht_only'
  has_configured: boolean
  applied_template: string | null
  pricing_config: {
    diagnostics?: Partial<Record<PricingDiagnosticType, DiagnosticPricing>>
    travelFees?: TravelFeesConfig
    majorations?: MajorationsConfig
  } | null
}

interface SelectConfigQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: ConfigRow | null
        error: { message: string } | null
      }>
    }
  }
}

interface SelectPacksQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{ data: UserPackRow[] | null; error: { message: string } | null }>
    }
  }
}

const ALL_DIAGNOSTICS: PricingDiagnosticType[] = [
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

export async function PricingSettings() {
  const { user, supabase } = await getCurrentUser()

  const configQuery = supabase.from('user_pricing_config') as unknown as SelectConfigQuery
  const { data: config } = await configQuery
    .select('vat_status, vat_rate, display_mode, has_configured, applied_template, pricing_config')
    .eq('user_id', user.id)
    .maybeSingle()

  // Pas encore configuré → TemplateSelector
  if (!config?.has_configured) {
    return <TemplateSelector />
  }

  const packsQuery = supabase.from('user_pricing_packs') as unknown as SelectPacksQuery
  const { data: packs } = await packsQuery
    .select(
      'id, name, description, predefined_pack_id, diagnostics, price_ht, applicable_for, min_property_age, is_active, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const cfg = config.pricing_config ?? {}
  const diagnosticsCfg = cfg.diagnostics ?? {}
  const travelFees: TravelFeesConfig = cfg.travelFees ?? TEMPLATE_MEDIAN.travelFees
  const majorations: MajorationsConfig = cfg.majorations ?? TEMPLATE_MEDIAN.majorations
  const vatRate = Number(config.vat_rate)
  const vatApplicable = config.vat_status === 'with_vat'

  return (
    <div className="space-y-6">
      {/* TVA + affichage */}
      <VatSettingsEditor
        initial={{
          vatStatus: config.vat_status,
          vatRate,
          displayMode: config.display_mode,
        }}
      />

      {/* Tarifs par diagnostic */}
      <section className="space-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Tarifs par diagnostic
          </p>
          <h2 className="text-[18px] font-semibold text-ink mt-1">Grille à l'unité</h2>
          <p className="text-[12px] text-ink-mute mt-1 max-w-xl">
            Prix de base sur appartement standard 30-80 m². Les modulations adaptent le tarif selon
            la surface et le type de bien.
          </p>
        </div>
        <div className="space-y-3">
          {ALL_DIAGNOSTICS.map((d) => {
            const initial = diagnosticsCfg[d] ?? TEMPLATE_MEDIAN.diagnostics[d]
            return (
              <DiagnosticPriceEditor
                key={d}
                diagnostic={d}
                initial={initial}
                vatRate={vatRate}
                vatApplicable={vatApplicable}
              />
            )
          })}
        </div>
      </section>

      {/* Packs */}
      <PackEditor initial={packs ?? []} />

      {/* Déplacement */}
      <TravelFeesEditor initial={travelFees} />

      {/* Majorations */}
      <MajorationsEditor initial={majorations} />

      {/* Danger zone */}
      <PricingDangerZone appliedTemplate={config.applied_template} />
    </div>
  )
}
