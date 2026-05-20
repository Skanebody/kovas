/**
 * Top 10 des champs Vision IA les plus corrigés manuellement.
 *
 * Une correction signale soit une extraction imparfaite, soit un champ ambigu.
 * Trier par editCount donne les points chauds à améliorer côté prompt Vision /
 * post-traitement.
 */

import { Card } from '@/components/ui/card'
import type { MostCorrectedField } from '@/lib/admin/product-analytics'

interface MostCorrectedFieldsTableProps {
  fields: MostCorrectedField[]
}

const DIAGNOSTIC_LABELS: Record<string, string> = {
  DPE: 'DPE',
  AMIANTE: 'AMIANTE',
  PLOMB: 'PLOMB',
  GAZ: 'GAZ',
  ELEC: 'ÉLEC',
  TERMITES: 'TERMITES',
  CARREZ: 'CARREZ',
  ERP: 'ERP',
}

const DIAGNOSTIC_PASTEL: Record<string, string> = {
  DPE: 'bg-blue-mist text-[#1E3A8A]',
  AMIANTE: 'bg-orange-mist text-[#7C3F0A]',
  PLOMB: 'bg-coral-mist text-[#8B1414]',
  GAZ: 'bg-lime-mist text-[#2D4015]',
  ELEC: 'bg-[#E8E0F5] text-[#2F1F5A]',
  TERMITES: 'bg-cream-deep text-ink-mute',
  CARREZ: 'bg-blue-mist text-[#1E3A8A]',
  ERP: 'bg-orange-mist text-[#7C3F0A]',
}

/**
 * Prettifie un field_path technique en label humain compact.
 *   "enveloppe.isolation_combles.epaisseur_cm" → "Isolation combles · épaisseur (cm)"
 */
function humanizeFieldPath(path: string): string {
  const cleaned = path
    .split('.')
    .map((seg) => seg.replace(/_/g, ' '))
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
  return cleaned.join(' · ')
}

export function MostCorrectedFieldsTable({ fields }: MostCorrectedFieldsTableProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Top champs corrigés manuellement
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Champs Vision IA les plus édités après extraction — points à améliorer.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          top {fields.length}
        </span>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucune correction manuelle enregistrée pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-mute font-mono text-[10px] uppercase tracking-[0.16em]">
                <th className="text-left font-normal pb-2 pr-3">Diag.</th>
                <th className="text-left font-normal pb-2 pr-3">Champ</th>
                <th className="text-right font-normal pb-2 pr-3">Corrigé</th>
                <th className="text-right font-normal pb-2 pr-3">Total</th>
                <th className="text-right font-normal pb-2 pr-3">Taux</th>
                <th className="pb-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={`${f.diagnostic}-${f.fieldPath}`} className="border-t border-rule/40">
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                        DIAGNOSTIC_PASTEL[f.diagnostic] ?? 'bg-ink/10 text-ink'
                      }`}
                    >
                      {DIAGNOSTIC_LABELS[f.diagnostic] ?? f.diagnostic}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-ink">
                    <span className="block truncate max-w-[280px]" title={f.fieldPath}>
                      {humanizeFieldPath(f.fieldPath)}
                    </span>
                    <span className="block font-mono text-[10px] text-ink-faint truncate max-w-[280px]">
                      {f.fieldPath}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-ink">{f.editCount}</td>
                  <td className="py-2 pr-3 text-right font-mono text-ink-mute">{f.totalCount}</td>
                  <td className="py-2 pr-3 text-right font-mono text-ink">
                    {f.correctionRate.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-ink transition-colors"
                      title="Voir les corrections détaillées (TODO V2)"
                      disabled
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
