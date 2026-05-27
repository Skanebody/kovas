/**
 * KOVAS — Pré-export · Analyseur 6 : photos et observations.
 *
 * Phase 1 sans Vision IA : analyseur "léger" qui se contente de compter les
 * photos par pièce et de détecter les pièces sans aucune photo. Détecte aussi
 * les écarts entre équipements mentionnés dans les voice-notes et photos
 * disponibles (ex : "poêle dans le salon" mais aucune photo dans la pièce).
 *
 * Phase 2 (post-Vision IA) : appel Claude Sonnet pour reconnaissance équipement
 * sur les photos, comparaison avec voice-notes structurés.
 *
 * Poids dans le score global : 10/100.
 */

import type { AnalyzerResult, Finding, MissionAnalysisContext } from './types'

/** Nombre minimum de photos recommandé pour un dossier DPE solide. */
const MIN_PHOTOS_RECOMMENDED = 5
const MIN_PHOTOS_GOOD = 8

export function analyzePhotosAndObservations(ctx: MissionAnalysisContext): AnalyzerResult {
  const findings: Finding[] = []

  const totalPhotos = ctx.photos.length

  // 1. Compte global de photos
  if (totalPhotos === 0) {
    findings.push({
      code: 'no_photos',
      category: 'quality',
      severity: 'critical',
      title: 'Aucune photo dans le dossier',
      message: `Aucune photo n'est associée à cette mission. Pour la preuve EEAT et la défense en cas de contrôle ADEME, au moins ${MIN_PHOTOS_RECOMMENDED} photos sont recommandées (façade, équipements, isolation visible).`,
      suggested_action: 'Ajouter les photos manquantes avant export',
    })
  } else if (totalPhotos < MIN_PHOTOS_RECOMMENDED) {
    findings.push({
      code: 'few_photos',
      category: 'quality',
      severity: 'warning',
      title: `Seulement ${totalPhotos} photo${totalPhotos > 1 ? 's' : ''} dans le dossier`,
      message: `Pour un dossier DPE robuste, au moins ${MIN_PHOTOS_RECOMMENDED} photos sont recommandées (façade, équipements de chauffage, isolation, étiquettes énergétiques). Vous en avez ${totalPhotos}.`,
      suggested_action: 'Ajouter quelques clichés clés',
    })
  } else if (totalPhotos < MIN_PHOTOS_GOOD) {
    findings.push({
      code: 'photos_ok_could_improve',
      category: 'quality',
      severity: 'suggestion',
      title: `${totalPhotos} photos — base correcte`,
      message: `Vous avez ${totalPhotos} photos. Pour un dossier vraiment exemplaire (preuve EEAT en cas de contrôle), pensez à atteindre ${MIN_PHOTOS_GOOD}+ avec étiquettes énergétiques et plaques constructeur.`,
    })
  }

  // 2. Pièces sans photo
  const photosByRoom = new Map<string, number>()
  for (const p of ctx.photos) {
    if (p.room_id) photosByRoom.set(p.room_id, (photosByRoom.get(p.room_id) ?? 0) + 1)
  }
  const roomsWithoutPhoto = ctx.rooms.filter((r) => !photosByRoom.has(r.id))
  if (roomsWithoutPhoto.length > 0 && ctx.rooms.length > 1) {
    findings.push({
      code: 'rooms_without_photo',
      category: 'quality',
      severity: 'suggestion',
      title: `${roomsWithoutPhoto.length} pièce${roomsWithoutPhoto.length > 1 ? 's' : ''} sans photo`,
      message: `Certaines pièces n'ont aucune photo associée : ${roomsWithoutPhoto
        .map((r) => r.name)
        .slice(0, 5)
        .join(
          ', ',
        )}${roomsWithoutPhoto.length > 5 ? '…' : ''}. Pour la traçabilité, une photo générale par pièce visitée est conseillée.`,
      context: { rooms: roomsWithoutPhoto.map((r) => r.id) },
    })
  }

  // 3. Équipements mentionnés dans voice-notes mais aucune photo de la pièce associée
  const equipmentsByRoom = new Map<string, string[]>()
  for (const vn of ctx.voiceNotes) {
    if (!vn.room_id || !vn.transcript_structured) continue
    const kinds = vn.transcript_structured.equipment.map((e) => e.kind)
    if (kinds.length === 0) continue
    equipmentsByRoom.set(vn.room_id, [...(equipmentsByRoom.get(vn.room_id) ?? []), ...kinds])
  }
  const mismatches: string[] = []
  for (const [roomId, kinds] of equipmentsByRoom) {
    if (!photosByRoom.has(roomId)) {
      const room = ctx.rooms.find((r) => r.id === roomId)
      if (room) {
        const unique = [...new Set(kinds)].slice(0, 3).join(', ')
        mismatches.push(`${room.name} (${unique})`)
      }
    }
  }
  if (mismatches.length > 0) {
    findings.push({
      code: 'equipment_voice_no_photo',
      category: 'quality',
      severity: 'suggestion',
      title: `Équipements mentionnés sans photo`,
      message: `Vous avez parlé d'équipements dans certaines pièces sans prendre de photo : ${mismatches
        .slice(0, 3)
        .join(' ; ')}${mismatches.length > 3 ? '…' : ''}. Une photo aide à étayer le rapport.`,
    })
  }

  // 4. Voice-notes vides (transcript_raw absent)
  const emptyVoiceNotes = ctx.voiceNotes.filter(
    (v) => !v.transcript_raw || v.transcript_raw.trim().length < 10,
  ).length
  if (emptyVoiceNotes > 0 && ctx.voiceNotes.length > 0) {
    findings.push({
      code: 'voice_notes_empty',
      category: 'quality',
      severity: 'info',
      title: `${emptyVoiceNotes} note vocale courte ou vide`,
      message: `${emptyVoiceNotes} note${
        emptyVoiceNotes > 1 ? 's' : ''
      } vocale${emptyVoiceNotes > 1 ? 's sont' : ' est'} très courte${
        emptyVoiceNotes > 1 ? 's' : ''
      } (< 10 caractères). Si c'était un test, tu peux la${emptyVoiceNotes > 1 ? 's' : ''} supprimer pour alléger le dossier.`,
    })
  }

  // Score : pénalité progressive sur sévérités
  const penalty = findings.reduce((acc, f) => {
    switch (f.severity) {
      case 'critical':
        return acc + 0.5
      case 'warning':
        return acc + 0.25
      case 'suggestion':
        return acc + 0.1
      default:
        return acc + 0.05
    }
  }, 0)
  const score = Math.max(0, Math.min(1, 1 - penalty))

  return {
    analyzer: 'photo-vision-analyzer',
    findings,
    score,
    meta: {
      total_photos: totalPhotos,
      rooms_total: ctx.rooms.length,
      rooms_with_photo: photosByRoom.size,
    },
  }
}
