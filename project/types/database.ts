export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          device_name: string;
          penalty_count: number;
          last_seen: string;
          is_online: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_name: string;
          penalty_count?: number;
          last_seen?: string;
          is_online?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_name?: string;
          penalty_count?: number;
          last_seen?: string;
          is_online?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      verses: {
        Row: {
          id: string;
          user_id: string;
          verse_text: string;
          submitted_date: string;
          day_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          verse_text: string;
          submitted_date?: string;
          day_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          verse_text?: string;
          submitted_date?: string;
          day_name?: string;
          created_at?: string;
        };
      };
      penalties: {
        Row: {
          id: string;
          user_id: string;
          penalty_date: string;
          removed_by: string | null;
          removed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          penalty_date?: string;
          removed_by?: string | null;
          removed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          penalty_date?: string;
          removed_by?: string | null;
          removed_at?: string | null;
          created_at?: string;
        };
      };
      user_activity: {
        Row: {
          id: string;
          user_id: string;
          ping_timestamp: string;
          response_time: number;
          is_online: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ping_timestamp?: string;
          response_time?: number;
          is_online?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ping_timestamp?: string;
          response_time?: number;
          is_online?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type Verse = Database['public']['Tables']['verses']['Row'];
export type Penalty = Database['public']['Tables']['penalties']['Row'];
export type UserActivity = Database['public']['Tables']['user_activity']['Row'];