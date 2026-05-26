/**
 * KOVAS — Widget "Renouvellements" (Lot B82 — Vague 3A, branchement réel B90).
 *
 * Expose l'algo A1.3.10 (`lib/algos/expiry-predictor.ts`) côté diagnostiqueur
 * sur le dashboard root. Anticipe les expirations COFRAC + RC Pro et propose
 * un CTA renouvellement clair.
 *
 * Source data réelle (B90) : table `diagnostician_verification_status` via
 * jointure `diagnosticians.claimed_by_user_id = auth.uid()`. Les colonnes
 * `cofrac_valid_until` + `rcpro_valid_until` (type DATE) sont la source
 * canonique du pipeline de vérification (migration
 * `20260524240000_diagnosticians_verification_pipeline.sql`).
 *
 * Fallback : si le diagnostiqueur n'a pas encore réclamé sa fiche ou si la
 * ligne `diagnostician_verification_status` n'existe pas encore, on retombe
 * sur les éventuelles colonnes `organizations.cofrac_valid_until` (legacy).
 * Si rien n'est trouvé → empty state positif "Tes certifications sont à jour".
 *
 * Tri : par urgence décroissante (expired > critical > urgent > attention).
 */

import { type UrgencyLevel, predictExpiry } from '@/lib/algos/expiry-predictor'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowUpRight, BellRing, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface CertExpiryRow {
  cert: 'cofrac' | 'rcpro'
  label: string
  daysUntilExpiry: number | null
  urgency: UrgencyLevel
  expiresOn: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface ExpirySources {
  cofracValidUntil: string | null
  rcproValidUntil: string | null
}

/**
 * Charge les dates d'expiration COFRAC + RC Pro pour le diagnostiqueur
 * connecté.
 *
 * Stratégie :
 *   1. Lookup `diagnosticians` via `claimed_by_user_id = auth.uid()`
 *   2. Si fiche trouvée → SELECT dans `diagnostician_verification_status`
 *      (colonnes `cofrac_valid_until` + `rcpro_valid_until`)
 *   3. Sinon → fallback safe sur `organizations` (legacy columns optionnelles)
 *   4. Sinon → null/null (le widget affiche empty state)
 */
async function loadExpiryDates(): Promise<ExpirySources> {
  try {
    const { supabase, user, orgId } = await getCurrentUser()

    // Étape 1 — chercher la fiche diagnostician réclamée par l'user
    // biome-ignore lint/suspicious/noExplicitAny: schéma diagnosticians multi-migrations
    const { data: diag } = await (supabase as any)
      .from('diagnosticians')
      .select('id')
      .eq('claimed_by_user_id', user.id)
      .maybeSingle()

    if (diag?.id) {
      // biome-ignore lint/suspicious/noExplicitAny: table verification_status optionnelle
      const { data: vstatus } = await (supabase as any)
        .from('diagnostician_verification_status')
        .select('cofrac_valid_until, rcpro_valid_until')
        .eq('diagnostician_id', diag.id)
        .maybeSingle()

      if (vstatus) {
        return {
          cofracValidUntil: (vstatus.cofrac_valid_until as string | null) ?? null,
          rcproValidUntil: (vstatus.rcpro_valid_until as string | null) ?? null,
        }
      }
    }

    // Étape 2 — fallback sur organizations (legacy si jamais)
    // biome-ignore lint/suspicious/noExplicitAny: colonnes legacy optionnelles
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle()

    return {
      cofracValidUntil: (org?.cofrac_valid_until as string | null) ?? null,
      rcproValidUntil: (org?.rcpro_valid_until as string | null) ?? null,
    }
  } catch {
    return { cofracValidUntil: null, rcproValidUntil: null }
  }
}

/**
 * Rang d'urgence — plus c'est haut, plus c'est prioritaire en tête de liste.
 */
function urgencyRank(u: UrgencyLevel): number {
  switch (u) {
    case 'expired':
      return 4
    case 'critical':
      return 3
    case 'urgent':
      return 2
    case 'attention':
      return 1
    default:
      return 0
  }
}

export async function RenewalsWidget() {
  const { cofracValidUntil, rcproValidUntil } = await loadExpiryDates()

  const prediction = predictExpiry({
    cofrac_valid_until: cofracValidUntil,
    rcpro_valid_until: rcproValidUntil,
  })

  const rows: CertExpiryRow[] = [
    {
      cert: 'cofrac',
      label: 'COFRAC',
      daysUntilExpiry: prediction.cofrac.days_until_expiry,
      urgency: prediction.cofrac.urgency,
      expiresOn: prediction.cofrac.expires_on,
    },
    {
      cert: 'rcpro',
      label: 'RC Pro',
      daysUntilExpiry: prediction.rcpro.days_until_expiry,
      urgency: prediction.rcpro.urgency,
      expiresOn: prediction.rcpro.expires_on,
    },
  ]

  // Filtre : on affiche uniquement les certifs qui ont une date renseignée
  // ET qui ne sont pas "safe" (>60j). Tri par urgence décroissante.
  const needsAttention = rows
    .filter((r) => r.daysUntilExpiry != null && r.urgency !== 'safe')
    .sort((a, b) => urgencyRank(b.urgency) - urgencyRank(a.urgency))

  return (
    <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-[#0F1419]/72" aria-hidden />
          <h2 className="text-sm font-semibold text-[#0F1419]">Renouvellements</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">A1.3.10</p>
      </header>

      {needsAttention.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-[#0F1419]/72">
          <CheckCircle2 className="size-4 text-[#0F1419]/55" aria-hidden />
          <span>Tes certifications sont à jour.</span>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {needsAttention.map((row) => (
            <li key={row.cert} className="flex items-center justify-between gap-3 py-1">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#0F1419]">{row.label}</p>
                <p className="font-mono text-[11px] text-[#0F1419]/55">
                  Expire le {formatDate(row.expiresOn)}
                  {row.daysUntilExpiry != null ? (
                    <span>
                      {' '}
                      · J{row.daysUntilExpiry >= 0 ? '−' : '+'}
                      {Math.abs(row.daysUntilExpiry)}
                    </span>
                  ) : null}
                </p>
              </div>
              <UrgencyBadge urgency={row.urgency} />
            </li>
          ))}
        </ul>
      )}

      <footer className="pt-2 border-t border-[#0F1419]/[0.06]">
        <Link
          href="/dashboard/account/verification"
          className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419] hover:text-[#0F1419]/72 transition-colors inline-flex items-center gap-1"
        >
          Gérer mes certifications
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </footer>
    </section>
  )
}

/**
 * Badge urgence — palette V5 sobre :
 *   - expired : fond rouge sombre (destructive doux) + texte cream
 *   - critical/urgent : fond chartreuse `#D4F542` (signature V5) + ink
 *   - attention : outline neutre "Bientôt"
 */
export function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  if (urgency === 'expired') {
    return (
      <span
        className="inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{ backgroundColor: '#7A1F1F', color: '#F5F7F4' }}
      >
        Expiré
      </span>
    )
  }
  if (urgency === 'critical' || urgency === 'urgent') {
    return (
      <span
        className="inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{ backgroundColor: '#D4F542', color: '#0F1419' }}
      >
        Urgent
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider border border-[#0F1419]/[0.12] text-[#0F1419]/72">
      Bientôt
    </span>
  )
}
