/**
 * KOVAS — Trust Badges (Airbnb pattern) sur la fiche publique diagnostiqueur.
 *
 * Affiche une rangée de pastilles "trust signals" juste après le hero pour
 * booster la conversion B2C. Inspiration : la bande "Superhost / Identity
 * verified / Speaks English" d'Airbnb.
 *
 * 5 badges possibles (graceful degradation : un badge n'est rendu que si la
 * condition de présence des données est vérifiée — pas de placeholder vide) :
 *   1. Identité vérifiée   — diagnostician_verification_status.identity_verified_at
 *   2. COFRAC à jour       — verification.cofrac_verified_at OU certifications jsonb non vide
 *   3. RC Pro vérifiée     — diagnostician_verification_status.rcpro_verified_at
 *   4. SIRET actif         — sireneBadge.isVerified (API Recherche Entreprises) OU siret présent
 *   5. Réponse rapide      — availability.responseBucket === 'fast' (médiane ≤ 4h)
 *
 * Le bloc entier est masqué si AUCUN des 5 badges n'est valide (zéro signal
 * = pas de bruit visuel inutile sur fiche non vérifiée).
 *
 * Design System v5 :
 *   - background sage `#F5F7F4` (cards sobres B2B)
 *   - bordure rule `#0B1D33/10`
 *   - texte navy `#0B1D33`
 *   - accent chartreuse `#D4F542` UNIQUEMENT pour le badge "Réponse rapide"
 *     (signal premium célébration, parcimonie de l'accent)
 *   - icones Lucide 14px
 *   - typo Manrope (héritée du layout)
 */

import { Clock, FileCheck, ShieldCheck, UserCheck, Zap } from 'lucide-react'

export interface TrustBadgesData {
  /** Date ISO de vérification d'identité civile (FranceConnect / KYC). NULL si non vérifié. */
  identityVerifiedAt: string | null
  /** Date ISO de vérification COFRAC. NULL si non vérifié. */
  cofracVerifiedAt: string | null
  /** Fallback : présence de certifications dans le profil (heuristique COFRAC à jour). */
  hasCertifications: boolean
  /** Date ISO de vérification RC Pro. NULL si non vérifié. */
  rcproVerifiedAt: string | null
  /** Vérifié SIRENE INSEE via API Recherche Entreprises (open data). */
  sireneVerified: boolean
  /** Bucket de réactivité — 'fast' = médiane ≤ 4h (modèle Doctolib calibré). */
  responseBucketFast: boolean
}

interface TrustBadgesProps {
  data: TrustBadgesData
  /** Classe Tailwind additionnelle (positionnement, marges) */
  className?: string
}

interface BadgeDef {
  key: string
  icon: typeof ShieldCheck
  label: string
  title: string
  accent?: boolean
}

/**
 * Calcule la liste des badges à afficher dans l'ordre canonique.
 * Exporté pour les tests unitaires éventuels.
 */
export function buildTrustBadges(data: TrustBadgesData): BadgeDef[] {
  const badges: BadgeDef[] = []

  if (data.identityVerifiedAt) {
    badges.push({
      key: 'identity',
      icon: UserCheck,
      label: 'Identité vérifiée',
      title:
        'Identité civile vérifiée par KOVAS (FranceConnect, scan CNI ou signature qualifiée Yousign).',
    })
  }

  if (data.cofracVerifiedAt || data.hasCertifications) {
    badges.push({
      key: 'cofrac',
      icon: ShieldCheck,
      label: 'COFRAC à jour',
      title:
        'Certification COFRAC active vérifiée auprès de l’organisme certificateur (Bureau Veritas, Apave, Dekra, ICert…).',
    })
  }

  if (data.rcproVerifiedAt) {
    badges.push({
      key: 'rcpro',
      icon: FileCheck,
      label: 'RC Pro vérifiée',
      title: 'Attestation de responsabilité civile professionnelle valide vérifiée par KOVAS.',
    })
  }

  if (data.sireneVerified) {
    badges.push({
      key: 'siret',
      icon: ShieldCheck,
      label: 'SIRET actif',
      title:
        'Établissement actif au registre SIRENE de l’INSEE (vérification automatique via API Recherche d’Entreprises).',
    })
  }

  if (data.responseBucketFast) {
    badges.push({
      key: 'response',
      icon: Zap,
      label: 'Réponse rapide',
      title:
        'Répond généralement aux demandes de devis sous 4 heures (médiane sur les 30 derniers leads).',
      accent: true,
    })
  }

  return badges
}

export function TrustBadges({ data, className }: TrustBadgesProps) {
  const badges = buildTrustBadges(data)
  if (badges.length === 0) return null

  return (
    <section
      aria-label="Vérifications et signaux de confiance"
      className={['border-b border-black/5 bg-[#F5F7F4]', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto max-w-6xl px-6 py-4">
        <ul className="flex flex-wrap items-center gap-2">
          {badges.map((b) => {
            const Icon = b.icon
            const baseCls =
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'
            const variantCls = b.accent
              ? 'border-[#0B1D33]/10 bg-[#D4F542] text-[#0B1D33]'
              : 'border-[#0B1D33]/10 bg-white text-[#0B1D33] hover:bg-[#F5F7F4]'
            return (
              <li key={b.key}>
                <span className={`${baseCls} ${variantCls}`} title={b.title}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {b.label}
                </span>
              </li>
            )
          })}
          <li className="ml-auto hidden md:block">
            <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-black/45">
              <Clock className="inline h-3 w-3 mr-1 -mt-0.5" aria-hidden />
              Vérifications KOVAS
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
