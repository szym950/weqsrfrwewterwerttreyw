export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      menu_categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_dishes: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          image_url: string;
          ingredients: string[];
          is_available: boolean;
          name: string;
          price_pln: number | null;
          sort_order: number;
          station: string;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          image_url?: string;
          ingredients?: string[];
          is_available?: boolean;
          name: string;
          price_pln?: number | null;
          sort_order?: number;
          station?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          image_url?: string;
          ingredients?: string[];
          is_available?: boolean;
          name?: string;
          price_pln?: number | null;
          sort_order?: number;
          station?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_dishes_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_counts: {
        Row: {
          count: number;
          dish_name: string;
          updated_at: string;
        };
        Insert: {
          count?: number;
          dish_name: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          dish_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          created_at: string;
          customer_email: string | null;
          customer_name: string;
          customer_phone: string;
          delivery_address: string | null;
          delivery_cost: number;
          fulfillment: string;
          id: string;
          idempotency_key: string;
          order_number: number;
          payment_method: string;
          payment_status: string;
          payu_order_id: string | null;
          payu_redirect_url: string | null;
          push_notification_claimed_at: string | null;
          push_notification_sent_at: string | null;
          status: string;
          subtotal: number;
          total: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_email?: string | null;
          customer_name: string;
          customer_phone: string;
          delivery_address?: string | null;
          delivery_cost?: number;
          fulfillment: string;
          id?: string;
          idempotency_key: string;
          order_number?: number;
          payment_method: string;
          payment_status?: string;
          payu_order_id?: string | null;
          payu_redirect_url?: string | null;
          push_notification_claimed_at?: string | null;
          push_notification_sent_at?: string | null;
          status?: string;
          subtotal: number;
          total: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_email?: string | null;
          customer_name?: string;
          customer_phone?: string;
          delivery_address?: string | null;
          delivery_cost?: number;
          fulfillment?: string;
          id?: string;
          idempotency_key?: string;
          order_number?: number;
          payment_method?: string;
          payment_status?: string;
          payu_order_id?: string | null;
          payu_redirect_url?: string | null;
          push_notification_claimed_at?: string | null;
          push_notification_sent_at?: string | null;
          status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_members: {
        Row: {
          created_at: string;
          role: "administrator" | "menu_editor" | "orders";
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: "administrator" | "menu_editor" | "orders";
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: "administrator" | "menu_editor" | "orders";
          user_id?: string;
        };
        Relationships: [];
      };
      staff_push_tokens: {
        Row: {
          expo_push_token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          expo_push_token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          expo_push_token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "staff_members";
            referencedColumns: ["user_id"];
          },
        ];
      };
      order_items: {
        Row: {
          category: string;
          created_at: string;
          dish_name: string;
          id: string;
          line_total: number;
          order_id: string;
          quantity: number;
          station: string;
          unit_price: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          dish_name: string;
          id?: string;
          line_total: number;
          order_id: string;
          quantity: number;
          station: string;
          unit_price: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          dish_name?: string;
          id?: string;
          line_total?: number;
          order_id?: string;
          quantity?: number;
          station?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_dish_count: { Args: { _dish: string }; Returns: undefined };
      create_web_order: {
        Args: { p_items: Json; p_order: Json };
        Returns: {
          id: string;
          order_number: number;
          total: number;
          payment_status: string;
          payu_order_id: string | null;
          payu_redirect_url: string | null;
        }[];
      };
      save_payu_redirect: {
        Args: { p_order_id: string; p_payu_order_id: string; p_redirect_url: string };
        Returns: boolean;
      };
      apply_payu_notification: {
        Args: {
          p_order_id: string;
          p_payu_order_id: string;
          p_total_grosz: number;
          p_payu_status: string;
        };
        Returns: boolean;
      };
      claim_order_push_notification: {
        Args: { p_order_id: string };
        Returns: { order_number: number }[];
      };
      complete_order_push_notification: {
        Args: { p_order_id: string };
        Returns: boolean;
      };
      release_order_push_notification: {
        Args: { p_order_id: string };
        Returns: boolean;
      };
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
