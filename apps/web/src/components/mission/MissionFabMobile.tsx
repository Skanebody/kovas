'use client'

/**
 * KOVAS — FAB "Mode mission" mobile global (FIX-JJ multi-accès #5).
 *
 * Bouton flottant en bottom-right (mobile only) avec icône Sparkles chartreuse.
 * Au clic : appel /api/dossiers/next-mission qui retourne l'id du prochain RDV
 * éligible, puis redirige vers `/dashboard/dossiers/[id]/mission/tchat`.
 *
 * Comportement :
 *   - Si aucune mission éligible → toast info + redirect /dashboard/dossiers/new
 *   - Sinon → navigate vers le mode mission
 *
 * Placement : bottom-right au-dessus de la safe-area iOS PWA, distinct du FAB
 * central `+` du MobileQuickActions (qui est centré bottom).
 *
 * Authority : CLAUDE.md §3 features 1-2-10 + FIX-JJ multi-accès point #5.
 */

import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface NextMissionResponse {
  ok: boolean
  dossierId?: string
  error?: string
}

export function MissionFabMobile() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [_pressed, setPressed] = useState(false)

  function handleClick(): void {
    setPressed(true)
    startTransition(async () => {
      try {
        const res = await fetch('/api/dossiers/next-mission', { method: 'GET' })
        const json = (await res.json()) as NextMissionResponse
        if (!res.ok || !json.ok || !json.dossierId) {
          toast.info('Aucune mission imminente — créez-en une nouvelle.')
          router.push('/dashboard/dossiers/new')
          return
        }
        router.push(`/dashboard/dossiers/${json.dossierId}/mission/tchat`)
      } catch {
        toast.error('Erreur réseau — réessayez.')
      } finally {
        setPressed(false)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label="Démarrer ma prochaine mission"
      className={cn(
        // Mobile only — bottom right, au-dessus safe-area iOS, sous le BottomNav.
        'md:hidden fixed right-4 z-20',
        'bottom-[calc(80px+env(safe-area-inset-bottom,0px))]',
        'flex size-12 items-center justify-center rounded-full',
        'bg-chartreuse text-ink shadow-[0_4px_14px_rgba(212,245,66,0.45)]',
        'hover:brightness-95 active:scale-95',
        'transition-all duration-fast ease-spring',
        'disabled:opacity-60 disabled:cursor-not-allowed',
      )}
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-5" aria-hidden strokeWidth={2} />
      )}
    </button>
  )
}
