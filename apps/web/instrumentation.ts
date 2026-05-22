/**
 * Next.js instrumentation hook.
 *
 * Appelé une seule fois au démarrage du serveur (Node.js ou Edge runtime).
 * Sert à initialiser :
 * - Sentry (error tracking + performance + replay configurés dans sentry.*.config.ts)
 * - Logs centralisés Axiom (à activer quand compte créé, cf. TODO)
 *
 * Doc : https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from '@sentry/nextjs'

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')

    // TODO: installer @axiomhq/js + next-axiom quand compte Axiom créé.
    //       Variables env requises : AXIOM_TOKEN, AXIOM_DATASET.
    //       Init exemple :
    //         const { Axiom } = await import('@axiomhq/js')
    //         const axiom = new Axiom({ token: process.env.AXIOM_TOKEN! })
    //         // wrapper logger global → axiom.ingest(dataset, [...])
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Capture les erreurs des React Server Components côté Sentry. Indispensable
 * depuis Next.js 15 : sans ce hook, les erreurs RSC remontent au logger mais
 * pas à Sentry.
 */
export const onRequestError = Sentry.captureRequestError
