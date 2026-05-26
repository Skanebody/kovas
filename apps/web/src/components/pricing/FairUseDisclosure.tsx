import { PRICING_PLANS } from '@/lib/pricing-plans'

/**
 * FairUseDisclosure — section explicite "Comment ça marche, l'usage illimité ?"
 *
 * Refonte P9 (2026-05-28) : transparence radicale sur le modèle all-you-can-eat.
 * Aucune fine print cachée. Trois sous-sections :
 *   1. Missions illimitées + soft caps par tier
 *   2. Stockage cloud par tier
 *   3. Loyauté (1 SIRET = 1 compte)
 *
 * Ton sobre, factuel. Pas de marketing fluff.
 */
export function FairUseDisclosure() {
  return (
    <section className="bg-white border-y border-[#0F1419]/[0.08] px-5 sm:px-12 py-20 sm:py-32">
      <div className="max-w-[1080px] mx-auto">
        <div className="text-center max-w-[820px] mx-auto mb-16">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
            Fair-use, expliqué sans fine print
          </p>
          <h2 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[72px] leading-[1.02] tracking-[-0.03em] mb-6">
            Comment ça marche, <span className="text-[#0F1419]/35">l'usage illimité ?</span>
          </h2>
          <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 leading-relaxed">
            Trois règles, qui tiennent en six lignes. Pas de clause cachée, pas de plafond
            silencieux qui vous coupe en pleine mission, pas de surprise sur la facture.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pilier 1 : Missions illimitées avec soft caps */}
          <article className="rounded-[20px] border border-[#0F1419]/[0.08] bg-[#F5F7F4] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
              Règle 1
            </p>
            <h3 className="text-[22px] font-semibold text-[#0F1419] mb-3 leading-tight">
              Missions illimitées
            </h3>
            <p className="text-[14px] text-[#0F1419]/72 leading-relaxed mb-4">
              Vous payez un forfait fixe, vous réalisez autant de missions que votre activité
              demande. Si vous dépassez régulièrement le seuil indicatif de votre tier, on vous
              envoie un mail pour proposer le tier au-dessus — pas pour vous facturer en plus.
            </p>
            <ul className="space-y-1.5 text-[12px] text-[#0F1419]/72 font-mono tabular-nums">
              {PRICING_PLANS.map((p) => (
                <li
                  key={p.code}
                  className="flex justify-between border-b border-[#0F1419]/[0.06] py-1.5"
                >
                  <span>{p.name}</span>
                  <span className="text-[#0F1419] font-semibold">{p.caps.missions} / mois</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Pilier 2 : Stockage */}
          <article className="rounded-[20px] border border-[#0F1419]/[0.08] bg-[#F5F7F4] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
              Règle 2
            </p>
            <h3 className="text-[22px] font-semibold text-[#0F1419] mb-3 leading-tight">
              Stockage cloud
            </h3>
            <p className="text-[14px] text-[#0F1419]/72 leading-relaxed mb-4">
              Cap dur par tier — photos, audios et exports compressés. Au-delà, on vous prévient au
              seuil 90 % avec la liste des plus gros fichiers à archiver localement. Pas
              d'augmentation automatique de la facture.
            </p>
            <ul className="space-y-1.5 text-[12px] text-[#0F1419]/72 font-mono tabular-nums">
              {PRICING_PLANS.map((p) => (
                <li
                  key={p.code}
                  className="flex justify-between border-b border-[#0F1419]/[0.06] py-1.5"
                >
                  <span>{p.name}</span>
                  <span className="text-[#0F1419] font-semibold">{p.caps.storageGb} Go</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Pilier 3 : Loyauté SIRET */}
          <article className="rounded-[20px] border border-[#0F1419]/[0.08] bg-[#F5F7F4] p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
              Règle 3
            </p>
            <h3 className="text-[22px] font-semibold text-[#0F1419] mb-3 leading-tight">
              Loyauté SIRET
            </h3>
            <p className="text-[14px] text-[#0F1419]/72 leading-relaxed mb-4">
              Un SIRET = un compte payant. Vous ne pouvez pas ouvrir plusieurs comptes pour partager
              les caps fair-use entre collègues. Cabinet (3 utilisateurs inclus) est conçu pour ce
              cas.
            </p>
            <ul className="space-y-1.5 text-[12px] text-[#0F1419]/72 font-mono tabular-nums">
              {PRICING_PLANS.map((p) => (
                <li
                  key={p.code}
                  className="flex justify-between border-b border-[#0F1419]/[0.06] py-1.5"
                >
                  <span>{p.name}</span>
                  <span className="text-[#0F1419] font-semibold">
                    {p.caps.users} user{p.caps.users > 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <p className="mt-10 text-center text-[14px] text-[#0F1419]/55 max-w-[680px] mx-auto leading-relaxed">
          Limites internes IA (transcription vocale, reconnaissance d'équipements sur photo)
          silencieuses jusqu'au plafonnement mensuel. Si tu atteins le plafond, tu gardes l'accès
          aux outils, le mode IA repasse en parser local jusqu'au 1er du mois suivant.
        </p>
      </div>
    </section>
  )
}
