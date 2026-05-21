'use client'

/**
 * KOVAS — Boutons "Générer / Télécharger PDF de défense".
 *
 * Appelle POST /api/defense-dossier/generate/:missionId (Edge Function),
 * récupère l'URL signée du PDF, l'ouvre dans un nouvel onglet et raffraîchit
 * la page (router.refresh) pour re-rendre les métadonnées.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileDown, FilePlus2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'

export interface DefenseGenerateButtonProps {
  missionId: string
  existingPdfUrl: string | null
}

export function DefenseGenerateButton({ missionId, existingPdfUrl }: DefenseGenerateButtonProps) {
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/defense-dossier/generate/${missionId}`, { method: 'POST' })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as { pdfUrl?: string }
      if (json.pdfUrl) {
        window.open(json.pdfUrl, '_blank', 'noopener,noreferrer')
        toast.success('PDF de défense généré')
      } else {
        toast.success('Dossier mis à jour')
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Génération impossible')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="accent" size="lg" onClick={handleGenerate} disabled={generating}>
        {generating ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Génération…
          </>
        ) : existingPdfUrl ? (
          <>
            <FilePlus2 className="size-4" /> Régénérer le PDF de défense
          </>
        ) : (
          <>
            <FilePlus2 className="size-4" /> Générer le PDF de défense
          </>
        )}
      </Button>
      {existingPdfUrl ? (
        <Button variant="outline" size="lg" asChild>
          <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer">
            <FileDown className="size-4" /> Télécharger le PDF
          </a>
        </Button>
      ) : null}
    </div>
  )
}
