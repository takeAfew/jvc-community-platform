import { NextRequest, NextResponse } from "next/server";
import { getProjectMode, setProjectMode, ProjectMode } from "@/lib/project-mode";

export async function GET() {
  try {
    const modeState = await getProjectMode();
    return NextResponse.json({
      success: true,
      ...modeState,
      isDev: modeState.mode === "DEV",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetMode, confirmationCount, confirmationPhrase } = body as {
      targetMode: ProjectMode;
      confirmationCount?: number;
      confirmationPhrase?: string;
    };

    if (!targetMode || (targetMode !== "DEV" && targetMode !== "LIVE")) {
      return NextResponse.json({ error: "Invalid targetMode. Must be DEV or LIVE." }, { status: 400 });
    }

    const result = await setProjectMode(targetMode, {
      confirmationCount,
      confirmationPhrase,
      adminUser: "JVC Admin",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, currentMode: result.mode },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: result.mode,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
