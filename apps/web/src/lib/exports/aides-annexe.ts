import {
  type AideInput,
  type AideResult,
  type DpeClass,
  type Occupation,
  simulateAides,
} from '@/lib/data-gouv/mes-aides-reno'
import { generateAidesAnnexePdf } from '@/lib/pdf/aides-renovation-annexe'
import type { Database } from '@kovas/database/types'
/**
 * Génération + persistance de l'annexe "Aides à la rénovation énergétique"
 * pour les exports DPE F/G.
 *
 * Flow :
 *  1. Détecte automatiquement si la mission est un DPE de classe F ou G.
 *  2. Appelle le simulateur officiel France Rénov' via
 *     `lib/data-gouv/mes-aides-reno`.
 *  3. Génère l'annexe PDF via `lib/pdf/aides-renovation-annexe`.
 *  4. Stocke le PDF sur Supabase Storage (`mission-annexes`).
 *  5. Persiste une ligne `dossier_export_annexes` pour la traçabilité.
 *
 * Si la simulation échoue ou si la mission n'est pas un DPE F/G,
 * on renvoie `null` et l'export se poursuit normalement.
 */
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { MissionExportData } from './build-mission-data'

const ANNEXES_BUCKET = 'mission-annexes'

export interface AidesAnnexeResult {
  pdf: Buffer
  aides: AideResult[]
  totalEur: number
  dpe_actuel: 'F' | 'G'
  storagePath: string | null
}

/**
 * Tente de générer l'annexe Aides Rénovation pour une mission DPE F/G.
 *
 * @param data — agrégat MissionExportData (mission + dossier + property…)
 * @param options.persist — si true, stocke le PDF + insère la ligne audit
 *   `dossier_export_annexes`. Par défaut true ; mettre à false pour les
 *   appels client-only (ex : aperçu) sans effets de bord.
 * @returns `null` si la mission n'est pas un DPE F/G éligible.
 */
export async function generateAidesAnnexeIfEligible(
  data: MissionExportData,
  options: { persist?: boolean } = {},
): Promise<AidesAnnexeResult | null> {
  const persist = options.persist ?? true

  const dpe = detectFgDpe(data)
  if (!dpe) return null

  const input = buildAideInput(data, dpe)
  if (!input) return null

  let aides: AideResult[]
  try {
    aides = await simulateAides(input)
  } catch {
    // On ne bloque jamais un export pour une indisponibilité France Rénov'.
    return null
  }
  if (aides.length === 0) return null

  const totalEur = roundHundred(aides.reduce((acc, a) => acc + a.montant_eur, 0))

  const pdf = generateAidesAnnexePdf({
    reference: data.mission.reference,
    adresse_bien: formatAddress(data),
    dpe_actuel: dpe,
    dpe_projete: 'C',
    aides,
    generated_at: data.exportedAt,
  })

  let storagePath: string | null = null
  if (persist) {
    try {
      storagePath = await persistAnnexe(data, pdf, aides, dpe)
    } catch {
      // Échec de persistance audit : on garde le PDF pour l'inclure dans le ZIP,
      // mais on n'interrompt pas l'export.
      storagePath = null
    }
  }

  return { pdf, aides, totalEur, dpe_actuel: dpe, storagePath }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectFgDpe(data: MissionExportData): 'F' | 'G' | null {
  // On n'agit que sur les missions DPE/copropriété (les autres diagnostics
  // n'ont pas de classe DPE émise).
  const type = data.mission.type
  if (!type.startsWith('dpe_') && type !== 'copropriete') return null

  // Le DPE peut venir soit du résultat mission (`dpe_letter`) en cas de
  // calcul Phase 2, soit du property `energy_class` saisi par le terrain.
  // build-mission-data n'expose pour l'instant pas dpe_letter, on lit dans
  // les notes structurées des voice notes. À défaut on regarde mission.notes
  // mais en pratique le diagnostiqueur renseigne la classe sur la mission
  // — exposée via property pour les besoins de cette annexe.
  // NB : si plus tard on ajoute mission.dpe_letter au MissionExportData,
  //      on le préfère ici.
  const cls = readDpeClass(data)
  if (cls === 'F' || cls === 'G') return cls
  return null
}

function readDpeClass(data: MissionExportData): DpeClass | null {
  // Voice notes structurées : champ `energy_class` parfois renseigné.
  for (const v of data.voiceNotes) {
    const s = v.transcript_structured as { property?: { energy_class?: string } } | null
    const cls = s?.property?.energy_class
    if (cls && isDpeClass(cls)) return cls
  }
  // Note libre mission (fallback)
  const noteMatch = data.mission.notes?.match(/\bDPE\s*[:=]?\s*([A-G])\b/i)
  if (noteMatch?.[1]) {
    const c = noteMatch[1].toUpperCase()
    if (isDpeClass(c)) return c as DpeClass
  }
  return null
}

function isDpeClass(s: string): s is DpeClass {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(s)
}

function buildAideInput(data: MissionExportData, dpe: 'F' | 'G'): AideInput | null {
  if (!data.property) return null
  const surface = data.property.surface_total
  const year = data.property.year_built
  const codePostal = data.property.postal_code ?? ''
  const propType = data.property.property_type ?? ''

  if (!surface || !year || !/^\d{5}$/.test(codePostal)) return null

  const type_logement = propType.toLowerCase().includes('appart') ? 'appartement' : 'maison'

  // V1 : on n'a pas le revenu fiscal — laisser undefined (fallback API).
  // V1 : par défaut on suppose un propriétaire occupant ; à terme on lira
  // l'info depuis le dossier client.
  const occupation: Occupation = 'proprietaire_occupant'

  return {
    surface_m2: Number(surface),
    annee_construction: Number(year),
    dpe_actuel: dpe,
    dpe_projete: 'C',
    code_postal: codePostal,
    type_logement,
    occupation,
  }
}

function formatAddress(data: MissionExportData): string {
  const p = data.property
  if (!p) return ''
  const parts = [p.address, [p.postal_code, p.city].filter(Boolean).join(' ')].filter(Boolean)
  return parts.join(', ')
}

function roundHundred(n: number): number {
  return Math.round(n / 100) * 100
}

async function persistAnnexe(
  data: MissionExportData,
  pdf: Buffer,
  aides: AideResult[],
  dpe: 'F' | 'G',
): Promise<string> {
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Récupère organization_id + dossier_id (build-mission-data ne les expose
  // pas sur l'objet sortant, on les relit en une requête courte).
  const { data: row, error: rowErr } = await admin
    .from('missions')
    .select('organization_id, dossier_id')
    .eq('id', data.mission.id)
    .single()

  if (rowErr || !row?.organization_id || !row?.dossier_id) {
    throw new Error('Mission introuvable pour persistance annexe')
  }

  const storagePath = `${row.organization_id}/${row.dossier_id}/aides-renovation-${data.mission.reference}.pdf`

  await admin.storage.from(ANNEXES_BUCKET).upload(storagePath, new Uint8Array(pdf), {
    contentType: 'application/pdf',
    upsert: true,
  })

  await admin.from('dossier_export_annexes').insert({
    organization_id: row.organization_id,
    dossier_id: row.dossier_id,
    annexe_type: 'aides_renovation',
    storage_path: storagePath,
    payload: {
      mission_id: data.mission.id,
      mission_reference: data.mission.reference,
      dpe_actuel: dpe,
      dpe_projete: 'C',
      aides: aides.map((a) => ({
        code: a.code,
        label: a.label,
        montant_eur: a.montant_eur,
        conditions: a.conditions,
        source_url: a.source_url,
      })),
      generated_at: data.exportedAt,
    } as never,
  } as never)

  return storagePath
}
