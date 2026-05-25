/**
 * KOVAS — Algo A1.3.7 : Classifier automatique documents clients.
 *
 * Pure function qui classe un fichier uploadé par un client B2C (avant
 * mission) dans une des 9 catégories métier diagnostic. Sert à :
 *   - Auto-rangement dans le dossier mission (feature 6 MVP V1)
 *   - Suggestion de complétude ("manque la facture énergie pour DPE précis")
 *   - Pré-extraction par Claude Vision uniquement sur les types pertinents
 *
 * 3 niveaux de détection (cascade) :
 *   1. Extension fichier (gratuit, 30% des cas)
 *   2. Mots-clés filename (gratuit, 60% des cas)
 *   3. OCR first chars / Claude Vision (optionnel, 10% restants)
 *
 * Sortie : { predicted_type, confidence 0-1, signals, requires_ai_fallback }.
 * Si confidence < 0.6, on recommande Claude Vision en fallback côté caller.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.7.
 */

export type DocumentType =
  | 'energy_bill' // facture énergie (EDF, Engie, TotalEnergies, gaz)
  | 'previous_dpe' // ancien DPE PDF
  | 'floor_plan' // plan d'étage, plan cadastral
  | 'invoice_works' // facture travaux (isolation, chaudière, fenêtres)
  | 'property_deed' // acte authentique de vente / propriété
  | 'safety_certificate' // carnet d'entretien chaudière, certif élec Consuel
  | 'tax_document' // taxe foncière, taxe habitation
  | 'photo' // photo d'équipement / pièce
  | 'other_admin' // autre admin (à classer manuellement)
  | 'unknown' // non classifié

export interface DocumentClassifierInput {
  /** Nom de fichier original */
  filename: string
  /** MIME type (image/png, application/pdf, etc.) */
  mime_type: string | null
  /** Taille du fichier en bytes (utile pour heuristics anti-spam) */
  size_bytes: number | null
  /** Premières lignes OCR si déjà extraites (optionnel, accélère la classification) */
  ocr_preview: string | null
}

export interface DocumentClassifierResult {
  /** Type prédit */
  predicted_type: DocumentType
  /** Confidence 0-1 */
  confidence: number
  /** Si true, le caller devrait lancer Claude Vision pour confirmer */
  requires_ai_fallback: boolean
  /** Signaux ayant contribué à la décision (audit) */
  signals: ReadonlyArray<{ code: string; weight: number; matched: string }>
  /** Suggestions pour le diagnostiqueur si le type est lié à un diagnostic */
  suggested_use: string | null
}

interface TypeRule {
  type: DocumentType
  filename_patterns: RegExp[]
  ocr_patterns: RegExp[]
  /** Poids du signal filename (0-1) */
  filename_weight: number
  /** Poids du signal OCR (0-1) */
  ocr_weight: number
  /** Suggestion pour le diagnostiqueur */
  suggested_use: string
}

const TYPE_RULES: readonly TypeRule[] = [
  {
    type: 'previous_dpe',
    filename_patterns: [
      /\b(dpe|diagnostic[-_ ]+perf|diagnostic[-_ ]+energ)/i,
      /\bancien[-_ ]+dpe\b/i,
    ],
    ocr_patterns: [
      /diagnostic\s+de\s+performance\s+énerg/i,
      /classe\s+énergétique/i,
      /étiquette\s+énergie/i,
    ],
    filename_weight: 0.85,
    ocr_weight: 0.95,
    suggested_use:
      'Ancien DPE détecté — comparez la classe estimée avec celle déclarée pour anticiper un éventuel DPE shopping.',
  },
  {
    type: 'energy_bill',
    filename_patterns: [
      /\b(facture|releve|relevé)[-_ ]+(edf|engie|gdf|total[-_ ]?energies?|enercoop|elec)/i,
      /\b(edf|engie|gaz|elec|électricité|electricite)[-_ ]+(facture|releve|conso)/i,
      /facture[-_ ]+(gaz|elec|électricité|electricite|chauffage)/i,
    ],
    ocr_patterns: [
      /consommation\s+(annuelle|mensuelle)/i,
      /kwh\s+consommés/i,
      /tarif\s+(réglementé|bleu)/i,
      /\b(edf|engie|total\s*energies?)\b.{0,40}facture/i,
    ],
    filename_weight: 0.9,
    ocr_weight: 0.95,
    suggested_use:
      'Facture énergie détectée — données consommation utiles pour calibrer le DPE 3CL.',
  },
  {
    type: 'invoice_works',
    filename_patterns: [
      /\b(facture|devis)[-_ ]+(isolation|chaudiere|chaudière|fenetre|fenêtre|toiture|vmc|combles)/i,
      /\bfacture[-_ ]+travaux/i,
      /\b(isolation|chaudiere|chaudière|pompe[-_ ]+chaleur|fenetre|fenêtre)/i,
    ],
    ocr_patterns: [
      /facture\s+travaux/i,
      /isolation\s+(thermique|comb|murs)/i,
      /pompe\s+à\s+chaleur/i,
      /chaudière\s+(condensation|gaz)/i,
    ],
    filename_weight: 0.8,
    ocr_weight: 0.9,
    suggested_use:
      "Facture travaux détectée — preuves de rénovation à intégrer dans l'évaluation 3CL (isolation, équipements).",
  },
  {
    type: 'floor_plan',
    filename_patterns: [
      /\bplan[-_ ]+(etage|étage|appartement|maison|cadastr|niveau)/i,
      /\bplan(s)?[-_ ]+(rdc|r\+1|sous[-_ ]?sol|toiture)/i,
      /\bcadastre/i,
    ],
    ocr_patterns: [/échelle\s+1[\/:]\d+/i, /cadastre/i, /plan\s+(de\s+masse|d['']?étage)/i],
    filename_weight: 0.85,
    ocr_weight: 0.85,
    suggested_use:
      'Plan détecté — utile pour Carrez / Boutin et reconnaissance des pièces (équipements).',
  },
  {
    type: 'property_deed',
    filename_patterns: [
      /\bacte[-_ ]+(authentique|vente|notari)/i,
      /\bcompromis[-_ ]+vente/i,
      /\bpromesse[-_ ]+vente/i,
    ],
    ocr_patterns: [
      /acte\s+authentique/i,
      /étude\s+notariale/i,
      /vendeur.{0,30}acquéreur/i,
      /\b(usufruit|nue[-_ ]?propriété|tontine)\b/i,
    ],
    filename_weight: 0.9,
    ocr_weight: 0.95,
    suggested_use:
      'Acte ou compromis détecté — date de mise en vente confirme la pertinence du DPE.',
  },
  {
    type: 'safety_certificate',
    filename_patterns: [
      /\b(consuel|carnet[-_ ]+entretien|certif[-_ ]+gaz|qualigaz)/i,
      /\bentretien[-_ ]+chaudiere/i,
      /\battestation[-_ ]+(gaz|electrique|électrique)/i,
    ],
    ocr_patterns: [
      /attestation\s+consuel/i,
      /carnet\s+d['']?entretien/i,
      /qualigaz/i,
      /certificat\s+(gaz|électrique)/i,
    ],
    filename_weight: 0.9,
    ocr_weight: 0.95,
    suggested_use:
      'Certificat sécurité détecté — peut alimenter le diagnostic Gaz ou Électricité existant.',
  },
  {
    type: 'tax_document',
    filename_patterns: [/\btaxe[-_ ]+(fonciere|foncière|habitation)/i, /\bavis[-_ ]+impot/i],
    ocr_patterns: [/taxe\s+foncière/i, /impôts\s+gouv/i, /avis\s+d['']?imposition/i],
    filename_weight: 0.85,
    ocr_weight: 0.95,
    suggested_use:
      'Document fiscal détecté — contient la surface cadastrale, utile cross-check Carrez.',
  },
]

function extensionFromFilename(filename: string): string | null {
  const m = filename.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : null
}

function isPhotoMime(mime: string | null, ext: string | null): boolean {
  if (mime?.startsWith('image/') && mime !== 'image/svg+xml') return true
  if (ext && ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext)) return true
  return false
}

function isPdfMime(mime: string | null, ext: string | null): boolean {
  return mime === 'application/pdf' || ext === 'pdf'
}

export function classifyDocument(input: DocumentClassifierInput): DocumentClassifierResult {
  const filename = input.filename.toLowerCase()
  const ext = extensionFromFilename(filename)
  const ocr = (input.ocr_preview ?? '').slice(0, 2000) // cap pour perf

  // 1. Court-circuit photo
  if (isPhotoMime(input.mime_type, ext)) {
    return {
      predicted_type: 'photo',
      confidence: 0.95,
      requires_ai_fallback: false,
      signals: [
        {
          code: 'MIME_IMAGE',
          weight: 0.95,
          matched: input.mime_type ?? `.${ext ?? '?'}`,
        },
      ],
      suggested_use:
        'Photo détectée — sera analysée par Vision IA (A1.3.6) pour reconnaissance équipement.',
    }
  }

  // 2. Si pas PDF / docx / xlsx → unknown rapide
  if (
    !isPdfMime(input.mime_type, ext) &&
    !['doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'].includes(ext ?? '')
  ) {
    return {
      predicted_type: 'unknown',
      confidence: 0.3,
      requires_ai_fallback: true,
      signals: [
        {
          code: 'MIME_UNRECOGNIZED',
          weight: 0.3,
          matched: input.mime_type ?? `.${ext ?? '?'}`,
        },
      ],
      suggested_use: null,
    }
  }

  // 3. Scan filename + OCR contre les règles
  let bestType: DocumentType = 'other_admin'
  let bestScore = 0
  let bestSignals: Array<{ code: string; weight: number; matched: string }> = []
  let bestSuggestion: string | null = null

  for (const rule of TYPE_RULES) {
    const signals: Array<{ code: string; weight: number; matched: string }> = []
    let score = 0

    for (const re of rule.filename_patterns) {
      const m = filename.match(re)
      if (m) {
        signals.push({ code: `FILENAME_${rule.type}`, weight: rule.filename_weight, matched: m[0] })
        score = Math.max(score, rule.filename_weight)
        break // une fois suffit
      }
    }

    if (ocr) {
      for (const re of rule.ocr_patterns) {
        const m = ocr.match(re)
        if (m) {
          signals.push({
            code: `OCR_${rule.type}`,
            weight: rule.ocr_weight,
            matched: m[0].slice(0, 80),
          })
          score = Math.max(score, rule.ocr_weight)
          break
        }
      }
    }

    if (score > bestScore) {
      bestType = rule.type
      bestScore = score
      bestSignals = signals
      bestSuggestion = rule.suggested_use
    }
  }

  // 4. Si rien n'a match : other_admin avec confidence faible
  if (bestScore === 0) {
    return {
      predicted_type: 'other_admin',
      confidence: 0.35,
      requires_ai_fallback: true,
      signals: [
        {
          code: 'NO_PATTERN_MATCH',
          weight: 0.35,
          matched: ext ?? 'aucun',
        },
      ],
      suggested_use: null,
    }
  }

  // 5. Confidence finale : score (filename poids ou OCR poids, max)
  const confidence = Math.round(bestScore * 100) / 100

  return {
    predicted_type: bestType,
    confidence,
    // Fallback Vision recommandé si confidence < 0.7
    requires_ai_fallback: confidence < 0.7,
    signals: bestSignals,
    suggested_use: bestSuggestion,
  }
}
