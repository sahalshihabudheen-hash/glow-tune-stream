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
      admin_activity_logs: {
        Row: {
          action_details: string | null
          action_type: string
          admin_email: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action_details?: string | null
          action_type: string
          admin_email: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_details?: string | null
          action_type?: string
          admin_email?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_chat_messages: {
        Row: {
          avatar_url: string | null
          content: string | null
          created_at: string
          display_name: string | null
          id: string
          media_url: string | null
          message_type: string
          nameplate: string | null
          reply_to: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          content?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          nameplate?: string | null
          reply_to?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          content?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          nameplate?: string | null
          reply_to?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "admin_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "admin_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          album_name: string
          artist_id: string
          cover_image_url: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          album_name: string
          artist_id: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          album_name?: string
          artist_id?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      artists: {
        Row: {
          artist_name: string
          bio: string | null
          created_at: string
          id: string
          profile_image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_name: string
          bio?: string | null
          created_at?: string
          id?: string
          profile_image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_name?: string
          bio?: string | null
          created_at?: string
          id?: string
          profile_image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          track_channel: string
          track_id: string
          track_thumbnail: string
          track_title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          track_channel: string
          track_id: string
          track_thumbnail: string
          track_title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          track_channel?: string
          track_id?: string
          track_thumbnail?: string
          track_title?: string
          user_id?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          game_name: string
          gems_collected: number | null
          id: string
          is_active: boolean | null
          score: number | null
          started_at: string
          track_playing: string | null
          track_source: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          game_name: string
          gems_collected?: number | null
          id?: string
          is_active?: boolean | null
          score?: number | null
          started_at?: string
          track_playing?: string | null
          track_source?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          game_name?: string
          gems_collected?: number | null
          id?: string
          is_active?: boolean | null
          score?: number | null
          started_at?: string
          track_playing?: string | null
          track_source?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      listening_history: {
        Row: {
          id: string
          played_at: string
          track_channel: string
          track_id: string
          track_thumbnail: string
          track_title: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string
          track_channel: string
          track_id: string
          track_thumbnail: string
          track_title: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string
          track_channel?: string
          track_id?: string
          track_thumbnail?: string
          track_title?: string
          user_id?: string
        }
        Relationships: []
      }
      lyrics: {
        Row: {
          created_at: string
          id: string
          lyrics_text: string
          source: string
          track_channel: string
          track_id: string
          track_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lyrics_text: string
          source?: string
          track_channel: string
          track_id: string
          track_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lyrics_text?: string
          source?: string
          track_channel?: string
          track_id?: string
          track_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          created_at: string
          id: string
          playlist_id: string
          position: number
          track_channel: string
          track_id: string
          track_thumbnail: string
          track_title: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_id: string
          position?: number
          track_channel: string
          track_id: string
          track_thumbnail: string
          track_title: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          track_channel?: string
          track_id?: string
          track_thumbnail?: string
          track_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          album_id: string
          audio_url: string
          created_at: string
          description: string | null
          duration: number | null
          id: string
          title: string
        }
        Insert: {
          album_id: string
          audio_url: string
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          title: string
        }
        Update: {
          album_id?: string
          audio_url?: string
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_info: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_vpn: boolean | null
          isp: string | null
          last_updated: string
          latitude: number | null
          longitude: number | null
          state: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_vpn?: boolean | null
          isp?: string | null
          last_updated?: string
          latitude?: number | null
          longitude?: number | null
          state?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_info?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_vpn?: boolean | null
          isp?: string | null
          last_updated?: string
          latitude?: number | null
          longitude?: number | null
          state?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          genres: string[]
          id: string
          onboarding_complete: boolean
          tutorial_complete: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          genres?: string[]
          id?: string
          onboarding_complete?: boolean
          tutorial_complete?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          genres?: string[]
          id?: string
          onboarding_complete?: boolean
          tutorial_complete?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
