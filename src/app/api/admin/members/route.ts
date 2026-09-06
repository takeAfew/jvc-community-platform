import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { addCandidateToGroup, removeMemberFromGroup } from "@/lib/whatsapp/bot-service";

export async function GET() {
  try {
    const { data: members, error } = await supabase
      .from("jvc_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ members: members || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, action } = body;

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
          joined_at: new Date().toISOString(),
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
      await removeMemberFromGroup(
        member.phone_number,
        member.full_name,
        "manual review step-out"
      );

      await supabase
        .from("jvc_members")
        .update({
          status: "removed_churned",
          wa_group_joined: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);

      await supabase.from("jvc_verification_logs").insert({
        member_id: memberId,
        run_type: "manual_trigger",
        previous_status: member.status,
        new_status: "removed_churned",
        action_taken: "removed_from_group",
        details: { manual_override_by: "admin" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
