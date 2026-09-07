import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateVCEligibility, VCEvaluationResult } from "@/lib/ai-evaluator";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-secret-token",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface CandidatePayload {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber: string;
  linkedinUrl: string;
  currentFirm?: string;
  roleTitle?: string;
  hubCity?: string;
  appliedAt?: string | Date;
}

function normalizePhone(raw: string): string {
  let clean = (raw || "").trim().replace(/[\s\-\(\)]/g, "");
  if (!clean.startsWith("+")) {
    clean = `+${clean}`;
  }
  return clean;
}

function cleanLinkedinUrl(url: string): string {
  return (url || "").trim().split("?")[0].replace(/\/$/, "");
}

function parseApplicationDate(raw?: any): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString();
  const str = String(raw).trim();
  if (!str) return null;

  // If already standard ISO
  const isoParsed = new Date(str);
  if (!isNaN(isoParsed.getTime()) && str.includes("-")) {
    return isoParsed.toISOString();
  }

  // Handle DD/MM/YYYY H.mm.ss or DD/MM/YYYY HH:mm:ss
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[.:](\d{1,2})(?:[.:](\d{1,2}))?)?/);
  if (match) {
    const [, day, month, year, hours, minutes, seconds] = match;
    const d = new Date(
      Date.UTC(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours ? parseInt(hours, 10) : 0,
        minutes ? parseInt(minutes, 10) : 0,
        seconds ? parseInt(seconds, 10) : 0
      )
    );
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  return !isNaN(isoParsed.getTime()) ? isoParsed.toISOString() : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if body is a batch array or single object
    const candidates: CandidatePayload[] = Array.isArray(body)
      ? body
      : Array.isArray(body.candidates)
      ? body.candidates
      : [body];

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No candidates provided." },
        { status: 400, headers: corsHeaders }
      );
    }

    const insertedOrUpdated: any[] = [];
    const errors: any[] = [];

    for (const item of candidates) {
      const {
        phoneNumber,
        linkedinUrl,
        currentFirm,
        roleTitle,
        hubCity,
        appliedAt,
      } = item;

      const firstName = (item.firstName || "").trim();
      const lastName = (item.lastName || "").trim();
      let fullName = (item.fullName || "").trim();

      if (!fullName && (firstName || lastName)) {
        fullName = `${firstName} ${lastName}`.trim();
      } else if (fullName && firstName && lastName && !fullName.includes(lastName)) {
        fullName = `${firstName} ${lastName}`.trim();
      }

      if (!fullName || !phoneNumber || !linkedinUrl) {
        errors.push({
          item,
          error: "Full name (or first & last name), phone number, and LinkedIn URL are mandatory.",
        });
        continue;
      }

      const cleanPhone = normalizePhone(phoneNumber);
      const cleanLinkedin = cleanLinkedinUrl(linkedinUrl);
      const parsedAppliedAt = parseApplicationDate(appliedAt) || new Date().toISOString();

      // Resolve proper Hub City (default to Paris for Paris sheet)
      const targetHub =
        hubCity && hubCity.toLowerCase() !== "europe" && !hubCity.toLowerCase().includes("play") && !hubCity.toLowerCase().includes("partech")
          ? hubCity.trim()
          : "Paris";

      // 🤖 Immediate AI evaluation with Gemini 3.6 Flash upon entering the platform
      let evalResult: VCEvaluationResult | null = null;
      try {
        evalResult = await evaluateVCEligibility({
          full_name: fullName,
          role_title: (roleTitle || "").trim() || null,
          current_firm: (currentFirm || "").trim() || null,
        });
      } catch (err) {
        console.warn("Immediate AI evaluation warning for", fullName, err);
      }

      const candidateRecord = {
        full_name: fullName,
        first_name: firstName || fullName.split(" ")[0] || null,
        last_name: lastName || fullName.split(" ").slice(1).join(" ") || null,
        phone_number: cleanPhone,
        linkedin_url: cleanLinkedin,
        current_firm: (currentFirm || "").trim() || null,
        role_title: (roleTitle || "").trim() || null,
        hub_city: targetHub,
        applied_at: parsedAppliedAt,
        status: "pending_review",
        is_eligible_vc: evalResult ? evalResult.is_eligible_vc : null,
        ai_evaluation: evalResult || null,
        rejection_reason:
          evalResult && !evalResult.is_eligible_vc
            ? evalResult.rejection_reason_message || evalResult.reasoning
            : null,
        last_verified_at: evalResult ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("jvc_members")
        .upsert(candidateRecord, { onConflict: "phone_number" })
        .select()
        .single();

      if (error) {
        // If conflict on linkedin_url, update by linkedin_url
        if (error.message.includes("idx_jvc_members_linkedin") || error.code === "23505") {
          const { data: updateData, error: updateError } = await supabase
            .from("jvc_members")
            .update(candidateRecord)
            .eq("linkedin_url", cleanLinkedin)
            .select()
            .single();

          if (updateError) {
            errors.push({ item, error: updateError.message });
          } else {
            insertedOrUpdated.push(updateData);
          }
        } else {
          errors.push({ item, error: error.message });
        }
      } else {
        insertedOrUpdated.push(data);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Synced ${insertedOrUpdated.length} candidate(s) successfully!`,
        syncedCount: insertedOrUpdated.length,
        errorsCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Application/Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
