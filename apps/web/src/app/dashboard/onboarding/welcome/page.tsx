import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Bienvenue' }

/**
 * Onboarding étape 1/4 — Welcome (refonte V5 sobre).
 * Plus de drama cyan : layout sobre sur fond sage, titre AppPageHeader,
 * card flat pour la suite. Tutoiement.
 */
export default async function OnboardingWelcomePage() {
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? ''

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-6">
      <div className="flex items-center justify-between">
        <div
          aria-hidden
          className="size-12 rounded-2xl bg-[#0F1419] text-[#D4F542] flex items-center justify-center font-bold text-xl"
        >
          K
        </div>
        <OnboardingProgress current={1} total={4} />
      </div>

      <AppPageHeader
        title={firstName ? `Bienvenue ${firstName}` : 'Bienvenue'}
        accent={firstName ? '' : 'sur KOVAS'}
        description="On va configurer ton KOVAS en 90 secondes. 4 étapes simples pour une première mission prête dès aujourd'hui."
      />

      <Card variant="flat" padding="lg">
        <CardContent className="pt-2 space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-[#0F1419]/72 leading-relaxed">Tu vas successivement :</p>
            <ol className="space-y-2 text-sm text-[#0F1419]/82 list-decimal pl-5">
              <li>Renseigner tes certifications COFRAC (pour les alertes d'expiration).</li>
              <li>Importer ou choisir tes modèles de rapport.</li>
              <li>Créer ton premier dossier (90 secondes chrono).</li>
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#0F1419]/[0.08]">
            <Button asChild size="lg">
              <Link href="/dashboard/onboarding/certifications">
                C&apos;est parti <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard/dashboard">Passer cette étape</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
