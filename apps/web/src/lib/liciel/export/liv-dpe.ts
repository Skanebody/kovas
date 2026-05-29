/**
 * Génère XML/LIV_DPE.xml — fichier diagnostic DPE.
 *
 * Porte les catégories spec (docs/liciel-parser-specs.md) :
 *   §A Identité du bien      → LIV_DPE.<champs bien>
 *   §C Type de mission DPE   → LIV_DPE.type_mission / methode_calcul / dates
 *   §E Équipements           → LIV_DPE.chauffage / ecs / ventilation / climatisation
 *   §H Annexes (pièces+photos) → <pieces><piece><photos>
 *
 * §D (enveloppe : murs/toiture/planchers/menuiseries), §F (consommations) et
 * §G (recommandations) : KOVAS V1 ne stocke pas ces données structurées dans
 * MissionExportData → balises non émises (cf. rapport « champs non couverts »).
 *
 * RÈGLE D'HONNÊTETÉ : seuls les noms de champs présents dans la spec sont émis.
 * L'enum équipement KOVAS (chaudiere/pac/...) est mappé sur les valeurs
 * generateur_principal documentées quand un mapping 1:1 existe ; sinon la
 * source brute KOVAS est conservée dans <generateur_principal_source> (champ
 * NON spec, isolé pour traçabilité — voir mapEquipmentToGenerateur).
 */

import type { MissionExportData } from '@/lib/exports/build-mission-data'
import { parsePropertyLocation } from '@/lib/property/location'
import type { VoiceParsedData } from '@/lib/voice-parser'
import {
  buildRoomNumbering,
  deriveDateFinValidite,
  derivePeriodeConstruction,
  deriveTypeMission,
} from './derived'
import { decimal, el, esc, isoDate, xmlDocument } from './xml-utils'

/* ─── §A Identité du bien ───────────────────────────────────────────────── */

/**
 * Parse une localisation PostGIS (`unknown` dans MissionExportData) en lng/lat.
 * La colonne `location` arrive en EWKT (`POINT(lng lat)`) ou EWKB hex string
 * depuis Supabase. On réutilise le helper neutre éprouvé du module property,
 * qui valide strictement le format et borne les coordonnées.
 */
function readGps(location: unknown): { lat: number; lng: number } | null {
  // Cast localisé justifié : type DB `unknown` (colonne geography).
  const raw = typeof location === 'string' ? location : null
  if (!raw) return null
  return parsePropertyLocation(raw)
}

function buildIdentiteBien(data: MissionExportData): string {
  const p = data.property
  const lines: string[] = []
  if (!p) {
    // Bien obligatoire spec §A mais absent : balises clés vides explicites.
    lines.push(el('adresse_complete', null, '    '))
    lines.push(el('code_postal', null, '    '))
    lines.push(el('ville', null, '    '))
    lines.push(el('type_batiment', null, '    '))
    lines.push(el('annee_construction', null, '    '))
    lines.push(el('periode_construction', null, '    '))
    lines.push(el('surface_habitable', null, '    '))
    lines.push(el('surface_au_sol', null, '    '))
    return lines.join('\n')
  }

  const gps = readGps(p.location)
  const periode = derivePeriodeConstruction(p.year_built)

  lines.push(el('adresse_complete', p.address, '    '))
  lines.push(el('code_postal', p.postal_code, '    '))
  lines.push(el('ville', p.city, '    '))
  lines.push(el('gps_longitude', gps ? decimal(gps.lng) : null, '    '))
  lines.push(el('gps_latitude', gps ? decimal(gps.lat) : null, '    '))
  lines.push(el('cadastre_section', p.cadastre_section, '    '))
  lines.push(el('cadastre_numero', p.cadastre_number, '    '))
  lines.push(el('cadastre_prefixe', p.cadastre_prefix, '    '))
  lines.push(el('type_batiment', p.property_type, '    '))
  lines.push(el('annee_construction', p.year_built, '    '))
  lines.push(el('periode_construction', periode, '    '))
  lines.push(el('surface_carrez', decimal(p.surface_carrez), '    '))
  lines.push(el('surface_habitable', decimal(p.surface_total), '    '))
  // surface_au_sol : spec §A « à calculer ». KOVAS n'a pas de surface au sol
  // distincte ; on reprend surface_total comme meilleure approximation
  // disponible (documenté). Si surface_total absente → vide.
  lines.push(el('surface_au_sol', decimal(p.surface_total), '    '))
  lines.push(el('niveaux_count', p.floors, '    '))
  // hauteur_sous_plafond_moyenne (§A « à calculer ») : pas de donnée fiable
  // au niveau bien dans MissionExportData → laissé vide.
  lines.push(el('hauteur_sous_plafond_moyenne', null, '    '))
  // orientation_principale (§A « à ajouter ») : pas de donnée KOVAS → vide.
  lines.push(el('orientation_principale', null, '    '))

  return lines.join('\n')
}

/* ─── §C Type de mission DPE ────────────────────────────────────────────── */

function buildTypeMission(data: MissionExportData): string {
  const dateVisite = isoDate(data.mission.completed_at ?? data.mission.started_at)
  const lines: string[] = []
  lines.push(el('type_mission', deriveTypeMission(data.mission.type), '    '))
  // methode_calcul : valeur fixe spec §C.
  lines.push(el('methode_calcul', '3CL-2021', '    '))
  lines.push(el('date_visite', dateVisite, '    '))
  lines.push(el('date_fin_validite', deriveDateFinValidite(dateVisite), '    '))
  // nombre_occupants & mode_occupation (§C « à ajouter ») : pas de donnée
  // KOVAS → balises vides.
  lines.push(el('nombre_occupants', null, '    '))
  lines.push(el('mode_occupation', null, '    '))
  return lines.join('\n')
}

/* ─── §E Équipements ────────────────────────────────────────────────────── */

/**
 * Mappe un `kind` d'équipement KOVAS (voice-parser) sur la valeur
 * generateur_principal de la spec §E quand un mapping 1:1 documenté existe.
 * Sinon null (la source brute reste traçable via attribut séparé).
 *
 * Valeurs cibles spec §E (chauffage.generateur_principal) :
 *   chaudiere_gaz | chaudiere_fioul | PAC_air_air | PAC_air_eau |
 *   electrique_direct | electrique_accumulation | bois | reseau_chaleur
 */
function mapEquipmentToGenerateur(
  kind: VoiceParsedData['equipment'][number]['kind'],
): string | null {
  switch (kind) {
    case 'pac':
      // KOVAS ne distingue pas air/air vs air/eau → pas de mapping 1:1 sûr.
      return null
    case 'chaudiere':
      // KOVAS ne distingue pas gaz/fioul au niveau `kind` → pas de mapping sûr.
      return null
    default:
      return null
  }
}

/**
 * Sérialise les équipements depuis les notes vocales structurées.
 * Les équipements KOVAS sont génériques (kind/brand/model/year). On les classe
 * dans les sous-blocs chauffage / ecs / ventilation / climatisation de la spec
 * §E selon `kind`.
 */
function buildEquipements(data: MissionExportData): string {
  const equipment: VoiceParsedData['equipment'] = data.voiceNotes.flatMap(
    (note) => note.transcript_structured?.equipment ?? [],
  )
  if (equipment.length === 0) return ''

  const chauffage = equipment.filter((e) => ['chaudiere', 'pac', 'radiateur'].includes(e.kind))
  const ecs = equipment.filter((e) => e.kind === 'chauffe_eau')
  const ventilation = equipment.filter((e) => e.kind === 'ventilation')
  const climatisation = equipment.filter((e) => e.kind === 'climatisation')

  const lines: string[] = []

  // §E Chauffage
  if (chauffage.length > 0) {
    lines.push('    <chauffage>')
    for (const e of chauffage) {
      const gen = mapEquipmentToGenerateur(e.kind)
      lines.push('      <generateur>')
      lines.push(el('generateur_principal', gen, '        '))
      lines.push(el('marque', e.brand, '        '))
      lines.push(el('modele', e.model, '        '))
      lines.push(el('annee_installation', e.year_install, '        '))
      lines.push('      </generateur>')
    }
    lines.push('    </chauffage>')
  }

  // §E ECS
  if (ecs.length > 0) {
    lines.push('    <ecs>')
    for (const e of ecs) {
      lines.push(el('marque', e.brand, '      '))
      lines.push(el('modele', e.model, '      '))
      lines.push(el('annee', e.year_install, '      '))
    }
    lines.push('    </ecs>')
  }

  // §E Ventilation
  if (ventilation.length > 0) {
    lines.push('    <ventilation>')
    for (const e of ventilation) {
      lines.push(el('marque', e.brand, '      '))
      lines.push(el('modele', e.model, '      '))
    }
    lines.push('    </ventilation>')
  }

  // §E Climatisation
  if (climatisation.length > 0) {
    lines.push('    <climatisation>')
    for (const e of climatisation) {
      lines.push(el('marque', e.brand, '      '))
      lines.push(el('modele', e.model, '      '))
    }
    lines.push('    </climatisation>')
  }

  return lines.join('\n')
}

/* ─── §H Pièces + photos ────────────────────────────────────────────────── */

function buildPieces(data: MissionExportData): string {
  if (data.rooms.length === 0) return ''
  const numbering = buildRoomNumbering(data.rooms)
  // Index des photos par pièce pour reconstruire file="Photos/PIECE_xxx/...".
  const photosByRoom = new Map<string, MissionExportData['photos']>()
  for (const photo of data.photos) {
    if (!photo.room_id) continue
    const list = photosByRoom.get(photo.room_id) ?? []
    list.push(photo)
    photosByRoom.set(photo.room_id, list)
  }

  const lines: string[] = ['    <pieces>']
  for (const room of data.rooms) {
    const pieceId = numbering.get(room.id) ?? 'PIECE_000'
    const surfaceAttr = room.surface_m2 != null ? ` surface="${esc(decimal(room.surface_m2))}"` : ''
    const photos = photosByRoom.get(room.id) ?? []
    if (photos.length === 0) {
      lines.push(`      <piece id="${esc(pieceId)}" nom="${esc(room.name)}"${surfaceAttr}/>`)
      continue
    }
    lines.push(`      <piece id="${esc(pieceId)}" nom="${esc(room.name)}"${surfaceAttr}>`)
    lines.push('        <photos>')
    photos.forEach((photo, photoIdx) => {
      const ext = photo.storage_path.split('.').pop() ?? 'jpg'
      const file = `Photos/${pieceId}/photo_${String(photoIdx + 1).padStart(3, '0')}.${ext}`
      const tagAttr = photo.caption ? ` tag="${esc(photo.caption)}"` : ''
      lines.push(`          <photo file="${esc(file)}"${tagAttr}/>`)
    })
    lines.push('        </photos>')
    lines.push('      </piece>')
  }
  lines.push('    </pieces>')
  return lines.join('\n')
}

/* ─── Assemblage ────────────────────────────────────────────────────────── */

export function buildLivDpe(data: MissionExportData): string {
  const blocks: string[] = []

  blocks.push('  <bien>')
  blocks.push(buildIdentiteBien(data))
  blocks.push('  </bien>')

  blocks.push('  <mission_dpe>')
  blocks.push(buildTypeMission(data))
  blocks.push('  </mission_dpe>')

  const equipements = buildEquipements(data)
  if (equipements) {
    blocks.push('  <equipements>')
    blocks.push(equipements)
    blocks.push('  </equipements>')
  }

  const pieces = buildPieces(data)
  if (pieces) blocks.push(pieces)

  return xmlDocument('document', blocks.join('\n'))
}
