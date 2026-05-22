'use client'

import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { FileText } from 'lucide-react'

interface AdminShortcutsBlockProps {
  dossierId: string
}

interface Shortcut {
  id: string
  label: string
  href?: string
  comingSoon?: boolean
}

/**
 * Bloc sidebar — Raccourcis administratifs.
 * Génération devis PDF / mandat / attestation / rapport / facture.
 */
export function AdminShortcutsBlock({ dossierId: _dossierId }: AdminShortcutsBlockProps) {
  const items: Shortcut[] = [
    { id: 'quote', label: 'Devis PDF', comingSoon: true },
    { id: 'mandate', label: 'Mandat de mission', comingSoon: true },
    { id: 'attestation', label: 'Attestation', comingSoon: true },
    { id: 'report', label: 'Rapport diagnostic', comingSoon: true },
    { id: 'invoice', label: 'Facture', comingSoon: true },
  ]

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="size-3.5 text-ink-mute" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Documents administratifs
        </p>
      </div>

      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-md border border-rule/50 bg-paper hover:border-ink/30 px-2.5 py-1.5 text-[12px] text-ink-soft transition-colors duration-fast"
              onClick={() =>
                toast.info(
                  `${it.label} — Génération PDF disponible prochainement.`,
                )
              }
            >
              <span>{it.label}</span>
              <span className="font-mono text-[10px] text-ink-faint">PDF</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
