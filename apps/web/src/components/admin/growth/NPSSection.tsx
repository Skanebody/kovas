import { Card } from '@/components/ui/card'
import { Smile } from 'lucide-react'

/**
 * Placeholder NPS — la table dédiée n'existe pas encore.
 *
 * TODO V2 :
 *   - Ajouter `nps_responses (id, profile_id, score 0-10, comment, created_at)`
 *   - In-app surveys post-3 missions terminées + email à J45
 *   - Affichage : score global (NPS = %promoters − %detractors), tendance 6 mois,
 *     verbatims récents.
 */
export function NPSSection() {
  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">NPS</h2>
          <p className="text-[12px] text-ink-mute mt-0.5">Net Promoter Score · à venir V2</p>
        </div>
        <Smile className="size-4 text-ink-faint" aria-hidden />
      </div>

      <div className="rounded-md border border-dashed border-rule/80 bg-ink/[0.02] p-5 text-center">
        <p className="font-serif italic text-3xl text-ink-mute leading-none">à venir</p>
        <p className="mt-3 text-[12px] text-ink-mute">
          Surveys in-app post-3 missions terminées + email à J45.
        </p>
        <p className="mt-1 text-[11px] text-ink-faint">
          Cible M12 : <span className="font-mono">NPS &gt; 55</span> (baseline 35 SaaS B2B FR).
        </p>
      </div>
    </Card>
  )
}
