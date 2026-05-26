/**
 * KOVAS — Page /a-propos
 *
 * Refonte FIX-Y (2026-05-23) : remplacement du discours générique "ex-cadre"
 * par le vrai parcours de Benjamin Bel, recoupé depuis :
 *   - LinkedIn public (titre : Directeur & Associé Maison Belvar)
 *   - societe.com manager (NEXUS 1993, BUBBLE ROUEN, Monsieur Benjamin Bel
 *     indépendant immobilier 2020-2025, SIREN 810268755, Ouville-la-Rivière 76)
 *   - benjamin-maisonbel.fr (offre de vente immobilière sans agence en Normandie)
 *   - CLAUDE.md (fondateur SASU Nexus 1993, basé à Dieppe Normandie)
 *
 * Ton SOBRE PROFESSIONNEL strict (avatar diagnostiqueur 43 ans) :
 * vouvoiement avec le lecteur, paragraphes factuels, AUCUNE fiction
 * romancée, AUCUN superlatif ("expert", "leader", "passionné" interdits).
 *
 * Brand V5 : sage `#F5F7F4` + navy `#0F1419` + chartreuse `#D4F542` accent.
 *
 * JSON-LD : graph Person (Benjamin Bel) + Organization (NEXUS 1993) +
 * AboutPage. Person.worksFor référence NEXUS 1993 ; sameAs lié au profil
 * LinkedIn public et à benjamin-maisonbel.fr pour la consolidation SEO
 * fondateur (Knowledge Graph signals).
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { KOVAS_SITE_URL, buildMetadata } from '@/lib/seo/metadata'
import { ArrowRight, Building2, Mail, MapPin } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'

const FOUNDER = {
  fullName: 'Benjamin Bel',
  displayTitle: 'Fondateur et président — SASU Nexus 1993',
  currentRoleLinkedIn: 'Directeur & Associé chez Maison Belvar',
  location: 'Dieppe, Normandie (Seine-Maritime · 76)',
  email: COMPANY_IDENTITY.emails.contactGeneral,
  linkedinUrl: 'https://www.linkedin.com/in/benjaminbel/',
  maisonBelUrl: 'https://benjamin-maisonbel.fr/',
} as const

export const metadata = buildMetadata({
  title: 'À propos — Benjamin Bel, fondateur KOVAS et Nexus 1993 | KOVAS',
  description:
    'Benjamin Bel, fondateur de KOVAS et président de la SASU Nexus 1993. Entrepreneur normand basé à Dieppe, opérateur immobilier indépendant depuis 2020, à l’origine de KOVAS.',
  path: '/a-propos',
  // OG image : générée dynamiquement par `opengraph-image.tsx` collocaté (Lot B88).
})

function buildJsonLd() {
  const orgId = `${KOVAS_SITE_URL}/#organization`
  const personId = `${KOVAS_SITE_URL}/a-propos#benjamin-bel`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: COMPANY_IDENTITY.brands.umbrella,
        legalName: COMPANY_IDENTITY.legalName,
        url: KOVAS_SITE_URL,
        founder: { '@id': personId },
        foundingDate: COMPANY_IDENTITY.incorporatedAt,
        address: {
          '@type': 'PostalAddress',
          streetAddress: COMPANY_IDENTITY.address.line1,
          postalCode: COMPANY_IDENTITY.address.postalCode,
          addressLocality: COMPANY_IDENTITY.address.city,
          addressCountry: 'FR',
        },
        taxID: COMPANY_IDENTITY.vatIntracom,
        identifier: COMPANY_IDENTITY.sirenFormatted,
      },
      {
        '@type': 'Person',
        '@id': personId,
        name: FOUNDER.fullName,
        givenName: 'Benjamin',
        familyName: 'Bel',
        jobTitle: 'Président de NEXUS 1993 · Fondateur de KOVAS',
        worksFor: { '@id': orgId },
        founder: { '@id': orgId },
        nationality: 'FR',
        homeLocation: {
          '@type': 'Place',
          name: 'Dieppe, Normandie, France',
        },
        sameAs: [FOUNDER.linkedinUrl, FOUNDER.maisonBelUrl],
        url: `${KOVAS_SITE_URL}/a-propos`,
        email: `mailto:${FOUNDER.email}`,
      },
      {
        '@type': 'AboutPage',
        '@id': `${KOVAS_SITE_URL}/a-propos#aboutpage`,
        url: `${KOVAS_SITE_URL}/a-propos`,
        name: 'À propos de KOVAS — Benjamin Bel',
        inLanguage: 'fr-FR',
        isPartOf: { '@id': `${KOVAS_SITE_URL}/#website` },
        about: [{ '@id': orgId }, { '@id': personId }],
        breadcrumb: { '@id': `${KOVAS_SITE_URL}/a-propos#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${KOVAS_SITE_URL}/a-propos#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: KOVAS_SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'À propos',
            item: `${KOVAS_SITE_URL}/a-propos`,
          },
        ],
      },
    ],
  }
}

export default function AProposPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <Script
        id="apropos-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />

      <PublicHeader />

      <main className="flex-1">
        {/* HERO — identité fondateur */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto grid gap-10 lg:grid-cols-[260px_1fr] lg:items-end">
            {/* Portrait placeholder (pas d'image inventée) */}
            <div className="flex justify-start">
              <div
                aria-hidden
                className="size-44 sm:size-56 rounded-full bg-[#0F1419]/[0.06] border border-[#0F1419]/[0.1] flex items-center justify-center"
              >
                <span className="font-serif italic font-normal text-[#0F1419]/72 text-[64px] leading-none">
                  BB
                </span>
              </div>
            </div>

            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
                À propos · Fondateur
              </p>
              <h1
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-3xl"
                style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
              >
                Benjamin Bel,{' '}
                <span className="font-serif italic font-normal">fondateur de KOVAS</span>.
              </h1>
              <p className="mt-6 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
                Dirigeant de la SASU Nexus 1993 (Paris 8), entrepreneur normand basé à Dieppe,
                opérateur indépendant dans l&apos;immobilier depuis 2020. Je conçois KOVAS comme la
                couche terrain mobile que les logiciels métiers historiques n&apos;ont jamais pris
                le temps d&apos;ajouter.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#0F1419]/72">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4" aria-hidden />
                  {FOUNDER.location}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Building2 className="size-4" aria-hidden />
                  Président — {COMPANY_IDENTITY.legalName}
                </span>
                <a
                  href={FOUNDER.linkedinUrl}
                  target="_blank"
                  rel="noreferrer noopener me"
                  className="font-mono uppercase tracking-wider text-xs text-[#0F1419]/72 hover:text-[#0F1419] underline-offset-4 hover:underline"
                >
                  LinkedIn ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 — MON PARCOURS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Mon parcours
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p className="text-xl sm:text-2xl font-medium text-[#0F1419] leading-snug">
                Trois cycles d&apos;entrepreneuriat : sport, immobilier indépendant, édition
                logicielle. C&apos;est à l&apos;intersection de ces trois métiers que KOVAS prend
                son sens.
              </p>
              <p>
                Mon premier cycle d&apos;entrepreneur a démarré en 2015 avec la création de la
                société Bubble Rouen, dans le secteur des activités sportives, en Seine-Maritime.
                J&apos;y ai appris la gestion opérationnelle d&apos;une petite structure de services
                : recrutement, prestation client direct, comptabilité courante, conformité
                administrative. La structure a été clôturée en 2018 dans un cadre ordonné, après
                trois années d&apos;exploitation.
              </p>
              <p>
                En octobre 2020, j&apos;ai lancé mon activité indépendante dans l&apos;immobilier
                (entreprise individuelle Monsieur Benjamin Bel, code APE agences immobilières, siège
                en Seine-Maritime). Pendant cinq ans, j&apos;ai accompagné des particuliers sur
                leurs ventes et leurs acquisitions en Normandie. C&apos;est dans ce cadre que
                j&apos;ai croisé régulièrement le travail des diagnostiqueurs immobiliers : visites
                communes, échanges sur les classes énergétiques, lectures de rapports DPE, amiante,
                plomb, gaz, électricité, Carrez. C&apos;est là que j&apos;ai vu, de
                l&apos;intérieur, le décalage entre la modernité du terrain et la rusticité des
                outils logiciels utilisés.
              </p>
              <p>
                En décembre 2023, j&apos;ai créé la SASU Nexus 1993, structure éditrice actuelle de
                KOVAS, immatriculée au RCS de Paris (siège 66 Avenue des Champs-Élysées). En
                parallèle, je poursuis aujourd&apos;hui une activité de directeur et associé chez
                Maison Belvar, marque de vente immobilière sans agence en Normandie. Cette double
                appartenance — opérateur immobilier sur le terrain ET éditeur logiciel — est le
                socle de KOVAS : je ne construis pas une plateforme depuis un bureau parisien, je la
                construis en gardant un pied dans la réalité régionale du métier.
              </p>
              <p>
                Le cycle KOVAS démarre officiellement en avril 2026, en solopreneur, avec un
                objectif de un million d&apos;euros de chiffre d&apos;affaires récurrent à
                vingt-quatre mois et sans levée de fonds. Le lancement public est prévu pour
                septembre-octobre 2026, après une bêta privée d&apos;une quarantaine de
                diagnostiqueurs.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2 — POURQUOI KOVAS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Pourquoi KOVAS
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p>
                Le diagnostic immobilier français repose à quatre-vingt-douze pour cent sur huit
                prestations standards : DPE, amiante, plomb CREP, gaz, électricité, termites,
                mesurage Carrez ou Boutin, état des risques. Sur chacune de ces missions, le
                diagnostiqueur passe en moyenne entre une heure trente et deux heures de retour au
                bureau pour ressaisir des informations déjà collectées sur le terrain.
              </p>
              <p>
                Cette friction n&apos;est pas une fatalité. Elle vient du fait que les éditeurs
                historiques — Liciel, OBBC, AnalysImmo, ORIS — ont été conçus à une époque où le
                terrain et le bureau étaient deux moments séparés. Aujourd&apos;hui, un smartphone
                ou une tablette dispose de l&apos;essentiel pour capter la visite en direct : photos
                géolocalisées, dictée vocale structurée, signature électronique, géocodage adresse,
                alerte de cohérence en temps réel.
              </p>
              <p>
                KOVAS ne remplace pas ton logiciel principal. KOVAS se positionne comme la couche
                terrain mobile, indépendante, qui prépare ton dossier pendant la visite puis
                l&apos;exporte vers le logiciel principal de ton choix — ou en PDF, Word, CSV, JSON
                si tu travailles en autonomie. L&apos;objectif mesurable est l&apos;économie
                d&apos;environ une heure trente par mission DPE typique, soit vingt-cinq à trente
                missions supplémentaires par mois à capacité égale pour un cabinet solo.
              </p>
              <p>
                Phase 2, prévue à partir du second semestre 2027, portera le calcul DPE certifié
                ADEME 3CL-2021 directement dans KOVAS. À ce moment-là, et seulement à ce moment-là,
                KOVAS pourra remplacer entièrement le logiciel historique. Jusque-là, nous restons
                compagnons.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3 — NEXUS 1993, LA SOCIÉTÉ */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Nexus 1993 — la société éditrice
              </p>
            </div>
            <div className="space-y-6 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p>
                KOVAS est édité par la SASU Nexus 1993, société par actions simplifiée
                unipersonnelle de droit français. Tu trouveras ci-dessous les éléments
                d&apos;identité légale qui figurent également sur nos mentions légales, CGV et
                factures.
              </p>
              <Card variant="opaque" padding="default" className="space-y-3">
                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Dénomination
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">{COMPANY_IDENTITY.legalName}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Forme juridique
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">{COMPANY_IDENTITY.legalForm}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Capital social
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">{COMPANY_IDENTITY.capitalLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      SIREN
                    </dt>
                    <dd className="mt-1 text-[#0F1419] font-mono">
                      {COMPANY_IDENTITY.sirenFormatted}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      RCS
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">{COMPANY_IDENTITY.rcs.number}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      TVA intracommunautaire
                    </dt>
                    <dd className="mt-1 text-[#0F1419] font-mono">
                      {COMPANY_IDENTITY.vatIntracom}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Code APE
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">
                      {COMPANY_IDENTITY.apeCode} — {COMPANY_IDENTITY.apeLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Date d&apos;immatriculation
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">{COMPANY_IDENTITY.rcs.registrationDate}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Siège social
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">{COMPANY_IDENTITY.address.full}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                      Représentant légal
                    </dt>
                    <dd className="mt-1 text-[#0F1419]">
                      {COMPANY_IDENTITY.legalRepresentative.fullName},{' '}
                      {COMPANY_IDENTITY.legalRepresentative.role}
                    </dd>
                  </div>
                </dl>
              </Card>
              <p className="text-sm text-[#0F1419]/72">
                Statut transparent : Nexus 1993 est exploitée en solopreneur, sans levée de fonds,
                sans investisseur externe au capital. L&apos;équipe technique élargie est composée
                de conseillers externes (architecture logicielle, métier diagnostic, conformité). Ce
                choix conditionne notre rythme produit et notre relation aux utilisateurs : nous
                prenons les décisions vite, nous parlons directement, nous assumons les arbitrages
                publiquement.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4 — MES ENGAGEMENTS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Mes engagements
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p>
                Quatre engagements opérationnels conditionnent les choix d&apos;architecture et les
                pratiques contractuelles de KOVAS au quotidien. Ce ne sont pas des éléments de
                communication.
              </p>
              <ul className="space-y-3 list-none pl-0">
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    RGPD
                  </span>
                  <span>
                    Registre des traitements à jour, point de contact protection des données
                    désigné, consentements granulaires, droit à l&apos;effacement et portabilité
                    accessibles depuis l&apos;espace utilisateur en un clic.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Hébergement UE
                  </span>
                  <span>
                    Données stockées exclusivement sur Supabase EU Paris (région eu-west-3),
                    chiffrement AES-256 au repos et TLS 1.3 en transit. Aucune réplication hors
                    Union européenne.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Indépendance
                  </span>
                  <span>
                    Aucun verrouillage propriétaire : tes dossiers s&apos;exportent au format ZIP
                    officiel des quatre éditeurs majeurs (Liciel, OBBC, AnalysImmo, ORIS) et en PDF,
                    Word, CSV, JSON. Si tu quittes KOVAS, tes données partent avec toi, sans frais
                    ni délai.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Prix
                  </span>
                  <span>
                    Tarification publique, lisible et stable. Pas de surprise à la facture, pas
                    d&apos;option cachée. Le détail de chaque tier figure sur la page tarifs et sur
                    tes factures mensuelles.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 5 — CONTACT */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Contact direct
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p>
                Pour toute question sur le produit, la roadmap, un partenariat, la presse ou un
                échange métier, une seule adresse, lue directement par moi-même :
              </p>
              <Card variant="opaque" padding="default" className="flex items-center gap-4">
                <div
                  aria-hidden
                  className="size-12 rounded-full bg-[#0F1419]/[0.06] flex items-center justify-center"
                >
                  <Mail className="size-5 text-[#0F1419]/72" />
                </div>
                <div>
                  <a
                    href={`mailto:${FOUNDER.email}`}
                    className="text-lg font-medium text-[#0F1419] hover:underline underline-offset-4"
                  >
                    {FOUNDER.email}
                  </a>
                  <p className="text-sm text-[#0F1419]/55 mt-0.5">
                    Réponse sous quarante-huit heures ouvrées, en français.
                  </p>
                </div>
              </Card>
              <p className="text-sm text-[#0F1419]/72">
                Adresse postale et identité légale complète sur les{' '}
                <Link
                  href="/mentions-legales"
                  className="underline underline-offset-4 hover:text-[#0F1419]"
                >
                  mentions légales
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.1]"
              style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}
            >
              Découvre{' '}
              <span className="font-serif italic font-normal">KOVAS pour diagnostiqueurs</span>.
            </h2>
            <p className="text-base sm:text-lg text-[#0F1419]/72 max-w-xl mx-auto">
              Trente jours d&apos;essai complet, sans engagement, pour mesurer le temps économisé
              sur tes premières missions terrain.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/pros">
                  Voir KOVAS pour diagnostiqueurs <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/tarifs">Voir les tarifs</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
