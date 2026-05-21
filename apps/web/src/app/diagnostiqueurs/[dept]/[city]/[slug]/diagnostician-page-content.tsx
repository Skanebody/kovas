import Link from 'next/link'
import {
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Star,
  ShieldCheck,
  Search,
} from 'lucide-react'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { ClaimBanner } from './claim-banner'
import { CertCard } from './cert-card'
import { DiagMap } from './diag-map'

// Type minimal — A1 régénère le type définitif depuis Supabase
// biome-ignore lint/suspicious/noExplicitAny: A1 creates the type
type DiagnosticianRow = any

type DiagnosticianPageContentProps = {
  diagnostician: DiagnosticianRow
  related: DiagnosticianRow[]
  dept: string
  city: string
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
}: DiagnosticianPageContentProps) {
  const fullName = formatName(d.first_name, d.last_name)
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
  const services: string[] = Array.isArray(d.services) ? d.services : []
  const serviceCards = services.length
    ? SERVICE_TYPES.filter((s) => services.includes(s.code))
    : SERVICE_TYPES
  const ratingValue: number | null = typeof d.gmb_rating === 'number' ? d.gmb_rating : null
  const reviewCount: number | null =
    typeof d.gmb_review_count === 'number' ? d.gmb_review_count : null
  const reviews: Array<{ author: string; rating: number; text: string; date?: string }> =
    Array.isArray(d.gmb_reviews) ? d.gmb_reviews.slice(0, 3) : []
  const lat = typeof d.geo_lat === 'number' ? d.geo_lat : null
  const lng = typeof d.geo_lng === 'number' ? d.geo_lng : null
  const radiusKm = typeof d.intervention_radius_km === 'number' ? d.intervention_radius_km : 30

  return (
    <div className="min-h-dvh flex flex-col bg-white text-[#0B1D33] font-display">
      <TopBar />

      {isUnclaimed ? <ClaimBanner diagnosticianId={String(d.id)} /> : null}

      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'Ariane"
        className="border-b border-black/5 bg-white"
      >
        <ol className="mx-auto max-w-6xl px-6 py-3 flex flex-wrap items-center gap-1.5 text-xs text-black/55">
          <li>
            <Link href="/" className="hover:text-[#0B1D33] transition-colors">
              Accueil
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li>
            <Link
              href="/diagnostiqueurs"
              className="hover:text-[#0B1D33] transition-colors"
            >
              Diagnostiqueurs
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li>
            <Link
              href={`/diagnostiqueurs/${dept}`}
              className="hover:text-[#0B1D33] transition-colors capitalize"
            >
              {deptLabel}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li>
            <Link
              href={`/diagnostiqueurs/${dept}/${city}`}
              className="hover:text-[#0B1D33] transition-colors capitalize"
            >
              {cityLabel}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-black/30" aria-hidden />
          <li className="text-[#0B1D33] font-medium">{fullName}</li>
        </ol>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-black/5">
          <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <div className="grid gap-8 md:grid-cols-[160px_1fr_auto] md:items-start">
              <AvatarBlock
                photoUrl={d.photo_url ?? null}
                firstName={d.first_name ?? ''}
                lastName={d.last_name ?? ''}
              />

              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-[0.12em] text-black/50">
                  Diagnostiqueur immobilier · {cityLabel}
                </p>
                <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">
                  {fullName}
                </h1>

                {d.company_name ? (
                  <p className="mt-2 text-base text-black/70">{d.company_name}</p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {certifications.slice(0, 4).map((c) => (
                    <span
                      key={`${c.type}-${c.number ?? c.organism}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1D33]/5 px-3 py-1 text-xs font-medium text-[#0B1D33]"
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {c.type}
                    </span>
                  ))}
                </div>

                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-black/40" aria-hidden />
                    <dt className="sr-only">Ville</dt>
                    <dd className="text-black/75">
                      {cityLabel}
                      {d.postal_code ? ` · ${d.postal_code}` : ''}
                    </dd>
                  </div>
                  {ratingValue !== null && reviewCount !== null && reviewCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <Star
                        className="h-4 w-4 text-amber-500"
                        fill="currentColor"
                        aria-hidden
                      />
                      <dt className="sr-only">Note Google</dt>
                      <dd className="text-black/75">
                        <span className="font-semibold text-[#0B1D33]">
                          {ratingValue.toFixed(1)}
                        </span>{' '}
                        <span className="text-black/55">
                          · {reviewCount} avis Google
                        </span>
                      </dd>
                    </div>
                  ) : null}
                  {typeof d.years_experience === 'number' && d.years_experience > 0 ? (
                    <div>
                      <dt className="sr-only">Expérience</dt>
                      <dd className="text-black/75">
                        <span className="font-semibold text-[#0B1D33]">
                          {d.years_experience}
                        </span>{' '}
                        <span className="text-black/55">ans d&apos;expérience</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="flex flex-col gap-2.5 md:items-end md:min-w-[200px]">
                <a
                  href="#quote-form"
                  className="inline-flex items-center justify-center rounded-full bg-[#0B1D33] text-white px-6 py-3 text-sm font-semibold hover:bg-[#08152a] transition-colors shadow-sm w-full md:w-auto"
                >
                  Demander un devis
                </a>
                {d.official_phone ? (
                  <a
                    href={`tel:${d.official_phone}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 px-6 py-3 text-sm font-medium hover:bg-black/[0.03] transition-colors w-full md:w-auto"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    {formatPhone(d.official_phone)}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* 01 — Certifications */}
        <section className="border-b border-black/5">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <SectionHeader number="01" title="Certifications COFRAC actives" />
            {certifications.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {certifications.map((c) => (
                  <CertCard
                    key={`${c.type}-${c.number ?? c.organism}`}
                    certification={c}
                  />
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
                    <div
                      key={s.code}
                      className="rounded-2xl border border-black/8 bg-white p-5"
                    >
                      <p className="text-xs font-mono uppercase tracking-[0.08em] text-black/45">
                        {s.code}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold text-[#0B1D33]">
                        {s.label}
                      </h3>
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
                  {d.postal_code ? ` (${d.postal_code})` : ''}.
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

              {/* 04 — Avis Google */}
              {reviewCount !== null && reviewCount > 0 ? (
                <div>
                  <SectionHeader number="04" title="Avis Google" />
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
                        <p className="text-black/55 mt-0.5">
                          {reviewCount} avis vérifiés Google
                        </p>
                      </div>
                    </div>

                    {reviews.length > 0 ? (
                      <ul className="mt-6 space-y-5 divide-y divide-black/5">
                        {reviews.map((r, i) => (
                          <li
                            key={`${r.author}-${i}`}
                            className={i > 0 ? 'pt-5' : ''}
                          >
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-[#0B1D33]">
                                {r.author}
                              </span>
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
                            <p className="mt-1.5 text-sm text-black/70 leading-relaxed">
                              {r.text}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Sidebar sticky — quote form placeholder (B2 fill) */}
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
                  Contacter {d.first_name}
                </h2>
                <p className="mt-2 text-sm text-black/65">
                  Décrivez votre projet, recevez un devis sous 24h. Sans engagement.
                </p>
                {/* Placeholder — Agent B2 remplace ce bloc par <QuoteRequestForm /> */}
                <div className="mt-5 rounded-xl border border-dashed border-black/15 p-4 text-xs text-black/45 text-center">
                  Formulaire de devis (composant client B2)
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* 05 — Related */}
        {related.length > 0 ? (
          <section className="border-b border-black/5">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <SectionHeader
                number="05"
                title={`Autres diagnostiqueurs à ${cityLabel}`}
              />
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {related.map((r) => (
                  <RelatedCard
                    key={String(r.id)}
                    diagnostician={r}
                    dept={dept}
                    city={city}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}
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
          <span
            aria-hidden
            className="inline-block size-7 rounded-md bg-[#0B1D33]"
          />
          <span className="text-base font-bold tracking-tight text-[#0B1D33]">
            KOVAS
          </span>
        </Link>

        <div className="hidden md:flex flex-1 max-w-md">
          <label className="relative w-full">
            <span className="sr-only">Rechercher un diagnostiqueur</span>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Rechercher par ville, nom, code postal..."
              className="w-full rounded-full border border-black/10 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/15 focus:border-[#0B1D33]/40"
            />
          </label>
        </div>

        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/diagnostiqueurs"
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
      // biome-ignore lint/performance/noImgElement: external URL, no Next/Image config
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
      <span className="font-mono text-xs text-black/40 uppercase tracking-[0.12em]">
        {number}
      </span>
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
  const fullName = formatName(r.first_name, r.last_name)
  const certs: Array<{ type: string }> = Array.isArray(r.certifications)
    ? r.certifications
    : []
  const slug = r.slug ?? ''

  return (
    <Link
      href={`/diagnostiqueurs/${dept}/${city}/${slug}`}
      className="group block rounded-2xl border border-black/8 bg-white p-5 hover:border-[#0B1D33]/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="h-12 w-12 rounded-xl bg-[#0B1D33]/[0.06] flex items-center justify-center font-semibold text-[#0B1D33]"
        >
          {`${(r.first_name?.[0] ?? '').toUpperCase()}${(r.last_name?.[0] ?? '').toUpperCase()}`}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[#0B1D33] truncate group-hover:underline underline-offset-2">
            {fullName}
          </h3>
          {r.company_name ? (
            <p className="text-xs text-black/55 truncate">{r.company_name}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {certs.slice(0, 3).map((c) => (
          <span
            key={c.type}
            className="rounded-full bg-[#0B1D33]/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#0B1D33]"
          >
            {c.type}
          </span>
        ))}
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
                href="/diagnostiqueurs"
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
              <Link
                href="/reclamer-ma-fiche"
                className="hover:text-white transition-colors"
              >
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
          <h3 className="text-xs font-mono uppercase tracking-[0.12em] text-white/40">
            KOVAS
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/mentions-legales"
                className="hover:text-white transition-colors"
              >
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/cgu" className="hover:text-white transition-colors">
                CGU
              </Link>
            </li>
            <li>
              <Link
                href="/confidentialite"
                className="hover:text-white transition-colors"
              >
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

function formatPhone(raw: string): string {
  // E.164 +33612345678 → 06 12 34 56 78
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('33') && digits.length === 11) {
    const local = `0${digits.slice(2)}`
    return local.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }
  return raw
}
