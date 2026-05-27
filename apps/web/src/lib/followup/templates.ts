/**
 * KOVAS — Templates de séquences de relance (Module 5).
 *
 * 5 types de séquences supportées :
 *  - `quote_pending`        : devis envoyé sans réponse
 *  - `invoice_unpaid`       : facture émise sans paiement
 *  - `post_dpe_fg`          : DPE F/G livré → suivi opportunité travaux
 *  - `prescriber_silent`    : agent prescripteur sans mission depuis N jours
 *  - `review_request`       : demande d'avis post-livraison
 *
 * Chaque template renvoie un `SequenceStepContent` (subject + text + html) prêt
 * à être passé à `sendEmail`. Les fonctions sont PURES : pas de side effects,
 * pas d'appel DB. La récupération des données contextuelles (quote, mission, etc.)
 * se fait côté caller.
 *
 * Ton : SOBRE, PROFESSIONNEL, vouvoiement par défaut. Pas d'emojis fun. Signature
 * "— Benjamin / KOVAS" (cf. CLAUDE.md avatar client diagnostiqueur).
 *
 * RGPD : chaque email contient un lien de désinscription (unsubscribeUrl injecté
 * par l'exécutant).
 */

export type SequenceTemplate =
  | 'quote_pending'
  | 'invoice_unpaid'
  | 'post_dpe_fg'
  | 'prescriber_silent'
  | 'review_request'

export interface SequenceStepContent {
  subject: string
  text: string
  html: string
}

interface BaseContext {
  recipientFirstName: string | null
  recipientCompany: string | null
  diagnosticianName: string
  diagnosticianEmail: string
  unsubscribeUrl: string
  appUrl: string
}

export interface QuoteContext extends BaseContext {
  quoteRef: string
  quoteAmountEur: number
  sentDaysAgo: number
  viewUrl: string
}

export interface InvoiceContext extends BaseContext {
  invoiceNumber: string
  invoiceAmountEur: number
  daysSinceDue: number
  paymentUrl: string
}

export interface PostDpeFgContext extends BaseContext {
  missionReference: string
  propertyAddress: string
  dpeClass: 'F' | 'G'
  rgeContactName: string | null
}

export interface PrescriberContext extends BaseContext {
  prescriberName: string
  silentDays: number
  lastMissionAt: string | null
}

export interface ReviewRequestContext extends BaseContext {
  missionReference: string
  reviewUrl: string
}

// ────────────────────────────────────────────────────────────
// Helpers de rendu
// ────────────────────────────────────────────────────────────

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrapEmailHtml(args: {
  body: string
  unsubscribeUrl: string
  diagnosticianName: string
}): string {
  // HTML inline, compatible Gmail / Outlook (pas de <style> dans <head>, table-based layout).
  const safeBody = args.body
  const safeName = escapeHtml(args.diagnosticianName)
  const unsub = escapeHtml(args.unsubscribeUrl)
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1E3D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5EE;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF6;border:1px solid #D5CDB8;border-radius:18px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.55;color:#0F1E3D;">
          ${safeBody}
          <p style="margin-top:32px;color:#4A5878;">— ${safeName}<br/>KOVAS</p>
        </td></tr>
        <tr><td style="border-top:1px solid #E5DECB;padding-top:16px;margin-top:24px;font-size:12px;color:#7E8AA4;">
          Cet email vous est envoyé par votre diagnostiqueur via la plateforme KOVAS.
          <a href="${unsub}" style="color:#4A5878;">Se désinscrire de ces relances</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px 0;">${escapeHtml(text)}</p>`
}

function buttonHtml(label: string, url: string): string {
  return `<p style="margin:24px 0;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#0F1E3D;color:#F8F5EE;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a>
  </p>`
}

function unsubFooterText(unsubscribeUrl: string): string {
  return `\n\nSe désinscrire des relances : ${unsubscribeUrl}`
}

// ────────────────────────────────────────────────────────────
// 1. Quote pending — devis sans réponse
// ────────────────────────────────────────────────────────────

export function templateSequenceQuote(step: number, ctx: QuoteContext): SequenceStepContent {
  const greeting = ctx.recipientFirstName ? `Bonjour ${ctx.recipientFirstName},` : 'Bonjour,'
  const ref = ctx.quoteRef
  const amount = ctx.quoteAmountEur.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  switch (step) {
    case 0: {
      // J+7 : rappel doux
      const subject = `Votre devis ${ref} — un point rapide ?`
      const text = `${greeting}

Je reviens vers vous concernant le devis ${ref} que je vous ai transmis il y a ${ctx.sentDaysAgo} jours pour un montant de ${amount} €.

Avez-vous pu en prendre connaissance ? Je reste disponible pour répondre à vos questions ou ajuster la prestation si besoin.

Vous pouvez consulter le devis à tout moment ici : ${ctx.viewUrl}
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `Je reviens vers vous concernant le devis ${ref} que je vous ai transmis il y a ${ctx.sentDaysAgo} jours pour un montant de ${amount} €.`,
        ) +
        paragraph(
          'Avez-vous pu en prendre connaissance ? Je reste disponible pour répondre à vos questions ou ajuster la prestation si besoin.',
        ) +
        buttonHtml('Consulter le devis', ctx.viewUrl)
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    case 1: {
      // J+15 : relance + précisions
      const subject = `Devis ${ref} — toujours d'actualité ?`
      const text = `${greeting}

Je n'ai pas eu de retour concernant le devis ${ref} (${amount} €).

Si votre projet a évolué (report, annulation, ajustement de périmètre), faites-le moi savoir : je peux adapter la proposition ou la clôturer si elle n'est plus pertinente.

Devis : ${ctx.viewUrl}
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(`Je n'ai pas eu de retour concernant le devis ${ref} (${amount} €).`) +
        paragraph(
          "Si votre projet a évolué (report, annulation, ajustement de périmètre), faites-le moi savoir : je peux adapter la proposition ou la clôturer si elle n'est plus pertinente.",
        ) +
        buttonHtml('Voir le devis', ctx.viewUrl)
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    case 2: {
      // J+30 : dernier rappel
      const subject = `Devis ${ref} — dernière relance`
      const text = `${greeting}

Sans retour de votre part dans les prochains jours, je clôturerai le devis ${ref} dans mon outil de suivi.

Vous pouvez bien sûr revenir vers moi à tout moment pour relancer le projet.

— ${ctx.diagnosticianName}
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `Sans retour de votre part dans les prochains jours, je clôturerai le devis ${ref} dans mon outil de suivi.`,
        ) +
        paragraph('Vous pouvez bien sûr revenir vers moi à tout moment pour relancer le projet.')
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    default:
      throw new Error(`templateSequenceQuote: step ${step} out of range (0-2)`)
  }
}

// ────────────────────────────────────────────────────────────
// 2. Invoice unpaid
// ────────────────────────────────────────────────────────────

export function templateSequenceInvoice(step: number, ctx: InvoiceContext): SequenceStepContent {
  const greeting = ctx.recipientFirstName ? `Bonjour ${ctx.recipientFirstName},` : 'Bonjour,'
  const ref = ctx.invoiceNumber
  const amount = ctx.invoiceAmountEur.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  switch (step) {
    case 0: {
      const subject = `Facture ${ref} — rappel`
      const text = `${greeting}

La facture ${ref} d'un montant de ${amount} € est arrivée à échéance depuis ${ctx.daysSinceDue} jours.

Si le règlement est en cours, je vous prie de l'ignorer. Dans le cas contraire, vous pouvez procéder au paiement ici : ${ctx.paymentUrl}

Restant disponible si vous avez besoin d'une copie de la facture ou d'un échéancier.
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `La facture ${ref} d'un montant de ${amount} € est arrivée à échéance depuis ${ctx.daysSinceDue} jours.`,
        ) +
        paragraph(
          "Si le règlement est en cours, je vous prie de l'ignorer. Dans le cas contraire, vous pouvez procéder au paiement en quelques clics.",
        ) +
        buttonHtml('Régler la facture', ctx.paymentUrl)
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    case 1: {
      const subject = `Facture ${ref} — règlement attendu`
      const text = `${greeting}

Sans nouvelle de votre part, la facture ${ref} (${amount} €) reste impayée à ce jour.

Conformément aux conditions générales de vente, les pénalités de retard s'appliquent à compter du 31e jour suivant l'échéance (taux d'intérêt légal + 10 € forfaitaires).

Je préfère régler cela à l'amiable. N'hésitez pas à me contacter si vous rencontrez une difficulté ponctuelle, un échéancier est envisageable.

Régler en ligne : ${ctx.paymentUrl}
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `Sans nouvelle de votre part, la facture ${ref} (${amount} €) reste impayée à ce jour.`,
        ) +
        paragraph(
          "Conformément aux CGV, les pénalités de retard s'appliquent à compter du 31e jour suivant l'échéance.",
        ) +
        paragraph(
          "Je préfère régler cela à l'amiable. Contactez-moi si vous rencontrez une difficulté ponctuelle.",
        ) +
        buttonHtml('Régler en ligne', ctx.paymentUrl)
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    case 2: {
      const subject = `Facture ${ref} — mise en demeure préalable`
      const text = `${greeting}

À ce jour, la facture ${ref} d'un montant de ${amount} € n'a toujours pas été réglée malgré mes précédents rappels.

Sans paiement sous 8 jours, je serai contraint d'engager une procédure de recouvrement, ce que je préférerais éviter.

Régler immédiatement : ${ctx.paymentUrl}
Me contacter : ${ctx.diagnosticianEmail}
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `À ce jour, la facture ${ref} d'un montant de ${amount} € n'a toujours pas été réglée malgré mes précédents rappels.`,
        ) +
        paragraph(
          "Sans paiement sous 8 jours, je serai contraint d'engager une procédure de recouvrement, ce que je préférerais éviter.",
        ) +
        buttonHtml('Régler immédiatement', ctx.paymentUrl)
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    default:
      throw new Error(`templateSequenceInvoice: step ${step} out of range (0-2)`)
  }
}

// ────────────────────────────────────────────────────────────
// 3. Post DPE F/G — opportunité travaux
// ────────────────────────────────────────────────────────────

export function templateSequencePostDpeFG(
  step: number,
  ctx: PostDpeFgContext,
): SequenceStepContent {
  const greeting = ctx.recipientFirstName ? `Bonjour ${ctx.recipientFirstName},` : 'Bonjour,'
  const ref = ctx.missionReference

  switch (step) {
    case 0: {
      // J+14 : suite à livraison DPE F/G
      const subject = `Diagnostic ${ref} — pistes d'amélioration énergétique`
      const text = `${greeting}

Suite au diagnostic réalisé sur le bien situé ${ctx.propertyAddress}, votre logement a été classé ${ctx.dpeClass}.

Pour information, les biens classés F et G entrent progressivement dans le calendrier d'interdiction de location (loi Climat et Résilience) : G interdit à la location depuis 2025, F dès 2028, E à partir de 2034.

Si vous envisagez des travaux d'amélioration énergétique, je peux vous orienter vers les dispositifs d'aide disponibles (MaPrimeRénov', CEE, Éco-PTZ).

Restant à votre disposition pour toute question.
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `Suite au diagnostic réalisé sur le bien situé ${ctx.propertyAddress}, votre logement a été classé ${ctx.dpeClass}.`,
        ) +
        paragraph(
          "Les biens F et G entrent progressivement dans le calendrier d'interdiction de location (loi Climat et Résilience).",
        ) +
        paragraph(
          "Si vous envisagez des travaux, je peux vous orienter vers les dispositifs d'aide (MaPrimeRénov', CEE, Éco-PTZ).",
        )
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    case 1: {
      // J+90 : reprise contact si pas de retour
      const subject = `Vos travaux d'amélioration énergétique — point d'étape ?`
      const text = `${greeting}

Trois mois se sont écoulés depuis votre diagnostic ${ref} (étiquette ${ctx.dpeClass}).

Avez-vous pu avancer sur d'éventuels travaux d'amélioration énergétique ? Si vous souhaitez planifier un nouveau diagnostic après travaux, je peux vous accompagner.

Bien à vous,
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `Trois mois se sont écoulés depuis votre diagnostic ${ref} (étiquette ${ctx.dpeClass}).`,
        ) +
        paragraph(
          "Avez-vous pu avancer sur d'éventuels travaux ? Si vous souhaitez planifier un nouveau diagnostic après travaux, je peux vous accompagner.",
        )
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    default:
      throw new Error(`templateSequencePostDpeFG: step ${step} out of range (0-1)`)
  }
}

// ────────────────────────────────────────────────────────────
// 4. Prescriber silent — agence/notaire sans mission depuis N jours
// ────────────────────────────────────────────────────────────

export function templateSequencePrescriberSilent(
  step: number,
  ctx: PrescriberContext,
): SequenceStepContent {
  const greeting = ctx.recipientFirstName ? `Bonjour ${ctx.recipientFirstName},` : `Bonjour,`

  switch (step) {
    case 0: {
      const subject =
        `Un point rapide ${ctx.recipientCompany ? `avec ${ctx.recipientCompany}` : ''}`.trim()
      const lastMissionStr = ctx.lastMissionAt
        ? `Notre dernière collaboration remonte au ${new Date(ctx.lastMissionAt).toLocaleDateString('fr-FR')}.`
        : `Nous n'avons pas encore eu l'occasion de collaborer.`
      const text = `${greeting}

${lastMissionStr} Je profite de cet email pour reprendre contact.

Si vous avez des biens nécessitant un diagnostic prochainement, je peux intervenir rapidement et vous transmettre devis et planning sous 24 h.

Bonne journée,
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(lastMissionStr + ' Je profite de cet email pour reprendre contact.') +
        paragraph(
          'Si vous avez des biens nécessitant un diagnostic prochainement, je peux intervenir rapidement et vous transmettre devis et planning sous 24 h.',
        )
      return {
        subject: subject.length > 0 ? subject : 'Un point rapide',
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    default:
      throw new Error(`templateSequencePrescriberSilent: step ${step} out of range (0)`)
  }
}

// ────────────────────────────────────────────────────────────
// 5. Review request — demande d'avis post-livraison
// ────────────────────────────────────────────────────────────

export function templateSequenceReviewRequest(
  step: number,
  ctx: ReviewRequestContext,
): SequenceStepContent {
  const greeting = ctx.recipientFirstName ? `Bonjour ${ctx.recipientFirstName},` : 'Bonjour,'

  switch (step) {
    case 0: {
      const subject = `Votre avis sur le diagnostic ${ctx.missionReference}`
      const text = `${greeting}

J'espère que mon intervention pour le diagnostic ${ctx.missionReference} s'est déroulée à votre satisfaction.

Si vous avez quelques minutes, votre retour me serait précieux. Vous pouvez laisser un avis ici : ${ctx.reviewUrl}

Merci d'avance pour votre confiance.
${unsubFooterText(ctx.unsubscribeUrl)}`
      const body =
        paragraph(greeting) +
        paragraph(
          `J'espère que mon intervention pour le diagnostic ${ctx.missionReference} s'est déroulée à votre satisfaction.`,
        ) +
        paragraph(
          'Si vous avez quelques minutes, votre retour me serait précieux pour faire progresser mon activité.',
        ) +
        buttonHtml('Laisser un avis', ctx.reviewUrl) +
        paragraph("Merci d'avance pour votre confiance.")
      return {
        subject,
        text,
        html: wrapEmailHtml({
          body,
          unsubscribeUrl: ctx.unsubscribeUrl,
          diagnosticianName: ctx.diagnosticianName,
        }),
      }
    }
    default:
      throw new Error(`templateSequenceReviewRequest: step ${step} out of range (0)`)
  }
}
