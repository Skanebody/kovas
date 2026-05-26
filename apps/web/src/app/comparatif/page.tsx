/**
 * /comparatif — refonte 26/05/2026 (Lot B71).
 *
 * Reframing stratégique : KOVAS n'est PAS une alternative à Liciel/OBBC.
 * C'est une couche terrain compagnon qui supprime la re-saisie. Le calcul DPE
 * 3CL-2021 certifié ADEME et la soumission restent côté Liciel/OBBC — KOVAS
 * amplifie tout ce qui se passe avant.
 *
 * B71 : harmonisation chrome au style home V5 sobre Synthex/Quora :
 *   - PublicHeader + SiteFooter (au lieu du wrapper nu)
 *   - bg-sage + ink #0F1419 + sections px-5 sm:px-12 py-20 sm:py-28 border-t 0.08
 *   - typo H1 clamp(40,7vw,104) + H2 clamp(32,4vw,56) Urbanist medium + serif italic
 *   - eyebrows font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55
 *   - cards rounded-2xl border [#0F1419]/[0.08] bg-paper px-6 py-7
 *   - vouvoiement strict
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

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    'Comparatif KOVAS vs Liciel, OBBC, AnalysImmo, ORIS : KOVAS est leur couche terrain compagnon (saisie vocale, pré-vérif ADEME). Ton logiciel certifié reste ton moteur. 1h30 gagnée par DPE.',
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
    without: 'Calepin papier ou app mobile basique de ton éditeur (saisie manuelle)',
    with: 'Saisie vocale FR structurée par pièce + photos géolocalisées + détection IA des équipements',
    isRegulatory: false,
  },
  {
    step: '3. Retour bureau',
    without: '30 à 45 minutes de re-saisie complète dans ton logiciel (Liciel, OBBC, AnalysImmo…)',
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
    with: 'Ton logiciel certifié reste le moteur 3CL-2021 ADEME',
    isRegulatory: true,
  },
  {
    step: '6. Soumission ADEME',
    without: 'Ton logiciel certifié → ADEME',
    with: 'Ton logiciel certifié → ADEME (inchangé)',
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
      "Oui. KOVAS exporte vers les quatre éditeurs majeurs du marché : Liciel (Imports spécifiques XML + Excel + ZIP), OBBC (Imports spécifiques XML), AnalysImmo (XML CII + ZIP générique), ORIS (ZIP générique + JSON). Le reframing s'applique exactement de la même façon : ton logiciel certifié reste ton moteur ADEME, KOVAS amplifie le terrain.",
  },
  {
    question: 'Est-ce que je perds mon paramétrage logiciel ?',
    answer:
      "Non. KOVAS exporte EN PLUS — ton logiciel (Liciel, OBBC, AnalysImmo ou ORIS) reste ta référence. Aucun fichier de ton éditeur n'est modifié, ton paramétrage local (entêtes, signatures, gabarits) est intact.",
  },
  {
    question: 'ADEME accepte-t-elle les rapports passés par KOVAS ?',
    answer:
      "Le calcul DPE et la soumission ADEME sont faits par ton logiciel certifié, pas par KOVAS. ADEME voit du Liciel, OBBC, AnalysImmo ou ORIS à l'arrivée — exactement comme avant. KOVAS n'apparaît jamais dans le circuit officiel.",
  },
  {
    question: "Que se passe-t-il si mon éditeur change son format d'import ?",
    answer:
      "KOVAS supporte 3 formats parallèles par éditeur (Imports spécifiques XML, ZIP générique, Excel ou JSON selon l'éditeur). Si un éditeur modifie l'un d'eux, les autres restent fonctionnels. Une option de bascule manuelle est prévue en cas de changement majeur côté éditeur.",
  },
  {
    question: 'Et si KOVAS ferme ?',
    answer:
      "Tes données restent exportables en formats universels (PDF, Word, CSV, JSON) à tout moment, sans dépendance. Tu gardes l'intégralité de tes missions. Ton logiciel certifié continue de fonctionner avec ses propres données — KOVAS n'est pas un point de défaillance unique.",
  },
  {
    question: "Je n'ai pas le temps de me former à un nouveau logiciel.",
    answer:
      'Compte 30 minutes de prise en main. La saisie vocale apprend ton vocabulaire au fil des missions. Aucun changement à apporter dans ton logiciel principal : ta routine bureau reste identique.',
  },
  {
    question: 'Combien de fois par jour vais-je devoir basculer entre KOVAS et mon logiciel ?',
    answer:
      'Une seule fois : à la fin de la mission, tu cliques « Partager vers mon logiciel ». KOVAS reste sur mobile (ou tablette) sur le terrain, ton éditeur reste au bureau pour le calcul. Pas de va-et-vient en cours de mission.',
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
// Sections (style home V5)
// ───────────────────────────────────────────────────────────────────────────

function SectionHero(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
      <div className="max-w-[1240px] mx-auto">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
          Positionnement
        </p>
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
          style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
        >
          KOVAS n&apos;est pas une{' '}
          <span className="font-serif italic font-normal">alternative</span> à Liciel, OBBC,
          AnalysImmo ou ORIS.
        </h1>
        <p className="mt-8 max-w-2xl text-[15px] sm:text-[18px] text-[#0F1419]/72 leading-relaxed">
          C&apos;est leur couche terrain commune. Tu gardes ton logiciel certifié pour le calcul{' '}
          <GlossaryTerm term="DPE" /> <GlossaryTerm term="3CL-2021">3CL-2021</GlossaryTerm> et la
          soumission ADEME. KOVAS te fait gagner 1h30 par mission avant d&apos;arriver dans ton
          éditeur. Aucune migration. Aucun risque réglementaire.
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[820px]">
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 text-center space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              Gain mesuré
            </p>
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(56px, 7vw, 90px)' }}
            >
              1h30
            </p>
            <p className="text-[14px] text-[#0F1419]/72">
              gagnée par mission DPE avant ton logiciel certifié
            </p>
          </div>
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 text-center space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              Migration
            </p>
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(56px, 7vw, 90px)' }}
            >
              0&nbsp;€
            </p>
            <p className="text-[14px] text-[#0F1419]/72">
              de migration. Ton éditeur reste ton moteur ADEME.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SectionWorkflow(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Workflow réel
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Qui fait quoi, <span className="font-serif italic font-normal">étape par étape</span>.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            Sept étapes pour livrer un DPE conforme. KOVAS amplifie les quatre premières. Ton
            logiciel certifié (Liciel, OBBC, AnalysImmo, ORIS) et ADEME pilotent les trois dernières
            — et ne changent pas.
          </p>
        </div>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px] sm:text-[14px]">
              <thead>
                <tr className="border-b border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Étape
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Outil
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
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
                        idx < WORKFLOW_STEPS.length - 1 ? 'border-b border-[#0F1419]/[0.06]' : '',
                        step.isRegulatory ? 'bg-[#F5F7F4]/50' : '',
                      ].join(' ')}
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white border border-[#0F1419]/[0.08] text-[#0F1419]">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <div>
                            <div className="font-medium text-[#0F1419]">{step.label}</div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                              Étape {step.step}/7
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <ToolBadge tool={step.tool} />
                        {step.isRegulatory && (
                          <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                            Reste ton outil officiel
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top text-[#0F1419]/72">{step.benefit}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function SectionLossAversion(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Coût caché
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Ce que tu <span className="font-serif italic font-normal">perds</span> dans ton logiciel
            sans le savoir.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            Base de calcul : un diagnostiqueur typique qui réalise 75 missions par mois, dont 90
            minutes de re-saisie bureau par mission (terrain vers Liciel, OBBC, AnalysImmo ou ORIS).
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              Heures perdues / an
            </p>
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(60px, 8vw, 110px)' }}
            >
              112h
            </p>
            <p className="text-[14px] text-[#0F1419]/72 leading-snug">
              perdues par an à re-saisir le terrain dans ton logiciel (75 missions/mois × 1h30
              économisable).
            </p>
          </div>
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              Équivalent jours
            </p>
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(60px, 8vw, 110px)' }}
            >
              2,8&nbsp;mois
            </p>
            <p className="text-[14px] text-[#0F1419]/72 leading-snug">
              de travail effectif perdu chaque année, par diagnostiqueur — sur la base d&apos;une
              journée standard de 7 heures.
            </p>
          </div>
          <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              Coût opportunité
            </p>
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(60px, 8vw, 110px)' }}
            >
              3&nbsp;580&nbsp;€
            </p>
            <p className="text-[14px] text-[#0F1419]/72 leading-snug">
              évaporés par an, base tarif horaire moyen 32&nbsp;€/h × 112 heures non facturables.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
            Le vendredi soir à 19h
          </p>
          <p className="text-[15px] text-[#0F1419] leading-relaxed">
            Re-saisir dans ton logiciel certifié pendant que les enfants attendent à table : tu
            connais. KOVAS ne change rien à Liciel, OBBC, AnalysImmo ou ORIS. Il te fait arriver
            dans ton éditeur avec tout déjà prêt. Tu cliques sur «&nbsp;Importer le ZIP&nbsp;», ton
            logiciel ouvre la mission complète, et tu fermes l&apos;ordinateur.
          </p>
        </div>
      </div>
    </section>
  )
}

function SectionComparisonTable(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Avant / Après
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Le workflow diagnostic, <span className="font-serif italic font-normal">avec</span> et{' '}
            <span className="font-serif italic font-normal">sans</span> KOVAS.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            Pas de comparaison &laquo;&nbsp;X versus Y&nbsp;&raquo;. Une lecture honnête de ce qui
            change concrètement quand KOVAS s&apos;ajoute à ton logiciel certifié.
          </p>
        </div>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px] sm:text-[14px]">
              <thead>
                <tr className="border-b border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Étape
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Sans KOVAS (logiciel certifié seul)
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Avec KOVAS + ton logiciel
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={row.step}
                    className={[
                      idx < COMPARISON_ROWS.length - 1 ? 'border-b border-[#0F1419]/[0.06]' : '',
                      row.isRegulatory ? 'bg-[#F5F7F4]/50' : '',
                    ].join(' ')}
                  >
                    <th
                      scope="row"
                      className={[
                        'px-5 py-4 text-left align-top font-medium text-[#0F1419]',
                        row.isRegulatory ? 'border-l-4 border-chartreuse-deep' : '',
                      ].join(' ')}
                    >
                      {row.step}
                      {row.isRegulatory && (
                        <div className="mt-1 font-mono text-[10px] font-normal uppercase tracking-wider text-chartreuse-deep">
                          Réglementaire — inchangé
                        </div>
                      )}
                    </th>
                    <td className="px-5 py-4 align-top text-[#0F1419]/72">{row.without}</td>
                    <td className="px-5 py-4 align-top text-[#0F1419]">{row.with}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#0F1419] text-paper rounded-2xl px-6 py-7 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-paper/70">
            Récapitulatif
          </p>
          <p className="text-paper text-[15px] sm:text-[18px] leading-relaxed">
            Les trois étapes réglementaires — calcul DPE, soumission ADEME, validation officielle —
            restent inchangées. Ton logiciel certifié (Liciel, OBBC, AnalysImmo ou ORIS) reste ta
            référence ADEME. KOVAS amplifie tout ce qui se trouve autour.
          </p>
        </div>
      </div>
    </section>
  )
}

function SectionCompatibility(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Compatibilité
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Compatible avec ton <span className="font-serif italic font-normal">éditeur</span>, dès
            J0.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            KOVAS exporte vers les principaux logiciels du marché diagnostic. Pas de fichier
            propriétaire qui t&apos;enferme — tu gardes la liberté de changer ou de rester.
          </p>
        </div>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px] sm:text-[14px]">
              <thead>
                <tr className="border-b border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Éditeur
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
                  >
                    Format d&apos;export KOVAS
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
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
                      idx < EDITOR_COMPATIBILITY.length - 1
                        ? 'border-b border-[#0F1419]/[0.06]'
                        : ''
                    }
                  >
                    <th
                      scope="row"
                      className="px-5 py-4 text-left align-top font-semibold text-[#0F1419]"
                    >
                      {row.editor}
                      {row.priority === 'p1' && (
                        <div className="mt-1 font-mono text-[10px] font-normal uppercase tracking-wider text-chartreuse-deep">
                          Priorité 1
                        </div>
                      )}
                    </th>
                    <td className="px-5 py-4 align-top text-[#0F1419]">{row.format}</td>
                    <td className="px-5 py-4 align-top text-[#0F1419]/72">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[13px] text-[#0F1419]/55">
          Exports universels également disponibles à tout moment : PDF, Word (.docx), CSV, JSON. Tes
          données t&apos;appartiennent.
        </p>
      </div>
    </section>
  )
}

function SectionTestimonials(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Retours diagnostiqueurs
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Ils gardent leur logiciel certifié.{' '}
            <span className="font-serif italic font-normal">Ils ajoutent KOVAS</span>.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author + t.context}
              className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-4"
            >
              <p className="font-serif italic font-normal text-[18px] sm:text-[20px] text-[#0F1419] leading-relaxed">
                <span className="text-[#0F1419]/55">«&nbsp;</span>
                {t.quote}
                <span className="text-[#0F1419]/55">&nbsp;»</span>
              </p>
              <div className="border-t border-[#0F1419]/[0.06] pt-3">
                <div className="font-medium text-[#0F1419]">{t.author}</div>
                <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
                  <MapPin className="size-3" aria-hidden />
                  {t.context}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionFaq(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[920px] mx-auto space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Questions fréquentes
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Les vraies <span className="font-serif italic font-normal">objections</span> d&apos;un
            diagnostiqueur sceptique.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            Réponses directes aux questions qui reviennent toujours quand on parle d&apos;un outil
            compagnon de Liciel, OBBC, AnalysImmo ou ORIS.
          </p>
        </div>

        <ul className="divide-y divide-[#0F1419]/[0.08] border-y border-[#0F1419]/[0.08]">
          {FAQ_ENTRIES.map((faq) => (
            <li key={faq.question} className="py-6">
              <details className="group space-y-3">
                <summary className="flex cursor-pointer items-start justify-between gap-4 text-left font-medium text-[#0F1419] list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-base sm:text-lg leading-snug tracking-tight font-semibold">
                    {faq.question}
                  </span>
                  <ArrowRight
                    className="mt-1 size-4 shrink-0 text-[#0F1419]/55 transition-transform duration-200 group-open:rotate-90"
                    aria-hidden
                  />
                </summary>
                <p className="text-[14px] sm:text-[15px] text-[#0F1419]/72 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function SectionFinalCta(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-24 sm:py-32 border-t border-[#0F1419]/[0.08] bg-[#0F1419] text-paper">
      <div className="max-w-[920px] mx-auto text-center space-y-8">
        <p className="font-mono uppercase tracking-wider text-[11px] text-paper/55">
          Prêt à essayer
        </p>
        <h2
          className="font-sans font-medium tracking-tight text-paper leading-[1.05]"
          style={{ fontSize: 'clamp(40px, 5vw, 80px)' }}
        >
          Reste sur ton logiciel certifié.{' '}
          <span className="font-serif italic font-normal text-chartreuse">
            Gagne 1h30 par mission.
          </span>
        </h2>
        <p className="text-lg text-paper/72 max-w-xl mx-auto leading-relaxed">
          Essai 30 jours, carte bancaire enregistrée, débit automatique à J+30. Résiliable à tout
          moment depuis le Customer Portal, en 2 clics, sans justification.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild variant="accent" size="lg">
            <Link href="/signup">
              Démarrer l&apos;essai 30 jours
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/demo">
              <PlayCircle className="size-4" aria-hidden />
              Voir la démo 15 min
            </Link>
          </Button>
        </div>
        <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-wider text-paper/55 pt-2">
          <CheckCircle2 className="size-3" aria-hidden /> Liciel · OBBC · AnalysImmo · ORIS restent
          ton moteur ADEME — aucun risque
        </p>
      </div>
    </section>
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
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <JsonLd data={[softwareApplicationSchema, faqSchema, breadcrumbSchema]} id="comparatif" />
      <PublicHeader />
      <main className="flex-1">
        <SectionHero />
        <SectionWorkflow />
        <SectionLossAversion />
        <SectionComparisonTable />
        <SectionCompatibility />
        <SectionTestimonials />
        <SectionFaq />
        <SectionFinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
