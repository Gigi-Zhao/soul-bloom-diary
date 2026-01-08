// Database types for Supabase tables
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          mood: string;
          entry_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>;
      };
      ai_roles: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          description: string | null;
          prompt: string;
          model: string;
          avatar_url: string | null;
          tags: string[] | null;
          mbti_type: string | null;
          catchphrase: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_roles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_roles']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          ai_role_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'ai' | 'system';
          content: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      journal_comments: {
        Row: {
          id: string;
          journal_entry_id: string;
          ai_role_id: string;
          comment_text: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_comments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['journal_comments']['Insert']>;
      };
      wishes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          todo_list: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['wishes']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['wishes']['Insert']>;
      };
      weekly_letters: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          week_end_date: string;
          content: string;
          model: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['weekly_letters']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['weekly_letters']['Insert']>;
      };
      daydreams: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          setup: {
            oneSentence: string;
            identity: string;
            dailyLife: string;
            person: string;
            tone: string;
          };
          messages: Array<{
            id: string;
            role: 'narrator' | 'npc' | 'user';
            content: string;
            timestamp: number;
          }>;
          current_chapter: number;
          is_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daydreams']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['daydreams']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      sender_role: 'user' | 'ai' | 'system';
    };
  };
}
