export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          link: string | null;
          message: string;
          title: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message: string;
          title: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message?: string;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_scan_logs: {
        Row: {
          id: string;
          asset_id: string;
          user_id: string | null;
          device_type: string | null;
          browser: string | null;
          platform: string | null;
          ip_address: string | null;
          latitude: string | null;
          longitude: string | null;
          scan_result: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          user_id?: string | null;
          device_type?: string | null;
          browser?: string | null;
          platform?: string | null;
          ip_address?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          scan_result?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          user_id?: string | null;
          device_type?: string | null;
          browser?: string | null;
          platform?: string | null;
          ip_address?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          scan_result?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_scan_logs_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_scan_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_logs: {
        Row: {
          action: string;
          created_at: string;
          description: string | null;
          id: string;
          ip_address: string | null;
          module: string;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          table_name: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          ip_address?: string | null;
          module: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          ip_address?: string | null;
          module?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_loans: {
        Row: {
          approved_by: string | null;
          asset_id: string;
          borrower_contact: string | null;
          borrower_name: string;
          borrower_unit: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          loan_condition: string | null;
          loan_date: string;
          purpose: string | null;
          return_condition: string | null;
          return_date: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          approved_by?: string | null;
          asset_id: string;
          borrower_contact?: string | null;
          borrower_name: string;
          borrower_unit?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          loan_condition?: string | null;
          loan_date?: string;
          purpose?: string | null;
          return_condition?: string | null;
          return_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_by?: string | null;
          asset_id?: string;
          borrower_contact?: string | null;
          borrower_name?: string;
          borrower_unit?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          loan_condition?: string | null;
          loan_date?: string;
          purpose?: string | null;
          return_condition?: string | null;
          return_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_loans_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_loans_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_loans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_mutations: {
        Row: {
          approved_by: string | null;
          asset_id: string;
          attachment: string | null;
          created_at: string;
          created_by: string | null;
          document_number: string | null;
          from_location_id: number | null;
          id: string;
          mutation_date: string;
          reason: string | null;
          to_location_id: number;
        };
        Insert: {
          approved_by?: string | null;
          asset_id: string;
          attachment?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_number?: string | null;
          from_location_id?: number | null;
          id?: string;
          mutation_date?: string;
          reason?: string | null;
          to_location_id: number;
        };
        Update: {
          approved_by?: string | null;
          asset_id?: string;
          attachment?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_number?: string | null;
          from_location_id?: number | null;
          id?: string;
          mutation_date?: string;
          reason?: string | null;
          to_location_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "asset_mutations_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_mutations_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_mutations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_mutations_from_location_id_fkey";
            columns: ["from_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_mutations_to_location_id_fkey";
            columns: ["to_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_photos: {
        Row: {
          asset_id: string;
          created_at: string;
          file_name: string | null;
          file_path: string;
          id: string;
          is_primary: boolean;
          uploaded_by: string | null;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          file_name?: string | null;
          file_path: string;
          id?: string;
          is_primary?: boolean;
          uploaded_by?: string | null;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          file_name?: string | null;
          file_path?: string;
          id?: string;
          is_primary?: boolean;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "asset_photos_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_photos_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_qr_codes: {
        Row: {
          asset_id: string;
          generated_at: string;
          id: string;
          print_count: number;
          printed_at: string | null;
          qr_image_path: string | null;
          qr_token: string;
          status: string;
        };
        Insert: {
          asset_id: string;
          generated_at?: string;
          id?: string;
          print_count?: number;
          printed_at?: string | null;
          qr_image_path?: string | null;
          qr_token: string;
          status?: string;
        };
        Update: {
          asset_id?: string;
          generated_at?: string;
          id?: string;
          print_count?: number;
          printed_at?: string | null;
          qr_image_path?: string | null;
          qr_token?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_qr_codes_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: true;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          acquisition_date: string;
          acquisition_price: number;
          asset_code: string;
          asset_name: string;
          asset_status: string;
          brand: string | null;
          category_id: number;
          condition_status: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          location_id: number;
          model: string | null;
          ownership_status: string;
          residual_value: number;
          serial_number: string | null;
          specification: string | null;
          quantity: number;
          updated_at: string;
          useful_life_years: number | null;
        };
        Insert: {
          acquisition_date: string;
          acquisition_price?: number;
          asset_code: string;
          asset_name: string;
          asset_status?: string;
          brand?: string | null;
          category_id: number;
          condition_status?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          location_id: number;
          model?: string | null;
          ownership_status?: string;
          quantity?: number;
          residual_value?: number;
          serial_number?: string | null;
          specification?: string | null;
          updated_at?: string;
          useful_life_years?: number | null;
        };
        Update: {
          acquisition_date?: string;
          acquisition_price?: number;
          asset_code?: string;
          asset_name?: string;
          asset_status?: string;
          brand?: string | null;
          category_id?: number;
          condition_status?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          location_id?: number;
          model?: string | null;
          ownership_status?: string;
          quantity?: number;
          residual_value?: number;
          serial_number?: string | null;
          specification?: string | null;
          updated_at?: string;
          useful_life_years?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_findings: {
        Row: {
          audit_result_id: string;
          created_at: string;
          description: string;
          finding_type: string;
          id: string;
          recommendation: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          status: string;
        };
        Insert: {
          audit_result_id: string;
          created_at?: string;
          description: string;
          finding_type: string;
          id?: string;
          recommendation?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          status?: string;
        };
        Update: {
          audit_result_id?: string;
          created_at?: string;
          description?: string;
          finding_type?: string;
          id?: string;
          recommendation?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_result_id_fkey";
            columns: ["audit_result_id"];
            isOneToOne: false;
            referencedRelation: "audit_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_findings_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_results: {
        Row: {
          asset_id: string;
          audit_schedule_id: string;
          audit_status: string;
          auditor_id: string | null;
          code_match: boolean;
          condition_match: boolean;
          created_at: string;
          evidence_photo: string | null;
          id: string;
          location_match: boolean;
          notes: string | null;
          physical_found: boolean;
          recommendation: string | null;
          scan_time: string | null;
        };
        Insert: {
          asset_id: string;
          audit_schedule_id: string;
          audit_status: string;
          auditor_id?: string | null;
          code_match?: boolean;
          condition_match?: boolean;
          created_at?: string;
          evidence_photo?: string | null;
          id?: string;
          location_match?: boolean;
          notes?: string | null;
          physical_found?: boolean;
          recommendation?: string | null;
          scan_time?: string | null;
        };
        Update: {
          asset_id?: string;
          audit_schedule_id?: string;
          audit_status?: string;
          auditor_id?: string | null;
          code_match?: boolean;
          condition_match?: boolean;
          created_at?: string;
          evidence_photo?: string | null;
          id?: string;
          location_match?: boolean;
          notes?: string | null;
          physical_found?: boolean;
          recommendation?: string | null;
          scan_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_results_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_results_audit_schedule_id_fkey";
            columns: ["audit_schedule_id"];
            isOneToOne: false;
            referencedRelation: "audit_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_results_auditor_id_fkey";
            columns: ["auditor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_schedules: {
        Row: {
          assigned_to: string | null;
          category_id: number | null;
          created_at: string;
          created_by: string | null;
          end_date: string;
          id: string;
          location_id: number | null;
          notes: string | null;
          start_date: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          category_id?: number | null;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          id?: string;
          location_id?: number | null;
          notes?: string | null;
          start_date: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          category_id?: number | null;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          id?: string;
          location_id?: number | null;
          notes?: string | null;
          start_date?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_schedules_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_schedules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_schedules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_schedules_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: number;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: number;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: number;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          asset_id: string | null;
          category_id: number | null;
          created_at: string;
          destination: string | null;
          id: string;
          item_name: string | null;
          notes: string | null;
          quantity: number | null;
          reference_no: string | null;
          status: string;
          transaction_date: string;
          transaction_no: string;
          type: string;
          updated_at: string | null;
          user_id: string | null;
          vendor_id: string | null;
          work_type_id: string | null;
        };
        Insert: {
          asset_id?: string | null;
          category_id?: number | null;
          created_at?: string;
          destination?: string | null;
          id?: string;
          item_name?: string | null;
          notes?: string | null;
          quantity?: number | null;
          reference_no?: string | null;
          status?: string;
          transaction_date: string;
          transaction_no: string;
          type: string;
          updated_at?: string | null;
          user_id?: string | null;
          vendor_id?: string | null;
          work_type_id?: string | null;
        };
        Update: {
          asset_id?: string | null;
          category_id?: number | null;
          created_at?: string;
          destination?: string | null;
          id?: string;
          item_name?: string | null;
          notes?: string | null;
          quantity?: number | null;
          reference_no?: string | null;
          status?: string;
          transaction_date?: string;
          transaction_no?: string;
          type?: string;
          updated_at?: string | null;
          user_id?: string | null;
          vendor_id?: string | null;
          work_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transactions_work_type_id_fkey";
            columns: ["work_type_id"];
            isOneToOne: false;
            referencedRelation: "work_types";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          building: string | null;
          code: string;
          created_at: string;
          description: string | null;
          floor: string | null;
          id: number;
          name: string;
          room: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          building?: string | null;
          code: string;
          created_at?: string;
          description?: string | null;
          floor?: string | null;
          id?: number;
          name: string;
          room?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          building?: string | null;
          code?: string;
          created_at?: string;
          description?: string | null;
          floor?: string | null;
          id?: number;
          name?: string;
          room?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      maintenance_records: {
        Row: {
          asset_id: string;
          attachment: string | null;
          condition_after: string | null;
          condition_before: string | null;
          cost: number;
          created_at: string;
          created_by: string | null;
          description: string | null;
          finish_date: string | null;
          id: string;
          maintenance_date: string;
          maintenance_type: string;
          start_date: string | null;
          status: string;
          updated_at: string;
          vendor_name: string | null;
        };
        Insert: {
          asset_id: string;
          attachment?: string | null;
          condition_after?: string | null;
          condition_before?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          finish_date?: string | null;
          id?: string;
          maintenance_date: string;
          maintenance_type: string;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
          vendor_name?: string | null;
        };
        Update: {
          asset_id?: string;
          attachment?: string | null;
          condition_after?: string | null;
          condition_before?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          finish_date?: string | null;
          id?: string;
          maintenance_date?: string;
          maintenance_type?: string;
          start_date?: string | null;
          status?: string;
          updated_at?: string;
          vendor_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_records_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_records_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          label: string;
          name: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          label: string;
          name: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          label?: string;
          name?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          description: string | null;
          id: number;
          setting_key: string;
          setting_value: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          description?: string | null;
          id?: number;
          setting_key: string;
          setting_value?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          description?: string | null;
          id?: number;
          setting_key?: string;
          setting_value?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
      users: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          last_login_at: string | null;
          phone: string | null;
          photo: string | null;
          status: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name: string;
          id: string;
          last_login_at?: string | null;
          phone?: string | null;
          photo?: string | null;
          status?: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          last_login_at?: string | null;
          phone?: string | null;
          photo?: string | null;
          status?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_types: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_manage_assets: { Args: never; Returns: boolean };
      current_role_name: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      get_asset_by_qr: {
        Args: { _token: string };
        Returns: {
          asset_code: string;
          asset_name: string;
          asset_status: string;
          brand: string;
          building: string;
          category_name: string;
          condition_status: string;
          location_name: string;
          model: string;
          photo_path: string;
          room: string;
          serial_number: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "admin_utama" | "operator_aset" | "auditor" | "pimpinan";
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
    Enums: {
      app_role: ["admin_utama", "operator_aset", "auditor", "pimpinan"],
    },
  },
} as const;
