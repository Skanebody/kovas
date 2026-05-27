import { applyZipLicielWatermark } from '@/lib/watermark'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
/**
 * Stub ZIP Liciel — V1 génère la structure XML + photos (sans .mdb).
 * Le .mdb réel sera généré par le microservice Java/Jackcess en J11-J12 réel
 * (post-launch). Pour l'instant on permet aux beta-testeurs d'avoir
 * un ZIP "presque-Liciel" avec les XMLs principaux + photos.
 *
 * Cf. docs/liciel-parser-specs.md
 */
import JSZip from 'jszip'
import type { MissionExportData } from './build-mission-data'

export async function buildLicielZip(data: MissionExportData): Promise<Buffer> {
  const zip = new JSZip()

  // Note explicative pour le diagnostiqueur
  zip.file(
    'LISEZ-MOI.txt',
    [
      'ZIP Liciel — version stub KOVAS V1',
      '',
      'Cette archive contient les fichiers XML générés à partir de votre mission KOVAS.',
      "Le fichier LICIEL_Dossiers.mdb (base Access) n'est PAS encore généré en V1 —",
      'la fonctionnalité complète arrive courant 2026 via notre microservice Java.',
      '',
      'En attendant, vous pouvez :',
      '  1. Ouvrir les XMLs dans Liciel via "Importer XML spécifique"',
      "  2. Ou utiliser l'export PDF/Word/CSV (rapport.pdf dans le ZIP universel)",
      '',
      'Référence mission : ' + data.mission.reference,
      'Date export : ' + new Date(data.exportedAt).toLocaleString('fr-FR'),
    ].join('\n'),
  )

  // Generate XML files
  const adminXml = generateAdminXml(data)
  const donneesXml = generateDonneesXml(data)

  zip.file('XML/LIV_administratif.xml', adminXml)
  zip.file('XML/LIV_donnees.xml', donneesXml)

  // Type-specific XML
  if (data.mission.type.startsWith('dpe_')) {
    zip.file('XML/LIV_DPE.xml', generateDpeXml(data))
  }
  if (data.mission.type.startsWith('amiante_')) {
    zip.file('XML/LIV_amiante.xml', generateAmianteXml(data))
  }

  // Photos organized by room
  if (data.photos.length > 0) {
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const roomNumById: Record<string, string> = {}
    let idx = 1
    for (const r of data.rooms) {
      roomNumById[r.id] = String(idx).padStart(3, '0')
      idx++
    }

    for (const p of data.photos) {
      const { data: blob } = await admin.storage.from('mission-photos').download(p.storage_path)
      if (!blob) continue
      const buffer = Buffer.from(await blob.arrayBuffer())
      const ext = p.storage_path.split('.').pop() ?? 'webp'
      const folder = p.room_id
        ? `Photos/PIECE_${roomNumById[p.room_id] ?? '000'}`
        : 'Photos/SANS_PIECE'
      zip.file(`${folder}/photo_${p.id.slice(0, 8)}.${ext}`, buffer)
    }
  }

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function xmlEscape(v: unknown): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function generateAdminXml(data: MissionExportData): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n`
  xml += `  <reference>${xmlEscape(data.mission.reference)}</reference>\n`
  if (data.client) {
    xml += `  <proprietaire>\n`
    xml += `    <nom_prenom>${xmlEscape(data.client.display_name)}</nom_prenom>\n`
    xml += `    <type>${xmlEscape(data.client.type)}</type>\n`
    xml += `    <email>${xmlEscape(data.client.email ?? '')}</email>\n`
    xml += `    <telephone>${xmlEscape(data.client.phone ?? '')}</telephone>\n`
    xml += `    <adresse>${xmlEscape(data.client.address ?? '')}</adresse>\n`
    xml += `  </proprietaire>\n`
  }
  xml += `</document>\n`

  // Apply watermark if trial
  if (data.isTrial) xml = applyZipLicielWatermark(xml)

  return xml
}

function generateDonneesXml(data: MissionExportData): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n`
  if (data.property) {
    xml += `  <bien>\n`
    xml += `    <adresse_complete>${xmlEscape(data.property.address)}</adresse_complete>\n`
    xml += `    <code_postal>${xmlEscape(data.property.postal_code ?? '')}</code_postal>\n`
    xml += `    <ville>${xmlEscape(data.property.city ?? '')}</ville>\n`
    xml += `    <type_batiment>${xmlEscape(data.property.property_type ?? '')}</type_batiment>\n`
    xml += `    <annee_construction>${xmlEscape(data.property.year_built ?? '')}</annee_construction>\n`
    xml += `    <surface_habitable>${xmlEscape(data.property.surface_total ?? '')}</surface_habitable>\n`
    xml += `    <surface_carrez>${xmlEscape(data.property.surface_carrez ?? '')}</surface_carrez>\n`
    xml += `  </bien>\n`
  }
  if (data.rooms.length > 0) {
    xml += `  <pieces>\n`
    let idx = 1
    for (const r of data.rooms) {
      xml += `    <piece id="PIECE_${String(idx).padStart(3, '0')}" nom="${xmlEscape(r.name)}" type="${xmlEscape(r.room_type ?? '')}" surface="${xmlEscape(r.surface_m2 ?? '')}"/>\n`
      idx++
    }
    xml += `  </pieces>\n`
  }
  xml += `</document>\n`
  return xml
}

function generateDpeXml(data: MissionExportData): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n`
  xml += `  <type_mission>${xmlEscape(data.mission.type === 'dpe_location' ? 'location' : 'vente')}</type_mission>\n`
  xml += `  <methode_calcul>3CL-2021</methode_calcul>\n`
  xml += `  <date_visite>${xmlEscape(data.mission.completed_at ?? data.mission.started_at ?? '')}</date_visite>\n`
  // Equipment from voice notes
  const allEquipment = data.voiceNotes.flatMap((v) => v.transcript_structured?.equipment ?? [])
  if (allEquipment.length > 0) {
    xml += `  <equipements>\n`
    for (const eq of allEquipment) {
      xml += `    <equipement kind="${xmlEscape(eq.kind)}" marque="${xmlEscape(eq.brand ?? '')}" modele="${xmlEscape(eq.model ?? '')}" annee="${xmlEscape(eq.year_install ?? '')}"/>\n`
    }
    xml += `  </equipements>\n`
  }
  xml += `</document>\n`
  return xml
}

function generateAmianteXml(data: MissionExportData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n  <reference>${xmlEscape(data.mission.reference)}</reference>\n  <annee_construction>${xmlEscape(data.property?.year_built ?? '')}</annee_construction>\n</document>\n`
}
