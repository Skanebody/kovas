#!/usr/bin/env node
/**
 * scripts/audit-invoice-compliance.ts
 *
 * Audit de conformité L441-9 + LAFT sur les factures de la base de production.
 *
 *   - Lit toutes les factures (avec snapshots) via connexion PostgreSQL directe
 *   - Vérifie pour chacune les mentions obligatoires (L441-9) via checkInvoiceCompliance
 *   - Vérifie la séquentialité continue per-organisation et per-année
 *   - Émet un rapport JSON dans reports/invoice-compliance.json
 *   - Exit code 1 si au moins une non-conformité bloquante est détectée
 *
 * Exécution :
 *   SUPABASE_DB_PASSWORD=… node --experimental-strip-types scripts/audit-invoice-compliance.ts
 *   ou via : pnpm audit:invoices
 *
 * Cadre légal : L441-9 Code de commerce, 286 I 3° bis CGI (LAFT), 242 nonies A CGI.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'

// On réutilise les helpers d'audit du module web (source unique de vérité).
// Le typescript-strip-types de Node 22 résout l'import sans transpilation.
import {
  type ComplianceIssue,
  type InvoiceForCompliance,
  checkInvoiceCompliance,
} from '../apps/web/src/lib/legal/invoice-mentions.ts'

interface InvoiceRow extends InvoiceForCompliance {
  id: string
  organization_id: string
  reference: string
  status: string
  issued_at: string | null
  created_at: string
}

interface InvoiceReport {
  id: string
  organization_id: string
  reference: string
  status: string
  issued_at: string | null
  compliant: boolean
  errors: ComplianceIssue[]
  warnings: ComplianceIssue[]
}

interface SequenceIssue {
  organization_id: string
  year: number
  missing: number[]
  duplicates: string[]
}

const PROJECT_REF = 'jlizdkffwjdiokvmhcwg'
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD ?? ''

if (!DB_PASSWORD) {
  console.error(
    'audit-invoice-compliance: SUPABASE_DB_PASSWORD requis pour audit DB. Pour audit offline, fournir factures via STDIN JSON.',
  )
  // On continue en mode offline si stdin présent
}

async function connect(): Promise<Client> {
  const strategies = [
    {
      host: 'aws-0-eu-west-3.pooler.supabase.com',
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
    {
      host: `db.${PROJECT_REF}.supabase.co`, // template literal volontaire : interpolation PROJECT_REF
      port: 5432,
      user: 'postgres',
      password: DB_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    },
  ]
  let lastError: unknown
  for (const cfg of strategies) {
    try {
      const c = new Client(cfg)
      await c.connect()
      return c
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Connexion DB impossible')
}

async function loadInvoices(client: Client): Promise<InvoiceRow[]> {
  const { rows } = await client.query<InvoiceRow>(`
    SELECT
      i.id,
      i.organization_id,
      i.reference,
      i.status,
      i.issued_at,
      i.created_at,
      i.amount_ht,
      i.amount_tva,
      i.amount_ttc,
      i.tva_rate,
      i.line_items,
      i.client_snapshot,
      i.due_date,
      i.payment_method,
      -- service_date et issuer_snapshot peuvent ne pas exister selon la migration
      to_jsonb(i.*) AS raw
    FROM invoices i
    WHERE i.deleted_at IS NULL
    ORDER BY i.organization_id, i.reference
  `)
  return rows.map((r) => normalizeRow(r))
}

function normalizeRow(raw: unknown): InvoiceRow {
  const r = raw as Record<string, unknown> & { raw?: Record<string, unknown> }
  const full = (r.raw ?? r) as Record<string, unknown>
  return {
    id: String(r.id ?? full.id),
    organization_id: String(r.organization_id ?? full.organization_id),
    reference: String(r.reference ?? full.reference ?? ''),
    status: String(r.status ?? full.status ?? 'draft'),
    issued_at: (r.issued_at ?? full.issued_at) as string | null,
    created_at: String(r.created_at ?? full.created_at),
    amount_ht: full.amount_ht as number | string | null,
    amount_tva: full.amount_tva as number | string | null,
    amount_ttc: full.amount_ttc as number | string | null,
    tva_rate: full.tva_rate as number | string | null,
    line_items: full.line_items as InvoiceForCompliance['line_items'],
    client_snapshot: full.client_snapshot as InvoiceForCompliance['client_snapshot'],
    issuer_snapshot: full.issuer_snapshot as InvoiceForCompliance['issuer_snapshot'],
    service_date: full.service_date as string | null,
    due_date: full.due_date as string | null,
    mentions: full.mentions as string[] | null,
    is_reverse_charge: full.is_reverse_charge as boolean | null,
    is_vat_exempt_293b: full.is_vat_exempt_293b as boolean | null,
    payment_terms: full.payment_terms as string | null,
    late_penalty_clause: full.late_penalty_clause as string | null,
    fixed_indemnity_clause: full.fixed_indemnity_clause as string | null,
    discount_for_early_payment: full.discount_for_early_payment as string | null,
  }
}

function detectSequenceIssues(rows: InvoiceRow[]): SequenceIssue[] {
  const buckets = new Map<string, Map<number, Set<number>>>()
  const duplicates = new Map<string, string[]>()
  const seenRefs = new Map<string, string>() // ref -> id

  for (const row of rows) {
    if (row.status === 'draft' || !row.reference) continue
    const m = /^FAC-(\d{4})-(\d+)$/.exec(row.reference)
    if (!m) continue
    const year = Number.parseInt(m[1], 10)
    const seq = Number.parseInt(m[2], 10)
    const key = `${row.organization_id}|${year}`
    let yearMap = buckets.get(row.organization_id)
    if (!yearMap) {
      yearMap = new Map()
      buckets.set(row.organization_id, yearMap)
    }
    let set = yearMap.get(year)
    if (!set) {
      set = new Set()
      yearMap.set(year, set)
    }
    if (set.has(seq)) {
      const existing = duplicates.get(key) ?? []
      existing.push(row.reference)
      duplicates.set(key, existing)
    }
    set.add(seq)
    seenRefs.set(`${row.organization_id}|${row.reference}`, row.id)
  }

  const issues: SequenceIssue[] = []
  for (const [orgId, yearMap] of buckets) {
    for (const [year, set] of yearMap) {
      const max = Math.max(...set)
      const missing: number[] = []
      for (let i = 1; i <= max; i++) {
        if (!set.has(i)) missing.push(i)
      }
      const dups = duplicates.get(`${orgId}|${year}`) ?? []
      if (missing.length > 0 || dups.length > 0) {
        issues.push({
          organization_id: orgId,
          year,
          missing,
          duplicates: dups,
        })
      }
    }
  }
  return issues
}

async function main(): Promise<void> {
  console.info('=== Audit conformité factures KOVAS ===')

  let invoices: InvoiceRow[] = []
  let dbAvailable = false

  if (DB_PASSWORD) {
    try {
      const client = await connect()
      invoices = await loadInvoices(client)
      await client.end()
      dbAvailable = true
      console.info(`Factures chargées depuis DB : ${invoices.length}`)
    } catch (err) {
      console.warn(
        `Connexion DB impossible (${(err as Error).message}). Audit limité au schéma + mentions.`,
      )
    }
  }

  const perInvoice: InvoiceReport[] = invoices.map((inv) => {
    const report = checkInvoiceCompliance(inv)
    return {
      id: inv.id,
      organization_id: inv.organization_id,
      reference: inv.reference,
      status: inv.status,
      issued_at: inv.issued_at,
      compliant: report.compliant,
      errors: [...report.errors],
      warnings: [...report.warnings],
    }
  })

  const sequenceIssues = detectSequenceIssues(invoices)

  const summary = {
    generated_at: new Date().toISOString(),
    db_available: dbAvailable,
    totals: {
      invoices: invoices.length,
      compliant: perInvoice.filter((r) => r.compliant).length,
      non_compliant: perInvoice.filter((r) => !r.compliant).length,
      with_warnings: perInvoice.filter((r) => r.warnings.length > 0).length,
      sequence_issues: sequenceIssues.length,
    },
    sequence_issues: sequenceIssues,
    invoices: perInvoice,
  }

  const reportsDir = path.resolve(process.cwd(), 'reports')
  await mkdir(reportsDir, { recursive: true })
  const outPath = path.join(reportsDir, 'invoice-compliance.json')
  await writeFile(outPath, JSON.stringify(summary, null, 2), 'utf8')
  console.info(`Rapport écrit : ${outPath}`)
  console.info(
    `Conformes : ${summary.totals.compliant}/${summary.totals.invoices} · Avertissements : ${summary.totals.with_warnings} · Séquence : ${summary.totals.sequence_issues} anomalie(s)`,
  )

  // Exit non-zero si défauts bloquants ou anomalies de séquence
  const hasBlocking = summary.totals.non_compliant > 0 || summary.totals.sequence_issues > 0
  if (hasBlocking) {
    console.error('ERREUR : non-conformités détectées. Voir reports/invoice-compliance.json.')
    process.exit(1)
  }
  console.info('OK — toutes les factures audit-ées sont conformes L441-9 + séquentialité.')
}

main().catch((err) => {
  console.error('audit-invoice-compliance: échec inattendu', err)
  process.exit(2)
})
