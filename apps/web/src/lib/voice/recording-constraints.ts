/**
 * KOVAS — Niveau 1 anti-bruit : constraints getUserMedia optimales pour Whisper FR terrain.
 *
 * Diagnostiqueur enregistre en cave, combles, dehors. Bruits ambiants fréquents :
 * tondeuse, ventilation industrielle, voiture, perceuse voisin, télé en arrière-plan.
 * Ces constraints branchent les pipelines de noise suppression natifs du navigateur
 * (WebRTC + ML noise gate sur iOS/Android/desktop depuis 2023) AVANT l'envoi à Whisper.
 *
 * Authority : MISSION-E pack anti-bruit vocal 4 niveaux.
 */

/** Constraints optimales pour Whisper FR terrain diagnostiqueur. */
export const OPTIMAL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true, // supprime écho voix (renvoi haut-parleur → micro)
  noiseSuppression: true, // ML noise gate intégré navigateur (depuis 2023 iOS/Android)
  autoGainControl: true, // amplifie voix faible, atténue voix forte
  sampleRate: 16000, // optimum Whisper (>16k = gaspille bande passante upload)
  channelCount: 1, // mono suffit (gain compression + précision)
}

/**
 * Wrapper qui tente les constraints optimales + fallback safe.
 * Safari iOS < 16 peut refuser sampleRate ou channelCount → on retombe sur les flags
 * essentiels (echo/noise/AGC), puis sur `audio: true` si tout échoue.
 *
 * @returns MediaStream prêt à brancher dans MediaRecorder + AnalyserNode
 * @throws DOMException si l'utilisateur refuse la permission micro
 */
export async function getOptimalMicrophoneStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    throw new Error('MediaDevices API non supportée (HTTPS requis)')
  }

  // Tentative 1 : constraints complètes
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: OPTIMAL_AUDIO_CONSTRAINTS })
  } catch (err1) {
    // Tentative 2 : constraints essentielles (echo/noise/AGC) sans sampleRate/channel
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err2) {
      // Tentative 3 : audio brut — dernier recours pour navigateurs très anciens
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err3) {
        // Aucune permission/support — on remonte l'erreur la plus parlante
        if (err3 instanceof Error) throw err3
        if (err2 instanceof Error) throw err2
        if (err1 instanceof Error) throw err1
        throw new Error('Permission micro refusée')
      }
    }
  }
}
