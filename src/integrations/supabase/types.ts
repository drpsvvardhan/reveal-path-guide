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
          age: number | null
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
      fn_name_match_score: {
        Args: { p_account_name: string; p_extracted_name: string }
        Returns: number
      }
      fn_normalize_name: { Args: { p_name: string }; Returns: string }
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
    },
  },
} as const
