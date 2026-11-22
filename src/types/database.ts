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
      life_events: {
        Row: {
          created_at: string;
          date_approximate: boolean;
          date_precision: Database['public']['Enums']['date_precision'];
          event_type: string;
          id: string;
          notes: string | null;
          occurred_on: string | null;
          person_id: string | null;
          place: string | null;
          title: string;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          event_type: string;
          id?: string;
          notes?: string | null;
          occurred_on?: string | null;
          person_id?: string | null;
          place?: string | null;
          title: string;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_approximate?: boolean;
          date_precision?: Database['public']['Enums']['date_precision'];
          event_type?: string;
          id?: string;
          notes?: string | null;
          occurred_on?: string | null;
          person_id?: string | null;
          place?: string | null;
          title?: string;
          tree_id?: string;
          updated_at?: string;
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
          birth_date: string | null;
          birth_date_approximate: boolean;
          birth_date_precision: Database['public']['Enums']['date_precision'];
          created_at: string;
          death_date: string | null;
          death_date_approximate: boolean;
          death_date_precision: Database['public']['Enums']['date_precision'];
          display_name: string;
          id: string;
          living_status: Database['public']['Enums']['living_status'];
          notes: string | null;
          tree_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          birth_date_approximate?: boolean;
          birth_date_precision?: Database['public']['Enums']['date_precision'];
          created_at?: string;
          death_date?: string | null;
          death_date_approximate?: boolean;
          death_date_precision?: Database['public']['Enums']['date_precision'];
          display_name: string;
          id?: string;
          living_status?: Database['public']['Enums']['living_status'];
          notes?: string | null;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          birth_date_approximate?: boolean;
          birth_date_precision?: Database['public']['Enums']['date_precision'];
          created_at?: string;
          death_date?: string | null;
          death_date_approximate?: boolean;
          death_date_precision?: Database['public']['Enums']['date_precision'];
          display_name?: string;
          id?: string;
          living_status?: Database['public']['Enums']['living_status'];
          notes?: string | null;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
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
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
