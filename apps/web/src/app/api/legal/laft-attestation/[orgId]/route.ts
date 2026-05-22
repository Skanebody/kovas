/**
 * GET /api/legal/laft-attestation/[orgId]
 *
 * Génère et télécharge l'attestation LAFT individuelle au format PDF pour
 * l'organisation `orgId`. Accessible uniquement aux membres de l'organisation
 * (vérification RLS Supabase via `getCurrentUser()`).
 *
 * Cadre légal : art. 286 I 3° bis CGI — l'éditeur (KOVAS) est tenu de fournir
 * une attestation individuelle nominative à chaque client utilisateur du logiciel
 * de facturation. Sanction en cas d'absence : 7 500 € par logiciel non attesté.
 *
 * L'attestation est aussi proposée en HTML via `?format=html` (aperçu in-app).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import {
  type DiagnostiqueurIdentity,
  buildAttestationData,
  renderLaftAttestationHtml,
} from '@/lib/legal/laft-attestation'
import { generateLaftAttestationPdf } from '@/lib/legal/laft-attestation-pdf'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // jsPDF requiert Node (Buffer/ArrayBuffer)

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { supabase, orgId: callerOrgId } = await getCurrentUser()

  // Sécurité : un membre ne peut générer une attestation que pour son organisation.
  if (orgId !== callerOrgId) {
    return NextResponse.json(
      { error: 'Accès refusé — vous n’êtes pas membre de cette organisation.' },
      { status: 403 },
    )
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .select('id, name, siret, address, postal_code, city, certification_n')
    .eq('id', orgId)
    .maybeSingle()

  if (error || !organization) {
    return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 })
  }
  if (!organization.name || organization.name.trim().length === 0) {
    return NextResponse.json(
      {
        error:
          'Raison sociale manquante. Renseignez les informations entreprise dans Mon compte avant de générer l’attestation LAFT.',
      },
      { status: 400 },
    )
  }

  const client: DiagnostiqueurIdentity = {
    legalName: organization.name,
    siren: organization.siret ?? null,
    address: organization.address ?? null,
    postalCode: organization.postal_code ?? null,
    city: organization.city ?? null,
    certificationN: organization.certification_n ?? null,
    orgId: organization.id,
  }

  const data = buildAttestationData(client, { editor: COMPANY_IDENTITY })
  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  if (format === 'html') {
    const html = renderLaftAttestationHtml(data)
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  const pdfBytes = generateLaftAttestationPdf(data)
  const filename = `attestation-laft-${data.attestationNumber}.pdf`
  // Conversion en ArrayBuffer pour satisfaire BodyInit Web Streams API
  const body = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
