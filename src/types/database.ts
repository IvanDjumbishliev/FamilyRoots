export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          actor_id: string | null;
          changed_fields: string[];
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          operation: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          changed_fields?: string[];
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          operation: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          changed_fields?: string[];
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          operation?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_logs_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      archive_item_people: {
        Row: {
          item_id: string;
          person_id: string;
          tree_id: string;
        };
        ComputedFields: never;
        Insert: {
          item_id: string;
          person_id: string;
          tree_id: string;
        };
        Update: {
          item_id?: string;
          person_id?: string;
          tree_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'archive_item_people_tree_id_item_id_fkey';
            columns: ['tree_id', 'item_id'];
            isOneToOne: false;
            referencedRelation: 'archive_items';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'archive_item_people_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      archive_items: {
        Row: {
          collection: string | null;
          created_at: string;
          date_approximate: boolean;
          date_precision: Database['public']['Enums']['date_precision'];
          description: string | null;
          event_id: string | null;
          file_name: string;
          id: string;
          location: string | null;
          mime_type: string;
          object_path: string;
          preview_path: string | null;
          recorded_on: string | null;
          sha256: string;
          size_bytes: number;
          source_note: string | null;
          state: string;
          stored_bytes: number;
          thumbnail_path: string | null;
          title: string;
          tree_id: string;
          updated_at: string;
          updated_by: string | null;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          collection?: string | null;
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          description?: string | null;
          event_id?: string | null;
          file_name: string;
          id?: string;
          location?: string | null;
          mime_type: string;
          object_path: string;
          preview_path?: string | null;
          recorded_on?: string | null;
          sha256: string;
          size_bytes: number;
          source_note?: string | null;
          state?: string;
          stored_bytes: number;
          thumbnail_path?: string | null;
          title: string;
          tree_id: string;
          updated_at?: string;
          updated_by?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          collection?: string | null;
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          description?: string | null;
          event_id?: string | null;
          file_name?: string;
          id?: string;
          location?: string | null;
          mime_type?: string;
          object_path?: string;
          preview_path?: string | null;
          recorded_on?: string | null;
          sha256?: string;
          size_bytes?: number;
          source_note?: string | null;
          state?: string;
          stored_bytes?: number;
          thumbnail_path?: string | null;
          title?: string;
          tree_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'archive_items_tree_id_event_id_fkey';
            columns: ['tree_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'life_events';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'archive_items_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'archive_items_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'archive_items_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      collaboration_comments: {
        Row: {
          archive_item_id: string | null;
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          person_id: string | null;
          source_id: string | null;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archive_item_id?: string | null;
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          person_id?: string | null;
          source_id?: string | null;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          archive_item_id?: string | null;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          person_id?: string | null;
          source_id?: string | null;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collaboration_comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collaboration_comments_tree_id_archive_item_id_fkey';
            columns: ['tree_id', 'archive_item_id'];
            isOneToOne: false;
            referencedRelation: 'archive_items';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'collaboration_comments_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collaboration_comments_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'collaboration_comments_tree_id_source_id_fkey';
            columns: ['tree_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      family_books: {
        Row: {
          attempts: number;
          claimed_at: string | null;
          created_at: string;
          creator_id: string;
          error: string | null;
          id: string;
          lease: string | null;
          operation: string;
          pdf_path: string | null;
          pdf_revision: number | null;
          revision: number;
          section_key: string | null;
          sections: NonNullable<Json>;
          settings: NonNullable<Json>;
          snapshot: Json | null;
          status: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          claimed_at?: string | null;
          created_at?: string;
          creator_id: string;
          error?: string | null;
          id?: string;
          lease?: string | null;
          operation?: string;
          pdf_path?: string | null;
          pdf_revision?: number | null;
          revision?: number;
          section_key?: string | null;
          sections?: NonNullable<Json>;
          settings: NonNullable<Json>;
          snapshot?: Json | null;
          status?: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          claimed_at?: string | null;
          created_at?: string;
          creator_id?: string;
          error?: string | null;
          id?: string;
          lease?: string | null;
          operation?: string;
          pdf_path?: string | null;
          pdf_revision?: number | null;
          revision?: number;
          section_key?: string | null;
          sections?: NonNullable<Json>;
          settings?: NonNullable<Json>;
          snapshot?: Json | null;
          status?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_books_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_books_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      family_trees: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_trees_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      life_event_archive_items: {
        Row: {
          event_id: string;
          item_id: string;
          tree_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          item_id: string;
          tree_id: string;
        };
        Update: {
          event_id?: string;
          item_id?: string;
          tree_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'life_event_archive_items_tree_id_event_id_fkey';
            columns: ['tree_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'life_events';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'life_event_archive_items_tree_id_item_id_fkey';
            columns: ['tree_id', 'item_id'];
            isOneToOne: false;
            referencedRelation: 'archive_items';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      life_event_people: {
        Row: {
          event_id: string;
          person_id: string;
          tree_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          person_id: string;
          tree_id: string;
        };
        Update: {
          event_id?: string;
          person_id?: string;
          tree_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'life_event_people_tree_id_event_id_fkey';
            columns: ['tree_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'life_events';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'life_event_people_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      life_events: {
        Row: {
          created_at: string;
          date_approximate: boolean;
          date_precision: Database['public']['Enums']['date_precision'];
          entry_kind: string;
          event_type: string;
          id: string;
          notes: string | null;
          occurred_on: string | null;
          person_id: string | null;
          place: string | null;
          title: string;
          tree_id: string;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          entry_kind?: string;
          event_type: string;
          id?: string;
          notes?: string | null;
          occurred_on?: string | null;
          person_id?: string | null;
          place?: string | null;
          title: string;
          tree_id: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Update: {
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          entry_kind?: string;
          event_type?: string;
          id?: string;
          notes?: string | null;
          occurred_on?: string | null;
          person_id?: string | null;
          place?: string | null;
          title?: string;
          tree_id?: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'life_events_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'life_events_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      media_assets: {
        Row: {
          captured_on: string | null;
          content_type: string;
          created_at: string;
          date_approximate: boolean;
          date_precision: Database['public']['Enums']['date_precision'];
          display_name: string;
          id: string;
          notes: string | null;
          person_id: string | null;
          size_bytes: number;
          storage_path: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          captured_on?: string | null;
          content_type: string;
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          display_name: string;
          id?: string;
          notes?: string | null;
          person_id?: string | null;
          size_bytes: number;
          storage_path: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          captured_on?: string | null;
          content_type?: string;
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          display_name?: string;
          id?: string;
          notes?: string | null;
          person_id?: string | null;
          size_bytes?: number;
          storage_path?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_assets_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_assets_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      other_family_relationships: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          notes: string | null;
          person_a_id: string;
          person_b_id: string;
          provenance: Database['public']['Enums']['relationship_provenance'];
          tree_id: string;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          notes?: string | null;
          person_a_id: string;
          person_b_id: string;
          provenance?: Database['public']['Enums']['relationship_provenance'];
          tree_id: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          notes?: string | null;
          person_a_id?: string;
          person_b_id?: string;
          provenance?: Database['public']['Enums']['relationship_provenance'];
          tree_id?: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'other_family_relationships_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'other_family_relationships_tree_id_person_a_id_fkey';
            columns: ['tree_id', 'person_a_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'other_family_relationships_tree_id_person_b_id_fkey';
            columns: ['tree_id', 'person_b_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      parent_child_relationships: {
        Row: {
          child_id: string;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['parent_child_kind'];
          notes: string | null;
          parent_id: string;
          provenance: Database['public']['Enums']['relationship_provenance'];
          tree_id: string;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
        };
        ComputedFields: never;
        Insert: {
          child_id: string;
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['parent_child_kind'];
          notes?: string | null;
          parent_id: string;
          provenance?: Database['public']['Enums']['relationship_provenance'];
          tree_id: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Update: {
          child_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['parent_child_kind'];
          notes?: string | null;
          parent_id?: string;
          provenance?: Database['public']['Enums']['relationship_provenance'];
          tree_id?: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'parent_child_relationships_tree_id_child_id_fkey';
            columns: ['tree_id', 'child_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'parent_child_relationships_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parent_child_relationships_tree_id_parent_id_fkey';
            columns: ['tree_id', 'parent_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      partnerships: {
        Row: {
          created_at: string;
          end_date_approximate: boolean;
          end_date_precision: Database['public']['Enums']['date_precision'];
          ended_on: string | null;
          id: string;
          kind: Database['public']['Enums']['partnership_kind'];
          notes: string | null;
          person_a_id: string;
          person_b_id: string;
          provenance: Database['public']['Enums']['relationship_provenance'];
          start_date_approximate: boolean;
          start_date_precision: Database['public']['Enums']['date_precision'];
          started_on: string | null;
          status: Database['public']['Enums']['partnership_status'];
          tree_id: string;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_date_approximate?: boolean;
          end_date_precision?: Database['public']['Enums']['date_precision'];
          ended_on?: string | null;
          id?: string;
          kind: Database['public']['Enums']['partnership_kind'];
          notes?: string | null;
          person_a_id: string;
          person_b_id: string;
          provenance?: Database['public']['Enums']['relationship_provenance'];
          start_date_approximate?: boolean;
          start_date_precision?: Database['public']['Enums']['date_precision'];
          started_on?: string | null;
          status?: Database['public']['Enums']['partnership_status'];
          tree_id: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Update: {
          created_at?: string;
          end_date_approximate?: boolean;
          end_date_precision?: Database['public']['Enums']['date_precision'];
          ended_on?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['partnership_kind'];
          notes?: string | null;
          person_a_id?: string;
          person_b_id?: string;
          provenance?: Database['public']['Enums']['relationship_provenance'];
          start_date_approximate?: boolean;
          start_date_precision?: Database['public']['Enums']['date_precision'];
          started_on?: string | null;
          status?: Database['public']['Enums']['partnership_status'];
          tree_id?: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'partnerships_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partnerships_tree_id_person_a_id_fkey';
            columns: ['tree_id', 'person_a_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'partnerships_tree_id_person_b_id_fkey';
            columns: ['tree_id', 'person_b_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      people: {
        Row: {
          alternative_names: string[];
          archived_at: string | null;
          biography: string | null;
          birth_date: string | null;
          birth_date_approximate: boolean;
          birth_date_precision: Database['public']['Enums']['date_precision'];
          birth_name: string | null;
          birth_place: string | null;
          created_at: string;
          death_date: string | null;
          death_date_approximate: boolean;
          death_date_precision: Database['public']['Enums']['date_precision'];
          death_place: string | null;
          display_name: string;
          gender_identity: string | null;
          given_names: string | null;
          id: string;
          is_draft: boolean;
          living_status: Database['public']['Enums']['living_status'];
          nationality: string | null;
          notes: string | null;
          occupation: string | null;
          profile_photo_id: string | null;
          surnames: string | null;
          tree_id: string;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
        };
        ComputedFields: never;
        Insert: {
          alternative_names?: string[];
          archived_at?: string | null;
          biography?: string | null;
          birth_date?: string | null;
          birth_date_approximate?: boolean;
          birth_date_precision?: Database['public']['Enums']['date_precision'];
          birth_name?: string | null;
          birth_place?: string | null;
          created_at?: string;
          death_date?: string | null;
          death_date_approximate?: boolean;
          death_date_precision?: Database['public']['Enums']['date_precision'];
          death_place?: string | null;
          display_name: string;
          gender_identity?: string | null;
          given_names?: string | null;
          id?: string;
          is_draft?: boolean;
          living_status?: Database['public']['Enums']['living_status'];
          nationality?: string | null;
          notes?: string | null;
          occupation?: string | null;
          profile_photo_id?: string | null;
          surnames?: string | null;
          tree_id: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Update: {
          alternative_names?: string[];
          archived_at?: string | null;
          biography?: string | null;
          birth_date?: string | null;
          birth_date_approximate?: boolean;
          birth_date_precision?: Database['public']['Enums']['date_precision'];
          birth_name?: string | null;
          birth_place?: string | null;
          created_at?: string;
          death_date?: string | null;
          death_date_approximate?: boolean;
          death_date_precision?: Database['public']['Enums']['date_precision'];
          death_place?: string | null;
          display_name?: string;
          gender_identity?: string | null;
          given_names?: string | null;
          id?: string;
          is_draft?: boolean;
          living_status?: Database['public']['Enums']['living_status'];
          nationality?: string | null;
          notes?: string | null;
          occupation?: string | null;
          profile_photo_id?: string | null;
          surnames?: string | null;
          tree_id?: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'people_profile_photo_fkey';
            columns: ['tree_id', 'profile_photo_id', 'id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['tree_id', 'id', 'person_id'];
          },
          {
            foreignKeyName: 'people_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          preferred_language: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          preferred_language?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          preferred_language?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_findings: {
        Row: {
          created_at: string;
          id: string;
          provider: string;
          record: NonNullable<Json>;
          record_key: string;
          saved_by: string | null;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          provider: string;
          record: NonNullable<Json>;
          record_key: string;
          saved_by?: string | null;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          provider?: string;
          record?: NonNullable<Json>;
          record_key?: string;
          saved_by?: string | null;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'research_findings_saved_by_fkey';
            columns: ['saved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_findings_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      research_matches: {
        Row: {
          citation_id: string | null;
          created_at: string;
          decided_by: string | null;
          finding_id: string;
          hypothesis: string | null;
          id: string;
          person_id: string;
          related_person_id: string | null;
          status: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          citation_id?: string | null;
          created_at?: string;
          decided_by?: string | null;
          finding_id: string;
          hypothesis?: string | null;
          id?: string;
          person_id: string;
          related_person_id?: string | null;
          status: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          citation_id?: string | null;
          created_at?: string;
          decided_by?: string | null;
          finding_id?: string;
          hypothesis?: string | null;
          id?: string;
          person_id?: string;
          related_person_id?: string | null;
          status?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'research_matches_citation_id_fkey';
            columns: ['citation_id'];
            isOneToOne: false;
            referencedRelation: 'source_citations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_matches_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_matches_tree_id_finding_id_fkey';
            columns: ['tree_id', 'finding_id'];
            isOneToOne: false;
            referencedRelation: 'research_findings';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'research_matches_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_matches_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'research_matches_tree_id_related_person_id_fkey';
            columns: ['tree_id', 'related_person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      source_citations: {
        Row: {
          created_at: string;
          id: string;
          life_event_id: string | null;
          locator: string | null;
          media_asset_id: string | null;
          notes: string | null;
          partnership_id: string | null;
          person_id: string | null;
          relationship_id: string | null;
          source_id: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          life_event_id?: string | null;
          locator?: string | null;
          media_asset_id?: string | null;
          notes?: string | null;
          partnership_id?: string | null;
          person_id?: string | null;
          relationship_id?: string | null;
          source_id: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          life_event_id?: string | null;
          locator?: string | null;
          media_asset_id?: string | null;
          notes?: string | null;
          partnership_id?: string | null;
          person_id?: string | null;
          relationship_id?: string | null;
          source_id?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'source_citations_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'source_citations_tree_id_life_event_id_fkey';
            columns: ['tree_id', 'life_event_id'];
            isOneToOne: false;
            referencedRelation: 'life_events';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'source_citations_tree_id_media_asset_id_fkey';
            columns: ['tree_id', 'media_asset_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'source_citations_tree_id_partnership_id_fkey';
            columns: ['tree_id', 'partnership_id'];
            isOneToOne: false;
            referencedRelation: 'partnerships';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'source_citations_tree_id_person_id_fkey';
            columns: ['tree_id', 'person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'source_citations_tree_id_relationship_id_fkey';
            columns: ['tree_id', 'relationship_id'];
            isOneToOne: false;
            referencedRelation: 'parent_child_relationships';
            referencedColumns: ['tree_id', 'id'];
          },
          {
            foreignKeyName: 'source_citations_tree_id_source_id_fkey';
            columns: ['tree_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['tree_id', 'id'];
          },
        ];
      };
      sources: {
        Row: {
          created_at: string;
          date_approximate: boolean;
          date_precision: Database['public']['Enums']['date_precision'];
          id: string;
          record_date: string | null;
          reference_url: string | null;
          repository_name: string | null;
          rights_note: string | null;
          title: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          id?: string;
          record_date?: string | null;
          reference_url?: string | null;
          repository_name?: string | null;
          rights_note?: string | null;
          title: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          id?: string;
          record_date?: string | null;
          reference_url?: string | null;
          repository_name?: string | null;
          rights_note?: string | null;
          title?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sources_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      tree_invitations: {
        Row: {
          consent_confirmed_at: string;
          created_at: string;
          delivery_attempt: string | null;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          last_attempt_at: string | null;
          responded_at: string | null;
          role: Database['public']['Enums']['tree_role'];
          sent_at: string | null;
          status: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          consent_confirmed_at?: string;
          created_at?: string;
          delivery_attempt?: string | null;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          last_attempt_at?: string | null;
          responded_at?: string | null;
          role: Database['public']['Enums']['tree_role'];
          sent_at?: string | null;
          status?: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          consent_confirmed_at?: string;
          created_at?: string;
          delivery_attempt?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          last_attempt_at?: string | null;
          responded_at?: string | null;
          role?: Database['public']['Enums']['tree_role'];
          sent_at?: string | null;
          status?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tree_invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tree_invitations_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      tree_memberships: {
        Row: {
          created_at: string;
          id: string;
          role: Database['public']['Enums']['tree_role'];
          tree_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          role: Database['public']['Enums']['tree_role'];
          tree_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['tree_role'];
          tree_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tree_memberships_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tree_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tree_reviews: {
        Row: {
          base_value: string | null;
          created_at: string;
          field: string;
          id: string;
          proposed_by: string | null;
          proposed_value: string | null;
          reason: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          target_id: string;
          target_type: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          base_value?: string | null;
          created_at?: string;
          field: string;
          id?: string;
          proposed_by?: string | null;
          proposed_value?: string | null;
          reason: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          target_id: string;
          target_type: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          base_value?: string | null;
          created_at?: string;
          field?: string;
          id?: string;
          proposed_by?: string | null;
          proposed_value?: string | null;
          reason?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          target_id?: string;
          target_type?: string;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tree_reviews_proposed_by_fkey';
            columns: ['proposed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tree_reviews_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tree_reviews_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      tree_update_reads: {
        Row: {
          read_at: string;
          tree_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          read_at?: string;
          tree_id: string;
          user_id: string;
        };
        Update: {
          read_at?: string;
          tree_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tree_update_reads_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tree_update_reads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_person_source: {
        Args: {
          p_locator: string;
          p_person_id: string;
          p_title: string;
          p_tree_id: string;
          p_url: string;
        };
        Returns: string;
      };
      attach_person_photo: {
        Args: {
          p_content_type: string;
          p_name: string;
          p_path: string;
          p_person_id: string;
          p_size: number;
          p_tree_id: string;
        };
        Returns: string;
      };
      cancel_tree_invitation: {
        Args: { p_id: string; p_tree: string };
        Returns: undefined;
      };
      claim_archive_upload: {
        Args: {
          p_actor: string;
          p_derivatives: boolean;
          p_file_name: string;
          p_hash: string;
          p_meta: Json;
          p_mime: string;
          p_people: string[];
          p_size: number;
          p_stored_bytes: number;
          p_tree: string;
        };
        Returns: Json;
      };
      claim_family_book: {
        Args: { p_id?: string };
        Returns: {
          attempts: number;
          claimed_at: string | null;
          created_at: string;
          creator_id: string;
          error: string | null;
          id: string;
          lease: string | null;
          operation: string;
          pdf_path: string | null;
          pdf_revision: number | null;
          revision: number;
          section_key: string | null;
          sections: NonNullable<Json>;
          settings: NonNullable<Json>;
          snapshot: Json | null;
          status: string;
          tree_id: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'family_books';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_family_onboarding: {
        Args: { p_display_name: string; p_tree_name: string };
        Returns: string;
      };
      create_family_book: {
        Args: { p_settings: Json; p_tree: string };
        Returns: string;
      };
      edit_family_book_section: {
        Args: {
          p_body: string;
          p_id: string;
          p_key: string;
          p_revision: number;
        };
        Returns: undefined;
      };
      export_gedcom: {
        Args: { p_exclude_living: boolean; p_tree: string };
        Returns: Json;
      };
      finish_family_book: {
        Args: {
          p_error?: string;
          p_id: string;
          p_lease: string;
          p_pdf?: string;
          p_sections?: Json;
          p_snapshot?: Json;
        };
        Returns: boolean;
      };
      get_assistant_evidence: {
        Args: { p_people: string[]; p_task: string; p_tree: string };
        Returns: Json;
      };
      get_family_book_context: {
        Args: { p_id: string; p_lease: string };
        Returns: Json;
      };
      get_tree_collaboration: { Args: { p_tree: string }; Returns: Json };
      import_gedcom: {
        Args: {
          p_choices: Json;
          p_data: Json;
          p_request?: string;
          p_tree: string;
        };
        Returns: Json;
      };
      inspect_tree_review: { Args: { p_id: string }; Returns: Json };
      list_my_tree_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          expires_at: string;
          id: string;
          role: Database['public']['Enums']['tree_role'];
        }[];
      };
      manage_tree_member: {
        Args: {
          p_member: string;
          p_remove?: boolean;
          p_role: Database['public']['Enums']['tree_role'];
          p_tree: string;
        };
        Returns: undefined;
      };
      mark_tree_updates_read: {
        Args: { p_through: string; p_tree: string };
        Returns: undefined;
      };
      propose_tree_review: {
        Args: {
          p_field: string;
          p_proposed: string;
          p_reason: string;
          p_target: string;
          p_target_type: string;
          p_tree: string;
        };
        Returns: string;
      };
      queue_family_book: {
        Args: {
          p_action: string;
          p_id: string;
          p_reviewed?: boolean;
          p_revision: number;
          p_section?: string;
        };
        Returns: undefined;
      };
      record_invitation_delivery: {
        Args: { p_attempt: string; p_id: string };
        Returns: undefined;
      };
      remove_archive_item: {
        Args: { p_actor: string; p_id: string };
        Returns: string[];
      };
      request_tree_invitation: {
        Args: {
          p_consent: boolean;
          p_email: string;
          p_role: Database['public']['Enums']['tree_role'];
          p_tree: string;
        };
        Returns: Json;
      };
      reserve_assistant_request: {
        Args: { p_actor: string; p_live: boolean };
        Returns: boolean;
      };
      resolve_tree_review: {
        Args: {
          p_decision: string;
          p_id: string;
          p_note: string;
          p_version?: string;
        };
        Returns: undefined;
      };
      respond_to_tree_invitation: {
        Args: { p_accept: boolean; p_id: string };
        Returns: string;
      };
      save_family_connection: {
        Args: { p_connection: Json; p_person_id: string; p_tree_id: string };
        Returns: string;
      };
      save_timeline_event: {
        Args: { p_payload: Json; p_tree: string };
        Returns: string;
      };
      save_versioned_family_connection: {
        Args: {
          p_connection: Json;
          p_person: string;
          p_tree: string;
          p_version?: string;
        };
        Returns: string;
      };
      search_fictional_historical_records: {
        Args: {
          p_from: number;
          p_name: string;
          p_place: string;
          p_to: number;
          p_type: string;
        };
        Returns: Json[];
      };
      update_archive_item: {
        Args: { p_id: string; p_meta: Json; p_people: string[] };
        Returns: undefined;
      };
      update_fictional_research: {
        Args: {
          p_action: string;
          p_hypothesis?: string;
          p_person?: string;
          p_record: string;
          p_related?: string;
          p_tree: string;
        };
        Returns: string;
      };
      update_versioned_archive_item: {
        Args: {
          p_id: string;
          p_meta: Json;
          p_people: string[];
          p_version: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      date_precision: 'unknown' | 'year' | 'month' | 'day';
      living_status: 'living' | 'deceased' | 'unknown';
      parent_child_kind:
        | 'biological'
        | 'adoptive'
        | 'step'
        | 'foster'
        | 'guardian'
        | 'other';
      partnership_kind:
        | 'marriage'
        | 'civil_union'
        | 'domestic_partnership'
        | 'other';
      partnership_status: 'unknown' | 'current' | 'former';
      relationship_provenance:
        | 'user_reported'
        | 'documented'
        | 'imported'
        | 'ai_suggested';
      tree_role: 'owner' | 'editor' | 'viewer';
      verification_status: 'unverified' | 'verified' | 'disputed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      date_precision: ['unknown', 'year', 'month', 'day'],
      living_status: ['living', 'deceased', 'unknown'],
      parent_child_kind: [
        'biological',
        'adoptive',
        'step',
        'foster',
        'guardian',
        'other',
      ],
      partnership_kind: [
        'marriage',
        'civil_union',
        'domestic_partnership',
        'other',
      ],
      partnership_status: ['unknown', 'current', 'former'],
      relationship_provenance: [
        'user_reported',
        'documented',
        'imported',
        'ai_suggested',
      ],
      tree_role: ['owner', 'editor', 'viewer'],
      verification_status: ['unverified', 'verified', 'disputed'],
    },
  },
} as const;
