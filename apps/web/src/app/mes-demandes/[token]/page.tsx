import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicNav } from '@/components/public/PublicNav'
import type { TimelineResponse } from '@/app/api/quote-requests/[token]/timeline/route'
import { QuoteRequestTimeline } from './quote-request-timeline'

export const metadata: Metadata = {
  title: 'Suivre ma demande de devis — KOVAS',
  description: 'Suivez en temps réel les réponses des diagnostiqueurs contactés.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ token: string }>
}

async function fetchTimeline(token: string): Promise<TimelineResponse | null> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'kovas.fr'
  const protocol = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`

  try {
    const res = await fetch(
      `${baseUrl}/api/quote-requests/${encodeURIComponent(token)}/timeline`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    return (await res.json()) as TimelineResponse
  } catch {
    return null
  }
}

export default async function MesDemandesPage({ params }: PageProps) {
  const { token } = await params
  const timeline = await fetchTimeline(token)

  if (!timeline) {
    notFound()
  }

  return (
    <div className="min-h-dvh bg-[#F8F5EE] text-[#0F1E3D] font-sans antialiased flex flex-col">
      <PublicNav variant="b2c" />
      <main className="flex-1 px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <QuoteRequestTimeline timeline={timeline} />
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
