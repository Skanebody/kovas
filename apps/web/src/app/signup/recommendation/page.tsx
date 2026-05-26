/**
 * /signup/recommendation — Étape 3 du tunnel signup Tugan v3.0.
 *
 * Lit les réponses du quiz dans les searchParams et affiche une
 * recommandation de plan personnalisée chiffrée :
 *   - Plan optimal (Solo / Pro / Cabinet / Cabinet+)
 *   - Heures gagnées / mois (calcul 35 min × volume)
 *   - Revenue potentiel additionnel (heures × tarif horaire)
 *   - ROI multiple (revenue / abonnement)
 *
 * CTA principal : "Démarrer mon essai 30 jours" → /signup?plan=X
 * CTA secondaire : "Voir les autres plans" → /tarifs
 *
 * Authority : docs Tugan §6 Étape 3.
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { decodeQuizAnswersFromSearchParams, recommendPlan } from '@/lib/signup/qualify-recommend'
import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Ta recommandation KOVAS personnalisée | KOVAS',
  description:
    'Recommandation de plan KOVAS personnalisée selon ton volume mensuel et ta taille d’équipe. Démarre ton essai 30 jours gratuit en 1 clic.',
  path: '/signup/recommendation',
})

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupRecommendationPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const answers = decodeQuizAnswersFromSearchParams(sp)
  const reco = recommendPlan(answers)

  const benefits = [
    `${reco.missionsCap} missions incluses chaque mois`,
    `Surplus à ${reco.overagePriceEur.toFixed(2).replace('.', ',')} €/mission au-delà`,
    'Saisie vocale terrain + photos géolocalisées',
    'Pré-vérification ADEME (Cross-Check 6 sources)',
    'Exports universels (PDF, Word, CSV, ZIP Liciel)',
    'Mode offline complet (zone blanche / sous-sol)',
    '30 jours essai gratuit · résiliation libre',
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />
      <main className="flex-1 px-5 sm:px-12 py-16 sm:py-24">
        <div className="max-w-[720px] mx-auto space-y-12 animate-fade-in motion-reduce:animate-none">
          {/* Eyebrow + verdict */}
          <div className="text-center space-y-4">
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-[#0F1419]/55">
              Étape 3 sur 5 · Ta recommandation
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-chartreuse/30 border border-chartreuse-deep/40 px-4 py-1.5">
              <CheckCircle2 className="size-4 text-chartreuse-deep" aria-hidden />
              <span className="font-mono uppercase tracking-wider text-[11px] font-semibold text-[#0F1419]">
                Plan recommandé pour toi
              </span>
            </div>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)' }}
            >
              {reco.planName}
            </h1>
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="font-serif italic font-normal text-[#0F1419] leading-none"
                style={{ fontSize: 'clamp(48px, 5vw, 72px)' }}
              >
                {reco.monthlyPriceEur} €
              </span>
              <span className="text-[14px] text-[#0F1419]/55 font-mono">HT / mois</span>
            </div>
          </div>

          {/* Pourquoi cette recommandation */}
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-7 py-7 space-y-3">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Pourquoi ce plan
            </p>
            <p className="text-[14px] text-[#0F1419]/82 leading-relaxed">{reco.rationale}</p>
          </div>

          {/* ROI chiffré */}
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-[#0F1419] text-paper px-7 py-8 space-y-6">
            <p className="font-mono uppercase tracking-wider text-[11px] text-chartreuse">
              À ton volume ({reco.monthlyMissions} missions/mois)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
              <div>
                <p className="font-mono uppercase tracking-wider text-[10px] text-paper/55">
                  Temps gagné
                </p>
                <p
                  className="font-serif italic font-normal text-chartreuse leading-none mt-2"
                  style={{ fontSize: 'clamp(40px, 4.5vw, 56px)' }}
                >
                  {reco.hoursSavedPerMonth} h
                </p>
                <p className="font-mono text-[11px] text-paper/55 mt-1">par mois</p>
              </div>
              <div>
                <p className="font-mono uppercase tracking-wider text-[10px] text-paper/55">
                  CA potentiel
                </p>
                <p
                  className="font-serif italic font-normal text-chartreuse leading-none mt-2"
                  style={{ fontSize: 'clamp(40px, 4.5vw, 56px)' }}
                >
                  {reco.monthlyRevenueUpsideEur.toLocaleString('fr-FR')} €
                </p>
                <p className="font-mono text-[11px] text-paper/55 mt-1">
                  à {reco.hourlyRateEur} €/h facturé
                </p>
              </div>
              <div>
                <p className="font-mono uppercase tracking-wider text-[10px] text-paper/55">ROI</p>
                <p
                  className="font-serif italic font-normal text-chartreuse leading-none mt-2"
                  style={{ fontSize: 'clamp(40px, 4.5vw, 56px)' }}
                >
                  {reco.roiMultiple}×
                </p>
                <p className="font-mono text-[11px] text-paper/55 mt-1">ton abonnement</p>
              </div>
            </div>
            <p className="text-[12px] text-paper/55 leading-relaxed border-t border-paper/15 pt-4">
              Calcul basé sur le gain mesuré de 35 minutes par mission DPE (capture vocale +
              pré-vérification + export). Tarif horaire diagnostiqueur conservateur (
              {reco.hourlyRateEur} €/h). Les chiffres réels sont souvent plus élevés.
            </p>
          </div>

          {/* Bénéfices inclus */}
          <div className="space-y-3">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Ce qui est inclus
            </p>
            <ul className="space-y-2.5">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[14px] text-[#0F1419]/82">
                  <CheckCircle2
                    className="size-4 text-chartreuse-deep shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 pt-2">
            <Button asChild variant="accent" size="lg" className="w-full justify-center">
              <Link href={`/signup?plan=${reco.planCode}`}>
                Démarrer mon essai 30 jours · Plan {reco.planName}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <Button asChild variant="ghost" size="default">
                <Link href="/tarifs">Voir les autres plans</Link>
              </Button>
              <span className="text-[#0F1419]/30 hidden sm:inline">·</span>
              <Button asChild variant="ghost" size="default">
                <Link href="/signup/qualify">
                  <RotateCcw className="size-3" aria-hidden />
                  Refaire le quiz
                </Link>
              </Button>
            </div>
            <p className="text-center text-[11px] font-mono text-[#0F1419]/40 mt-2">
              CB requise · débit auto à J+30 · résiliation en 2 clics
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
