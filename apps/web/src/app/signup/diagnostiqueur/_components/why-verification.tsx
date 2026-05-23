/**
 * Encart "Pourquoi ces vérifications ?" — message Doctolib 2022 lesson learned.
 * Avatar SOBRE PROFESSIONNEL, vouvoiement, pas d'emoji.
 */
export function WhyVerification() {
  return (
    <aside className="rounded-2xl border border-[#0F1419]/[0.08] bg-white p-6 text-[13px] leading-relaxed text-[#0F1419]/75 space-y-2">
      <h3 className="font-mono uppercase tracking-[0.08em] text-[10px] font-semibold text-[#0F1419]">
        Pourquoi ces vérifications&nbsp;?
      </h3>
      <p>
        Doctolib a appris en 2022 qu&apos;un délai de tolérance crée une faille pour les escrocs.
        KOVAS applique une validation préalable obligatoire pour protéger les particuliers et notre
        communauté de diagnostiqueurs honnêtes.
      </p>
      <p>
        Votre profil n&apos;apparaîtra dans l&apos;annuaire public qu&apos;une fois les quatre
        phases validées (identité, COFRAC, RC Pro, SIRENE). Vous gardez l&apos;accès à votre
        dashboard pendant l&apos;instruction.
      </p>
    </aside>
  )
}
