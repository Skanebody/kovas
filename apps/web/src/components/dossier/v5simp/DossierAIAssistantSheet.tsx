'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { useState } from 'react'

interface AIMessage {
  id: string
  role: 'bot' | 'user'
  content: string
}

interface DossierAIAssistantSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Bottom sheet "Assistant KOVAS" — ouvert depuis le FAB (action IA).
 * V1 stub : message d'accueil + réponse statique. Le vrai chat contextualisé
 * arrive en V1.5 (cf. CLAUDE.md §3 — features Phase 3 / V1.5).
 */
export function DossierAIAssistantSheet({ open, onOpenChange }: DossierAIAssistantSheetProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      content:
        'Bonjour, je suis votre assistant KOVAS. Posez-moi une question sur ce dossier — équipements, réglementation, cohérence des saisies.',
    },
  ])
  const [input, setInput] = useState('')

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return
    const userMsg: AIMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    const botMsg: AIMessage = {
      id: `b-${Date.now()}`,
      role: 'bot',
      content:
        "Cette fonctionnalité arrive en V1.5 avec contextualisation automatique du dossier. Pour l'instant, l'assistant ne lit pas encore vos saisies.",
    }
    setMessages((m) => [...m, userMsg, botMsg])
    setInput('')
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Assistant KOVAS"
      description="Posez une question — bientôt contextualisé au dossier en cours."
    >
      <div className="space-y-3">
        <ul className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                m.role === 'bot'
                  ? 'rounded-lg border border-rule/50 bg-cream-deep/60 px-3 py-2 text-[13px] text-ink'
                  : 'rounded-lg bg-navy text-paper px-3 py-2 text-[13px] ml-6'
              }
            >
              {m.content}
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question…"
            aria-label="Message à l'assistant KOVAS"
            className="flex-1 h-10 rounded-pill border border-rule bg-paper px-4 text-[13px] text-ink placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
          />
          <Button type="submit" size="icon" aria-label="Envoyer" disabled={!input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </BottomSheet>
  )
}
