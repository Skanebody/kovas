/**
 * Pattern 2 — Processing velocity.
 *
 * Détecte des temps de traitement anormaux entre création de mission et
 * signature DPE. Référence métier (médiane FR 2024) :
 *  - délai sain : 3-30 jours
 *  - très rapide (< 24h) : suspect — pas de visite
 *  - extrêmement rapide (< 4h) : très suspect — production en chaîne
 *  - très lent (> 90j) : suspect — DPE signé rétroactivement
 *
 * Tient compte du profil diagnostiqueur :
 *  - junior (< 2 ans) avec délai court : plus suspect qu'un sénior
 *  - volume mensuel élevé (> 80 missions) avec délais courts : moins suspect
 *    (capacité industrielle légitime)
 */

import type { FraudSignal } from '../types'

export interface VelocityInput {
  createdAt: Date
  signedAt: Date
  diagnostician: {
    yearsActive: number
    monthlyMissions: number
  }
}

const MIN_LEGITIMATE_HOURS = 4
const FAST_THRESHOLD_HOURS = 24
const NORMAL_LOW_DAYS = 3
const NORMAL_HIGH_DAYS = 30
const SLOW_THRESHOLD_DAYS = 90

export function detectProcessingVelocity(input: VelocityInput): FraudSignal {
  const elapsedMs = input.signedAt.getTime() - input.createdAt.getTime()
  const elapsedHours = elapsedMs / (1000 * 60 * 60)
  const elapsedDays = elapsedHours / 24

  let severity = 0
  let reason = `Délai création→signature ${elapsedHours.toFixed(1)}h — dans la fourchette normale.`

  if (elapsedMs < 0) {
    // Signature avant création : impossible, signal max
    severity = 1
    reason = `Signature antérieure à la création (${elapsedHours.toFixed(1)}h) — donnée corrompue ou fraude évidente.`
  } else if (elapsedHours < MIN_LEGITIMATE_HOURS) {
    // < 4h : production industrielle, quasi-impossible visite réelle
    severity = 0.95
    reason = `Signature en ${elapsedHours.toFixed(1)}h — impossibilité technique d'une visite réelle.`
  } else if (elapsedHours < FAST_THRESHOLD_HOURS) {
    // 4-24h : très rapide, suspect sauf cabinet industriel
    severity = 0.6
    reason = `Signature en ${elapsedHours.toFixed(1)}h — délai très court (médiane FR : 12 jours).`
    // Atténuation si volume mensuel élevé (cabinet rodé)
    if (input.diagnostician.monthlyMissions >= 80) {
      severity *= 0.6
      reason += ` Modéré : volume mensuel élevé (${input.diagnostician.monthlyMissions} missions/mo).`
    }
    // Aggravation si junior
    if (input.diagnostician.yearsActive < 2) {
      severity = Math.min(0.85, severity + 0.15)
      reason += ` Aggravé : opérateur junior (${input.diagnostician.yearsActive} an[s]).`
    }
  } else if (elapsedDays >= NORMAL_LOW_DAYS && elapsedDays <= NORMAL_HIGH_DAYS) {
    // Plage normale
    severity = 0
  } else if (elapsedDays > SLOW_THRESHOLD_DAYS) {
    // > 90j : suspect — peut être un DPE rétroactif
    severity = 0.7
    reason = `Délai ${elapsedDays.toFixed(0)} jours — signature très tardive, possible DPE rétroactif.`
  } else if (elapsedDays > NORMAL_HIGH_DAYS) {
    // 30-90j : warning léger
    severity = 0.3
    reason = `Délai ${elapsedDays.toFixed(0)} jours — au-delà de la médiane mais plausible.`
  } else {
    // 1-3j : très rapide mais possible si client motivé + planning aligné
    severity = 0.25
    reason = `Délai ${elapsedDays.toFixed(1)} jours — rapide mais plausible.`
  }

  return {
    pattern: 'processing_velocity',
    severity: Math.max(0, Math.min(1, severity)),
    flagged: severity >= 0.5,
    reason,
    details: {
      elapsedHours: Number(elapsedHours.toFixed(2)),
      elapsedDays: Number(elapsedDays.toFixed(2)),
      createdAt: input.createdAt.toISOString(),
      signedAt: input.signedAt.toISOString(),
      diagnostician: input.diagnostician,
    },
  }
}
