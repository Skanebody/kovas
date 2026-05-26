import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Card } from '@/components/ui/card'
import { CAREER_VALUES } from '@/lib/institutional/team'
import { buildMetadata } from '@/lib/seo/metadata'
import { SpontaneousApplicationForm } from './spontaneous-application-form'

export const metadata = buildMetadata({
  title: 'Carrières',
  description:
    'Rejoindre KOVAS : nos valeurs, notre approche du travail à distance, candidatures spontanées pour les profils tech et métier du diagnostic immobilier.',
  path: '/carrieres',
})

export default function CarrieresPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Carrières
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-3xl"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              <span className="font-serif italic font-normal">Rejoindre</span> KOVAS.
            </h1>
            <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
              Petite équipe, ambition forte, impact concret. Nous construisons l&apos;outil de
              référence du diagnostic immobilier français.
            </p>
          </div>
        </section>

        {/* POURQUOI */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Pourquoi KOVAS
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p className="text-xl font-medium text-[#0F1419] leading-snug">
                Nous construisons l&apos;outil de référence du diagnostic immobilier français.
                Petite équipe, ambition forte, impact concret.
              </p>
              <p>
                Tu travailleras sur un produit utilisé chaque jour par des diagnostiqueurs
                indépendants pour gagner du temps sur leurs missions. Pas de couche
                d&apos;abstraction entre ton code et l&apos;utilisateur final. Pas de roadmap
                imposée par un département marketing à six mille kilomètres. Les décisions produit
                se prennent vite et se mesurent en quelques semaines.
              </p>
              <p>
                Nous privilégions la qualité technique, la maturité humaine et l&apos;autonomie. Le
                télétravail est la norme, les visios sont rares mais préparées. Les contrats sont en
                CDI ou en freelance, jamais en stage non rémunéré.
              </p>
            </div>
          </div>
        </section>

        {/* VALEURS */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Nos valeurs en pratique
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Quatre principes qui structurent notre quotidien.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {CAREER_VALUES.map((value) => (
                <Card key={value.id} variant="opaque" padding="default" className="space-y-3">
                  <h3 className="text-lg font-semibold text-[#0F1419]">{value.title}</h3>
                  <p className="text-sm text-[#0F1419]/72 leading-relaxed">{value.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* OFFRES OUVERTES */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Offres ouvertes
              </p>
            </div>
            <Card variant="opaque" padding="lg" className="max-w-3xl space-y-3">
              <h2 className="text-xl font-semibold text-[#0F1419]">
                Pas d&apos;offre ouverte actuellement.
              </h2>
              <p className="text-[#0F1419]/72 leading-relaxed">
                KOVAS est portée en solopreneur jusqu&apos;à au moins fin 2026, par choix
                stratégique. Nous restons attentifs aux talents qui partagent notre vision et
                rouvrirons les recrutements lorsque le besoin se fera concret.
              </p>
              <p className="text-sm text-[#0F1419]/55">
                Profils en veille active : développement Next.js / TypeScript, ingénierie produit
                métier diagnostic, support client B2B francophone.
              </p>
            </Card>
          </div>
        </section>

        {/* CANDIDATURE SPONTANÉE */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div className="space-y-3">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Candidature spontanée
              </p>
              <p className="text-sm text-[#0F1419]/72 leading-relaxed">
                Si ton profil correspond à notre veille, ta candidature sera conservée et relue dès
                qu&apos;un poste s&apos;ouvre. Nous répondons à chaque message.
              </p>
            </div>
            <SpontaneousApplicationForm />
          </div>
        </section>

        {/* CTA SECONDAIRE */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <p className="text-base text-[#0F1419]/72">
              Pas le bon moment ? Suis-nous sur LinkedIn pour être informé des prochaines
              ouvertures.
            </p>
            <a
              href="https://www.linkedin.com/company/kovas-fr"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-mono uppercase tracking-wider text-[#0F1419] underline-offset-4 hover:underline"
            >
              LinkedIn KOVAS ↗
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
