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
      action_plans: {
        Row: {
          assessment_id: string | null
          created_at: string
          id: string
          retest_schedule: Json
          sequence_explanation: string | null
          status: string
          today_actions: Json
          updated_at: string
          user_id: string
          version: number
          voice_validation_status: string | null
          voice_validation_warnings: Json | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          retest_schedule?: Json
          sequence_explanation?: string | null
          status?: string
          today_actions?: Json
          updated_at?: string
          user_id: string
          version?: number
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          retest_schedule?: Json
          sequence_explanation?: string | null
          status?: string
          today_actions?: Json
          updated_at?: string
          user_id?: string
          version?: number
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cie_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_view_as_audit: {
        Row: {
          admin_user_id: string
          created_at: string
          event_detail: Json
          event_type: string
          id: string
          session_id: string | null
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          event_detail?: Json
          event_type: string
          id?: string
          session_id?: string | null
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          event_detail?: Json
          event_type?: string
          id?: string
          session_id?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_view_as_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_view_as_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_view_as_sessions: {
        Row: {
          access_count: number
          admin_user_id: string
          expires_at: string
          granted_at: string
          id: string
          last_accessed_at: string | null
          reason: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          target_user_id: string
        }
        Insert: {
          access_count?: number
          admin_user_id: string
          expires_at: string
          granted_at?: string
          id?: string
          last_accessed_at?: string | null
          reason: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          target_user_id: string
        }
        Update: {
          access_count?: number
          admin_user_id?: string
          expires_at?: string
          granted_at?: string
          id?: string
          last_accessed_at?: string | null
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      answer_evidence_refs: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          ref_id: string
          ref_type: string
          usage: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          ref_id: string
          ref_type: string
          usage?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          ref_id?: string
          ref_type?: string
          usage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_evidence_refs_answer_fk"
            columns: ["answer_id", "user_id"]
            isOneToOne: false
            referencedRelation: "patient_chat_validation_log"
            referencedColumns: ["answer_id", "user_id"]
          },
        ]
      }
      biotwin_reports: {
        Row: {
          adapter_version: string
          attestation: Json
          clinician_review_required: boolean
          content_sha256: string
          created_at: string
          executive_synthesis: Json
          generated_date: string | null
          holds: string[]
          id: string
          import_diagnostics: Json
          patient_release_permitted: boolean
          raw_report: Json
          release_control: Json
          report_type: string
          schema_name: string
          schema_version: string | null
          semantic_repair_version: string | null
          status: string
          twin_id: string | null
          updated_at: string
          upload_id: string | null
          user_id: string
          version: number
        }
        Insert: {
          adapter_version: string
          attestation?: Json
          clinician_review_required?: boolean
          content_sha256: string
          created_at?: string
          executive_synthesis?: Json
          generated_date?: string | null
          holds?: string[]
          id?: string
          import_diagnostics?: Json
          patient_release_permitted?: boolean
          raw_report: Json
          release_control?: Json
          report_type: string
          schema_name: string
          schema_version?: string | null
          semantic_repair_version?: string | null
          status?: string
          twin_id?: string | null
          updated_at?: string
          upload_id?: string | null
          user_id: string
          version?: number
        }
        Update: {
          adapter_version?: string
          attestation?: Json
          clinician_review_required?: boolean
          content_sha256?: string
          created_at?: string
          executive_synthesis?: Json
          generated_date?: string | null
          holds?: string[]
          id?: string
          import_diagnostics?: Json
          patient_release_permitted?: boolean
          raw_report?: Json
          release_control?: Json
          report_type?: string
          schema_name?: string
          schema_version?: string | null
          semantic_repair_version?: string | null
          status?: string
          twin_id?: string | null
          updated_at?: string
          upload_id?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "biotwin_reports_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      biotwin_statements: {
        Row: {
          body: string | null
          bounds: string[]
          clinical_authority: string
          created_at: string
          holds: string[]
          id: string
          measurements: Json
          ordinal: number
          provenance: Json
          report_id: string
          requires_measurement: Json | null
          section: string
          source_id: string
          statement_kind: string
          timepoint: string | null
          title: string
          truth_status: string
          user_id: string
          witness_id: string | null
        }
        Insert: {
          body?: string | null
          bounds?: string[]
          clinical_authority: string
          created_at?: string
          holds?: string[]
          id?: string
          measurements?: Json
          ordinal: number
          provenance?: Json
          report_id: string
          requires_measurement?: Json | null
          section: string
          source_id: string
          statement_kind: string
          timepoint?: string | null
          title: string
          truth_status: string
          user_id: string
          witness_id?: string | null
        }
        Update: {
          body?: string | null
          bounds?: string[]
          clinical_authority?: string
          created_at?: string
          holds?: string[]
          id?: string
          measurements?: Json
          ordinal?: number
          provenance?: Json
          report_id?: string
          requires_measurement?: Json | null
          section?: string
          source_id?: string
          statement_kind?: string
          timepoint?: string | null
          title?: string
          truth_status?: string
          user_id?: string
          witness_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biotwin_statements_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "biotwin_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biotwin_statements_witness_id_fkey"
            columns: ["witness_id"]
            isOneToOne: false
            referencedRelation: "witness_objects"
            referencedColumns: ["witness_id"]
          },
        ]
      }
      celf_exports: {
        Row: {
          bundle: Json
          bundle_version: string
          content_sha256: string
          downloaded_at: string | null
          failure_reason: string | null
          feature_state_count: number
          generated_at: string
          has_cie: boolean
          has_food_log: boolean
          has_inbody: boolean
          has_labs: boolean
          id: string
          map_version: string
          observation_count: number
          phi_level: string
          pushed_at: string | null
          pushed_to_url: string | null
          shared_with_clinician_at: string | null
          source_document_count: number
          status: string
          subject_count: number
          user_id: string
        }
        Insert: {
          bundle: Json
          bundle_version?: string
          content_sha256: string
          downloaded_at?: string | null
          failure_reason?: string | null
          feature_state_count?: number
          generated_at?: string
          has_cie?: boolean
          has_food_log?: boolean
          has_inbody?: boolean
          has_labs?: boolean
          id?: string
          map_version?: string
          observation_count?: number
          phi_level?: string
          pushed_at?: string | null
          pushed_to_url?: string | null
          shared_with_clinician_at?: string | null
          source_document_count?: number
          status?: string
          subject_count?: number
          user_id: string
        }
        Update: {
          bundle?: Json
          bundle_version?: string
          content_sha256?: string
          downloaded_at?: string | null
          failure_reason?: string | null
          feature_state_count?: number
          generated_at?: string
          has_cie?: boolean
          has_food_log?: boolean
          has_inbody?: boolean
          has_labs?: boolean
          id?: string
          map_version?: string
          observation_count?: number
          phi_level?: string
          pushed_at?: string | null
          pushed_to_url?: string | null
          shared_with_clinician_at?: string | null
          source_document_count?: number
          status?: string
          subject_count?: number
          user_id?: string
        }
        Relationships: []
      }
      celf_feature_map: {
        Row: {
          celf_domain: string | null
          celf_feature_label: string | null
          celf_feature_name: string
          celf_panel_group: string | null
          created_at: string
          id: string
          map_version: string
          notes: string | null
          reveal_canonical: string
          source_system: string
          source_unit: string | null
          unit_canonical: string | null
          unit_factor: number
          unit_offset: number
        }
        Insert: {
          celf_domain?: string | null
          celf_feature_label?: string | null
          celf_feature_name: string
          celf_panel_group?: string | null
          created_at?: string
          id?: string
          map_version?: string
          notes?: string | null
          reveal_canonical: string
          source_system: string
          source_unit?: string | null
          unit_canonical?: string | null
          unit_factor?: number
          unit_offset?: number
        }
        Update: {
          celf_domain?: string | null
          celf_feature_label?: string | null
          celf_feature_name?: string
          celf_panel_group?: string | null
          created_at?: string
          id?: string
          map_version?: string
          notes?: string | null
          reveal_canonical?: string
          source_system?: string
          source_unit?: string | null
          unit_canonical?: string | null
          unit_factor?: number
          unit_offset?: number
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sections: Json | null
          user_id: string
          voice_validation_status: string | null
          voice_validation_warnings: Json | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sections?: Json | null
          user_id: string
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sections?: Json | null
          user_id?: string
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cie_assessments: {
        Row: {
          created_at: string
          full_completed_at: string | null
          id: string
          layer1_completed_at: string | null
          layer2_completed_at: string | null
          status: string
          total_questions_answered: number
          triggered_domains: string[]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          full_completed_at?: string | null
          id?: string
          layer1_completed_at?: string | null
          layer2_completed_at?: string | null
          status?: string
          total_questions_answered?: number
          triggered_domains?: string[]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          full_completed_at?: string | null
          id?: string
          layer1_completed_at?: string | null
          layer2_completed_at?: string | null
          status?: string
          total_questions_answered?: number
          triggered_domains?: string[]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      cie_domain_scores: {
        Row: {
          assessment_id: string
          axis: string
          created_at: string
          domain_id: string
          final_score: number
          id: string
          layer1_score: number
          layer2_score: number | null
          triggered_layer2: boolean
          user_id: string
        }
        Insert: {
          assessment_id: string
          axis: string
          created_at?: string
          domain_id: string
          final_score?: number
          id?: string
          layer1_score?: number
          layer2_score?: number | null
          triggered_layer2?: boolean
          user_id: string
        }
        Update: {
          assessment_id?: string
          axis?: string
          created_at?: string
          domain_id?: string
          final_score?: number
          id?: string
          layer1_score?: number
          layer2_score?: number | null
          triggered_layer2?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cie_domain_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cie_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      cie_gate_scores: {
        Row: {
          assessment_id: string
          contributing_domains: string[]
          created_at: string
          gate_id: string
          gate_name: string
          id: string
          score: number
          traffic_light: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          contributing_domains?: string[]
          created_at?: string
          gate_id: string
          gate_name: string
          id?: string
          score?: number
          traffic_light?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          contributing_domains?: string[]
          created_at?: string
          gate_id?: string
          gate_name?: string
          id?: string
          score?: number
          traffic_light?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cie_gate_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cie_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      cie_responses: {
        Row: {
          assessment_id: string
          created_at: string
          domain_id: string
          id: string
          layer: number
          question_id: string
          question_type: string
          raw_response: string
          response_latency_ms: number | null
          score: number
          t1_answer: string | null
          t1_latency_ms: number | null
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          domain_id: string
          id?: string
          layer: number
          question_id: string
          question_type: string
          raw_response: string
          response_latency_ms?: number | null
          score?: number
          t1_answer?: string | null
          t1_latency_ms?: number | null
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          domain_id?: string
          id?: string
          layer?: number
          question_id?: string
          question_type?: string
          raw_response?: string
          response_latency_ms?: number | null
          score?: number
          t1_answer?: string | null
          t1_latency_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cie_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cie_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_evidence: {
        Row: {
          cluster_id: string
          created_at: string
          direction: Database["public"]["Enums"]["cluster_evidence_direction"]
          evidence_id: string
          evidence_kind: string
          id: string
          layer_type: Database["public"]["Enums"]["cluster_evidence_layer"]
          time_point: string | null
          weight: number
        }
        Insert: {
          cluster_id: string
          created_at?: string
          direction?: Database["public"]["Enums"]["cluster_evidence_direction"]
          evidence_id: string
          evidence_kind: string
          id?: string
          layer_type: Database["public"]["Enums"]["cluster_evidence_layer"]
          time_point?: string | null
          weight?: number
        }
        Update: {
          cluster_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["cluster_evidence_direction"]
          evidence_id?: string
          evidence_kind?: string
          id?: string
          layer_type?: Database["public"]["Enums"]["cluster_evidence_layer"]
          time_point?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "cluster_evidence_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          claim: string
          cluster_kind: string
          coherence_signals: Json
          confidence_dimensions: Json
          confidence_score: number
          confidence_tier: Database["public"]["Enums"]["cluster_confidence_tier"]
          constituent_evidence: Json
          created_at: string
          generation_run_id: string | null
          id: string
          linked_intervention_ids: string[]
          linked_surfaces: Json
          missing_evidence: Json
          notes: string | null
          patient_id: string
          provenance: Json
          status: string
          tensions_held: Json
          updated_at: string
        }
        Insert: {
          claim: string
          cluster_kind: string
          coherence_signals?: Json
          confidence_dimensions?: Json
          confidence_score?: number
          confidence_tier?: Database["public"]["Enums"]["cluster_confidence_tier"]
          constituent_evidence?: Json
          created_at?: string
          generation_run_id?: string | null
          id?: string
          linked_intervention_ids?: string[]
          linked_surfaces?: Json
          missing_evidence?: Json
          notes?: string | null
          patient_id: string
          provenance?: Json
          status?: string
          tensions_held?: Json
          updated_at?: string
        }
        Update: {
          claim?: string
          cluster_kind?: string
          coherence_signals?: Json
          confidence_dimensions?: Json
          confidence_score?: number
          confidence_tier?: Database["public"]["Enums"]["cluster_confidence_tier"]
          constituent_evidence?: Json
          created_at?: string
          generation_run_id?: string | null
          id?: string
          linked_intervention_ids?: string[]
          linked_surfaces?: Json
          missing_evidence?: Json
          notes?: string | null
          patient_id?: string
          provenance?: Json
          status?: string
          tensions_held?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_assignment_witnesses: {
        Row: {
          candidate_concept_id: string
          caw_id: string
          coherence_result: string
          composite_identity_score: number
          confidence_basis: string
          confidence_value: number
          created_at: string
          current_state: Database["public"]["Enums"]["rae_admission_state"]
          current_state_actor_id: string
          current_state_actor_kind: string
          current_state_entered_at: string
          engine_version_id: string
          founder_review_flag: boolean
          id: string
          limitations: string[]
          ontology_version: string
          policy_at_decision: string
          produced_witness_id: string | null
          registry_seed_version: string
          signal_results: Json
          source_row_id: string
          source_table: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_concept_id: string
          caw_id: string
          coherence_result: string
          composite_identity_score: number
          confidence_basis: string
          confidence_value: number
          created_at?: string
          current_state: Database["public"]["Enums"]["rae_admission_state"]
          current_state_actor_id: string
          current_state_actor_kind: string
          current_state_entered_at?: string
          engine_version_id: string
          founder_review_flag?: boolean
          id?: string
          limitations: string[]
          ontology_version: string
          policy_at_decision?: string
          produced_witness_id?: string | null
          registry_seed_version: string
          signal_results: Json
          source_row_id: string
          source_table: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_concept_id?: string
          caw_id?: string
          coherence_result?: string
          composite_identity_score?: number
          confidence_basis?: string
          confidence_value?: number
          created_at?: string
          current_state?: Database["public"]["Enums"]["rae_admission_state"]
          current_state_actor_id?: string
          current_state_actor_kind?: string
          current_state_entered_at?: string
          engine_version_id?: string
          founder_review_flag?: boolean
          id?: string
          limitations?: string[]
          ontology_version?: string
          policy_at_decision?: string
          produced_witness_id?: string | null
          registry_seed_version?: string
          signal_results?: Json
          source_row_id?: string
          source_table?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_assignment_witnesses_engine_version_id_fkey"
            columns: ["engine_version_id"]
            isOneToOne: false
            referencedRelation: "rae_engine_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_assignment_witnesses_produced_witness_id_fkey"
            columns: ["produced_witness_id"]
            isOneToOne: false
            referencedRelation: "witness_objects"
            referencedColumns: ["witness_id"]
          },
        ]
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
          user_id: string
        }
        Insert: {
          entry: string
          id?: string
          logged_at?: string
          patient_id: string
          user_id: string
        }
        Update: {
          entry?: string
          id?: string
          logged_at?: string
          patient_id?: string
          user_id?: string
        }
        Relationships: []
      }
      observation_packets: {
        Row: {
          biological_timestamp: string
          context: Json | null
          created_at: string
          packet_id: string
          signal: string
          source_id: string | null
          source_method: string | null
          source_operator: string | null
          source_row_id: string | null
          source_table: string | null
          source_window: Database["public"]["Enums"]["witness_source_window"]
          system_timestamp: string
          unit: string | null
          user_id: string
          value: Json
        }
        Insert: {
          biological_timestamp: string
          context?: Json | null
          created_at?: string
          packet_id?: string
          signal: string
          source_id?: string | null
          source_method?: string | null
          source_operator?: string | null
          source_row_id?: string | null
          source_table?: string | null
          source_window: Database["public"]["Enums"]["witness_source_window"]
          system_timestamp?: string
          unit?: string | null
          user_id: string
          value: Json
        }
        Update: {
          biological_timestamp?: string
          context?: Json | null
          created_at?: string
          packet_id?: string
          signal?: string
          source_id?: string | null
          source_method?: string | null
          source_operator?: string | null
          source_row_id?: string | null
          source_table?: string | null
          source_window?: Database["public"]["Enums"]["witness_source_window"]
          system_timestamp?: string
          unit?: string | null
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      observation_review_queue: {
        Row: {
          classification_confidence: number | null
          id: string
          observation_id: string
          page_number: number | null
          proposed_concept_id: string | null
          proposed_concept_label: string | null
          proposed_new_concept: boolean
          proposed_unit: string | null
          queued_at: string
          raw_name: string
          raw_unit: string | null
          raw_value: number | null
          reject_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_concept_id: string | null
          reviewer_notes: string | null
          upload_id: string | null
          user_id: string
        }
        Insert: {
          classification_confidence?: number | null
          id?: string
          observation_id: string
          page_number?: number | null
          proposed_concept_id?: string | null
          proposed_concept_label?: string | null
          proposed_new_concept?: boolean
          proposed_unit?: string | null
          queued_at?: string
          raw_name: string
          raw_unit?: string | null
          raw_value?: number | null
          reject_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_concept_id?: string | null
          reviewer_notes?: string | null
          upload_id?: string | null
          user_id: string
        }
        Update: {
          classification_confidence?: number | null
          id?: string
          observation_id?: string
          page_number?: number | null
          proposed_concept_id?: string | null
          proposed_concept_label?: string | null
          proposed_new_concept?: boolean
          proposed_unit?: string | null
          queued_at?: string
          raw_name?: string
          raw_unit?: string | null
          raw_value?: number | null
          reject_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_concept_id?: string | null
          reviewer_notes?: string | null
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observation_review_queue_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_review_queue_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_concept_proposals: {
        Row: {
          example_raw_names: string[] | null
          first_seen_observation_id: string | null
          id: string
          merged_into_concept_id: string | null
          proposed_at: string
          proposed_by: string | null
          proposed_concept_id: string
          proposed_domain: string | null
          proposed_label: string
          proposed_unit: string | null
          status: string
        }
        Insert: {
          example_raw_names?: string[] | null
          first_seen_observation_id?: string | null
          id?: string
          merged_into_concept_id?: string | null
          proposed_at?: string
          proposed_by?: string | null
          proposed_concept_id: string
          proposed_domain?: string | null
          proposed_label: string
          proposed_unit?: string | null
          status?: string
        }
        Update: {
          example_raw_names?: string[] | null
          first_seen_observation_id?: string | null
          id?: string
          merged_into_concept_id?: string | null
          proposed_at?: string
          proposed_by?: string | null
          proposed_concept_id?: string
          proposed_domain?: string | null
          proposed_label?: string
          proposed_unit?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ontology_concept_proposals_first_seen_observation_id_fkey"
            columns: ["first_seen_observation_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_chat_validation_log: {
        Row: {
          answer_id: string
          authority_policy_version: string | null
          biotwin_packet_sha256: string | null
          biotwin_report_id: string | null
          biotwin_statement_count_available: number | null
          biotwin_validator_version: string | null
          cluster_count: number | null
          cluster_count_available: number | null
          context_bytes: number | null
          context_packet_sha256: string | null
          context_ref_manifest: Json | null
          conversation_id: string | null
          created_at: string
          doctor_question_generated: boolean | null
          dose_patterns_matched: string[]
          dose_policy_context: Json | null
          dose_policy_version: string | null
          emergency_routed: boolean | null
          fallback_used: boolean | null
          grounding_witness_count: number | null
          id: string
          input_tokens: number | null
          last_user_message: string | null
          latency_ms: number | null
          latest_witness_as_of: string | null
          marker_coverage: number | null
          message_role: string
          model_name: string | null
          model_provider: string | null
          original_output: string | null
          output_tokens: number | null
          prompt_template_version: string | null
          query_intent: string | null
          query_intent_rule: string | null
          question_timestamp: string | null
          regeneration_attempted: boolean
          regeneration_succeeded: boolean | null
          replaced_with: string | null
          replacement_template_used: string | null
          report_generated_at: string | null
          role_violation: Json | null
          routing_mode: string | null
          runtime_version: string | null
          sentences_checked: number | null
          status: string
          tokens_estimated: boolean | null
          twin_id: string | null
          twin_state_as_of: string | null
          twin_version: string | null
          user_id: string
          violations: Json
          witness_count_available: number | null
        }
        Insert: {
          answer_id?: string
          authority_policy_version?: string | null
          biotwin_packet_sha256?: string | null
          biotwin_report_id?: string | null
          biotwin_statement_count_available?: number | null
          biotwin_validator_version?: string | null
          cluster_count?: number | null
          cluster_count_available?: number | null
          context_bytes?: number | null
          context_packet_sha256?: string | null
          context_ref_manifest?: Json | null
          conversation_id?: string | null
          created_at?: string
          doctor_question_generated?: boolean | null
          dose_patterns_matched?: string[]
          dose_policy_context?: Json | null
          dose_policy_version?: string | null
          emergency_routed?: boolean | null
          fallback_used?: boolean | null
          grounding_witness_count?: number | null
          id?: string
          input_tokens?: number | null
          last_user_message?: string | null
          latency_ms?: number | null
          latest_witness_as_of?: string | null
          marker_coverage?: number | null
          message_role?: string
          model_name?: string | null
          model_provider?: string | null
          original_output?: string | null
          output_tokens?: number | null
          prompt_template_version?: string | null
          query_intent?: string | null
          query_intent_rule?: string | null
          question_timestamp?: string | null
          regeneration_attempted?: boolean
          regeneration_succeeded?: boolean | null
          replaced_with?: string | null
          replacement_template_used?: string | null
          report_generated_at?: string | null
          role_violation?: Json | null
          routing_mode?: string | null
          runtime_version?: string | null
          sentences_checked?: number | null
          status: string
          tokens_estimated?: boolean | null
          twin_id?: string | null
          twin_state_as_of?: string | null
          twin_version?: string | null
          user_id: string
          violations?: Json
          witness_count_available?: number | null
        }
        Update: {
          answer_id?: string
          authority_policy_version?: string | null
          biotwin_packet_sha256?: string | null
          biotwin_report_id?: string | null
          biotwin_statement_count_available?: number | null
          biotwin_validator_version?: string | null
          cluster_count?: number | null
          cluster_count_available?: number | null
          context_bytes?: number | null
          context_packet_sha256?: string | null
          context_ref_manifest?: Json | null
          conversation_id?: string | null
          created_at?: string
          doctor_question_generated?: boolean | null
          dose_patterns_matched?: string[]
          dose_policy_context?: Json | null
          dose_policy_version?: string | null
          emergency_routed?: boolean | null
          fallback_used?: boolean | null
          grounding_witness_count?: number | null
          id?: string
          input_tokens?: number | null
          last_user_message?: string | null
          latency_ms?: number | null
          latest_witness_as_of?: string | null
          marker_coverage?: number | null
          message_role?: string
          model_name?: string | null
          model_provider?: string | null
          original_output?: string | null
          output_tokens?: number | null
          prompt_template_version?: string | null
          query_intent?: string | null
          query_intent_rule?: string | null
          question_timestamp?: string | null
          regeneration_attempted?: boolean
          regeneration_succeeded?: boolean | null
          replaced_with?: string | null
          replacement_template_used?: string | null
          report_generated_at?: string | null
          role_violation?: Json | null
          routing_mode?: string | null
          runtime_version?: string | null
          sentences_checked?: number | null
          status?: string
          tokens_estimated?: boolean | null
          twin_id?: string | null
          twin_state_as_of?: string | null
          twin_version?: string | null
          user_id?: string
          violations?: Json
          witness_count_available?: number | null
        }
        Relationships: []
      }
      patient_intent_profiles: {
        Row: {
          created_at: string
          doctors_missing: string | null
          id: string
          ninety_day_change: string | null
          think_about_most: string | null
          unexplained_result: string | null
          updated_at: string
          user_id: string
          version: number
          want_to_understand: string | null
        }
        Insert: {
          created_at?: string
          doctors_missing?: string | null
          id?: string
          ninety_day_change?: string | null
          think_about_most?: string | null
          unexplained_result?: string | null
          updated_at?: string
          user_id: string
          version?: number
          want_to_understand?: string | null
        }
        Update: {
          created_at?: string
          doctors_missing?: string | null
          id?: string
          ninety_day_change?: string | null
          think_about_most?: string | null
          unexplained_result?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          want_to_understand?: string | null
        }
        Relationships: []
      }
      patient_lab_observations: {
        Row: {
          biomarker_class: string | null
          canonical_concept_id: string | null
          canonical_name: string
          canonical_unit: string | null
          canonical_value: number | null
          classification_confidence: number | null
          classification_method: string | null
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
          specimen_type: string | null
          unit: string
          upload_id: string
          user_id: string
          value: number
        }
        Insert: {
          biomarker_class?: string | null
          canonical_concept_id?: string | null
          canonical_name: string
          canonical_unit?: string | null
          canonical_value?: number | null
          classification_confidence?: number | null
          classification_method?: string | null
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
          specimen_type?: string | null
          unit: string
          upload_id: string
          user_id: string
          value: number
        }
        Update: {
          biomarker_class?: string | null
          canonical_concept_id?: string | null
          canonical_name?: string
          canonical_unit?: string | null
          canonical_value?: number | null
          classification_confidence?: number | null
          classification_method?: string | null
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
          specimen_type?: string | null
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
          content_sha256: string | null
          created_at: string
          document_type: string | null
          error_message: string | null
          extracted_patient_dob: string | null
          extracted_patient_mrn: string | null
          extracted_patient_name: string | null
          file_size_bytes: number | null
          id: string
          identity_confirmation_kind: string | null
          identity_confirmed_at: string | null
          identity_confirmed_name: string | null
          name_match_score: number | null
          name_match_status: string | null
          observations_duplicates: number | null
          observations_extracted: number | null
          observations_inserted: number | null
          ordering_provider: string | null
          original_filename: string
          processing_completed_at: string | null
          processing_started_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          retry_count: number
          source_lab: string | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          collection_date?: string | null
          content_sha256?: string | null
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          extracted_patient_dob?: string | null
          extracted_patient_mrn?: string | null
          extracted_patient_name?: string | null
          file_size_bytes?: number | null
          id?: string
          identity_confirmation_kind?: string | null
          identity_confirmed_at?: string | null
          identity_confirmed_name?: string | null
          name_match_score?: number | null
          name_match_status?: string | null
          observations_duplicates?: number | null
          observations_extracted?: number | null
          observations_inserted?: number | null
          ordering_provider?: string | null
          original_filename: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          retry_count?: number
          source_lab?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          collection_date?: string | null
          content_sha256?: string | null
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          extracted_patient_dob?: string | null
          extracted_patient_mrn?: string | null
          extracted_patient_name?: string | null
          file_size_bytes?: number | null
          id?: string
          identity_confirmation_kind?: string | null
          identity_confirmed_at?: string | null
          identity_confirmed_name?: string | null
          name_match_score?: number | null
          name_match_status?: string | null
          observations_duplicates?: number | null
          observations_extracted?: number | null
          observations_inserted?: number | null
          ordering_provider?: string | null
          original_filename?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
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
          voice_validation_status: string | null
          voice_validation_warnings: Json | null
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
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
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
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
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
          source_answer_id: string | null
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
          source_answer_id?: string | null
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
          source_answer_id?: string | null
          source_user_message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_question_queue_source_answer_fk"
            columns: ["source_answer_id"]
            isOneToOne: false
            referencedRelation: "patient_chat_validation_log"
            referencedColumns: ["answer_id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          ask_my_twin_release0_enabled: boolean
          consumer_action_plan_mode: string
          created_at: string
          display_name: string | null
          first_name: string | null
          first_time_banner_dismissed_at: string | null
          id: string
          name_aliases: string[] | null
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          onboarding_step: string | null
          preferred_name: string | null
          sex: string | null
          share_token: string | null
          signature_color: string | null
          study_summary: string | null
          terrain_share_token: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          ask_my_twin_release0_enabled?: boolean
          consumer_action_plan_mode?: string
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          first_time_banner_dismissed_at?: string | null
          id?: string
          name_aliases?: string[] | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: string | null
          preferred_name?: string | null
          sex?: string | null
          share_token?: string | null
          signature_color?: string | null
          study_summary?: string | null
          terrain_share_token?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          ask_my_twin_release0_enabled?: boolean
          consumer_action_plan_mode?: string
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          first_time_banner_dismissed_at?: string | null
          id?: string
          name_aliases?: string[] | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: string | null
          preferred_name?: string | null
          sex?: string | null
          share_token?: string | null
          signature_color?: string | null
          study_summary?: string | null
          terrain_share_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rae_engine_concept_overrides: {
        Row: {
          candidate_concept_id: string
          created_at: string
          engine_version_id: string
          id: string
          lifted: boolean
          lifted_at: string | null
          lifted_by: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          candidate_concept_id: string
          created_at?: string
          engine_version_id: string
          id?: string
          lifted?: boolean
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          candidate_concept_id?: string
          created_at?: string
          engine_version_id?: string
          id?: string
          lifted?: boolean
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rae_engine_concept_overrides_engine_version_id_fkey"
            columns: ["engine_version_id"]
            isOneToOne: false
            referencedRelation: "rae_engine_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rae_engine_versions: {
        Row: {
          activated_at: string | null
          calibration_mode: boolean
          created_at: string
          id: string
          notes: string | null
          ontology_version: string
          parameters: Json
          registry_seed_version: string
          semver: string
          threshold_admission: number
          threshold_rejection_floor: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          calibration_mode?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          ontology_version: string
          parameters?: Json
          registry_seed_version: string
          semver: string
          threshold_admission: number
          threshold_rejection_floor: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          calibration_mode?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          ontology_version?: string
          parameters?: Json
          registry_seed_version?: string
          semver?: string
          threshold_admission?: number
          threshold_rejection_floor?: number
          updated_at?: string
        }
        Relationships: []
      }
      rae_signal_config: {
        Row: {
          candidate_concept_id: string
          created_at: string
          engine_version_id: string
          id: string
          notes: string | null
          parameters: Json
          signal_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          candidate_concept_id: string
          created_at?: string
          engine_version_id: string
          id?: string
          notes?: string | null
          parameters?: Json
          signal_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          candidate_concept_id?: string
          created_at?: string
          engine_version_id?: string
          id?: string
          notes?: string | null
          parameters?: Json
          signal_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rae_signal_config_engine_version_id_fkey"
            columns: ["engine_version_id"]
            isOneToOne: false
            referencedRelation: "rae_engine_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rae_state_transitions: {
        Row: {
          actor_id: string
          actor_kind: string
          caw_id: string
          created_at: string
          from_state: Database["public"]["Enums"]["rae_admission_state"] | null
          id: string
          policy: string
          reason: string
          to_state: Database["public"]["Enums"]["rae_admission_state"]
        }
        Insert: {
          actor_id: string
          actor_kind: string
          caw_id: string
          created_at?: string
          from_state?: Database["public"]["Enums"]["rae_admission_state"] | null
          id?: string
          policy?: string
          reason: string
          to_state: Database["public"]["Enums"]["rae_admission_state"]
        }
        Update: {
          actor_id?: string
          actor_kind?: string
          caw_id?: string
          created_at?: string
          from_state?: Database["public"]["Enums"]["rae_admission_state"] | null
          id?: string
          policy?: string
          reason?: string
          to_state?: Database["public"]["Enums"]["rae_admission_state"]
        }
        Relationships: [
          {
            foreignKeyName: "rae_state_transitions_caw_id_fkey"
            columns: ["caw_id"]
            isOneToOne: false
            referencedRelation: "concept_assignment_witnesses"
            referencedColumns: ["caw_id"]
          },
        ]
      }
      reconsideration_events: {
        Row: {
          assessment_id: string
          created_at: string
          delta_type: string | null
          domain_id: string
          id: string
          question_id: string
          t1_answer: string
          t1_latency_ms: number
          t2_answer: string | null
          t2_latency_ms: number | null
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          delta_type?: string | null
          domain_id: string
          id?: string
          question_id: string
          t1_answer: string
          t1_latency_ms: number
          t2_answer?: string | null
          t2_latency_ms?: number | null
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          delta_type?: string | null
          domain_id?: string
          id?: string
          question_id?: string
          t1_answer?: string
          t1_latency_ms?: number
          t2_answer?: string | null
          t2_latency_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconsideration_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cie_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      review_queue_audit_log: {
        Row: {
          created_at: string
          created_new_proposal: boolean
          id: string
          new_concept_id: string | null
          observation_id: string | null
          previous_concept_id: string | null
          queue_item_id: string
          reviewer_action: string
          reviewer_id: string
          reviewer_notes: string | null
        }
        Insert: {
          created_at?: string
          created_new_proposal?: boolean
          id?: string
          new_concept_id?: string | null
          observation_id?: string | null
          previous_concept_id?: string | null
          queue_item_id: string
          reviewer_action: string
          reviewer_id: string
          reviewer_notes?: string | null
        }
        Update: {
          created_at?: string
          created_new_proposal?: boolean
          id?: string
          new_concept_id?: string | null
          observation_id?: string | null
          previous_concept_id?: string | null
          queue_item_id?: string
          reviewer_action?: string
          reviewer_id?: string
          reviewer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_queue_audit_log_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_queue_audit_log_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "observation_review_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_checkpoints: {
        Row: {
          biomarkers: string[]
          checkpoint_at: string
          completed_at: string | null
          created_at: string
          experiment_id: string
          id: string
          measured_deltas: Json | null
          status: string
          updated_at: string
          user_id: string
          verdict: string | null
          verdict_summary: string | null
        }
        Insert: {
          biomarkers?: string[]
          checkpoint_at: string
          completed_at?: string | null
          created_at?: string
          experiment_id: string
          id?: string
          measured_deltas?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          verdict?: string | null
          verdict_summary?: string | null
        }
        Update: {
          biomarkers?: string[]
          checkpoint_at?: string
          completed_at?: string | null
          created_at?: string
          experiment_id?: string
          id?: string
          measured_deltas?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          verdict?: string | null
          verdict_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulator_checkpoints_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "simulator_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_daily_observations: {
        Row: {
          actual_dose: Json | null
          actual_duration_min: number | null
          actual_time: string | null
          confounders: Json
          created_at: string
          energy: number | null
          experiment_id: string
          id: string
          intervention_performed: boolean | null
          logged_at: string
          note: string | null
          observed_on: string
          phase: string
          primary_value: number | null
          recovery: number | null
          secondary_values: Json
          sleep_hours: number | null
          sleep_quality: number | null
          symptom: number | null
          user_id: string
        }
        Insert: {
          actual_dose?: Json | null
          actual_duration_min?: number | null
          actual_time?: string | null
          confounders?: Json
          created_at?: string
          energy?: number | null
          experiment_id: string
          id?: string
          intervention_performed?: boolean | null
          logged_at?: string
          note?: string | null
          observed_on: string
          phase: string
          primary_value?: number | null
          recovery?: number | null
          secondary_values?: Json
          sleep_hours?: number | null
          sleep_quality?: number | null
          symptom?: number | null
          user_id: string
        }
        Update: {
          actual_dose?: Json | null
          actual_duration_min?: number | null
          actual_time?: string | null
          confounders?: Json
          created_at?: string
          energy?: number | null
          experiment_id?: string
          id?: string
          intervention_performed?: boolean | null
          logged_at?: string
          note?: string | null
          observed_on?: string
          phase?: string
          primary_value?: number | null
          recovery?: number | null
          secondary_values?: Json
          sleep_hours?: number | null
          sleep_quality?: number | null
          symptom?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_daily_observations_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "simulator_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_experiment_comparisons: {
        Row: {
          abs_change: number | null
          adherence_pct: number | null
          computed_at: string
          confounder_burden: number | null
          direction_consistency_pct: number | null
          experiment_id: string
          human_summary: string | null
          id: string
          median_a: number | null
          median_b: number | null
          missingness_pct: number | null
          n_a: number
          n_b: number
          overlap_ratio: number | null
          pct_change: number | null
          phase_a: string
          phase_b: string
          reasons: Json
          result: string
          user_id: string
        }
        Insert: {
          abs_change?: number | null
          adherence_pct?: number | null
          computed_at?: string
          confounder_burden?: number | null
          direction_consistency_pct?: number | null
          experiment_id: string
          human_summary?: string | null
          id?: string
          median_a?: number | null
          median_b?: number | null
          missingness_pct?: number | null
          n_a: number
          n_b: number
          overlap_ratio?: number | null
          pct_change?: number | null
          phase_a: string
          phase_b: string
          reasons?: Json
          result: string
          user_id: string
        }
        Update: {
          abs_change?: number | null
          adherence_pct?: number | null
          computed_at?: string
          confounder_burden?: number | null
          direction_consistency_pct?: number | null
          experiment_id?: string
          human_summary?: string | null
          id?: string
          median_a?: number | null
          median_b?: number | null
          missingness_pct?: number | null
          n_a?: number
          n_b?: number
          overlap_ratio?: number | null
          pct_change?: number | null
          phase_a?: string
          phase_b?: string
          reasons?: Json
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_experiment_comparisons_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "simulator_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_experiment_protocols: {
        Row: {
          admission_reasons: Json | null
          admission_verdict: string | null
          allowed_cointerventions: string[]
          clinician_review_required: boolean
          contraindications: string[]
          created_at: string
          crossover: Json | null
          evidence_refs: Json
          expected_direction: string | null
          experiment_id: string
          hold_stable: string[]
          hypothesis_question: string
          id: string
          intervention: Json
          intervention_days: number
          min_adherence_pct: number
          min_observations_per_phase: number
          perturbation_category: string
          primary_outcome: Json
          protocol_version: number
          run_in_days: number
          secondary_outcomes: Json
          stop_criteria: string[]
          updated_at: string
          user_id: string
          washout_days: number | null
        }
        Insert: {
          admission_reasons?: Json | null
          admission_verdict?: string | null
          allowed_cointerventions?: string[]
          clinician_review_required?: boolean
          contraindications?: string[]
          created_at?: string
          crossover?: Json | null
          evidence_refs?: Json
          expected_direction?: string | null
          experiment_id: string
          hold_stable?: string[]
          hypothesis_question: string
          id?: string
          intervention?: Json
          intervention_days?: number
          min_adherence_pct?: number
          min_observations_per_phase?: number
          perturbation_category: string
          primary_outcome: Json
          protocol_version?: number
          run_in_days?: number
          secondary_outcomes?: Json
          stop_criteria?: string[]
          updated_at?: string
          user_id: string
          washout_days?: number | null
        }
        Update: {
          admission_reasons?: Json | null
          admission_verdict?: string | null
          allowed_cointerventions?: string[]
          clinician_review_required?: boolean
          contraindications?: string[]
          created_at?: string
          crossover?: Json | null
          evidence_refs?: Json
          expected_direction?: string | null
          experiment_id?: string
          hold_stable?: string[]
          hypothesis_question?: string
          id?: string
          intervention?: Json
          intervention_days?: number
          min_adherence_pct?: number
          min_observations_per_phase?: number
          perturbation_category?: string
          primary_outcome?: Json
          protocol_version?: number
          run_in_days?: number
          secondary_outcomes?: Json
          stop_criteria?: string[]
          updated_at?: string
          user_id?: string
          washout_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulator_experiment_protocols_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "simulator_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_experiments: {
        Row: {
          created_at: string
          ended_at: string | null
          horizon_days: number
          id: string
          intervention_started_at: string | null
          lever: string
          notes: string | null
          phase: string
          phase_started_at: string | null
          predicted_deltas: Json
          rationale: string
          run_in_started_at: string | null
          source_card_id: string | null
          source_cluster_ids: string[]
          source_terrain_render_id: string | null
          started_at: string
          status: string
          stopped_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          horizon_days?: number
          id?: string
          intervention_started_at?: string | null
          lever: string
          notes?: string | null
          phase?: string
          phase_started_at?: string | null
          predicted_deltas?: Json
          rationale: string
          run_in_started_at?: string | null
          source_card_id?: string | null
          source_cluster_ids?: string[]
          source_terrain_render_id?: string | null
          started_at?: string
          status?: string
          stopped_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          horizon_days?: number
          id?: string
          intervention_started_at?: string | null
          lever?: string
          notes?: string | null
          phase?: string
          phase_started_at?: string | null
          predicted_deltas?: Json
          rationale?: string
          run_in_started_at?: string | null
          source_card_id?: string | null
          source_cluster_ids?: string[]
          source_terrain_render_id?: string | null
          started_at?: string
          status?: string
          stopped_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_experiments_source_card_id_fkey"
            columns: ["source_card_id"]
            isOneToOne: false
            referencedRelation: "simulator_what_if_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_learnings: {
        Row: {
          body: string | null
          checkpoint_id: string | null
          confidence: number | null
          created_at: string
          cycle_count: number
          evidence_witness_ids: string[]
          experiment_id: string | null
          graduated: boolean
          headline: string
          id: string
          kind: string
          learning_status: string
          replicated_by_experiment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          checkpoint_id?: string | null
          confidence?: number | null
          created_at?: string
          cycle_count?: number
          evidence_witness_ids?: string[]
          experiment_id?: string | null
          graduated?: boolean
          headline: string
          id?: string
          kind?: string
          learning_status?: string
          replicated_by_experiment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          checkpoint_id?: string | null
          confidence?: number | null
          created_at?: string
          cycle_count?: number
          evidence_witness_ids?: string[]
          experiment_id?: string | null
          graduated?: boolean
          headline?: string
          id?: string
          kind?: string
          learning_status?: string
          replicated_by_experiment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_learnings_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "simulator_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulator_learnings_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "simulator_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_what_if_cards: {
        Row: {
          admission_reasons: Json | null
          admission_verdict: string | null
          committed_experiment_id: string | null
          confidence: number | null
          created_at: string
          dismissed_at: string | null
          engine_version: string | null
          evidence_label: string | null
          focus: string | null
          horizon_days: number
          id: string
          lever: string
          patient_safe: boolean
          perturbation_category: string | null
          predicted_deltas: Json
          primary_outcome: Json | null
          protocol_template: Json | null
          rationale: string
          safety_flags: Json | null
          seen_at: string | null
          source_cluster_ids: string[]
          source_terrain_render_id: string | null
          unbound_biomarkers: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admission_reasons?: Json | null
          admission_verdict?: string | null
          committed_experiment_id?: string | null
          confidence?: number | null
          created_at?: string
          dismissed_at?: string | null
          engine_version?: string | null
          evidence_label?: string | null
          focus?: string | null
          horizon_days?: number
          id?: string
          lever: string
          patient_safe?: boolean
          perturbation_category?: string | null
          predicted_deltas?: Json
          primary_outcome?: Json | null
          protocol_template?: Json | null
          rationale: string
          safety_flags?: Json | null
          seen_at?: string | null
          source_cluster_ids?: string[]
          source_terrain_render_id?: string | null
          unbound_biomarkers?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admission_reasons?: Json | null
          admission_verdict?: string | null
          committed_experiment_id?: string | null
          confidence?: number | null
          created_at?: string
          dismissed_at?: string | null
          engine_version?: string | null
          evidence_label?: string | null
          focus?: string | null
          horizon_days?: number
          id?: string
          lever?: string
          patient_safe?: boolean
          perturbation_category?: string | null
          predicted_deltas?: Json
          primary_outcome?: Json | null
          protocol_template?: Json | null
          rationale?: string
          safety_flags?: Json | null
          seen_at?: string | null
          source_cluster_ids?: string[]
          source_terrain_render_id?: string | null
          unbound_biomarkers?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terrain_renders: {
        Row: {
          assessment_id: string | null
          clinician_summary: Json | null
          created_at: string
          error_message: string | null
          generated_at: string | null
          generation_input_hash: string | null
          id: string
          patient_portrait: Json | null
          status: string
          updated_at: string
          user_id: string
          version: number
          voice_validation_status: string | null
          voice_validation_warnings: Json | null
        }
        Insert: {
          assessment_id?: string | null
          clinician_summary?: Json | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          generation_input_hash?: string | null
          id?: string
          patient_portrait?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
        }
        Update: {
          assessment_id?: string | null
          clinician_summary?: Json | null
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          generation_input_hash?: string | null
          id?: string
          patient_portrait?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
          voice_validation_status?: string | null
          voice_validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "terrain_renders_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "cie_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_rejection_audit: {
        Row: {
          account_holder_name: string | null
          content_sha256: string | null
          extracted_patient_name: string | null
          file_name: string | null
          id: string
          name_match_score: number | null
          rejected_at: string
          rejection_category: string
          rejection_detail: string | null
          upload_id: string | null
          user_id: string
        }
        Insert: {
          account_holder_name?: string | null
          content_sha256?: string | null
          extracted_patient_name?: string | null
          file_name?: string | null
          id?: string
          name_match_score?: number | null
          rejected_at?: string
          rejection_category: string
          rejection_detail?: string | null
          upload_id?: string | null
          user_id: string
        }
        Update: {
          account_holder_name?: string | null
          content_sha256?: string | null
          extracted_patient_name?: string | null
          file_name?: string | null
          id?: string
          name_match_score?: number | null
          rejected_at?: string
          rejection_category?: string
          rejection_detail?: string | null
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_rejection_audit_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "patient_lab_uploads"
            referencedColumns: ["id"]
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
      voice_notes: {
        Row: {
          id: string
          patient_id: string
          recorded_at: string
          transcript: string
          user_id: string
        }
        Insert: {
          id?: string
          patient_id: string
          recorded_at?: string
          transcript: string
          user_id: string
        }
        Update: {
          id?: string
          patient_id?: string
          recorded_at?: string
          transcript?: string
          user_id?: string
        }
        Relationships: []
      }
      witness_objects: {
        Row: {
          ancestry_witness_ids: string[] | null
          biological_timestamp: string
          compression_depth: number
          confidence_basis: string
          confidence_value: number
          conflict_candidates: string[] | null
          created_at: string
          derived_from_packet_id: string | null
          domain_of_access: Database["public"]["Enums"]["witness_domain_of_access"]
          epistemic_role: Database["public"]["Enums"]["witness_epistemic_role"]
          limitations: string[]
          observed_unit: string | null
          observed_value: Json
          registry_seed_version: string
          reliability_class: Database["public"]["Enums"]["witness_reliability_class"]
          signal: string
          source_row_id: string | null
          source_table: string | null
          source_window: Database["public"]["Enums"]["witness_source_window"]
          testimony: string
          transformation_version: string
          user_id: string
          validity_window_seconds: number | null
          witness_id: string
        }
        Insert: {
          ancestry_witness_ids?: string[] | null
          biological_timestamp: string
          compression_depth: number
          confidence_basis: string
          confidence_value: number
          conflict_candidates?: string[] | null
          created_at?: string
          derived_from_packet_id?: string | null
          domain_of_access: Database["public"]["Enums"]["witness_domain_of_access"]
          epistemic_role: Database["public"]["Enums"]["witness_epistemic_role"]
          limitations: string[]
          observed_unit?: string | null
          observed_value: Json
          registry_seed_version: string
          reliability_class: Database["public"]["Enums"]["witness_reliability_class"]
          signal: string
          source_row_id?: string | null
          source_table?: string | null
          source_window: Database["public"]["Enums"]["witness_source_window"]
          testimony: string
          transformation_version: string
          user_id: string
          validity_window_seconds?: number | null
          witness_id?: string
        }
        Update: {
          ancestry_witness_ids?: string[] | null
          biological_timestamp?: string
          compression_depth?: number
          confidence_basis?: string
          confidence_value?: number
          conflict_candidates?: string[] | null
          created_at?: string
          derived_from_packet_id?: string | null
          domain_of_access?: Database["public"]["Enums"]["witness_domain_of_access"]
          epistemic_role?: Database["public"]["Enums"]["witness_epistemic_role"]
          limitations?: string[]
          observed_unit?: string | null
          observed_value?: Json
          registry_seed_version?: string
          reliability_class?: Database["public"]["Enums"]["witness_reliability_class"]
          signal?: string
          source_row_id?: string | null
          source_table?: string | null
          source_window?: Database["public"]["Enums"]["witness_source_window"]
          testimony?: string
          transformation_version?: string
          user_id?: string
          validity_window_seconds?: number | null
          witness_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "witness_objects_derived_from_packet_id_fkey"
            columns: ["derived_from_packet_id"]
            isOneToOne: false
            referencedRelation: "observation_packets"
            referencedColumns: ["packet_id"]
          },
          {
            foreignKeyName: "witness_objects_source_window_signal_fkey"
            columns: ["source_window", "signal"]
            isOneToOne: false
            referencedRelation: "witness_signal_registry"
            referencedColumns: ["source_window", "signal"]
          },
        ]
      }
      witness_signal_registry: {
        Row: {
          compression_depth: number
          created_at: string
          default_confidence_basis: string
          default_confidence_value: number
          default_limitations: string[]
          default_validity_window_seconds: number | null
          description: string | null
          domain_of_access: Database["public"]["Enums"]["witness_domain_of_access"]
          epistemic_role: Database["public"]["Enums"]["witness_epistemic_role"]
          label: string
          ontology_concept_id: string | null
          ontology_version: string | null
          registry_seed_version: string
          reliability_class: Database["public"]["Enums"]["witness_reliability_class"]
          signal: string
          source_window: Database["public"]["Enums"]["witness_source_window"]
          unit: string | null
          updated_at: string
        }
        Insert: {
          compression_depth: number
          created_at?: string
          default_confidence_basis: string
          default_confidence_value: number
          default_limitations: string[]
          default_validity_window_seconds?: number | null
          description?: string | null
          domain_of_access: Database["public"]["Enums"]["witness_domain_of_access"]
          epistemic_role: Database["public"]["Enums"]["witness_epistemic_role"]
          label: string
          ontology_concept_id?: string | null
          ontology_version?: string | null
          registry_seed_version?: string
          reliability_class: Database["public"]["Enums"]["witness_reliability_class"]
          signal: string
          source_window: Database["public"]["Enums"]["witness_source_window"]
          unit?: string | null
          updated_at?: string
        }
        Update: {
          compression_depth?: number
          created_at?: string
          default_confidence_basis?: string
          default_confidence_value?: number
          default_limitations?: string[]
          default_validity_window_seconds?: number | null
          description?: string | null
          domain_of_access?: Database["public"]["Enums"]["witness_domain_of_access"]
          epistemic_role?: Database["public"]["Enums"]["witness_epistemic_role"]
          label?: string
          ontology_concept_id?: string | null
          ontology_version?: string | null
          registry_seed_version?: string
          reliability_class?: Database["public"]["Enums"]["witness_reliability_class"]
          signal?: string
          source_window?: Database["public"]["Enums"]["witness_source_window"]
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_witness_coverage: {
        Row: {
          compression_depth: number | null
          domain_of_access:
            | Database["public"]["Enums"]["witness_domain_of_access"]
            | null
          earliest_observation: string | null
          epistemic_role:
            | Database["public"]["Enums"]["witness_epistemic_role"]
            | null
          latest_observation: string | null
          mean_confidence: number | null
          signal: string | null
          source_window:
            | Database["public"]["Enums"]["witness_source_window"]
            | null
          user_id: string | null
          witness_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "witness_objects_source_window_signal_fkey"
            columns: ["source_window", "signal"]
            isOneToOne: false
            referencedRelation: "witness_signal_registry"
            referencedColumns: ["source_window", "signal"]
          },
        ]
      }
    }
    Functions: {
      fn_name_match_score: {
        Args: { p_account_name: string; p_extracted_name: string }
        Returns: number
      }
      fn_normalize_name: { Args: { p_name: string }; Returns: string }
      get_shared_clinical_summary: {
        Args: { p_token: string }
        Returns: {
          age: number
          clinician_summary: Json
          display_name: string
          first_name: string
          generated_at: string
          preferred_name: string
          sex: string
        }[]
      }
      get_shared_question_queue: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          display_name: string
          priority: number
          question: string
          question_id: string
          rationale: string
          source: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_view_as_session: {
        Args: { p_admin_user_id: string; p_target_user_id: string }
        Returns: boolean
      }
      next_action_plan_version: { Args: { p_user_id: string }; Returns: number }
      next_cie_version: { Args: { p_user_id: string }; Returns: number }
      next_narrative_version: { Args: { p_user_id: string }; Returns: number }
      next_terrain_render_version: {
        Args: { p_user_id: string }
        Returns: number
      }
      rae_insert_witness_object: { Args: { p_witness: Json }; Returns: string }
      rae_persist_initial_admission: {
        Args: { p_payload: Json }
        Returns: Json
      }
      resolve_observation_review_queue_item: {
        Args: {
          p_action: string
          p_concept_id?: string
          p_queue_item_id: string
          p_reviewer_notes?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      cluster_confidence_tier:
        | "emerging"
        | "tentative"
        | "developing"
        | "supported"
        | "robust"
      cluster_evidence_direction: "convergent" | "divergent" | "neutral"
      cluster_evidence_layer:
        | "cie"
        | "lab"
        | "inbody"
        | "emr"
        | "medication"
        | "sensor"
        | "food_log"
        | "imaging"
        | "omics"
        | "narrative"
      rae_admission_state:
        | "auto_admitted"
        | "needs_review"
        | "rejected"
        | "human_confirmed"
      witness_domain_of_access:
        | "embodied_perception"
        | "symptom_continuity"
        | "biochemical_state_snapshot"
        | "biochemical_state_dynamic"
        | "body_composition"
        | "hepatic_mechanical_state"
        | "temporal_physiology"
        | "protein_abundance"
        | "gene_expression"
        | "genomic_variant"
        | "metabolic_flux"
        | "microbial_ecology"
        | "lipid_composition"
        | "structural_anatomy"
        | "clinical_compression"
        | "intervention_layer"
        | "environmental_exposure"
        | "psychosocial_context"
      witness_epistemic_role:
        | "direct_measure"
        | "self_report"
        | "dynamic_sensor"
        | "derived_score"
        | "compressed_label"
        | "intervention_context"
        | "historical_event"
      witness_reliability_class: "high" | "medium" | "low" | "unknown"
      witness_source_window:
        | "cie"
        | "lab"
        | "inbody"
        | "fibroscan"
        | "sensor"
        | "wearable"
        | "omics"
        | "imaging"
        | "medication"
        | "emr"
        | "history"
        | "narrative"
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
      cluster_confidence_tier: [
        "emerging",
        "tentative",
        "developing",
        "supported",
        "robust",
      ],
      cluster_evidence_direction: ["convergent", "divergent", "neutral"],
      cluster_evidence_layer: [
        "cie",
        "lab",
        "inbody",
        "emr",
        "medication",
        "sensor",
        "food_log",
        "imaging",
        "omics",
        "narrative",
      ],
      rae_admission_state: [
        "auto_admitted",
        "needs_review",
        "rejected",
        "human_confirmed",
      ],
      witness_domain_of_access: [
        "embodied_perception",
        "symptom_continuity",
        "biochemical_state_snapshot",
        "biochemical_state_dynamic",
        "body_composition",
        "hepatic_mechanical_state",
        "temporal_physiology",
        "protein_abundance",
        "gene_expression",
        "genomic_variant",
        "metabolic_flux",
        "microbial_ecology",
        "lipid_composition",
        "structural_anatomy",
        "clinical_compression",
        "intervention_layer",
        "environmental_exposure",
        "psychosocial_context",
      ],
      witness_epistemic_role: [
        "direct_measure",
        "self_report",
        "dynamic_sensor",
        "derived_score",
        "compressed_label",
        "intervention_context",
        "historical_event",
      ],
      witness_reliability_class: ["high", "medium", "low", "unknown"],
      witness_source_window: [
        "cie",
        "lab",
        "inbody",
        "fibroscan",
        "sensor",
        "wearable",
        "omics",
        "imaging",
        "medication",
        "emr",
        "history",
        "narrative",
      ],
    },
  },
} as const
