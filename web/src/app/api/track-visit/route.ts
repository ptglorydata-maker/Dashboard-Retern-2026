import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sheetsClient, VISIT_LOG_SPREADSHEET_ID } from "@/lib/sheets-server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!VISIT_LOG_SPREADSHEET_ID) {
    // Not configured yet — no-op rather than error, so the dashboard still works.
    return NextResponse.json({ ok: false, error: "visit logging not configured" });
  }

  const body = await req.json().catch(() => ({}));
  const path = typeof body.path === "string" ? body.path : "/";

  try {
    const sheets = sheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: VISIT_LOG_SPREADSHEET_ID,
      range: "visits!A:C",
      valueInputOption: "RAW",
      requestBody: { values: [[new Date().toISOString(), session.user.email, path]] },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("track-visit failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
