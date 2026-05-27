import { Button } from '@/components/ui/button'
import { createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2, FileCheck2, ShieldCheck, UserCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CofracResubmitForm } from '../_forms/cofrac-resubmit-form'
import { IdentityResubmitForm } from '../_forms/identity-resubmit-form'
import { RcproResubmitForm } from '../_forms/rcpro-resubmit-form'
import { SireneResubmitForm } from '../_forms/sirene-resubmit-form'

const PHASES = ['identity', 'cofrac', 'rcpro', 'sirene'] as const
type Phase = (typeof PHASES)[number]

function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value)
}

const PHASE_META: Record<Phase, { title: string; description: string; icon: React.ReactNode }> = {
  identity: {
    title: 'Identité civile',
    description:
      'Mets à jour les pièces justificatives ou change de méthode. Tu peux choisir FranceConnect (instantané), un scan CNI + vérification du visage, ou une signature Yousign qualifiée.',
    icon: <UserCheck className="size-5" />,
  },
  cofrac: {
    title: 'Certification COFRAC',
    description:
      'Re-téléverse un certificat à jour et corrige le numéro / organisme si nécessaire. La vérification automatique sera relancée.',
    icon: <FileCheck2 className="size-5" />,
  },
  rcpro: {
    title: 'Assurance RC Pro',
    description:
      "Téléverse une attestation à jour. Les données seront extraites automatiquement (compagnie, échéance, montants). Tu valides l'exactitude avant envoi.",
    icon: <ShieldCheck className="size-5" />,
  },
  sirene: {
    title: 'Entreprise SIRENE',
    description:
      "Corrige ton numéro SIRET et relance la vérification auprès de l'INSEE Sirene.",
    icon: <Building2 className="size-5" />,
  },
}

interface VerificationStatus {
  diagnostician_id: string
  identity_status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'
  identity_method: 'france_connect' | 'kyc_scan_cni' | 'yousign_qualified' | null
  identity_rejection_reason: string | null
  cofrac_status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'
  cofrac_number: string | null
  cofrac_certifying_body: string | null
  cofrac_rejection_reason: string | null
  rcpro_status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'
  rcpro_insurer: string | null
  rcpro_policy_number: string | null
  rcpro_valid_until: string | null
  rcpro_amount_per_claim_eur: number | null
  rcpro_amount_per_year_eur: number | null
  rcpro_rejection_reason: string | null
  sirene_status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'
  sirene_siret: string | null
  sirene_company_name: string | null
  sirene_legal_form: string | null
  sirene_ape_code: string | null
  sirene_director_name: string | null
  sirene_rejection_reason: string | null
}

interface PageProps {
  params: Promise<{ phase: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { phase } = await params
  const title = isPhase(phase) ? PHASE_META[phase].title : 'Phase inconnue'
  return {
    title: `Re-soumettre — ${title} — KOVAS`,
    robots: { index: false, follow: false },
  }
}

async function loadStatus(): Promise<VerificationStatus | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClientLoose()
  const { data: diag } = await admin
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()
  if (!diag?.id) return null

  const { data: statusRow } = await admin
    .from('diagnostician_verification_status')
    .select('*')
    .eq('diagnostician_id', diag.id)
    .maybeSingle()

  return (statusRow as VerificationStatus | null) ?? null
}

export default async function ResubmitPhasePage({ params }: PageProps) {
  const { phase } = await params

  if (!isPhase(phase)) {
    notFound()
  }

  const status = await loadStatus()
  if (!status) {
    redirect('/login?redirect=/dashboard/account/verification')
  }

  const meta = PHASE_META[phase]

  return (
    <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-[#0F1419]/70">
          <Link href="/dashboard/account/verification">
            <ArrowLeft className="size-3.5" />
            Retour à la validation
          </Link>
        </Button>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Mon compte · Validation · Re-soumission
        </p>
        <div className="flex items-start gap-3">
          <span className="mt-1 text-[#0F1419]">{meta.icon}</span>
          <div className="space-y-1">
            <h1 className="font-serif italic text-3xl sm:text-4xl text-[#0F1419] leading-tight">
              {meta.title}.
            </h1>
            <p className="text-[14px] text-[#0F1419]/70 leading-relaxed">{meta.description}</p>
          </div>
        </div>
      </header>

      {phase === 'identity' && status.identity_rejection_reason && (
        <RejectionBanner reason={status.identity_rejection_reason} />
      )}
      {phase === 'cofrac' && status.cofrac_rejection_reason && (
        <RejectionBanner reason={status.cofrac_rejection_reason} />
      )}
      {phase === 'rcpro' && status.rcpro_rejection_reason && (
        <RejectionBanner reason={status.rcpro_rejection_reason} />
      )}
      {phase === 'sirene' && status.sirene_rejection_reason && (
        <RejectionBanner reason={status.sirene_rejection_reason} />
      )}

      <section className="rounded-2xl bg-white border border-[#0F1419]/[0.08] p-6">
        {phase === 'identity' && (
          <IdentityResubmitForm currentMethod={status.identity_method} />
        )}
        {phase === 'cofrac' && (
          <CofracResubmitForm
            currentNumber={status.cofrac_number}
            currentBody={status.cofrac_certifying_body}
          />
        )}
        {phase === 'rcpro' && (
          <RcproResubmitForm
            currentInsurer={status.rcpro_insurer}
            currentPolicy={status.rcpro_policy_number}
            currentValidUntil={status.rcpro_valid_until}
            currentAmountPerClaim={status.rcpro_amount_per_claim_eur}
            currentAmountPerYear={status.rcpro_amount_per_year_eur}
          />
        )}
        {phase === 'sirene' && (
          <SireneResubmitForm
            currentSiret={status.sirene_siret}
            currentCompanyName={status.sirene_company_name}
            currentLegalForm={status.sirene_legal_form}
            currentApeCode={status.sirene_ape_code}
            currentDirector={status.sirene_director_name}
          />
        )}
      </section>
    </div>
  )
}

function RejectionBanner({ reason }: { reason: string }) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-900">
      <p className="font-semibold mb-1">Motif du refus précédent</p>
      <p className="text-red-800">{reason}</p>
    </div>
  )
}
