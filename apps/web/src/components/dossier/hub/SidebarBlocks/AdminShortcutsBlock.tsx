'use client'

import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import {
  ADMIN_DOCS,
  ADMIN_DOCS_ORDER,
  type AdminDocKind,
} from '@/lib/dossier/admin-docs'
import { downloadAdminDoc } from '@/lib/dossier/admin-docs-client'
import { FileText } from 'lucide-react'

interface AdminShortcutsBlockProps {
  dossierId: string
  dossierReference: string
  clientName: string | null
  clientAddress: string | null
  propertyAddress: string | null
}

/**
 * Bloc sidebar — Raccourcis administratifs.
 * Génération PDF V1 client-side (5 documents : bon de commande, attestation
 * visite, décharge propriétaire, bordereau diagnostic, récap mission).
 *
 * Contenu placeholder V1 — entête KOVAS + nom client + référence dossier.
 * Le contenu détaillé spécifique cabinet sera livré au sprint admin-docs V1.5.
 */
export function AdminShortcutsBlock({
  dossierId: _dossierId,
  dossierReference,
  clientName,
  clientAddress,
  propertyAddress,
}: AdminShortcutsBlockProps) {
  const ctx = {
    dossierReference,
    clientName,
    clientAddress,
    propertyAddress,
  }

  function handleGenerate(kind: AdminDocKind, label: string): void {
    try {
      const fileName = downloadAdminDoc(kind, ctx)
      toast.success(`${label} généré`, {
        description: `Téléchargement : ${fileName}`,
      })
    } catch (err) {
      toast.error('Échec de génération PDF', {
        description: err instanceof Error ? err.message : 'Erreur inconnue.',
      })
    }
  }

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="size-3.5 text-ink-mute" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Documents administratifs
        </p>
      </div>

      <ul className="space-y-1.5">
        {ADMIN_DOCS_ORDER.map((kind) => {
          const meta = ADMIN_DOCS[kind]
          return (
            <li key={kind}>
              <button
                type="button"
                className="w-full flex items-center justify-between rounded-md border border-rule/50 bg-paper hover:border-ink/30 px-2.5 py-1.5 text-[12px] text-ink-soft transition-colors duration-fast"
                onClick={() => handleGenerate(kind, meta.label)}
                aria-label={`Générer ${meta.fullTitle} en PDF`}
              >
                <span>{meta.label}</span>
                <span className="font-mono text-[10px] text-ink-faint">PDF</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
