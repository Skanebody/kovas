import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Card } from '@/components/ui/card'
import { PARTNER_PROFILES, PARTNER_USE_CASES } from '@/lib/institutional/partner-programs'
import { buildMetadata } from '@/lib/seo/metadata'
import { PartnerInquiryForm } from './partner-inquiry-form'

export const metadata = buildMetadata({
  title: 'Programmes partenaires',
  description:
    'Programmes partenaires KOVAS pour notaires, agences immobilières, banques, courtiers et fournisseurs énergie. Commissions, intégrations et co-marketing.',
  path: '/partenaires',
})

export default function PartenairesPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Partenariats
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-3xl"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              Programmes <span className="font-serif italic font-normal">partenaires</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
              Notaires, agences, banques, fournisseurs énergie : nous construisons des partenariats
              clairs, rémunérateurs et alignés sur l&apos;intérêt du client final.
            </p>
          </div>
        </section>

        {/* POUR QUI */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Pour qui
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Quatre profils, quatre programmes dédiés.
              </h2>
            </div>
            <div className="grid lg:grid-cols-2 gap-5">
              {PARTNER_PROFILES.map((profile) => (
                <Card key={profile.id} variant="opaque" padding="lg" className="space-y-5">
                  <div className="space-y-2">
                    <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">
                      Programme
                    </p>
                    <h3 className="text-xl font-semibold text-[#0F1419]">{profile.title}</h3>
                    <p className="text-sm text-[#0F1419]/72 leading-relaxed">
                      {profile.description}
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-[#0F1419]/80">
                    {profile.benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-2">
                        <span className="text-[#0F1419]/40 font-mono shrink-0">—</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <figure className="border-l-2 border-[#0F1419]/[0.15] pl-4 space-y-2">
                    <blockquote className="text-sm italic text-[#0F1419]/72 leading-relaxed">
                      « {profile.testimonial.quote} »
                    </blockquote>
                    <figcaption className="text-xs text-[#0F1419]/55 font-mono">
                      {profile.testimonial.author} — {profile.testimonial.role}
                    </figcaption>
                  </figure>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* PROGRAMME TYPE */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Mécanique du programme
              </p>
            </div>
            <div className="space-y-5 max-w-3xl text-[#0F1419]/80 leading-relaxed">
              <p className="text-xl font-medium text-[#0F1419] leading-snug">
                Un cadre simple : commission sur leads qualifiés, tableau de bord dédié, et
                co-marketing à la demande.
              </p>
              <ul className="space-y-3 list-none pl-0">
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Commission
                  </span>
                  <span>
                    Taux entre 5 et 10 % HT sur les missions effectivement réalisées par les
                    diagnostiqueurs de notre réseau, payé sous trente jours en fin de mois.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Tableau de bord
                  </span>
                  <span>
                    Accès dédié pour suivre les leads transmis, l&apos;avancement des missions et
                    les commissions accumulées, en temps réel.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    API d&apos;intégration
                  </span>
                  <span>
                    Disponible en Phase 2 (à partir du second semestre 2027) pour intégrer
                    l&apos;annuaire ou le calculateur DPE dans votre propre logiciel.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Co-marketing
                  </span>
                  <span>
                    Publications presse conjointes, événements régionaux, contenus pédagogiques
                    mutualisés à destination des particuliers. Toujours validé en amont, jamais
                    imposé.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-xs text-[#0F1419]/55 mt-1 w-32 shrink-0">
                    Engagement
                  </span>
                  <span>
                    Aucune exclusivité, aucun engagement de volume minimum. Si le partenariat
                    n&apos;apporte pas la valeur attendue de votre côté, nous le clôturons sans
                    frais.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CAS D'USAGE */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Cas d&apos;usage
              </p>
              <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                Trois exemples concrets de partenariat.
              </h2>
            </div>
            <div className="grid lg:grid-cols-3 gap-5">
              {PARTNER_USE_CASES.map((useCase, idx) => (
                <Card key={useCase.id} variant="opaque" padding="default" className="space-y-3">
                  <p
                    className="font-serif italic font-normal text-[#0F1419]/30 leading-none"
                    style={{ fontSize: '64px' }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </p>
                  <h3 className="text-base font-semibold text-[#0F1419] leading-snug">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-[#0F1419]/72 leading-relaxed">{useCase.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* DEVENIR PARTENAIRE */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div className="space-y-3">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Devenir partenaire
              </p>
              <p className="text-sm text-[#0F1419]/72 leading-relaxed">
                Présentez votre structure et le partenariat envisagé. Nous revenons vers vous sous
                quarante-huit heures ouvrées pour échanger.
              </p>
            </div>
            <PartnerInquiryForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
