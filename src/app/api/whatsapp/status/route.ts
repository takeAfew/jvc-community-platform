import { NextRequest, NextResponse } from "next/server";
import { whatsapp } from "@/lib/whatsapp";
import { getProjectMode } from "@/lib/project-mode";

export async function GET() {
  try {
    const session = await whatsapp.getSessionStatus();
    const modeState = await getProjectMode();

    return NextResponse.json({
      success: true,
      status: session.connected ? "connected" : "disconnected",
      rawStatus: session.status,
      phoneNumber: session.phoneNumber || "+33745426699",
      pushName: session.pushName || "JVC",
      engineState: session.engineState,
      projectMode: modeState.mode,
      isDev: modeState.mode === "DEV",
      safeguardActive: modeState.mode === "DEV",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check/refresh WAHA status
    const session = await whatsapp.getSessionStatus();
    return NextResponse.json({
      message: session.connected ? "WAHA WhatsApp engine is online and connected." : "WhatsApp is disconnected.",
      session,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
