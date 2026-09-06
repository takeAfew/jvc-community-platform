import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-secret-token",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface CandidatePayload {
  fullName: string;
  phoneNumber: string;
  linkedinUrl: string;
  currentFirm?: string;
  roleTitle?: string;
  hubCity?: string;
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
      const { fullName, phoneNumber, linkedinUrl, currentFirm, roleTitle, hubCity } = item;

      if (!fullName || !phoneNumber || !linkedinUrl) {
        errors.push({
          item,
          error: "Full name, phone number, and LinkedIn URL are mandatory.",
        });
        continue;
      }

      const cleanPhone = normalizePhone(phoneNumber);
      const cleanLinkedin = cleanLinkedinUrl(linkedinUrl);

      const { data, error } = await supabase
        .from("jvc_members")
        .upsert(
          {
            full_name: fullName.trim(),
            phone_number: cleanPhone,
            linkedin_url: cleanLinkedin,
            current_firm: (currentFirm || "").trim(),
            role_title: (roleTitle || "").trim(),
            hub_city: (hubCity || "Paris").trim(),
            status: "pending_review",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone_number" }
        )
        .select()
        .single();

      if (error) {
        // If conflict on linkedin_url, update by linkedin_url
        if (error.message.includes("idx_jvc_members_linkedin") || error.code === "23505") {
          const { data: updateData, error: updateError } = await supabase
            .from("jvc_members")
            .update({
              full_name: fullName.trim(),
              phone_number: cleanPhone,
              current_firm: (currentFirm || "").trim(),
              role_title: (roleTitle || "").trim(),
              hub_city: (hubCity || "Paris").trim(),
              updated_at: new Date().toISOString(),
            })
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
