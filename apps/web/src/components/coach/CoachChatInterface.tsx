'use client'

/**
 * KOVAS — Interface de chat Coach IA (streaming SSE).
 *
 * Streame depuis /api/coach/stream. Protocole SSE (compatible avec
 * /api/dossier/ai-chat) :
 *   data: { type: 'delta', text: string }
 *   data: { type: 'done', usage?: {...}, conversationId?: string }
 *   data: { type: 'error', error: string }
 *
 * Avatar : SOBRE PROFESSIONNEL — vouvoiement, pas d'emoji, ton expert.
 */

import { Button } from '@/components/ui/button'
import { Loader2, Send } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  error?: string | null
}

interface InitialMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CoachChatInterfaceProps {
  conversationId: string | null
  initialMessages: readonly InitialMessage[]
  /** Suggestion de prompt cliquée — injectée dans le textarea. */
  prefilledPrompt?: string | null
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function CoachChatInterface({
  conversationId: initialConversationId,
  initialMessages,
  prefilledPrompt,
}: CoachChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
  )
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll bas à chaque nouveau message
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  // Cleanup à l'unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Injection prompt cliqué depuis la sidebar
  useEffect(() => {
    if (prefilledPrompt && prefilledPrompt.trim().length > 0) {
      setInput(prefilledPrompt)
    }
  }, [prefilledPrompt])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (trimmed.length === 0 || isSending) return

      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: trimmed,
      }
      const assistantMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput('')
      setIsSending(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const resp = await fetch('/api/coach/stream', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: trimmed,
          }),
          signal: controller.signal,
        })

        if (!resp.ok || !resp.body) {
          const errText = await resp.text().catch(() => '')
          throw new Error(errText.slice(0, 200) || `Erreur ${resp.status}`)
        }

        await readStream(resp.body, assistantMsg.id, setMessages, (newId) => {
          setConversationId(newId)
        })

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)),
        )
      } catch (err) {
        const message =
          err instanceof Error && err.name === 'AbortError'
            ? null
            : err instanceof Error
              ? err.message
              : 'Erreur inconnue'
        if (message !== null) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, isStreaming: false, error: message } : m,
            ),
          )
        }
      } finally {
        setIsSending(false)
        abortRef.current = null
      }
    },
    [conversationId, input, isSending],
  )

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[480px] rounded-xl border border-rule/60 bg-paper/85 shadow-glass-sm overflow-hidden">
      {/* Historique */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-ink-mute text-[13px] py-12 max-w-md mx-auto">
            <p className="font-serif italic text-2xl text-ink mb-2">
              Bonjour, je suis votre coach KOVAS.
            </p>
            <p>
              Posez-moi votre question sur votre activité, vos chiffres, votre productivité ou la
              réglementation. Je vais analyser votre contexte et vous proposer des pistes concrètes.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <CoachMessageBubble key={m.id} message={m} />
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-rule/40 p-3 flex items-end gap-2 bg-paper"
      >
        <label htmlFor="coach-chat-input" className="sr-only">
          Votre question
        </label>
        <textarea
          id="coach-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ;(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
            }
          }}
          placeholder="Posez votre question au Coach IA…"
          rows={1}
          disabled={isSending}
          className="flex-1 resize-none rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/10 max-h-32"
        />
        <Button
          type="submit"
          disabled={isSending || input.trim().length === 0}
          aria-label="Envoyer"
        >
          {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  )
}

function CoachMessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-[#0F1419] text-white px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <div className="max-w-[92%] space-y-2">
        <div className="rounded-lg bg-sage-alt px-4 py-3 text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
          {message.content.length > 0 ? (
            message.content
          ) : message.isStreaming ? (
            <span className="inline-flex items-center gap-2 text-ink-mute">
              <Loader2 className="size-3.5 animate-spin" /> Analyse en cours…
            </span>
          ) : (
            <span className="text-ink-mute italic">Aucun contenu retourné.</span>
          )}
          {message.isStreaming && message.content.length > 0 && (
            <span className="inline-block w-1.5 h-4 align-middle bg-ink-faint ml-0.5 animate-pulse" />
          )}
        </div>
        {message.error && <p className="text-[12px] text-accent-red">Erreur : {message.error}</p>}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SSE reader
// ────────────────────────────────────────────────────────────

type SetMessagesFn = (updater: (prev: ChatMessage[]) => ChatMessage[]) => void

interface StreamPayload {
  type?: string
  text?: string
  error?: string
  conversationId?: string
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  assistantMsgId: string,
  setMessages: SetMessagesFn,
  onConversationId: (id: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const appendText = (delta: string): void => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + delta } : m)),
    )
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    // biome-ignore lint/suspicious/noAssignInExpressions: pattern SSE classique
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const lines = chunk.split('\n')
      const dataLines: string[] = []
      for (const line of lines) {
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      const data = dataLines.join('\n')
      if (data.length === 0) continue

      let parsed: StreamPayload | null = null
      try {
        parsed = JSON.parse(data) as StreamPayload
      } catch {
        // ignore malformed chunks
      }
      if (!parsed) continue

      if (parsed.type === 'delta' && typeof parsed.text === 'string') {
        appendText(parsed.text)
      } else if (parsed.type === 'done') {
        if (typeof parsed.conversationId === 'string') {
          onConversationId(parsed.conversationId)
        }
      } else if (parsed.type === 'error' && typeof parsed.error === 'string') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, error: parsed?.error ?? 'erreur', isStreaming: false }
              : m,
          ),
        )
      }
    }
  }
}
