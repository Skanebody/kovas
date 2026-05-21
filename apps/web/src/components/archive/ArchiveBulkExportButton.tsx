'use client'

/**
 * Bouton "Exporter ZIP" — relaie les query params courants vers
 * /api/archive/zip pour télécharger un bundle filtré.
 *
 * Cf. /api/archive/zip — cap 300 fichiers / 500 MB.
 */

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

export function ArchiveBulkExportButton() {
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)

  const href = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    next.delete('limit')
    const query = next.toString()
    return query ? `/api/archive/zip?${query}` : '/api/archive/zip'
  }, [searchParams])

  function handleClick() {
    setPending(true)
    // Le browser gère le download via Content-Disposition. On reset le pending
    // après un délai court (le téléchargement réel peut prendre 30-60s côté serveur).
    window.setTimeout(() => setPending(false), 3000)
  }

  return (
    <Button asChild variant="outline" size="sm" aria-busy={pending}>
      <a href={href} onClick={handleClick} rel="nofollow">
        <Download className="size-4" />
        Exporter ZIP
      </a>
    </Button>
  )
}
