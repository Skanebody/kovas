import { GainTrackerCard } from '@/app/app/dashboard/gain-tracker-card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Gain de temps' }

export default function GainPage() {
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 min-h-[70vh] bg-fluid-navy px-4 md:px-8 py-10 md:py-14 space-y-8 animate-fade-in">
      <Button
        variant="glass"
        size="sm"
        asChild
        className="border-paper/25 bg-paper/10 text-paper hover:bg-paper/20"
      >
        <Link href="/app/dashboard">
          <ArrowLeft className="size-4" /> Tableau de bord
        </Link>
      </Button>

      <div className="max-w-3xl space-y-2">
        <h1 className="font-display font-light text-display-m text-paper tracking-tight">
          Votre <span className="font-serif italic">gain de temps</span>
        </h1>
        <p className="text-[14px] text-paper/80 leading-[1.55]">
          Estimation basée sur les missions terminées ce mois (~1h30 par mission type DPE).
        </p>
      </div>

      <GainTrackerCard />
    </div>
  )
}
