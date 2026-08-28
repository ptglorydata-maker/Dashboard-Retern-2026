import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sheetsClient, VISIT_LOG_SPREADSHEET_ID } from "@/lib/sheets-server";

interface Bucket {
  label: string;
  count: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!VISIT_LOG_SPREADSHEET_ID) {
    return NextResponse.json({ monthly: [], quarterly: [], yearly: [], total: 0, configured: false });
  }

  try {
    const sheets = sheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: VISIT_LOG_SPREADSHEET_ID,
      range: "visits!A2:C",
    });
    const rows = res.data.values ?? [];

    const monthly = new Map<string, number>();
    const quarterly = new Map<string, number>();
    const yearly = new Map<string, number>();

    for (const row of rows) {
      const ts = row[0];
      const d = new Date(ts);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const q = Math.ceil(m / 3);
      const mKey = `${y}-${String(m).padStart(2, "0")}`;
      const qKey = `${y}-Q${q}`;
      const yKey = `${y}`;
      monthly.set(mKey, (monthly.get(mKey) ?? 0) + 1);
      quarterly.set(qKey, (quarterly.get(qKey) ?? 0) + 1);
      yearly.set(yKey, (yearly.get(yKey) ?? 0) + 1);
    }

    const toArr = (m: Map<string, number>): Bucket[] =>
      Array.from(m.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, count]) => ({ label, count }));

    return NextResponse.json({
      monthly: toArr(monthly),
      quarterly: toArr(quarterly),
      yearly: toArr(yearly),
      total: rows.length,
      configured: true,
    });
  } catch (err) {
    console.error("visit-stats failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
