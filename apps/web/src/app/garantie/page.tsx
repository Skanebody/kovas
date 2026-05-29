import { RiskReversalRow } from '@/components/decouvrir/RiskReversalRow'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildMetadata } from '@/lib/seo/metadata'
import { buildBreadcrumbList } from '@/lib/seo/schema-org'
import { CalendarCheck, RotateCcw, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildMetadata({
  title: 'Garantie KOVAS — essai 30 jours + satisfait ou remboursé 60 jours',
  description:
    'Teste KOVAS sans risque : 30 jours d’essai sans débit, satisfait ou remboursé 60 jours après le premier prélèvement, résiliation en 2 clics et tes données toujours exportables.',
  path: '/garantie',
})

/** Les 3 piliers temporels de la garantie (l'essai, le SOR, la sortie). */
const PILLARS = [
  {
    icon: CalendarCheck,
    eyebrow: '30 jours',
    title: 'Essai gratuit, sans débit',
    body: "Tu enregistres ta carte à l'inscription (pour vérifier que tu es bien un pro), mais aucun prélèvement n'a lieu avant le 30ᵉ jour. Tu profites de toutes les fonctionnalités de ton offre pendant un mois complet.",
  },
  {
    icon: ShieldCheck,
    eyebrow: '60 jours',
    title: 'Satisfait ou remboursé',
    body: "Après le 1er prélèvement, tu as 60 jours pour changer d'avis. Si KOVAS ne te fait pas gagner de temps, écris à contact@kovas.fr : on te rembourse intégralement, sans justification à fournir.",
  },
  {
    icon: RotateCcw,
    eyebrow: 'À tout moment',
    title: 'Résiliation en 2 clics',
    body: 'Tu résilies depuis ton compte via le portail Stripe, 24h/24, sans appel ni négociation. Aucun engagement de durée, aucun frais de sortie.',
  },
] as const

export default function GarantiePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-cream text-ink font-sans">
      <JsonLd
        id="garantie-breadcrumb"
        data={buildBreadcrumbList([
          { name: 'Accueil', path: '/' },
          { name: 'Garantie', path: '/garantie' },
        ])}
      />
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[820px] mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink/55 mb-5">
            Engagement KOVAS
          </p>
          <h1 className="font-sans font-semibold text-[36px] sm:text-[52px] leading-[1.05] tracking-[-0.025em]">
            Essaie KOVAS <span className="font-serif italic font-normal">sans aucun risque</span>.
          </h1>
          <p className="mt-6 text-[18px] sm:text-[20px] text-ink/72 leading-relaxed max-w-[680px] mx-auto">
            On sait que changer d'outil fait peur quand on enchaîne les missions. Alors on retire le
            risque de ton côté : tu testes, et si ça ne te convient pas, tu pars — ou on te
            rembourse.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup/qualify"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-navy text-cream font-semibold hover:bg-navy/90 transition-colors"
            >
              Démarrer mon essai 30 jours
            </Link>
            <Link
              href="/tarifs"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-ink/15 text-ink font-semibold hover:bg-ink/[0.03] transition-colors"
            >
              Voir les tarifs
            </Link>
          </div>
        </section>

        {/* 3 piliers */}
        <section className="max-w-[1080px] mx-auto px-6 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PILLARS.map((p) => {
              const Icon = p.icon
              return (
                <div
                  key={p.title}
                  className="rounded-2xl border border-ink/[0.08] bg-paper p-6 sm:p-7 space-y-3"
                >
                  <div className="size-11 rounded-full bg-cream-deep/60 border border-ink/[0.08] flex items-center justify-center">
                    <Icon className="size-5 text-ink" aria-hidden />
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ink/55">
                    {p.eyebrow}
                  </p>
                  <h2 className="font-sans font-semibold text-[19px] tracking-tight">{p.title}</h2>
                  <p className="text-[14px] leading-relaxed text-ink/72">{p.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Les 4 garanties détaillées (composant partagé Découvrir) */}
        <section className="max-w-[1080px] mx-auto px-6 pb-14">
          <h2 className="font-sans font-semibold text-[24px] sm:text-[30px] tracking-tight mb-6">
            Tes garanties, en clair
          </h2>
          <RiskReversalRow />
        </section>

        {/* Comment se faire rembourser */}
        <section className="border-t border-rule/60 bg-paper">
          <div className="max-w-[820px] mx-auto px-6 py-14 sm:py-16 space-y-5">
            <h2 className="font-sans font-semibold text-[24px] sm:text-[30px] tracking-tight">
              Comment fonctionne le remboursement ?
            </h2>
            <ol className="space-y-4 text-[15px] leading-relaxed text-ink/80">
              <li className="flex gap-3">
                <span className="font-mono text-ink/45">1.</span>
                <span>
                  Tu écris à{' '}
                  <a href="mailto:contact@kovas.fr" className="text-navy hover:underline">
                    contact@kovas.fr
                  </a>{' '}
                  dans les 60 jours suivant ton 1er prélèvement.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ink/45">2.</span>
                <span>Aucune justification demandée — un simple message suffit.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ink/45">3.</span>
                <span>
                  Le remboursement intégral est traité sous 14 jours ouvrés, sur le moyen de
                  paiement d'origine.
                </span>
              </li>
            </ol>
            <p className="text-[13px] text-ink/55 leading-relaxed pt-2">
              Conditions complètes dans nos{' '}
              <Link href="/cgv" className="text-navy hover:underline">
                Conditions Générales de Vente
              </Link>
              . Cette garantie s'applique aux abonnements souscrits directement sur kovas.fr.
            </p>
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-[820px] mx-auto px-6 py-16 text-center">
          <h2 className="font-sans font-semibold text-[26px] sm:text-[34px] tracking-tight leading-snug">
            Le seul risque, c'est de continuer à perdre 3 h par jour.
          </h2>
          <div className="mt-8">
            <Link
              href="/signup/qualify"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-navy text-cream font-semibold hover:bg-navy/90 transition-colors"
            >
              Démarrer mon essai gratuit
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
