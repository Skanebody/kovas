import type { MissionExportData } from './build-mission-data'

const MISSION_TYPE_LABELS: Record<string, string> = {
  dpe_vente: 'DPE vente',
  dpe_location: 'DPE location',
  copropriete: 'DPE copropriété',
  amiante_vente: 'Amiante (vente)',
  amiante_avant_travaux: 'Amiante avant travaux',
  plomb_crep: 'Plomb CREP',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez_boutin: 'Carrez / Boutin',
  erp: 'ERP',
}

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function generateCsv(data: MissionExportData): string {
  const lines: string[] = []

  if (data.isTrial) {
    lines.push(`# Essai KOVAS — kovas.fr — Mission ${data.mission.reference} — Export ${data.exportedAt}`)
  }
  lines.push(`# KOVAS — Export mission ${data.mission.reference}`)
  lines.push('')

  // Mission
  lines.push('Section,Champ,Valeur')
  lines.push(`Mission,Référence,${csvEscape(data.mission.reference)}`)
  lines.push(`Mission,Type,${csvEscape(MISSION_TYPE_LABELS[data.mission.type] ?? data.mission.type)}`)
  lines.push(`Mission,Statut,${csvEscape(data.mission.status)}`)
  lines.push(`Mission,Date prévue,${csvEscape(data.mission.scheduled_at ?? '')}`)
  lines.push(`Mission,Date début,${csvEscape(data.mission.started_at ?? '')}`)
  lines.push(`Mission,Date fin,${csvEscape(data.mission.completed_at ?? '')}`)

  if (data.property) {
    lines.push(`Bien,Adresse,${csvEscape(data.property.address)}`)
    lines.push(`Bien,Code postal,${csvEscape(data.property.postal_code ?? '')}`)
    lines.push(`Bien,Ville,${csvEscape(data.property.city ?? '')}`)
    lines.push(`Bien,Type,${csvEscape(data.property.property_type ?? '')}`)
    lines.push(`Bien,Année construction,${csvEscape(data.property.year_built ?? '')}`)
    lines.push(`Bien,Surface totale (m²),${csvEscape(data.property.surface_total ?? '')}`)
    lines.push(`Bien,Surface Carrez (m²),${csvEscape(data.property.surface_carrez ?? '')}`)
  }

  if (data.client) {
    lines.push(`Client,Nom,${csvEscape(data.client.display_name)}`)
    lines.push(`Client,Type,${csvEscape(data.client.type)}`)
    lines.push(`Client,Email,${csvEscape(data.client.email ?? '')}`)
    lines.push(`Client,Téléphone,${csvEscape(data.client.phone ?? '')}`)
  }

  // Rooms
  if (data.rooms.length > 0) {
    lines.push('')
    lines.push('Pièce,Type,Surface (m²)')
    for (const r of data.rooms) {
      lines.push(`${csvEscape(r.name)},${csvEscape(r.room_type ?? '')},${csvEscape(r.surface_m2 ?? '')}`)
    }
  }

  // Voice notes structured data
  const allEquipment = data.voiceNotes
    .flatMap((v) => v.transcript_structured?.equipment ?? [])
  if (allEquipment.length > 0) {
    lines.push('')
    lines.push('Équipement,Marque,Modèle,Année,Notes')
    for (const eq of allEquipment) {
      lines.push(
        [
          csvEscape(eq.kind),
          csvEscape(eq.brand ?? ''),
          csvEscape(eq.model ?? ''),
          csvEscape(eq.year_install ?? ''),
          csvEscape(eq.notes ?? ''),
        ].join(','),
      )
    }
  }

  return `${lines.join('\n')}\n`
}
