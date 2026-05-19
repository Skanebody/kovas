'use client'

import {
  Cloud,
  Download,
  FileArchive,
  Loader2,
  Mail,
  Share2,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ShareMissionButtonProps {
  missionId: string
  missionReference: string
  clientEmail?: string | null
}

export function ShareMissionButton({
  missionId,
  missionReference,
  clientEmail,
}: ShareMissionButtonProps) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState<'zip' | 'liciel' | null>(null)

  async function handleDownload(format: 'zip' | 'liciel') {
    setDownloading(format)
    try {
      const url = `/api/missions/${missionId}/export?format=${format}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Export failed')

      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download =
        format === 'liciel'
          ? `LICIEL_${missionReference}.zip`
          : `KOVAS_${missionReference}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setDownloading(null)
    }
  }

  function handleEmail() {
    const subject = `Mission KOVAS ${missionReference}`
    const body = `Bonjour,\n\nVeuillez trouver ci-joint le compte-rendu de la mission ${missionReference}.\n\nVous pouvez télécharger l'export complet depuis votre espace KOVAS.\n\nCordialement.`
    const to = clientEmail ?? ''
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Share2 className="size-4" /> Partager
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partager la mission {missionReference}</DialogTitle>
          <DialogDescription>
            3 modes d'envoi vers votre logiciel principal ou votre client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ShareCard
            icon={FileArchive}
            title="Export universel (PDF + Word + CSV + JSON)"
            description="ZIP avec rapport visuel, document éditable, données structurées + photos terrain organisées par pièce."
            action={
              <Button onClick={() => handleDownload('zip')} disabled={downloading !== null}>
                {downloading === 'zip' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Télécharger
              </Button>
            }
          />

          <ShareCard
            icon={FileArchive}
            badge={<Badge variant="orange">Stub V1</Badge>}
            title="Export Liciel (ZIP natif)"
            description="XML LIV_administratif + LIV_donnees + LIV_DPE + photos taggées. Le .mdb sera ajouté courant 2026."
            action={
              <Button
                variant="glass"
                onClick={() => handleDownload('liciel')}
                disabled={downloading !== null}
              >
                {downloading === 'liciel' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Télécharger
              </Button>
            }
          />

          <div className="border-t border-rule pt-3">
            <p className="text-xs text-ink-mute mb-3">Autres modes d'envoi</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="glass" onClick={handleEmail}>
                <Mail className="size-4" /> Email{clientEmail ? ' au client' : ''}
              </Button>
              <Button variant="glass" disabled>
                <Cloud className="size-4" /> GDrive (bientôt)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShareCard({
  icon: Icon,
  badge,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-rule p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-cream-deep flex items-center justify-center shrink-0">
            <Icon className="size-4" />
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {badge}
      </div>
      <p className="text-xs text-ink-mute">{description}</p>
      <div className="flex justify-end">{action}</div>
    </div>
  )
}
