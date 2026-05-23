/**
 * KOVAS — Aperçu fiche publique diagnostiqueur (server component).
 *
 * Reflet "live" de ce que voient les visiteurs sur la page publique
 * /trouver-un-diagnostiqueur/[dept]/[city]/[slug].
 *
 * Pur affichage — pas d'interactivité. Utilise les mêmes tokens
 * V5 que la page publique.
 */

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BadgeCheck, ExternalLink, MapPin } from 'lucide-react'
import Link from 'next/link'

interface AnnuairePreviewProps {
  fullName: string | null
  city: string | null
  department: string | null
  bioShort: string | null
  bioLong: string | null
  interventionZones: readonly string[]
  specialties: readonly string[]
  openingHours: Record<string, { open: string; close: string }>
  publicHref: string | null
  isVerified: boolean
  gmbRating: number | null
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
}

const SPECIALTY_LABELS: Record<string, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Carrez',
  ERP: 'ERP',
}

export function AnnuairePreview({
  fullName,
  city,
  department,
  bioShort,
  bioLong,
  interventionZones,
  specialties,
  openingHours,
  publicHref,
  isVerified,
  gmbRating,
}: AnnuairePreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          Aperçu de votre fiche publique
        </p>
        {publicHref ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-navy hover:underline"
          >
            Voir en ligne
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>

      <Card variant="flat" padding="default">
        {/* En-tête fiche */}
        <div className="flex items-start gap-4">
          <Avatar
            name={fullName ?? '—'}
            size="lg"
            className="size-16 text-lg bg-navy text-chartreuse font-semibold"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-sans text-[22px] font-semibold leading-tight tracking-tight text-ink truncate">
                {fullName ?? 'Nom non renseigné'}
              </h2>
              {isVerified ? (
                <Badge variant="green" className="gap-1">
                  <BadgeCheck className="size-3" />
                  Vérifié
                </Badge>
              ) : (
                <Badge variant="muted">Non vérifié</Badge>
              )}
            </div>
            {city ? (
              <p className="flex items-center gap-1 text-[13px] text-ink-mute">
                <MapPin className="size-3.5" />
                {city}
                {department ? ` (${department})` : ''}
              </p>
            ) : null}
            {bioShort ? (
              <p className="text-[13px] text-ink-mute leading-relaxed pt-1">{bioShort}</p>
            ) : null}
            {gmbRating !== null ? (
              <p className="font-mono text-[11px] text-ink-mute pt-1">
                Note Google : {gmbRating.toFixed(1)} / 5
              </p>
            ) : null}
          </div>
        </div>

        {/* Bio détaillée */}
        {bioLong ? (
          <div className="mt-5 border-t border-rule/40 pt-4">
            <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{bioLong}</p>
          </div>
        ) : null}

        {/* Spécialités */}
        {specialties.length > 0 ? (
          <div className="mt-5 border-t border-rule/40 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-2">
              Spécialités
            </p>
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((s) => (
                <Badge key={s} variant="muted" className="uppercase tracking-wider">
                  {SPECIALTY_LABELS[s] ?? s}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Zones */}
        {interventionZones.length > 0 ? (
          <div className="mt-5 border-t border-rule/40 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-2">
              Zones d'intervention
            </p>
            <div className="flex flex-wrap gap-1.5">
              {interventionZones.map((z) => (
                <Badge key={z} variant="outline">
                  {z}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Horaires */}
        {Object.keys(openingHours).length > 0 ? (
          <div className="mt-5 border-t border-rule/40 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-2">
              Horaires
            </p>
            <ul className="space-y-1">
              {Object.entries(openingHours).map(([day, h]) => (
                <li
                  key={day}
                  className="flex justify-between text-[12.5px] text-ink-mute font-mono"
                >
                  <span>{DAY_LABELS[day] ?? day}</span>
                  <span>
                    {h.open} – {h.close}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* CTA contact (preview only) */}
        <div className="mt-5 border-t border-rule/40 pt-4">
          <p className="text-[12px] text-ink-faint italic">
            Le visiteur verra ici un bouton « Demander un devis » qui ouvre le formulaire de
            contact. Coordonnées masquées pour la confidentialité.
          </p>
        </div>
      </Card>
    </div>
  )
}
