import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface JVCMember {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  applied_at?: string | null;
  phone_number: string;
  linkedin_url: string;
  current_firm: string | null;
  role_title: string | null;
  hub_city: string | null;
  status: "pending_review" | "active_member" | "rejected" | "removed_churned" | "flagged_manual";
  lobstr_raw_data?: any;
  last_scraped_at?: string;
  is_eligible_vc?: boolean;
  ai_evaluation?: any;
  rejection_reason?: string;
  wa_group_joined?: boolean;
  wa_invite_sent_at?: string;
  wa_last_message_at?: string;
  joined_at?: string;
  last_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface JVCVerificationLog {
  id: string;
  member_id: string;
  run_type: "monthly_batch" | "onboarding_check" | "manual_trigger";
  previous_status: string | null;
  new_status: string;
  action_taken: "added_to_group" | "invite_sent_dm" | "removed_from_group" | "rejected_dm" | "none_kept";
  details: any;
  created_at: string;
}
