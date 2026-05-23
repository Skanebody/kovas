/**
 * KOVAS — Niveau 4 (partie locale) : cross-check métier rapide d'une transcription.
 *
 * Avant d'envoyer la transcription à Claude, on détecte les incohérences évidentes
 * qui suggèrent une erreur de transcription Whisper (homophonie, hallucination,
 * unité mal comprise). Si une incohérence est détectée, on propose à l'utilisateur :
 *   - [Ignorer] : on continue, c'est volontaire
 *   - [Refaire le vocal] : ré-enregistre
 *   - [Corriger manuellement] : édite le texte
 *
 * Règles métier (DPE / diagnostic immobilier FR) :
 *   - Surface > 1000 m² ou < 1 m² → incohérent
 *   - Année construction < 1800 ou > année courante + 2 → impossible
 *   - Classe DPE doit être A-G (1 lettre majuscule)
 *   - Hauteur sous plafond < 1,5m ou > 6m → suspect
 *   - Nombre de pièces principales > 20 ou < 1 → suspect
 *
 * Authority : MISSION-E niveau 4 (cross-check métier).
 */

import { extractStructuredData } from '@/lib/mission/local-extraction'

export type CoherenceSeverity = 'warning' | 'error'

export interface CoherenceIssue {
  severity: CoherenceSeverity
  field: string
  value: string | number
  message: string
  hint?: string
}

const CURRENT_YEAR = new Date().getFullYear()
const VALID_DPE_CLASSES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

/**
 * Analyse une transcription et retourne les incohérences détectées.
 * Retourne [] si tout va bien (cas normal).
 *
 * @param transcript Texte brut transcrit par Whisper (potentiellement marqué)
 * @returns Liste d'incohérences (vide si OK)
 */
export function checkTranscriptCoherence(transcript: string): CoherenceIssue[] {
  if (!transcript || transcript.trim().length === 0) return []

  const issues: CoherenceIssue[] = []
  const data = extractStructuredData(transcript)

  // Surface : >1000m² ou <1m² = très suspect
  if (data.surfaceSqm != null) {
    if (data.surfaceSqm > 1000) {
      issues.push({
        severity: 'error',
        field: 'surface',
        value: data.surfaceSqm,
        message: `Surface ${data.surfaceSqm} m² invraisemblable (max ~1000 m² pour un logement)`,
        hint: 'Vérifiez : Whisper confond parfois "200" et "deux cents", ou ajoute des zéros.',
      })
    } else if (data.surfaceSqm < 1) {
      issues.push({
        severity: 'error',
        field: 'surface',
        value: data.surfaceSqm,
        message: `Surface ${data.surfaceSqm} m² trop petite (minimum 1 m²)`,
      })
    }
  }

  // Année construction : <1800 ou >année+2
  if (data.yearBuilt != null) {
    if (data.yearBuilt < 1800) {
      issues.push({
        severity: 'error',
        field: 'yearBuilt',
        value: data.yearBuilt,
        message: `Année ${data.yearBuilt} antérieure à 1800 — vérifiez la transcription`,
        hint: "Le DPE ne s'applique pas aux édifices historiques classés.",
      })
    } else if (data.yearBuilt > CURRENT_YEAR + 2) {
      issues.push({
        severity: 'error',
        field: 'yearBuilt',
        value: data.yearBuilt,
        message: `Année ${data.yearBuilt} dans le futur — vérifiez la transcription`,
      })
    }
  }

  // Classe DPE : doit être A-G
  if (data.classeDpe != null) {
    const upper = String(data.classeDpe).trim().toUpperCase()
    if (!VALID_DPE_CLASSES.has(upper)) {
      issues.push({
        severity: 'warning',
        field: 'classeDpe',
        value: upper,
        message: `Classe DPE "${upper}" hors barème A-G`,
        hint: 'Whisper confond parfois "A" avec "AH", "ah", "ha".',
      })
    }
  }

  // Hauteur sous plafond : <1,5m ou >6m suspect
  if (data.ceilingHeightM != null) {
    if (data.ceilingHeightM < 1.5) {
      issues.push({
        severity: 'warning',
        field: 'ceilingHeightM',
        value: data.ceilingHeightM,
        message: `Hauteur ${data.ceilingHeightM} m très basse (combles aménagés ?)`,
      })
    } else if (data.ceilingHeightM > 6) {
      issues.push({
        severity: 'warning',
        field: 'ceilingHeightM',
        value: data.ceilingHeightM,
        message: `Hauteur ${data.ceilingHeightM} m exceptionnelle (loft ?)`,
      })
    }
  }

  // Nombre de chambres : >20 = très suspect
  if (data.nbBedrooms != null && data.nbBedrooms > 20) {
    issues.push({
      severity: 'warning',
      field: 'nbBedrooms',
      value: data.nbBedrooms,
      message: `${data.nbBedrooms} chambres : vérifiez la transcription`,
    })
  }

  return issues
}

/** Helper : true si au moins une incohérence de niveau 'error'. */
export function hasBlockingIssues(issues: CoherenceIssue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}
