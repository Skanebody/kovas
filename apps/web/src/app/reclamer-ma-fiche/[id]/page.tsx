import { Card } from '@/components/ui/card'
import { isFrenchMobile, maskEmail, maskPhone, maskSiret } from '@/lib/diagnosticians/mask-contact'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { MapPin, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClaimMethodTabs } from './claim-method-tabs'

/**
 * Page publique de réclamation de fiche (Mission A4 — FIX-FF refonte 2026-05-23).
 *
 * Server component — charge le diag depuis le schéma canonique consolidé
 * (cf. migration 20260524110000_diagnosticians_unified.sql), masque les
 * contacts officiels, et instancie le composant client de vérification 3
 * méthodes (Email pro / Sirene / SMS) + fallback Justificatif manuel.
 *
 * URL : /reclamer-ma-fiche/<diagnostician_id>
 * Anon — pas d'auth requise (l'auth se fait après vérification → /signup?claim_id=)
 *
 * ROOT CAUSE du bug 404 initial (FIX-FF, mai 2026) :
 *   Le code A4 ciblait les anciennes colonnes (display_name, official_email,
 *   official_phone, postal_code, official_company_name) qui ont été renommées
 *   par la consolidation de Phase A. Le SELECT échouait avec PostgREST 42703
 *   ("column does not exist") → data=null → notFound(). On lit désormais le
 *   schéma canonique : full_name, email, phone, postcode (+ pas de company_name
 *   stockée — on dérive le label cabinet du SIRET via verify-siret côté API).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Une certification peut être stockée sous deux formes en DB :
 *   - string[] (legacy bandit/seed simple) : ['DPE', 'AMIANTE', ...]
 *   - object[] (DHUP enrichi)              : [{ type, number, status, organism, valid_until }, ...]
 *
 * Le helper extractCertLabel() unifie l'affichage.
 */
type CertificationRaw =
  | string
  | { type?: string | null; number?: string | null; status?: string | null }

interface DiagnosticianRow {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  city: string | null
  postcode: string | null
  department_code: string | null
  certifications: CertificationRaw[] | null
  email: string | null
  phone: string | null
  sirene_siret: string | null
  claim_status: string | null
  slug: string | null
  slug_city: string | null
}

/** Normalise un item certifications en label affichable. */
function extractCertLabel(cert: CertificationRaw): string {
  if (typeof cert === 'string') return cert
  if (cert && typeof cert === 'object' && typeof cert.type === 'string' && cert.type.trim()) {
    return cert.type.trim()
  }
  return ''
}

async function loadDiagnostician(id: string): Promise<DiagnosticianRow | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }

  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // biome-ignore lint/suspicious/noExplicitAny: types Database non régénérés post-migration 20260524110000 (cf. tâche DEPLOY-4 pending)
  const adminAny = admin as any

  const { data, error } = await adminAny
    .from('diagnosticians')
    .select(
      'id, full_name, first_name, last_name, city, postcode, department_code, certifications, email, phone, sirene_siret, claim_status, slug, slug_city',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    // Erreur SQL : on log et renvoie null (la page affichera 404)
    console.error('[reclamer-ma-fiche] loadDiagnostician error:', error.message)
    return null
  }

  return (data as DiagnosticianRow | null) ?? null
}

/** Formate le nom complet à afficher (full_name si présent, sinon first + last). */
function buildDisplayName(diag: DiagnosticianRow): string {
  if (diag.full_name?.trim()) return diag.full_name.trim()
  const fn = (diag.first_name ?? '').trim()
  const ln = (diag.last_name ?? '').trim()
  const composed = `${fn} ${ln}`.trim()
  return composed || 'Diagnostiqueur'
}

export default async function ReclamerMaFichePage({ params }: PageProps) {
  const { id } = await params
  const diag = await loadDiagnostician(id)
  if (!diag) notFound()

  const displayName = buildDisplayName(diag)

  // Si déjà claimed, on bloque la page (et propose retour annuaire)
  if (diag.claim_status === 'claimed') {
    return (
      <div className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <Card variant="flat" padding="lg" className="text-center">
            <ShieldCheck className="size-12 text-ink mx-auto mb-4" aria-hidden />
            <h1 className="text-xl font-bold text-ink mb-2">Fiche déjà réclamée</h1>
            <p className="text-[14px] text-ink-mute mb-6">
              Cette fiche professionnelle a déjà été réclamée par son titulaire. Si vous pensez
              qu&apos;il s&apos;agit d&apos;une erreur, contactez{' '}
              <a href="mailto:contact@kovas.fr" className="underline">
                contact@kovas.fr
              </a>
              .
            </p>
            <Link href="/trouver-un-diagnostiqueur" className="text-[13px] underline text-ink">
              Retour à l&apos;annuaire
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  // Slug pour retour annuaire (le wrong_person flow est sur la page détail diag)
  const dept = diag.department_code?.toLowerCase() ?? null
  const citySlug = diag.slug_city ?? diag.city?.toLowerCase().replace(/\s+/g, '-') ?? null
  const detailHref =
    dept && citySlug && diag.slug
      ? `/trouver-un-diagnostiqueur/${dept}/${citySlug}/${diag.slug}?report=wrong_person`
      : '/trouver-un-diagnostiqueur'

  return (
    <div className="py-12 px-4 md:py-16">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-10 max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mb-3">
            Annuaire KOVAS · Réclamation
          </p>
          <h1 className="text-[28px] md:text-[36px] font-display font-bold text-ink leading-tight">
            Réclamez <span className="text-display-serif italic font-normal">votre fiche</span>
          </h1>
          <p className="text-[15px] text-ink-mute mt-4 leading-relaxed">
            Vérifiez votre identité pour reprendre le contrôle de votre fiche publique. Trois
            méthodes au choix selon votre profil. Compte gratuit — vous restez maître de vos
            données.
          </p>
        </div>

        {/* Récap fiche cible */}
        <Card variant="flat" padding="default" className="mb-8 max-w-2xl">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mb-3">
            Fiche ciblée
          </p>
          <h2 className="text-[19px] font-semibold text-ink mb-1">{displayName}</h2>
          {diag.city && (
            <p className="text-[13px] text-ink-mute flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {diag.city}
              {diag.postcode ? ` (${diag.postcode})` : ''}
            </p>
          )}
          {Array.isArray(diag.certifications) && diag.certifications.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {diag.certifications
                .map(extractCertLabel)
                .filter((label) => label.length > 0)
                .map((label) => (
                  <span
                    key={label}
                    className="text-[11px] px-2.5 py-1 rounded-pill bg-pastel-butter text-ink font-medium"
                  >
                    {label}
                  </span>
                ))}
            </div>
          )}
        </Card>

        {/* Vérification 3 méthodes côte à côte (Email pro / SIRET / SMS) + fallback manuel */}
        <ClaimMethodTabs
          diagnosticianId={diag.id}
          maskedEmail={diag.email ? maskEmail(diag.email) : null}
          maskedPhone={diag.phone && isFrenchMobile(diag.phone) ? maskPhone(diag.phone) : null}
          maskedSiret={diag.sirene_siret ? maskSiret(diag.sirene_siret) : null}
          companyName={null}
        />

        {/* Footer escape : ce n'est pas moi */}
        <div className="mt-12 text-center">
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
  const displayName = diag ? buildDisplayName(diag) : null
  return {
    title: displayName
      ? `Réclamer la fiche de ${displayName} — KOVAS`
      : 'Réclamer ma fiche — KOVAS',
    robots: { index: false, follow: false },
  }
}
