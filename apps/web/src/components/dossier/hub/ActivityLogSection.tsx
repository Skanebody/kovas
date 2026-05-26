import { Card } from '@/components/ui/card'
import {
  Activity,
  Camera,
  FilePlus,
  FileText,
  Mic,
  Receipt,
  Send,
  Upload,
  UserCog,
  Workflow,
} from 'lucide-react'

export type ActivityEventType =
  | 'created'
  | 'status_changed'
  | 'photo_added'
  | 'voice_note_added'
  | 'historical_document_added'
  | 'quote_created'
  | 'invoice_created'
  | 'export_generated'
  | 'client_changed'
  | 'owner_changed'

export interface ActivityEvent {
  id: string
  event_type: ActivityEventType | string
  event_data: Record<string, unknown> | null
  occurred_at: string
}

interface ActivityLogSectionProps {
  events: ReadonlyArray<ActivityEvent>
}

interface EventStyle {
  icon: typeof Activity
  label: (data: Record<string, unknown> | null) => string
}

const EVENT_STYLES: Record<string, EventStyle> = {
  created: {
    icon: FilePlus,
    label: (d) => {
      const ref = typeof d?.reference === 'string' ? d.reference : 'dossier'
      return `Création du ${ref}`
    },
  },
  status_changed: {
    icon: Workflow,
    label: (d) => {
      const from = typeof d?.from === 'string' ? d.from : '?'
      const to = typeof d?.to === 'string' ? d.to : '?'
      return `Statut : ${from} → ${to}`
    },
  },
  photo_added: { icon: Camera, label: () => 'Photo ajoutée' },
  voice_note_added: {
    icon: Mic,
    label: (d) => {
      const dur = typeof d?.duration_seconds === 'number' ? d.duration_seconds : null
      return dur ? `Note vocale (${dur}s)` : 'Note vocale ajoutée'
    },
  },
  historical_document_added: {
    icon: Upload,
    label: (d) => {
      const cat = typeof d?.category === 'string' ? d.category : 'document'
      const name = typeof d?.filename === 'string' ? d.filename : ''
      return `Document historique (${cat})${name ? ` — ${name}` : ''}`
    },
  },
  quote_created: {
    icon: FileText,
    label: (d) => {
      const ref = typeof d?.reference === 'string' ? d.reference : 'devis'
      return `Devis créé : ${ref}`
    },
  },
  invoice_created: {
    icon: Receipt,
    label: (d) => {
      const ref = typeof d?.reference === 'string' ? d.reference : 'facture'
      return `Facture créée : ${ref}`
    },
  },
  export_generated: { icon: Send, label: () => 'Export généré' },
  client_changed: { icon: UserCog, label: () => 'Changement de client' },
  owner_changed: { icon: UserCog, label: () => 'Changement de propriétaire' },
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Section Historique d'activité — timeline append-only.
 *
 * Chantier E (FIX-KK §E) : liste chronologique de tous les événements du
 * dossier (création, statut, photos, vocaux, docs, devis, factures,
 * exports, changements client/proprio). Données issues de
 * `dossier_activity_log` alimentée par triggers Postgres + INSERT manuels
 * depuis l'application.
 */
export function ActivityLogSection({ events }: ActivityLogSectionProps) {
  const sorted = [...events].sort((a, b) => (b.occurred_at > a.occurred_at ? 1 : -1))

  return (
    <Card variant="flat" padding="default" id="activity-log" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#0F1419]">Historique d'activité</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          Section 09
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#0F1419]/[0.08] bg-cream-deep/30 px-3 py-3 text-[13px] text-[#0F1419]/72">
          Aucun événement enregistré pour ce dossier.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-[#0F1419]/[0.08] pl-5">
          {sorted.map((ev) => {
            const style = EVENT_STYLES[ev.event_type] ?? {
              icon: Activity,
              label: () => ev.event_type,
            }
            const Icon = style.icon
            const label = style.label(ev.event_data)
            return (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full border border-[#0F1419]/[0.08] bg-paper">
                  <Icon className="size-2.5 text-[#0F1419]/72" />
                </span>
                <div className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12px] font-medium text-[#0F1419]">{label}</p>
                    <p className="font-mono text-[10px] text-[#0F1419]/55">
                      {formatRelative(ev.occurred_at)}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
