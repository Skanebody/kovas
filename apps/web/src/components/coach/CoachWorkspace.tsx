'use client'

/**
 * KOVAS — Workspace Coach IA.
 *
 * Wrapper client qui orchestre :
 *  - CoachChatInterface (colonne gauche 2/3)
 *  - PromptSuggestions  (colonne droite, click → injecte dans chat)
 *
 * Permet le partage d'état (prompt cliqué) sans remonter en server.
 */

import { useState } from 'react'
import { CoachChatInterface } from './CoachChatInterface'
import { PromptSuggestions } from './PromptSuggestions'

interface InitialMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CoachWorkspaceProps {
  conversationId: string | null
  initialMessages: readonly InitialMessage[]
}

export function CoachWorkspace({ conversationId, initialMessages }: CoachWorkspaceProps) {
  // Compteur incrémenté à chaque sélection : permet de re-déclencher
  // l'effect d'injection même si on re-clique sur le même prompt.
  const [prefilled, setPrefilled] = useState<{ text: string; nonce: number } | null>(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 order-1">
        <CoachChatInterface
          conversationId={conversationId}
          initialMessages={initialMessages}
          prefilledPrompt={prefilled?.text ?? null}
          key={prefilled?.nonce ?? 'initial'}
        />
      </div>
      <aside className="lg:col-span-1 order-2 space-y-4">
        <PromptSuggestions
          onSelect={(prompt) => setPrefilled({ text: prompt, nonce: Date.now() })}
        />
      </aside>
    </div>
  )
}
