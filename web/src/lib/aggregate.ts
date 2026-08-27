import { RawRecord, MONTH_LABELS } from "./types";

export function demoData(): RawRecord[] {
  const months = Object.keys(MONTH_LABELS).slice(0, 8);
  const channels = ["Facebook", "CRM", "Shopee", "Lazada", "TikTok"];
  const provinces = ["กรุงเทพฯ", "เชียงใหม่", "ขอนแก่น", "ชลบุรี", "สงขลา", "นครราชสีมา"];
  const products = ["วิตามินซี", "คอลลาเจน", "โปรตีน", "น้ำมันปลา", "โพรไบโอติก"];
  let seed = 69;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const records: RawRecord[] = [];
  months.forEach((month) => {
    const n = 180 + Math.floor(rand() * 240);
    for (let i = 0; i < n; i++) {
      const day = 1 + Math.floor(rand() * 27);
      const date = new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`);
      records.push({
        m: month,
        id: `DEMO-${month}-${String(i).padStart(4, "0")}`,
        c: pick(channels),
        p: pick(provinces),
        n: pick(products),
        v: 190 + Math.floor(rand() * 1400),
        t: date.toISOString(),
      });
    }
  });
  return records;
}

export interface Kpis {
  curMonth: string | null;
  curMonthLabel: string;
  curCount: number;
  curValue: number;
  countDeltaPct: number | null;
  valueDeltaPct: number | null;
  avgPerMonth: number;
  nMonths: number;
  topChannel: string;
  topChannelSharePct: number;
}

export function computeKpis(all: RawRecord[], filtered: RawRecord[]): Kpis {
  const allMonths = Array.from(new Set(all.map((r) => r.m))).sort();
  const curMonth = allMonths.length ? allMonths[allMonths.length - 1] : null;
  const prevMonth = allMonths.length >= 2 ? allMonths[allMonths.length - 2] : null;

  const curRecords = curMonth ? all.filter((r) => r.m === curMonth) : [];
  const prevRecords = prevMonth ? all.filter((r) => r.m === prevMonth) : [];

  const curCount = curRecords.length;
  const curValue = curRecords.reduce((s, r) => s + (r.v ?? 0), 0);
  const prevCount = prevRecords.length;
  const prevValue = prevRecords.reduce((s, r) => s + (r.v ?? 0), 0);

  const countDeltaPct = prevMonth && prevCount ? ((curCount - prevCount) / prevCount) * 100 : null;
  const valueDeltaPct = prevMonth && prevValue ? ((curValue - prevValue) / prevValue) * 100 : null;

  const filteredMonths = new Set(filtered.map((r) => r.m));
  const nMonths = Math.max(filteredMonths.size, 1);
  const avgPerMonth = filtered.length / nMonths;

  const channelCounts = countBy(filtered, (r) => r.c ?? "ไม่ระบุ");
  const topEntry = channelCounts[0];
  const topChannel = topEntry ? topEntry[0] : "-";
  const topChannelSharePct = topEntry && filtered.length ? (topEntry[1] / filtered.length) * 100 : 0;

  return {
    curMonth,
    curMonthLabel: curMonth ? MONTH_LABELS[curMonth] ?? curMonth : "-",
    curCount,
    curValue,
    countDeltaPct,
    valueDeltaPct,
    avgPerMonth,
    nMonths,
    topChannel,
    topChannelSharePct,
  };
}

export function countBy(records: RawRecord[], keyFn: (r: RawRecord) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const r of records) {
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export function monthlyTrend(records: RawRecord[]): { month: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.m, (counts.get(r.m) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, label: MONTH_LABELS[month] ?? month, count }));
}
