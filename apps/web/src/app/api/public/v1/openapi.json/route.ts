/**
 * KOVAS — OpenAPI 3.1 spec pour l'API publique v1.
 *
 * Servi à `/api/public/v1/openapi.json` (et linkée depuis /pros/api).
 * Mise à jour manuelle à chaque ajout d'endpoint.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10.
 */

import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 86400 // 24h ISR

export function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'KOVAS API publique',
      version: '1.0.0',
      description:
        "API d'accès aux données publiques agrégées sur le diagnostic immobilier français — référentiel diagnostiqueurs, profils unifiés de propriété, statistiques de la profession.\n\nDonnées 100% open data : BAN + IGN Cadastre + ADEME DPE + DVF + INSEE Sirene + DHUP + Géorisques. Aucune PII exposée.",
      contact: {
        name: 'Équipe KOVAS',
        email: 'contact@kovas.fr',
        url: 'https://kovas.fr/pros/api',
      },
      license: {
        name: 'CC-BY 4.0',
        url: 'https://creativecommons.org/licenses/by/4.0/',
      },
    },
    servers: [
      { url: 'https://kovas.fr/api/public/v1', description: 'Production' },
    ],
    paths: {
      '/property/{banId}': {
        get: {
          summary: 'Profil unifié propriété',
          description:
            'Retourne le profil consolidé cross-source pour une adresse identifiée par son BAN ID. Inclut cadastre IGN, transactions DVF (10 ans), historique DPE ADEME, risques ERP Géorisques. Cache 7 jours.',
          parameters: [
            {
              name: 'banId',
              in: 'path',
              required: true,
              schema: { type: 'string', minLength: 5, maxLength: 100 },
              description: 'Identifiant BAN officiel (api-adresse.data.gouv.fr)',
            },
            {
              name: 'X-API-Key',
              in: 'header',
              required: false,
              schema: { type: 'string' },
              description: 'Clé API (élève la limite à 600 req/min)',
            },
          ],
          responses: {
            '200': {
              description: 'Profil unifié',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/PropertyProfile' } } },
            },
            '400': { description: 'banId invalide' },
            '404': { description: 'Adresse introuvable' },
            '429': { description: 'Rate limit dépassé' },
            '500': { description: 'Erreur serveur' },
          },
        },
      },
      '/observatoire/profession': {
        get: {
          summary: 'Statistiques agrégées de la profession',
          description:
            "État de la profession du diagnostic immobilier en France : total DHUP, taux de cross-validation SIRENE, taux d'activité, distribution par département. Aucune PII. Cache 1 h.",
          parameters: [
            {
              name: 'X-API-Key',
              in: 'header',
              required: false,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Statistiques agrégées',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ObservatoireProfession' } },
              },
            },
            '429': { description: 'Rate limit dépassé' },
            '500': { description: 'Erreur serveur' },
          },
        },
      },
      '/commune/{inseeCode}': {
        get: {
          summary: 'Statistiques DPE + DVF par commune',
          description:
            'Statistiques agrégées open data pour une commune française : passoires thermiques (% F-G), volume DPE 24 mois, prix médian DVF, prix moyen €/m² 12 mois. Source ADEME + Etalab DVF. Cache 6h.',
          parameters: [
            {
              name: 'inseeCode',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^[0-9A-B]{5}$' },
              description: 'Code INSEE 5 caractères (ex: 75056 pour Paris)',
            },
            {
              name: 'X-API-Key',
              in: 'header',
              required: false,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Statistiques commune',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CommuneStats' } },
              },
            },
            '400': { description: 'Code INSEE invalide' },
            '404': { description: "Commune absente du data lake (pas encore ingérée)" },
            '429': { description: 'Rate limit dépassé' },
            '500': { description: 'Erreur serveur' },
          },
        },
      },
    },
    components: {
      schemas: {
        PropertyProfile: {
          type: 'object',
          properties: {
            ban_id: { type: 'string' },
            address: { type: 'string' },
            postal_code: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            insee_code: { type: 'string', nullable: true },
            geo: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' },
              },
            },
            cadastre: { type: 'object', nullable: true },
            transactions: { type: 'array', items: { type: 'object' } },
            dpe_history: { type: 'array', items: { type: 'object' } },
            erp_risks: { type: 'object', nullable: true },
            meta: {
              type: 'object',
              properties: {
                last_synced_at: { type: 'string', format: 'date-time' },
                freshness_score: { type: 'number', minimum: 0, maximum: 1 },
                partial_failures: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        CommuneStats: {
          type: 'object',
          properties: {
            api_version: { type: 'string', const: '1.0' },
            generated_at: { type: 'string', format: 'date-time' },
            insee_code: { type: 'string' },
            dpe: {
              type: 'object',
              nullable: true,
              properties: {
                total_dpe_24_months: { type: 'integer' },
                count_passoires_f_g: { type: 'integer' },
                ratio_passoires_pct: { type: 'number', nullable: true },
                last_dpe_date: { type: 'string', format: 'date', nullable: true },
              },
            },
            transactions: {
              type: 'object',
              nullable: true,
              properties: {
                total_transactions_12_months: { type: 'integer' },
                avg_price_per_m2_eur: { type: 'integer', nullable: true },
                median_price_eur: { type: 'integer', nullable: true },
                last_transaction_date: { type: 'string', format: 'date', nullable: true },
              },
            },
            methodology: { type: 'object' },
          },
        },
        ObservatoireProfession: {
          type: 'object',
          properties: {
            api_version: { type: 'string', const: '1.0' },
            generated_at: { type: 'string', format: 'date-time' },
            summary: {
              type: 'object',
              properties: {
                total_diagnosticians: { type: 'integer' },
                verified: { type: 'integer' },
                unverified: { type: 'integer' },
                sirene_active: { type: 'integer' },
                very_active: { type: 'integer' },
                last_dhup_sync_at: { type: 'string', format: 'date-time', nullable: true },
              },
            },
            ratios_pct: {
              type: 'object',
              properties: {
                verified: { type: 'integer' },
                sirene_active: { type: 'integer' },
                very_active: { type: 'integer' },
                claimed: { type: 'integer' },
                with_fraud_flags: { type: 'integer' },
              },
            },
            top_departments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  department_code: { type: 'string' },
                  total: { type: 'integer' },
                  verified: { type: 'integer' },
                  avg_activity_score: { type: 'number', nullable: true },
                },
              },
            },
            methodology: { type: 'object' },
          },
        },
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    'x-rate-limits': {
      anonymous: { requests_per_minute: 60, identification: 'IP' },
      api_key: { requests_per_minute: 600, identification: 'X-API-Key header' },
      enforcement: 'sliding-window via Upstash Redis (production) ou in-memory (fallback)',
    },
  }

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
