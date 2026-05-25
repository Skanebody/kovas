import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { isValidReferralCodeFormat, normalizeReferralCode } from '@/lib/referral/code-generator'
import { KOVAS_TIERS } from '@/lib/stripe-config'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Check } from 'lucide-react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Vous avez été parrainé',
  description: "1 mois offert sur votre abonnement KOVAS, sur invitation d'un confrère.",
}

const REFERRAL_COOKIE = 'kovas_ref_code'
const REFERRAL_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60 // 30 jours

interface PageProps {
  params: Promise<{ code: string }>
}

/**
 * Page publique de landing d'un lien de parrainage.
 *
 * Ton sobre, vouvoiement. Pas d'emoji. Promesse simple : 1 mois offert.
 * Dépose un cookie httpOnly 30j pour porter le code jusqu'au signup.
 */
export default async function ReferralLandingPage({ params }: PageProps) {
  const { code: rawCode } = await params

  if (!isValidReferralCodeFormat(rawCode)) {
    notFound()
  }

  const normalized = normalizeReferralCode(rawCode)
  const supabase = await createClient()

  const { data: codeRow } = await supabase
    .from('referral_codes')
    .select('user_id, active')
    .eq('code', normalized)
    .maybeSingle()

  const row = codeRow as { user_id: string; active: boolean } | null

  if (!row || !row.active) {
    notFound()
  }

  // Lookup nom du parrain (server-side seulement, on n'expose pas l'email)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', row.user_id)
    .maybeSingle()

  const referrerName = (profile as { full_name: string | null } | null)?.full_name ?? 'un confrère'

  // Dépose le cookie pour porter le code jusqu'au signup
  const cookieStore = await cookies()
  cookieStore.set(REFERRAL_COOKIE, normalized, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFERRAL_COOKIE_MAX_AGE_S,
    path: '/',
  })

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24 space-y-12">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute">
            Programme parrainage KOVAS
          </p>
          <h1 className="font-sans font-light text-display-m md:text-display-l tracking-tight text-ink leading-[1.05]">
            Vous avez été parrainé par{' '}
            <span className="font-serif italic font-normal">{referrerName}</span>
            <span className="text-ink-mute">.</span>
          </h1>
          <p className="text-base text-ink-mute max-w-xl mx-auto">
            Profitez de <strong className="text-ink">1 mois offert</strong> sur votre abonnement
            KOVAS, quel que soit le forfait choisi.
          </p>
        </header>

        {/* Avantages */}
        <Card variant="flat" padding="lg" className="space-y-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            Ce que vous obtenez
          </h2>
          <ul className="space-y-3 text-[14px] text-ink">
            <li className="flex items-start gap-3">
              <Check className="size-4 mt-0.5 shrink-0 text-chartreuse-deep" />
              <span>
                <strong>1 mois d'abonnement offert</strong> appliqué automatiquement à votre 1re
                facture.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="size-4 mt-0.5 shrink-0 text-chartreuse-deep" />
              <span>
                30 jours d'essai libre puis le forfait de votre choix (29 € à 499 € HT/mois).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="size-4 mt-0.5 shrink-0 text-chartreuse-deep" />
              <span>Toutes les fonctionnalités KOVAS dès l'inscription, sans engagement.</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="size-4 mt-0.5 shrink-0 text-chartreuse-deep" />
              <span>Données hébergées en France, conformes RGPD, exports universels.</span>
            </li>
          </ul>
        </Card>

        {/* Forfaits récap */}
        <section className="space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute text-center">
            Forfaits disponibles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KOVAS_TIERS.map((t) => (
              <div key={t.id} className="rounded-lg border border-rule/70 bg-paper p-5 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                  {t.label}
                </div>
                <div className="text-2xl font-extrabold tracking-tight text-ink">
                  {(t.priceMonthlyCents / 100).toFixed(0)} €
                  <span className="text-[12px] font-normal text-ink-mute"> HT / mois</span>
                </div>
                <p className="text-[12px] text-ink-mute">
                  {t.missionsIncluded} missions incluses · {t.storageGb} Go
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <Button asChild size="lg" variant="accent">
            <Link href={`/signup?ref=${normalized}`}>
              Démarrer mon essai
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            Code appliqué automatiquement : {normalized}
          </p>
        </div>

        {/* Mention RGPD */}
        <footer className="pt-8 border-t border-rule/40 text-[11px] text-ink-faint text-center space-y-2 leading-relaxed">
          <p>
            Programme conforme à l'article L121-21 du Code de la consommation. Le bonus parrainage
            est attribué après le 1er paiement effectif de votre abonnement.
          </p>
          <p>
            En cliquant sur « Démarrer mon essai », vous acceptez le dépôt d'un cookie technique de
            suivi du parrainage. Voir notre{' '}
            <Link href="/confidentialite" className="underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  )
}
