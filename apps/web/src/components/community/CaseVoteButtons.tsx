'use client'

/**
 * <CaseVoteButtons> — upvote / downvote sur un cas communautaire.
 *
 *  - Animation subtle au click (scale-up 1.15 sur l'icône pressée)
 *  - Tooltip natif title="X votes positifs, Y votes négatifs"
 *  - Optimistic update + reconcile depuis la réponse API
 */

import { cn } from '@/lib/utils'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import { useCallback, useState } from 'react'

interface Props {
  caseId: string
  initialUp: number
  initialDown: number
}

interface ApiResponse {
  ok?: true
  net?: number
  upvotes?: number
  downvotes?: number
  error?: string
}

export function CaseVoteButtons({ caseId, initialUp, initialDown }: Props) {
  const [up, setUp] = useState(initialUp)
  const [down, setDown] = useState(initialDown)
  const [my, setMy] = useState<1 | -1 | 0>(0)
  const [pressed, setPressed] = useState<'up' | 'down' | null>(null)
  const [pending, setPending] = useState(false)

  const net = up - down

  const submit = useCallback(
    async (next: 1 | -1) => {
      if (pending) return
      const willToggle = my === next
      const desired: 1 | -1 | 0 = willToggle ? 0 : next
      setPending(true)
      setPressed(next === 1 ? 'up' : 'down')
      setTimeout(() => setPressed(null), 220)
      // Optimistic
      const prev = { up, down, my }
      if (willToggle) {
        if (my === 1) setUp((v) => Math.max(0, v - 1))
        if (my === -1) setDown((v) => Math.max(0, v - 1))
        setMy(0)
      } else {
        if (my === 1) setUp((v) => Math.max(0, v - 1))
        if (my === -1) setDown((v) => Math.max(0, v - 1))
        if (next === 1) setUp((v) => v + 1)
        else setDown((v) => v + 1)
        setMy(next)
      }
      try {
        const res = await fetch(`/api/community/cases/${caseId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: desired }),
        })
        const json = (await res.json().catch(() => ({}))) as ApiResponse
        if (!res.ok) {
          setUp(prev.up)
          setDown(prev.down)
          setMy(prev.my)
          return
        }
        if (typeof json.upvotes === 'number') setUp(json.upvotes)
        if (typeof json.downvotes === 'number') setDown(json.downvotes)
      } catch {
        setUp(prev.up)
        setDown(prev.down)
        setMy(prev.my)
      } finally {
        setPending(false)
      }
    },
    [caseId, my, up, down, pending],
  )

  const tip = `${up} vote${up > 1 ? 's' : ''} positif${up > 1 ? 's' : ''}, ${down} vote${
    down > 1 ? 's' : ''
  } négatif${down > 1 ? 's' : ''}`

  return (
    <div
      className="inline-flex items-center gap-1 rounded-pill border border-rule bg-paper p-1"
      title={tip}
    >
      <button
        type="button"
        onClick={() => submit(1)}
        disabled={pending}
        aria-pressed={my === 1}
        aria-label="Voter positivement"
        className={cn(
          'inline-flex items-center justify-center size-9 rounded-full transition-transform duration-150 ease-spring',
          'hover:bg-accent-green/15',
          my === 1 && 'bg-accent-green/15 text-accent-green',
          pressed === 'up' && 'scale-110',
        )}
      >
        <ArrowBigUp className="size-5" strokeWidth={2} />
      </button>
      <span
        className={cn(
          'min-w-[2.5rem] text-center font-mono font-semibold tabular-nums text-[13px]',
          net > 0 && 'text-accent-green',
          net < 0 && 'text-accent-red',
          net === 0 && 'text-ink-mute',
        )}
      >
        {net > 0 ? '+' : ''}
        {net}
      </span>
      <button
        type="button"
        onClick={() => submit(-1)}
        disabled={pending}
        aria-pressed={my === -1}
        aria-label="Voter négativement"
        className={cn(
          'inline-flex items-center justify-center size-9 rounded-full transition-transform duration-150 ease-spring',
          'hover:bg-accent-red/10',
          my === -1 && 'bg-accent-red/10 text-accent-red',
          pressed === 'down' && 'scale-110',
        )}
      >
        <ArrowBigDown className="size-5" strokeWidth={2} />
      </button>
    </div>
  )
}
