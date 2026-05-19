import type { ReactNode } from 'react'

interface FaqAnswerProps {
  /** Markdown light : \n\n = paragraphes, "- " = bullets, "1. " = numbered, **x** = bold */
  markdown: string
}

/**
 * Renderer minimal pour les réponses FAQ.
 * Supporte uniquement le subset markdown utilisé dans faq-data.ts :
 *  - Paragraphes (split sur double saut de ligne)
 *  - Listes à puces (lignes qui commencent par "- ")
 *  - Listes numérotées (lignes qui commencent par "1. ", "2. ", etc.)
 *  - Bold inline (**texte**)
 *
 * Pas de markdown plus avancé (links, headings, images) — pas besoin V1.
 */
export function FaqAnswer({ markdown }: FaqAnswerProps) {
  const paragraphs = markdown.trim().split(/\n\n+/)
  return (
    <div className="space-y-3 text-sm text-foreground leading-relaxed">
      {paragraphs.map((para, i) => renderParagraph(para, i))}
    </div>
  )
}

function renderParagraph(para: string, key: number): ReactNode {
  const lines = para.split('\n')

  // Bullet list ?
  if (lines.every((l) => l.trim().startsWith('- '))) {
    return (
      <ul key={key} className="list-disc pl-5 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*-\s+/, ''))}</li>
        ))}
      </ul>
    )
  }

  // Numbered list ?
  if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
    return (
      <ol key={key} className="list-decimal pl-5 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    )
  }

  // Plain paragraph
  return <p key={key}>{renderInline(para)}</p>
}

/**
 * Render bold inline : **texte** → <strong>texte</strong>.
 */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}
