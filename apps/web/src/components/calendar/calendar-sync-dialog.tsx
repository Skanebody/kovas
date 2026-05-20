'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Download, Share2, Upload } from 'lucide-react'
import { useState } from 'react'
import { CalendarSyncExport } from './calendar-sync-export'
import { CalendarSyncImport } from './calendar-sync-import'

interface CalendarSyncDialogProps {
  httpsUrl: string
  webcalUrl: string
}

/**
 * Dialog "Synchroniser" — page /app/calendar.
 *
 * Deux onglets : Exporter (Kovas → externe via URL d'abonnement .ics) et
 * Importer (externe → Kovas via fichier .ics drag-drop).
 *
 * Pattern v5 : Dialog Radix centré, max-w-2xl, max-h-[85vh] scrollable.
 */
export function CalendarSyncDialog({ httpsUrl, webcalUrl }: CalendarSyncDialogProps) {
  const [tab, setTab] = useState<'export' | 'import'>('export')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="glass" size="sm">
          <Share2 className="size-4" /> Synchroniser
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-2xl text-ink">
            Synchroniser votre agenda
          </DialogTitle>
          <DialogDescription>
            Connectez KOVAS à Google Calendar, Apple Calendar ou Outlook — dans les deux sens.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-pill border border-rule bg-cream-deep/40 p-1 self-start">
          <TabButton active={tab === 'export'} onClick={() => setTab('export')}>
            <Download className="size-3.5" /> Exporter
          </TabButton>
          <TabButton active={tab === 'import'} onClick={() => setTab('import')}>
            <Upload className="size-3.5" /> Importer
          </TabButton>
        </div>

        {tab === 'export' ? (
          <CalendarSyncExport httpsUrl={httpsUrl} webcalUrl={webcalUrl} />
        ) : (
          <CalendarSyncImport />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-paper text-ink shadow-sm' : 'text-ink-mute hover:text-ink hover:bg-paper/50',
      )}
    >
      {children}
    </button>
  )
}
