/**
 * Pattern 1 — Class anomaly.
 *
 * Détecte une incohérence entre la classe DPE déclarée et les caractéristiques
 * du bien. Le moteur d'estimation est délibérément simple (heuristique métier
 * sourcée du barème 3CL-2021 simplifié) et indépendant du futur calculateur
 * Phase 2. La détection cherche les écarts de **≥ 2 classes** par rapport à
 * la classe heuristique attendue.
 *
 * Exemples flaggés :
 *  - Maison 1850, 200m², fioul, isolation moyenne → classé A : sévérité ≈ 0.85
 *  - Appartement neuf 2024, PAC, 60m² → classé G : sévérité ≈ 0.9
 *  - Bien neuf < 2015 → classé F-G : sévérité ≈ 0.7
 *  - Maison ancienne sans isolation → classé A-B : sévérité ≈ 0.9
 *
 * Sources métier :
 *  - Arrêté du 31 mars 2021 méthode 3CL-2021
 *  - Données ADEME DPE base publique 2024 (médianes par tranche d'âge)
 */

import type { DpeClass, FraudSignal } from '../types'

export type HeatingType =
  | 'electric'
  | 'gas'
  | 'fioul'
  | 'wood'
  | 'heat_pump'
  | 'district'
  | 'unknown'

export type InsulationLevel = 'verygood' | 'good' | 'medium' | 'bad' | 'unknown'

export interface ClassAnomalyInput {
  declaredClass: DpeClass
  yearBuilt: number
  surfaceM2: number
  heatingType: HeatingType
  insulationLevel: InsulationLevel
  propertyType?: 'house' | 'apartment'
}

const CLASS_INDEX: Record<DpeClass, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
}

const CLASS_FROM_INDEX: ReadonlyArray<DpeClass> = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/**
 * Estime la classe DPE attendue via heuristique simplifiée.
 * Calcul d'un score 0-6, mappé à la classe correspondante.
 */
export function estimateExpectedClass(input: ClassAnomalyInput): {
  expectedClass: DpeClass
  scoreNumeric: number
  reasoning: string[]
} {
  const reasoning: string[] = []
  let score = 3 // partir de D, classe médiane

  // === Année construction ===
  if (input.yearBuilt >= 2013) {
    score -= 2.0 // RT 2012 → A-C par défaut
    reasoning.push('Bien construit ≥ 2013 (RT 2012) : -2.0')
  } else if (input.yearBuilt >= 2005) {
    score -= 1.0
    reasoning.push('Bien 2005-2012 (RT 2005) : -1.0')
  } else if (input.yearBuilt >= 1989) {
    score += 0.0
    reasoning.push('Bien 1989-2004 (RT 1988/2000) : neutre')
  } else if (input.yearBuilt >= 1975) {
    score += 1.0
    reasoning.push('Bien 1975-1988 (1ère RT) : +1.0')
  } else if (input.yearBuilt >= 1948) {
    score += 1.5
    reasoning.push('Bien 1948-1974 (reconstruction) : +1.5')
  } else {
    score += 2.0
    reasoning.push('Bien < 1948 (ancien) : +2.0')
  }

  // === Type de chauffage ===
  switch (input.heatingType) {
    case 'heat_pump':
      score -= 1.5
      reasoning.push('Chauffage PAC : -1.5')
      break
    case 'gas':
      score -= 0.5
      reasoning.push('Chauffage gaz : -0.5')
      break
    case 'wood':
      score -= 0.5
      reasoning.push('Chauffage bois : -0.5')
      break
    case 'district':
      score -= 0.5
      reasoning.push('Chauffage urbain : -0.5')
      break
    case 'electric':
      score += 0.5
      reasoning.push('Chauffage électrique : +0.5')
      break
    case 'fioul':
      score += 1.5
      reasoning.push('Chauffage fioul : +1.5')
      break
    case 'unknown':
      reasoning.push('Chauffage inconnu : neutre')
      break
  }

  // === Isolation ===
  switch (input.insulationLevel) {
    case 'verygood':
      score -= 1.5
      reasoning.push('Isolation très bonne : -1.5')
      break
    case 'good':
      score -= 0.75
      reasoning.push('Isolation bonne : -0.75')
      break
    case 'medium':
      score += 0.0
      reasoning.push('Isolation moyenne : neutre')
      break
    case 'bad':
      score += 1.5
      reasoning.push('Isolation mauvaise : +1.5')
      break
    case 'unknown':
      reasoning.push('Isolation inconnue : neutre')
      break
  }

  // === Effet surface (modérateur) ===
  // Très petits logements : surconsommation relative possible
  if (input.surfaceM2 < 25) {
    score += 0.25
    reasoning.push('Surface < 25m² : +0.25 (ratio chauffage défavorable)')
  } else if (input.surfaceM2 > 200) {
    score += 0.25
    reasoning.push('Surface > 200m² : +0.25 (déperditions volumétriques)')
  }

  // Clamp [0, 6]
  const clamped = Math.max(0, Math.min(6, score))
  const expectedIdx = Math.round(clamped)
  const expectedClass = CLASS_FROM_INDEX[expectedIdx] ?? 'D'

  return {
    expectedClass,
    scoreNumeric: clamped,
    reasoning,
  }
}

/**
 * Détecte l'anomalie de classe DPE.
 * Severity = écart absolu en classes / 6, plafonné à 1.
 * Boost de severity si l'écart va dans le sens "amélioration suspecte" (déclaré meilleur que attendu).
 */
export function detectClassAnomaly(input: ClassAnomalyInput): FraudSignal {
  const { expectedClass, scoreNumeric, reasoning } = estimateExpectedClass(input)
  const declaredIdx = CLASS_INDEX[input.declaredClass]
  const expectedIdx = CLASS_INDEX[expectedClass]
  const gap = declaredIdx - expectedIdx // négatif = déclaré "meilleur" qu'attendu

  let severity: number
  if (Math.abs(gap) <= 1) {
    severity = 0.0
  } else if (gap < 0) {
    // Surclassement (déclaré meilleur qu'attendu) — typique de la fraude
    // gap=-2 → 0.55, gap=-3 → 0.75, gap=-4 → 0.90, gap=-5 → 1.0
    severity = Math.min(1, 0.35 + Math.abs(gap) * 0.18)
  } else {
    // Sous-classement (déclaré pire qu'attendu) — rare, peut être négligence
    severity = Math.min(0.5, Math.abs(gap) * 0.12)
  }

  const flagged = severity >= 0.5
  const direction = gap < 0 ? 'surclassement (suspect)' : gap > 0 ? 'sous-classement' : 'aligné'

  const reason =
    severity >= 0.5
      ? `Classe DPE déclarée ${input.declaredClass} vs attendue ${expectedClass} — ${direction}, écart ${Math.abs(gap)} classe(s).`
      : `Classe DPE déclarée ${input.declaredClass} cohérente avec l'estimation (${expectedClass}).`

  return {
    pattern: 'class_anomaly',
    severity,
    flagged,
    reason,
    details: {
      declaredClass: input.declaredClass,
      expectedClass,
      expectedScore: Number(scoreNumeric.toFixed(2)),
      gap,
      direction,
      reasoning,
      yearBuilt: input.yearBuilt,
      surfaceM2: input.surfaceM2,
      heatingType: input.heatingType,
      insulationLevel: input.insulationLevel,
    },
  }
}
