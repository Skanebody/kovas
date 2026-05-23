import { Button } from '@/components/ui/button'
import { createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  RefreshCcw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Validation de mon profil — KOVAS 360',
  robots: { index: false, follow: false },
}

type PhaseStatus = 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'

interface FullStatus {
  diagnostician_id: string
  identity_status: PhaseStatus
  identity_method: string | null
  identity_rejection_reason: string | null
  cofrac_status: PhaseStatus
  cofrac_number: string | null
  cofrac_certifying_body: string | null
  cofrac_rejection_reason: string | null
  rcpro_status: PhaseStatus
  rcpro_insurer: string | null
  rcpro_valid_until: string | null
  rcpro_rejection_reason: string | null
  sirene_status: PhaseStatus
  sirene_company_name: string | null
  sirene_siret: string | null
  sirene_rejection_reason: string | null
  overall_status: 'pending' | 'verified' | 'rejected' | 'expired'
  badge_level: 'unverified' | 'verified' | 'verified_plus'
}

interface CheckLogRow {
  id: string
  check_type: string
  check_source: string
  status: 'success' | 'warning' | 'failure' | 'timeout'
  performed_at: string
}

async function loadAll(): Promise<{
  status: FullStatus | null
  logs: CheckLogRow[]
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const adminLoose = createAdminClientLoose()

  const { data: diag } = await adminLoose
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()
  if (!diag?.id) return { status: null, logs: [] }

  const [{ data: statusRow }, { data: logRows }] = await Promise.all([
    adminLoose
      .from('diagnostician_verification_status')
      .select('*')
      .eq('diagnostician_id', diag.id)
      .maybeSingle(),
    adminLoose
      .from('verification_checks_log')
      .select('id, check_type, check_source, status, performed_at')
      .eq('diagnostician_id', diag.id)
      .order('performed_at', { ascending: false })
      .limit(20),
  ])

  return {
    status: (statusRow as FullStatus | null) ?? null,
    logs: (logRows as CheckLogRow[] | null) ?? [],
  }
}

export default async function VerificationPage() {
  const data = await loadAll()
  if (!data) redirect('/login?redirect=/dashboard/account/verification')

  const { status, logs } = data
  const isVerified = status?.overall_status === 'verified'

  return (
    <div className="px-4 sm:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Mon compte · Validation
        </p>
        <h1 className="font-serif italic text-3xl sm:text-4xl text-[#0F1419] leading-tight">
          Validation de mon profil.
        </h1>
        <GlobalBanner status={status} />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PhaseCard
          icon={<UserCheck className="size-5" />}
          title="Identité civile"
          status={status?.identity_status ?? 'pending'}
          detail={
            status?.identity_method
              ? `Méthode : ${labelMethod(status.identity_method)}`
              : 'Non renseignée'
          }
          rejection={status?.identity_rejection_reason ?? null}
          resubmitHref="/signup/diagnostiqueur?step=3"
        />
        <PhaseCard
          icon={<FileCheck2 className="size-5" />}
          title="Certification COFRAC"
          status={status?.cofrac_status ?? 'pending'}
          detail={
            status?.cofrac_number
              ? `${status.cofrac_number} · ${status.cofrac_certifying_body ?? '—'}`
              : 'Non renseignée'
          }
          rejection={status?.cofrac_rejection_reason ?? null}
          resubmitHref="/signup/diagnostiqueur?step=4"
        />
        <PhaseCard
          icon={<ShieldCheck className="size-5" />}
          title="Assurance RC Pro"
          status={status?.rcpro_status ?? 'pending'}
          detail={
            status?.rcpro_insurer
              ? `${status.rcpro_insurer} · échéance ${status.rcpro_valid_until ?? '—'}`
              : 'Non renseignée'
          }
          rejection={status?.rcpro_rejection_reason ?? null}
          resubmitHref="/signup/diagnostiqueur?step=5"
        />
        <PhaseCard
          icon={<Building2 className="size-5" />}
          title="Entreprise SIRENE"
          status={status?.sirene_status ?? 'pending'}
          detail={
            status?.sirene_company_name
              ? `${status.sirene_company_name} · ${status.sirene_siret ?? '—'}`
              : 'Non renseignée'
          }
          rejection={status?.sirene_rejection_reason ?? null}
          resubmitHref="/signup/diagnostiqueur?step=6"
        />
      </section>

      <section className="rounded-2xl bg-white border border-[#0F1419]/[0.08] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[#0F1419]">Historique des vérifications</h2>
          <span className="text-[12px] text-[#0F1419]/55">
            {logs.length} entrée{logs.length > 1 ? 's' : ''}
          </span>
        </div>
        {logs.length === 0 ? (
          <p className="text-[13px] text-[#0F1419]/60">
            Aucune vérification effectuée pour le moment.
          </p>
        ) : (
          <ol className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between text-[12px] py-2 border-b border-[#0F1419]/[0.04] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'size-2 rounded-full flex-shrink-0',
                      log.status === 'success' && 'bg-emerald-500',
                      log.status === 'warning' && 'bg-amber-500',
                      (log.status === 'failure' || log.status === 'timeout') && 'bg-red-500',
                    )}
                  />
                  <span className="font-medium text-[#0F1419]">
                    {labelCheckType(log.check_type)}
                  </span>
                  <span className="text-[#0F1419]/55 font-mono text-[11px]">
                    via {log.check_source}
                  </span>
                </div>
                <time
                  dateTime={log.performed_at}
                  className="text-[#0F1419]/55 font-mono text-[11px]"
                >
                  {new Date(log.performed_at).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!isVerified && (
        <aside className="rounded-2xl border border-[#0F1419]/[0.08] bg-[#F5F7F4] p-6 text-[13px] text-[#0F1419]/75 leading-relaxed">
          <p className="font-semibold text-[#0F1419] mb-1">
            Pourquoi mon profil n&apos;est pas encore visible&nbsp;?
          </p>
          <p>
            Doctolib a appris en 2022 qu&apos;un délai de tolérance crée une faille pour les
            escrocs. KOVAS applique une validation préalable obligatoire pour protéger les
            particuliers et notre communauté de diagnostiqueurs honnêtes. Dès que les quatre phases
            sont vert, votre profil apparaît dans l&apos;annuaire public et reçoit des leads du
            calculateur DPE gratuit.
          </p>
        </aside>
      )}
    </div>
  )
}

function GlobalBanner({ status }: { status: FullStatus | null }) {
  if (!status || status.overall_status !== 'verified') {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-900 flex items-center gap-2">
        <Clock className="size-4 flex-shrink-0" />
        <span>
          Profil pas encore visible publiquement — validation en cours (24-48&nbsp;h moyen).
        </span>
      </div>
    )
  }
  return (
    <div className="rounded-md bg-[#D4F542]/30 border border-[#D4F542] px-4 py-3 text-[13px] text-[#0F1419] flex items-center gap-2">
      <CheckCircle2 className="size-4 flex-shrink-0" />
      <span className="font-semibold">Profil vérifié et visible dans l&apos;annuaire.</span>
    </div>
  )
}

function PhaseCard({
  icon,
  title,
  status,
  detail,
  rejection,
  resubmitHref,
}: {
  icon: React.ReactNode
  title: string
  status: PhaseStatus
  detail: string
  rejection: string | null
  resubmitHref: string
}) {
  const isVerified = status === 'verified'
  const isReview = status === 'in_review'
  const isRejected = status === 'rejected' || status === 'expired'

  return (
    <article className="rounded-2xl bg-white border border-[#0F1419]/[0.08] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[#0F1419]">
          {icon}
          <h3 className="font-semibold text-[14px]">{title}</h3>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="text-[13px] text-[#0F1419]/70">{detail}</p>
      {isRejected && rejection && (
        <p className="text-[12px] text-red-700 bg-red-50 rounded-md p-2.5 flex items-start gap-2">
          <AlertCircle className="size-3.5 mt-0.5 flex-shrink-0" />
          {rejection}
        </p>
      )}
      {(isRejected || (!isVerified && !isReview)) && (
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={resubmitHref}>
            <RefreshCcw className="size-3.5" />
            {isRejected ? 'Re-soumettre' : 'Compléter'}
          </Link>
        </Button>
      )}
    </article>
  )
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  const map: Record<PhaseStatus, { label: string; cls: string }> = {
    verified: { label: 'Vérifié', cls: 'bg-[#D4F542] text-[#0F1419]' },
    in_review: { label: 'En cours', cls: 'bg-amber-50 text-amber-800' },
    pending: { label: 'En attente', cls: 'bg-[#0F1419]/[0.06] text-[#0F1419]/55' },
    rejected: { label: 'Refusé', cls: 'bg-red-50 text-red-700' },
    expired: { label: 'Expiré', cls: 'bg-red-50 text-red-700' },
  }
  const { label, cls } = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-mono uppercase tracking-[0.06em] px-2 py-0.5 rounded-full font-semibold',
        cls,
      )}
    >
      {label}
    </span>
  )
}

function labelMethod(method: string): string {
  switch (method) {
    case 'france_connect':
      return 'FranceConnect'
    case 'kyc_scan_cni':
      return 'Scan CNI + liveness'
    case 'yousign_qualified':
      return 'Signature Yousign qualifiée'
    default:
      return method
  }
}

function labelCheckType(type: string): string {
  const map: Record<string, string> = {
    identity_initial: 'Vérification identité',
    cofrac_initial: 'Vérification COFRAC',
    cofrac_recurring: 'Recheck COFRAC',
    rcpro_initial: 'Vérification RC Pro',
    rcpro_renewal_alert: 'Alerte renouvellement RC Pro',
    sirene_initial: 'Vérification SIRENE',
    sirene_annual: 'Recheck SIRENE annuel',
    signalement: 'Signalement particulier',
    manual_audit: 'Audit manuel admin',
  }
  return map[type] ?? type
}
