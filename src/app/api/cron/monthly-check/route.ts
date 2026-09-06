import { NextRequest, NextResponse } from "next/server";
import { runMonthlyVerification } from "@/lib/monthly-checker";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET || "jvc_secret_monthly_verification_2026";

    // Allow internal admin calls or matching cron secret
    if (authHeader !== `Bearer ${secret}` && !req.headers.get("x-admin-trigger")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const targetMemberId = searchParams.get("memberId") || undefined;

    const summary = await runMonthlyVerification({ dryRun, targetMemberId });

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error("Monthly check failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
