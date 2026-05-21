/**
 * Génération XML Factur-X profil EN16931 (norme européenne UN/CEFACT CII).
 *
 * Spec : ZUGFeRD/Factur-X 2.x — Cross Industry Invoice (CII) D16B.
 * https://fnfe-mpe.org/factur-x/
 *
 * Profil EN16931 (équivalent ZUGFeRD COMFORT) = niveau minimum exigé par
 * la future obligation PPF/Iopole 09/2027 pour les TPE. Contient toutes les
 * mentions légales obligatoires + données structurées de paiement.
 *
 * Le XML produit est destiné à :
 *   1. Être affiché tel quel (export `.xml` côté admin / utilisateur power)
 *   2. Être embarqué dans le PDF/A-3 (cf. embed-facturx.ts à venir V2)
 *   3. Être transmis au PPF Iopole quand disponible (champ ppf_transmission_id)
 *
 * Codes BT (Business Term) référencés dans les commentaires.
 *
 * Type document codes (BT-3) :
 *   380 = Facture commerciale standard
 *   381 = Avoir (Credit note)
 */

import {
  type InvoiceClientSnapshot,
  type InvoiceIssuerSnapshot,
  type InvoiceLineItem,
} from './types'

export type FacturxDocumentTypeCode = '380' | '381'

export interface GenerateFacturxXmlInput {
  reference: string
  typeCode: FacturxDocumentTypeCode
  issuedAt: string | null // YYYY-MM-DD
  dueDate: string | null
  paymentTermsDays: number
  notes: string | null
  lineItems: InvoiceLineItem[]
  tvaRate: number
  amountHt: number
  amountTva: number
  amountTtc: number
  issuer: InvoiceIssuerSnapshot
  client: InvoiceClientSnapshot
  /** Référence facture d'origine (uniquement BT-3 = 381) */
  creditNoteForReference?: string | null
}

function escapeXml(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatYyyymmdd(iso: string | null): string {
  if (!iso) return ''
  // Factur-X format 102 = YYYYMMDD sans séparateur
  return iso.replace(/-/g, '').slice(0, 8)
}

function num(n: number): string {
  // Toujours 2 décimales, point séparateur (norme XBRL)
  return n.toFixed(2)
}

/**
 * Génère le XML Factur-X complet en string. Pas de pretty-print —
 * le parser PPF Iopole accepte les deux et compresse mieux.
 */
export function generateFacturxXml(input: GenerateFacturxXmlInput): string {
  const isCreditNote = input.typeCode === '381'
  const issuedYyyymmdd = formatYyyymmdd(input.issuedAt)
  const dueYyyymmdd = formatYyyymmdd(input.dueDate)

  // Pour un avoir : montants négatifs (norme CII)
  const sign = isCreditNote ? -1 : 1
  const ht = input.amountHt * sign
  const tva = input.amountTva * sign
  const ttc = input.amountTtc * sign

  const lineItemsXml = input.lineItems
    .map((item, idx) => {
      const lineHt = item.unit_price_ht * item.quantity * sign
      const unitPrice = item.unit_price_ht * sign
      return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.label)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${num(unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${num(item.tva_rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${num(lineHt)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join('')

  // Bloc référence facture d'origine si avoir
  const refDocXml = isCreditNote && input.creditNoteForReference
    ? `
      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${escapeXml(input.creditNoteForReference)}</ram:IssuerAssignedID>
      </ram:InvoiceReferencedDocument>`
    : ''

  // Bloc notes
  const notesXml = input.notes
    ? `
    <ram:IncludedNote>
      <ram:Content>${escapeXml(input.notes)}</ram:Content>
    </ram:IncludedNote>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(input.reference)}</ram:ID>
    <ram:TypeCode>${input.typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issuedYyyymmdd}</udt:DateTimeString>
    </ram:IssueDateTime>${notesXml}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineItemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(input.issuer.name)}</ram:Name>
        ${input.issuer.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0009">${escapeXml(input.issuer.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          ${input.issuer.postal_code ? `<ram:PostcodeCode>${escapeXml(input.issuer.postal_code)}</ram:PostcodeCode>` : ''}
          ${input.issuer.address ? `<ram:LineOne>${escapeXml(input.issuer.address)}</ram:LineOne>` : ''}
          ${input.issuer.city ? `<ram:CityName>${escapeXml(input.issuer.city)}</ram:CityName>` : ''}
          <ram:CountryID>${escapeXml(input.issuer.country || 'FR')}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${input.issuer.vat_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(input.issuer.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(input.client.display_name)}</ram:Name>
        ${input.client.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0009">${escapeXml(input.client.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          ${input.client.postal_code ? `<ram:PostcodeCode>${escapeXml(input.client.postal_code)}</ram:PostcodeCode>` : ''}
          ${input.client.address ? `<ram:LineOne>${escapeXml(input.client.address)}</ram:LineOne>` : ''}
          ${input.client.city ? `<ram:CityName>${escapeXml(input.client.city)}</ram:CityName>` : ''}
          <ram:CountryID>${escapeXml(input.client.country || 'FR')}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>${refDocXml}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${issuedYyyymmdd}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${input.issuer.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>30</ram:TypeCode>
        <ram:Information>Virement</ram:Information>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(input.issuer.iban.replace(/\s+/g, ''))}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${input.issuer.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${escapeXml(input.issuer.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${num(tva)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${num(ht)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${num(input.tvaRate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      ${dueYyyymmdd ? `<ram:SpecifiedTradePaymentTerms>
        <ram:Description>Paiement à ${input.paymentTermsDays} jour${input.paymentTermsDays > 1 ? 's' : ''}</ram:Description>
        <ram:DueDateDateTime><udt:DateTimeString format="102">${dueYyyymmdd}</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${num(ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${num(ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${num(tva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${num(ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${num(ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`
}
