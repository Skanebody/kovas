'use client'

import type { DiagnosticType } from '@/lib/mission/types'
/**
 * KOVAS — Section #export-section du dossier refonte (Partition D).
 *
 * 5 destinations alignées sur table `dossier_exports.destination` :
 *   1. liciel_zip   — Export ZIP Liciel (pour finaliser calcul DPE)
 *   2. pdf_reports  — Rapports PDF (par diagnostic / par dossier)
 *   3. client_email — Envoyer au client (lien sécurisé 30j)
 *   4. archive      — Sauvegarder en archive (10 ans / 50 ans amiante)
 *   5. raw_json_csv — Export brut JSON/CSV (sauvegarde technique)
 *
 * Si `missingFields.length > 0`, affiche `<ExportWarning>` + modale de
 * confirmation avant retry avec `confirmIncomplete: true`.
 *
 * Authority : CLAUDE.md §3 features 8-9 + design system v5.
 */
import { Archive, Code, FileText, Mail, Package } from 'lucide-react'
import { useState } from 'react'
import {
  DestinationCard,
  type DestinationStatus,
  type DestinationStatusType,
} from './DestinationCard'
import { ExportIncompleteModal, type IncompleteConsequence } from './ExportIncompleteModal'
import { ExportWarning, type ExportWarningMissingField } from './ExportWarning'

export type ExportFormat =
  | 'liciel_zip'
  | 'pdf_reports'
  | 'client_email'
  | 'archive'
  | 'raw_json_csv'

export interface ExportSectionProps {
  dossierId: string
  missingFields: ExportWarningMissingField[]
  /** Si vrai → DPE actif sur le dossier (warning + recommended sur ZIP Liciel). */
  hasDpe: boolean
  /** Si vrai → AMIANTE actif (conservation 50 ans pour archive). */
  hasAmiante: boolean
  client?: {
    display_name: string | null
    email: string | null
  } | null
}

interface DestinationDef {
  format: ExportFormat
  icon: typeof Package
  name: string
  description: string
  ctaLabel?: string
  /** Filename par défaut côté client (overridable par Content-Disposition serveur). */
  defaultFilename?: string
  /** true → endpoint renvoie JSON (pas binaire). */
  isJsonResponse?: boolean
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  liciel_zip: 'Export ZIP Liciel',
  pdf_reports: 'Rapports PDF',
  client_email: "l'envoi au client",
  archive: "l'archive",
  raw_json_csv: 'Export JSON/CSV',
}

export function ExportSection({
  dossierId,
  missingFields,
  hasDpe,
  hasAmiante,
  client,
}: ExportSectionProps) {
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null)
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const isIncomplete = missingFields.length > 0
  // ZIP Liciel : warning si DPE incomplet, recommandé si DPE actif et manques faibles
  const dpeManques = missingFields.filter((m) => m.diagnostic === 'DPE').length
  const licielStatus: DestinationStatus =
    isIncomplete && hasDpe && dpeManques > 0
      ? {
          type: 'warning',
          text: `DPE incomplet (${dpeManques} manque${dpeManques > 1 ? 's' : ''})`,
        }
      : { type: 'success', text: 'Prêt pour Liciel' }
  const licielRecommended = hasDpe && dpeManques === 0

  const clientLine = client
    ? `${client.display_name ?? 'Client'}${client.email ? ` · ${client.email}` : ''}`
    : 'Aucun email client renseigné'

  const archiveText = hasAmiante ? 'Conservation 50 ans (amiante)' : 'Conservation 10 ans'

  const destinations: Array<{
    def: DestinationDef
    status: DestinationStatus
    recommended: boolean
    disabled?: boolean
  }> = [
    {
      def: {
        format: 'liciel_zip',
        icon: Package,
        name: 'Export ZIP Liciel',
        description: 'Pour finaliser le calcul DPE dans votre logiciel principal.',
        defaultFilename: `kovas-liciel-${dossierId.slice(0, 8)}.zip`,
      },
      status: licielStatus,
      recommended: licielRecommended,
    },
    {
      def: {
        format: 'pdf_reports',
        icon: FileText,
        name: 'Rapports PDF',
        description: 'PDF par diagnostic ou agrégé sur tout le dossier.',
        defaultFilename: `kovas-rapports-${dossierId.slice(0, 8)}.pdf`,
      },
      status: { type: 'success', text: 'Téléchargement immédiat' },
      recommended: false,
    },
    {
      def: {
        format: 'client_email',
        icon: Mail,
        name: 'Envoyer au client',
        description: clientLine,
        ctaLabel: 'Envoyer',
        isJsonResponse: true,
      },
      status: { type: 'default', text: 'Lien sécurisé 30 jours' } as {
        type: DestinationStatusType
        text: string
      },
      recommended: false,
      disabled: !client?.email,
    },
    {
      def: {
        format: 'archive',
        icon: Archive,
        name: 'Sauvegarder en archive',
        description: archiveText,
        defaultFilename: `kovas-archive-${dossierId.slice(0, 8)}.zip`,
      },
      status: { type: 'success', text: 'Sauvegarde sécurisée EU' },
      recommended: false,
    },
    {
      def: {
        format: 'raw_json_csv',
        icon: Code,
        name: 'Export brut JSON/CSV',
        description: 'Sauvegarde technique ou import logiciel tiers.',
        defaultFilename: `kovas-raw-${dossierId.slice(0, 8)}.zip`,
      },
      status: { type: 'default', text: 'Format structuré' },
      recommended: false,
    },
  ]

  async function triggerExport(format: ExportFormat, confirmIncomplete = false) {
    setLoadingFormat(format)
    setToast(null)
    try {
      const resp = await fetch(`/api/dossiers/${dossierId}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmIncomplete }),
      })

      // 409 INCOMPLETE → ouvre la modale
      if (resp.status === 409 && !confirmIncomplete) {
        setPendingFormat(format)
        setLoadingFormat(null)
        return
      }

      if (!resp.ok) {
        const errPayload = (await resp.json().catch(() => ({}))) as { error?: string }
        throw new Error(errPayload.error ?? `Export échoué (${resp.status})`)
      }

      const destination = destinations.find((d) => d.def.format === format)
      if (destination?.def.isJsonResponse) {
        const data = (await resp.json()) as { token?: string; ok?: boolean }
        if (data.ok) setToast('Email envoyé au client.')
      } else {
        // Binary → trigger download
        const blob = await resp.blob()
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        // Préférer le filename Content-Disposition côté serveur
        const disposition = resp.headers.get('Content-Disposition') ?? ''
        const match = disposition.match(/filename="?([^";]+)"?/i)
        anchor.download = match?.[1] ?? destination?.def.defaultFilename ?? 'export.bin'
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(objectUrl)
        setToast('Téléchargement démarré.')
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Erreur inattendue.')
    } finally {
      setLoadingFormat(null)
      setPendingFormat(null)
    }
  }

  // Conséquences contextuelles affichées dans la modale incomplet
  const incompleteConsequences: IncompleteConsequence[] = [
    {
      type: 'warning',
      text: 'Le rapport généré ne sera pas conforme aux exigences réglementaires.',
    },
    { type: 'info', text: 'Tu pourras relancer un export complet plus tard.' },
    { type: 'ok', text: "L'historique des exports conserve la trace des manques détectés." },
  ]

  return (
    <section id="export-section" className="space-y-5">
      <header className="space-y-2">
        <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-mute">
          Exporter ce dossier
        </p>
        <h2 className="text-3xl text-ink">
          <span className="text-display-serif">Exporter ce dossier.</span>
        </h2>
        <p className="text-sm text-ink-mute">
          Tu peux exporter à n'importe quel moment, même incomplet.
        </p>
      </header>

      {isIncomplete && (
        <ExportWarning missingFields={missingFields as ExportWarningMissingField[]} />
      )}

      <div className="space-y-3">
        {destinations.map((d) => (
          <DestinationCard
            key={d.def.format}
            icon={d.def.icon}
            name={d.def.name}
            description={d.def.description}
            status={d.status}
            recommended={d.recommended}
            ctaLabel={d.def.ctaLabel}
            loading={loadingFormat === d.def.format}
            disabled={d.disabled}
            onExport={() => triggerExport(d.def.format)}
          />
        ))}
      </div>

      {toast && <output className="block text-[12px] text-ink-mute italic">{toast}</output>}

      <ExportIncompleteModal
        open={pendingFormat !== null}
        destinationLabel={pendingFormat ? FORMAT_LABELS[pendingFormat] : ''}
        missingFields={missingFields as { diagnostic: DiagnosticType; label: string }[]}
        consequences={incompleteConsequences}
        onOpenChange={(open) => {
          if (!open) setPendingFormat(null)
        }}
        onConfirm={() => {
          if (pendingFormat) {
            void triggerExport(pendingFormat, true)
          }
        }}
      />
    </section>
  )
}
