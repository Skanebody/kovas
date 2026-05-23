'use client'

/**
 * KOVAS — Interface conversationnelle mode mission tchat IA (refonte FIX-MM).
 *
 * UI inspirée ChatGPT/WhatsApp/Claude :
 *  - Bulles asymétriques (user droite chartreuse, assistant gauche paper)
 *  - Streaming SSE Claude Haiku 4.5 (caractères qui apparaissent progressivement)
 *  - Markdown rendu inline (gras, italique, listes, code, links)
 *  - Indicateur typing 3 dots animé avant le 1er token
 *  - Quick replies contextuelles (3-4 boutons qui changent selon contexte)
 *  - Web Speech API pour dictée (Chrome/Edge)
 *  - Capture photo via input file capture=environment
 *  - Auto-scroll bottom + bouton "voir nouveau message" si scrolled up
 *  - Header sticky avec stats + bouton pause + menu
 *
 * Branchement IA :
 *  - POST /api/mission/[dossierId]/chat/stream
 *  - Body { sessionId, message }
 *  - SSE events: delta / done / error
 *  - Persistence: messages stockés en DB mission_chat_messages
 *  - Captures: [CAPTURE: ...] parsés côté serveur, stockés mission_session_captures
 *
 * Authority : CLAUDE.md §3 features 1 + DISCOVERY tchat IA + FIX-MM.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type SpeechRecognitionController,
  createSpeechRecognition,
} from '@/lib/voice/speech-recognition'
import {
  ArrowDown,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  MoreVertical,
  Pause,
  Send,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ExistingRoom {
  id: string
  name: string
  roomType: string | null
  surfaceM2: number | null
}

interface InitialChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

interface MissionTchatInterfaceProps {
  dossierId: string
  reference: string
  clientName: string
  fullAddress: string
  sessionId: string
  sessionStartedAt: string
  sessionPausedAt: string | null
  existingRooms: ExistingRoom[]
  initialStats: { photos: number; voiceNotes: number }
  propertyMeta: { surface: number | null; yearBuilt: number | null } | null
  initialChatHistory: InitialChatMessage[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** Si la réponse user a été transcrite via Web Speech API. */
  isVoice?: boolean
  /** Photo URL temporaire (objectURL) si message est une photo. */
  photoUrl?: string
  /** Indique si ce message assistant est encore en cours de streaming. */
  streaming?: boolean
}

type ConversationPhase = 'start' | 'mid' | 'end'

// -----------------------------------------------------------------------------
// Markdown renderer ultra-light (pas de dépendance externe)
// -----------------------------------------------------------------------------

interface MarkdownInlineProps {
  text: string
}

/**
 * Mini parser markdown inline : **gras**, *italique*, `code`, [lien](url).
 * Suffisant pour les réponses IA terrain.
 */
function MarkdownInline({ text }: MarkdownInlineProps): React.ReactElement {
  // On utilise un parser regex en plusieurs passes pour produire un array
  // de nodes React. C'est volontairement simple — pas de tables, pas
  // d'images, pas de HTML inline. Robuste pour les réponses IA terrain.
  type Node = { type: 'text' | 'bold' | 'italic' | 'code' | 'link'; value: string; href?: string }
  const nodes: Node[] = []
  const remaining = text
  const re = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = re.exec(remaining)) !== null) {
    if (m.index > lastIdx) {
      nodes.push({ type: 'text', value: remaining.slice(lastIdx, m.index) })
    }
    const matched = m[0]
    if (matched.startsWith('**') && matched.endsWith('**')) {
      nodes.push({ type: 'bold', value: matched.slice(2, -2) })
    } else if (matched.startsWith('*') && matched.endsWith('*')) {
      nodes.push({ type: 'italic', value: matched.slice(1, -1) })
    } else if (matched.startsWith('`') && matched.endsWith('`')) {
      nodes.push({ type: 'code', value: matched.slice(1, -1) })
    } else if (matched.startsWith('[')) {
      const closeBracket = matched.indexOf(']')
      const openParen = matched.indexOf('(', closeBracket)
      const closeParen = matched.lastIndexOf(')')
      const label = matched.slice(1, closeBracket)
      const href = matched.slice(openParen + 1, closeParen)
      nodes.push({ type: 'link', value: label, href })
    }
    lastIdx = m.index + matched.length
  }
  if (lastIdx < remaining.length) {
    nodes.push({ type: 'text', value: remaining.slice(lastIdx) })
  }

  return (
    <>
      {nodes.map((n, i) => {
        const key = `${n.type}-${i}`
        if (n.type === 'bold') return <strong key={key}>{n.value}</strong>
        if (n.type === 'italic') return <em key={key}>{n.value}</em>
        if (n.type === 'code') {
          return (
            <code
              key={key}
              className="font-mono text-[0.9em] bg-ink/10 px-1.5 py-0.5 rounded text-ink"
            >
              {n.value}
            </code>
          )
        }
        if (n.type === 'link' && n.href) {
          return (
            <a
              key={key}
              href={n.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-chartreuse-deep underline underline-offset-2 hover:text-chartreuse"
            >
              {n.value}
            </a>
          )
        }
        return <span key={key}>{n.value}</span>
      })}
    </>
  )
}

/**
 * Découpe le markdown en lignes + détecte les blocs liste / paragraphes.
 * Très basique mais lisible pour les réponses Claude métier.
 */
function MarkdownBlock({ content }: { content: string }): React.ReactElement {
  const lines = content.split('\n')
  const blocks: React.ReactElement[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i += 1
      continue
    }

    // Liste à puces
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i += 1
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="my-1.5 ml-4 list-disc space-y-1">
          {items.map((it) => (
            <li key={`li-${it.slice(0, 20)}`}>
              <MarkdownInline text={it} />
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // Liste numérotée
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i += 1
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="my-1.5 ml-5 list-decimal space-y-1">
          {items.map((it) => (
            <li key={`oli-${it.slice(0, 20)}`}>
              <MarkdownInline text={it} />
            </li>
          ))}
        </ol>,
      )
      continue
    }

    // Header H3
    if (/^###\s+/.test(line)) {
      blocks.push(
        <h4 key={`h-${key++}`} className="mt-2 mb-1 text-[14px] font-semibold text-ink">
          <MarkdownInline text={line.replace(/^###\s+/, '')} />
        </h4>,
      )
      i += 1
      continue
    }

    // Paragraphe — agrège lignes consécutives
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^###\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i])
      i += 1
    }
    if (paragraph.length > 0) {
      blocks.push(
        <p key={`p-${key++}`} className="my-1 leading-relaxed">
          <MarkdownInline text={paragraph.join(' ')} />
        </p>,
      )
    }
  }

  return <>{blocks}</>
}

// -----------------------------------------------------------------------------
// Quick replies contextuelles
// -----------------------------------------------------------------------------

interface QuickReply {
  label: string
  message: string
}

function getQuickReplies(phase: ConversationPhase, lastAssistantText: string): QuickReply[] {
  // Phase début (peu de captures) — questions méthodo
  if (phase === 'start') {
    return [
      { label: 'Par où commencer ?', message: 'Par où dois-je commencer le travail ?' },
      {
        label: 'Ordre des pièces',
        message: 'Quel ordre optimal pour parcourir les pièces ?',
      },
      { label: 'Combien de temps ?', message: 'Combien de temps prévoir pour ce diagnostic ?' },
      {
        label: 'Points de vigilance',
        message: 'Quels sont les points de vigilance principaux sur ce bien ?',
      },
    ]
  }
  // Phase fin — wrap-up
  if (phase === 'end') {
    return [
      { label: 'Récapitulatif', message: 'Faites-moi un récapitulatif des pièces saisies.' },
      { label: 'Manque-t-il quelque chose ?', message: 'Manque-t-il des données importantes ?' },
      { label: 'Préparer export', message: "Comment préparer l'export pour Liciel ?" },
      { label: 'Vérifier la cohérence', message: 'Vérifiez la cohérence des données saisies.' },
    ]
  }
  // Phase mid — actions contextuelles
  const lower = lastAssistantText.toLowerCase()
  if (lower.includes('pièce') || lower.includes('salon') || lower.includes('cuisine')) {
    return [
      { label: 'Photo de cette pièce', message: 'Je viens de prendre une photo de cette pièce.' },
      { label: 'Pièce suivante', message: 'Passons à la pièce suivante.' },
      { label: 'Vérifier surface', message: 'Comment vérifier la surface au sol précisément ?' },
      { label: 'Ajouter équipement', message: 'Comment renseigner les équipements de la pièce ?' },
    ]
  }
  return [
    { label: 'Continuer', message: 'On continue, pièce suivante.' },
    { label: 'Pause méthodo', message: 'Rappelle-moi la méthode pour ce type de mesure.' },
    { label: 'Photo prise', message: "J'ai pris une photo." },
    { label: 'Récap en cours', message: "Récapitule ce qu'on a déjà saisi." },
  ]
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function MissionTchatInterface({
  dossierId,
  reference,
  clientName,
  fullAddress,
  sessionId,
  sessionStartedAt: _sessionStartedAt,
  sessionPausedAt: _sessionPausedAt,
  existingRooms,
  initialStats,
  propertyMeta: _propertyMeta,
  initialChatHistory,
}: MissionTchatInterfaceProps) {
  const router = useRouter()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ----- State principal -----
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialChatHistory.length > 0) {
      return initialChatHistory.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt).getTime(),
      }))
    }
    // Message d'accueil bootstrap
    return [
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant' as const,
        content:
          existingRooms.length > 0
            ? `Bonjour. ${existingRooms.length} pièce${existingRooms.length > 1 ? 's' : ''} déjà saisie${existingRooms.length > 1 ? 's' : ''} dans ce dossier. On peut reprendre où vous en étiez, ou attaquer une nouvelle pièce. **Que souhaitez-vous faire ?**`
            : `Bonjour Benjamin. Je suis votre assistant terrain pour cette mission chez **${clientName}**. Je peux vous **guider pas à pas**, **répondre à vos questions métier** (méthodo, réglementation, particularités du bien), et **enregistrer vos données** au fur et à mesure.\n\nDites-moi simplement par où vous voulez commencer, ou posez-moi une question.`,
        createdAt: Date.now(),
      },
    ]
  })
  const [input, setInput] = useState<string>('')
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [stats, setStats] = useState(initialStats)
  const [roomsSaved, setRoomsSaved] = useState<number>(existingRooms.length)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ----- Online / offline -----
  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateOnline = (): void => setIsOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  // ----- Auto-scroll bottom (mais pas si user a scroll up volontairement) -----
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  useEffect(() => {
    // Auto-scroll uniquement si proche du bas
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 200) {
      scrollToBottom('smooth')
    } else {
      setShowScrollToBottom(true)
    }
  }, [scrollToBottom])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const onScroll = (): void => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight
      setShowScrollToBottom(distance > 200)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  // ----- Auto-resize textarea -----
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const newHeight = Math.min(ta.scrollHeight, 180) // max 180px ~ 6 lignes
    ta.style.height = `${newHeight}px`
  }, [])

  // ----- Speech Recognition -----
  const startListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.abort()
    const ctrl = createSpeechRecognition({
      lang: 'fr-FR',
      continuous: false,
      interimResults: true,
      onResult: ({ interim, final }) => {
        setInput(final.length > 0 ? final : interim)
      },
      onError: (err) => {
        setIsListening(false)
        if (err === 'not-allowed') {
          setErrorMsg("Autorisez l'accès au micro dans les réglages du navigateur pour la dictée.")
        }
      },
      onEnd: () => setIsListening(false),
    })
    if (!ctrl.isSupported) {
      setErrorMsg(
        'Reconnaissance vocale non supportée par ce navigateur — utilisez Chrome/Edge ou tapez votre réponse.',
      )
      return
    }
    ctrl.start()
    recognitionRef.current = ctrl
    setIsListening(true)
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsListening(false)
  }, [])

  // ----- Streaming IA -----
  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || isStreaming) return

      setErrorMsg(null)

      // Insère le user message immédiatement
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: Date.now(),
        isVoice: isListening,
      }

      // Prépare un placeholder assistant streaming
      const assistantId = `assistant-${Date.now() + 1}`
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now() + 1,
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
      setInput('')
      setIsStreaming(true)

      try {
        const res = await fetch(`/api/mission/${dossierId}/chat/stream`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text }),
        })
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''
        let capturesCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Découpe SSE par lignes "data: ...\n\n"
          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const jsonStr = trimmed.slice(5).trim()
            try {
              const payload = JSON.parse(jsonStr) as {
                type: string
                text?: string
                error?: string
                captures?: Array<{ type: string }>
              }
              if (payload.type === 'delta' && typeof payload.text === 'string') {
                // On filtre les fragments [CAPTURE: ...] côté client (ils peuvent
                // arriver progressivement et ne doivent pas s'afficher).
                accumulated += payload.text
                const cleaned = accumulated.replace(/\[CAPTURE:[^\]]*\]?/gi, '')
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: cleaned, streaming: true } : m,
                  ),
                )
              } else if (payload.type === 'done') {
                capturesCount = payload.captures?.length ?? 0
                // Le contenu final est déjà nettoyé côté serveur dans le content
                // de mission_chat_messages. On retire les éventuels [CAPTURE: …]
                // restants côté client (si streaming partiel).
                const finalClean = accumulated.replace(/\[CAPTURE:[^\]]*\]/gi, '').trim()
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: finalClean, streaming: false } : m,
                  ),
                )
                if (capturesCount > 0) {
                  // Incrémente le compteur de rooms si une capture room est arrivée
                  const hasRoom = payload.captures?.some((c) => c.type === 'room')
                  if (hasRoom) setRoomsSaved((r) => r + 1)
                  const hasPhoto = payload.captures?.some((c) => c.type === 'photo_taken')
                  if (hasPhoto) setStats((s) => ({ ...s, photos: s.photos + 1 }))
                }
              } else if (payload.type === 'error') {
                setErrorMsg(payload.error ?? 'Erreur de streaming')
                setMessages((prev) => prev.filter((m) => m.id !== assistantId))
              }
            } catch {
              // ligne SSE corrompue — on ignore
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur réseau'
        setErrorMsg(msg)
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setIsStreaming(false)
        scrollToBottom('smooth')
      }
    },
    [dossierId, sessionId, isListening, isStreaming, scrollToBottom],
  )

  // ----- Submit -----
  const handleSubmit = useCallback(() => {
    if (!input.trim()) return
    void sendMessage(input)
  }, [input, sendMessage])

  // ----- Photo -----
  const handlePhotoClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handlePhotoCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      const msg: ChatMessage = {
        id: `photo-${Date.now()}`,
        role: 'user',
        content: 'Photo prise',
        createdAt: Date.now(),
        photoUrl: url,
      }
      setMessages((prev) => [...prev, msg])
      setStats((s) => ({ ...s, photos: s.photos + 1 }))
      // Envoie un message à l'IA pour la prévenir
      void sendMessage(
        'Je viens de prendre une photo. Quels angles complémentaires conseillez-vous ?',
      )
      e.target.value = ''
    },
    [sendMessage],
  )

  // ----- Pause -----
  const handlePause = useCallback(async () => {
    setIsPaused(true)
    try {
      await fetch(`/api/dossiers/${dossierId}/actions/pause_mission`, { method: 'POST' })
    } catch {
      // Offline — sera sync plus tard
    }
  }, [dossierId])

  // ----- Phase conversation pour quick replies -----
  const phase: ConversationPhase = useMemo(() => {
    if (roomsSaved === 0 && messages.filter((m) => m.role === 'user').length < 2) return 'start'
    if (roomsSaved >= 4) return 'end'
    return 'mid'
  }, [roomsSaved, messages])

  const quickReplies = useMemo(() => {
    const lastAssistant = messages.filter((m) => m.role === 'assistant').slice(-1)[0]
    return getQuickReplies(phase, lastAssistant?.content ?? '')
  }, [phase, messages])

  // ----- Render -----
  return (
    <>
      {/* Header sticky 56px */}
      <header className="relative flex h-14 items-center justify-between gap-3 border-b border-rule/70 bg-paper/95 px-3 sm:px-5 backdrop-blur-md shrink-0 z-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Quitter le mode mission"
            className="shrink-0 size-9"
          >
            <Link href={`/dashboard/dossiers/${dossierId}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
              <span>{reference}</span>
            </div>
            <p className="text-[13px] font-semibold text-ink truncate leading-tight">
              {clientName}
              <span className="hidden sm:inline ml-2 font-normal text-ink-mute">
                · {fullAddress}
              </span>
            </p>
          </div>
        </div>

        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-3 font-mono text-[11px] text-ink-mute">
          <span>
            {roomsSaved} pièce{roomsSaved > 1 ? 's' : ''} saisie{roomsSaved > 1 ? 's' : ''}
          </span>
          <span className="size-1 rounded-full bg-ink-mute/40" aria-hidden />
          <span>
            {stats.photos} photo{stats.photos > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isOnline ? (
            <span
              className="inline-flex items-center gap-1 rounded-pill bg-accent-warm-soft px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-accent-warm"
              title="Hors ligne — messages mis en file d'attente"
            >
              <WifiOff className="size-3" />
              <span className="hidden sm:inline">Hors ligne</span>
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePause}
            disabled={isPaused}
            aria-label="Mettre en pause"
            className="size-9"
          >
            <Pause className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Menu mission"
            className="size-9"
          >
            <MoreVertical className="size-4" />
          </Button>
        </div>
      </header>

      {/* Bandeau mobile adresse */}
      <div className="md:hidden border-b border-rule/40 bg-paper/80 px-4 py-1.5 shrink-0">
        <p className="text-[11px] text-ink-mute truncate">
          {roomsSaved} pièce{roomsSaved > 1 ? 's' : ''} · {stats.photos} photo
          {stats.photos > 1 ? 's' : ''} · {fullAddress}
        </p>
      </div>

      {/* Zone messages scrollable */}
      <div
        ref={messagesContainerRef}
        className="relative flex-1 overflow-y-auto bg-sage scroll-smooth"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="mx-auto max-w-3xl px-3 sm:px-6 py-4 pb-6 space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {errorMsg ? (
            <div className="mx-auto max-w-md rounded-lg border border-accent-red/30 bg-accent-red/5 px-3 py-2 text-[13px] text-accent-red">
              {errorMsg}
            </div>
          ) : null}
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {showScrollToBottom ? (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-3 py-1.5 text-[12px] font-medium text-ink shadow-glass-sm hover:bg-sage-alt transition-colors"
            aria-label="Voir les nouveaux messages"
          >
            <ArrowDown className="size-3.5" />
            Nouveaux messages
          </button>
        ) : null}
      </div>

      {/* Quick replies contextuelles */}
      <div className="border-t border-rule/40 bg-paper/60 px-3 sm:px-6 py-2 shrink-0 overflow-x-auto">
        <div className="mx-auto max-w-3xl flex items-center gap-2 min-w-fit">
          {quickReplies.map((qr) => (
            <button
              key={qr.label}
              type="button"
              onClick={() => void sendMessage(qr.message)}
              disabled={isStreaming || isPaused}
              className={cn(
                'shrink-0 rounded-pill border border-rule bg-paper px-3 py-1.5',
                'text-[12px] font-medium text-ink',
                'hover:bg-sage-alt hover:border-ink/30 transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {qr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar sticky bottom */}
      <div className="border-t border-rule/70 bg-paper px-3 sm:px-5 py-3 shrink-0">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePhotoClick}
            aria-label="Prendre une photo"
            className="shrink-0 size-10 rounded-full"
            disabled={isPaused}
          >
            <Camera className="size-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
            aria-hidden
          />

          <Button
            type="button"
            variant={isListening ? 'accent' : 'ghost'}
            size="icon"
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée vocale'}
            className="shrink-0 size-10 rounded-full"
            disabled={isPaused || isStreaming}
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // Auto-resize
              const ta = e.currentTarget
              ta.style.height = 'auto'
              ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              } else if (e.key === 'Escape') {
                setInput('')
              }
            }}
            placeholder={
              isListening
                ? 'Parlez maintenant…'
                : isStreaming
                  ? "L'assistant rédige sa réponse…"
                  : 'Tapez votre message — ou utilisez le micro'
            }
            disabled={isStreaming || isPaused}
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-2xl border border-rule bg-sage-alt/40 px-4 py-2.5',
              'text-[14px] text-ink placeholder:text-ink-mute',
              'focus:outline-none focus:ring-2 focus:ring-chartreuse/40 focus:border-chartreuse/50',
              'disabled:opacity-50 transition-colors',
              'min-h-[40px] max-h-[180px]',
            )}
            aria-label="Votre message"
          />

          <Button
            type="button"
            variant="accent"
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming || isPaused}
            aria-label="Envoyer"
            className="shrink-0 size-10 rounded-full"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <div className="mx-auto max-w-3xl mt-1.5 flex items-center justify-between text-[10px] font-mono text-ink-mute">
          <span>Entrée pour envoyer · Maj+Entrée pour saut de ligne</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => router.push(`/dashboard/dossiers/${dossierId}`)}
            className="text-[10px] font-mono text-ink-mute hover:text-ink h-auto p-0"
          >
            Quitter la mission
          </Button>
        </div>
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------
// MessageBubble
// -----------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }): React.ReactElement {
  const isAssistant = message.role === 'assistant'
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="my-2 flex items-center justify-center gap-1.5">
        <CheckCircle2 className="size-3 text-chartreuse-deep" />
        <span className="text-[11px] font-mono text-ink-faint">{message.content}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex animate-fade-in-up',
        isAssistant ? 'justify-start' : 'justify-end',
        'gap-2',
      )}
    >
      {/* Avatar IA (gauche) */}
      {isAssistant ? (
        <div
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink shadow-glass-sm"
          aria-hidden
        >
          <Sparkles className="size-4 text-chartreuse" />
        </div>
      ) : null}

      <div
        className={cn(
          'max-w-[78%] sm:max-w-[72%] px-4 py-2.5',
          isAssistant &&
            'bg-paper border border-rule/60 text-ink rounded-2xl rounded-bl-md shadow-glass-sm',
          isUser && 'bg-chartreuse text-ink rounded-2xl rounded-br-md',
        )}
      >
        {message.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={message.photoUrl}
            alt="Aperçu pris durant la mission"
            className="mb-2 max-h-48 rounded-lg object-cover"
          />
        ) : null}

        <div
          className={cn(
            'text-[14px] leading-relaxed',
            isUser && 'whitespace-pre-wrap',
            isAssistant && 'prose-tchat',
          )}
        >
          {isAssistant ? (
            <>
              <MarkdownBlock content={message.content} />
              {message.streaming && message.content.length === 0 ? (
                <TypingDots />
              ) : message.streaming ? (
                <span
                  className="ml-0.5 inline-block w-[3px] h-[14px] bg-chartreuse-deep align-middle animate-pulse"
                  aria-hidden
                />
              ) : null}
            </>
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        <div
          className={cn(
            'mt-1 flex items-center gap-1.5 text-[10px] font-mono',
            isAssistant ? 'text-ink-mute' : 'text-ink/60',
            isUser && 'justify-end',
          )}
        >
          {message.isVoice ? <Mic className="size-2.5" aria-label="Réponse vocale" /> : null}
          <span>
            {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// TypingDots — 3 dots animés style WhatsApp pendant que Claude réfléchit
// -----------------------------------------------------------------------------

function TypingDots(): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="L'assistant réfléchit">
      <span className="size-1.5 rounded-full bg-ink-mute animate-typing-dot" />
      <span
        className="size-1.5 rounded-full bg-ink-mute animate-typing-dot"
        style={{ animationDelay: '0.2s' }}
      />
      <span
        className="size-1.5 rounded-full bg-ink-mute animate-typing-dot"
        style={{ animationDelay: '0.4s' }}
      />
    </span>
  )
}
