import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NewExperimentForm } from './form'

export const metadata: Metadata = { title: 'Nouvelle expérience — KOVAS Admin' }

export default async function NewExperimentPage() {
  await getCurrentUser()

  return (
    <div className="space-y-6 max-w-2xl">
      <nav className="text-[11px] text-ink-mute">
        <Link href="/admin/ab-testing" className="hover:text-ink">
          A/B testing
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">Nouvelle expérience</span>
      </nav>

      <header>
        <h1 className="text-[24px] font-display font-bold text-ink">Nouvelle expérience</h1>
        <p className="text-[13px] text-ink-mute mt-1">
          L'expérience est créée en brouillon. Elle ne commencera à servir des variants qu'une fois
          activée depuis la page détail.
        </p>
      </header>

      <Card variant="opaque" padding="default">
        <NewExperimentForm />
      </Card>
    </div>
  )
}
