/**
 * Export ZIP Liciel — point d'entrée public `buildLicielZip`.
 *
 * Assemble la structure ZIP cible de docs/liciel-parser-specs.md §1 :
 *   XML/LIV_donnees.xml         — données principales
 *   XML/LIV_administratif.xml   — propriétaire / donneur d'ordre
 *   XML/LIV_DPE.xml             — si mission DPE
 *   XML/LIV_<diag>.xml          — pour le diagnostic réellement présent
 *   Photos/PIECE_xxx/photo_yyy  — photos rangées par pièce
 *   Annexes/                    — documents propriétaire
 *   LISEZ-MOI.txt               — import + statut .mdb
 *
 * Le .mdb (LICIEL_Dossiers.mdb) N'est PAS généré ici : c'est le rôle du
 * microservice Java/Jackcess (cf. lib/liciel/mdb-writer-client.ts). À l'import
 * « Importer XML spécifique », Liciel régénère sa base depuis ces XML.
 */

import type { MissionExportData } from '@/lib/exports/build-mission-data'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { diagnosticFileForMissionType } from './derived'
import { buildLivAdministratif } from './liv-administratif'
import { buildLivDiagnosticGeneric } from './liv-diagnostic-generic'
import { buildLivDonnees } from './liv-donnees'
import { buildLivDpe } from './liv-dpe'

/** Libellé lisible du diagnostic pour les fichiers LIV_<diag> non-DPE. */
const DIAGNOSTIC_LABELS: Record<string, string> = {
  amiante_vente: 'Amiante',
  amiante_avant_travaux: 'Amiante avant travaux',
  plomb_crep: 'Plomb (CREP)',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez_boutin: 'Carrez / Boutin',
  erp: 'ERP',
  copropriete: 'Copropriété',
}

/**
 * Nettoie un nom de fichier annexe : retire tout composant de chemin
 * (protection zip-slip) et les caractères de contrôle, conserve le basename.
 * Filtrage par code point pour éviter tout literal de contrôle dans le source.
 */
function sanitizeAnnexeName(name: string | null | undefined): string {
  if (!name) return ''
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = Array.from(base)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 32 && code !== 127
    })
    .join('')
  return cleaned.trim()
}

/** Construit le LISEZ-MOI expliquant l'import et le statut du .mdb. */
function buildReadme(data: MissionExportData): string {
  return [
    'Export Liciel — généré par KOVAS',
    '',
    'Cette archive contient les fichiers XML de votre mission au format Liciel.',
    '',
    'Import dans Liciel : menu « Importer XML spécifique », sélectionnez les',
    'fichiers du dossier XML/. Liciel régénère automatiquement sa base Access',
    "(LICIEL_Dossiers.mdb) à partir de ces XML — vous n'avez rien à faire.",
    '',
    "Le fichier .mdb n'est pas inclus dans cette archive : il est régénéré par",
    "Liciel à l'import, ou par notre microservice de génération .mdb lorsqu'il",
    'est disponible (option « Partager vers Liciel »).',
    '',
    'Contenu :',
    '  XML/        — données structurées (LIV_donnees, LIV_administratif, LIV_<diag>)',
    '  Photos/     — photos rangées par pièce (PIECE_xxx)',
    '  Annexes/    — documents fournis par le propriétaire',
    '',
    `Référence dossier : ${data.mission.reference}`,
    `Date d'export : ${new Date(data.exportedAt).toLocaleString('fr-FR')}`,
  ].join('\n')
}

export async function buildLicielZip(data: MissionExportData): Promise<Buffer> {
  const zip = new JSZip()

  zip.file('LISEZ-MOI.txt', buildReadme(data))

  // ─── Fichiers XML ───────────────────────────────────────────────────────
  zip.file('XML/LIV_donnees.xml', buildLivDonnees(data))
  zip.file('XML/LIV_administratif.xml', buildLivAdministratif(data))

  // Fichier diagnostic correspondant au type de mission.
  const diagFile = diagnosticFileForMissionType(data.mission.type)
  if (data.mission.type.startsWith('dpe_')) {
    // DPE : mapping complet (§A/§C/§E/§H).
    zip.file('XML/LIV_DPE.xml', buildLivDpe(data))
  } else if (diagFile) {
    // Autres diagnostics : fichier générique honnête (pas de champs inventés).
    const label = DIAGNOSTIC_LABELS[data.mission.type] ?? data.mission.type
    zip.file(diagFile, buildLivDiagnosticGeneric(data, label))
  }
  // Pour une mission DPE, au minimum LIV_DPE.xml est présent (spec §1).

  // ─── Photos rangées par pièce + Annexes ──────────────────────────────────
  if (data.photos.length > 0 || data.ownerDocuments.length > 0) {
    const admin = createAdminClient<Database>(
      // biome-ignore lint/style/noNonNullAssertion: vars d'env serveur garanties au runtime.
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // biome-ignore lint/style/noNonNullAssertion: vars d'env serveur garanties au runtime.
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // room_id (uuid) → PIECE_xxx (numérotation identique à LIV_DPE <pieces>).
    const pieceIdByRoom = new Map<string, string>()
    data.rooms.forEach((room, index) => {
      pieceIdByRoom.set(room.id, `PIECE_${String(index + 1).padStart(3, '0')}`)
    })

    // Compteur de photo par dossier pour numéroter photo_001, photo_002, …
    const photoCountByFolder = new Map<string, number>()

    for (const photo of data.photos) {
      const { data: blob } = await admin.storage.from('mission-photos').download(photo.storage_path)
      if (!blob) continue
      const buffer = Buffer.from(await blob.arrayBuffer())
      const ext = photo.storage_path.split('.').pop() ?? 'jpg'
      const pieceId = photo.room_id ? (pieceIdByRoom.get(photo.room_id) ?? null) : null
      const folder = pieceId ? `Photos/${pieceId}` : 'Photos/SANS_PIECE'
      const seq = (photoCountByFolder.get(folder) ?? 0) + 1
      photoCountByFolder.set(folder, seq)
      zip.file(`${folder}/photo_${String(seq).padStart(3, '0')}.${ext}`, buffer)
    }

    for (const doc of data.ownerDocuments) {
      const { data: blob } = await admin.storage.from('owner-uploads').download(doc.storage_path)
      if (!blob) continue
      const buffer = Buffer.from(await blob.arrayBuffer())
      const name = sanitizeAnnexeName(doc.original_name) || `${doc.id}.pdf`
      zip.file(`Annexes/${name}`, buffer)
    }
  }

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
