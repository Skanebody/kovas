'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import {
  ANNUAIRE_PLANS,
  BUNDLES,
  LOGICIEL_PLANS,
  type AnnuairePlan,
  type AnnuairePlanCode,
  type Bundle,
  type LogicielPlan,
  type LogicielPlanCode,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { Check, Minus } from 'lucide-react'

/**
 * Matrice comparative V3 dual track — affichée sur `/pricing/compare`.
 *
 * 9 colonnes : 4 Annuaire + 5 Logiciel KOVAS 360.
 * Sections : "Annuaire" / "KOVAS 360" / "Bundles" (5 lignes simples).
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

const ANNUAIRE_ROWS: readonly AnnuaireRow[] = [
  {
    feature: 'Niveau de fiche',
    values: {
      annuaire_free: 'Vérifiée',
      annuaire_pro: 'Premium',
      annuaire_visibility: 'Premium + boost',
      annuaire_sponsored: 'Premium top dept',
    },
  },
  {
    feature: 'Leads particuliers / mois',
    values: {
      annuaire_free: '0',
      annuaire_pro: '5',
      annuaire_visibility: '15',
      annuaire_sponsored: '30',
    },
  },
  {
    feature: 'Photos + services',
    values: {
      annuaire_free: false,
      annuaire_pro: true,
      annuaire_visibility: true,
      annuaire_sponsored: true,
    },
  },
  {
    feature: 'Boost SEO local',
    values: {
      annuaire_free: false,
      annuaire_pro: false,
      annuaire_visibility: true,
      annuaire_sponsored: true,
    },
  },
  {
    feature: 'Analytics fiche',
    values: {
      annuaire_free: false,
      annuaire_pro: false,
      annuaire_visibility: true,
      annuaire_sponsored: true,
    },
  },
  {
    feature: 'Badge "Recommandé"',
    values: {
      annuaire_free: false,
      annuaire_pro: false,
      annuaire_visibility: false,
      annuaire_sponsored: true,
    },
  },
  {
    feature: 'Sponsored Slot exclusif',
    values: {
      annuaire_free: false,
      annuaire_pro: false,
      annuaire_visibility: false,
      annuaire_sponsored: 'Inclus (surcoût ville)',
    },
  },
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

// ─── KOVAS 360 ───────────────────────────────────────────────

interface LogicielRow {
  category: string
  feature: string
  values: Record<LogicielPlanCode, boolean | string>
}

const LOGICIEL_ROWS: readonly LogicielRow[] = [
  {
    category: 'Volume',
    feature: 'Missions / mois',
    values: {
      logiciel_free: '30 (cap)',
      logiciel_starter: '60',
      logiciel_active: '150',
      logiciel_cabinet: '400',
      logiciel_enterprise: 'illimité',
    },
  },
  {
    category: 'Diagnostics',
    feature: '8 diagnostics standards (DPE, Amiante, Plomb, Gaz, Élec, Termites, Carrez, ERP)',
    values: {
      logiciel_free: true,
      logiciel_starter: true,
      logiciel_active: true,
      logiciel_cabinet: true,
      logiciel_enterprise: true,
    },
  },
  {
    category: 'IA',
    feature: 'Saisie vocale Whisper',
    values: {
      logiciel_free: '1h/mo',
      logiciel_starter: '5h/mo',
      logiciel_active: '10h/mo',
      logiciel_cabinet: '40h/mo',
      logiciel_enterprise: '80h/mo',
    },
  },
  {
    category: 'IA',
    feature: 'Vision IA reconnaissance équipements',
    values: {
      logiciel_free: false,
      logiciel_starter: false,
      logiciel_active: '100/mo',
      logiciel_cabinet: '600/mo',
      logiciel_enterprise: '1 500/mo',
    },
  },
  {
    category: 'IA',
    feature: 'Recommandations post-DPE F/G',
    values: {
      logiciel_free: false,
      logiciel_starter: false,
      logiciel_active: true,
      logiciel_cabinet: true,
      logiciel_enterprise: true,
    },
  },
  {
    category: 'Stockage',
    feature: 'Capacité cloud',
    values: {
      logiciel_free: '5 Go',
      logiciel_starter: '12 Go',
      logiciel_active: '25 Go',
      logiciel_cabinet: '100 Go',
      logiciel_enterprise: '250 Go',
    },
  },
  {
    category: 'Comptes',
    feature: "Nombre d'utilisateurs",
    values: {
      logiciel_free: '1',
      logiciel_starter: '1',
      logiciel_active: '1',
      logiciel_cabinet: '3',
      logiciel_enterprise: '10+',
    },
  },
  {
    category: 'Facturation',
    feature: 'Factur-X (obligation 2027)',
    values: {
      logiciel_free: false,
      logiciel_starter: false,
      logiciel_active: false,
      logiciel_cabinet: true,
      logiciel_enterprise: true,
    },
  },
  {
    category: 'API',
    feature: 'API publique',
    values: {
      logiciel_free: false,
      logiciel_starter: false,
      logiciel_active: false,
      logiciel_cabinet: false,
      logiciel_enterprise: true,
    },
  },
  {
    category: 'Support',
    feature: 'Support',
    values: {
      logiciel_free: 'Email 48h',
      logiciel_starter: 'Email 24h',
      logiciel_active: 'Prio 4h',
      logiciel_cabinet: 'Account manager',
      logiciel_enterprise: 'SLA 4h + onboarding',
    },
  },
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
        KOVAS 360 — 5 tiers
      </h3>
      <div className="overflow-x-auto rounded-[24px] border border-[#0F1419]/[0.08] bg-white">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#0F1419]/[0.08]">
              <th
                scope="col"
                className="sticky left-0 bg-white text-left px-5 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold min-w-[260px]"
              >
                Fonctionnalité KOVAS 360
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
