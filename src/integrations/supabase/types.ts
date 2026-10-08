export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance_records: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          session_id: string;
          status: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id: string;
          session_id: string;
          status?: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          session_id?: string;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_sessions: {
        Row: {
          batch_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          owner_id: string;
          session_date: string;
        };
        Insert: {
          batch_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          owner_id: string;
          session_date: string;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          owner_id?: string;
          session_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
        ];
      };
      batches: {
        Row: {
          capacity: number;
          created_at: string;
          days_of_week: string[];
          id: string;
          is_active: boolean;
          is_sample: boolean;
          name: string;
          notes: string | null;
          owner_id: string;
          subject: string | null;
          teacher_name: string | null;
          timing: string | null;
          updated_at: string;
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          days_of_week?: string[];
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          name: string;
          notes?: string | null;
          owner_id: string;
          subject?: string | null;
          teacher_name?: string | null;
          timing?: string | null;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          days_of_week?: string[];
          id?: string;
          is_active?: boolean;
          is_sample?: boolean;
          name?: string;
          notes?: string | null;
          owner_id?: string;
          subject?: string | null;
          teacher_name?: string | null;
          timing?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_orders: {
        Row: {
          activated_at: string | null;
          amount_paise: number;
          created_at: string;
          currency: string;
          id: string;
          intent: string;
          line_items: Json | null;
          owner_id: string;
          paid_at: string | null;
          razorpay_order_id: string;
          razorpay_payment_id: string | null;
          status: string;
          tier: string;
          cycle: string;
        };
        Insert: {
          activated_at?: string | null;
          amount_paise: number;
          created_at?: string;
          currency?: string;
          id?: string;
          intent: string;
          line_items?: Json | null;
          owner_id: string;
          paid_at?: string | null;
          razorpay_order_id: string;
          razorpay_payment_id?: string | null;
          status?: string;
          tier: string;
          cycle: string;
        };
        Update: {
          activated_at?: string | null;
          amount_paise?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          intent?: string;
          line_items?: Json | null;
          owner_id?: string;
          paid_at?: string | null;
          razorpay_order_id?: string;
          razorpay_payment_id?: string | null;
          status?: string;
          tier?: string;
          cycle?: string;
        };
        Relationships: [];
      };
      fee_payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          is_sample: boolean;
          method: string;
          notes: string | null;
          owner_id: string;
          payment_date: string;
          receipt_number: string | null;
          reference: string | null;
          student_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          method?: string;
          notes?: string | null;
          owner_id: string;
          payment_date?: string;
          receipt_number?: string | null;
          reference?: string | null;
          student_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          is_sample?: boolean;
          method?: string;
          notes?: string | null;
          owner_id?: string;
          payment_date?: string;
          receipt_number?: string | null;
          reference?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      institutes: {
        Row: {
          address: string | null;
          admin_notes: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          currency: string;
          id: string;
          logo_url: string | null;
          name: string;
          owner_id: string;
          receipt_footer: string | null;
          receipt_prefix: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          admin_notes?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id: string;
          receipt_footer?: string | null;
          receipt_prefix?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          admin_notes?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string;
          receipt_footer?: string | null;
          receipt_prefix?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      razorpay_webhook_deliveries: {
        Row: {
          created_at: string;
          delivery_hash: string;
          error: string | null;
          event_type: string | null;
          handled: boolean;
          handled_at: string | null;
          id: string;
          owner_id: string | null;
          raw_body: Json | null;
          signature: string | null;
          subscription_id: string | null;
        };
        Insert: {
          created_at?: string;
          delivery_hash: string;
          error?: string | null;
          event_type?: string | null;
          handled?: boolean;
          handled_at?: string | null;
          id?: string;
          owner_id?: string | null;
          raw_body?: Json | null;
          signature?: string | null;
          subscription_id?: string | null;
        };
        Update: {
          created_at?: string;
          delivery_hash?: string;
          error?: string | null;
          event_type?: string | null;
          handled?: boolean;
          handled_at?: string | null;
          id?: string;
          owner_id?: string | null;
          raw_body?: Json | null;
          signature?: string | null;
          subscription_id?: string | null;
        };
        Relationships: [];
      };
      students: {
        Row: {
          address: string | null;
          batch_id: string | null;
          created_at: string;
          fee_due_date: string | null;
          fee_total: number;
          full_name: string;
          guardian_name: string | null;
          guardian_phone: string | null;
          id: string;
          is_sample: boolean;
          joining_date: string;
          notes: string | null;
          owner_id: string;
          phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          batch_id?: string | null;
          created_at?: string;
          fee_due_date?: string | null;
          fee_total?: number;
          full_name: string;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          id?: string;
          is_sample?: boolean;
          joining_date?: string;
          notes?: string | null;
          owner_id: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          batch_id?: string | null;
          created_at?: string;
          fee_due_date?: string | null;
          fee_total?: number;
          full_name?: string;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          id?: string;
          is_sample?: boolean;
          joining_date?: string;
          notes?: string | null;
          owner_id?: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "batches";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_audit: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          id: string;
          new_expiry: string | null;
          new_plan: Database["public"]["Enums"]["plan_code"] | null;
          new_price: number | null;
          new_status: string | null;
          note: string | null;
          old_expiry: string | null;
          old_plan: Database["public"]["Enums"]["plan_code"] | null;
          old_price: number | null;
          old_status: string | null;
          owner_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          new_expiry?: string | null;
          new_plan?: Database["public"]["Enums"]["plan_code"] | null;
          new_price?: number | null;
          new_status?: string | null;
          note?: string | null;
          old_expiry?: string | null;
          old_plan?: Database["public"]["Enums"]["plan_code"] | null;
          old_price?: number | null;
          old_status?: string | null;
          owner_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          new_expiry?: string | null;
          new_plan?: Database["public"]["Enums"]["plan_code"] | null;
          new_price?: number | null;
          new_status?: string | null;
          note?: string | null;
          old_expiry?: string | null;
          old_plan?: Database["public"]["Enums"]["plan_code"] | null;
          old_price?: number | null;
          old_status?: string | null;
          owner_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          expiry_date: string | null;
          last_webhook_at: string | null;
          last_webhook_event: string | null;
          notes: string | null;
          owner_id: string;
          plan: Database["public"]["Enums"]["plan_code"];
          plan_price: number | null;
          razorpay_customer_id: string | null;
          razorpay_subscription_id: string | null;
          start_date: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          expiry_date?: string | null;
          last_webhook_at?: string | null;
          last_webhook_event?: string | null;
          notes?: string | null;
          owner_id: string;
          plan?: Database["public"]["Enums"]["plan_code"];
          plan_price?: number | null;
          razorpay_customer_id?: string | null;
          razorpay_subscription_id?: string | null;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          expiry_date?: string | null;
          last_webhook_at?: string | null;
          last_webhook_event?: string | null;
          notes?: string | null;
          owner_id?: string;
          plan?: Database["public"]["Enums"]["plan_code"];
          plan_price?: number | null;
          razorpay_customer_id?: string | null;
          razorpay_subscription_id?: string | null;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      workspace_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          owner_id: string;
          permissions: Json;
          role: Database["public"]["Enums"]["workspace_role"];
          status: Database["public"]["Enums"]["invite_status"];
          token: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          owner_id: string;
          permissions?: Json;
          role?: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["invite_status"];
          token: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          owner_id?: string;
          permissions?: Json;
          role?: Database["public"]["Enums"]["workspace_role"];
          status?: Database["public"]["Enums"]["invite_status"];
          token?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          owner_id: string;
          permissions: Json;
          role: Database["public"]["Enums"]["workspace_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          owner_id: string;
          permissions?: Json;
          role?: Database["public"]["Enums"]["workspace_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          owner_id?: string;
          permissions?: Json;
          role?: Database["public"]["Enums"]["workspace_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_institute_health_detail: {
        Args: { _owner: string };
        Returns: Json;
      };
      admin_institute_health_summary: {
        Args: { _search?: string };
        Returns: {
          attendance_30d: number;
          batches_30d: number;
          contact_email: string;
          days_until_expiry: number;
          expiry_date: string;
          last_active_at: string;
          last_active_source: string;
          member_emails: string[];
          name: string;
          owner_id: string;
          payments_30d: number;
          plan: Database["public"]["Enums"]["plan_code"];
          plan_limit: number;
          plan_price: number;
          start_date: string;
          status: string;
          student_count: number;
          students_30d: number;
          top_feature_30d: string;
        }[];
      };
      apply_subscription_change: {
        Args: {
          _changed_by: string;
          _confirm?: boolean;
          _expiry: string;
          _note: string;
          _notes: string;
          _owner: string;
          _plan: Database["public"]["Enums"]["plan_code"];
          _price: number;
          _start: string;
          _status: string;
        };
        Returns: Json;
      };
      current_plan: {
        Args: { _uid: string };
        Returns: Database["public"]["Enums"]["plan_code"];
      };
      has_resource_access: {
        Args: {
          _owner: string;
          _resource: string;
          _uid: string;
          _write: boolean;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { _owner: string; _uid: string };
        Returns: boolean;
      };
      member_permission: {
        Args: { _owner: string; _resource: string; _uid: string };
        Returns: string;
      };
      plan_student_limit: {
        Args: { _plan: Database["public"]["Enums"]["plan_code"] };
        Returns: number;
      };
      subscription_health: { Args: { _uid: string }; Returns: Json };
    };
    activate_billing_order: {
      Args: {
        _order_id: string;
        _payment_id: string;
        _amount: number;
        _currency: string;
      };
      Returns: Json;
    };

    Enums: {
      app_role: "admin" | "user";
      invite_status: "pending" | "accepted" | "revoked" | "expired";
      plan_code: "free" | "starter" | "growth" | "pro";
      workspace_role: "owner" | "manager" | "staff" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      plan_code: ["free", "starter", "growth", "pro"],
      workspace_role: ["owner", "manager", "staff", "viewer"],
    },
  },
} as const;
