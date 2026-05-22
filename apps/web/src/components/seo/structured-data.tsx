import type { Thing, WithContext } from 'schema-dts'

/**
 * Composant utilitaire pour injecter du JSON-LD typé dans les Server Components.
 *
 * Usage :
 *
 * ```tsx
 * import { StructuredData } from '@/components/seo/structured-data'
 * import { getOrganizationSchema, getFAQPageSchema } from '@/lib/seo/structured-data'
 *
 * export default function Page() {
 *   return (
 *     <>
 *       <StructuredData schema={getOrganizationSchema()} />
 *       <StructuredData schema={getFAQPageSchema(faqs)} id="faq-jsonld" />
 *       <main>{...}</main>
 *     </>
 *   )
 * }
 * ```
 *
 * Important :
 *  - Le JSON est sérialisé puis échappé (`</script>` neutralisé) pour éviter
 *    une cassure de balise.
 *  - `dangerouslySetInnerHTML` est nécessaire car Next.js sinon HTML-encode
 *    les caractères et casse le parsing JSON-LD côté crawlers.
 */
interface StructuredDataProps<T extends Thing> {
  readonly schema: WithContext<T>
  readonly id?: string
}

export function StructuredData<T extends Thing>({
  schema,
  id,
}: StructuredDataProps<T>): React.JSX.Element {
  const safeJson = JSON.stringify(schema).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      id={id}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: nécessaire pour JSON-LD non-HTML-encodé
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  )
}
