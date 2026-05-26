/**
 * /signup/welcome — Étape 6 du tunnel signup Tugan v3.0.
 *
 * Page de bienvenue post-engagement (CB enregistrée à l'étape billing).
 * Pattern Tugan : les bonus sont *révélés* UNE FOIS l'engagement pris,
 * jamais avant. Ici on dévoile :
 *   - 3 bonus inclus dans l'essai (templates, audit IA, webinar)
 *   - Preview des 4 étapes onboarding (TTFV < 5 min)
 *   - CTA principal vers /dashboard/dashboard (entry app authentifiée)
 *
 * Si searchParams.audit_retro=true : encadré bonus supplémentaire "Audit
 * Rétrospectif en cours · rapport sous 24h".
 *
 * Ton SOBRE PROFESSIONNEL (avatar 43 ans ex-cadre). Pas de gaming, pas
 * de "BOOM", style "bienvenue dans une démarche pro".
 *
 * Authority : docs Tugan §6 Étapes 6-7, CLAUDE.md §3 design system V5.
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { decodeQuizAnswersFromSearchParams, recommendPlan } from '@/lib/signup/qualify-recommend'
import { ArrowRight, CheckCircle2, Clock, Gift, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Ton essai KOVAS est activé · bonus offerts | KOVAS',
  description:
    'Ton essai 30 jours KOVAS est activé. Découvre les bonus inclus et démarre ton onboarding (4 étapes, moins de 5 minutes).',
  path: '/signup/welcome',
})

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Formate une date en FR long ("24 juin 2026"). */
function formatDateFr(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** Bonus révélés post-engagement (pattern Tugan §6 Étape 6). */
const BONUSES = [
  {
    title: 'Pack 10 templates de rapports premium',
    description:
      'Mises en page abouties pour DPE, amiante et plomb. Personnalisables avec ton logo, ton SIRET et ta certification.',
    valueEur: 99,
  },
  {
    title: 'Audit gratuit de tes 3 derniers DPE',
    description:
      'Analyse automatique de cohérence ADEME sur 3 missions récentes. Tu identifies les écarts avant qu’ils ne reviennent en non-conformité.',
    valueEur: 49,
  },
  {
    title: 'Place au webinar mensuel « Tendances ADEME 2026 »',
    description:
      'Décryptage trimestriel des évolutions réglementaires, animé par Benjamin Bel et un advisor diagnostiqueur senior.',
    valueEur: 99,
  },
] as const

const ONBOARDING_STEPS = [
  {
    title: 'Importe ta première mission',
    description:
      'Liciel ZIP, ORIS, OBBC ou mission test fictive si tu préfères explorer sans données réelles.',
  },
  {
    title: 'KOVAS croise 6 sources publiques sur la propriété',
    description:
      'BAN, cadastre, IGN, Géorisques, ADEME, INSEE. Analyse terminée en moins de 8 secondes.',
  },
  {
    title: 'Voilà ton premier gain mesuré',
    description: 'h récupérées chaque mois sur ton volume actuel, chiffrées noir sur blanc.',
  },
  {
    title: 'Ta fiche annuaire est en ligne',
    description:
      'Pré-remplie depuis ton SIRET et ta certification. Visible par les particuliers et les notaires de ton département.',
  },
] as const

export default async function SignupWelcomePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const answers = decodeQuizAnswersFromSearchParams(sp)
  const reco = recommendPlan(answers)

  const auditRetroRaw = typeof sp.audit_retro === 'string' ? sp.audit_retro : ''
  const auditRetroRequested = auditRetroRaw === 'true' || auditRetroRaw === '1'

  // Prochain débit = aujourd'hui + 30 jours.
  const nextChargeDate = new Date()
  nextChargeDate.setDate(nextChargeDate.getDate() + 30)
  const nextChargeFormatted = formatDateFr(nextChargeDate)

  const totalBonusValue = BONUSES.reduce((sum, b) => sum + b.valueEur, 0)

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />
      <main className="flex-1 px-5 sm:px-12 py-16 sm:py-24">
        <div className="max-w-[760px] mx-auto space-y-14 animate-fade-in motion-reduce:animate-none">
          {/* Header victoire */}
          <div className="text-center space-y-5">
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-[#0F1419]/55">
              Étape 6 sur 7 · Essai activé
            </p>
            <div className="flex justify-center">
              <div className="relative inline-flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full bg-chartreuse/40 blur-2xl"
                  aria-hidden
                />
                <CheckCircle2
                  className="relative size-16 sm:size-[72px] text-chartreuse-deep"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
            </div>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
              style={{ fontSize: 'clamp(36px, 5.5vw, 64px)' }}
            >
              Ton essai est <span className="font-serif italic font-normal">activé</span>.
            </h1>
            <p className="text-[15px] sm:text-[16px] text-[#0F1419]/72 max-w-[560px] mx-auto leading-relaxed">
              Plan <span className="font-semibold text-[#0F1419]">{reco.planName}</span> ·{' '}
              <span className="font-semibold text-[#0F1419]">{reco.monthlyPriceEur} €/mois</span>{' '}
              après 30 jours. Prochain débit le{' '}
              <span className="font-semibold text-[#0F1419]">{nextChargeFormatted}</span>.
            </p>
          </div>

          {/* Audit rétrospectif (conditionnel) */}
          {auditRetroRequested ? (
            <div className="rounded-2xl border border-chartreuse-deep/30 bg-chartreuse/12 px-6 sm:px-7 py-6 flex items-start gap-4">
              <div className="shrink-0 mt-0.5">
                <Gift className="size-6 text-chartreuse-deep" aria-hidden />
              </div>
              <div className="space-y-1.5">
                <p className="font-mono uppercase tracking-wider text-[11px] font-semibold text-chartreuse-deep">
                  Audit rétrospectif en cours
                </p>
                <p className="text-[14px] sm:text-[15px] text-[#0F1419]/82 leading-relaxed">
                  Tu reçois ton rapport complet sous 24h par email. Pendant ce temps, commence ton
                  onboarding — tu gagneras du temps quand l’audit arrivera.
                </p>
              </div>
            </div>
          ) : null}

          {/* Bonus reveal */}
          <section className="space-y-6">
            <div className="space-y-2">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Bonus inclus dans ton essai
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-tight"
                style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}
              >
                Trois bonus qu’on garde pour ce moment précis.
              </h2>
              <p className="text-[14px] text-[#0F1419]/65 leading-relaxed max-w-[600px]">
                Ils ne sont pas affichés sur la page tarifs — réservés à ceux qui activent leur
                essai. Tu les retrouves dans ton tableau de bord dès la première connexion.
              </p>
            </div>

            <ul className="space-y-3">
              {BONUSES.map((bonus, index) => (
                <li
                  key={bonus.title}
                  className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 sm:px-7 py-5 flex items-start gap-4"
                >
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/45">
                      Bonus
                    </span>
                    <span className="font-serif italic text-[28px] leading-none text-chartreuse-deep">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <h3 className="text-[15px] sm:text-[16px] font-semibold text-[#0F1419] leading-snug">
                        {bonus.title}
                      </h3>
                      <span className="font-mono text-[12px] text-[#0F1419]/55 whitespace-nowrap">
                        Valeur {bonus.valueEur} €
                      </span>
                    </div>
                    <p className="text-[13.5px] text-[#0F1419]/72 leading-relaxed">
                      {bonus.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-[#0F1419] text-paper px-6 sm:px-7 py-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-chartreuse" aria-hidden />
                <p className="font-mono uppercase tracking-wider text-[11px] text-paper/72">
                  Total bonus inclus dans ton essai
                </p>
              </div>
              <p
                className="font-serif italic font-normal text-chartreuse leading-none"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}
              >
                {totalBonusValue} €
              </p>
            </div>
          </section>

          {/* Onboarding preview */}
          <section className="space-y-6">
            <div className="space-y-2">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Onboarding · 4 étapes · moins de 5 minutes
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-tight"
                style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}
              >
                Maintenant, on commence ton onboarding ?
              </h2>
              <p className="text-[14px] text-[#0F1419]/65 leading-relaxed max-w-[600px]">
                Tu vois ton premier gain mesuré avant la fin du parcours. Pas de tutoriel
                interminable — on entre directement dans le concret.
              </p>
            </div>

            <ol className="space-y-3">
              {ONBOARDING_STEPS.map((step, index) => {
                const isGainStep = index === 2
                return (
                  <li
                    key={step.title}
                    className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 sm:px-7 py-5 flex items-start gap-5"
                  >
                    <div className="shrink-0 size-9 rounded-full bg-[#0F1419] text-paper flex items-center justify-center font-mono text-[13px] font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-[15px] sm:text-[16px] font-semibold text-[#0F1419] leading-snug">
                        {step.title}
                      </h3>
                      <p className="text-[13.5px] text-[#0F1419]/72 leading-relaxed">
                        {isGainStep ? (
                          <>
                            <span className="font-serif italic text-chartreuse-deep text-[18px] font-normal align-baseline">
                              {reco.hoursSavedPerMonth} h
                            </span>{' '}
                            {step.description}
                          </>
                        ) : (
                          step.description
                        )}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* CTA principal */}
          <div className="space-y-3 pt-2">
            <Button asChild variant="accent" size="lg" className="w-full justify-center">
              <Link href="/dashboard/dashboard">
                Configurer mon compte
                <span className="font-mono text-[12px] opacity-70 ml-1">· 4 min</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <p className="flex items-center justify-center gap-2 text-[11px] font-mono text-[#0F1419]/45">
              <Clock className="size-3" aria-hidden />
              Tu peux interrompre l’onboarding à tout moment, ton compte est déjà actif.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
