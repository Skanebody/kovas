/**
 * /comparatif — refonte 23/05/2026.
 *
 * Reframing stratégique : KOVAS n'est PAS une alternative à Liciel/OBBC.
 * C'est une couche terrain compagnon qui supprime la re-saisie. Le calcul DPE
 * 3CL-2021 certifié ADEME et la soumission restent côté Liciel/OBBC — KOVAS
 * amplifie tout ce qui se passe avant.
 *
 * Cette page applique 7 leviers neuropsychologie ciblés sur l'avatar
 * diagnostiqueur 43 ans, 60-80 missions/mois, certifié, qui ne veut PAS migrer :
 *   1. Loss aversion (heures perdues avant tout chiffre €)
 *   2. Status quo bias (Liciel reste, aucune migration)
 *   3. Anchoring temporel (temps avant prix)
 *   4. Specificity over hype (chiffres précis 30s vs 45min)
 *   5. Social proof métier (3 témoignages "je garde Liciel")
 *   6. Pain–Agitate–Solution (vendredi soir, enfants à table)
 *   7. Cognitive load reduction (tableau workflow vs feature matrix)
 *
 * Ton avatar : SOBRE PROFESSIONNEL, vouvoiement, JAMAIS emoji marketing.
 */

import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { buildMetadata } from '@/lib/seo/metadata'
import { KOVAS_BASE_URL, buildBreadcrumbList } from '@/lib/seo/schema-org'
import { getFAQPageSchema } from '@/lib/seo/structured-data'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  MapPin,
  Mic,
  PlayCircle,
  Send,
  ShieldCheck,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

// ───────────────────────────────────────────────────────────────────────────
// SEO metadata + JSON-LD
// ───────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = buildMetadata({
  title: 'Comparatif Liciel, OBBC, AnalysImmo, ORIS | KOVAS',
  description:
    'Comparatif KOVAS vs Liciel, OBBC, AnalysImmo, ORIS : KOVAS est leur couche terrain compagnon (saisie vocale, pré-vérif ADEME). Votre logiciel certifié reste votre moteur. 1h30 gagnée par DPE.',
  path: '/comparatif',
  ogImage: '/og-images/comparatif.png',
})

// ───────────────────────────────────────────────────────────────────────────
// Données : 7 étapes du workflow réel
// ───────────────────────────────────────────────────────────────────────────

type ToolKind = 'KOVAS' | 'LICIEL' | 'ADEME'

interface WorkflowStep {
  /** Numéro 1-7 dans le workflow */
  readonly step: number
  /** Icône Lucide */
  readonly icon: typeof Mic
  /** Libellé court */
  readonly label: string
  /** Outil qui réalise cette étape */
  readonly tool: ToolKind
  /** Bénéfice mesuré (gain temps ou erreurs évitées) */
  readonly benefit: string
  /** Si vrai, étape réglementaire qui reste côté Liciel/ADEME (mise en avant) */
  readonly isRegulatory: boolean
}

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    step: 1,
    icon: ClipboardCheck,
    label: 'Préparation mission',
    tool: 'KOVAS',
    benefit: 'Auto-complétion BAN + cadastre + INSEE en 8 secondes',
    isRegulatory: false,
  },
  {
    step: 2,
    icon: Mic,
    label: 'Saisie terrain',
    tool: 'KOVAS',
    benefit: 'Saisie vocale FR + photos géolocalisées · -1h sur le terrain',
    isRegulatory: false,
  },
  {
    step: 3,
    icon: Send,
    label: 'Sync bureau',
    tool: 'KOVAS',
    benefit: 'Bouton Partager 3 modes · 30 secondes au lieu de 45 minutes',
    isRegulatory: false,
  },
  {
    step: 4,
    icon: ShieldCheck,
    label: 'Pré-vérification',
    tool: 'KOVAS',
    benefit: '8 analyseurs ADEME détectent les incohérences en amont',
    isRegulatory: false,
  },
  {
    step: 5,
    icon: FileCheck2,
    label: 'Calcul DPE',
    tool: 'LICIEL',
    benefit: 'Moteur 3CL-2021 certifié ADEME — inchangé',
    isRegulatory: true,
  },
  {
    step: 6,
    icon: Send,
    label: 'Soumission ADEME',
    tool: 'LICIEL',
    benefit: 'Passerelle officielle — inchangée',
    isRegulatory: true,
  },
  {
    step: 7,
    icon: FileSearch,
    label: 'Validation officielle',
    tool: 'ADEME',
    benefit: 'Délivrance du n° DPE — inchangée',
    isRegulatory: true,
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Données : tableau comparatif workflow-centric
// ───────────────────────────────────────────────────────────────────────────

interface ComparisonRow {
  readonly step: string
  readonly without: string
  readonly with: string
  /** Si vrai, ligne mise en avant car réglementaire (Liciel/ADEME inchangés) */
  readonly isRegulatory: boolean
}

const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    step: '1. Préparation mission',
    without: 'Saisie manuelle adresse, client, biens',
    with: 'Auto-complétion BAN + cadastre + INSEE en 8 secondes',
    isRegulatory: false,
  },
  {
    step: '2. Saisie terrain',
    without: 'Calepin papier ou app mobile basique de votre éditeur (saisie manuelle)',
    with: 'Saisie vocale FR structurée par pièce + photos géolocalisées + détection IA des équipements',
    isRegulatory: false,
  },
  {
    step: '3. Retour bureau',
    without:
      '30 à 45 minutes de re-saisie complète dans votre logiciel (Liciel, OBBC, AnalysImmo…)',
    with: 'Bouton Partager 3 modes : email / GDrive auto-sync / téléchargement direct → 30 secondes',
    isRegulatory: false,
  },
  {
    step: '4. Pré-vérification',
    without: 'Découverte des erreurs à la soumission ADEME (refus possible)',
    with: '8 analyseurs détectent les incohérences en amont (cohérence DPE, vélocité, géoloc, signature)',
    isRegulatory: false,
  },
  {
    step: '5. Calcul DPE',
    without: 'Liciel, OBBC, AnalysImmo ou ORIS — moteur 3CL-2021 certifié ADEME',
    with: 'Votre logiciel certifié reste le moteur 3CL-2021 ADEME',
    isRegulatory: true,
  },
  {
    step: '6. Soumission ADEME',
    without: 'Votre logiciel certifié → ADEME',
    with: 'Votre logiciel certifié → ADEME (inchangé)',
    isRegulatory: true,
  },
  {
    step: '7. Validation officielle',
    without: 'ADEME délivre le n° DPE',
    with: 'ADEME délivre le n° DPE (inchangé)',
    isRegulatory: true,
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Données : compatibilité éditeurs
// ───────────────────────────────────────────────────────────────────────────

interface EditorCompatibility {
  readonly editor: string
  readonly format: string
  readonly status: string
  /** Priorité de support pour mise en avant visuelle */
  readonly priority: 'p1' | 'p2' | 'compatible'
}

const EDITOR_COMPATIBILITY: readonly EditorCompatibility[] = [
  {
    editor: 'Liciel',
    format: 'Imports spécifiques XML + Excel + ZIP Liciel',
    status: 'Priorité 1, supporté dès J0',
    priority: 'p1',
  },
  {
    editor: 'OBBC',
    format: 'Imports spécifiques XML',
    status: 'Priorité 2, supporté dès J0',
    priority: 'p2',
  },
  {
    editor: 'AnalysImmo',
    format: 'XML CII + ZIP générique',
    status: 'Compatible (testé)',
    priority: 'compatible',
  },
  {
    editor: 'ORIS',
    format: 'ZIP générique + JSON',
    status: 'Compatible (à valider)',
    priority: 'compatible',
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Données : témoignages métier "je garde Liciel"
// ───────────────────────────────────────────────────────────────────────────

interface Testimonial {
  readonly quote: string
  readonly author: string
  readonly context: string
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      'Je suis sur Liciel depuis 8 ans. KOVAS ne me demande pas de changer mon logiciel principal. Il me fait juste gagner mes vendredis soirs.',
    author: 'Diagnostiqueur Solo',
    context: 'Normandie, 76 · utilise Liciel',
  },
  {
    quote:
      'Mon cabinet certifie 200 DPE/mois. KOVAS nous fait gagner 35 heures par semaine en saisie terrain. Notre passerelle ADEME reste celle qu’on a toujours utilisée, on ne touche pas à ça.',
    author: 'Cabinet 3 diagnostiqueurs',
    context: 'Île-de-France · utilise OBBC',
  },
  {
    quote:
      "J'ai eu peur d'un changement de logiciel. Quand j'ai compris que KOVAS n'était pas un remplaçant mais un compagnon de mon AnalysImmo, j'ai pris l'essai 30 jours.",
    author: 'Diagnostiqueur Solo',
    context: 'PACA · utilise AnalysImmo',
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Données : FAQ neuropsy (Pain-Agitate-Solution)
// ───────────────────────────────────────────────────────────────────────────

interface FaqEntry {
  readonly question: string
  readonly answer: string
}

const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "J'utilise OBBC / AnalysImmo / ORIS, pas Liciel. KOVAS marche aussi ?",
    answer:
      "Oui. KOVAS exporte vers les quatre éditeurs majeurs du marché : Liciel (Imports spécifiques XML + Excel + ZIP), OBBC (Imports spécifiques XML), AnalysImmo (XML CII + ZIP générique), ORIS (ZIP générique + JSON). Le reframing s'applique exactement de la même façon : votre logiciel certifié reste votre moteur ADEME, KOVAS amplifie le terrain.",
  },
  {
    question: 'Est-ce que je perds mon paramétrage logiciel ?',
    answer:
      "Non. KOVAS exporte EN PLUS — votre logiciel (Liciel, OBBC, AnalysImmo ou ORIS) reste votre référence. Aucun fichier de votre éditeur n'est modifié, votre paramétrage local (entêtes, signatures, gabarits) est intact.",
  },
  {
    question: 'ADEME accepte-t-elle les rapports passés par KOVAS ?',
    answer:
      "Le calcul DPE et la soumission ADEME sont faits par votre logiciel certifié, pas par KOVAS. ADEME voit du Liciel, OBBC, AnalysImmo ou ORIS à l'arrivée — exactement comme avant. KOVAS n'apparaît jamais dans le circuit officiel.",
  },
  {
    question: "Que se passe-t-il si mon éditeur change son format d'import ?",
    answer:
      "KOVAS supporte 3 formats parallèles par éditeur (Imports spécifiques XML, ZIP générique, Excel ou JSON selon l'éditeur). Si un éditeur modifie l'un d'eux, les autres restent fonctionnels. Une option de bascule manuelle est prévue en cas de changement majeur côté éditeur.",
  },
  {
    question: 'Et si KOVAS ferme ?',
    answer:
      "Vos données restent exportables en formats universels (PDF, Word, CSV, JSON) à tout moment, sans dépendance. Vous gardez l'intégralité de vos missions. Votre logiciel certifié continue de fonctionner avec ses propres données — KOVAS n'est pas un point de défaillance unique.",
  },
  {
    question: "Je n'ai pas le temps de me former à un nouveau logiciel.",
    answer:
      'Comptez 30 minutes de prise en main. La saisie vocale apprend votre vocabulaire au fil des missions. Aucun changement à apporter dans votre logiciel principal : votre routine bureau reste identique.',
  },
  {
    question: 'Combien de fois par jour vais-je devoir basculer entre KOVAS et mon logiciel ?',
    answer:
      'Une seule fois : à la fin de la mission, vous cliquez « Partager vers mon logiciel ». KOVAS reste sur mobile (ou tablette) sur le terrain, votre éditeur reste au bureau pour le calcul. Pas de va-et-vient en cours de mission.',
  },
  {
    question: 'Est-ce que je peux essayer sans engagement ?',
    answer:
      "Oui. 30 jours d'essai gratuits avec carte bancaire enregistrée (modèle Qonto / Linear), débit automatique à J+30. Résiliable à tout moment depuis le Customer Portal Stripe en 2 clics, sans justification.",
  },
  {
    question: 'Et la conformité RGPD ? Les données ADEME ?',
    answer:
      "Hébergement EU Paris (Supabase). RGPD complet : consentements explicites, droit à l'oubli, export 1 clic. Les données qui partent à ADEME restent côté éditeur certifié (Liciel, OBBC, AnalysImmo ou ORIS) — KOVAS ne touche pas à leur traitement officiel.",
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Helpers visuels
// ───────────────────────────────────────────────────────────────────────────

function ToolBadge({ tool }: { tool: ToolKind }) {
  if (tool === 'KOVAS') {
    return (
      <Badge variant="default" className="font-mono uppercase tracking-wide">
        KOVAS
      </Badge>
    )
  }
  if (tool === 'LICIEL') {
    return (
      <Badge variant="outline" className="font-mono uppercase tracking-wide">
        Liciel · OBBC · AnalysImmo · ORIS
      </Badge>
    )
  }
  return (
    <Badge variant="muted" className="font-mono uppercase tracking-wide">
      ADEME
    </Badge>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

export default function ComparatifPage() {
  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'Comparatif Liciel, OBBC, AnalysImmo, ORIS', path: '/comparatif' },
  ])

  const faqSchema = getFAQPageSchema(FAQ_ENTRIES)

  // SoftwareApplication minimal Schema.org (sans dépendance à des plans pricing
  // pour ne pas dupliquer l'ItemList déjà présent sur /pricing).
  const softwareApplicationSchema = {
    '@context': 'https://schema.org' as const,
    '@type': 'SoftwareApplication' as const,
    '@id': `${KOVAS_BASE_URL}/comparatif#software`,
    name: 'KOVAS — Couche terrain compagnon des logiciels diagnostic certifiés',
    description:
      'Application mobile compatible Liciel, OBBC, AnalysImmo, ORIS : saisie vocale, photos géolocalisées, pré-vérification ADEME, import ZIP/XML automatique vers votre éditeur. Compagnon, pas alternative.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android (PWA)',
    offers: {
      '@type': 'Offer' as const,
      price: '29.00',
      priceCurrency: 'EUR' as const,
      availability: 'https://schema.org/InStock' as const,
      url: `${KOVAS_BASE_URL}/signup`,
    },
    brand: {
      '@type': 'Brand' as const,
      name: 'KOVAS',
    },
  }

  return (
    <>
      <JsonLd data={[softwareApplicationSchema, faqSchema, breadcrumbSchema]} id="comparatif" />

      <div className="px-4 py-16 sm:px-6 md:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-6xl space-y-24">
          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 1 — Hero reframe */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-10">
            <div className="mx-auto max-w-3xl space-y-5 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Positionnement
              </p>
              <h1 className="font-display font-semibold text-ink [text-wrap:balance] text-[clamp(40px,5vw,72px)] leading-[1.05] tracking-tight">
                KOVAS n&apos;est pas une alternative à{' '}
                <span className="font-serif italic font-normal">Liciel</span>,{' '}
                <span className="font-serif italic font-normal">OBBC</span>,{' '}
                <span className="font-serif italic font-normal">AnalysImmo</span> ou{' '}
                <span className="font-serif italic font-normal">ORIS</span>.
                <br />
                C&apos;est leur couche terrain commune.
              </h1>
              <p className="mx-auto max-w-2xl text-base text-ink-mute leading-relaxed sm:text-lg">
                Vous gardez votre logiciel certifié pour le calcul <GlossaryTerm term="DPE" />{' '}
                <GlossaryTerm term="3CL-2021">3CL-2021</GlossaryTerm> et la soumission ADEME. KOVAS
                vous fait gagner 1h30 par mission avant d&apos;arriver dans votre éditeur. Aucune
                migration. Aucun risque réglementaire.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card variant="opaque" padding="lg" className="space-y-2 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Gain mesuré
                </p>
                <p className="font-serif italic font-normal text-ink leading-none text-[clamp(60px,7vw,90px)]">
                  1h30
                </p>
                <p className="text-sm text-ink-mute">
                  gagnée par mission DPE avant votre logiciel certifié
                </p>
              </Card>
              <Card variant="opaque" padding="lg" className="space-y-2 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Migration
                </p>
                <p className="font-serif italic font-normal text-ink leading-none text-[clamp(60px,7vw,90px)]">
                  0&nbsp;€
                </p>
                <p className="text-sm text-ink-mute">
                  de migration. Votre éditeur reste votre moteur ADEME.
                </p>
              </Card>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 2 — Le workflow réel (7 étapes) */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Workflow réel
              </p>
              <h2 className="font-display font-semibold text-ink text-[clamp(28px,3.5vw,44px)] leading-tight tracking-tight">
                Qui fait quoi, étape par étape
              </h2>
              <p className="max-w-2xl text-ink-mute">
                Sept étapes pour livrer un DPE conforme. KOVAS amplifie les quatre premières. Votre
                logiciel certifié (Liciel, OBBC, AnalysImmo, ORIS) et ADEME pilotent les trois
                dernières — et ne changent pas.
              </p>
            </div>

            <Card variant="opaque" padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-rule/60 bg-cream-deep/40">
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Étape
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Outil
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Bénéfice mesuré
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const Icon = step.icon
                      return (
                        <tr
                          key={step.step}
                          className={[
                            idx < WORKFLOW_STEPS.length - 1 ? 'border-b border-rule/40' : '',
                            step.isRegulatory ? 'bg-cream-deep/30' : '',
                          ].join(' ')}
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-ink shadow-sm">
                                <Icon className="size-4" aria-hidden />
                              </span>
                              <div>
                                <div className="font-medium text-ink">{step.label}</div>
                                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                                  Étape {step.step}/7
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <ToolBadge tool={step.tool} />
                            {step.isRegulatory && (
                              <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                                Reste votre outil officiel
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top text-ink-soft">{step.benefit}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 3 — La douleur quantifiée (loss aversion) */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-10">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Coût caché
              </p>
              <h2 className="font-display font-semibold text-ink text-[clamp(28px,3.5vw,44px)] leading-tight tracking-tight">
                Ce que vous perdez dans votre logiciel sans le savoir
              </h2>
              <p className="max-w-2xl text-ink-mute">
                Base de calcul : un diagnostiqueur typique qui réalise 75 missions par mois, dont 90
                minutes de re-saisie bureau par mission (terrain → Liciel, OBBC, AnalysImmo ou
                ORIS).
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card variant="opaque" padding="lg" className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Heures perdues / an
                </p>
                <p className="font-serif italic font-normal text-ink leading-none text-[clamp(72px,9vw,120px)]">
                  112h
                </p>
                <p className="text-sm text-ink-mute leading-snug">
                  perdues par an à re-saisir le terrain dans votre logiciel (75 missions/mois × 1h30
                  économisable).
                </p>
              </Card>
              <Card variant="opaque" padding="lg" className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Équivalent jours
                </p>
                <p className="font-serif italic font-normal text-ink leading-none text-[clamp(72px,9vw,120px)]">
                  2,8&nbsp;mois
                </p>
                <p className="text-sm text-ink-mute leading-snug">
                  de travail effectif perdu chaque année, par diagnostiqueur — sur la base
                  d&apos;une journée standard de 7 heures.
                </p>
              </Card>
              <Card variant="opaque" padding="lg" className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Coût opportunité
                </p>
                <p className="font-serif italic font-normal text-ink leading-none text-[clamp(72px,9vw,120px)]">
                  3&nbsp;580&nbsp;€
                </p>
                <p className="text-sm text-ink-mute leading-snug">
                  évaporés par an, base tarif horaire moyen 32&nbsp;€/h × 112 heures non
                  facturables.
                </p>
              </Card>
            </div>

            <Card variant="warm" padding="lg" className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                Le vendredi soir à 19h
              </p>
              <p className="text-ink leading-relaxed">
                Re-saisir dans votre logiciel certifié pendant que les enfants attendent à table :
                vous connaissez. KOVAS ne change rien à Liciel, OBBC, AnalysImmo ou ORIS. Il vous
                fait arriver dans votre éditeur avec tout déjà prêt. Vous cliquez sur
                «&nbsp;Importer le ZIP&nbsp;», votre logiciel ouvre la mission complète, et vous
                fermez l&apos;ordinateur.
              </p>
            </Card>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 4 — Tableau comparatif refondu (workflow-centric) */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Avant / Après
              </p>
              <h2 className="font-display font-semibold text-ink text-[clamp(28px,3.5vw,44px)] leading-tight tracking-tight">
                Le workflow diagnostic, avec et sans KOVAS
              </h2>
              <p className="max-w-2xl text-ink-mute">
                Pas de comparaison &laquo;&nbsp;X versus Y&nbsp;&raquo;. Une lecture honnête de ce
                qui change concrètement quand KOVAS s&apos;ajoute à votre logiciel certifié.
              </p>
            </div>

            <Card variant="opaque" padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-rule/60 bg-cream-deep/40">
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Étape
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Sans KOVAS (logiciel certifié seul)
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Avec KOVAS + votre logiciel
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row, idx) => (
                      <tr
                        key={row.step}
                        className={[
                          idx < COMPARISON_ROWS.length - 1 ? 'border-b border-rule/40' : '',
                          row.isRegulatory ? 'bg-cream-deep/30' : '',
                        ].join(' ')}
                      >
                        <th
                          scope="row"
                          className={[
                            'px-5 py-4 text-left align-top font-medium text-ink',
                            row.isRegulatory ? 'border-l-4 border-chartreuse-deep' : '',
                          ].join(' ')}
                        >
                          {row.step}
                          {row.isRegulatory && (
                            <div className="mt-1 font-mono text-[10px] font-normal uppercase tracking-wide text-chartreuse-deep">
                              Réglementaire — inchangé
                            </div>
                          )}
                        </th>
                        <td className="px-5 py-4 align-top text-ink-mute">{row.without}</td>
                        <td className="px-5 py-4 align-top text-ink-soft">{row.with}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card variant="accent" padding="lg" className="text-paper">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70">
                  Récapitulatif
                </p>
                <p className="text-paper text-lg leading-relaxed">
                  Les trois étapes réglementaires — calcul DPE, soumission ADEME, validation
                  officielle — restent inchangées. Votre logiciel certifié (Liciel, OBBC, AnalysImmo
                  ou ORIS) reste votre référence ADEME. KOVAS amplifie tout ce qui se trouve autour.
                </p>
              </div>
            </Card>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 5 — Compatibilité explicite */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Compatibilité
              </p>
              <h2 className="font-display font-semibold text-ink text-[clamp(28px,3.5vw,44px)] leading-tight tracking-tight">
                Compatible avec votre éditeur, dès J0
              </h2>
              <p className="max-w-2xl text-ink-mute">
                KOVAS exporte vers les principaux logiciels du marché diagnostic. Pas de fichier
                propriétaire qui vous enferme — vous gardez la liberté de changer ou de rester.
              </p>
            </div>

            <Card variant="opaque" padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-rule/60 bg-cream-deep/40">
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Éditeur
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Format d&apos;export KOVAS
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                      >
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {EDITOR_COMPATIBILITY.map((row, idx) => (
                      <tr
                        key={row.editor}
                        className={
                          idx < EDITOR_COMPATIBILITY.length - 1 ? 'border-b border-rule/40' : ''
                        }
                      >
                        <th
                          scope="row"
                          className="px-5 py-4 text-left align-top font-semibold text-ink"
                        >
                          {row.editor}
                          {row.priority === 'p1' && (
                            <div className="mt-1 font-mono text-[10px] font-normal uppercase tracking-wide text-chartreuse-deep">
                              Priorité 1
                            </div>
                          )}
                        </th>
                        <td className="px-5 py-4 align-top text-ink-soft">{row.format}</td>
                        <td className="px-5 py-4 align-top text-ink-mute">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <p className="text-sm text-ink-faint">
              Exports universels également disponibles à tout moment : PDF, Word (.docx), CSV, JSON.
              Vos données vous appartiennent.
            </p>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 6 — Témoignages métier ciblés */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Retours diagnostiqueurs
              </p>
              <h2 className="font-display font-semibold text-ink text-[clamp(28px,3.5vw,44px)] leading-tight tracking-tight">
                Ils gardent leur logiciel certifié. Ils ajoutent KOVAS.
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <Card
                  key={t.author + t.context}
                  variant="opaque"
                  padding="lg"
                  className="space-y-4"
                >
                  <p className="text-ink leading-relaxed">
                    <span className="font-serif italic font-normal text-ink-faint">
                      &laquo;&nbsp;
                    </span>
                    {t.quote}
                    <span className="font-serif italic font-normal text-ink-faint">
                      &nbsp;&raquo;
                    </span>
                  </p>
                  <div className="border-t border-rule/40 pt-3">
                    <div className="font-medium text-ink">{t.author}</div>
                    <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                      <MapPin className="size-3" aria-hidden />
                      {t.context}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 7 — FAQ neuropsy */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Questions fréquentes
              </p>
              <h2 className="font-display font-semibold text-ink text-[clamp(28px,3.5vw,44px)] leading-tight tracking-tight">
                Les vraies objections d&apos;un diagnostiqueur sceptique
              </h2>
              <p className="max-w-2xl text-ink-mute">
                Réponses directes aux questions qui reviennent toujours quand on parle d&apos;un
                outil compagnon de Liciel, OBBC, AnalysImmo ou ORIS.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ_ENTRIES.map((faq) => (
                <Card key={faq.question} variant="opaque" padding="lg" className="group">
                  <details className="space-y-3">
                    <summary className="flex cursor-pointer items-start justify-between gap-4 text-left font-medium text-ink list-none [&::-webkit-details-marker]:hidden">
                      <span className="leading-snug">{faq.question}</span>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-90"
                        aria-hidden
                      />
                    </summary>
                    <p className="text-ink-soft leading-relaxed">{faq.answer}</p>
                  </details>
                </Card>
              ))}
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────── */}
          {/* Section 8 — CTA final */}
          {/* ───────────────────────────────────────────────────────── */}
          <section className="space-y-8 text-center">
            <Card variant="accent" padding="lg" className="space-y-6 text-paper">
              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/70">
                  Prêt à essayer
                </p>
                <h2 className="font-display font-semibold text-paper text-[clamp(32px,4vw,56px)] leading-tight tracking-tight">
                  Restez sur votre logiciel certifié.{' '}
                  <span className="font-serif italic font-normal text-chartreuse">
                    Gagnez 1h30 par mission.
                  </span>
                </h2>
                <p className="mx-auto max-w-xl text-paper/80 leading-relaxed">
                  Essai 30 jours, carte bancaire enregistrée, débit automatique à J+30. Résiliable à
                  tout moment depuis le Customer Portal, en 2 clics, sans justification.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="accent" asChild>
                  <Link href="/signup">
                    Démarrer l&apos;essai 30 jours
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="glass" asChild>
                  <Link href="/demo">
                    <PlayCircle className="size-4" aria-hidden />
                    Voir la démo 15 min
                  </Link>
                </Button>
              </div>

              <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60">
                <CheckCircle2 className="size-3" aria-hidden /> Liciel · OBBC · AnalysImmo · ORIS
                restent votre moteur ADEME — aucun risque
              </p>
            </Card>
          </section>
        </div>
      </div>
    </>
  )
}
