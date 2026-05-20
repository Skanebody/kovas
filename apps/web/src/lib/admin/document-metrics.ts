/**
 * Analytics Document Intelligence pour la page /admin/utilities.
 *
 * Tables consommées (créées par autres agents) :
 *   - `documents`             (user_id, document_type, status, classification_confidence, created_at)
 *   - `document_extractions`  (extraction_data, confidence_by_field, ai_cost_eur)
 *   - `document_corrections`  (field_path, ai_value, ai_confidence, user_value)
 *   - `ai_usage_log`          (user_id, operation, model, cost_eur, created_at)
 *   - `user_scan_quotas`      (user_id, scans_used_this_period, scans_included, overage_cost_eur)
 *   - `profiles`              (id, full_name, email, default_org_id)
 *
 * Stratégie V1 identique à utilities-metrics : agrégation JS sur volumes brut
 * (< 100k rows mensuels attendus). V2 si latence > 1s : RPC SQL ou vue
 * matérialisée admin_documents_summary.
 *
 * Toutes les fonctions retournent des valeurs neutres en cas de table absente
 * ou erreur transient — la page reste affichable.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types publics
// ============================================

export interface DocumentTypeBreakdownEntry {
  type: string
  count: number
  percent: number
}

export interface FieldCorrectionRateEntry {
  fieldPath: string
  fieldLabel: string
  corrections: number
  total: number
  rate: number // 0..1
}

export interface DocumentUserVolumeEntry {
  userId: string
  name: string
  orgName: string
  volumeMonth: number
  costEur: number
}

export interface DocumentCostByUserEntry {
  userId: string
  name: string
  costEur: number
  percentOfTotal: number
}

export interface UserNearQuotaEntry {
  userId: string
  name: string
  scansUsed: number
  scansIncluded: number
  percentUsed: number // 0..100, capped 999 si dépassement
}

export interface DocumentMetrics {
  totalScans30d: number
  scanGrowthPct: number
  successRate: number // 0..1
  avgConfidence: number // 0..1
  totalCost30d: number
  marginPct: number // -∞ .. 1
  documentTypeBreakdown: DocumentTypeBreakdownEntry[]
  correctionRateByField: FieldCorrectionRateEntry[]
  topUsers: DocumentUserVolumeEntry[]
  costByUser: DocumentCostByUserEntry[]
  usersNearQuota: UserNearQuotaEntry[]
}

// ============================================
// Mapping field_path → label clair FR
// ============================================

const FIELD_LABELS: Record<string, string> = {
  'dpe.classe_energie': 'DPE · Classe énergie',
  'dpe.classe_climat': 'DPE · Classe climat',
  'dpe.consommation': 'DPE · Consommation kWh/m²',
  'dpe.emissions': 'DPE · Émissions CO₂',
  'dpe.date_realisation': 'DPE · Date réalisation',
  'amiante.presence': 'Amiante · Présence',
  'amiante.localisation': 'Amiante · Localisation',
  'plomb.classe': 'Plomb · Classe',
  'plomb.concentration': 'Plomb · Concentration',
  'carrez.surface_m2': 'Carrez · Surface m²',
  'carrez.pieces': 'Carrez · Pièces',
  'erp.zone_inondation': 'ERP · Zone inondation',
  'erp.zone_sismique': 'ERP · Zone sismique',
  'gaz.conformite': 'Gaz · Conformité',
  'elec.conformite': 'Élec · Conformité',
  'termites.presence': 'Termites · Présence',
  client_name: 'Client · Nom',
  client_email: 'Client · Email',
  client_phone: 'Client · Téléphone',
  bien_adresse: 'Bien · Adresse',
}

function labelForField(fieldPath: string): string {
  return FIELD_LABELS[fieldPath] ?? fieldPath
}

// ============================================
// Types row partiels (tables pas (encore) typées)
// ============================================

interface DocumentRow {
  id: string
  user_id: string
  document_type: string | null
  status: string | null
  classification_confidence: number | null
  created_at: string
}

interface DocumentCorrectionRow {
  field_path: string
}

interface AiUsageLogRow {
  user_id: string | null
  cost_eur: number | string | null
}

interface UserScanQuotaRow {
  user_id: string
  scans_used_this_period: number | null
  scans_included: number | null
  overage_cost_eur: number | string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  default_org_id: string | null
}

interface OrgNameRow {
  id: string
  name: string
}

// ============================================
// Helpers
// ============================================

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

async function fetchProfileMap(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, ProfileRow>> {
  const out = new Map<string, ProfileRow>()
  if (userIds.length === 0) return out
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, default_org_id')
    .in('id', userIds)
  for (const row of (data ?? []) as ProfileRow[]) {
    out.set(row.id, row)
  }
  return out
}

async function fetchOrgNameMap(
  supabase: SupabaseClient<Database>,
  orgIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (orgIds.length === 0) return out
  const { data } = await supabase.from('organizations').select('id, name').in('id', orgIds)
  for (const row of (data ?? []) as OrgNameRow[]) {
    out.set(row.id, row.name)
  }
  return out
}

function displayName(profile: ProfileRow | undefined): string {
  if (!profile) return '(utilisateur supprimé)'
  return profile.full_name?.trim() || profile.email || '(sans nom)'
}

// ============================================
// Public API
// ============================================

export async function getDocumentMetrics(
  supabase: SupabaseClient<Database>,
): Promise<DocumentMetrics> {
  const since30dIso = daysAgoIso(30)
  const since60dIso = daysAgoIso(60)

  // ----- Lecture brute -----
  // biome-ignore lint/suspicious/noExplicitAny: table non-encore typée dans Database
  const docsRes = await (supabase as any)
    .from('documents')
    .select('id, user_id, document_type, status, classification_confidence, created_at')
    .gte('created_at', since60dIso)

  const docs60d: DocumentRow[] = Array.isArray(docsRes?.data) ? (docsRes.data as DocumentRow[]) : []

  const docs30d = docs60d.filter((d) => d.created_at >= since30dIso)
  const docs30To60d = docs60d.filter((d) => d.created_at < since30dIso)

  // Corrections 30j
  // biome-ignore lint/suspicious/noExplicitAny: table non-encore typée dans Database
  const corrRes = await (supabase as any)
    .from('document_corrections')
    .select('field_path')
    .gte('created_at', since30dIso)

  const corrections30d: DocumentCorrectionRow[] = Array.isArray(corrRes?.data)
    ? (corrRes.data as DocumentCorrectionRow[])
    : []

  // AI usage log 30j (coût Document Intelligence)
  // biome-ignore lint/suspicious/noExplicitAny: table non-encore typée dans Database
  const aiRes = await (supabase as any)
    .from('ai_usage_log')
    .select('user_id, cost_eur')
    .gte('created_at', since30dIso)

  const aiUsage30d: AiUsageLogRow[] = Array.isArray(aiRes?.data)
    ? (aiRes.data as AiUsageLogRow[])
    : []

  // User scan quotas
  // biome-ignore lint/suspicious/noExplicitAny: table non-encore typée dans Database
  const quotasRes = await (supabase as any)
    .from('user_scan_quotas')
    .select('user_id, scans_used_this_period, scans_included, overage_cost_eur')

  const quotas: UserScanQuotaRow[] = Array.isArray(quotasRes?.data)
    ? (quotasRes.data as UserScanQuotaRow[])
    : []

  // ----- KPI globaux -----
  const totalScans30d = docs30d.length
  const totalScans30To60d = docs30To60d.length
  const scanGrowthPct =
    totalScans30To60d > 0 ? ((totalScans30d - totalScans30To60d) / totalScans30To60d) * 100 : 0

  const successCount = docs30d.filter(
    (d) => d.status === 'extracted' || d.status === 'prefilled',
  ).length
  const successRate = totalScans30d > 0 ? successCount / totalScans30d : 0

  const confidenceValues = docs30d
    .map((d) => d.classification_confidence)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length
      : 0

  const totalCost30d = aiUsage30d.reduce((s, r) => s + toNumber(r.cost_eur), 0)

  // Revenue overage : SUM(overage_cost_eur) — proxy V1 du revenu Document Intelligence
  const revenueOverage = quotas.reduce((s, q) => s + toNumber(q.overage_cost_eur), 0)
  const marginPct = revenueOverage > 0 ? (revenueOverage - totalCost30d) / revenueOverage : 0

  // ----- Type breakdown -----
  const typeCounts = new Map<string, number>()
  for (const d of docs30d) {
    const t = d.document_type ?? 'unknown'
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  const documentTypeBreakdown: DocumentTypeBreakdownEntry[] = [...typeCounts.entries()]
    .map(([type, count]) => ({
      type,
      count,
      percent: totalScans30d > 0 ? (count / totalScans30d) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // ----- Correction rate by field (top 10) -----
  const corrByField = new Map<string, number>()
  for (const c of corrections30d) {
    corrByField.set(c.field_path, (corrByField.get(c.field_path) ?? 0) + 1)
  }
  // Total extractions par champ : approximation V1 = total docs extraits 30j.
  // Plus précis V2 : SELECT key FROM document_extractions, jsonb_each(extraction_data).
  const totalExtracted = successCount > 0 ? successCount : 1
  const correctionRateByField: FieldCorrectionRateEntry[] = [...corrByField.entries()]
    .map(([fieldPath, corr]) => ({
      fieldPath,
      fieldLabel: labelForField(fieldPath),
      corrections: corr,
      total: totalExtracted,
      rate: corr / totalExtracted,
    }))
    .sort((a, b) => b.corrections - a.corrections)
    .slice(0, 10)

  // ----- Top users + cost by user -----
  const docsByUser = new Map<string, number>()
  for (const d of docs30d) {
    docsByUser.set(d.user_id, (docsByUser.get(d.user_id) ?? 0) + 1)
  }
  const costByUserMap = new Map<string, number>()
  for (const r of aiUsage30d) {
    if (!r.user_id) continue
    costByUserMap.set(r.user_id, (costByUserMap.get(r.user_id) ?? 0) + toNumber(r.cost_eur))
  }

  const allUserIds = new Set<string>([...docsByUser.keys(), ...costByUserMap.keys()])
  const profileMap = await fetchProfileMap(supabase, [...allUserIds])

  const orgIds = [...new Set([...profileMap.values()].map((p) => p.default_org_id).filter(Boolean))]
  const orgMap = await fetchOrgNameMap(supabase, orgIds as string[])

  const topUsers: DocumentUserVolumeEntry[] = [...docsByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, volume]) => {
      const p = profileMap.get(userId)
      return {
        userId,
        name: displayName(p),
        orgName: p?.default_org_id ? (orgMap.get(p.default_org_id) ?? '—') : '—',
        volumeMonth: volume,
        costEur: costByUserMap.get(userId) ?? 0,
      }
    })

  const costTotal = [...costByUserMap.values()].reduce((s, v) => s + v, 0)
  const costByUser: DocumentCostByUserEntry[] = [...costByUserMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, cost]) => ({
      userId,
      name: displayName(profileMap.get(userId)),
      costEur: cost,
      percentOfTotal: costTotal > 0 ? (cost / costTotal) * 100 : 0,
    }))

  // ----- Users near quota (>= 80% utilisé) -----
  const nearQuotaUserIds = quotas.map((q) => q.user_id)
  const nearProfileMap = await fetchProfileMap(supabase, nearQuotaUserIds)

  const usersNearQuota: UserNearQuotaEntry[] = quotas
    .map((q): UserNearQuotaEntry | null => {
      const used = toNumber(q.scans_used_this_period)
      const included = toNumber(q.scans_included)
      if (included <= 0) return null
      const pct = (used / included) * 100
      if (pct < 80) return null
      return {
        userId: q.user_id,
        name: displayName(nearProfileMap.get(q.user_id)),
        scansUsed: used,
        scansIncluded: included,
        percentUsed: Math.min(999, Math.round(pct)),
      }
    })
    .filter((v): v is UserNearQuotaEntry => v !== null)
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 20)

  return {
    totalScans30d,
    scanGrowthPct,
    successRate,
    avgConfidence,
    totalCost30d,
    marginPct,
    documentTypeBreakdown,
    correctionRateByField,
    topUsers,
    costByUser,
    usersNearQuota,
  }
}
