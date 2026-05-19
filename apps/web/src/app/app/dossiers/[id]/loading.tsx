import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

function SkelLine({ className }: { className?: string }) {
  return <div className={`h-3 rounded-md bg-cream-deep/80 animate-pulse ${className ?? ''}`} />
}

function SkelBlock({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-cream-deep/80 animate-pulse ${className ?? ''}`} />
}

/**
 * Skeleton de chargement pour /app/dossiers/[id].
 * Server component lourd (7 queries Supabase en parallèle) — skeleton évite
 * le blanc pendant le streaming initial.
 */
export default function DossierDetailLoading() {
  return (
    <div className="max-w-4xl space-y-4" aria-busy="true" aria-live="polite">
      <Button variant="ghost" size="sm" disabled>
        <ArrowLeft className="size-4" /> Retour aux dossiers
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2 min-w-0 flex-1">
          <SkelLine className="w-32 h-2.5" />
          <SkelLine className="w-56 h-7" />
        </div>
        <SkelBlock className="size-9" />
      </div>

      {/* Status pills row */}
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkelBlock key={i} className="h-7 w-24 rounded-pill shrink-0" />
        ))}
      </div>

      {/* Details card */}
      <Card variant="opaque" padding="default" className="space-y-2">
        <SkelLine className="w-3/4" />
        <SkelLine className="w-1/2 h-2.5" />
      </Card>

      {/* Workflow */}
      <Card variant="opaque" padding="default">
        <CardContent className="pt-2 space-y-3">
          <SkelLine className="w-1/3 h-4" />
          <SkelBlock className="h-1.5 rounded-full" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkelBlock key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Owner docs */}
      <Card variant="opaque" padding="default">
        <CardContent className="pt-2">
          <SkelLine className="w-1/4 h-4" />
        </CardContent>
      </Card>

      {/* Pieces */}
      <Card variant="opaque" padding="default">
        <CardContent className="pt-2 space-y-2">
          <SkelLine className="w-1/4 h-4" />
          {[0, 1, 2].map((i) => (
            <SkelBlock key={i} className="h-9 rounded-md" />
          ))}
        </CardContent>
      </Card>

      {/* Diagnostics list */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <SkelBlock key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
