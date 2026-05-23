'use client'

/**
 * KOVAS — Client-side helpers pour mutations de préférences sidebar.
 * Optimiste (cache local) + sync via Server Action.
 */

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import type { SidebarPreferences } from './preferences-types'
import {
  ALL_PROFILE_PRESETS,
  type ProfilePresetCode,
  expandPreset,
  getPreset,
} from './profile-presets'

/**
 * Hook léger : reçoit les préférences chargées server-side, gère mutations
 * locales optimistes + appel à l'action serveur. Synchronisation
 * multi-onglets via Supabase Realtime sur la ligne user.
 */
export function useSidebarPreferences(
  initial: SidebarPreferences,
  userId: string,
  saveAction: (prefs: SidebarPreferences) => Promise<void>,
): {
  prefs: SidebarPreferences
  setPrefs: (next: SidebarPreferences) => void
  applyPresetCode: (code: ProfilePresetCode) => void
  resetDefaults: () => void
  toggleCollapsed: () => void
  saving: boolean
} {
  const [prefs, setPrefsState] = useState<SidebarPreferences>(initial)
  const [saving, setSaving] = useState(false)

  // Mutation optimiste : update UI puis save en background
  const setPrefs = useCallback(
    (next: SidebarPreferences) => {
      setPrefsState(next)
      setSaving(true)
      saveAction(next)
        .catch((err) => {
          // En cas d'erreur on log côté console (Sentry capturera).
          // L'UI reste optimiste — la prochaine load corrigera.
          console.error('[sidebar] save failed', err)
        })
        .finally(() => setSaving(false))
    },
    [saveAction],
  )

  const applyPresetCode = useCallback(
    (code: ProfilePresetCode) => {
      const preset = getPreset(code)
      if (!preset) return
      const { mainItems, moreItems } = expandPreset(preset)
      setPrefs({ ...prefs, mainItems, moreItems, profilePreset: code })
    },
    [prefs, setPrefs],
  )

  const resetDefaults = useCallback(() => {
    // Recalcule defaults inline (évite import server-only depuis client)
    // En pratique on applique solo_admin qui contient TOUS les items dans
    // l'ordre du registre canonique (équivalent buildDefaultPreferences).
    const defaultsPreset = ALL_PROFILE_PRESETS[1] // solo_admin
    if (!defaultsPreset) return
    const { mainItems, moreItems } = expandPreset(defaultsPreset)
    setPrefs({ ...prefs, mainItems, moreItems, profilePreset: null })
  }, [prefs, setPrefs])

  const toggleCollapsed = useCallback(() => {
    setPrefs({ ...prefs, sidebarCollapsed: !prefs.sidebarCollapsed })
  }, [prefs, setPrefs])

  // Supabase Realtime — sync multi-onglets / multi-appareils
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`sidebar_preferences:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sidebar_preferences',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null
          if (!row) return
          // Reconciliation minimale : si la mise à jour vient d'un autre client,
          // on adopte les nouvelles préférences.
          try {
            const mainItems = Array.isArray(row.main_items)
              ? (row.main_items as SidebarPreferences['mainItems'])
              : prefs.mainItems
            const moreItems = Array.isArray(row.more_items)
              ? (row.more_items as SidebarPreferences['moreItems'])
              : prefs.moreItems
            setPrefsState({
              mainItems,
              moreItems,
              profilePreset:
                typeof row.profile_preset === 'string'
                  ? (row.profile_preset as ProfilePresetCode)
                  : null,
              notificationStyle: row.notification_style === 'dot' ? 'dot' : 'count',
              sidebarCollapsed: Boolean(row.sidebar_collapsed),
            })
          } catch {
            /* ignore parse errors */
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return { prefs, setPrefs, applyPresetCode, resetDefaults, toggleCollapsed, saving }
}
