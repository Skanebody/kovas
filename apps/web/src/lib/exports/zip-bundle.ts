/**
 * Génère un ZIP universel contenant tous les formats d'export.
 * KOVAS_export_{reference}.zip
 *  ├── README.txt
 *  ├── rapport.pdf
 *  ├── rapport.docx
 *  ├── donnees.csv
 *  ├── donnees.json
 *  └── photos/        (clones depuis Supabase Storage)
 *      ├── piece_<id>/...
 *      └── _sans_piece/...
 */
import JSZip from 'jszip'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@kovas/database/types'
import { applyCsvWatermarkLine } from '@/lib/watermark'
import { generateAidesAnnexeIfEligible } from './aides-annexe'
import type { MissionExportData } from './build-mission-data'
import { generateCsv } from './csv'
import { generateDocx } from './docx'
import { generateJson } from './json'
import { generatePdf } from './pdf'

export async function buildExportZip(data: MissionExportData): Promise<Buffer> {
  const zip = new JSZip()

  // README
  const readme = [
    'Export KOVAS',
    '=============',
    `Mission : ${data.mission.reference}`,
    `Date export : ${new Date(data.exportedAt).toLocaleString('fr-FR')}`,
    '',
    'Contenu :',
    '  - rapport.pdf : rapport visuel (impression)',
    '  - rapport.docx : Word éditable',
    '  - donnees.csv : tableur Excel',
    '  - donnees.json : structuré (import logiciel tiers)',
    '  - photos/ : photos terrain organisées par pièce',
    data.isTrial ? '' : null,
    data.isTrial ? '⚠ Document généré pendant l\'essai gratuit KOVAS — kovas.fr' : null,
  ]
    .filter(Boolean)
    .join('\n')
  zip.file('README.txt', readme)

  // PDF
  zip.file('rapport.pdf', generatePdf(data))

  // DOCX
  zip.file('rapport.docx', await generateDocx(data))

  // CSV (with watermark if trial)
  let csv = generateCsv(data)
  if (data.isTrial) {
    csv = applyCsvWatermarkLine(csv, data.mission.reference)
  }
  zip.file('donnees.csv', csv)

  // JSON
  zip.file('donnees.json', generateJson(data))

  // Annexe Aides Rénovation (DPE F/G uniquement)
  // On l'inclut systématiquement si la mission est éligible. En cas d'échec
  // du simulateur France Rénov', l'export se poursuit sans annexe (graceful).
  try {
    const annexe = await generateAidesAnnexeIfEligible(data)
    if (annexe) {
      zip.file('annexe_aides_renovation.pdf', annexe.pdf)
    }
  } catch {
    // Jamais bloquant : l'export DPE reste produit même sans annexe.
  }

  // Photos — download from Supabase Storage, group by room
  if (data.photos.length > 0) {
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const roomNameById: Record<string, string> = {}
    for (const r of data.rooms) roomNameById[r.id] = r.name

    for (const p of data.photos) {
      const { data: blob } = await admin.storage.from('mission-photos').download(p.storage_path)
      if (!blob) continue
      const buffer = Buffer.from(await blob.arrayBuffer())
      const ext = p.storage_path.split('.').pop() ?? 'webp'
      const folder = p.room_id
        ? `photos/${slugify(roomNameById[p.room_id] ?? 'piece')}_${p.room_id.slice(0, 8)}`
        : 'photos/_sans_piece'
      zip.file(`${folder}/${p.id.slice(0, 8)}.${ext}`, buffer)
    }
  }

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
