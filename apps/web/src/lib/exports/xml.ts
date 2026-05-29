import type { MissionExportData } from './build-mission-data'

/**
 * Génère un XML structuré universel (`donnees.xml`) inclus dans le ZIP
 * d'export KOVAS.
 *
 * Objectif compatibilité (CLAUDE.md §13 + différenciateur #2) : fournir un
 * fichier XML propre et documenté, importable par les logiciels métier qui
 * acceptent un import XML structuré (Liciel « Importer XML spécifique », et
 * en complément des CSV/JSON pour OBBC, AnalysImmo). C'est le format
 * pivot « Plan B » indépendant de tout éditeur — pas un format propriétaire.
 *
 * Le XML reprend exactement la même donnée que `generateJson` (parité totale)
 * pour qu'un éditeur puisse choisir l'un ou l'autre selon son importeur.
 *
 * Bien formé : déclaration UTF-8, échappement strict des entités, valeurs
 * nulles rendues en éléments vides (pas d'attribut xsi:nil pour rester
 * lisible par les parseurs basiques des logiciels métier).
 */

const XML_VERSION = '1.0'

/** Échappe les 5 entités XML dans une valeur texte. */
function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Élément simple `<tag>valeur</tag>` (vide si null/undefined). */
function el(tag: string, value: unknown, indent: string): string {
  if (value === null || value === undefined || value === '') {
    return `${indent}<${tag}/>`
  }
  return `${indent}<${tag}>${esc(value)}</${tag}>`
}

/** Sérialise un objet plat en une suite d'éléments (clés = noms de balises). */
function objectToElements(obj: Record<string, unknown> | null, indent: string): string {
  if (!obj) return ''
  return Object.entries(obj)
    .filter(([, v]) => typeof v !== 'object' || v === null)
    .map(([k, v]) => el(sanitizeTag(k), v, indent))
    .join('\n')
}

/** Un nom de balise XML valide (les clés DB sont déjà en snake_case ASCII). */
function sanitizeTag(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_]/g, '_')
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`
}

export function generateUniversalXml(data: MissionExportData): string {
  const lines: string[] = []
  lines.push(`<?xml version="${XML_VERSION}" encoding="UTF-8"?>`)
  lines.push('<kovas_export version="1.0">')
  lines.push(el('exported_at', data.exportedAt, '  '))
  lines.push(el('is_trial', data.isTrial ? 'true' : 'false', '  '))

  // Mission
  lines.push('  <mission>')
  lines.push(objectToElements(data.mission as Record<string, unknown>, '    '))
  lines.push('  </mission>')

  // Bien / propriété
  lines.push('  <property>')
  lines.push(objectToElements(data.property as Record<string, unknown> | null, '    '))
  lines.push('  </property>')

  // Client
  lines.push('  <client>')
  lines.push(objectToElements(data.client as Record<string, unknown> | null, '    '))
  lines.push('  </client>')

  // Organisation
  lines.push('  <organization>')
  lines.push(objectToElements(data.organization as Record<string, unknown> | null, '    '))
  lines.push('  </organization>')

  // Pièces
  lines.push('  <rooms>')
  for (const room of data.rooms) {
    lines.push('    <room>')
    lines.push(objectToElements(room as Record<string, unknown>, '      '))
    lines.push('    </room>')
  }
  lines.push('  </rooms>')

  // Notes vocales (transcript brut uniquement — le structuré reste en JSON)
  lines.push('  <voice_notes>')
  for (const v of data.voiceNotes) {
    lines.push('    <voice_note>')
    lines.push(el('id', v.id, '      '))
    lines.push(el('room_id', v.room_id, '      '))
    lines.push(el('duration_seconds', v.duration_seconds, '      '))
    lines.push(el('transcript', v.transcript_raw, '      '))
    lines.push(el('created_at', v.created_at, '      '))
    lines.push('    </voice_note>')
  }
  lines.push('  </voice_notes>')

  // Compteurs (parité avec le JSON)
  lines.push(el('photos_count', data.photos.length, '  '))
  lines.push(el('owner_documents_count', data.ownerDocuments.length, '  '))

  lines.push('</kovas_export>')
  // Filtre les lignes vides produites par objectToElements quand l'objet est null.
  return lines.filter((l) => l !== '').join('\n')
}
