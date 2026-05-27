/**
 * Hero visual — tablette simulée en HTML/CSS pur.
 *
 * Mirror exact du mockup `docs/design/pricing-mockup.html` (section .hero-visual) :
 *   - frame dark `#0F1419` rounded-[24px] + ombre douce
 *   - écran sage avec sidebar liste pièces + zone main "saisie vocale active"
 *   - voice icon avec barres animées chartreuse (pulse 1.4s)
 *   - 4 champs structurés extraits par l'IA
 *
 * Décision : SVG dot animé + flexbox plutôt qu'image — l'effet "produit en cours
 * d'utilisation" est plus impactant en HTML live que en screenshot figé.
 */
export function HeroVisual() {
  return (
    <div className="max-w-[1100px] mx-auto mt-20 px-5 sm:px-12">
      <div className="bg-white rounded-[32px] py-[60px] px-5 sm:px-10 md:px-20 border border-[#0F1419]/[0.08] relative overflow-hidden">
        <div
          className="bg-[#0F1419] rounded-[24px] p-3.5 max-w-[880px] mx-auto relative z-10"
          style={{ boxShadow: '0 30px 80px -20px rgba(15, 20, 25, 0.18)' }}
        >
          <div className="bg-[#F5F7F4] rounded-[14px] p-6 min-h-[380px] grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            {/* Sidebar : liste des pièces */}
            <div className="hidden md:block border-r border-[#0F1419]/[0.08] pr-5 text-[13px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold mb-4">
                Mission · 76 rue Foch
              </p>
              <RoomRow label="Entrée" done />
              <RoomRow label="Séjour" done />
              <RoomRow label="Cuisine" done active />
              <RoomRow label="Chambre 1" />
              <RoomRow label="Chambre 2" />
              <RoomRow label="Salle de bain" />
              <RoomRow label="WC" />
            </div>

            {/* Main : saisie vocale active */}
            <div className="p-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold mb-2">
                Saisie vocale active
              </p>
              <h3 className="text-[22px] font-semibold tracking-[-0.01em] mb-5 text-[#0F1419]">
                Cuisine
              </h3>

              {/* Voice pill */}
              <div className="bg-white border border-[#0F1419]/[0.08] rounded-[12px] px-[18px] py-3.5 mb-4 flex gap-3 items-start text-sm">
                <div className="size-7 bg-[#0F1419] rounded-full flex items-center justify-center shrink-0 relative">
                  <span className="voice-bars" aria-hidden />
                </div>
                <p className="text-[#0F1419] leading-snug">
                  «&nbsp;Cuisine 12 mètres carrés, fenêtre double vitrage PVC, chaudière gaz Saunier
                  Duval 24 kilowatts, VMC simple flux fonctionnelle…&nbsp;»
                </p>
              </div>

              {/* Fields extracted */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Field label="Surface" value="12 m²" />
                <Field label="Menuiseries" value="Double vitrage PVC" />
                <Field label="Chauffage" value="Gaz · 24 kW" />
                <Field label="Ventilation" value="VMC simple flux" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voice icon animation — CSS inline pour éviter @keyframes global */}
      <style>{`
        .voice-bars {
          width: 3px;
          height: 12px;
          background: #D4F542;
          border-radius: 2px;
          box-shadow: 6px 0 0 #D4F542, -6px 0 0 #D4F542;
          animation: voice-pulse 1.4s ease-in-out infinite;
        }
        @keyframes voice-pulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.6); }
          50% { opacity: 1; transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .voice-bars { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function RoomRow({
  label,
  done = false,
  active = false,
}: {
  label: string
  done?: boolean
  active?: boolean
}) {
  return (
    <div
      className={
        active
          ? 'relative bg-[#0F1419] text-white rounded-[8px] py-2.5 pl-4 pr-3 mb-1 flex items-center justify-between'
          : 'rounded-[8px] py-2.5 px-3 mb-1 flex items-center justify-between text-[#0F1419]/72'
      }
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-chartreuse rounded-[2px]"
        />
      )}
      <span>{label}</span>
      {done && (
        <span
          className={active ? 'text-chartreuse' : 'text-[#0F1419]/35'}
          aria-label="Pièce relevée"
        >
          ✓
        </span>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-3 rounded-[8px] text-[12px] border border-[#0F1419]/[0.08]">
      <div className="text-[#0F1419]/55 uppercase tracking-[0.08em] text-[10px] mb-1">{label}</div>
      <div className="font-semibold text-sm text-[#0F1419]">{value}</div>
    </div>
  )
}
