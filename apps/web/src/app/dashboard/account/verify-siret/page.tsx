import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { VerifySiretForm } from './verify-siret-form'

export const metadata: Metadata = { title: 'Activer mon compte · SIRET' }

/**
 * Écran SIRET post-paiement (funnel sans friction).
 *
 * Affiché lorsque la CB est enregistrée mais que l'organisation n'a pas encore
 * de SIRET vérifié (cf. `siret-guard`). Tant que le SIRET n'est pas validé,
 * le reste du dashboard reste verrouillé.
 */
export default async function VerifySiretPage() {
  const { orgId, supabase } = await getCurrentUser()

  // Si le SIRET est déjà renseigné, cette page n'a pas lieu d'être.
  if (orgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('siret')
      .eq('id', orgId)
      .maybeSingle()
    if (org?.siret) redirect('/dashboard/dashboard')
  }

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <Card variant="opaque" padding="default" className="space-y-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="size-11 shrink-0 rounded-xl bg-[#0F1419] text-[#D4F542] flex items-center justify-center"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-sans text-[20px] font-semibold leading-tight text-[#0F1419]">
              Dernière étape : ton SIRET
            </h1>
            <p className="mt-1 text-[13px] text-[#0F1419]/65 leading-relaxed">
              Ton paiement est bien enregistré. Renseigne le SIRET de ton cabinet pour activer ton
              compte — on le vérifie au registre SIRENE (officiel). C’est requis une seule fois.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#0F1419]/[0.08]">
          <VerifySiretForm />
        </div>

        <p className="text-[11px] text-[#0F1419]/50 leading-snug">
          Un souci avec ton SIRET ? Écris à{' '}
          <a href="mailto:contact@kovas.fr" className="underline underline-offset-2">
            contact@kovas.fr
          </a>
          .
        </p>
      </Card>
    </div>
  )
}
