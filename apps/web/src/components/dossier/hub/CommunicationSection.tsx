import { Card } from '@/components/ui/card'
import { Mail, MessageSquare, Phone } from 'lucide-react'

export interface CommunicationEvent {
  id: string
  kind: 'email' | 'sms' | 'call'
  direction: 'in' | 'out'
  at: string
  subject: string | null
  preview: string | null
}

interface CommunicationSectionProps {
  events: ReadonlyArray<CommunicationEvent>
}

const KIND_ICON = { email: Mail, sms: MessageSquare, call: Phone }
const KIND_LABEL = { email: 'Email', sms: 'SMS', call: 'Appel' }

/**
 * Section 6 — Communication client (timeline).
 * Affichage agrégé des emails / SMS / appels rattachés au dossier.
 */
export function CommunicationSection({ events }: CommunicationSectionProps) {
  const sorted = [...events].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 6)

  return (
    <Card variant="flat" padding="default" id="communication" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Communication client</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Section 06</p>
      </div>

      {sorted.length > 0 ? (
        <ol className="relative space-y-3 border-l border-rule/60 pl-5">
          {sorted.map((ev) => {
            const Icon = KIND_ICON[ev.kind]
            return (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full border border-rule/60 bg-paper">
                  <Icon className="size-2.5 text-ink-mute" />
                </span>
                <div className="rounded-md border border-rule/50 bg-paper px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12px] font-medium text-ink">
                      {KIND_LABEL[ev.kind]} {ev.direction === 'in' ? 'reçu' : 'envoyé'}
                    </p>
                    <p className="font-mono text-[10px] text-ink-faint">
                      {new Date(ev.at).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                    </p>
                  </div>
                  {ev.subject ? (
                    <p className="text-[13px] text-ink-soft mt-0.5">{ev.subject}</p>
                  ) : null}
                  {ev.preview ? (
                    <p className="text-[12px] text-ink-mute mt-0.5 line-clamp-2">{ev.preview}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 p-4 text-center text-[13px] text-ink-mute">
          Aucune communication enregistrée. Les emails et SMS envoyés depuis KOVAS apparaîtront ici.
        </div>
      )}
    </Card>
  )
}
