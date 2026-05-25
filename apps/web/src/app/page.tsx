/**
 * KOVAS — Homepage marketing kovas.fr/
 *
 * Lot B35 (post-pivot SaaS-only) — Refonte 8 sections strictes :
 *   1. Hero "Le copilote des diagnostiqueurs"
 *   2. Trust bar (6 sources data + 3 chiffres clés)
 *   3. 3 promesses (35 min/mission · zéro erreur ADEME · leads B2C)
 *   4. Comparaison Liciel seul vs Liciel + KOVAS
 *   5. How it works 3 étapes (Capture → Vérifie → Export Liciel)
 *   6. Pricing teaser transparent
 *   7. FAQ 8 objections principales
 *   8. CTA final essai 30 jours
 *
 * Brand strict V5 : sage #F5F7F4 + navy #0F1419 + chartreuse #D4F542 UNIQUEMENT
 * sur CTA conversion et badges validation. Instrument Serif italic réservée
 * Hero + sections 3 & 4. Urbanist body. Aucun gradient, aucune ombre,
 * bordures 1px max.
 *
 * Avatar : diagnostiqueur 43 ans, ex-cadre reconverti. Ton SOBRE
 * PROFESSIONNEL, vouvoiement, jamais gaming/lifestyle/millennial.
 *
 * Authority : prompt orchestration refonte (Update 3 — homepage 8 sections).
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getPublicStats } from '@/lib/public-stats'
import { buildMetadata } from '@/lib/seo/metadata'
import { buildOrganizationSchema, buildWebSiteSchema } from '@/lib/seo/schema-org'
import { getFAQPageSchema } from '@/lib/seo/structured-data'
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Database,
  Mic,
  Shield,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = buildMetadata({
  title: 'Logiciel diagnostic immobilier compagnon Liciel | KOVAS',
  description:
    'Logiciel SaaS pour diagnostiqueurs immobiliers, compagnon Liciel, ORIS, OBBC. Saisie vocale terrain, photos géolocalisées, exports ZIP. 1h30 gagnée par DPE. Essai 30 jours.',
  path: '/',
  ogImage: '/og-images/home.png',
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
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
          style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
        >
          Le <span className="font-serif italic font-normal">copilote</span> des diagnostiqueurs.
        </h1>
        <p className="mt-8 max-w-2xl text-lg sm:text-xl text-[#0F1419]/72 leading-relaxed">
          Compatible Liciel, ORIS, OBBC. Vous capturez sur le terrain, KOVAS vérifie en temps réel,
          vous exportez vers votre logiciel principal. 1 h 30 gagnée par mission DPE.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href="/signup">
              Essai 30 jours gratuit
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/demo">Voir la démo</Link>
          </Button>
          <p className="text-[12px] text-[#0F1419]/55 ml-1">
            CB requise · débit auto J+30 · résiliation libre
          </p>
        </div>
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
  const promises = [
    {
      icon: <Mic className="size-5" aria-hidden />,
      title: '35 minutes',
      sub: 'par mission gagnées',
      body: 'Saisie vocale terrain structurée par pièce + photos géolocalisées + check-lists pré-remplies. Zéro re-saisie au bureau.',
    },
    {
      icon: <CheckCircle2 className="size-5" aria-hidden />,
      title: 'Zéro erreur',
      sub: 'ADEME signalée',
      body: 'Pré-vérification intelligente avant publication : cohérence cadastre, distribution locale, jump de classe, GES vs énergie. 13 algorithmes contrôlent chaque mission.',
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
              <p className="text-[14px] text-[#0F1419]/72 leading-relaxed pt-2">{p.body}</p>
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
      label: 'Cross-check sources publiques',
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
            calcul DPE certifié 3CL-2021 et l&apos;envoi ADEME restent dans Liciel.
          </p>
        </div>
        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden">
          <table className="w-full text-[13px] sm:text-[14px]">
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
                  <td className="px-4 py-3 font-medium text-[#0F1419]">{line.label}</td>
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
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. HOW IT WORKS                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionHowItWorks(): React.ReactElement {
  const steps = [
    {
      n: 1,
      icon: <Camera className="size-5" aria-hidden />,
      title: 'Capture KOVAS',
      body: 'Sur le terrain : vocal pièce par pièce, photos géolocalisées, check-lists 3CL embarquées. iPhone, iPad ou Web, offline complet.',
    },
    {
      n: 2,
      icon: <Shield className="size-5" aria-hidden />,
      title: 'KOVAS vérifie',
      body: '13 algorithmes contrôlent la cohérence : cadastre vs surface déclarée, classe vs distribution locale, jump suspect, GES incohérent, DPE shopping détecté. Vous corrigez avant export.',
    },
    {
      n: 3,
      icon: <Upload className="size-5" aria-hidden />,
      title: 'Export Liciel pour ADEME',
      body: "ZIP V4 généré en un clic, import direct dans Liciel. Le calcul 3CL-2021 certifié reste chez Liciel. L'envoi ADEME aussi. Vous gagnez la friction, pas la certification.",
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
              <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. PRICING TEASER                                                           */
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
/* 7. FAQ — 8 OBJECTIONS PRINCIPALES                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const HOME_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Faut-il abandonner Liciel pour utiliser KOVAS ?',
    a: "Non, c'est l'inverse. KOVAS est compagnon de Liciel : vous capturez avec KOVAS, le calcul DPE 3CL-2021 certifié reste dans Liciel, l'envoi à l'ADEME aussi. Switching cost zéro. KOVAS supprime la friction terrain et la re-saisie au bureau.",
  },
  {
    q: 'KOVAS est-il certifié ADEME pour le calcul DPE ?',
    a: "Non, et c'est volontaire. Le moteur de calcul certifié 3CL-2021 reste dans Liciel (ou ORIS, OBBC selon votre logiciel). KOVAS n'envoie jamais directement à l'ADEME. Cette séparation des responsabilités protège votre certification et évite tout risque de signalement.",
  },
  {
    q: "Mes données restent-elles à moi si j'arrête KOVAS ?",
    a: 'Oui sans condition. Export complet PDF, Word, CSV, JSON ou ZIP Liciel à tout moment. Après résiliation, votre compte reste 90 jours en lecture seule pour récupérer vos dossiers. Aucun verrou propriétaire, aucune négociation de sortie.',
  },
  {
    q: 'Quelles données sont stockées et où ?',
    a: "Hébergement Supabase EU (Paris). Vos missions, photos, notes vocales sont chiffrées au repos. Conformité RGPD complète depuis le démarrage. Aucune donnée client n'est partagée avec un tiers commercial. Données 100% sous votre contrôle.",
  },
  {
    q: 'Combien gagne réellement un diagnostiqueur par mission ?',
    a: 'Le calcul est mécanique : un DPE T3 demande 50 min de relevé terrain + 90 min de re-saisie bureau (enquête métier 2024). KOVAS structure la saisie pendant le relevé : la re-saisie passe à 0-10 min selon complexité. Gain médian observé en bêta : 1h27 par DPE.',
  },
  {
    q: "Et si je n'ai pas de réseau sur le terrain ?",
    a: 'KOVAS fonctionne 100% hors ligne. Saisie vocale traitée localement (Whisper iOS), photos stockées en IndexedDB, validation cohérence en local. Sync différée dès que le réseau revient. Aucune mission perdue, aucune saisie à refaire.',
  },
  {
    q: "L'annuaire B2C est-il vraiment qualifié ?",
    a: '13 000 diagnostiqueurs certifiés DHUP cross-validés avec INSEE Sirene + COFRAC. Chaque lead B2C passe par un calculateur DPE gratuit (8 questions, OTP SMS, anti-spam). Lead scoring intent 0-100, routing Thompson sampling. Modèle Doctolib pur.',
  },
  {
    q: 'Quel est le moat technique de KOVAS face à un nouveau concurrent ?',
    a: 'Data lake autonome (BAN + IGN + ADEME + DVF + INSEE + DHUP + Géorisques + COFRAC + INPI + GSC + France Renov) cross-validé en temps réel. 13 algorithmes propriétaires testés (159 tests Vitest, 10 E2E Playwright). API publique CC-BY 4.0. Construire ça prend 18-24 mois minimum.',
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
            Vos 8 objections principales.
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
/* 8. CTA FINAL                                                                */
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
          libre depuis votre compte en deux clics.
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
        <SectionPricingTeaser />
        <SectionFaq />
        <SectionFinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
