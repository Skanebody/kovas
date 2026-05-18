import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { Camera, CheckCircle2, FileText, FolderPlus, History, Mic } from 'lucide-react'
import Link from 'next/link'

interface Event {
  key: string
  at: string
  icon: 'folder' | 'check' | 'photo' | 'voice' | 'doc'
  label: string
  href: string
}

function timeAgoFr(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

export async function RecentActivityBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: dossiers },
    { data: missionsDone },
    { data: photos },
    { data: voiceNotes },
    { data: docs },
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select('id, reference, created_at, properties(address)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('missions')
      .select('id, type, dossier_id, completed_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', since)
      .order('completed_at', { ascending: false })
      .limit(5),
    supabase
      .from('photos')
      .select('id, dossier_id, taken_at, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('voice_notes')
      .select('id, dossier_id, transcribed_at')
      .eq('organization_id', orgId)
      .gte('transcribed_at', since)
      .order('transcribed_at', { ascending: false })
      .limit(5),
    supabase
      .from('owner_documents')
      .select('id, dossier_id, original_name, uploaded_at')
      .eq('organization_id', orgId)
      .gte('uploaded_at', since)
      .order('uploaded_at', { ascending: false })
      .limit(5),
  ])

  const events: Event[] = []

  for (const d of dossiers ?? []) {
    const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
    events.push({
      key: `dossier-${d.id}`,
      at: d.created_at,
      icon: 'folder',
      label: `Dossier ${d.reference} créé${prop?.address ? ` — ${prop.address}` : ''}`,
      href: `/app/dossiers/${d.id}`,
    })
  }
  for (const m of missionsDone ?? []) {
    if (!m.completed_at) continue
    events.push({
      key: `mission-${m.id}`,
      at: m.completed_at,
      icon: 'check',
      label: `Mission ${MISSION_TYPE_LABELS[m.type] ?? m.type} terminée`,
      href: `/app/dossiers/${m.dossier_id}#mission-${m.id}`,
    })
  }
  for (const p of photos ?? []) {
    const at = p.created_at ?? p.taken_at
    if (!at) continue
    events.push({
      key: `photo-${p.id}`,
      at,
      icon: 'photo',
      label: 'Photo terrain ajoutée',
      href: `/app/dossiers/${p.dossier_id}`,
    })
  }
  for (const v of voiceNotes ?? []) {
    if (!v.transcribed_at) continue
    events.push({
      key: `voice-${v.id}`,
      at: v.transcribed_at,
      icon: 'voice',
      label: 'Note vocale transcrite',
      href: `/app/dossiers/${v.dossier_id}`,
    })
  }
  for (const d of docs ?? []) {
    if (!d.uploaded_at) continue
    events.push({
      key: `doc-${d.id}`,
      at: d.uploaded_at,
      icon: 'doc',
      label: `Document client reçu — ${d.original_name}`,
      href: `/app/dossiers/${d.dossier_id}`,
    })
  }

  const top = events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="size-4" /> Activité récente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {top.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">
            Pas d'activité sur les 14 derniers jours.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((e) => (
              <li key={e.key} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <Link href={e.href} className="flex items-center gap-3 text-sm">
                  <EventIcon kind={e.icon} />
                  <span className="flex-1 min-w-0 truncate">{e.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgoFr(e.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function EventIcon({ kind }: { kind: Event['icon'] }) {
  const className = 'size-4 text-muted-foreground shrink-0'
  switch (kind) {
    case 'folder':
      return <FolderPlus className={className} />
    case 'check':
      return <CheckCircle2 className={className} />
    case 'photo':
      return <Camera className={className} />
    case 'voice':
      return <Mic className={className} />
    case 'doc':
      return <FileText className={className} />
  }
}
