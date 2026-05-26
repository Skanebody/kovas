/**
 * KOVAS — Génération des "findings" pré-export pour les risques étendus.
 *
 * Vérifie que les obligations d'Information Acquéreur/Locataire (IAL) sont
 * cochées dans le rapport quand l'aléa Géorisques le requiert. Évite l'erreur
 * grossière d'IAL incomplète qui rend le DPE annexable mais le compromis
 * juridique attaquable.
 *
 * Convention métadonnées dossier (`dossiers.metadata.ial_acknowledged`) :
 *   {
 *     radon?: boolean    // case "Information radon" cochée ?
 *     ppri?: boolean     // case "PPRI" cochée ?
 *     argiles?: boolean  // case "RGA / argiles" cochée ?
 *   }
 *
 * Si ce sous-objet n'existe pas → on considère que la case n'est pas cochée.
 *
 * Authority : arrêté 13/07/2018 (IAL radon), loi ELAN 23/11/2018 (IAL RGA),
 *             R125-26 CCH (information sur les risques).
 */

import type { ExtendedRisksBundle } from './georisques-cache'

export type PreExportFindingSeverity = 'info' | 'warn' | 'block'

export interface PreExportFinding {
  id: string
  severity: PreExportFindingSeverity
  message: string
}

interface IalAcknowledged {
  radon?: boolean
  ppri?: boolean
  argiles?: boolean
}

/**
 * Lit le sous-objet `ial_acknowledged` depuis `metadata` sans casser si la
 * structure n'est pas conforme.
 */
function readIalAck(metadata: Record<string, unknown> | null | undefined): IalAcknowledged {
  if (!metadata || typeof metadata !== 'object') return {}
  const raw = (metadata as Record<string, unknown>)['ial_acknowledged']
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  return {
    radon: typeof obj['radon'] === 'boolean' ? (obj['radon'] as boolean) : undefined,
    ppri: typeof obj['ppri'] === 'boolean' ? (obj['ppri'] as boolean) : undefined,
    argiles: typeof obj['argiles'] === 'boolean' ? (obj['argiles'] as boolean) : undefined,
  }
}

/**
 * Construit la liste des findings pré-export liés aux risques étendus.
 * - Vide si bundle null ou aucun aléa déclencheur d'IAL n'est présent.
 * - Sévérité `warn` (pas `block`) — l'utilisateur reste seul juge.
 */
export function buildExtendedRisksFindings(
  bundle: ExtendedRisksBundle | null,
  metadata: Record<string, unknown> | null | undefined,
): PreExportFinding[] {
  if (!bundle) return []
  const ack = readIalAck(metadata)
  const findings: PreExportFinding[] = []

  // ── Radon classe 3 ─────────────────────────────────────────────────────
  if (bundle.radon?.obligationIAL && ack.radon !== true) {
    findings.push({
      id: 'ial-radon',
      severity: 'warn',
      message:
        'Commune en zone radon 3 : confirmez que la case « Information radon » est cochée dans le rapport.',
    })
  }

  // ── PPRI applicable ────────────────────────────────────────────────────
  const ppriApprouve = bundle.ppri.filter((p) => p.etat === 'approuvé' || p.etat === 'approuve')
  if (ppriApprouve.length > 0 && ack.ppri !== true) {
    findings.push({
      id: 'ial-ppri',
      severity: 'warn',
      message:
        'Plan PPRI approuvé sur la commune : confirmez que la case « PPRI » est cochée dans le rapport.',
    })
  }

  // ── Argiles moyen/fort ─────────────────────────────────────────────────
  if (bundle.argiles?.obligationIAL && ack.argiles !== true) {
    const niveau = bundle.argiles.alea
    findings.push({
      id: 'ial-argiles',
      severity: 'warn',
      message: `Aléa retrait-gonflement argiles ${niveau} : confirmez que la case « RGA » est cochée dans le rapport.`,
    })
  }

  return findings
}
