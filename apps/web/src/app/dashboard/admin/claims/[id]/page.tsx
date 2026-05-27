import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClaimReviewForm } from './claim-review-form'

export const metadata: Metadata = {
  title: 'Claim KYC · Admin KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ClaimDetail {
  claim_id: string
  diagnostician_id: string
  diagnostician_name: string | null
  diagnostician_city: string | null
  diagnostician_postcode: string | null
  diagnostician_email: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_siret: string | null
  status: string
  flow_version: string
  siret_verified_at: string | null
  phone_verified_at: string | null
  identity_uploaded_at: string | null
  identity_doc_path: string | null
  identity_kyc_score: number | null
  // biome-ignore lint/suspicious/noExplicitAny: jsonb dynamique
  identity_kyc_reasons: any | null
  kyc_reviewed_at: string | null
  kyc_decision: string | null
  kyc_review_notes: string | null
  ip_address: string | null
  created_at: string
}

async function loadClaim(
  claimId: string,
): Promise<{ claim: ClaimDetail; signedUrl: string | null } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    return null
  }

  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validées au boot
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validées au boot
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: vue claim_kyc_queue
  const adminAny = admin as any

  const { data, error } = await adminAny
    .from('claim_kyc_queue')
    .select('*')
    .eq('claim_id', claimId)
    .maybeSingle()

  if (error || !data) {
    console.error('[admin/claims/[id]] loadClaim error:', error?.message)
    return null
  }

  const claim = data as ClaimDetail

  // Génère une signed URL pour la pièce d'identité (5 minutes TTL)
  let signedUrl: string | null = null
  if (claim.identity_doc_path) {
    const { data: signed } = await admin.storage
      .from('claim-identity-documents')
      .createSignedUrl(claim.identity_doc_path, 300)
    signedUrl = signed?.signedUrl ?? null
  }

  return { claim, signedUrl }
}

export default async function AdminClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = await requireAdmin()
  const loaded = await loadClaim(id)
  if (!loaded) notFound()

  const { claim, signedUrl } = loaded
  const reasons: string[] = Array.isArray(claim.identity_kyc_reasons?.reasons)
    ? claim.identity_kyc_reasons.reasons
    : []
  const recommendation: string | null = claim.identity_kyc_reasons?.recommendation ?? null
  const flags = claim.identity_kyc_reasons?.flags ?? null

  const isDecided = claim.kyc_decision === 'approved' || claim.kyc_decision === 'rejected'

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <Link
          href="/dashboard/admin/claims"
          className="text-[11px] font-mono uppercase tracking-wider text-ink-mute underline hover:text-ink"
        >
          ← File modération claims
        </Link>
      </div>

      <AppPageHeader
        eyebrow="Admin · Claim KYC"
        title={claim.diagnostician_name ?? 'Diagnostiqueur'}
        description={`Demande créée le ${new Date(claim.created_at).toLocaleString('fr-FR')} · ${claim.diagnostician_city ?? ''} ${claim.diagnostician_postcode ?? ''}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche — métadonnées + score */}
        <div className="space-y-4">
          <Card variant="flat" padding="default">
            <h3 className="text-[14px] font-semibold text-ink mb-3">Étapes validées</h3>
            <dl className="space-y-2 text-[12px]">
              <StepRow
                label="01 · SIRET"
                timestamp={claim.siret_verified_at}
                value={claim.contact_siret}
              />
              <StepRow
                label="02 · SMS pro"
                timestamp={claim.phone_verified_at}
                value={claim.contact_phone}
              />
              <StepRow label="03 · Identité" timestamp={claim.identity_uploaded_at} value={null} />
            </dl>
          </Card>

          <Card variant="flat" padding="default">
            <h3 className="text-[14px] font-semibold text-ink mb-3">Score Vision IA</h3>
            <p className="font-serif italic text-[56px] leading-none text-ink">
              {claim.identity_kyc_score ?? '—'}
              <span className="text-[18px] text-ink-mute">/100</span>
            </p>
            {recommendation && (
              <p className="mt-3 text-[11px] font-mono uppercase tracking-wider text-ink-mute">
                Recommandation : {recommendation}
              </p>
            )}
            {flags && (
              <ul className="mt-4 text-[12px] text-ink-mute space-y-1">
                <li>
                  Type document :{' '}
                  <span className="text-ink font-medium">{flags.doc_type ?? '—'}</span>
                </li>
                <li>Pièce d&apos;identité officielle : {flags.is_id_document ? 'Oui' : 'Non'}</li>
                <li>Date d&apos;expiration valide : {flags.expiry_ok ? 'Oui' : 'Non'}</li>
                <li>Pas de falsification : {flags.no_falsification_detected ? 'Oui' : 'Non'}</li>
                <li>Concordance nom : {Math.round((flags.name_match_score ?? 0) * 100)}%</li>
                {flags.full_name_detected && (
                  <li>
                    Nom lu :{' '}
                    <span className="text-ink font-medium">{flags.full_name_detected}</span>
                  </li>
                )}
              </ul>
            )}
          </Card>

          {reasons.length > 0 && (
            <Card variant="flat" padding="default">
              <h3 className="text-[14px] font-semibold text-ink mb-3">Raisons Vision IA</h3>
              <ul className="text-[12px] text-ink-mute space-y-1.5 list-disc pl-4">
                {reasons.map((r, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: liste statique
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Colonne droite — preview document + form décision */}
        <div className="space-y-4">
          <Card variant="flat" padding="default">
            <h3 className="text-[14px] font-semibold text-ink mb-3">
              Pièce d&apos;identité (signed URL, 5 min)
            </h3>
            {signedUrl ? (
              <div className="space-y-2">
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full max-h-[60vh] overflow-hidden rounded-md border border-rule"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrl}
                    alt="Pièce d'identité"
                    className="w-full h-auto object-contain"
                  />
                </a>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono uppercase tracking-wider text-ink-mute underline hover:text-ink"
                >
                  Ouvrir en plein écran
                </a>
              </div>
            ) : (
              <p className="text-[12px] text-ink-mute">Aucun document uploadé.</p>
            )}
          </Card>

          {isDecided ? (
            <Card variant="flat" padding="default" className="border-l-4 border-l-[#D4F542]">
              <h3 className="text-[14px] font-semibold text-ink mb-2">
                Décision : {claim.kyc_decision === 'approved' ? 'Approuvé' : 'Rejeté'}
              </h3>
              <p className="text-[12px] text-ink-mute">
                Tranché le{' '}
                {claim.kyc_reviewed_at
                  ? new Date(claim.kyc_reviewed_at).toLocaleString('fr-FR')
                  : '—'}
              </p>
              {claim.kyc_review_notes && (
                <p className="text-[12px] text-ink-mute mt-3 leading-relaxed whitespace-pre-wrap">
                  {claim.kyc_review_notes}
                </p>
              )}
            </Card>
          ) : (
            <ClaimReviewForm
              claimId={claim.claim_id}
              diagnosticianId={claim.diagnostician_id}
              reviewerEmail={admin.email}
              diagnosticianEmail={claim.diagnostician_email ?? claim.contact_email}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StepRow({
  label,
  timestamp,
  value,
}: {
  label: string
  timestamp: string | null
  value: string | null
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-mono text-ink-mute">{label}</dt>
      <dd className="text-right">
        {timestamp ? (
          <>
            <span className="text-ink">{new Date(timestamp).toLocaleString('fr-FR')}</span>
            {value && <p className="text-[11px] text-ink-mute font-mono">{value}</p>}
          </>
        ) : (
          <span className="text-ink-faint italic">—</span>
        )}
      </dd>
    </div>
  )
}
