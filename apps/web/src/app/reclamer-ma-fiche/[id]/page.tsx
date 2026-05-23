import { createClient as createAdminClient } from '@supabase/supabase-js'
import { MapPin, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Database } from '@kovas/database/types'
import { Card } from '@/components/ui/card'
import { isFrenchMobile, maskEmail, maskPhone, maskSiret } from '@/lib/diagnosticians/mask-contact'
import { ClaimMethodTabs } from './claim-method-tabs'

/**
 * Page publique de réclamation de fiche (Mission A4).
 * Server component — charge le diag, masque les contacts, instancie les tabs.
 *
 * URL : /reclamer-ma-fiche/<diagnostician_id>
 * Anon — pas d'auth requise (l'auth se fait après vérification → /signup?claim_id=)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

interface DiagnosticianRow {
  id: string
  display_name: string | null
  city: string | null
  postal_code: string | null
  department_code: string | null
  certifications: string[] | null
  official_email: string | null
  official_phone: string | null
  sirene_siret: string | null
  official_company_name: string | null
  claim_status: string | null
  slug: string | null
}

async function loadDiagnostician(id: string): Promise<DiagnosticianRow | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  const { data } = await adminAny
    .from('diagnosticians')
    .select(
      'id, display_name, city, postal_code, department_code, certifications, official_email, official_phone, sirene_siret, official_company_name, claim_status, slug',
    )
    .eq('id', id)
    .maybeSingle()

  return (data as DiagnosticianRow | null) ?? null
}

export default async function ReclamerMaFichePage({ params }: PageProps) {
  const { id } = await params
  const diag = await loadDiagnostician(id)
  if (!diag) notFound()

  // Si déjà claimed, on bloque la page (et propose retour annuaire)
  if (diag.claim_status === 'claimed') {
    return (
      <div className="min-h-dvh bg-cream py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <Card variant="flat" padding="lg" className="text-center">
            <ShieldCheck className="size-12 text-navy mx-auto mb-4" aria-hidden />
            <h1 className="text-xl font-bold text-ink mb-2">Fiche déjà réclamée</h1>
            <p className="text-[14px] text-ink-mute mb-6">
              Cette fiche professionnelle a déjà été réclamée par son titulaire.
              Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez{' '}
              <a href="mailto:contact@kovas.fr" className="underline">
                contact@kovas.fr
              </a>
              .
            </p>
            <Link href="/diagnostiqueurs" className="text-[13px] underline text-ink">
              Retour à l&apos;annuaire
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  // Préparation des données contact (masquées, jamais leakées en clair côté HTML)
  const hasEmail = !!diag.official_email
  const hasMobile = !!diag.official_phone && isFrenchMobile(diag.official_phone)
  const hasSiret = !!diag.sirene_siret
  const hasCompany = !!diag.official_company_name

  // Slug pour retour annuaire (le wrong_person flow est sur la page détail diag)
  const dept = diag.department_code?.toLowerCase() ?? null
  const citySlug = diag.city?.toLowerCase().replace(/\s+/g, '-') ?? null
  const detailHref =
    dept && citySlug && diag.slug
      ? `/diagnostiqueurs/${dept}/${citySlug}/${diag.slug}?report=wrong_person`
      : '/diagnostiqueurs'

  return (
    <div className="min-h-dvh bg-cream py-12 px-4 md:py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-2">
            Annuaire KOVAS
          </p>
          <h1 className="text-[28px] md:text-[34px] font-display font-bold text-ink leading-tight">
            Réclamer ma fiche{' '}
            <span className="text-display-serif italic font-normal">
              {diag.display_name ?? 'professionnelle'}
            </span>
          </h1>
          <p className="text-[14px] text-ink-mute mt-3">
            Vérifiez votre identité pour récupérer le contrôle de votre fiche publique
            et créer votre compte KOVAS.
          </p>
        </div>

        {/* Récap fiche */}
        <Card variant="flat" padding="sm" className="mb-6">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-3">
            C&apos;est bien cette fiche&nbsp;?
          </p>
          <h2 className="text-[17px] font-semibold text-ink mb-1">
            {diag.display_name ?? 'Sans nom'}
          </h2>
          {diag.city && (
            <p className="text-[13px] text-ink-mute flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {diag.city}
              {diag.postal_code ? ` (${diag.postal_code})` : ''}
            </p>
          )}
          {Array.isArray(diag.certifications) && diag.certifications.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {diag.certifications.map((cert) => (
                <span
                  key={cert}
                  className="text-[11px] px-2 py-0.5 rounded-pill bg-pastel-butter text-ink"
                >
                  {cert}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Tabs vérification */}
        <ClaimMethodTabs
          diagnosticianId={diag.id}
          maskedEmail={hasEmail ? maskEmail(diag.official_email!) : null}
          maskedPhone={hasMobile ? maskPhone(diag.official_phone!) : null}
          maskedSiret={hasSiret ? maskSiret(diag.sirene_siret!) : null}
          companyName={hasCompany ? diag.official_company_name : null}
        />

        {/* Footer : ce n'est pas moi */}
        <div className="mt-10 text-center">
          <Link
            href={detailHref}
            className="text-[12px] text-ink-mute underline underline-offset-4 hover:text-ink"
          >
            Ce n&apos;est pas moi — signaler une erreur
          </Link>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const diag = await loadDiagnostician(id)
  return {
    title: diag
      ? `Réclamer la fiche de ${diag.display_name ?? 'diagnostiqueur'} — KOVAS`
      : 'Réclamer ma fiche — KOVAS',
    robots: { index: false, follow: false },
  }
}
