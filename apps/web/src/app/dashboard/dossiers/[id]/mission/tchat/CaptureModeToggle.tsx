'use client'

/**
 * KOVAS — CaptureModeToggle : bascule "Capture silencieuse / Conversation IA" (MISSION-H).
 *
 * Pillule sobre dans le header du tchat mission. Mémorise le choix par session
 * (persisté dans mission_sessions.captured_data.capture_mode via PATCH).
 *
 * Capture (défaut) : pas d'IA réactive — le diag dicte, ses messages restent là.
 * Conversation     : Claude répond à chaque message (mode legacy).
 *
 * Authority : brief MISSION-H lot 1 + design v5 sobre.
 */

import { cn } from '@/lib/utils'
import { MessageSquare, MicOff } from 'lucide-react'

export type CaptureMode = 'capture' | 'conversation'

interface CaptureModeToggleProps {
  mode: CaptureMode
  onModeChange: (mode: CaptureMode) => void
  disabled?: boolean
}

export function CaptureModeToggle({
  mode,
  onModeChange,
  disabled = false,
}: CaptureModeToggleProps): React.ReactElement {
  return (
    <fieldset
      aria-label="Mode de tchat mission"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill border border-[#0F1419]/[0.08] bg-paper p-0.5',
        'm-0',
      )}
    >
      <ToggleButton
        active={mode === 'capture'}
        onClick={() => onModeChange('capture')}
        disabled={disabled}
        icon={<MicOff className="size-3" aria-hidden />}
        label="Capture"
        title="Capture silencieuse — tes messages restent là, sans réponse IA. Idéal terrain."
      />
      <ToggleButton
        active={mode === 'conversation'}
        onClick={() => onModeChange('conversation')}
        disabled={disabled}
        icon={<MessageSquare className="size-3" aria-hidden />}
        label="Conversation"
        title="Conversation IA — l'assistant répond à chaque message. Pour les questions, l'onboarding."
      />
    </fieldset>
  )
}

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  disabled?: boolean
  icon: React.ReactElement
  label: string
  title: string
}

function ToggleButton({
  active,
  onClick,
  disabled,
  icon,
  label,
  title,
}: ToggleButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1',
        'font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
        active
          ? 'bg-[#0F1419] text-paper'
          : 'text-[#0F1419]/72 hover:text-[#0F1419] hover:bg-sage-alt',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
