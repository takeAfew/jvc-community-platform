import { supabase, JVCMember } from "./supabase";
import { scrapeLinkedInProfile } from "./lobstr";
import { evaluateVCEligibility } from "./ai-evaluator";
import {
  addCandidateToGroup,
  removeMemberFromGroup,
  sendRejectionNotice,
} from "./whatsapp/bot-service";

export interface VerificationRunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  totalProcessed: number;
  newApplicantsEvaluated: number;
  newApplicantsApproved: number;
  newApplicantsRejected: number;
  existingMembersChecked: number;
  existingMembersKept: number;
  existingMembersRemoved: number;
  errors: Array<{ memberId: string; error: string }>;
}

export async function runMonthlyVerification(options?: {
  dryRun?: boolean;
  targetMemberId?: string;
}): Promise<VerificationRunSummary> {
  const startedAt = new Date().toISOString();
  const dryRun = options?.dryRun || false;

  console.log(`\n======================================================`);
  console.log(`🚀 JVC VERIFICATION RUN ${dryRun ? "[DRY RUN / SIMULATION]" : "[LIVE]"}`);
  console.log(`======================================================\n`);

  const summary: VerificationRunSummary = {
    runId: `run_${Date.now()}`,
    startedAt,
    completedAt: "",
    totalProcessed: 0,
    newApplicantsEvaluated: 0,
    newApplicantsApproved: 0,
    newApplicantsRejected: 0,
    existingMembersChecked: 0,
    existingMembersKept: 0,
    existingMembersRemoved: 0,
    errors: [],
  };

  // 1. Fetch group settings from database
  const { data: settingsData } = await supabase
    .from("jvc_community_settings")
    .select("key, value");

  const settingsMap = new Map((settingsData || []).map((s) => [s.key, s.value]));
  const waGroup = settingsMap.get("wa_group") || {};
  const groupJid = waGroup.group_jid || process.env.WHATSAPP_GROUP_JID;
  const inviteLink = waGroup.invite_link || process.env.WHATSAPP_GROUP_INVITE_LINK;

  // 2. Fetch members to process
  let query = supabase.from("jvc_members").select("*");
  if (options?.targetMemberId) {
    query = query.eq("id", options.targetMemberId);
  } else {
    query = query.in("status", ["pending_review", "active_member"]);
  }

  const { data: members, error } = await query;
  if (error || !members) {
    throw new Error(`Failed to query members: ${error?.message}`);
  }

  console.log(`Found ${members.length} member(s) to verify.\n`);

  for (const member of members as JVCMember[]) {
    summary.totalProcessed++;
    try {
      console.log(`--- Processing [${member.status}] ${member.full_name} (${member.linkedin_url}) ---`);

      // A. Scrape Profile from LinkedIn via Lobstr
      console.log(` 1. Scraping LinkedIn profile via Lobstr...`);
      const scraped = await scrapeLinkedInProfile(member.linkedin_url, {
        fullName: member.full_name,
        currentFirm: member.current_firm || undefined,
        roleTitle: member.role_title || undefined,
      });

      // B. Evaluate VC Eligibility via Gemini 3.6 Flash
      console.log(` 2. Evaluating role & firm with Gemini 3.6 Flash...`);
      const evaluation = await evaluateVCEligibility({
        full_name: member.full_name,
        role_title: scraped.current_role || member.role_title,
        current_firm: scraped.current_company || member.current_firm,
        summary: scraped.summary,
        current_positions: scraped.current_positions,
        past_positions: scraped.past_positions,
      });

      console.log(
        `    -> Result: ${evaluation.is_eligible_vc ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE"} (${evaluation.confidence * 100}%)`
      );
      console.log(`    -> Reasoning: ${evaluation.reasoning}`);

      // C. Process based on lifecycle status
      if (member.status === "pending_review") {
        summary.newApplicantsEvaluated++;

        if (evaluation.is_eligible_vc) {
          summary.newApplicantsApproved++;
          console.log(` 3. Approved! Adding candidate to group / sending welcome...`);

          let actionResult = { action: "invite_sent_dm" };
          if (!dryRun) {
            actionResult = await addCandidateToGroup(
              member.phone_number,
              member.full_name,
              evaluation.firm_name || member.current_firm || "your VC firm",
              groupJid,
              inviteLink
            );

            await supabase
              .from("jvc_members")
              .update({
                status: "active_member",
                current_firm: evaluation.firm_name || member.current_firm,
                role_title: scraped.current_role || member.role_title,
                is_eligible_vc: true,
                ai_evaluation: evaluation,
                lobstr_raw_data: scraped.raw || null,
                last_scraped_at: new Date().toISOString(),
                joined_at: new Date().toISOString(),
                last_verified_at: new Date().toISOString(),
                wa_group_joined: actionResult.action === "added_to_group",
                wa_invite_sent_at: new Date().toISOString(),
                wa_last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", member.id);

            await supabase.from("jvc_verification_logs").insert({
              member_id: member.id,
              run_type: "onboarding_check",
              previous_status: "pending_review",
              new_status: "active_member",
              action_taken: actionResult.action,
              details: { evaluation, scrapedSummary: scraped.summary },
            });
          }
        } else {
          // Rejection
          summary.newApplicantsRejected++;
          const reasonMsg = evaluation.rejection_reason_message || evaluation.reasoning;
          console.log(` 3. Rejected: "${reasonMsg}". Sending notification via WhatsApp...`);

          if (!dryRun) {
            await sendRejectionNotice(member.phone_number, member.full_name, reasonMsg);

            await supabase
              .from("jvc_members")
              .update({
                status: "rejected",
                is_eligible_vc: false,
                ai_evaluation: evaluation,
                rejection_reason: reasonMsg,
                lobstr_raw_data: scraped.raw || null,
                last_scraped_at: new Date().toISOString(),
                wa_last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", member.id);

            await supabase.from("jvc_verification_logs").insert({
              member_id: member.id,
              run_type: "onboarding_check",
              previous_status: "pending_review",
              new_status: "rejected",
              action_taken: "rejected_dm",
              details: { evaluation, reasonMsg },
            });
          }
        }
      } else if (member.status === "active_member") {
        summary.existingMembersChecked++;

        if (evaluation.is_eligible_vc) {
          summary.existingMembersKept++;
          console.log(` 3. Status intact! Member continues in community.`);

          if (!dryRun) {
            await supabase
              .from("jvc_members")
              .update({
                current_firm: evaluation.firm_name || member.current_firm,
                role_title: scraped.current_role || member.role_title,
                is_eligible_vc: true,
                ai_evaluation: evaluation,
                lobstr_raw_data: scraped.raw || null,
                last_scraped_at: new Date().toISOString(),
                last_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", member.id);

            await supabase.from("jvc_verification_logs").insert({
              member_id: member.id,
              run_type: "monthly_batch",
              previous_status: "active_member",
              new_status: "active_member",
              action_taken: "none_kept",
              details: { evaluation },
            });
          }
        } else {
          // Member no longer working in VC -> Remove and notify
          summary.existingMembersRemoved++;
          const reasonMsg = evaluation.rejection_reason_message || evaluation.reasoning;
          console.log(` 3. Member no longer in VC: "${reasonMsg}". Removing from group & notifying...`);

          if (!dryRun) {
            await removeMemberFromGroup(member.phone_number, member.full_name, reasonMsg, groupJid);

            await supabase
              .from("jvc_members")
              .update({
                status: "removed_churned",
                is_eligible_vc: false,
                ai_evaluation: evaluation,
                rejection_reason: reasonMsg,
                lobstr_raw_data: scraped.raw || null,
                last_scraped_at: new Date().toISOString(),
                wa_group_joined: false,
                wa_last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", member.id);

            await supabase.from("jvc_verification_logs").insert({
              member_id: member.id,
              run_type: "monthly_batch",
              previous_status: "active_member",
              new_status: "removed_churned",
              action_taken: "removed_from_group",
              details: { evaluation, reasonMsg },
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`Error processing member ${member.id}:`, err);
      summary.errors.push({ memberId: member.id, error: err.message });
    }
  }

  summary.completedAt = new Date().toISOString();
  console.log(`\n======================================================`);
  console.log(`✅ VERIFICATION SUMMARY:`, JSON.stringify(summary, null, 2));
  console.log(`======================================================\n`);

  return summary;
}
