import { cn } from '@/lib/utils'

interface BrandingPreviewProps {
  /** URL signée du logo (signed 24h) ou null. */
  logoUrl: string | null
  /** Mime type — sert à choisir <img> vs <Image>. */
  logoMime: string | null
  /** Couleur principale hex `#RRGGBB`. */
  brandColorHex: string
  /** Nom cabinet pour le mockup (fallback "Votre cabinet"). */
  cabinetName: string | null
}

/**
 * Mockup A4 statique d'une mini-facture. SSR-only — figé en CSS, aucun JS.
 *
 * Reproduit fidèlement la structure utilisée par les futurs générateurs PDF
 * devis/facture (Agents B & C). Sert de référence visuelle pour l'utilisateur
 * et de spec implicite pour les agents qui généreront les PDF.
 *
 * Layout PDF cible :
 *   - Header : filet de couleur 4px + logo à gauche + bloc émetteur à droite
 *   - Bloc destinataire en haut à droite (sous l'émetteur)
 *   - Table 2 colonnes (Désignation / Montant HT)
 *   - Total HT/TVA/TTC en bas à droite, filet couleur
 */
export function BrandingPreview({
  logoUrl,
  logoMime,
  brandColorHex,
  cabinetName,
}: BrandingPreviewProps) {
  const displayName = cabinetName ?? 'Votre cabinet'
  const isSvg = logoMime === 'image/svg+xml'

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55">
        Aperçu facture
      </p>

      <div
        className={cn(
          'mx-auto w-full max-w-[520px] rounded-[12px] border border-[#0F1419]/[0.08]',
          'bg-white shadow-sm overflow-hidden',
          // Ratio A4 portrait approximatif (1:√2) — limité ici pour aperçu compact
        )}
        aria-hidden
      >
        {/* Filet couleur signature en haut */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: brandColorHex }}
        />

        <div className="p-6 space-y-5">
          {/* ============ Header : logo + bloc émetteur ============ */}
          <div className="flex items-start justify-between gap-4">
            {/* Logo cabinet */}
            <div className="flex items-center justify-center size-14 shrink-0">
              {logoUrl ? (
                isSvg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                )
              ) : (
                <span
                  className="flex size-14 items-center justify-center rounded-md border border-dashed border-[#0F1419]/15 text-[9px] font-mono uppercase tracking-[0.1em] text-[#0F1419]/40 text-center leading-tight px-1"
                >
                  Votre
                  <br />
                  logo
                </span>
              )}
            </div>

            <div className="text-right space-y-0.5">
              <p
                className="font-sans font-semibold text-[13px] leading-tight"
                style={{ color: brandColorHex }}
              >
                {displayName}
              </p>
              <p className="text-[10px] text-[#0F1419]/55 leading-snug">
                12 rue de la République
                <br />
                76200 Dieppe · SIRET 123 456 789 00012
              </p>
            </div>
          </div>

          {/* ============ Méta facture + destinataire ============ */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                Facture
              </p>
              <p
                className="font-sans font-semibold text-base leading-tight"
                style={{ color: brandColorHex }}
              >
                FAC-2026-0042
              </p>
              <p className="text-[10px] text-[#0F1419]/55">
                Émise le 20 mai 2026
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                Destinataire
              </p>
              <p className="text-[11px] text-[#0F1419] font-medium leading-tight">
                Agence Belle Plage
              </p>
              <p className="text-[10px] text-[#0F1419]/55 leading-snug">
                14 quai Henri IV
                <br />
                76200 Dieppe
              </p>
            </div>
          </div>

          {/* ============ Table prestations (2 lignes) ============ */}
          <div className="pt-3">
            <div
              className="grid grid-cols-[1fr_auto] gap-3 pb-1.5 border-b-[1.5px]"
              style={{ borderColor: brandColorHex }}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                Désignation
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                Montant HT
              </span>
            </div>
            <div className="divide-y divide-[#0F1419]/[0.08]">
              <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-[11px]">
                <span className="text-[#0F1419]">
                  DPE — Maison T4 · 96 m²
                </span>
                <span className="font-mono tabular-nums text-[#0F1419]">
                  180,00 €
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-[11px]">
                <span className="text-[#0F1419]">
                  Diagnostic amiante avant-vente
                </span>
                <span className="font-mono tabular-nums text-[#0F1419]">
                  120,00 €
                </span>
              </div>
            </div>
          </div>

          {/* ============ Totaux à droite ============ */}
          <div className="flex justify-end pt-2">
            <div className="w-full max-w-[200px] space-y-1.5">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-[#0F1419]/55">Total HT</span>
                <span className="font-mono tabular-nums text-[#0F1419]">
                  300,00 €
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-[#0F1419]/55">TVA 20%</span>
                <span className="font-mono tabular-nums text-[#0F1419]">
                  60,00 €
                </span>
              </div>
              <div
                className="flex items-baseline justify-between pt-2 border-t-[1.5px]"
                style={{ borderColor: brandColorHex }}
              >
                <span
                  className="font-sans text-[12px] font-semibold"
                  style={{ color: brandColorHex }}
                >
                  Total TTC
                </span>
                <span
                  className="font-mono tabular-nums text-[14px] font-semibold"
                  style={{ color: brandColorHex }}
                >
                  360,00 €
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filet couleur en pied */}
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: brandColorHex }}
        />
      </div>

      <p className="text-[11px] text-[#0F1419]/55 leading-relaxed">
        Cet aperçu est représentatif. Les devis et factures réels reprendront
        votre logo et votre couleur sur l'en-tête, les filets et les totaux.
      </p>
    </div>
  )
}
