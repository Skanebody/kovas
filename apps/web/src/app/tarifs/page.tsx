/**
 * /tarifs — refonte V5 selon mockup canonique 2026-05-25 (Lot B43).
 *
 * Layout sobre Synthex/Quora :
 *   - Hero "Le logiciel fait pour toi"
 *   - 3 onglets sticky (Logiciel / Annuaire / Bundles) via TarifsTabs (client)
 *   - Section Logiciel : grid 4 tiers (Solo/Pro/Cabinet/Cabinet+) + Enterprise card
 *   - Section Annuaire : grid 3 tiers (Présence/Boost/Premium)
 *   - Section Bundles : grid 5 tiers (Démarrage/Croissance/Acquisition/Cabinet/Cabinet+)
 *   - Section Options (3 add-ons : Utilisateur+, Vérif renforcée, Au-delà quota)
 *   - Section Fidélité progressive (4 items)
 *   - Footer 5 promesses
 *
 * Brand V5 strict :
 *   - background sage #F5F7F4
 *   - texte/border navy #0F1419
 *   - chartreuse #D4F542 réservé : badge "Le plus populaire", CTA hover,
 *     bordure tab active, accent Enterprise. JAMAIS sur fond ni texte secondaire.
 *   - Typography : Urbanist (default) + Instrument Serif italic (prix hero + chiffres)
 *     + JetBrains Mono (eyebrows, tags, navigation).
 *
 * Authority : mockup HTML user 2026-05-25.
 */

import { BUNDLES } from '@/lib/pricing-plans'
import { ArrowRight, Check, Flag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { TarifsTabs } from './TarifsTabs'

export const metadata: Metadata = {
  title: 'Tarifs · KOVAS',
  description:
    'KOVAS Logiciel 29/79/199/499€/mo · KOVAS Annuaire 19/39/79€/mo · Bundles combinés. Essai 30 jours, satisfait ou remboursé 60 jours. TVA 20%.',
}

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
/* LOGICIEL — 4 tiers + Enterprise (mockup)                                    */
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
/* ANNUAIRE — 3 tiers (mockup)                                                 */
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
/* BUNDLES — 5 combos (extraits de BUNDLES canonique pour cohérence)           */
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
/* TIER CARD — composant atomique partagé                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function TierCard({ tier }: { tier: Tier }) {
  const isHighlighted = tier.highlighted === true
  return (
    <div
      className={[
        'relative flex flex-col p-8 border-r border-[#0F1419] last:border-r-0',
        isHighlighted ? 'bg-[#0F1419] text-[#F5F7F4]' : 'bg-[#F5F7F4]',
      ].join(' ')}
    >
      {tier.badge ? (
        <div className="absolute -top-px -left-px -right-px bg-[#D4F542] text-[#0F1419] py-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.15em] font-semibold text-center">
          {tier.badge}
        </div>
      ) : null}

      <div className={tier.badge ? 'mt-6' : 'mt-0'}>
        <p
          className={[
            'font-mono uppercase tracking-[0.2em] text-xs font-semibold',
            isHighlighted ? 'text-[#F5F7F4]' : 'text-[#0F1419]',
          ].join(' ')}
        >
          {tier.name}
        </p>
        <p
          className={[
            'mt-3 text-[13px] leading-[1.4] min-h-[38px]',
            isHighlighted ? 'text-[#C7CCD1]' : 'text-[#4A525B]',
          ].join(' ')}
        >
          {tier.forWho}
        </p>
        <p
          className={[
            'mt-5 font-serif italic text-[22px] leading-[1.2] min-h-[80px]',
            isHighlighted ? 'text-[#F5F7F4]' : 'text-[#0F1419]',
          ].join(' ')}
        >
          {tier.promise}
        </p>
      </div>

      <div className="mt-6">
        <div
          className={[
            'font-serif italic text-[64px] leading-none font-normal tracking-tight',
            isHighlighted ? 'text-[#F5F7F4]' : 'text-[#0F1419]',
          ].join(' ')}
        >
          <span className="text-[32px] align-top mr-0.5">€</span>
          {tier.price}
        </div>
        <p
          className={['mt-1 text-[13px]', isHighlighted ? 'text-[#C7CCD1]' : 'text-[#4A525B]'].join(
            ' ',
          )}
        >
          par mois
        </p>
        <p
          className={[
            'mt-3 font-mono text-[10px] uppercase tracking-[0.15em]',
            isHighlighted ? 'text-[#D4F542]' : 'text-[#4A525B]',
          ].join(' ')}
        >
          {(Number.parseFloat(tier.price) * 0.85).toFixed(2)}€ en annuel · −15%
        </p>
      </div>

      <div
        className={[
          'mt-6 py-3 border-t border-b text-[15px] font-medium',
          isHighlighted ? 'border-[#2A3138]' : 'border-[#C7CCD1]',
        ].join(' ')}
      >
        <span className="font-serif italic font-normal">{tier.cap.count}</span> {tier.cap.unit}
        {tier.cap.overage ? (
          <>
            <br />
            <span
              className={[
                'inline-block mt-1 text-[11px] font-normal',
                isHighlighted ? 'text-[#C7CCD1]' : 'text-[#4A525B]',
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
            <Check
              className={[
                'h-3.5 w-3.5 mt-0.5 shrink-0',
                isHighlighted ? 'text-[#D4F542]' : 'text-[#0F1419]',
              ].join(' ')}
              strokeWidth={3}
            />
            <span className="leading-[1.4]">{feature}</span>
          </li>
        ))}
      </ul>

      {tier.bundleSaving ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] font-semibold text-[#16A66B]">
          {tier.bundleSaving}
        </p>
      ) : null}

      <Link
        href="/signup"
        className={[
          'mt-8 inline-flex items-center justify-center py-3.5 px-6 border font-mono uppercase tracking-[0.15em] text-[11px] font-medium transition-colors',
          isHighlighted
            ? 'bg-[#D4F542] text-[#0F1419] border-[#D4F542] hover:bg-[#F5F7F4] hover:border-[#F5F7F4]'
            : 'bg-[#0F1419] text-[#F5F7F4] border-[#0F1419] hover:bg-[#D4F542] hover:text-[#0F1419] hover:border-[#D4F542]',
        ].join(' ')}
      >
        Essai 30 jours
      </Link>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTIONS                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function LogicielSection() {
  return (
    <div className="py-16">
      <p className="lg:hidden mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#4A525B]">
        <span className="text-[#D4F542] font-bold">→ </span>Glisse pour comparer
      </p>
      <div className="overflow-x-auto pb-4">
        <div className="grid border border-[#0F1419] min-w-full grid-cols-[repeat(4,minmax(260px,1fr))]">
          {LOGICIEL_TIERS.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>

      {/* Enterprise card */}
      <div className="mt-12 p-12 bg-[#0F1419] text-[#F5F7F4] grid gap-8 lg:grid-cols-[2fr_1fr] items-center">
        <div>
          <p className="font-mono uppercase tracking-[0.2em] text-xs font-semibold text-[#D4F542]">
            Enterprise
          </p>
          <h3 className="mt-4 font-serif italic text-[36px] leading-[1.1]">
            Tu pilotes un réseau, une franchise ou plus de 15 utilisateurs ?
          </h3>
          <p className="mt-4 text-[15px] text-[#C7CCD1] max-w-[480px]">
            Pour les structures qui dépassent Cabinet+ (utilisateurs illimités, intégrations
            sur-mesure, contrat-cadre, account manager dédié, SLA personnalisé), nous construisons
            une offre adaptée à ton organisation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {['Utilisateurs illimités', 'SLA dédié', 'SSO', 'Account manager', 'API étendue'].map(
              (feature) => (
                <span
                  key={feature}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#F5F7F4] py-1.5 px-3 border border-[#2A3138]"
                >
                  {feature}
                </span>
              ),
            )}
          </div>
        </div>
        <Link
          href="/contact?subject=enterprise"
          className="inline-flex items-center justify-center py-[18px] px-8 bg-[#D4F542] text-[#0F1419] border border-[#D4F542] font-mono uppercase tracking-[0.15em] text-xs font-semibold hover:bg-[#F5F7F4] transition-colors"
        >
          Parlons-en
        </Link>
      </div>
    </div>
  )
}

function AnnuaireSection() {
  return (
    <div className="py-16">
      <p className="lg:hidden mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#4A525B]">
        <span className="text-[#D4F542] font-bold">→ </span>Glisse pour comparer
      </p>
      <div className="overflow-x-auto pb-4">
        <div className="grid border border-[#0F1419] min-w-full grid-cols-[repeat(3,minmax(260px,1fr))]">
          {ANNUAIRE_TIERS.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BundlesSection() {
  return (
    <div className="py-16">
      <p className="lg:hidden mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#4A525B]">
        <span className="text-[#D4F542] font-bold">→ </span>Glisse pour comparer
      </p>
      <div className="overflow-x-auto pb-4">
        <div className="grid border border-[#0F1419] min-w-full grid-cols-[repeat(5,minmax(240px,1fr))]">
          {BUNDLE_TIERS.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SECTIONS GLOBALES : Add-ons + Loyalty + Footer                              */
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

function AddonsSection() {
  return (
    <section className="border-t border-[#0F1419] py-20 lg:py-24">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4A525B]">
            À combiner avec n’importe quel plan
          </p>
          <h2 className="mt-2 text-[28px] md:text-[40px] lg:text-[48px] leading-[1.1] font-light tracking-tight">
            Options <span className="font-serif italic font-normal">en plus</span>
          </h2>
        </div>
      </div>

      <div className="grid border border-[#0F1419] grid-cols-1 lg:grid-cols-3">
        {ADDONS.map((addon) => (
          <div
            key={addon.name}
            className={[
              'p-8 border-r border-b border-[#0F1419] last:border-b-0 lg:border-b-0 lg:last:border-r-0',
              addon.overage ? 'bg-[#0F1419] text-[#F5F7F4]' : 'bg-[#F5F7F4]',
            ].join(' ')}
          >
            <p
              className={[
                'font-mono uppercase tracking-[0.15em] text-[11px] font-semibold',
                addon.overage ? 'text-[#D4F542]' : 'text-[#0F1419]',
              ].join(' ')}
            >
              {addon.name}
            </p>
            <div className="mt-4 font-serif italic text-[36px] leading-none">
              <span className="text-[20px] align-top">€</span>
              {addon.price}
            </div>
            <p
              className={[
                'text-[12px] mt-1',
                addon.overage ? 'text-[#C7CCD1]' : 'text-[#4A525B]',
              ].join(' ')}
            >
              {addon.priceSub}
            </p>
            <p
              className={[
                'mt-5 text-[14px] leading-[1.5]',
                addon.overage ? 'text-[#C7CCD1]' : 'text-[#4A525B]',
              ].join(' ')}
            >
              {addon.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

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

function LoyaltySection() {
  return (
    <section className="border-t border-[#0F1419] py-20 lg:py-24">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4A525B]">
            Plus tu restes, plus tu économises
          </p>
          <h2 className="mt-2 text-[28px] md:text-[40px] lg:text-[48px] leading-[1.1] font-light tracking-tight">
            Fidélité <span className="font-serif italic font-normal">progressive</span>
          </h2>
        </div>
      </div>

      <div className="grid border border-[#0F1419] grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {LOYALTY_ITEMS.map((item, i) => (
          <div
            key={item.trigger}
            className={[
              'p-8 border-r border-b border-[#0F1419]',
              i === LOYALTY_ITEMS.length - 1 ? 'lg:border-r-0' : '',
              i >= LOYALTY_ITEMS.length - 2 ? 'lg:border-b-0' : '',
              item.special ? 'bg-[#0F1419] text-[#F5F7F4]' : 'bg-[#F5F7F4]',
            ].join(' ')}
          >
            <p
              className={[
                'font-mono text-[11px] uppercase tracking-[0.15em]',
                item.special ? 'text-[#C7CCD1]' : 'text-[#4A525B]',
              ].join(' ')}
            >
              {item.trigger}
            </p>
            <div
              className={[
                'mt-4 font-serif italic text-[48px] leading-none',
                item.special ? 'text-[#D4F542]' : 'text-[#0F1419]',
              ].join(' ')}
            >
              {item.discount}
            </div>
            <p
              className={[
                'mt-4 text-[14px]',
                item.special ? 'text-[#C7CCD1]' : 'text-[#4A525B]',
              ].join(' ')}
            >
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

const FOOTER_PROMISES: string[] = [
  'Essai 30 jours débit auto',
  'Satisfait ou remboursé 60 jours',
  'Résiliation en 2 clics',
  'Pas de hausse de prix la 1ère année',
  'Hébergement France · RGPD',
]

function FooterPromises() {
  return (
    <footer className="border-t border-[#0F1419] py-12 mt-16">
      <div className="flex flex-wrap gap-8">
        {FOOTER_PROMISES.map((promise) => (
          <span
            key={promise}
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#4A525B] before:content-['✓_'] before:text-[#16A66B] before:font-bold"
          >
            {promise}
          </span>
        ))}
      </div>
    </footer>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PAGE                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export default function TarifsPage() {
  return (
    <div className="bg-[#F5F7F4] text-[#0F1419] min-h-dvh font-sans">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Header */}
        <header className="border-b border-[#0F1419] pt-8 pb-6">
          <Link
            href="/"
            className="font-mono uppercase tracking-[0.4em] font-semibold text-sm hover:opacity-70 transition-opacity"
          >
            K · O · V · A · S
          </Link>
          <h1 className="mt-14 text-[40px] sm:text-[56px] md:text-[72px] lg:text-[88px] leading-none font-light tracking-tight">
            Le logiciel <span className="font-serif italic font-normal">fait pour toi.</span>
          </h1>
          <p className="mt-6 text-[18px] text-[#4A525B] max-w-[620px]">
            Du diagnostiqueur solo au cabinet structuré, chaque tier est calibré pour ton stade
            d’activité. Essai 30 jours sans engagement, satisfait ou remboursé sous 60 jours.
          </p>
          <div className="mt-10 flex flex-wrap gap-8">
            {['À partir de 29€/mois', 'Compatible Liciel, ORIS, OBBC', 'Support en français'].map(
              (meta) => (
                <span
                  key={meta}
                  className="font-mono text-[11px] uppercase tracking-[0.15em] before:content-['—_'] before:text-[#8B939B]"
                >
                  {meta}
                </span>
              ),
            )}
          </div>
        </header>

        {/* Tabs + content (Suspense pour useSearchParams Next.js 15) */}
        <Suspense fallback={<LogicielSection />}>
          <TarifsTabs
            logiciel={<LogicielSection />}
            annuaire={<AnnuaireSection />}
            bundles={<BundlesSection />}
          />
        </Suspense>

        <AddonsSection />
        <LoyaltySection />
        <FooterPromises />

        {/* Lien discret signalement / aide en bas */}
        <div className="border-t border-[#0F1419] py-8 text-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#4A525B] hover:text-[#0F1419] transition-colors"
          >
            <Flag className="h-3 w-3" />
            Une question sur la tarification ?
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
