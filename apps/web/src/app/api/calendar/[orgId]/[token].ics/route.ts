import { validateCalendarToken } from '@/lib/calendar-token'
import { buildIcsCalendar } from '@/lib/ics'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/calendar/[orgId]/[token].ics
 *
 * Endpoint d'abonnement calendrier (subscription URL) — l'utilisateur ajoute
 * cette URL dans Google Calendar / Apple Calendar / Outlook qui la rafraîchit
 * périodiquement. Tous les dossiers de l'organisation avec un `scheduled_at`
 * apparaissent comme événements dans le calendrier externe.
 *
 * Authentification : token déterministe HMAC dérivé du orgId + secret serveur
 * (lib/calendar-token.ts). Pas de session/cookie nécessaire — les apps
 * calendrier ne savent pas faire OAuth.
 *
 * Pas un endpoint à protéger derrière le middleware Next.js auth → on utilise
 * le client admin (service_role) après validation du token.
 */

// Le client calendrier rafraîchit plus ou moins fréquemment selon ses propres
// règles ; on annonce 1h dans X-PUBLISHED-TTL mais on autorise le cache HTTP
// à 30 min pour soulager le serveur.
const HTTP_CACHE_SECONDS = 1800

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; token: string }> },
) {
  const { orgId, token: tokenWithExt } = await params
  // Le filename inclut .ics dans la route, on retire l'extension côté param
  const token = tokenWithExt.replace(/\.ics$/, '')

  // 1. Validation token (timing-safe)
  if (!validateCalendarToken(orgId, token)) {
    return new NextResponse('Token invalide ou révoqué.', { status: 401 })
  }

  // 2. Fetch dossiers planifiés via service_role
  const supabase = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // On expose les RDV à venir + un peu de passé (utile pour avoir
  // l'historique récent dans l'agenda). Limite ~12 mois passé / 12 mois futur.
  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  const fromIso = new Date(Date.now() - oneYearMs).toISOString()
  const toIso = new Date(Date.now() + oneYearMs).toISOString()

  const { data: dossiers, error } = await supabase
    .from('dossiers')
    .select(
      'id, reference, scheduled_at, notes, status, properties(address, postal_code, city), clients(display_name, phone), missions(type)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .order('scheduled_at', { ascending: true })

  if (error) {
    return new NextResponse(`Erreur lecture dossiers : ${error.message}`, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'

  type DossierRow = NonNullable<typeof dossiers>[number]
  const events = (dossiers ?? [])
    .filter((d): d is DossierRow & { scheduled_at: string } => Boolean(d.scheduled_at))
    .map((d) => {
      const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
      const client = Array.isArray(d.clients) ? d.clients[0] : d.clients
      const missions = (d.missions ?? []) as { type: string }[]
      const missionLabels = missions
        .map((m) => MISSION_TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type)
        .join(', ')
      const address = prop
        ? [prop.address, prop.postal_code, prop.city].filter(Boolean).join(' ')
        : ''
      const descriptionParts: string[] = [`Dossier ${d.reference}`]
      if (missionLabels) descriptionParts.push(`Diagnostics : ${missionLabels}`)
      if (client?.display_name) descriptionParts.push(`Client : ${client.display_name}`)
      if (client?.phone) descriptionParts.push(`Tél : ${client.phone}`)
      if (d.notes) descriptionParts.push(`Notes : ${d.notes}`)

      return {
        uid: `kovas-dossier-${d.id}@kovas.fr`,
        start: new Date(d.scheduled_at),
        durationMinutes: 90,
        summary: `Diagnostic ${missionLabels || ''} — ${client?.display_name ?? 'Client'}`.trim(),
        description: descriptionParts.join('\n'),
        location: address,
        url: `${baseUrl}/dashboard/dossiers/${d.id}`,
      }
    })

  const ics = buildIcsCalendar(events, {
    name: 'KOVAS · Diagnostics',
    description: 'Calendrier de vos rendez-vous diagnostic KOVAS',
    refreshIntervalHours: 1,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kovas-calendar.ics"',
      // Cache court côté CDN/navigateur — les clients calendrier ont leur
      // propre cadence de refresh derrière
      'Cache-Control': `public, max-age=${HTTP_CACHE_SECONDS}, s-maxage=${HTTP_CACHE_SECONDS}`,
    },
  })
}
