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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_completions: {
        Row: {
          action_key: string
          completed_date: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_key: string
          completed_date?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_key?: string
          completed_date?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      derived_patterns: {
        Row: {
          category: string
          dismissed_at: string | null
          evidence: Json
          first_detected_at: string
          generated_question_id: string | null
          id: string
          last_confirmed_at: string
          rule_id: string
          rule_version: number
          severity: string
          status: string
          summary: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          dismissed_at?: string | null
          evidence?: Json
          first_detected_at?: string
          generated_question_id?: string | null
          id?: string
          last_confirmed_at?: string
          rule_id: string
          rule_version?: number
          severity: string
          status?: string
          summary: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          dismissed_at?: string | null
          evidence?: Json
          first_detected_at?: string
          generated_question_id?: string | null
          id?: string
          last_confirmed_at?: string
          rule_id?: string
          rule_version?: number
          severity?: string
          status?: string
          summary?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "derived_patterns_generated_question_id_fkey"
            columns: ["generated_question_id"]
            isOneToOne: false
            referencedRelation: "patient_question_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      food_logs: {
        Row: {
          entry: string
          id: string
          logged_at: string
          patient_id: string
          user_id: string | null
        }
        Insert: {
          entry: string
          id?: string
          logged_at?: string
          patient_id?: string
          user_id?: string | null
        }
        Update: {
          entry?: string
          id?: string
          logged_at?: string
          patient_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      patient_lab_observations: {
        Row: {
          canonical_name: string
          collection_date: string
          corrected: boolean
          corrected_at: string | null
          created_at: string
          display_name: string | null
          flag: string | null
          id: string
          original_value: number | null
          raw_name: string
          ref_high: number | null
          ref_low: number | null
          source: string | null
          unit: string
          upload_id: string
          user_id: string
          value: number
        }
        Insert: {
          canonical_name: string
          collection_date: string
          corrected?: boolean
          corrected_at?: string | null
          created_at?: string
          display_name?: string | null
          flag?: string | null
          id?: string
          original_value?: number | null
          raw_name: string
          ref_high?: number | null
          ref_low?: number | null
          source?: string | null
          unit: string
          upload_id: string
          user_id: string
          value: number
        }
        Update: {
          canonical_name?: string
          collection_date?: string
          corrected?: boolean
          corrected_at?: string | null
          created_at?: string
          display_name?: string | null
          flag?: string | null
          id?: string
          original_value?: number | null
          raw_name?: string
          ref_high?: number | null
          ref_low?: number | null
          source?: string | null
          unit?: string
          upload_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_lab_observations_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_lab_uploads: {
        Row: {
          collection_date: string | null
          created_at: string
          error_message: string | null
          file_size_bytes: number | null
          id: string
          observations_duplicates: number | null
          observations_extracted: number | null
          observations_inserted: number | null
          ordering_provider: string | null
          original_filename: string
          processing_completed_at: string | null
          processing_started_at: string | null
          retry_count: number
          source_lab: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          collection_date?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          observations_duplicates?: number | null
          observations_extracted?: number | null
          observations_inserted?: number | null
          ordering_provider?: string | null
          original_filename: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          retry_count?: number
          source_lab?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          collection_date?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          observations_duplicates?: number | null
          observations_extracted?: number | null
          observations_inserted?: number | null
          ordering_provider?: string | null
          original_filename?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          retry_count?: number
          source_lab?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_narratives: {
        Row: {
          created_at: string
          generation_ms: number | null
          id: string
          input_biomarker_count: number | null
          input_pattern_count: number | null
          model_used: string
          narrative: Json
          retry_count: number
          status: string
          user_id: string
          validation_error: string | null
          version: number
        }
        Insert: {
          created_at?: string
          generation_ms?: number | null
          id?: string
          input_biomarker_count?: number | null
          input_pattern_count?: number | null
          model_used: string
          narrative: Json
          retry_count?: number
          status?: string
          user_id: string
          validation_error?: string | null
          version: number
        }
        Update: {
          created_at?: string
          generation_ms?: number | null
          id?: string
          input_biomarker_count?: number | null
          input_pattern_count?: number | null
          model_used?: string
          narrative?: Json
          retry_count?: number
          status?: string
          user_id?: string
          validation_error?: string | null
          version?: number
        }
        Relationships: []
      }
      patient_question_queue: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          priority: number
          question: string
          rationale: string | null
          source: string
          source_user_message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          priority?: number
          question: string
          rationale?: string | null
          source?: string
          source_user_message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          priority?: number
          question?: string
          rationale?: string | null
          source?: string
          source_user_message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          share_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          share_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          share_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          id: string
          patient_id: string
          recorded_at: string
          transcript: string
          user_id: string | null
        }
        Insert: {
          id?: string
          patient_id?: string
          recorded_at?: string
          transcript: string
          user_id?: string | null
        }
        Update: {
          id?: string
          patient_id?: string
          recorded_at?: string
          transcript?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_narrative_version: { Args: { p_user_id: string }; Returns: number }
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
