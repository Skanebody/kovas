/**
 * Compression d'image côté navigateur (HEIF / JPEG / PNG → WebP).
 * Cible : 5 MB → 250 KB, max 1920x1080, qualité 0.75.
 * Cf. CLAUDE.md §8 — Web Camera API + compression WebP.
 */

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const QUALITY = 0.75

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
  originalSizeBytes: number
  compressedSizeBytes: number
}

/**
 * Compresse une image (File ou Blob) en WebP.
 * - Resize si > 1920x1080 (proportions conservées)
 * - Encode en image/webp qualité 0.75
 * - Préserve l'orientation EXIF (canvas la corrige automatiquement)
 */
export async function compressImage(file: File | Blob): Promise<CompressionResult> {
  const dataUrl = await fileToDataUrl(file)
  const img = await loadImage(dataUrl)

  let { width, height } = img
  const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1)
  width = Math.round(width * ratio)
  height = Math.round(height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, 'image/webp', QUALITY)

  return {
    blob,
    width,
    height,
    originalSizeBytes: file.size,
    compressedSizeBytes: blob.size,
  }
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load error'))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Canvas toBlob returned null'))
        else resolve(blob)
      },
      mime,
      quality,
    )
  })
}
