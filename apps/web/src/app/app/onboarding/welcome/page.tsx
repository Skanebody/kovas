import { Button } from '@/components/ui/button'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: "Bienvenue" }

/**
 * Onboarding étape 1/4 — Welcome (wireframe v4 §2.1).
 * Drama cyan liquide, full-screen, serif italic 64px, 2 CTAs.
 */
export default async function OnboardingWelcomePage() {
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? ''

  return (
    <div className="-mx-4 md:-mx-8 -mt-4 min-h-[80vh] bg-fluid-cyan flex flex-col items-center justify-center px-6 py-12 animate-fade-in">
      <div className="max-w-xl w-full space-y-8 text-center">
        {/* Logo K animé */}
        <div className="flex justify-center">
          <div
            aria-hidden
            className="size-16 rounded-2xl bg-paper shadow-glass flex items-center justify-center text-navy-900 font-bold text-2xl"
          >
            K
          </div>
        </div>

        {/* Titre hero serif italic */}
        <div className="space-y-4">
          <h1 className="font-serif italic font-normal text-5xl md:text-6xl tracking-tight text-paper leading-[1.05]">
            Bienvenue {firstName}.
          </h1>
          <p className="text-lg md:text-xl text-paper/90 leading-relaxed max-w-md mx-auto">
            On va configurer votre KOVAS en 90 secondes.
          </p>
          <p className="text-base text-paper/75 max-w-md mx-auto">
            4 étapes simples pour une première mission prête dès aujourd'hui.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/app/onboarding/certifications">
              C&apos;est parti <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="text-paper hover:bg-paper/10">
            <Link href="/app/dashboard">Passer cette étape</Link>
          </Button>
        </div>

        {/* Indicateur progression */}
        <div className="pt-6 flex justify-center">
          <OnboardingProgress current={1} total={4} className="bg-paper/15 px-4 py-2 rounded-pill" />
        </div>
      </div>
    </div>
  )
}
