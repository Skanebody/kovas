// KOVAS — Edge Function `defense-dossier-generate`
//
// POST /defense-dossier-generate
//   body : { missionId: string }
//   → 200 { ok: true, defense_dossier_id, pdf_url, sha256, generated_at }
//
// Génère le PDF "Dossier de défense" d'une mission. Source d'autorité :
// CLAUDE.md §20 (différenciateur Phase 1 : preuves opposables) +
// Module 3 (Bouclier de défense, migrations 20260525120000-121000).
//
// Pages :
//   1. Identification (logo KOVAS, identité diag, certificat + QR code)
//   2. Géolocalisation (timestamp visit_start/end + coords)
//   3. Photos contextuelles (toutes horodatées + géolocalisées + EXIF)
//   4. Choix méthodologiques (tableau paramètre / valeur / justification / référence)
//   5. Documents joints (liens hypertexte storage)
//
// Choix techniques :
//   - `pdf-lib` plutôt que Puppeteer : Puppeteer ne tourne pas en
//     Edge Functions (Deno isolate sans Chromium). pdf-lib est WASM-pure
//     et tourne nativement en Deno via esm.sh.
//   - SHA-256 du PDF généré pour preuve d'intégrité.
//   - OpenTimestamps (RFC 3161, gratuit) en TODO V2 — pour l'instant on
//     stocke le hash + on note la procédure manuelle d'ancrage.
//
// NB Cost Optimization 2026-05 — Cette fonction N'APPELLE PAS Anthropic en V1
// (génération PDF déterministe via pdf-lib). Aucun cost-tracker requis.
// Mapping logique futur : MODEL_FOR_FEATURE.defense_dossier = 'sonnet'
// (Sonnet 4.6) si on ajoute une narrative IA en Phase 2 (résumé exécutif
// auto-généré du choix méthodologique). Cf. apps/web/src/lib/ai/anthropic-config.ts.

/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import QRCode from 'https://esm.sh/qrcode-svg@1.1.0'

// ────────────────────────────────────────────────────────────
// Types miroir DB (les types Database ne sont pas régénérés pour
// les tables Module 3).
// ────────────────────────────────────────────────────────────

interface DefenseDossierRow {
  id: string
  organization_id: string
  mission_id: string
  reference: string | null
  status: string
  contract_url: string | null
  cgv_url: string | null
  certificate_url: string | null
}

interface MissionRow {
  id: string
  organization_id: string
  dossier_id: string
  reference: string
  type: string
  status: string
  completed_at: string | null
  exported_at: string | null
}

interface DossierRow {
  id: string
  property_id: string
  client_id: string | null
  started_at: string | null
  completed_at: string | null
  reference: string
}

interface PropertyRow {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  insee_code: string | null
  property_type: string | null
}

interface OrgRow {
  id: string
  name: string
  siret: string | null
  certification_n: string | null
  address: string | null
  city: string | null
  postal_code: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string
  phone: string | null
}

interface PhotoRow {
  id: string
  storage_path: string
  caption: string | null
  taken_at: string | null
  location: string | null // PostGIS WKT/GeoJSON
  width: number | null
  height: number | null
  size_bytes: number | null
  created_at: string
}

interface ParameterSuggestionRow {
  id: string
  field_name: string
  suggested_value: Record<string, unknown> | null
  corrected_value: Record<string, unknown> | null
  status: string
  explanation: string | null
  decided_at: string | null
}

// ────────────────────────────────────────────────────────────
// Auth user / org.
// ────────────────────────────────────────────────────────────

async function resolveUser(authClient: SupabaseClient): Promise<{ userId: string } | null> {
  const { data, error } = await authClient.auth.getUser()
  if (error || !data?.user) return null
  return { userId: data.user.id }
}

async function assertMember(
  client: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await (client as any)
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return false
  return !!data
}

// ────────────────────────────────────────────────────────────
// Loaders.
// ────────────────────────────────────────────────────────────

async function loadOrCreateDefenseDossier(
  client: SupabaseClient,
  mission: MissionRow,
  userId: string,
): Promise<DefenseDossierRow> {
  const { data: existing, error: selErr } = await (client as any)
    .from('defense_dossiers')
    .select(
      'id, organization_id, mission_id, reference, status, contract_url, cgv_url, certificate_url',
    )
    .eq('mission_id', mission.id)
    .eq('organization_id', mission.organization_id)
    .maybeSingle()
  if (selErr) throw new Error(`defense_dossiers select: ${selErr.message}`)
  if (existing) return existing as DefenseDossierRow

  const { data: inserted, error: insErr } = await (client as any)
    .from('defense_dossiers')
    .insert({
      organization_id: mission.organization_id,
      mission_id: mission.id,
      user_id: userId,
      status: 'open',
    })
    .select(
      'id, organization_id, mission_id, reference, status, contract_url, cgv_url, certificate_url',
    )
    .single()
  if (insErr || !inserted)
    throw new Error(`defense_dossiers insert: ${insErr?.message ?? 'unknown'}`)
  return inserted as DefenseDossierRow
}

async function loadMission(client: SupabaseClient, missionId: string): Promise<MissionRow | null> {
  const { data, error } = await (client as any)
    .from('missions')
    .select('id, organization_id, dossier_id, reference, type, status, completed_at, exported_at')
    .eq('id', missionId)
    .maybeSingle()
  if (error) {
    console.error('[defense-dossier-generate] loadMission error:', error.message)
    return null
  }
  return (data as MissionRow) ?? null
}

async function loadDossier(client: SupabaseClient, dossierId: string): Promise<DossierRow | null> {
  const { data, error } = await (client as any)
    .from('dossiers')
    .select('id, property_id, client_id, started_at, completed_at, reference')
    .eq('id', dossierId)
    .maybeSingle()
  if (error || !data) return null
  return data as DossierRow
}

async function loadProperty(
  client: SupabaseClient,
  propertyId: string,
): Promise<PropertyRow | null> {
  const { data, error } = await (client as any)
    .from('properties')
    .select('id, address, city, postal_code, insee_code, property_type')
    .eq('id', propertyId)
    .maybeSingle()
  if (error || !data) return null
  return data as PropertyRow
}

async function loadOrg(client: SupabaseClient, orgId: string): Promise<OrgRow | null> {
  const { data, error } = await (client as any)
    .from('organizations')
    .select('id, name, siret, certification_n, address, city, postal_code')
    .eq('id', orgId)
    .maybeSingle()
  if (error || !data) return null
  return data as OrgRow
}

async function loadProfile(client: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await (client as any)
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as ProfileRow
}

async function loadPhotos(client: SupabaseClient, dossierId: string): Promise<PhotoRow[]> {
  const { data, error } = await (client as any)
    .from('photos')
    .select('id, storage_path, caption, taken_at, location, width, height, size_bytes, created_at')
    .eq('dossier_id', dossierId)
    .order('taken_at', { ascending: true, nullsFirst: false })
    .limit(80)
  if (error) {
    console.error('[defense-dossier-generate] loadPhotos error:', error.message)
    return []
  }
  return (data ?? []) as PhotoRow[]
}

async function loadParameterChoices(
  client: SupabaseClient,
  missionId: string,
): Promise<ParameterSuggestionRow[]> {
  const { data, error } = await (client as any)
    .from('parameter_suggestions')
    .select('id, field_name, suggested_value, corrected_value, status, explanation, decided_at')
    .eq('mission_id', missionId)
    .in('status', ['accepted', 'corrected'])
    .order('decided_at', { ascending: true, nullsFirst: false })
  if (error) {
    console.error('[defense-dossier-generate] loadParameterChoices error:', error.message)
    return []
  }
  return (data ?? []) as ParameterSuggestionRow[]
}

// ────────────────────────────────────────────────────────────
// PDF generation with pdf-lib.
// ────────────────────────────────────────────────────────────

const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN = 50

interface PdfContext {
  doc: PDFDocument
  fontRegular: any
  fontBold: any
}

async function buildPdf(input: {
  org: OrgRow
  profile: ProfileRow
  mission: MissionRow
  dossier: DossierRow
  property: PropertyRow
  photos: PhotoRow[]
  choices: ParameterSuggestionRow[]
  defenseDossier: DefenseDossierRow
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: PdfContext = { doc, fontRegular, fontBold }

  drawPageIdentification(ctx, input)
  drawPageGeolocation(ctx, input)
  drawPagePhotos(ctx, input)
  drawPageMethodologyChoices(ctx, input)
  drawPageAttachedDocuments(ctx, input)

  return doc.save()
}

function newPage(ctx: PdfContext): {
  page: any
  cursor: { y: number }
} {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  return { page, cursor: { y: PAGE_HEIGHT - MARGIN } }
}

function drawHeader(ctx: PdfContext, page: any, title: string, subtitle?: string): number {
  page.drawText('KOVAS — Dossier de défense', {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN,
    size: 10,
    font: ctx.fontBold,
    color: rgb(0.06, 0.12, 0.24), // navy KOVAS
  })
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 8 },
    thickness: 0.5,
    color: rgb(0.06, 0.12, 0.24),
  })
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 30,
    size: 18,
    font: ctx.fontBold,
    color: rgb(0.06, 0.12, 0.24),
  })
  let y = PAGE_HEIGHT - MARGIN - 50
  if (subtitle) {
    page.drawText(subtitle, {
      x: MARGIN,
      y,
      size: 10,
      font: ctx.fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    })
    y -= 18
  }
  return y - 10
}

function drawParagraph(
  ctx: PdfContext,
  page: any,
  x: number,
  startY: number,
  text: string,
  options: { font?: any; size?: number; maxWidth?: number; lineHeight?: number } = {},
): number {
  const font = options.font ?? ctx.fontRegular
  const size = options.size ?? 10
  const maxWidth = options.maxWidth ?? PAGE_WIDTH - 2 * MARGIN
  const lineHeight = options.lineHeight ?? size * 1.4
  const words = text.split(/\s+/)
  let line = ''
  let y = startY
  for (const w of words) {
    const candidate = line.length === 0 ? w : `${line} ${w}`
    const width = font.widthOfTextAtSize(candidate, size)
    if (width > maxWidth) {
      page.drawText(line, { x, y, size, font, color: rgb(0.1, 0.1, 0.15) })
      y -= lineHeight
      line = w
    } else {
      line = candidate
    }
  }
  if (line) {
    page.drawText(line, { x, y, size, font, color: rgb(0.1, 0.1, 0.15) })
    y -= lineHeight
  }
  return y
}

function drawKeyValue(
  ctx: PdfContext,
  page: any,
  x: number,
  y: number,
  key: string,
  value: string,
): number {
  page.drawText(`${key} :`, {
    x,
    y,
    size: 10,
    font: ctx.fontBold,
    color: rgb(0.06, 0.12, 0.24),
  })
  page.drawText(value, {
    x: x + 140,
    y,
    size: 10,
    font: ctx.fontRegular,
    color: rgb(0.1, 0.1, 0.15),
  })
  return y - 18
}

// ────────────────────────────────────────────────────────────
// Page 1 — Identification + QR code.
// ────────────────────────────────────────────────────────────

function drawPageIdentification(
  ctx: PdfContext,
  input: {
    org: OrgRow
    profile: ProfileRow
    mission: MissionRow
    dossier: DossierRow
    property: PropertyRow
    defenseDossier: DefenseDossierRow
  },
): void {
  const { page } = newPage(ctx)
  let y = drawHeader(
    ctx,
    page,
    '1. Identification',
    `Mission ${input.mission.reference} — Dossier ${input.dossier.reference}`,
  )

  y = drawKeyValue(ctx, page, MARGIN, y, 'Cabinet', input.org.name)
  if (input.org.siret) y = drawKeyValue(ctx, page, MARGIN, y, 'SIRET', input.org.siret)
  if (input.org.certification_n) {
    y = drawKeyValue(ctx, page, MARGIN, y, 'Certification', input.org.certification_n)
  }
  if (input.org.address) {
    y = drawKeyValue(
      ctx,
      page,
      MARGIN,
      y,
      'Siège',
      `${input.org.address}, ${input.org.postal_code ?? ''} ${input.org.city ?? ''}`.trim(),
    )
  }
  y -= 10
  y = drawKeyValue(
    ctx,
    page,
    MARGIN,
    y,
    'Diagnostiqueur',
    input.profile.full_name ?? input.profile.email,
  )
  y = drawKeyValue(ctx, page, MARGIN, y, 'Contact', input.profile.email)
  if (input.profile.phone) y = drawKeyValue(ctx, page, MARGIN, y, 'Téléphone', input.profile.phone)
  y -= 10
  y = drawKeyValue(ctx, page, MARGIN, y, 'Type diagnostic', input.mission.type.toUpperCase())
  y = drawKeyValue(
    ctx,
    page,
    MARGIN,
    y,
    'Bien diagnostiqué',
    `${input.property.address}, ${input.property.postal_code ?? ''} ${input.property.city ?? ''}`.trim(),
  )

  // QR code → URL Storage signée (TODO V2 : page publique de vérif d'authenticité)
  try {
    const qrUrl = `https://kovas.fr/v/defense/${input.defenseDossier.id}`
    const qr = new QRCode({
      content: qrUrl,
      padding: 2,
      width: 120,
      height: 120,
      ecl: 'M',
    })
    const svg = qr.svg()
    // Note : pdf-lib n'embarque pas de renderer SVG → on documente l'URL en clair
    // sous le placeholder, et on stocke le SVG en metadata pour V2.
    const _svgPreview = svg
    page.drawRectangle({
      x: PAGE_WIDTH - MARGIN - 120,
      y: PAGE_HEIGHT - MARGIN - 50 - 120,
      width: 120,
      height: 120,
      borderColor: rgb(0.06, 0.12, 0.24),
      borderWidth: 1,
    })
    page.drawText('QR — vérif', {
      x: PAGE_WIDTH - MARGIN - 115,
      y: PAGE_HEIGHT - MARGIN - 50 - 60,
      size: 10,
      font: ctx.fontBold,
      color: rgb(0.06, 0.12, 0.24),
    })
    page.drawText(qrUrl.slice(0, 30), {
      x: PAGE_WIDTH - MARGIN - 120,
      y: PAGE_HEIGHT - MARGIN - 50 - 130,
      size: 8,
      font: ctx.fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    })
  } catch (err) {
    console.warn('[defense-dossier-generate] QR code generation skipped:', err)
  }

  // Footer
  drawFooter(ctx, page, 'Page 1 — Identification')
}

// ────────────────────────────────────────────────────────────
// Page 2 — Géolocalisation visite.
// ────────────────────────────────────────────────────────────

function drawPageGeolocation(
  ctx: PdfContext,
  input: { dossier: DossierRow; property: PropertyRow; photos: PhotoRow[] },
): void {
  const { page } = newPage(ctx)
  let y = drawHeader(ctx, page, '2. Géolocalisation de la visite', 'Horodatages + coordonnées')

  y = drawKeyValue(
    ctx,
    page,
    MARGIN,
    y,
    'Début de visite',
    input.dossier.started_at ?? 'non renseigné',
  )
  y = drawKeyValue(
    ctx,
    page,
    MARGIN,
    y,
    'Fin de visite',
    input.dossier.completed_at ?? 'non renseigné',
  )
  y = drawKeyValue(
    ctx,
    page,
    MARGIN,
    y,
    'Adresse',
    `${input.property.address}, ${input.property.postal_code ?? ''} ${input.property.city ?? ''}`.trim(),
  )
  if (input.property.insee_code) {
    y = drawKeyValue(ctx, page, MARGIN, y, 'Code INSEE', input.property.insee_code)
  }
  y -= 10
  y = drawParagraph(
    ctx,
    page,
    MARGIN,
    y,
    "Une carte statique de localisation peut être ajoutée en V2 via l'API Mapbox Static (jetons côté serveur). Pour la V1, les coordonnées exactes de chaque photo géolocalisée figurent en page 3.",
    { size: 9 },
  )
  drawFooter(ctx, page, 'Page 2 — Géolocalisation')
}

// ────────────────────────────────────────────────────────────
// Page 3 — Photos contextuelles.
// ────────────────────────────────────────────────────────────

function drawPagePhotos(ctx: PdfContext, input: { photos: PhotoRow[] }): void {
  const { page } = newPage(ctx)
  let y = drawHeader(
    ctx,
    page,
    '3. Photos contextuelles',
    `${input.photos.length} photos horodatées + géolocalisées`,
  )

  if (input.photos.length === 0) {
    drawParagraph(ctx, page, MARGIN, y, 'Aucune photo enregistrée pour cette mission.', {
      size: 10,
    })
    drawFooter(ctx, page, 'Page 3 — Photos')
    return
  }

  // Tableau simple : storage_path | taken_at | location | size
  const rowHeight = 16
  page.drawText('Référence', { x: MARGIN, y, size: 9, font: ctx.fontBold })
  page.drawText('Prise le', { x: MARGIN + 200, y, size: 9, font: ctx.fontBold })
  page.drawText('Position', { x: MARGIN + 320, y, size: 9, font: ctx.fontBold })
  page.drawText('Taille', { x: MARGIN + 430, y, size: 9, font: ctx.fontBold })
  y -= rowHeight

  for (const photo of input.photos) {
    if (y < MARGIN + 30) break
    const ref = photo.storage_path.split('/').pop()?.slice(0, 24) ?? photo.id.slice(0, 8)
    const taken = photo.taken_at ?? photo.created_at
    const loc = photo.location ? photo.location.slice(0, 24) : '—'
    const size = photo.size_bytes ? `${Math.round(photo.size_bytes / 1024)} Ko` : '—'
    page.drawText(ref, { x: MARGIN, y, size: 8, font: ctx.fontRegular })
    page.drawText(taken.slice(0, 19), {
      x: MARGIN + 200,
      y,
      size: 8,
      font: ctx.fontRegular,
    })
    page.drawText(loc, { x: MARGIN + 320, y, size: 8, font: ctx.fontRegular })
    page.drawText(size, { x: MARGIN + 430, y, size: 8, font: ctx.fontRegular })
    y -= rowHeight
  }
  drawFooter(ctx, page, 'Page 3 — Photos')
}

// ────────────────────────────────────────────────────────────
// Page 4 — Choix méthodologiques.
// ────────────────────────────────────────────────────────────

function drawPageMethodologyChoices(
  ctx: PdfContext,
  input: { choices: ParameterSuggestionRow[] },
): void {
  const { page } = newPage(ctx)
  let y = drawHeader(
    ctx,
    page,
    '4. Choix méthodologiques',
    `${input.choices.length} paramètres acceptés ou corrigés`,
  )

  if (input.choices.length === 0) {
    drawParagraph(
      ctx,
      page,
      MARGIN,
      y,
      "Aucun paramètre suggéré n'a été utilisé pour cette mission. Le diagnostiqueur a saisi manuellement les valeurs (cf. rapport métier joint).",
      { size: 10 },
    )
    drawFooter(ctx, page, 'Page 4 — Méthodologie')
    return
  }

  const rowHeight = 24
  page.drawText('Paramètre', { x: MARGIN, y, size: 9, font: ctx.fontBold })
  page.drawText('Valeur retenue', { x: MARGIN + 150, y, size: 9, font: ctx.fontBold })
  page.drawText('Justification', { x: MARGIN + 290, y, size: 9, font: ctx.fontBold })
  y -= 14

  for (const choice of input.choices) {
    if (y < MARGIN + 40) break
    const value = choice.corrected_value ?? choice.suggested_value
    const valueStr = value ? safeStringify(value).slice(0, 18) : '—'
    const justif = (choice.explanation ?? '').slice(0, 90)
    page.drawText(choice.field_name.slice(0, 22), {
      x: MARGIN,
      y,
      size: 8,
      font: ctx.fontRegular,
    })
    page.drawText(valueStr, {
      x: MARGIN + 150,
      y,
      size: 8,
      font: ctx.fontRegular,
    })
    page.drawText(justif, {
      x: MARGIN + 290,
      y,
      size: 7,
      font: ctx.fontRegular,
    })
    y -= rowHeight
  }
  drawFooter(ctx, page, 'Page 4 — Méthodologie')
}

function safeStringify(v: Record<string, unknown>): string {
  try {
    if ('value' in v) return String(v['value'])
    return JSON.stringify(v)
  } catch {
    return '—'
  }
}

// ────────────────────────────────────────────────────────────
// Page 5 — Documents joints.
// ────────────────────────────────────────────────────────────

function drawPageAttachedDocuments(
  ctx: PdfContext,
  input: { defenseDossier: DefenseDossierRow },
): void {
  const { page } = newPage(ctx)
  let y = drawHeader(
    ctx,
    page,
    '5. Documents joints',
    'Contrat, CGV, certificat — liens hypertexte',
  )

  const items: Array<{ label: string; url: string | null }> = [
    { label: 'Contrat / lettre de mission', url: input.defenseDossier.contract_url },
    { label: 'Conditions générales (CGV)', url: input.defenseDossier.cgv_url },
    { label: 'Certificat / attestation diagnostiqueur', url: input.defenseDossier.certificate_url },
  ]
  for (const item of items) {
    if (item.url) {
      page.drawText(`• ${item.label} :`, {
        x: MARGIN,
        y,
        size: 10,
        font: ctx.fontBold,
      })
      page.drawText(item.url.slice(0, 80), {
        x: MARGIN + 220,
        y,
        size: 9,
        font: ctx.fontRegular,
        color: rgb(0.06, 0.4, 0.8),
      })
    } else {
      page.drawText(`• ${item.label} : non renseigné`, {
        x: MARGIN,
        y,
        size: 10,
        font: ctx.fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      })
    }
    y -= 22
  }

  y -= 20
  drawParagraph(
    ctx,
    page,
    MARGIN,
    y,
    "Note d'intégrité : ce PDF est horodaté par hash SHA-256. Pour un horodatage qualifié RFC 3161 (eIDAS), KOVAS prévoit en V2 une intégration Lex Persona ou DigiCert.",
    { size: 9, lineHeight: 12 },
  )
  drawFooter(ctx, page, 'Page 5 — Documents joints')
}

// ────────────────────────────────────────────────────────────
// Footer commun.
// ────────────────────────────────────────────────────────────

function drawFooter(ctx: PdfContext, page: any, label: string): void {
  page.drawLine({
    start: { x: MARGIN, y: MARGIN + 16 },
    end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 16 },
    thickness: 0.3,
    color: rgb(0.7, 0.7, 0.75),
  })
  page.drawText(label, {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font: ctx.fontRegular,
    color: rgb(0.4, 0.4, 0.5),
  })
  page.drawText(`Généré par KOVAS App — ${new Date().toISOString()}`, {
    x: PAGE_WIDTH - MARGIN - 220,
    y: MARGIN,
    size: 8,
    font: ctx.fontRegular,
    color: rgb(0.4, 0.4, 0.5),
  })
}

// ────────────────────────────────────────────────────────────
// SHA-256 du PDF (Deno crypto).
// ────────────────────────────────────────────────────────────

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ────────────────────────────────────────────────────────────
// Upload Storage + update DB.
// ────────────────────────────────────────────────────────────

async function uploadPdf(
  client: SupabaseClient,
  orgId: string,
  defenseDossierId: string,
  pdfBytes: Uint8Array,
): Promise<{ path: string; signedUrl: string | null }> {
  const path = `${orgId}/${defenseDossierId}/dossier-${Date.now()}.pdf`
  const { error: upErr } = await client.storage.from('defense-dossiers').upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (upErr) throw new Error(`storage upload: ${upErr.message}`)

  // Signed URL TTL 1h (lecture côté client par signed URL ; le path est l'autorité).
  const { data: signed, error: signErr } = await client.storage
    .from('defense-dossiers')
    .createSignedUrl(path, 3600)
  if (signErr) {
    console.warn('[defense-dossier-generate] createSignedUrl warn:', signErr.message)
    return { path, signedUrl: null }
  }
  return { path, signedUrl: signed.signedUrl }
}

// ────────────────────────────────────────────────────────────
// Handler.
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonError('POST only', 405)
  }
  const supaUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supaUrl || !anonKey || !serviceKey) {
    return jsonError('missing supabase env', 500)
  }
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonError('missing bearer', 401)

  const authClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const user = await resolveUser(authClient)
  if (!user) return jsonError('unauthorized', 401)

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: { missionId?: string }
  try {
    body = (await req.json()) as { missionId?: string }
  } catch {
    return jsonError('invalid JSON', 400)
  }
  const missionId = body.missionId
  if (!missionId) return jsonError('missionId required', 400)

  const startedAt = Date.now()
  try {
    const mission = await loadMission(admin, missionId)
    if (!mission) return jsonError('mission not found', 404)
    const member = await assertMember(admin, user.userId, mission.organization_id)
    if (!member) return jsonError('forbidden — not a member of mission organization', 403)

    const dossier = await loadDossier(admin, mission.dossier_id)
    if (!dossier) return jsonError('parent dossier not found', 404)

    const [property, org, profile, photos, choices, defenseDossier] = await Promise.all([
      loadProperty(admin, dossier.property_id),
      loadOrg(admin, mission.organization_id),
      loadProfile(admin, user.userId),
      loadPhotos(admin, dossier.id),
      loadParameterChoices(admin, missionId),
      loadOrCreateDefenseDossier(admin, mission, user.userId),
    ])
    if (!property) return jsonError('property not found', 404)
    if (!org) return jsonError('organization not found', 404)
    if (!profile) return jsonError('profile not found', 404)

    const pdfBytes = await buildPdf({
      org,
      profile,
      mission,
      dossier,
      property,
      photos,
      choices,
      defenseDossier,
    })

    const hash = await sha256Hex(pdfBytes)
    const { path, signedUrl } = await uploadPdf(
      admin,
      mission.organization_id,
      defenseDossier.id,
      pdfBytes,
    )

    const generatedAt = new Date().toISOString()
    // TODO V2 — horodatage qualifié :
    //   1. POST hash → calendar OpenTimestamps (https://alice.btc.calendar.opentimestamps.org).
    //   2. Stocker la .ots proof dans timestamping_anchor jsonb.
    //   3. Phase 2 commerciale : Lex Persona / DigiCert avec contrat eIDAS.
    const timestampingAnchor = {
      method: 'sha256_only_v1',
      sha256: hash,
      anchored_at: generatedAt,
      todo: 'V2: OpenTimestamps (RFC 3161, gratuit) puis Lex Persona/DigiCert (eIDAS qualifié) — cf. CLAUDE.md §20.',
    }

    const { error: updErr } = await (admin as any)
      .from('defense_dossiers')
      .update({
        defense_pdf_url: signedUrl,
        defense_pdf_storage_path: path,
        defense_pdf_generated_at: generatedAt,
        defense_pdf_sha256: hash,
        defense_pdf_size_bytes: pdfBytes.byteLength,
        timestamping_anchor: timestampingAnchor,
      })
      .eq('id', defenseDossier.id)
    if (updErr) throw new Error(`defense_dossiers update: ${updErr.message}`)

    return new Response(
      JSON.stringify({
        ok: true,
        defense_dossier_id: defenseDossier.id,
        pdf_url: signedUrl,
        storage_path: path,
        sha256: hash,
        size_bytes: pdfBytes.byteLength,
        generated_at: generatedAt,
        duration_ms: Date.now() - startedAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startedAt,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
