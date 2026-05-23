/**
 * Referentiel des certifications diagnostic affichees dans l'annuaire public
 * `/trouver-un-diagnostiqueur`. Les codes correspondent a ceux stockes en base
 * dans `diagnosticians.certifications` (jsonb [{type, organism, number, ...}])
 * ou dans la table normalisee `diagnostician_certifications.certification_type`.
 *
 * Couverture canonique :
 *  - 8 diagnostics standards (~92% du volume metier FR — cf. CLAUDE.md §3)
 *  - +1 type premium DPE_MENTION = audit energetique avec mention
 *    (certification specifique habilitant l'audit obligatoire des passoires
 *    F/G depuis 2023 — loi Climat & Resilience). C'est un differenciateur
 *    fort dans l'annuaire : ces diagnostiqueurs peuvent realiser les audits
 *    energetiques reglementaires, pas seulement les DPE simples.
 *
 * Source DHUP officiel (data.gouv.fr) : libelles observes mappes par
 * `supabase/functions/absorb-dhup-directory/index.ts` → `normalizeCertificationType`.
 *
 * Codes legacy (AM/PL/GZ/EL/TR/CR) conserves pour retrocompat URL/params,
 * mappes vers les codes canoniques DHUP par `parseCertCodes()`.
 */

export type DiagCertCode =
  | 'DPE'
  | 'DPE_MENTION'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELECTRICITE'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'
  | 'AM'
  | 'PL'
  | 'GZ'
  | 'EL'
  | 'TR'
  | 'CR'

export interface DiagCertDef {
  code: DiagCertCode
  /** Libelle court pour les pillules / badges (1-2 mots). */
  short: string
  /** Libelle long pour les listes detaillees et le screen reader. */
  label: string
  /** Description metier — affichee en tooltip. */
  description?: string
  /**
   * Flag premium — affiche le badge en variant `amber` (chartreuse premium
   * V5) avec icone Sparkles. Reserve aux certifications a valeur ajoutee
   * (audit energetique avec mention pour l'instant).
   */
  premium?: boolean
}

/**
 * Liste canonique des 9 types (8 standards + 1 premium audit mention).
 * L'ordre influence l'affichage par defaut dans les listes (premium en tete).
 */
export const DIAG_CERTS: DiagCertDef[] = [
  {
    code: 'DPE_MENTION',
    short: 'Audit énergétique',
    label: 'Audit énergétique (DPE avec mention)',
    description:
      'Habilitation specifique pour les audits energetiques reglementaires obligatoires sur les passoires F/G (loi Climat & Resilience 2023). Certification au-dela du DPE simple.',
    premium: true,
  },
  {
    code: 'DPE',
    short: 'DPE',
    label: 'DPE — Performance énergétique',
    description: 'Diagnostic de performance energetique (residentiel et tertiaire).',
  },
  {
    code: 'AMIANTE',
    short: 'Amiante',
    label: 'Amiante',
    description: 'Reperage amiante avant vente, location ou travaux (DTA, CREP amiante).',
  },
  {
    code: 'PLOMB',
    short: 'Plomb',
    label: 'Plomb (CREP)',
    description: "Constat de risque d'exposition au plomb (logements pre-1949).",
  },
  {
    code: 'GAZ',
    short: 'Gaz',
    label: 'Gaz',
    description: "Etat de l'installation interieure gaz (installations de plus de 15 ans).",
  },
  {
    code: 'ELECTRICITE',
    short: 'Électricité',
    label: 'Électricité',
    description: "Etat de l'installation electrique (installations de plus de 15 ans).",
  },
  {
    code: 'TERMITES',
    short: 'Termites',
    label: 'Termites',
    description: 'Etat relatif a la presence de termites dans le batiment.',
  },
  {
    code: 'CARREZ',
    short: 'Carrez',
    label: 'Loi Carrez / Boutin',
    description: 'Mesurage de surface privative (copropriete) ou habitable (location).',
  },
  {
    code: 'ERP',
    short: 'ERP',
    label: 'État des risques (ERP)',
    description: 'Etat des risques et pollutions (naturels, miniers, technologiques, radon).',
  },
]

/**
 * Lookup rapide code → definition.
 * Cle = code canonique uppercase (DPE, DPE_MENTION, AMIANTE, ...).
 * `Record<string, ...>` (et pas `Record<DiagCertCode, ...>`) car on lit
 * depuis du jsonb DB ou unknown[] sans garantie de validation type-level.
 */
export const DIAG_CERT_BY_CODE: Record<string, DiagCertDef> = Object.fromEntries(
  DIAG_CERTS.map((c) => [c.code, c]),
)

/**
 * Aliases legacy courts (AM/PL/GZ/EL/TR/CR) — utilises par d'anciens flux
 * URL ?certs=DPE,AM,PL. On les retro-map vers les codes canoniques DHUP.
 */
const LEGACY_CODE_MAP: Record<string, DiagCertCode> = {
  AM: 'AMIANTE',
  PL: 'PLOMB',
  GZ: 'GAZ',
  EL: 'ELECTRICITE',
  TR: 'TERMITES',
  CR: 'CARREZ',
}

const VALID_CANONICAL_CODES = new Set<string>(DIAG_CERTS.map((c) => c.code))

/**
 * Normalize unknown strings into known cert codes (drops the rest).
 * Accepte les codes canoniques (DPE, DPE_MENTION, AMIANTE, ...) et les
 * aliases legacy (AM, PL, GZ, EL, TR, CR).
 */
export function parseCertCodes(input: string | string[] | undefined | null): DiagCertCode[] {
  if (!input) return []
  const raw = Array.isArray(input) ? input : input.split(',')
  const out: DiagCertCode[] = []
  for (const v of raw) {
    const t = v.trim().toUpperCase()
    if (VALID_CANONICAL_CODES.has(t)) {
      out.push(t as DiagCertCode)
      continue
    }
    const legacy = LEGACY_CODE_MAP[t]
    if (legacy && !out.includes(legacy)) {
      out.push(legacy)
    }
  }
  return out
}

/**
 * Retourne `true` si au moins une certification du diagnostiqueur correspond
 * a un type premium (DPE_MENTION pour l'instant). Utilise pour mettre en
 * avant les diagnostiqueurs habilites audit energetique dans l'annuaire.
 *
 * Accepte les 3 formats observes en base :
 *   - string[]                                  (legacy A1)
 *   - { type: string }[]                        (jsonb canonique DHUP)
 *   - { certification_type: string }[]          (table normalisee)
 */
export function hasMentionAudit(
  certifications:
    | ReadonlyArray<string>
    | ReadonlyArray<{ type?: string | null; certification_type?: string | null }>
    | null
    | undefined,
): boolean {
  if (!Array.isArray(certifications)) return false
  return certifications.some((c) => {
    if (typeof c === 'string') return c.toUpperCase() === 'DPE_MENTION'
    if (c && typeof c === 'object') {
      const t = c.type ?? c.certification_type
      return typeof t === 'string' && t.toUpperCase() === 'DPE_MENTION'
    }
    return false
  })
}

/**
 * Particules nobiliaires / determinants : reste en minuscule meme dans un nom propre.
 */
const NAME_PARTICLES = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'von',
  'van',
  'der',
  'den',
  'di',
  'da',
  'al',
])

function capitalizePart(part: string): string {
  if (!part) return ''
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
}

function capitalizeHyphenated(token: string): string {
  return token
    .split('-')
    .map((sub) => sub.split("'").map(capitalizePart).join("'"))
    .join('-')
}

/**
 * Capitalize correctement un nom propre francais.
 * "raoul chipot" → "Raoul Chipot"
 * "JEAN-PIERRE DUPONT" → "Jean-Pierre Dupont"
 * "marie de la fontaine" → "Marie de la Fontaine" (particules minuscules)
 *
 * Cas geres :
 *  - mots multiples (split par espace)
 *  - traits d'union ("Jean-Pierre" → "Jean-Pierre")
 *  - apostrophes ("d'Artagnan" → "D'Artagnan")
 *  - particules nobiliaires minuscules (de, du, de la, von, van, le, la)
 */
export function formatFullName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const cleaned = fullName.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map((token, idx) => {
      const lower = token.toLowerCase()
      // Particules : minuscule sauf si premier mot du nom
      if (idx > 0 && NAME_PARTICLES.has(lower)) return lower
      return capitalizeHyphenated(token)
    })
    .join(' ')
}

/**
 * Retourne le nom d'affichage public d'un diagnostiqueur :
 *   - raison sociale (company_name) si non-NULL et non-vide
 *   - sinon nom + prenom capitalises (formatFullName)
 *
 * Pattern annuaire B2C : le particulier voit le cabinet/societe d'abord
 * (plus pro, plus reconnaissable sur Google), avec le gerant en sous-titre
 * discret quand pertinent.
 */
export function getDiagDisplayName(diag: {
  company_name?: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  const company = (diag.company_name ?? '').trim()
  if (company) return company
  const fullName = (diag.full_name ?? '').trim()
  if (fullName) return formatFullName(fullName)
  const composed = [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim()
  return composed ? formatFullName(composed) : ''
}
