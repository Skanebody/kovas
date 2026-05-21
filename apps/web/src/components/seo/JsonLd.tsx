/**
 * Composant Server-rendered qui injecte une balise <script type="application/ld+json">
 * dans le DOM. Compatible Next.js 15 App Router (Server Component pur, pas de 'use client').
 *
 * Le contenu JSON est échappé via `serializeSchema` pour prévenir toute injection XSS.
 * Accepte un schéma unique ou un tableau de schémas (rendus séquentiellement).
 *
 * Usage :
 *   <JsonLd data={buildOrganizationSchema()} id="org" />
 *   <JsonLd data={[orgSchema, websiteSchema]} />
 */

import { serializeSchema } from '@/lib/seo/schema-org'

interface JsonLdProps {
  readonly data: object | readonly object[]
  /** Préfixe optionnel pour les attributs key React (utile si plusieurs JsonLd sur une page). */
  readonly id?: string
}

export function JsonLd({ data, id }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : [data]
  return (
    <>
      {payload.map((item, idx) => (
        <script
          // eslint-disable-next-line react/no-array-index-key -- ordre statique server-rendered
          key={id ? `${id}-${idx}` : `jsonld-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema(item) }}
        />
      ))}
    </>
  )
}
