/**
 * KOVAS — Calculatrice surface multi-formes.
 *
 * 7 formes supportées (cf. brief §1.3) :
 * - rectangle           : largeur × longueur
 * - l_shape             : 4 mesures (gros L)
 * - t_shape             : 4 mesures (T)
 * - trapeze             : (base1 + base2) × hauteur / 2
 * - triangle            : base × hauteur / 2
 * - cercle              : π × r²
 * - demi_cercle         : π × r² / 2
 *
 * Unités : mètres. Surfaces : m² avec 2 décimales.
 */

export type PieceFormType =
  | 'rectangle'
  | 'l_shape'
  | 't_shape'
  | 'trapeze'
  | 'triangle'
  | 'cercle'
  | 'demi_cercle'

export interface PieceDimensions {
  formType: PieceFormType
  /** Valeurs en mètres, ordre dépendant de la forme (cf. PIECE_FORM_FIELDS). */
  values: number[]
}

export interface PieceEntry {
  id: string
  name: string
  formType: PieceFormType
  dimensions: PieceDimensions
  surface: number
  notes?: string
}

/** Définition des champs attendus par formType (label FR, ordre = index dans values). */
export const PIECE_FORM_FIELDS: Record<PieceFormType, readonly { key: string; label: string }[]> = {
  rectangle: [
    { key: 'width', label: 'Largeur (m)' },
    { key: 'length', label: 'Longueur (m)' },
  ],
  l_shape: [
    { key: 'a', label: 'Côté A (m)' },
    { key: 'b', label: 'Côté B (m)' },
    { key: 'c', label: 'Décrochement C (m)' },
    { key: 'd', label: 'Décrochement D (m)' },
  ],
  t_shape: [
    { key: 'a', label: 'Branche horizontale — longueur (m)' },
    { key: 'b', label: 'Branche horizontale — largeur (m)' },
    { key: 'c', label: 'Branche verticale — longueur (m)' },
    { key: 'd', label: 'Branche verticale — largeur (m)' },
  ],
  trapeze: [
    { key: 'base1', label: 'Base 1 (m)' },
    { key: 'base2', label: 'Base 2 (m)' },
    { key: 'height', label: 'Hauteur (m)' },
  ],
  triangle: [
    { key: 'base', label: 'Base (m)' },
    { key: 'height', label: 'Hauteur (m)' },
  ],
  cercle: [{ key: 'radius', label: 'Rayon (m)' }],
  demi_cercle: [{ key: 'radius', label: 'Rayon (m)' }],
}

export const PIECE_FORM_LABEL: Record<PieceFormType, string> = {
  rectangle: 'Rectangle',
  l_shape: 'En L',
  t_shape: 'En T',
  trapeze: 'Trapèze',
  triangle: 'Triangle',
  cercle: 'Cercle',
  demi_cercle: 'Demi-cercle',
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function safe(values: number[], expected: number): number[] {
  // Substitue NaN/négatif par 0 pour ne pas casser le calcul live.
  const out = new Array<number>(expected).fill(0)
  for (let i = 0; i < expected; i++) {
    const v = values[i]
    out[i] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
  }
  return out
}

export function calculateSurface(dimensions: PieceDimensions): number {
  const { formType } = dimensions
  switch (formType) {
    case 'rectangle': {
      const [w, l] = safe(dimensions.values, 2)
      return round2(w * l)
    }
    case 'l_shape': {
      const [a, b, c, d] = safe(dimensions.values, 4)
      // Surface = rectangle global (a × b) − décrochement (c × d)
      return round2(Math.max(0, a * b - c * d))
    }
    case 't_shape': {
      const [a, b, c, d] = safe(dimensions.values, 4)
      // Surface = horizontale (a × b) + verticale (c × d)
      return round2(a * b + c * d)
    }
    case 'trapeze': {
      const [b1, b2, h] = safe(dimensions.values, 3)
      return round2(((b1 + b2) * h) / 2)
    }
    case 'triangle': {
      const [base, h] = safe(dimensions.values, 2)
      return round2((base * h) / 2)
    }
    case 'cercle': {
      const [r] = safe(dimensions.values, 1)
      return round2(Math.PI * r * r)
    }
    case 'demi_cercle': {
      const [r] = safe(dimensions.values, 1)
      return round2((Math.PI * r * r) / 2)
    }
    default: {
      const _exhaustive: never = formType
      throw new Error(`Unsupported form: ${String(_exhaustive)}`)
    }
  }
}

export function calculateTotal(pieces: PieceEntry[]): number {
  return round2(pieces.reduce((sum, p) => sum + p.surface, 0))
}

/** Crée une PieceEntry vide pour un formType. */
export function emptyPieceEntry(formType: PieceFormType, name: string): PieceEntry {
  const values = new Array<number>(PIECE_FORM_FIELDS[formType].length).fill(0)
  return {
    id: `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    formType,
    dimensions: { formType, values },
    surface: 0,
  }
}

/**
 * Export texte simple (copier-coller).
 */
export function exportPiecesAsText(pieces: PieceEntry[]): string {
  if (pieces.length === 0) return 'Aucune pièce.'
  const lines: string[] = []
  for (const p of pieces) {
    const dims = PIECE_FORM_FIELDS[p.formType]
      .map((f, i) => `${f.label} = ${p.dimensions.values[i] ?? 0}`)
      .join(' · ')
    lines.push(`• ${p.name} (${PIECE_FORM_LABEL[p.formType]}) — ${p.surface} m²  [${dims}]`)
    if (p.notes) lines.push(`  notes: ${p.notes}`)
  }
  lines.push('')
  lines.push(`TOTAL : ${calculateTotal(pieces)} m²`)
  return lines.join('\n')
}
