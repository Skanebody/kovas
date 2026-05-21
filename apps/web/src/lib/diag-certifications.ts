/**
 * Référentiel des 8 types de certifications diagnostic affichés dans l'annuaire public
 * `/diagnostiqueurs`. Les codes correspondent à ceux stockés en base dans la colonne
 * `diagnosticians.certifications` (text[]).
 *
 * Ces 8 types couvrent ~92% du volume diagnostic standard FR
 * (cf. CLAUDE.md §3 — Plan couverture progressive).
 */

export type DiagCertCode =
  | 'DPE'
  | 'AM'
  | 'PL'
  | 'GZ'
  | 'EL'
  | 'TR'
  | 'CR'
  | 'ERP'

export interface DiagCertDef {
  code: DiagCertCode
  short: string
  label: string
}

export const DIAG_CERTS: DiagCertDef[] = [
  { code: 'DPE', short: 'DPE', label: 'DPE — Performance énergétique' },
  { code: 'AM', short: 'Amiante', label: 'Amiante' },
  { code: 'PL', short: 'Plomb', label: 'Plomb (CREP)' },
  { code: 'GZ', short: 'Gaz', label: 'Gaz' },
  { code: 'EL', short: 'Électricité', label: 'Électricité' },
  { code: 'TR', short: 'Termites', label: 'Termites' },
  { code: 'CR', short: 'Carrez', label: 'Carrez / Boutin' },
  { code: 'ERP', short: 'ERP', label: 'État des risques (ERP)' },
]

export const DIAG_CERT_BY_CODE: Record<DiagCertCode, DiagCertDef> = Object.fromEntries(
  DIAG_CERTS.map((c) => [c.code, c]),
) as Record<DiagCertCode, DiagCertDef>

const VALID_CODES = new Set<string>(DIAG_CERTS.map((c) => c.code))

/** Normalize unknown strings into known cert codes (drops the rest). */
export function parseCertCodes(input: string | string[] | undefined | null): DiagCertCode[] {
  if (!input) return []
  const raw = Array.isArray(input) ? input : input.split(',')
  const out: DiagCertCode[] = []
  for (const v of raw) {
    const t = v.trim().toUpperCase()
    if (VALID_CODES.has(t)) out.push(t as DiagCertCode)
  }
  return out
}
