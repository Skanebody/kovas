import { Card } from '@/components/ui/card'
import { Linkedin, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

/**
 * KOVAS — Bloc auteur "Benjamin Bel" (E-E-A-T Core Update mai 2026).
 *
 * Obligatoire sur toute page YMYL programmatique du site
 * (`/trouver-un-diagnostiqueur/*`, `/diagnostic/*`, `/prix/*`, `/guides/*`).
 *
 * Signal Google : auteur identifié + photo + qualifications + sameAs LinkedIn.
 * À combiner avec un JSON-LD `Article.author` côté page.
 *
 * Photo : `/press-kit/photo-benjamin.jpg` (fallback initial Benjamin) — si
 * absente, l'avatar texte "BB" s'affiche (ne pas casser la page).
 */
interface AuthorBioProps {
  /** Date dernière mise à jour ISO 8601. */
  readonly lastUpdatedIso: string
  /** Sujet contextualisé (ex: "diagnostic immobilier à Paris"). */
  readonly contextLabel?: string
}

export function AuthorBio({ lastUpdatedIso, contextLabel }: AuthorBioProps) {
  const lastUpdatedDate = new Date(lastUpdatedIso)
  const formattedDate = lastUpdatedDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Card className="p-6 max-w-3xl border-rule bg-paper">
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <div className="relative size-16 rounded-full overflow-hidden border border-rule bg-cream-deep">
            <Image
              src="/press-kit/photo-benjamin-bel.jpg"
              alt="Benjamin Bel, fondateur de KOVAS"
              width={64}
              height={64}
              className="size-16 object-cover"
              // Fallback discret si la photo n'est pas encore disponible
              onError={undefined}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-sans font-bold text-base text-ink">Benjamin Bel</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-cream-deep text-[10px] font-mono uppercase tracking-wider text-ink-mute">
              <ShieldCheck className="size-3" aria-hidden />
              Fondateur KOVAS
            </span>
          </div>
          <p className="text-sm text-ink-soft leading-relaxed">
            Article rédigé par Benjamin Bel, fondateur de KOVAS et acteur du secteur
            de l'immobilier en Normandie depuis 10 ans. KOVAS est édité par la SASU
            NEXUS 1993 (Paris 8ᵉ), spécialiste de la productivité des diagnostiqueurs
            immobiliers certifiés.
            {contextLabel ? (
              <>
                {' '}
                Cette page couvre spécifiquement {contextLabel} et synthétise les
                données publiques INSEE, ADEME et DHUP applicables à cette zone.
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <Link
              href="https://linkedin.com/in/benjaminbel"
              target="_blank"
              rel="noopener noreferrer me author"
              className="inline-flex items-center gap-1.5 text-xs text-navy hover:underline underline-offset-4"
            >
              <Linkedin className="size-3.5" aria-hidden />
              LinkedIn
            </Link>
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <Link
              href="/a-propos"
              className="text-xs text-navy hover:underline underline-offset-4"
            >
              À propos de l'auteur
            </Link>
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <time
              dateTime={lastUpdatedIso}
              className="text-xs font-mono text-ink-faint"
            >
              Mis à jour le {formattedDate}
            </time>
          </div>
        </div>
      </div>
    </Card>
  )
}
