/**
 * Registre d'icônes Lucide pour Analytics — Server→Client safe.
 *
 * Problème résolu : les Server Components ne peuvent pas passer de fonctions
 * (les icônes Lucide sont des composants React) en props à des Client Components.
 * Solution : référencer les icônes par leur nom (string) côté serveur, puis
 * résoudre en composant côté client via ce registre.
 */

import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  Clock,
  Coins,
  Download,
  FileCheck,
  FileText,
  HeartHandshake,
  LineChart,
  Percent,
  PiggyBank,
  Repeat,
  ShieldAlert,
  Smile,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

/** Identifiants stables (strings sérialisables) côté serveur. */
export type AnalyticsIconName =
  | 'activity'
  | 'alert-octagon'
  | 'arrow-up-right'
  | 'clock'
  | 'coins'
  | 'download'
  | 'file-check'
  | 'file-text'
  | 'heart-handshake'
  | 'line-chart'
  | 'percent'
  | 'piggy-bank'
  | 'repeat'
  | 'shield-alert'
  | 'smile'
  | 'star'
  | 'target'
  | 'trending-down'
  | 'trending-up'
  | 'users'

const REGISTRY: Record<AnalyticsIconName, LucideIcon> = {
  activity: Activity,
  'alert-octagon': AlertOctagon,
  'arrow-up-right': ArrowUpRight,
  clock: Clock,
  coins: Coins,
  download: Download,
  'file-check': FileCheck,
  'file-text': FileText,
  'heart-handshake': HeartHandshake,
  'line-chart': LineChart,
  percent: Percent,
  'piggy-bank': PiggyBank,
  repeat: Repeat,
  'shield-alert': ShieldAlert,
  smile: Smile,
  star: Star,
  target: Target,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  users: Users,
}

/**
 * Résout un identifiant d'icône en composant React Lucide.
 * Côté client uniquement (le registre importe des composants).
 */
export function resolveAnalyticsIcon(name: AnalyticsIconName): LucideIcon {
  return REGISTRY[name]
}
