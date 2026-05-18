import { jsPDF } from 'jspdf'
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

const ROOM_TYPE_LABELS: Record<string, string> = {
  salon: 'Salon',
  sejour: 'Séjour',
  cuisine: 'Cuisine',
  chambre: 'Chambre',
  salle_de_bain: 'Salle de bain',
  wc: 'WC',
  entree: 'Entrée',
  couloir: 'Couloir',
  buanderie: 'Buanderie',
  cave: 'Cave',
  grenier: 'Grenier',
  garage: 'Garage',
  balcon: 'Balcon',
  terrasse: 'Terrasse',
  autre: 'Autre',
}

export function generatePdf(data: MissionExportData): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('KOVAS', margin, y)
  y += 24
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(`Mission ${data.mission.reference}`, margin, y)
  y += 14
  doc.setFontSize(10)
  doc.setTextColor(128)
  doc.text(MISSION_TYPE_LABELS[data.mission.type] ?? data.mission.type, margin, y)
  doc.setTextColor(0)
  y += 24

  // Property block
  if (data.property) {
    y = section(doc, 'Bien', y, margin)
    y = kv(doc, 'Adresse', data.property.address, y, margin)
    if (data.property.postal_code || data.property.city) {
      y = kv(
        doc,
        'Localisation',
        `${data.property.postal_code ?? ''} ${data.property.city ?? ''}`.trim(),
        y,
        margin,
      )
    }
    if (data.property.property_type) y = kv(doc, 'Type', data.property.property_type, y, margin)
    if (data.property.year_built) y = kv(doc, 'Année', String(data.property.year_built), y, margin)
    if (data.property.surface_total)
      y = kv(doc, 'Surface', `${data.property.surface_total} m²`, y, margin)
    y += 8
  }

  // Client block
  if (data.client) {
    y = section(doc, 'Donneur d\'ordre', y, margin)
    y = kv(doc, 'Nom', data.client.display_name, y, margin)
    y = kv(doc, 'Type', data.client.type, y, margin)
    if (data.client.email) y = kv(doc, 'Email', data.client.email, y, margin)
    if (data.client.phone) y = kv(doc, 'Téléphone', data.client.phone, y, margin)
    y += 8
  }

  // Rooms
  if (data.rooms.length > 0) {
    y = section(doc, `Pièces (${data.rooms.length})`, y, margin)
    for (const r of data.rooms) {
      const surface = r.surface_m2 ? `${r.surface_m2} m²` : ''
      const type = r.room_type ? `(${ROOM_TYPE_LABELS[r.room_type] ?? r.room_type})` : ''
      y = line(doc, `• ${r.name} ${type} ${surface}`, y, margin)
    }
    y += 8
  }

  // Voice notes
  if (data.voiceNotes.length > 0) {
    y = section(doc, `Notes vocales (${data.voiceNotes.length})`, y, margin)
    for (const v of data.voiceNotes) {
      if (v.transcript_raw) {
        const wrapped = doc.splitTextToSize(v.transcript_raw, 500)
        for (const w of wrapped) y = line(doc, w as string, y, margin)
        y += 6
      }
    }
  }

  // Photos summary
  if (data.photos.length > 0) {
    y = section(doc, `Photos terrain (${data.photos.length})`, y, margin)
    y = line(
      doc,
      `${data.photos.length} photos géolocalisées au format WebP, disponibles dans le ZIP de l'export.`,
      y,
      margin,
    )
  }

  // Watermark essai
  if (data.isTrial) {
    const pages = doc.getNumberOfPages()
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(136)
      doc.text(
        'Document généré en essai KOVAS — kovas.fr',
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 16,
        { align: 'center' },
      )
      doc.setTextColor(0)
    }
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128)
  const footY = doc.internal.pageSize.getHeight() - 26
  doc.text(`Généré le ${new Date(data.exportedAt).toLocaleString('fr-FR')} via kovas.fr`, margin, footY)
  doc.setTextColor(0)

  return Buffer.from(doc.output('arraybuffer'))
}

function section(doc: jsPDF, label: string, y: number, margin: number): number {
  if (y > 760) {
    doc.addPage()
    y = 40
  }
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(label, margin, y)
  doc.setFont('helvetica', 'normal')
  return y + 16
}

function kv(doc: jsPDF, label: string, value: string, y: number, margin: number): number {
  if (y > 770) {
    doc.addPage()
    y = 40
  }
  doc.setFontSize(10)
  doc.setTextColor(128)
  doc.text(`${label} :`, margin, y)
  doc.setTextColor(0)
  doc.text(value, margin + 90, y)
  return y + 14
}

function line(doc: jsPDF, text: string, y: number, margin: number): number {
  if (y > 770) {
    doc.addPage()
    y = 40
  }
  doc.setFontSize(10)
  doc.text(text, margin, y)
  return y + 13
}
