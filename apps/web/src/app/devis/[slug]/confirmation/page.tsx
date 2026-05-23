/**
 * KOVAS — Page confirmation post-soumission devis.
 *
 * Route : /devis/[slug]/confirmation
 *
 * Note : le flow nominal du QuoteRequestForm redirige vers /verifier-mon-email/[token]
 * (OTP email anti-spam, Phase E E3). Cette page est :
 *   - Fallback statique pour visiteurs/bots qui accèdent directement à l'URL
 *   - Confirmation de courtoisie après vérification email (CTA cross-sell)
 *   - Robots : noindex (page transactionnelle privée)
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type RouteParams = { slug: string }
type PageProps = { params: Promise<RouteParams> }

// biome-ignore lint/suspicious/noExplicitAny: Diagnostician row type pending typegen
type DiagnosticianRow = any

async function fetchDiagnosticianBySlug(slug: string): Promise<DiagnosticianRow | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select(
      'id, slug, full_name, first_name, last_name, city, city_slug, department_code, dept_code',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return data as DiagnosticianRow
}

async function fetchNearbyDiagnosticians(
  citySlug: string | null,
  excludeId: string,
  limit = 2,
): Promise<DiagnosticianRow[]> {
  if (!citySlug) return []
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer
    const { data } = await (supabase as any)
      .from('diagnosticians')
      .select('id, slug, full_name, first_name, last_name, city, city_slug, department_code')
      .eq('city_slug', citySlug)
      .neq('id', excludeId)
      .eq('withdrawal_requested', false)
      .limit(limit)
    return Array.isArray(data) ? (data as DiagnosticianRow[]) : []
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: 'Demande envoyée · KOVAS',
  robots: { index: false, follow: false },
}

export default async function QuoteConfirmationPage({ params }: PageProps) {
  const { slug } = await params
  const diag = await fetchDiagnosticianBySlug(slug)

  if (!diag) {
    notFound()
  }

  const fullName: string =
    (typeof diag.full_name === 'string' && diag.full_name.trim()) ||
    [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim() ||
    'le diagnostiqueur'
  const citySlug: string | null = typeof diag.city_slug === 'string' ? diag.city_slug : null
  const deptCode: string | null =
    (typeof diag.department_code === 'string' && diag.department_code) ||
    (typeof diag.dept_code === 'string' && diag.dept_code) ||
    null

  const nearby = await fetchNearbyDiagnosticians(citySlug, String(diag.id), 2)

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Confirmation */}
          <Card variant="opaque" padding="lg" className="text-center">
            <div className="mx-auto size-12 rounded-full bg-pastel-lime flex items-center justify-center mb-4">
              <CheckCircle2 className="size-6 text-ink" aria-hidden />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Votre demande a bien été envoyée
            </h1>
            <p className="mt-3 text-[14px] text-ink-mute leading-relaxed">
              {fullName} a reçu votre demande de devis. Vous serez recontacté sous 24 heures ouvrées
              au maximum.
            </p>

            <ul className="mt-6 grid gap-2.5 text-left text-[13px] text-ink-soft">
              <li className="flex items-start gap-2.5">
                <Clock className="size-4 text-ink-mute mt-0.5 shrink-0" aria-hidden />
                <span>
                  Un email de confirmation vient de vous être envoyé. Pensez à vérifier vos spams.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-ink-mute mt-0.5 shrink-0" aria-hidden />
                <span>
                  Vos coordonnées ont été transmises uniquement à {fullName}, conformément à notre
                  politique RGPD.
                </span>
              </li>
            </ul>

            <p className="mt-6 text-[12px] text-ink-faint">
              Sans nouvelle sous 48 heures, vous pouvez le signaler depuis votre espace ou nous
              écrire à{' '}
              <a href="mailto:contact@kovas.fr" className="underline hover:text-ink-soft">
                contact@kovas.fr
              </a>
              .
            </p>
          </Card>

          {/* Cross-sell : autres diagnostiqueurs à proximité */}
          {nearby.length > 0 && deptCode && citySlug ? (
            <Card variant="opaque" padding="default">
              <h2 className="text-[15px] font-bold text-ink mb-1">
                Souhaitez-vous comparer avec d&apos;autres diagnostiqueurs ?
              </h2>
              <p className="text-[12px] text-ink-mute mb-4">
                Pour un devis solide, KOVAS recommande de comparer 2 à 3 devis avant de choisir.
              </p>
              <div className="space-y-2">
                {nearby.map((d) => {
                  const otherFullName: string =
                    (typeof d.full_name === 'string' && d.full_name.trim()) ||
                    [d.first_name, d.last_name].filter(Boolean).join(' ').trim() ||
                    'Diagnostiqueur'
                  const otherSlug: string = typeof d.slug === 'string' ? d.slug : String(d.id)
                  return (
                    <Link
                      key={String(d.id)}
                      href={`/devis/${otherSlug}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-paper px-3.5 py-3 hover:bg-cream-deep/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">
                          {otherFullName}
                        </p>
                        {d.city ? (
                          <p className="text-[11px] text-ink-mute truncate">{d.city}</p>
                        ) : null}
                      </div>
                      <ArrowRight className="size-4 text-ink-mute shrink-0" aria-hidden />
                    </Link>
                  )
                })}
              </div>
            </Card>
          ) : null}

          <div className="text-center pt-2">
            <Button asChild variant="outline" size="lg">
              <Link href="/trouver-un-diagnostiqueur">Retour à l&apos;annuaire</Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
