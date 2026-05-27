import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Claims KYC · Admin KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface ClaimRow {
  claim_id: string
  diagnostician_id: string
  diagnostician_name: string | null
  diagnostician_city: string | null
  diagnostician_postcode: string | null
  status: string
  identity_kyc_score: number | null
  identity_uploaded_at: string | null
  kyc_decision: string | null
  created_at: string
}

async function loadClaimsQueue(): Promise<ClaimRow[]> {
  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validées au boot
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validées au boot
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour la vue claim_kyc_queue
  const adminAny = admin as any

  const { data, error } = await adminAny
    .from('claim_kyc_queue')
    .select(
      'claim_id, diagnostician_id, diagnostician_name, diagnostician_city, diagnostician_postcode, status, identity_kyc_score, identity_uploaded_at, kyc_decision, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[admin/claims] loadClaimsQueue error:', error.message)
    return []
  }
  return (data as ClaimRow[]) ?? []
}

export default async function AdminClaimsListPage() {
  await requireAdmin()
  const claims = await loadClaimsQueue()

  const pending = claims.filter(
    (c) => c.status === 'review_pending' || c.status === 'identity_uploaded',
  )
  const decided = claims.filter((c) => c.status === 'approved' || c.status === 'rejected')

  return (
    <div className="space-y-8 animate-fade-in">
      <AppPageHeader
        eyebrow="Tableau de bord admin"
        title="Claims KYC"
        accent="KOVAS"
        description="File de modération des demandes de réclamation Doctolib pattern (3 étapes : SIRET + SMS + KYC). SLA review : 24-48h."
      />

      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold text-ink">À traiter ({pending.length})</h2>
        {pending.length === 0 ? (
          <Card variant="flat" padding="default">
            <p className="text-[13px] text-ink-mute">Aucune demande en attente.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pending.map((c) => (
              <ClaimListItem key={c.claim_id} claim={c} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold text-ink">
            Décisions récentes ({decided.length})
          </h2>
          <div className="space-y-2">
            {decided.map((c) => (
              <ClaimListItem key={c.claim_id} claim={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ClaimListItem({ claim }: { claim: ClaimRow }) {
  const scoreBadge =
    claim.identity_kyc_score === null
      ? null
      : claim.identity_kyc_score >= 85
        ? { label: `${claim.identity_kyc_score}/100`, cls: 'bg-pastel-lime text-ink' }
        : claim.identity_kyc_score >= 70
          ? { label: `${claim.identity_kyc_score}/100`, cls: 'bg-pastel-butter text-ink' }
          : { label: `${claim.identity_kyc_score}/100`, cls: 'bg-pastel-peach text-ink' }

  const statusBadge =
    claim.kyc_decision === 'approved'
      ? { label: 'Approuvé', cls: 'bg-pastel-lime text-ink' }
      : claim.kyc_decision === 'rejected'
        ? { label: 'Rejeté', cls: 'bg-pastel-peach text-ink' }
        : claim.status === 'review_pending'
          ? { label: 'À reviewer', cls: 'bg-pastel-sky text-ink' }
          : { label: claim.status, cls: 'bg-rule/40 text-ink-mute' }

  return (
    <Link href={`/dashboard/admin/claims/${claim.claim_id}`} className="block">
      <Card variant="flat" padding="sm" className="hover:shadow-glass-lg transition-shadow">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink truncate">
              {claim.diagnostician_name ?? '—'}
            </p>
            <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mt-0.5">
              {claim.diagnostician_city ?? ''}{' '}
              {claim.diagnostician_postcode ? `(${claim.diagnostician_postcode})` : ''}
              {' · '}
              {new Date(claim.created_at).toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {scoreBadge && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-pill ${scoreBadge.cls}`}>
                {scoreBadge.label}
              </span>
            )}
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-pill ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
