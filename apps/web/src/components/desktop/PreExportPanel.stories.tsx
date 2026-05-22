import type { Finding, PreExportAnalysisResult } from '@/lib/pre-export/types'
import type { Meta, StoryObj } from '@storybook/react'
import { PreExportPanel } from './PreExportPanel'

/**
 * PreExportPanel — module de pré-vérification avant export.
 *
 * Stories couvrent les 3 scénarios canoniques :
 *   - Score 95 (exemplaire, peu de findings)
 *   - Score 60 (exploitable, plusieurs warnings)
 *   - Score 35 (à reprendre, beaucoup de findings critiques)
 *
 * Le bouton "Exporter quand même" reste TOUJOURS actif — c'est la règle UX
 * forte du module (cf. CLAUDE.md §9 philosophie).
 */

const baseResult = (overrides: Partial<PreExportAnalysisResult>): PreExportAnalysisResult => ({
  global_score: 80,
  conformity_score: 32,
  coherence_score: 16,
  statistical_score: 16,
  quality_score: 8,
  exhaustivity_score: 8,
  findings: [],
  interpretation: 'conforme',
  counters: { critical: 0, warning: 0, suggestion: 0, info: 0 },
  analyzed_at: new Date().toISOString(),
  duration_ms: 320,
  ...overrides,
})

const meta: Meta<typeof PreExportPanel> = {
  title: 'Desktop/PreExportPanel',
  component: PreExportPanel,
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [768, 1280, 1920] },
  },
  args: {
    targetFormat: 'liciel_xml',
    missionReference: 'MIS-2026-00042',
    onClose: () => undefined,
    onExport: () => undefined,
  },
}

export default meta
type Story = StoryObj<typeof PreExportPanel>

export const Score95Exemplaire: Story = {
  args: {
    result: baseResult({
      global_score: 95,
      conformity_score: 40,
      coherence_score: 19,
      statistical_score: 18,
      quality_score: 10,
      exhaustivity_score: 8,
      interpretation: 'exemplaire',
      counters: { critical: 0, warning: 0, suggestion: 2, info: 1 },
      findings: [
        {
          code: 'opportunity_audit',
          category: 'opportunity',
          severity: 'suggestion',
          title: 'Opportunité audit énergétique',
          message: 'Le client pourrait être intéressé par un audit énergétique (DPE F détecté).',
        },
      ],
    }),
  },
}

export const Score60Exploitable: Story = {
  args: {
    result: baseResult({
      global_score: 60,
      conformity_score: 26,
      coherence_score: 14,
      statistical_score: 12,
      quality_score: 5,
      exhaustivity_score: 3,
      interpretation: 'exploitable',
      counters: { critical: 0, warning: 4, suggestion: 3, info: 1 },
      findings: buildSampleFindings(4, 'warning'),
    }),
  },
}

export const Score35ARependre: Story = {
  args: {
    result: baseResult({
      global_score: 35,
      conformity_score: 15,
      coherence_score: 8,
      statistical_score: 7,
      quality_score: 3,
      exhaustivity_score: 2,
      interpretation: 'a_reprendre',
      counters: { critical: 5, warning: 6, suggestion: 2, info: 0 },
      findings: [...buildSampleFindings(5, 'critical'), ...buildSampleFindings(6, 'warning')],
    }),
  },
}

export const ManyFindings: Story = {
  args: {
    result: baseResult({
      global_score: 55,
      counters: { critical: 3, warning: 12, suggestion: 8, info: 4 },
      findings: [
        ...buildSampleFindings(3, 'critical'),
        ...buildSampleFindings(12, 'warning'),
        ...buildSampleFindings(8, 'suggestion'),
      ],
    }),
  },
}

function buildSampleFindings(count: number, severity: Finding['severity']): Finding[] {
  const categories: Finding['category'][] = [
    'conformity',
    'coherence',
    'statistical',
    'quality',
    'opportunity',
  ]
  return Array.from({ length: count }, (_, i) => ({
    code: `sample_${severity}_${i}`,
    category: categories[i % categories.length],
    severity,
    title: `Vérification ${severity} #${i + 1}`,
    message:
      'Vous avez peut-être omis cette information. Vérifiez avant export pour éviter un retour client.',
    suggested_action: 'Compléter le champ correspondant.',
  }))
}
