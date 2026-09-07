import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateVCEligibility } from "@/lib/ai-evaluator";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceAll = searchParams.get("force") === "true";

    // Fetch members that need evaluation
    let query = supabase.from("jvc_members").select("*");
    if (!forceAll) {
      query = query.or("ai_evaluation.is.null,is_eligible_vc.is.null");
    }

    const { data: members, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All profiles are already analyzed by AI.",
        evaluatedCount: 0,
      });
    }

    const results: any[] = [];

    // Analyze each profile with Gemini 3.6 Flash
    for (const member of members) {
      try {
        const evaluation = await evaluateVCEligibility({
          full_name: member.full_name,
          role_title: member.role_title,
          current_firm: member.current_firm,
        });

        const updateData = {
          is_eligible_vc: evaluation.is_eligible_vc,
          ai_evaluation: evaluation,
          rejection_reason: evaluation.is_eligible_vc
            ? null
            : evaluation.rejection_reason_message || evaluation.reasoning,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data, error: updateError } = await supabase
          .from("jvc_members")
          .update(updateData)
          .eq("id", member.id)
          .select()
          .single();

        if (updateError) {
          results.push({ id: member.id, error: updateError.message });
        } else {
          results.push({
            id: member.id,
            name: member.full_name,
            eligible: evaluation.is_eligible_vc,
            firm_category: evaluation.firm_category,
            confidence: evaluation.confidence,
          });
        }
      } catch (err: any) {
        results.push({ id: member.id, error: err.message });
      }

      // Small delay between calls to respect API limits
      if (members.length > 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed ${results.length} candidate profile(s) with Gemini AI!`,
      evaluatedCount: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Auto-analyze API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
