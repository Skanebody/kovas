# Garde-fou local — Anti-oubli terrain

> Module 100% local, déterministe, zéro appel API pendant l'utilisation.
> Objectif : empêcher l'oubli sur le terrain (priorité 1) puis récupérer un
> oubli à distance via le client (priorité 2).

## Architecture

```
apps/web/src/lib/local-ai/
├── checklist-tracker.ts         Moteur stateful (processMessage / getCompletionStatus)
├── room-transition-detector.ts  Détection pièce + transitions (30+ keywords)
├── photo-coverage-validator.ts  Validation photo par pièce / item required
├── proactive-suggester.ts       Règles métier (7 règles V1)
├── text-folding.ts              Normalisation NFKD + keyword matcher
├── checklists/
│   ├── types.ts                 ChecklistItem / ChecklistSection / TRIGGER_DELAYS
│   ├── index.ts                 Registry + getChecklist / resolveDiagnosticKind
│   ├── dpe.ts                   24 items / 8 sections
│   ├── amiante.ts               18 items / 5 sections
│   ├── plomb.ts                 14 items / 4 sections
│   ├── gaz.ts                   16 items / 5 sections
│   ├── electricite.ts           20 items / 7 sections
│   ├── termites.ts              11 items / 4 sections
│   ├── carrez.ts                9 items / 3 sections
│   ├── boutin.ts                9 items / 3 sections
│   └── erp.ts                   9 items / 3 sections
└── vocabulary/diagnostic-jargon.ts  (déjà mergé — Lot C)

apps/web/src/components/mobile/
├── ChecklistPanel.tsx           Panel flottant top-right (collapsible)
├── TransitionAlert.tsx          Bulle in-flow transition pièce + gaps
├── PhotoSuggestionBubble.tsx
├── ProactiveSuggestionBubble.tsx
├── MissingFieldQuestion.tsx     Question automatique overdue
└── CheckoutScreen.tsx           Plein écran bilan avant départ

apps/web/src/components/desktop/
├── RecoveryActions.tsx          Grille 2×2 (appel / photo / visio / Cal.com)
├── ClientPhotoRequest.tsx       Modal demande photo SMS
└── VideoCallRequest.tsx         Modal proposition visio SMS

supabase/functions/
├── request-client-photo/        Edge fn génère token + SMS Brevo (48h)
├── request-client-video/        Edge fn envoie SMS lien visio + motif
└── upload-client-photo/         Reçoit photo + persiste Storage + photos

apps/web/src/app/
├── (public)/upload-photo/[token]/page.tsx       Page publique sobre client
├── (public)/upload-photo/[token]/upload-photo-form.tsx
├── api/recovery/request-client-photo/route.ts
├── api/recovery/request-client-video/route.ts
└── api/client-photo-upload/route.ts             Proxy multipart vers edge fn

supabase/migrations/
└── 20260612100000_client_photo_requests.sql    Table + RLS + index
```

## Intégration ChatInterface (TODO)

Le composant `ChatInterface` global n'existe pas encore sur `main` au
moment de l'introduction de ce module (HEAD = `2be52fe`). L'intégration se
fera lors d'une mission ultérieure (Capture-First V1.5 — composant Chat).

Le pattern d'intégration cible :

```tsx
'use client'
import { ChecklistTracker } from '@/lib/local-ai/checklist-tracker'
import { ChecklistPanel } from '@/components/mobile/ChecklistPanel'
import { TransitionAlert } from '@/components/mobile/TransitionAlert'
import { MissingFieldQuestion } from '@/components/mobile/MissingFieldQuestion'
import { ProactiveSuggestionBubble } from '@/components/mobile/ProactiveSuggestionBubble'
import { CheckoutScreen } from '@/components/mobile/CheckoutScreen'
import { getTopSuggestion } from '@/lib/local-ai/proactive-suggester'
import { useMemo, useRef, useState, useEffect } from 'react'

export function ChatInterface({ mission, property }) {
  const trackerRef = useRef(
    new ChecklistTracker(mission.diagnostics, mission.started_at_ms),
  )
  const [status, setStatus] = useState(() => trackerRef.current.getCompletionStatus())
  const [pendingTransition, setPendingTransition] = useState<RoomTransitionEvent | null>(null)
  const [overdue, setOverdue] = useState<OverdueItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)

  const handleUserMessage = (text: string) => {
    const event = trackerRef.current.processMessage({
      kind: 'text', text, at: Date.now(),
    })
    setStatus(trackerRef.current.getCompletionStatus())
    if (event.transition) setPendingTransition(event.transition)
    if (event.overdue.length) setOverdue(event.overdue)
  }

  // Polling overdue toutes les 30s
  useEffect(() => {
    const id = setInterval(() => {
      const items = trackerRef.current.getOverdueQuestions()
      if (items.length) setOverdue(items)
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const topSuggestion = useMemo(
    () => getTopSuggestion(toPropertyContext(property), mission.diagnostics),
    [property, mission.diagnostics],
  )

  return (
    <>
      <ChecklistPanel status={status} />
      {pendingTransition && (
        <TransitionAlert
          transition={pendingTransition}
          onComplete={() => setShowCheckout(true)}
          onDismiss={() => setPendingTransition(null)}
        />
      )}
      {topSuggestion && (
        <ProactiveSuggestionBubble
          suggestion={topSuggestion}
          onAccept={addMissingDiagnostic}
          onDismiss={dismissSuggestion}
        />
      )}
      {overdue.length > 0 && (
        <MissingFieldQuestion
          overdue={overdue[0]}
          onAnswerText={handleUserMessage}
          onAnswerVoice={startVoiceCapture}
          onDismiss={() => setOverdue((o) => o.slice(1))}
        />
      )}
      {showCheckout && (
        <CheckoutScreen
          status={status}
          onContinue={() => setShowCheckout(false)}
          onComplete={openSpecificItem}
          onConfirmLeave={finalizeMission}
        />
      )}
    </>
  )
}
```

## Conventions

- TypeScript strict, **zéro `any`** sauf Edge Functions Deno (`@ts-nocheck`).
- Code en anglais, UI strings français, ton sobre, vouvoiement.
- Tokens V5 : `sage`, `navy-deep`, `chartreuse`, `warning`/`info`/`success`/`danger`,
  classes `label-mono`/`hero-serif`/`kpi-hero`.
- Pas d'emoji marketing — uniquement `✓` et `→` métier acceptés (déjà présents
  dans le lexique).
