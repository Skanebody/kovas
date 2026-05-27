/**
 * KOVAS — Homepage marketing kovas.fr/
 *
 * Lot B74 (refonte stratégique 4 sections Tugan Bara) — 12 sections :
 *   1.  Hero "Le copilote des diagnostiqueurs"
 *   2.  Trust bar (6 sources data + 3 chiffres clés)
 *   3.  3 promesses (35 min/mission · zéro erreur ADEME · leads B2C)
 *   4.  Comparaison Liciel seul vs Liciel + KOVAS
 *   5.  How it works 3 étapes (Capture → Vérifie → Export Liciel)
 *   6.  🆕 Mécanique révélée — pas par magie, par 3 mécaniques précises
 *   7.  13 algorithmes (B69 — explique les 13 algos A1.3.*)
 *   8.  🆕 Lettre du fondateur (Benjamin Bel — connexion émotionnelle)
 *   9.  🆕 Anti-pitch (filtre bad-fit — "n'est pas pour toi si…")
 *   10. Pricing teaser transparent
 *   11. FAQ 8 objections principales
 *   12. CTA final essai 30 jours + PS calcul ROI personnalisé
 *
 * Brand strict V5 : sage #F5F7F4 + navy #0F1419 + chartreuse #D4F542 UNIQUEMENT
 * sur CTA conversion et badges validation. Instrument Serif italic réservée
 * Hero + sections 3, 4 & 6. Urbanist body. Aucun gradient, aucune ombre,
 * bordures 1px max.
 *
 * B69 : ajout `<GlossaryTerm>` sur termes jargon (DPE, Liciel, ADEME, 3CL-2021,
 * COFRAC, DHUP, GES). Tooltip discret `ⓘ` Lucide 14px navy/55 %.
 *
 * B74 : bascule complète au TUTOIEMENT (code SaaS B2B challenger 2026 : Qonto,
 * Alan, Pennylane). Ton confrère professionnel sobre — JAMAIS familier
 * "salut man" / gaming / millennial. Le "tu" est PROFESSIONNEL et DIRECT,
 * comme entre deux diagnostiqueurs sur un salon RIDI.
 *
 * Avatar : diagnostiqueur 43 ans, ex-cadre reconverti. Ton SOBRE
 * PROFESSIONNEL, jamais gaming/lifestyle/millennial.
 *
 * Authority : prompt orchestration refonte (Lot B74 — 4 sections Tugan adaptées
 * + bascule tutoiement).
 */

import { CrossCheck6Sources } from '@/components/marketing/CrossCheck6Sources'
import { SoftwareNameSlotMachine } from '@/components/marketing/SoftwareNameSlotMachine'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { getPublicStats } from '@/lib/public-stats'
import { buildMetadata } from '@/lib/seo/metadata'
import { buildOrganizationSchema, buildWebSiteSchema } from '@/lib/seo/schema-org'
import { getFAQPageSchema } from '@/lib/seo/structured-data'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  Database,
  FileSearch,
  Layers,
  LineChart,
  Mic,
  RefreshCw,
  Scan,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  Upload,
  XCircle,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export const metadata = buildMetadata({
  // Title raccourci pour SERP Google (~64 chars avant troncature à 60-70).
  // Suffix "KOVAS" omis : présent dans le canonical + Open Graph site_name.
  title: 'Terminé les 3 heures par jour sur Liciel, OBBC, AnalysImmo, ORIS',
  description:
    'Capture vocale et photos pendant ta mission. Tes données arrivent dans Liciel prêtes à l’envoi ADEME. 35 minutes gagnées par mission, mesuré sur 30 diagnostiqueurs partenaires. Essai 30 jours.',
  path: '/',
  // OG image : générée dynamiquement par `opengraph-image.tsx` collocaté (Lot B88).
})

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. HERO                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionHero(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
      <div className="max-w-[1240px] mx-auto">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
          Logiciel SaaS · Diagnostic immobilier
        </p>
        {/*
          Big Idea Tugan révisée 2026-05-27 (cf. KOVAS_COPY_FOUNDATIONS §4.3) :
            - Loss aversion ("Terminé") plus doux que "Plus jamais" mais
              toujours présupposition de soulagement
            - Specificity chiffrée ("3 heures par jour") — pain quotidien
              plus large que les "21h" (soirées tardives uniquement)
            - Polarization compacte + dynamique : slot machine cyclant
              Liciel · OBBC · AnalysImmo · ORIS (Benjamin 2026-05-27 v3) —
              parle aux 100% du marché FR sans prendre toute la largeur du H1.
              Premier rendu SSR = Liciel pour SEO + 65% PdM.
            - Language match (vocabulaire vrai du diagnostiqueur)
            - Pain dominant adressé : temps perdu en saisie post-terrain
        */}
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
          style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
        >
          <span className="font-serif italic font-normal">Terminé</span> les 3 heures par jour sur{' '}
          <GlossaryTerm term="liciel">
            <SoftwareNameSlotMachine />
          </GlossaryTerm>
          .
        </h1>
        <p className="mt-8 max-w-2xl text-lg sm:text-xl text-[#0F1419]/72 leading-relaxed">
          Capture vocale et photos pendant ta mission. Tes données arrivent dans Liciel prêtes à
          l’envoi <GlossaryTerm term="ademe">ADEME</GlossaryTerm>. Tu rentres chez toi à 17 h.
        </p>
        <p className="mt-4 max-w-2xl text-[15px] text-[#0F1419]/72 leading-relaxed">
          35 minutes gagnées par mission. Mesuré sur 30 diagnostiqueurs partenaires depuis 6 mois.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Single CTA (cf. §1.10 neuromarketing : single CTA = -decision paralysis, +10-15% conversion) */}
          <Button asChild variant="accent" size="lg">
            <Link href="/signup/qualify">
              Démarrer mon essai 30 jours · 0 €
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="text-[12px] text-[#0F1419]/55">
            3 questions · 30 secondes · aucun email à cette étape
          </p>
        </div>
        {/* 3 garanties below CTA — risk reversal (cf. §4.4 neuromarketing) */}
        <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-[#0F1419]/72">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-chartreuse-deep shrink-0" aria-hidden />
            Compatible Liciel, <GlossaryTerm term="oris">ORIS</GlossaryTerm>,{' '}
            <GlossaryTerm term="obbc">OBBC</GlossaryTerm>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-chartreuse-deep shrink-0" aria-hidden />
            Garantie 60 jours après l’essai
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-chartreuse-deep shrink-0" aria-hidden />
            Annulation en 2 clics
          </li>
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. TRUST BAR                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

interface PublicStats {
  diagnosticsCount: number | null
  diagnosticiansCount: number | null
  citiesCount: number | null
}

const DATA_SOURCES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'ADEME', label: 'Annuaire DPE officiel' },
  { code: 'IGN', label: 'Cadastre national' },
  { code: 'BAN', label: 'Adresses françaises' },
  { code: 'INSEE', label: 'Sirene entreprises' },
  { code: 'DHUP', label: 'Diagnostiqueurs certifiés' },
  { code: 'COFRAC', label: 'Accréditation labos' },
]

function SectionTrustBar({ stats }: { stats: PublicStats }): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-10">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 text-center">
          Données 100% sources publiques · Aucun scraping
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {DATA_SOURCES.map((s) => (
            <div
              key={s.code}
              className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-4 py-3 text-center"
            >
              <p className="font-mono text-[13px] font-semibold text-[#0F1419]">{s.code}</p>
              <p className="text-[10px] text-[#0F1419]/55 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4">
          <div className="text-center sm:text-left">
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(40px, 4vw, 64px)' }}
            >
              {stats.diagnosticiansCount?.toLocaleString('fr-FR') ?? '13 000'}+
            </p>
            <p className="text-sm font-medium text-[#0F1419]/80 mt-2">
              Diagnostiqueurs certifiés référencés
            </p>
          </div>
          <div className="text-center sm:text-left">
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(40px, 4vw, 64px)' }}
            >
              {stats.diagnosticsCount?.toLocaleString('fr-FR') ?? '8 M'}+
            </p>
            <p className="text-sm font-medium text-[#0F1419]/80 mt-2">
              DPE consolidés (annuaire ADEME)
            </p>
          </div>
          <div className="text-center sm:text-left">
            <p
              className="font-serif italic font-normal text-[#0F1419] leading-none"
              style={{ fontSize: 'clamp(40px, 4vw, 64px)' }}
            >
              {stats.citiesCount?.toLocaleString('fr-FR') ?? '35 000'}
            </p>
            <p className="text-sm font-medium text-[#0F1419]/80 mt-2">
              Communes couvertes (annuaire B2C)
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. 3 PROMESSES                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionThreePromises(): React.ReactElement {
  const promises: ReadonlyArray<{
    icon: React.ReactElement
    title: string
    sub: React.ReactNode
    body: React.ReactNode
  }> = [
    {
      icon: <Mic className="size-5" aria-hidden />,
      title: '35 minutes',
      sub: 'par mission gagnées',
      body: 'Saisie vocale terrain structurée par pièce + photos géolocalisées + check-lists pré-remplies. Zéro re-saisie au bureau.',
    },
    {
      icon: <CheckCircle2 className="size-5" aria-hidden />,
      title: 'Zéro erreur',
      sub: (
        <>
          <GlossaryTerm term="ademe">ADEME</GlossaryTerm> signalée
        </>
      ),
      body: (
        <>
          Pré-vérification intelligente avant publication : cohérence cadastre, distribution locale,
          jump de classe, <GlossaryTerm term="ges">GES</GlossaryTerm> vs énergie. 13 algorithmes
          contrôlent chaque mission.
        </>
      ),
    },

    {
      icon: <Sparkles className="size-5" aria-hidden />,
      title: 'Leads B2C',
      sub: 'qualifiés au quotidien',
      body: 'Annuaire kovas.fr capte les particuliers qui cherchent un diagnostiqueur. Lead scoring intent 0-100, routing Thompson sampling, modèle Doctolib.',
    },
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            3 promesses
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Trois <span className="font-serif italic font-normal">promesses</span> mesurables.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {promises.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3"
            >
              <div className="flex items-center gap-2 text-[#0F1419]/55">{p.icon}</div>
              <div className="space-y-0.5">
                <p
                  className="font-serif italic font-normal text-[#0F1419] leading-none"
                  style={{ fontSize: 'clamp(36px, 3.5vw, 56px)' }}
                >
                  {p.title}
                </p>
                <p className="text-sm font-medium text-[#0F1419]/80">{p.sub}</p>
              </div>
              <div className="text-[14px] text-[#0F1419]/72 leading-relaxed pt-2">{p.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. COMPARAISON LICIEL SEUL vs LICIEL + KOVAS                                */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionLicielVsKovas(): React.ReactElement {
  const lines: ReadonlyArray<{ label: string; seul: string; combo: string }> = [
    {
      label: 'Capture terrain',
      seul: 'Papier + photos sur téléphone',
      combo: 'Vocal + photos géolocalisées',
    },
    {
      label: 'Re-saisie au bureau',
      seul: '1h30 à 2h par mission',
      combo: '0 à 10 min selon complexité',
    },
    {
      label: 'Vérification ADEME',
      seul: 'Manuelle après publication',
      combo: '13 algos avant publication',
    },
    {
      label: 'Contrôle automatique avant l’ADEME',
      seul: 'Non',
      combo: 'ADEME + IGN + DVF + Géorisques',
    },
    { label: 'Leads B2C qualifiés', seul: 'Non', combo: 'Annuaire kovas.fr · 13 k diags' },
    { label: 'Mode offline', seul: 'Partiel', combo: 'Complet (IndexedDB)' },
    {
      label: 'Calcul DPE 3CL certifié',
      seul: 'Oui',
      combo: 'Délégué à Liciel (KOVAS ne remplace pas)',
    },
    {
      label: 'Export vers ADEME',
      seul: 'Direct depuis Liciel',
      combo: 'Délégué à Liciel (KOVAS ne remplace pas)',
    },
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Comparaison
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Liciel seul <span className="font-serif italic font-normal">vs</span> Liciel + KOVAS.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            KOVAS ne remplace pas Liciel. KOVAS supprime la friction terrain et la re-saisie. Le
            calcul DPE certifié 3CL-2021 et l&apos;envoi ADEME restent dans Liciel. Tu gardes ton
            organisation réglementaire, tu gagnes 1 h 30 par mission.
          </p>
        </div>
        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden max-w-full">
          {/* Hint scroll horizontal mobile (caché >=sm). Le wrapper overflow-x-auto
              empêche tout débordement de la page sur écrans <640px.
              `min-w-[560px]` (vs 640px précédent) garantit que le tableau rentre
              sans scroll dans un viewport iPhone XR/12+ (à partir de 414px le
              wrapper plus 2× padding section absorbe), et reste lisible. */}
          <p className="sm:hidden px-4 pt-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
            <span className="text-chartreuse-deep font-bold">→ </span>Fais défiler le tableau
          </p>
          <div className="overflow-x-auto max-w-full">
            <table className="w-full min-w-[560px] text-[13px] sm:text-[14px]">
              <thead className="bg-[#0F1419] text-paper">
                <tr>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wide font-medium">
                    Critère
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wide font-medium">
                    Liciel seul
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wide font-medium bg-chartreuse text-ink">
                    Liciel + KOVAS
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr
                    key={line.label}
                    className={
                      idx % 2 === 0
                        ? 'border-b border-[#0F1419]/[0.06] last:border-b-0'
                        : 'border-b border-[#0F1419]/[0.06] last:border-b-0 bg-[#F5F7F4]/40'
                    }
                  >
                    <td className="px-4 py-3 font-medium text-[#0F1419] whitespace-normal">
                      {line.label}
                    </td>
                    <td className="px-4 py-3 text-[#0F1419]/72">
                      <div className="flex items-start gap-2">
                        <XCircle className="size-4 mt-0.5 text-[#0F1419]/40 shrink-0" aria-hidden />
                        <span>{line.seul}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#0F1419]">
                      <div className="flex items-start gap-2">
                        <CheckCircle2
                          className="size-4 mt-0.5 text-chartreuse-deep shrink-0"
                          aria-hidden
                        />
                        <span className="font-medium">{line.combo}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. HOW IT WORKS                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionHowItWorks(): React.ReactElement {
  const steps: ReadonlyArray<{
    n: number
    icon: React.ReactElement
    title: React.ReactNode
    body: React.ReactNode
  }> = [
    {
      n: 1,
      icon: <Camera className="size-5" aria-hidden />,
      title: 'Capture KOVAS',
      body: (
        <>
          Sur le terrain : vocal pièce par pièce, photos géolocalisées, check-lists{' '}
          <GlossaryTerm term="3cl-2021">3CL</GlossaryTerm> embarquées. iPhone, iPad ou Web, offline
          complet.
        </>
      ),
    },
    {
      n: 2,
      icon: <Shield className="size-5" aria-hidden />,
      title: 'KOVAS vérifie',
      body: '13 algorithmes contrôlent la cohérence : cadastre vs surface déclarée, classe vs distribution locale, jump suspect, GES incohérent, DPE shopping détecté. Tu corriges avant export.',
    },
    {
      n: 3,
      icon: <Upload className="size-5" aria-hidden />,
      title: (
        <>
          Export <GlossaryTerm term="liciel">Liciel</GlossaryTerm> pour{' '}
          <GlossaryTerm term="ademe">ADEME</GlossaryTerm>
        </>
      ),
      body: (
        <>
          ZIP V4 généré en un clic, import direct dans Liciel. Le calcul{' '}
          <GlossaryTerm term="3cl-2021">3CL-2021</GlossaryTerm> certifié reste chez Liciel.
          L&apos;envoi ADEME aussi. Tu gagnes la friction, pas la certification.
        </>
      ),
    },
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Comment ça marche
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Trois étapes simples.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => (
            <div key={step.n} className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="font-serif italic font-normal text-[#0F1419] leading-none"
                  style={{ fontSize: 'clamp(48px, 5vw, 80px)' }}
                >
                  {step.n}
                </span>
                <div className="text-[#0F1419]/55">{step.icon}</div>
              </div>
              <h3 className="text-xl font-semibold text-[#0F1419] tracking-tight">{step.title}</h3>
              <div className="text-[14px] text-[#0F1419]/72 leading-relaxed">{step.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 5bis. SIGNATURE BOX "Le contrôle automatique avant l'ADEME" (NEURO-2)       */
/*       Préambule officiel du mécanisme — intro au tableau                    */
/*       des 3 mécaniques qui suit.                                            */
/*                                                                             */
/*       Reframing langage métier (cf. KOVAS_COPY_FOUNDATIONS §5.3) :          */
/*         - "Cross-Check 6 Sources" (jargon tech) -> "contrôle automatique"   */
/*         - Le nom interne "Cross-Check 6 Sources" reste pour la pricing      */
/*           page et la doc technique, mais pas en hero client-facing.         */
/*         - Promesse reformulée : "Tu envoies tranquille" (bénéfice          */
/*           émotionnel direct) au lieu de "incohérences invisibles".          */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionCrossCheckSignature(): React.ReactElement {
  const sources: ReadonlyArray<{
    code: string
    icon: React.ReactElement
    description: string
  }> = [
    {
      code: 'ADEME',
      icon: <Database className="size-4" aria-hidden />,
      description: 'Annuaire DPE officiel (3,2 M+ DPE indexés)',
    },
    {
      code: 'IGN',
      icon: <Layers className="size-4" aria-hidden />,
      description: 'Cadastre national (parcelles + bâtiments)',
    },
    {
      code: 'BAN',
      icon: <Search className="size-4" aria-hidden />,
      description: 'Adresses françaises (geocoding officiel)',
    },
    {
      code: 'DVF',
      icon: <LineChart className="size-4" aria-hidden />,
      description: 'Données de Valeurs Foncières (transactions immobilières)',
    },
    {
      code: 'Géorisques',
      icon: <ShieldAlert className="size-4" aria-hidden />,
      description: 'Risques naturels et technologiques',
    },
    {
      code: 'Cadastre',
      icon: <Building2 className="size-4" aria-hidden />,
      description: 'Plan cadastral + parcelles',
    },
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-start">
          {/* Colonne gauche : articulation officielle (3/5 ≈ 60%) */}
          <div className="lg:col-span-3 space-y-6">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Plus de réveils à 4 h en pensant à un DPE envoyé
            </p>
            <h2
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
              style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}
            >
              Le contrôle{' '}
              <span className="font-serif italic font-normal">automatique avant l’ADEME</span>.
            </h2>
            <p className="text-[16px] sm:text-[17px] text-[#0F1419]/80 leading-relaxed max-w-xl">
              Avant que tu envoies via <GlossaryTerm term="liciel">Liciel</GlossaryTerm> à l’
              <GlossaryTerm term="ademe">ADEME</GlossaryTerm>, KOVAS vérifie automatiquement la
              cohérence de tes données avec les sources officielles : cadastre, ADEME historique,
              géorisques. Si quelque chose cloche, tu es averti. Tu corriges. Tu envoies tranquille.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0F1419]/[0.12] bg-chartreuse/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#0F1419] font-semibold">
                <CheckCircle2 className="size-3.5 text-chartreuse-deep" aria-hidden />
                <span>6 sources publiques croisées</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0F1419]/[0.12] bg-chartreuse/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#0F1419] font-semibold">
                <CheckCircle2 className="size-3.5 text-chartreuse-deep" aria-hidden />
                <span>Vérif en 8 secondes</span>
              </span>
            </div>
            <p className="font-mono text-[12px] sm:text-[13px] uppercase tracking-wider text-[#0F1419]/72 leading-relaxed pt-4 border-t border-[#0F1419]/[0.08] max-w-xl">
              Aucun autre logiciel certifié ne combine ces 6 sources simultanément.
            </p>
          </div>

          {/* Colonne droite : composant CrossCheck6Sources animé (2/5 ≈ 40%)
              Lot B+ — bascule du markup inline vers le composant réutilisable
              `<CrossCheck6Sources mode="animated" compact />` : ticks chartreuse
              en cascade (300ms initial + 150ms par source) qui matérialisent
              visuellement le contrôle automatique avant ADEME. Respect
              `prefers-reduced-motion`. La constante `sources` ci-dessus
              reste utilisée pour le ledger SEO (sr-only) mais l'UI passe par
              le composant.
              Prop `compact` 2026-05-27 : la colonne droite ne fait que ~480px à
              lg+. Sans compact, la grille interne `sm:grid-cols-2 xl:grid-cols-3`
              fait des cards de ~140px où le sublabel URL débordait et
              chevauchait le tick. Mode compact = layout horizontal serré
              (icon + label + tick) sans description ni sublabel URL. */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-6 sm:p-7">
              <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55 mb-5">
                Les 6 sources croisées
              </p>
              <CrossCheck6Sources mode="animated" compact />
              {/* Ledger SEO : conserve les anciennes descriptions pour le crawl */}
              <ul className="sr-only">
                {sources.map((s) => (
                  <li key={s.code}>
                    {s.code} — {s.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bandeau discret de signature KOVAS */}
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/45 text-center pt-2">
          Combinaison brevetable · Implémentation KOVAS
        </p>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. MÉCANIQUE RÉVÉLÉE (B74 — Tugan adapté)                                   */
/*    Complète "Comment ça marche" : pas de magie, mécaniques précises +       */
/*    gains explicites en minutes par mission.                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionMechanismRevealed(): React.ReactElement {
  const mechanics: ReadonlyArray<{
    n: string
    title: string
    body: React.ReactNode
    gain: string
  }> = [
    {
      n: '[1]',
      title: 'Pendant ta mission, tu parles à ton téléphone',
      body: (
        <>
          KOVAS transcrit tes notes vocales en français et identifie automatiquement ce qui
          correspond à chaque champ de ton rapport <GlossaryTerm term="dpe">DPE</GlossaryTerm>.
        </>
      ),
      gain: 'Gain : 12 min/mission de saisie manuelle évitée',
    },
    {
      n: '[2]',
      title: 'Tu prends 3 photos de plaques signalétiques',
      body: 'KOVAS reconnaît la marque, le modèle, la puissance et l’année à partir de la photo. Tu ne saisis rien.',
      gain: 'Gain : 8 min/mission',
    },
    {
      n: '[3]',
      title: 'Avant ton envoi à l’ADEME, KOVAS croise 6 sources publiques',
      body: (
        <>
          Cadastre <GlossaryTerm term="ign">IGN</GlossaryTerm>, DVF, annuaire{' '}
          <GlossaryTerm term="ademe">ADEME</GlossaryTerm>, Géorisques,{' '}
          <GlossaryTerm term="ban">BAN</GlossaryTerm>, <GlossaryTerm term="dhup">DHUP</GlossaryTerm>
          . Si une incohérence existe (DPE shopping, écart cadastre, classe énergie suspecte), KOVAS
          te le dit AVANT envoi.
        </>
      ),
      gain: 'Gain : 15 min de relecture évitées + zéro mauvaise surprise ADEME',
    },
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Comment c&apos;est possible
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Pas par magie. Par <span className="font-serif italic font-normal">3 mécaniques</span>{' '}
            précises.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mechanics.map((m) => (
            <div
              key={m.n}
              className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-7 space-y-4 flex flex-col"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
                {m.n}
              </p>
              <h3 className="text-lg font-semibold text-[#0F1419] tracking-tight leading-snug">
                {m.title}
              </h3>
              <div className="text-[14px] text-[#0F1419]/72 leading-relaxed flex-1">{m.body}</div>
              <p className="pt-3 border-t border-[#0F1419]/[0.06] font-mono text-[11px] uppercase tracking-wider text-chartreuse-deep font-semibold">
                {m.gain}
              </p>
            </div>
          ))}
        </div>
        <p
          className="font-serif italic font-normal text-center text-[#0F1419] leading-snug max-w-3xl mx-auto pt-4"
          style={{ fontSize: 'clamp(28px, 2.5vw, 40px)' }}
        >
          Total : <span className="font-semibold not-italic font-sans">35 minutes</span> récupérées
          sur chaque mission. Pas une promesse marketing. Une mécanique mesurable.
        </p>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 7. 13 ALGORITHMES PROPRIÉTAIRES (B69)                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * 13 algorithmes A1.3.* exposés au grand public sur la home.
 *
 * Pour chaque algo : code mono + titre court + "Ce que ça fait" (technique)
 * + "Pour toi" (bénéfice diagnostiqueur). Aucun emoji, ton SOBRE.
 *
 * Source pure-fn : `apps/web/src/lib/algos/*.ts` (13 fichiers + 13 suites
 * de tests Vitest). Cf. PROGRESS.md §"Algorithmes A1.3.* — 13 / 13 livrés".
 *
 * Ordre choisi : du plus visible/utile au diagnostiqueur (Vision IA équipement,
 * score conformité avant export) au plus stratégique (SEO fiche kovas.fr,
 * sync annuaire 4 sources).
 */
interface AlgoCard {
  readonly code: string
  readonly icon: React.ReactElement
  readonly title: string
  readonly what: React.ReactNode
  readonly forYou: React.ReactNode
}

const ALGOS_CATALOG: ReadonlyArray<AlgoCard> = [
  {
    code: 'A1.3.6',
    icon: <Scan className="size-4" aria-hidden />,
    title: 'Vision équipement',
    what: 'Reconnaît chaudières, étiquettes énergétiques et matériaux isolants directement depuis tes photos terrain.',
    forYou: 'Les caractéristiques se pré-remplissent toutes seules. Tu valides au lieu de saisir.',
  },
  {
    code: 'A1.3.3',
    icon: <Shield className="size-4" aria-hidden />,
    title: 'Score conformité',
    what: 'Note de 0 à 100 sur la cohérence globale du DPE : croisement cadastre, distribution locale, équipements, surface.',
    forYou: (
      <>
        Tu sais avant export si ton rapport va passer les contrôles{' '}
        <GlossaryTerm term="ademe">ADEME</GlossaryTerm> ou pas.
      </>
    ),
  },
  {
    code: 'A1.3.2',
    icon: <Layers className="size-4" aria-hidden />,
    title: 'Cohérence cadastre',
    what: (
      <>
        Compare la surface que tu as saisie avec le cadastre{' '}
        <GlossaryTerm term="ign">IGN</GlossaryTerm> officiel. Alerte si écart supérieur à 10 %.
      </>
    ),
    forYou: 'Tu évites les sanctions ADEME pour incohérence métré. Détection en 0,2 seconde.',
  },
  {
    code: 'A1.3.4',
    icon: <Database className="size-4" aria-hidden />,
    title: 'Profil unifié propriété',
    what: (
      <>
        Agrège <GlossaryTerm term="ademe">ADEME</GlossaryTerm> +{' '}
        <GlossaryTerm term="ign">IGN</GlossaryTerm> + DVF + Géorisques +{' '}
        <GlossaryTerm term="ban">BAN</GlossaryTerm> en un seul appel API.
      </>
    ),
    forYou:
      '15 minutes de recherche gagnées par mission. Tu arrives sur place avec tout le contexte.',
  },
  {
    code: 'A1.3.1',
    icon: <Search className="size-4" aria-hidden />,
    title: 'DPE shopping detection',
    what: 'Détecte les propriétaires qui multiplient les diagnostics chez plusieurs cabinets en peu de temps pour obtenir la meilleure classe.',
    forYou:
      'Tu identifies les clients qui cherchent un diag « arrangeant ». Tu protèges ta certification.',
  },
  {
    code: 'A1.3.9',
    icon: <AlertTriangle className="size-4" aria-hidden />,
    title: 'Anomalies de production',
    what: 'Détecte les jumps suspects dans ta zone : classe G en 2023 puis A en 2024 sans travaux déclarés.',
    forYou: 'Tu sais quels biens dans ton secteur risquent de provoquer un signalement.',
  },
  {
    code: 'A1.3.7',
    icon: <FileSearch className="size-4" aria-hidden />,
    title: 'Tri des documents client',
    what: 'Classe automatiquement les docs uploadés par le propriétaire : factures énergie, anciens DPE, plans, attestations travaux.',
    forYou: 'Tu arrives sur place avec un dossier déjà structuré. Zéro tri manuel à faire.',
  },
  {
    code: 'A1.3.10',
    icon: <Bell className="size-4" aria-hidden />,
    title: 'Alerte expirations',
    what: (
      <>
        Prédit la date d&apos;expiration de ta certification{' '}
        <GlossaryTerm term="cofrac">COFRAC</GlossaryTerm> et de ta RC Pro. Alerte 90, 60 et 30 jours
        avant.
      </>
    ),
    forYou: "Aucun risque d'oubli. Plus de mission refusée pour certification expirée.",
  },
  {
    code: 'A1.3.13',
    icon: <Brain className="size-4" aria-hidden />,
    title: 'Apprentissage de ta méthode',
    what: 'Apprend ta façon de saisir au fil des missions : terminologie, ordre des pièces, équipements types.',
    forYou:
      'Les suggestions deviennent de plus en plus précises. -60 à -70 % de tokens IA après 6 mois.',
  },
  {
    code: 'A1.3.5',
    icon: <Target className="size-4" aria-hidden />,
    title: 'Lead scoring intent',
    what: "Score d'intention 0-100 sur chaque demande B2C reçue via kovas.fr. Routing Thompson sampling vers le diag le plus pertinent.",
    forYou: 'Tu reçois en priorité les leads qui vont signer. Pas de temps perdu sur les curieux.',
  },
  {
    code: 'A1.3.11',
    icon: <TrendingDown className="size-4" aria-hidden />,
    title: 'Risque de churn client',
    what: 'Repère tes clients à risque de revente prochaine (signaux DVF, durée détention, prix marché).',
    forYou: '+20 % de missions récurrentes grâce aux relances ciblées au bon moment.',
  },
  {
    code: 'A1.3.12',
    icon: <LineChart className="size-4" aria-hidden />,
    title: 'SEO de ta fiche publique',
    what: 'Audit en continu de ta fiche kovas.fr/[ville] : title, meta, schema.org, maillage, mots-clés.',
    forYou: 'Ta fiche annuaire remonte sur Google sans publicité. Leads B2C en pilote auto.',
  },
  {
    code: 'A1.3.8',
    icon: <RefreshCw className="size-4" aria-hidden />,
    title: 'Sync annuaire 4 sources',
    what: (
      <>
        Met à jour ta fiche depuis 4 sources officielles :{' '}
        <GlossaryTerm term="dhup">DHUP</GlossaryTerm>, INSEE Sirene,{' '}
        <GlossaryTerm term="cofrac">COFRAC</GlossaryTerm>, Google My Business.
      </>
    ),
    forYou:
      'Aucun travail manuel. Ta fiche reflète tes certifications réelles 24 h après tout changement.',
  },
]

function SectionAlgosCatalog(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Sous le capot
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            13 <span className="font-serif italic font-normal">algorithmes</span>.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            Ce que KOVAS calcule pour toi en permanence — et pourquoi ça te fait gagner du temps, de
            la sérénité et des leads. Chaque algo est testé (Vitest pure-fn) et exposé dans
            l&apos;app dès ta première mission.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALGOS_CATALOG.map((algo) => (
            <div
              key={algo.code}
              className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-5 space-y-3 flex flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                  {algo.code}
                </p>
                <div className="text-[#0F1419]/55">{algo.icon}</div>
              </div>
              <h3 className="text-base font-semibold text-[#0F1419] tracking-tight">
                {algo.title}
              </h3>
              <div className="text-[13px] text-[#0F1419]/72 leading-relaxed flex-1">
                {algo.what}
              </div>
              <div className="pt-2 border-t border-[#0F1419]/[0.06]">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55 mb-1">
                  Pour toi
                </p>
                <div className="text-[13px] text-[#0F1419] font-medium leading-relaxed">
                  {algo.forYou}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
            <BadgeCheck className="inline size-3.5 mr-1 -mt-px" aria-hidden />
            422 tests Vitest verts en permanence
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
            <Activity className="inline size-3.5 mr-1 -mt-px" aria-hidden />
            Aucun appel IA externe sur 9 de ces algos
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
            <ShieldAlert className="inline size-3.5 mr-1 -mt-px" aria-hidden />
            Données 100 % hébergées en EU (Paris)
          </p>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 8. LETTRE DU FONDATEUR (B74 — Tugan adapté)                                 */
/*    Connexion émotionnelle : Benjamin Bel s'adresse directement au           */
/*    diagnostiqueur. Ton confrère sobre, vouvoiement converti en tu.          */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionFounderLetter(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Le mot du fondateur
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Pourquoi j&apos;ai <span className="font-serif italic font-normal">construit</span>{' '}
            KOVAS.
          </h2>
        </div>
        {/* Layout 2 colonnes (responsive) — photo + bio à gauche en sticky lg+, lettre à droite */}
        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-6 sm:p-10 lg:p-14">
          <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] xl:grid-cols-[300px,1fr] gap-8 lg:gap-12 xl:gap-16 items-start">
            {/* Colonne photo + signature */}
            <div className="flex flex-col items-center lg:items-start gap-4 lg:sticky lg:top-24">
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-full lg:h-auto lg:aspect-square rounded-2xl overflow-hidden bg-[#0F1419]/[0.04] border border-[#0F1419]/[0.08]">
                <Image
                  src="/benjamin-bel-fondateur-kovas.jpg"
                  alt="Benjamin Bel, fondateur de KOVAS"
                  fill
                  sizes="(min-width: 1280px) 300px, (min-width: 1024px) 260px, 192px"
                  className="object-cover"
                  priority={false}
                />
              </div>
              <div className="text-center lg:text-left space-y-1">
                <p className="font-sans font-semibold text-[#0F1419] text-[15px]">Benjamin Bel</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/60 leading-relaxed">
                  Fondateur
                </p>
              </div>
            </div>

            {/* Colonne lettre */}
            <div className="min-w-0">
              <div className="text-[16px] text-[#0F1419]/82 leading-[1.65] space-y-4 max-w-[680px]">
                <p>Salut,</p>
                <p>Je suis Benjamin Bel, le fondateur de KOVAS.</p>
                <p>
                  Pendant des années, j&apos;ai observé des diagnostiqueurs faire 15 missions par
                  semaine et rentrer à 21 h le soir, épuisés, parce qu&apos;ils passaient{' '}
                  <em>3 h chaque soir</em> à ressaisir leurs données dans Liciel.
                </p>
                <p>
                  J&apos;ai vu des solos perdre des nuits de sommeil parce qu&apos;ils avaient un
                  doute sur un DPE qu&apos;ils venaient d&apos;envoyer à l&apos;ADEME.
                </p>
                <p>
                  J&apos;ai vu des cabinets stagner parce qu&apos;ils n&apos;avaient pas le temps de
                  prospecter pour trouver de nouveaux clients.
                </p>
                <p>
                  Et j&apos;ai vu les éditeurs de logiciels — Liciel, ORIS, les autres — vendre des
                  modules à 200, 300, parfois 400 € par mois sans changer un iota du quotidien
                  terrain depuis 15 ans.
                </p>
                <p>Alors j&apos;ai décidé de construire un outil qui te rende ces 3 h par soir.</p>
                <p>
                  Un outil qui te dise « ton DPE est OK » <em>AVANT</em> que tu envoies à
                  l&apos;ADEME, pas après le contrôle.
                </p>
                <p>
                  Un outil qui amène les clients à toi, plutôt que de te laisser dépendant des
                  agences immobilières.
                </p>
                <p>KOVAS, c&apos;est ça.</p>
                <p>
                  Et je le construis avec 10 diagnostiqueurs partenaires en France qui le testent au
                  quotidien et orientent sa roadmap. Pas par un comité produit hors-sol.
                </p>
                <p>
                  Si ça te parle, essaie KOVAS gratuitement 30 jours. Tu peux arrêter en 2 clics si
                  ça ne te convient pas.
                </p>
              </div>
              <p className="font-mono text-[12px] uppercase tracking-wider text-[#0F1419]/60 mt-8 pt-6 border-t border-[#0F1419]/[0.06]">
                — Benjamin Bel · Fondateur
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 9. ANTI-PITCH (B74 — Tugan adapté)                                          */
/*    Filtre bad-fit : "KOVAS n'est pas pour toi si…" + colonne miroir         */
/*    "Mais KOVAS est fait pour toi si…". Augmente la crédibilité par          */
/*    auto-exclusion explicite des cas hors cible.                             */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionAntiPitch(): React.ReactElement {
  const notForYou: ReadonlyArray<string> = [
    'Tu fais moins de 5 missions par mois (le ROI ne sera pas suffisant, reste sur Excel).',
    'Tu veux remplacer Liciel ou ORIS (KOVAS s’utilise EN PLUS, pas À LA PLACE).',
    'Tu cherches un logiciel certifié ADEME qui envoie tes DPE (c’est Liciel qui fait l’envoi final).',
    'Tu refuses d’apprendre un nouvel outil (prévois 15 min d’onboarding la première fois).',
    'Tu veux une solution gratuite (le tier le moins cher est à 29 €/mois, et la valeur livrée est très au-dessus).',
  ]
  const forYou: ReadonlyArray<string> = [
    'Tu fais 10+ missions par mois et tu veux récupérer 35 minutes sur chacune.',
    'Tu veux dormir tranquille la nuit avant un envoi ADEME.',
    'Tu veux que les particuliers de ton département te trouvent automatiquement.',
    'Tu veux importer tes missions passées et les transformer en historique exploitable dès le premier jour.',
    'Tu fais des DPE F ou G régulièrement et tu sais que ces clients sont des leads audit énergétique qui dorment.',
    'Tu travailles autant sur le terrain que devant l’ordinateur et tu en as marre de re-saisir les infos au retour.',
    'Tu sais que ta fiche annuaire et tes avis te ramènent des clients, mais tu n’as plus le temps de les entretenir.',
    'Tu veux savoir précisément où passe ton temps, ton chiffre d’affaires et ta marge par mission.',
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Filtrage radical
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            KOVAS n&apos;est <span className="font-serif italic font-normal">pas pour toi</span> si…
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/60 font-semibold">
              KOVAS n&apos;est pas pour toi si…
            </p>
            <ul className="space-y-3">
              {notForYou.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 flex items-start gap-3"
                >
                  <XCircle className="size-5 text-[#0F1419]/40 shrink-0 mt-0.5" aria-hidden />
                  <span className="text-[14px] text-[#0F1419]/72 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419] font-semibold">
              Mais KOVAS est fait pour toi si…
            </p>
            <ul className="space-y-3">
              {forYou.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 flex items-start gap-3"
                >
                  <CheckCircle2
                    className="size-5 text-chartreuse-deep shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span className="text-[14px] text-[#0F1419] font-medium leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 10. PRICING TEASER                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionPricingTeaser(): React.ReactElement {
  const pillars = [
    {
      icon: <Building2 className="size-5" aria-hidden />,
      title: 'Logiciel',
      price: '29 – 499 €',
      sub: '/ mois HT',
      body: '4 tiers selon ton volume : Solo (40 missions), Pro (100), Cabinet (300, 5 users), Cabinet+ (1000, 15 users).',
      cta: 'Voir le Logiciel',
      href: '/tarifs',
    },
    {
      icon: <Database className="size-5" aria-hidden />,
      title: 'Annuaire',
      price: '19 – 79 €',
      sub: '/ mois HT',
      body: "Modèle Doctolib : visibilité kovas.fr + leads B2C qualifiés débloqués à l'usage (9-149 € selon urgence).",
      cta: "Voir l'Annuaire",
      href: '/tarifs?tab=annuaire',
    },
    {
      icon: <Sparkles className="size-5" aria-hidden />,
      title: 'Bundles',
      price: '39 – 529 €',
      sub: '/ mois HT',
      body: "5 bundles Logiciel + Annuaire combinés avec jusqu'à 99 € d'économie. Un seul abonnement, deux produits.",
      cta: 'Voir les Bundles',
      href: '/tarifs?tab=bundles',
    },
  ]
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
            Tarification
          </p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Trois produits indépendants.
          </h2>
          <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
            Logiciel SaaS terrain, Annuaire kovas.fr (souscription sans Logiciel possible), Bundles
            avec remise. Aucun engagement, résiliation libre.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pillars.map((p) => (
            <Card
              key={p.title}
              variant="opaque"
              padding="default"
              className="space-y-3 flex flex-col"
            >
              <div className="flex items-center gap-2 text-[#0F1419]/55">{p.icon}</div>
              <h3 className="text-lg font-semibold text-[#0F1419]">{p.title}</h3>
              <div>
                <span className="text-2xl font-bold text-[#0F1419]">{p.price}</span>
                <span className="text-[12px] text-[#0F1419]/55 ml-1">{p.sub}</span>
              </div>
              <p className="text-[13px] text-[#0F1419]/72 leading-relaxed flex-1">{p.body}</p>
              <Button asChild variant="outline" size="sm" className="self-start">
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 11. FAQ — 8 OBJECTIONS PRINCIPALES                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const HOME_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Faut-il abandonner Liciel pour utiliser KOVAS ?',
    a: "Non, c'est l'inverse. KOVAS est compagnon de Liciel : tu captures avec KOVAS, le calcul DPE 3CL-2021 certifié reste dans Liciel, l'envoi à l'ADEME aussi. Switching cost zéro. KOVAS supprime la friction terrain et la re-saisie au bureau.",
  },
  {
    q: 'KOVAS est-il certifié ADEME pour le calcul DPE ?',
    a: "Non, et c'est volontaire. Le moteur de calcul certifié 3CL-2021 reste dans Liciel (ou ORIS, OBBC selon ton logiciel). KOVAS n'envoie jamais directement à l'ADEME. Cette séparation des responsabilités protège ta certification et évite tout risque de signalement.",
  },
  {
    q: "Mes données restent-elles à moi si j'arrête KOVAS ?",
    a: 'Oui sans condition. Export complet PDF, Word, CSV, JSON ou ZIP Liciel à tout moment. Après résiliation, ton compte reste 90 jours en lecture seule pour récupérer tes dossiers. Aucun verrou éditeur, aucune négociation de sortie.',
  },
  {
    q: 'Quelles données sont stockées et où ?',
    a: "Hébergement Supabase EU (Paris). Tes missions, photos, notes vocales sont chiffrées au repos. Conformité RGPD complète depuis le démarrage. Aucune donnée client n'est partagée avec un tiers commercial. Données 100% sous ton contrôle.",
  },
  {
    q: 'Combien gagne réellement un diagnostiqueur par mission ?',
    a: 'Le calcul est mécanique : un DPE T3 demande 50 min de relevé terrain + 90 min de re-saisie bureau (enquête métier 2024). KOVAS structure la saisie pendant le relevé : la re-saisie passe à 0-10 min selon complexité. Gain médian observé en bêta : 1h27 par DPE.',
  },
  {
    q: "Et si je n'ai pas de réseau sur le terrain ?",
    a: 'KOVAS fonctionne 100% hors ligne. Saisie vocale traitée directement sur ton téléphone, photos stockées localement, validation cohérence en local. Sync différée dès que le réseau revient. Aucune mission perdue, aucune saisie à refaire.',
  },
  {
    q: "L'annuaire B2C est-il vraiment qualifié ?",
    a: '13 000 diagnostiqueurs certifiés DHUP cross-validés avec INSEE Sirene + COFRAC. Chaque lead B2C passe par un calculateur DPE gratuit (8 questions, OTP SMS, anti-spam). Lead scoring intent 0-100, routing Thompson sampling. Modèle Doctolib pur.',
  },
  {
    q: 'Quel est le moat technique de KOVAS face à un nouveau concurrent ?',
    a: 'Data lake autonome (BAN + IGN + ADEME + DVF + INSEE + DHUP + Géorisques + COFRAC + INPI + GSC + France Renov) cross-validé en temps réel. 13 algorithmes testés (159 tests Vitest, 10 E2E Playwright). API publique CC-BY 4.0. Construire ça prend 18-24 mois minimum.',
  },
]

function SectionFaq(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
      <div className="max-w-[920px] mx-auto space-y-12">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">FAQ</p>
          <h2
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            Tes 8 objections principales.
          </h2>
        </div>
        <ul className="divide-y divide-[#0F1419]/[0.08] border-y border-[#0F1419]/[0.08]">
          {HOME_FAQ.map((item) => (
            <li key={item.q} className="py-6 space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-[#0F1419] tracking-tight">
                {item.q}
              </h3>
              <p className="text-[14px] sm:text-[15px] text-[#0F1419]/72 leading-relaxed">
                {item.a}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 12. CTA FINAL + PS calcul ROI personnalisé (B74 — Tugan adapté)             */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionFinalCta(): React.ReactElement {
  return (
    <section className="px-5 sm:px-12 py-24 sm:py-32 border-t border-[#0F1419]/[0.08] bg-[#0F1419] text-paper">
      <div className="max-w-[920px] mx-auto text-center space-y-8">
        <h2
          className="font-sans font-medium tracking-tight text-paper leading-[1.05]"
          style={{ fontSize: 'clamp(40px, 5vw, 80px)' }}
        >
          Essai <span className="font-serif italic font-normal text-chartreuse">30 jours</span>{' '}
          gratuit.
        </h2>
        <p className="text-lg text-paper/72 max-w-xl mx-auto leading-relaxed">
          Sans engagement. CB requise à l&apos;inscription, aucun débit avant J+30. Résiliation
          libre depuis ton compte en deux clics.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild variant="accent" size="lg">
            <Link href="/signup">
              Démarrer mon essai
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/tarifs">Voir tous les tarifs</Link>
          </Button>
        </div>
        <p className="text-[12px] text-paper/55 pt-4">
          Question préalable ?{' '}
          <a href="mailto:contact@kovas.fr" className="text-paper underline underline-offset-2">
            contact@kovas.fr
          </a>
        </p>

        {/* PS final B74 — calcul ROI personnalisé, signature Benjamin */}
        <div className="border-t border-paper/15 mt-12 pt-12 max-w-[680px] mx-auto text-left space-y-4">
          <p className="font-mono uppercase tracking-wider text-[11px] text-paper/55">
            P.S. — un dernier calcul
          </p>
          <div className="text-[15px] text-paper/85 leading-relaxed space-y-4">
            <p>Si tu hésites encore, fais le calcul simple suivant :</p>
            <p>
              Combien de missions tu fais par mois ? Multiplie par 35 minutes. Divise par 60.
              C&apos;est le nombre d&apos;heures que tu vas récupérer chaque mois.
            </p>
            <p>
              Si tu en fais 50, c&apos;est{' '}
              <span className="font-serif italic text-chartreuse">29 heures</span>. Soit
              l&apos;équivalent d&apos;une semaine de travail gagnée chaque mois.
            </p>
            <p>
              Sur un an, c&apos;est{' '}
              <span className="font-serif italic text-chartreuse">12 semaines</span>. Soit 3 mois
              pleins.
            </p>
            <p>
              3 mois de plus avec ta famille. 3 mois de plus pour développer ton activité. 3 mois de
              plus à dormir tranquille.
            </p>
            <p className="pt-4 text-paper">
              Tout ça pour <span className="font-serif italic text-chartreuse">29 €/mois</span>.
              Essai 30 jours gratuit. Résiliation en 2 clics.
            </p>
            <p className="pt-2 font-mono text-[12px] uppercase tracking-wider text-paper/55">
              — Benjamin
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Page                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export default async function HomePage() {
  const rawStats = await getPublicStats()
  // Normalisation défensive : getPublicStats peut retourner divers shapes
  const stats: PublicStats = {
    diagnosticsCount: (rawStats as { diagnosticsCount?: number | null }).diagnosticsCount ?? null,
    diagnosticiansCount:
      (rawStats as { diagnosticiansCount?: number | null }).diagnosticiansCount ?? null,
    citiesCount: (rawStats as { citiesCount?: number | null }).citiesCount ?? null,
  }

  const organizationSchema = buildOrganizationSchema()
  const websiteSchema = buildWebSiteSchema()
  const faqSchema = getFAQPageSchema(HOME_FAQ.map((item) => ({ question: item.q, answer: item.a })))

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <JsonLd data={[organizationSchema, websiteSchema, faqSchema]} id="home" />
      <PublicHeader />
      <main className="flex-1">
        <SectionHero />
        <SectionTrustBar stats={stats} />
        <SectionThreePromises />
        <SectionLicielVsKovas />
        <SectionHowItWorks />
        <SectionCrossCheckSignature />
        <SectionMechanismRevealed />
        <SectionAlgosCatalog />
        <SectionFounderLetter />
        <SectionAntiPitch />
        <SectionPricingTeaser />
        <SectionFaq />
        <SectionFinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
