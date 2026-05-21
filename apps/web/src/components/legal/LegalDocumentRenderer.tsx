import type { LegalTocEntry } from '@/lib/legal/load-document'

/**
 * Renderer markdown minimaliste dédié au pack juridique KOVAS.
 *
 * On évite l'ajout d'une dépendance (react-markdown / marked) — le markdown des
 * documents juridiques suit une grammaire restreinte : H1 / H2 / H3, paragraphes,
 * listes ul/ol, tables GFM, blockquotes, gras `**...**`, italique `*...*` /
 * `_..._`, code inline `` `...` ``. Aucun lien externe complexe, aucune image.
 *
 * Ce renderer produit du HTML stylé avec les tokens KOVAS (navy `#0F1419`,
 * background sage `#F5F7F4`) — voir docs/design/KOVAS_UIUX_v5_Final.md.
 *
 * Les `##` et `###` reçoivent une ancre `id` slugifiée identique à celle du TOC
 * pour permettre les deep-links.
 */

interface LegalDocumentRendererProps {
  /** Contenu markdown brut. */
  readonly content: string
  /** Table des matières (utilisée pour la cohérence des ancres). */
  readonly toc: readonly LegalTocEntry[]
}

// ============================================
// Utilitaires
// ============================================

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Échappe HTML pour insérer en toute sécurité. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Rend les emphases inline : gras `**`, italique `*` ou `_`, code `` ` ``. */
function renderInline(raw: string): string {
  let text = escapeHtml(raw)
  // Inline code en premier (protégeable des autres remplacements).
  text = text.replace(
    /`([^`]+)`/g,
    '<code class="font-mono text-[12px] bg-[#0F1419]/[0.06] rounded px-1 py-0.5">$1</code>',
  )
  // Gras (double étoile).
  text = text.replace(
    /\*\*([^*]+?)\*\*/g,
    '<strong class="font-semibold text-[#0F1419]">$1</strong>',
  )
  // Italique (étoile simple ou underscore — heuristique simple).
  text = text.replace(/(^|\s)\*([^*]+?)\*(?=\s|$|[.,;:!?)])/g, '$1<em>$2</em>')
  text = text.replace(/(^|\s)_([^_]+?)_(?=\s|$|[.,;:!?)])/g, '$1<em>$2</em>')
  // Liens markdown `[text](url)`.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label: string, href: string) => {
    const safeHref = href.replace(/"/g, '&quot;')
    return `<a href="${safeHref}" class="text-[#0F1419] underline-offset-4 hover:underline">${label}</a>`
  })
  return text
}

// ============================================
// Parser bloc par bloc
// ============================================

interface RenderedBlock {
  html: string
}

function renderTable(lines: string[]): string {
  const rows = lines
    .map((line) => line.trim().replace(/^\||\|$/g, ''))
    .map((line) => line.split('|').map((c) => c.trim()))
  if (rows.length < 2) return ''
  const headerCells = rows[0]
  const bodyRows = rows.slice(2) // skip separator
  const thead = `<thead><tr>${headerCells
    .map(
      (c) =>
        `<th class="border-b border-[#0F1419]/15 py-2 pr-4 text-left text-[12px] font-mono font-medium uppercase tracking-wider text-[#0F1419]/70">${renderInline(c)}</th>`,
    )
    .join('')}</tr></thead>`
  const tbody = `<tbody>${bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td class="border-b border-[#0F1419]/[0.08] py-2 pr-4 align-top text-[14px] text-[#0F1419]/85">${renderInline(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')}</tbody>`
  return `<div class="my-6 overflow-x-auto"><table class="w-full border-collapse text-left">${thead}${tbody}</table></div>`
}

function renderBlock(lines: string[]): RenderedBlock {
  const first = lines[0]
  if (!first) return { html: '' }
  // Horizontal rule.
  if (/^---+$/.test(first.trim())) return { html: '<hr class="my-8 border-[#0F1419]/15" />' }
  // Headings.
  const h1 = first.match(/^#\s+(.+?)\s*$/)
  if (h1) {
    return {
      html: `<h1 class="font-serif italic text-3xl md:text-4xl text-[#0F1419] tracking-tight leading-[1.15] mt-0 mb-6">${renderInline(h1[1])}</h1>`,
    }
  }
  const h2 = first.match(/^##\s+(.+?)\s*$/)
  if (h2) {
    const id = slugify(h2[1])
    return {
      html: `<h2 id="${id}" class="font-sans font-semibold text-xl md:text-2xl text-[#0F1419] mt-10 mb-3 scroll-mt-24">${renderInline(h2[1])}</h2>`,
    }
  }
  const h3 = first.match(/^###\s+(.+?)\s*$/)
  if (h3) {
    const id = slugify(h3[1])
    return {
      html: `<h3 id="${id}" class="font-sans font-semibold text-base md:text-lg text-[#0F1419] mt-6 mb-2 scroll-mt-24">${renderInline(h3[1])}</h3>`,
    }
  }
  const h4 = first.match(/^####\s+(.+?)\s*$/)
  if (h4) {
    return {
      html: `<h4 class="font-sans font-semibold text-[15px] text-[#0F1419] mt-5 mb-2">${renderInline(h4[1])}</h4>`,
    }
  }
  // Blockquote.
  if (first.startsWith('>')) {
    const text = lines
      .map((l) => l.replace(/^>\s?/, ''))
      .join(' ')
      .trim()
    return {
      html: `<blockquote class="my-5 border-l-2 border-[#0F1419]/30 pl-4 italic text-[14px] text-[#0F1419]/65">${renderInline(text)}</blockquote>`,
    }
  }
  // Table (heuristique : première ligne contient `|` et seconde ligne contient `---`).
  if (first.includes('|') && lines[1]?.match(/^[\s|\-:]+$/)) {
    return { html: renderTable(lines) }
  }
  // Liste non ordonnée.
  if (/^[-*]\s+/.test(first)) {
    const items = lines
      .filter((l) => l.trim() !== '')
      .map((l) => l.replace(/^[-*]\s+/, ''))
      .map((l) => `<li class="mb-1.5">${renderInline(l)}</li>`)
      .join('')
    return {
      html: `<ul class="list-disc pl-6 my-4 text-[14px] text-[#0F1419]/85 leading-relaxed">${items}</ul>`,
    }
  }
  // Liste ordonnée.
  if (/^\d+\.\s+/.test(first)) {
    const items = lines
      .filter((l) => l.trim() !== '')
      .map((l) => l.replace(/^\d+\.\s+/, ''))
      .map((l) => `<li class="mb-1.5">${renderInline(l)}</li>`)
      .join('')
    return {
      html: `<ol class="list-decimal pl-6 my-4 text-[14px] text-[#0F1419]/85 leading-relaxed">${items}</ol>`,
    }
  }
  // Paragraphe par défaut.
  const joined = lines.join(' ').trim()
  if (!joined) return { html: '' }
  return {
    html: `<p class="my-3 text-[14px] text-[#0F1419]/80 leading-relaxed">${renderInline(joined)}</p>`,
  }
}

/**
 * Découpe le markdown en blocs (séparés par lignes vides ou bordures de tables).
 */
function splitBlocks(content: string): string[][] {
  const lines = content.split('\n')
  const blocks: string[][] = []
  let current: string[] = []
  let inTable = false
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    const isTableSep = /^\s*\|?[\s|\-:]+\|?\s*$/.test(line)
    if (line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current)
        current = []
      }
      inTable = false
      continue
    }
    // Headings et HR sont des blocs indépendants.
    if (/^#{1,4}\s+/.test(line) || /^---+$/.test(line.trim())) {
      if (current.length > 0) {
        blocks.push(current)
      }
      blocks.push([line])
      current = []
      inTable = false
      continue
    }
    // Table : on accumule jusqu'à ligne vide.
    if (line.includes('|') && (inTable || isTableSep || /^\|/.test(line.trim()))) {
      current.push(line)
      inTable = true
      continue
    }
    current.push(line)
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

// ============================================
// Composant React
// ============================================

export function LegalDocumentRenderer({ content, toc: _toc }: LegalDocumentRendererProps) {
  // Le TOC est géré côté layout (sidebar). Ici on ne rend que le corps du document.
  // Le H1 du markdown est généralement masqué (il est rendu par le layout/page).
  const blocks = splitBlocks(content)
  const html = blocks
    .map((block, idx) => {
      // On masque le H1 du markdown — le titre est rendu par la page wrapper.
      if (idx === 0 && block[0]?.startsWith('# ')) return ''
      // On masque aussi la première blockquote (note de versionning) qui est
      // déjà rendue dans le bandeau version sous le titre, et la ligne version
      // brute "**Édition au ... — Version v1.X**" si elle apparaît isolément.
      const joined = block.join('\n')
      if (/^\*\*Édition au.*Version.*\*\*$/.test(joined.trim())) return ''
      if (idx <= 4 && block[0]?.startsWith('>')) return ''
      return renderBlock(block).html
    })
    .filter(Boolean)
    .join('\n')

  return (
    <div
      className="prose-kovas-legal"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: rendu markdown serveur depuis fichiers .md contrôlés.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
