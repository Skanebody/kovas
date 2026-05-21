'use client'

/**
 * Chat IA réglementaire (RAG sur regulatory_documents).
 *
 * Stream SSE depuis /api/regulatory/ai-chat. Le protocole SSE attendu :
 *   event: token      data: { delta: string }
 *   event: citation   data: { document_id, title, doc_type, published_at }
 *   event: usage      data: { input_tokens, output_tokens, cost_eur, ai_model }
 *   event: done       data: { ok: true }
 *   event: error      data: { error, detail? }
 *
 * Tolérant : si l'Edge Function envoie uniquement des "data: <text>" plain
 * (pas d'event:), on les append au token courant. Évite de casser si le
 * format évolue.
 *
 * Historique : persisté dans localStorage par sessionId (UUID v4 random).
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FaqAnswer } from '@/components/faq-answer'
import { Loader2, Send, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

const STORAGE_PREFIX = 'kovas.regulatory.chat.'

interface Citation {
  document_id: string
  title: string
  doc_type?: string
  published_at?: string | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  /** Streaming en cours (assistant only). */
  isStreaming?: boolean
  /** Erreur de stream — affichée inline. */
  error?: string | null
}

interface PersistedSession {
  sessionId: string
  messages: ChatMessage[]
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback non cryptographique — uniquement pour identifiant local.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function loadSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null
  // V1 : on garde une seule session active. Pour multi-session, étendre ici.
  const sessionIdRaw = window.localStorage.getItem(`${STORAGE_PREFIX}current`)
  if (!sessionIdRaw) return null
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${sessionIdRaw}`)
  if (!raw) return { sessionId: sessionIdRaw, messages: [] }
  try {
    const parsed = JSON.parse(raw) as { messages: ChatMessage[] }
    return { sessionId: sessionIdRaw, messages: parsed.messages ?? [] }
  } catch {
    return { sessionId: sessionIdRaw, messages: [] }
  }
}

function persistSession(sessionId: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}current`, sessionId)
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${sessionId}`,
      JSON.stringify({ messages }),
    )
  } catch {
    // Quota dépassé ou storage indisponible : silencieux.
  }
}

interface RegulatoryAIChatProps {
  /** Si vrai, layout modal flottant compact. Sinon plein écran. */
  variant?: 'modal' | 'page'
  onClose?: () => void
  /** Optionnel : contexte mission pour orienter les retrievals côté serveur. */
  missionContext?: { dossierId?: string; currentField?: string }
}

export function RegulatoryAIChat({
  variant = 'page',
  onClose,
  missionContext,
}: RegulatoryAIChatProps) {
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Initialisation : reprise ou nouvelle session.
  useEffect(() => {
    const existing = loadSession()
    if (existing && existing.sessionId) {
      setSessionId(existing.sessionId)
      setMessages(existing.messages)
    } else {
      const next = uuid()
      setSessionId(next)
      persistSession(next, [])
    }
  }, [])

  // Persistance à chaque update.
  useEffect(() => {
    if (!sessionId) return
    persistSession(sessionId, messages)
  }, [sessionId, messages])

  // Auto-scroll bas.
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  // Cleanup stream en cours si unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleReset = useCallback(() => {
    abortRef.current?.abort()
    const next = uuid()
    setSessionId(next)
    setMessages([])
    persistSession(next, [])
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (trimmed.length === 0 || isSending || !sessionId) return

      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: trimmed,
      }
      const assistantMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: '',
        citations: [],
        isStreaming: true,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput('')
      setIsSending(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const resp = await fetch('/api/regulatory/ai-chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            missionContext: missionContext ?? undefined,
          }),
          signal: controller.signal,
        })

        if (!resp.ok || !resp.body) {
          const errText = await resp.text().catch(() => '')
          throw new Error(
            resp.status === 429
              ? '30 messages / heure maximum. Réessayez plus tard.'
              : errText.slice(0, 200) || `Erreur ${resp.status}`,
          )
        }

        await readStream(resp.body, assistantMsg.id, setMessages)
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
    [input, isSending, sessionId, missionContext],
  )

  const containerClass = useMemo(() => {
    if (variant === 'modal') {
      return 'fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] max-h-[80vh] flex flex-col'
    }
    return 'flex flex-col h-[calc(100vh-180px)] max-h-[800px]'
  }, [variant])

  return (
    <div className={containerClass}>
      <Card variant="flat" padding="none" className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-rule">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden
              className="size-8 rounded-full bg-[#0F1419] text-white flex items-center justify-center shrink-0"
            >
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink leading-tight">
                Assistant veille KOVAS
              </p>
              <p className="text-[11px] text-ink-faint">
                Réglementation diagnostic — Claude + RAG
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSending}
            >
              Nouvelle session
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fermer"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Historique */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-ink-mute text-[13px] py-12 max-w-md mx-auto">
              <p className="font-serif italic text-2xl text-ink mb-2">Posez votre question.</p>
              <p>
                Exemple : « Quelle est la durée de validité d'un DPE résidentiel ? » ou
                « Quels équipements sont concernés par le diagnostic amiante ? »
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-rule p-3 flex items-end gap-2 bg-paper"
        >
          <label htmlFor="reg-chat-input" className="sr-only">
            Votre question
          </label>
          <textarea
            id="reg-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ;(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
              }
            }}
            placeholder="Posez votre question réglementaire…"
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
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Bubble
// ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-[#0F1419] text-white px-4 py-2.5 text-[13px] leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <div className="max-w-[92%] space-y-2">
        <div className="rounded-lg bg-sage-alt px-4 py-3 text-[13px] text-ink leading-relaxed">
          {message.content.length > 0 ? (
            <FaqAnswer markdown={message.content} />
          ) : message.isStreaming ? (
            <span className="inline-flex items-center gap-2 text-ink-mute">
              <Loader2 className="size-3.5 animate-spin" /> Réflexion…
            </span>
          ) : (
            <span className="text-ink-mute italic">Aucun contenu retourné.</span>
          )}
          {message.isStreaming && message.content.length > 0 && (
            <span className="inline-block w-1.5 h-4 align-middle bg-ink-faint ml-0.5 animate-pulse-soft" />
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {message.citations.map((c) => (
              <li key={c.document_id}>
                <Link
                  href={`/app/veille/${c.document_id}`}
                  className="inline-flex items-center gap-1 rounded-pill border border-rule bg-paper hover:bg-sage-alt px-2.5 py-1 text-[11px] text-ink transition-colors"
                >
                  <span className="font-mono uppercase tracking-[0.12em] text-[9px] text-ink-faint">
                    {c.doc_type ?? 'Doc'}
                  </span>
                  <span className="truncate max-w-[260px]">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {message.error && (
          <p className="text-[12px] text-accent-red">Erreur : {message.error}</p>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SSE reader
// ────────────────────────────────────────────────────────────

type SetMessagesFn = (updater: (prev: ChatMessage[]) => ChatMessage[]) => void

async function readStream(
  body: ReadableStream<Uint8Array>,
  assistantMsgId: string,
  setMessages: SetMessagesFn,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent: string = 'message'

  const appendToken = (delta: string): void => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + delta } : m)),
    )
  }

  const addCitation = (citation: Citation): void => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantMsgId) return m
        const existing = m.citations ?? []
        if (existing.some((c) => c.document_id === citation.document_id)) return m
        return { ...m, citations: [...existing, citation] }
      }),
    )
  }

  // SSE : events séparés par double newline, lignes "event:" / "data:" / "id:".
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sepIndex: number
    // biome-ignore lint/suspicious/noAssignInExpressions: pattern SSE classique
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      const lines = chunk.split('\n')
      let dataLines: string[] = []
      currentEvent = 'message'
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim())
        }
        // "id:" et autres : ignorés
      }
      const dataStr = dataLines.join('\n')
      if (dataStr.length === 0) continue

      // Tente JSON, fallback texte brut.
      let parsed: unknown = null
      try {
        parsed = JSON.parse(dataStr)
      } catch {
        // texte brut
      }

      if (currentEvent === 'token') {
        if (parsed && typeof parsed === 'object' && 'delta' in parsed) {
          const delta = (parsed as { delta: unknown }).delta
          if (typeof delta === 'string') appendToken(delta)
        } else if (typeof parsed === 'string') {
          appendToken(parsed)
        } else if (parsed === null) {
          appendToken(dataStr)
        }
      } else if (currentEvent === 'citation') {
        if (parsed && typeof parsed === 'object') {
          const p = parsed as Record<string, unknown>
          const documentId = typeof p.document_id === 'string' ? p.document_id : null
          const title = typeof p.title === 'string' ? p.title : ''
          if (documentId && title) {
            addCitation({
              document_id: documentId,
              title,
              doc_type: typeof p.doc_type === 'string' ? p.doc_type : undefined,
              published_at:
                typeof p.published_at === 'string' ? p.published_at : null,
            })
          }
        }
      } else if (currentEvent === 'error') {
        const msg =
          parsed && typeof parsed === 'object' && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : dataStr || 'Erreur du flux'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, error: msg, isStreaming: false } : m,
          ),
        )
      } else if (currentEvent === 'done') {
        // Stream terminé proprement — le caller set isStreaming=false.
      } else {
        // Event inconnu / "message" générique : on append en best effort si string.
        if (typeof parsed === 'string') {
          appendToken(parsed)
        } else if (parsed && typeof parsed === 'object' && 'delta' in parsed) {
          const delta = (parsed as { delta: unknown }).delta
          if (typeof delta === 'string') appendToken(delta)
        }
      }
    }
  }
}
