import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import {
  COMPANY_KPIS,
  COMPANY_VALUES,
  TEAM_MEMBERS,
  type TeamMember,
} from '@/lib/institutional/team'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { buildMetadata, KOVAS_SITE_URL } from '@/lib/seo/metadata'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'

export const metadata = buildMetadata({
  title: 'À propos de KOVAS',
  description:
    "L'histoire, la mission et l'équipe derrière KOVAS, la plateforme SaaS dédiée aux diagnostiqueurs immobiliers indépendants en France.",
  path: '/a-propos',
})

function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${KOVAS_SITE_URL}/#organization`,
        name: COMPANY_IDENTITY.brands.umbrella,
        legalName: COMPANY_IDENTITY.legalName,
        url: KOVAS_SITE_URL,
        founder: {
          '@type': 'Person',
          name: COMPANY_IDENTITY.legalRepresentative.fullName,
        },
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
        '@type': 'AboutPage',
        '@id': `${KOVAS_SITE_URL}/a-propos#aboutpage`,
        url: `${KOVAS_SITE_URL}/a-propos`,
        name: 'À propos de KOVAS',
        about: { '@id': `${KOVAS_SITE_URL}/#organization` },
      },
    ],
  }
}

function TeamCard({ member }: { member: TeamMember }) {
  const initials = member.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="size-14 shrink-0 rounded-full bg-[#0F1419]/[0.06] flex items-center justify-center text-[15px] font-semibold text-[#0F1419]/72"
        >
          {initials}
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-[#0F1419]">{member.displayName}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/55">
            {member.role}
          </p>
        </div>
      </div>
      <p className="text-sm text-[#0F1419]/72 leading-relaxed">{member.bio}</p>
      <p className="text-xs text-[#0F1419]/55 leading-relaxed">{member.experience}</p>
      {member.linkedinUrl ? (
        <a
          href={member.linkedinUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72 hover:text-[#0F1419] underline-offset-4 hover:underline"
        >
          LinkedIn ↗
        </a>
      ) : null}
    </Card>
  )
}

export default function AProposPage() {
  const founders = TEAM_MEMBERS.filter((m) => m.category === 'founder')
  const advisors = TEAM_MEMBERS.filter((m) => m.category === 'advisor')

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <Script
        id="apropos-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
      />

      <LandingHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              À propos
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-4xl"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              L&apos;histoire de{' '}
              <span className="font-serif italic font-normal">KOVAS</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
              Une plateforme construite par un ex-cadre devenu diagnostiqueur, pour libérer le
              métier de la double saisie et redonner du temps au terrain.
            </p>
          </div>
        </section>

        {/* SECTION 1 — MISSION */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Notre mission
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p className="text-xl sm:text-2xl font-medium text-[#0F1419] leading-snug">
                Nous outillons les 13 000 diagnostiqueurs immobiliers indépendants de France pour
                qu&apos;ils libèrent leur temps métier des saisies manuelles, des doubles
                ressaisies et des erreurs ADEME.
              </p>
              <p>
                Le diagnostic immobilier français repose à 92 % sur huit prestations standards :
                DPE, amiante, plomb, gaz, électricité, termites, mesurage Carrez/Boutin et état des
                risques. Sur chacune de ces missions, le diagnostiqueur passe encore aujourd&apos;hui
                en moyenne une heure trente de retour au bureau pour reformater des données déjà
                collectées sur le terrain. Ce temps perdu n&apos;est pas un détail : il représente
                à l&apos;échelle d&apos;un cabinet solo entre vingt-cinq et trente missions
                supplémentaires par mois qui n&apos;ont jamais lieu, faute de capacité.
              </p>
              <p>
                KOVAS s&apos;attaque à ce gâchis avec une approche simple : capture vocale
                structurée par pièce, photos géolocalisées et nommées automatiquement, validation
                de cohérence en temps réel, puis exports universels vers Liciel, OBBC ou
                AnalysImmo. Notre promesse mesurable est l&apos;économie d&apos;une heure trente
                par mission DPE typique. Notre objectif sous-jacent, plus profond, est de rendre le
                métier de diagnostiqueur plus serein, plus prévisible et plus respecté.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2 — HISTOIRE */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                L&apos;histoire
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p>
                KOVAS naît fin 2025 d&apos;un constat personnel. Benjamin Bel, fondateur de la
                SASU Nexus 1993 et ex-cadre dans une PME industrielle normande, entame une
                reconversion vers le diagnostic immobilier après une décennie passée à concevoir
                des outils logiciels pour les opérateurs terrain. Très vite, en suivant sa
                certification et en accompagnant des diagnostiqueurs en activité dans le bassin
                rouennais, il observe le décalage entre la modernité des smartphones et la
                rusticité des logiciels métiers historiques.
              </p>
              <p>
                Le constat est partagé par tous : la saisie sur Liciel ou OBBC après une visite
                terrain ressemble à un retraitement administratif sans valeur ajoutée. Photos à
                renommer, mesures à retaper, observations vocales à transcrire à la main, mention
                par mention. Les confrères acceptent cette friction comme une fatalité du métier.
                Benjamin ne s&apos;en satisfait pas.
              </p>
              <p>
                Au printemps 2026, après six mois d&apos;entretiens avec une cinquantaine de
                diagnostiqueurs indépendants, le cahier des charges se stabilise. KOVAS sera un
                compagnon de Liciel, pas un remplaçant : la saisie terrain se fait dans KOVAS,
                l&apos;envoi ADEME reste dans Liciel. Le développement démarre en avril 2026 dans
                une logique solopreneur stricte, sans levée de fonds, avec un objectif de un
                million d&apos;euros de chiffre d&apos;affaires récurrent à vingt-quatre mois.
              </p>
              <p>
                Le lancement public est prévu pour septembre-octobre 2026, après une bêta privée
                de quarante diagnostiqueurs. Une phase 2 portera le calcul DPE certifié ADEME
                3CL-2021 directement dans KOVAS, à partir du second semestre 2027.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3 — VALEURS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Nos valeurs
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Quatre principes qui guident chaque décision produit.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {COMPANY_VALUES.map((value) => (
                <Card key={value.id} variant="opaque" padding="default" className="space-y-3">
                  <h3 className="text-lg font-semibold text-[#0F1419]">{value.title}</h3>
                  <p className="text-sm font-medium text-[#0F1419]/80">{value.summary}</p>
                  <p className="text-sm text-[#0F1419]/72 leading-relaxed">
                    {value.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4 — ÉQUIPE */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                L&apos;équipe
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Un fondateur et deux conseillers seniors.
              </h2>
            </div>

            <div className="space-y-8">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/55 mb-4">
                  Fondation
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {founders.map((m) => (
                    <TeamCard key={m.id} member={m} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/55 mb-4">
                  Conseillers
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {advisors.map((m) => (
                    <TeamCard key={m.id} member={m} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 — CHIFFRES CLÉS */}
        <section className="px-5 sm:px-12 py-16 sm:py-24 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Chiffres clés
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Le marché que nous servons en quelques ordres de grandeur.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {COMPANY_KPIS.map((kpi) => (
                <div key={kpi.id} className="space-y-3">
                  <p
                    className="font-serif italic font-normal text-[#0F1419] leading-none"
                    style={{ fontSize: 'clamp(56px, 6vw, 96px)' }}
                  >
                    {kpi.value}
                  </p>
                  <p className="text-sm font-medium text-[#0F1419]/80 leading-snug">
                    {kpi.label}
                  </p>
                  {kpi.caveat ? (
                    <p className="text-[11px] text-[#0F1419]/55 leading-relaxed italic">
                      {kpi.caveat}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6 — RSE / CONFORMITÉ */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Engagement RSE et conformité
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p>
                Nos engagements opérationnels ne sont pas des éléments de communication : ils
                conditionnent nos choix d&apos;architecture et nos pratiques contractuelles
                quotidiennes.
              </p>
              <ul className="space-y-3 list-none pl-0">
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    RGPD
                  </span>
                  <span>
                    Registre des traitements à jour, désignation d&apos;un point de contact
                    données, consentements granulaires, droit à l&apos;effacement et portabilité
                    accessibles depuis l&apos;espace utilisateur.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Hébergement
                  </span>
                  <span>
                    Données stockées exclusivement sur Supabase EU Paris (eu-west-3), chiffrement
                    AES-256 au repos et TLS 1.3 en transit. Aucune réplication hors Union
                    européenne.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Anti-fraude
                  </span>
                  <span>
                    Vérification du SIRET via API INSEE, contrôle des certifications COFRAC
                    déclarées, traçabilité des modifications de profil et signalement public.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Décret 2023-417
                  </span>
                  <span>
                    Modèles de rapports alignés sur les arrêtés en vigueur et veille
                    réglementaire continue. Chaque évolution des seuils ADEME est intégrée dans
                    les soixante-douze heures.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    LAFT
                  </span>
                  <span>
                    Loi anti-fraude transparence respectée pour la facturation : certification
                    NF525 en cours, mentions Factur-X 2027 prêtes, pénalités de retard
                    pré-paramétrées.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.1]"
              style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}
            >
              Rejoignez les diagnostiqueurs qui ont{' '}
              <span className="font-serif italic font-normal">choisi KOVAS</span>.
            </h2>
            <p className="text-base sm:text-lg text-[#0F1419]/72 max-w-xl mx-auto">
              Trente jours d&apos;essai complet, sans engagement, pour mesurer le temps
              économisé sur vos premières missions.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/pros">
                  Découvrir KOVAS pour les pros <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/pricing">Voir les tarifs</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
