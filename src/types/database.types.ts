// ============================================================================
// GERADO AUTOMATICAMENTE a partir do projeto Supabase "lidera+"
// (vqrnjiwansfobxaeswnu) via generate_typescript_types.
// NÃO editar à mão. Para regenerar após uma migration:
//   npx supabase gen types typescript --project-id vqrnjiwansfobxaeswnu > src/types/database.types.ts
// Última regeneração: coluna is_platform_admin em users_profiles (acesso
// cross-tenant pra provisionar organizações novas) — ver docs/07-migracao-multi-tenant.md.
// ============================================================================
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_events: {
        Row: {
          attendance_id: string | null
          created_at: string
          created_by: string | null
          demand_id: string | null
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          leader_id: string | null
          location: string | null
          neighborhood: string | null
          notes: string | null
          organization_id: string
          responsible_user_id: string | null
          status: string
          supporter_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string
          created_by?: string | null
          demand_id?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          leader_id?: string | null
          location?: string | null
          neighborhood?: string | null
          notes?: string | null
          organization_id: string
          responsible_user_id?: string | null
          status?: string
          supporter_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          created_by?: string | null
          demand_id?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          leader_id?: string | null
          location?: string | null
          neighborhood?: string | null
          notes?: string | null
          organization_id?: string
          responsible_user_id?: string | null
          status?: string
          supporter_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          organization_id: string
          related_id: string
          related_table: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          organization_id: string
          related_id: string
          related_table: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          organization_id?: string
          related_id?: string
          related_table?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          attendance_type: string
          attended_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          leader_id: string | null
          notes: string | null
          organization_id: string
          priority: string
          requested_at: string
          responsible_user_id: string | null
          result_description: string | null
          return_channel: string | null
          return_sent: boolean
          status: string
          supporter_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attendance_type: string
          attended_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          leader_id?: string | null
          notes?: string | null
          organization_id: string
          priority?: string
          requested_at?: string
          responsible_user_id?: string | null
          result_description?: string | null
          return_channel?: string | null
          return_sent?: boolean
          status?: string
          supporter_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attendance_type?: string
          attended_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          leader_id?: string | null
          notes?: string | null
          organization_id?: string
          priority?: string
          requested_at?: string
          responsible_user_id?: string | null
          result_description?: string | null
          return_channel?: string | null
          return_sent?: boolean
          status?: string
          supporter_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_updates: {
        Row: {
          comment: string | null
          created_at: string
          demand_id: string
          id: string
          organization_id: string
          status: string
          updated_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          demand_id: string
          id?: string
          organization_id: string
          status: string
          updated_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          demand_id?: string
          id?: string
          organization_id?: string
          status?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_updates_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_updates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          address: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          demand_type: string | null
          description: string | null
          due_date: string | null
          id: string
          latitude: number | null
          leader_id: string | null
          longitude: number | null
          neighborhood: string | null
          neighborhood_id: string | null
          notes: string | null
          organization_id: string
          priority: string
          public_agency: string | null
          requested_at: string
          responsible_user_id: string | null
          result_description: string | null
          status: string
          supporter_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          demand_type?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          latitude?: number | null
          leader_id?: string | null
          longitude?: number | null
          neighborhood?: string | null
          neighborhood_id?: string | null
          notes?: string | null
          organization_id: string
          priority?: string
          public_agency?: string | null
          requested_at?: string
          responsible_user_id?: string | null
          result_description?: string | null
          status?: string
          supporter_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          demand_type?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          latitude?: number | null
          leader_id?: string | null
          longitude?: number | null
          neighborhood?: string | null
          neighborhood_id?: string | null
          notes?: string | null
          organization_id?: string
          priority?: string
          public_agency?: string | null
          requested_at?: string
          responsible_user_id?: string | null
          result_description?: string | null
          status?: string
          supporter_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          interaction_type: string | null
          leader_id: string | null
          organization_id: string
          person_type: string | null
          supporter_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interaction_type?: string | null
          leader_id?: string | null
          organization_id: string
          person_type?: string | null
          supporter_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interaction_type?: string | null
          leader_id?: string | null
          organization_id?: string
          person_type?: string | null
          supporter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      leaders: {
        Row: {
          address: string | null
          birth_date: string | null
          can_view_attendances: boolean
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          influence_level: string | null
          latitude: number | null
          leader_type: string | null
          longitude: number | null
          name: string
          neighborhood: string | null
          neighborhood_id: string | null
          nickname: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          photo_url: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          can_view_attendances?: boolean
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          latitude?: number | null
          leader_type?: string | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          neighborhood_id?: string | null
          nickname?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          can_view_attendances?: boolean
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          latitude?: number | null
          leader_type?: string | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          neighborhood_id?: string | null
          nickname?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaders_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          status: string
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          subject?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          city: string | null
          classification: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          population_estimate: number | null
          state: string | null
        }
        Insert: {
          city?: string | null
          classification?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          population_estimate?: number | null
          state?: string | null
        }
        Update: {
          city?: string | null
          classification?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          population_estimate?: number | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          notification_type: string | null
          organization_id: string
          related_id: string | null
          related_table: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string | null
          organization_id: string
          related_id?: string | null
          related_table?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string | null
          organization_id?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      supporters: {
        Row: {
          address: string
          birth_date: string
          city: string | null
          consent_date: string | null
          consent_email: boolean
          consent_origin: string | null
          consent_registration: boolean
          consent_whatsapp: boolean
          created_at: string
          created_by: string | null
          email: string | null
          gender: string | null
          id: string
          latitude: number | null
          leader_id: string | null
          longitude: number | null
          name: string
          neighborhood: string | null
          neighborhood_id: string | null
          notes: string | null
          organization_id: string
          origin: string | null
          phone: string
          profession: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address: string
          birth_date: string
          city?: string | null
          consent_date?: string | null
          consent_email?: boolean
          consent_origin?: string | null
          consent_registration?: boolean
          consent_whatsapp?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          latitude?: number | null
          leader_id?: string | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          neighborhood_id?: string | null
          notes?: string | null
          organization_id: string
          origin?: string | null
          phone: string
          profession?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string
          birth_date?: string
          city?: string | null
          consent_date?: string | null
          consent_email?: boolean
          consent_origin?: string | null
          consent_registration?: boolean
          consent_whatsapp?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          latitude?: number | null
          leader_id?: string | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          neighborhood_id?: string | null
          notes?: string | null
          organization_id?: string
          origin?: string | null
          phone?: string
          profession?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supporters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporters_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporters_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supporters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_platform_admin: boolean
          leader_id: string | null
          organization_id: string
          phone: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_platform_admin?: boolean
          leader_id?: string | null
          organization_id: string
          phone?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_platform_admin?: boolean
          leader_id?: string | null
          organization_id?: string
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_profiles_leader"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_own_supporter: { Args: { p_leader_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
