export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_request_attempts: {
        Row: {
          attempts: number;
          created_at: string;
          duration_ms: number;
          error_code: string | null;
          estimated_cost_usd: number | null;
          http_status: number | null;
          id: string;
          input_tokens: number | null;
          model: string;
          output_tokens: number | null;
          owner_id: string;
          position: number;
          provider: string;
          request_id: string;
          status: string;
          thought_tokens: number | null;
        };
        ComputedFields: never;
        Insert: {
          attempts: number;
          created_at?: string;
          duration_ms: number;
          error_code?: string | null;
          estimated_cost_usd?: number | null;
          http_status?: number | null;
          id?: string;
          input_tokens?: number | null;
          model: string;
          output_tokens?: number | null;
          owner_id: string;
          position: number;
          provider: string;
          request_id: string;
          status: string;
          thought_tokens?: number | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          duration_ms?: number;
          error_code?: string | null;
          estimated_cost_usd?: number | null;
          http_status?: number | null;
          id?: string;
          input_tokens?: number | null;
          model?: string;
          output_tokens?: number | null;
          owner_id?: string;
          position?: number;
          provider?: string;
          request_id?: string;
          status?: string;
          thought_tokens?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_request_attempts_owner_id_request_id_fkey";
            columns: ["owner_id", "request_id"];
            isOneToOne: false;
            referencedRelation: "ai_requests";
            referencedColumns: ["owner_id", "id"];
          },
        ];
      };
      ai_requests: {
        Row: {
          attempts: number;
          duration_ms: number | null;
          error_code: string | null;
          estimated_cost_usd: number | null;
          feature: string;
          finished_at: string | null;
          id: string;
          input_tokens: number | null;
          model: string;
          output_tokens: number | null;
          owner_id: string;
          provider: string | null;
          started_at: string;
          status: string;
          thought_tokens: number | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          duration_ms?: number | null;
          error_code?: string | null;
          estimated_cost_usd?: number | null;
          feature: string;
          finished_at?: string | null;
          id?: string;
          input_tokens?: number | null;
          model: string;
          output_tokens?: number | null;
          owner_id: string;
          provider?: string | null;
          started_at?: string;
          status?: string;
          thought_tokens?: number | null;
        };
        Update: {
          attempts?: number;
          duration_ms?: number | null;
          error_code?: string | null;
          estimated_cost_usd?: number | null;
          feature?: string;
          finished_at?: string | null;
          id?: string;
          input_tokens?: number | null;
          model?: string;
          output_tokens?: number | null;
          owner_id?: string;
          provider?: string | null;
          started_at?: string;
          status?: string;
          thought_tokens?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_requests_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      app_owners: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      certifications: {
        Row: {
          created_at: string;
          credential_url: string | null;
          deleted_at: string | null;
          id: string;
          issued_month: number | null;
          issued_year: number | null;
          issuer_i18n: NonNullable<Json>;
          owner_id: string;
          sort_order: number;
          title_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          credential_url?: string | null;
          deleted_at?: string | null;
          id?: string;
          issued_month?: number | null;
          issued_year?: number | null;
          issuer_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          credential_url?: string | null;
          deleted_at?: string | null;
          id?: string;
          issued_month?: number | null;
          issued_year?: number | null;
          issuer_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certifications_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      custom_items: {
        Row: {
          created_at: string;
          custom_subsection_id: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          label_i18n: NonNullable<Json>;
          owner_id: string;
          sort_order: number;
          text_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_subsection_id: string;
          deleted_at?: string | null;
          id?: string;
          kind: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          text_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_subsection_id?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          text_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_items_owner_id_custom_subsection_id_fkey";
            columns: ["owner_id", "custom_subsection_id"];
            isOneToOne: false;
            referencedRelation: "custom_subsections";
            referencedColumns: ["owner_id", "id"];
          },
          {
            foreignKeyName: "custom_items_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      custom_sections: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          owner_id: string;
          sort_order: number;
          title_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_sections_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      custom_subsections: {
        Row: {
          created_at: string;
          custom_section_id: string;
          deleted_at: string | null;
          id: string;
          owner_id: string;
          sort_order: number;
          title_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_section_id: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_section_id?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_subsections_owner_id_custom_section_id_fkey";
            columns: ["owner_id", "custom_section_id"];
            isOneToOne: false;
            referencedRelation: "custom_sections";
            referencedColumns: ["owner_id", "id"];
          },
          {
            foreignKeyName: "custom_subsections_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      cv_documents: {
        Row: {
          created_at: string;
          created_from_template_id: string | null;
          created_from_template_name: string | null;
          definition: NonNullable<Json>;
          deleted_at: string | null;
          design: Json | null;
          id: string;
          job_post_id: string | null;
          locale: string;
          name: string;
          owner_id: string;
          revision: number;
          schema_version: number;
          updated_at: string;
          visual_template_key: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_from_template_id?: string | null;
          created_from_template_name?: string | null;
          definition?: NonNullable<Json>;
          deleted_at?: string | null;
          design?: Json | null;
          id?: string;
          job_post_id?: string | null;
          locale?: string;
          name: string;
          owner_id?: string;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          visual_template_key?: string;
        };
        Update: {
          created_at?: string;
          created_from_template_id?: string | null;
          created_from_template_name?: string | null;
          definition?: NonNullable<Json>;
          deleted_at?: string | null;
          design?: Json | null;
          id?: string;
          job_post_id?: string | null;
          locale?: string;
          name?: string;
          owner_id?: string;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          visual_template_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cv_documents_job_post_fk";
            columns: ["owner_id", "job_post_id"];
            isOneToOne: false;
            referencedRelation: "job_posts";
            referencedColumns: ["owner_id", "id"];
          },
          {
            foreignKeyName: "cv_documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      cv_templates: {
        Row: {
          created_at: string;
          definition: NonNullable<Json>;
          deleted_at: string | null;
          description: string;
          design: Json | null;
          id: string;
          locale: string;
          name: string;
          owner_id: string;
          revision: number;
          schema_version: number;
          updated_at: string;
          visual_template_key: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          definition?: NonNullable<Json>;
          deleted_at?: string | null;
          description?: string;
          design?: Json | null;
          id?: string;
          locale?: string;
          name: string;
          owner_id?: string;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          visual_template_key?: string;
        };
        Update: {
          created_at?: string;
          definition?: NonNullable<Json>;
          deleted_at?: string | null;
          description?: string;
          design?: Json | null;
          id?: string;
          locale?: string;
          name?: string;
          owner_id?: string;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          visual_template_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cv_templates_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      educations: {
        Row: {
          created_at: string;
          credential_i18n: NonNullable<Json>;
          deleted_at: string | null;
          description_i18n: NonNullable<Json>;
          end_month: number | null;
          end_year: number | null;
          id: string;
          institution_i18n: NonNullable<Json>;
          is_current: boolean;
          location_i18n: NonNullable<Json>;
          owner_id: string;
          sort_order: number;
          start_month: number | null;
          start_year: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          credential_i18n?: NonNullable<Json>;
          deleted_at?: string | null;
          description_i18n?: NonNullable<Json>;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          institution_i18n?: NonNullable<Json>;
          is_current?: boolean;
          location_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          credential_i18n?: NonNullable<Json>;
          deleted_at?: string | null;
          description_i18n?: NonNullable<Json>;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          institution_i18n?: NonNullable<Json>;
          is_current?: boolean;
          location_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "educations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      experience_details: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          experience_id: string;
          id: string;
          kind: string;
          owner_id: string;
          sort_order: number;
          text_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          experience_id: string;
          id?: string;
          kind: string;
          owner_id?: string;
          sort_order?: number;
          text_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          experience_id?: string;
          id?: string;
          kind?: string;
          owner_id?: string;
          sort_order?: number;
          text_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "experience_details_owner_id_experience_id_fkey";
            columns: ["owner_id", "experience_id"];
            isOneToOne: false;
            referencedRelation: "experiences";
            referencedColumns: ["owner_id", "id"];
          },
          {
            foreignKeyName: "experience_details_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      experiences: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          end_month: number | null;
          end_year: number | null;
          id: string;
          is_current: boolean;
          location_i18n: NonNullable<Json>;
          organization: string;
          owner_id: string;
          role_i18n: NonNullable<Json>;
          sort_order: number;
          start_month: number | null;
          start_year: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          location_i18n?: NonNullable<Json>;
          organization: string;
          owner_id?: string;
          role_i18n?: NonNullable<Json>;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          location_i18n?: NonNullable<Json>;
          organization?: string;
          owner_id?: string;
          role_i18n?: NonNullable<Json>;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "experiences_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      job_posts: {
        Row: {
          analyzed_at: string | null;
          company: string;
          created_at: string;
          deleted_at: string | null;
          description: string;
          id: string;
          language: string;
          owner_id: string;
          requirements: NonNullable<Json>;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          analyzed_at?: string | null;
          company?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          language?: string;
          owner_id?: string;
          requirements?: NonNullable<Json>;
          title: string;
          updated_at?: string;
        };
        Update: {
          analyzed_at?: string | null;
          company?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          language?: string;
          owner_id?: string;
          requirements?: NonNullable<Json>;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_posts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      owner_settings: {
        Row: {
          ai_daily_limit: number;
          ai_enabled: boolean;
          created_at: string;
          owner_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ai_daily_limit?: number;
          ai_enabled?: boolean;
          created_at?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          ai_daily_limit?: number;
          ai_enabled?: boolean;
          created_at?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "owner_settings_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profile_links: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_text: string;
          id: string;
          kind: string;
          label_i18n: NonNullable<Json>;
          owner_id: string;
          sort_order: number;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_text?: string;
          id?: string;
          kind?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_text?: string;
          id?: string;
          kind?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_links_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          location_i18n: NonNullable<Json>;
          owner_id: string;
          phone: string | null;
          photo_path: string | null;
          summary_i18n: NonNullable<Json>;
          title_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          location_i18n?: NonNullable<Json>;
          owner_id: string;
          phone?: string | null;
          photo_path?: string | null;
          summary_i18n?: NonNullable<Json>;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          location_i18n?: NonNullable<Json>;
          owner_id?: string;
          phone?: string | null;
          photo_path?: string | null;
          summary_i18n?: NonNullable<Json>;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      project_details: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          owner_id: string;
          project_id: string;
          sort_order: number;
          text_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind: string;
          owner_id?: string;
          project_id: string;
          sort_order?: number;
          text_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          owner_id?: string;
          project_id?: string;
          sort_order?: number;
          text_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_details_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "project_details_owner_id_project_id_fkey";
            columns: ["owner_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["owner_id", "id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description_i18n: NonNullable<Json>;
          end_month: number | null;
          end_year: number | null;
          id: string;
          is_current: boolean;
          owner_id: string;
          project_url: string | null;
          sort_order: number;
          source_url: string | null;
          start_month: number | null;
          start_year: number | null;
          title_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description_i18n?: NonNullable<Json>;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          owner_id?: string;
          project_url?: string | null;
          sort_order?: number;
          source_url?: string | null;
          start_month?: number | null;
          start_year?: number | null;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description_i18n?: NonNullable<Json>;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          owner_id?: string;
          project_url?: string | null;
          sort_order?: number;
          source_url?: string | null;
          start_month?: number | null;
          start_year?: number | null;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      skill_groups: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          owner_id: string;
          sort_order: number;
          title_i18n: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          sort_order?: number;
          title_i18n?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skill_groups_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      skills: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          label_i18n: NonNullable<Json>;
          owner_id: string;
          skill_group_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          skill_group_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          skill_group_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skills_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "skills_owner_id_skill_group_id_fkey";
            columns: ["owner_id", "skill_group_id"];
            isOneToOne: false;
            referencedRelation: "skill_groups";
            referencedColumns: ["owner_id", "id"];
          },
        ];
      };
      soft_skills: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          label_i18n: NonNullable<Json>;
          owner_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label_i18n?: NonNullable<Json>;
          owner_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "soft_skills_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
      spoken_languages: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name_i18n: NonNullable<Json>;
          owner_id: string;
          proficiency_i18n: NonNullable<Json>;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name_i18n?: NonNullable<Json>;
          owner_id?: string;
          proficiency_i18n?: NonNullable<Json>;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name_i18n?: NonNullable<Json>;
          owner_id?: string;
          proficiency_i18n?: NonNullable<Json>;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spoken_languages_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "app_owners";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      begin_ai_request: { Args: { p_feature: string; p_model: string }; Returns: string };
      count_record_references: { Args: { record_id: string }; Returns: Json };
      finish_ai_request: {
        Args: {
          p_attempts: number;
          p_duration_ms: number;
          p_error_code?: string;
          p_estimated_cost_usd?: number;
          p_input_tokens?: number;
          p_output_tokens?: number;
          p_provider_attempts?: Json;
          p_request_id: string;
          p_succeeded: boolean;
          p_thought_tokens?: number;
        };
        Returns: undefined;
      };
      reorder_records: { Args: { ids: string[]; target: string }; Returns: undefined };
      save_certification: { Args: { payload: Json }; Returns: Json };
      save_custom_section: { Args: { payload: Json }; Returns: Json };
      save_education: { Args: { payload: Json }; Returns: Json };
      save_experience: { Args: { payload: Json }; Returns: Json };
      save_profile: { Args: { payload: Json }; Returns: Json };
      save_project: { Args: { payload: Json }; Returns: Json };
      save_skill_groups: { Args: { payload: Json }; Returns: Json };
      save_soft_skills: { Args: { payload: Json }; Returns: Json };
      save_spoken_languages: { Args: { payload: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
