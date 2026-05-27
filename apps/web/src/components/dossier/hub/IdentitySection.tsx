import { Card } from '@/components/ui/card'
import { DiagChip, type DiagType, missionTypeToDiag } from '@/components/ui/diag-chip'
import { Calendar, Home, Mail, MapPin, Phone, User } from 'lucide-react'
import Link from 'next/link'
import type { HubClient, HubDossier, HubMission, HubProperty } from './types'

interface IdentitySectionProps {
  dossier: HubDossier
  client: HubClient
  property: HubProperty
  missions: HubMission[]
  fullAddress: string
}

/**
 * Section 1 — Carte identité du dossier.
 * Identifie : client + bien + diagnostics + dates clés.
 */
export function IdentitySection({
  dossier,
  client,
  property,
  missions,
  fullAddress,
}: IdentitySectionProps) {
  const diags: DiagType[] = Array.from(
    new Set(missions.map((m) => missionTypeToDiag(m.type))),
  ) as DiagType[]

  const dateScheduled = dossier.scheduled_at
    ? new Date(dossier.scheduled_at).toLocaleString('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : null
  const dateCompleted = dossier.completed_at
    ? new Date(dossier.completed_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })
    : null

  return (
    <Card variant="flat" padding="default" id="identity" className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#0F1419]">Carte d&apos;identité</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          Section 01
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Client */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Client
          </p>
          <div className="space-y-1.5 text-[14px]">
            {client.id && client.display_name ? (
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="flex items-center gap-2 font-medium text-[#0F1419] hover:underline"
              >
                <User className="size-3.5 text-[#0F1419]/72" />
                {client.display_name}
              </Link>
            ) : (
              <span className="text-[#0F1419]/55 text-[13px]">Aucun client rattaché</span>
            )}
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-2 text-[13px] text-[#0F1419]/72 hover:text-[#0F1419]"
              >
                <Mail className="size-3.5" />
                {client.email}
              </a>
            ) : null}
            {client.phone ? (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-2 text-[13px] text-[#0F1419]/72 hover:text-[#0F1419]"
              >
                <Phone className="size-3.5" />
                {client.phone}
              </a>
            ) : null}
          </div>
        </div>

        {/* Bien */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Bien
          </p>
          <div className="space-y-1.5 text-[14px]">
            {fullAddress ? (
              <Link
                href={`/dashboard/properties/${property.id}`}
                className="flex items-start gap-2 font-medium text-[#0F1419] hover:underline"
              >
                <MapPin className="size-3.5 text-[#0F1419]/72 mt-0.5 shrink-0" />
                <span>{fullAddress}</span>
              </Link>
            ) : (
              <span className="text-[#0F1419]/55 text-[13px]">Aucune adresse</span>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#0F1419]/72">
              {property.property_type ? (
                <span className="flex items-center gap-1">
                  <Home className="size-3" /> {property.property_type}
                </span>
              ) : null}
              {property.surface_total ? <span>· {property.surface_total} m²</span> : null}
              {property.year_built ? <span>· {property.year_built}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics + dates */}
      <div className="grid gap-5 md:grid-cols-2 pt-4 border-t border-[#0F1419]/[0.08]">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Diagnostics ({diags.length})
          </p>
          {diags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {diags.map((d) => (
                <DiagChip key={d} type={d} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#0F1419]/55">Aucun diagnostic ajouté</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Dates clés
          </p>
          <div className="space-y-1.5 text-[13px] text-[#0F1419]/82">
            {dateScheduled ? (
              <p className="flex items-center gap-2">
                <Calendar className="size-3.5 text-[#0F1419]/72" />
                Planifié : <span className="text-[#0F1419]">{dateScheduled}</span>
              </p>
            ) : null}
            {dateCompleted ? (
              <p className="flex items-center gap-2">
                <Calendar className="size-3.5 text-[#0F1419]/72" />
                Terminé : <span className="text-[#0F1419]">{dateCompleted}</span>
              </p>
            ) : null}
            {!dateScheduled && !dateCompleted ? (
              <p className="text-[#0F1419]/55">Aucune date programmée</p>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
