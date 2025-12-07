export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      buyer_documents: {
        Row: {
          buyer_id: string
          document_type: string
          file_name: string
          file_path: string
          id: string
          notes: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          buyer_id: string
          document_type: string
          file_name: string
          file_path: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          buyer_id?: string
          document_type?: string
          file_name?: string
          file_path?: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          parcelle_id: string | null
          title: string
          type: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          parcelle_id?: string | null
          title: string
          type: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          parcelle_id?: string | null
          title?: string
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
        ]
      }
      hectares: {
        Row: {
          amount_paid: number | null
          buyer_address: string | null
          buyer_birth_date: string | null
          buyer_birth_place: string | null
          buyer_children_count: number | null
          buyer_email: string | null
          buyer_first_name: string | null
          buyer_groupement: string | null
          buyer_last_name: string | null
          buyer_marital_status: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_profession: string | null
          buyer_province: string | null
          buyer_secteur: string | null
          buyer_territoire: string | null
          buyer_village_origin: string | null
          created_at: string
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          paper_form_completed: boolean | null
          payment_type: string | null
          prix: number | null
          purchase_type: string | null
          remaining_amount: number | null
          rmb_number: string | null
          sale_date: string | null
          sale_type: string | null
          site_id: string | null
          status: string | null
          surface: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          buyer_address?: string | null
          buyer_birth_date?: string | null
          buyer_birth_place?: string | null
          buyer_children_count?: number | null
          buyer_email?: string | null
          buyer_first_name?: string | null
          buyer_groupement?: string | null
          buyer_last_name?: string | null
          buyer_marital_status?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_profession?: string | null
          buyer_province?: string | null
          buyer_secteur?: string | null
          buyer_territoire?: string | null
          buyer_village_origin?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          paper_form_completed?: boolean | null
          payment_type?: string | null
          prix?: number | null
          purchase_type?: string | null
          remaining_amount?: number | null
          rmb_number?: string | null
          sale_date?: string | null
          sale_type?: string | null
          site_id?: string | null
          status?: string | null
          surface: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          buyer_address?: string | null
          buyer_birth_date?: string | null
          buyer_birth_place?: string | null
          buyer_children_count?: number | null
          buyer_email?: string | null
          buyer_first_name?: string | null
          buyer_groupement?: string | null
          buyer_last_name?: string | null
          buyer_marital_status?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_profession?: string | null
          buyer_province?: string | null
          buyer_secteur?: string | null
          buyer_territoire?: string | null
          buyer_village_origin?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          paper_form_completed?: boolean | null
          payment_type?: string | null
          prix?: number | null
          purchase_type?: string | null
          remaining_amount?: number | null
          rmb_number?: string | null
          sale_date?: string | null
          sale_type?: string | null
          site_id?: string | null
          status?: string | null
          surface?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hectares_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelles: {
        Row: {
          amount_paid: number | null
          buyer_address: string | null
          buyer_birth_date: string | null
          buyer_birth_place: string | null
          buyer_children_count: number | null
          buyer_email: string | null
          buyer_first_name: string | null
          buyer_groupement: string | null
          buyer_last_name: string | null
          buyer_marital_status: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_profession: string | null
          buyer_province: string | null
          buyer_secteur: string | null
          buyer_territoire: string | null
          buyer_village_origin: string | null
          created_at: string
          hectare_id: string | null
          id: string
          is_merge_primary: boolean | null
          latitude: number | null
          longitude: number | null
          merged_group_id: string | null
          numero: string
          paper_form_completed: boolean | null
          payment_type: string | null
          prix: number
          purchase_type: string | null
          remaining_amount: number | null
          rmb_number: string | null
          sale_date: string | null
          sale_type: string | null
          status: string | null
          surface: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          buyer_address?: string | null
          buyer_birth_date?: string | null
          buyer_birth_place?: string | null
          buyer_children_count?: number | null
          buyer_email?: string | null
          buyer_first_name?: string | null
          buyer_groupement?: string | null
          buyer_last_name?: string | null
          buyer_marital_status?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_profession?: string | null
          buyer_province?: string | null
          buyer_secteur?: string | null
          buyer_territoire?: string | null
          buyer_village_origin?: string | null
          created_at?: string
          hectare_id?: string | null
          id?: string
          is_merge_primary?: boolean | null
          latitude?: number | null
          longitude?: number | null
          merged_group_id?: string | null
          numero: string
          paper_form_completed?: boolean | null
          payment_type?: string | null
          prix: number
          purchase_type?: string | null
          remaining_amount?: number | null
          rmb_number?: string | null
          sale_date?: string | null
          sale_type?: string | null
          status?: string | null
          surface: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          buyer_address?: string | null
          buyer_birth_date?: string | null
          buyer_birth_place?: string | null
          buyer_children_count?: number | null
          buyer_email?: string | null
          buyer_first_name?: string | null
          buyer_groupement?: string | null
          buyer_last_name?: string | null
          buyer_marital_status?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_profession?: string | null
          buyer_province?: string | null
          buyer_secteur?: string | null
          buyer_territoire?: string | null
          buyer_village_origin?: string | null
          created_at?: string
          hectare_id?: string | null
          id?: string
          is_merge_primary?: boolean | null
          latitude?: number | null
          longitude?: number | null
          merged_group_id?: string | null
          numero?: string
          paper_form_completed?: boolean | null
          payment_type?: string | null
          prix?: number
          purchase_type?: string | null
          remaining_amount?: number | null
          rmb_number?: string | null
          sale_date?: string | null
          sale_type?: string | null
          status?: string | null
          surface?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcelles_hectare_id_fkey"
            columns: ["hectare_id"]
            isOneToOne: false
            referencedRelation: "hectares"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          hectare_id: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          parcelle_id: string | null
          payment_date: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          hectare_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          parcelle_id?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          hectare_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          parcelle_id?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_hectare_id_fkey"
            columns: ["hectare_id"]
            isOneToOne: false
            referencedRelation: "hectares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parcelle_id_fkey"
            columns: ["parcelle_id"]
            isOneToOne: false
            referencedRelation: "parcelles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          organization: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          organization?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          organization?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
          quota_percentage: number | null
          surface_totale: number
          surface_vendue: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quota_percentage?: number | null
          surface_totale: number
          surface_vendue?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quota_percentage?: number | null
          surface_totale?: number
          surface_vendue?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_code: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_code: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _permission_code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
