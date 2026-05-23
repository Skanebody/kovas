// Auto-generated TypeScript types from Supabase schema
// Generated: 2026-05-23T22:14:53.000Z
// Source: db.jlizdkffwjdiokvmhcwg.supabase.co:5432 (public schema)
// Do NOT edit manually. Regenerate via: pnpm db:gen-types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      ab_assignments: {
        Row: {
          assigned_at: string
          experiment_id: string
          id: string
          user_identifier: string
          variant_assigned: string
        }
        Insert: {
          assigned_at?: string
          experiment_id: string
          id?: string
          user_identifier: string
          variant_assigned: string
        }
        Update: {
          assigned_at?: string
          experiment_id?: string
          id?: string
          user_identifier?: string
          variant_assigned?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ab_assignments_experiment_id_fkey'
            columns: ['experiment_id']
            isOneToOne: false
            referencedRelation: 'ab_experiments'
            referencedColumns: ['id']
          },
        ]
      }
      ab_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          event_value: number | null
          experiment_id: string
          id: string
          user_identifier: string
          variant_assigned: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          event_value?: number | null
          experiment_id: string
          id?: string
          user_identifier: string
          variant_assigned: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          event_value?: number | null
          experiment_id?: string
          id?: string
          user_identifier?: string
          variant_assigned?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ab_events_experiment_id_fkey'
            columns: ['experiment_id']
            isOneToOne: false
            referencedRelation: 'ab_experiments'
            referencedColumns: ['id']
          },
        ]
      }
      ab_experiments: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string
          ended_at: string | null
          experiment_key: string
          hypothesis: string | null
          id: string
          primary_metric: string | null
          started_at: string | null
          status: string
          traffic_split: Json
          updated_at: string
          variants: Json
          winner_variant: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description: string
          ended_at?: string | null
          experiment_key: string
          hypothesis?: string | null
          id?: string
          primary_metric?: string | null
          started_at?: string | null
          status?: string
          traffic_split: Json
          updated_at?: string
          variants: Json
          winner_variant?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          ended_at?: string | null
          experiment_key?: string
          hypothesis?: string | null
          id?: string
          primary_metric?: string | null
          started_at?: string | null
          status?: string
          traffic_split?: Json
          updated_at?: string
          variants?: Json
          winner_variant?: string | null
        }
        Relationships: []
      }
      abuse_detection_logs: {
        Row: {
          action_taken: string | null
          details: Json | null
          detected_at: string
          id: string
          ip_address: unknown
          organization_id: string | null
          severity: number
          signal_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          details?: Json | null
          detected_at?: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          severity: number
          signal_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          details?: Json | null
          detected_at?: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          severity?: number
          signal_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'abuse_detection_logs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      accounting_connectors: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          config: Json
          created_at: string
          encrypted_secret: string | null
          encrypted_token: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_error_at: string | null
          last_sync_at: string | null
          oauth_access_token_encrypted: string | null
          oauth_expires_at: string | null
          oauth_refresh_token_encrypted: string | null
          organization_id: string
          pennylane_company_id: string | null
          provider: string
          status: string
          token_encrypted: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          config?: Json
          created_at?: string
          encrypted_secret?: string | null
          encrypted_token?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token_encrypted?: string | null
          organization_id: string
          pennylane_company_id?: string | null
          provider: string
          status?: string
          token_encrypted: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          config?: Json
          created_at?: string
          encrypted_secret?: string | null
          encrypted_token?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token_encrypted?: string | null
          organization_id?: string
          pennylane_company_id?: string | null
          provider?: string
          status?: string
          token_encrypted?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'accounting_connectors_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      addon_modules: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          included_quantity: number | null
          is_active: boolean
          kind: string
          module_code: string
          monthly_price_cents: number | null
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          included_quantity?: number | null
          is_active?: boolean
          kind?: string
          module_code: string
          monthly_price_cents?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          included_quantity?: number | null
          is_active?: boolean
          kind?: string
          module_code?: string
          monthly_price_cents?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      addon_packs: {
        Row: {
          annual_price: number | null
          bundle_limits: Json
          code: string
          created_at: string
          description: string | null
          included_addons: string[]
          monthly_price: number
          name: string
        }
        Insert: {
          annual_price?: number | null
          bundle_limits?: Json
          code: string
          created_at?: string
          description?: string | null
          included_addons?: string[]
          monthly_price: number
          name: string
        }
        Update: {
          annual_price?: number | null
          bundle_limits?: Json
          code?: string
          created_at?: string
          description?: string | null
          included_addons?: string[]
          monthly_price?: number
          name?: string
        }
        Relationships: []
      }
      ademe_alerts: {
        Row: {
          alert_code: string
          context: Json
          created_at: string
          id: string
          message: string
          mission_id: string | null
          notified_at: string | null
          notified_channels: string[]
          organization_id: string
          prevalidation_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          alert_code: string
          context?: Json
          created_at?: string
          id?: string
          message: string
          mission_id?: string | null
          notified_at?: string | null
          notified_channels?: string[]
          organization_id: string
          prevalidation_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          alert_code?: string
          context?: Json
          created_at?: string
          id?: string
          message?: string
          mission_id?: string | null
          notified_at?: string | null
          notified_channels?: string[]
          organization_id?: string
          prevalidation_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ademe_alerts_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ademe_alerts_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ademe_alerts_prevalidation_id_fkey'
            columns: ['prevalidation_id']
            isOneToOne: false
            referencedRelation: 'ademe_prevalidations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ademe_alerts_rule_id_fkey'
            columns: ['rule_id']
            isOneToOne: false
            referencedRelation: 'ademe_coherence_rules'
            referencedColumns: ['id']
          },
        ]
      }
      ademe_benchmarks: {
        Row: {
          bien_type: string | null
          data_period_end: string | null
          data_period_start: string | null
          distribution: Json
          distribution_ges: Json | null
          fetched_at: string
          id: string
          sample_size: number | null
          scope_type: string
          scope_value: string | null
          source: string | null
          year_construction_band: string | null
        }
        Insert: {
          bien_type?: string | null
          data_period_end?: string | null
          data_period_start?: string | null
          distribution: Json
          distribution_ges?: Json | null
          fetched_at?: string
          id?: string
          sample_size?: number | null
          scope_type: string
          scope_value?: string | null
          source?: string | null
          year_construction_band?: string | null
        }
        Update: {
          bien_type?: string | null
          data_period_end?: string | null
          data_period_start?: string | null
          distribution?: Json
          distribution_ges?: Json | null
          fetched_at?: string
          id?: string
          sample_size?: number | null
          scope_type?: string
          scope_value?: string | null
          source?: string | null
          year_construction_band?: string | null
        }
        Relationships: []
      }
      ademe_coherence_rules: {
        Row: {
          applies_from: string | null
          applies_until: string | null
          created_at: string
          created_by: string | null
          description: string
          diagnostic_types: string[]
          enabled: boolean
          id: string
          metadata: Json
          rule_code: string
          rule_logic: Json
          severity: string
          source_reference: string | null
          source_url: string | null
          suggested_fix: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_from?: string | null
          applies_until?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          diagnostic_types?: string[]
          enabled?: boolean
          id?: string
          metadata?: Json
          rule_code: string
          rule_logic: Json
          severity?: string
          source_reference?: string | null
          source_url?: string | null
          suggested_fix?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_from?: string | null
          applies_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          diagnostic_types?: string[]
          enabled?: boolean
          id?: string
          metadata?: Json
          rule_code?: string
          rule_logic?: Json
          severity?: string
          source_reference?: string | null
          source_url?: string | null
          suggested_fix?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ademe_dpe_cache: {
        Row: {
          address: string | null
          ancien_numero_dpe: string | null
          annee_construction: number | null
          certificat_number: string | null
          city: string | null
          consommation_kwh_m2: number | null
          created_at: string
          date_etablissement: string | null
          date_fin_validite: string | null
          date_visite: string | null
          emissions_kgco2_m2: number | null
          etiquette_dpe: string | null
          etiquette_ges: string | null
          expires_at: string | null
          fetched_at: string
          fetched_by: string | null
          id: string
          insee_code: string | null
          latitude: number | null
          longitude: number | null
          numero_dpe: string
          organization_id: string
          postal_code: string | null
          raw_payload: Json
          surface_habitable_m2: number | null
          type_batiment: string | null
          type_chauffage: string | null
          type_climatisation: string | null
          type_ecs: string | null
          type_ventilation: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          ancien_numero_dpe?: string | null
          annee_construction?: number | null
          certificat_number?: string | null
          city?: string | null
          consommation_kwh_m2?: number | null
          created_at?: string
          date_etablissement?: string | null
          date_fin_validite?: string | null
          date_visite?: string | null
          emissions_kgco2_m2?: number | null
          etiquette_dpe?: string | null
          etiquette_ges?: string | null
          expires_at?: string | null
          fetched_at?: string
          fetched_by?: string | null
          id?: string
          insee_code?: string | null
          latitude?: number | null
          longitude?: number | null
          numero_dpe: string
          organization_id: string
          postal_code?: string | null
          raw_payload?: Json
          surface_habitable_m2?: number | null
          type_batiment?: string | null
          type_chauffage?: string | null
          type_climatisation?: string | null
          type_ecs?: string | null
          type_ventilation?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          ancien_numero_dpe?: string | null
          annee_construction?: number | null
          certificat_number?: string | null
          city?: string | null
          consommation_kwh_m2?: number | null
          created_at?: string
          date_etablissement?: string | null
          date_fin_validite?: string | null
          date_visite?: string | null
          emissions_kgco2_m2?: number | null
          etiquette_dpe?: string | null
          etiquette_ges?: string | null
          expires_at?: string | null
          fetched_at?: string
          fetched_by?: string | null
          id?: string
          insee_code?: string | null
          latitude?: number | null
          longitude?: number | null
          numero_dpe?: string
          organization_id?: string
          postal_code?: string | null
          raw_payload?: Json
          surface_habitable_m2?: number | null
          type_batiment?: string | null
          type_chauffage?: string | null
          type_climatisation?: string | null
          type_ecs?: string | null
          type_ventilation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ademe_dpe_cache_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ademe_kpi_snapshots: {
        Row: {
          avg_energy_value: number | null
          avg_ges_value: number | null
          avg_surface_m2: number | null
          certificat_number: string | null
          computed_at: string
          count_a: number
          count_b: number
          count_c: number
          count_d: number
          count_e: number
          count_f: number
          count_g: number
          created_at: string
          error_rate: number
          ges_count_a: number
          ges_count_b: number
          ges_count_c: number
          ges_count_d: number
          ges_count_e: number
          ges_count_f: number
          ges_count_g: number
          id: string
          metadata: Json
          organization_id: string
          period: string
          snapshot_date: string
          source: string
          total_anomalies: number
          total_corrections: number
          total_dpe: number
          total_published: number
          user_id: string | null
        }
        Insert: {
          avg_energy_value?: number | null
          avg_ges_value?: number | null
          avg_surface_m2?: number | null
          certificat_number?: string | null
          computed_at?: string
          count_a?: number
          count_b?: number
          count_c?: number
          count_d?: number
          count_e?: number
          count_f?: number
          count_g?: number
          created_at?: string
          error_rate?: number
          ges_count_a?: number
          ges_count_b?: number
          ges_count_c?: number
          ges_count_d?: number
          ges_count_e?: number
          ges_count_f?: number
          ges_count_g?: number
          id?: string
          metadata?: Json
          organization_id: string
          period?: string
          snapshot_date: string
          source?: string
          total_anomalies?: number
          total_corrections?: number
          total_dpe?: number
          total_published?: number
          user_id?: string | null
        }
        Update: {
          avg_energy_value?: number | null
          avg_ges_value?: number | null
          avg_surface_m2?: number | null
          certificat_number?: string | null
          computed_at?: string
          count_a?: number
          count_b?: number
          count_c?: number
          count_d?: number
          count_e?: number
          count_f?: number
          count_g?: number
          created_at?: string
          error_rate?: number
          ges_count_a?: number
          ges_count_b?: number
          ges_count_c?: number
          ges_count_d?: number
          ges_count_e?: number
          ges_count_f?: number
          ges_count_g?: number
          id?: string
          metadata?: Json
          organization_id?: string
          period?: string
          snapshot_date?: string
          source?: string
          total_anomalies?: number
          total_corrections?: number
          total_dpe?: number
          total_published?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ademe_kpi_snapshots_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ademe_prevalidations: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          completed_at: string | null
          created_at: string
          findings: Json
          id: string
          mission_id: string
          organization_id: string
          override_reason: string | null
          quality_score: number | null
          rules_failed: number
          rules_passed: number
          rules_warning: number
          snapshot_payload: Json
          started_at: string
          status: string
          total_rules_checked: number
          triggered_by: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          completed_at?: string | null
          created_at?: string
          findings?: Json
          id?: string
          mission_id: string
          organization_id: string
          override_reason?: string | null
          quality_score?: number | null
          rules_failed?: number
          rules_passed?: number
          rules_warning?: number
          snapshot_payload?: Json
          started_at?: string
          status?: string
          total_rules_checked?: number
          triggered_by?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          completed_at?: string | null
          created_at?: string
          findings?: Json
          id?: string
          mission_id?: string
          organization_id?: string
          override_reason?: string | null
          quality_score?: number | null
          rules_failed?: number
          rules_passed?: number
          rules_warning?: number
          snapshot_payload?: Json
          started_at?: string
          status?: string
          total_rules_checked?: number
          triggered_by?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ademe_prevalidations_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ademe_prevalidations_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      admin_2fa_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          success: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      admin_2fa_secrets: {
        Row: {
          created_at: string
          enabled: boolean
          enabled_at: string | null
          last_used_at: string | null
          secret_encrypted: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          last_used_at?: string | null
          secret_encrypted: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          last_used_at?: string | null
          secret_encrypted?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_source: string
          action_type: string
          admin_user_id: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          new_state: Json | null
          payload: Json
          previous_state: Json | null
          succeeded: boolean
          target_id: string | null
          target_label: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action_source: string
          action_type: string
          admin_user_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          payload?: Json
          previous_state?: Json | null
          succeeded: boolean
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action_source?: string
          action_type?: string
          admin_user_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          payload?: Json
          previous_state?: Json | null
          succeeded?: boolean
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'admin_notes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          last_login_at: string | null
          notes: string | null
          role: string
          telegram_chat_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          last_login_at?: string | null
          notes?: string | null
          role?: string
          telegram_chat_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          last_login_at?: string | null
          notes?: string | null
          role?: string
          telegram_chat_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          audio_seconds: number | null
          cached_tokens: number | null
          cost_eur: number
          created_at: string
          fallback_used: boolean | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          mission_id: string | null
          model: string
          operation: string
          organization_id: string | null
          output_tokens: number | null
          provider: string
          user_id: string | null
        }
        Insert: {
          audio_seconds?: number | null
          cached_tokens?: number | null
          cost_eur: number
          created_at?: string
          fallback_used?: boolean | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          mission_id?: string | null
          model: string
          operation: string
          organization_id?: string | null
          output_tokens?: number | null
          provider: string
          user_id?: string | null
        }
        Update: {
          audio_seconds?: number | null
          cached_tokens?: number | null
          cost_eur?: number
          created_at?: string
          fallback_used?: boolean | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          mission_id?: string | null
          model?: string
          operation?: string
          organization_id?: string | null
          output_tokens?: number | null
          provider?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_usage_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ai_usage_log: {
        Row: {
          ai_model: string
          cost_eur: number | null
          created_at: string
          document_id: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_tokens: number | null
          operation: string
          output_tokens: number | null
          success: boolean
          user_id: string
        }
        Insert: {
          ai_model: string
          cost_eur?: number | null
          created_at?: string
          document_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          operation: string
          output_tokens?: number | null
          success?: boolean
          user_id: string
        }
        Update: {
          ai_model?: string
          cost_eur?: number | null
          created_at?: string
          document_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          operation?: string
          output_tokens?: number | null
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_log_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          audio_minutes: number | null
          cache_write_tokens: number
          cached_input_tokens: number
          created_at: string
          estimated_cost_eur_cents: number
          feature: string
          id: string
          input_tokens: number
          latency_ms: number | null
          metadata: Json
          model_used: string
          organization_id: string
          output_tokens: number
          provider: string
          related_id: string | null
          related_table: string | null
          user_id: string | null
        }
        Insert: {
          audio_minutes?: number | null
          cache_write_tokens?: number
          cached_input_tokens?: number
          created_at?: string
          estimated_cost_eur_cents?: number
          feature: string
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          metadata?: Json
          model_used: string
          organization_id: string
          output_tokens?: number
          provider: string
          related_id?: string | null
          related_table?: string | null
          user_id?: string | null
        }
        Update: {
          audio_minutes?: number | null
          cache_write_tokens?: number
          cached_input_tokens?: number
          created_at?: string
          estimated_cost_eur_cents?: number
          feature?: string
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          metadata?: Json
          model_used?: string
          organization_id?: string
          output_tokens?: number
          provider?: string
          related_id?: string | null
          related_table?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_logs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ai_usage_monthly: {
        Row: {
          claude_tokens_input: number
          claude_tokens_output: number
          cost_cents: number
          degraded_mode_at: string | null
          id: string
          month_iso: string
          organization_id: string
          updated_at: string
          vision_calls: number
          whisper_seconds: number
        }
        Insert: {
          claude_tokens_input?: number
          claude_tokens_output?: number
          cost_cents?: number
          degraded_mode_at?: string | null
          id?: string
          month_iso: string
          organization_id: string
          updated_at?: string
          vision_calls?: number
          whisper_seconds?: number
        }
        Update: {
          claude_tokens_input?: number
          claude_tokens_output?: number
          cost_cents?: number
          degraded_mode_at?: string | null
          id?: string
          month_iso?: string
          organization_id?: string
          updated_at?: string
          vision_calls?: number
          whisper_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_monthly_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      alert_auto_disabled: {
        Row: {
          alert_subtype: string | null
          alert_type: string
          disabled_at: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          alert_subtype?: string | null
          alert_type: string
          disabled_at?: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          alert_subtype?: string | null
          alert_type?: string
          disabled_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'alert_auto_disabled_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      alert_dismissals: {
        Row: {
          alert_subtype: string | null
          alert_type: string
          context: Json | null
          dismissed_at: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          alert_subtype?: string | null
          alert_type: string
          context?: Json | null
          dismissed_at?: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          alert_subtype?: string | null
          alert_type?: string
          context?: Json | null
          dismissed_at?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'alert_dismissals_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      alert_events: {
        Row: {
          actual_value: number | null
          created_at: string
          id: string
          notified_email: boolean | null
          notified_telegram: boolean | null
          payload: Json
          resolution_note: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string
          target_id: string | null
          target_label: string | null
          target_type: string | null
          threshold_value: number | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          id?: string
          notified_email?: boolean | null
          notified_telegram?: boolean | null
          payload?: Json
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id: string
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          threshold_value?: number | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          id?: string
          notified_email?: boolean | null
          notified_telegram?: boolean | null
          payload?: Json
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'alert_events_rule_id_fkey'
            columns: ['rule_id']
            isOneToOne: false
            referencedRelation: 'alert_rules'
            referencedColumns: ['id']
          },
        ]
      }
      alert_preferences: {
        Row: {
          coach_ai_enabled: boolean
          coach_ai_frequency: string
          created_at: string
          fraud_detection_enabled: boolean
          fraud_sensitivity: string
          gamification_enabled: boolean
          id: string
          lead_notifications_enabled: boolean
          lead_notifications_quiet_hours_end: string
          lead_notifications_quiet_hours_start: string
          lead_notifications_weekend: boolean
          level_notifications_enabled: boolean
          organization_id: string
          pre_export_enabled: boolean
          pre_export_strictness: string
          proactive_suggestions_mode: string
          updated_at: string
        }
        Insert: {
          coach_ai_enabled?: boolean
          coach_ai_frequency?: string
          created_at?: string
          fraud_detection_enabled?: boolean
          fraud_sensitivity?: string
          gamification_enabled?: boolean
          id?: string
          lead_notifications_enabled?: boolean
          lead_notifications_quiet_hours_end?: string
          lead_notifications_quiet_hours_start?: string
          lead_notifications_weekend?: boolean
          level_notifications_enabled?: boolean
          organization_id: string
          pre_export_enabled?: boolean
          pre_export_strictness?: string
          proactive_suggestions_mode?: string
          updated_at?: string
        }
        Update: {
          coach_ai_enabled?: boolean
          coach_ai_frequency?: string
          created_at?: string
          fraud_detection_enabled?: boolean
          fraud_sensitivity?: string
          gamification_enabled?: boolean
          id?: string
          lead_notifications_enabled?: boolean
          lead_notifications_quiet_hours_end?: string
          lead_notifications_quiet_hours_start?: string
          lead_notifications_weekend?: boolean
          level_notifications_enabled?: boolean
          organization_id?: string
          pre_export_enabled?: boolean
          pre_export_strictness?: string
          proactive_suggestions_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alert_preferences_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      alert_rules: {
        Row: {
          active: boolean
          auto_action: Json | null
          cooldown_minutes: number
          created_at: string
          created_by: string | null
          description: string | null
          detection_formula: Json
          id: string
          name: string
          notify_buttons: Json | null
          notify_email: boolean
          notify_message_template: string | null
          notify_telegram: boolean
          notify_telegram_channel: string | null
          severity: string
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_action?: Json | null
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          detection_formula: Json
          id?: string
          name: string
          notify_buttons?: Json | null
          notify_email?: boolean
          notify_message_template?: string | null
          notify_telegram?: boolean
          notify_telegram_channel?: string | null
          severity?: string
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_action?: Json | null
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          detection_formula?: Json
          id?: string
          name?: string
          notify_buttons?: Json | null
          notify_email?: boolean
          notify_message_template?: string | null
          notify_telegram?: boolean
          notify_telegram_channel?: string | null
          severity?: string
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      anonymous_benchmarks: {
        Row: {
          cabinet_segment: string
          cabinets_count: number
          computed_by: string
          created_at: string
          diagnostic_kind: string | null
          diagnostic_mix_pct: Json
          id: string
          k_anonymity_threshold: number
          median_gross_margin_ratio: number | null
          median_mission_value_cents: number | null
          median_missions_per_cabinet: number | null
          median_time_saved_seconds_per_mission: number | null
          median_time_to_export_seconds: number | null
          metadata: Json | null
          missions_count: number
          p25_mission_value_cents: number | null
          p25_missions_per_cabinet: number | null
          p25_time_to_export_seconds: number | null
          p75_mission_value_cents: number | null
          p75_missions_per_cabinet: number | null
          p75_time_to_export_seconds: number | null
          period_type: string
          scope: string
          scope_code: string | null
          snapshot_period: string
          updated_at: string
        }
        Insert: {
          cabinet_segment?: string
          cabinets_count: number
          computed_by?: string
          created_at?: string
          diagnostic_kind?: string | null
          diagnostic_mix_pct?: Json
          id?: string
          k_anonymity_threshold?: number
          median_gross_margin_ratio?: number | null
          median_mission_value_cents?: number | null
          median_missions_per_cabinet?: number | null
          median_time_saved_seconds_per_mission?: number | null
          median_time_to_export_seconds?: number | null
          metadata?: Json | null
          missions_count: number
          p25_mission_value_cents?: number | null
          p25_missions_per_cabinet?: number | null
          p25_time_to_export_seconds?: number | null
          p75_mission_value_cents?: number | null
          p75_missions_per_cabinet?: number | null
          p75_time_to_export_seconds?: number | null
          period_type: string
          scope?: string
          scope_code?: string | null
          snapshot_period: string
          updated_at?: string
        }
        Update: {
          cabinet_segment?: string
          cabinets_count?: number
          computed_by?: string
          created_at?: string
          diagnostic_kind?: string | null
          diagnostic_mix_pct?: Json
          id?: string
          k_anonymity_threshold?: number
          median_gross_margin_ratio?: number | null
          median_mission_value_cents?: number | null
          median_missions_per_cabinet?: number | null
          median_time_saved_seconds_per_mission?: number | null
          median_time_to_export_seconds?: number | null
          metadata?: Json | null
          missions_count?: number
          p25_mission_value_cents?: number | null
          p25_missions_per_cabinet?: number | null
          p25_time_to_export_seconds?: number | null
          p75_mission_value_cents?: number | null
          p75_missions_per_cabinet?: number | null
          p75_time_to_export_seconds?: number | null
          period_type?: string
          scope?: string
          scope_code?: string | null
          snapshot_period?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_data_access: {
        Row: {
          accessed_at: string
          action: string
          data_type: string
          id: string
          ip: string | null
          organization_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          action: string
          data_type: string
          id?: string
          ip?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          action?: string
          data_type?: string
          id?: string
          ip?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_data_access_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      auto_quotes: {
        Row: {
          ai_confidence: number | null
          contact_id: string | null
          created_at: string
          decided_at: string | null
          decision_notes: string | null
          diagnostics_requested: string[]
          generated_amount_ht: number | null
          generated_amount_ttc: number | null
          generated_at: string | null
          id: string
          organization_id: string
          property_snapshot: Json
          quote_id: string | null
          sent_at: string | null
          status: string
          trigger_source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          contact_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          diagnostics_requested?: string[]
          generated_amount_ht?: number | null
          generated_amount_ttc?: number | null
          generated_at?: string | null
          id?: string
          organization_id: string
          property_snapshot?: Json
          quote_id?: string | null
          sent_at?: string | null
          status?: string
          trigger_source: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          contact_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          diagnostics_requested?: string[]
          generated_amount_ht?: number | null
          generated_amount_ttc?: number | null
          generated_at?: string | null
          id?: string
          organization_id?: string
          property_snapshot?: Json
          quote_id?: string | null
          sent_at?: string | null
          status?: string
          trigger_source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'auto_quotes_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'auto_quotes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'auto_quotes_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'auto_quotes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bandit_diagnostician_stats: {
        Row: {
          alpha: number
          beta: number
          conversions: number
          created_at: string
          decay_factor: number
          diagnostician_id: string
          impressions: number
          last_updated_at: string
          warm_threshold: number
        }
        Insert: {
          alpha?: number
          beta?: number
          conversions?: number
          created_at?: string
          decay_factor?: number
          diagnostician_id: string
          impressions?: number
          last_updated_at?: string
          warm_threshold?: number
        }
        Update: {
          alpha?: number
          beta?: number
          conversions?: number
          created_at?: string
          decay_factor?: number
          diagnostician_id?: string
          impressions?: number
          last_updated_at?: string
          warm_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: 'bandit_diagnostician_stats_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bandit_diagnostician_stats_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'bandit_diagnostician_stats_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bandit_diagnostician_stats_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bandit_diagnostician_stats_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      bandit_events: {
        Row: {
          city_slug: string | null
          diagnostician_id: string
          event_type: string
          id: number
          metadata: Json
          occurred_at: string
        }
        Insert: {
          city_slug?: string | null
          diagnostician_id: string
          event_type: string
          id?: number
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          city_slug?: string | null
          diagnostician_id?: string
          event_type?: string
          id?: number
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bandit_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bandit_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'bandit_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bandit_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bandit_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      broadcast_history: {
        Row: {
          audience_filter: Json
          body_html: string
          body_text: string | null
          clicked_count: number
          created_at: string
          created_by: string
          delivered_count: number
          error_count: number
          id: string
          opened_count: number
          recipients_count: number
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          audience_filter: Json
          body_html: string
          body_text?: string | null
          clicked_count?: number
          created_at?: string
          created_by: string
          delivered_count?: number
          error_count?: number
          id?: string
          opened_count?: number
          recipients_count?: number
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          audience_filter?: Json
          body_html?: string
          body_text?: string | null
          clicked_count?: number
          created_at?: string
          created_by?: string
          delivered_count?: number
          error_count?: number
          id?: string
          opened_count?: number
          recipients_count?: number
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      bundle_subscriptions: {
        Row: {
          bundle_code: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          bundle_code: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          bundle_code?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bundle_subscriptions_bundle_code_fkey'
            columns: ['bundle_code']
            isOneToOne: false
            referencedRelation: 'bundles'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'bundle_subscriptions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      bundles: {
        Row: {
          annuaire_component: string
          annual_price_cents: number
          code: string
          created_at: string
          display_order: number
          featured: boolean
          logiciel_component: string
          monthly_price_cents: number
          name: string
          savings_cents: number
        }
        Insert: {
          annuaire_component: string
          annual_price_cents: number
          code: string
          created_at?: string
          display_order?: number
          featured?: boolean
          logiciel_component: string
          monthly_price_cents: number
          name: string
          savings_cents: number
        }
        Update: {
          annuaire_component?: string
          annual_price_cents?: number
          code?: string
          created_at?: string
          display_order?: number
          featured?: boolean
          logiciel_component?: string
          monthly_price_cents?: number
          name?: string
          savings_cents?: number
        }
        Relationships: []
      }
      business_analytics_snapshots: {
        Row: {
          ai_cost_cents: number
          avg_mission_value_cents: number
          avg_photos_per_mission: number | null
          avg_time_to_export_seconds: number | null
          avg_voice_seconds_per_mission: number | null
          by_day_of_week: Json | null
          by_hour_of_day: Json | null
          computed_by: string
          created_at: string
          diagnostic_mix: Json
          estimated_time_saved_seconds: number
          gross_margin_cents: number
          gross_margin_ratio: number | null
          id: string
          metadata: Json | null
          missions_cancelled: number
          missions_completed: number
          missions_exported: number
          missions_total: number
          organization_id: string
          period_type: string
          recurring_clients: number
          revenue_ht_cents: number
          revenue_ttc_cents: number
          snapshot_period: string
          top_client_share_pct: number | null
          top_departments: Json | null
          unique_clients: number
          updated_at: string
          variable_cost_cents: number
        }
        Insert: {
          ai_cost_cents?: number
          avg_mission_value_cents?: number
          avg_photos_per_mission?: number | null
          avg_time_to_export_seconds?: number | null
          avg_voice_seconds_per_mission?: number | null
          by_day_of_week?: Json | null
          by_hour_of_day?: Json | null
          computed_by?: string
          created_at?: string
          diagnostic_mix?: Json
          estimated_time_saved_seconds?: number
          gross_margin_cents?: number
          gross_margin_ratio?: number | null
          id?: string
          metadata?: Json | null
          missions_cancelled?: number
          missions_completed?: number
          missions_exported?: number
          missions_total?: number
          organization_id: string
          period_type: string
          recurring_clients?: number
          revenue_ht_cents?: number
          revenue_ttc_cents?: number
          snapshot_period: string
          top_client_share_pct?: number | null
          top_departments?: Json | null
          unique_clients?: number
          updated_at?: string
          variable_cost_cents?: number
        }
        Update: {
          ai_cost_cents?: number
          avg_mission_value_cents?: number
          avg_photos_per_mission?: number | null
          avg_time_to_export_seconds?: number | null
          avg_voice_seconds_per_mission?: number | null
          by_day_of_week?: Json | null
          by_hour_of_day?: Json | null
          computed_by?: string
          created_at?: string
          diagnostic_mix?: Json
          estimated_time_saved_seconds?: number
          gross_margin_cents?: number
          gross_margin_ratio?: number | null
          id?: string
          metadata?: Json | null
          missions_cancelled?: number
          missions_completed?: number
          missions_exported?: number
          missions_total?: number
          organization_id?: string
          period_type?: string
          recurring_clients?: number
          revenue_ht_cents?: number
          revenue_ttc_cents?: number
          snapshot_period?: string
          top_client_share_pct?: number | null
          top_departments?: Json | null
          unique_clients?: number
          updated_at?: string
          variable_cost_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: 'business_analytics_snapshots_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      business_cards: {
        Row: {
          created_at: string
          custom_phone_fixed: string | null
          custom_title: string | null
          custom_website: string | null
          organization_id: string
          public_token: string
          scan_count: number
          show_address: boolean
          show_certification: boolean
          show_email: boolean
          show_logo: boolean
          show_phone_fixed: boolean
          show_phone_mobile: boolean
          show_siret: boolean
          show_website: boolean
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          custom_phone_fixed?: string | null
          custom_title?: string | null
          custom_website?: string | null
          organization_id: string
          public_token?: string
          scan_count?: number
          show_address?: boolean
          show_certification?: boolean
          show_email?: boolean
          show_logo?: boolean
          show_phone_fixed?: boolean
          show_phone_mobile?: boolean
          show_siret?: boolean
          show_website?: boolean
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          custom_phone_fixed?: string | null
          custom_title?: string | null
          custom_website?: string | null
          organization_id?: string
          public_token?: string
          scan_count?: number
          show_address?: boolean
          show_certification?: boolean
          show_email?: boolean
          show_logo?: boolean
          show_phone_fixed?: boolean
          show_phone_mobile?: boolean
          show_siret?: boolean
          show_website?: boolean
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'business_cards_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      cabinet_trials: {
        Row: {
          blocked_reason: string | null
          converted_to_paid: boolean
          created_at: string
          email: string
          id: string
          organization_id: string | null
          siret: string
          trial_ended_at: string | null
          trial_started_at: string
          user_id: string | null
        }
        Insert: {
          blocked_reason?: string | null
          converted_to_paid?: boolean
          created_at?: string
          email: string
          id?: string
          organization_id?: string | null
          siret: string
          trial_ended_at?: string | null
          trial_started_at?: string
          user_id?: string | null
        }
        Update: {
          blocked_reason?: string | null
          converted_to_paid?: boolean
          created_at?: string
          email?: string
          id?: string
          organization_id?: string | null
          siret?: string
          trial_ended_at?: string | null
          trial_started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'cabinet_trials_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      cancellations: {
        Row: {
          calendly_booked: boolean
          calendly_call_at: string | null
          calendly_link_shown_at: string | null
          confirmed_at: string | null
          created_at: string
          effective_end_date: string | null
          feedback_category: string
          feedback_text: string
          id: string
          initiated_at: string
          ip_address: unknown
          organization_id: string
          reactivated_at: string | null
          reactivation_subscription_id: string | null
          step1_seen_at: string | null
          step2_alternative_accepted: boolean
          step2_alternative_offered: string | null
          step2_discount_percentage: number | null
          step2_downgrade_to_plan_code: string | null
          step2_pause_duration_months: number | null
          step2_seen_at: string | null
          subscription_id: string
          user_agent: string | null
          user_id: string
          winback_code: string | null
          winback_code_expires_at: string | null
          winback_code_used_at: string | null
          winback_email_sent_at: string | null
        }
        Insert: {
          calendly_booked?: boolean
          calendly_call_at?: string | null
          calendly_link_shown_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          effective_end_date?: string | null
          feedback_category: string
          feedback_text: string
          id?: string
          initiated_at?: string
          ip_address?: unknown
          organization_id: string
          reactivated_at?: string | null
          reactivation_subscription_id?: string | null
          step1_seen_at?: string | null
          step2_alternative_accepted?: boolean
          step2_alternative_offered?: string | null
          step2_discount_percentage?: number | null
          step2_downgrade_to_plan_code?: string | null
          step2_pause_duration_months?: number | null
          step2_seen_at?: string | null
          subscription_id: string
          user_agent?: string | null
          user_id: string
          winback_code?: string | null
          winback_code_expires_at?: string | null
          winback_code_used_at?: string | null
          winback_email_sent_at?: string | null
        }
        Update: {
          calendly_booked?: boolean
          calendly_call_at?: string | null
          calendly_link_shown_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          effective_end_date?: string | null
          feedback_category?: string
          feedback_text?: string
          id?: string
          initiated_at?: string
          ip_address?: unknown
          organization_id?: string
          reactivated_at?: string | null
          reactivation_subscription_id?: string | null
          step1_seen_at?: string | null
          step2_alternative_accepted?: boolean
          step2_alternative_offered?: string | null
          step2_discount_percentage?: number | null
          step2_downgrade_to_plan_code?: string | null
          step2_pause_duration_months?: number | null
          step2_seen_at?: string | null
          subscription_id?: string
          user_agent?: string | null
          user_id?: string
          winback_code?: string | null
          winback_code_expires_at?: string | null
          winback_code_used_at?: string | null
          winback_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'cancellations_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cancellations_reactivation_subscription_id_fkey'
            columns: ['reactivation_subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cancellations_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      city_premium_slots: {
        Row: {
          city_slug: string
          created_at: string
          current_slot_price_eur_monthly: number
          department_code: string
          enabled: boolean
          id: string
          max_slots: number
        }
        Insert: {
          city_slug: string
          created_at?: string
          current_slot_price_eur_monthly?: number
          department_code: string
          enabled?: boolean
          id?: string
          max_slots?: number
        }
        Update: {
          city_slug?: string
          created_at?: string
          current_slot_price_eur_monthly?: number
          department_code?: string
          enabled?: boolean
          id?: string
          max_slots?: number
        }
        Relationships: []
      }
      city_real_stats: {
        Row: {
          ai_generated_at: string | null
          ai_model: string | null
          avg_construction_year: number | null
          city_name: string
          city_slug: string
          context_paragraphs: Json
          created_at: string
          dept_code: string
          dpe_distribution: Json
          dpe_period_end: string | null
          dpe_period_start: string | null
          estimated_dpe_per_year: number | null
          fg_rate_pct: number | null
          insee_code: string | null
          last_error: string | null
          last_refreshed_at: string | null
          max_dpe_price_eur: number | null
          median_delivery_days: number | null
          median_dpe_price_eur: number | null
          median_energy_class: string | null
          min_dpe_price_eur: number | null
          next_refresh_due: string | null
          population: number | null
          pre_1948_rate_pct: number | null
          pre_1997_rate_pct: number | null
          price_source: string | null
          refresh_status: string
          sources_used: Json
          total_dpe_count: number
          total_dwellings: number | null
          updated_at: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model?: string | null
          avg_construction_year?: number | null
          city_name: string
          city_slug: string
          context_paragraphs?: Json
          created_at?: string
          dept_code: string
          dpe_distribution?: Json
          dpe_period_end?: string | null
          dpe_period_start?: string | null
          estimated_dpe_per_year?: number | null
          fg_rate_pct?: number | null
          insee_code?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          max_dpe_price_eur?: number | null
          median_delivery_days?: number | null
          median_dpe_price_eur?: number | null
          median_energy_class?: string | null
          min_dpe_price_eur?: number | null
          next_refresh_due?: string | null
          population?: number | null
          pre_1948_rate_pct?: number | null
          pre_1997_rate_pct?: number | null
          price_source?: string | null
          refresh_status?: string
          sources_used?: Json
          total_dpe_count?: number
          total_dwellings?: number | null
          updated_at?: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_model?: string | null
          avg_construction_year?: number | null
          city_name?: string
          city_slug?: string
          context_paragraphs?: Json
          created_at?: string
          dept_code?: string
          dpe_distribution?: Json
          dpe_period_end?: string | null
          dpe_period_start?: string | null
          estimated_dpe_per_year?: number | null
          fg_rate_pct?: number | null
          insee_code?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          max_dpe_price_eur?: number | null
          median_delivery_days?: number | null
          median_dpe_price_eur?: number | null
          median_energy_class?: string | null
          min_dpe_price_eur?: number | null
          next_refresh_due?: string | null
          population?: number | null
          pre_1948_rate_pct?: number | null
          pre_1997_rate_pct?: number | null
          price_source?: string | null
          refresh_status?: string
          sources_used?: Json
          total_dpe_count?: number
          total_dwellings?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      claim_requests: {
        Row: {
          cert_upload_path: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_siret: string | null
          created_at: string
          diagnostician_id: string
          id: string
          id_upload_path: string | null
          ip_address: unknown
          method: string
          rejected_reason: string | null
          status: string
          user_agent: string | null
          user_id_created: string | null
          verification_attempts: number
          verification_code: string | null
          verification_code_expires_at: string | null
          verified_at: string | null
        }
        Insert: {
          cert_upload_path?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_siret?: string | null
          created_at?: string
          diagnostician_id: string
          id?: string
          id_upload_path?: string | null
          ip_address?: unknown
          method: string
          rejected_reason?: string | null
          status?: string
          user_agent?: string | null
          user_id_created?: string | null
          verification_attempts?: number
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verified_at?: string | null
        }
        Update: {
          cert_upload_path?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_siret?: string | null
          created_at?: string
          diagnostician_id?: string
          id?: string
          id_upload_path?: string | null
          ip_address?: unknown
          method?: string
          rejected_reason?: string | null
          status?: string
          user_agent?: string | null
          user_id_created?: string | null
          verification_attempts?: number
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'claim_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'claim_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'claim_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'claim_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'claim_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      client_photo_requests: {
        Row: {
          client_phone: string
          created_at: string
          expires_at: string
          id: string
          mission_id: string
          organization_id: string
          photo_description: string
          photo_storage_path: string | null
          requested_by: string
          status: string
          token: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          client_phone: string
          created_at?: string
          expires_at: string
          id?: string
          mission_id: string
          organization_id: string
          photo_description: string
          photo_storage_path?: string | null
          requested_by: string
          status?: string
          token: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          client_phone?: string
          created_at?: string
          expires_at?: string
          id?: string
          mission_id?: string
          organization_id?: string
          photo_description?: string
          photo_storage_path?: string | null
          requested_by?: string
          status?: string
          token?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'client_photo_requests_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_photo_requests_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_photo_requests_requested_by_fkey'
            columns: ['requested_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_complement: string | null
          apartment_detail: string | null
          building_letter: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string
          email: string | null
          first_name: string | null
          floor_number: number | null
          id: string
          indy_customer_id: string | null
          last_name: string | null
          notes: string | null
          organization_id: string
          pennylane_customer_id: string | null
          pennylane_synced_at: string | null
          phone: string | null
          postal_code: string | null
          qonto_customer_id: string | null
          qonto_synced_at: string | null
          siret: string | null
          tags: string[] | null
          tiime_customer_id: string | null
          type: Database['public']['Enums']['client_type']
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          apartment_detail?: string | null
          building_letter?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name: string
          email?: string | null
          first_name?: string | null
          floor_number?: number | null
          id?: string
          indy_customer_id?: string | null
          last_name?: string | null
          notes?: string | null
          organization_id: string
          pennylane_customer_id?: string | null
          pennylane_synced_at?: string | null
          phone?: string | null
          postal_code?: string | null
          qonto_customer_id?: string | null
          qonto_synced_at?: string | null
          siret?: string | null
          tags?: string[] | null
          tiime_customer_id?: string | null
          type?: Database['public']['Enums']['client_type']
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          apartment_detail?: string | null
          building_letter?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          first_name?: string | null
          floor_number?: number | null
          id?: string
          indy_customer_id?: string | null
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          pennylane_customer_id?: string | null
          pennylane_synced_at?: string | null
          phone?: string | null
          postal_code?: string | null
          qonto_customer_id?: string | null
          qonto_synced_at?: string | null
          siret?: string | null
          tags?: string[] | null
          tiime_customer_id?: string | null
          type?: Database['public']['Enums']['client_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clients_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      coach_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          role: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'coach_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'coach_conversations'
            referencedColumns: ['id']
          },
        ]
      }
      coach_recommendations: {
        Row: {
          action_url: string | null
          created_at: string
          expires_at: string | null
          id: string
          priority: number
          resolved_at: string | null
          source_conversation_id: string | null
          status: string
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          priority?: number
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: string
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          priority?: number
          resolved_at?: string | null
          source_conversation_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'coach_recommendations_source_conversation_id_fkey'
            columns: ['source_conversation_id']
            isOneToOne: false
            referencedRelation: 'coach_conversations'
            referencedColumns: ['id']
          },
        ]
      }
      community_case_responses: {
        Row: {
          author_user_id: string | null
          body: string
          case_id: string
          created_at: string
          downvotes_count: number
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          status: string
          updated_at: string
          upvotes_count: number
        }
        Insert: {
          author_user_id?: string | null
          body: string
          case_id: string
          created_at?: string
          downvotes_count?: number
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          status?: string
          updated_at?: string
          upvotes_count?: number
        }
        Update: {
          author_user_id?: string | null
          body?: string
          case_id?: string
          created_at?: string
          downvotes_count?: number
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          status?: string
          updated_at?: string
          upvotes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'community_case_responses_case_id_fkey'
            columns: ['case_id']
            isOneToOne: false
            referencedRelation: 'community_cases'
            referencedColumns: ['id']
          },
        ]
      }
      community_case_votes: {
        Row: {
          case_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'community_case_votes_case_id_fkey'
            columns: ['case_id']
            isOneToOne: false
            referencedRelation: 'community_cases'
            referencedColumns: ['id']
          },
        ]
      }
      community_cases: {
        Row: {
          author_user_id: string | null
          building_type: string | null
          context_description: string
          created_at: string
          decision_made: string | null
          diagnostic_kinds: string[] | null
          downvotes_count: number
          id: string
          justification: string | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          question: string
          region_anonymised: string | null
          responses_count: number
          status: string
          surface_range: string | null
          tags: string[] | null
          title: string
          updated_at: string
          upvotes_count: number
          views_count: number
          year_built_range: string | null
        }
        Insert: {
          author_user_id?: string | null
          building_type?: string | null
          context_description: string
          created_at?: string
          decision_made?: string | null
          diagnostic_kinds?: string[] | null
          downvotes_count?: number
          id?: string
          justification?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          question: string
          region_anonymised?: string | null
          responses_count?: number
          status?: string
          surface_range?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          upvotes_count?: number
          views_count?: number
          year_built_range?: string | null
        }
        Update: {
          author_user_id?: string | null
          building_type?: string | null
          context_description?: string
          created_at?: string
          decision_made?: string | null
          diagnostic_kinds?: string[] | null
          downvotes_count?: number
          id?: string
          justification?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          question?: string
          region_anonymised?: string | null
          responses_count?: number
          status?: string
          surface_range?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          upvotes_count?: number
          views_count?: number
          year_built_range?: string | null
        }
        Relationships: []
      }
      connector_api_access_requests: {
        Row: {
          contact_email: string | null
          id: string
          message: string | null
          organization_id: string
          provider: string
          requested_at: string
          requested_by: string | null
          resolved_at: string | null
          resolved_notes: string | null
          status: string
        }
        Insert: {
          contact_email?: string | null
          id?: string
          message?: string | null
          organization_id: string
          provider: string
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          resolved_notes?: string | null
          status?: string
        }
        Update: {
          contact_email?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          provider?: string
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          resolved_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'connector_api_access_requests_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      contact_inquiries: {
        Row: {
          company: string | null
          context: Json
          created_at: string
          email: string
          first_name: string
          honeypot_value: string | null
          id: string
          inquiry_type: string
          internal_notes: string | null
          last_name: string
          message: string
          phone: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_ip: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          company?: string | null
          context?: Json
          created_at?: string
          email: string
          first_name: string
          honeypot_value?: string | null
          id?: string
          inquiry_type: string
          internal_notes?: string | null
          last_name: string
          message: string
          phone?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_ip?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          company?: string | null
          context?: Json
          created_at?: string
          email?: string
          first_name?: string
          honeypot_value?: string | null
          id?: string
          inquiry_type?: string
          internal_notes?: string | null
          last_name?: string
          message?: string
          phone?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_ip?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_name: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          id: string
          kind: string
          notes: string | null
          organization_id: string
          phone: string | null
          siret: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email?: string | null
          id?: string
          kind: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          siret?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          kind?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          siret?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      coproprietes: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          insee_code: string | null
          location: unknown
          lots_count: number | null
          name: string
          notes: string | null
          organization_id: string
          postal_code: string | null
          rnic_number: string | null
          syndic_id: string | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          insee_code?: string | null
          location?: unknown
          lots_count?: number | null
          name: string
          notes?: string | null
          organization_id: string
          postal_code?: string | null
          rnic_number?: string | null
          syndic_id?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          insee_code?: string | null
          location?: unknown
          lots_count?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          postal_code?: string | null
          rnic_number?: string | null
          syndic_id?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'coproprietes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coproprietes_syndic_id_fkey'
            columns: ['syndic_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount_eur_cents: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_eur_cents: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_eur_cents?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'credit_transactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      defense_dossiers: {
        Row: {
          created_at: string
          evidence_count: number
          evidence_manifest: Json
          id: string
          metadata: Json
          mission_id: string
          notes: string | null
          organization_id: string
          photos_geo_count: number
          reference: string | null
          robustness_score: number | null
          sealed_at: string | null
          sealed_by: string | null
          sealed_hash: string | null
          sealed_storage_path: string | null
          signatures_count: number
          status: string
          updated_at: string
          user_id: string | null
          voice_notes_count: number
        }
        Insert: {
          created_at?: string
          evidence_count?: number
          evidence_manifest?: Json
          id?: string
          metadata?: Json
          mission_id: string
          notes?: string | null
          organization_id: string
          photos_geo_count?: number
          reference?: string | null
          robustness_score?: number | null
          sealed_at?: string | null
          sealed_by?: string | null
          sealed_hash?: string | null
          sealed_storage_path?: string | null
          signatures_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
          voice_notes_count?: number
        }
        Update: {
          created_at?: string
          evidence_count?: number
          evidence_manifest?: Json
          id?: string
          metadata?: Json
          mission_id?: string
          notes?: string | null
          organization_id?: string
          photos_geo_count?: number
          reference?: string | null
          robustness_score?: number | null
          sealed_at?: string | null
          sealed_by?: string | null
          sealed_hash?: string | null
          sealed_storage_path?: string | null
          signatures_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
          voice_notes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'defense_dossiers_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'defense_dossiers_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostic_scans: {
        Row: {
          ademe_number: string | null
          adresse: string | null
          ai_confidence: number | null
          ai_cost_eur: number | null
          ai_latency_ms: number | null
          client_id: string | null
          confirmed_at: string | null
          created_at: string
          date_emission: string | null
          date_expiration: string | null
          deleted_at: string | null
          diagnostic_type: string | null
          energy_class: string | null
          extracted_data: Json
          file_storage_path: string
          id: string
          mime_type: string | null
          organization_id: string
          original_name: string | null
          property_id: string | null
          proprietaire: string | null
          rejected_at: string | null
          result_positive: boolean | null
          size_bytes: number | null
          status: string
          updated_at: string
          uploaded_by: string | null
          usage_context: string | null
        }
        Insert: {
          ademe_number?: string | null
          adresse?: string | null
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          ai_latency_ms?: number | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          date_emission?: string | null
          date_expiration?: string | null
          deleted_at?: string | null
          diagnostic_type?: string | null
          energy_class?: string | null
          extracted_data?: Json
          file_storage_path: string
          id?: string
          mime_type?: string | null
          organization_id: string
          original_name?: string | null
          property_id?: string | null
          proprietaire?: string | null
          rejected_at?: string | null
          result_positive?: boolean | null
          size_bytes?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          usage_context?: string | null
        }
        Update: {
          ademe_number?: string | null
          adresse?: string | null
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          ai_latency_ms?: number | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          date_emission?: string | null
          date_expiration?: string | null
          deleted_at?: string | null
          diagnostic_type?: string | null
          energy_class?: string | null
          extracted_data?: Json
          file_storage_path?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          original_name?: string | null
          property_id?: string | null
          proprietaire?: string | null
          rejected_at?: string | null
          result_positive?: boolean | null
          size_bytes?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          usage_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostic_scans_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostic_scans_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostic_scans_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_certifications: {
        Row: {
          certification_number: string
          certification_type: string
          created_at: string
          diagnostician_id: string
          id: string
          last_verified_at: string | null
          organism: string
          source: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          certification_number: string
          certification_type: string
          created_at?: string
          diagnostician_id: string
          id?: string
          last_verified_at?: string | null
          organism: string
          source: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          certification_number?: string
          certification_type?: string
          created_at?: string
          diagnostician_id?: string
          id?: string
          last_verified_at?: string | null
          organism?: string
          source?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_certifications_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_certifications_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_certifications_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_certifications_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_certifications_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_corrections_pending: {
        Row: {
          contact_email: string | null
          created_at: string
          current_values: Json
          diagnostician_id: string
          id: string
          message: string | null
          proposed_changes: Json
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          submitter_ip: unknown
          submitter_user_agent: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          current_values?: Json
          diagnostician_id: string
          id?: string
          message?: string | null
          proposed_changes?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          submitter_ip?: unknown
          submitter_user_agent?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          current_values?: Json
          diagnostician_id?: string
          id?: string
          message?: string | null
          proposed_changes?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          submitter_ip?: unknown
          submitter_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_corrections_pending_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_corrections_pending_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_corrections_pending_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_corrections_pending_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_corrections_pending_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_cross_validation_logs: {
        Row: {
          created_at: string
          diagnostician_id: string
          error_message: string | null
          id: number
          latency_ms: number | null
          outcome: string
          payload: Json | null
          source: string
        }
        Insert: {
          created_at?: string
          diagnostician_id: string
          error_message?: string | null
          id?: number
          latency_ms?: number | null
          outcome: string
          payload?: Json | null
          source: string
        }
        Update: {
          created_at?: string
          diagnostician_id?: string
          error_message?: string | null
          id?: number
          latency_ms?: number | null
          outcome?: string
          payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_cross_validation_logs_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_cross_validation_logs_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_cross_validation_logs_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_cross_validation_logs_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_cross_validation_logs_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_email_events: {
        Row: {
          clicked_url: string | null
          diagnostician_id: string
          email_step: number
          event_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          resend_message_id: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_url?: string | null
          diagnostician_id: string
          email_step: number
          event_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          resend_message_id?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_url?: string | null
          diagnostician_id?: string
          email_step?: number
          event_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          resend_message_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_email_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_email_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_email_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_email_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_email_events_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_premium_bookings: {
        Row: {
          active_from: string
          active_until: string | null
          created_at: string
          diagnostician_id: string
          id: string
          monthly_price_paid_eur: number
          position: number
          slot_id: string
        }
        Insert: {
          active_from?: string
          active_until?: string | null
          created_at?: string
          diagnostician_id: string
          id?: string
          monthly_price_paid_eur: number
          position: number
          slot_id: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          created_at?: string
          diagnostician_id?: string
          id?: string
          monthly_price_paid_eur?: number
          position?: number
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_premium_bookings_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_premium_bookings_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_premium_bookings_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_premium_bookings_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_premium_bookings_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_premium_bookings_slot_id_fkey'
            columns: ['slot_id']
            isOneToOne: false
            referencedRelation: 'city_premium_slots'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_profile_views: {
        Row: {
          diagnostician_id: string
          id: string
          source: string | null
          viewed_at: string
          visitor_city: string | null
        }
        Insert: {
          diagnostician_id: string
          id?: string
          source?: string | null
          viewed_at?: string
          visitor_city?: string | null
        }
        Update: {
          diagnostician_id?: string
          id?: string
          source?: string | null
          viewed_at?: string
          visitor_city?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_profile_views_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_profile_views_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_profile_views_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_profile_views_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_profile_views_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_public_profile: {
        Row: {
          bio_long: string | null
          bio_short: string | null
          diagnostician_id: string
          indicative_prices: Json
          intervention_zones: Json
          opening_hours: Json
          portfolio_photo_urls: Json
          profile_photo_url: string | null
          specialties: Json
          updated_at: string
        }
        Insert: {
          bio_long?: string | null
          bio_short?: string | null
          diagnostician_id: string
          indicative_prices?: Json
          intervention_zones?: Json
          opening_hours?: Json
          portfolio_photo_urls?: Json
          profile_photo_url?: string | null
          specialties?: Json
          updated_at?: string
        }
        Update: {
          bio_long?: string | null
          bio_short?: string | null
          diagnostician_id?: string
          indicative_prices?: Json
          intervention_zones?: Json
          opening_hours?: Json
          portfolio_photo_urls?: Json
          profile_photo_url?: string | null
          specialties?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_public_profile_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_public_profile_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_public_profile_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_public_profile_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_public_profile_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_signalements: {
        Row: {
          created_at: string
          description: string | null
          diagnostician_id: string
          id: string
          investigated_by: string | null
          proof_urls: Json
          reason: string
          reporter_email: string | null
          reporter_ip_hash: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          diagnostician_id: string
          id?: string
          investigated_by?: string | null
          proof_urls?: Json
          reason: string
          reporter_email?: string | null
          reporter_ip_hash: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          diagnostician_id?: string
          id?: string
          investigated_by?: string | null
          proof_urls?: Json
          reason?: string
          reporter_email?: string | null
          reporter_ip_hash?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_signalements_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_signalements_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_signalements_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_signalements_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_signalements_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostician_verification_status: {
        Row: {
          badge_level: string
          badge_level_granted_at: string | null
          cofrac_certifying_body: string | null
          cofrac_domains: Json
          cofrac_last_api_check: string | null
          cofrac_number: string | null
          cofrac_rejection_reason: string | null
          cofrac_status: string
          cofrac_valid_from: string | null
          cofrac_valid_until: string | null
          cofrac_verified_at: string | null
          created_at: string
          diagnostician_id: string
          identity_method: string | null
          identity_provider_ref: string | null
          identity_rejection_reason: string | null
          identity_status: string
          identity_verified_at: string | null
          manual_review_priority: number
          overall_status: string | null
          rcpro_amount_per_claim_eur: number | null
          rcpro_amount_per_year_eur: number | null
          rcpro_insurer: string | null
          rcpro_policy_number: string | null
          rcpro_rejection_reason: string | null
          rcpro_status: string
          rcpro_valid_from: string | null
          rcpro_valid_until: string | null
          rcpro_verified_at: string | null
          signalements_count: number
          sirene_ape_code: string | null
          sirene_company_created_at: string | null
          sirene_company_name: string | null
          sirene_director_name: string | null
          sirene_last_api_check: string | null
          sirene_legal_form: string | null
          sirene_rejection_reason: string | null
          sirene_siret: string | null
          sirene_status: string
          sirene_verified_at: string | null
          updated_at: string
        }
        Insert: {
          badge_level?: string
          badge_level_granted_at?: string | null
          cofrac_certifying_body?: string | null
          cofrac_domains?: Json
          cofrac_last_api_check?: string | null
          cofrac_number?: string | null
          cofrac_rejection_reason?: string | null
          cofrac_status?: string
          cofrac_valid_from?: string | null
          cofrac_valid_until?: string | null
          cofrac_verified_at?: string | null
          created_at?: string
          diagnostician_id: string
          identity_method?: string | null
          identity_provider_ref?: string | null
          identity_rejection_reason?: string | null
          identity_status?: string
          identity_verified_at?: string | null
          manual_review_priority?: number
          overall_status?: string | null
          rcpro_amount_per_claim_eur?: number | null
          rcpro_amount_per_year_eur?: number | null
          rcpro_insurer?: string | null
          rcpro_policy_number?: string | null
          rcpro_rejection_reason?: string | null
          rcpro_status?: string
          rcpro_valid_from?: string | null
          rcpro_valid_until?: string | null
          rcpro_verified_at?: string | null
          signalements_count?: number
          sirene_ape_code?: string | null
          sirene_company_created_at?: string | null
          sirene_company_name?: string | null
          sirene_director_name?: string | null
          sirene_last_api_check?: string | null
          sirene_legal_form?: string | null
          sirene_rejection_reason?: string | null
          sirene_siret?: string | null
          sirene_status?: string
          sirene_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          badge_level?: string
          badge_level_granted_at?: string | null
          cofrac_certifying_body?: string | null
          cofrac_domains?: Json
          cofrac_last_api_check?: string | null
          cofrac_number?: string | null
          cofrac_rejection_reason?: string | null
          cofrac_status?: string
          cofrac_valid_from?: string | null
          cofrac_valid_until?: string | null
          cofrac_verified_at?: string | null
          created_at?: string
          diagnostician_id?: string
          identity_method?: string | null
          identity_provider_ref?: string | null
          identity_rejection_reason?: string | null
          identity_status?: string
          identity_verified_at?: string | null
          manual_review_priority?: number
          overall_status?: string | null
          rcpro_amount_per_claim_eur?: number | null
          rcpro_amount_per_year_eur?: number | null
          rcpro_insurer?: string | null
          rcpro_policy_number?: string | null
          rcpro_rejection_reason?: string | null
          rcpro_status?: string
          rcpro_valid_from?: string | null
          rcpro_valid_until?: string | null
          rcpro_verified_at?: string | null
          signalements_count?: number
          sirene_ape_code?: string | null
          sirene_company_created_at?: string | null
          sirene_company_name?: string | null
          sirene_director_name?: string | null
          sirene_last_api_check?: string | null
          sirene_legal_form?: string | null
          sirene_rejection_reason?: string | null
          sirene_siret?: string | null
          sirene_status?: string
          sirene_verified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostician_verification_status_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_verification_status_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'diagnostician_verification_status_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_verification_status_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnostician_verification_status_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: true
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      diagnosticians: {
        Row: {
          activity_score: number | null
          activity_score_computed_at: string | null
          address: string | null
          ademe_dpe_count_12mo: number
          ademe_last_dpe_at: string | null
          ademe_last_synced_at: string | null
          ban_accuracy: string | null
          ban_label: string | null
          ban_last_synced_at: string | null
          boost_lead_active: boolean
          cabinet_lat: number | null
          cabinet_lng: number | null
          certification_n: string | null
          certifications: Json | null
          city: string | null
          city_slug: string | null
          claim_status: string | null
          claimed_at: string | null
          claimed_by_user_id: string | null
          company_name: string | null
          consecutive_ignored_leads: number
          created_at: string
          department_code: string | null
          dept_code: string | null
          dhup_imported_at: string | null
          dhup_last_synced_at: string | null
          dhup_source_id: string | null
          email: string | null
          email_verified_at: string | null
          first_name: string | null
          fraud_flags: Json
          full_name: string
          full_name_normalized: string | null
          geo_lat: number | null
          geo_lng: number | null
          ghost_notification_sent_at: string | null
          ghost_status: string
          ghost_status_updated_at: string | null
          gmb_place_id: string | null
          gmb_rating: number | null
          gmb_review_count: number | null
          id: string
          inpi_last_synced_at: string | null
          inpi_legal_representatives: Json
          inpi_share_capital_paid: number | null
          intervention_radius_km: number | null
          is_published: boolean
          last_boost_lead_sent_at: string | null
          last_lead_interaction_at: string | null
          last_lead_received_at: string | null
          last_name: string | null
          latitude: number | null
          lead_cooldown_until: string | null
          leads_received_count: number
          leads_unlocked_count: number
          listing_level: string
          longitude: number | null
          manual_pause_until: string | null
          monthly_missions: number
          organization_id: string | null
          organization_id_v2: string | null
          phone: string | null
          photo_url: string | null
          postcode: string | null
          pre_notification_email_1_sent_at: string | null
          pre_notification_email_2_sent_at: string | null
          pre_notification_email_3_sent_at: string | null
          sirene_capital_eur: number | null
          sirene_creation_date: string | null
          sirene_denomination: string | null
          sirene_employee_range: string | null
          sirene_last_synced_at: string | null
          sirene_legal_form: string | null
          sirene_siret: string | null
          sirene_state: string | null
          slug: string | null
          slug_city: string | null
          unsubscribed: boolean
          unsubscribed_at: string | null
          updated_at: string
          user_id: string | null
          validation_status: string | null
          validation_status_changed_at: string | null
          validation_status_reason: string | null
          withdrawal_requested: boolean | null
          withdrawal_requested_at: string | null
          years_active: number
        }
        Insert: {
          activity_score?: number | null
          activity_score_computed_at?: string | null
          address?: string | null
          ademe_dpe_count_12mo?: number
          ademe_last_dpe_at?: string | null
          ademe_last_synced_at?: string | null
          ban_accuracy?: string | null
          ban_label?: string | null
          ban_last_synced_at?: string | null
          boost_lead_active?: boolean
          cabinet_lat?: number | null
          cabinet_lng?: number | null
          certification_n?: string | null
          certifications?: Json | null
          city?: string | null
          city_slug?: string | null
          claim_status?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          company_name?: string | null
          consecutive_ignored_leads?: number
          created_at?: string
          department_code?: string | null
          dept_code?: string | null
          dhup_imported_at?: string | null
          dhup_last_synced_at?: string | null
          dhup_source_id?: string | null
          email?: string | null
          email_verified_at?: string | null
          first_name?: string | null
          fraud_flags?: Json
          full_name: string
          full_name_normalized?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          ghost_notification_sent_at?: string | null
          ghost_status?: string
          ghost_status_updated_at?: string | null
          gmb_place_id?: string | null
          gmb_rating?: number | null
          gmb_review_count?: number | null
          id?: string
          inpi_last_synced_at?: string | null
          inpi_legal_representatives?: Json
          inpi_share_capital_paid?: number | null
          intervention_radius_km?: number | null
          is_published?: boolean
          last_boost_lead_sent_at?: string | null
          last_lead_interaction_at?: string | null
          last_lead_received_at?: string | null
          last_name?: string | null
          latitude?: number | null
          lead_cooldown_until?: string | null
          leads_received_count?: number
          leads_unlocked_count?: number
          listing_level?: string
          longitude?: number | null
          manual_pause_until?: string | null
          monthly_missions?: number
          organization_id?: string | null
          organization_id_v2?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          pre_notification_email_1_sent_at?: string | null
          pre_notification_email_2_sent_at?: string | null
          pre_notification_email_3_sent_at?: string | null
          sirene_capital_eur?: number | null
          sirene_creation_date?: string | null
          sirene_denomination?: string | null
          sirene_employee_range?: string | null
          sirene_last_synced_at?: string | null
          sirene_legal_form?: string | null
          sirene_siret?: string | null
          sirene_state?: string | null
          slug?: string | null
          slug_city?: string | null
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
          validation_status?: string | null
          validation_status_changed_at?: string | null
          validation_status_reason?: string | null
          withdrawal_requested?: boolean | null
          withdrawal_requested_at?: string | null
          years_active?: number
        }
        Update: {
          activity_score?: number | null
          activity_score_computed_at?: string | null
          address?: string | null
          ademe_dpe_count_12mo?: number
          ademe_last_dpe_at?: string | null
          ademe_last_synced_at?: string | null
          ban_accuracy?: string | null
          ban_label?: string | null
          ban_last_synced_at?: string | null
          boost_lead_active?: boolean
          cabinet_lat?: number | null
          cabinet_lng?: number | null
          certification_n?: string | null
          certifications?: Json | null
          city?: string | null
          city_slug?: string | null
          claim_status?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          company_name?: string | null
          consecutive_ignored_leads?: number
          created_at?: string
          department_code?: string | null
          dept_code?: string | null
          dhup_imported_at?: string | null
          dhup_last_synced_at?: string | null
          dhup_source_id?: string | null
          email?: string | null
          email_verified_at?: string | null
          first_name?: string | null
          fraud_flags?: Json
          full_name?: string
          full_name_normalized?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          ghost_notification_sent_at?: string | null
          ghost_status?: string
          ghost_status_updated_at?: string | null
          gmb_place_id?: string | null
          gmb_rating?: number | null
          gmb_review_count?: number | null
          id?: string
          inpi_last_synced_at?: string | null
          inpi_legal_representatives?: Json
          inpi_share_capital_paid?: number | null
          intervention_radius_km?: number | null
          is_published?: boolean
          last_boost_lead_sent_at?: string | null
          last_lead_interaction_at?: string | null
          last_lead_received_at?: string | null
          last_name?: string | null
          latitude?: number | null
          lead_cooldown_until?: string | null
          leads_received_count?: number
          leads_unlocked_count?: number
          listing_level?: string
          longitude?: number | null
          manual_pause_until?: string | null
          monthly_missions?: number
          organization_id?: string | null
          organization_id_v2?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          pre_notification_email_1_sent_at?: string | null
          pre_notification_email_2_sent_at?: string | null
          pre_notification_email_3_sent_at?: string | null
          sirene_capital_eur?: number | null
          sirene_creation_date?: string | null
          sirene_denomination?: string | null
          sirene_employee_range?: string | null
          sirene_last_synced_at?: string | null
          sirene_legal_form?: string | null
          sirene_siret?: string | null
          sirene_state?: string | null
          slug?: string | null
          slug_city?: string | null
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
          validation_status?: string | null
          validation_status_changed_at?: string | null
          validation_status_reason?: string | null
          withdrawal_requested?: boolean | null
          withdrawal_requested_at?: string | null
          years_active?: number
        }
        Relationships: [
          {
            foreignKeyName: 'diagnosticians_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diagnosticians_organization_id_v2_fkey'
            columns: ['organization_id_v2']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      document_corrections: {
        Row: {
          ai_confidence: number | null
          ai_value: string | null
          correction_reason: string | null
          created_at: string
          document_id: string
          field_path: string
          id: string
          user_id: string
          user_value: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_value?: string | null
          correction_reason?: string | null
          created_at?: string
          document_id: string
          field_path: string
          id?: string
          user_id: string
          user_value?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_value?: string | null
          correction_reason?: string | null
          created_at?: string
          document_id?: string
          field_path?: string
          id?: string
          user_id?: string
          user_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'document_corrections_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      document_extractions: {
        Row: {
          ai_cost_eur: number | null
          ai_input_tokens: number | null
          ai_model: string | null
          ai_output_tokens: number | null
          confidence_by_field: Json | null
          created_at: string
          document_id: string
          extraction_data: Json
          id: string
          prefill_summary: Json | null
          regulatory_validation: Json | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_input_tokens?: number | null
          ai_model?: string | null
          ai_output_tokens?: number | null
          confidence_by_field?: Json | null
          created_at?: string
          document_id: string
          extraction_data: Json
          id?: string
          prefill_summary?: Json | null
          regulatory_validation?: Json | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_input_tokens?: number | null
          ai_model?: string | null
          ai_output_tokens?: number | null
          confidence_by_field?: Json | null
          created_at?: string
          document_id?: string
          extraction_data?: Json
          id?: string
          prefill_summary?: Json | null
          regulatory_validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'document_extractions_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      documents: {
        Row: {
          classification_confidence: number | null
          client_id: string | null
          created_at: string
          document_type: string | null
          dossier_id: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          ocr_text: string | null
          organization_id: string
          original_filename: string | null
          raw_file_path: string
          source: string
          status: string
          thumbnail_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          classification_confidence?: number | null
          client_id?: string | null
          created_at?: string
          document_type?: string | null
          dossier_id?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          ocr_text?: string | null
          organization_id: string
          original_filename?: string | null
          raw_file_path: string
          source: string
          status?: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          classification_confidence?: number | null
          client_id?: string | null
          created_at?: string
          document_type?: string | null
          dossier_id?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          ocr_text?: string | null
          organization_id?: string
          original_filename?: string | null
          raw_file_path?: string
          source?: string
          status?: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dossier_activity_log: {
        Row: {
          actor_user_id: string | null
          dossier_id: string
          event_data: Json
          event_type: string
          id: string
          occurred_at: string
          organization_id: string
        }
        Insert: {
          actor_user_id?: string | null
          dossier_id: string
          event_data?: Json
          event_type: string
          id?: string
          occurred_at?: string
          organization_id: string
        }
        Update: {
          actor_user_id?: string | null
          dossier_id?: string
          event_data?: Json
          event_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dossier_activity_log_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_activity_log_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dossier_exports: {
        Row: {
          created_at: string
          created_by: string | null
          destination: string
          dossier_id: string
          download_count: number
          download_token: string | null
          downloaded_at: string | null
          expires_at: string | null
          id: string
          missing_fields_count: number
          missing_fields_snapshot: Json | null
          organization_id: string
          recipient: string | null
          storage_path: string | null
          was_complete: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination: string
          dossier_id: string
          download_count?: number
          download_token?: string | null
          downloaded_at?: string | null
          expires_at?: string | null
          id?: string
          missing_fields_count?: number
          missing_fields_snapshot?: Json | null
          organization_id: string
          recipient?: string | null
          storage_path?: string | null
          was_complete: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination?: string
          dossier_id?: string
          download_count?: number
          download_token?: string | null
          downloaded_at?: string | null
          expires_at?: string | null
          id?: string
          missing_fields_count?: number
          missing_fields_snapshot?: Json | null
          organization_id?: string
          recipient?: string | null
          storage_path?: string | null
          was_complete?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'dossier_exports_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_exports_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dossier_field_value_history: {
        Row: {
          changed_by: string | null
          changed_by_user: boolean | null
          created_at: string
          field_value_id: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_user?: boolean | null
          created_at?: string
          field_value_id: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_user?: boolean | null
          created_at?: string
          field_value_id?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'dossier_field_value_history_field_value_id_fkey'
            columns: ['field_value_id']
            isOneToOne: false
            referencedRelation: 'dossier_field_values'
            referencedColumns: ['id']
          },
        ]
      }
      dossier_field_values: {
        Row: {
          confidence: number | null
          conflict_resolution: string | null
          created_at: string
          diagnostic_type: string
          dossier_id: string
          field_path: string
          has_conflict: boolean | null
          id: string
          manually_edited_at: string | null
          organization_id: string
          source_document_id: string | null
          source_photo_id: string | null
          source_text_id: string | null
          source_type: string
          source_voice_id: string | null
          unit: string | null
          updated_at: string
          validated_at: string | null
          validated_by_user: boolean | null
          value: Json
        }
        Insert: {
          confidence?: number | null
          conflict_resolution?: string | null
          created_at?: string
          diagnostic_type: string
          dossier_id: string
          field_path: string
          has_conflict?: boolean | null
          id?: string
          manually_edited_at?: string | null
          organization_id: string
          source_document_id?: string | null
          source_photo_id?: string | null
          source_text_id?: string | null
          source_type: string
          source_voice_id?: string | null
          unit?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_user?: boolean | null
          value: Json
        }
        Update: {
          confidence?: number | null
          conflict_resolution?: string | null
          created_at?: string
          diagnostic_type?: string
          dossier_id?: string
          field_path?: string
          has_conflict?: boolean | null
          id?: string
          manually_edited_at?: string | null
          organization_id?: string
          source_document_id?: string | null
          source_photo_id?: string | null
          source_text_id?: string | null
          source_type?: string
          source_voice_id?: string | null
          unit?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_user?: boolean | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'dossier_field_values_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_field_values_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_field_values_source_document_id_fkey'
            columns: ['source_document_id']
            isOneToOne: false
            referencedRelation: 'owner_documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_field_values_source_text_id_fkey'
            columns: ['source_text_id']
            isOneToOne: false
            referencedRelation: 'mission_text_notes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_field_values_source_voice_id_fkey'
            columns: ['source_voice_id']
            isOneToOne: false
            referencedRelation: 'voice_notes'
            referencedColumns: ['id']
          },
        ]
      }
      dossier_historical_documents: {
        Row: {
          ai_extracted_data: Json | null
          ai_extraction_cost_eur: number | null
          ai_extraction_status: string | null
          category: string
          dossier_id: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          notes: string | null
          organization_id: string
          original_filename: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          ai_extracted_data?: Json | null
          ai_extraction_cost_eur?: number | null
          ai_extraction_status?: string | null
          category: string
          dossier_id: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          original_filename?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_extracted_data?: Json | null
          ai_extraction_cost_eur?: number | null
          ai_extraction_status?: string | null
          category?: string
          dossier_id?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          original_filename?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'dossier_historical_documents_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossier_historical_documents_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dossier_rooms: {
        Row: {
          ceiling_height_m: number | null
          created_at: string
          dossier_id: string
          has_heating: boolean | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          position: number | null
          room_type: string | null
          surface_m2: number | null
          updated_at: string
        }
        Insert: {
          ceiling_height_m?: number | null
          created_at?: string
          dossier_id: string
          has_heating?: boolean | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          position?: number | null
          room_type?: string | null
          surface_m2?: number | null
          updated_at?: string
        }
        Update: {
          ceiling_height_m?: number | null
          created_at?: string
          dossier_id?: string
          has_heating?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          position?: number | null
          room_type?: string | null
          surface_m2?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dossier_rooms_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_rooms_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dossiers: {
        Row: {
          actual_duration_min: number | null
          assigned_to: string | null
          client_id: string | null
          client_upload_expires_at: string | null
          client_upload_token: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          estimated_duration_min: number | null
          exported_count: number
          forced_duration_min: number | null
          geo_lat: number | null
          geo_lng: number | null
          has_combles_amenagees: boolean
          has_garage: boolean
          has_sous_sol: boolean
          id: string
          metadata: Json
          mission_started_at: string | null
          notes: string | null
          organization_id: string
          ownership: string | null
          property_id: string
          property_rooms: Json | null
          property_type_scheduling: string | null
          reference: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          actual_duration_min?: number | null
          assigned_to?: string | null
          client_id?: string | null
          client_upload_expires_at?: string | null
          client_upload_token?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          estimated_duration_min?: number | null
          exported_count?: number
          forced_duration_min?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          has_combles_amenagees?: boolean
          has_garage?: boolean
          has_sous_sol?: boolean
          id?: string
          metadata?: Json
          mission_started_at?: string | null
          notes?: string | null
          organization_id: string
          ownership?: string | null
          property_id: string
          property_rooms?: Json | null
          property_type_scheduling?: string | null
          reference: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          actual_duration_min?: number | null
          assigned_to?: string | null
          client_id?: string | null
          client_upload_expires_at?: string | null
          client_upload_token?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          estimated_duration_min?: number | null
          exported_count?: number
          forced_duration_min?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          has_combles_amenagees?: boolean
          has_garage?: boolean
          has_sous_sol?: boolean
          id?: string
          metadata?: Json
          mission_started_at?: string | null
          notes?: string | null
          organization_id?: string
          ownership?: string | null
          property_id?: string
          property_rooms?: Json | null
          property_type_scheduling?: string | null
          reference?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'dossiers_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossiers_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dossiers_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
        ]
      }
      dpe_historical_cache: {
        Row: {
          address_normalized: string
          ademe_number: string | null
          conso_kwh_m2_an: number | null
          diagnostic_date: string | null
          diagnostician_name: string | null
          energy_class: string | null
          expires_at: string
          fetched_at: string
          ges_class: string | null
          ges_kgco2_m2_an: number | null
          id: string
          insee_code: string | null
          postal_code: string | null
        }
        Insert: {
          address_normalized: string
          ademe_number?: string | null
          conso_kwh_m2_an?: number | null
          diagnostic_date?: string | null
          diagnostician_name?: string | null
          energy_class?: string | null
          expires_at?: string
          fetched_at?: string
          ges_class?: string | null
          ges_kgco2_m2_an?: number | null
          id?: string
          insee_code?: string | null
          postal_code?: string | null
        }
        Update: {
          address_normalized?: string
          ademe_number?: string | null
          conso_kwh_m2_an?: number | null
          diagnostic_date?: string | null
          diagnostician_name?: string | null
          energy_class?: string | null
          expires_at?: string
          fetched_at?: string
          ges_class?: string | null
          ges_kgco2_m2_an?: number | null
          id?: string
          insee_code?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      dpe_imports: {
        Row: {
          declared_at: string | null
          declared_class: string | null
          diagnostician_id: string | null
          energy_kwh: number | null
          external_ref: string | null
          ghg_kg: number | null
          heating_type: string | null
          id: string
          insulation_level: string | null
          organization_id: string | null
          property_address: string | null
          property_lat: number | null
          property_lng: number | null
          property_type: string | null
          raw_comments: string | null
          raw_payload: Json | null
          scanned_at: string
          source: string
          surface_m2: number | null
          year_built: number | null
        }
        Insert: {
          declared_at?: string | null
          declared_class?: string | null
          diagnostician_id?: string | null
          energy_kwh?: number | null
          external_ref?: string | null
          ghg_kg?: number | null
          heating_type?: string | null
          id?: string
          insulation_level?: string | null
          organization_id?: string | null
          property_address?: string | null
          property_lat?: number | null
          property_lng?: number | null
          property_type?: string | null
          raw_comments?: string | null
          raw_payload?: Json | null
          scanned_at?: string
          source: string
          surface_m2?: number | null
          year_built?: number | null
        }
        Update: {
          declared_at?: string | null
          declared_class?: string | null
          diagnostician_id?: string | null
          energy_kwh?: number | null
          external_ref?: string | null
          ghg_kg?: number | null
          heating_type?: string | null
          id?: string
          insulation_level?: string | null
          organization_id?: string | null
          property_address?: string | null
          property_lat?: number | null
          property_lng?: number | null
          property_type?: string | null
          raw_comments?: string | null
          raw_payload?: Json | null
          scanned_at?: string
          source?: string
          surface_m2?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'dpe_imports_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dpe_imports_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'dpe_imports_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dpe_imports_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dpe_imports_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dpe_imports_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dpe_quota_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          dpe_count: number
          id: string
          percent_used: number
          severity: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          dpe_count: number
          id?: string
          percent_used: number
          severity: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          dpe_count?: number
          id?: string
          percent_used?: number
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      dsar_requests: {
        Row: {
          completed_at: string | null
          completed_by_admin: string | null
          created_at: string
          deadline: string
          id: string
          notes: string | null
          organization_id: string | null
          requested_at: string
          status: Database['public']['Enums']['dsar_status']
          type: Database['public']['Enums']['dsar_type']
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_admin?: string | null
          created_at?: string
          deadline: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          requested_at?: string
          status?: Database['public']['Enums']['dsar_status']
          type: Database['public']['Enums']['dsar_type']
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by_admin?: string | null
          created_at?: string
          deadline?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          requested_at?: string
          status?: Database['public']['Enums']['dsar_status']
          type?: Database['public']['Enums']['dsar_type']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dsar_requests_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          email_type: string | null
          event_type: string
          id: string
          message_id: string | null
          payload: Json
          recipient: string
        }
        Insert: {
          created_at?: string
          email_type?: string | null
          event_type: string
          id?: string
          message_id?: string | null
          payload?: Json
          recipient: string
        }
        Update: {
          created_at?: string
          email_type?: string | null
          event_type?: string
          id?: string
          message_id?: string | null
          payload?: Json
          recipient?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          data: Json
          error: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject: string
          template: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          active: boolean
          body_html: string
          body_text: string | null
          created_at: string
          id: string
          key: string
          name: string
          subject: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          active?: boolean
          body_html: string
          body_text?: string | null
          created_at?: string
          id?: string
          key: string
          name: string
          subject: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          active?: boolean
          body_html?: string
          body_text?: string | null
          created_at?: string
          id?: string
          key?: string
          name?: string
          subject?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      equipment_findings: {
        Row: {
          ai_confidence: number | null
          ai_cost_eur: number | null
          ai_model: string | null
          ai_provider: string | null
          brand: string | null
          created_at: string
          details: Json | null
          dossier_id: string
          energy_class: string | null
          id: string
          kind: Database['public']['Enums']['equipment_kind']
          model: string | null
          organization_id: string
          photo_id: string | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          room_id: string | null
          year_install: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          brand?: string | null
          created_at?: string
          details?: Json | null
          dossier_id: string
          energy_class?: string | null
          id?: string
          kind: Database['public']['Enums']['equipment_kind']
          model?: string | null
          organization_id: string
          photo_id?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string | null
          year_install?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          brand?: string | null
          created_at?: string
          details?: Json | null
          dossier_id?: string
          energy_class?: string | null
          id?: string
          kind?: Database['public']['Enums']['equipment_kind']
          model?: string | null
          organization_id?: string
          photo_id?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string | null
          year_install?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'equipment_findings_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'equipment_findings_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'equipment_findings_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'dossier_rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_finding_photo'
            columns: ['photo_id', 'created_at']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['id', 'created_at']
          },
        ]
      }
      events: {
        Row: {
          actor_email: string | null
          actor_ip: unknown
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          organization_id: string | null
          payload: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_ip?: unknown
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_ip?: unknown
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_2026_05: {
        Row: {
          actor_email: string | null
          actor_ip: unknown
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          organization_id: string | null
          payload: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_ip?: unknown
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_ip?: unknown
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_2026_06: {
        Row: {
          actor_email: string | null
          actor_ip: unknown
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          organization_id: string | null
          payload: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_ip?: unknown
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_ip?: unknown
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fair_use_alerts: {
        Row: {
          cap_threshold: number
          consecutive_months_over: number
          created_at: string
          email_sent_at: string | null
          id: string
          missions_count: number
          month_iso: string
          organization_id: string
        }
        Insert: {
          cap_threshold: number
          consecutive_months_over?: number
          created_at?: string
          email_sent_at?: string | null
          id?: string
          missions_count: number
          month_iso: string
          organization_id: string
        }
        Update: {
          cap_threshold?: number
          consecutive_months_over?: number
          created_at?: string
          email_sent_at?: string | null
          id?: string
          missions_count?: number
          month_iso?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fair_use_alerts_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          channel: string
          context: Json
          created_at: string
          current_step: number
          id: string
          last_action_at: string | null
          last_action_result: string | null
          next_action_at: string | null
          organization_id: string
          sequence_template: string
          status: string
          target_entity_id: string
          target_entity_type: string
          total_steps: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          context?: Json
          created_at?: string
          current_step?: number
          id?: string
          last_action_at?: string | null
          last_action_result?: string | null
          next_action_at?: string | null
          organization_id: string
          sequence_template: string
          status?: string
          target_entity_id: string
          target_entity_type: string
          total_steps?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          context?: Json
          created_at?: string
          current_step?: number
          id?: string
          last_action_at?: string | null
          last_action_result?: string | null
          next_action_at?: string | null
          organization_id?: string
          sequence_template?: string
          status?: string
          target_entity_id?: string
          target_entity_type?: string
          total_steps?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'follow_up_sequences_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'follow_up_sequences_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      fraud_signals: {
        Row: {
          details: Json
          detected_at: string
          diagnostic_scan_id: string | null
          id: string
          mission_id: string | null
          pattern: string
          review_notes: string | null
          review_outcome: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: number
        }
        Insert: {
          details?: Json
          detected_at?: string
          diagnostic_scan_id?: string | null
          id?: string
          mission_id?: string | null
          pattern: string
          review_notes?: string | null
          review_outcome?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: number
        }
        Update: {
          details?: Json
          detected_at?: string
          diagnostic_scan_id?: string | null
          id?: string
          mission_id?: string | null
          pattern?: string
          review_notes?: string | null
          review_outcome?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: number
        }
        Relationships: [
          {
            foreignKeyName: 'fraud_signals_diagnostic_scan_id_fkey'
            columns: ['diagnostic_scan_id']
            isOneToOne: false
            referencedRelation: 'dpe_imports'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fraud_signals_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fraud_signals_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      geocoding_cache: {
        Row: {
          address_normalized: string
          city: string | null
          confidence: number | null
          country: string | null
          created_at: string
          geo_lat: number
          geo_lng: number
          hit_count: number
          id: string
          last_used_at: string
          postal_code: string | null
          provider: string | null
          raw_address: string
        }
        Insert: {
          address_normalized: string
          city?: string | null
          confidence?: number | null
          country?: string | null
          created_at?: string
          geo_lat: number
          geo_lng: number
          hit_count?: number
          id?: string
          last_used_at?: string
          postal_code?: string | null
          provider?: string | null
          raw_address: string
        }
        Update: {
          address_normalized?: string
          city?: string | null
          confidence?: number | null
          country?: string | null
          created_at?: string
          geo_lat?: number
          geo_lng?: number
          hit_count?: number
          id?: string
          last_used_at?: string
          postal_code?: string | null
          provider?: string | null
          raw_address?: string
        }
        Relationships: []
      }
      import_dedupe_matches: {
        Row: {
          confidence_score: number
          created_at: string
          entity_type: string
          existing_entity_id: string
          field_choices: Json | null
          id: string
          job_id: string
          match_reasons: Json
          organization_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          staging_entity_id: string
        }
        Insert: {
          confidence_score: number
          created_at?: string
          entity_type: string
          existing_entity_id: string
          field_choices?: Json | null
          id?: string
          job_id: string
          match_reasons: Json
          organization_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          staging_entity_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          entity_type?: string
          existing_entity_id?: string
          field_choices?: Json | null
          id?: string
          job_id?: string
          match_reasons?: Json
          organization_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          staging_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'import_dedupe_matches_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'import_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_dedupe_matches_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      import_jobs: {
        Row: {
          committed_at: string | null
          created_at: string
          created_by: string
          dedupe_completed_at: string | null
          detected_clients_count: number
          detected_coproprietes_count: number
          detected_diagnostics_count: number
          detected_lots_count: number
          detected_properties_count: number
          duplicates_clients_count: number
          duplicates_coproprietes_count: number
          duplicates_properties_count: number
          error_details: Json | null
          error_message: string | null
          expires_at: string
          id: string
          imported_clients_count: number
          imported_coproprietes_count: number
          imported_lots_count: number
          imported_properties_count: number
          organization_id: string
          parsing_completed_at: string | null
          parsing_started_at: string | null
          processing_log: Json
          source_filename: string
          source_filesize_bytes: number
          source_format: string | null
          source_logiciel: string
          source_mime_type: string
          source_storage_path: string
          status: string
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          created_by: string
          dedupe_completed_at?: string | null
          detected_clients_count?: number
          detected_coproprietes_count?: number
          detected_diagnostics_count?: number
          detected_lots_count?: number
          detected_properties_count?: number
          duplicates_clients_count?: number
          duplicates_coproprietes_count?: number
          duplicates_properties_count?: number
          error_details?: Json | null
          error_message?: string | null
          expires_at?: string
          id?: string
          imported_clients_count?: number
          imported_coproprietes_count?: number
          imported_lots_count?: number
          imported_properties_count?: number
          organization_id: string
          parsing_completed_at?: string | null
          parsing_started_at?: string | null
          processing_log?: Json
          source_filename: string
          source_filesize_bytes: number
          source_format?: string | null
          source_logiciel?: string
          source_mime_type: string
          source_storage_path: string
          status?: string
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          created_by?: string
          dedupe_completed_at?: string | null
          detected_clients_count?: number
          detected_coproprietes_count?: number
          detected_diagnostics_count?: number
          detected_lots_count?: number
          detected_properties_count?: number
          duplicates_clients_count?: number
          duplicates_coproprietes_count?: number
          duplicates_properties_count?: number
          error_details?: Json | null
          error_message?: string | null
          expires_at?: string
          id?: string
          imported_clients_count?: number
          imported_coproprietes_count?: number
          imported_lots_count?: number
          imported_properties_count?: number
          organization_id?: string
          parsing_completed_at?: string | null
          parsing_started_at?: string | null
          processing_log?: Json
          source_filename?: string
          source_filesize_bytes?: number
          source_format?: string | null
          source_logiciel?: string
          source_mime_type?: string
          source_storage_path?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'import_jobs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      import_staging_clients: {
        Row: {
          address: string | null
          address_complement: string | null
          apartment_detail: string | null
          ban_id: string | null
          building_letter: string | null
          city: string | null
          company_name: string | null
          confidence_score: number | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          floor_number: number | null
          geocoded_lat: number | null
          geocoded_lng: number | null
          id: string
          insee_data: Json | null
          job_id: string
          last_name: string | null
          merged_into_client_id: string | null
          normalization_warnings: Json
          notes: string | null
          organization_id: string
          phone: string | null
          phone_mobile: string | null
          postal_code: string | null
          raw_data: Json
          siret: string | null
          status: string
          type: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          apartment_detail?: string | null
          ban_id?: string | null
          building_letter?: string | null
          city?: string | null
          company_name?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          floor_number?: number | null
          geocoded_lat?: number | null
          geocoded_lng?: number | null
          id?: string
          insee_data?: Json | null
          job_id: string
          last_name?: string | null
          merged_into_client_id?: string | null
          normalization_warnings?: Json
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_mobile?: string | null
          postal_code?: string | null
          raw_data: Json
          siret?: string | null
          status?: string
          type?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          apartment_detail?: string | null
          ban_id?: string | null
          building_letter?: string | null
          city?: string | null
          company_name?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          floor_number?: number | null
          geocoded_lat?: number | null
          geocoded_lng?: number | null
          id?: string
          insee_data?: Json | null
          job_id?: string
          last_name?: string | null
          merged_into_client_id?: string | null
          normalization_warnings?: Json
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_mobile?: string | null
          postal_code?: string | null
          raw_data?: Json
          siret?: string | null
          status?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'import_staging_clients_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'import_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_clients_merged_into_client_id_fkey'
            columns: ['merged_into_client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_clients_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      import_staging_coproprietes: {
        Row: {
          address: string | null
          ban_id: string | null
          city: string | null
          confidence_score: number | null
          created_at: string
          geocoded_lat: number | null
          geocoded_lng: number | null
          id: string
          insee_code: string | null
          job_id: string
          lots_count: number | null
          merged_into_copropriete_id: string | null
          name: string | null
          normalization_warnings: Json
          organization_id: string
          postal_code: string | null
          raw_data: Json
          rnic_number: string | null
          staging_syndic_id: string | null
          status: string
          year_built: number | null
        }
        Insert: {
          address?: string | null
          ban_id?: string | null
          city?: string | null
          confidence_score?: number | null
          created_at?: string
          geocoded_lat?: number | null
          geocoded_lng?: number | null
          id?: string
          insee_code?: string | null
          job_id: string
          lots_count?: number | null
          merged_into_copropriete_id?: string | null
          name?: string | null
          normalization_warnings?: Json
          organization_id: string
          postal_code?: string | null
          raw_data: Json
          rnic_number?: string | null
          staging_syndic_id?: string | null
          status?: string
          year_built?: number | null
        }
        Update: {
          address?: string | null
          ban_id?: string | null
          city?: string | null
          confidence_score?: number | null
          created_at?: string
          geocoded_lat?: number | null
          geocoded_lng?: number | null
          id?: string
          insee_code?: string | null
          job_id?: string
          lots_count?: number | null
          merged_into_copropriete_id?: string | null
          name?: string | null
          normalization_warnings?: Json
          organization_id?: string
          postal_code?: string | null
          raw_data?: Json
          rnic_number?: string | null
          staging_syndic_id?: string | null
          status?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'import_staging_coproprietes_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'import_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_coproprietes_merged_into_copropriete_id_fkey'
            columns: ['merged_into_copropriete_id']
            isOneToOne: false
            referencedRelation: 'coproprietes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_coproprietes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_coproprietes_staging_syndic_id_fkey'
            columns: ['staging_syndic_id']
            isOneToOne: false
            referencedRelation: 'import_staging_clients'
            referencedColumns: ['id']
          },
        ]
      }
      import_staging_lots: {
        Row: {
          building_letter: string | null
          created_at: string
          description: string | null
          door_number: string | null
          floor_number: number | null
          id: string
          job_id: string
          lot_number: string | null
          merged_into_lot_id: string | null
          organization_id: string
          raw_data: Json
          staging_copropriete_id: string | null
          staging_property_id: string | null
          status: string
          tantiemes_generaux: number | null
        }
        Insert: {
          building_letter?: string | null
          created_at?: string
          description?: string | null
          door_number?: string | null
          floor_number?: number | null
          id?: string
          job_id: string
          lot_number?: string | null
          merged_into_lot_id?: string | null
          organization_id: string
          raw_data: Json
          staging_copropriete_id?: string | null
          staging_property_id?: string | null
          status?: string
          tantiemes_generaux?: number | null
        }
        Update: {
          building_letter?: string | null
          created_at?: string
          description?: string | null
          door_number?: string | null
          floor_number?: number | null
          id?: string
          job_id?: string
          lot_number?: string | null
          merged_into_lot_id?: string | null
          organization_id?: string
          raw_data?: Json
          staging_copropriete_id?: string | null
          staging_property_id?: string | null
          status?: string
          tantiemes_generaux?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'import_staging_lots_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'import_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_lots_merged_into_lot_id_fkey'
            columns: ['merged_into_lot_id']
            isOneToOne: false
            referencedRelation: 'property_lots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_lots_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_lots_staging_copropriete_id_fkey'
            columns: ['staging_copropriete_id']
            isOneToOne: false
            referencedRelation: 'import_staging_coproprietes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_lots_staging_property_id_fkey'
            columns: ['staging_property_id']
            isOneToOne: false
            referencedRelation: 'import_staging_properties'
            referencedColumns: ['id']
          },
        ]
      }
      import_staging_properties: {
        Row: {
          address: string | null
          apartment_detail: string | null
          ban_id: string | null
          bdnb_data: Json | null
          building_letter: string | null
          cadastre_numero: string | null
          cadastre_section: string | null
          city: string | null
          confidence_score: number | null
          country: string | null
          created_at: string
          floor_number: number | null
          floors_count: number | null
          geocoded_lat: number | null
          geocoded_lng: number | null
          id: string
          insee_code: string | null
          job_id: string
          lot_number: string | null
          merged_into_property_id: string | null
          normalization_warnings: Json
          organization_id: string
          postal_code: string | null
          property_type: string | null
          raw_data: Json
          rooms_count: number | null
          staging_copropriete_id: string | null
          staging_owner_client_id: string | null
          status: string
          street_view_url: string | null
          surface_boutin: number | null
          surface_carrez: number | null
          surface_total: number | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          apartment_detail?: string | null
          ban_id?: string | null
          bdnb_data?: Json | null
          building_letter?: string | null
          cadastre_numero?: string | null
          cadastre_section?: string | null
          city?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          floor_number?: number | null
          floors_count?: number | null
          geocoded_lat?: number | null
          geocoded_lng?: number | null
          id?: string
          insee_code?: string | null
          job_id: string
          lot_number?: string | null
          merged_into_property_id?: string | null
          normalization_warnings?: Json
          organization_id: string
          postal_code?: string | null
          property_type?: string | null
          raw_data: Json
          rooms_count?: number | null
          staging_copropriete_id?: string | null
          staging_owner_client_id?: string | null
          status?: string
          street_view_url?: string | null
          surface_boutin?: number | null
          surface_carrez?: number | null
          surface_total?: number | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          apartment_detail?: string | null
          ban_id?: string | null
          bdnb_data?: Json | null
          building_letter?: string | null
          cadastre_numero?: string | null
          cadastre_section?: string | null
          city?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          floor_number?: number | null
          floors_count?: number | null
          geocoded_lat?: number | null
          geocoded_lng?: number | null
          id?: string
          insee_code?: string | null
          job_id?: string
          lot_number?: string | null
          merged_into_property_id?: string | null
          normalization_warnings?: Json
          organization_id?: string
          postal_code?: string | null
          property_type?: string | null
          raw_data?: Json
          rooms_count?: number | null
          staging_copropriete_id?: string | null
          staging_owner_client_id?: string | null
          status?: string
          street_view_url?: string | null
          surface_boutin?: number | null
          surface_carrez?: number | null
          surface_total?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_staging_properties_copro'
            columns: ['staging_copropriete_id']
            isOneToOne: false
            referencedRelation: 'import_staging_coproprietes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_properties_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'import_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_properties_merged_into_property_id_fkey'
            columns: ['merged_into_property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_properties_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_staging_properties_staging_owner_client_id_fkey'
            columns: ['staging_owner_client_id']
            isOneToOne: false
            referencedRelation: 'import_staging_clients'
            referencedColumns: ['id']
          },
        ]
      }
      incidents: {
        Row: {
          active: boolean
          id: string
          message: string
          resolution_notes: string | null
          resolved_at: string | null
          root_cause: string | null
          severity: string
          started_at: string
        }
        Insert: {
          active?: boolean
          id?: string
          message: string
          resolution_notes?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: string
          started_at?: string
        }
        Update: {
          active?: boolean
          id?: string
          message?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          severity?: string
          started_at?: string
        }
        Relationships: []
      }
      invoice_sequences: {
        Row: {
          kind: string
          next_seq: number
          organization_id: string
          updated_at: string
          year: number
        }
        Insert: {
          kind: string
          next_seq?: number
          organization_id: string
          updated_at?: string
          year: number
        }
        Update: {
          kind?: string
          next_seq?: number
          organization_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_sequences_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          amount_ht: number
          amount_ttc: number
          amount_tva: number
          archived_at: string | null
          client_id: string | null
          client_snapshot: Json | null
          contact_id: string | null
          created_at: string
          credit_note_for_invoice_id: string | null
          deleted_at: string | null
          dossier_id: string | null
          due_date: string | null
          facturx_profile: string | null
          facturx_xml: string | null
          id: string
          indy_invoice_id: string | null
          indy_synced_at: string | null
          issued_at: string | null
          line_items: Json
          mission_id: string | null
          notes: string | null
          organization_id: string
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_terms_days: number
          pdf_path: string | null
          pennylane_customer_id: string | null
          pennylane_invoice_id: string | null
          pennylane_public_url: string | null
          pennylane_synced_at: string | null
          ppf_status: string | null
          ppf_transmission_id: string | null
          qonto_invoice_id: string | null
          qonto_synced_at: string | null
          quote_id: string | null
          reference: string
          reminder_j15_sent_at: string | null
          reminder_j30_sent_at: string | null
          reminder_j7_sent_at: string | null
          sent_at: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_payment_link_url: string | null
          tiime_invoice_id: string | null
          tiime_synced_at: string | null
          tva_rate: number | null
          updated_at: string
          user_id: string | null
          xml_path: string | null
        }
        Insert: {
          amount_ht: number
          amount_ttc: number
          amount_tva: number
          archived_at?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          contact_id?: string | null
          created_at?: string
          credit_note_for_invoice_id?: string | null
          deleted_at?: string | null
          dossier_id?: string | null
          due_date?: string | null
          facturx_profile?: string | null
          facturx_xml?: string | null
          id?: string
          indy_invoice_id?: string | null
          indy_synced_at?: string | null
          issued_at?: string | null
          line_items?: Json
          mission_id?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_terms_days?: number
          pdf_path?: string | null
          pennylane_customer_id?: string | null
          pennylane_invoice_id?: string | null
          pennylane_public_url?: string | null
          pennylane_synced_at?: string | null
          ppf_status?: string | null
          ppf_transmission_id?: string | null
          qonto_invoice_id?: string | null
          qonto_synced_at?: string | null
          quote_id?: string | null
          reference: string
          reminder_j15_sent_at?: string | null
          reminder_j30_sent_at?: string | null
          reminder_j7_sent_at?: string | null
          sent_at?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_payment_link_url?: string | null
          tiime_invoice_id?: string | null
          tiime_synced_at?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string | null
          xml_path?: string | null
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number
          amount_tva?: number
          archived_at?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          contact_id?: string | null
          created_at?: string
          credit_note_for_invoice_id?: string | null
          deleted_at?: string | null
          dossier_id?: string | null
          due_date?: string | null
          facturx_profile?: string | null
          facturx_xml?: string | null
          id?: string
          indy_invoice_id?: string | null
          indy_synced_at?: string | null
          issued_at?: string | null
          line_items?: Json
          mission_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_terms_days?: number
          pdf_path?: string | null
          pennylane_customer_id?: string | null
          pennylane_invoice_id?: string | null
          pennylane_public_url?: string | null
          pennylane_synced_at?: string | null
          ppf_status?: string | null
          ppf_transmission_id?: string | null
          qonto_invoice_id?: string | null
          qonto_synced_at?: string | null
          quote_id?: string | null
          reference?: string
          reminder_j15_sent_at?: string | null
          reminder_j30_sent_at?: string | null
          reminder_j7_sent_at?: string | null
          sent_at?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_payment_link_url?: string | null
          tiime_invoice_id?: string | null
          tiime_synced_at?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string | null
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_credit_note_for_invoice_id_fkey'
            columns: ['credit_note_for_invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_credit_note_for_invoice_id_fkey'
            columns: ['credit_note_for_invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices_active'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          max_attempts: number | null
          organization_id: string | null
          payload: Json
          result: Json | null
          scheduled_for: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          max_attempts?: number | null
          organization_id?: string | null
          payload?: Json
          result?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          max_attempts?: number | null
          organization_id?: string | null
          payload?: Json
          result?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      launch_offer_subscriptions: {
        Row: {
          annual_commitment: boolean
          created_at: string
          discount_ends_at: string
          discount_percentage: number
          discount_starts_at: string
          discounted_monthly_price_cents: number
          id: string
          organization_id: string
          original_monthly_price_cents: number
          position_number: number
          stripe_coupon_id: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          annual_commitment?: boolean
          created_at?: string
          discount_ends_at: string
          discount_percentage?: number
          discount_starts_at: string
          discounted_monthly_price_cents: number
          id?: string
          organization_id: string
          original_monthly_price_cents: number
          position_number: number
          stripe_coupon_id?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          annual_commitment?: boolean
          created_at?: string
          discount_ends_at?: string
          discount_percentage?: number
          discount_starts_at?: string
          discounted_monthly_price_cents?: number
          id?: string
          organization_id?: string
          original_monthly_price_cents?: number
          position_number?: number
          stripe_coupon_id?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'launch_offer_subscriptions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'launch_offer_subscriptions_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      lead_assignments: {
        Row: {
          assignment_type: string
          created_at: string
          decline_reason: string | null
          diagnostician_id: string
          distance_km: number | null
          expires_at: string
          id: string
          lead_id: string
          notification_method: string | null
          notified_at: string
          responded_at: string | null
          score: number | null
          status: string
        }
        Insert: {
          assignment_type: string
          created_at?: string
          decline_reason?: string | null
          diagnostician_id: string
          distance_km?: number | null
          expires_at?: string
          id?: string
          lead_id: string
          notification_method?: string | null
          notified_at?: string
          responded_at?: string | null
          score?: number | null
          status?: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          decline_reason?: string | null
          diagnostician_id?: string
          distance_km?: number | null
          expires_at?: string
          id?: string
          lead_id?: string
          notification_method?: string | null
          notified_at?: string
          responded_at?: string | null
          score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_assignments_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_assignments_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'lead_assignments_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_assignments_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_assignments_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_assignments_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_assignments_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'quote_requests'
            referencedColumns: ['id']
          },
        ]
      }
      litigation_workflows: {
        Row: {
          claim_amount_cents: number | null
          created_at: string
          currency: string
          current_step: string | null
          defense_dossier_id: string | null
          documents: Json
          id: string
          litigation_kind: string
          metadata: Json
          mission_id: string | null
          next_action: string | null
          next_action_due_at: string | null
          notes: string | null
          opened_at: string
          organization_id: string
          parties: Json
          reference: string | null
          resolution_outcome: string | null
          resolved_at: string | null
          settlement_cents: number | null
          severity: string
          status: string
          timeline: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          claim_amount_cents?: number | null
          created_at?: string
          currency?: string
          current_step?: string | null
          defense_dossier_id?: string | null
          documents?: Json
          id?: string
          litigation_kind: string
          metadata?: Json
          mission_id?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          opened_at?: string
          organization_id: string
          parties?: Json
          reference?: string | null
          resolution_outcome?: string | null
          resolved_at?: string | null
          settlement_cents?: number | null
          severity?: string
          status?: string
          timeline?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          claim_amount_cents?: number | null
          created_at?: string
          currency?: string
          current_step?: string | null
          defense_dossier_id?: string | null
          documents?: Json
          id?: string
          litigation_kind?: string
          metadata?: Json
          mission_id?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          notes?: string | null
          opened_at?: string
          organization_id?: string
          parties?: Json
          reference?: string | null
          resolution_outcome?: string | null
          resolved_at?: string | null
          settlement_cents?: number | null
          severity?: string
          status?: string
          timeline?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'litigation_workflows_defense_dossier_id_fkey'
            columns: ['defense_dossier_id']
            isOneToOne: false
            referencedRelation: 'defense_dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'litigation_workflows_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'litigation_workflows_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          organization_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          organization_id: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          organization_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      migration_runs: {
        Row: {
          affected_rows: number | null
          id: string
          metadata: Json
          name: string
          ran_at: string
        }
        Insert: {
          affected_rows?: number | null
          id?: string
          metadata?: Json
          name: string
          ran_at?: string
        }
        Update: {
          affected_rows?: number | null
          id?: string
          metadata?: Json
          name?: string
          ran_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          achieved: boolean
          achieved_at: string | null
          category: string
          created_at: string
          created_by: string | null
          current_value: number | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          target_value: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          achieved?: boolean
          achieved_at?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          target_value: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          achieved?: boolean
          achieved_at?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          target_value?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mission_chat_messages: {
        Row: {
          content: string
          content_markdown: string | null
          created_at: string
          id: string
          metadata: Json | null
          model: string | null
          role: string
          session_id: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: string
          content_markdown?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          role: string
          session_id: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string
          content_markdown?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          role?: string
          session_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'mission_chat_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'mission_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      mission_duration_history: {
        Row: {
          actual_duration_min: number | null
          completed_at: string | null
          created_at: string
          diff_min: number | null
          dossier_id: string
          estimated_duration_min: number
          estimation_factors: Json | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          actual_duration_min?: number | null
          completed_at?: string | null
          created_at?: string
          diff_min?: number | null
          dossier_id: string
          estimated_duration_min: number
          estimation_factors?: Json | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          actual_duration_min?: number | null
          completed_at?: string | null
          created_at?: string
          diff_min?: number | null
          dossier_id?: string
          estimated_duration_min?: number
          estimation_factors?: Json | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mission_duration_history_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_duration_history_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      mission_photos: {
        Row: {
          ai_analyzed: boolean
          ai_extracted_data: Json | null
          created_at: string
          dossier_id: string
          id: string
          metadata: Json
          mission_session_id: string
          room_id: string | null
          storage_bucket: string
          storage_path: string
          thumbnail_base64: string | null
        }
        Insert: {
          ai_analyzed?: boolean
          ai_extracted_data?: Json | null
          created_at?: string
          dossier_id: string
          id?: string
          metadata?: Json
          mission_session_id: string
          room_id?: string | null
          storage_bucket?: string
          storage_path: string
          thumbnail_base64?: string | null
        }
        Update: {
          ai_analyzed?: boolean
          ai_extracted_data?: Json | null
          created_at?: string
          dossier_id?: string
          id?: string
          metadata?: Json
          mission_session_id?: string
          room_id?: string | null
          storage_bucket?: string
          storage_path?: string
          thumbnail_base64?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'mission_photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_photos_mission_session_id_fkey'
            columns: ['mission_session_id']
            isOneToOne: false
            referencedRelation: 'mission_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      mission_pricing_snapshots: {
        Row: {
          applied_pack_id: string | null
          applied_pack_price_ht: number | null
          dossier_id: string
          estimated_at: string
          id: string
          itemized_subtotal_ht: number | null
          majorations_details: Json | null
          majorations_ht: number
          organization_id: string
          status: string
          status_updated_at: string | null
          total_ht: number
          total_ttc: number
          travel_distance_km: number | null
          travel_fees_ht: number
          user_id: string
          vat_amount: number
        }
        Insert: {
          applied_pack_id?: string | null
          applied_pack_price_ht?: number | null
          dossier_id: string
          estimated_at?: string
          id?: string
          itemized_subtotal_ht?: number | null
          majorations_details?: Json | null
          majorations_ht?: number
          organization_id: string
          status?: string
          status_updated_at?: string | null
          total_ht: number
          total_ttc: number
          travel_distance_km?: number | null
          travel_fees_ht?: number
          user_id: string
          vat_amount?: number
        }
        Update: {
          applied_pack_id?: string | null
          applied_pack_price_ht?: number | null
          dossier_id?: string
          estimated_at?: string
          id?: string
          itemized_subtotal_ht?: number | null
          majorations_details?: Json | null
          majorations_ht?: number
          organization_id?: string
          status?: string
          status_updated_at?: string | null
          total_ht?: number
          total_ttc?: number
          travel_distance_km?: number | null
          travel_fees_ht?: number
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: 'mission_pricing_snapshots_applied_pack_id_fkey'
            columns: ['applied_pack_id']
            isOneToOne: false
            referencedRelation: 'user_pricing_packs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_pricing_snapshots_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_pricing_snapshots_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      mission_rooms_3cl_data: {
        Row: {
          ai_confidence_score: number | null
          ceiling_height_m: number | null
          created_at: string
          data_3cl: Json
          id: string
          mission_session_id: string
          organization_id: string
          orientation: string | null
          room_name: string
          room_type: string
          source: string
          surface_sqm: number | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_by_user: boolean
        }
        Insert: {
          ai_confidence_score?: number | null
          ceiling_height_m?: number | null
          created_at?: string
          data_3cl?: Json
          id?: string
          mission_session_id: string
          organization_id: string
          orientation?: string | null
          room_name: string
          room_type: string
          source?: string
          surface_sqm?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_user?: boolean
        }
        Update: {
          ai_confidence_score?: number | null
          ceiling_height_m?: number | null
          created_at?: string
          data_3cl?: Json
          id?: string
          mission_session_id?: string
          organization_id?: string
          orientation?: string | null
          room_name?: string
          room_type?: string
          source?: string
          surface_sqm?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'mission_rooms_3cl_data_mission_session_id_fkey'
            columns: ['mission_session_id']
            isOneToOne: false
            referencedRelation: 'mission_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_rooms_3cl_data_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      mission_session_captures: {
        Row: {
          capture_type: string
          created_at: string
          data: Json
          id: string
          session_id: string
          source_message_id: string | null
        }
        Insert: {
          capture_type: string
          created_at?: string
          data: Json
          id?: string
          session_id: string
          source_message_id?: string | null
        }
        Update: {
          capture_type?: string
          created_at?: string
          data?: Json
          id?: string
          session_id?: string
          source_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'mission_session_captures_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'mission_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_session_captures_source_message_id_fkey'
            columns: ['source_message_id']
            isOneToOne: false
            referencedRelation: 'mission_chat_messages'
            referencedColumns: ['id']
          },
        ]
      }
      mission_sessions: {
        Row: {
          captured_data: Json
          created_at: string
          created_by: string | null
          current_room_id: string | null
          device_info: Json | null
          dossier_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          last_sync_attempt: string | null
          organization_id: string
          paused_at: string | null
          payload_processed: boolean
          started_at: string
          sync_attempts_count: number
          sync_completed_at: string | null
          sync_error: string | null
          sync_status: string | null
        }
        Insert: {
          captured_data?: Json
          created_at?: string
          created_by?: string | null
          current_room_id?: string | null
          device_info?: Json | null
          dossier_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          last_sync_attempt?: string | null
          organization_id: string
          paused_at?: string | null
          payload_processed?: boolean
          started_at: string
          sync_attempts_count?: number
          sync_completed_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
        }
        Update: {
          captured_data?: Json
          created_at?: string
          created_by?: string | null
          current_room_id?: string | null
          device_info?: Json | null
          dossier_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          last_sync_attempt?: string | null
          organization_id?: string
          paused_at?: string | null
          payload_processed?: boolean
          started_at?: string
          sync_attempts_count?: number
          sync_completed_at?: string | null
          sync_error?: string | null
          sync_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'mission_sessions_current_room_id_fkey'
            columns: ['current_room_id']
            isOneToOne: false
            referencedRelation: 'dossier_rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_sessions_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_sessions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      mission_text_notes: {
        Row: {
          attached_photo_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dossier_id: string
          id: string
          organization_id: string
          room_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          attached_photo_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dossier_id: string
          id?: string
          organization_id: string
          room_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          attached_photo_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dossier_id?: string
          id?: string
          organization_id?: string
          room_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mission_text_notes_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_text_notes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mission_text_notes_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'dossier_rooms'
            referencedColumns: ['id']
          },
        ]
      }
      missions: {
        Row: {
          ai_cost_eur: number | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dossier_id: string
          dpe_letter: string | null
          energy_value: number | null
          equipment_findings_count: number | null
          exported_at: string | null
          ges_letter: string | null
          ges_value: number | null
          id: string
          liciel_export_hash: string | null
          liciel_export_path: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          photos_count: number | null
          priority: number | null
          reference: string
          status: Database['public']['Enums']['mission_status']
          type: Database['public']['Enums']['mission_type']
          updated_at: string
          voice_seconds_total: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dossier_id: string
          dpe_letter?: string | null
          energy_value?: number | null
          equipment_findings_count?: number | null
          exported_at?: string | null
          ges_letter?: string | null
          ges_value?: number | null
          id?: string
          liciel_export_hash?: string | null
          liciel_export_path?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          photos_count?: number | null
          priority?: number | null
          reference: string
          status?: Database['public']['Enums']['mission_status']
          type: Database['public']['Enums']['mission_type']
          updated_at?: string
          voice_seconds_total?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dossier_id?: string
          dpe_letter?: string | null
          energy_value?: number | null
          equipment_findings_count?: number | null
          exported_at?: string | null
          ges_letter?: string | null
          ges_value?: number | null
          id?: string
          liciel_export_hash?: string | null
          liciel_export_path?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          photos_count?: number | null
          priority?: number | null
          reference?: string
          status?: Database['public']['Enums']['mission_status']
          type?: Database['public']['Enums']['mission_type']
          updated_at?: string
          voice_seconds_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'missions_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'missions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ml_models: {
        Row: {
          artifact_hash: string | null
          artifact_path: string | null
          base_model: string | null
          code: string
          config: Json
          created_at: string
          deployed_at: string | null
          framework: string | null
          id: string
          metadata: Json
          metrics: Json
          model_kind: string
          name: string
          notes: string | null
          retired_at: string | null
          status: string
          target_field: string | null
          target_table: string | null
          trained_at: string | null
          trained_by: string | null
          training_dataset_ref: string | null
          updated_at: string
          version: string
        }
        Insert: {
          artifact_hash?: string | null
          artifact_path?: string | null
          base_model?: string | null
          code: string
          config?: Json
          created_at?: string
          deployed_at?: string | null
          framework?: string | null
          id?: string
          metadata?: Json
          metrics?: Json
          model_kind: string
          name: string
          notes?: string | null
          retired_at?: string | null
          status?: string
          target_field?: string | null
          target_table?: string | null
          trained_at?: string | null
          trained_by?: string | null
          training_dataset_ref?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          artifact_hash?: string | null
          artifact_path?: string | null
          base_model?: string | null
          code?: string
          config?: Json
          created_at?: string
          deployed_at?: string | null
          framework?: string | null
          id?: string
          metadata?: Json
          metrics?: Json
          model_kind?: string
          name?: string
          notes?: string | null
          retired_at?: string | null
          status?: string
          target_field?: string | null
          target_table?: string | null
          trained_at?: string | null
          trained_by?: string | null
          training_dataset_ref?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      module_trials: {
        Row: {
          converted_to_addon_id: string | null
          created_at: string
          first_payment_amount_cents: number | null
          first_payment_at: string | null
          id: string
          module_id: string
          organization_id: string
          reminder_j_minus_2_sent_at: string | null
          reminder_j_minus_5_sent_at: string | null
          reminder_j1_sent_at: string | null
          status: string
          subscription_id: string
          trial_duration_days: number
          trial_ends_at: string
          trial_started_at: string
          user_cancel_reason: string | null
          user_decision: string | null
          user_decision_at: string | null
          user_id: string
        }
        Insert: {
          converted_to_addon_id?: string | null
          created_at?: string
          first_payment_amount_cents?: number | null
          first_payment_at?: string | null
          id?: string
          module_id: string
          organization_id: string
          reminder_j_minus_2_sent_at?: string | null
          reminder_j_minus_5_sent_at?: string | null
          reminder_j1_sent_at?: string | null
          status?: string
          subscription_id: string
          trial_duration_days?: number
          trial_ends_at: string
          trial_started_at?: string
          user_cancel_reason?: string | null
          user_decision?: string | null
          user_decision_at?: string | null
          user_id: string
        }
        Update: {
          converted_to_addon_id?: string | null
          created_at?: string
          first_payment_amount_cents?: number | null
          first_payment_at?: string | null
          id?: string
          module_id?: string
          organization_id?: string
          reminder_j_minus_2_sent_at?: string | null
          reminder_j_minus_5_sent_at?: string | null
          reminder_j1_sent_at?: string | null
          status?: string
          subscription_id?: string
          trial_duration_days?: number
          trial_ends_at?: string
          trial_started_at?: string
          user_cancel_reason?: string | null
          user_decision?: string | null
          user_decision_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'module_trials_converted_to_addon_id_fkey'
            columns: ['converted_to_addon_id']
            isOneToOne: false
            referencedRelation: 'user_addons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'module_trials_module_id_fkey'
            columns: ['module_id']
            isOneToOne: false
            referencedRelation: 'addon_modules'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'module_trials_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'module_trials_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      observatoire_live_stats: {
        Row: {
          created_at: string
          diagnostics_count: number
          dpe_distribution: Json
          fg_rate_pct: number | null
          generated_at: string
          id: string
          median_delivery_days: number | null
          median_price_eur: number | null
          period_month: number
          period_year: number
          region_code: string | null
          source_notes: string | null
          top_transition_cities: Json
          transactions_count: number
        }
        Insert: {
          created_at?: string
          diagnostics_count?: number
          dpe_distribution?: Json
          fg_rate_pct?: number | null
          generated_at?: string
          id?: string
          median_delivery_days?: number | null
          median_price_eur?: number | null
          period_month: number
          period_year: number
          region_code?: string | null
          source_notes?: string | null
          top_transition_cities?: Json
          transactions_count?: number
        }
        Update: {
          created_at?: string
          diagnostics_count?: number
          dpe_distribution?: Json
          fg_rate_pct?: number | null
          generated_at?: string
          id?: string
          median_delivery_days?: number | null
          median_price_eur?: number | null
          period_month?: number
          period_year?: number
          region_code?: string | null
          source_notes?: string | null
          top_transition_cities?: Json
          transactions_count?: number
        }
        Relationships: []
      }
      observatoire_press_citations: {
        Row: {
          article_title: string
          article_url: string
          author: string | null
          click_count: number
          created_at: string
          display_order: number
          id: string
          media_slug: string
          published_at: string
          quote_excerpt: string
          rejection_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          article_title: string
          article_url: string
          author?: string | null
          click_count?: number
          created_at?: string
          display_order?: number
          id?: string
          media_slug: string
          published_at: string
          quote_excerpt: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          article_title?: string
          article_url?: string
          author?: string | null
          click_count?: number
          created_at?: string
          display_order?: number
          id?: string
          media_slug?: string
          published_at?: string
          quote_excerpt?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      observatoire_reports: {
        Row: {
          ai_cost_eur: number
          ai_input_tokens: number
          ai_model: string | null
          ai_output_tokens: number
          cover_title: string
          created_at: string
          downloads_direct: number
          emails_failed: number
          emails_opened: number
          emails_sent: number
          executive_summary: string
          generated_at: string
          id: string
          pdf_size_bytes: number | null
          pdf_url: string
          period_month: number
          period_year: number
          sent_at: string | null
          stats_payload: Json
          status: string
          subscribers_at_send: number
        }
        Insert: {
          ai_cost_eur?: number
          ai_input_tokens?: number
          ai_model?: string | null
          ai_output_tokens?: number
          cover_title: string
          created_at?: string
          downloads_direct?: number
          emails_failed?: number
          emails_opened?: number
          emails_sent?: number
          executive_summary: string
          generated_at?: string
          id?: string
          pdf_size_bytes?: number | null
          pdf_url: string
          period_month: number
          period_year: number
          sent_at?: string | null
          stats_payload?: Json
          status?: string
          subscribers_at_send?: number
        }
        Update: {
          ai_cost_eur?: number
          ai_input_tokens?: number
          ai_model?: string | null
          ai_output_tokens?: number
          cover_title?: string
          created_at?: string
          downloads_direct?: number
          emails_failed?: number
          emails_opened?: number
          emails_sent?: number
          executive_summary?: string
          generated_at?: string
          id?: string
          pdf_size_bytes?: number | null
          pdf_url?: string
          period_month?: number
          period_year?: number
          sent_at?: string | null
          stats_payload?: Json
          status?: string
          subscribers_at_send?: number
        }
        Relationships: []
      }
      observatoire_subscribers: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_opened_at: string | null
          last_sent_at: string | null
          newsletter_opt_in: boolean
          opens_count: number
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_opened_at?: string | null
          last_sent_at?: string | null
          newsletter_opt_in?: boolean
          opens_count?: number
          source?: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_opened_at?: string | null
          last_sent_at?: string | null
          newsletter_opt_in?: boolean
          opens_count?: number
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      okrs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          key_results: Json
          objective: string
          progress: number | null
          quarter: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          key_results?: Json
          objective: string
          progress?: number | null
          quarter: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          key_results?: Json
          objective?: string
          progress?: number | null
          quarter?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      open_data_enrichments: {
        Row: {
          ban_fetched_at: string | null
          ban_payload: Json | null
          bdnb_fetched_at: string | null
          bdnb_payload: Json | null
          created_at: string
          dvf_fetched_at: string | null
          dvf_payload: Json | null
          fetch_errors: Json
          georisques_fetched_at: string | null
          georisques_payload: Json | null
          id: string
          ign_fetched_at: string | null
          ign_payload: Json | null
          latitude: number | null
          longitude: number | null
          mission_id: string
          organization_id: string
          rnb_fetched_at: string | null
          rnb_payload: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ban_fetched_at?: string | null
          ban_payload?: Json | null
          bdnb_fetched_at?: string | null
          bdnb_payload?: Json | null
          created_at?: string
          dvf_fetched_at?: string | null
          dvf_payload?: Json | null
          fetch_errors?: Json
          georisques_fetched_at?: string | null
          georisques_payload?: Json | null
          id?: string
          ign_fetched_at?: string | null
          ign_payload?: Json | null
          latitude?: number | null
          longitude?: number | null
          mission_id: string
          organization_id: string
          rnb_fetched_at?: string | null
          rnb_payload?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ban_fetched_at?: string | null
          ban_payload?: Json | null
          bdnb_fetched_at?: string | null
          bdnb_payload?: Json | null
          created_at?: string
          dvf_fetched_at?: string | null
          dvf_payload?: Json | null
          fetch_errors?: Json
          georisques_fetched_at?: string | null
          georisques_payload?: Json | null
          id?: string
          ign_fetched_at?: string | null
          ign_payload?: Json | null
          latitude?: number | null
          longitude?: number | null
          mission_id?: string
          organization_id?: string
          rnb_fetched_at?: string | null
          rnb_payload?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'open_data_enrichments_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'open_data_enrichments_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'open_data_enrichments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          ai_cap_daily_cents: number | null
          ai_cap_monthly_cents: number | null
          bank_name: string | null
          bic: string | null
          certification_n: string | null
          city: string | null
          country: string
          created_at: string
          current_period_end: string | null
          default_export_mode: string | null
          default_logiciel: string | null
          deleted_at: string | null
          iban: string | null
          id: string
          name: string
          plan: string
          plan_status: string
          postal_code: string | null
          siret: string | null
          storage_quota_bytes: number
          storage_used_bytes: number
          stripe_customer_id: string | null
          suspended_at: string | null
          suspension_reason: string | null
          trial_ends_at: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          ai_cap_daily_cents?: number | null
          ai_cap_monthly_cents?: number | null
          bank_name?: string | null
          bic?: string | null
          certification_n?: string | null
          city?: string | null
          country?: string
          created_at?: string
          current_period_end?: string | null
          default_export_mode?: string | null
          default_logiciel?: string | null
          deleted_at?: string | null
          iban?: string | null
          id?: string
          name: string
          plan?: string
          plan_status?: string
          postal_code?: string | null
          siret?: string | null
          storage_quota_bytes?: number
          storage_used_bytes?: number
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          ai_cap_daily_cents?: number | null
          ai_cap_monthly_cents?: number | null
          bank_name?: string | null
          bic?: string | null
          certification_n?: string | null
          city?: string | null
          country?: string
          created_at?: string
          current_period_end?: string | null
          default_export_mode?: string | null
          default_logiciel?: string | null
          deleted_at?: string | null
          iban?: string | null
          id?: string
          name?: string
          plan?: string
          plan_status?: string
          postal_code?: string | null
          siret?: string | null
          storage_quota_bytes?: number
          storage_used_bytes?: number
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          lead_id: string | null
          max_attempts: number
          phone_e164: string
          purpose: string
          user_agent: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          max_attempts?: number
          phone_e164: string
          purpose?: string
          user_agent?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          max_attempts?: number
          phone_e164?: string
          purpose?: string
          user_agent?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'otp_codes_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'otp_codes_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'quote_requests'
            referencedColumns: ['id']
          },
        ]
      }
      outgoing_message_log: {
        Row: {
          category: string
          channel: string
          error_message: string | null
          id: string
          organization_id: string | null
          provider_id: string | null
          recipient_to: string
          sent_at: string
          sequence_id: string | null
          sequence_step: number | null
          status: string
          subject: string | null
          target_entity_id: string | null
          target_entity_type: string | null
          template_slug: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          channel: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          provider_id?: string | null
          recipient_to: string
          sent_at?: string
          sequence_id?: string | null
          sequence_step?: number | null
          status?: string
          subject?: string | null
          target_entity_id?: string | null
          target_entity_type?: string | null
          template_slug?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          channel?: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          provider_id?: string | null
          recipient_to?: string
          sent_at?: string
          sequence_id?: string | null
          sequence_step?: number | null
          status?: string
          subject?: string | null
          target_entity_id?: string | null
          target_entity_type?: string | null
          template_slug?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'outgoing_message_log_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'outgoing_message_log_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'follow_up_sequences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'outgoing_message_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      owner_documents: {
        Row: {
          doc_kind: string | null
          dossier_id: string
          extracted_at: string | null
          extracted_data: Json | null
          extraction_cost_eur: number | null
          extraction_error: string | null
          extraction_status: string | null
          id: string
          mime_type: string | null
          organization_id: string
          original_name: string | null
          reviewed_by_diag: boolean | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          doc_kind?: string | null
          dossier_id: string
          extracted_at?: string | null
          extracted_data?: Json | null
          extraction_cost_eur?: number | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          mime_type?: string | null
          organization_id: string
          original_name?: string | null
          reviewed_by_diag?: boolean | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          doc_kind?: string | null
          dossier_id?: string
          extracted_at?: string | null
          extracted_data?: Json | null
          extraction_cost_eur?: number | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          original_name?: string | null
          reviewed_by_diag?: boolean | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'owner_documents_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
        ]
      }
      parameter_suggestions: {
        Row: {
          alternatives: Json
          confidence_score: number
          corrected_value: Json | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          explanation: string | null
          features_snapshot: Json
          field_kind: string | null
          field_name: string
          id: string
          mission_id: string | null
          ml_model_id: string | null
          organization_id: string
          rejection_reason: string | null
          source: string
          status: string
          suggested_value: Json
          target_record_id: string | null
          target_table: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alternatives?: Json
          confidence_score: number
          corrected_value?: Json | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          explanation?: string | null
          features_snapshot?: Json
          field_kind?: string | null
          field_name: string
          id?: string
          mission_id?: string | null
          ml_model_id?: string | null
          organization_id: string
          rejection_reason?: string | null
          source?: string
          status?: string
          suggested_value: Json
          target_record_id?: string | null
          target_table: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alternatives?: Json
          confidence_score?: number
          corrected_value?: Json | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          explanation?: string | null
          features_snapshot?: Json
          field_kind?: string | null
          field_name?: string
          id?: string
          mission_id?: string | null
          ml_model_id?: string | null
          organization_id?: string
          rejection_reason?: string | null
          source?: string
          status?: string
          suggested_value?: Json
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_param_sugg_ml_model'
            columns: ['ml_model_id']
            isOneToOne: false
            referencedRelation: 'ml_models'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parameter_suggestions_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parameter_suggestions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      partner_inquiries: {
        Row: {
          company_name: string
          company_role: string
          created_at: string
          email: string
          first_name: string
          honeypot_value: string | null
          id: string
          internal_notes: string | null
          last_name: string
          message: string
          partnership_type: string
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_ip: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          company_name: string
          company_role: string
          created_at?: string
          email: string
          first_name: string
          honeypot_value?: string | null
          id?: string
          internal_notes?: string | null
          last_name: string
          message: string
          partnership_type: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ip?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          company_name?: string
          company_role?: string
          created_at?: string
          email?: string
          first_name?: string
          honeypot_value?: string | null
          id?: string
          internal_notes?: string | null
          last_name?: string
          message?: string
          partnership_type?: string
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ip?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      pending_admin_actions: {
        Row: {
          chat_id: number
          created_at: string
          description: string
          expires_at: string
          id: string
          original_message: string | null
          resolved_at: string | null
          status: string
          tool_uses: Json
          user_id: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          description: string
          expires_at?: string
          id?: string
          original_message?: string | null
          resolved_at?: string | null
          status?: string
          tool_uses: Json
          user_id?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          description?: string
          expires_at?: string
          id?: string
          original_message?: string | null
          resolved_at?: string | null
          status?: string
          tool_uses?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      perf_metrics: {
        Row: {
          created_at: string
          duration_ms: number
          error_code: string | null
          id: string
          metadata: Json | null
          operation: string
          organization_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms: number
          error_code?: string | null
          id?: string
          metadata?: Json | null
          operation: string
          organization_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error_code?: string | null
          id?: string
          metadata?: Json | null
          operation?: string
          organization_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'perf_metrics_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      photos: {
        Row: {
          ai_cost_eur: number | null
          ai_tags: string[] | null
          analyzed_at: string | null
          caption: string | null
          created_at: string
          device_info: Json | null
          dossier_id: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_blurry: boolean | null
          is_duplicate_of: string | null
          location: unknown
          mime_type: string | null
          organization_id: string
          perceptual_hash: string | null
          room_id: string | null
          size_bytes: number | null
          storage_path: string
          sync_status: string | null
          taken_at: string | null
          thumb_path: string | null
          uploaded_by: string | null
          view_type: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_cost_usd: number | null
          vision_model: string | null
          vision_status: string | null
          width: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id?: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
        ]
      }
      photos_2026_05: {
        Row: {
          ai_cost_eur: number | null
          ai_tags: string[] | null
          analyzed_at: string | null
          caption: string | null
          created_at: string
          device_info: Json | null
          dossier_id: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_blurry: boolean | null
          is_duplicate_of: string | null
          location: unknown
          mime_type: string | null
          organization_id: string
          perceptual_hash: string | null
          room_id: string | null
          size_bytes: number | null
          storage_path: string
          sync_status: string | null
          taken_at: string | null
          thumb_path: string | null
          uploaded_by: string | null
          view_type: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_cost_usd: number | null
          vision_model: string | null
          vision_status: string | null
          width: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id?: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Relationships: []
      }
      photos_2026_06: {
        Row: {
          ai_cost_eur: number | null
          ai_tags: string[] | null
          analyzed_at: string | null
          caption: string | null
          created_at: string
          device_info: Json | null
          dossier_id: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_blurry: boolean | null
          is_duplicate_of: string | null
          location: unknown
          mime_type: string | null
          organization_id: string
          perceptual_hash: string | null
          room_id: string | null
          size_bytes: number | null
          storage_path: string
          sync_status: string | null
          taken_at: string | null
          thumb_path: string | null
          uploaded_by: string | null
          view_type: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_cost_usd: number | null
          vision_model: string | null
          vision_status: string | null
          width: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id?: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Relationships: []
      }
      photos_2026_07: {
        Row: {
          ai_cost_eur: number | null
          ai_tags: string[] | null
          analyzed_at: string | null
          caption: string | null
          created_at: string
          device_info: Json | null
          dossier_id: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_blurry: boolean | null
          is_duplicate_of: string | null
          location: unknown
          mime_type: string | null
          organization_id: string
          perceptual_hash: string | null
          room_id: string | null
          size_bytes: number | null
          storage_path: string
          sync_status: string | null
          taken_at: string | null
          thumb_path: string | null
          uploaded_by: string | null
          view_type: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_cost_usd: number | null
          vision_model: string | null
          vision_status: string | null
          width: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id?: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Relationships: []
      }
      photos_2026_08: {
        Row: {
          ai_cost_eur: number | null
          ai_tags: string[] | null
          analyzed_at: string | null
          caption: string | null
          created_at: string
          device_info: Json | null
          dossier_id: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_blurry: boolean | null
          is_duplicate_of: string | null
          location: unknown
          mime_type: string | null
          organization_id: string
          perceptual_hash: string | null
          room_id: string | null
          size_bytes: number | null
          storage_path: string
          sync_status: string | null
          taken_at: string | null
          thumb_path: string | null
          uploaded_by: string | null
          view_type: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_cost_usd: number | null
          vision_model: string | null
          vision_status: string | null
          width: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id?: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Relationships: []
      }
      photos_2026_09: {
        Row: {
          ai_cost_eur: number | null
          ai_tags: string[] | null
          analyzed_at: string | null
          caption: string | null
          created_at: string
          device_info: Json | null
          dossier_id: string
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_blurry: boolean | null
          is_duplicate_of: string | null
          location: unknown
          mime_type: string | null
          organization_id: string
          perceptual_hash: string | null
          room_id: string | null
          size_bytes: number | null
          storage_path: string
          sync_status: string | null
          taken_at: string | null
          thumb_path: string | null
          uploaded_by: string | null
          view_type: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_cost_usd: number | null
          vision_model: string | null
          vision_status: string | null
          width: number | null
        }
        Insert: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Update: {
          ai_cost_eur?: number | null
          ai_tags?: string[] | null
          analyzed_at?: string | null
          caption?: string | null
          created_at?: string
          device_info?: Json | null
          dossier_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          location?: unknown
          mime_type?: string | null
          organization_id?: string
          perceptual_hash?: string | null
          room_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          sync_status?: string | null
          taken_at?: string | null
          thumb_path?: string | null
          uploaded_by?: string | null
          view_type?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_cost_usd?: number | null
          vision_model?: string | null
          vision_status?: string | null
          width?: number | null
        }
        Relationships: []
      }
      pre_export_analyses: {
        Row: {
          ai_tokens_used: number | null
          analysis_duration_ms: number | null
          analyzed_at: string
          coherence_score: number | null
          conformity_score: number | null
          created_at: string
          diagnostician_id: string
          exhaustivity_score: number | null
          export_file_url: string | null
          exported: boolean | null
          exported_at: string | null
          findings: Json
          global_score: number | null
          id: string
          mission_id: string
          organization_id: string
          quality_score: number | null
          statistical_score: number | null
          target_format: string
          user_actions: Json | null
        }
        Insert: {
          ai_tokens_used?: number | null
          analysis_duration_ms?: number | null
          analyzed_at?: string
          coherence_score?: number | null
          conformity_score?: number | null
          created_at?: string
          diagnostician_id: string
          exhaustivity_score?: number | null
          export_file_url?: string | null
          exported?: boolean | null
          exported_at?: string | null
          findings?: Json
          global_score?: number | null
          id?: string
          mission_id: string
          organization_id: string
          quality_score?: number | null
          statistical_score?: number | null
          target_format: string
          user_actions?: Json | null
        }
        Update: {
          ai_tokens_used?: number | null
          analysis_duration_ms?: number | null
          analyzed_at?: string
          coherence_score?: number | null
          conformity_score?: number | null
          created_at?: string
          diagnostician_id?: string
          exhaustivity_score?: number | null
          export_file_url?: string | null
          exported?: boolean | null
          exported_at?: string | null
          findings?: Json
          global_score?: number | null
          id?: string
          mission_id?: string
          organization_id?: string
          quality_score?: number | null
          statistical_score?: number | null
          target_format?: string
          user_actions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'pre_export_analyses_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pre_export_analyses_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pre_export_analyses_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      prescriber_relationships: {
        Row: {
          acceptance_rate: number | null
          avg_basket_eur: number | null
          contact_id: string
          created_at: string
          id: string
          last_contact_at: string | null
          last_mission_at: string | null
          missions_12m_count: number
          next_action_at: string | null
          next_action_type: string | null
          notes: string | null
          organization_id: string
          revenue_12m_eur: number
          tier: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          acceptance_rate?: number | null
          avg_basket_eur?: number | null
          contact_id: string
          created_at?: string
          id?: string
          last_contact_at?: string | null
          last_mission_at?: string | null
          missions_12m_count?: number
          next_action_at?: string | null
          next_action_type?: string | null
          notes?: string | null
          organization_id: string
          revenue_12m_eur?: number
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          acceptance_rate?: number | null
          avg_basket_eur?: number | null
          contact_id?: string
          created_at?: string
          id?: string
          last_contact_at?: string | null
          last_mission_at?: string | null
          missions_12m_count?: number
          next_action_at?: string | null
          next_action_type?: string | null
          notes?: string | null
          organization_id?: string
          revenue_12m_eur?: number
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'prescriber_relationships_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prescriber_relationships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prescriber_relationships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_org_id: string | null
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          last_active_at: string | null
          linguistic_profile: Json | null
          locale: string
          notification_prefs: Json | null
          phone: string | null
          privacy_policy_accepted_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          last_active_at?: string | null
          linguistic_profile?: Json | null
          locale?: string
          notification_prefs?: Json | null
          phone?: string | null
          privacy_policy_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          last_active_at?: string | null
          linguistic_profile?: Json | null
          locale?: string
          notification_prefs?: Json | null
          phone?: string | null
          privacy_policy_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_default_org_id_fkey'
            columns: ['default_org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      properties: {
        Row: {
          address: string
          apartment_detail: string | null
          ban_id: string | null
          building_letter: string | null
          cadastre_number: string | null
          cadastre_prefix: string | null
          cadastre_section: string | null
          city: string | null
          client_id: string | null
          copropriete_id: string | null
          created_at: string
          deleted_at: string | null
          energy_class: string | null
          floor_number: number | null
          floors: number | null
          ges_class: string | null
          heating_type: string | null
          id: string
          insee_code: string | null
          location: unknown
          lot_number: string | null
          notes: string | null
          organization_id: string
          postal_code: string | null
          property_type: Database['public']['Enums']['property_type_enum'] | null
          rooms_count: number | null
          surface_boutin: number | null
          surface_carrez: number | null
          surface_total: number | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address: string
          apartment_detail?: string | null
          ban_id?: string | null
          building_letter?: string | null
          cadastre_number?: string | null
          cadastre_prefix?: string | null
          cadastre_section?: string | null
          city?: string | null
          client_id?: string | null
          copropriete_id?: string | null
          created_at?: string
          deleted_at?: string | null
          energy_class?: string | null
          floor_number?: number | null
          floors?: number | null
          ges_class?: string | null
          heating_type?: string | null
          id?: string
          insee_code?: string | null
          location?: unknown
          lot_number?: string | null
          notes?: string | null
          organization_id: string
          postal_code?: string | null
          property_type?: Database['public']['Enums']['property_type_enum'] | null
          rooms_count?: number | null
          surface_boutin?: number | null
          surface_carrez?: number | null
          surface_total?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address?: string
          apartment_detail?: string | null
          ban_id?: string | null
          building_letter?: string | null
          cadastre_number?: string | null
          cadastre_prefix?: string | null
          cadastre_section?: string | null
          city?: string | null
          client_id?: string | null
          copropriete_id?: string | null
          created_at?: string
          deleted_at?: string | null
          energy_class?: string | null
          floor_number?: number | null
          floors?: number | null
          ges_class?: string | null
          heating_type?: string | null
          id?: string
          insee_code?: string | null
          location?: unknown
          lot_number?: string | null
          notes?: string | null
          organization_id?: string
          postal_code?: string | null
          property_type?: Database['public']['Enums']['property_type_enum'] | null
          rooms_count?: number | null
          surface_boutin?: number | null
          surface_carrez?: number | null
          surface_total?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'properties_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'properties_copropriete_id_fkey'
            columns: ['copropriete_id']
            isOneToOne: false
            referencedRelation: 'coproprietes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'properties_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      property_client_relationships: {
        Row: {
          client_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_current: boolean
          notes: string | null
          organization_id: string
          ownership_share: number | null
          property_id: string
          role: string
          started_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          organization_id: string
          ownership_share?: number | null
          property_id: string
          role: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          organization_id?: string
          ownership_share?: number | null
          property_id?: string
          role?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'property_client_relationships_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_client_relationships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_client_relationships_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
        ]
      }
      property_lots: {
        Row: {
          building_letter: string | null
          copropriete_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          door_number: string | null
          floor_number: number | null
          id: string
          lot_number: string
          organization_id: string
          property_id: string | null
          tantiemes_generaux: number | null
          updated_at: string
        }
        Insert: {
          building_letter?: string | null
          copropriete_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          door_number?: string | null
          floor_number?: number | null
          id?: string
          lot_number: string
          organization_id: string
          property_id?: string | null
          tantiemes_generaux?: number | null
          updated_at?: string
        }
        Update: {
          building_letter?: string | null
          copropriete_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          door_number?: string | null
          floor_number?: number | null
          id?: string
          lot_number?: string
          organization_id?: string
          property_id?: string | null
          tantiemes_generaux?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'property_lots_copropriete_id_fkey'
            columns: ['copropriete_id']
            isOneToOne: false
            referencedRelation: 'coproprietes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_lots_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_lots_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
        ]
      }
      property_ownership_history: {
        Row: {
          id: string
          new_owner_client_id: string | null
          notary_act_storage_path: string | null
          notes: string | null
          organization_id: string
          previous_owner_client_id: string | null
          property_id: string
          recorded_at: string
          recorded_by: string | null
          transaction_amount_eur: number | null
          transaction_date: string
        }
        Insert: {
          id?: string
          new_owner_client_id?: string | null
          notary_act_storage_path?: string | null
          notes?: string | null
          organization_id: string
          previous_owner_client_id?: string | null
          property_id: string
          recorded_at?: string
          recorded_by?: string | null
          transaction_amount_eur?: number | null
          transaction_date: string
        }
        Update: {
          id?: string
          new_owner_client_id?: string | null
          notary_act_storage_path?: string | null
          notes?: string | null
          organization_id?: string
          previous_owner_client_id?: string | null
          property_id?: string
          recorded_at?: string
          recorded_by?: string | null
          transaction_amount_eur?: number | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'property_ownership_history_new_owner_client_id_fkey'
            columns: ['new_owner_client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_ownership_history_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_ownership_history_previous_owner_client_id_fkey'
            columns: ['previous_owner_client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_ownership_history_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
        ]
      }
      quote_request_rate_limits: {
        Row: {
          bucket_start_at: string
          count: number
          created_at: string
          id: string
          key: string
        }
        Insert: {
          bucket_start_at: string
          count?: number
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          bucket_start_at?: string
          count?: number
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      quote_request_recipients: {
        Row: {
          created_at: string
          declined_at: string | null
          diagnostician_id: string
          id: string
          ignored_at: string | null
          opened_at: string | null
          quote_request_id: string
          recipient_tier: string
          resend_message_id: string | null
          responded_at: string | null
          sent_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          declined_at?: string | null
          diagnostician_id: string
          id?: string
          ignored_at?: string | null
          opened_at?: string | null
          quote_request_id: string
          recipient_tier: string
          resend_message_id?: string | null
          responded_at?: string | null
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          declined_at?: string | null
          diagnostician_id?: string
          id?: string
          ignored_at?: string | null
          opened_at?: string | null
          quote_request_id?: string
          recipient_tier?: string
          resend_message_id?: string | null
          responded_at?: string | null
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_request_recipients_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_recipients_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'quote_request_recipients_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_recipients_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_recipients_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_recipients_quote_request_id_fkey'
            columns: ['quote_request_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_recipients_quote_request_id_fkey'
            columns: ['quote_request_id']
            isOneToOne: false
            referencedRelation: 'quote_requests'
            referencedColumns: ['id']
          },
        ]
      }
      quote_request_unlocks: {
        Row: {
          diagnostician_id: string
          id: string
          quote_request_id: string
          subscription_id: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          diagnostician_id: string
          id?: string
          quote_request_id: string
          subscription_id?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          diagnostician_id?: string
          id?: string
          quote_request_id?: string
          subscription_id?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_request_unlocks_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_quote_request_id_fkey'
            columns: ['quote_request_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_quote_request_id_fkey'
            columns: ['quote_request_id']
            isOneToOne: false
            referencedRelation: 'quote_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_request_unlocks_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      quote_requests: {
        Row: {
          acceptance_count: number
          close_reason: string | null
          closed_at: string | null
          created_at: string
          diag_notified_at: string | null
          diag_responded_at: string | null
          diagnostician_id: string | null
          diagnostics_requested: string[]
          diagnostics_suggested: Json | null
          estimated_class: string | null
          factors_json: Json | null
          honeypot_filled: boolean | null
          id: string
          ip_address: unknown
          message: string | null
          otp_attempts: number
          otp_verified_at: string | null
          property_address: string | null
          property_city: string | null
          property_geo_lat: number | null
          property_geo_lng: number | null
          property_postal_code: string | null
          property_situation: string
          property_surface_m2: number | null
          property_type: string
          property_year_built: number | null
          public_tracking_token: string | null
          recaptcha_score: number | null
          requester_email: string
          requester_email_verified: boolean
          requester_first_name: string
          requester_last_name: string
          requester_phone: string | null
          requester_verification_code: string | null
          requester_verification_code_expires_at: string | null
          requester_verification_sent_at: string | null
          routed_at: string | null
          routing_metadata: Json
          routing_strategy: string | null
          source: string
          status: string
          updated_at: string
          user_agent: string | null
          verification_attempts: number
        }
        Insert: {
          acceptance_count?: number
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          diag_notified_at?: string | null
          diag_responded_at?: string | null
          diagnostician_id?: string | null
          diagnostics_requested?: string[]
          diagnostics_suggested?: Json | null
          estimated_class?: string | null
          factors_json?: Json | null
          honeypot_filled?: boolean | null
          id?: string
          ip_address?: unknown
          message?: string | null
          otp_attempts?: number
          otp_verified_at?: string | null
          property_address?: string | null
          property_city?: string | null
          property_geo_lat?: number | null
          property_geo_lng?: number | null
          property_postal_code?: string | null
          property_situation: string
          property_surface_m2?: number | null
          property_type: string
          property_year_built?: number | null
          public_tracking_token?: string | null
          recaptcha_score?: number | null
          requester_email: string
          requester_email_verified?: boolean
          requester_first_name: string
          requester_last_name: string
          requester_phone?: string | null
          requester_verification_code?: string | null
          requester_verification_code_expires_at?: string | null
          requester_verification_sent_at?: string | null
          routed_at?: string | null
          routing_metadata?: Json
          routing_strategy?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          verification_attempts?: number
        }
        Update: {
          acceptance_count?: number
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          diag_notified_at?: string | null
          diag_responded_at?: string | null
          diagnostician_id?: string | null
          diagnostics_requested?: string[]
          diagnostics_suggested?: Json | null
          estimated_class?: string | null
          factors_json?: Json | null
          honeypot_filled?: boolean | null
          id?: string
          ip_address?: unknown
          message?: string | null
          otp_attempts?: number
          otp_verified_at?: string | null
          property_address?: string | null
          property_city?: string | null
          property_geo_lat?: number | null
          property_geo_lng?: number | null
          property_postal_code?: string | null
          property_situation?: string
          property_surface_m2?: number | null
          property_type?: string
          property_year_built?: number | null
          public_tracking_token?: string | null
          recaptcha_score?: number | null
          requester_email?: string
          requester_email_verified?: boolean
          requester_first_name?: string
          requester_last_name?: string
          requester_phone?: string | null
          requester_verification_code?: string | null
          requester_verification_code_expires_at?: string | null
          requester_verification_sent_at?: string | null
          routed_at?: string | null
          routing_metadata?: Json
          routing_strategy?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          verification_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          amount_ht: number
          amount_ttc: number
          amount_tva: number
          client_id: string
          client_snapshot: Json | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          dossier_id: string | null
          expires_at: string | null
          facturx_profile: string | null
          facturx_xml: string | null
          id: string
          indy_quote_id: string | null
          indy_synced_at: string | null
          issued_at: string | null
          line_items: Json
          mission_id: string | null
          notes: string | null
          organization_id: string
          payment_method: string | null
          payment_terms_days: number | null
          pdf_path: string | null
          pennylane_customer_id: string | null
          pennylane_quote_id: string | null
          pennylane_synced_at: string | null
          qonto_quote_id: string | null
          qonto_synced_at: string | null
          reference: string
          sent_at: string | null
          signature_id: string | null
          signature_provider: string | null
          status: string
          tiime_quote_id: string | null
          tiime_synced_at: string | null
          tva_rate: number | null
          updated_at: string
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount_ht: number
          amount_ttc: number
          amount_tva: number
          client_id: string
          client_snapshot?: Json | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dossier_id?: string | null
          expires_at?: string | null
          facturx_profile?: string | null
          facturx_xml?: string | null
          id?: string
          indy_quote_id?: string | null
          indy_synced_at?: string | null
          issued_at?: string | null
          line_items?: Json
          mission_id?: string | null
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          payment_terms_days?: number | null
          pdf_path?: string | null
          pennylane_customer_id?: string | null
          pennylane_quote_id?: string | null
          pennylane_synced_at?: string | null
          qonto_quote_id?: string | null
          qonto_synced_at?: string | null
          reference: string
          sent_at?: string | null
          signature_id?: string | null
          signature_provider?: string | null
          status?: string
          tiime_quote_id?: string | null
          tiime_synced_at?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount_ht?: number
          amount_ttc?: number
          amount_tva?: number
          client_id?: string
          client_snapshot?: Json | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dossier_id?: string | null
          expires_at?: string | null
          facturx_profile?: string | null
          facturx_xml?: string | null
          id?: string
          indy_quote_id?: string | null
          indy_synced_at?: string | null
          issued_at?: string | null
          line_items?: Json
          mission_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          payment_terms_days?: number | null
          pdf_path?: string | null
          pennylane_customer_id?: string | null
          pennylane_quote_id?: string | null
          pennylane_synced_at?: string | null
          qonto_quote_id?: string | null
          qonto_synced_at?: string | null
          reference?: string
          sent_at?: string | null
          signature_id?: string | null
          signature_provider?: string | null
          status?: string
          tiime_quote_id?: string | null
          tiime_synced_at?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      reference_counters: {
        Row: {
          kind: string
          last_value: number
          organization_id: string
          year: number
        }
        Insert: {
          kind: string
          last_value?: number
          organization_id: string
          year: number
        }
        Update: {
          kind?: string
          last_value?: number
          organization_id?: string
          year?: number
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          channel: string | null
          clicked_at: string
          converted_to_signup: boolean
          id: string
          ip_hash: string
          referer_url: string | null
          referral_code: string
          signup_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          channel?: string | null
          clicked_at?: string
          converted_to_signup?: boolean
          id?: string
          ip_hash: string
          referer_url?: string | null
          referral_code: string
          signup_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          channel?: string | null
          clicked_at?: string
          converted_to_signup?: boolean
          id?: string
          ip_hash?: string
          referer_url?: string | null
          referral_code?: string
          signup_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'referral_clicks_referral_code_fkey'
            columns: ['referral_code']
            isOneToOne: false
            referencedRelation: 'referral_clicks_per_code'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'referral_clicks_referral_code_fkey'
            columns: ['referral_code']
            isOneToOne: false
            referencedRelation: 'referral_codes'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'referral_clicks_referral_code_fkey'
            columns: ['referral_code']
            isOneToOne: false
            referencedRelation: 'referral_stats_per_user'
            referencedColumns: ['code']
          },
        ]
      }
      referral_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'referral_codes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          first_invoice_paid_at: string | null
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_eur_cents: number | null
          rewarded_at: string | null
          signed_up_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          first_invoice_paid_at?: string | null
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_eur_cents?: number | null
          rewarded_at?: string | null
          signed_up_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          first_invoice_paid_at?: string | null
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_eur_cents?: number | null
          rewarded_at?: string | null
          signed_up_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'referrals_referral_code_fkey'
            columns: ['referral_code']
            isOneToOne: false
            referencedRelation: 'referral_clicks_per_code'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'referrals_referral_code_fkey'
            columns: ['referral_code']
            isOneToOne: false
            referencedRelation: 'referral_codes'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'referrals_referral_code_fkey'
            columns: ['referral_code']
            isOneToOne: false
            referencedRelation: 'referral_stats_per_user'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'referrals_referred_id_fkey'
            columns: ['referred_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'referrals_referrer_id_fkey'
            columns: ['referrer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      regulatory_ai_conversations: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          cached_tokens: number | null
          cited_document_ids: string[] | null
          content: string
          cost_eur: number | null
          created_at: string
          feedback_note: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json | null
          organization_id: string
          output_tokens: number | null
          retrieval_query: string | null
          retrieval_scores: number[] | null
          retrieval_top_k: number | null
          role: string
          session_id: string
          user_feedback: number | null
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          cached_tokens?: number | null
          cited_document_ids?: string[] | null
          content: string
          cost_eur?: number | null
          created_at?: string
          feedback_note?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          organization_id: string
          output_tokens?: number | null
          retrieval_query?: string | null
          retrieval_scores?: number[] | null
          retrieval_top_k?: number | null
          role: string
          session_id: string
          user_feedback?: number | null
          user_id: string
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          cached_tokens?: number | null
          cited_document_ids?: string[] | null
          content?: string
          cost_eur?: number | null
          created_at?: string
          feedback_note?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json | null
          organization_id?: string
          output_tokens?: number | null
          retrieval_query?: string | null
          retrieval_scores?: number[] | null
          retrieval_top_k?: number | null
          role?: string
          session_id?: string
          user_feedback?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'regulatory_ai_conversations_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      regulatory_documents: {
        Row: {
          ai_summary: string | null
          ai_summary_cost_eur: number | null
          ai_summary_embedding: string | null
          ai_summary_model: string | null
          applies_to: string[] | null
          batch_completed_at: string | null
          batch_error: string | null
          batch_job_id: string | null
          batch_submitted_at: string | null
          content_hash: string
          created_at: string
          diagnostic_kinds: string[] | null
          doc_type: string
          effective_at: string | null
          embedding: string | null
          embedding_generated_at: string | null
          external_id: string | null
          id: string
          importance: string
          is_superseded: boolean
          jurisdiction: string
          metadata: Json | null
          processed: boolean
          processed_at: string | null
          published_at: string | null
          raw_html: string | null
          raw_text: string
          source_id: string
          superseded_by: string | null
          title: string
          topics: string[] | null
          updated_at: string
          url: string
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_cost_eur?: number | null
          ai_summary_embedding?: string | null
          ai_summary_model?: string | null
          applies_to?: string[] | null
          batch_completed_at?: string | null
          batch_error?: string | null
          batch_job_id?: string | null
          batch_submitted_at?: string | null
          content_hash: string
          created_at?: string
          diagnostic_kinds?: string[] | null
          doc_type: string
          effective_at?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          external_id?: string | null
          id?: string
          importance?: string
          is_superseded?: boolean
          jurisdiction?: string
          metadata?: Json | null
          processed?: boolean
          processed_at?: string | null
          published_at?: string | null
          raw_html?: string | null
          raw_text: string
          source_id: string
          superseded_by?: string | null
          title: string
          topics?: string[] | null
          updated_at?: string
          url: string
        }
        Update: {
          ai_summary?: string | null
          ai_summary_cost_eur?: number | null
          ai_summary_embedding?: string | null
          ai_summary_model?: string | null
          applies_to?: string[] | null
          batch_completed_at?: string | null
          batch_error?: string | null
          batch_job_id?: string | null
          batch_submitted_at?: string | null
          content_hash?: string
          created_at?: string
          diagnostic_kinds?: string[] | null
          doc_type?: string
          effective_at?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          external_id?: string | null
          id?: string
          importance?: string
          is_superseded?: boolean
          jurisdiction?: string
          metadata?: Json | null
          processed?: boolean
          processed_at?: string | null
          published_at?: string | null
          raw_html?: string | null
          raw_text?: string
          source_id?: string
          superseded_by?: string | null
          title?: string
          topics?: string[] | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'regulatory_documents_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'regulatory_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'regulatory_documents_superseded_by_fkey'
            columns: ['superseded_by']
            isOneToOne: false
            referencedRelation: 'regulatory_documents'
            referencedColumns: ['id']
          },
        ]
      }
      regulatory_notifications: {
        Row: {
          acted_at: string | null
          created_at: string
          delivered_email: boolean
          delivered_in_app: boolean
          delivered_push: boolean
          dismissed_at: string | null
          document_id: string
          id: string
          matched_kinds: string[] | null
          matched_topics: string[] | null
          organization_id: string
          read_at: string | null
          reason: string | null
          severity: string
          user_id: string
        }
        Insert: {
          acted_at?: string | null
          created_at?: string
          delivered_email?: boolean
          delivered_in_app?: boolean
          delivered_push?: boolean
          dismissed_at?: string | null
          document_id: string
          id?: string
          matched_kinds?: string[] | null
          matched_topics?: string[] | null
          organization_id: string
          read_at?: string | null
          reason?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          acted_at?: string | null
          created_at?: string
          delivered_email?: boolean
          delivered_in_app?: boolean
          delivered_push?: boolean
          dismissed_at?: string | null
          document_id?: string
          id?: string
          matched_kinds?: string[] | null
          matched_topics?: string[] | null
          organization_id?: string
          read_at?: string | null
          reason?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'regulatory_notifications_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'regulatory_documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'regulatory_notifications_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      regulatory_sources: {
        Row: {
          api_url: string | null
          authority: string
          consecutive_failures: number
          created_at: string
          feed_url: string | null
          fetch_frequency_hours: number
          fetch_method: string
          id: string
          is_active: boolean
          last_error: string | null
          last_fetched_at: string | null
          last_success_at: string | null
          name: string
          notes: string | null
          parser_config: Json
          reliability: string
          robots_txt_checked: boolean
          slug: string
          tos_compatible: boolean
          updated_at: string
          url: string
        }
        Insert: {
          api_url?: string | null
          authority: string
          consecutive_failures?: number
          created_at?: string
          feed_url?: string | null
          fetch_frequency_hours?: number
          fetch_method?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          name: string
          notes?: string | null
          parser_config?: Json
          reliability?: string
          robots_txt_checked?: boolean
          slug: string
          tos_compatible?: boolean
          updated_at?: string
          url: string
        }
        Update: {
          api_url?: string | null
          authority?: string
          consecutive_failures?: number
          created_at?: string
          feed_url?: string | null
          fetch_frequency_hours?: number
          fetch_method?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          name?: string
          notes?: string | null
          parser_config?: Json
          reliability?: string
          robots_txt_checked?: boolean
          slug?: string
          tos_compatible?: boolean
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      report_payment_locks: {
        Row: {
          amount_due: number | null
          created_at: string
          id: string
          locked: boolean
          mission_id: string
          organization_id: string
          override_at: string | null
          override_by_user: boolean
          override_by_user_id: string | null
          override_reason: string | null
          payment_intent_id: string | null
          payment_link: string | null
          payment_provider: Database['public']['Enums']['payment_provider_kind'] | null
          payment_received_at: string | null
          payment_request_sent_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_due?: number | null
          created_at?: string
          id?: string
          locked?: boolean
          mission_id: string
          organization_id: string
          override_at?: string | null
          override_by_user?: boolean
          override_by_user_id?: string | null
          override_reason?: string | null
          payment_intent_id?: string | null
          payment_link?: string | null
          payment_provider?: Database['public']['Enums']['payment_provider_kind'] | null
          payment_received_at?: string | null
          payment_request_sent_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_due?: number | null
          created_at?: string
          id?: string
          locked?: boolean
          mission_id?: string
          organization_id?: string
          override_at?: string | null
          override_by_user?: boolean
          override_by_user_id?: string | null
          override_reason?: string | null
          payment_intent_id?: string | null
          payment_link?: string | null
          payment_provider?: Database['public']['Enums']['payment_provider_kind'] | null
          payment_received_at?: string | null
          payment_request_sent_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'report_payment_locks_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: true
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'report_payment_locks_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'report_payment_locks_override_by_user_id_fkey'
            columns: ['override_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'report_payment_locks_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      report_templates: {
        Row: {
          changelog: string | null
          created_at: string
          default_variables: Json
          description: string | null
          diagnostic_kind: string
          effective_from: string | null
          effective_until: string | null
          format: string
          id: string
          is_active: boolean
          legal_basis: string | null
          slug: string
          template_body: string
          template_engine: string
          triggered_by_doc_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          default_variables?: Json
          description?: string | null
          diagnostic_kind: string
          effective_from?: string | null
          effective_until?: string | null
          format?: string
          id?: string
          is_active?: boolean
          legal_basis?: string | null
          slug: string
          template_body: string
          template_engine?: string
          triggered_by_doc_id?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          default_variables?: Json
          description?: string | null
          diagnostic_kind?: string
          effective_from?: string | null
          effective_until?: string | null
          format?: string
          id?: string
          is_active?: boolean
          legal_basis?: string | null
          slug?: string
          template_body?: string
          template_engine?: string
          triggered_by_doc_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: 'report_templates_triggered_by_doc_id_fkey'
            columns: ['triggered_by_doc_id']
            isOneToOne: false
            referencedRelation: 'regulatory_documents'
            referencedColumns: ['id']
          },
        ]
      }
      roadmap_items: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_days: number | null
          id: string
          priority: number | null
          shipped_at: string | null
          status: string
          target_version: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_days?: number | null
          id?: string
          priority?: number | null
          shipped_at?: string | null
          status?: string
          target_version?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_days?: number | null
          id?: string
          priority?: number | null
          shipped_at?: string | null
          status?: string
          target_version?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      routes_cache: {
        Row: {
          cache_key: string
          created_at: string
          distance_meters: number
          duration_seconds: number
          expires_at: string
          id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          distance_meters: number
          duration_seconds: number
          expires_at: string
          id?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          distance_meters?: number
          duration_seconds?: number
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      seo_draft_versions: {
        Row: {
          content_markdown: string
          created_at: string
          draft_id: string
          edit_summary: string | null
          edited_by: string | null
          id: string
          version_number: number
        }
        Insert: {
          content_markdown: string
          created_at?: string
          draft_id: string
          edit_summary?: string | null
          edited_by?: string | null
          id?: string
          version_number: number
        }
        Update: {
          content_markdown?: string
          created_at?: string
          draft_id?: string
          edit_summary?: string | null
          edited_by?: string | null
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'seo_draft_versions_draft_id_fkey'
            columns: ['draft_id']
            isOneToOne: false
            referencedRelation: 'seo_drafts'
            referencedColumns: ['id']
          },
        ]
      }
      seo_drafts: {
        Row: {
          assigned_to: string | null
          claude_cost_eur: number | null
          claude_model: string | null
          content_html: string | null
          content_markdown: string
          created_at: string
          created_by: string | null
          eeat_score: number | null
          eeat_validations: Json | null
          generation_prompt_id: string | null
          id: string
          keyword_id: string | null
          meta_description: string | null
          published_at: string | null
          published_by: string | null
          published_url: string | null
          revision_count: number
          slug: string
          status: string
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          claude_cost_eur?: number | null
          claude_model?: string | null
          content_html?: string | null
          content_markdown: string
          created_at?: string
          created_by?: string | null
          eeat_score?: number | null
          eeat_validations?: Json | null
          generation_prompt_id?: string | null
          id?: string
          keyword_id?: string | null
          meta_description?: string | null
          published_at?: string | null
          published_by?: string | null
          published_url?: string | null
          revision_count?: number
          slug: string
          status?: string
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          claude_cost_eur?: number | null
          claude_model?: string | null
          content_html?: string | null
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          eeat_score?: number | null
          eeat_validations?: Json | null
          generation_prompt_id?: string | null
          id?: string
          keyword_id?: string | null
          meta_description?: string | null
          published_at?: string | null
          published_by?: string | null
          published_url?: string | null
          revision_count?: number
          slug?: string
          status?: string
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'seo_drafts_keyword_id_fkey'
            columns: ['keyword_id']
            isOneToOne: false
            referencedRelation: 'seo_keywords'
            referencedColumns: ['id']
          },
        ]
      }
      seo_geo_pages: {
        Row: {
          average_price_dpe: number | null
          avg_price_per_m2: number | null
          canonical_url: string | null
          city_name: string | null
          city_slug: string | null
          created_at: string
          department_code: string
          department_name: string | null
          diagnosticians_count: number
          faq_items: Json | null
          generation_tier: number
          h1_title: string
          id: string
          intro_content: string | null
          last_regenerated_at: string | null
          long_form_content: string | null
          meta_description: string
          meta_title: string
          page_type: string
          population: number | null
          priority_rank: number
          region_code: string | null
          region_name: string | null
          schema_jsonld: Json | null
          slug: string
          transactions_count_dvf: number | null
          updated_at: string
        }
        Insert: {
          average_price_dpe?: number | null
          avg_price_per_m2?: number | null
          canonical_url?: string | null
          city_name?: string | null
          city_slug?: string | null
          created_at?: string
          department_code: string
          department_name?: string | null
          diagnosticians_count?: number
          faq_items?: Json | null
          generation_tier: number
          h1_title: string
          id?: string
          intro_content?: string | null
          last_regenerated_at?: string | null
          long_form_content?: string | null
          meta_description: string
          meta_title: string
          page_type: string
          population?: number | null
          priority_rank: number
          region_code?: string | null
          region_name?: string | null
          schema_jsonld?: Json | null
          slug: string
          transactions_count_dvf?: number | null
          updated_at?: string
        }
        Update: {
          average_price_dpe?: number | null
          avg_price_per_m2?: number | null
          canonical_url?: string | null
          city_name?: string | null
          city_slug?: string | null
          created_at?: string
          department_code?: string
          department_name?: string | null
          diagnosticians_count?: number
          faq_items?: Json | null
          generation_tier?: number
          h1_title?: string
          id?: string
          intro_content?: string | null
          last_regenerated_at?: string | null
          long_form_content?: string | null
          meta_description?: string
          meta_title?: string
          page_type?: string
          population?: number | null
          priority_rank?: number
          region_code?: string | null
          region_name?: string | null
          schema_jsonld?: Json | null
          slug?: string
          transactions_count_dvf?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_keyword_signals: {
        Row: {
          captured_at: string
          id: string
          ingestion_run_id: string | null
          keyword_id: string
          metadata: Json | null
          signal_type: string
          signal_value: number
          source_code: string
        }
        Insert: {
          captured_at?: string
          id?: string
          ingestion_run_id?: string | null
          keyword_id: string
          metadata?: Json | null
          signal_type: string
          signal_value: number
          source_code: string
        }
        Update: {
          captured_at?: string
          id?: string
          ingestion_run_id?: string | null
          keyword_id?: string
          metadata?: Json | null
          signal_type?: string
          signal_value?: number
          source_code?: string
        }
        Relationships: [
          {
            foreignKeyName: 'seo_keyword_signals_keyword_id_fkey'
            columns: ['keyword_id']
            isOneToOne: false
            referencedRelation: 'seo_keywords'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_keyword_signals_source_code_fkey'
            columns: ['source_code']
            isOneToOne: false
            referencedRelation: 'seo_sources'
            referencedColumns: ['code']
          },
        ]
      }
      seo_keywords: {
        Row: {
          category: string | null
          competition: number | null
          created_at: string
          first_seen_at: string
          geo_scope: string | null
          id: string
          intent_type: string | null
          keyword_display: string
          keyword_normalized: string
          language: string
          last_seen_at: string
          monthly_search_volume: number | null
          score: number | null
          score_components: Json | null
          score_computed_at: string | null
          signal_count: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          competition?: number | null
          created_at?: string
          first_seen_at?: string
          geo_scope?: string | null
          id?: string
          intent_type?: string | null
          keyword_display: string
          keyword_normalized: string
          language?: string
          last_seen_at?: string
          monthly_search_volume?: number | null
          score?: number | null
          score_components?: Json | null
          score_computed_at?: string | null
          signal_count?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          competition?: number | null
          created_at?: string
          first_seen_at?: string
          geo_scope?: string | null
          id?: string
          intent_type?: string | null
          keyword_display?: string
          keyword_normalized?: string
          language?: string
          last_seen_at?: string
          monthly_search_volume?: number | null
          score?: number | null
          score_components?: Json | null
          score_computed_at?: string | null
          signal_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      seo_page_quality_signals: {
        Row: {
          avg_time_on_page_sec: number | null
          bounce_rate: number | null
          city_slug: string | null
          created_at: string
          dept_code: string | null
          has_human_signature: boolean
          has_local_data: boolean
          has_real_diagnostician: boolean
          id: string
          last_audited_at: string
          needs_refresh: boolean
          page_type: string | null
          page_url: string
          pogo_stick_count: number
          quality_score: number | null
          refresh_reason: string | null
          total_conversions: number
          total_visits: number
          updated_at: string
        }
        Insert: {
          avg_time_on_page_sec?: number | null
          bounce_rate?: number | null
          city_slug?: string | null
          created_at?: string
          dept_code?: string | null
          has_human_signature?: boolean
          has_local_data?: boolean
          has_real_diagnostician?: boolean
          id?: string
          last_audited_at?: string
          needs_refresh?: boolean
          page_type?: string | null
          page_url: string
          pogo_stick_count?: number
          quality_score?: number | null
          refresh_reason?: string | null
          total_conversions?: number
          total_visits?: number
          updated_at?: string
        }
        Update: {
          avg_time_on_page_sec?: number | null
          bounce_rate?: number | null
          city_slug?: string | null
          created_at?: string
          dept_code?: string | null
          has_human_signature?: boolean
          has_local_data?: boolean
          has_real_diagnostician?: boolean
          id?: string
          last_audited_at?: string
          needs_refresh?: boolean
          page_type?: string | null
          page_url?: string
          pogo_stick_count?: number
          quality_score?: number | null
          refresh_reason?: string | null
          total_conversions?: number
          total_visits?: number
          updated_at?: string
        }
        Relationships: []
      }
      seo_publications: {
        Row: {
          canonical_url: string | null
          clicks_count: number
          draft_id: string
          id: string
          last_gsc_sync_at: string | null
          published_at: string
          published_url: string
          schema_org_json: Json | null
          seo_description: string
          seo_title: string
          views_count: number
        }
        Insert: {
          canonical_url?: string | null
          clicks_count?: number
          draft_id: string
          id?: string
          last_gsc_sync_at?: string | null
          published_at?: string
          published_url: string
          schema_org_json?: Json | null
          seo_description: string
          seo_title: string
          views_count?: number
        }
        Update: {
          canonical_url?: string | null
          clicks_count?: number
          draft_id?: string
          id?: string
          last_gsc_sync_at?: string | null
          published_at?: string
          published_url?: string
          schema_org_json?: Json | null
          seo_description?: string
          seo_title?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'seo_publications_draft_id_fkey'
            columns: ['draft_id']
            isOneToOne: false
            referencedRelation: 'seo_drafts'
            referencedColumns: ['id']
          },
        ]
      }
      seo_sources: {
        Row: {
          category: string
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          last_ingested_at: string | null
          total_signals_count: number
          updated_at: string
          weight: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          last_ingested_at?: string | null
          total_signals_count?: number
          updated_at?: string
          weight: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          last_ingested_at?: string | null
          total_signals_count?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      sidebar_preferences: {
        Row: {
          created_at: string
          id: string
          main_items: Json
          more_items: Json
          notification_style: string
          profile_preset: string | null
          sidebar_collapsed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          main_items?: Json
          more_items?: Json
          notification_style?: string
          profile_preset?: string | null
          sidebar_collapsed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          main_items?: Json
          more_items?: Json
          notification_style?: string
          profile_preset?: string | null
          sidebar_collapsed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sidebar_preferences_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sketches: {
        Row: {
          ai_cost_eur: number | null
          created_at: string
          geometry: Json
          id: string
          mission_id: string
          organization_id: string
          preview_path: string | null
          reviewed: boolean | null
          room_id: string | null
          source: string
          surface_boutin_m2: number | null
          surface_carrez_m2: number | null
          updated_at: string
        }
        Insert: {
          ai_cost_eur?: number | null
          created_at?: string
          geometry: Json
          id?: string
          mission_id: string
          organization_id: string
          preview_path?: string | null
          reviewed?: boolean | null
          room_id?: string | null
          source: string
          surface_boutin_m2?: number | null
          surface_carrez_m2?: number | null
          updated_at?: string
        }
        Update: {
          ai_cost_eur?: number | null
          created_at?: string
          geometry?: Json
          id?: string
          mission_id?: string
          organization_id?: string
          preview_path?: string | null
          reviewed?: boolean | null
          room_id?: string | null
          source?: string
          surface_boutin_m2?: number | null
          surface_carrez_m2?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sketches_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sketches_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sketches_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'dossier_rooms'
            referencedColumns: ['id']
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sponsored_slot_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          diagnostician_id: string
          id: string
          organization_id: string
          sponsored_slot_id: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          diagnostician_id: string
          id?: string
          organization_id: string
          sponsored_slot_id: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          diagnostician_id?: string
          id?: string
          organization_id?: string
          sponsored_slot_id?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sponsored_slot_subscriptions_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_sponsored_slot_id_fkey'
            columns: ['sponsored_slot_id']
            isOneToOne: false
            referencedRelation: 'sponsored_slots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsored_slot_subscriptions_sponsored_slot_id_fkey'
            columns: ['sponsored_slot_id']
            isOneToOne: false
            referencedRelation: 'v_sponsored_slot_availability'
            referencedColumns: ['sponsored_slot_id']
          },
        ]
      }
      sponsored_slots: {
        Row: {
          annual_price_cents: number
          city_inseecode: string
          city_label: string
          created_at: string
          department_code: string
          id: string
          monthly_price_cents: number
          population: number
          slot_capacity: number
          slot_code: string
        }
        Insert: {
          annual_price_cents: number
          city_inseecode: string
          city_label: string
          created_at?: string
          department_code: string
          id?: string
          monthly_price_cents: number
          population: number
          slot_capacity?: number
          slot_code: string
        }
        Update: {
          annual_price_cents?: number
          city_inseecode?: string
          city_label?: string
          created_at?: string
          department_code?: string
          id?: string
          monthly_price_cents?: number
          population?: number
          slot_capacity?: number
          slot_code?: string
        }
        Relationships: []
      }
      spontaneous_applications: {
        Row: {
          created_at: string
          email: string
          first_name: string
          honeypot_value: string | null
          id: string
          internal_notes: string | null
          last_name: string
          linkedin_url: string | null
          message: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_ip: string | null
          status: string
          target_role: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          honeypot_value?: string | null
          id?: string
          internal_notes?: string | null
          last_name: string
          linkedin_url?: string | null
          message: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ip?: string | null
          status?: string
          target_role: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          honeypot_value?: string | null
          id?: string
          internal_notes?: string | null
          last_name?: string
          linkedin_url?: string | null
          message?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ip?: string | null
          status?: string
          target_role?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          livemode: boolean
          payload_summary: Json
          processed_at: string
          processing_result: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id: string
          livemode?: boolean
          payload_summary?: Json
          processed_at?: string
          processing_result?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          livemode?: boolean
          payload_summary?: Json
          processed_at?: string
          processing_result?: string
        }
        Relationships: []
      }
      subscription_history: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          new_plan_code: string | null
          old_plan_code: string | null
          subscription_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          new_plan_code?: string | null
          old_plan_code?: string | null
          subscription_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_plan_code?: string | null
          old_plan_code?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_history_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      subscription_plans: {
        Row: {
          chatbot_messages_quota: number
          created_at: string
          description: string | null
          display_name: string
          extra_user_price_cents: number | null
          features: Json
          geocoding_requests_quota: number
          id: string
          is_active: boolean
          is_featured: boolean
          max_users: number | null
          missions_quota: number
          overage_chatbot_price_cents: number
          overage_geocoding_price_cents: number
          overage_mission_price_cents: number
          overage_signature_price_cents: number
          overage_storage_price_cents_per_gb: number
          plan_code: string
          price_annual_cents: number
          price_monthly_cents: number
          sort_order: number
          storage_gb: number
          stripe_price_annual_id: string | null
          stripe_price_monthly_id: string | null
          stripe_product_id: string | null
          updated_at: string
          users_included: number
          yousign_signatures_quota: number
        }
        Insert: {
          chatbot_messages_quota: number
          created_at?: string
          description?: string | null
          display_name: string
          extra_user_price_cents?: number | null
          features?: Json
          geocoding_requests_quota?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          max_users?: number | null
          missions_quota: number
          overage_chatbot_price_cents?: number
          overage_geocoding_price_cents?: number
          overage_mission_price_cents?: number
          overage_signature_price_cents?: number
          overage_storage_price_cents_per_gb?: number
          plan_code: string
          price_annual_cents: number
          price_monthly_cents: number
          sort_order?: number
          storage_gb: number
          stripe_price_annual_id?: string | null
          stripe_price_monthly_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          users_included?: number
          yousign_signatures_quota?: number
        }
        Update: {
          chatbot_messages_quota?: number
          created_at?: string
          description?: string | null
          display_name?: string
          extra_user_price_cents?: number | null
          features?: Json
          geocoding_requests_quota?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          max_users?: number | null
          missions_quota?: number
          overage_chatbot_price_cents?: number
          overage_geocoding_price_cents?: number
          overage_mission_price_cents?: number
          overage_signature_price_cents?: number
          overage_storage_price_cents_per_gb?: number
          plan_code?: string
          price_annual_cents?: number
          price_monthly_cents?: number
          sort_order?: number
          storage_gb?: number
          stripe_price_annual_id?: string | null
          stripe_price_monthly_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          users_included?: number
          yousign_signatures_quota?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_period: string
          cancel_at_period_end: boolean
          cancel_feedback: string | null
          cancel_reason: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          extra_users_count: number
          fair_use_cap_missions: number | null
          hard_cap_burst_per_day: number | null
          hard_cap_storage_gb: number | null
          hard_cap_vision_calls: number | null
          hard_cap_whisper_seconds: number | null
          id: string
          is_grandfathered: boolean
          is_in_trial: boolean
          launch_offer_id: string | null
          missions_included: number | null
          monthly_cap_eur: number | null
          organization_id: string
          overage_price_cents: number | null
          pause_ends_at: string | null
          pause_started_at: string | null
          plan_code: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          trial_card_setup_intent_id: string | null
          trial_end_at: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_period?: string
          cancel_at_period_end?: boolean
          cancel_feedback?: string | null
          cancel_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          extra_users_count?: number
          fair_use_cap_missions?: number | null
          hard_cap_burst_per_day?: number | null
          hard_cap_storage_gb?: number | null
          hard_cap_vision_calls?: number | null
          hard_cap_whisper_seconds?: number | null
          id?: string
          is_grandfathered?: boolean
          is_in_trial?: boolean
          launch_offer_id?: string | null
          missions_included?: number | null
          monthly_cap_eur?: number | null
          organization_id: string
          overage_price_cents?: number | null
          pause_ends_at?: string | null
          pause_started_at?: string | null
          plan_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          trial_card_setup_intent_id?: string | null
          trial_end_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_period?: string
          cancel_at_period_end?: boolean
          cancel_feedback?: string | null
          cancel_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          extra_users_count?: number
          fair_use_cap_missions?: number | null
          hard_cap_burst_per_day?: number | null
          hard_cap_storage_gb?: number | null
          hard_cap_vision_calls?: number | null
          hard_cap_whisper_seconds?: number | null
          id?: string
          is_grandfathered?: boolean
          is_in_trial?: boolean
          launch_offer_id?: string | null
          missions_included?: number | null
          monthly_cap_eur?: number | null
          organization_id?: string
          overage_price_cents?: number | null
          pause_ends_at?: string | null
          pause_started_at?: string | null
          plan_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          trial_card_setup_intent_id?: string | null
          trial_end_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          from_role: string
          id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          from_role: string
          id?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          from_role?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'support_messages_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'support_tickets'
            referencedColumns: ['id']
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_classification: string | null
          ai_confidence: number | null
          ai_suggested_response: string | null
          body: string
          created_at: string
          escalated_to_human: boolean | null
          id: string
          last_message_at: string | null
          organization_id: string
          priority: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_classification?: string | null
          ai_confidence?: number | null
          ai_suggested_response?: string | null
          body: string
          created_at?: string
          escalated_to_human?: boolean | null
          id?: string
          last_message_at?: string | null
          organization_id: string
          priority?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_classification?: string | null
          ai_confidence?: number | null
          ai_suggested_response?: string | null
          body?: string
          created_at?: string
          escalated_to_human?: boolean | null
          id?: string
          last_message_at?: string | null
          organization_id?: string
          priority?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'support_tickets_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      system_auto_updates: {
        Row: {
          affected_areas: string[] | null
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          apply_result: Json | null
          change_type: string
          created_at: string
          detected_by: string
          id: string
          proposed_payload: Json
          rationale: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string
          rollback_payload: Json | null
          status: string
          summary: string
          title: string
          triggered_by_doc_id: string | null
          updated_at: string
        }
        Insert: {
          affected_areas?: string[] | null
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          apply_result?: Json | null
          change_type: string
          created_at?: string
          detected_by?: string
          id?: string
          proposed_payload?: Json
          rationale: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          rollback_payload?: Json | null
          status?: string
          summary: string
          title: string
          triggered_by_doc_id?: string | null
          updated_at?: string
        }
        Update: {
          affected_areas?: string[] | null
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          apply_result?: Json | null
          change_type?: string
          created_at?: string
          detected_by?: string
          id?: string
          proposed_payload?: Json
          rationale?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          rollback_payload?: Json | null
          status?: string
          summary?: string
          title?: string
          triggered_by_doc_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'system_auto_updates_triggered_by_doc_id_fkey'
            columns: ['triggered_by_doc_id']
            isOneToOne: false
            referencedRelation: 'regulatory_documents'
            referencedColumns: ['id']
          },
        ]
      }
      telegram_bot_interactions: {
        Row: {
          ai_cost_eur: number | null
          bot_response: string | null
          callback_data: string | null
          chat_id: number
          command_name: string | null
          created_at: string
          error_message: string | null
          id: string
          message_id: number | null
          succeeded: boolean | null
          tool_uses: Json | null
          type: string
          user_id: string | null
          user_message: string | null
        }
        Insert: {
          ai_cost_eur?: number | null
          bot_response?: string | null
          callback_data?: string | null
          chat_id: number
          command_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: number | null
          succeeded?: boolean | null
          tool_uses?: Json | null
          type: string
          user_id?: string | null
          user_message?: string | null
        }
        Update: {
          ai_cost_eur?: number | null
          bot_response?: string | null
          callback_data?: string | null
          chat_id?: number
          command_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: number | null
          succeeded?: boolean | null
          tool_uses?: Json | null
          type?: string
          user_id?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      upsell_suggestions: {
        Row: {
          brevo_message_id: string | null
          clicked_at: string | null
          context_json: Json
          conversion_value_cents: number | null
          converted_at: string | null
          created_at: string
          dismissed_at: string | null
          email_clicked_at: string | null
          email_opened_at: string | null
          email_sent_at: string | null
          email_template_slug: string | null
          email_unsubscribed_at: string | null
          estimated_value_eur: number | null
          id: string
          organization_id: string | null
          priority: number
          reason_benefit: string | null
          reason_label: string | null
          shown_email_at: string | null
          shown_in_app_at: string | null
          status: string
          suggested_at: string
          suggested_target: string | null
          suggestion_type: string | null
          surfaced_at: string | null
          target_addon_module_id: string | null
          target_plan_code: string | null
          trigger_event: string
          user_id: string
        }
        Insert: {
          brevo_message_id?: string | null
          clicked_at?: string | null
          context_json?: Json
          conversion_value_cents?: number | null
          converted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          email_clicked_at?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          email_template_slug?: string | null
          email_unsubscribed_at?: string | null
          estimated_value_eur?: number | null
          id?: string
          organization_id?: string | null
          priority?: number
          reason_benefit?: string | null
          reason_label?: string | null
          shown_email_at?: string | null
          shown_in_app_at?: string | null
          status?: string
          suggested_at?: string
          suggested_target?: string | null
          suggestion_type?: string | null
          surfaced_at?: string | null
          target_addon_module_id?: string | null
          target_plan_code?: string | null
          trigger_event: string
          user_id: string
        }
        Update: {
          brevo_message_id?: string | null
          clicked_at?: string | null
          context_json?: Json
          conversion_value_cents?: number | null
          converted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          email_clicked_at?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          email_template_slug?: string | null
          email_unsubscribed_at?: string | null
          estimated_value_eur?: number | null
          id?: string
          organization_id?: string | null
          priority?: number
          reason_benefit?: string | null
          reason_label?: string | null
          shown_email_at?: string | null
          shown_in_app_at?: string | null
          status?: string
          suggested_at?: string
          suggested_target?: string | null
          suggestion_type?: string | null
          surfaced_at?: string | null
          target_addon_module_id?: string | null
          target_plan_code?: string | null
          trigger_event?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'upsell_suggestions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'upsell_suggestions_target_addon_module_id_fkey'
            columns: ['target_addon_module_id']
            isOneToOne: false
            referencedRelation: 'addon_modules'
            referencedColumns: ['id']
          },
        ]
      }
      user_addons: {
        Row: {
          addon_module_id: string
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          organization_id: string
          started_at: string
          status: string
          subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          addon_module_id: string
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          started_at?: string
          status?: string
          subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          addon_module_id?: string
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          started_at?: string
          status?: string
          subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_addons_addon_module_id_fkey'
            columns: ['addon_module_id']
            isOneToOne: false
            referencedRelation: 'addon_modules'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_addons_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_addons_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
        ]
      }
      user_admin_tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          tag?: string
          user_id?: string
        }
        Relationships: []
      }
      user_behavior_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_behavior_events_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      user_credits: {
        Row: {
          balance_eur_cents: number
          last_updated_at: string
          total_earned_eur_cents: number
          total_spent_eur_cents: number
          user_id: string
        }
        Insert: {
          balance_eur_cents?: number
          last_updated_at?: string
          total_earned_eur_cents?: number
          total_spent_eur_cents?: number
          user_id: string
        }
        Update: {
          balance_eur_cents?: number
          last_updated_at?: string
          total_earned_eur_cents?: number
          total_spent_eur_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_credits_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_duration_coefficients: {
        Row: {
          coef_amiante: number
          coef_carrez: number
          coef_dpe: number
          coef_elec: number
          coef_gaz: number
          coef_plomb: number
          coef_termites: number
          enabled: boolean
          global_coefficient: number
          last_calculated_at: string | null
          sample_size_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coef_amiante?: number
          coef_carrez?: number
          coef_dpe?: number
          coef_elec?: number
          coef_gaz?: number
          coef_plomb?: number
          coef_termites?: number
          enabled?: boolean
          global_coefficient?: number
          last_calculated_at?: string | null
          sample_size_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coef_amiante?: number
          coef_carrez?: number
          coef_dpe?: number
          coef_elec?: number
          coef_gaz?: number
          coef_plomb?: number
          coef_termites?: number
          enabled?: boolean
          global_coefficient?: number
          last_calculated_at?: string | null
          sample_size_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_level_history: {
        Row: {
          from_level: number
          id: string
          reason: string | null
          to_level: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          from_level: number
          id?: string
          reason?: string | null
          to_level: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          from_level?: number
          id?: string
          reason?: string | null
          to_level?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_level_history_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_preferences: {
        Row: {
          auto_clustering_suggestions: boolean
          created_at: string
          daily_briefing_enabled: boolean
          email_marketing_enabled: boolean
          email_notifications_enabled: boolean
          follow_up_opt_out_at: string | null
          locale: string
          marketing_emails_enabled: boolean
          monthly_report_enabled: boolean
          personal_coefficient_enabled: boolean
          preferences_json: Json
          push_notifications_enabled: boolean
          scheduling_buffer_minutes: number
          skip_weekends: boolean
          sms_marketing_enabled: boolean
          sms_notifications_enabled: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
          weekly_summary_enabled: boolean
        }
        Insert: {
          auto_clustering_suggestions?: boolean
          created_at?: string
          daily_briefing_enabled?: boolean
          email_marketing_enabled?: boolean
          email_notifications_enabled?: boolean
          follow_up_opt_out_at?: string | null
          locale?: string
          marketing_emails_enabled?: boolean
          monthly_report_enabled?: boolean
          personal_coefficient_enabled?: boolean
          preferences_json?: Json
          push_notifications_enabled?: boolean
          scheduling_buffer_minutes?: number
          skip_weekends?: boolean
          sms_marketing_enabled?: boolean
          sms_notifications_enabled?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_summary_enabled?: boolean
        }
        Update: {
          auto_clustering_suggestions?: boolean
          created_at?: string
          daily_briefing_enabled?: boolean
          email_marketing_enabled?: boolean
          email_notifications_enabled?: boolean
          follow_up_opt_out_at?: string | null
          locale?: string
          marketing_emails_enabled?: boolean
          monthly_report_enabled?: boolean
          personal_coefficient_enabled?: boolean
          preferences_json?: Json
          push_notifications_enabled?: boolean
          scheduling_buffer_minutes?: number
          skip_weekends?: boolean
          sms_marketing_enabled?: boolean
          sms_notifications_enabled?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_summary_enabled?: boolean
        }
        Relationships: []
      }
      user_pricing_config: {
        Row: {
          applied_template: string | null
          created_at: string
          display_mode: string
          has_configured: boolean
          organization_id: string
          pricing_config: Json
          template_applied_at: string | null
          updated_at: string
          user_id: string
          vat_rate: number
          vat_status: string
        }
        Insert: {
          applied_template?: string | null
          created_at?: string
          display_mode?: string
          has_configured?: boolean
          organization_id: string
          pricing_config?: Json
          template_applied_at?: string | null
          updated_at?: string
          user_id: string
          vat_rate?: number
          vat_status?: string
        }
        Update: {
          applied_template?: string | null
          created_at?: string
          display_mode?: string
          has_configured?: boolean
          organization_id?: string
          pricing_config?: Json
          template_applied_at?: string | null
          updated_at?: string
          user_id?: string
          vat_rate?: number
          vat_status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_pricing_config_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      user_pricing_packs: {
        Row: {
          applicable_for: string[] | null
          created_at: string
          description: string | null
          diagnostics: string[]
          id: string
          is_active: boolean
          min_property_age: number | null
          name: string
          organization_id: string
          predefined_pack_id: string | null
          price_ht: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applicable_for?: string[] | null
          created_at?: string
          description?: string | null
          diagnostics: string[]
          id?: string
          is_active?: boolean
          min_property_age?: number | null
          name: string
          organization_id: string
          predefined_pack_id?: string | null
          price_ht: number
          updated_at?: string
          user_id: string
        }
        Update: {
          applicable_for?: string[] | null
          created_at?: string
          description?: string | null
          diagnostics?: string[]
          id?: string
          is_active?: boolean
          min_property_age?: number | null
          name?: string
          organization_id?: string
          predefined_pack_id?: string | null
          price_ht?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_pricing_packs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      user_progression: {
        Row: {
          ademe_export_score: number | null
          current_level: number
          current_level_unlocked_at: string
          last_recomputed_at: string
          subscription_age_days: number
          total_missions: number
          total_referrals_paid: number
          user_id: string
        }
        Insert: {
          ademe_export_score?: number | null
          current_level?: number
          current_level_unlocked_at?: string
          last_recomputed_at?: string
          subscription_age_days?: number
          total_missions?: number
          total_referrals_paid?: number
          user_id: string
        }
        Update: {
          ademe_export_score?: number | null
          current_level?: number
          current_level_unlocked_at?: string
          last_recomputed_at?: string
          subscription_age_days?: number
          total_missions?: number
          total_referrals_paid?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_progression_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_scan_quotas: {
        Row: {
          current_period_start: string
          last_reset_at: string
          overage_cost_eur: number
          overage_price_per_scan: number | null
          overage_scans: number
          plan_id: string | null
          scans_included: number
          scans_used_this_period: number
          user_id: string
        }
        Insert: {
          current_period_start?: string
          last_reset_at?: string
          overage_cost_eur?: number
          overage_price_per_scan?: number | null
          overage_scans?: number
          plan_id?: string | null
          scans_included: number
          scans_used_this_period?: number
          user_id: string
        }
        Update: {
          current_period_start?: string
          last_reset_at?: string
          overage_cost_eur?: number
          overage_price_per_scan?: number | null
          overage_scans?: number
          plan_id?: string | null
          scans_included?: number
          scans_used_this_period?: number
          user_id?: string
        }
        Relationships: []
      }
      user_usage_quotas: {
        Row: {
          alert_100pct_sent_at: string | null
          alert_80pct_sent_at: string | null
          auto_overflow_enabled: boolean
          billed_at: string | null
          chatbot_messages_quota: number
          chatbot_messages_used: number
          chatbot_overflow_amount_cents: number
          chatbot_overflow_count: number
          geocoding_overflow_amount_cents: number
          geocoding_overflow_count: number
          geocoding_requests_quota: number
          geocoding_requests_used: number
          id: string
          missions_overflow_amount_cents: number
          missions_overflow_count: number
          missions_quota: number
          missions_used: number
          organization_id: string
          period_month: string
          storage_gb_quota: number
          storage_gb_used: number
          storage_overflow_amount_cents: number
          storage_overflow_gb: number
          stripe_usage_record_id: string | null
          updated_at: string
          yousign_overflow_amount_cents: number
          yousign_overflow_count: number
          yousign_signatures_quota: number
          yousign_signatures_used: number
        }
        Insert: {
          alert_100pct_sent_at?: string | null
          alert_80pct_sent_at?: string | null
          auto_overflow_enabled?: boolean
          billed_at?: string | null
          chatbot_messages_quota: number
          chatbot_messages_used?: number
          chatbot_overflow_amount_cents?: number
          chatbot_overflow_count?: number
          geocoding_overflow_amount_cents?: number
          geocoding_overflow_count?: number
          geocoding_requests_quota: number
          geocoding_requests_used?: number
          id?: string
          missions_overflow_amount_cents?: number
          missions_overflow_count?: number
          missions_quota: number
          missions_used?: number
          organization_id: string
          period_month: string
          storage_gb_quota: number
          storage_gb_used?: number
          storage_overflow_amount_cents?: number
          storage_overflow_gb?: number
          stripe_usage_record_id?: string | null
          updated_at?: string
          yousign_overflow_amount_cents?: number
          yousign_overflow_count?: number
          yousign_signatures_quota: number
          yousign_signatures_used?: number
        }
        Update: {
          alert_100pct_sent_at?: string | null
          alert_80pct_sent_at?: string | null
          auto_overflow_enabled?: boolean
          billed_at?: string | null
          chatbot_messages_quota?: number
          chatbot_messages_used?: number
          chatbot_overflow_amount_cents?: number
          chatbot_overflow_count?: number
          geocoding_overflow_amount_cents?: number
          geocoding_overflow_count?: number
          geocoding_requests_quota?: number
          geocoding_requests_used?: number
          id?: string
          missions_overflow_amount_cents?: number
          missions_overflow_count?: number
          missions_quota?: number
          missions_used?: number
          organization_id?: string
          period_month?: string
          storage_gb_quota?: number
          storage_gb_used?: number
          storage_overflow_amount_cents?: number
          storage_overflow_gb?: number
          stripe_usage_record_id?: string | null
          updated_at?: string
          yousign_overflow_amount_cents?: number
          yousign_overflow_count?: number
          yousign_signatures_quota?: number
          yousign_signatures_used?: number
        }
        Relationships: [
          {
            foreignKeyName: 'user_usage_quotas_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      utilities_usage: {
        Row: {
          context: Json | null
          id: string
          organization_id: string | null
          used_at: string
          user_id: string
          utility: string
        }
        Insert: {
          context?: Json | null
          id?: string
          organization_id?: string | null
          used_at?: string
          user_id: string
          utility: string
        }
        Update: {
          context?: Json | null
          id?: string
          organization_id?: string | null
          used_at?: string
          user_id?: string
          utility?: string
        }
        Relationships: [
          {
            foreignKeyName: 'utilities_usage_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      veille_articles_draft: {
        Row: {
          ai_cost_eur: number
          ai_generated_at: string
          ai_input_tokens: number
          ai_model: string
          ai_output_tokens: number
          category: string
          content_markdown: string
          created_at: string
          eeat_authoritativeness: number
          eeat_experience: number
          eeat_expertise: number
          eeat_score: number | null
          eeat_trustworthiness: number
          excerpt: string | null
          faq_questions_count: number
          h2_count: number
          h3_count: number
          hero_image_url: string | null
          id: string
          internal_links_count: number
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          rejected_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          source_citations_count: number
          status: string
          tags: string[]
          target_keyword: string
          title: string
          topic: string
          updated_at: string
          word_count: number
        }
        Insert: {
          ai_cost_eur?: number
          ai_generated_at?: string
          ai_input_tokens?: number
          ai_model?: string
          ai_output_tokens?: number
          category?: string
          content_markdown: string
          created_at?: string
          eeat_authoritativeness?: number
          eeat_experience?: number
          eeat_expertise?: number
          eeat_score?: number | null
          eeat_trustworthiness?: number
          excerpt?: string | null
          faq_questions_count?: number
          h2_count?: number
          h3_count?: number
          hero_image_url?: string | null
          id?: string
          internal_links_count?: number
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          rejected_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          source_citations_count?: number
          status?: string
          tags?: string[]
          target_keyword: string
          title: string
          topic: string
          updated_at?: string
          word_count?: number
        }
        Update: {
          ai_cost_eur?: number
          ai_generated_at?: string
          ai_input_tokens?: number
          ai_model?: string
          ai_output_tokens?: number
          category?: string
          content_markdown?: string
          created_at?: string
          eeat_authoritativeness?: number
          eeat_experience?: number
          eeat_expertise?: number
          eeat_score?: number | null
          eeat_trustworthiness?: number
          excerpt?: string | null
          faq_questions_count?: number
          h2_count?: number
          h3_count?: number
          hero_image_url?: string | null
          id?: string
          internal_links_count?: number
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          rejected_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          source_citations_count?: number
          status?: string
          tags?: string[]
          target_keyword?: string
          title?: string
          topic?: string
          updated_at?: string
          word_count?: number
        }
        Relationships: []
      }
      veille_keywords_priority: {
        Row: {
          category: string
          created_at: string
          estimated_volume: number | null
          generation_count: number
          id: string
          is_active: boolean
          keyword: string
          last_generated_at: string | null
          priority: number
          topic: string
        }
        Insert: {
          category?: string
          created_at?: string
          estimated_volume?: number | null
          generation_count?: number
          id?: string
          is_active?: boolean
          keyword: string
          last_generated_at?: string | null
          priority?: number
          topic: string
        }
        Update: {
          category?: string
          created_at?: string
          estimated_volume?: number | null
          generation_count?: number
          id?: string
          is_active?: boolean
          keyword?: string
          last_generated_at?: string | null
          priority?: number
          topic?: string
        }
        Relationships: []
      }
      verification_alerts_queue: {
        Row: {
          alert_type: string
          created_at: string
          diagnostician_id: string
          email_sent_at: string | null
          id: string
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          diagnostician_id: string
          email_sent_at?: string | null
          id?: string
          resolved_at?: string | null
          severity: string
          status?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          diagnostician_id?: string
          email_sent_at?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'verification_alerts_queue_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_alerts_queue_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'verification_alerts_queue_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_alerts_queue_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_alerts_queue_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      verification_checks_log: {
        Row: {
          check_source: string
          check_type: string
          diagnostician_id: string
          duration_ms: number | null
          id: string
          performed_at: string
          result: Json | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          check_source: string
          check_type: string
          diagnostician_id: string
          duration_ms?: number | null
          id?: string
          performed_at?: string
          result?: Json | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          check_source?: string
          check_type?: string
          diagnostician_id?: string
          duration_ms?: number | null
          id?: string
          performed_at?: string
          result?: Json | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'verification_checks_log_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_checks_log_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'verification_checks_log_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_checks_log_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_checks_log_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      verification_documents: {
        Row: {
          ai_confidence_score: number | null
          ai_extracted_data: Json | null
          diagnostician_id: string
          doc_type: string
          id: string
          notes: string | null
          storage_path: string
          uploaded_at: string
          validated_at: string | null
          validated_by_admin: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_extracted_data?: Json | null
          diagnostician_id: string
          doc_type: string
          id?: string
          notes?: string | null
          storage_path: string
          uploaded_at?: string
          validated_at?: string | null
          validated_by_admin?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          ai_extracted_data?: Json | null
          diagnostician_id?: string
          doc_type?: string
          id?: string
          notes?: string | null
          storage_path?: string
          uploaded_at?: string
          validated_at?: string | null
          validated_by_admin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'verification_documents_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_documents_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'verification_documents_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_documents_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'verification_documents_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      vision_analysis_cache: {
        Row: {
          analysis_result: Json
          created_at: string
          id: string
          model_used: string
          perceptual_hash: string
          reused_count: number
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          analysis_result: Json
          created_at?: string
          id?: string
          model_used: string
          perceptual_hash: string
          reused_count?: number
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          analysis_result?: Json
          created_at?: string
          id?: string
          model_used?: string
          perceptual_hash?: string
          reused_count?: number
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: []
      }
      vision_cache: {
        Row: {
          analysis: Json
          cost_savings_usd: number | null
          created_at: string
          diagnostics_signature: string
          expires_at: string
          full_hash: string
          hit_count: number
          id: string
          perceptual_hash_prefix: string
        }
        Insert: {
          analysis: Json
          cost_savings_usd?: number | null
          created_at?: string
          diagnostics_signature: string
          expires_at?: string
          full_hash: string
          hit_count?: number
          id?: string
          perceptual_hash_prefix: string
        }
        Update: {
          analysis?: Json
          cost_savings_usd?: number | null
          created_at?: string
          diagnostics_signature?: string
          expires_at?: string
          full_hash?: string
          hit_count?: number
          id?: string
          perceptual_hash_prefix?: string
        }
        Relationships: []
      }
      vision_corrections: {
        Row: {
          ai_brand: string | null
          ai_confidence: number | null
          ai_model: string
          ai_model_eq: string | null
          ai_provider: string
          corrected_at: string
          id: string
          mission_id: string
          organization_id: string
          photo_id: string
          training_session_id: string | null
          used_in_training: boolean | null
          user_brand: string | null
          user_id: string
          user_model_eq: string | null
          user_notes: string | null
        }
        Insert: {
          ai_brand?: string | null
          ai_confidence?: number | null
          ai_model: string
          ai_model_eq?: string | null
          ai_provider: string
          corrected_at?: string
          id?: string
          mission_id: string
          organization_id: string
          photo_id: string
          training_session_id?: string | null
          used_in_training?: boolean | null
          user_brand?: string | null
          user_id: string
          user_model_eq?: string | null
          user_notes?: string | null
        }
        Update: {
          ai_brand?: string | null
          ai_confidence?: number | null
          ai_model?: string
          ai_model_eq?: string | null
          ai_provider?: string
          corrected_at?: string
          id?: string
          mission_id?: string
          organization_id?: string
          photo_id?: string
          training_session_id?: string | null
          used_in_training?: boolean | null
          user_brand?: string | null
          user_id?: string
          user_model_eq?: string | null
          user_notes?: string | null
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          ai_confidence: number | null
          ai_cost_eur: number | null
          attached_photo_id: string | null
          created_at: string
          dossier_id: string
          duration_seconds: number | null
          edited_transcription: string | null
          file_size_bytes: number | null
          id: string
          language: string | null
          organization_id: string
          parser_used: string | null
          provider: string | null
          recorded_by: string | null
          room_id: string | null
          status: string
          storage_path: string
          transcribed_at: string | null
          transcript_raw: string | null
          transcript_structured: Json | null
          transcription_confidence: number | null
          transcription_cost_usd: number | null
          transcription_model: string | null
          transcription_status: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          attached_photo_id?: string | null
          created_at?: string
          dossier_id: string
          duration_seconds?: number | null
          edited_transcription?: string | null
          file_size_bytes?: number | null
          id?: string
          language?: string | null
          organization_id: string
          parser_used?: string | null
          provider?: string | null
          recorded_by?: string | null
          room_id?: string | null
          status?: string
          storage_path: string
          transcribed_at?: string | null
          transcript_raw?: string | null
          transcript_structured?: Json | null
          transcription_confidence?: number | null
          transcription_cost_usd?: number | null
          transcription_model?: string | null
          transcription_status?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          attached_photo_id?: string | null
          created_at?: string
          dossier_id?: string
          duration_seconds?: number | null
          edited_transcription?: string | null
          file_size_bytes?: number | null
          id?: string
          language?: string | null
          organization_id?: string
          parser_used?: string | null
          provider?: string | null
          recorded_by?: string | null
          room_id?: string | null
          status?: string
          storage_path?: string
          transcribed_at?: string | null
          transcript_raw?: string | null
          transcript_structured?: Json | null
          transcription_confidence?: number | null
          transcription_cost_usd?: number | null
          transcription_model?: string | null
          transcription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'voice_notes_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'voice_notes_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'voice_notes_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'dossier_rooms'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      ab_experiment_results: {
        Row: {
          clicks: number | null
          conversion_rate_pct: number | null
          conversions: number | null
          experiment_id: string | null
          exposures: number | null
          submits: number | null
          variant_assigned: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ab_events_experiment_id_fkey'
            columns: ['experiment_id']
            isOneToOne: false
            referencedRelation: 'ab_experiments'
            referencedColumns: ['id']
          },
        ]
      }
      admin_city_stats_queue: {
        Row: {
          city_name: string | null
          city_slug: string | null
          dept_code: string | null
          health_status: string | null
          insee_code: string | null
          last_error: string | null
          last_refreshed_at: string | null
          next_refresh_due: string | null
          refresh_status: string | null
          sources_count: number | null
          total_dpe_count: number | null
        }
        Insert: {
          city_name?: string | null
          city_slug?: string | null
          dept_code?: string | null
          health_status?: never
          insee_code?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          next_refresh_due?: string | null
          refresh_status?: string | null
          sources_count?: never
          total_dpe_count?: number | null
        }
        Update: {
          city_name?: string | null
          city_slug?: string | null
          dept_code?: string | null
          health_status?: never
          insee_code?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          next_refresh_due?: string | null
          refresh_status?: string | null
          sources_count?: never
          total_dpe_count?: number | null
        }
        Relationships: []
      }
      admin_verification_queue: {
        Row: {
          badge_level: string | null
          city: string | null
          cofrac_status: string | null
          full_name: string | null
          id: string | null
          identity_status: string | null
          last_activity_at: string | null
          manual_review_priority: number | null
          overall_status: string | null
          rcpro_status: string | null
          signalements_count: number | null
          sirene_status: string | null
          verification_started_at: string | null
        }
        Relationships: []
      }
      cron_job_runs_recent: {
        Row: {
          duration_seconds: number | null
          end_time: string | null
          jobid: number | null
          jobname: string | null
          return_message: string | null
          runid: number | null
          schedule: string | null
          start_time: string | null
          status: string | null
        }
        Relationships: []
      }
      diagnostician_email_next_step: {
        Row: {
          claim_status: string | null
          diagnostician_id: string | null
          email: string | null
          next_step: number | null
          pre_notification_email_1_sent_at: string | null
          pre_notification_email_2_sent_at: string | null
          pre_notification_email_3_sent_at: string | null
          unsubscribed: boolean | null
          withdrawal_requested: boolean | null
        }
        Insert: {
          claim_status?: string | null
          diagnostician_id?: string | null
          email?: string | null
          next_step?: never
          pre_notification_email_1_sent_at?: string | null
          pre_notification_email_2_sent_at?: string | null
          pre_notification_email_3_sent_at?: string | null
          unsubscribed?: boolean | null
          withdrawal_requested?: boolean | null
        }
        Update: {
          claim_status?: string | null
          diagnostician_id?: string | null
          email?: string | null
          next_step?: never
          pre_notification_email_1_sent_at?: string | null
          pre_notification_email_2_sent_at?: string | null
          pre_notification_email_3_sent_at?: string | null
          unsubscribed?: boolean | null
          withdrawal_requested?: boolean | null
        }
        Relationships: []
      }
      diagnosticians_top_departments: {
        Row: {
          below_threshold: number | null
          dept_code: string | null
          total: number | null
          verified: number | null
        }
        Relationships: []
      }
      diagnosticians_verify_health: {
        Row: {
          avg_activity_score: number | null
          ceased_24h: number | null
          fraud_flags_24h: number | null
          last_cron_run_at: string | null
          last_cron_status: string | null
          logs_24h: number | null
          overdue_30d: number | null
          total_below_threshold: number | null
          total_ceased: number | null
          total_diagnosticians: number | null
          total_fraud_flagged: number | null
          total_gmb_enriched: number | null
          total_pending: number | null
          total_sirene_active: number | null
          total_suspended: number | null
          total_verified: number | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      invoices_active: {
        Row: {
          amount_ht: number | null
          amount_ttc: number | null
          amount_tva: number | null
          archived_at: string | null
          client_id: string | null
          client_snapshot: Json | null
          created_at: string | null
          deleted_at: string | null
          due_date: string | null
          facturx_profile: string | null
          facturx_xml: string | null
          id: string | null
          issued_at: string | null
          line_items: Json | null
          mission_id: string | null
          organization_id: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          pdf_path: string | null
          ppf_status: string | null
          ppf_transmission_id: string | null
          qonto_invoice_id: string | null
          qonto_synced_at: string | null
          quote_id: string | null
          reference: string | null
          reminder_j15_sent_at: string | null
          reminder_j30_sent_at: string | null
          reminder_j7_sent_at: string | null
          status: string | null
          stripe_payment_intent: string | null
          tva_rate: number | null
          updated_at: string | null
        }
        Insert: {
          amount_ht?: number | null
          amount_ttc?: number | null
          amount_tva?: number | null
          archived_at?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string | null
          facturx_profile?: string | null
          facturx_xml?: string | null
          id?: string | null
          issued_at?: string | null
          line_items?: Json | null
          mission_id?: string | null
          organization_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          ppf_status?: string | null
          ppf_transmission_id?: string | null
          qonto_invoice_id?: string | null
          qonto_synced_at?: string | null
          quote_id?: string | null
          reference?: string | null
          reminder_j15_sent_at?: string | null
          reminder_j30_sent_at?: string | null
          reminder_j7_sent_at?: string | null
          status?: string | null
          stripe_payment_intent?: string | null
          tva_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_ht?: number | null
          amount_ttc?: number | null
          amount_tva?: number | null
          archived_at?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string | null
          facturx_profile?: string | null
          facturx_xml?: string | null
          id?: string | null
          issued_at?: string | null
          line_items?: Json | null
          mission_id?: string | null
          organization_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          ppf_status?: string | null
          ppf_transmission_id?: string | null
          qonto_invoice_id?: string | null
          qonto_synced_at?: string | null
          quote_id?: string | null
          reference?: string | null
          reminder_j15_sent_at?: string | null
          reminder_j30_sent_at?: string | null
          reminder_j7_sent_at?: string | null
          status?: string | null
          stripe_payment_intent?: string | null
          tva_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
        ]
      }
      launch_offer_status: {
        Row: {
          is_available: boolean | null
          positions_remaining: number | null
          positions_taken: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          acceptance_count: number | null
          close_reason: string | null
          closed_at: string | null
          created_at: string | null
          diag_notified_at: string | null
          diag_responded_at: string | null
          diagnostician_id: string | null
          diagnostics_requested: string[] | null
          diagnostics_suggested: Json | null
          estimated_class: string | null
          factors_json: Json | null
          honeypot_filled: boolean | null
          id: string | null
          ip_address: unknown
          message: string | null
          otp_attempts: number | null
          otp_verified_at: string | null
          property_address: string | null
          property_city: string | null
          property_geo_lat: number | null
          property_geo_lng: number | null
          property_postal_code: string | null
          property_situation: string | null
          property_surface_m2: number | null
          property_type: string | null
          property_year_built: number | null
          recaptcha_score: number | null
          requester_email: string | null
          requester_first_name: string | null
          requester_last_name: string | null
          requester_phone: string | null
          routed_at: string | null
          routing_metadata: Json | null
          routing_strategy: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          acceptance_count?: number | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string | null
          diag_notified_at?: string | null
          diag_responded_at?: string | null
          diagnostician_id?: string | null
          diagnostics_requested?: string[] | null
          diagnostics_suggested?: Json | null
          estimated_class?: string | null
          factors_json?: Json | null
          honeypot_filled?: boolean | null
          id?: string | null
          ip_address?: unknown
          message?: string | null
          otp_attempts?: number | null
          otp_verified_at?: string | null
          property_address?: string | null
          property_city?: string | null
          property_geo_lat?: number | null
          property_geo_lng?: number | null
          property_postal_code?: string | null
          property_situation?: string | null
          property_surface_m2?: number | null
          property_type?: string | null
          property_year_built?: number | null
          recaptcha_score?: number | null
          requester_email?: string | null
          requester_first_name?: string | null
          requester_last_name?: string | null
          requester_phone?: string | null
          routed_at?: string | null
          routing_metadata?: Json | null
          routing_strategy?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          acceptance_count?: number | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string | null
          diag_notified_at?: string | null
          diag_responded_at?: string | null
          diagnostician_id?: string | null
          diagnostics_requested?: string[] | null
          diagnostics_suggested?: Json | null
          estimated_class?: string | null
          factors_json?: Json | null
          honeypot_filled?: boolean | null
          id?: string | null
          ip_address?: unknown
          message?: string | null
          otp_attempts?: number | null
          otp_verified_at?: string | null
          property_address?: string | null
          property_city?: string | null
          property_geo_lat?: number | null
          property_geo_lng?: number | null
          property_postal_code?: string | null
          property_situation?: string | null
          property_surface_m2?: number | null
          property_type?: string | null
          property_year_built?: number | null
          recaptcha_score?: number | null
          requester_email?: string | null
          requester_first_name?: string | null
          requester_last_name?: string | null
          requester_phone?: string | null
          routed_at?: string | null
          routing_metadata?: Json | null
          routing_strategy?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'admin_verification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnostician_email_next_step'
            referencedColumns: ['diagnostician_id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'diagnosticians'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_listing_level'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_requests_diagnostician_id_fkey'
            columns: ['diagnostician_id']
            isOneToOne: false
            referencedRelation: 'v_diagnostician_routing_score'
            referencedColumns: ['id']
          },
        ]
      }
      monthly_mission_counts: {
        Row: {
          missions_count: number | null
          month: string | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'missions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      referral_clicks_per_code: {
        Row: {
          clicks_30d: number | null
          code: string | null
          conversions: number | null
          last_click_at: string | null
          referrer_id: string | null
          total_clicks: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'referral_codes_user_id_fkey'
            columns: ['referrer_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      referral_stats_per_user: {
        Row: {
          active: boolean | null
          code: string | null
          total_earned_eur_cents: number | null
          total_paid: number | null
          total_referred: number | null
          total_rewarded: number | null
          total_subscribed: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'referral_codes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      v_diagnostician_listing_level: {
        Row: {
          claim_status: string | null
          claimed_by_user_id: string | null
          id: string | null
          listing_level: string | null
          plan_code: string | null
          slug: string | null
          subscription_status: string | null
          tier: string | null
        }
        Relationships: []
      }
      v_diagnostician_routing_score: {
        Row: {
          certifications: Json | null
          city: string | null
          claimed_by_user_id: string | null
          department_code: string | null
          geo_lat: number | null
          geo_lng: number | null
          ghost_status: string | null
          gmb_rating: number | null
          gmb_review_count: number | null
          id: string | null
          intervention_radius_km: number | null
          manual_pause_until: string | null
          postal_code: string | null
          recipient_tier: string | null
          routing_score: number | null
          slug: string | null
        }
        Insert: {
          certifications?: Json | null
          city?: string | null
          claimed_by_user_id?: string | null
          department_code?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          ghost_status?: string | null
          gmb_rating?: number | null
          gmb_review_count?: number | null
          id?: string | null
          intervention_radius_km?: number | null
          manual_pause_until?: string | null
          postal_code?: string | null
          recipient_tier?: never
          routing_score?: never
          slug?: string | null
        }
        Update: {
          certifications?: Json | null
          city?: string | null
          claimed_by_user_id?: string | null
          department_code?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          ghost_status?: string | null
          gmb_rating?: number | null
          gmb_review_count?: number | null
          id?: string | null
          intervention_radius_km?: number | null
          manual_pause_until?: string | null
          postal_code?: string | null
          recipient_tier?: never
          routing_score?: never
          slug?: string | null
        }
        Relationships: []
      }
      v_prescriber_silence: {
        Row: {
          contact_id: string | null
          id: string | null
          last_contact_at: string | null
          organization_id: string | null
          silent_since_days: number | null
        }
        Insert: {
          contact_id?: string | null
          id?: string | null
          last_contact_at?: string | null
          organization_id?: string | null
          silent_since_days?: never
        }
        Update: {
          contact_id?: string | null
          id?: string | null
          last_contact_at?: string | null
          organization_id?: string | null
          silent_since_days?: never
        }
        Relationships: [
          {
            foreignKeyName: 'prescriber_relationships_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prescriber_relationships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      v_sponsored_slot_availability: {
        Row: {
          active_subscriptions: number | null
          annual_price_cents: number | null
          city_inseecode: string | null
          city_label: string | null
          department_code: string | null
          monthly_price_cents: number | null
          population: number | null
          slot_capacity: number | null
          slot_code: string | null
          slots_remaining: number | null
          sponsored_slot_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ''?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { '': string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      anonymize_community_case: {
        Args: {
          p_context: string
          p_decision: string
          p_justification: string
          p_question: string
        }
        Returns: Json
      }
      apply_client_merges: { Args: { p_job_id: string }; Returns: undefined }
      apply_copropriete_merges: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      apply_property_merges: { Args: { p_job_id: string }; Returns: undefined }
      bandit_apply_decay: { Args: never; Returns: number }
      bandit_record_event: {
        Args: {
          p_city_slug?: string
          p_diagnostician_id: string
          p_event_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      check_otp_rate_limit: { Args: { p_phone: string }; Returns: boolean }
      check_quote_request_rate_limit: {
        Args: { p_ip: unknown; p_window_minutes?: number }
        Returns: number
      }
      commit_import_job: { Args: { p_job_id: string }; Returns: Json }
      compute_keyword_score: { Args: { p_keyword_id: string }; Returns: number }
      disablelongtransactions: { Args: never; Returns: string }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      earth: { Args: never; Returns: number }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_current_month_quota_row: {
        Args: { p_organization_id: string }
        Returns: string
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_old_claim_codes: { Args: never; Returns: number }
      expire_pending_lead_assignments: { Args: never; Returns: number }
      find_claimed_non_subscribed_nearby: {
        Args: {
          p_certification_type: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_km: number
        }
        Returns: {
          activity_score: number
          distance_km: number
          full_name: string
          id: string
        }[]
      }
      find_eligible_for_onboarding_gift: {
        Args: {
          p_certification_type: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_km: number
        }
        Returns: {
          activity_score: number
          distance_km: number
          full_name: string
          id: string
        }[]
      }
      find_subscribed_diagnosticians_nearby: {
        Args: {
          p_certification_type: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_km: number
        }
        Returns: {
          activity_score: number
          distance_km: number
          full_name: string
          id: string
        }[]
      }
      fraud_overall_score: {
        Args: { p_diagnostic_scan_id?: string; p_mission_id?: string }
        Returns: {
          flagged: boolean
          overall_score: number
          signal_count: number
        }[]
      }
      generate_credit_note_reference: {
        Args: { p_org_id: string }
        Returns: string
      }
      generate_invoice_reference: {
        Args: { p_org_id: string }
        Returns: string
      }
      generate_quote_reference: { Args: { p_org: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      generate_unique_diag_slug: {
        Args: { p_first: string; p_last: string; p_postal: string }
        Returns: string
      }
      geometry: { Args: { '': string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { '': string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      has_pending_critical_alerts: {
        Args: { p_diagnostician_id: string }
        Returns: boolean
      }
      immutable_unaccent: { Args: { '': string }; Returns: string }
      import_resolve_field_text: {
        Args: { p_choice: Json; p_existing: string; p_new: string }
        Returns: string
      }
      increment_quota_usage: {
        Args: {
          p_column: string
          p_delta?: number
          p_organization_id: string
          p_period_month: string
        }
        Returns: number
      }
      invoice_retention_until: {
        Args: { p_invoice_id: string }
        Returns: string
      }
      invoke_edge_function: {
        Args: { fn_name: string; payload?: Json }
        Returns: Json
      }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_diagnostician_publicly_visible: {
        Args: { p_diagnostician_id: string }
        Returns: boolean
      }
      is_member_of: { Args: { p_org: string }; Returns: boolean }
      log_dossier_event: {
        Args: {
          p_actor_user_id?: string
          p_dossier_id: string
          p_event_data?: Json
          p_event_type: string
        }
        Returns: string
      }
      log_referral_click: {
        Args: {
          p_channel?: string
          p_code: string
          p_ip_hash: string
          p_referer?: string
          p_user_agent?: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      lookup_referral_code: {
        Args: { p_code: string }
        Returns: {
          active: boolean
          referrer_id: string
        }[]
      }
      match_community_cases: {
        Args: { match_count?: number; query_text: string }
        Returns: {
          decision_made: string
          id: string
          justification: string
          question: string
          rank: number
          title: string
          upvotes: number
        }[]
      }
      match_regulatory_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          ai_summary: string
          id: string
          importance: string
          published_at: string
          similarity: number
          title: string
          url: string
        }[]
      }
      month_iso: { Args: { ts: string }; Returns: string }
      next_reference: {
        Args: { p_kind: string; p_org: string }
        Returns: string
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      purge_expired_otp_codes: { Args: never; Returns: number }
      recompute_diag_ghost_status: { Args: never; Returns: Json }
      recompute_diagnostician_activity_score: {
        Args: { p_diagnostician_id?: string; p_limit?: number }
        Returns: {
          ceased: number
          pending: number
          processed: number
          verified: number
        }[]
      }
      record_diag_lead_interaction: {
        Args: {
          p_diagnostician_id: string
          p_event: string
          p_recipient_id: string
        }
        Returns: undefined
      }
      refresh_all_keyword_scores: {
        Args: { p_limit?: number }
        Returns: number
      }
      search_diagnosticians: {
        Args: {
          p_certs?: string[]
          p_city_slug?: string
          p_dept_code?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_offset?: number
          p_query?: string
          p_radius_km?: number
        }
        Returns: {
          certif_valid_count: number
          certifications: Json
          city: string
          city_slug: string
          claim_status: string
          created_at: string
          department_code: string
          distance_km: number
          full_name: string
          gmb_rating: number
          gmb_review_count: number
          id: string
          latitude: number
          longitude: number
          photo_url: string
          postcode: string
          slug: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { '': string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { '': string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { '': string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { '': string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { '': string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { '': string }; Returns: string }
      st_astext: { Args: { '': string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { '': string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { '': string }; Returns: unknown }
      st_geographyfromtext: { Args: { '': string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { '': string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { '': string }; Returns: unknown }
      st_geomfromewkt: { Args: { '': string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { '': Json }; Returns: unknown }
        | { Args: { '': Json }; Returns: unknown }
        | { Args: { '': string }; Returns: unknown }
      st_geomfromgml: { Args: { '': string }; Returns: unknown }
      st_geomfromkml: { Args: { '': string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { '': string }; Returns: unknown }
      st_gmltosql: { Args: { '': string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database['public']['CompositeTypes']['valid_detail']
        SetofOptions: {
          from: '*'
          to: 'valid_detail'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { '': string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { '': string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { '': string }; Returns: unknown }
      st_mpointfromtext: { Args: { '': string }; Returns: unknown }
      st_mpolyfromtext: { Args: { '': string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { '': string }; Returns: unknown }
      st_multipointfromtext: { Args: { '': string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { '': string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { '': string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { '': string }; Returns: unknown }
      st_polygonfromtext: { Args: { '': string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { '': string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trigger_verify_diagnosticians_daily: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: number
      }
      unaccent: { Args: { '': string }; Returns: string }
      unlockrows: { Args: { '': string }; Returns: number }
      update_storage_usage: {
        Args: { p_delta_bytes: number; p_org_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      veille_articles_pick_next_keywords: {
        Args: { limit_count?: number }
        Returns: {
          category: string
          id: string
          keyword: string
          priority: number
          topic: string
        }[]
      }
    }
    Enums: {
      client_type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
      dsar_status: 'pending' | 'processing' | 'completed' | 'rejected'
      dsar_type: 'export' | 'erasure'
      equipment_kind:
        | 'chaudiere'
        | 'chauffe_eau'
        | 'radiateur'
        | 'pac'
        | 'climatisation'
        | 'fenetre'
        | 'isolation'
        | 'ventilation'
        | 'tableau_elec'
        | 'autre'
      mission_status:
        | 'draft'
        | 'scheduled'
        | 'in_progress'
        | 'to_review'
        | 'done'
        | 'exported'
        | 'archived'
        | 'cancelled'
      mission_type:
        | 'dpe_vente'
        | 'dpe_location'
        | 'copropriete'
        | 'amiante_vente'
        | 'amiante_avant_travaux'
        | 'plomb_crep'
        | 'gaz'
        | 'electricite'
        | 'termites'
        | 'carrez_boutin'
        | 'erp'
      payment_provider_kind: 'stripe' | 'gocardless' | 'virement' | 'cb' | 'especes'
      property_type_enum:
        | 'maison'
        | 'appartement'
        | 'immeuble'
        | 'local_commercial'
        | 'bureau'
        | 'autre'
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_type: ['particulier', 'agence', 'notaire', 'syndic', 'entreprise', 'collectivite'],
      dsar_status: ['pending', 'processing', 'completed', 'rejected'],
      dsar_type: ['export', 'erasure'],
      equipment_kind: [
        'chaudiere',
        'chauffe_eau',
        'radiateur',
        'pac',
        'climatisation',
        'fenetre',
        'isolation',
        'ventilation',
        'tableau_elec',
        'autre',
      ],
      mission_status: [
        'draft',
        'scheduled',
        'in_progress',
        'to_review',
        'done',
        'exported',
        'archived',
        'cancelled',
      ],
      mission_type: [
        'dpe_vente',
        'dpe_location',
        'copropriete',
        'amiante_vente',
        'amiante_avant_travaux',
        'plomb_crep',
        'gaz',
        'electricite',
        'termites',
        'carrez_boutin',
        'erp',
      ],
      payment_provider_kind: ['stripe', 'gocardless', 'virement', 'cb', 'especes'],
      property_type_enum: [
        'maison',
        'appartement',
        'immeuble',
        'local_commercial',
        'bureau',
        'autre',
      ],
    },
  },
} as const
