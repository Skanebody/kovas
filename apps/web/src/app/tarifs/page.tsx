import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BUNDLES } from '@/lib/pricing-plans'
import { ArrowRight, Check, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { TarifsTabs } from './TarifsTabs'

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'KOVAS Logiciel 29/59/149/299€/mo · KOVAS Annuaire 19/39/79€/mo · Bundles combinés. Modèle Doctolib : abonnement + leads B2C qualifiés. TVA 20%.',
}

/* ────────────────────────────────────────────────────────────────────────── */
/* LOGICIEL — 4 tiers SaaS terrain                                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface LogicielTier {
  name: string
  price: string
  missions: number
  surplus: string
  storage: string
  users: string
  description: string
  highlighted?: boolean
  cta: string
}

// SOURCE DE VÉRITÉ : apps/web/src/lib/pricing-plans.ts (LOGICIEL_PLANS).
const LOGICIEL_TIERS: LogicielTier[] = [
  {
    name: 'Solo Light',
    price: '29€',
    missions: 60,
    surplus: '1,50€ / mission',
    storage: '12 Go',
    users: '1 utilisateur',
    description: 'Démarrer en solo sur les diagnostics standards.',
    cta: 'Commencer Solo Light',
  },
  {
    name: 'Solo Pro',
    price: '59€',
    missions: 150,
    surplus: '1,20€ / mission',
    storage: '25 Go',
    users: '1 utilisateur',
    description: 'Le tier le plus choisi par les solopreneurs actifs.',
    highlighted: true,
    cta: 'Commencer Solo Pro',
  },
  {
    name: 'Cabinet',
    price: '149€',
    missions: 400,
    surplus: '0,90€ / mission',
    storage: '100 Go',
    users: "jusqu'à 3 utilisateurs",
    description: 'Cabinet 2 à 3 diagnostiqueurs.',
    cta: 'Commencer Cabinet',
  },
  {
    name: 'Cabinet+',
    price: '299€',
    missions: 0,
    surplus: 'inclus',
    storage: '250 Go',
    users: "jusqu'à 7 utilisateurs",
    description: 'Cabinet en croissance, multi-sites ou volume très élevé.',
    cta: 'Commencer Cabinet+',
  },
]

const INCLUDED_FEATURES = [
  '8 diagnostics standards (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP)',
  'Saisie vocale terrain illimitée',
  'Photos géolocalisées illimitées',
  'Exports universels (PDF, Word, CSV, JSON) + compatibilité Liciel · OBBC · AnalysImmo · ORIS',
  'Bouton « Partager » 3 modes',
  'Sync iPad / iPhone / Web temps réel',
  'Mode offline complet',
  'Templates pièces + check-lists',
  'Pré-vérification ADEME intelligente',
  'Détection de fraude DPE 4 patterns',
  'Coach IA personnel',
  'Fiche publique annuaire kovas.fr',
  'Leads calculateur DPE gratuit',
  'Hébergement EU (Paris), conformité RGPD',
  'Support email sous 24h ouvrées',
]

/* ────────────────────────────────────────────────────────────────────────── */
/* ANNUAIRE — 3 tiers visibilité (modèle Doctolib)                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface AnnuaireTier {
  name: string
  price: string
  zone: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const ANNUAIRE_TIERS: AnnuaireTier[] = [
  {
    name: 'Annuaire Local',
    price: '19€',
    zone: '1 ville (population < 50k)',
    description: 'Top 3 sur votre ville, fiche enrichie photos + avis.',
    features: [
      'Top 3 résultats sur 1 ville',
      'Fiche publique enrichie (photos, certifications, avis)',
      'Notifications de leads en temps réel',
      'Statistiques mensuelles de profil',
      'Indicateur disponibilité semaine',
    ],
    cta: 'Démarrer Annuaire Local',
  },
  {
    name: 'Annuaire Régional',
    price: '39€',
    zone: '1 département complet',
    description: 'Couverture département + mise en avant cartographie.',
    features: [
      'Top 3 sur 1 département entier',
      'Mise en avant cartographie',
      'Réponse prioritaire aux demandes',
      'Export hebdomadaire des contacts',
      'Statistiques détaillées par ville',
    ],
    highlighted: true,
    cta: 'Démarrer Annuaire Régional',
  },
  {
    name: 'Annuaire National',
    price: '79€',
    zone: 'multi-départements + national',
    description: 'Présence prioritaire France entière + API leads.',
    features: [
      'Top de page kovas.fr/trouver-un-diagnostiqueur',
      'Profil bilingue FR/EN',
      'Account manager dédié',
      'API leads (Webhook + CSV)',
      'Stats nationales anonymisées',
    ],
    cta: 'Démarrer Annuaire National',
  },
]

const LEAD_UNLOCK_FEATURES = [
  "Lead unlock à l'usage de 9€ à 149€ selon urgence + budget client (modèle dynamique)",
  'Premium : 30 minutes exclusives avant diffusion concurrents',
  'Standard : top 3 diagnostiqueurs en parallèle',
  'Sponsorisé : 9€ à 149€/mois pour placement boosté ville par ville',
  'Aucun frais sans lead unlock — vous ne payez que ce que vous utilisez',
]

/* ────────────────────────────────────────────────────────────────────────── */
/* OPTIONS ponctuelles                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const ONE_SHOTS = [
  { label: 'Signature eIDAS Yousign', price: '2€ / signature' },
  { label: 'Rapport bilingue FR / EN', price: '5€ / rapport' },
  { label: 'SMS rappel client J-1', price: '0,15€ / SMS' },
]

/* ────────────────────────────────────────────────────────────────────────── */
/* FAQ                                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const FAQ = [
  {
    question: 'Que se passe-t-il si je dépasse mon quota mensuel Logiciel ?',
    answer:
      'Vous payez le surplus au tarif indiqué dans votre tier. Aucun blocage, aucune carte bancaire redemandée. Vous pouvez activer un plafond mensuel auto-protecteur dans votre compte.',
  },
  {
    question: "Puis-je souscrire à l'Annuaire sans abonner au Logiciel ?",
    answer:
      "Oui, totalement. L'Annuaire est un produit à part entière (second pilier de revenu KOVAS). Vous pouvez démarrer à 19€/mois Annuaire Local sans aucune obligation logiciel.",
  },
  {
    question: 'Comment fonctionnent les bundles Logiciel + Annuaire ?',
    answer:
      'Les bundles combinent un tier Logiciel et un tier Annuaire avec une remise immédiate (9€ à 59€/mois économisés). Un seul abonnement Stripe pour les deux produits, résiliable séparément.',
  },
  {
    question: "Puis-je changer de tier en cours d'abonnement ?",
    answer:
      'Oui, depuis votre compte, à tout moment. Le changement est appliqué au prorata du mois en cours, sans pénalité.',
  },
  {
    question: 'Y a-t-il un engagement ?',
    answer:
      "Aucun. Résiliation libre depuis le Customer Portal Stripe en deux clics. L'annuel offre 2 mois gratuits (10 mois payés sur 12).",
  },
  {
    question: "L'essai gratuit Logiciel nécessite-t-il une carte bancaire ?",
    answer:
      "Oui, depuis le 22/05/2026, l'essai 30 jours requiert une carte bancaire à l'inscription. Aucun débit avant J+30. Vous pouvez résilier à tout moment pendant la période d'essai.",
  },
  {
    question: 'Les tarifs incluent-ils la TVA ?',
    answer:
      'Non, tous les tarifs affichés sont HT. La TVA française 20 % est facturée en sus pour les clients FR. Les clients UE assujettis avec numéro TVA intracommunautaire valide sont exonérés (autoliquidation).',
  },
]

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-section components                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function LogicielSection(): React.ReactElement {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {LOGICIEL_TIERS.map((tier) => (
          <Card
            key={tier.name}
            variant="opaque"
            padding="default"
            className={
              tier.highlighted
                ? 'relative border-chartreuse-deep/30 flex flex-col'
                : 'flex flex-col'
            }
          >
            {tier.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
            )}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="text-xs text-ink-mute">{tier.description}</p>
            </div>
            <div className="pt-4">
              <div className="text-4xl font-bold tracking-tight">{tier.price}</div>
              <div className="text-xs text-ink-mute">HT / mois</div>
            </div>
            <ul className="space-y-2 pt-4 text-sm">
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 mt-0.5" />
                <span>
                  <strong>
                    {tier.missions === 0 ? 'Missions illimitées' : `${tier.missions} missions`}
                  </strong>
                  {tier.missions !== 0 && ' incluses'}
                </span>
              </li>
              {tier.missions !== 0 && (
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <span>Surplus : {tier.surplus}</span>
                </li>
              )}
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 mt-0.5" />
                <span>{tier.storage} de stockage</span>
              </li>
              <li className="flex gap-2">
                <Check className="size-4 shrink-0 mt-0.5" />
                <span>{tier.users}</span>
              </li>
            </ul>
            <div className="mt-auto pt-6">
              <Button className="w-full" variant={tier.highlighted ? 'accent' : 'outline'} asChild>
                <Link
                  href={`/signup?plan=${tier.name.toLowerCase().replace(/\s+/g, '_').replace('+', '_plus')}`}
                >
                  {tier.cta}
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <section className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Inclus dans tous les tiers Logiciel
          </h2>
          <p className="text-sm text-ink-mute">
            Aucune fonctionnalité réservée aux tiers supérieurs. La différence porte uniquement sur
            le volume et le nombre d&apos;utilisateurs.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {INCLUDED_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2">
              <Check className="size-4 shrink-0 mt-0.5 text-chartreuse-deep" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>

      <Card variant="opaque" padding="default" className="mx-auto max-w-3xl space-y-3">
        <h3 className="text-lg font-semibold">Options ponctuelles (paiement à l&apos;usage)</h3>
        <ul className="space-y-2 text-sm text-ink-mute">
          {ONE_SHOTS.map((shot) => (
            <li key={shot.label}>
              · {shot.label} — <strong className="text-ink">{shot.price}</strong>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-ink-faint">
          Aucun pack mensuel obligatoire — vous ne payez que ce que vous utilisez. TVA 20 % en sus
          pour les clients FR.
        </p>
      </Card>
    </div>
  )
}

function AnnuaireSection(): React.ReactElement {
  return (
    <div className="space-y-12">
      <div className="mx-auto max-w-3xl text-center space-y-3">
        <Badge variant="muted">Modèle Doctolib · Second pilier de revenu KOVAS</Badge>
        <p className="text-sm text-ink-mute leading-relaxed">
          L&apos;Annuaire kovas.fr capte les particuliers qui cherchent un diagnostiqueur près de
          chez eux. Vous pouvez souscrire <strong>sans abonnement Logiciel</strong> — c&apos;est un
          produit à part entière. ARPU combiné Logiciel + Annuaire : 2-3× supérieur au logiciel
          seul.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ANNUAIRE_TIERS.map((tier) => (
          <Card
            key={tier.name}
            variant="opaque"
            padding="default"
            className={
              tier.highlighted
                ? 'relative border-chartreuse-deep/30 flex flex-col'
                : 'flex flex-col'
            }
          >
            {tier.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
            )}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="text-xs text-ink-mute">{tier.description}</p>
            </div>
            <div className="pt-4">
              <div className="text-4xl font-bold tracking-tight">{tier.price}</div>
              <div className="text-xs text-ink-mute">HT / mois</div>
            </div>
            <p className="pt-2 font-mono text-[11px] uppercase tracking-wide text-ink-mute">
              Zone : {tier.zone}
            </p>
            <ul className="space-y-2 pt-4 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <Button className="w-full" variant={tier.highlighted ? 'accent' : 'outline'} asChild>
                <Link href={`/signup?annuaire=${tier.name.toLowerCase().replace(/\s+/g, '_')}`}>
                  {tier.cta}
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card variant="opaque" padding="default" className="mx-auto max-w-3xl space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-chartreuse-deep" aria-hidden />
          <h3 className="text-base font-semibold">Lead unlock dynamique + Sponsorisé</h3>
        </div>
        <ul className="space-y-2 text-sm text-ink-mute">
          {LEAD_UNLOCK_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span className="text-ink-mute mt-0.5">·</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card variant="opaque" padding="default" className="mx-auto max-w-3xl">
        <h3 className="text-base font-semibold mb-3">Calcul ROI rapide</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">Local 19€</p>
            <p className="text-ink mt-1">
              Rentabilisé dès <strong>1 lead</strong> débloqué à 25€+
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
              Régional 39€
            </p>
            <p className="text-ink mt-1">
              Rentabilisé dès <strong>2 leads</strong> à 25€ ou 1 à 50€+
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
              National 79€
            </p>
            <p className="text-ink mt-1">
              Rentabilisé dès <strong>3-4 leads</strong> par mois
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function BundlesSection(): React.ReactElement {
  return (
    <div className="space-y-12">
      <div className="mx-auto max-w-3xl text-center space-y-3">
        <Badge variant="muted">Combos Logiciel + Annuaire avec remise</Badge>
        <p className="text-sm text-ink-mute leading-relaxed">
          Cinq bundles canoniques qui combinent un tier Logiciel et un tier Annuaire avec une remise
          immédiate. Un seul abonnement Stripe, résiliable séparément. ARPU multiplié par 2-3× vs un
          Liciel seul.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {BUNDLES.map((bundle) => {
          const monthlyPriceEur = Math.round(bundle.monthlyPrice / 100)
          const individualPriceEur = Math.round(bundle.individualMonthlyPriceCents / 100)
          const savingsPctRounded = Math.round(
            ((bundle.individualMonthlyPriceCents - bundle.monthlyPrice) /
              bundle.individualMonthlyPriceCents) *
              100,
          )
          return (
            <Card
              key={bundle.code}
              variant="opaque"
              padding="default"
              className={
                'featured' in bundle && bundle.featured
                  ? 'relative border-chartreuse-deep/30 flex flex-col'
                  : 'flex flex-col'
              }
            >
              {'featured' in bundle && bundle.featured ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Best-seller</Badge>
              ) : null}
              <div className="space-y-1">
                <h3 className="text-base font-semibold">{bundle.name}</h3>
                <p className="text-xs text-ink-mute">{bundle.tagline}</p>
              </div>
              <div className="pt-4">
                <div className="text-3xl font-bold tracking-tight">{monthlyPriceEur}€</div>
                <div className="text-xs text-ink-mute">HT / mois</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="line-through text-[11px] text-ink-mute">
                    {individualPriceEur}€ séparés
                  </span>
                  <Badge variant="green" className="text-[10px]">
                    −{savingsPctRounded}%
                  </Badge>
                </div>
              </div>
              <ul className="space-y-1.5 pt-4 text-[13px]">
                {bundle.includedPlanLabels.map((label) => (
                  <li key={label} className="flex gap-2">
                    <Check className="size-3.5 shrink-0 mt-0.5 text-chartreuse-deep" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Button
                  className="w-full"
                  variant={'featured' in bundle && bundle.featured ? 'accent' : 'outline'}
                  size="sm"
                  asChild
                >
                  <Link href={`/signup?bundle=${bundle.code}`}>Choisir ce bundle</Link>
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Card variant="opaque" padding="default" className="mx-auto max-w-3xl space-y-2">
        <h3 className="text-base font-semibold">Pourquoi prendre un bundle ?</h3>
        <ul className="space-y-2 text-sm text-ink-mute">
          <li>· Remise immédiate de 9€ à 59€/mois selon le bundle choisi</li>
          <li>· Un seul abonnement Stripe à gérer (pas deux factures séparées)</li>
          <li>· Synchronisation profil Logiciel ↔ Annuaire automatique</li>
          <li>· Résiliation séparée possible (garder uniquement Annuaire si besoin)</li>
        </ul>
      </Card>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Page                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export default function TarifsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 py-16">
      <div className="space-y-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">
            Tarification
          </p>
          <h1
            className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
            style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}
          >
            Tarifs{' '}
            <span className="font-serif italic font-normal text-chartreuse-deep">transparents</span>
            .
          </h1>
          <p className="text-ink-mute text-lg">
            Trois produits indépendants ou combinés en bundles avec remise. Logiciel SaaS terrain,
            Annuaire kovas.fr modèle Doctolib, bundles cross-sell.
          </p>
        </div>

        {/* TarifsTabs utilise useSearchParams() — Next.js 15 exige un wrapper Suspense */}
        <Suspense fallback={<LogicielSection />}>
          <TarifsTabs
            logiciel={<LogicielSection />}
            annuaire={<AnnuaireSection />}
            bundles={<BundlesSection />}
          />
        </Suspense>

        <section className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-2 text-center">
            <Badge variant="muted">FAQ tarifs</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Vos questions sur les tarifs
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <Card key={item.question} variant="opaque" padding="default" className="space-y-2">
                <h3 className="text-base font-semibold">{item.question}</h3>
                <p className="text-sm text-ink-mute">{item.answer}</p>
              </Card>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-3xl text-center space-y-4">
          <p className="text-sm text-ink-mute">
            <strong>Annuel : 2 mois offerts</strong> (10 mois payés sur 12) sur tous les tiers.
          </p>
          <Button size="lg" variant="accent" asChild>
            <Link href="/signup">
              Démarrer mon essai 30 jours <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
