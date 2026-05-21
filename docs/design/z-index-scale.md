# KOVAS — Z-Index Scale Globale (Design System v5)

> Source de vérité pour la stratification verticale UI.
> Toute valeur `z-*` Tailwind doit appartenir à cette échelle.
> Tokens CSS associés dans [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) (helper `.above-mobile-nav`).
> **Dernière mise à jour** : 2026-05-20 (Vague C3 — fix collision DossierStickyBar ↔ AppMobileNav)

---

## 1. Scale canonique

| z-index | Usage | Exemples |
|---|---|---|
| `z-10` | Éléments inline (tooltips, dropdowns courts, popovers attachés) | `DropdownMenuContent`, `Popover`, `room-picker`, `address-autocomplete` (dans contexte non sticky) |
| `z-20` | FAB (floating action buttons) — au-dessus du contenu, sous la nav mobile | `MobileQuickActionsFab`, `SurfaceCalculatorShortcut` |
| `z-30` | Header app sticky, sub-navs sticky non bloquants | `app/layout.tsx` header, `MissionToolbar`, `AdminHeader`, `LegalPageShell` header |
| `z-40` | Mobile nav permanente + sticky bars contextuels (avec `.above-mobile-nav`) | `AppMobileNav`, `DossierStickyBar` (+ helper), `offline-banner`, `post-photo-action-bar` |
| `z-50` | Modals, sheets, drawers, dialogs, toasts métier ponctuels | `Dialog`, `BottomSheet`, `Drawer`, `dossier-more-menu`, `mission-focus-drawer`, `voice-recorder-modal` |
| `z-60` | Toasts globaux / notifications système (non encore utilisé en V1) | `Toaster` (futur), bannières d'urgence |
| `z-100` | Command palette / overlay critique au-dessus de tout | `CommandPalette` (V1.5) |

---

## 2. Règle anti-collision mobile

`AppMobileNav` est positionnée `fixed bottom-0 inset-x-0 z-40` avec un padding `pb-[env(safe-area-inset-bottom)]` (≈ 64px utile). **Tout élément `fixed` ou `sticky bottom-*` qui rend en mobile doit utiliser le helper CSS `.above-mobile-nav`** :

```css
.above-mobile-nav {
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 768px) {
  .above-mobile-nav {
    bottom: 0;
  }
}
```

Cela libère la zone mobile nav (64px) sur < 768px et restaure `bottom: 0` sur ≥ md (où la mobile nav est masquée par `md:hidden`).

### Composants concernés (audit 2026-05-20)

| Composant | Position | Helper appliqué ? | Raison |
|---|---|---|---|
| `AppMobileNav` | `fixed bottom-0 z-40` | ❌ (c'est lui la nav) | Référence |
| `DossierStickyBar` | `fixed bottom-0 z-40 md:left-20` | ✅ `above-mobile-nav` | CTA principal dossier (Démarrer/Reprendre/Exporter) doit rester accessible mobile |
| `AddToHomeScreen` | `fixed inset-x-0 bottom-0 z-50` | ✅ `above-mobile-nav` | Banner iOS A2HS, ne doit pas masquer mobile-nav |
| `MobileQuickActionsFab` | `fixed bottom-[72px] z-20` | ❌ (offset explicit) | FAB centré au-dessus du milieu de la nav (offset 8px) — z-20 (sous z-40 nav) |
| `SurfaceCalculatorShortcut` | `fixed bottom-24 right-4 z-20 md:bottom-8` | ❌ (offset explicit) | Offset 96px sur mobile = 32px au-dessus de nav 64px ; bottom-8 sur md |
| `RegulatoryAIChat` (variant=modal) | `fixed bottom-4 right-4 z-50` | ❌ (desktop only) | Widget chat IA — masqué mobile par parent (`md:` only) |
| `dossier-form.tsx` action bar | `sticky bottom-4 z-10` | ⚠️ contextuel | Sticky dans flow ; `bottom-4` peut chevaucher mobile-nav, mais c'est un wizard pleine page où l'utilisateur sait qu'il scrolle |
| `duplicate-review-view.tsx` toast | `fixed bottom-4 right-4 z-50` | ⚠️ ponctuel | Toast 3s ; chevauchement acceptable car éphémère |

---

## 3. Règles d'usage

1. **Ne jamais inventer** un `z-[123]` arbitraire. Si la scale ne couvre pas le besoin, ajouter le palier ici d'abord.
2. **z-50 réservé aux overlays bloquants** (modals/dialogs/sheets/drawers). Ne pas l'utiliser pour des sticky bars permanentes.
3. **Stacking context** : tout parent avec `transform`, `filter`, `opacity` < 1, `isolation: isolate` ou `position: fixed/sticky` crée un nouveau contexte d'empilement local. Vérifier l'arbre DOM avant de diagnostiquer un z-index "qui ne marche pas".
4. **Safe area iOS PWA** : tout `fixed bottom-*` qui rend sur iPhone PWA doit gérer `env(safe-area-inset-bottom)` (via `pb-[env(...)]` ou le helper `.above-mobile-nav`).
5. **Animation entrée** : les sticky bars utilisent `animate-slide-in-bottom` (cf. globals.css). Les FAB n'animent pas leur entrée.

---

## 4. Tests visuels recommandés (mobile, < 768px)

Routes à vérifier après tout changement de positionnement bottom :

- `/app/dossiers/[id]` — `DossierStickyBar` + `AppMobileNav` côte à côte, sticky bar visible sans masquer la nav
- `/app/dossiers/[id]/mission` — `capture-screen` overlays + nav cohabitent
- `/app/dashboard` — `MobileQuickActionsFab` (FAB chartreuse) centré au-dessus de la nav (8px gap)
- `/app/outils/*` — `SurfaceCalculatorShortcut` (icône Ruler) en bottom-right, 32px au-dessus de la nav
- Toutes routes `/app/*` (iOS PWA) — `AddToHomeScreen` banner ne masque pas la nav permanente

Outils : Chrome DevTools device mode (iPhone 14 Pro, iPad Mini), `prefers-reduced-motion`, mode dark + light.

---

## 5. Historique

- **2026-05-20** (Vague C3) — Création du document. Fix `DossierStickyBar` (ajout `above-mobile-nav`), `AddToHomeScreen` (ajout `above-mobile-nav`), `MobileQuickActionsFab` (z-40 → z-20), `SurfaceCalculatorShortcut` (z-30 → z-20). Helper CSS `.above-mobile-nav` ajouté en Vague A.
- **2026-05-19** (Design v5) — Bascule sidebar 80px icon-only + AppMobileNav 5 tabs (4 + FAB central).
