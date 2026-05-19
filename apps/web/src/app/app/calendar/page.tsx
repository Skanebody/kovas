import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type CalendarEvent, CalendarWeekView } from './calendar-week-view'

export const metadata: Metadata = { title: 'Planning' }

export default async function CalendarPage() {
  const { supabase, orgId } = await getCurrentUser()

  const now = new Date()
  const since = new Date(now)
  since.setMonth(since.getMonth() - 3)
  const until = new Date(now)
  until.setMonth(until.getMonth() + 6)

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, properties(city), clients(display_name), missions(type)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', since.toISOString())
    .lte('scheduled_at', until.toISOString())
    .order('scheduled_at', { ascending: true })

  const events: CalendarEvent[] = (dossiers ?? []).map((d) => {
    const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
    const client = Array.isArray(d.clients) ? d.clients[0] : d.clients
    const missions = (d.missions ?? []) as { type: string }[]
    return {
      dossierId: d.id,
      reference: d.reference,
      scheduledAt: d.scheduled_at as string,
      durationMinutes: 90,
      clientName: client?.display_name ?? null,
      city: prop?.city ?? null,
      missionTypes: missions.map((m) => m.type),
      status: d.status,
    }
  })

  return (
    <div className="max-w-6xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dashboard">
          <ArrowLeft className="size-4" /> Tableau de bord
        </Link>
      </Button>

      <AppPageHeader
        title="Planning"
        description="Vue calendrier de vos visites diagnostic. Cliquez sur un RDV pour ouvrir le dossier."
      />

      <CalendarWeekView events={events} />

      <p className="text-[11px] text-ink-mute text-center">
        Les RDV se créent en planifiant un dossier. Téléchargez un .ics depuis le détail du dossier
        pour l&apos;importer dans Google / Apple / Outlook.
      </p>
    </div>
  )
}
