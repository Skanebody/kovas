/**
 * PremiumClientReport — composant de rendu du PDF Premium Client (Upsell #1 Tugan).
 *
 * V1 SCAFFOLD : `@react-pdf/renderer` n'est PAS encore installé dans
 * `apps/web/package.json` (cf. revue 2026-05-26). Ce fichier fournit donc :
 *
 *   1. Un composant React 19 fonctionnel qui rend un MOCK HTML stylé V5 sage/navy
 *      directement convertible en PDF côté serveur par n'importe quel pipeline
 *      HTML→PDF (Puppeteer/Playwright headless, `jspdf-html`, Browserless, etc.).
 *   2. Un type `PremiumReportContent` réutilisable côté Edge Function
 *      `generate-premium-client-report` (sortie JSON du rédacteur cloud).
 *
 * TODO V1.1 : installer `@react-pdf/renderer` (peer dep React 19 OK depuis 4.0.0)
 * et remplacer le rendu HTML par un vrai composant `<Document>` / `<Page>` /
 * `<View>` / `<Text>` / `<Image>` avec mise en page typographique pixel-perfect.
 * À ce stade-là, ce fichier exportera 2 composants : `PremiumClientReportHtml`
 * (conservé pour preview in-app et fallback) et `PremiumClientReportPdf`
 * (le vrai composant react-pdf consommé par `renderToBuffer` dans l'Edge Function).
 *
 * Design strict V5 sage / navy : background `#F5F7F4`, sidebar / accent `#0F1419`,
 * accent chartreuse `#D4F542` réservé aux badges (priorité, MaPrimeRénov').
 * Police : Urbanist via Google Fonts CDN si le pipeline PDF supporte les fonts
 * web (Playwright headless OK), sinon fallback Helvetica.
 *
 * AUCUNE mention de provider IA tiers dans le rendu visible (directive
 * transversale 2026-05). Le PDF doit apparaître produit PAR le diagnostiqueur.
 */

import type { ReactElement } from 'react'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types — contenu narratif produit par le rédacteur cloud                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface PremiumReportRoomSection {
  readonly nom_piece: string
  readonly paragraphe: string
  readonly alertes: readonly string[]
}

export interface PremiumReportRecommendation {
  /** 1 = urgent / sécurité, 2 = confort / valeur, 3 = optimisation long terme. */
  readonly priorite: 1 | 2 | 3
  readonly titre: string
  readonly description: string
  readonly cout_estime_eur: number | null
  readonly economies_annuelles_eur: number | null
  readonly payback_annees: number | null
  readonly aides_publiques: string | null
}

/**
 * Structure JSON produite par l'Edge Function `generate-premium-client-report`
 * et consommée par ce composant. Miroir exact du schéma de sortie documenté
 * dans `apps/web/src/lib/ai/system-prompts/premium-report.ts`.
 */
export interface PremiumReportContent {
  readonly intro: string
  readonly par_piece: readonly PremiumReportRoomSection[]
  readonly recommandations: readonly PremiumReportRecommendation[]
  readonly conclusion: string
}

export interface PremiumReportPhoto {
  /** URL signée du Storage Supabase (1h TTL) ou data URL inline. */
  readonly url: string
  readonly caption: string
  /** Pièce associée (matche `par_piece[].nom_piece`). */
  readonly room?: string
}

export interface PremiumClientReportProps {
  /** Contenu narratif généré par le rédacteur cloud. */
  readonly content: PremiumReportContent
  /** Nom complet du propriétaire (affiché en cover + signature). */
  readonly ownerName: string
  /** Adresse complète du bien. */
  readonly propertyAddress: string
  /** Date de visite affichée en cover (formatée FR : "12 mai 2026"). */
  readonly visitDateFr: string
  /** Nom du diagnostiqueur (signature finale). */
  readonly diagnostiqueurName: string
  /** Email du diagnostiqueur (signature finale). */
  readonly diagnostiqueurEmail: string
  /** Numéro de certification (mention légale obligatoire). */
  readonly diagnostiqueurCertNumber: string
  /** Photo principale de la façade (cover). */
  readonly coverPhotoUrl?: string
  /** Photos commentées par pièce (max 2 par pièce recommandé). */
  readonly photos?: readonly PremiumReportPhoto[]
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers de formatage                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function formatEur(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'à confirmer'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatYears(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'à confirmer'
  return value < 1
    ? `${Math.round(value * 12)} mois`
    : `${value.toFixed(1).replace(/\.0$/, '')} an${value >= 2 ? 's' : ''}`
}

function priorityLabel(p: 1 | 2 | 3): string {
  if (p === 1) return 'Priorité 1'
  if (p === 2) return 'Priorité 2'
  return 'Priorité 3'
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tokens design V5 sage / navy                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

const TOKENS = {
  bgPage: '#F5F7F4',
  bgCard: '#FFFFFF',
  navy: '#0F1419',
  navySoft: '#1F2A38',
  ink: '#0F1419',
  inkSoft: '#475467',
  inkMute: '#667085',
  border: '#E4E7EC',
  chartreuse: '#D4F542',
  chartreuseDeep: '#A8C32E',
  alertBg: '#FEF3F2',
  alertText: '#B42318',
  fontStack:
    "'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Composant principal                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Rend le PDF Premium Client en HTML stylé (V1 scaffold).
 *
 * Le markup retourné est conçu pour être passé directement à un pipeline
 * HTML→PDF côté serveur (Playwright `page.pdf()` recommandé pour le pixel-perfect,
 * fallback `jspdf-html` côté Edge Function si Playwright indisponible).
 *
 * @example
 * ```tsx
 * const html = renderToStaticMarkup(<PremiumClientReport {...props} />)
 * const pdfBuffer = await playwrightRenderPdf(html, { format: 'A4' })
 * ```
 */
export function PremiumClientReport({
  content,
  ownerName,
  propertyAddress,
  visitDateFr,
  diagnostiqueurName,
  diagnostiqueurEmail,
  diagnostiqueurCertNumber,
  coverPhotoUrl,
  photos,
}: PremiumClientReportProps): ReactElement {
  const photosByRoom = new Map<string, PremiumReportPhoto[]>()
  for (const p of photos ?? []) {
    if (!p.room) continue
    const list = photosByRoom.get(p.room) ?? []
    list.push(p)
    photosByRoom.set(p.room, list)
  }

  return (
    <article
      style={{
        background: TOKENS.bgPage,
        color: TOKENS.ink,
        fontFamily: TOKENS.fontStack,
        fontSize: 14,
        lineHeight: 1.55,
        padding: 0,
        margin: 0,
        width: '210mm',
      }}
    >
      {/* ─── Page 1 — Cover ─── */}
      <section
        style={{
          minHeight: '297mm',
          padding: '48px 56px',
          pageBreakAfter: 'always',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <header>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: TOKENS.inkSoft,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Rapport client premium
          </div>
          <div
            style={{
              width: 48,
              height: 4,
              background: TOKENS.chartreuse,
              borderRadius: 2,
            }}
          />
        </header>

        <div style={{ marginTop: 64 }}>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1.1,
              color: TOKENS.navy,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Le rapport détaillé
            <br />
            de votre logement
          </h1>
          <p
            style={{
              marginTop: 24,
              fontSize: 18,
              color: TOKENS.inkSoft,
              lineHeight: 1.4,
              maxWidth: 480,
            }}
          >
            Préparé pour {ownerName}, à propos du bien situé {propertyAddress}.
          </p>
        </div>

        {coverPhotoUrl ? (
          <figure style={{ margin: '32px 0', textAlign: 'center' }}>
            <img
              src={coverPhotoUrl}
              alt={`Façade ${propertyAddress}`}
              style={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'cover',
                borderRadius: 12,
                border: `1px solid ${TOKENS.border}`,
              }}
            />
          </figure>
        ) : (
          <div
            style={{
              height: 280,
              background: TOKENS.bgCard,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: TOKENS.inkMute,
              fontSize: 13,
              margin: '32px 0',
            }}
          >
            (Photo principale du bien à insérer)
          </div>
        )}

        <footer
          style={{
            borderTop: `1px solid ${TOKENS.border}`,
            paddingTop: 16,
            fontSize: 12,
            color: TOKENS.inkMute,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Visite réalisée le {visitDateFr}</span>
          <span>{diagnostiqueurName}</span>
        </footer>
      </section>

      {/* ─── Page 2 — Intro narrative ─── */}
      <section
        style={{
          minHeight: '297mm',
          padding: '56px 56px',
          pageBreakAfter: 'always',
        }}
      >
        <PageTitle eyebrow="Synthèse" title="Votre logement en quelques mots" />
        <div
          style={{
            marginTop: 24,
            fontSize: 15,
            color: TOKENS.inkSoft,
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}
        >
          {content.intro}
        </div>
      </section>

      {/* ─── Pages 3-N — Sections par pièce ─── */}
      {content.par_piece.map((section, idx) => (
        <section
          key={`room-${idx}-${section.nom_piece}`}
          style={{
            minHeight: '297mm',
            padding: '56px 56px',
            pageBreakAfter: 'always',
          }}
        >
          <PageTitle
            eyebrow={`Pièce ${idx + 1} sur ${content.par_piece.length}`}
            title={section.nom_piece}
          />

          <p
            style={{
              marginTop: 24,
              fontSize: 15,
              color: TOKENS.inkSoft,
              lineHeight: 1.7,
            }}
          >
            {section.paragraphe}
          </p>

          {section.alertes.length > 0 ? (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: TOKENS.alertBg,
                borderLeft: `3px solid ${TOKENS.alertText}`,
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: TOKENS.alertText,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Points d'attention
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: TOKENS.alertText, fontSize: 14 }}>
                {section.alertes.map((a) => (
                  <li key={`alert-${section.nom_piece}-${a}`} style={{ marginBottom: 4 }}>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Photos de la pièce (si disponibles). */}
          {(photosByRoom.get(section.nom_piece) ?? []).slice(0, 2).map((photo) => (
            <figure
              key={`photo-${section.nom_piece}-${photo.url}`}
              style={{
                margin: '24px 0 0',
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 12,
                padding: 8,
              }}
            >
              <img
                src={photo.url}
                alt={photo.caption}
                style={{
                  width: '100%',
                  maxHeight: 320,
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
              <figcaption
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: TOKENS.inkMute,
                  fontStyle: 'italic',
                }}
              >
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </section>
      ))}

      {/* ─── Page N+1 — Recommandations chiffrées ─── */}
      <section
        style={{
          minHeight: '297mm',
          padding: '56px 56px',
          pageBreakAfter: 'always',
        }}
      >
        <PageTitle eyebrow="Plan d'action" title="Nos recommandations chiffrées" />

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {content.recommandations.map((reco, idx) => (
            <div key={`reco-${idx}-${reco.titre}`}>
              <RecommendationCard reco={reco} />
            </div>
          ))}
        </div>
      </section>

      {/* ─── Dernière page — Conclusion + signature ─── */}
      <section style={{ minHeight: '297mm', padding: '56px 56px' }}>
        <PageTitle eyebrow="En conclusion" title="Pour la suite" />

        <div
          style={{
            marginTop: 24,
            fontSize: 15,
            color: TOKENS.inkSoft,
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}
        >
          {content.conclusion}
        </div>

        <div
          style={{
            marginTop: 64,
            padding: 24,
            background: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: TOKENS.inkMute,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Votre diagnostiqueur
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TOKENS.navy }}>
            {diagnostiqueurName}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.inkSoft }}>
            {diagnostiqueurEmail}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: TOKENS.inkMute }}>
            Certification n° {diagnostiqueurCertNumber}
          </div>
        </div>
      </section>
    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Sous-composants                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }): ReactElement {
  return (
    <header>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: TOKENS.chartreuseDeep,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.15,
          color: TOKENS.navy,
          margin: 0,
          letterSpacing: '-0.015em',
        }}
      >
        {title}
      </h2>
    </header>
  )
}

function RecommendationCard({
  reco,
}: {
  reco: PremiumReportRecommendation
}): ReactElement {
  const badgeBg =
    reco.priorite === 1 ? TOKENS.navy : reco.priorite === 2 ? TOKENS.navySoft : '#9AA4B2'

  return (
    <article
      style={{
        background: TOKENS.bgCard,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: TOKENS.navy,
            margin: 0,
            flex: 1,
          }}
        >
          {reco.titre}
        </h3>
        <span
          style={{
            background: badgeBg,
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {priorityLabel(reco.priorite)}
        </span>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 14, color: TOKENS.inkSoft, lineHeight: 1.6 }}>
        {reco.description}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          padding: 12,
          background: TOKENS.bgPage,
          borderRadius: 8,
        }}
      >
        <Stat label="Coût estimé" value={formatEur(reco.cout_estime_eur)} />
        <Stat label="Économies / an" value={formatEur(reco.economies_annuelles_eur)} />
        <Stat label="Retour sur invest." value={formatYears(reco.payback_annees)} />
      </div>

      {reco.aides_publiques ? (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: TOKENS.chartreuse,
            color: TOKENS.navy,
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            display: 'inline-block',
          }}
        >
          Aide publique : {reco.aides_publiques}
        </div>
      ) : null}
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: TOKENS.inkMute,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TOKENS.navy, marginTop: 2 }}>{value}</div>
    </div>
  )
}
