import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, phoneNumber, linkedinUrl, currentFirm, roleTitle, hubCity } = body;

    if (!fullName || !phoneNumber || !linkedinUrl) {
      return NextResponse.json(
        { error: "Full name, WhatsApp phone number, and LinkedIn URL are required." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Format phone: ensure international prefix
    let cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = `+${cleanPhone}`;
    }

    // Clean LinkedIn URL
    const cleanLinkedin = linkedinUrl.trim().split("?")[0].replace(/\/$/, "");

    // Check if member already exists
    const { data: existing } = await supabase
      .from("jvc_members")
      .select("id, status, full_name")
      .or(`phone_number.eq.${cleanPhone},linkedin_url.eq.${cleanLinkedin}`)
      .maybeSingle();

    if (existing) {
      if (existing.status === "active_member") {
        return NextResponse.json(
          { message: "You are already an active member of JVC! Welcome back." },
          { status: 200, headers: corsHeaders }
        );
      } else if (existing.status === "pending_review") {
        return NextResponse.json(
          { message: "Your application is already received and queued for the monthly review." },
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // Insert new application
    const { data, error } = await supabase
      .from("jvc_members")
      .upsert(
        {
          full_name: fullName.trim(),
          phone_number: cleanPhone,
          linkedin_url: cleanLinkedin,
          current_firm: (currentFirm || "").trim(),
          role_title: (roleTitle || "").trim(),
          hub_city: (hubCity || "Europe").trim(),
          status: "pending_review",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone_number" }
      )
      .select()
      .single();

    if (error) {
      console.error("Database insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully! Your profile will be verified during the monthly review cycle.",
        member: data,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Application error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
