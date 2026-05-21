'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
  BRANDING_ALLOWED_MIME_TYPES,
  BRANDING_MAX_BYTES,
  type BrandingMime,
} from '@/lib/branding/get-organization-branding'
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import Image from 'next/image'
import {
  useCallback,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { deleteLogoAction, uploadLogoAction } from './actions'

interface LogoUploadProps {
  /** URL signée du logo actuel (24h TTL) ou null si pas de logo. */
  currentLogoUrl: string | null
  /** Mime type courant (sert à afficher correctement le SVG vs raster). */
  currentLogoMime: string | null
}

const ACCEPT_ATTR = BRANDING_ALLOWED_MIME_TYPES.join(',')

/**
 * Zone d'upload logo cabinet : drag & drop + click-to-upload + preview + delete.
 *
 * Validations client (taille + mime) doublées côté server action.
 * Toasts FR sobres, ton métier.
 */
export function LogoUpload({ currentLogoUrl, currentLogoMime }: LogoUploadProps) {
  const [pending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((file: File) => {
    if (!BRANDING_ALLOWED_MIME_TYPES.includes(file.type as BrandingMime)) {
      toast.error('Format non supporté. Utilisez PNG, JPEG ou SVG.')
      return
    }
    if (file.size > BRANDING_MAX_BYTES) {
      toast.error('Fichier trop volumineux (2 Mo maximum).')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      const result = await uploadLogoAction(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Logo enregistré.')
      }
    })
  }, [])

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFiles(file)
    // reset pour permettre de re-sélectionner le même fichier
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) handleFiles(file)
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteLogoAction()
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Logo supprimé.')
      }
    })
  }

  const isSvg = currentLogoMime === 'image/svg+xml'

  return (
    <div className="space-y-4">
      {currentLogoUrl ? (
        // ============ PREVIEW ÉTAT : logo présent ============
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className={cn(
              'relative size-[200px] shrink-0 rounded-[16px] border border-[#0F1419]/[0.08]',
              'bg-white flex items-center justify-center overflow-hidden p-4',
            )}
          >
            {isSvg ? (
              // Next/Image accepte SVG via remote signed URLs sans optim
              // (svgs Storage signed = pas de domaine config simple). On
              // utilise une balise <img> brute pour SVG.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentLogoUrl}
                alt="Logo cabinet"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Image
                src={currentLogoUrl}
                alt="Logo cabinet"
                width={200}
                height={200}
                unoptimized
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                Logo actif
              </p>
              <p className="text-sm text-[#0F1419]">
                Ce logo apparaîtra en haut de vos devis, factures et rapports
                clients.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Remplacer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={pending}
              >
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // ============ ZONE VIDE : drag & drop ============
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Téléverser un logo"
          className={cn(
            'relative flex flex-col items-center justify-center gap-3 px-6 py-10',
            'rounded-[16px] border-2 border-dashed cursor-pointer transition-all',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F1419]/10',
            isDragging
              ? 'border-[#0F1419] bg-[#0F1419]/[0.03]'
              : 'border-[#0F1419]/15 bg-white hover:border-[#0F1419]/30 hover:bg-[#0F1419]/[0.02]',
            pending && 'pointer-events-none opacity-60',
          )}
        >
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-[#0F1419]/[0.04]"
          >
            {pending ? (
              <Loader2 className="size-5 text-[#0F1419] animate-spin" />
            ) : (
              <ImageIcon className="size-5 text-[#0F1419]/55" />
            )}
          </span>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-[#0F1419]">
              Déposez votre logo ici ou cliquez pour parcourir
            </p>
            <p className="font-mono text-[11px] text-[#0F1419]/55 tracking-[0.05em]">
              PNG · SVG · JPEG — 2 Mo max — 400×400 recommandé
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={onInputChange}
        aria-hidden
      />
    </div>
  )
}
