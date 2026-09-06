import { NextRequest, NextResponse } from "next/server";
import { getBotState, startWhatsAppClient } from "@/lib/whatsapp/bot-service";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // Check Supabase cached status
    const { data: setting } = await supabase
      .from("jvc_community_settings")
      .select("value")
      .eq("key", "wa_bot_live_status")
      .maybeSingle();

    const inMemory = getBotState();
    const result = setting?.value || inMemory;

    return NextResponse.json({
      status: inMemory.status !== "disconnected" ? inMemory.status : result.status || "disconnected",
      phoneNumber: inMemory.phoneNumber || result.phoneNumber || null,
      qrCodeDataUrl: inMemory.qrCodeDataUrl || result.qrCodeDataUrl || null,
      lastConnectedAt: inMemory.lastConnectedAt || result.updated_at || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Trigger WhatsApp connection
    startWhatsAppClient().catch(console.error);
    return NextResponse.json({ message: "WhatsApp client initializing..." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
