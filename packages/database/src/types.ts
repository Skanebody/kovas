// Auto-generated TypeScript types from Supabase schema
// Generated: 2026-05-18T18:27:09.659Z
// Source: db.jlizdkffwjdiokvmhcwg.supabase.co:5432 (public schema)
// Do NOT edit manually. Regenerate via: pnpm db:gen-types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      accounting_connectors: {
        Row: {
          id: string
          organization_id: string
          provider: 'qonto' | 'pennylane' | 'indy' | 'tiime'
          token_encrypted: string | null
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          oauth_access_token_encrypted: string | null
          oauth_refresh_token_encrypted: string | null
          oauth_expires_at: string | null
          workspace_id: string | null
          config: Json
          status: 'active' | 'inactive' | 'error' | 'pending'
          last_sync_at: string | null
          last_error: string | null
          last_error_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          provider: 'qonto' | 'pennylane' | 'indy' | 'tiime'
          token_encrypted?: string | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_refresh_token_encrypted?: string | null
          oauth_expires_at?: string | null
          workspace_id?: string | null
          config?: Json
          status?: 'active' | 'inactive' | 'error' | 'pending'
          last_sync_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          provider?: 'qonto' | 'pennylane' | 'indy' | 'tiime'
          token_encrypted?: string | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_refresh_token_encrypted?: string | null
          oauth_expires_at?: string | null
          workspace_id?: string | null
          config?: Json
          status?: 'active' | 'inactive' | 'error' | 'pending'
          last_sync_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      connector_api_access_requests: {
        Row: {
          id: string
          organization_id: string
          provider: 'qonto' | 'pennylane' | 'indy' | 'tiime'
          requested_by: string | null
          contact_email: string | null
          message: string | null
          status: 'pending' | 'granted' | 'rejected'
          requested_at: string
          resolved_at: string | null
          resolved_notes: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          provider: 'qonto' | 'pennylane' | 'indy' | 'tiime'
          requested_by?: string | null
          contact_email?: string | null
          message?: string | null
          status?: 'pending' | 'granted' | 'rejected'
          requested_at?: string
          resolved_at?: string | null
          resolved_notes?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          provider?: 'qonto' | 'pennylane' | 'indy' | 'tiime'
          requested_by?: string | null
          contact_email?: string | null
          message?: string | null
          status?: 'pending' | 'granted' | 'rejected'
          requested_at?: string
          resolved_at?: string | null
          resolved_notes?: string | null
        }
        Relationships: []
      }
      abuse_detection_logs: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          signal_type: string
          severity: number
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          detected_at: string
          action_taken: string | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          signal_type: string
          severity: number
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          detected_at?: string
          action_taken?: string | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          signal_type?: string
          severity?: number
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          detected_at?: string
          action_taken?: string | null
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
      audit_data_access: {
        Row: {
          id: string
          user_id: string
          organization_id: string | null
          data_type: string
          action: 'read' | 'export' | 'delete'
          ip: string | null
          user_agent: string | null
          accessed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id?: string | null
          data_type: string
          action: 'read' | 'export' | 'delete'
          ip?: string | null
          user_agent?: string | null
          accessed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string | null
          data_type?: string
          action?: 'read' | 'export' | 'delete'
          ip?: string | null
          user_agent?: string | null
          accessed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_data_access_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_data_access_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ai_usage: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          mission_id: string | null
          provider: string
          model: string
          operation: string
          input_tokens: number | null
          output_tokens: number | null
          cached_tokens: number | null
          audio_seconds: number | null
          cost_eur: number
          latency_ms: number | null
          fallback_used: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          mission_id?: string | null
          provider: string
          model: string
          operation: string
          input_tokens?: number | null
          output_tokens?: number | null
          cached_tokens?: number | null
          audio_seconds?: number | null
          cost_eur: number
          latency_ms?: number | null
          fallback_used?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          mission_id?: string | null
          provider?: string
          model?: string
          operation?: string
          input_tokens?: number | null
          output_tokens?: number | null
          cached_tokens?: number | null
          audio_seconds?: number | null
          cost_eur?: number
          latency_ms?: number | null
          fallback_used?: boolean | null
          created_at?: string
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
      cabinet_trials: {
        Row: {
          id: string
          siret: string
          email: string
          user_id: string | null
          organization_id: string | null
          trial_started_at: string
          trial_ended_at: string | null
          converted_to_paid: boolean
          blocked_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          siret: string
          email: string
          user_id?: string | null
          organization_id?: string | null
          trial_started_at?: string
          trial_ended_at?: string | null
          converted_to_paid?: boolean
          blocked_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          siret?: string
          email?: string
          user_id?: string | null
          organization_id?: string | null
          trial_started_at?: string
          trial_ended_at?: string | null
          converted_to_paid?: boolean
          blocked_reason?: string | null
          created_at?: string
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
      clients: {
        Row: {
          id: string
          organization_id: string
          type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
          display_name: string
          first_name: string | null
          last_name: string | null
          company_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          apartment_detail: string | null
          floor_number: number | null
          building_letter: string | null
          address_complement: string | null
          siret: string | null
          notes: string | null
          tags: unknown[] | null
          qonto_customer_id: string | null
          qonto_synced_at: string | null
          pennylane_customer_id: string | null
          indy_customer_id: string | null
          tiime_customer_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          type?: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
          display_name: string
          first_name?: string | null
          last_name?: string | null
          company_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          apartment_detail?: string | null
          floor_number?: number | null
          building_letter?: string | null
          address_complement?: string | null
          siret?: string | null
          notes?: string | null
          tags?: unknown[] | null
          qonto_customer_id?: string | null
          qonto_synced_at?: string | null
          pennylane_customer_id?: string | null
          indy_customer_id?: string | null
          tiime_customer_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          type?: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
          display_name?: string
          first_name?: string | null
          last_name?: string | null
          company_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          apartment_detail?: string | null
          floor_number?: number | null
          building_letter?: string | null
          address_complement?: string | null
          siret?: string | null
          notes?: string | null
          tags?: unknown[] | null
          qonto_customer_id?: string | null
          qonto_synced_at?: string | null
          pennylane_customer_id?: string | null
          indy_customer_id?: string | null
          tiime_customer_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
      dossier_rooms: {
        Row: {
          id: string
          dossier_id: string
          organization_id: string
          name: string
          room_type: string | null
          position: number | null
          surface_m2: number | null
          ceiling_height_m: number | null
          has_heating: boolean | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          organization_id: string
          name: string
          room_type?: string | null
          position?: number | null
          surface_m2?: number | null
          ceiling_height_m?: number | null
          has_heating?: boolean | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dossier_id?: string
          organization_id?: string
          name?: string
          room_type?: string | null
          position?: number | null
          surface_m2?: number | null
          ceiling_height_m?: number | null
          has_heating?: boolean | null
          notes?: string | null
          created_at?: string
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
          id: string
          organization_id: string
          property_id: string
          client_id: string | null
          reference: string
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          status: string
          client_upload_token: string | null
          client_upload_expires_at: string | null
          metadata: Json
          notes: string | null
          assigned_to: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          property_id: string
          client_id?: string | null
          reference: string
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          status?: string
          client_upload_token?: string | null
          client_upload_expires_at?: string | null
          metadata?: Json
          notes?: string | null
          assigned_to?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          property_id?: string
          client_id?: string | null
          reference?: string
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          status?: string
          client_upload_token?: string | null
          client_upload_expires_at?: string | null
          metadata?: Json
          notes?: string | null
          assigned_to?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
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
      equipment_findings: {
        Row: {
          id: string
          dossier_id: string
          organization_id: string
          room_id: string | null
          photo_id: string | null
          kind:
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
          brand: string | null
          model: string | null
          energy_class: string | null
          year_install: number | null
          details: Json | null
          ai_provider: string | null
          ai_model: string | null
          ai_confidence: number | null
          ai_cost_eur: number | null
          reviewed: boolean | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          organization_id: string
          room_id?: string | null
          photo_id?: string | null
          kind:
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
          brand?: string | null
          model?: string | null
          energy_class?: string | null
          year_install?: number | null
          details?: Json | null
          ai_provider?: string | null
          ai_model?: string | null
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          reviewed?: boolean | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          dossier_id?: string
          organization_id?: string
          room_id?: string | null
          photo_id?: string | null
          kind?:
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
          brand?: string | null
          model?: string | null
          energy_class?: string | null
          year_install?: number | null
          details?: Json | null
          ai_provider?: string | null
          ai_model?: string | null
          ai_confidence?: number | null
          ai_cost_eur?: number | null
          reviewed?: boolean | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_finding_photo'
            columns: ['created_at']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['created_at']
          },
          {
            foreignKeyName: 'fk_finding_photo'
            columns: ['created_at']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['id']
          },
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
            foreignKeyName: 'fk_finding_photo'
            columns: ['photo_id']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['created_at']
          },
          {
            foreignKeyName: 'fk_finding_photo'
            columns: ['photo_id']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'equipment_findings_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'dossier_rooms'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          actor_email: string | null
          actor_ip: string | null
          user_agent: string | null
          event_type: string
          entity_type: string | null
          entity_id: string | null
          payload: Json | null
          changes: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          actor_email?: string | null
          actor_ip?: string | null
          user_agent?: string | null
          event_type: string
          entity_type?: string | null
          entity_id?: string | null
          payload?: Json | null
          changes?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          actor_email?: string | null
          actor_ip?: string | null
          user_agent?: string | null
          event_type?: string
          entity_type?: string | null
          entity_id?: string | null
          payload?: Json | null
          changes?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          active: boolean
          severity: string
          message: string
          started_at: string
          resolved_at: string | null
          root_cause: string | null
          resolution_notes: string | null
        }
        Insert: {
          id?: string
          active?: boolean
          severity?: string
          message: string
          started_at?: string
          resolved_at?: string | null
          root_cause?: string | null
          resolution_notes?: string | null
        }
        Update: {
          id?: string
          active?: boolean
          severity?: string
          message?: string
          started_at?: string
          resolved_at?: string | null
          root_cause?: string | null
          resolution_notes?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          client_id: string | null
          mission_id: string | null
          quote_id: string | null
          reference: string
          status: string
          amount_ht: number
          amount_tva: number
          amount_ttc: number
          paid_amount: number | null
          tva_rate: number | null
          line_items: Json
          pdf_path: string | null
          facturx_xml: string | null
          facturx_profile: string | null
          ppf_transmission_id: string | null
          ppf_status: string | null
          stripe_payment_intent: string | null
          payment_method: string | null
          due_date: string | null
          paid_at: string | null
          reminder_j7_sent_at: string | null
          reminder_j15_sent_at: string | null
          reminder_j30_sent_at: string | null
          client_snapshot: Json | null
          issued_at: string | null
          payment_terms_days: number
          notes: string | null
          credit_note_for_invoice_id: string | null
          user_id: string | null
          contact_id: string | null
          sent_at: string | null
          stripe_payment_link_url: string | null
          xml_path: string | null
          qonto_invoice_id: string | null
          qonto_synced_at: string | null
          pennylane_invoice_id: string | null
          pennylane_synced_at: string | null
          indy_invoice_id: string | null
          indy_synced_at: string | null
          tiime_invoice_id: string | null
          tiime_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          client_id?: string | null
          mission_id?: string | null
          quote_id?: string | null
          reference: string
          status?: string
          amount_ht: number
          amount_tva: number
          amount_ttc: number
          paid_amount?: number | null
          tva_rate?: number | null
          line_items?: Json
          pdf_path?: string | null
          facturx_xml?: string | null
          facturx_profile?: string | null
          ppf_transmission_id?: string | null
          ppf_status?: string | null
          stripe_payment_intent?: string | null
          payment_method?: string | null
          due_date?: string | null
          paid_at?: string | null
          reminder_j7_sent_at?: string | null
          reminder_j15_sent_at?: string | null
          reminder_j30_sent_at?: string | null
          client_snapshot?: Json | null
          issued_at?: string | null
          payment_terms_days?: number
          notes?: string | null
          credit_note_for_invoice_id?: string | null
          user_id?: string | null
          contact_id?: string | null
          sent_at?: string | null
          stripe_payment_link_url?: string | null
          xml_path?: string | null
          qonto_invoice_id?: string | null
          qonto_synced_at?: string | null
          pennylane_invoice_id?: string | null
          pennylane_synced_at?: string | null
          indy_invoice_id?: string | null
          indy_synced_at?: string | null
          tiime_invoice_id?: string | null
          tiime_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string | null
          mission_id?: string | null
          quote_id?: string | null
          reference?: string
          status?: string
          amount_ht?: number
          amount_tva?: number
          amount_ttc?: number
          paid_amount?: number | null
          tva_rate?: number | null
          line_items?: Json
          pdf_path?: string | null
          facturx_xml?: string | null
          facturx_profile?: string | null
          ppf_transmission_id?: string | null
          ppf_status?: string | null
          stripe_payment_intent?: string | null
          payment_method?: string | null
          due_date?: string | null
          paid_at?: string | null
          reminder_j7_sent_at?: string | null
          reminder_j15_sent_at?: string | null
          reminder_j30_sent_at?: string | null
          client_snapshot?: Json | null
          issued_at?: string | null
          payment_terms_days?: number
          notes?: string | null
          credit_note_for_invoice_id?: string | null
          user_id?: string | null
          contact_id?: string | null
          sent_at?: string | null
          stripe_payment_link_url?: string | null
          xml_path?: string | null
          qonto_invoice_id?: string | null
          qonto_synced_at?: string | null
          pennylane_invoice_id?: string | null
          pennylane_synced_at?: string | null
          indy_invoice_id?: string | null
          indy_synced_at?: string | null
          tiime_invoice_id?: string | null
          tiime_synced_at?: string | null
          created_at?: string
          updated_at?: string
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
      jobs: {
        Row: {
          id: string
          organization_id: string | null
          kind: string
          status: string
          payload: Json
          result: Json | null
          error: string | null
          attempts: number | null
          max_attempts: number | null
          scheduled_for: string
          started_at: string | null
          finished_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          kind: string
          status?: string
          payload?: Json
          result?: Json | null
          error?: string | null
          attempts?: number | null
          max_attempts?: number | null
          scheduled_for?: string
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          kind?: string
          status?: string
          payload?: Json
          result?: Json | null
          error?: string | null
          attempts?: number | null
          max_attempts?: number | null
          scheduled_for?: string
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
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
      memberships: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          invited_email: string | null
          invited_by: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: string
          invited_email?: string | null
          invited_by?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: string
          invited_email?: string | null
          invited_by?: string | null
          status?: string
          created_at?: string
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
      missions: {
        Row: {
          id: string
          organization_id: string
          assigned_to: string | null
          created_by: string | null
          reference: string
          type:
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
          status:
            | 'draft'
            | 'scheduled'
            | 'in_progress'
            | 'to_review'
            | 'done'
            | 'exported'
            | 'archived'
            | 'cancelled'
          priority: number | null
          completed_at: string | null
          exported_at: string | null
          liciel_export_path: string | null
          liciel_export_hash: string | null
          dpe_letter: string | null
          ges_letter: string | null
          energy_value: number | null
          ges_value: number | null
          voice_seconds_total: number | null
          photos_count: number | null
          equipment_findings_count: number | null
          ai_cost_eur: number | null
          notes: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          dossier_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          assigned_to?: string | null
          created_by?: string | null
          reference: string
          type:
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
          status?:
            | 'draft'
            | 'scheduled'
            | 'in_progress'
            | 'to_review'
            | 'done'
            | 'exported'
            | 'archived'
            | 'cancelled'
          priority?: number | null
          completed_at?: string | null
          exported_at?: string | null
          liciel_export_path?: string | null
          liciel_export_hash?: string | null
          dpe_letter?: string | null
          ges_letter?: string | null
          energy_value?: number | null
          ges_value?: number | null
          voice_seconds_total?: number | null
          photos_count?: number | null
          equipment_findings_count?: number | null
          ai_cost_eur?: number | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          dossier_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          assigned_to?: string | null
          created_by?: string | null
          reference?: string
          type?:
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
          status?:
            | 'draft'
            | 'scheduled'
            | 'in_progress'
            | 'to_review'
            | 'done'
            | 'exported'
            | 'archived'
            | 'cancelled'
          priority?: number | null
          completed_at?: string | null
          exported_at?: string | null
          liciel_export_path?: string | null
          liciel_export_hash?: string | null
          dpe_letter?: string | null
          ges_letter?: string | null
          energy_value?: number | null
          ges_value?: number | null
          voice_seconds_total?: number | null
          photos_count?: number | null
          equipment_findings_count?: number | null
          ai_cost_eur?: number | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          dossier_id?: string
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
      organizations: {
        Row: {
          id: string
          name: string
          siret: string | null
          vat_number: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string
          certification_n: string | null
          stripe_customer_id: string | null
          plan: string
          plan_status: string
          trial_ends_at: string | null
          current_period_end: string | null
          default_logiciel: string | null
          default_export_mode: string | null
          iban: string | null
          bic: string | null
          bank_name: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          siret?: string | null
          vat_number?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          certification_n?: string | null
          stripe_customer_id?: string | null
          plan?: string
          plan_status?: string
          trial_ends_at?: string | null
          current_period_end?: string | null
          default_logiciel?: string | null
          default_export_mode?: string | null
          iban?: string | null
          bic?: string | null
          bank_name?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          siret?: string | null
          vat_number?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          certification_n?: string | null
          stripe_customer_id?: string | null
          plan?: string
          plan_status?: string
          trial_ends_at?: string | null
          current_period_end?: string | null
          default_logiciel?: string | null
          default_export_mode?: string | null
          iban?: string | null
          bic?: string | null
          bank_name?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      owner_documents: {
        Row: {
          id: string
          dossier_id: string
          organization_id: string
          storage_path: string
          original_name: string | null
          size_bytes: number | null
          mime_type: string | null
          doc_kind: string | null
          uploaded_at: string | null
          reviewed_by_diag: boolean | null
          extracted_data: Json | null
          extraction_status: string | null
          extracted_at: string | null
          extraction_cost_eur: number | null
          extraction_error: string | null
        }
        Insert: {
          id?: string
          dossier_id: string
          organization_id: string
          storage_path: string
          original_name?: string | null
          size_bytes?: number | null
          mime_type?: string | null
          doc_kind?: string | null
          uploaded_at?: string | null
          reviewed_by_diag?: boolean | null
          extracted_data?: Json | null
          extraction_status?: string | null
          extracted_at?: string | null
          extraction_cost_eur?: number | null
          extraction_error?: string | null
        }
        Update: {
          id?: string
          dossier_id?: string
          organization_id?: string
          storage_path?: string
          original_name?: string | null
          size_bytes?: number | null
          mime_type?: string | null
          doc_kind?: string | null
          uploaded_at?: string | null
          reviewed_by_diag?: boolean | null
          extracted_data?: Json | null
          extraction_status?: string | null
          extracted_at?: string | null
          extraction_cost_eur?: number | null
          extraction_error?: string | null
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
      photos: {
        Row: {
          id: string
          organization_id: string
          dossier_id: string
          room_id: string | null
          storage_path: string
          thumb_path: string | null
          width: number | null
          height: number | null
          size_bytes: number | null
          mime_type: string | null
          taken_at: string | null
          location: unknown | null
          caption: string | null
          ai_tags: unknown[] | null
          ai_cost_eur: number | null
          uploaded_by: string | null
          sync_status: string | null
          created_at: string
          view_type: string | null
          // Capture-First (migration 20260520180000)
          perceptual_hash: string | null
          is_blurry: boolean | null
          is_duplicate_of: string | null
          device_info: Json | null
          gps_lat: number | null
          gps_lng: number | null
          vision_status: string | null
          vision_analysis: Json | null
          vision_confidence: number | null
          vision_model: string | null
          vision_cost_usd: number | null
          analyzed_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          dossier_id: string
          room_id?: string | null
          storage_path: string
          thumb_path?: string | null
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          mime_type?: string | null
          taken_at?: string | null
          location?: unknown | null
          caption?: string | null
          ai_tags?: unknown[] | null
          ai_cost_eur?: number | null
          uploaded_by?: string | null
          sync_status?: string | null
          created_at?: string
          view_type?: string | null
          // Capture-First
          perceptual_hash?: string | null
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          device_info?: Json | null
          gps_lat?: number | null
          gps_lng?: number | null
          vision_status?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_model?: string | null
          vision_cost_usd?: number | null
          analyzed_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          dossier_id?: string
          room_id?: string | null
          storage_path?: string
          thumb_path?: string | null
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          mime_type?: string | null
          taken_at?: string | null
          location?: unknown | null
          caption?: string | null
          ai_tags?: unknown[] | null
          ai_cost_eur?: number | null
          uploaded_by?: string | null
          sync_status?: string | null
          created_at?: string
          view_type?: string | null
          // Capture-First
          perceptual_hash?: string | null
          is_blurry?: boolean | null
          is_duplicate_of?: string | null
          device_info?: Json | null
          gps_lat?: number | null
          gps_lng?: number | null
          vision_status?: string | null
          vision_analysis?: Json | null
          vision_confidence?: number | null
          vision_model?: string | null
          vision_cost_usd?: number | null
          analyzed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'dossiers'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          default_org_id: string | null
          locale: string
          timezone: string
          notification_prefs: Json | null
          linguistic_profile: Json | null
          last_active_at: string | null
          privacy_policy_accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          default_org_id?: string | null
          locale?: string
          timezone?: string
          notification_prefs?: Json | null
          linguistic_profile?: Json | null
          last_active_at?: string | null
          privacy_policy_accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          default_org_id?: string | null
          locale?: string
          timezone?: string
          notification_prefs?: Json | null
          linguistic_profile?: Json | null
          last_active_at?: string | null
          privacy_policy_accepted_at?: string | null
          created_at?: string
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
          id: string
          organization_id: string
          client_id: string | null
          ban_id: string | null
          address: string
          city: string | null
          postal_code: string | null
          insee_code: string | null
          location: unknown | null
          cadastre_section: string | null
          cadastre_number: string | null
          cadastre_prefix: string | null
          property_type:
            | 'maison'
            | 'appartement'
            | 'immeuble'
            | 'local_commercial'
            | 'bureau'
            | 'autre'
            | null
          year_built: number | null
          surface_carrez: number | null
          surface_boutin: number | null
          surface_total: number | null
          floors: number | null
          rooms_count: number | null
          heating_type: string | null
          energy_class: string | null
          ges_class: string | null
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          apartment_detail: string | null
          floor_number: number | null
          building_letter: string | null
          lot_number: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          client_id?: string | null
          ban_id?: string | null
          address: string
          city?: string | null
          postal_code?: string | null
          insee_code?: string | null
          location?: unknown | null
          cadastre_section?: string | null
          cadastre_number?: string | null
          cadastre_prefix?: string | null
          property_type?:
            | 'maison'
            | 'appartement'
            | 'immeuble'
            | 'local_commercial'
            | 'bureau'
            | 'autre'
            | null
          year_built?: number | null
          surface_carrez?: number | null
          surface_boutin?: number | null
          surface_total?: number | null
          floors?: number | null
          rooms_count?: number | null
          heating_type?: string | null
          energy_class?: string | null
          ges_class?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          apartment_detail?: string | null
          floor_number?: number | null
          building_letter?: string | null
          lot_number?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string | null
          ban_id?: string | null
          address?: string
          city?: string | null
          postal_code?: string | null
          insee_code?: string | null
          location?: unknown | null
          cadastre_section?: string | null
          cadastre_number?: string | null
          cadastre_prefix?: string | null
          property_type?:
            | 'maison'
            | 'appartement'
            | 'immeuble'
            | 'local_commercial'
            | 'bureau'
            | 'autre'
            | null
          year_built?: number | null
          surface_carrez?: number | null
          surface_boutin?: number | null
          surface_total?: number | null
          floors?: number | null
          rooms_count?: number | null
          heating_type?: string | null
          energy_class?: string | null
          ges_class?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          apartment_detail?: string | null
          floor_number?: number | null
          building_letter?: string | null
          lot_number?: string | null
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
            foreignKeyName: 'properties_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      quotes: {
        Row: {
          id: string
          organization_id: string
          client_id: string
          mission_id: string | null
          reference: string
          status: string
          amount_ht: number
          amount_tva: number
          amount_ttc: number
          tva_rate: number | null
          line_items: Json
          pdf_path: string | null
          issued_at: string | null
          expires_at: string | null
          accepted_at: string | null
          signature_provider: string | null
          signature_id: string | null
          qonto_quote_id: string | null
          qonto_synced_at: string | null
          pennylane_quote_id: string | null
          pennylane_synced_at: string | null
          indy_quote_id: string | null
          indy_synced_at: string | null
          tiime_quote_id: string | null
          tiime_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          client_id: string
          mission_id?: string | null
          reference: string
          status?: string
          amount_ht: number
          amount_tva: number
          amount_ttc: number
          tva_rate?: number | null
          line_items?: Json
          pdf_path?: string | null
          issued_at?: string | null
          expires_at?: string | null
          accepted_at?: string | null
          signature_provider?: string | null
          signature_id?: string | null
          qonto_quote_id?: string | null
          qonto_synced_at?: string | null
          pennylane_quote_id?: string | null
          pennylane_synced_at?: string | null
          indy_quote_id?: string | null
          indy_synced_at?: string | null
          tiime_quote_id?: string | null
          tiime_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string
          mission_id?: string | null
          reference?: string
          status?: string
          amount_ht?: number
          amount_tva?: number
          amount_ttc?: number
          tva_rate?: number | null
          line_items?: Json
          pdf_path?: string | null
          issued_at?: string | null
          expires_at?: string | null
          accepted_at?: string | null
          signature_provider?: string | null
          signature_id?: string | null
          qonto_quote_id?: string | null
          qonto_synced_at?: string | null
          pennylane_quote_id?: string | null
          pennylane_synced_at?: string | null
          indy_quote_id?: string | null
          indy_synced_at?: string | null
          tiime_quote_id?: string | null
          tiime_synced_at?: string | null
          created_at?: string
          updated_at?: string
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
        ]
      }
      reference_counters: {
        Row: {
          organization_id: string
          kind: string
          year: number
          last_value: string
        }
        Insert: {
          organization_id: string
          kind: string
          year: number
          last_value?: string
        }
        Update: {
          organization_id?: string
          kind?: string
          year?: number
          last_value?: string
        }
        Relationships: []
      }
      sketches: {
        Row: {
          id: string
          mission_id: string
          organization_id: string
          room_id: string | null
          source: string
          geometry: Json
          preview_path: string | null
          surface_carrez_m2: number | null
          surface_boutin_m2: number | null
          ai_cost_eur: number | null
          reviewed: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mission_id: string
          organization_id: string
          room_id?: string | null
          source: string
          geometry: Json
          preview_path?: string | null
          surface_carrez_m2?: number | null
          surface_boutin_m2?: number | null
          ai_cost_eur?: number | null
          reviewed?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mission_id?: string
          organization_id?: string
          room_id?: string | null
          source?: string
          geometry?: Json
          preview_path?: string | null
          surface_carrez_m2?: number | null
          surface_boutin_m2?: number | null
          ai_cost_eur?: number | null
          reviewed?: boolean | null
          created_at?: string
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
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: string
          tier: string | null
          missions_included: number | null
          overage_price_cents: number | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          monthly_cap_eur: number | null
          trial_started_at: string | null
          trial_ends_at: string | null
          is_in_trial: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          tier?: string | null
          missions_included?: number | null
          overage_price_cents?: number | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          monthly_cap_eur?: number | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          /** GENERATED ALWAYS — never insert directly */
          is_in_trial?: never
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
          tier?: string | null
          missions_included?: number | null
          overage_price_cents?: number | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          monthly_cap_eur?: number | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          /** GENERATED ALWAYS — never update directly */
          is_in_trial?: never
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      support_messages: {
        Row: {
          id: string
          ticket_id: string
          from_role: string
          body: string
          attachments: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          from_role: string
          body: string
          attachments?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          from_role?: string
          body?: string
          attachments?: Json | null
          created_at?: string
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
          id: string
          organization_id: string
          user_id: string
          subject: string
          body: string
          status: string
          priority: string | null
          last_message_at: string | null
          ai_classification: string | null
          ai_suggested_response: string | null
          ai_confidence: number | null
          escalated_to_human: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          subject: string
          body: string
          status?: string
          priority?: string | null
          last_message_at?: string | null
          ai_classification?: string | null
          ai_suggested_response?: string | null
          ai_confidence?: number | null
          escalated_to_human?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          subject?: string
          body?: string
          status?: string
          priority?: string | null
          last_message_at?: string | null
          ai_classification?: string | null
          ai_suggested_response?: string | null
          ai_confidence?: number | null
          escalated_to_human?: boolean | null
          created_at?: string
          updated_at?: string
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
      vision_corrections: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          mission_id: string
          photo_id: string
          ai_provider: string
          ai_model: string
          ai_brand: string | null
          ai_model_eq: string | null
          ai_confidence: number | null
          user_brand: string | null
          user_model_eq: string | null
          user_notes: string | null
          corrected_at: string
          used_in_training: boolean | null
          training_session_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          mission_id: string
          photo_id: string
          ai_provider: string
          ai_model: string
          ai_brand?: string | null
          ai_model_eq?: string | null
          ai_confidence?: number | null
          user_brand?: string | null
          user_model_eq?: string | null
          user_notes?: string | null
          corrected_at?: string
          used_in_training?: boolean | null
          training_session_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          mission_id?: string
          photo_id?: string
          ai_provider?: string
          ai_model?: string
          ai_brand?: string | null
          ai_model_eq?: string | null
          ai_confidence?: number | null
          user_brand?: string | null
          user_model_eq?: string | null
          user_notes?: string | null
          corrected_at?: string
          used_in_training?: boolean | null
          training_session_id?: string | null
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          id: string
          dossier_id: string
          organization_id: string
          room_id: string | null
          recorded_by: string | null
          storage_path: string
          duration_seconds: number | null
          language: string | null
          provider: string | null
          transcript_raw: string | null
          transcript_structured: Json | null
          parser_used: string | null
          ai_cost_eur: number | null
          ai_confidence: number | null
          status: string
          created_at: string
          transcribed_at: string | null
        }
        Insert: {
          id?: string
          dossier_id: string
          organization_id: string
          room_id?: string | null
          recorded_by?: string | null
          storage_path: string
          duration_seconds?: number | null
          language?: string | null
          provider?: string | null
          transcript_raw?: string | null
          transcript_structured?: Json | null
          parser_used?: string | null
          ai_cost_eur?: number | null
          ai_confidence?: number | null
          status?: string
          created_at?: string
          transcribed_at?: string | null
        }
        Update: {
          id?: string
          dossier_id?: string
          organization_id?: string
          room_id?: string | null
          recorded_by?: string | null
          storage_path?: string
          duration_seconds?: number | null
          language?: string | null
          provider?: string | null
          transcript_raw?: string | null
          transcript_structured?: Json | null
          parser_used?: string | null
          ai_cost_eur?: number | null
          ai_confidence?: number | null
          status?: string
          created_at?: string
          transcribed_at?: string | null
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
    Views: Record<string, never>
    Functions: {
      is_member_of: {
        Args: {
          p_org: string
        }
        Returns: boolean
      }
      next_reference: {
        Args: {
          p_org: string
          p_kind: string
        }
        Returns: string
      }
      generate_invoice_reference: {
        Args: {
          p_org_id: string
        }
        Returns: string
      }
      generate_credit_note_reference: {
        Args: {
          p_org_id: string
        }
        Returns: string
      }
      subscriptions_set_updated_at: {
        Args: Record<string, never>
        Returns: unknown
      }
    }
    Enums: {
      client_type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
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
      property_type_enum:
        | 'maison'
        | 'appartement'
        | 'immeuble'
        | 'local_commercial'
        | 'bureau'
        | 'autre'
    }
    CompositeTypes: Record<string, never>
  }
}
