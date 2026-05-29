/**
 * KOVAS — Page publique de demande de devis (funnel monétisé annuaire).
 *
 * Route : /devis/[slug]   (slug = slug diagnostiqueur, ex. "raoul-chipot-75019")
 *
 * Pourquoi cette page existe (business critical) :
 *   Sur la fiche publique d'un diagnostiqueur (/trouver-un-diagnostiqueur/...),
 *   le téléphone et l'email NE SONT JAMAIS exposés (modèle Doctolib). Le seul
 *   chemin de mise en relation passe par /devis/[slug] → KOVAS monétise le lead
 *   (commission au diag claimé, ou pay-to-unlock pour lead orphelin).
 *
 * Server Component :
 *   - Charge le diagnostiqueur via createAdminClient() (bypass RLS, public design).
 *   - notFound() si introuvable ou withdrawal_requested.
 *   - Récupère verification_status pour afficher le badge Vérifié/Vérifié+.
 *   - Délègue le formulaire au composant <QuoteRequestForm /> (wizard 3 étapes,
 *     déjà testé en B2, smart defaults BAN + auto-détection diagnostics).
 *
 * Avatar particulier (CLAUDE.md §9) : SOBRE PROFESSIONNEL, vouvoiement, pas
 * d'emoji, brand V5 sage/navy/chartreuse.
 */

// Funnel devis canonique (refonte 2026-06-28) : on expose le formulaire OTP SMS
// (chemin /api/leads/* → dispatchRecipients → lead_assignments source de vérité),
// PAS l'ancien formulaire email legacy (components/public/QuoteRequestForm) qui
// n'alimentait que quote_request_recipients (invisible du dashboard diagnostiqueur).
import { QuoteRequestForm } from '@/components/annuaire/quote-request-form'
import { BadgeVerified } from '@/components/diagnostician/BadgeVerified'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Clock, MapPin, ShieldCheck, Star } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type RouteParams = { slug: string }
type PageProps = { params: Promise<RouteParams> }

const SITE_URL = 'https://kovas.fr'

// Type minimal — Database types à régénérer post-migration (cf. DEPLOY-4).
// biome-ignore lint/suspicious/noExplicitAny: Diagnostician row type pending typegen
type DiagnosticianRow = any

async function fetchDiagnosticianBySlug(slug: string): Promise<DiagnosticianRow | null> {
  // Page publique — admin client (bypass RLS) pour cohérence anon/authenticated
  // (cf. FIX-LL : RLS asymmetric sur diagnosticians peut masquer une fiche aux
  // users connectés). La table reste publique par design (annuaire SEO).
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer post-migration
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return data as DiagnosticianRow
}

async function fetchVerificationBadge(
  diagId: string,
): Promise<'unverified' | 'verified' | 'verified_plus'> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    // biome-ignore lint/suspicious/noExplicitAny: cross-schema view, types regen pending
    const { data } = await (supabase as any)
      .from('diagnostician_verification_status')
      .select('badge_level')
      .eq('diagnostician_id', diagId)
      .maybeSingle()
    if (!data) return 'unverified'
    return (data.badge_level as 'unverified' | 'verified' | 'verified_plus' | null) ?? 'unverified'
  } catch {
    return 'unverified'
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const diag = await fetchDiagnosticianBySlug(slug)

  if (!diag || diag.withdrawal_requested === true) {
    return {
      title: 'Demande de devis · Diagnostiqueur introuvable',
      robots: { index: false, follow: false },
    }
  }

  const fullName: string =
    (typeof diag.full_name === 'string' && diag.full_name.trim()) ||
    [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim() ||
    'Diagnostiqueur'
  const city: string = typeof diag.city === 'string' ? diag.city : ''
  const title = `Demander un devis à ${fullName}${city ? ` (${city})` : ''} | KOVAS`
  const description = `Demandez un devis gratuit à ${fullName}, diagnostiqueur immobilier indépendant${city ? ` à ${city}` : ''}. Réponse sous 24 heures ouvrées. Sans engagement.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/devis/${slug}` },
    // Page transactionnelle — robots index OK pour capter "demander devis [diag]"
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/devis/${slug}`,
      siteName: 'KOVAS',
      locale: 'fr_FR',
    },
  }
}

export default async function QuoteRequestPage({ params }: PageProps) {
  const { slug } = await params
  const diag = await fetchDiagnosticianBySlug(slug)

  if (!diag || diag.withdrawal_requested === true) {
    notFound()
  }

  const badgeLevel = await fetchVerificationBadge(String(diag.id))

  // ─── Champs canoniques (cf. AUDIT-A schema) ───
  const fullName: string =
    (typeof diag.full_name === 'string' && diag.full_name.trim()) ||
    [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim() ||
    'Diagnostiqueur'
  const cityLabel: string = typeof diag.city === 'string' ? diag.city : ''
  const ratingValue: number | null = typeof diag.gmb_rating === 'number' ? diag.gmb_rating : null
  const reviewCount: number | null =
    typeof diag.gmb_review_count === 'number' ? diag.gmb_review_count : null
  const yearsActive: number | null =
    typeof diag.years_active === 'number'
      ? diag.years_active
      : typeof diag.years_experience === 'number'
        ? diag.years_experience
        : null
  const photoUrl: string | null = typeof diag.photo_url === 'string' ? diag.photo_url : null

  // Certifications canoniques (jsonb [{type,...}] ou legacy string[])
  const certs: string[] = (() => {
    const raw = Array.isArray(diag.certifications) ? diag.certifications : []
    return raw
      .map((c: unknown) => {
        if (typeof c === 'string') return c
        if (c && typeof c === 'object' && 'type' in c) {
          const t = (c as { type?: unknown }).type
          return typeof t === 'string' ? t : null
        }
        return null
      })
      .filter((c: string | null): c is string => Boolean(c))
  })()

  // Avatar initiales
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const initials = (
    (nameParts[0]?.[0] ?? '') +
    (nameParts.length > 1 ? (nameParts[nameParts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase()

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero — diagnostiqueur context + reassurance */}
        <section className="px-4 sm:px-6 py-8 sm:py-10 border-b border-rule/60">
          <div className="mx-auto max-w-5xl">
            {/* Breadcrumb-style retour */}
            <nav aria-label="Fil d'Ariane" className="mb-5 text-[12px] text-ink-faint">
              <Link href="/trouver-un-diagnostiqueur" className="hover:text-ink transition-colors">
                Annuaire
              </Link>
              <span className="mx-1.5">·</span>
              <span className="text-ink-mute">Demande de devis</span>
            </nav>

            <div className="grid gap-6 sm:grid-cols-[88px_1fr] items-start">
              {/* Avatar */}
              <div className="shrink-0">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={fullName}
                    className="size-[88px] rounded-2xl object-cover border border-rule"
                    loading="lazy"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="size-[88px] rounded-2xl bg-cream-deep flex items-center justify-center font-serif italic text-3xl text-navy border border-rule"
                  >
                    {initials || '—'}
                  </div>
                )}
              </div>

              {/* Identity + meta */}
              <div className="min-w-0">
                <Badge variant="outline" className="mb-2">
                  Devis gratuit · Sans engagement
                </Badge>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
                  Demander un devis à {fullName}
                </h1>
                <p className="mt-1.5 text-[14px] text-ink-mute">
                  Réponse sous 24 heures ouvrées
                  {cityLabel ? (
                    <>
                      {' '}
                      ·{' '}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden /> {cityLabel}
                      </span>
                    </>
                  ) : null}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  {badgeLevel !== 'unverified' ? (
                    <BadgeVerified level={badgeLevel} size="sm" />
                  ) : null}
                  {ratingValue !== null && reviewCount !== null && reviewCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
                      <Star className="size-3.5 fill-amber text-amber" aria-hidden />
                      <span className="font-semibold">{ratingValue.toFixed(1)}</span>
                      <span className="text-ink-faint">· {reviewCount} avis Google</span>
                    </span>
                  ) : null}
                  {yearsActive !== null && yearsActive > 0 ? (
                    <span className="text-[12px] text-ink-soft">
                      <span className="font-semibold">{yearsActive}</span> ans d&apos;expérience
                    </span>
                  ) : null}
                </div>

                {/* Tags certifications (max 6 affichées) */}
                {certs.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {certs.slice(0, 6).map((c) => (
                      <Badge key={c} variant="muted" className="font-normal">
                        <ShieldCheck className="size-3 mr-1" aria-hidden />
                        {c}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Reassurance strip */}
        <section className="px-4 sm:px-6 py-5 border-b border-rule/60 bg-cream-deep/40">
          <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <ReassuranceItem
              icon={<Clock className="size-4" aria-hidden />}
              title="Sous 24h ouvrées"
              text="Le diagnostiqueur te recontacte rapidement"
            />
            <ReassuranceItem
              icon={<ShieldCheck className="size-4" aria-hidden />}
              title="Coordonnées protégées"
              text="Transmises uniquement au diagnostiqueur, pas de démarchage"
            />
            <ReassuranceItem
              icon={<CheckCircle2 className="size-4" aria-hidden />}
              title="Sans engagement"
              text="Compare plusieurs devis avant de choisir"
            />
          </div>
        </section>

        {/* Formulaire */}
        <section className="px-4 sm:px-6 py-8 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <QuoteRequestForm diagnosticianId={String(diag.id)} diagnosticianName={fullName} />

            <p className="mt-5 text-center text-[11px] text-ink-faint leading-relaxed">
              En soumettant ce formulaire, vous acceptez que vos données soient transmises au
              diagnostiqueur ainsi qu&apos;à KOVAS pour le traitement de votre demande conformément
              à nos{' '}
              <Link href="/cgu" className="underline hover:text-ink-soft">
                conditions générales
              </Link>{' '}
              et notre{' '}
              <Link href="/confidentialite" className="underline hover:text-ink-soft">
                politique de confidentialité
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Schema.org — page transactionnelle */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `Demande de devis · ${fullName}`,
            url: `${SITE_URL}/devis/${slug}`,
            description: `Formulaire de demande de devis pour ${fullName}, diagnostiqueur immobilier.`,
            // FIX-PP — pas de telephone, pas d'email dans le JSON-LD public.
          }),
        }}
      />
    </div>
  )
}

function ReassuranceItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <Card variant="opaque" padding="sm" className="flex items-start gap-3">
      <div className="shrink-0 size-8 rounded-lg bg-paper flex items-center justify-center text-ink border border-rule">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-tight">{title}</p>
        <p className="mt-0.5 text-[12px] text-ink-mute leading-snug">{text}</p>
      </div>
    </Card>
  )
}

export const revalidate = 600 // ISR 10 min — la fiche change peu, le form est client
