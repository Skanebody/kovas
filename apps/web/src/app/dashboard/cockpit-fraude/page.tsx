/**
 * KOVAS — Cockpit fraude DPE diagnostiqueur-facing (Game Changer 6).
 *
 * Avant chaque mission DPE en cours, vérification base ADEME publique :
 * si DPE existant < 12 mois avec écart 2+ classes potentiel → panneau
 * avertissant NON-BLOQUANT.
 *
 * Ton aidant, jamais accusateur. Loi vs pratique réelle = on respecte
 * les marges (philosophie alertes KOVAS).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 6.7.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { CockpitFraudeList } from '@/components/cockpit-fraude/CockpitFraudeList'
import { Button } from '@/components/ui/button'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Cockpit fraude DPE' }

export default async function CockpitFraudePage() {
  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    redirect('/login')
  }

  // Charge les missions DPE actives (non exportées) avec leur dossier + property
  // Note : missions.type enum réel = dpe_vente|dpe_location (pas 'DPE' générique).
  const { data: missions } = await supabase
    .from('missions')
    .select(
      'id, type, status, dossier_id, dossiers!inner(id, properties!inner(address_full, address_postcode, address_city))',
    )
    .eq('organization_id', orgId)
    .in('type', ['dpe_vente', 'dpe_location'])
    .in('status', ['scheduled', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(20)

  type MissionRow = {
    id: string
    status: string
    dossier_id: string
    dossiers?: {
      properties?: { address_full?: string; address_postcode?: string; address_city?: string }[]
    }
  }
  const items = ((missions ?? []) as unknown as MissionRow[]).map((m) => {
    const prop = m.dossiers?.properties?.[0]
    return {
      mission_id: m.id,
      status: m.status,
      address: prop?.address_full
        ? `${prop.address_full} ${prop.address_postcode ?? ''} ${prop.address_city ?? ''}`.trim()
        : '(adresse manquante)',
    }
  })

  return (
    <div className="space-y-8 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="size-4" /> Retour au tableau de bord
        </Link>
      </Button>

      <AppPageHeader
        eyebrow="Avant mission"
        title="Cockpit fraude DPE"
        description="Pré-vérification ADEME pour tes missions DPE en cours. Détection des écarts de classe potentiels et historique des DPE récents."
      />

      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="size-5 mt-0.5 text-chartreuse-deep shrink-0" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold text-[#0F1419]">Ton aidant, jamais bloquant</p>
          <p className="text-[13px] text-[#0F1419]/82 leading-relaxed mt-0.5">
            Ces vérifications restent informatives. Tu décides si l&apos;écart est justifié (travaux
            récents, annexes, etc.) — KOVAS ne bloque rien, et n&apos;envoie JAMAIS rien à l&apos;
            <GlossaryTerm term="ademe">ADEME</GlossaryTerm> directement.
          </p>
        </div>
      </section>

      <CockpitFraudeList items={items} />
    </div>
  )
}
