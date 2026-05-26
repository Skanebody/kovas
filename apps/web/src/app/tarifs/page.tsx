/**
 * /tarifs — refonte chrome V5 sobre Synthex/Quora (Lot B70, 2026-05-26).
 *
 * Adopte le chrome de la home `/` :
 *   - <PublicHeader /> + <SiteFooter /> partagés
 *   - bg-sage #F5F7F4 + navy #0F1419 + chartreuse #D4F542 sur CTA/badges accent
 *   - cards rounded-2xl border 0.08 bg-paper (au lieu de grid border pleine)
 *   - sections px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]
 *   - hero clamp(40px, 7vw, 104px) + mot-clé serif italic
 *   - vouvoiement strict
 *
 * Préserve intacts (B43 / B67 / B68) :
 *   - data 4 tiers Logiciel + 3 tiers Annuaire + 5 Bundles + Add-ons + Loyalty
 *   - composant client TarifsTabs (3 onglets sticky useSearchParams + Suspense)
 *   - JSON-LD BreadcrumbList + ItemList
 *   - metadata SEO buildMetadata
 *   - Enterprise card en bas du panel Logiciel
 *   - <GlossaryTerm> du glossaire express
 *   - maillage interne final (4 liens + lien contact)
 *
 * Montants pricing canoniques V5 (NE PAS modifier) :
 *   Logiciel : 29 / 79 / 199 / 499 €
 *   Annuaire : 19 / 39 / 79 €
 *   Bundles  : 39 / 99 / 89 / 229 / 529 €
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { ANNUAIRE_PLANS, BUNDLES, LOGICIEL_PLANS } from '@/lib/pricing-plans'
import { buildMetadata } from '@/lib/seo/metadata'
import { buildBreadcrumbList, buildPricingItemListSchema } from '@/lib/seo/schema-org'
import { ArrowRight, CheckCircle2, Flag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { TarifsTabs } from './TarifsTabs'

export const metadata: Metadata = buildMetadata({
  title: 'Tarifs logiciel diagnostic immobilier dès 29€/mois | KOVAS',
  description:
    'Tarifs KOVAS : logiciel SaaS dès 29€/mois (Solo 40 missions), annuaire pro dès 19€/mois, bundles combinés. Essai 30 jours gratuit, satisfait ou remboursé 60 jours.',
  path: '/tarifs',
  // OG image : générée dynamiquement par `opengraph-image.tsx` collocaté (Lot B88).
})

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface Tier {
  name: string
  forWho: string
  promise: string
  price: string
  cap: { count: string; unit: string; overage: string }
  features: string[]
  highlighted?: boolean
  badge?: string
  cta?: string
  bundleSaving?: string
}

/* ────────────────────────────────────────────────────────────────────────── */
/* LOGICIEL — 4 tiers + Enterprise                                             */
/* ────────────────────────────────────────────────────────────────────────── */

const LOGICIEL_TIERS: Tier[] = [
  {
    name: 'Solo',
    forWho: 'Tu démarres ou tu fais ~10 missions par semaine.',
    promise: 'Gagne 35 minutes sur chaque mission. Zéro mauvaise surprise ADEME.',
    price: '29',
    cap: { count: '40', unit: 'missions / mois', overage: 'puis 0,99€ / mission' },
    features: [
      'Notes vocales transcrites automatiquement',
      'Photos plaques lues automatiquement',
      'Vérification automatique avant ADEME',
      'Mise à jour des normes en continu',
      'Facturation Qonto + Pennylane',
      'Signature électronique légale',
      '1 utilisateur',
    ],
  },
  {
    name: 'Pro',
    forWho: 'Tu travailles à temps plein, 15 à 25 missions par semaine.',
    promise: 'Tout Solo, plus ton tableau de bord pour piloter ton activité.',
    price: '79',
    cap: { count: '100', unit: 'missions / mois', overage: 'puis 0,79€ / mission' },
    features: [
      'Suivi du temps gagné chaque semaine',
      'Tableau de bord (CA, devis, conversion)',
      'Templates de rapports illimités',
      'Facturation conforme 2027 (Factur-X)',
      'Historique complet des biens',
      'Relances impayés automatiques',
      'Réponse support sous 1 jour ouvré',
      '1 invité lecture seule',
    ],
    highlighted: true,
    badge: 'Le plus populaire',
  },
  {
    name: 'Cabinet',
    forWho: 'Tu travailles en équipe de 2 à 5 personnes.',
    promise: 'Pilote ton équipe. Rôles, permissions, dashboards par membre.',
    price: '199',
    cap: { count: '300', unit: 'missions / mois', overage: 'puis 0,59€ / mission' },
    features: [
      'Tout Pro, plus :',
      '5 utilisateurs avec rôles distincts',
      'Workload distribution + planning équipe',
      'Audit trail par membre (qui a fait quoi)',
      'Dashboard manager (productivité, CA par diag)',
      'Alerte si DPE existe déjà sur le bien',
      'Aide à la défense en cas de plainte',
      'Branding cabinet personnalisé',
      'Réponse support sous 4 heures ouvrées',
    ],
  },
  {
    name: 'Cabinet+',
    forWho: 'Tu pilotes 6 à 15 personnes sur un ou plusieurs sites.',
    promise: 'Tout Cabinet, plus multi-site et accompagnement direct fondateur.',
    price: '499',
    cap: { count: '1000', unit: 'missions / mois', overage: 'puis 0,29€ / mission' },
    features: [
      'Tout Cabinet, plus :',
      '15 utilisateurs inclus',
      'Reporting consolidé multi-sites',
      'White-label complet (logo + couleurs)',
      'Vérification renforcée incluse',
      'Échange direct avec Benjamin, le fondateur',
      'Onboarding sur-mesure de ton équipe',
      'Réponse support sous 1 heure ouvrée',
      'Personnalisation avancée du workflow',
    ],
  },
]

/* ────────────────────────────────────────────────────────────────────────── */
/* ANNUAIRE — 3 tiers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const ANNUAIRE_TIERS: Tier[] = [
  {
    name: 'Présence',
    forWho: 'Tu veux que les particuliers de ton département te trouvent.',
    promise: 'Une fiche professionnelle visible 24/7, avec tes vrais avis Google.',
    price: '19',
    cap: { count: 'Visibilité', unit: 'département', overage: '' },
    features: [
      'Fiche publique sur l’annuaire KOVAS',
      'Tes 3 derniers avis Google affichés',
      'Indicateur de disponibilité de la semaine',
      'Statistiques de ta fiche (vues, contacts)',
      'Réception de demandes de devis qualifiés',
      'Tu paies seulement quand un lead t’intéresse',
    ],
  },
  {
    name: 'Boost',
    forWho: 'Tu veux passer devant tes concurrents dans les résultats.',
    promise: 'Top 5 de ton département, badge Vérifié bien visible.',
    price: '39',
    cap: { count: 'Top 5', unit: 'département', overage: '' },
    features: [
      'Tout Présence, plus :',
      'Position prioritaire (top 5 département)',
      '1 commune mise en avant',
      'Badge Vérifié bleu sur ta fiche',
      'Notifications de leads en temps réel',
      '−20% sur ton premier lead du mois',
    ],
    highlighted: true,
    badge: 'Recommandé',
  },
  {
    name: 'Premium',
    forWho: 'Tu veux capturer tout le marché de ta région.',
    promise: 'Visibilité maximale multi-départements, badge Premium doré.',
    price: '79',
    cap: { count: 'Top 3', unit: 'région', overage: '' },
    features: [
      'Tout Boost, plus :',
      'Visibilité multi-départements',
      '3 communes mises en avant',
      'Badge Premium doré',
      '−50% sur tes 3 premiers leads du mois',
      'Promesse de réponse client le jour même',
      'Support prioritaire',
    ],
  },
]

/* ────────────────────────────────────────────────────────────────────────── */
/* BUNDLES — 5 combos (extraits canoniques)                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function formatBundleCents(cents: number): string {
  return Math.round(cents / 100).toString()
}

function bundleByCode(code: string) {
  return BUNDLES.find((b) => b.code === code)
}

const BUNDLE_TIERS: Tier[] = [
  {
    name: 'Démarrage',
    forWho: 'Tu démarres et tu veux te faire connaître.',
    promise: 'Le logiciel + la fiche publique. Tout pour commencer.',
    price: formatBundleCents(bundleByCode('bundle_solo_starter')?.monthlyPrice ?? 3900),
    cap: { count: 'Solo', unit: '+ Présence', overage: '' },
    features: [
      'Logiciel Solo complet',
      'Annuaire Présence',
      '40 missions / mois',
      'Fiche publique active',
    ],
    bundleSaving: 'Économie −9€ / mois',
  },
  {
    name: 'Croissance',
    forWho: 'Tu es établi et tu veux accélérer.',
    promise: 'Le combo le plus choisi par les diagnostiqueurs en croissance.',
    price: formatBundleCents(bundleByCode('bundle_solo_performance')?.monthlyPrice ?? 9900),
    cap: { count: 'Pro', unit: '+ Boost', overage: '' },
    features: [
      'Logiciel Pro complet',
      'Annuaire Boost',
      '100 missions / mois',
      'Top 5 département + badge Vérifié',
      '1 commune mise en avant',
    ],
    highlighted: true,
    badge: 'Best value',
    bundleSaving: 'Économie −19€ / mois',
  },
  {
    name: 'Acquisition',
    forWho: 'Tu travailles en solo mais tu vises gros sur les leads.',
    promise: 'Pour ceux qui font de l’annuaire leur source n°1 de clients.',
    price: formatBundleCents(bundleByCode('bundle_solo_regional')?.monthlyPrice ?? 8900),
    cap: { count: 'Solo', unit: '+ Premium', overage: '' },
    features: [
      'Logiciel Solo complet',
      'Annuaire Premium',
      '40 missions / mois',
      'Top 3 régional + badge doré',
      '3 communes mises en avant',
    ],
    bundleSaving: 'Économie −19€ / mois',
  },
  {
    name: 'Cabinet',
    forWho: 'Cabinet structuré qui veut dominer son marché.',
    promise: 'L’équipe coordonnée + la visibilité maximale.',
    price: formatBundleCents(bundleByCode('bundle_cabinet_360')?.monthlyPrice ?? 22900),
    cap: { count: 'Cabinet', unit: '+ Premium', overage: '' },
    features: [
      'Logiciel Cabinet complet',
      'Annuaire Premium',
      '300 missions / mois',
      "Jusqu'à 5 utilisateurs",
      'Protection juridique incluse',
    ],
    bundleSaving: 'Économie −49€ / mois',
  },
  {
    name: 'Cabinet+',
    forWho: 'Acteur régional qui veut être incontournable.',
    promise: 'Le tout-en-un, multi-site, avec Benjamin en accompagnement direct.',
    price: formatBundleCents(bundleByCode('bundle_cabinet_national')?.monthlyPrice ?? 52900),
    cap: { count: 'Cabinet+', unit: '+ Premium + 5 villes', overage: '' },
    features: [
      'Logiciel Cabinet+ complet',
      'Annuaire Premium',
      'Mise en avant sur 5 communes',
      '1000 missions / mois',
      '15 utilisateurs inclus',
      'Échange direct fondateur',
    ],
    bundleSaving: 'Économie −99€ / mois',
  },
]

/* ────────────────────────────────────────────────────────────────────────── */
/* TIER CARD — composant atomique partagé (refonte V5 sobre)                   */
/* ────────────────────────────────────────────────────────────────────────── */

function TierCard({ tier }: { tier: Tier }): React.ReactElement {
  const isHighlighted = tier.highlighted === true
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border p-8',
        isHighlighted
          ? 'bg-[#0F1419] text-paper border-[#0F1419]'
          : 'bg-paper text-[#0F1419] border-[#0F1419]/[0.08]',
      ].join(' ')}
    >
      {tier.badge ? (
        <span className="absolute -top-3 left-6 rounded-pill bg-chartreuse text-[#0F1419] px-3 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold">
          {tier.badge}
        </span>
      ) : null}

      <div className={tier.badge ? 'mt-4' : 'mt-0'}>
        <p
          className={[
            'font-mono uppercase tracking-wider text-[11px] font-semibold',
            isHighlighted ? 'text-paper' : 'text-[#0F1419]',
          ].join(' ')}
        >
          {tier.name}
        </p>
        <p
          className={[
            'mt-3 text-[13px] leading-[1.4] min-h-[38px]',
            isHighlighted ? 'text-paper/72' : 'text-[#0F1419]/72',
          ].join(' ')}
        >
          {tier.forWho}
        </p>
        <p
          className={[
            'mt-5 font-serif italic text-[22px] leading-[1.2] min-h-[80px]',
            isHighlighted ? 'text-paper' : 'text-[#0F1419]',
          ].join(' ')}
        >
          {tier.promise}
        </p>
      </div>

      <div className="mt-6">
        <div
          className={[
            'font-serif italic font-normal leading-none tracking-tight',
            isHighlighted ? 'text-paper' : 'text-[#0F1419]',
          ].join(' ')}
          style={{ fontSize: 'clamp(48px, 5vw, 72px)' }}
        >
          <span className="text-[24px] align-top mr-0.5">€</span>
          {tier.price}
        </div>
        <p
          className={[
            'mt-1 text-[13px]',
            isHighlighted ? 'text-paper/72' : 'text-[#0F1419]/55',
          ].join(' ')}
        >
          par mois
        </p>
        <p
          className={[
            'mt-3 font-mono text-[10px] uppercase tracking-wider',
            isHighlighted ? 'text-chartreuse' : 'text-[#0F1419]/55',
          ].join(' ')}
        >
          {(Number.parseFloat(tier.price) * 0.85).toFixed(2)}€ en annuel · −15%
        </p>
      </div>

      <div
        className={[
          'mt-6 py-3 border-t border-b text-[15px] font-medium',
          isHighlighted ? 'border-paper/15' : 'border-[#0F1419]/[0.08]',
        ].join(' ')}
      >
        <span className="font-serif italic font-normal">{tier.cap.count}</span> {tier.cap.unit}
        {tier.cap.overage ? (
          <>
            <br />
            <span
              className={[
                'inline-block mt-1 text-[11px] font-normal',
                isHighlighted ? 'text-paper/72' : 'text-[#0F1419]/55',
              ].join(' ')}
            >
              {tier.cap.overage}
            </span>
          </>
        ) : null}
      </div>

      <ul className="mt-6 flex-grow space-y-0">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 py-2 text-[14px]">
            <CheckCircle2
              className={[
                'size-4 mt-0.5 shrink-0',
                isHighlighted ? 'text-chartreuse' : 'text-chartreuse-deep',
              ].join(' ')}
              aria-hidden
            />
            <span className={['leading-[1.4]', isHighlighted ? 'text-paper' : ''].join(' ')}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {tier.bundleSaving ? (
        <p
          className={[
            'mt-4 font-mono text-[10px] uppercase tracking-wider font-semibold',
            isHighlighted ? 'text-chartreuse' : 'text-chartreuse-deep',
          ].join(' ')}
        >
          {tier.bundleSaving}
        </p>
      ) : null}

      <div className="mt-8">
        <Button asChild variant={isHighlighted ? 'accent' : 'default'} size="lg" className="w-full">
          <Link href="/signup">
            Essai 30 jours
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTIONS PANELS (Logiciel / Annuaire / Bundles)                             */
/* ────────────────────────────────────────────────────────────────────────── */

function LogicielSection(): React.ReactElement {
  return (
    <div className="pt-4">
      <p className="lg:hidden mb-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
        <span className="text-chartreuse-deep font-bold">→ </span>Fais défiler pour comparer
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {LOGICIEL_TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>

      {/* Enterprise card — bg navy plein, chartreuse accent label uniquement */}
      <div className="mt-10 rounded-2xl bg-[#0F1419] text-paper p-10 sm:p-12 grid gap-8 lg:grid-cols-[2fr_1fr] items-center">
        <div>
          <p className="font-mono uppercase tracking-wider text-[11px] font-semibold text-chartreuse">
            Enterprise
          </p>
          <h3
            className="mt-4 font-serif italic font-normal leading-[1.1] text-paper"
            style={{ fontSize: 'clamp(28px, 3vw, 40px)' }}
          >
            Tu pilotes un réseau, une franchise ou plus de 15 utilisateurs ?
          </h3>
          <p className="mt-4 text-[15px] text-paper/72 max-w-[520px] leading-relaxed">
            Pour les structures qui dépassent Cabinet+ (utilisateurs illimités, intégrations
            sur-mesure, contrat-cadre, account manager dédié, SLA personnalisé), nous construisons
            une offre adaptée à ton organisation.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {['Utilisateurs illimités', 'SLA dédié', 'SSO', 'Account manager', 'API étendue'].map(
              (feature) => (
                <span
                  key={feature}
                  className="font-mono text-[10px] uppercase tracking-wider text-paper py-1.5 px-3 rounded-pill border border-paper/15"
                >
                  {feature}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="flex lg:justify-end">
          <Button asChild variant="accent" size="lg">
            <Link href="/contact?subject=enterprise">
              Parlons-en
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function AnnuaireSection(): React.ReactElement {
  return (
    <div className="pt-4">
      <p className="lg:hidden mb-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
        <span className="text-chartreuse-deep font-bold">→ </span>Fais défiler pour comparer
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ANNUAIRE_TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>
    </div>
  )
}

function BundlesSection(): React.ReactElement {
  return (
    <div className="pt-4">
      <p className="lg:hidden mb-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
        <span className="text-chartreuse-deep font-bold">→ </span>Fais défiler pour comparer
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {BUNDLE_TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HERO                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionHero(): React.ReactElement {
  const metas = ['À partir de 29€/mois', 'Compatible Liciel, ORIS, OBBC', 'Support en français']
  return (
    <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
      <div className="max-w-[1240px] mx-auto">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
          Tarifs · 3 onglets canoniques
        </p>
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
          style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
        >
          Le logiciel <span className="font-serif italic font-normal">fait pour toi.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg sm:text-xl text-[#0F1419]/72 leading-relaxed">
          Du diagnostiqueur solo au cabinet structuré, chaque tier est calibré pour ton stade
          d&apos;activité. Essai 30 jours sans engagement, satisfait ou remboursé sous 60 jours.
        </p>
        <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2">
          {metas.map((meta, idx) => (
            <span
              key={meta}
              className="flex items-center gap-2 font-mono text-[12px] tracking-wide text-[#0F1419]/55"
            >
              {idx > 0 ? (
                <span aria-hidden className="text-[#0F1419]/30">
                  ·
                </span>
              ) : null}
              <span>{meta}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTION TABS CONTAINER                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionTabs(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto">
        <div className="mb-12 space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Catalogue tarifaire
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Trois produits,{' '}
            <span className="font-serif italic font-normal">prix transparents.</span>
          </h2>
        </div>
        <Suspense fallback={<LogicielSection />}>
          <TarifsTabs
            logiciel={<LogicielSection />}
            annuaire={<AnnuaireSection />}
            bundles={<BundlesSection />}
          />
        </Suspense>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTION ADD-ONS                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface Addon {
  name: string
  price: string
  priceSub: string
  desc: string
  overage?: boolean
}

const ADDONS: Addon[] = [
  {
    name: 'Utilisateur en plus',
    price: '19',
    priceSub: 'par mois et par user',
    desc: "Ajoute un membre d'équipe au-delà des utilisateurs inclus dans ton plan.",
  },
  {
    name: 'Vérification renforcée',
    price: '39',
    priceSub: 'par mois',
    desc: 'Analyse approfondie sur les dossiers sensibles : ventes en cascade, immeubles classés, biens à fort enjeu litigation.',
  },
  {
    name: 'Au-delà du quota',
    price: '0,99',
    priceSub: 'à 0,29€ par mission selon tier',
    desc: "Pas d'angoisse de quota. Tu travailles sans interruption. Les missions au-delà sont débitées en fin de mois sur la carte enregistrée. Plus ton tier est élevé, moins ça coûte par mission.",
    overage: true,
  },
]

function SectionAddons(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            À combiner avec n&apos;importe quel plan
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Options <span className="font-serif italic font-normal">en plus.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {ADDONS.map((addon) => {
            const isOverage = addon.overage === true
            return (
              <div
                key={addon.name}
                className={[
                  'rounded-2xl border p-8',
                  isOverage
                    ? 'bg-[#0F1419] text-paper border-[#0F1419]'
                    : 'bg-paper text-[#0F1419] border-[#0F1419]/[0.08]',
                ].join(' ')}
              >
                <p
                  className={[
                    'font-mono uppercase tracking-wider text-[11px] font-semibold',
                    isOverage ? 'text-chartreuse' : 'text-[#0F1419]',
                  ].join(' ')}
                >
                  {addon.name}
                </p>
                <div
                  className={[
                    'mt-4 font-serif italic font-normal leading-none',
                    isOverage ? 'text-paper' : 'text-[#0F1419]',
                  ].join(' ')}
                  style={{ fontSize: 'clamp(32px, 3vw, 44px)' }}
                >
                  <span className="text-[18px] align-top mr-0.5">€</span>
                  {addon.price}
                </div>
                <p
                  className={[
                    'text-[12px] mt-1',
                    isOverage ? 'text-paper/72' : 'text-[#0F1419]/55',
                  ].join(' ')}
                >
                  {addon.priceSub}
                </p>
                <p
                  className={[
                    'mt-5 text-[14px] leading-relaxed',
                    isOverage ? 'text-paper/72' : 'text-[#0F1419]/72',
                  ].join(' ')}
                >
                  {addon.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTION LOYALTY                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface LoyaltyItem {
  trigger: string
  discount: string
  desc: string
  special?: boolean
}

const LOYALTY_ITEMS: LoyaltyItem[] = [
  {
    trigger: 'Paiement annuel',
    discount: '−15%',
    desc: "Sur n'importe quel plan, dès la souscription annuelle.",
  },
  {
    trigger: 'Après 12 mois',
    discount: '−5%',
    desc: "Additionnel à l'annuel. Effectif M13. Cumulable.",
  },
  {
    trigger: 'Après 24 mois',
    discount: '−10%',
    desc: 'Additionnel. Effectif M25. Plafonné à −30% total.',
  },
  {
    trigger: 'Partenaire fondateur · 10 places',
    discount: '2000€',
    desc: 'Cabinet pour 3 ans, échange direct fondateur, influence sur la roadmap. Premier semestre 2026 uniquement.',
    special: true,
  },
]

function SectionLoyalty(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Plus tu restes, plus tu économises
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Fidélité <span className="font-serif italic font-normal">progressive.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LOYALTY_ITEMS.map((item) => {
            const isSpecial = item.special === true
            return (
              <div
                key={item.trigger}
                className={[
                  'rounded-2xl border p-7',
                  isSpecial
                    ? 'bg-[#0F1419] text-paper border-[#0F1419]'
                    : 'bg-paper text-[#0F1419] border-[#0F1419]/[0.08]',
                ].join(' ')}
              >
                <p
                  className={[
                    'font-mono text-[11px] uppercase tracking-wider',
                    isSpecial ? 'text-paper/72' : 'text-[#0F1419]/55',
                  ].join(' ')}
                >
                  {item.trigger}
                </p>
                <div
                  className={[
                    'mt-4 font-serif italic font-normal leading-none',
                    isSpecial ? 'text-chartreuse' : 'text-[#0F1419]',
                  ].join(' ')}
                  style={{ fontSize: 'clamp(36px, 3.5vw, 56px)' }}
                >
                  {item.discount}
                </div>
                <p
                  className={[
                    'mt-4 text-[14px] leading-relaxed',
                    isSpecial ? 'text-paper/72' : 'text-[#0F1419]/72',
                  ].join(' ')}
                >
                  {item.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTION ENGAGEMENTS (ex-FOOTER_PROMISES, reskinné V5)                       */
/* ────────────────────────────────────────────────────────────────────────── */

const ENGAGEMENTS: ReadonlyArray<string> = [
  'Essai 30 jours débit auto',
  'Satisfait ou remboursé 60 jours',
  'Résiliation en 2 clics',
  'Pas de hausse de prix la 1ère année',
  'Hébergement France · RGPD',
]

function SectionEngagements(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Nos engagements
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Cinq promesses <span className="font-serif italic font-normal">sans astérisque.</span>
          </h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ENGAGEMENTS.map((promise) => (
            <li
              key={promise}
              className="flex items-start gap-2.5 rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4"
            >
              <CheckCircle2 className="size-3.5 mt-0.5 text-chartreuse-deep shrink-0" aria-hidden />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/72 leading-relaxed">
                {promise}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTION GLOSSAIRE EXPRESS (B67 — préservé, reskinné V5)                     */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionGlossary(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[920px] mx-auto space-y-5">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
          Glossaire express
        </p>
        <p className="text-[15px] sm:text-base leading-relaxed text-[#0F1419]/80">
          Les forfaits intègrent <GlossaryTerm term="Factur-X">Factur-X</GlossaryTerm> conforme
          2027, les calculs <GlossaryTerm term="Carrez" /> / <GlossaryTerm term="Boutin" /> en
          location, la rédaction d&apos;
          <GlossaryTerm term="ERP" /> à jour Géorisques, la détection des{' '}
          <GlossaryTerm term="passoire-thermique">passoires thermiques</GlossaryTerm> F-G et
          l&apos;alerte si un <GlossaryTerm term="DPE" /> existe déjà sur le bien. Survole chaque
          terme souligné pour la définition officielle.
        </p>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTION MAILLAGE INTERNE (préservé, reskinné V5)                            */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionInternalLinks(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-16 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto flex flex-col gap-6 items-center text-center">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
          <li>
            <Link href="/aide" className="hover:text-[#0F1419] transition-colors">
              Centre d&apos;aide
            </Link>
          </li>
          <li aria-hidden>·</li>
          <li>
            <Link href="/comparatif" className="hover:text-[#0F1419] transition-colors">
              Comparatif Liciel
            </Link>
          </li>
          <li aria-hidden>·</li>
          <li>
            <Link href="/observatoire" className="hover:text-[#0F1419] transition-colors">
              Observatoire DPE
            </Link>
          </li>
          <li aria-hidden>·</li>
          <li>
            <Link href="/temoignages" className="hover:text-[#0F1419] transition-colors">
              Témoignages
            </Link>
          </li>
        </ul>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55 hover:text-[#0F1419] transition-colors"
        >
          <Flag className="size-3" aria-hidden />
          Une question sur la tarification ?
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PAGE                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export default function TarifsPage(): React.ReactElement {
  const breadcrumb = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'Tarifs', path: '/tarifs' },
  ])
  const pricingItemList = buildPricingItemListSchema({
    logicielPlans: LOGICIEL_PLANS.filter((p) => p.monthlyPrice > 0),
    annuairePlans: ANNUAIRE_PLANS.filter((p) => p.monthlyPrice > 0),
    bundles: BUNDLES,
  })

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <JsonLd data={[breadcrumb, pricingItemList]} id="tarifs" />
      <PublicHeader />
      <main className="flex-1">
        <SectionHero />
        <SectionTabs />
        <SectionAddons />
        <SectionLoyalty />
        <SectionEngagements />
        <SectionGlossary />
        <SectionInternalLinks />
      </main>
      <SiteFooter />
    </div>
  )
}
