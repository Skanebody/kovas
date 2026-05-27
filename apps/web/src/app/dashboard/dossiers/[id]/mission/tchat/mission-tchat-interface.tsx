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

import { AudioMessageBubble } from '@/components/chat/AudioMessageBubble'
import { BottomSheet, BottomSheetTitle } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { RecordingOverlay } from '@/components/voice/RecordingOverlay'
import { TranscriptCoherenceBanner } from '@/components/voice/TranscriptCoherenceBanner'
import { TranscriptSegments } from '@/components/voice/TranscriptSegments'
import { VoiceMessageButton } from '@/components/voice/VoiceMessageButton'
import {
  CHECK_ITEMS_3CL,
  CHECK_ITEMS_3CL_COUNT,
  type CheckCategory,
  getRequiredCheckItems,
} from '@/lib/3cl/checklist'
import {
  type Contradiction,
  type MissionSnapshot,
  type RoomSnapshot,
  detectContradictions,
} from '@/lib/3cl/contradictions-detector'
import { computeMissionCompletionPct, useMissionRiskFlags } from '@/lib/3cl/use-mission-risk-flags'
import { generateDefaultRooms } from '@/lib/mission/default-rooms'
import {
  type ExtractedMissionData,
  extractStructuredData,
  generateLocalResponse,
} from '@/lib/mission/local-extraction'
import { photosSyncManager } from '@/lib/mission/photos-sync-manager'
import {
  type RoomCompletionStatus,
  type RoomType,
  computeRoomStatus,
  getRequiredFieldsCount,
  inferRoomTypeFromName,
} from '@/lib/mission/room-completion'
import {
  useMissionPhotosSyncStatus,
  usePhotoSyncStatus,
} from '@/lib/mission/use-mission-photos-count'
import { cn } from '@/lib/utils'
import { type CoherenceIssue, checkTranscriptCoherence } from '@/lib/voice/transcription-coherence'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Hourglass,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type CaptureMode, CaptureModeToggle } from './CaptureModeToggle'
import {
  type FinalAnalysisGap,
  type FinalAnalysisResult,
  FinalAnalysisSheet,
} from './FinalAnalysisSheet'
import { MissionContextBar } from './MissionContextBar'
import {
  MissionRecapButton,
  MissionRecapSheet,
  type RecapCellStatus,
  type RecapGlobalField,
  type RecapRoom,
  useMissionRecap,
} from './MissionRecapSheet'
import { MissionRoomsSidebar, type MissionSidebarRoom } from './MissionRoomsSidebar'
import { PhotoCaptureButton } from './PhotoCaptureButton'
import { PhotoMetadataModal, type PhotoVisionSuggestion } from './PhotoMetadataModal'
import { type ChatMessage, type SendMessageFn, useVoiceCapture } from './use-voice-capture'

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
  /** Organisation id — utilisé par PhotosSyncManager pour le path Storage RLS. */
  orgId: string
  reference: string
  clientName: string
  fullAddress: string
  sessionId: string
  sessionStartedAt: string
  sessionPausedAt: string | null
  existingRooms: ExistingRoom[]
  initialStats: { photos: number; voiceNotes: number }
  propertyMeta: {
    surface: number | null
    yearBuilt: number | null
    propertyType: string | null
  } | null
  initialChatHistory: InitialChatMessage[]
}

// ChatMessage + ChatVoiceSegment sont définis dans use-voice-capture.ts et
// importés au-dessus (extraction refactor — types partagés entre le composant
// et le hook).

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
              className="font-mono text-[0.9em] bg-[#0F1419]/10 px-1.5 py-0.5 rounded text-[#0F1419]"
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
        <h4 key={`h-${key++}`} className="mt-2 mb-1 text-[14px] font-semibold text-[#0F1419]">
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
  orgId,
  reference,
  clientName,
  fullAddress,
  sessionId,
  sessionStartedAt: _sessionStartedAt,
  sessionPausedAt: _sessionPausedAt,
  existingRooms,
  initialStats,
  propertyMeta,
  initialChatHistory,
}: MissionTchatInterfaceProps) {
  const router = useRouter()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Forward-ref vers sendMessage (défini plus bas) — permet à commitVoiceMessage
  // (via le hook useVoiceCapture) d'appeler sendMessage sans circular dep dans
  // les useCallback. La ref est synchronisée via useLayoutEffect plus bas.
  const sendMessageRef = useRef<SendMessageFn | null>(null)
  // MISSION-E niveau 4 (local) : incohérences détectées sur le dernier message
  // user en attente de validation (Ignorer/Refaire/Corriger).
  const [pendingCoherenceIssues, setPendingCoherenceIssues] = useState<CoherenceIssue[]>([])
  const [pendingMessageDraft, setPendingMessageDraft] = useState<string | null>(null)

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
            ? `Bonjour. ${existingRooms.length} pièce${existingRooms.length > 1 ? 's' : ''} déjà saisie${existingRooms.length > 1 ? 's' : ''} dans ce dossier. On peut reprendre où tu en étais, ou attaquer une nouvelle pièce. **Que souhaites-tu faire ?**`
            : `Bonjour Benjamin. Je suis ton assistant terrain pour cette mission chez **${clientName}**. Je peux te **guider pas à pas**, **répondre à tes questions métier** (méthodo, réglementation, particularités du bien), et **enregistrer tes données** au fur et à mesure.\n\nDis-moi simplement par où tu veux commencer, ou pose-moi une question.`,
        createdAt: Date.now(),
      },
    ]
  })
  const [input, setInput] = useState<string>('')
  const [isOnline, setIsOnline] = useState<boolean>(true)
  // Initialisation depuis l'état serveur — si la session est `paused_at`, on
  // démarre en pause au refresh (cf. audit P0-2 mode mission).
  const [isPaused, setIsPaused] = useState<boolean>(() => _sessionPausedAt != null)
  const [stats, setStats] = useState(initialStats)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ----- Mode Capture (par défaut) vs Conversation IA (MISSION-H lot 1) -----
  // Persisté dans mission_sessions.captured_data.capture_mode via PATCH.
  // Le mode Capture ne déclenche AUCUNE réponse Claude → flow terrain silencieux.
  const [captureMode, setCaptureMode] = useState<CaptureMode>('capture')
  const [captureModeLoaded, setCaptureModeLoaded] = useState<boolean>(false)

  // ----- Analyse finale (MISSION-H lot 2) -----
  const [analysisOpen, setAnalysisOpen] = useState<boolean>(false)
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<FinalAnalysisResult | null>(null)

  // ----- Photo metadata modal (MISSION-H lot 3) -----
  const [photoModalOpen, setPhotoModalOpen] = useState<boolean>(false)
  const [photoModalSuggestion, setPhotoModalSuggestion] = useState<PhotoVisionSuggestion | null>(
    null,
  )
  const [photoModalLocalId, setPhotoModalLocalId] = useState<string | null>(null)

  // ----- MISSION-B : sync manager photos rafale -----
  // Démarre le job background photos pending → Supabase Storage + mission_photos.
  // Le snapshot { pending, uploading, synced, errors } est exposé via hook.
  useEffect(() => {
    if (typeof window === 'undefined') return
    photosSyncManager.start({ orgId, dossierId, missionSessionId: sessionId })
    return () => {
      photosSyncManager.stop()
    }
  }, [orgId, dossierId, sessionId])

  const photosSyncSnapshot = useMissionPhotosSyncStatus(sessionId)

  // ----- Sidebar pièces (lot MISSION-A) -----
  // Construit l'état initial depuis :
  //   1. Les pièces déjà persistées en DB (existingRooms)
  //   2. Pré-rempli par generateDefaultRooms si zéro pièce et propertyMeta dispo
  //
  // TODO V1.5 : sync DB des champs filledFields/requiredFields (actuellement
  // tenu en local state — pas persistant entre refreshes pour les pièces
  // pré-remplies). En V1 c'est volontaire pour rester read-mostly + simple.
  const [rooms, setRooms] = useState<MissionSidebarRoom[]>(() => {
    if (existingRooms.length > 0) {
      return existingRooms.map((r) => {
        const type: RoomType = (r.roomType as RoomType | null) ?? inferRoomTypeFromName(r.name)
        const required = getRequiredFieldsCount(type)
        // En l'absence de tracking persisté, on suppose "partial" pour les
        // pièces existantes (au moins le nom + la surface saisis).
        const filled = r.surfaceM2 != null ? 2 : 1
        return {
          id: r.id,
          name: r.name,
          type,
          surfaceSqm: r.surfaceM2 ?? null,
          requiredFields: required,
          filledFields: Math.min(filled, required),
          completionStatus: computeRoomStatus(
            r.surfaceM2 != null ? ['name', 'surface'] : ['name'],
            type,
          ),
        }
      })
    }
    if (propertyMeta) {
      return generateDefaultRooms({
        propertyType: propertyMeta.propertyType,
        surfaceSqm: propertyMeta.surface,
      }).map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        surfaceSqm: r.surfaceSqm,
        requiredFields: getRequiredFieldsCount(r.type),
        filledFields: 0,
        completionStatus: 'empty' as RoomCompletionStatus,
      }))
    }
    return []
  })
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [isRoomsSheetOpen, setIsRoomsSheetOpen] = useState<boolean>(false)

  // ----- Lot MISSION-C : récap visuel + risk flags + contradictions -----
  // State local pour les champs 3CL renseignés (global + par pièce).
  // V1 : ce state est mis à jour ad-hoc via les captures Claude. V1.5 : sync DB.
  const recap = useMissionRecap()
  const [globalCheckFields, setGlobalCheckFields] = useState<Record<string, unknown>>(() => {
    // Bootstrap avec les meta propriétés connues
    const initial: Record<string, unknown> = {}
    if (propertyMeta?.yearBuilt != null) initial['bati.annee_construction'] = propertyMeta.yearBuilt
    if (propertyMeta?.surface != null) initial['bati.surface_habitable'] = propertyMeta.surface
    return initial
  })
  const [roomCheckFields, setRoomCheckFields] = useState<
    Record<string, { roomType: string; fields: Record<string, unknown> }>
  >({})

  // Compteur "X pièces saisies" pour quick-replies & context bar.
  const roomsSaved = useMemo(
    () => rooms.filter((r) => r.completionStatus !== 'empty').length,
    [rooms],
  )
  const roomsCompleted = useMemo(
    () => rooms.filter((r) => r.completionStatus === 'complete').length,
    [rooms],
  )

  // ----- Lot MISSION-C : agrégation données pour récap -----
  // Maps roomFields pour intégrer le type + filled count (utilisé par hook risk).
  const roomFieldsForRisk = useMemo(() => {
    const out: Record<string, { roomType: string; fields: Record<string, unknown> }> = {}
    for (const room of rooms) {
      const existing = roomCheckFields[room.id]
      out[room.id] = {
        roomType: room.type,
        fields: existing?.fields ?? {},
      }
    }
    return out
  }, [rooms, roomCheckFields])

  // Risk flags (champs required + pitfall non remplis)
  const riskFlags = useMissionRiskFlags({
    globalFields: globalCheckFields,
    roomFields: roomFieldsForRisk,
  })

  // Mission snapshot pour le détecteur de contradictions
  const missionSnapshot: MissionSnapshot = useMemo(() => {
    const g = globalCheckFields
    return {
      yearBuilt:
        typeof g['bati.annee_construction'] === 'number'
          ? (g['bati.annee_construction'] as number)
          : null,
      surfaceHabitableSqm:
        typeof g['bati.surface_habitable'] === 'number'
          ? (g['bati.surface_habitable'] as number)
          : null,
      ceilingHeightAvgM:
        typeof g['bati.hauteur_sous_plafond_moyenne'] === 'number'
          ? (g['bati.hauteur_sous_plafond_moyenne'] as number)
          : null,
      mitoyennete:
        typeof g['bati.mitoyennete'] === 'string' ? (g['bati.mitoyennete'] as string) : null,
      chauffageType:
        typeof g['chauffage.type_generateur_principal'] === 'string'
          ? (g['chauffage.type_generateur_principal'] as string)
          : null,
      chauffageEnergie:
        typeof g['chauffage.energie_principale'] === 'string'
          ? (g['chauffage.energie_principale'] as string)
          : null,
      arriveeGazPresent:
        g['chauffage.arrivee_gaz_present'] === 'oui' || g['chauffage.arrivee_gaz_present'] === 'non'
          ? (g['chauffage.arrivee_gaz_present'] as 'oui' | 'non')
          : null,
      cuveFioulPresent:
        g['chauffage.cuve_fioul_present'] === 'oui' || g['chauffage.cuve_fioul_present'] === 'non'
          ? (g['chauffage.cuve_fioul_present'] as 'oui' | 'non')
          : null,
      ecsType:
        typeof g['ecs.type_generateur'] === 'string' ? (g['ecs.type_generateur'] as string) : null,
      ecsEnergie: typeof g['ecs.energie'] === 'string' ? (g['ecs.energie'] as string) : null,
      vitrageType:
        typeof g['parois_vitrees.type_vitrage'] === 'string'
          ? (g['parois_vitrees.type_vitrage'] as string)
          : null,
      menuiserieAnnee:
        typeof g['parois_vitrees.menuiserie_annee'] === 'number'
          ? (g['parois_vitrees.menuiserie_annee'] as number)
          : null,
      isolationCombles:
        typeof g['bati.isolation_combles_type'] === 'string'
          ? (g['bati.isolation_combles_type'] as string)
          : null,
      isolationMurs:
        typeof g['bati.isolation_murs_type'] === 'string'
          ? (g['bati.isolation_murs_type'] as string)
          : null,
      ventilationType:
        typeof g['ventilation.type_systeme'] === 'string'
          ? (g['ventilation.type_systeme'] as string)
          : null,
      regulationType:
        typeof g['chauffage.regulation_type'] === 'string'
          ? (g['chauffage.regulation_type'] as string)
          : null,
      nbEmetteursTotal:
        typeof g['chauffage.nb_emetteurs_total'] === 'number'
          ? (g['chauffage.nb_emetteurs_total'] as number)
          : null,
      nbPiecesPrincipales:
        typeof g['bati.nombre_pieces_principales'] === 'number'
          ? (g['bati.nombre_pieces_principales'] as number)
          : null,
    }
  }, [globalCheckFields])

  // Room snapshots pour le détecteur
  const roomSnapshots: RoomSnapshot[] = useMemo(() => {
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      surfaceSqm: r.surfaceSqm ?? null,
      ceilingHeightM: null,
      fields: roomCheckFields[r.id]?.fields as
        | Record<string, string | number | boolean | null>
        | undefined,
    }))
  }, [rooms, roomCheckFields])

  const contradictions: Contradiction[] = useMemo(
    () => detectContradictions(missionSnapshot, roomSnapshots),
    [missionSnapshot, roomSnapshots],
  )

  // Progression globale
  const completionPct = useMemo(
    () => computeMissionCompletionPct(globalCheckFields, roomFieldsForRisk),
    [globalCheckFields, roomFieldsForRisk],
  )

  // Compte global de champs renseignés (utilisé dans le bouton FAB + récap)
  const fieldsFilled = useMemo(() => {
    let count = 0
    for (const v of Object.values(globalCheckFields)) {
      if (v !== null && v !== undefined && v !== '') count++
    }
    for (const r of Object.values(roomCheckFields)) {
      for (const v of Object.values(r.fields)) {
        if (v !== null && v !== undefined && v !== '') count++
      }
    }
    return count
  }, [globalCheckFields, roomCheckFields])

  // RecapRoom[] avec status par catégorie
  const recapRooms: RecapRoom[] = useMemo(() => {
    return rooms.map((r) => {
      const fields = roomCheckFields[r.id]?.fields ?? {}
      // Pour chaque catégorie, on regarde les items applicables à ce roomType
      // et on calcule "complete" / "partial" / "empty".
      const statusByCategory: Partial<Record<CheckCategory, RecapCellStatus>> = {}
      const CATEGORIES: CheckCategory[] = [
        'pieces',
        'parois_vitrees',
        'chauffage',
        'ecs',
        'ventilation',
        'eclairage',
      ]
      for (const cat of CATEGORIES) {
        const applicable = CHECK_ITEMS_3CL.filter(
          (it) => it.category === cat && it.applicableTo?.includes(r.type),
        )
        if (applicable.length === 0) {
          // pas applicable → ne pas afficher (status undefined)
          continue
        }
        const filledCount = applicable.filter((it) => {
          const v = fields[it.key]
          return v !== null && v !== undefined && v !== ''
        }).length
        if (filledCount === 0) statusByCategory[cat] = 'empty'
        else if (filledCount >= applicable.length * 0.9) statusByCategory[cat] = 'complete'
        else statusByCategory[cat] = 'partial'
      }
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        statusByCategory,
        requiredFieldsCount: r.requiredFields,
        filledFieldsCount: r.filledFields,
      }
    })
  }, [rooms, roomCheckFields])

  // RecapGlobalField[] — les champs globaux required en priorité
  const recapGlobalFields: RecapGlobalField[] = useMemo(() => {
    const globalItems = CHECK_ITEMS_3CL.filter((it) => !it.applicableTo)
    return globalItems.map((it) => ({
      key: it.key,
      label: it.label,
      filled: (() => {
        const v = globalCheckFields[it.key]
        return v !== null && v !== undefined && v !== ''
      })(),
      isRequired: it.required,
    }))
  }, [globalCheckFields])

  // Total des champs applicables (cible "X/Y" dans le récap)
  const fieldsTotal = CHECK_ITEMS_3CL_COUNT

  // ----- Charge le capture_mode depuis mission_sessions.captured_data au mount -----
  useEffect(() => {
    let aborted = false
    void (async () => {
      try {
        const res = await fetch(`/api/dossiers/${dossierId}/sessions/${sessionId}/mode`, {
          cache: 'no-store',
        })
        if (!aborted && res.ok) {
          const data = (await res.json()) as { capture_mode?: CaptureMode }
          if (data.capture_mode === 'capture' || data.capture_mode === 'conversation') {
            setCaptureMode(data.capture_mode)
          }
        }
      } catch {
        // Route optionnelle — défaut 'capture' si indisponible
      } finally {
        if (!aborted) setCaptureModeLoaded(true)
      }
    })()
    return () => {
      aborted = true
    }
  }, [dossierId, sessionId])

  // Persiste le capture_mode au changement (debounce léger via PATCH async)
  const updateCaptureMode = useCallback(
    (next: CaptureMode) => {
      setCaptureMode(next)
      if (!captureModeLoaded) return
      void fetch(`/api/dossiers/${dossierId}/sessions/${sessionId}/mode`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capture_mode: next }),
      }).catch(() => {
        // Non bloquant — le state local reste correct, sera resync à la prochaine ouverture
      })
    },
    [dossierId, sessionId, captureModeLoaded],
  )

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
    // Auto-scroll uniquement si proche du bas — déclenché à CHAQUE nouveau message
    // ou token streamé. Sans `messages.length` dans les deps, le scrollToBottom
    // étant stable (useCallback []), l'effet ne se ré-exécutait JAMAIS et la vue
    // restait figée pendant le streaming Claude (cf. audit P0-1 mode mission).
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 200) {
      scrollToBottom('smooth')
    } else {
      setShowScrollToBottom(true)
    }
  }, [scrollToBottom, messages])

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
  // Doit dépendre de `input` pour se redimensionner sur pré-remplissage (gap analyse,
  // pendingDraft) ainsi que sur frappe. Sans cette dep, l'effet ne tournait qu'au
  // montage et le textarea restait à 40px pour les inputs setés via setInput().
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const newHeight = Math.min(ta.scrollHeight, 180) // max 180px ~ 6 lignes
    ta.style.height = `${newHeight}px`
  }, [input])

  // ----- Capture vocale (extraite dans useVoiceCapture) -----
  // FIX-WA : le micro stream est ouvert UNE SEULE FOIS via l'AudioRecorder, et
  // partagé avec le VU-mètre. Le transcript live arrive par Web Speech API en
  // parallèle. Au commit on dispose de blob+transcript pour la bulle vocale.
  //
  // Le hook gère : AudioRecorder + Web Speech API + meter stream + cleanup
  // objectURLs + POST /api/transcribe + forward vers Claude via sendMessageRef.
  // Cf. `./use-voice-capture.ts` pour la logique complète.
  //
  // Le composant principal expose `input` au hook via un ref shadow pour que
  // `commitVoiceMessage` puisse lire la valeur courante du textarea (fallback
  // si la ref transcript Web Speech est vide).
  const inputRef = useRef<string>(input)
  inputRef.current = input
  const getInput = useCallback((): string => inputRef.current, [])

  const {
    isListening,
    voiceMode,
    setVoiceMode,
    voiceStartedAt,
    meterStream,
    startListening,
    commitVoiceMessage,
    cancelVoiceMessage,
  } = useVoiceCapture({
    dossierId,
    orgId,
    roomId: activeRoomId,
    sessionId,
    sendMessageRef,
    setMessages,
    setErrorMsg,
    setInput,
    getInput,
  })

  // ----- Apply captures → state rooms -----
  // Quand Claude renvoie une capture `room` ou `measurement` ou autres
  // qui touchent une pièce, on met à jour le state local. Implémentation
  // V1 simple : on cherche par nom, sinon on insère la pièce.
  // V1.5 : sync DB côté serveur (TODO non bloquant).
  const applyCapturesToRooms = useCallback(
    (captures: Array<{ type: string; data?: Record<string, unknown> }>) => {
      setRooms((prev) => {
        let next = prev
        for (const cap of captures) {
          if (cap.type === 'room' && cap.data) {
            next = upsertRoomFromCapture(next, cap.data)
          } else if (cap.type === 'measurement' && cap.data) {
            next = applyMeasurementCapture(next, cap.data)
          } else if (cap.type === 'equipment' && cap.data) {
            next = applyEquipmentCapture(next, cap.data)
          } else if (cap.type === 'observation' && cap.data) {
            next = applyObservationCapture(next, cap.data)
          }
        }
        return next
      })
    },
    [],
  )

  // ----- Streaming IA -----
  const sendMessage = useCallback(
    async (rawText: string, opts?: { suppressUserBubble?: boolean }) => {
      const text = rawText.trim()
      if (!text || isStreaming) return
      const suppressUserBubble = opts?.suppressUserBubble === true

      setErrorMsg(null)

      // ===== MISSION-H lot 1 : mode Capture silencieuse =====
      // En mode Capture, on ajoute la bulle user mais on n'appelle PAS Claude.
      // Le message est persisté en background (mission_text_notes via API) — on
      // garde le state local pour l'affichage instantané.
      if (captureMode === 'capture') {
        if (!suppressUserBubble) {
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: Date.now(),
            isVoice: isListening,
          }
          setMessages((prev) => [...prev, userMsg])
        }
        setInput('')
        // Persistence background (best-effort, non bloquant)
        void fetch(`/api/dossiers/${dossierId}/notes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            text,
            roomId: activeRoomId,
            source: isListening ? 'voice' : 'text',
          }),
        }).catch(() => {
          // Le state local reste la source de vérité ; la queue de retry
          // est gérée par le manager photos/voice existant.
        })
        return
      }

      // ===== Lot MISSION-C : pré-extraction locale =====
      // On extrait les données structurées AVANT envoi serveur. Si l'intent est
      // simple (saisie pièce/surface) ET qu'on a une réponse locale pertinente,
      // on évite l'appel Claude. Sinon on continue le SSE habituel.
      const extracted: ExtractedMissionData = extractStructuredData(text)
      const activeRoomNameLocal = activeRoomId
        ? (rooms.find((r) => r.id === activeRoomId)?.name ?? null)
        : null

      // Push les données extraites dans le state local (sans bloquer le flux)
      if (extracted.confidence > 0.15) {
        setGlobalCheckFields((prev) => {
          const next = { ...prev }
          if (extracted.yearBuilt != null) next['bati.annee_construction'] = extracted.yearBuilt
          if (extracted.surfaceSqm != null && !activeRoomId)
            next['bati.surface_habitable'] = extracted.surfaceSqm
          if (extracted.classeDpe != null) next['general.classe_dpe_estimee'] = extracted.classeDpe
          if (extracted.chauffageType != null)
            next['chauffage.type_generateur_principal'] = extracted.chauffageType
          if (extracted.energie != null) next['chauffage.energie_principale'] = extracted.energie
          if (extracted.vitrageType != null) {
            const map: Record<string, string> = {
              simple: 'simple',
              double: 'double_argon',
              triple: 'triple_argon',
            }
            next['parois_vitrees.type_vitrage'] = map[extracted.vitrageType]
          }
          if (extracted.orientation != null && !activeRoomId)
            next['bati.exposition_dominante'] = extracted.orientation
          if (extracted.nbBedrooms != null)
            next['bati.nombre_pieces_principales'] = extracted.nbBedrooms + 1
          return next
        })
        // Si on a un activeRoom + données scoped, on met à jour roomCheckFields
        if (activeRoomId) {
          const activeRoom = rooms.find((r) => r.id === activeRoomId)
          if (activeRoom) {
            setRoomCheckFields((prev) => {
              const existing = prev[activeRoomId] ?? { roomType: activeRoom.type, fields: {} }
              const fields = { ...existing.fields }
              if (extracted.surfaceSqm != null) fields['piece.surface'] = extracted.surfaceSqm
              if (extracted.ceilingHeightM != null)
                fields['piece.hauteur_sous_plafond'] = extracted.ceilingHeightM
              if (extracted.nbWindows != null)
                fields['parois_vitrees.nb_fenetres'] = extracted.nbWindows
              if (extracted.orientation != null)
                fields['parois_vitrees.orientation_piece'] = extracted.orientation
              return { ...prev, [activeRoomId]: { roomType: activeRoom.type, fields } }
            })
          }
        }
      }

      // Tentative de réponse locale (économie tokens Claude)
      const localResponse = generateLocalResponse(text, {
        currentRoomName: activeRoomNameLocal,
        roomsCount: rooms.length,
        roomsCompleteCount: roomsCompleted,
        phase:
          roomsSaved === 0 && messages.filter((m) => m.role === 'user').length < 2
            ? 'start'
            : roomsCompleted >= 4
              ? 'end'
              : 'mid',
        alreadyExtracted: extracted,
      })

      // Si réponse locale et offline, on traite en local uniquement
      if (localResponse && !isOnline) {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now() + 1}`,
          role: 'assistant',
          content: localResponse,
          createdAt: Date.now() + 1,
        }
        if (suppressUserBubble) {
          // Audio-companion : la bulle user (vocal) a déjà été insérée par commitVoiceMessage.
          setMessages((prev) => [...prev, assistantMsg])
        } else {
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: Date.now(),
            isVoice: isListening,
          }
          setMessages((prev) => [...prev, userMsg, assistantMsg])
        }
        setInput('')
        return
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

      if (suppressUserBubble) {
        // Audio-companion : la bulle user (vocal) a déjà été insérée par commitVoiceMessage.
        setMessages((prev) => [...prev, assistantPlaceholder])
      } else {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: text,
          createdAt: Date.now(),
          isVoice: isListening,
        }
        setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
      }
      setInput('')
      setIsStreaming(true)

      // Contextualise l'IA avec la pièce active si l'utilisateur l'a sélectionnée
      // dans la sidebar — l'API serveur enrichira le system prompt avec
      // "L'utilisateur travaille sur la pièce: X" (cf. route stream).
      const activeRoomName = activeRoomId
        ? (rooms.find((r) => r.id === activeRoomId)?.name ?? null)
        : null

      try {
        const res = await fetch(`/api/mission/${dossierId}/chat/stream`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: text,
            activeRoomName,
          }),
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
                captures?: Array<{ type: string; data?: Record<string, unknown> }>
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
                if (capturesCount > 0 && payload.captures) {
                  applyCapturesToRooms(payload.captures)
                  const hasPhoto = payload.captures.some((c) => c.type === 'photo_taken')
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
    [
      dossierId,
      sessionId,
      isListening,
      isStreaming,
      scrollToBottom,
      applyCapturesToRooms,
      activeRoomId,
      rooms,
      isOnline,
      messages,
      roomsCompleted,
      roomsSaved,
      captureMode,
    ],
  )

  // Sync forward-ref (utilisé par commitVoiceMessage déclaré plus haut).
  // useLayoutEffect garantit que la ref est synchronisée AVANT le paint suivant —
  // sinon sur un voice commit arrivant juste après un sendMessage en cours, le
  // ref pointait sur l'ancienne closure et l'appel était silencieusement ignoré
  // (cf. audit P0-7 mode mission).
  useLayoutEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // ----- Submit avec cross-check métier (MISSION-E niveau 4 local) -----
  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text) return
    // En mode Capture, le message n'est pas envoyé à Claude — c'est une note
    // silencieuse de terrain. Le cross-check coherence ne doit donc PAS bloquer
    // la prise de note (cf. audit P0-3 mode mission : "capture silencieuse · tes
    // messages restent là").
    if (captureMode === 'capture') {
      void sendMessage(text)
      return
    }
    // Mode Conversation : check incohérences métier (surface > 1000m², année <
    // 1800, etc.) AVANT l'envoi. Si OK → envoi normal. Si NOK → banner + attente
    // choix utilisateur.
    const issues = checkTranscriptCoherence(text)
    if (issues.length > 0) {
      setPendingCoherenceIssues(issues)
      setPendingMessageDraft(text)
      return
    }
    void sendMessage(text)
  }, [input, sendMessage, captureMode])

  // ----- Handlers banner coherence -----
  const handleCoherenceIgnore = useCallback(() => {
    const draft = pendingMessageDraft
    setPendingCoherenceIssues([])
    setPendingMessageDraft(null)
    if (draft) void sendMessage(draft)
  }, [pendingMessageDraft, sendMessage])

  const handleCoherenceRedo = useCallback(() => {
    setPendingCoherenceIssues([])
    setPendingMessageDraft(null)
    setInput('')
    startListening()
  }, [startListening])

  const handleCoherenceEdit = useCallback(() => {
    // Garde le brouillon dans l'input pour édition manuelle
    setPendingCoherenceIssues([])
    setPendingMessageDraft(null)
    textareaRef.current?.focus()
  }, [])

  // ----- Photo capture (MISSION-B) — handler depuis PhotoCaptureButton -----
  /**
   * Callback déclenché APRÈS écriture IndexedDB Dexie (offline-safe).
   * Crée une bulle USER spéciale dans le chat avec thumbnail base64 + status pending.
   * Le PhotosSyncManager s'occupe d'uploader en background — le statut sera
   * mis à jour automatiquement via le snapshot photosSyncSnapshot.
   */
  const handlePhotoCaptured = useCallback(
    (photo: {
      localId: string
      thumbnailBase64: string
      roomName: string | null
      takenAt: string
    }) => {
      const timeStr = new Date(photo.takenAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const caption = photo.roomName
        ? `Photo · ${photo.roomName} · ${timeStr}`
        : `Photo · ${timeStr}`
      const msg: ChatMessage = {
        id: `photo-${photo.localId}`,
        role: 'user',
        content: caption,
        createdAt: new Date(photo.takenAt).getTime(),
        photoUrl: photo.thumbnailBase64,
        photoLocalId: photo.localId,
        photoRoomName: photo.roomName,
      }
      setMessages((prev) => [...prev, msg])
      // MISSION-H lot 3 : en offline, on propose immédiatement la modale de
      // classification (pièce/équipement/note) — pas d'IA Vision dispo.
      // En online, la Vision IA tourne en background via le sync manager ; on
      // n'ouvre PAS la modale automatiquement (le badge sur la photo permettra
      // une correction manuelle si besoin).
      if (!isOnline) {
        setPhotoModalLocalId(photo.localId)
        setPhotoModalSuggestion(null)
      }
      // NB : on n'envoie PAS de message IA automatique (anti-spam de la conversation).
      // L'IA peut être interrogée explicitement via les quick replies "Photo prise".
    },
    [isOnline],
  )

  // ----- Pause / Reprendre -----
  // Toggle bidirectionnel. Sans le handleResume, une session pausée restait
  // figée à vie (cf. audit P0-2 mode mission). L'état optimiste local est
  // appliqué immédiatement ; un rollback est fait en cas d'échec serveur.
  const handlePause = useCallback(async () => {
    setIsPaused(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/actions/pause_mission`, {
        method: 'POST',
      })
      if (!res.ok) {
        setIsPaused(false)
        setErrorMsg('Impossible de mettre la mission en pause.')
      }
    } catch {
      // Offline — on garde l'état optimiste, sera sync plus tard
    }
  }, [dossierId])

  const handleResume = useCallback(async () => {
    setIsPaused(false)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/actions/resume_mission`, {
        method: 'POST',
      })
      if (!res.ok) {
        setIsPaused(true)
        setErrorMsg('Impossible de reprendre la mission.')
      }
    } catch {
      // Offline — on garde l'état optimiste
    }
  }, [dossierId])

  // ----- Sidebar pièces : sélection + ajout manuel -----
  const handleSelectRoom = useCallback((roomId: string) => {
    // Toggle : reclic = désélection (libère le contexte de saisie IA)
    setActiveRoomId((prev) => (prev === roomId ? null : roomId))
    // Sur mobile, ferme la bottom sheet pour redonner la main au chat
    setIsRoomsSheetOpen(false)
  }, [])

  const handleAddRoom = useCallback(() => {
    // Démarre la conversation avec une question d'ajout — IA générera
    // ensuite une CAPTURE room=... quand l'utilisateur précisera le nom.
    void sendMessage('Je souhaite ajouter une nouvelle pièce — laquelle me conseilles-tu ?')
  }, [sendMessage])

  // ----- Lot MISSION-C : "Aller corriger" depuis le récap -----
  // Ferme le sheet, sélectionne la pièce si fournie, envoie une question
  // contextuelle à l'IA pour amorcer la saisie du champ.
  const handleGoToField = useCallback(
    (fieldKey: string, roomId?: string) => {
      recap.close()
      if (roomId) setActiveRoomId(roomId)
      const item = getRequiredCheckItems().find((it) => it.key === fieldKey)
      const label = item?.label ?? fieldKey
      void sendMessage(`Aide-moi à renseigner : ${label}`)
    },
    [recap, sendMessage],
  )

  // Helper dev-only logger (cf. audit P2-1 — pas de console en prod)
  const devLog = useCallback((...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') console.info(...args)
  }, [])

  const handleFinishMission = useCallback(async () => {
    recap.close()
    // Cf. audit P1-10 : avant on faisait void fetch + router.push immédiat — si le
    // POST échouait (RLS, network), l'utilisateur partait quand même vers le hub
    // dossier où le statut était incohérent. Maintenant on await + toast d'erreur
    // si échec, et on ne redirige qu'en cas de succès.
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/actions/finish_mission`, {
        method: 'POST',
      })
      if (!res.ok) {
        setErrorMsg('Impossible de terminer la mission. Vérifie ta connexion.')
        return
      }
      router.push(`/dashboard/dossiers/${dossierId}`)
    } catch {
      setErrorMsg('Impossible de terminer la mission. Vérifie ta connexion.')
    }
  }, [recap, dossierId, router])

  // ----- MISSION-H lot 2 : déclenche l'analyse finale -----
  const runFinalAnalysis = useCallback(async () => {
    const url = `/api/mission/${dossierId}/finalize-analysis`
    devLog('[finalize-analysis] click → POST', url, { sessionId })
    setAnalysisLoading(true)
    setAnalysisError(null)
    setAnalysisResult(null)
    setAnalysisOpen(true)

    // AbortController + timeout 60s (cf. audit P1-9). Vercel timeout serveur est
    // 60s aussi — le client doit pouvoir abort proprement sinon la sheet reste en
    // spinner à vie pour l'utilisateur. Si Claude prend > 60s, on affiche un
    // message clair et le user peut "Réessayer".
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal,
      })
      devLog('[finalize-analysis] response', { status: res.status, ok: res.ok })

      // Lecture du body avec fallback texte (au cas où non-JSON)
      const rawText = await res.text()
      let data: unknown
      try {
        data = JSON.parse(rawText)
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[finalize-analysis] non-JSON response', {
            status: res.status,
            rawText: rawText.slice(0, 500),
          })
        }
        setAnalysisError(`Réponse serveur invalide (HTTP ${res.status}).`)
        return
      }
      devLog('[finalize-analysis] parsed body', data)

      if (!res.ok) {
        const errMsg =
          typeof data === 'object' && data !== null && 'error' in data
            ? String((data as { error: unknown }).error)
            : `HTTP ${res.status}`
        setAnalysisError(errMsg)
        return
      }

      const d = data as {
        ok?: boolean
        summary?: string
        rooms?: unknown
        gaps?: unknown
        capturesCount?: number
        error?: string
      }
      if (d.ok === false) {
        setAnalysisError(d.error ?? 'Erreur inconnue')
        return
      }
      const rooms = Array.isArray(d.rooms) ? (d.rooms as FinalAnalysisResult['rooms']) : []
      const gaps = Array.isArray(d.gaps) ? (d.gaps as FinalAnalysisGap[]) : []
      setAnalysisResult({
        summary: d.summary ?? '',
        rooms,
        gaps,
        capturesCount: d.capturesCount ?? 0,
      })
    } catch (err) {
      // AbortError = timeout 60s ; autres erreurs = réseau
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      const msg = isAbort
        ? "L'analyse a dépassé 60 secondes. Réessayez ou simplifiez le contenu."
        : err instanceof Error
          ? `${err.name}: ${err.message}`
          : 'Erreur réseau'
      if (process.env.NODE_ENV !== 'production') {
        console.error('[finalize-analysis] fetch threw', err)
      }
      setAnalysisError(msg)
    } finally {
      clearTimeout(timeoutId)
      setAnalysisLoading(false)
    }
  }, [dossierId, sessionId, devLog])

  const handleAddVoiceNoteForGap = useCallback((gap: FinalAnalysisGap) => {
    setAnalysisOpen(false)
    // Pré-remplit le composer avec un libellé contextuel pour amorcer la dictée
    setInput(`À propos de ${gap.label} : `)
    textareaRef.current?.focus()
  }, [])

  const handleExportToLiciel = useCallback(() => {
    setAnalysisOpen(false)
    router.push(`/dashboard/dossiers/${dossierId}/prevalidation`)
  }, [dossierId, router])

  // ----- MISSION-H lot 3 : photo metadata modal -----
  // Affichée seulement en offline pour V1 (online = Vision IA auto via sync manager).
  const handlePhotoMetadataConfirm = useCallback(
    (_metadata: { room: string; equipment: string | null; note: string | null }) => {
      // V1.5 : on logge la métadonnée en background (mission_text_notes attachée à la photo).
      // Pour l'instant on ne fait que fermer la modal — l'UI se mettra à jour quand
      // le sync manager poussera la photo + la metadata.
      setPhotoModalLocalId(null)
      setPhotoModalSuggestion(null)
    },
    [],
  )

  const handlePhotoMetadataSkip = useCallback(() => {
    setPhotoModalLocalId(null)
    setPhotoModalSuggestion(null)
  }, [])

  // Auto-open dès qu'un localId arrive (photo captée offline)
  useEffect(() => {
    if (photoModalLocalId && !photoModalOpen) {
      setPhotoModalOpen(true)
    }
  }, [photoModalLocalId, photoModalOpen])

  // ----- Phase conversation pour quick replies -----
  const phase: ConversationPhase = useMemo(() => {
    if (roomsSaved === 0 && messages.filter((m) => m.role === 'user').length < 2) return 'start'
    if (roomsCompleted >= 4) return 'end'
    return 'mid'
  }, [roomsSaved, roomsCompleted, messages])

  const quickReplies = useMemo(() => {
    const lastAssistant = messages.filter((m) => m.role === 'assistant').slice(-1)[0]
    return getQuickReplies(phase, lastAssistant?.content ?? '')
  }, [phase, messages])

  // Mapping rooms → variant sidebar (props normalisées).
  const sidebarRooms: MissionSidebarRoom[] = rooms

  // ----- Render -----
  return (
    <>
      {/* Context bar persistante (lot MISSION-A) — 40px desktop / 36px mobile */}
      <MissionContextBar
        client={{ name: clientName }}
        property={{
          type: propertyMeta?.propertyType ?? 'Bien',
          constructionYear: propertyMeta?.yearBuilt ?? null,
          surfaceSqm: propertyMeta?.surface ?? null,
        }}
        rooms={{ total: rooms.length, completed: roomsCompleted }}
        photosCount={stats.photos + photosSyncSnapshot.total}
        isOffline={!isOnline}
        onToggleRoomsSidebar={() => setIsRoomsSheetOpen((o) => !o)}
        isRoomsSidebarOpen={isRoomsSheetOpen}
      />

      {/* Header sticky 56px (simplifié — info déjà dans ContextBar) */}
      <header className="relative flex h-14 items-center justify-between gap-3 border-b border-[#0F1419]/[0.08] bg-paper px-3 sm:px-5 shrink-0 z-10">
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
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/72">
              <span>{reference}</span>
            </div>
            <p className="text-[13px] font-semibold text-[#0F1419] truncate leading-tight">
              <span className="font-normal text-[#0F1419]/72">{fullAddress}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* MISSION-H lot 1 : toggle Capture / Conversation */}
          <CaptureModeToggle
            mode={captureMode}
            onModeChange={updateCaptureMode}
            disabled={isStreaming || isPaused}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={isPaused ? handleResume : handlePause}
            aria-label={isPaused ? 'Reprendre la mission' : 'Mettre en pause'}
            title={isPaused ? 'Reprendre la mission' : 'Mettre en pause'}
            className="size-9"
          >
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
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

      {/* Zone principale 2 colonnes : chat à gauche + sidebar pièces à droite (desktop) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Colonne gauche : chat + quick replies + input */}
        <div className="flex flex-1 flex-col min-w-0">
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
                className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-pill border border-[#0F1419]/[0.08] bg-paper px-3 py-1.5 text-[12px] font-medium text-[#0F1419] hover:bg-sage-alt transition-colors"
                aria-label="Voir les nouveaux messages"
              >
                <ArrowDown className="size-3.5" />
                Nouveaux messages
              </button>
            ) : null}
          </div>

          {/* Quick replies (Conversation IA) OU bouton Analyser (Capture) */}
          {captureMode === 'conversation' ? (
            <div className="border-t border-[#0F1419]/[0.06] bg-paper px-3 sm:px-6 py-2 shrink-0 overflow-x-auto">
              <div className="mx-auto max-w-3xl flex items-center gap-2 min-w-fit">
                {quickReplies.map((qr) => (
                  <button
                    key={qr.label}
                    type="button"
                    onClick={() => void sendMessage(qr.message)}
                    disabled={isStreaming || isPaused || !isOnline}
                    className={cn(
                      'shrink-0 rounded-pill border border-[#0F1419]/[0.08] bg-paper px-3 py-1.5',
                      'text-[12px] font-medium text-[#0F1419]',
                      'hover:bg-sage-alt hover:border-[#0F1419]/30 transition-colors',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // MISSION-H lot 2 : bouton "Terminer et analyser" en mode Capture
            // Toujours visible — Benjamin décide quand sa session est terminée.
            // Désactivé uniquement si AUCUN message user n'a été capturé.
            <div className="border-t border-[#0F1419]/[0.06] bg-paper px-3 sm:px-6 py-2 shrink-0">
              <div className="mx-auto max-w-3xl flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/72">
                  Mode capture silencieuse · tes messages ne déclenchent pas d'IA
                </p>
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  onClick={() => void runFinalAnalysis()}
                  disabled={
                    isPaused ||
                    analysisLoading ||
                    messages.filter((m) => m.role === 'user').length === 0
                  }
                  className="gap-1.5"
                  title={
                    messages.filter((m) => m.role === 'user').length === 0
                      ? 'Dictez ou écrivez au moins une observation avant de lancer l’analyse'
                      : undefined
                  }
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  Terminer et analyser
                  {messages.filter((m) => m.role === 'user').length > 0 ? (
                    <span className="font-mono text-[10px] opacity-70">
                      · {messages.filter((m) => m.role === 'user').length}
                    </span>
                  ) : null}
                </Button>
              </div>
            </div>
          )}

          {/* Input bar sticky bottom */}
          <div className="border-t border-[#0F1419]/[0.08] bg-paper px-3 sm:px-5 py-3 shrink-0 pb-[max(env(safe-area-inset-bottom),12px)]">
            {/* MISSION-E niveau 4 (local) : banner cross-check metier */}
            {pendingCoherenceIssues.length > 0 ? (
              <div className="mx-auto max-w-3xl mb-2">
                <TranscriptCoherenceBanner
                  issues={pendingCoherenceIssues}
                  onIgnore={handleCoherenceIgnore}
                  onRedo={handleCoherenceRedo}
                  onEditManually={handleCoherenceEdit}
                />
              </div>
            ) : null}
            {/* FIX-WA : composer style WhatsApp. Pendant l'enregistrement, le textarea
                est remplacé par le RecordingOverlay (timer + VU-mètre + hint cancel).
                Sinon : PhotoCaptureButton + textarea + VoiceMessageButton dynamique. */}
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              {/* MISSION-B : bouton capture rafale (tap court 1 photo, long press = rafale) */}
              <PhotoCaptureButton
                dossierId={dossierId}
                missionSessionId={sessionId}
                activeRoomId={activeRoomId}
                activeRoomName={
                  activeRoomId ? (rooms.find((r) => r.id === activeRoomId)?.name ?? null) : null
                }
                onPhotoCaptured={handlePhotoCaptured}
                disabled={isPaused}
              />

              {/* Zone centrale : textarea OU RecordingOverlay selon état */}
              {isListening ? (
                <RecordingOverlay
                  mode={voiceMode}
                  meterStream={meterStream}
                  startedAt={voiceStartedAt}
                  className="flex-1 min-h-[44px]"
                />
              ) : (
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
                    isStreaming
                      ? "L'assistant rédige sa réponse…"
                      : captureMode === 'capture'
                        ? 'Dicte ou écris ton observation…'
                        : 'Tape ton message — ou utilise le micro'
                  }
                  disabled={isStreaming || isPaused}
                  rows={1}
                  className={cn(
                    'flex-1 resize-none rounded-2xl border border-[#0F1419]/[0.08] bg-sage-alt/40 px-4 py-2.5',
                    'text-[14px] text-[#0F1419] placeholder:text-[#0F1419]/72',
                    'focus:outline-none focus:ring-2 focus:ring-chartreuse/40 focus:border-chartreuse/50',
                    'disabled:opacity-50 transition-colors',
                    'min-h-[40px] max-h-[180px]',
                  )}
                  aria-label="Ton message"
                />
              )}

              {/* Bouton dynamique unique (micro/send/stop) — pilote la dictée et l'envoi */}
              <VoiceMessageButton
                hasText={input.trim().length > 0}
                isRecording={isListening}
                mode={voiceMode}
                disabled={isPaused || isStreaming}
                onSendText={handleSubmit}
                onRecordStart={startListening}
                onModeChange={setVoiceMode}
                onRecordCommit={() => {
                  void commitVoiceMessage()
                }}
                onRecordCancel={cancelVoiceMessage}
              />
            </div>
            <div className="mx-auto max-w-3xl mt-1.5 flex items-center justify-between text-[10px] font-mono text-[#0F1419]/72">
              <span>Entrée pour envoyer · Maj+Entrée pour saut de ligne</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => router.push(`/dashboard/dossiers/${dossierId}`)}
                className="text-[10px] font-mono text-[#0F1419]/72 hover:text-[#0F1419] h-auto p-0"
              >
                Quitter la mission
              </Button>
            </div>
          </div>
        </div>
        {/* Fin colonne gauche */}

        {/* Sidebar pièces desktop (lg+) — sticky droite 280px */}
        <MissionRoomsSidebar
          rooms={sidebarRooms}
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
          onAddRoom={handleAddRoom}
          variant="desktop"
        />
      </div>
      {/* Fin zone 2 colonnes */}

      {/* Bottom sheet mobile : même sidebar pièces (toggle via ContextBar) */}
      <BottomSheet open={isRoomsSheetOpen} onOpenChange={setIsRoomsSheetOpen} maxHeight="78vh">
        <BottomSheetTitle>Pièces du bien</BottomSheetTitle>
        <div className="px-0 pb-1">
          <MissionRoomsSidebar
            rooms={sidebarRooms}
            activeRoomId={activeRoomId}
            onSelectRoom={handleSelectRoom}
            onAddRoom={handleAddRoom}
            variant="mobile"
          />
        </div>
      </BottomSheet>

      {/* Lot MISSION-C : FAB récap + Bottom sheet récap */}
      <MissionRecapButton
        fieldsFilled={fieldsFilled}
        fieldsTotal={fieldsTotal}
        contradictionsCount={contradictions.length}
        onClick={recap.toggle}
      />
      <MissionRecapSheet
        open={recap.open}
        onOpenChange={recap.setOpen}
        completionPct={completionPct}
        fieldsFilled={fieldsFilled}
        fieldsTotal={fieldsTotal}
        rooms={recapRooms}
        globalFields={recapGlobalFields}
        contradictions={contradictions}
        riskFlags={riskFlags}
        onGoToField={handleGoToField}
        onFinish={handleFinishMission}
      />

      {/* MISSION-H lot 2 : sheet d'analyse finale (mode Capture) */}
      <FinalAnalysisSheet
        open={analysisOpen}
        onOpenChange={(open) => {
          setAnalysisOpen(open)
          if (!open) {
            setAnalysisError(null)
          }
        }}
        result={analysisResult}
        isLoading={analysisLoading}
        error={analysisError}
        onAddVoiceNoteForGap={handleAddVoiceNoteForGap}
        onExport={handleExportToLiciel}
        onRetry={() => void runFinalAnalysis()}
      />

      {/* MISSION-H lot 3 : modal métadonnées photo (offline OU correction manuelle) */}
      <PhotoMetadataModal
        open={photoModalOpen}
        onOpenChange={(open) => {
          setPhotoModalOpen(open)
          if (!open) {
            setPhotoModalLocalId(null)
            setPhotoModalSuggestion(null)
          }
        }}
        suggestion={photoModalSuggestion}
        knownRooms={rooms.map((r) => r.name)}
        onConfirm={handlePhotoMetadataConfirm}
        onSkip={handlePhotoMetadataSkip}
      />
    </>
  )
}

// -----------------------------------------------------------------------------
// Helpers state rooms — application des captures Claude → MissionSidebarRoom[]
// -----------------------------------------------------------------------------

/**
 * Bump le nombre de champs renseignés d'une pièce, recalcule le statut.
 * Ne dépasse jamais `requiredFields`.
 */
function bumpRoomFilled(room: MissionSidebarRoom, extraFields: number): MissionSidebarRoom {
  const next = Math.min(room.requiredFields, room.filledFields + extraFields)
  // Pour le calcul de statut, on simule un array de N items pour réutiliser
  // computeRoomStatus (qui se base sur .length / requiredFields).
  const simulated = new Array<string>(next).fill('x')
  return {
    ...room,
    filledFields: next,
    completionStatus: computeRoomStatus(simulated, room.type),
  }
}

/**
 * Trouve ou crée une pièce dans le state à partir d'une capture `room`.
 * Si le `name` matche (case-insensitive) une pièce existante : on met à jour
 * (surface + au moins 2 champs supposés saisis). Sinon : on l'insère.
 */
function upsertRoomFromCapture(
  rooms: MissionSidebarRoom[],
  data: Record<string, unknown>,
): MissionSidebarRoom[] {
  const name = typeof data.name === 'string' ? data.name : null
  if (!name) return rooms

  const surface = typeof data.surface === 'number' ? data.surface : null
  const type = inferRoomTypeFromName(name)

  const idx = rooms.findIndex((r) => r.name.toLowerCase() === name.toLowerCase())
  if (idx >= 0) {
    // Met à jour la pièce existante : surface + bump filled
    const target = rooms[idx]
    const updated = bumpRoomFilled(
      {
        ...target,
        surfaceSqm: surface ?? target.surfaceSqm,
      },
      // surface + 1 ou 2 champs implicites (features, floor) si données
      (surface != null ? 1 : 0) +
        (Array.isArray(data.features) ? 1 : 0) +
        (typeof data.floor === 'number' ? 1 : 0) || 1,
    )
    const next = [...rooms]
    next[idx] = updated
    return next
  }

  // Insertion d'une nouvelle pièce détectée par l'IA
  const required = getRequiredFieldsCount(type)
  const initialFilled = Math.min(
    required,
    1 + (surface != null ? 1 : 0) + (Array.isArray(data.features) ? 1 : 0),
  )
  const newRoom: MissionSidebarRoom = {
    id: `ai-${Date.now()}-${rooms.length}`,
    name,
    type,
    surfaceSqm: surface,
    requiredFields: required,
    filledFields: initialFilled,
    completionStatus: computeRoomStatus(new Array<string>(initialFilled).fill('x'), type),
  }
  return [...rooms, newRoom]
}

function applyMeasurementCapture(
  rooms: MissionSidebarRoom[],
  data: Record<string, unknown>,
): MissionSidebarRoom[] {
  const roomName = typeof data.room === 'string' ? data.room : null
  if (!roomName) return rooms
  const idx = rooms.findIndex((r) => r.name.toLowerCase() === roomName.toLowerCase())
  if (idx < 0) return rooms
  const surface =
    typeof data.value === 'number' && data.type === 'surface_carrez' ? data.value : null
  const next = [...rooms]
  next[idx] = bumpRoomFilled(
    {
      ...next[idx],
      surfaceSqm: surface ?? next[idx].surfaceSqm,
    },
    1,
  )
  return next
}

function applyEquipmentCapture(
  rooms: MissionSidebarRoom[],
  data: Record<string, unknown>,
): MissionSidebarRoom[] {
  const roomName = typeof data.room === 'string' ? data.room : null
  if (!roomName) return rooms
  const idx = rooms.findIndex((r) => r.name.toLowerCase() === roomName.toLowerCase())
  if (idx < 0) return rooms
  const next = [...rooms]
  next[idx] = bumpRoomFilled(next[idx], 1)
  return next
}

function applyObservationCapture(
  rooms: MissionSidebarRoom[],
  data: Record<string, unknown>,
): MissionSidebarRoom[] {
  // Les observations comptent comme 1 champ supplémentaire (humidite_observation
  // dans les schémas 3CL pour basement/attic notamment).
  return applyEquipmentCapture(rooms, data)
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
        <span className="text-[11px] font-mono text-[#0F1419]/55">{message.content}</span>
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
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0F1419]"
          aria-hidden
        >
          <Sparkles className="size-4 text-chartreuse" />
        </div>
      ) : null}

      <div
        aria-busy={message.isTranscribing ? true : undefined}
        className={cn(
          'max-w-[78%] sm:max-w-[72%] px-4 py-2.5',
          isAssistant &&
            'bg-paper border border-[#0F1419]/[0.08] text-[#0F1419] rounded-2xl rounded-bl-md',
          isUser && 'bg-chartreuse text-[#0F1419] rounded-2xl rounded-br-md',
        )}
      >
        {message.photoUrl ? (
          <div className="mb-2 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.photoUrl}
              alt={message.photoRoomName ? `Photo ${message.photoRoomName}` : 'Photo de la mission'}
              className="max-h-48 rounded-lg object-cover w-full"
            />
            {message.photoLocalId ? <PhotoSyncStatusBadge localId={message.photoLocalId} /> : null}
          </div>
        ) : null}

        {/* Mini-player audio WhatsApp-style si message vocal */}
        {message.audioUrl ? (
          <div className={cn('mb-1.5', isUser ? '-mx-1' : '-mx-1')}>
            <AudioMessageBubble
              audioUrl={message.audioUrl}
              duration={message.audioDuration ?? 0}
              variant={isUser ? 'user' : 'assistant'}
              isTranscribing={message.isTranscribing}
            />
          </div>
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
          ) : message.isTranscribing ? (
            <span className="italic text-[#0F1419]/70">{message.content}</span>
          ) : message.audioSegments && message.audioSegments.length > 0 ? (
            // Rendu segments annotés Whisper : inaudible/douteux/fiable (MISSION-E)
            <TranscriptSegments
              segments={message.audioSegments}
              audioUrl={message.audioUrl ?? null}
            />
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        <div
          className={cn(
            'mt-1 flex items-center gap-1.5 text-[10px] font-mono',
            isAssistant ? 'text-[#0F1419]/72' : 'text-[#0F1419]/60',
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

// -----------------------------------------------------------------------------
// PhotoSyncStatusBadge (MISSION-B) — petit badge ⏳ / ☁️ / ✓ / ⚠ overlay photo
// -----------------------------------------------------------------------------

/**
 * Badge superposé en bas-droite d'une photo dans le chat.
 * Réactif à l'état Dexie via useLiveQuery — mis à jour par PhotosSyncManager.
 */
function PhotoSyncStatusBadge({ localId }: { localId: string }): React.ReactElement | null {
  const status = usePhotoSyncStatus(localId)
  if (!status) return null

  const config: Record<
    'pending' | 'uploading' | 'synced' | 'error',
    { icon: React.ReactElement; label: string; className: string }
  > = {
    pending: {
      icon: <Hourglass className="size-3" />,
      label: 'En attente de sync',
      className: 'bg-[#0F1419]/80 text-paper',
    },
    uploading: {
      icon: <CloudUpload className="size-3 animate-pulse" />,
      label: 'Upload en cours',
      className: 'bg-accent-blue/90 text-paper',
    },
    synced: {
      icon: <Cloud className="size-3" />,
      label: 'Synchronisée',
      className: 'bg-accent-green/90 text-paper',
    },
    error: {
      icon: <AlertTriangle className="size-3" />,
      label: 'Erreur — sera retentée',
      className: 'bg-accent-red/90 text-paper',
    },
  }
  const conf = config[status]
  return (
    <span
      className={cn(
        'absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5',
        'rounded-full text-[10px] font-mono',
        conf.className,
      )}
      title={conf.label}
      aria-label={conf.label}
    >
      {conf.icon}
    </span>
  )
}
