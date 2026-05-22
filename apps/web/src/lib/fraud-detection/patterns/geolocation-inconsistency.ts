/**
 * Pattern 3 — Geolocation inconsistency.
 *
 * Détecte des incohérences spatiales :
 *  1. Bien hors zone d'exercice : > 100 km du cabinet du diagnostiqueur
 *  2. Bien très éloigné : > 500 km — quasi-impossible visite physique
 *  3. Géoloc photo mission incohérente avec adresse bien (haversine > 1 km)
 *  4. Deux missions du même diagnostiqueur dans la même heure mais à
 *     ≥ 50 km d'écart (téléportation) — détection externe à ce pattern,
 *     gérée par `crossMissionTeleport` séparément.
 *
 * Severity = max des composantes individuelles.
 */

import type { FraudSignal } from '../types'

const EARTH_RADIUS_KM = 6371

/**
 * Haversine distance entre deux points en kilomètres.
 * Pure function, exportée pour tests.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface GeolocationInput {
  propertyLat: number
  propertyLng: number
  diagnosticianCabinetLat: number
  diagnosticianCabinetLng: number
  photoGeolocations: ReadonlyArray<{ lat: number; lng: number; takenAt: Date }>
}

export function detectGeolocationInconsistency(input: GeolocationInput): FraudSignal {
  const distanceCabinet = haversineKm(
    { lat: input.propertyLat, lng: input.propertyLng },
    { lat: input.diagnosticianCabinetLat, lng: input.diagnosticianCabinetLng },
  )

  const photoDistances = input.photoGeolocations.map((p) =>
    haversineKm({ lat: p.lat, lng: p.lng }, { lat: input.propertyLat, lng: input.propertyLng }),
  )

  // === Composante 1 : éloignement cabinet ===
  let cabinetSeverity = 0
  if (distanceCabinet > 500) {
    cabinetSeverity = 0.9
  } else if (distanceCabinet > 200) {
    cabinetSeverity = 0.5
  } else if (distanceCabinet > 100) {
    cabinetSeverity = 0.3
  }

  // === Composante 2 : photos hors adresse bien ===
  let photoSeverity = 0
  const inconsistentPhotos: number[] = []
  for (let i = 0; i < photoDistances.length; i++) {
    const d = photoDistances[i] ?? 0
    if (d > 5) {
      // > 5km : très suspect (photo prise ailleurs)
      photoSeverity = Math.max(photoSeverity, 0.85)
      inconsistentPhotos.push(i)
    } else if (d > 1) {
      // 1-5km : suspect (mauvaise géoloc ou photo voisin)
      photoSeverity = Math.max(photoSeverity, 0.45)
      inconsistentPhotos.push(i)
    }
  }

  // Si majorité des photos sont incohérentes, on aggrave
  if (
    inconsistentPhotos.length > 0 &&
    inconsistentPhotos.length >= Math.ceil(input.photoGeolocations.length / 2)
  ) {
    photoSeverity = Math.min(1, photoSeverity + 0.15)
  }

  const severity = Math.max(cabinetSeverity, photoSeverity)
  const flagged = severity >= 0.5

  const parts: string[] = []
  if (cabinetSeverity > 0) {
    parts.push(`bien à ${distanceCabinet.toFixed(0)} km du cabinet`)
  }
  if (photoSeverity > 0) {
    parts.push(
      `${inconsistentPhotos.length}/${input.photoGeolocations.length} photo(s) géolocalisées loin du bien`,
    )
  }
  const reason =
    parts.length > 0
      ? `Incohérence géolocalisation — ${parts.join(' ; ')}.`
      : `Géolocalisation cohérente (cabinet ${distanceCabinet.toFixed(0)} km, ${input.photoGeolocations.length} photo[s] dans rayon 1 km).`

  return {
    pattern: 'geolocation_inconsistency',
    severity,
    flagged,
    reason,
    details: {
      distanceCabinetKm: Number(distanceCabinet.toFixed(2)),
      photoDistancesKm: photoDistances.map((d) => Number(d.toFixed(2))),
      inconsistentPhotoIndexes: inconsistentPhotos,
      cabinetSeverity,
      photoSeverity,
    },
  }
}

export interface TeleportInput {
  missions: ReadonlyArray<{
    missionId: string
    propertyLat: number
    propertyLng: number
    arrivedAt: Date
  }>
}

/**
 * Détecte les "téléportations" : 2 missions chevauchant temporellement
 * mais séparées spatialement de manière physiquement impossible.
 * Seuil : Δt < 60min ET distance > 50km.
 */
export function detectCrossMissionTeleport(input: TeleportInput): FraudSignal[] {
  const signals: FraudSignal[] = []
  const sorted = [...input.missions].sort((a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime())

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (!a || !b) continue
    const elapsedMin = (b.arrivedAt.getTime() - a.arrivedAt.getTime()) / (1000 * 60)
    if (elapsedMin >= 60) continue
    const distKm = haversineKm(
      { lat: a.propertyLat, lng: a.propertyLng },
      { lat: b.propertyLat, lng: b.propertyLng },
    )
    // Vitesse implicite — > 100 km/h sur courte distance = impossible
    const requiredKmh = (distKm / Math.max(1, elapsedMin)) * 60
    if (distKm > 50 && requiredKmh > 100) {
      signals.push({
        pattern: 'geolocation_inconsistency',
        severity: 0.95,
        flagged: true,
        reason: `Téléportation détectée : missions ${a.missionId}↔${b.missionId} séparées de ${distKm.toFixed(0)} km en ${elapsedMin.toFixed(0)} min (${requiredKmh.toFixed(0)} km/h requis).`,
        details: {
          subPattern: 'teleport',
          missionA: a.missionId,
          missionB: b.missionId,
          distanceKm: Number(distKm.toFixed(2)),
          elapsedMinutes: Number(elapsedMin.toFixed(1)),
          requiredKmh: Number(requiredKmh.toFixed(1)),
        },
      })
    }
  }

  return signals
}
