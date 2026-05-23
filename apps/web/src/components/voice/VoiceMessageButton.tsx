'use client'

/**
 * KOVAS — VoiceMessageButton : bouton dynamique WhatsApp-like (micro/send/stop).
 *
 * Trois états visuels :
 *   - 'send'   : icône envoi (textarea non vide) → onSendText()
 *   - 'mic'    : icône micro (textarea vide, pas en enregistrement) → démarre dictée
 *   - 'stop'   : icône stop (enregistrement actif en mode tap-toggle) → arrête + envoie
 *
 * Deux interactions sur le micro (détection auto au pointerup) :
 *   - Mode A « tap to toggle » : pointerdown → pointerup < 200ms ET deltaX < 10px
 *       → reste en enregistrement, le bouton bascule en 'stop'.
 *       → tap suivant sur stop : arrête + envoie.
 *
 *   - Mode B « press and hold » : pointerdown → maintien > 200ms OU deltaX > 10px
 *       → l'enregistrement est déjà démarré (au pointerdown), l'utilisateur GARDE le doigt.
 *       Pendant le maintien :
 *         deltaX > -80  : normal (envoie au release)
 *         -80 ≥ deltaX > -150 : zone "Relâcher pour annuler" (overlay rouge)
 *         deltaX ≤ -150 : annulé (drop au release, vibration)
 *       Au pointerup : envoie OU annule selon zone atteinte.
 *
 * Haptics (navigator.vibrate) :
 *   - start record       : 30ms (feedback léger)
 *   - enter cancel zone  : 60ms (alerte tactile)
 *   - cancel confirmed   : 50ms
 *   - send               : aucun (pas de vibration sur succès)
 *
 * A11y :
 *   - aria-label dynamique sur le bouton
 *   - Espace = toggle mode A (clavier-only)
 *   - role="status" sur les changements d'état (géré par le parent overlay)
 *
 * Authority : design v5 — pas d'emoji UI, ton sobre, pillule navy/chartreuse.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Mic, Send, Square } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

export type VoiceButtonMode = 'idle' | 'tap-toggle' | 'press-hold' | 'press-hold-cancel'

export interface VoiceMessageButtonProps {
  /** True si du texte est dans le composer → bouton devient "send". */
  hasText: boolean
  /** True si un enregistrement est en cours (peu importe le mode). */
  isRecording: boolean
  /** Mode courant — utilisé pour switcher icône stop quand on est en tap-toggle. */
  mode: VoiceButtonMode
  /** Disabled (mission en pause OU IA en streaming OU support manquant). */
  disabled?: boolean

  // ─── Callbacks ───────────────────────────────────────────────────────
  /** Tap sur send (textarea non vide) → envoie le texte. */
  onSendText: () => void
  /** Démarrage enregistrement (au pointerdown). */
  onRecordStart: () => void
  /** Mise à jour live du mode (tap-toggle vs press-hold vs cancel). */
  onModeChange: (mode: VoiceButtonMode) => void
  /** Release confirmé : on envoie l'audio (transcript + blob). */
  onRecordCommit: () => void
  /** Release dans la zone cancel OU appel programmatique : on drop l'audio. */
  onRecordCancel: () => void
}

const HOLD_THRESHOLD_MS = 200
const MOVE_THRESHOLD_PX = 10
const CANCEL_ENTER_PX = -80
const CANCEL_COMMIT_PX = -150

export function VoiceMessageButton({
  hasText,
  isRecording,
  mode,
  disabled = false,
  onSendText,
  onRecordStart,
  onModeChange,
  onRecordCommit,
  onRecordCancel,
}: VoiceMessageButtonProps): React.ReactElement {
  const pointerDownAtRef = useRef<number>(0)
  const pointerStartXRef = useRef<number>(0)
  const pointerIdRef = useRef<number | null>(null)
  // True si le pointerup a confirmé le mode tap-toggle (on ne fait rien au release).
  const tapToggleCommittedRef = useRef<boolean>(false)
  // Anti double-trigger : après un pointerup qui bascule en tap-toggle, le
  // browser fire un événement click automatique → on doit l'ignorer sinon
  // handleClick commit immédiatement et l'enregistrement ne reste pas actif.
  const ignoreNextClickRef = useRef<boolean>(false)
  // Cache la dernière valeur pour cleanup au unmount sans dépendance instable.
  const modeRef = useRef<VoiceButtonMode>(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // ── Haptic helper (best-effort, ignore si non supporté) ─────────────
  const haptic = useCallback((ms: number): void => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    try {
      navigator.vibrate(ms)
    } catch {
      /* iOS Safari peut bloquer — best effort */
    }
  }, [])

  // ── State courant pour l'affichage ──────────────────────────────────
  // Priorité : isRecording > hasText > idle
  const visual: 'send' | 'stop' | 'mic' = isRecording
    ? mode === 'tap-toggle'
      ? 'stop'
      : 'mic' // press-hold = on garde le micro affiché car le doigt est dessus
    : hasText
      ? 'send'
      : 'mic'

  // ── PointerDown : démarre l'enregistrement OU envoie le texte ───────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return

      // Cas 1 : texte présent → envoyer le texte (tap simple)
      if (hasText && !isRecording) {
        // On laisse onClick gérer l'envoi (évite double-trigger)
        return
      }

      // Cas 2 : en cours d'enregistrement tap-toggle → tap sur stop
      if (isRecording && modeRef.current === 'tap-toggle') {
        // Idem : laisser onClick faire le stop+envoi
        return
      }

      // Cas 3 : on démarre un enregistrement
      e.preventDefault() // empêche focus/click pour pouvoir tracker le hold
      e.currentTarget.setPointerCapture(e.pointerId)
      pointerIdRef.current = e.pointerId
      pointerDownAtRef.current = performance.now()
      pointerStartXRef.current = e.clientX
      tapToggleCommittedRef.current = false
      haptic(30)
      onRecordStart()
      // On démarre en press-hold par défaut — sera converti en tap-toggle au pointerup si court+stable.
      onModeChange('press-hold')
    },
    [disabled, hasText, isRecording, onRecordStart, onModeChange, haptic],
  )

  // ── PointerMove : détecte la zone cancel pendant un press-hold ──────
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      if (!isRecording) return
      if (modeRef.current === 'tap-toggle') return // déjà passé en tap-toggle, plus de drag

      const deltaX = e.clientX - pointerStartXRef.current

      if (deltaX <= CANCEL_ENTER_PX && modeRef.current !== 'press-hold-cancel') {
        haptic(60)
        onModeChange('press-hold-cancel')
      } else if (deltaX > CANCEL_ENTER_PX && modeRef.current === 'press-hold-cancel') {
        // Le user est revenu vers la droite, on repasse en mode normal
        onModeChange('press-hold')
      }
    },
    [isRecording, onModeChange, haptic],
  )

  // ── PointerUp : décide tap-toggle vs commit vs cancel ───────────────
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      pointerIdRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* déjà relâché */
      }

      if (!isRecording) return // sécurité

      const heldMs = performance.now() - pointerDownAtRef.current
      const deltaX = e.clientX - pointerStartXRef.current
      const absDelta = Math.abs(deltaX)

      // Cas A : tap court + stable → bascule en mode tap-toggle (reste en enregistrement)
      // IMPORTANT : on flag ignoreNextClickRef car le browser fire un événement
      // click synthétique APRÈS ce pointerup → sans flag, handleClick voit
      // mode==='tap-toggle' et commit immédiatement (bug : enregistrement
      // s'arrête tout seul, et le tap suivant relance un nouveau recording).
      if (heldMs < HOLD_THRESHOLD_MS && absDelta < MOVE_THRESHOLD_PX) {
        tapToggleCommittedRef.current = true
        ignoreNextClickRef.current = true
        onModeChange('tap-toggle')
        return
      }

      // Cas B : press-hold release
      // → vérif si on est entré dans la zone "commit cancel"
      if (deltaX <= CANCEL_COMMIT_PX) {
        haptic(50)
        onRecordCancel()
        onModeChange('idle')
        return
      }

      // Cas C : press-hold release normal → on envoie
      onRecordCommit()
      onModeChange('idle')
    },
    [isRecording, onModeChange, onRecordCommit, onRecordCancel, haptic],
  )

  // ── PointerCancel (système annule, ex: appel téléphone) : drop ──────
  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      pointerIdRef.current = null
      if (isRecording && modeRef.current !== 'tap-toggle') {
        // Pas un tap-toggle commit → on drop pour éviter un envoi accidentel
        haptic(50)
        onRecordCancel()
        onModeChange('idle')
      }
    },
    [isRecording, onRecordCancel, onModeChange, haptic],
  )

  // ── Click : géré uniquement pour le cas "send text" et "stop tap-toggle" ─
  const handleClick = useCallback(() => {
    if (disabled) return
    // Ignore le click synthétique qui suit immédiatement un pointerup
    // ayant basculé en tap-toggle (sinon on commit instantanément).
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false
      return
    }
    if (isRecording && modeRef.current === 'tap-toggle') {
      // Stop + envoi (clic réel sur le bouton stop après que l'utilisateur
      // ait relâché son tap initial — c'est ici qu'on commit pour de vrai).
      onRecordCommit()
      onModeChange('idle')
      return
    }
    if (hasText && !isRecording) {
      onSendText()
    }
  }, [disabled, hasText, isRecording, onSendText, onRecordCommit, onModeChange])

  // ── Keyboard support : Space = toggle mode A (clavier-only) ─────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      if (disabled) return
      // En mode "send" : on laisse le click natif gérer (Enter/Space déclenche click)
      if (hasText && !isRecording) return
      // Sinon, on toggle tap-toggle
      e.preventDefault()
      if (isRecording && modeRef.current === 'tap-toggle') {
        onRecordCommit()
        onModeChange('idle')
      } else if (!isRecording) {
        haptic(30)
        onRecordStart()
        onModeChange('tap-toggle')
      }
    },
    [disabled, hasText, isRecording, onRecordCommit, onRecordStart, onModeChange, haptic],
  )

  // ── Render ──────────────────────────────────────────────────────────
  const ariaLabel =
    visual === 'send'
      ? 'Envoyer le message'
      : visual === 'stop'
        ? "Arrêter et envoyer l'enregistrement"
        : 'Démarrer la dictée vocale — tap pour basculer, maintenir pour parler'

  return (
    <Button
      type="button"
      // Visuellement : accent chartreuse quand send/stop, navy ghost en idle
      variant={visual === 'mic' ? 'default' : 'accent'}
      size="icon"
      aria-label={ariaLabel}
      aria-pressed={isRecording}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'shrink-0 size-11 rounded-full touch-none select-none',
        // touch-none évite que le navigateur intercepte le drag horizontal
        // (sinon iOS Safari peut scroller la page pendant le drag-to-cancel)
        visual === 'stop' && mode === 'press-hold-cancel' && 'bg-accent-red hover:bg-accent-red/90',
        visual === 'mic' && !isRecording && 'bg-ink text-paper hover:bg-ink/90',
      )}
    >
      {visual === 'send' ? (
        <Send className="size-4" aria-hidden />
      ) : visual === 'stop' ? (
        <Square className="size-4 fill-current" aria-hidden />
      ) : (
        <Mic className="size-4" aria-hidden />
      )}
    </Button>
  )
}
