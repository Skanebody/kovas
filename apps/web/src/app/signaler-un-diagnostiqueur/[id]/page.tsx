import { SignalementForm } from '@/components/diagnostician/SignalementForm'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Signaler un problème avec un diagnostiqueur · KOVAS',
  description:
    "Signaler une suspicion de fraude, d'usurpation d'identité ou de mauvais comportement professionnel sur un diagnostiqueur immobilier de l'annuaire KOVAS.",
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SignalementPage({ params }: PageProps) {
  const { id } = await params
  if (!id || id.length < 8) notFound()

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name, city')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  const row = data as {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
    city: string | null
  }
  const fullName =
    row.full_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    'Diagnostiqueur'

  return (
    <main className="min-h-screen bg-sage py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Modération annuaire
          </p>
          <h1 className="text-3xl font-display font-bold text-ink mt-2">
            Signaler un problème avec ce diagnostiqueur
          </h1>
          <p className="text-sm text-ink-mute mt-3 max-w-prose">
            Vous suspectez une fraude, une usurpation d'identité, un rapport aberrant ou un
            comportement non professionnel ? Décrivez la situation ci-dessous. Notre équipe enquête
            sous 48 heures ouvrables et peut suspendre temporairement la fiche en cas de risque
            avéré.
          </p>
          <div className="mt-4 rounded-lg border border-rule bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
              Diagnostiqueur signalé
            </p>
            <p className="text-base font-display font-semibold text-ink mt-1">{fullName}</p>
            {row.city ? <p className="text-sm text-ink-mute mt-0.5">{row.city}</p> : null}
          </div>
        </header>

        <SignalementForm diagnosticianId={row.id} />

        <footer className="mt-10 pt-6 border-t border-rule text-[12px] text-ink-faint space-y-2">
          <p>
            <strong className="text-ink-mute">Confidentialité.</strong> Votre signalement est traité
            par l'équipe modération de KOVAS dans le respect du RGPD. Votre email n'est jamais
            communiqué au diagnostiqueur signalé.
          </p>
          <p>
            <strong className="text-ink-mute">Anti-spam.</strong> Un seul signalement par
            diagnostiqueur et par 24 heures depuis votre connexion. Les signalements abusifs peuvent
            faire l'objet d'un blocage IP.
          </p>
        </footer>
      </div>
    </main>
  )
}
