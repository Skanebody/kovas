/**
 * KOVAS — Génération XML CII Factur-X (profile EN16931) pour un devis.
 *
 * Référence : `urn:cen.eu:en16931:2017`
 *
 * Limites V1 :
 *   - Pas d'embed PDF/A-3 (pdf-lib n'est pas installé). On stocke le XML
 *     en clair dans `quotes.facturx_xml` pour audit et future intégration.
 *   - Pas de validation de schéma XSD côté server — la conformité sera
 *     vérifiée Phase 2 (M10-M18) lors de l'intégration PPF / Iopole.
 *
 * Profil EN16931 (européen) : couvre 99% des cas FR, inclut :
 *   - ExchangedDocument (id, type, issue date)
 *   - SupplyChainTradeTransaction
 *       - IncludedSupplyChainTradeLineItem (lignes prestations)
 *       - ApplicableHeaderTradeAgreement (seller + buyer TradeParty)
 *       - ApplicableHeaderTradeDelivery
 *       - ApplicableHeaderTradeSettlement (montants + TVA + paiement)
 */

import type {
  QuoteClientSnapshot,
  QuoteLineItem,
  QuoteOrganizationSnapshot,
} from './types'

export interface FacturxQuoteInput {
  reference: string
  /** Date émission (YYYY-MM-DD). */
  issuedAt: string
  /** Date d'expiration (YYYY-MM-DD). */
  expiresAt: string
  lines: QuoteLineItem[]
  totalHt: number
  totalTva: number
  totalTtc: number
  paymentTermsDays: number
  paymentMethod: string
  organization: QuoteOrganizationSnapshot
  client: QuoteClientSnapshot
  /** Profil Factur-X attendu (défaut : EN16931). */
  profile?: 'BASIC' | 'EN16931' | 'EXTENDED'
}

/**
 * Échappe les caractères XML dangereux dans un string.
 */
function xmlEscape(s: string | null | undefined): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format un nombre pour Factur-X : 2 décimales, séparateur point.
 */
function fmt(n: number): string {
  return n.toFixed(2)
}

/**
 * Convertit YYYY-MM-DD → YYYYMMDD (format UN/CEFACT 102).
 */
function fmtDate102(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8)
}

/**
 * Mapping des moyens de paiement KOVAS → UN/CEFACT 4461 codes.
 *   30 = Crédit transfert (virement)
 *   59 = SEPA direct debit
 *   20 = Chèque
 *   10 = Espèces
 *   54 = Carte bancaire
 */
function paymentMethodCode(method: string): string {
  switch (method) {
    case 'virement':
      return '30'
    case 'sepa':
      return '59'
    case 'cheque':
      return '20'
    case 'especes':
      return '10'
    case 'cb':
      return '54'
    default:
      return '30'
  }
}

/**
 * Code profile Factur-X correspondant à `urn:cen.eu:en16931:2017#compliant#...`.
 */
function profileUrn(profile: 'BASIC' | 'EN16931' | 'EXTENDED'): string {
  switch (profile) {
    case 'BASIC':
      return 'urn:factur-x.eu:1p0:basic'
    case 'EXTENDED':
      return 'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended'
    default:
      return 'urn:cen.eu:en16931:2017'
  }
}

export function generateFacturxXml(input: FacturxQuoteInput): string {
  const profile = input.profile ?? 'EN16931'
  const reference = xmlEscape(input.reference)
  const issuedAt102 = fmtDate102(input.issuedAt)

  // Regroupe la TVA par taux (Factur-X exige un récap par taux distinct).
  const tvaGroups = new Map<number, { baseHt: number; tva: number }>()
  for (const line of input.lines) {
    const lineHt = Math.round(line.quantity * line.unitPriceHt * 100) / 100
    const lineTva = Math.round(lineHt * (line.tvaRate / 100) * 100) / 100
    const existing = tvaGroups.get(line.tvaRate)
    if (existing) {
      existing.baseHt += lineHt
      existing.tva += lineTva
    } else {
      tvaGroups.set(line.tvaRate, { baseHt: lineHt, tva: lineTva })
    }
  }

  // Lines (IncludedSupplyChainTradeLineItem)
  const linesXml = input.lines
    .map((line, idx) => {
      const lineHt = Math.round(line.quantity * line.unitPriceHt * 100) / 100
      return `      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${idx + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${xmlEscape(line.designation)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${fmt(line.unitPriceHt)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="C62">${fmt(line.quantity)}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>S</ram:CategoryCode>
            <ram:RateApplicablePercent>${fmt(line.tvaRate)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${fmt(lineHt)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join('\n')

  // Récap TVA (ApplicableTradeTax au niveau header)
  const tvaSummary = Array.from(tvaGroups.entries())
    .map(
      ([rate, { baseHt, tva }]) => `        <ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${fmt(tva)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:BasisAmount>${fmt(baseHt)}</ram:BasisAmount>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`,
    )
    .join('\n')

  // SellerTradeParty
  const seller = `        <ram:SellerTradeParty>
          <ram:Name>${xmlEscape(input.organization.name)}</ram:Name>
          ${
            input.organization.siret
              ? `<ram:SpecifiedLegalOrganization>
            <ram:ID schemeID="0002">${xmlEscape(input.organization.siret)}</ram:ID>
          </ram:SpecifiedLegalOrganization>`
              : ''
          }
          <ram:PostalTradeAddress>
            <ram:PostcodeCode>${xmlEscape(input.organization.postalCode)}</ram:PostcodeCode>
            <ram:LineOne>${xmlEscape(input.organization.address)}</ram:LineOne>
            <ram:CityName>${xmlEscape(input.organization.city)}</ram:CityName>
            <ram:CountryID>${xmlEscape(input.organization.country)}</ram:CountryID>
          </ram:PostalTradeAddress>
          ${
            input.organization.vatNumber
              ? `<ram:SpecifiedTaxRegistration>
            <ram:ID schemeID="VA">${xmlEscape(input.organization.vatNumber)}</ram:ID>
          </ram:SpecifiedTaxRegistration>`
              : ''
          }
        </ram:SellerTradeParty>`

  // BuyerTradeParty
  const buyer = `        <ram:BuyerTradeParty>
          <ram:Name>${xmlEscape(input.client.displayName)}</ram:Name>
          ${
            input.client.siret
              ? `<ram:SpecifiedLegalOrganization>
            <ram:ID schemeID="0002">${xmlEscape(input.client.siret)}</ram:ID>
          </ram:SpecifiedLegalOrganization>`
              : ''
          }
          <ram:PostalTradeAddress>
            <ram:PostcodeCode>${xmlEscape(input.client.postalCode)}</ram:PostcodeCode>
            <ram:LineOne>${xmlEscape(input.client.address)}</ram:LineOne>
            <ram:CityName>${xmlEscape(input.client.city)}</ram:CityName>
            <ram:CountryID>FR</ram:CountryID>
          </ram:PostalTradeAddress>
        </ram:BuyerTradeParty>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profileUrn(profile)}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${reference}</ram:ID>
    <ram:TypeCode>325</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issuedAt102}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
${seller}
${buyer}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery />
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${paymentMethodCode(input.paymentMethod)}</ram:TypeCode>
      </ram:SpecifiedTradeSettlementPaymentMeans>
${tvaSummary}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Paiement à ${input.paymentTermsDays} jours date d'émission</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${fmtDate102(input.expiresAt)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt(input.totalHt)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt(input.totalHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmt(input.totalTva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt(input.totalTtc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt(input.totalTtc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`
}
