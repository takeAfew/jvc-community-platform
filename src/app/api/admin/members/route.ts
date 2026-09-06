import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { addCandidateToGroup, removeMemberFromGroup, sendRejectionNotice } from "@/lib/whatsapp/bot-service";
import { scrapeLinkedInProfile } from "@/lib/lobstr";
import { evaluateVCEligibility } from "@/lib/ai-evaluator";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hub = searchParams.get("hub");

    let query = supabase.from("jvc_members").select("*").order("created_at", { ascending: false });
    if (hub && hub !== "all") {
      query = query.ilike("hub_city", `%${hub}%`);
    }

    const { data: members, error } = await query;
    if (error) throw error;

    return NextResponse.json({ members: members || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, action, newHub, customReason } = body;

    const { data: member } = await supabase
      .from("jvc_members")
      .select("*")
      .eq("id", memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (action === "force_approve") {
      await addCandidateToGroup(
        member.phone_number,
        member.full_name,
        member.current_firm || "Venture Capital"
      );

      await supabase
        .from("jvc_members")
        .update({
          status: "active_member",
          is_eligible_vc: true,
          wa_group_joined: true,
          rejection_reason: null,
          joined_at: member.joined_at || new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);

      await supabase.from("jvc_verification_logs").insert({
        member_id: memberId,
        run_type: "manual_trigger",
        previous_status: member.status,
        new_status: "active_member",
        action_taken: "added_to_group",
        details: { manual_override_by: "admin" },
      });
    } else if (action === "force_remove") {
      const reason = customReason || "No longer actively working in venture capital";
      await removeMemberFromGroup(member.phone_number, member.full_name, reason);

      await supabase
        .from("jvc_members")
        .update({
          status: "removed_churned",
          wa_group_joined: false,
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);

      await supabase.from("jvc_verification_logs").insert({
        member_id: memberId,
        run_type: "manual_trigger",
        previous_status: member.status,
        new_status: "removed_churned",
        action_taken: "removed_from_group",
        details: { manual_override_by: "admin", reason },
      });
    } else if (action === "force_reject") {
      const reason = customReason || "Profile does not meet active junior VC requirements";
      await sendRejectionNotice(member.phone_number, member.full_name, reason);

      await supabase
        .from("jvc_members")
        .update({
          status: "rejected",
          is_eligible_vc: false,
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);

      await supabase.from("jvc_verification_logs").insert({
        member_id: memberId,
        run_type: "manual_trigger",
        previous_status: member.status,
        new_status: "rejected",
        action_taken: "rejected_dm",
        details: { manual_override_by: "admin", reason },
      });
    } else if (action === "change_hub") {
      await supabase
        .from("jvc_members")
        .update({
          hub_city: newHub,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);
    } else if (action === "re_verify") {
      // Scrape fresh profile
      const scraped = await scrapeLinkedInProfile(member.linkedin_url, {
        fullName: member.full_name,
        currentFirm: member.current_firm || undefined,
        roleTitle: member.role_title || undefined,
      });

      // AI evaluate
      const evalResult = await evaluateVCEligibility({
        full_name: member.full_name,
        role_title: scraped.current_role || member.role_title,
        current_firm: scraped.current_company || member.current_firm,
        summary: scraped.summary,
        current_positions: scraped.current_positions,
        past_positions: scraped.past_positions,
      });

      await supabase
        .from("jvc_members")
        .update({
          is_eligible_vc: evalResult.is_eligible_vc,
          ai_evaluation: evalResult,
          current_firm: evalResult.firm_name || scraped.current_company || member.current_firm,
          role_title: scraped.current_role || member.role_title,
          rejection_reason: evalResult.is_eligible_vc ? null : evalResult.rejection_reason_message || evalResult.reasoning,
          last_scraped_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin member action error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
