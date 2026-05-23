'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Step = 'idle' | 'requesting' | 'left' | 'right' | 'done' | 'error'

/**
 * Liveness capture — version dev simulée.
 *
 * En production (V2), ce composant invoquera Veriff SDK ou un provider
 * KYC similaire. Pour l'instant :
 *  1. Demande l'accès webcam (getUserMedia)
 *  2. Affiche le flux + instruction "Inclinez la tête à gauche"
 *  3. Après 3 secondes affiche "Inclinez la tête à droite"
 *  4. Après 3 secondes encore, marque OK et stocke un payload signé
 *
 * Le payload est posé dans un hidden input `liveness_payload` du form parent.
 */
export function LivenessCapture({ inputName = 'liveness_payload' }: { inputName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<string>('')

  useEffect(() => {
    return () => {
      for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    }
  }, [])

  async function startCapture() {
    setError(null)
    setStep('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStep('left')
      setTimeout(() => setStep('right'), 3000)
      setTimeout(() => {
        const challenge = {
          completed_at: new Date().toISOString(),
          challenges: ['head_left', 'head_right'],
          mode: 'dev_simulation',
        }
        setPayload(JSON.stringify(challenge))
        setStep('done')
        for (const track of streamRef.current?.getTracks() ?? []) track.stop()
      }, 6000)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Accès caméra refusé : ${err.message}`
          : "Impossible d'accéder à la caméra.",
      )
      setStep('error')
    }
  }

  const instruction =
    step === 'left'
      ? 'Inclinez la tête à gauche'
      : step === 'right'
        ? 'Inclinez la tête à droite'
        : step === 'done'
          ? 'Vérification du visage validée'
          : null

  return (
    <div className="space-y-3">
      <input type="hidden" name={inputName} value={payload} />
      <div className="rounded-2xl bg-[#0F1419]/[0.04] border border-[#0F1419]/[0.08] aspect-[4/3] overflow-hidden relative flex items-center justify-center">
        {step === 'idle' && (
          <div className="text-center px-4">
            <p className="text-[13px] text-[#0F1419]/60 mb-3">
              Vérification du visage en direct (anti-fraude). Pas d&apos;enregistrement vidéo
              conservé.
            </p>
            <Button type="button" variant="outline" onClick={startCapture}>
              Démarrer la vérification
            </Button>
          </div>
        )}
        {(step === 'requesting' || step === 'left' || step === 'right') && (
          <>
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-[#0F1419]/85 text-white text-center py-2 text-[13px] font-medium">
              {step === 'requesting' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Activation caméra
                </span>
              ) : (
                instruction
              )}
            </div>
          </>
        )}
        {step === 'done' && (
          <div className="text-center px-6">
            <div className="size-12 rounded-full bg-[#D4F542] text-[#0F1419] inline-flex items-center justify-center text-xl font-bold mb-2">
              ✓
            </div>
            <p className="text-[14px] font-semibold text-[#0F1419]">{instruction}</p>
            <p className="text-[12px] text-[#0F1419]/60 mt-1">Vous pouvez continuer le parcours.</p>
          </div>
        )}
        {step === 'error' && (
          <div
            className={cn(
              'text-center px-6 text-[13px]',
              'text-red-700 bg-red-50 size-full flex flex-col items-center justify-center',
            )}
          >
            <p className="font-semibold mb-2">Caméra inaccessible</p>
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={startCapture}
            >
              Réessayer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
