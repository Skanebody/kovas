'use client'

/**
 * KOVAS — Photo preprocessor du mode Capture-First (V1.5 iteration 2).
 *
 * 100% browser API (canvas + createImageBitmap). Aucune dépendance externe.
 * Toutes les opérations sont async pour ne pas bloquer le main thread plus de ~200ms.
 *
 * Pipeline (un seul `decode()` du `File`, on réutilise l'`ImageBitmap`) :
 *   1. createImageBitmap(file)                    — décodage natif rapide (V8 thread quand dispo)
 *   2. compress descente cascade max 4096→2048→1600 vers JPEG q=0.8
 *   3. thumbnail 200×200 q=0.7
 *   4. dHash 9×8 grayscale → 64 bits → 16 hex chars
 *   5. variance Laplacian (sample 256×256) → isBlurry si var < 100
 *
 * Authority : CLAUDE.md §3 feature #2 (photos compressées) + #10 (offline) + Vision IA V2.
 */

export interface PreprocessResult {
  compressedBlob: Blob
  thumbnailBlob: Blob
  width: number
  height: number
  sizeBytes: number
  isBlurry: boolean
  /** dHash 8×8 = 64 bits = 16 hex chars. */
  perceptualHash: string
  /** Timestamp client (Date.now()) à la capture. */
  capturedAt: number
}

// ============================================
// Constantes ajustables
// ============================================

const COMPRESS_MAX_DIM = 1600
const COMPRESS_QUALITY = 0.8
const THUMBNAIL_MAX_DIM = 200
const THUMBNAIL_QUALITY = 0.7
/** Seuil empirique conservateur — variance Laplacian sur grayscale 0-255. */
const BLUR_VARIANCE_THRESHOLD = 100
/** Sample carré pour le calcul de blur (limite le coût CPU sur grosses photos iPhone). */
const BLUR_SAMPLE_DIM = 256
const DHASH_W = 9
const DHASH_H = 8

// ============================================
// Helpers canvas
// ============================================

function getOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  // OffscreenCanvas est plus rapide sur Chrome/Edge ; Safari iOS 16.4+ supporte
  // OffscreenCanvas mais pas toujours .toBlob (selon contexte). On garde le fallback HTMLCanvasElement.
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(width, height)
    } catch {
      // ignore — fallback
    }
  }
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    // OffscreenCanvas
    return canvas.convertToBlob({ type: mimeType, quality })
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('canvas.toBlob() returned null'))
      },
      mimeType,
      quality,
    )
  })
}

function computeTargetDims(
  srcW: number,
  srcH: number,
  maxDim: number,
): { width: number; height: number } {
  const largest = Math.max(srcW, srcH)
  if (largest <= maxDim) {
    return { width: srcW, height: srcH }
  }
  const ratio = maxDim / largest
  return {
    width: Math.round(srcW * ratio),
    height: Math.round(srcH * ratio),
  }
}

/**
 * Compression cascade : si l'image dépasse 4096, on passe par 2048 puis maxDim
 * pour éviter de réserver un buffer Canvas géant en une fois (pic mémoire iOS Safari).
 */
async function drawCascade(
  source: ImageBitmap,
  maxDim: number,
): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const intermediateSteps: number[] = []
  const largest = Math.max(source.width, source.height)
  if (largest > 4096) intermediateSteps.push(2048)
  intermediateSteps.push(maxDim)

  let current: ImageBitmap | OffscreenCanvas | HTMLCanvasElement = source
  let currentW = source.width
  let currentH = source.height

  for (const step of intermediateSteps) {
    const { width, height } = computeTargetDims(currentW, currentH, step)
    const canvas = getOffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
    if (!ctx) {
      throw new Error('2D context unavailable on canvas')
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    // drawImage accepte ImageBitmap, OffscreenCanvas et HTMLCanvasElement comme source.
    ctx.drawImage(current as CanvasImageSource, 0, 0, width, height)
    currentW = width
    currentH = height
    current = canvas
  }

  return current as OffscreenCanvas | HTMLCanvasElement
}

// ============================================
// Sous-fonctions exposées (testables)
// ============================================

/**
 * Compresse une image et retourne `{ blob, width, height }`.
 * Préserve l'orientation telle qu'interprétée par `createImageBitmap`
 * (qui applique automatiquement l'EXIF orientation sur Safari iOS 14+).
 */
export async function compressImage(
  source: Blob,
  opts: { maxDim?: number; quality?: number; mimeType?: string } = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxDim = opts.maxDim ?? COMPRESS_MAX_DIM
  const quality = opts.quality ?? COMPRESS_QUALITY
  const mimeType = opts.mimeType ?? 'image/jpeg'

  // imageOrientation: 'from-image' applique automatiquement le tag EXIF
  // (Chrome 81+, Safari 13.1+). Fallback ignoré si non supporté.
  const bitmap = await createImageBitmap(source, {
    imageOrientation: 'from-image',
  } as ImageBitmapOptions)
  try {
    const canvas = await drawCascade(bitmap, maxDim)
    const blob = await canvasToBlob(canvas, mimeType, quality)
    return { blob, width: canvas.width, height: canvas.height }
  } finally {
    bitmap.close()
  }
}

/**
 * Calcule le dHash 9×8 = 64 bits.
 * 1. resize la source en 9×8 grayscale
 * 2. pour chaque ligne, compare pixel[i] > pixel[i+1] → bit
 * 3. concat 64 bits → 16 hex chars
 */
export async function computeDHash(source: ImageBitmap | Blob): Promise<string> {
  const bitmap =
    'width' in source
      ? source
      : await createImageBitmap(source, {
          imageOrientation: 'from-image',
        } as ImageBitmapOptions)
  const ownsBitmap = !('width' in source)

  try {
    const canvas = getOffscreenCanvas(DHASH_W, DHASH_H)
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
    if (!ctx) throw new Error('2D context unavailable')
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, DHASH_W, DHASH_H)
    const { data } = ctx.getImageData(0, 0, DHASH_W, DHASH_H)

    // Convert to grayscale row by row, compare adjacent pixels.
    // Hash bit string in MSB-first order to align with classical dHash refs.
    // `data` is a Uint8ClampedArray — index access is `number | undefined` under
    // noUncheckedIndexedAccess. We default to 0 for out-of-bound (unreachable
    // ici car la boucle reste dans `DHASH_W * DHASH_H * 4`).
    let bitString = ''
    for (let y = 0; y < DHASH_H; y++) {
      for (let x = 0; x < DHASH_W - 1; x++) {
        const i = (y * DHASH_W + x) * 4
        const j = (y * DHASH_W + (x + 1)) * 4
        // Rec. 601 luma
        const left =
          0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)
        const right =
          0.299 * (data[j] ?? 0) + 0.587 * (data[j + 1] ?? 0) + 0.114 * (data[j + 2] ?? 0)
        bitString += left > right ? '1' : '0'
      }
    }
    // 8 rows × 8 comparisons = 64 bits → 16 hex chars
    let hex = ''
    for (let i = 0; i < bitString.length; i += 4) {
      hex += Number.parseInt(bitString.slice(i, i + 4), 2).toString(16)
    }
    return hex.padStart(16, '0')
  } finally {
    if (ownsBitmap) (bitmap as ImageBitmap).close()
  }
}

/**
 * Variance Laplacian sur un sample carré 256×256 grayscale.
 * Convolution kernel [0,1,0; 1,-4,1; 0,1,0].
 * Si variance < BLUR_VARIANCE_THRESHOLD → la photo est considérée floue.
 */
export async function detectBlurry(source: ImageBitmap | Blob): Promise<boolean> {
  const bitmap =
    'width' in source
      ? source
      : await createImageBitmap(source, {
          imageOrientation: 'from-image',
        } as ImageBitmapOptions)
  const ownsBitmap = !('width' in source)

  try {
    const w = BLUR_SAMPLE_DIM
    const h = BLUR_SAMPLE_DIM
    const canvas = getOffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
    if (!ctx) throw new Error('2D context unavailable')
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    // Build grayscale buffer
    const gray = new Float32Array(w * h)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)
    }

    // Apply Laplacian kernel, accumulate sum + sum² for variance.
    // Float32Array index access est `number | undefined` sous noUncheckedIndexedAccess
    // → on défausse par 0 (la boucle reste in-bounds par construction).
    let sum = 0
    let sumSq = 0
    let count = 0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        const up = gray[i - w] ?? 0
        const left = gray[i - 1] ?? 0
        const right = gray[i + 1] ?? 0
        const down = gray[i + w] ?? 0
        const center = gray[i] ?? 0
        const v = up + left + right + down - 4 * center
        sum += v
        sumSq += v * v
        count++
      }
    }
    const mean = sum / count
    const variance = sumSq / count - mean * mean
    return variance < BLUR_VARIANCE_THRESHOLD
  } finally {
    if (ownsBitmap) (bitmap as ImageBitmap).close()
  }
}

// ============================================
// Pipeline complet
// ============================================

/**
 * Pré-traite une photo terrain en une passe :
 *   - compresse en JPEG ≤ 1600px q=0.8
 *   - thumbnail ≤ 200px q=0.7
 *   - dHash perceptuel (16 hex)
 *   - détection floue (variance Laplacian)
 *
 * Performance cible : < 500ms sur iPhone récent pour photo 4032×3024.
 * Utilise un seul `createImageBitmap` réutilisé pour les 3 lectures pixels.
 */
export async function preprocessPhoto(file: File | Blob): Promise<PreprocessResult> {
  const capturedAt = Date.now()

  // Single decode reused for all downstream ops (compression + dHash + blur)
  const sourceBitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  } as ImageBitmapOptions)

  try {
    // 1. Compression
    const compressedCanvas = await drawCascade(sourceBitmap, COMPRESS_MAX_DIM)
    const compressedBlob = await canvasToBlob(compressedCanvas, 'image/jpeg', COMPRESS_QUALITY)

    // 2. Thumbnail (depuis la source d'origine — qualité supérieure que depuis le compressé)
    const thumbCanvas = await drawCascade(sourceBitmap, THUMBNAIL_MAX_DIM)
    const thumbnailBlob = await canvasToBlob(thumbCanvas, 'image/jpeg', THUMBNAIL_QUALITY)

    // 3. & 4. dHash + blur en parallèle (chacun re-tire l'ImageBitmap source)
    const [perceptualHash, isBlurry] = await Promise.all([
      computeDHash(sourceBitmap),
      detectBlurry(sourceBitmap),
    ])

    return {
      compressedBlob,
      thumbnailBlob,
      width: compressedCanvas.width,
      height: compressedCanvas.height,
      sizeBytes: compressedBlob.size,
      isBlurry,
      perceptualHash,
      capturedAt,
    }
  } finally {
    sourceBitmap.close()
  }
}
