import { RawRecord, MONTH_LABELS, OrderTotals, OrderTotalsOverall, DimBreakdownRow } from "./types";

// Picks the all-orders denominator row matching the sidebar's selected
// month ("ทั้งหมด" -> overall totals, else that month's row from byMonth).
export function pickTotals(totals: OrderTotals, selectedMonth: string): OrderTotalsOverall {
  if (selectedMonth === "ทั้งหมด") return totals.overall;
  const row = totals.byMonth.find((r) => r.key === selectedMonth);
  if (!row) return totals.overall;
  return {
    orders: row.orders,
    value: row.value,
    returned: row.returned,
    returned_value: row.returned_value,
    cod_orders: row.cod_orders,
    cod_value: 0,
    cod_returned: row.cod_returned,
    cod_returned_value: 0,
  };
}

export interface RateCards {
  returnRateUnits: number;
  returnRateValue: number;
  codRejectionRate: number;
  codOrders: number;
  financialLoss: number;
}

export function computeRateCards(t: OrderTotalsOverall): RateCards {
  return {
    returnRateUnits: t.orders ? (t.returned / t.orders) * 100 : 0,
    returnRateValue: t.value ? (t.returned_value / t.value) * 100 : 0,
    codRejectionRate: t.cod_orders ? (t.cod_returned / t.cod_orders) * 100 : 0,
    codOrders: t.cod_orders,
    financialLoss: t.returned_value,
  };
}

export interface RateRow {
  key: string;
  label: string;
  orders: number;
  returned: number;
  returnRatePct: number;
}

// Return-rate ranking for a dimension breakdown (courier / admin / SKU),
// restricted to groups with at least `minOrders` orders so low-volume
// noise (e.g. an admin who closed 3 sales) doesn't dominate the ranking.
export function rateRanking(
  rows: DimBreakdownRow[],
  minOrders: number,
  limit = 10,
  sortDir: "desc" | "asc" = "desc"
): RateRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  return rows
    .filter((r) => r.orders >= minOrders)
    .map((r) => ({
      key: r.key,
      label: r.label,
      orders: r.orders,
      returned: r.returned,
      returnRatePct: r.orders ? (r.returned / r.orders) * 100 : 0,
    }))
    .sort((a, b) => dir * (a.returnRatePct - b.returnRatePct))
    .slice(0, limit);
}

export interface MonthlyRateRow {
  month: string;
  label: string;
  orders: number;
  returned: number;
  returnRatePct: number;
}

export function monthlyRateTrend(byMonth: DimBreakdownRow[]): MonthlyRateRow[] {
  return [...byMonth]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({
      month: r.key,
      label: MONTH_LABELS[r.key] ?? r.key,
      orders: r.orders,
      returned: r.returned,
      returnRatePct: r.orders ? (r.returned / r.orders) * 100 : 0,
    }));
}

export function demoData(): RawRecord[] {
  const months = Object.keys(MONTH_LABELS).slice(0, 8);
  const channels = ["Facebook", "CRM", "Shopee", "Lazada", "TikTok"];
  const provinces: [string, string][] = [
    ["กรุงเทพมหานคร", "Bangkok Metropolis"],
    ["เชียงใหม่", "Chiang Mai"],
    ["ขอนแก่น", "Khon Kaen"],
    ["ชลบุรี", "Chon Buri"],
    ["สงขลา", "Songkhla"],
    ["นครราชสีมา", "Nakhon Ratchasima"],
  ];
  const products = ["วิตามินซี", "คอลลาเจน", "โปรตีน", "น้ำมันปลา", "โพรไบโอติก"];
  const admins = ["แอดมินเอ", "แอดมินบี", "แอดมินซี", "แอดมินดี"];
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
      const [p, geo] = pick(provinces);
      records.push({
        m: month,
        id: `DEMO-${month}-${String(i).padStart(4, "0")}`,
        c: pick(channels),
        p,
        geo,
        n: pick(products),
        v: 190 + Math.floor(rand() * 1400),
        t: date.toISOString(),
        a: pick(admins),
      });
    }
  });
  return records;
}

export interface Kpis {
  curMonth: string | null;
  curMonthLabel: string;
  isTotal: boolean;
  curCount: number;
  curValue: number;
  countDeltaPct: number | null;
  valueDeltaPct: number | null;
  avgPerMonth: number;
  nMonths: number;
  topChannel: string;
  topChannelSharePct: number;
}

// selectedMonth: "ทั้งหมด" or a specific "YYYY-MM". When a specific month is
// selected, the top two cards show that month's totals with a real MoM delta
// against the true calendar-previous month. When "ทั้งหมด" is selected, they
// show the sum across every month currently in `filtered` instead — deltas
// don't make sense for a multi-month sum, so they're omitted.
export function computeKpis(all: RawRecord[], filtered: RawRecord[], selectedMonth: string): Kpis {
  const allMonths = Array.from(new Set(all.map((r) => r.m))).sort();
  const isTotal = selectedMonth === "ทั้งหมด";

  let curMonth: string | null;
  let curMonthLabel: string;
  let curCount: number;
  let curValue: number;
  let countDeltaPct: number | null = null;
  let valueDeltaPct: number | null = null;

  if (isTotal) {
    curMonth = null;
    curMonthLabel = "รวมทั้งหมด";
    curCount = filtered.length;
    curValue = filtered.reduce((s, r) => s + (r.v ?? 0), 0);
  } else {
    curMonth = selectedMonth;
    curMonthLabel = MONTH_LABELS[selectedMonth] ?? selectedMonth;
    curCount = filtered.length;
    curValue = filtered.reduce((s, r) => s + (r.v ?? 0), 0);

    const idx = allMonths.indexOf(selectedMonth);
    const prevMonth = idx > 0 ? allMonths[idx - 1] : null;
    if (prevMonth) {
      const prevRecords = all.filter((r) => r.m === prevMonth);
      const prevCount = prevRecords.length;
      const prevValue = prevRecords.reduce((s, r) => s + (r.v ?? 0), 0);
      countDeltaPct = prevCount ? ((curCount - prevCount) / prevCount) * 100 : null;
      valueDeltaPct = prevValue ? ((curValue - prevValue) / prevValue) * 100 : null;
    }
  }

  const filteredMonths = new Set(filtered.map((r) => r.m));
  const nMonths = Math.max(filteredMonths.size, 1);
  const avgPerMonth = filtered.length / nMonths;

  const channelCounts = countBy(filtered, (r) => r.c ?? "ไม่ระบุ");
  const topEntry = channelCounts[0];
  const topChannel = topEntry ? topEntry[0] : "-";
  const topChannelSharePct = topEntry && filtered.length ? (topEntry[1] / filtered.length) * 100 : 0;

  return {
    curMonth,
    curMonthLabel,
    isTotal,
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

export function monthlyTrend(records: RawRecord[]): { month: string; label: string; count: number; value: number }[] {
  const stats = new Map<string, { count: number; value: number }>();
  for (const r of records) {
    const cur = stats.get(r.m) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += r.v ?? 0;
    stats.set(r.m, cur);
  }
  return Array.from(stats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { count, value }]) => ({ month, label: MONTH_LABELS[month] ?? month, count, value }));
}

export interface MonthlySummaryRow {
  month: string;
  label: string;
  count: number;
  value: number;
  countDeltaPct: number | null;
  valueDeltaPct: number | null;
}

// Always built from the full (unfiltered) dataset — a month-by-month summary
// table doesn't make sense scoped to a single selected month.
export function monthlySummary(all: RawRecord[]): MonthlySummaryRow[] {
  const months = Array.from(new Set(all.map((r) => r.m))).sort();
  let prevCount: number | null = null;
  let prevValue: number | null = null;
  return months.map((month) => {
    const rows = all.filter((r) => r.m === month);
    const count = rows.length;
    const value = rows.reduce((s, r) => s + (r.v ?? 0), 0);
    const countDeltaPct = prevCount ? ((count - prevCount) / prevCount) * 100 : null;
    const valueDeltaPct = prevValue ? ((value - prevValue) / prevValue) * 100 : null;
    prevCount = count;
    prevValue = value;
    return { month, label: MONTH_LABELS[month] ?? month, count, value, countDeltaPct, valueDeltaPct };
  });
}

export interface ChannelRow {
  name: string;
  count: number;
  value: number;
  sharePct: number;
}

export function channelBreakdown(records: RawRecord[]): ChannelRow[] {
  const map = new Map<string, { count: number; value: number }>();
  for (const r of records) {
    const key = r.c ?? "ไม่ระบุ";
    const cur = map.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += r.v ?? 0;
    map.set(key, cur);
  }
  const total = records.length || 1;
  return Array.from(map.entries())
    .map(([name, { count, value }]) => ({ name, count, value, sharePct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export interface ProductRow {
  name: string;
  count: number;
  value: number;
}

export function topProducts(records: RawRecord[], limit = 15): ProductRow[] {
  return topByDimension(records, "n", limit);
}

export type Dimension = "n" | "p" | "c";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  n: "สินค้า",
  p: "จังหวัด",
  c: "ช่องทางการขาย",
};

export function topByDimension(
  records: RawRecord[],
  dim: Dimension,
  limit = 8,
  sortDir: "desc" | "asc" = "desc"
): ProductRow[] {
  const map = new Map<string, { count: number; value: number }>();
  for (const r of records) {
    const key = (dim === "n" ? r.n : dim === "p" ? r.p : r.c) ?? "ไม่ระบุ";
    const cur = map.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += r.v ?? 0;
    map.set(key, cur);
  }
  const dir = sortDir === "desc" ? -1 : 1;
  return Array.from(map.entries())
    .map(([name, { count, value }]) => ({ name, count, value }))
    .sort((a, b) => dir * (a.count - b.count))
    .slice(0, limit);
}

export interface ProvinceRow {
  geo: string;
  name: string;
  count: number;
  value: number;
}

// Grouped by `geo` (the key that matches thailand-provinces.geojson), but
// labeled with the Thai display name — records with no geo match (garbled
// province text) are excluded, since they can't be placed on the map.
export function provinceBreakdown(records: RawRecord[]): ProvinceRow[] {
  const map = new Map<string, { name: string; count: number; value: number }>();
  for (const r of records) {
    if (!r.geo) continue;
    const cur = map.get(r.geo) ?? { name: r.p ?? r.geo, count: 0, value: 0 };
    cur.count += 1;
    cur.value += r.v ?? 0;
    map.set(r.geo, cur);
  }
  return Array.from(map.entries())
    .map(([geo, { name, count, value }]) => ({ geo, name, count, value }))
    .sort((a, b) => b.count - a.count);
}

// Pivoted monthly return-count trend, one column per channel — for
// comparing whether each sales channel's returns are trending up or down.
// Uses the full (unfiltered) record set so the trend always covers every
// month regardless of the sidebar's month filter. Limited to the top
// `limit` channels by total volume so the chart doesn't get cluttered with
// long-tail channels.
export function channelMonthlyTrend(
  all: RawRecord[],
  limit = 6
): { rows: Record<string, string | number>[]; channels: string[] } {
  const totalByChannel = countBy(all, (r) => r.c ?? "ไม่ระบุ");
  const channels = totalByChannel.slice(0, limit).map(([name]) => name);
  const channelSet = new Set(channels);

  const months = Array.from(new Set(all.map((r) => r.m))).sort();
  const counts = new Map<string, Map<string, number>>();
  for (const r of all) {
    const ch = r.c ?? "ไม่ระบุ";
    if (!channelSet.has(ch)) continue;
    const byChannel = counts.get(r.m) ?? new Map<string, number>();
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1);
    counts.set(r.m, byChannel);
  }

  const rows = months.map((m) => {
    const row: Record<string, string | number> = { month: m, label: MONTH_LABELS[m] ?? m };
    const byChannel = counts.get(m);
    for (const ch of channels) row[ch] = byChannel?.get(ch) ?? 0;
    return row;
  });

  return { rows, channels };
}
