/**
 * KOVAS — POST /api/utilities/check-validity
 *
 * Calcule la validité d'un diagnostic existant en fonction de sa date,
 * son type, son résultat éventuel et le contexte transaction.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { DIAGNOSTIC_TYPES, type DiagnosticType } from '@/lib/mission/types'
import { trackUtilityUsage } from '@/lib/utilities/usage-tracker'
import {
  type DiagnosticResult,
  type TransactionContext,
  type ValidityCheckInput,
  type ValidityResult,
  checkValidity,
} from '@/lib/utilities/validity-checker'

export const runtime = 'nodejs'

interface ErrorBody {
  error: string
}

const RESULT_VALUES: readonly DiagnosticResult[] = ['negative', 'positive', 'unknown']
const TX_VALUES: readonly TransactionContext[] = ['sale', 'rental', 'unknown']

function parseInput(body: unknown): ValidityCheckInput | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object'
  const b = body as Record<string, unknown>

  const diagnosticType = b.diagnosticType
  if (
    typeof diagnosticType !== 'string' ||
    !DIAGNOSTIC_TYPES.includes(diagnosticType as DiagnosticType)
  ) {
    return `diagnosticType must be one of ${DIAGNOSTIC_TYPES.join('|')}`
  }

  const performedAt = b.performedAt
  if (typeof performedAt !== 'string' || Number.isNaN(Date.parse(performedAt))) {
    return 'performedAt: ISO date string required'
  }

  let result: DiagnosticResult | undefined
  if (typeof b.result === 'string') {
    if (!RESULT_VALUES.includes(b.result as DiagnosticResult)) {
      return `result must be one of ${RESULT_VALUES.join('|')}`
    }
    result = b.result as DiagnosticResult
  }

  let transaction: TransactionContext | undefined
  if (typeof b.transaction === 'string') {
    if (!TX_VALUES.includes(b.transaction as TransactionContext)) {
      return `transaction must be one of ${TX_VALUES.join('|')}`
    }
    transaction = b.transaction as TransactionContext
  }

  return {
    diagnosticType: diagnosticType as DiagnosticType,
    performedAt,
    result,
    transaction,
  }
}

interface SerializableValidity {
  status: ValidityResult['status']
  expiresAt: string | null
  daysRemaining: number | null
  message: string
  referenceRule: string
  recommendation: string
}

function toJSON(v: ValidityResult): SerializableValidity {
  return {
    status: v.status,
    expiresAt: v.expiresAt ? v.expiresAt.toISOString() : null,
    daysRemaining: v.daysRemaining,
    message: v.message,
    referenceRule: v.referenceRule,
    recommendation: v.recommendation,
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<SerializableValidity | ErrorBody>> {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = parseInput(bodyJson)
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 })
  }

  let result: ValidityResult
  try {
    result = checkValidity(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'validity check failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  trackUtilityUsage({
    supabase: user.supabase,
    userId: user.user.id,
    organizationId: user.orgId,
    utility: 'validity_checker',
    context: {
      diagnosticType: parsed.diagnosticType,
      status: result.status,
    },
  })

  return NextResponse.json(toJSON(result))
}
