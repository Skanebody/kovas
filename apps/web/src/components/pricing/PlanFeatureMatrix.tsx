'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import {
  ANNUAIRE_PLANS,
  type AnnuairePlan,
  type AnnuairePlanCode,
  BUNDLES,
  type Bundle,
  LOGICIEL_PLANS,
  type LogicielPlan,
  type LogicielPlanCode,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { Check, Minus } from 'lucide-react'

/**
 * Matrice comparative V3 dual track — affichée sur `/pricing/compare`.
 *
 * 9 colonnes : 4 Annuaire + 5 Logiciel KOVAS.
 * Sections : "Annuaire" / "KOVAS" / "Bundles" (5 lignes simples).
 *
 * Mobile : table scroll horizontale. Les anciennes 5 colonnes E2c et les
 * 5 addons supprimés (`bilingual_reports`, `facturx_ppf`, `analytics_advanced`,
 * `regulatory_watch`, `cockpit_ademe_m2`) ne sont plus référencés.
 */
export function PlanFeatureMatrix() {
  return (
    <div className="space-y-10">
      <AnnuaireMatrix />
      <LogicielMatrix />
      <BundlesComparison />
    </div>
  )
}

// ─── Annuaire ────────────────────────────────────────────────

interface AnnuaireRow {
  feature: string
  values: Record<AnnuairePlanCode, boolean | string>
}

/**
 * Helper interne : construit une row Annuaire en propageant la valeur officielle
 * (annuaire_local / regional / national) vers les alias V3 (annuaire_pro /
 * visibility / sponsored) pour satisfaire `Record<AnnuairePlanCode, …>` exhaustif.
 */
function buildAnnuaireRow(
  feature: string,
  values: {
    annuaire_free: boolean | string
    annuaire_local: boolean | string
    annuaire_regional: boolean | string
    annuaire_national: boolean | string
  },
): AnnuaireRow {
  return {
    feature,
    values: {
      annuaire_free: values.annuaire_free,
      annuaire_local: values.annuaire_local,
      annuaire_regional: values.annuaire_regional,
      annuaire_national: values.annuaire_national,
      // Alias V3 historiques (rétrocompat type)
      annuaire_pro: values.annuaire_local,
      annuaire_visibility: values.annuaire_regional,
      annuaire_sponsored: values.annuaire_national,
    },
  }
}

const ANNUAIRE_ROWS: readonly AnnuaireRow[] = [
  buildAnnuaireRow('Niveau de fiche', {
    annuaire_free: 'Vérifiée',
    annuaire_local: 'Premium',
    annuaire_regional: 'Premium + boost',
    annuaire_national: 'Premium top dept',
  }),
  buildAnnuaireRow('Leads particuliers / mois', {
    annuaire_free: '0',
    annuaire_local: '5',
    annuaire_regional: '15',
    annuaire_national: '30',
  }),
  buildAnnuaireRow('Photos + services', {
    annuaire_free: false,
    annuaire_local: true,
    annuaire_regional: true,
    annuaire_national: true,
  }),
  buildAnnuaireRow('Boost SEO local', {
    annuaire_free: false,
    annuaire_local: false,
    annuaire_regional: true,
    annuaire_national: true,
  }),
  buildAnnuaireRow('Analytics fiche', {
    annuaire_free: false,
    annuaire_local: false,
    annuaire_regional: true,
    annuaire_national: true,
  }),
  buildAnnuaireRow('Badge "Recommandé"', {
    annuaire_free: false,
    annuaire_local: false,
    annuaire_regional: false,
    annuaire_national: true,
  }),
  buildAnnuaireRow('Sponsored Slot exclusif', {
    annuaire_free: false,
    annuaire_local: false,
    annuaire_regional: false,
    annuaire_national: 'Inclus (surcoût ville)',
  }),
]

function AnnuaireMatrix() {
  return (
    <div>
      <h3 className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
        KOVAS Annuaire — 4 tiers
      </h3>
      <div className="overflow-x-auto rounded-[24px] border border-[#0F1419]/[0.08] bg-white">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#0F1419]/[0.08]">
              <th
                scope="col"
                className="sticky left-0 bg-white text-left px-5 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold min-w-[220px]"
              >
                Fonctionnalité Annuaire
              </th>
              {ANNUAIRE_PLANS.map((plan: AnnuairePlan) => (
                <th
                  key={plan.code}
                  scope="col"
                  className={cn(
                    'px-3 py-5 text-center min-w-[120px]',
                    plan.featured === true && 'bg-[#0F1419]/[0.03]',
                  )}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold mb-1">
                    {plan.featured === true ? 'Recommandé' : ' '}
                  </div>
                  <div className="font-semibold text-[#0F1419] text-[14px]">{plan.name}</div>
                  <div className="font-serif italic text-[22px] leading-none mt-1 text-[#0F1419]">
                    {Math.round(plan.monthlyPrice / 100)} €
                  </div>
                  <div className="text-[10px] text-[#0F1419]/55">HT / mois</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ANNUAIRE_ROWS.map((row, idx) => (
              <tr
                key={row.feature}
                className={cn(
                  'border-t border-[#0F1419]/[0.04]',
                  idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F7F4]/40',
                )}
              >
                <td className="sticky left-0 bg-inherit px-5 py-3.5 text-[#0F1419] font-medium">
                  {row.feature}
                </td>
                {ANNUAIRE_PLANS.map((plan) => (
                  <td
                    key={plan.code}
                    className={cn(
                      'px-3 py-3.5 text-center',
                      plan.featured === true && 'bg-[#0F1419]/[0.03]',
                    )}
                  >
                    <Cell value={row.values[plan.code]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── KOVAS ───────────────────────────────────────────────

interface LogicielRow {
  category: string
  feature: string
  values: Record<LogicielPlanCode, boolean | string>
}

/**
 * Helper interne : construit une row Logiciel en propageant la valeur officielle
 * (essai / solo_light / solo_pro / cabinet / cabinet_plus) vers les alias V3
 * historiques (logiciel_*) pour satisfaire `Record<LogicielPlanCode, …>` exhaustif.
 */
function buildLogicielRow(
  category: string,
  feature: string,
  values: {
    essai: boolean | string
    solo_light: boolean | string
    solo_pro: boolean | string
    cabinet: boolean | string
    cabinet_plus: boolean | string
  },
): LogicielRow {
  return {
    category,
    feature,
    values: {
      essai: values.essai,
      solo_light: values.solo_light,
      solo_pro: values.solo_pro,
      cabinet: values.cabinet,
      cabinet_plus: values.cabinet_plus,
      // Alias V3 historiques (rétrocompat type)
      logiciel_free: values.essai,
      logiciel_starter: values.solo_light,
      logiciel_active: values.solo_pro,
      logiciel_cabinet: values.cabinet,
      logiciel_enterprise: values.cabinet_plus,
    },
  }
}

const LOGICIEL_ROWS: readonly LogicielRow[] = [
  buildLogicielRow('Volume', 'Missions / mois', {
    essai: '30 (cap)',
    solo_light: '60',
    solo_pro: '150',
    cabinet: '400',
    cabinet_plus: 'illimité',
  }),
  buildLogicielRow(
    'Diagnostics',
    '8 diagnostics standards (DPE, Amiante, Plomb, Gaz, Élec, Termites, Carrez, ERP)',
    {
      essai: true,
      solo_light: true,
      solo_pro: true,
      cabinet: true,
      cabinet_plus: true,
    },
  ),
  buildLogicielRow('IA', 'Saisie vocale Whisper', {
    essai: '1h/mo',
    solo_light: '5h/mo',
    solo_pro: '10h/mo',
    cabinet: '40h/mo',
    cabinet_plus: '80h/mo',
  }),
  buildLogicielRow('IA', 'Vision IA reconnaissance équipements', {
    essai: false,
    solo_light: false,
    solo_pro: '100/mo',
    cabinet: '600/mo',
    cabinet_plus: '1 500/mo',
  }),
  buildLogicielRow('IA', 'Recommandations post-DPE F/G', {
    essai: false,
    solo_light: false,
    solo_pro: true,
    cabinet: true,
    cabinet_plus: true,
  }),
  buildLogicielRow('Stockage', 'Capacité cloud', {
    essai: '5 Go',
    solo_light: '12 Go',
    solo_pro: '25 Go',
    cabinet: '100 Go',
    cabinet_plus: '250 Go',
  }),
  buildLogicielRow('Comptes', "Nombre d'utilisateurs", {
    essai: '1',
    solo_light: '1',
    solo_pro: '1',
    cabinet: '3',
    cabinet_plus: '7',
  }),
  buildLogicielRow('Facturation', 'Factur-X (obligation 2027)', {
    essai: false,
    solo_light: false,
    solo_pro: false,
    cabinet: true,
    cabinet_plus: true,
  }),
  buildLogicielRow('API', 'API publique', {
    essai: false,
    solo_light: false,
    solo_pro: false,
    cabinet: false,
    cabinet_plus: true,
  }),
  buildLogicielRow('Support', 'Support', {
    essai: 'Email 48h',
    solo_light: 'Email 24h',
    solo_pro: 'Prio 4h',
    cabinet: 'Account manager',
    cabinet_plus: 'SLA 4h + onboarding',
  }),
]

function LogicielMatrix() {
  const grouped = LOGICIEL_ROWS.reduce<Map<string, LogicielRow[]>>((acc, row) => {
    const list = acc.get(row.category) ?? []
    list.push(row)
    acc.set(row.category, list)
    return acc
  }, new Map())

  return (
    <div>
      <h3 className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
        KOVAS — 5 tiers
      </h3>
      <div className="overflow-x-auto rounded-[24px] border border-[#0F1419]/[0.08] bg-white">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#0F1419]/[0.08]">
              <th
                scope="col"
                className="sticky left-0 bg-white text-left px-5 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold min-w-[260px]"
              >
                Fonctionnalité KOVAS
              </th>
              {LOGICIEL_PLANS.map((plan: LogicielPlan) => (
                <th
                  key={plan.code}
                  scope="col"
                  className={cn(
                    'px-3 py-5 text-center min-w-[110px]',
                    plan.featured === true && 'bg-[#0F1419]/[0.03]',
                  )}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold mb-1">
                    {plan.featured === true ? 'Populaire' : ' '}
                  </div>
                  <div className="font-semibold text-[#0F1419] text-[14px]">{plan.name}</div>
                  <div className="font-serif italic text-[22px] leading-none mt-1 text-[#0F1419]">
                    {Math.round(plan.monthlyPrice / 100)} €
                  </div>
                  <div className="text-[10px] text-[#0F1419]/55">HT / mois</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([category, rows]) => (
              <tbody key={category} className="contents">
                <tr>
                  <th
                    colSpan={1 + LOGICIEL_PLANS.length}
                    scope="colgroup"
                    className="bg-[#F5F7F4] text-left px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/72 font-semibold border-t border-[#0F1419]/[0.08]"
                  >
                    {category}
                  </th>
                </tr>
                {rows.map((row, idx) => (
                  <tr
                    key={row.feature}
                    className={cn(
                      'border-t border-[#0F1419]/[0.04]',
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F7F4]/40',
                    )}
                  >
                    <td className="sticky left-0 bg-inherit px-5 py-3.5 text-[#0F1419] font-medium">
                      {row.feature}
                    </td>
                    {LOGICIEL_PLANS.map((plan) => (
                      <td
                        key={plan.code}
                        className={cn(
                          'px-3 py-3.5 text-center',
                          plan.featured === true && 'bg-[#0F1419]/[0.03]',
                        )}
                      >
                        <Cell value={row.values[plan.code]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Bundles ────────────────────────────────────────────────

function BundlesComparison() {
  return (
    <div>
      <h3 className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
        Bundles — économisez en combinant
      </h3>
      <div className="overflow-x-auto rounded-[24px] border border-[#0F1419]/[0.08] bg-white">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
              <th
                scope="col"
                className="text-left px-5 py-4 font-semibold text-[#0F1419] min-w-[200px]"
              >
                Bundle
              </th>
              <th scope="col" className="text-left px-5 py-4 font-semibold text-[#0F1419]">
                Composition
              </th>
              <th
                scope="col"
                className="text-right px-5 py-4 font-semibold text-[#0F1419] min-w-[110px]"
              >
                Séparément
              </th>
              <th
                scope="col"
                className="text-right px-5 py-4 font-semibold text-[#0F1419] min-w-[110px]"
              >
                Bundle
              </th>
              <th
                scope="col"
                className="text-right px-5 py-4 font-semibold text-[#0F1419] min-w-[120px]"
              >
                Économie / mois
              </th>
            </tr>
          </thead>
          <tbody>
            {BUNDLES.map((bundle: Bundle, idx) => (
              <tr
                key={bundle.code}
                className={cn(
                  'border-t border-[#0F1419]/[0.04]',
                  idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F7F4]/40',
                )}
              >
                <td className="px-5 py-3.5 font-medium text-[#0F1419]">{bundle.name}</td>
                <td className="px-5 py-3.5 text-[#0F1419]/72 text-[13px]">
                  {bundle.includedPlanLabels.join(' + ')}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-[#0F1419]/55 line-through">
                  {Math.round(bundle.individualMonthlyPriceCents / 100)} €
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums font-semibold">
                  {Math.round(bundle.monthlyPrice / 100)} €
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[12px] font-semibold bg-chartreuse text-[#0F1419] tabular-nums">
                    − {Math.round(bundle.monthlySavingsCents / 100)} €
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Cell helper ────────────────────────────────────────────

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span
        aria-label="Inclus"
        className="inline-flex items-center justify-center size-6 rounded-full bg-chartreuse text-[#0F1419]"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    )
  }
  if (value === false) {
    return (
      <span
        aria-label="Non inclus"
        className="inline-flex items-center justify-center size-6 rounded-full bg-[#0F1419]/[0.04] text-[#0F1419]/35"
      >
        <Minus className="size-3.5" />
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#0F1419]/[0.06] text-[#0F1419]/80 tabular-nums">
      {value}
    </span>
  )
}
