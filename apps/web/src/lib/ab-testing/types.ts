/**
 * A/B testing — types locaux des tables `ab_*`.
 *
 * Les types générés de @kovas/database ne contiennent pas encore
 * ces tables (migration 20260530150000_ab_testing.sql). On définit
 * ici un schéma minimal compatible avec @supabase/supabase-js pour
 * conserver TypeScript strict (zéro any).
 *
 * À supprimer lors de la prochaine régénération via `pnpm db:gen-types`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AbExperimentStatusDB = 'draft' | 'running' | 'paused' | 'completed' | 'aborted'

export type AbEventTypeDB = 'exposure' | 'conversion' | 'click' | 'submit'

export interface AbDatabase {
  public: {
    Tables: {
      ab_experiments: {
        Row: {
          id: string
          experiment_key: string
          description: string
          hypothesis: string | null
          variants: Json
          traffic_split: Json
          status: AbExperimentStatusDB
          primary_metric: string | null
          started_at: string | null
          ended_at: string | null
          winner_variant: string | null
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          experiment_key: string
          description: string
          hypothesis?: string | null
          variants: Json
          traffic_split: Json
          status?: AbExperimentStatusDB
          primary_metric?: string | null
          started_at?: string | null
          ended_at?: string | null
          winner_variant?: string | null
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          experiment_key?: string
          description?: string
          hypothesis?: string | null
          variants?: Json
          traffic_split?: Json
          status?: AbExperimentStatusDB
          primary_metric?: string | null
          started_at?: string | null
          ended_at?: string | null
          winner_variant?: string | null
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ab_assignments: {
        Row: {
          id: string
          experiment_id: string
          user_identifier: string
          variant_assigned: string
          assigned_at: string
        }
        Insert: {
          id?: string
          experiment_id: string
          user_identifier: string
          variant_assigned: string
          assigned_at?: string
        }
        Update: {
          id?: string
          experiment_id?: string
          user_identifier?: string
          variant_assigned?: string
          assigned_at?: string
        }
        Relationships: []
      }
      ab_events: {
        Row: {
          id: string
          experiment_id: string
          user_identifier: string
          event_type: AbEventTypeDB
          event_value: number | null
          event_data: Json | null
          variant_assigned: string
          created_at: string
        }
        Insert: {
          id?: string
          experiment_id: string
          user_identifier: string
          event_type: AbEventTypeDB
          event_value?: number | null
          event_data?: Json | null
          variant_assigned: string
          created_at?: string
        }
        Update: {
          id?: string
          experiment_id?: string
          user_identifier?: string
          event_type?: AbEventTypeDB
          event_value?: number | null
          event_data?: Json | null
          variant_assigned?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      ab_experiment_results: {
        Row: {
          experiment_id: string
          variant_assigned: string
          exposures: number | null
          conversions: number | null
          clicks: number | null
          submits: number | null
          conversion_rate_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
