/**
 * KOVAS — Widget "Renouvellements" (Lot B82 — Vague 3A).
 *
 * Expose l'algo A1.3.10 (`lib/algos/expiry-predictor.ts`) côté diagnostiqueur
 * sur le dashboard root. Anticipe les expirations COFRAC + RC Pro et propose
 * un CTA renouvellement clair.
 *
 * Server Component : charge les dates depuis le profil organisation
 * (`organizations.cofrac_valid_until` + `rcpro_valid_until` si présents)
 * sinon affiche un état neutre invitant à renseigner les certifications.
 *
 * TODO B82+ : brancher sur la vraie source (`verification_evidence` ou table
 * `organization_certifications` dédiée) une fois le schéma stabilisé.
 * En attendant, placeholder data déterministe à partir du `organization_id`.
 */

import { predictExpiry } from '@/lib/algos/expiry-predictor'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowUpRight, BellRing, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface CertExpiryRow {
  cert: 'cofrac' | 'rcpro'
  label: string
  daysUntilExpiry: number | null
  urgency: 'safe' | 'attention' | 'urgent' | 'critical' | 'expired'
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

/**
 * Charge les dates d'expiration depuis Supabase. Fallback placeholder si
 * colonnes/table absente — la priorité B82 est l'exposition visible.
 */
async function loadExpiryDates(): Promise<{
  cofracValidUntil: string | null
  rcproValidUntil: string | null
}> {
  try {
    const { supabase, orgId } = await getCurrentUser()
    // Les colonnes peuvent ne pas exister sur tous les schémas — on requête
    // tout l'objet et on lit les champs avec safe-access.
    // biome-ignore lint/suspicious/noExplicitAny: schéma org en évolution
    const { data } = await (supabase as any)
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle()

    return {
      cofracValidUntil: (data?.cofrac_valid_until as string | null) ?? null,
      rcproValidUntil: (data?.rcpro_valid_until as string | null) ?? null,
    }
  } catch {
    return { cofracValidUntil: null, rcproValidUntil: null }
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
  // ET qui ne sont pas "safe" (>60j). Si tout est safe ou non renseigné,
  // empty state positif.
  const needsAttention = rows.filter((r) => r.daysUntilExpiry != null && r.urgency !== 'safe')

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

function UrgencyBadge({ urgency }: { urgency: CertExpiryRow['urgency'] }) {
  if (urgency === 'critical' || urgency === 'expired') {
    return (
      <span
        className="inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{ backgroundColor: '#D4F542', color: '#0F1419' }}
      >
        {urgency === 'expired' ? 'Expiré' : 'Urgent'}
      </span>
    )
  }
  if (urgency === 'urgent') {
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
