/**
 * /signup/qualify — Étape 2 du tunnel signup Tugan v3.0.
 *
 * Quiz 3 questions avant tout formulaire d'email (commitment progressif
 * Cialdini : "Pas de formulaire d'email avant qualification").
 *
 *   Q1. Tu es ? Solo / Petit cabinet / Cabinet structuré / Franchise
 *   Q2. Combien de missions / mois ?       (slider 5-500)
 *   Q3. Tu utilises quel logiciel principal ? (Liciel / ORIS / OBBC / Autre / Aucun)
 *
 * Soumission → /signup/recommendation?team=...&volume=...&editor=...
 *
 * Authority : docs Tugan §6 Étape 2.
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import type { Metadata } from 'next'
import { QuizClient } from './QuizClient'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'En 3 questions, on identifie le plan parfait pour toi | KOVAS',
  description:
    'Quiz de qualification 3 questions pour identifier le plan KOVAS qui te correspond. Aucune création de compte requise à cette étape.',
  path: '/signup/qualify',
})

export default function SignupQualifyPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />
      <main className="flex-1 px-5 sm:px-12 py-16 sm:py-24">
        <div className="max-w-[640px] mx-auto">
          <QuizClient />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
