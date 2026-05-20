/**
 * Petits badges plan + status utilisés dans liste + fiche détaillée.
 *
 * Les variants de Badge (default/blue/green/red/orange/amber/muted) sont
 * mappés via `planBadge()` / `statusBadge()` (cf. lib/admin/users-types.ts).
 */

import { Badge } from '@/components/ui/badge'
import { planBadge, statusBadge } from '@/lib/admin/users-types'

export function PlanBadge({ plan }: { plan: string }) {
  const meta = planBadge(plan)
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

export function StatusBadge({ status, suspended }: { status: string; suspended: boolean }) {
  const meta = statusBadge(status, suspended)
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}
