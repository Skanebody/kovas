# KOVAS — Stratégie SEO (Couche 5 industrialisation)

> Document de référence : SEO local 30-50 villes + schémas schema.org + audits automatisés.
> Mis à jour 2026-05-22 — Couche 5 Lighthouse CI + schema-dts + scripts d'audit.

## 1. Stratégie SEO global

### Cible d'acquisition

KOVAS répond à deux intents SEO distincts :

| Intent | Produit | Pages | Volume estimé FR |
|---|---|---|---|
| **B2B** "logiciel diagnostic immobilier", "alternative Liciel" | KOVAS 360 (SaaS payant) | `/`, `/pricing`, `/pour-les-diagnostiqueurs`, `/blog` | 5-10k recherches/mois |
| **B2C** "diagnostiqueur immobilier {ville}", "DPE {ville}" | KOVAS Annuaire (gratuit) | `/trouver-un-diagnostiqueur/{slug}`, fiches publiques | **20-50k recherches/mois** |

Le **B2C est le levier d'acquisition principal** : il génère du trafic organique vers la marque, sur lequel on greffe la conversion B2B via les liens latéraux "Vous êtes diagnostiqueur ?".

### Pages publiques actuelles (Sprint 14j MVP V1)

- `/` (home marketing)
- `/pricing`
- `/faq`
- `/contact`
- `/cgu`, `/confidentialite`, `/mentions-legales`

### Pages publiques planifiées (Sprint M0-M3 SEO local)

- `/qui-sommes-nous` — about/founder story (NEXUS 1993, Benjamin Bel)
- `/pour-les-diagnostiqueurs` — landing acquisition B2B (différencier vs Liciel)
- `/blog` + `/blog/{slug}` — contenu SEO (20 articles M0-M5)
- `/trouver-un-diagnostiqueur` (index) + `/trouver-un-diagnostiqueur/{slug}` — fiches villes + diagnostiqueurs

## 2. Schémas schema.org utilisés

Implémentation typée via `schema-dts` dans [`apps/web/src/lib/seo/structured-data.ts`](../apps/web/src/lib/seo/structured-data.ts).

| Schéma | Page(s) | Helper |
|---|---|---|
| `Organization` | toutes (publisher node) | `getOrganizationSchema()` |
| `LocalBusiness` | `/`, `/trouver-un-diagnostiqueur/{slug}` | `getLocalBusinessSchema(diagnostician?)` |
| `Service` | `/pour-les-diagnostiqueurs`, fiche diagnostiqueur | `getServiceSchema(type)` |
| `Product` (×3) | `/pricing` (1 par tier) | `getProductSchema(plan)` |
| `FAQPage` | `/`, `/faq` | `getFAQPageSchema(faqs)` |
| `Article` | `/blog/{slug}` | `getArticleSchema(post)` |
| `BreadcrumbList` | toutes pages multi-niveaux | `getBreadcrumbListSchema(items)` |

Le composant React `<StructuredData schema={...} />` ([`apps/web/src/components/seo/structured-data.tsx`](../apps/web/src/components/seo/structured-data.tsx)) sérialise le JSON-LD en `<script type="application/ld+json">` avec échappement `</script>`.

## 3. Sitemap structure

KOVAS expose **trois sitemaps** pour scinder les contenus par fréquence de mise à jour :

| Sitemap | Source | Régénération | Cache |
|---|---|---|---|
| `/sitemap.xml` | `next-sitemap` (post-build) | À chaque déploiement | static |
| `/sitemap-villes.xml` | Route Handler `apps/web/src/app/sitemap-villes.xml/route.ts` | À chaque déploiement (revalidate 1h) | `s-maxage=3600` |
| `/sitemap-blog.xml` | Route Handler `apps/web/src/app/sitemap-blog.xml/route.ts` | À chaque déploiement (revalidate 1h) | `s-maxage=3600` |

Le `robots.txt` (généré par `next-sitemap` ET la metadata route `apps/web/src/app/robots.ts`) déclare les trois sitemaps.

### Priorités

| Path pattern | Priority | Changefreq |
|---|---|---|
| `/` | 1.0 | daily |
| `/trouver-un-diagnostiqueur/{slug}` | 0.9 | weekly |
| `/pricing`, `/qui-sommes-nous`, `/pour-les-diagnostiqueurs` | 0.7 | weekly |
| `/blog/{slug}` | 0.6 | monthly |
| Reste | 0.7 | weekly |

### Exclusions

`/dashboard/`, `/app/`, `/api/`, `/admin/`, `/validate/`, `/mission/`, `/upload-photo/`, `/login`, `/signup` sont exclus du sitemap **et** disallow dans robots.txt.

## 4. Liste seed des villes SEO local

30 villes seed dans [`apps/web/src/lib/seo/cities.ts`](../apps/web/src/lib/seo/cities.ts), basé sur :

- Top 25 métropoles FR (volume diagnostic > 10k/an)
- Villes côtières/normandes (Dieppe, Rouen, Caen — proximité founder + zone amiante historique)
- Préfectures non encore servies par les concurrents

Phase 2 (M3-M4) : migration vers table Supabase `cities` avec sourcing INSEE + scoring SEO automatique (volume Google Trends, concurrence Liciel/AnalysImmo).

## 5. Lighthouse CI — budgets de performance

Configuration [`lighthouserc.js`](../lighthouserc.js) — bloquant en CI dès qu'un seuil est dépassé sur 3 runs consécutifs.

| Métrique | Seuil | Niveau |
|---|---|---|
| First Contentful Paint | < 1500 ms | error |
| Largest Contentful Paint | < 2500 ms | error |
| Cumulative Layout Shift | < 0.1 | error |
| Total Blocking Time | < 200 ms | error |
| Performance score | ≥ 0.85 | error |
| SEO score | ≥ 0.95 | error |
| Accessibility score | ≥ 0.95 | error |
| Best Practices score | ≥ 0.95 | error |

Audits ciblés "error" : `meta-description`, `document-title`, `link-text`, `image-alt`, `canonical`, `is-crawlable`, `robots-txt`. `structured-data` est en `warn` (validation par le crawler Google indispensable pour passer en `error`).

Lancement local : `pnpm lighthouse` (depuis la racine, après `pnpm -F @kovas/web build`).

Uploads : `temporary-public-storage` (lien public 7 jours). Migrer vers LHCI Server self-hosted Railway en V2 si besoin d'historique.

## 6. Scripts d'audit manuels

| Script | Commande | Fonction | Output |
|---|---|---|---|
| `seo-audit.ts` | `pnpm seo:audit` | Crawl Playwright, contrôle on-page essentiels | `reports/seo-audit.json` |
| `validate-structured-data.ts` | `pnpm seo:validate-jsonld` | Extraction JSON-LD, validation schema.org | `reports/jsonld-validation.json` |
| `check-outdated.ts` | `pnpm seo:check-outdated` | Détection deps en retard majeur, ouvre issues GitHub | `reports/outdated-dependencies.json` |
| `analyze-bundle.ts` | `pnpm seo:analyze-bundle` | Mesure top 10 chunks `.next/static/chunks/` | `reports/bundle-top10.json` |

À intégrer dans la CI GitHub Actions en Sprint M2 (job `quality:seo` quotidien sur main).

## 7. Setup Google Search Console (à faire M5 avant bêta)

1. Ajouter la propriété `https://kovas.fr` (vérification via DNS TXT Cloudflare).
2. Soumettre les 3 sitemaps : `sitemap.xml`, `sitemap-villes.xml`, `sitemap-blog.xml`.
3. Configurer les redirections de `kovas.app` / `kovas.com` si déposés ultérieurement.
4. Activer "Indexation par défaut" mais bloquer `/app/*` via robots.txt (déjà fait).
5. Surveiller hebdo : Couverture, Sitemaps, Core Web Vitals.

## 8. Roadmap SEO

| Sprint | Livrable |
|---|---|
| Sprint MVP J1-J14 | Pages publiques de base + robots/sitemap minimal (déjà fait) |
| **Couche 5 (ce sprint)** | Lighthouse CI + schema-dts + scripts audit + sitemaps villes/blog (FAIT) |
| Sprint M2 contenu | 20 articles blog + intégration table `cities` Supabase + fiches /trouver-un-diagnostiqueur/{slug} dynamiques |
| Sprint M3 SEO local | Outreach annuaires + bonification fiches diagnostiqueurs payantes |
| Sprint M5 GSC | Verification + monitoring + first audit Search Console |

## 9. Composants à utiliser dans les pages publiques

```tsx
import { StructuredData } from '@/components/seo/structured-data'
import {
  getOrganizationSchema,
  getLocalBusinessSchema,
  getBreadcrumbListSchema,
} from '@/lib/seo/structured-data'

export default function Page() {
  return (
    <>
      <StructuredData schema={getOrganizationSchema()} id="ld-org" />
      <StructuredData schema={getBreadcrumbListSchema([
        { name: 'Accueil', url: 'https://kovas.fr/' },
        { name: 'Tarifs', url: 'https://kovas.fr/pricing' },
      ])} id="ld-breadcrumb" />
      {/* page content */}
    </>
  )
}
```

Et dans la metadata Next :

```ts
export const metadata: Metadata = {
  title: '…',
  description: '…',
  alternates: { canonical: 'https://kovas.fr/…' },
  openGraph: {
    title, description, url, siteName: 'KOVAS', locale: 'fr_FR', type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
}
```
