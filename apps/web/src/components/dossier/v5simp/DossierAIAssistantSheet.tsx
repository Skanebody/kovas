'use client'

/**
 * DossierAIAssistantSheet — Chat IA Claude contextualisé sur le dossier en cours.
 *
 * Streaming SSE depuis /api/dossier/ai-chat :
 *   data: { type: 'delta', text }
 *   data: { type: 'done',  usage }
 *   data: { type: 'error', error }
 *
 * Modèle par défaut : claude-haiku-4-5 (rapide + bon marché pour chat).
 * Ton sobre, vouvoiement, pas d'emoji. Voir CLAUDE.md §9 + avatar-client.md.
 */

import { RotateCcw, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { BottomSheet, BottomSheetTitle } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface DossierAIAssistantSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ID du dossier — utilisé côté serveur pour charger le contexte. */
  dossierId: string
}

const WELCOME_MESSAGE: AIMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Bonjour, je suis votre assistant KOVAS. Je peux répondre à vos questions sur ce dossier (réglementation, cohérence des saisies, équipements). Que puis-je faire pour vous ?',
}

function uid(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function DossierAIAssistantSheet({
  open,
  onOpenChange,
  dossierId,
}: DossierAIAssistantSheetProps) {
  const [messages, setMessages] = useState<AIMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState<string>('')
  const [streaming, setStreaming] = useState<boolean>(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  // Scroll auto en bas à chaque nouveau message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  // Cleanup abort à la fermeture
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      setStreaming(false)
    }
  }, [open])

  const handleReset = useCallback((): void => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setMessages([WELCOME_MESSAGE])
    setInput('')
    setStreaming(false)
  }, [])

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = input.trim()
    if (!trimmed || streaming) return

    const userMsg: AIMessage = { id: uid(), role: 'user', content: trimmed }
    const assistantId = uid()
    const assistantMsg: AIMessage = { id: assistantId, role: 'assistant', content: '' }

    // Historique envoyé à Claude — exclut le message d'accueil hardcodé
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))
    const apiMessages = [...history, { role: 'user' as const, content: trimmed }]

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/dossier/ai-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          messages: apiMessages,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        const err = data.error ?? `HTTP ${response.status}`
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Erreur : ${err}` }
              : m,
          ),
        )
        toast.error("L'assistant a rencontré une erreur.")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse événements SSE : "data: {...}\n\n"
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const evt of events) {
          const line = evt.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue

          try {
            const parsed = JSON.parse(json) as
              | { type: 'delta'; text: string }
              | { type: 'done'; usage?: unknown }
              | { type: 'error'; error: string }

            if (parsed.type === 'delta') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.text }
                    : m,
                ),
              )
            } else if (parsed.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content || `Erreur : ${parsed.error}` }
                    : m,
                ),
              )
              toast.error("L'assistant a rencontré une erreur.")
            }
          } catch {
            // Ignore lignes malformées
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof Error ? err.message : 'Erreur réseau'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || `Erreur : ${message}` }
            : m,
        ),
      )
      toast.error(message)
    } finally {
      abortRef.current = null
      setStreaming(false)
    }
  }, [dossierId, input, messages, streaming])

  const canSend = input.trim().length > 0 && !streaming

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} maxHeight="85vh">
      <BottomSheetTitle>Assistant KOVAS</BottomSheetTitle>

      <div className="px-4 pb-4">
        <p className="text-[12px] text-ink-mute mb-3">
          Posez une question sur ce dossier (réglementation, cohérence des saisies, équipements).
        </p>

        <ul
          ref={listRef}
          className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1 mb-3"
          aria-live="polite"
          aria-busy={streaming}
        >
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                m.role === 'assistant'
                  ? 'rounded-lg border border-rule/50 bg-cream-deep/60 px-3 py-2 text-[13px] text-ink whitespace-pre-wrap'
                  : 'rounded-lg bg-navy text-paper px-3 py-2 text-[13px] ml-6 whitespace-pre-wrap'
              }
            >
              {m.content ? (
                m.content
              ) : (
                <span className="inline-flex items-center gap-1 text-ink-mute">
                  <span className="size-1.5 rounded-full bg-ink-mute animate-pulse" />
                  <span className="size-1.5 rounded-full bg-ink-mute animate-pulse [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-ink-mute animate-pulse [animation-delay:300ms]" />
                </span>
              )}
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSend()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question…"
            aria-label="Message à l'assistant KOVAS"
            disabled={streaming}
            maxLength={2000}
            className="flex-1 h-10 rounded-pill border border-rule bg-paper px-4 text-[13px] text-ink placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:opacity-60"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Envoyer"
            disabled={!canSend}
          >
            <Send className="size-4" />
          </Button>
        </form>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={streaming}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute hover:text-ink disabled:opacity-50"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            Effacer la conversation
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
