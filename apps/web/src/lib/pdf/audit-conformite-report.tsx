/**
 * KOVAS — Scaffold composant rapport mensuel "Bouclier Conformité" (Upsell #3).
 *
 * V1 minimal : composant React fonctionnel rendant le rapport en HTML/JSX
 * imprimable (CSS `@page A4`). La conversion HTML → PDF se fait soit en
 * runtime client via `window.print()`, soit en server side via Puppeteer
 * (route API `/api/audit-conformite/[reportId]/pdf` à câbler post-V1).
 *
 * Design : strict KOVAS Design System v2 — Manrope sans + Instrument Serif
 * italic + Cream paper #FDFBF6 + Navy #0F1E3D + Ambre warm pour KPI hero +
 * Pastels catégoriels pour les diagnostic chips.
 *
 * Structure :
 *   - Page 1 (cover) : mois + score global hero italic + nb missions analysées
 *   - Page 2 (liste) : top 5 missions à risque, severity color-coded
 *   - Page 3 (recos) : plan de remédiation narratif (généré par l'Edge Function)
 *
 * Données : alimenté par la row `audit_conformite_reports` (champ
 * `high_risk_missions` JSONB qui contient `{ signals, bySeverity, remediation }`).
 *
 * Note V1 : pas d'import `@react-pdf/renderer` (non installé). Si on bascule
 * vers @react-pdf plus tard, remplacer les `<div>` par les primitives RP-PDF.
 *
 * Authority : CLAUDE.md §9 Design System v2 + brief Bouclier Conformité.
 */

import type { CSSProperties, ReactElement } from 'react'

/* -------------------------------------------------------------------------- */
/*  Types — alignés sur la row DB audit_conformite_reports                    */
/* -------------------------------------------------------------------------- */

export type RemediationSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RemediationSignalType =
  | 'dpe_shopping'
  | 'cadastre_mismatch'
  | 'class_jump'
  | 'aberrant_data'
  | 'pattern_recurrent'

export interface HighRiskSignal {
  readonly mission_id: string
  readonly type: RemediationSignalType
  readonly severity: RemediationSeverity
  readonly description: string
  readonly evidence: Readonly<Record<string, unknown>>
}

export interface HighRiskMissionsPayload {
  readonly signals: readonly HighRiskSignal[]
  readonly bySeverity: Readonly<Record<RemediationSeverity, number>>
  readonly remediation: string
}

export interface AuditConformiteReportData {
  readonly id: string
  readonly month_year: string // YYYY-MM
  readonly score_global: number
  readonly missions_count: number
  readonly high_risk_missions: HighRiskMissionsPayload
  readonly generated_at: string // ISO
}

export interface AuditConformiteReportProps {
  readonly data: AuditConformiteReportData
  /** Nom du diagnostiqueur (affiché en cover). Tutoiement OK ("Pour Benjamin"). */
  readonly firstName?: string | null
}

/* -------------------------------------------------------------------------- */
/*  Helpers — affichage                                                        */
/* -------------------------------------------------------------------------- */

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function formatMonthLabel(monthYear: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthYear)
  if (!match) return monthYear
  const year = match[1]
  const monthIdx = Number(match[2]) - 1
  if (monthIdx < 0 || monthIdx > 11) return monthYear
  return `${MONTHS_FR[monthIdx]} ${year}`
}

function severityLabel(s: RemediationSeverity): string {
  switch (s) {
    case 'critical': return 'Critique'
    case 'high': return 'Élevé'
    case 'medium': return 'Modéré'
    case 'low': return 'Faible'
  }
}

function severityColor(s: RemediationSeverity): string {
  // Palette sémantique cohérente Design System v2
  switch (s) {
    case 'critical': return '#DC2626' // accent-red
    case 'high': return '#F97316'     // accent-orange
    case 'medium': return '#F59E0B'   // accent-yellow
    case 'low': return '#3B82F6'      // accent-blue
  }
}

function signalTypeLabel(t: RemediationSignalType): string {
  switch (t) {
    case 'dpe_shopping': return 'DPE shopping'
    case 'cadastre_mismatch': return 'Surface cadastrale'
    case 'class_jump': return 'Saut de classe'
    case 'aberrant_data': return 'Donnée aberrante'
    case 'pattern_recurrent': return 'Erreur récurrente'
  }
}

/* -------------------------------------------------------------------------- */
/*  Styles inline (impression A4 friendly)                                     */
/* -------------------------------------------------------------------------- */

const styles: Record<string, CSSProperties> = {
  page: {
    width: '210mm',
    minHeight: '297mm',
    padding: '20mm 18mm',
    background: '#FDFBF6',
    color: '#0F1E3D',
    fontFamily:
      'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    fontSize: '12pt',
    lineHeight: 1.55,
    pageBreakAfter: 'always',
  },
  pageLast: {
    pageBreakAfter: 'auto',
  },
  eyebrow: {
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontSize: '10pt',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#4A5878',
    marginBottom: '6mm',
  },
  h1: {
    fontFamily: 'Manrope, sans-serif',
    fontSize: '32pt',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: '4mm',
  },
  h1Serif: {
    fontFamily: '"Instrument Serif", Georgia, serif',
    fontStyle: 'italic',
    fontWeight: 400,
  },
  scoreHero: {
    fontFamily: '"Instrument Serif", Georgia, serif',
    fontStyle: 'italic',
    fontSize: '96pt',
    fontWeight: 400,
    lineHeight: 1,
    color: '#0F1E3D',
    margin: '12mm 0',
  },
  scoreLabel: {
    fontSize: '14pt',
    color: '#4A5878',
    marginBottom: '20mm',
  },
  kpiBlock: {
    display: 'flex',
    gap: '12mm',
    marginTop: '8mm',
  },
  kpi: {
    background: '#F8F5EE',
    border: '1px solid #D5CDB8',
    borderRadius: '12pt',
    padding: '5mm 6mm',
    flex: 1,
  },
  kpiValue: {
    fontFamily: '"Instrument Serif", Georgia, serif',
    fontStyle: 'italic',
    fontSize: '32pt',
    lineHeight: 1,
    marginBottom: '2mm',
  },
  kpiLabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '9pt',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#4A5878',
  },
  h2: {
    fontFamily: 'Manrope, sans-serif',
    fontSize: '20pt',
    fontWeight: 700,
    marginBottom: '6mm',
    color: '#0F1E3D',
  },
  signalCard: {
    border: '1px solid #D5CDB8',
    borderRadius: '12pt',
    padding: '5mm',
    marginBottom: '4mm',
    background: '#FDFBF6',
    pageBreakInside: 'avoid',
  },
  signalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3mm',
  },
  severityPill: {
    display: 'inline-block',
    padding: '2pt 10pt',
    borderRadius: '999pt',
    fontSize: '9pt',
    fontWeight: 600,
    fontFamily: 'JetBrains Mono, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#FFFFFF',
  },
  typeBadge: {
    display: 'inline-block',
    padding: '2pt 8pt',
    borderRadius: '6pt',
    fontSize: '9pt',
    fontWeight: 500,
    background: '#F8F5EE',
    color: '#1F2E4D',
    fontFamily: 'JetBrains Mono, monospace',
  },
  signalDescription: {
    fontSize: '11pt',
    lineHeight: 1.5,
    color: '#1F2E4D',
  },
  missionRef: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10pt',
    color: '#4A5878',
  },
  remediationBlock: {
    background: '#FFEDD5',
    borderRadius: '12pt',
    padding: '8mm',
    border: '1px solid #FFD7A8',
    whiteSpace: 'pre-wrap',
    fontSize: '11pt',
    lineHeight: 1.6,
  },
  footer: {
    marginTop: '20mm',
    paddingTop: '6mm',
    borderTop: '1px solid #E5DECB',
    fontSize: '9pt',
    color: '#7E8AA4',
    fontFamily: 'JetBrains Mono, monospace',
  },
  emptyState: {
    background: '#F8F5EE',
    border: '1px solid #D5CDB8',
    borderRadius: '12pt',
    padding: '10mm',
    textAlign: 'center',
    color: '#4A5878',
    fontSize: '11pt',
    marginBottom: '6mm',
  },
}

/* -------------------------------------------------------------------------- */
/*  Sous-composants                                                            */
/* -------------------------------------------------------------------------- */

function CoverPage({
  data,
  firstName,
}: { data: AuditConformiteReportData; firstName: string | null }): ReactElement {
  const total = data.high_risk_missions.bySeverity
  const totalSignals = total.critical + total.high + total.medium + total.low

  return (
    <section style={styles.page}>
      <div style={styles.eyebrow}>Rapport mensuel · Bouclier Conformité</div>

      <h1 style={styles.h1}>
        {firstName ? `${firstName}, ` : ''}voici ton{' '}
        <span style={styles.h1Serif}>scan de conformité</span>
        <br />
        de {formatMonthLabel(data.month_year)}.
      </h1>

      <div style={styles.scoreHero}>{data.score_global}</div>
      <div style={styles.scoreLabel}>Score global / 100 — préventif ADEME</div>

      <div style={styles.kpiBlock}>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{data.missions_count}</div>
          <div style={styles.kpiLabel}>Missions analysées</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{totalSignals}</div>
          <div style={styles.kpiLabel}>Signaux détectés</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{total.critical + total.high}</div>
          <div style={styles.kpiLabel}>Risques élevés</div>
        </div>
      </div>

      <p
        style={{
          marginTop: '14mm',
          fontSize: '11pt',
          color: '#4A5878',
          lineHeight: 1.6,
        }}
      >
        Avant que tes DPE partent à l'ADEME via Liciel, KOVAS scanne préventivement chaque
        mission et identifie celles à risque de contrôle. Tu corriges. Tu envoies en
        confiance.
      </p>
    </section>
  )
}

function RiskMissionsPage({ data }: { data: AuditConformiteReportData }): ReactElement {
  const signals = data.high_risk_missions.signals ?? []
  return (
    <section style={styles.page}>
      <div style={styles.eyebrow}>Page 2 / 3</div>
      <h2 style={styles.h2}>Top {Math.min(5, signals.length)} missions à risque</h2>

      {signals.length === 0 ? (
        <div style={styles.emptyState}>
          Aucune mission à risque détectée ce mois-ci. Continue comme ça.
        </div>
      ) : (
        signals.slice(0, 5).map((s) => (
          <article key={`${s.mission_id}-${s.type}`} style={styles.signalCard}>
            <div style={styles.signalHeader}>
              <span style={styles.missionRef}>Mission {s.mission_id.slice(0, 8)}</span>
              <div style={{ display: 'flex', gap: '4mm', alignItems: 'center' }}>
                <span style={styles.typeBadge}>{signalTypeLabel(s.type)}</span>
                <span
                  style={{
                    ...styles.severityPill,
                    background: severityColor(s.severity),
                  }}
                >
                  {severityLabel(s.severity)}
                </span>
              </div>
            </div>
            <p style={styles.signalDescription}>{s.description}</p>
          </article>
        ))
      )}
    </section>
  )
}

function RemediationPage({ data }: { data: AuditConformiteReportData }): ReactElement {
  const remediation = data.high_risk_missions.remediation ?? ''
  return (
    <section style={{ ...styles.page, ...styles.pageLast }}>
      <div style={styles.eyebrow}>Page 3 / 3</div>
      <h2 style={styles.h2}>Plan de remédiation</h2>

      {remediation.trim().length === 0 ? (
        <div style={styles.emptyState}>
          Aucun plan de remédiation généré pour ce rapport (score global :{' '}
          {data.score_global}/100).
        </div>
      ) : (
        <div style={styles.remediationBlock}>{remediation}</div>
      )}

      <div style={styles.footer}>
        Rapport généré le{' '}
        {new Date(data.generated_at).toLocaleString('fr-FR', {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'Europe/Paris',
        })}
        {' · '}KOVAS — édité par Nexus 1993, SASU. Document confidentiel.
        <br />
        Liciel calcule techniquement le DPE selon la méthode 3CL-2021. KOVAS Bouclier
        Conformité scanne préventivement pour identifier les missions à risque de contrôle.
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Composant principal — page complète A4                                     */
/* -------------------------------------------------------------------------- */

/**
 * Composant scaffold V1 du rapport "Bouclier Conformité".
 *
 * Rendu en mode HTML imprimable (CSS @page A4, page-breaks contrôlés). Pour
 * l'export PDF serveur, embarquer dans un endpoint Next.js qui appelle
 * Puppeteer / @sparticuz/chromium ou les utilitaires `printToPDF` standards.
 *
 * @example
 *   <AuditConformiteReport data={report} firstName="Benjamin" />
 *   // puis : window.print() côté client, ou pdf.create(html) côté serveur.
 */
export function AuditConformiteReport(props: AuditConformiteReportProps): ReactElement {
  const firstName = props.firstName ?? null
  return (
    <div data-kovas-report="audit-conformite" data-report-id={props.data.id}>
      <CoverPage data={props.data} firstName={firstName} />
      <RiskMissionsPage data={props.data} />
      <RemediationPage data={props.data} />
    </div>
  )
}

export default AuditConformiteReport
