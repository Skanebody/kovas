import { Button } from '@/components/ui/button'
import { createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'

type PhaseStatus = 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'

interface VerificationStatusRow {
  identity_status: PhaseStatus
  cofrac_status: PhaseStatus
  rcpro_status: PhaseStatus
  sirene_status: PhaseStatus
  overall_status: 'pending' | 'verified' | 'rejected' | 'expired'
}

const PHASE_LABELS: Record<keyof Omit<VerificationStatusRow, 'overall_status'>, string> = {
  identity_status: 'Identité civile',
  cofrac_status: 'Certification COFRAC',
  rcpro_status: 'Assurance RC Pro',
  sirene_status: 'Entreprise SIRENE',
}

async function loadStatus(): Promise<VerificationStatusRow | null> {
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
  if (!diag?.id) return null

  const { data: status } = await adminLoose
    .from('diagnostician_verification_status')
    .select('identity_status, cofrac_status, rcpro_status, sirene_status, overall_status')
    .eq('diagnostician_id', diag.id)
    .maybeSingle()

  return (status as VerificationStatusRow | null) ?? null
}

export async function Step7Confirmation() {
  const status = await loadStatus()

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="size-14 rounded-full bg-[#D4F542] text-[#0F1419] inline-flex items-center justify-center text-2xl font-bold mx-auto">
          ✓
        </div>
        <h1 className="font-serif italic text-3xl sm:text-4xl text-[#0F1419] leading-tight">
          Votre compte est créé.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70 max-w-md mx-auto">
          Nous vérifions vos documents (24-48 h moyen). Pendant ce temps, configurez votre compte,
          importez vos contacts, paramétrez votre agenda.{' '}
          <strong className="text-[#0F1419]">
            Dès validation, votre profil apparaîtra dans l&apos;annuaire public
          </strong>{' '}
          et vous pourrez recevoir des leads du calculateur DPE gratuit.
        </p>
      </div>

      <div className="rounded-2xl border border-[#0F1419]/[0.08] divide-y divide-[#0F1419]/[0.06]">
        {(['identity_status', 'cofrac_status', 'rcpro_status', 'sirene_status'] as const).map(
          (key) => (
            <PhaseRow key={key} label={PHASE_LABELS[key]} status={status?.[key] ?? 'pending'} />
          ),
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/dashboard">Aller au dashboard</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/dashboard/account/verification">Voir la file de validation</Link>
        </Button>
      </div>

      <p className="text-center text-[12px] text-[#0F1419]/55">
        Vous recevrez un email à T+12h et T+48h pour suivre l&apos;avancement de la validation.
      </p>
    </div>
  )
}

function PhaseRow({ label, status }: { label: string; status: PhaseStatus }) {
  const isVerified = status === 'verified'
  const isReview = status === 'in_review'
  const isRejected = status === 'rejected' || status === 'expired'

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-[14px] text-[#0F1419] font-medium">{label}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.06em] px-2.5 py-1 rounded-full font-semibold',
          isVerified && 'bg-[#D4F542] text-[#0F1419]',
          isReview && 'bg-amber-50 text-amber-800',
          !isVerified && !isReview && !isRejected && 'bg-[#0F1419]/[0.06] text-[#0F1419]/55',
          isRejected && 'bg-red-50 text-red-700',
        )}
      >
        {isVerified && <CheckCircle2 className="size-3.5" />}
        {isReview && <Clock className="size-3.5" />}
        {isVerified
          ? 'Vérifié'
          : isReview
            ? 'En cours'
            : isRejected
              ? status === 'expired'
                ? 'Expiré'
                : 'À reprendre'
              : 'En attente'}
      </span>
    </div>
  )
}
