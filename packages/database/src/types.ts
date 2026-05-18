// Auto-generated TypeScript types from Supabase schema
// Generated: 2026-05-18T15:05:29.951Z
// Source: db.jlizdkffwjdiokvmhcwg.supabase.co:5432 (public schema)
// Do NOT edit manually. Regenerate via: pnpm db:gen-types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
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
          siret: string | null
          notes: string | null
          tags: (unknown)[] | null
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
          siret?: string | null
          notes?: string | null
          tags?: (unknown)[] | null
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
          siret?: string | null
          notes?: string | null
          tags?: (unknown)[] | null
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
      equipment_findings: {
        Row: {
          id: string
          mission_id: string
          organization_id: string
          room_id: string | null
          photo_id: string | null
          kind: 'chaudiere' | 'chauffe_eau' | 'radiateur' | 'pac' | 'climatisation' | 'fenetre' | 'isolation' | 'ventilation' | 'tableau_elec' | 'autre'
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
          mission_id: string
          organization_id: string
          room_id?: string | null
          photo_id?: string | null
          kind: 'chaudiere' | 'chauffe_eau' | 'radiateur' | 'pac' | 'climatisation' | 'fenetre' | 'isolation' | 'ventilation' | 'tableau_elec' | 'autre'
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
          mission_id?: string
          organization_id?: string
          room_id?: string | null
          photo_id?: string | null
          kind?: 'chaudiere' | 'chauffe_eau' | 'radiateur' | 'pac' | 'climatisation' | 'fenetre' | 'isolation' | 'ventilation' | 'tableau_elec' | 'autre'
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
            foreignKeyName: 'equipment_findings_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
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
            referencedRelation: 'mission_rooms'
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
      mission_rooms: {
        Row: {
          id: string
          mission_id: string
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
          mission_id: string
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
          mission_id?: string
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
            foreignKeyName: 'mission_rooms_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
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
      missions: {
        Row: {
          id: string
          organization_id: string
          property_id: string
          client_id: string | null
          assigned_to: string | null
          created_by: string | null
          reference: string
          type: 'dpe_vente' | 'dpe_location' | 'copropriete' | 'amiante_vente' | 'amiante_avant_travaux' | 'plomb_crep' | 'gaz' | 'electricite' | 'termites' | 'carrez_boutin' | 'erp'
          status: 'draft' | 'scheduled' | 'in_progress' | 'to_review' | 'done' | 'exported' | 'archived' | 'cancelled'
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          exported_at: string | null
          liciel_export_path: string | null
          liciel_export_hash: string | null
          client_upload_token: string | null
          client_upload_expires_at: string | null
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
        }
        Insert: {
          id?: string
          organization_id: string
          property_id: string
          client_id?: string | null
          assigned_to?: string | null
          created_by?: string | null
          reference: string
          type: 'dpe_vente' | 'dpe_location' | 'copropriete' | 'amiante_vente' | 'amiante_avant_travaux' | 'plomb_crep' | 'gaz' | 'electricite' | 'termites' | 'carrez_boutin' | 'erp'
          status?: 'draft' | 'scheduled' | 'in_progress' | 'to_review' | 'done' | 'exported' | 'archived' | 'cancelled'
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          exported_at?: string | null
          liciel_export_path?: string | null
          liciel_export_hash?: string | null
          client_upload_token?: string | null
          client_upload_expires_at?: string | null
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
        }
        Update: {
          id?: string
          organization_id?: string
          property_id?: string
          client_id?: string | null
          assigned_to?: string | null
          created_by?: string | null
          reference?: string
          type?: 'dpe_vente' | 'dpe_location' | 'copropriete' | 'amiante_vente' | 'amiante_avant_travaux' | 'plomb_crep' | 'gaz' | 'electricite' | 'termites' | 'carrez_boutin' | 'erp'
          status?: 'draft' | 'scheduled' | 'in_progress' | 'to_review' | 'done' | 'exported' | 'archived' | 'cancelled'
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          exported_at?: string | null
          liciel_export_path?: string | null
          liciel_export_hash?: string | null
          client_upload_token?: string | null
          client_upload_expires_at?: string | null
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
        }
        Relationships: [
          {
            foreignKeyName: 'missions_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'missions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'missions_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
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
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      owner_documents: {
        Row: {
          id: string
          mission_id: string
          organization_id: string
          storage_path: string
          original_name: string | null
          size_bytes: number | null
          mime_type: string | null
          doc_kind: string | null
          uploaded_at: string | null
          reviewed_by_diag: boolean | null
        }
        Insert: {
          id?: string
          mission_id: string
          organization_id: string
          storage_path: string
          original_name?: string | null
          size_bytes?: number | null
          mime_type?: string | null
          doc_kind?: string | null
          uploaded_at?: string | null
          reviewed_by_diag?: boolean | null
        }
        Update: {
          id?: string
          mission_id?: string
          organization_id?: string
          storage_path?: string
          original_name?: string | null
          size_bytes?: number | null
          mime_type?: string | null
          doc_kind?: string | null
          uploaded_at?: string | null
          reviewed_by_diag?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'owner_documents_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
            referencedColumns: ['id']
          },
        ]
      }
      photos: {
        Row: {
          id: string
          organization_id: string
          mission_id: string
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
          ai_tags: (unknown)[] | null
          ai_cost_eur: number | null
          uploaded_by: string | null
          sync_status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          mission_id: string
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
          ai_tags?: (unknown)[] | null
          ai_cost_eur?: number | null
          uploaded_by?: string | null
          sync_status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          mission_id?: string
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
          ai_tags?: (unknown)[] | null
          ai_cost_eur?: number | null
          uploaded_by?: string | null
          sync_status?: string | null
          created_at?: string
        }
        Relationships: []
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
          property_type: 'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre' | null
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
          property_type?: 'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre' | null
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
          property_type?: 'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre' | null
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
            referencedRelation: 'mission_rooms'
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
          mission_id: string
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
          mission_id: string
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
          mission_id?: string
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
            foreignKeyName: 'voice_notes_mission_id_fkey'
            columns: ['mission_id']
            isOneToOne: false
            referencedRelation: 'missions'
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
            referencedRelation: 'mission_rooms'
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
    }
    Enums: {
      client_type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
      equipment_kind: 'chaudiere' | 'chauffe_eau' | 'radiateur' | 'pac' | 'climatisation' | 'fenetre' | 'isolation' | 'ventilation' | 'tableau_elec' | 'autre'
      mission_status: 'draft' | 'scheduled' | 'in_progress' | 'to_review' | 'done' | 'exported' | 'archived' | 'cancelled'
      mission_type: 'dpe_vente' | 'dpe_location' | 'copropriete' | 'amiante_vente' | 'amiante_avant_travaux' | 'plomb_crep' | 'gaz' | 'electricite' | 'termites' | 'carrez_boutin' | 'erp'
      property_type_enum: 'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre'
    }
    CompositeTypes: Record<string, never>
  }
}
