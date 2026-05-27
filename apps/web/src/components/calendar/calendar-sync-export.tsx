'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Apple, Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface CalendarSyncExportProps {
  httpsUrl: string
  webcalUrl: string
}

/**
 * Section "Exporter (Kovas → externe)" — URL d'abonnement .ics.
 *
 * Mutualisé entre /app/account (CollapsibleSection) et /app/calendar
 * (onglet "Exporter" du dialog Synchronisation).
 *
 * L'utilisateur copie l'URL et la colle dans Google Calendar / Apple Calendar /
 * Outlook — tous les RDV KOVAS apparaissent automatiquement, refresh ~1h.
 * Sens Kovas → Externe en V1. Bidirectionnel via OAuth Google Calendar
 * prévu V1.5 (CLAUDE.md §20).
 */
export function CalendarSyncExport({ httpsUrl, webcalUrl }: CalendarSyncExportProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // Fallback : sélection manuelle via prompt
      window.prompt('Copiez cette URL', value)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft leading-relaxed">
        Synchronise tes RDV KOVAS avec ton agenda personnel. Tous tes dossiers planifiés
        apparaîtront automatiquement dans <strong>Google Calendar</strong>,{' '}
        <strong>Apple Calendar</strong>, <strong>Outlook</strong> — refresh ~1h.
      </p>

      {/* URL https — copie + collage manuel */}
      <div className="rounded-xl border border-rule bg-paper p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
            URL d'abonnement (https://)
          </div>
          <Badge variant="muted" className="text-[10px]">
            Lecture seule
          </Badge>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={httpsUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 min-w-0 rounded-md border border-rule bg-cream-deep/40 px-3 py-2 text-xs font-mono text-ink-soft"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copy(httpsUrl, 'https')}
            className={cn(copiedKey === 'https' && 'border-accent-green/60 text-accent-green')}
          >
            {copiedKey === 'https' ? (
              <>
                <Check className="size-4" /> Copié
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copier
              </>
            )}
          </Button>
        </div>
      </div>

      {/* webcal:// — ouverture directe dans Apple Calendar / Outlook */}
      <a
        href={webcalUrl}
        className="inline-flex items-center gap-2 rounded-pill border border-rule bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-navy/40 hover:bg-cream-deep/40 transition-colors"
      >
        <Apple className="size-3.5" /> Ouvrir dans Apple Calendar / Outlook
        <ExternalLink className="size-3" />
      </a>

      {/* Instructions par plateforme */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <InstructionCard
          title="Google Calendar"
          steps={[
            'Ouvrir Google Calendar (web)',
            "Menu gauche : « Autres agendas » → « + » → « À partir d'une URL »",
            "Coller l'URL https:// → Ajouter un agenda",
          ]}
          note="Refresh ~24h côté Google (limitation Google)"
        />
        <InstructionCard
          title="Apple Calendar"
          steps={[
            'Cliquer le bouton « Ouvrir dans Apple Calendar » ci-dessus',
            "OU : Fichier → Nouvel abonnement → coller l'URL",
            'Choisir Refresh « Toutes les heures »',
          ]}
          note="Refresh configurable (5min → 1 mois)"
        />
        <InstructionCard
          title="Outlook"
          steps={[
            "Outlook web : « Ajouter un agenda » → « S'abonner à partir du web »",
            "Coller l'URL https://",
            'Nommer « KOVAS » → Importer',
          ]}
          note="Refresh ~3h côté Outlook"
        />
      </div>

      {/* V1.5 — sync bidirectionnelle */}
      <div className="rounded-xl border border-rule/60 bg-cream-deep/30 p-3 text-xs text-ink-mute">
        <span className="font-medium text-ink-soft">À venir V1.5 :</span> synchronisation
        bidirectionnelle (RDV créé dans Google Calendar → import automatique dans KOVAS) via Google
        Calendar OAuth.
      </div>
    </div>
  )
}

function InstructionCard({
  title,
  steps,
  note,
}: {
  title: string
  steps: string[]
  note: string
}) {
  return (
    <div className="rounded-xl border border-rule bg-paper p-3 space-y-2">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <ol className="space-y-1 text-xs text-ink-soft">
        {steps.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <li key={i} className="flex gap-1.5">
            <span className="font-mono text-ink-mute shrink-0">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-ink-mute italic pt-1 border-t border-rule/40">{note}</p>
    </div>
  )
}
