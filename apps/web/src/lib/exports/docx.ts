import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
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

export async function generateDocx(data: MissionExportData): Promise<Buffer> {
  const children: Paragraph[] = []

  // Trial header banner
  if (data.isTrial) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Essai KOVAS — kovas.fr', italics: true, color: '888888' })],
        alignment: AlignmentType.CENTER,
      }),
    )
  }

  // Title
  children.push(new Paragraph({ text: 'KOVAS', heading: HeadingLevel.TITLE }))
  children.push(
    new Paragraph({
      text: `Mission ${data.mission.reference}`,
      heading: HeadingLevel.HEADING_1,
    }),
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: MISSION_TYPE_LABELS[data.mission.type] ?? data.mission.type,
          color: '666666',
        }),
      ],
    }),
  )
  children.push(new Paragraph({ text: '' }))

  // Property
  if (data.property) {
    children.push(new Paragraph({ text: 'Bien', heading: HeadingLevel.HEADING_2 }))
    children.push(kvParagraph('Adresse', data.property.address))
    if (data.property.postal_code || data.property.city) {
      children.push(
        kvParagraph(
          'Localisation',
          `${data.property.postal_code ?? ''} ${data.property.city ?? ''}`.trim(),
        ),
      )
    }
    if (data.property.property_type) children.push(kvParagraph('Type', data.property.property_type))
    if (data.property.year_built)
      children.push(kvParagraph('Année', String(data.property.year_built)))
    if (data.property.surface_total)
      children.push(kvParagraph('Surface', `${data.property.surface_total} m²`))
    children.push(new Paragraph({ text: '' }))
  }

  // Client
  if (data.client) {
    children.push(new Paragraph({ text: "Donneur d'ordre", heading: HeadingLevel.HEADING_2 }))
    children.push(kvParagraph('Nom', data.client.display_name))
    children.push(kvParagraph('Type', data.client.type))
    if (data.client.email) children.push(kvParagraph('Email', data.client.email))
    if (data.client.phone) children.push(kvParagraph('Téléphone', data.client.phone))
    children.push(new Paragraph({ text: '' }))
  }

  // Rooms
  if (data.rooms.length > 0) {
    children.push(
      new Paragraph({ text: `Pièces (${data.rooms.length})`, heading: HeadingLevel.HEADING_2 }),
    )
    for (const r of data.rooms) {
      const parts = [r.name]
      if (r.surface_m2) parts.push(`${r.surface_m2} m²`)
      children.push(new Paragraph({ text: `• ${parts.join(' — ')}` }))
    }
    children.push(new Paragraph({ text: '' }))
  }

  // Voice notes
  if (data.voiceNotes.length > 0) {
    children.push(
      new Paragraph({
        text: `Notes vocales (${data.voiceNotes.length})`,
        heading: HeadingLevel.HEADING_2,
      }),
    )
    for (const v of data.voiceNotes) {
      if (v.transcript_raw) {
        children.push(new Paragraph({ text: v.transcript_raw }))
        children.push(new Paragraph({ text: '' }))
      }
    }
  }

  // Photos summary
  if (data.photos.length > 0) {
    children.push(
      new Paragraph({
        text: `Photos terrain (${data.photos.length})`,
        heading: HeadingLevel.HEADING_2,
      }),
    )
    children.push(
      new Paragraph({
        text: `${data.photos.length} photos géolocalisées au format WebP, disponibles dans le ZIP de l'export.`,
      }),
    )
  }

  // Footer
  children.push(new Paragraph({ text: '' }))
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Généré le ${new Date(data.exportedAt).toLocaleString('fr-FR')} via kovas.fr`,
          italics: true,
          color: '888888',
          size: 16,
        }),
      ],
    }),
  )

  const doc = new Document({
    creator: 'KOVAS',
    title: `Mission ${data.mission.reference}`,
    description: 'Export généré via KOVAS',
    sections: [{ children }],
  })

  return await Packer.toBuffer(doc)
}

function kvParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `${label} : `, bold: true }), new TextRun({ text: value })],
  })
}
