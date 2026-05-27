/**
 * KOVAS — Renderer Markdown minimal pour articles de veille longue forme.
 *
 * Supporte : H1, H2, H3, paragraphes, liens (Markdown + URL bruts), listes
 * à puces, listes numérotées, bold inline, italic inline, blocs de code,
 * citations (> blockquote). Pas de tables ni d'images (V2 si besoin).
 *
 * Conçu pour le rendu d'articles 1500-3000 mots générés par Claude Haiku
 * via la pipeline Veille Amandine Bart.
 */

import type { ReactNode } from 'react'

interface ArticleMarkdownProps {
  readonly markdown: string
}

function renderInline(text: string): ReactNode[] {
  // Order matters: links → bold → italic → code → plain
  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Markdown link [label](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      const [full, label, url] = linkMatch
      const isInternal = url?.startsWith('/')
      parts.push(
        <a
          key={key++}
          href={url}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer nofollow'}
          className="text-navy hover:underline underline-offset-4 font-medium"
        >
          {label}
        </a>,
      )
      remaining = remaining.slice(full?.length ?? 0)
      continue
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold text-ink">
          {boldMatch[1]}
        </strong>,
      )
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic">
          {italicMatch[1]}
        </em>,
      )
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(
        <code key={key++} className="font-mono text-[0.85em] px-1.5 py-0.5 bg-cream-deep rounded">
          {codeMatch[1]}
        </code>,
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Plain text up to next special char
    const nextSpecial = remaining.search(/[\[\*`]/)
    if (nextSpecial === -1) {
      parts.push(remaining)
      break
    }
    if (nextSpecial === 0) {
      // Special char at start but didn't match a pattern → consume one char
      parts.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      parts.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return parts
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'blockquote' | 'hr' | 'code'
  content: string
  items?: string[]
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let currentParagraph: string[] = []
  let currentList: string[] = []
  let currentListType: 'ul' | 'ol' | null = null
  let currentBlockquote: string[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'p', content: currentParagraph.join(' ').trim() })
      currentParagraph = []
    }
  }

  const flushList = () => {
    if (currentList.length > 0 && currentListType) {
      blocks.push({ type: currentListType, content: '', items: [...currentList] })
      currentList = []
      currentListType = null
    }
  }

  const flushBlockquote = () => {
    if (currentBlockquote.length > 0) {
      blocks.push({ type: 'blockquote', content: currentBlockquote.join(' ').trim() })
      currentBlockquote = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine

    // Code block fence
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', content: codeBlockContent.join('\n') })
        codeBlockContent = []
        inCodeBlock = false
      } else {
        flushParagraph()
        flushList()
        flushBlockquote()
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Empty line → flush in-progress blocks
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      flushBlockquote()
      continue
    }

    // Headings
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) {
      flushParagraph()
      flushList()
      flushBlockquote()
      blocks.push({ type: 'h3', content: h3[1] ?? '' })
      continue
    }
    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) {
      flushParagraph()
      flushList()
      flushBlockquote()
      blocks.push({ type: 'h2', content: h2[1] ?? '' })
      continue
    }
    const h1 = line.match(/^#\s+(.+)$/)
    if (h1) {
      flushParagraph()
      flushList()
      flushBlockquote()
      blocks.push({ type: 'h1', content: h1[1] ?? '' })
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushParagraph()
      flushList()
      flushBlockquote()
      blocks.push({ type: 'hr', content: '' })
      continue
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      flushParagraph()
      flushList()
      currentBlockquote.push(line.trim().slice(2))
      continue
    }

    // Numbered list
    const olItem = line.match(/^\s*\d+\.\s+(.+)$/)
    if (olItem) {
      flushParagraph()
      flushBlockquote()
      if (currentListType !== 'ol') flushList()
      currentListType = 'ol'
      currentList.push(olItem[1] ?? '')
      continue
    }

    // Bullet list
    const ulItem = line.match(/^\s*[-*]\s+(.+)$/)
    if (ulItem) {
      flushParagraph()
      flushBlockquote()
      if (currentListType !== 'ul') flushList()
      currentListType = 'ul'
      currentList.push(ulItem[1] ?? '')
      continue
    }

    // Plain paragraph line
    flushList()
    flushBlockquote()
    currentParagraph.push(line.trim())
  }

  // Final flushes
  flushParagraph()
  flushList()
  flushBlockquote()
  if (inCodeBlock && codeBlockContent.length > 0) {
    blocks.push({ type: 'code', content: codeBlockContent.join('\n') })
  }

  return blocks
}

export function ArticleMarkdown({ markdown }: ArticleMarkdownProps) {
  const blocks = parseBlocks(markdown)

  return (
    <article className="prose-kovas text-ink leading-relaxed">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`
        switch (block.type) {
          case 'h1':
            return (
              <h1
                key={key}
                className="font-sans font-bold text-3xl md:text-4xl tracking-tight text-ink mt-0 mb-6"
              >
                {renderInline(block.content)}
              </h1>
            )
          case 'h2':
            return (
              <h2
                key={key}
                className="font-sans font-bold text-2xl tracking-tight text-ink mt-10 mb-4 scroll-mt-24"
                id={slugifyHeading(block.content)}
              >
                {renderInline(block.content)}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={key} className="font-sans font-semibold text-lg text-ink mt-6 mb-3">
                {renderInline(block.content)}
              </h3>
            )
          case 'p':
            return (
              <p key={key} className="text-base text-ink-soft leading-7 mb-4">
                {renderInline(block.content)}
              </p>
            )
          case 'ul':
            return (
              <ul key={key} className="list-disc pl-6 space-y-1.5 mb-4 text-ink-soft">
                {(block.items ?? []).map((item, j) => (
                  <li key={j} className="leading-7">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={key} className="list-decimal pl-6 space-y-1.5 mb-4 text-ink-soft">
                {(block.items ?? []).map((item, j) => (
                  <li key={j} className="leading-7">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            )
          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="border-l-4 border-rule pl-4 italic text-ink-mute my-4"
              >
                {renderInline(block.content)}
              </blockquote>
            )
          case 'hr':
            return <hr key={key} className="my-8 border-rule" />
          case 'code':
            return (
              <pre
                key={key}
                className="bg-cream-deep rounded-lg p-4 overflow-x-auto my-4 text-sm font-mono"
              >
                <code>{block.content}</code>
              </pre>
            )
          default:
            return null
        }
      })}
    </article>
  )
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}
