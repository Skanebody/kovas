import { BadgeVerified } from '@/components/diagnostician/BadgeVerified'
import { TrustBadges, type TrustBadgesData } from '@/components/marketplace/TrustBadges'
import type { DiagnosticianSireneBadge } from '@/lib/data-gouv/recherche-entreprises/diagnostician-badge'
import type { AvailabilitySignals } from '@/lib/diag-availability'
import {
  DIAG_CERT_BY_CODE,
  formatFullName,
  getDiagDisplayName,
  hasMentionAudit,
} from '@/lib/diag-certifications'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import {
  ChevronRight,
  FileText,
  Flag,
  Lock,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import Link from 'next/link'
import { AvailabilitySection } from './availability-section'
import { CertCard } from './cert-card'
import { ClaimBanner } from './claim-banner'
import { DiagMap } from './diag-map'

// Type minimal — A1 régénère le type définitif depuis Supabase
// biome-ignore lint/suspicious/noExplicitAny: A1 creates the type
type DiagnosticianRow = any

type DiagnosticianPageContentProps = {
  diagnostician: DiagnosticianRow
  related: DiagnosticianRow[]
  dept: string
  city: string
  /** Niveau de badge vérification (Doctolib 2022). Default 'unverified'. */
  badgeLevel?: 'unverified' | 'verified' | 'verified_plus'
  /** Signaux de réactivité/fraîcheur (B37 / GC3). Optionnel : section masquée si null/0 signal. */
  availability?: AvailabilitySignals | null
  /** Badge "Activité diagnostic vérifiée" via API Recherche d'Entreprises (open data INSEE). */
  sireneBadge?: DiagnosticianSireneBadge | null
  /** Trust badges (Airbnb pattern) — bande sous le hero. Masquée si 0 signal. */
  trustBadges?: TrustBadgesData | null
}

const SERVICE_TYPES = [
  { code: 'DPE', label: 'DPE', desc: 'Diagnostic de performance énergétique' },
  { code: 'AMIANTE', label: 'Amiante', desc: 'Repérage amiante avant vente / location' },
  { code: 'PLOMB', label: 'Plomb (CREP)', desc: 'Constat de risque d’exposition au plomb' },
  { code: 'GAZ', label: 'Gaz', desc: 'État de l’installation intérieure gaz' },
  { code: 'ELECTRICITE', label: 'Électricité', desc: 'État de l’installation électrique' },
  { code: 'TERMITES', label: 'Termites', desc: 'État relatif à la présence de termites' },
  { code: 'CARREZ', label: 'Loi Carrez / Boutin', desc: 'Mesurage de surface privative' },
  { code: 'ERP', label: 'ERP', desc: 'État des risques et pollutions' },
] as const

/**
 * Contenu de la page publique diagnostiqueur.
 * Server Component — rendu côté serveur, hydratation client pour la carte uniquement.
 */
export function DiagnosticianPageContent({
  diagnostician: d,
  related,
  dept,
  city,
  badgeLevel = 'unverified',
  availability = null,
  sireneBadge = null,
  trustBadges = null,
}: DiagnosticianPageContentProps) {
  // AUDIT-A — Mapping schéma canonique (post-consolidation FIX-AA) :
  //   full_name canonique (fallback first_name+last_name), postal_code → postcode,
  //   official_phone → phone, geo_lat/geo_lng → latitude/longitude (fallback geo_*),
  //   years_experience → years_active.
  // FIX-RR — company_name reintroduite (migration 20260524410000) pour afficher
  // la raison sociale du cabinet plutot que le nom du gerant.
  const rawFullName: string =
    (typeof d.full_name === 'string' && d.full_name.trim()) || formatName(d.first_name, d.last_name)
  const formattedGerant = formatFullName(rawFullName)
  const companyName: string = typeof d.company_name === 'string' ? d.company_name.trim() : ''
  // Nom d'affichage public (preference societe > gerant).
  const displayName: string =
    getDiagDisplayName({
      company_name: companyName || null,
      full_name: rawFullName,
    }) || rawFullName
  const subtitleGerant: string | null = companyName && formattedGerant ? formattedGerant : null
  // Conserve l'alias `fullName` (gerant capitalise) pour le breadcrumb/initiales legacy.
  const fullName = formattedGerant || rawFullName
  const deptLabel = decodeURIComponent(dept)
  const cityLabel = decodeURIComponent(city)
  const isUnclaimed = d.claim_status === 'unclaimed'
  const certifications: Array<{
    type: string
    organism: string
    number: string | null
    valid_until: string | null
    status?: 'active' | 'expired' | 'pending' | null
  }> = Array.isArray(d.certifications) ? d.certifications : []
  // FIX-RR — flag premium audit energetique avec mention (DPE_MENTION).
  const isMentionAudit = hasMentionAudit(certifications)
  const services: string[] = Array.isArray(d.services) ? d.services : []
  const serviceCards = services.length
    ? SERVICE_TYPES.filter((s) => services.includes(s.code))
    : SERVICE_TYPES
  const ratingValue: number | null = typeof d.gmb_rating === 'number' ? d.gmb_rating : null
  const reviewCount: number | null =
    typeof d.gmb_review_count === 'number' ? d.gmb_review_count : null
  const reviews: Array<{ author: string; rating: number; text: string; date?: string }> =
    Array.isArray(d.gmb_reviews) ? d.gmb_reviews.slice(0, 3) : []
  const lat: number | null =
    typeof d.latitude === 'number' ? d.latitude : typeof d.geo_lat === 'number' ? d.geo_lat : null
  const lng: number | null =
    typeof d.longitude === 'number' ? d.longitude : typeof d.geo_lng === 'number' ? d.geo_lng : null
  const postcodeCanonical: string | null =
    (typeof d.postcode === 'string' && d.postcode) ||
    (typeof d.postal_code === 'string' && d.postal_code) ||
    null
  // PII MASQUÉE : Le téléphone n'est JAMAIS affiché publiquement (modèle Doctolib).
  // KOVAS monétise la mise en relation via le funnel `/devis/[slug]`. Donner le
  // numéro direct ferait perdre la commission lead. La colonne reste en DB,
  // visible côté dashboard /dashboard/leads/incoming pour le diag claimé.
  const diagSlug: string = (typeof d.slug === 'string' && d.slug) || String(d.id)
  const yearsActive: number | null =
    typeof d.years_active === 'number'
      ? d.years_active
      : typeof d.years_experience === 'number'
        ? d.years_experience
        : null
  const radiusKm = typeof d.intervention_radius_km === 'number' ? d.intervention_radius_km : 30
  // Initiales pour l'avatar — dérivées du full_name canonique
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const initialFirst = nameParts[0] ?? ''
  const initialLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

  return (
    <div className="min-h-dvh flex flex-col bg-white text-[#0B1D33] font-display">
      <TopBar />

      {isUnclaimed ? <ClaimBanner diagnosticianId={String(d.id)} /> : null}

      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="border-b border-black/5 bg-white">
        <ol className="mx-auto max-w-6xl px-6 py-3 flex flex-wrap items-center gap-1.5 text-xs text-black/55">
          <li>
            <Link href="/" className="hover:text-[#0B1D33] transition-colors">
              Accueil
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li>
            <Link
              href="/trouver-un-diagnostiqueur"
              className="hover:text-[#0B1D33] transition-colors"
            >
              Diagnostiqueurs
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li>
            <Link
              href={`/trouver-un-diagnostiqueur/${dept}`}
              className="hover:text-[#0B1D33] transition-colors capitalize"
            >
              {deptLabel}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li>
            <Link
              href={`/trouver-un-diagnostiqueur/${dept}/${city}`}
              className="hover:text-[#0B1D33] transition-colors capitalize"
            >
              {cityLabel}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li className="text-[#0B1D33] font-medium">{displayName}</li>
        </ol>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-black/5">
          <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <div className="grid gap-8 md:grid-cols-[160px_1fr_auto] md:items-start">
              {/* FIX-RR — Avatar : initiales calculees sur le nom d'affichage public
                   (raison sociale > nom gerant), pas sur le first/last name brut. */}
              <AvatarBlock
                photoUrl={d.photo_url ?? null}
                firstName={initialFirst}
                lastName={initialLast}
              />

              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-[0.12em] text-black/50">
                  Diagnostiqueur immobilier · {cityLabel}
                </p>
                <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">
                  {displayName}
                </h1>
                {subtitleGerant ? (
                  <p className="mt-2 text-sm text-black/55">
                    Représenté par{' '}
                    <span className="font-medium text-black/75">{subtitleGerant}</span>
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {badgeLevel !== 'unverified' ? (
                    <BadgeVerified level={badgeLevel} size="md" />
                  ) : null}
                  {/* Badge "Activité diagnostic vérifiée" via API Recherche
                       d'Entreprises (api.gouv.fr, open data INSEE). Affiché
                       UNIQUEMENT si l'établissement est actif au registre
                       SIRENE ET enregistré sous un code NAF diagnostic
                       (71.20B Analyses techniques ou 71.12B Ingénierie). */}
                  {sireneBadge?.isVerified ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1D33]/5 px-3 py-1 text-xs font-medium text-[#0B1D33]"
                      title="Vérification effectuée auprès du registre SIRENE de l'INSEE (Open Data)."
                    >
                      <Lock className="h-3 w-3" aria-hidden />
                      Activité diagnostic immobilier vérifiée
                      {sireneBadge.nafCode ? (
                        <span className="text-[#0B1D33]/55"> · Code NAF {sireneBadge.nafCode}</span>
                      ) : null}
                    </span>
                  ) : null}
                  {/* FIX-RR — Badge premium audit énergétique avec mention (DPE_MENTION) */}
                  {isMentionAudit ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#D4F542] px-3 py-1 text-xs font-semibold text-[#0B1D33] shadow-sm"
                      title="Habilité audit énergétique réglementaire (passoires F/G — loi Climat & Résilience 2023)"
                    >
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Audit énergétique avec mention
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {certifications
                    .filter((c) => c.type !== 'DPE_MENTION')
                    .slice(0, 4)
                    .map((c) => {
                      const def = DIAG_CERT_BY_CODE[c.type]
                      const label = def?.short ?? c.type
                      return (
                        <span
                          key={`${c.type}-${c.number ?? c.organism}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1D33]/5 px-3 py-1 text-xs font-medium text-[#0B1D33]"
                          title={def?.description}
                        >
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          {label}
                        </span>
                      )
                    })}
                </div>

                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-black/40" aria-hidden />
                    <dt className="sr-only">Ville</dt>
                    <dd className="text-black/75">
                      {cityLabel}
                      {postcodeCanonical ? ` · ${postcodeCanonical}` : ''}
                    </dd>
                  </div>
                  {ratingValue !== null && reviewCount !== null && reviewCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" fill="currentColor" aria-hidden />
                      <dt className="sr-only">Note Google</dt>
                      <dd className="text-black/75">
                        <span className="font-semibold text-[#0B1D33]">
                          {ratingValue.toFixed(1)}
                        </span>{' '}
                        <span className="text-black/55">· {reviewCount} avis Google</span>
                      </dd>
                    </div>
                  ) : null}
                  {yearsActive !== null && yearsActive > 0 ? (
                    <div>
                      <dt className="sr-only">Expérience</dt>
                      <dd className="text-black/75">
                        <span className="font-semibold text-[#0B1D33]">{yearsActive}</span>{' '}
                        <span className="text-black/55">ans d&apos;expérience</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="flex flex-col gap-2.5 md:items-end md:min-w-[220px]">
                <Link
                  href={`/devis/${diagSlug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D4F542] text-[#0B1D33] px-6 py-3 text-sm font-semibold hover:bg-[#c4e636] transition-colors shadow-sm w-full md:w-auto"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  Demander un devis gratuit
                </Link>
                <p className="text-[11px] text-black/45 md:text-right max-w-[220px]">
                  Réponse sous 24h ouvrées. Sans engagement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Badges (Airbnb pattern) — masqué si 0 signal valide */}
        {trustBadges ? <TrustBadges data={trustBadges} /> : null}

        {/* 01 — Certifications */}
        <section className="border-b border-black/5">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <SectionHeader number="01" title="Certifications COFRAC actives" />
            {certifications.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {certifications.map((c) => (
                  <CertCard key={`${c.type}-${c.number ?? c.organism}`} certification={c} />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-black/55">
                Aucune certification renseignée pour le moment.
              </p>
            )}
          </div>
        </section>

        {/* Split layout : main + sidebar */}
        <section className="border-b border-black/5">
          <div className="mx-auto max-w-6xl px-6 py-12 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div className="space-y-12 min-w-0">
              {/* 02 — Services */}
              <div>
                <SectionHeader number="02" title="Services proposés" />
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {serviceCards.map((s) => (
                    <div key={s.code} className="rounded-2xl border border-black/8 bg-white p-5">
                      <p className="text-xs font-mono uppercase tracking-[0.08em] text-black/45">
                        {s.code}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold text-[#0B1D33]">{s.label}</h3>
                      <p className="mt-1 text-sm text-black/60">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 03 — Zone intervention */}
              <div>
                <SectionHeader number="03" title="Zone d'intervention" />
                <p className="mt-2 text-sm text-black/60">
                  Rayon de {radiusKm} km autour de {cityLabel}
                  {postcodeCanonical ? ` (${postcodeCanonical})` : ''}.
                </p>
                <div className="mt-6">
                  {lat !== null && lng !== null ? (
                    <DiagMap
                      lat={lat}
                      lng={lng}
                      radiusKm={radiusKm}
                      name={fullName}
                      city={cityLabel}
                    />
                  ) : (
                    <div className="h-[320px] rounded-2xl border border-dashed border-black/15 flex items-center justify-center text-sm text-black/50">
                      Coordonnées géographiques non renseignées
                    </div>
                  )}
                </div>
              </div>

              {/* 04 — Réactivité & vérification (B37 / GC3) */}
              {availability && availability.signalsCount > 0 ? (
                <AvailabilitySection signals={availability} sectionNumber="04" />
              ) : null}

              {/* 05 — Avis Google */}
              {reviewCount !== null && reviewCount > 0 ? (
                <div>
                  <SectionHeader number="05" title="Avis Google" />
                  <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-serif italic text-5xl text-[#0B1D33]">
                        {ratingValue !== null ? ratingValue.toFixed(1) : '—'}
                      </span>
                      <div className="text-sm">
                        <div className="flex items-center gap-0.5" aria-hidden>
                          {[0, 1, 2, 3, 4].map((i) => (
                            <Star
                              key={i}
                              className={[
                                'h-4 w-4',
                                ratingValue !== null && i < Math.round(ratingValue)
                                  ? 'text-amber-500'
                                  : 'text-black/15',
                              ].join(' ')}
                              fill="currentColor"
                            />
                          ))}
                        </div>
                        <p className="text-black/55 mt-0.5">{reviewCount} avis vérifiés Google</p>
                      </div>
                    </div>

                    {reviews.length > 0 ? (
                      <ul className="mt-6 space-y-5 divide-y divide-black/5">
                        {reviews.map((r, i) => (
                          <li key={`${r.author}-${i}`} className={i > 0 ? 'pt-5' : ''}>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-[#0B1D33]">{r.author}</span>
                              <span className="flex items-center gap-0.5" aria-hidden>
                                {[0, 1, 2, 3, 4].map((j) => (
                                  <Star
                                    key={j}
                                    className={[
                                      'h-3.5 w-3.5',
                                      j < r.rating ? 'text-amber-500' : 'text-black/15',
                                    ].join(' ')}
                                    fill="currentColor"
                                  />
                                ))}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm text-black/70 leading-relaxed">{r.text}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Sidebar sticky — CTA devis (le formulaire est sur /devis/[slug]) */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div
                id="quote-form"
                className="rounded-2xl border border-black/8 bg-[#F7F6F2] p-6"
                data-quote-form
                data-diagnostician-id={String(d.id)}
              >
                <p className="text-xs font-mono uppercase tracking-[0.08em] text-black/50">
                  Demande de devis
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#0B1D33]">
                  Contacter {companyName || initialFirst || fullName}
                </h2>
                <p className="mt-2 text-sm text-black/65">
                  Décrivez votre projet, recevez un devis sous 24 heures ouvrées. Sans engagement.
                </p>
                <Link
                  href={`/devis/${diagSlug}`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D4F542] text-[#0B1D33] px-6 py-3 text-sm font-semibold hover:bg-[#c4e636] transition-colors shadow-sm"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  Demander un devis gratuit
                </Link>
                <ul className="mt-5 space-y-2 text-xs text-black/55">
                  <li className="flex items-start gap-2">
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-black/45 mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <span>Vos coordonnées transmises uniquement au diagnostiqueur</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-black/45 mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <span>Pas de démarchage tiers, RGPD respecté</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-black/45 mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <span>Devis détaillé sous 24 heures ouvrées</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </section>

        {/* 06 — Related */}
        {related.length > 0 ? (
          <section className="border-b border-black/5">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <SectionHeader number="06" title={`Autres diagnostiqueurs à ${cityLabel}`} />
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {related.map((r) => (
                  <RelatedCard key={String(r.id)} diagnostician={r} dept={dept} city={city} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Lien signalement discret en bas de page */}
        <section className="border-t border-black/5 bg-white py-8">
          <div className="mx-auto max-w-6xl px-6 text-center text-xs text-black/40">
            <Link
              href={`/signaler-un-diagnostiqueur/${String(d.id)}`}
              className="inline-flex items-center gap-1.5 hover:text-black/70 transition-colors"
            >
              <Flag className="h-3 w-3" aria-hidden />
              Signaler un problème avec ce diagnostiqueur
            </Link>
          </div>
        </section>
      </main>

      <DarkFooter />
    </div>
  )
}

function TopBar() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-black/5">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden className="inline-block size-7 rounded-md bg-[#0B1D33]" />
          <span className="text-base font-bold tracking-tight text-[#0B1D33]">KOVAS</span>
        </Link>

        <search className="hidden md:flex flex-1 max-w-md">
          <form
            action="/trouver-un-diagnostiqueur"
            method="GET"
            className="w-full"
            aria-label="Rechercher un diagnostiqueur"
          >
            <label className="relative w-full">
              <span className="sr-only">Rechercher un diagnostiqueur</span>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                placeholder="Rechercher par ville, nom, code postal..."
                className="w-full rounded-full border border-black/10 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/15 focus:border-[#0B1D33]/40"
              />
            </label>
          </form>
        </search>

        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/trouver-un-diagnostiqueur"
            className="hidden sm:inline text-black/70 hover:text-[#0B1D33] transition-colors"
          >
            Annuaire
          </Link>
          <Link
            href="/pricing"
            className="hidden sm:inline text-black/70 hover:text-[#0B1D33] transition-colors"
          >
            Pour les pros
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full bg-[#0B1D33] text-white px-4 py-2 text-sm font-medium hover:bg-[#08152a] transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  )
}

function AvatarBlock({
  photoUrl,
  firstName,
  lastName,
}: {
  photoUrl: string | null
  firstName: string
  lastName: string
}) {
  const initials = `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className="h-32 w-32 md:h-40 md:w-40 rounded-2xl object-cover border border-black/8"
        loading="lazy"
      />
    )
  }
  return (
    <div
      aria-hidden
      className="h-32 w-32 md:h-40 md:w-40 rounded-2xl bg-[#0B1D33] text-white flex items-center justify-center font-serif italic text-5xl"
    >
      {initials || '—'}
    </div>
  )
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-xs text-black/40 uppercase tracking-[0.12em]">{number}</span>
      <div className="h-px flex-1 bg-black/8" aria-hidden />
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0B1D33] shrink-0 ml-4">
        {title}
      </h2>
    </div>
  )
}

function RelatedCard({
  diagnostician: r,
  dept,
  city,
}: {
  diagnostician: DiagnosticianRow
  dept: string
  city: string
}) {
  // FIX-RR — Preference d'affichage : raison sociale > nom du gerant.
  const rawFullName: string =
    (typeof r.full_name === 'string' && r.full_name.trim()) || formatName(r.first_name, r.last_name)
  const formattedGerant = formatFullName(rawFullName)
  const companyTrim = typeof r.company_name === 'string' ? r.company_name.trim() : ''
  const displayName =
    getDiagDisplayName({
      company_name: companyTrim || null,
      full_name: rawFullName,
    }) || rawFullName
  const subtitleGerant = companyTrim && formattedGerant ? formattedGerant : null
  const certs: Array<{ type: string }> = Array.isArray(r.certifications) ? r.certifications : []
  const isMention = hasMentionAudit(certs)
  const slug = r.slug ?? ''
  const cityLabel: string = (typeof r.city === 'string' && r.city) || ''
  const parts = displayName.split(/\s+/).filter(Boolean)
  const init1 = (parts[0]?.[0] ?? '').toUpperCase()
  const init2 = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '').toUpperCase() : ''

  return (
    <Link
      href={`/trouver-un-diagnostiqueur/${dept}/${city}/${slug}`}
      className="group block rounded-2xl border border-black/8 bg-white p-5 hover:border-[#0B1D33]/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="h-12 w-12 rounded-xl bg-[#0B1D33]/[0.06] flex items-center justify-center font-semibold text-[#0B1D33]"
        >
          {`${init1}${init2}`}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[#0B1D33] truncate group-hover:underline underline-offset-2">
            {displayName}
          </h3>
          {subtitleGerant ? (
            <p className="text-[10px] text-black/45 truncate">Représenté par {subtitleGerant}</p>
          ) : null}
          {cityLabel ? <p className="text-xs text-black/55 truncate">{cityLabel}</p> : null}
        </div>
      </div>
      {isMention ? (
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[#D4F542] px-2 py-0.5 text-[10px] font-semibold text-[#0B1D33]"
            title="Audit énergétique avec mention"
          >
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            Audit énergétique
          </span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {certs
          .filter((c) => c.type !== 'DPE_MENTION')
          .slice(0, 3)
          .map((c) => {
            const def = DIAG_CERT_BY_CODE[c.type]
            const label = def?.short ?? c.type
            return (
              <span
                key={c.type}
                className="rounded-full bg-[#0B1D33]/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#0B1D33]"
              >
                {label}
              </span>
            )
          })}
      </div>
    </Link>
  )
}

function DarkFooter() {
  return (
    <footer className="bg-[#0B1D33] text-white/80">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="inline-block size-7 rounded-md bg-white" />
            <span className="text-base font-bold tracking-tight text-white">KOVAS</span>
          </div>
          <p className="mt-3 text-sm text-white/55 leading-relaxed">
            L&apos;annuaire des diagnostiqueurs immobiliers certifiés en France.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-[0.12em] text-white/40">
            Particuliers
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/trouver-un-diagnostiqueur"
                className="hover:text-white transition-colors"
              >
                Trouver un diagnostiqueur
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-white transition-colors">
                Questions fréquentes
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-[0.12em] text-white/40">
            Professionnels
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/reclamer-ma-fiche" className="hover:text-white transition-colors">
                Réclamer ma fiche
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-white transition-colors">
                Logiciel KOVAS
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-[0.12em] text-white/40">KOVAS</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/mentions-legales" className="hover:text-white transition-colors">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/cgu" className="hover:text-white transition-colors">
                CGU
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="hover:text-white transition-colors">
                Confidentialité
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-5 text-xs text-white/45 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>
            © 2026 SASU {COMPANY_IDENTITY.legalName} · SIREN {COMPANY_IDENTITY.sirenFormatted} ·{' '}
            {COMPANY_IDENTITY.address.line1}, {COMPANY_IDENTITY.address.postalCode}{' '}
            {COMPANY_IDENTITY.address.city}
          </p>
          <p>
            <a
              href="mailto:contact@kovas.fr"
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              contact@kovas.fr
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

function formatName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || '—'
}
