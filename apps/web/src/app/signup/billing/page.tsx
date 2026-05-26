/**
 * /signup/billing — Étape 5 du tunnel signup Tugan v3.0.
 *
 * Lit la recommandation issue du quiz (searchParams `team` / `volume` /
 * `editor` + override optionnel `plan`) puis affiche :
 *   - Récap visuel "Active ton essai 30 jours — Plan X · Y €/mois"
 *   - Bullets garanties (0 € aujourd'hui · 30j essai · annulation 2 clics · 60j SOR)
 *   - Order bump Audit Rétrospectif IA (+99 € one-time, composant client)
 *   - Placeholder Stripe Checkout (wiring réel TUGAN-5)
 *   - CTA "Activer mon essai 30 jours" → /signup?plan=X&audit_retro={true|false}
 *
 * CTA pilote la query-param `audit_retro` selon l'état de la checkbox
 * order bump (composant client). La création du compte + Setup Intent
 * Stripe sont assurés par la route /signup existante (refonte TUGAN-5).
 *
 * Authority : docs Tugan §6 Étape 5 + §11 (order bump).
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { decodeQuizAnswersFromSearchParams, recommendPlan } from '@/lib/signup/qualify-recommend'
import { CheckCircle2, Lock, ShieldCheck, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import { OrderBumpAuditRetro } from './OrderBumpAuditRetro'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Active ton essai 30 jours | KOVAS',
  description:
    'Active ton essai KOVAS 30 jours sans débit aujourd’hui. Annulation libre en 2 clics, garantie satisfait ou remboursé 60 jours après le 1er prélèvement.',
  path: '/signup/billing',
})

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupBillingPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const answers = decodeQuizAnswersFromSearchParams(sp)
  const reco = recommendPlan(answers)

  // Le user peut avoir cliqué "Voir les autres plans" puis revenir ici
  // avec un plan override différent du calculé. On garde la reco pour
  // afficher le ROI mais on respecte le plan choisi pour le CTA / récap.
  const overridePlan = typeof sp.plan === 'string' ? sp.plan : null
  const finalPlanCode = overridePlan ?? reco.planCode
  const finalPlanName = overridePlan ? overridePlan.replace(/_/g, ' ') : reco.planName
  // Si override, on conserve le prix de la reco par défaut (les plans
  // alternatifs viendront du tunnel /tarifs en V2 avec recompute).
  const priceEur = reco.monthlyPriceEur

  const guarantees = [
    {
      icon: Wallet,
      title: 'Aujourd’hui, tu paies 0 €',
      detail: 'La CB est validée (Setup Intent 3DS) mais aucun débit ne part avant J+30.',
    },
    {
      title: '30 jours d’essai complet',
      icon: CheckCircle2,
      detail:
        'Accès intégral à toutes les fonctionnalités. Exports illimités, missions illimitées.',
    },
    {
      title: 'Annulation en 2 clics, sans question',
      icon: ShieldCheck,
      detail: 'Customer Portal Stripe accessible 24/7 depuis ton compte. Aucun call retention.',
    },
    {
      title: '60 jours satisfait ou remboursé après le 1er prélèvement',
      icon: ShieldCheck,
      detail: 'Tu changes d’avis dans les 60 jours après J+30 ? On rembourse intégralement.',
    },
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />
      <main className="flex-1 px-5 sm:px-12 py-12 sm:py-20">
        <div className="max-w-[720px] mx-auto space-y-10 animate-fade-in motion-reduce:animate-none">
          {/* Eyebrow Étape 5/5 */}
          <div className="text-center space-y-3">
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-[#0F1419]/55">
              Étape 5 sur 5 · Activation de ton essai
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
              style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}
            >
              Active ton <span className="font-serif italic font-normal">essai 30 jours</span>.
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#0F1419]/72 max-w-[520px] mx-auto leading-relaxed">
              Une dernière étape avant de capturer ta première mission KOVAS sur le terrain.
            </p>
          </div>

          {/* Récap plan */}
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 sm:px-7 py-6 sm:py-7 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wider text-[10px] sm:text-[11px] text-[#0F1419]/55">
                  Plan sélectionné
                </p>
                <p
                  className="font-sans font-semibold text-[#0F1419] leading-tight capitalize"
                  style={{ fontSize: 'clamp(22px, 2.6vw, 28px)' }}
                >
                  {finalPlanName}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono uppercase tracking-wider text-[10px] sm:text-[11px] text-[#0F1419]/55">
                  Tarif après essai
                </p>
                <div className="flex items-baseline justify-end gap-1.5">
                  <span
                    className="font-serif italic font-normal text-[#0F1419] leading-none"
                    style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}
                  >
                    {priceEur} €
                  </span>
                  <span className="text-[12px] text-[#0F1419]/55 font-mono">HT / mois</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-[#0F1419]/55 leading-relaxed border-t border-[#0F1419]/10 pt-3">
              Au-delà du 30<sup>e</sup> jour, prélèvement automatique de {priceEur} € HT/mois
              jusqu’à résiliation. Tu peux annuler à tout moment depuis ton compte (Customer Portal
              Stripe, 24/7).
            </p>
          </div>

          {/* Garanties */}
          <div className="space-y-3">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Tes garanties
            </p>
            <ul className="space-y-3">
              {guarantees.map((g) => {
                const Icon = g.icon
                return (
                  <li
                    key={g.title}
                    className="flex items-start gap-3 rounded-xl border border-[#0F1419]/[0.06] bg-paper px-4 py-3"
                  >
                    <Icon className="size-4 text-chartreuse-deep shrink-0 mt-0.5" aria-hidden />
                    <div className="space-y-0.5">
                      <p className="text-[14px] font-semibold text-[#0F1419] leading-snug">
                        {g.title}
                      </p>
                      <p className="text-[12.5px] text-[#0F1419]/72 leading-relaxed">{g.detail}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Order bump (composant client) */}
          <OrderBumpAuditRetro planCode={finalPlanCode} planName={finalPlanName} />

          {/* Placeholder Stripe Checkout */}
          {/* TODO TUGAN-5 : remplacer ce placeholder par <StripeCheckoutForm setupIntent /> */}
          <div className="rounded-2xl border-2 border-dashed border-[#0F1419]/15 bg-[#0F1419]/[0.02] px-6 py-7 space-y-3">
            <div className="flex items-center gap-3">
              <Lock className="size-4 text-[#0F1419]/55" aria-hidden />
              <p className="font-mono uppercase tracking-wider text-[10px] sm:text-[11px] font-semibold text-[#0F1419]/72">
                Paiement — étape suivante
              </p>
            </div>
            <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">
              Stripe Checkout · sécurisé · 3DS · paiement en 1 clic. La saisie de ta CB se fera
              après création du compte sur la page suivante. Aucun débit aujourd’hui — la carte sert
              uniquement à activer l’essai (Setup Intent transparent).
            </p>
            <div className="flex items-center gap-2 pt-1">
              {['VISA', 'MASTERCARD', 'CB', 'AMEX', 'SEPA'].map((brand) => (
                <span
                  key={brand}
                  className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/40 border border-[#0F1419]/15 rounded-md px-2 py-1"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>

          {/* Trust footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-6 pt-4 text-[11px] sm:text-[12px] font-mono text-[#0F1419]/55">
            <span className="flex items-center gap-1.5">
              <Lock className="size-3" aria-hidden />
              Sécurisé par Stripe
            </span>
            <span className="hidden sm:inline text-[#0F1419]/20">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3" aria-hidden />
              Données hébergées en France · RGPD
            </span>
            <span className="hidden sm:inline text-[#0F1419]/20">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3" aria-hidden />
              Annulation libre en 2 clics
            </span>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
