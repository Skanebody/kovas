/**
 * Parser Liciel — dispatch CSV / XLSX / XML / ZIP de PDFs.
 *
 * V1 : seul le CSV est réellement implémenté. Les autres formats throw
 * `ImportError('FORMAT_UNSUPPORTED')` — ils seront ajoutés au fil des
 * remontées bêta-testeurs.
 *
 * Le parser CSV est *maison* (pas de dépendance papaparse) pour :
 *  - garder le bundle minimal,
 *  - gérer finement BOM UTF-8 + CRLF + delimiter auto-détecté,
 *  - éviter une dépendance lourde sur un format qu'on contrôle.
 *
 * Cf. CLAUDE.md §13 (stratégie défensive Liciel) — toujours basé sur les
 * exports utilisateur, jamais sur scraping/désassemblage.
 */

import {
  type EntityKind,
  LICIEL_CSV_HEADERS,
  detectEntityKind,
  normalizeHeader,
} from './liciel-schema-reference'
import {
  ImportError,
  type ImportSourceFormat,
  type LicielParsedClient,
  type LicielParsedCopropriete,
  type LicielParsedExport,
  type LicielParsedLot,
  type LicielParsedProperty,
} from './types'

// ============================================================================
// Détection de format
// ============================================================================

/**
 * Détecte le format réel d'un fichier à partir de son contenu + filename + mime.
 * On regarde d'abord la signature binaire (magic bytes), puis l'extension,
 * puis le mime — dans cet ordre car le mime est le moins fiable (Safari…).
 */
export function detectFormat(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): ImportSourceFormat {
  const lower = filename.toLowerCase()

  // ZIP : magic bytes PK\x03\x04
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    // XLSX est techniquement un ZIP — on distingue via extension
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx'
    return 'zip-pdfs'
  }

  // XML : déclaration <?xml
  const head = buffer.slice(0, 256).toString('utf8').trimStart()
  if (head.startsWith('<?xml') || head.startsWith('<')) {
    return 'xml'
  }

  // Fallback extension
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx'
  if (lower.endsWith('.xml')) return 'xml'
  if (lower.endsWith('.zip')) return 'zip-pdfs'

  // Fallback mime
  if (mimeType.includes('csv')) return 'csv'
  if (mimeType.includes('xml')) return 'xml'
  if (mimeType.includes('zip')) return 'zip-pdfs'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'xlsx'

  // Dernier recours : si le buffer ressemble à du texte, on tente CSV
  if (looksLikeText(buffer)) return 'csv'

  throw new ImportError(
    'FORMAT_DETECTION_FAILED',
    `Impossible de détecter le format de "${filename}" (mime: ${mimeType}).`,
  )
}

function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.slice(0, 1024)
  let printable = 0
  for (const byte of sample) {
    // ASCII imprimable, tab, LF, CR
    if ((byte >= 0x20 && byte < 0x7f) || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      printable++
    } else if (byte >= 0x80) {
      // UTF-8 continuation — on accepte
      printable++
    }
  }
  return printable / sample.length > 0.9
}

// ============================================================================
// Entrée principale
// ============================================================================

export async function parseLicielExport(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<LicielParsedExport> {
  if (fileBuffer.length === 0) {
    throw new ImportError('FILE_EMPTY', 'Fichier vide.')
  }

  const format = detectFormat(fileBuffer, filename, mimeType)

  switch (format) {
    case 'csv':
      return parseCsvBuffer(fileBuffer)
    case 'xlsx':
      throw new ImportError(
        'FORMAT_UNSUPPORTED',
        'Format Excel (.xlsx) — implémentation en cours, utilisez CSV pour le moment.',
      )
    case 'xml':
      throw new ImportError(
        'FORMAT_UNSUPPORTED',
        'Format XML — implémentation en cours, utilisez CSV pour le moment.',
      )
    case 'zip-pdfs':
      throw new ImportError(
        'FORMAT_UNSUPPORTED',
        'Format ZIP de PDFs — implémentation en cours, utilisez CSV pour le moment.',
      )
  }
}

// ============================================================================
// Parser CSV maison
// ============================================================================

const BOM = '﻿'

/**
 * Parse un CSV en `{ headers, rows }` puis dispatche les rows vers
 * l'entité détectée. Si plusieurs entités sont identifiables, on ne
 * garde QUE la mieux détectée (V1).
 *
 * Limitations V1 (à documenter à Benjamin) :
 *  - 1 seul type d'entité par CSV (on ne split pas plusieurs blocs)
 *  - Pas de support multi-feuilles
 *  - Pas de fallback Claude automatique ici (la route appelle Claude
 *    en cas d'échec total seulement)
 */
export function parseCsvBuffer(buffer: Buffer): LicielParsedExport {
  const text = buffer.toString('utf8').replace(/^﻿/, '').replace(/^﻿/, '')
  return parseCsvText(text)
}

export function parseCsvText(rawText: string): LicielParsedExport {
  let text = rawText
  if (text.startsWith(BOM)) {
    text = text.slice(1)
  }

  // Normalise EOL → \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (text.trim().length === 0) {
    throw new ImportError('FILE_EMPTY', 'Le fichier CSV est vide.')
  }

  const delimiter = detectDelimiter(text)
  const rows = parseDelimited(text, delimiter)
  if (rows.length === 0) {
    throw new ImportError('FILE_EMPTY', 'Aucune ligne dans le fichier CSV.')
  }

  const headers = rows[0] ?? []
  const dataRows = rows.slice(1)

  if (headers.length === 0) {
    throw new ImportError('FILE_CORRUPTED', 'Aucune en-tête détectée dans le CSV.')
  }

  const normalized = headers.map((h) => normalizeHeader(h))
  const detection = detectEntityKind(normalized)
  if (!detection.kind) {
    throw new ImportError(
      'FORMAT_DETECTION_FAILED',
      `Impossible d'identifier le type de données dans le CSV (en-têtes : ${headers
        .slice(0, 5)
        .join(', ')}…). Score max : ${detection.score}.`,
      { headers, scores: detection.allScores },
    )
  }

  return dispatchRows(detection.kind, normalized, dataRows)
}

// ----------------------------------------------------------------------------
// Détection delimiter
// ----------------------------------------------------------------------------

function detectDelimiter(text: string): string {
  // Prend la première ligne non-vide
  const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? ''
  const candidates = [';', ',', '\t', '|']
  let best = ','
  let bestCount = 0
  for (const c of candidates) {
    // On compte hors quotes — heuristique simple : approximation suffisante
    // pour des CSV Liciel raisonnables. La vraie validation a lieu au parse.
    let count = 0
    let inQuote = false
    for (const ch of firstLine) {
      if (ch === '"') inQuote = !inQuote
      else if (!inQuote && ch === c) count++
    }
    if (count > bestCount) {
      bestCount = count
      best = c
    }
  }
  return best
}

// ----------------------------------------------------------------------------
// Parse rangée par rangée (gestion quotes + escape `""`)
// ----------------------------------------------------------------------------

function parseDelimited(text: string, delimiter: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuote) {
      if (ch === '"') {
        // Quote escaped : `""` → `"` littéral
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuote = true
      continue
    }

    if (ch === delimiter) {
      row.push(field)
      field = ''
      continue
    }

    if (ch === '\n') {
      row.push(field)
      field = ''
      // Skip lignes 100% vides
      if (row.length === 1 && row[0] === '') {
        row = []
        continue
      }
      result.push(row)
      row = []
      continue
    }

    field += ch
  }

  // Dernière ligne (pas de EOL en fin)
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (!(row.length === 1 && row[0] === '')) {
      result.push(row)
    }
  }

  return result
}

// ----------------------------------------------------------------------------
// Dispatch rows → entité
// ----------------------------------------------------------------------------

function dispatchRows(
  kind: EntityKind,
  normalizedHeaders: string[],
  dataRows: string[][],
): LicielParsedExport {
  const empty: LicielParsedExport = {
    clients: [],
    properties: [],
    coproprietes: [],
    lots: [],
    diagnostics: [],
  }

  switch (kind) {
    case 'client':
      empty.clients = dataRows.map((row) => buildClient(normalizedHeaders, row)).filter(notEmpty)
      break
    case 'property':
      empty.properties = dataRows
        .map((row) => buildProperty(normalizedHeaders, row))
        .filter(notEmpty)
      break
    case 'copropriete':
      empty.coproprietes = dataRows
        .map((row) => buildCopropriete(normalizedHeaders, row))
        .filter(notEmpty)
      break
    case 'lot':
      empty.lots = dataRows.map((row) => buildLot(normalizedHeaders, row)).filter(notEmpty)
      break
  }

  return empty
}

function notEmpty<T extends object>(obj: T): boolean {
  return Object.values(obj).some((v) => v !== undefined && v !== null && v !== '')
}

// ----------------------------------------------------------------------------
// Builders typés
// ----------------------------------------------------------------------------

function getCell(row: string[], index: number): string | undefined {
  if (index < 0 || index >= row.length) return undefined
  const value = row[index]?.trim()
  return value === '' || value === undefined ? undefined : value
}

function buildClient(normalizedHeaders: string[], row: string[]): LicielParsedClient {
  const out: LicielParsedClient = {}
  const map = LICIEL_CSV_HEADERS.client
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i] ?? ''
    const target = (map as Record<string, keyof LicielParsedClient>)[h]
    if (!target) continue
    const value = getCell(row, i)
    if (value === undefined) continue
    out[target] = value
  }
  return out
}

function buildProperty(normalizedHeaders: string[], row: string[]): LicielParsedProperty {
  const out: LicielParsedProperty = {}
  const map = LICIEL_CSV_HEADERS.property
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i] ?? ''
    const target = (map as Record<string, keyof LicielParsedProperty>)[h]
    if (!target) continue
    const raw = getCell(row, i)
    if (raw === undefined) continue

    // Champs numériques
    if (
      target === 'surface_loi_carrez' ||
      target === 'surface_habitable' ||
      target === 'surface_utile'
    ) {
      const n = parseFrenchNumber(raw)
      if (n !== null) out[target] = n
    } else if (
      target === 'nombre_pieces' ||
      target === 'nombre_niveaux' ||
      target === 'annee_construction'
    ) {
      const n = parseFrenchNumber(raw)
      if (n !== null) out[target] = Math.round(n)
    } else {
      out[target] = raw
    }
  }
  return out
}

function buildCopropriete(normalizedHeaders: string[], row: string[]): LicielParsedCopropriete {
  const out: LicielParsedCopropriete = {}
  const map = LICIEL_CSV_HEADERS.copropriete
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i] ?? ''
    const target = (map as Record<string, keyof LicielParsedCopropriete>)[h]
    if (!target) continue
    const raw = getCell(row, i)
    if (raw === undefined) continue
    if (target === 'nombre_lots' || target === 'annee_construction') {
      const n = parseFrenchNumber(raw)
      if (n !== null) out[target] = Math.round(n)
    } else {
      out[target] = raw
    }
  }
  return out
}

function buildLot(normalizedHeaders: string[], row: string[]): LicielParsedLot {
  const out: LicielParsedLot = {}
  const map = LICIEL_CSV_HEADERS.lot
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i] ?? ''
    const target = (map as Record<string, keyof LicielParsedLot>)[h]
    if (!target) continue
    const raw = getCell(row, i)
    if (raw === undefined) continue
    out[target] = raw
  }
  return out
}

/**
 * Parse un nombre au format FR (`1 234,56`) ou EN (`1234.56`).
 * Retourne null si non parseable.
 */
function parseFrenchNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.+\-]/g, '')
  if (cleaned === '') return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}
