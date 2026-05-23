import { Card } from '@/components/ui/card'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { buildMetadata } from '@/lib/seo/metadata'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { ContactInquiryForm } from './contact-inquiry-form'

export const metadata = buildMetadata({
  title: 'Nous contacter',
  description:
    "Quatre canaux dédiés pour joindre KOVAS : particuliers, diagnostiqueurs, journalistes et partenaires B2B. Réponse sous 24h ouvrées.",
  path: '/contact',
})

export default function ContactPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <LandingHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Contact
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-3xl"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              <span className="font-serif italic font-normal">Nous</span> contacter.
            </h1>
            <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
              Quatre canaux dédiés selon votre profil. Nous répondons à tous les messages sous
              vingt-quatre heures ouvrées.
            </p>
          </div>
        </section>

        {/* FORM + SIDEBAR */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1fr_320px] gap-10 lg:gap-16">
            {/* Formulaire dynamique */}
            <ContactInquiryForm />

            {/* Sidebar info */}
            <aside className="space-y-5">
              <Card variant="opaque" padding="default" className="space-y-4">
                <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                  Coordonnées
                </p>
                <div className="space-y-3 text-sm text-[#0F1419]/80">
                  <div className="flex gap-3">
                    <Mail className="size-4 text-[#0F1419]/55 mt-0.5 shrink-0" />
                    <a
                      href={`mailto:${COMPANY_IDENTITY.emails.contactGeneral}`}
                      className="hover:underline underline-offset-4"
                    >
                      {COMPANY_IDENTITY.emails.contactGeneral}
                    </a>
                  </div>
                  <div className="flex gap-3">
                    <Phone className="size-4 text-[#0F1419]/55 mt-0.5 shrink-0" />
                    <span className="text-[#0F1419]/72">
                      Téléphone : à venir
                      <span className="block text-[11px] text-[#0F1419]/55">
                        Standard téléphonique en cours d&apos;installation.
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="size-4 text-[#0F1419]/55 mt-0.5 shrink-0" />
                    <span>
                      SASU {COMPANY_IDENTITY.legalName}
                      <br />
                      {COMPANY_IDENTITY.address.line1}
                      <br />
                      {COMPANY_IDENTITY.address.postalCode} {COMPANY_IDENTITY.address.city}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Clock className="size-4 text-[#0F1419]/55 mt-0.5 shrink-0" />
                    <span>
                      Du lundi au vendredi
                      <br />
                      9h à 18h (heure de Paris)
                    </span>
                  </div>
                </div>
              </Card>

              <Card variant="opaque" padding="default" className="space-y-2">
                <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                  Une seule adresse de contact
                </p>
                <p className="text-sm text-[#0F1419]/72 leading-relaxed">
                  Toutes les demandes — particuliers, diagnostiqueurs, presse, données
                  personnelles, signalement — sont traitées via la même adresse{' '}
                  <a
                    href={`mailto:${COMPANY_IDENTITY.emails.contactGeneral}`}
                    className="text-[#0F1419] hover:underline underline-offset-4"
                  >
                    {COMPANY_IDENTITY.emails.contactGeneral}
                  </a>
                  . Indiquez votre profil dans le formulaire ci-contre pour un routage
                  prioritaire sous 24 heures ouvrées.
                </p>
              </Card>
            </aside>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
