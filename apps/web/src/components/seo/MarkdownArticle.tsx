/**
 * MarkdownArticle — renderer minimaliste pour les articles `/conseils/[slug]`.
 *
 * Server Component sans dépendance externe (la lib `marked` n'est pas installée
 * dans le projet ; voir TODO Phase H2 pour bascule rich-text). Si `html`
 * est fourni (rendu cached côté Edge Function `seo_drafts.content_html`), on
 * l'injecte tel quel dans un conteneur `prose`. Sinon, on bascule sur un rendu
 * markdown brut très limité (paragraphes, titres `#`/`##`/`###`, listes `- `)
 * pour préserver la lisibilité jusqu'au merge H2.
 *
 * Sécurité : `html` est supposé pré-assaini côté pipeline SEO (Phase D). La
 * conversion markdown → HTML fallback échappe les balises HTML brutes.
 */

interface MarkdownArticleProps {
  /** HTML pré-rendu côté Edge Function (`seo_drafts.content_html`). */
  readonly html?: string | null
  /** Markdown brut (fallback si `html` absent). */
  readonly markdown?: string | null
}

/** Échappement HTML basique pour le fallback markdown brut. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Conversion markdown → HTML ultra-minimaliste (titres, listes, paragraphes).
 * À remplacer par `marked` ou `react-markdown` en Phase H2.
 */
function renderMarkdownFallback(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  let inList = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line.startsWith('### ')) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith('## ')) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('# ')) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`)
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`)
      continue
    }
    if (line === '') {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      continue
    }
    if (inList) {
      out.push('</ul>')
      inList = false
    }
    out.push(`<p>${escapeHtml(line)}</p>`)
  }

  if (inList) out.push('</ul>')
  return out.join('\n')
}

export function MarkdownArticle({ html, markdown }: MarkdownArticleProps) {
  const finalHtml =
    typeof html === 'string' && html.length > 0
      ? html
      : typeof markdown === 'string' && markdown.length > 0
        ? renderMarkdownFallback(markdown)
        : ''

  if (finalHtml === '') {
    return (
      <p className="text-ink/60">
        Contenu indisponible. Cet article sera disponible prochainement.
      </p>
    )
  }

  return (
    <article
      className="prose prose-lg prose-stone max-w-none prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-3xl prose-h3:text-2xl prose-p:leading-relaxed prose-a:text-navy prose-a:underline-offset-4 prose-strong:text-ink"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML pré-assaini par pipeline SEO ou converti via escapeHtml.
      dangerouslySetInnerHTML={{ __html: finalHtml }}
    />
  )
}
