import { BadgeVerified, type BadgeVerifiedLevel } from '@/components/diagnostician/BadgeVerified'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DIAG_CERT_BY_CODE, type DiagCertCode } from '@/lib/diag-certifications'
import { MapPin, ShieldCheck, Star } from 'lucide-react'
import Link from 'next/link'

export interface DiagResultCardProps {
  slug: string
  deptCode: string
  citySlug: string
  fullName: string
  city: string | null
  certifications: string[]
  gmbRating: number | null
  gmbReviewCount: number | null
  claimStatus: 'claimed' | 'unclaimed' | string | null
  distanceKm: number | null
  photoUrl: string | null
  /** Badge KOVAS (Doctolib 2022). Default 'unverified'. */
  badgeLevel?: BadgeVerifiedLevel
}

/** Initiales depuis le nom complet (max 2 lettres). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Card individuelle d'un diagnostiqueur dans la liste de résultats `/trouver-un-diagnostiqueur`.
 * Server component pur — toute action utilisateur passe par le lien plein-largeur.
 *
 * Lien généré : `/trouver-un-diagnostiqueur/<deptCode>/<citySlug>/<slug>`
 * (cohérent avec scope agent A2 qui construit les pages détail).
 */
export function DiagResultCard({
  slug,
  deptCode,
  citySlug,
  fullName,
  city,
  certifications,
  gmbRating,
  gmbReviewCount,
  claimStatus,
  distanceKm,
  photoUrl,
  badgeLevel = 'unverified',
}: DiagResultCardProps) {
  const href = `/trouver-un-diagnostiqueur/${deptCode}/${citySlug}/${slug}`
  const claimed = claimStatus === 'claimed'
  const initials = getInitials(fullName)

  // Garde 4 certifs max, indique "+N" si davantage
  const visibleCerts = certifications.slice(0, 4)
  const extraCount = Math.max(0, certifications.length - visibleCerts.length)

  return (
    <Card variant="opaque" padding="sm" className="group relative overflow-hidden">
      <Link
        href={href}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 rounded-lg"
        aria-label={`Voir la fiche de ${fullName}${city ? `, ${city}` : ''}`}
      >
        <span className="sr-only">Voir la fiche</span>
      </Link>

      <div className="flex items-start gap-4">
        {/* Avatar / photo */}
        <div className="shrink-0 size-14 rounded-full bg-cream-deep flex items-center justify-center overflow-hidden border border-rule">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <span className="font-display text-base font-semibold text-ink-mute">{initials}</span>
          )}
        </div>

        {/* Nom + localisation */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-[15px] font-semibold leading-tight text-ink truncate">{fullName}</h3>
          {city ? (
            <p className="flex items-center gap-1 text-[12px] text-ink-mute">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{city}</span>
              {distanceKm !== null && (
                <span className="text-ink-faint">· {distanceKm.toFixed(1)} km</span>
              )}
            </p>
          ) : null}
        </div>

        {/* Badge vérifié KOVAS (priorité) OU statut claim */}
        <div className="shrink-0">
          {badgeLevel !== 'unverified' ? (
            <BadgeVerified level={badgeLevel} size="sm" />
          ) : claimed ? (
            <Badge variant="green" className="gap-1">
              <ShieldCheck className="size-3" aria-hidden />
              Réclamée
            </Badge>
          ) : (
            <Badge variant="muted">À réclamer</Badge>
          )}
        </div>
      </div>

      {/* Certifications */}
      {visibleCerts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleCerts.map((code) => {
            const def = DIAG_CERT_BY_CODE[code as DiagCertCode]
            const label = def?.short ?? code
            return (
              <Badge key={code} variant="outline" className="font-normal">
                {label}
              </Badge>
            )
          })}
          {extraCount > 0 && (
            <Badge variant="muted" className="font-normal">
              +{extraCount}
            </Badge>
          )}
        </div>
      )}

      {/* Rating */}
      {gmbRating !== null && (
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-mute">
          <Star className="size-3.5 fill-amber text-amber" aria-hidden />
          <span className="font-medium text-ink">{gmbRating.toFixed(1)}</span>
          {gmbReviewCount !== null && gmbReviewCount > 0 && (
            <span className="text-ink-faint">({gmbReviewCount} avis)</span>
          )}
        </div>
      )}
    </Card>
  )
}
