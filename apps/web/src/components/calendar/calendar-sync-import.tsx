'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { type ParsedIcsEvent, parseIcsContent } from '@/lib/ics-parser'
import { cn } from '@/lib/utils'
import { AlertCircle, CalendarPlus, FileText, Loader2, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'

type ImportStatus = 'idle' | 'parsing' | 'parsed' | 'error'

/**
 * Onglet "Importer (externe → Kovas)" du dialog Synchronisation.
 *
 * L'utilisateur dépose un fichier .ics (exporté depuis Google Calendar, Apple
 * Calendar ou Outlook). Le parsing est 100% client (pas d'upload serveur, RGPD-friendly).
 * Pour chaque VEVENT trouvé : 3 actions possibles :
 *   - "Créer un dossier" → redirige vers /app/dossiers/new?prefill=...
 *   - "Ignorer" → retire l'event de la liste
 *   - (V1.5) "Lier à un dossier existant" — placeholder désactivé
 *
 * La création de dossier n'est PAS automatique (validation manuelle requise
 * pour éviter d'inonder le compte avec des events parasites).
 */
export function CalendarSyncImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [events, setEvents] = useState<ParsedIcsEvent[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  async function handleFile(file: File) {
    setStatus('parsing')
    setErrorMsg(null)
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseIcsContent(text)
      if (parsed.length === 0) {
        setStatus('error')
        setErrorMsg('Aucun événement trouvé dans ce fichier.')
        return
      }
      setEvents(parsed)
      setStatus('parsed')
      toast.success(`${parsed.length} événement(s) trouvé(s)`)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Fichier .ics invalide')
    }
  }

  function onFilesChosen(list: FileList | null) {
    if (!list || list.length === 0) return
    const file = list[0]
    if (!file) return
    const isIcs =
      file.name.toLowerCase().endsWith('.ics') || file.type === 'text/calendar' || file.type === ''
    if (!isIcs) {
      setStatus('error')
      setErrorMsg('Format non reconnu — sélectionnez un fichier .ics')
      return
    }
    void handleFile(file)
  }

  function reset() {
    setStatus('idle')
    setEvents([])
    setFileName(null)
    setErrorMsg(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function ignoreEvent(uid: string) {
    setEvents((prev) => prev.filter((e) => e.uid !== uid))
  }

  const showDropZone = status === 'idle' || status === 'error' || status === 'parsing'

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft leading-relaxed">
        Importez un fichier <code className="font-mono text-xs">.ics</code> exporté depuis votre
        agenda (Google Calendar, Apple Calendar, Outlook). KOVAS lira les rendez-vous et vous
        proposera de créer un dossier pour chacun.
      </p>

      {showDropZone && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            onChange={(e) => onFilesChosen(e.target.files)}
            tabIndex={-1}
            aria-hidden
          />
          <button
            type="button"
            disabled={status === 'parsing'}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragOver(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              onFilesChosen(e.dataTransfer.files)
            }}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              'cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
              'disabled:cursor-wait',
              !isDragOver &&
                status !== 'error' &&
                'border-rule bg-paper/40 hover:border-navy/40 hover:bg-cream-deep/40',
              isDragOver && 'border-chartreuse bg-chartreuse/10',
              status === 'error' && 'border-danger/60 bg-danger/5',
            )}
          >
            {status === 'parsing' ? (
              <>
                <Loader2 className="size-8 text-navy animate-spin" aria-hidden />
                <p className="text-sm font-medium text-ink">Lecture en cours…</p>
                {fileName && <p className="text-xs text-ink-mute">{fileName}</p>}
              </>
            ) : (
              <>
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-cream-deep/60 text-ink">
                  <Upload className="size-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-ink">
                    Déposez un fichier .ics ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-ink-mute">
                    Exports Google / Apple / Outlook supportés
                  </p>
                </div>
              </>
            )}
          </button>
          {status === 'error' && errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-1">
                <p className="font-medium">Impossible de lire ce fichier</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}
        </>
      )}

      {status === 'parsed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-ink-mute" />
              <span className="text-xs font-mono text-ink-mute">{fileName}</span>
              <Badge variant="muted" className="text-[10px]">
                {events.length} RDV
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-3.5" /> Changer
            </Button>
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-ink-mute italic text-center py-6">
              Tous les événements ont été ignorés.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto -mx-1 px-1">
              {events.map((ev) => (
                <EventRow key={ev.uid} event={ev} onIgnore={() => ignoreEvent(ev.uid)} />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-rule/60 bg-cream-deep/30 p-3 text-xs text-ink-mute">
        <span className="font-medium text-ink-soft">À venir V1.5 :</span> import bidirectionnel
        OAuth Google Calendar (les nouveaux RDV de votre agenda apparaissent automatiquement dans
        KOVAS) + liaison à un dossier existant.
      </div>
    </div>
  )
}

function EventRow({ event, onIgnore }: { event: ParsedIcsEvent; onIgnore: () => void }) {
  const dateLabel = event.dtstart.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
  const timeLabel = event.allDay
    ? 'Toute la journée'
    : event.dtstart.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      })

  // Prefill URL — la page /app/dossiers/new lira les query params si elle les
  // supporte. Sinon, l'utilisateur reverra l'info dans le pré-remplissage.
  const prefillParams = new URLSearchParams()
  prefillParams.set('source', 'ics')
  if (event.summary) prefillParams.set('summary', event.summary)
  if (event.location) prefillParams.set('location', event.location)
  prefillParams.set('scheduled_at', event.dtstart.toISOString())
  if (event.description) prefillParams.set('notes', event.description)
  const prefillHref = `/dashboard/dossiers/new?${prefillParams.toString()}`

  return (
    <li className="rounded-xl border border-rule bg-paper p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-mute">
            {dateLabel} · {timeLabel}
          </div>
          <p className="text-sm font-semibold text-ink line-clamp-2">
            {event.summary || '(sans titre)'}
          </p>
          {event.location && <p className="text-xs text-ink-soft line-clamp-1">{event.location}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild size="sm" variant="accent">
          <Link href={prefillHref}>
            <CalendarPlus className="size-3.5" /> Créer un dossier
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onIgnore}>
          Ignorer
        </Button>
      </div>
    </li>
  )
}
