import { GainTrackerCard } from '@/app/app/dashboard/gain-tracker-card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Gain de temps' }

export default function GainPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dashboard">
          <ArrowLeft className="size-4" /> Tableau de bord
        </Link>
      </Button>

      <div className="space-y-2">
        <h1 className="text-display text-3xl md:text-4xl tracking-tight">
          Votre <span className="text-display-serif">gain de temps</span>
        </h1>
        <p className="text-sm text-ink-mute max-w-lg">
          Estimation basée sur les missions terminées ce mois (environ 1h30 gagnées par mission
          type DPE). Le suivi détaillé arrive en V1.5.
        </p>
      </div>

      <GainTrackerCard />
    </div>
  )
}
