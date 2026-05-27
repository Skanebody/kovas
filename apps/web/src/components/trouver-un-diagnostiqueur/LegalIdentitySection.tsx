/**
 * KOVAS — Section "Identité légale" pour les fiches publiques diagnostiqueurs.
 *
 * Affiche les données SIRENE OPEN DATA INSEE : SIRET formaté, raison sociale,
 * forme juridique, code NAF, date d'immatriculation. Équivalent du badge RPPS
 * sur Doctolib — preuve d'existence légale exposée volontairement pour la
 * transparence annuaire.
 *
 * Source : Recherche d'Entreprises (api.gouv.fr) — accessible sans clé,
 * sans inscription, sans restriction. Lien externe vers
 * annuaire-entreprises.data.gouv.fr pour vérification indépendante.
 *
 * Design System v5 (CLAUDE.md §9) : sage `#F5F7F4` background, navy `#0F1419`
 * texte, Manrope. Aucun emoji, ton SOBRE PROFESSIONNEL (avatar diagnostiqueur
 * 43 ans ex-cadre reconverti).
 */

import { ExternalLink } from 'lucide-react'

interface LegalIdentitySectionProps {
  /** SIRET 14 chiffres (peut contenir des espaces, on les retire). */
  siret: string | null | undefined
  companyName: string | null | undefined
  legalForm: string | null | undefined
  nafCode: string | null | undefined
  nafLabel: string | null | undefined
  /** Date d'immatriculation au registre SIRENE (ISO 8601 ou `YYYY-MM-DD`). */
  creationDate: string | null | undefined
}

/**
 * Formate un SIRET en `XXX XXX XXX XXXXX` (3-3-3-5).
 * Retourne `null` si le SIRET n'est pas exactement 14 chiffres.
 */
function formatSiret(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, '')
  if (!/^\d{14}$/.test(cleaned)) return null
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 14)}`
}

/**
 * Formate une date ISO en français lisible (`12 mars 2018`).
 * Tolère les inputs invalides — retourne null.
 */
function formatCreationDate(raw: string): string | null {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface DataRowProps {
  label: string
  value: string | null
}

function DataRow({ label, value }: DataRowProps) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-black/[0.06] last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4 sm:py-3">
      <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#4A5878] sm:w-[160px] sm:flex-shrink-0">
        {label}
      </dt>
      <dd className="text-[14px] text-[#0F1419] font-medium sm:flex-1">{value}</dd>
    </div>
  )
}

export function LegalIdentitySection({
  siret,
  companyName,
  legalForm,
  nafCode,
  nafLabel,
  creationDate,
}: LegalIdentitySectionProps) {
  if (!siret) return null

  const formattedSiret = formatSiret(siret)
  if (!formattedSiret) return null

  const cleanedSiret = siret.replace(/\s/g, '')
  const formattedCreationDate = creationDate ? formatCreationDate(creationDate) : null
  const nafDisplay =
    nafCode && nafLabel ? `${nafCode} — ${nafLabel}` : (nafCode ?? nafLabel ?? null)

  return (
    <section
      aria-labelledby="legal-identity-heading"
      className="rounded-2xl border border-black/[0.08] bg-[#F5F7F4] px-5 py-6 sm:px-7 sm:py-7"
    >
      <header className="mb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#4A5878]">
          Open data INSEE
        </p>
        <h2
          id="legal-identity-heading"
          className="mt-1 text-[20px] sm:text-[22px] font-bold text-[#0F1419] tracking-tight"
        >
          Identité légale
        </h2>
        <p className="mt-1 text-[13px] text-[#4A5878] leading-relaxed">
          Données publiques issues du registre SIRENE de l'INSEE — équivalent du numéro RPPS pour
          les professions médicales.
        </p>
      </header>

      <dl className="divide-y divide-black/[0.06]">
        <DataRow label="SIRET" value={formattedSiret} />
        <DataRow label="Raison sociale" value={companyName ?? null} />
        <DataRow label="Forme juridique" value={legalForm ?? null} />
        <DataRow label="Code NAF" value={nafDisplay} />
        <DataRow label="Immatriculation" value={formattedCreationDate} />
      </dl>

      <div className="mt-5 pt-4 border-t border-black/[0.06]">
        <a
          href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${cleanedSiret}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0F1419] hover:text-[#0F1419]/70 transition-colors underline underline-offset-4 decoration-black/30"
        >
          Vérifier sur annuaire-entreprises.data.gouv.fr
          <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
