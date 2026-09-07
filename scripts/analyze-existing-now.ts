import { supabase } from "../src/lib/supabase";
import { evaluateVCEligibility } from "../src/lib/ai-evaluator";

async function main() {
  console.log("Fetching all candidates that need AI evaluation...");

  const { data: members, error } = await supabase
    .from("jvc_members")
    .select("*")
    .order("applied_at", { ascending: true });

  if (error || !members) {
    console.error("Error fetching members:", error);
    process.exit(1);
  }

  console.log(`Found ${members.length} member(s). Starting Gemini 3.6 Flash analysis...`);

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    console.log(`[${i + 1}/${members.length}] Analyzing ${m.full_name} (${m.current_firm}, ${m.role_title})...`);

    try {
      const evaluation = await evaluateVCEligibility({
        full_name: m.full_name,
        role_title: m.role_title,
        current_firm: m.current_firm,
      });

      console.log(`  -> Verdict: ${evaluation.is_eligible_vc ? "✅ ELIGIBLE" : "❌ INELIGIBLE"} (${evaluation.confidence * 100}%)`);
      console.log(`  -> Reasoning: ${evaluation.reasoning}`);

      await supabase
        .from("jvc_members")
        .update({
          is_eligible_vc: evaluation.is_eligible_vc,
          ai_evaluation: evaluation,
          rejection_reason: evaluation.is_eligible_vc
            ? null
            : evaluation.rejection_reason_message || evaluation.reasoning,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", m.id);

      // 1.2s delay between requests to stay comfortably within rate limits
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err: any) {
      console.error(`  -> Error analyzing ${m.full_name}:`, err.message);
    }
  }

  console.log("All candidates analyzed successfully!");
  process.exit(0);
}

main();
