"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import { RawRecord, MONTH_LABELS, COLORS, OrderTotals } from "@/lib/types";
import {
  demoData,
  computeKpis,
  countBy,
  monthlyTrend,
  monthlySummary,
  channelBreakdown,
  topByDimension,
  provinceBreakdown,
  pickTotals,
  computeRateCards,
  rateRanking,
  monthlyRateTrend,
  channelMonthlyTrend,
  DIMENSION_LABELS,
  Dimension,
} from "@/lib/aggregate";
import { ThailandMap } from "@/components/ThailandMap";
import { InsightTab } from "@/components/InsightTab";

const MENU_ITEMS = ["ภาพรวม", "รายเดือน", "ช่องทางขาย", "สินค้า", "COD & ต้นทุน", "Insight"];
const DONUT_PALETTE = [COLORS.teal, COLORS.blue, COLORS.orange, COLORS.red, COLORS.purple, COLORS.cyan];

type TrendMetric = "rate" | "count" | "value";
const TREND_METRIC_OPTIONS: Record<
  TrendMetric,
  { label: string; dataKey: TrendMetric; color: string; format: (v: number) => string }
> = {
  rate: { label: "% ตีกลับ", dataKey: "rate", color: COLORS.red, format: (v) => `${v.toFixed(2)}%` },
  count: { label: "ยอดตีกลับ", dataKey: "count", color: COLORS.teal, format: (v) => `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })} รายการ` },
  value: { label: "มูลค่าตีกลับ", dataKey: "value", color: COLORS.blue, format: (v) => "฿" + v.toLocaleString("en-US", { maximumFractionDigits: 0 }) },
};
const TOOLTIP_STYLE = {
  contentStyle: { background: "#121a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#e5e7eb" },
};

function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatBaht(n: number) {
  return "฿" + formatNumber(n);
}

function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function DeltaPill({ pct, badWhenUp, note }: { pct: number | null; badWhenUp: boolean; note: string }) {
  if (pct === null) {
    return <span className="kpi-delta">ไม่มีข้อมูลเดือนก่อนหน้า</span>;
  }
  const isUp = pct >= 0;
  const isBad = badWhenUp ? isUp : !isUp;
  const arrowColor = isBad ? "#fb7185" : "#4ade80";
  return (
    <span className="kpi-delta">
      <span className="font-bold" style={{ color: arrowColor }}>
        {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
      </span>
      &nbsp;{note}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
  sub: React.ReactNode;
  onClick?: () => void;
}) {
  const sizeClass = value.length > 11 ? "text-[1.3rem]" : value.length > 7 ? "text-[1.65rem]" : "text-[2.35rem]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`kpi-card text-left ${onClick ? "cursor-pointer" : "cursor-default"}`}
      style={{
        borderColor: `${accent}55`,
        boxShadow: `0 0 0 1px ${accent}22, 0 16px 32px -18px ${accent}77, inset 0 0 40px -28px ${accent}aa`,
      }}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="text-[0.76rem] font-medium uppercase tracking-wide text-white/55">{label}</div>
        <div className="kpi-icon" style={{ background: `${accent}22`, color: accent, boxShadow: `0 0 14px -2px ${accent}aa` }}>
          {icon}
        </div>
      </div>
      <div
        className={`relative z-10 font-bold whitespace-nowrap overflow-hidden text-white ${sizeClass}`}
        style={{ textShadow: `0 0 20px ${accent}66` }}
      >
        {value}
      </div>
      <div className="relative z-10">{sub}</div>
      {onClick && <div className="relative z-10 text-[0.68rem] text-white/35 mt-1">คลิกดูรายละเอียด →</div>}
    </button>
  );
}

export default function Home() {
  const [allRecords, setAllRecords] = useState<RawRecord[] | null>(null);
  const [orderTotals, setOrderTotals] = useState<OrderTotals | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("ทั้งหมด");
  const [activeMenu, setActiveMenu] = useState<string>(MENU_ITEMS[0]);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("rate");
  const [compareDim, setCompareDim] = useState<Dimension>("n");
  const [mapChannel, setMapChannel] = useState<string>("ทั้งหมด");
  const [mapSort, setMapSort] = useState<"มากสุด" | "น้อยสุด">("มากสุด");
  const [kpiModal, setKpiModal] = useState<"count" | "value" | "avg" | "channel" | null>(null);
  const [provinceModalGeo, setProvinceModalGeo] = useState<string | null>(null);
  const [productModalName, setProductModalName] = useState<string | null>(null);
  const [channelTabSelected, setChannelTabSelected] = useState<string>("ทั้งหมด");
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [productSortDir, setProductSortDir] = useState<"desc" | "asc">("desc");
  const [adminSortDir, setAdminSortDir] = useState<"desc" | "asc">("desc");
  const [skuSortDir, setSkuSortDir] = useState<"desc" | "asc">("desc");
  const { data: session } = useSession();
  const [visitStats, setVisitStats] = useState<{
    monthly: { label: string; count: number }[];
    quarterly: { label: string; count: number }[];
    yearly: { label: string; count: number }[];
    total: number;
    configured: boolean;
  } | null>(null);

  // Log this visit once per page load, then load the aggregated stats for
  // the "สถิติเข้าใช้งาน" tab.
  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/" }),
    }).catch(() => {});
    fetch("/api/visit-stats")
      .then((r) => r.json())
      .then(setVisitStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/data/records.json")
      .then((r) => {
        if (!r.ok) throw new Error("no data file");
        return r.json();
      })
      .then((data: RawRecord[]) => {
        if (!Array.isArray(data) || data.length === 0) throw new Error("empty");
        setAllRecords(data);
        setIsDemo(false);
      })
      .catch(() => {
        setAllRecords(demoData());
        setIsDemo(true);
      })
      .finally(() => setUpdatedAt(new Date().toLocaleString("th-TH")));

    fetch("/data/order_totals.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrderTotals | null) => setOrderTotals(data))
      .catch(() => setOrderTotals(null));
  }, []);

  const allMonths = useMemo(
    () => (allRecords ? Array.from(new Set(allRecords.map((r) => r.m))).sort() : []),
    [allRecords]
  );

  const filtered = useMemo(() => {
    if (!allRecords) return [];
    return selectedMonth === "ทั้งหมด" ? allRecords : allRecords.filter((r) => r.m === selectedMonth);
  }, [allRecords, selectedMonth]);

  const kpis = useMemo(
    () => (allRecords ? computeKpis(allRecords, filtered, selectedMonth) : null),
    [allRecords, filtered, selectedMonth]
  );
  // When a single month is selected, show every month up to and including
  // it so the trend line still has context instead of a single point.
  const trendRecords = useMemo(() => {
    if (selectedMonth === "ทั้งหมด" || !allRecords) return filtered;
    const idx = allMonths.indexOf(selectedMonth);
    const windowMonths = new Set(allMonths.slice(0, idx + 1));
    return allRecords.filter((r) => windowMonths.has(r.m));
  }, [filtered, allRecords, allMonths, selectedMonth]);
  const trend = useMemo(() => monthlyTrend(trendRecords), [trendRecords]);
  // % ตีกลับ per month comes from order_totals.json (all-orders denominator),
  // not from records.json (returns only) — merge it in by month key so the
  // overview trend chart can offer rate/count/value on the same panel.
  const rateByMonth = useMemo(() => {
    if (!orderTotals) return new Map<string, number>();
    return new Map(monthlyRateTrend(orderTotals.byMonth).map((r) => [r.month, r.returnRatePct]));
  }, [orderTotals]);
  const trendWithRate = useMemo(
    () => trend.map((t) => ({ ...t, rate: rateByMonth.get(t.month) ?? null })),
    [trend, rateByMonth]
  );
  const channelCounts = useMemo(() => countBy(filtered, (r) => r.c ?? "ไม่ระบุ").slice(0, 4), [filtered]);
  const totalForShare = channelCounts.reduce((s, [, v]) => s + v, 0) || 1;

  const monthlyRows = useMemo(() => (allRecords ? monthlySummary(allRecords) : []), [allRecords]);
  const allChannels = useMemo(() => channelBreakdown(filtered), [filtered]);
  const channelComparisonTrend = useMemo(() => (allRecords ? channelMonthlyTrend(allRecords) : { rows: [], channels: [] }), [allRecords]);
  const channelTabRecords = useMemo(
    () => (channelTabSelected === "ทั้งหมด" ? filtered : filtered.filter((r) => r.c === channelTabSelected)),
    [filtered, channelTabSelected]
  );
  const channelTabTrend = useMemo(
    () => (allRecords && channelTabSelected !== "ทั้งหมด" ? monthlyTrend(allRecords.filter((r) => r.c === channelTabSelected)) : []),
    [allRecords, channelTabSelected]
  );
  const channelTabProducts = useMemo(() => topByDimension(channelTabRecords, "n", 8), [channelTabRecords]);
  const channelTabProvinces = useMemo(() => provinceBreakdown(channelTabRecords).slice(0, 8), [channelTabRecords]);

  const mapChannels = useMemo(
    () => (allRecords ? Array.from(new Set(allRecords.map((r) => r.c).filter((c): c is string => !!c))).sort() : []),
    [allRecords]
  );
  const mapRecords = useMemo(
    () => (mapChannel === "ทั้งหมด" ? filtered : filtered.filter((r) => r.c === mapChannel)),
    [filtered, mapChannel]
  );
  const provinceRows = useMemo(() => {
    const rows = provinceBreakdown(mapRecords);
    return mapSort === "มากสุด" ? rows : [...rows].reverse();
  }, [mapRecords, mapSort]);
  const provinceModalRecords = useMemo(
    () => (provinceModalGeo ? mapRecords.filter((r) => r.geo === provinceModalGeo) : []),
    [mapRecords, provinceModalGeo]
  );
  const provinceModalProducts = useMemo(() => topByDimension(provinceModalRecords, "n", 10), [provinceModalRecords]);
  const provinceModalChannels = useMemo(() => channelBreakdown(provinceModalRecords), [provinceModalRecords]);
  const provinceModalTotalValue = useMemo(() => provinceModalRecords.reduce((s, r) => s + (r.v ?? 0), 0), [provinceModalRecords]);
  const provinceModalName = useMemo(
    () => provinceRows.find((r) => r.geo === provinceModalGeo)?.name ?? provinceModalGeo ?? "",
    [provinceRows, provinceModalGeo]
  );
  const compareRows = useMemo(() => topByDimension(filtered, compareDim, 15), [filtered, compareDim]);
  const compareAllRows = useMemo(() => topByDimension(filtered, compareDim, Infinity), [filtered, compareDim]);
  const productsAll = useMemo(() => topByDimension(filtered, "n", Infinity, productSortDir), [filtered, productSortDir]);
  const productsTop = useMemo(() => productsAll.slice(0, 15), [productsAll]);

  const productModalRecords = useMemo(
    () => (productModalName ? filtered.filter((r) => r.n === productModalName) : []),
    [filtered, productModalName]
  );
  const productModalChannels = useMemo(() => channelBreakdown(productModalRecords), [productModalRecords]);
  const productModalProvinces = useMemo(() => provinceBreakdown(productModalRecords).slice(0, 8), [productModalRecords]);
  const productModalAdmins = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const r of productModalRecords) {
      const key = r.a ?? "ไม่ระบุ";
      const cur = map.get(key) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += r.v ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, { count, value }]) => ({ name, count, value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [productModalRecords]);
  const productModalTotalValue = useMemo(() => productModalRecords.reduce((s, r) => s + (r.v ?? 0), 0), [productModalRecords]);

  const rateCards = useMemo(
    () => (orderTotals ? computeRateCards(pickTotals(orderTotals, selectedMonth)) : null),
    [orderTotals, selectedMonth]
  );
  const courierRanking = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.byCourier, 200, 10) : []),
    [orderTotals]
  );
  const adminRanking = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.byAdmin, 300, 10, adminSortDir) : []),
    [orderTotals, adminSortDir]
  );
  const skuRanking = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.bySku, 100, 10, skuSortDir) : []),
    [orderTotals, skuSortDir]
  );
  const rateTrend = useMemo(() => (orderTotals ? monthlyRateTrend(orderTotals.byMonth) : []), [orderTotals]);

  if (!allRecords || !kpis) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">กำลังโหลดข้อมูล...</div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-[280px] flex-shrink-0 p-6 text-white flex flex-col border-r border-white/5"
        style={{ background: "linear-gradient(180deg, #101729 0%, #0d1424 55%, #0a0f1e 100%)" }}
      >
        <div className="flex items-center gap-3 pb-5">
          <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center p-1 shadow-lg flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="PT Glory" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-[1.05rem]">PT Glory</div>
            <div className="text-xs text-[#cbb8ee]">Returns Dashboard 2569</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => {
            const active = item === activeMenu;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setActiveMenu(item)}
                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 text-left cursor-pointer transition-colors hover:bg-white/10 ${
                  active ? "bg-white/10" : ""
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "" : "border border-white/60"}`}
                  style={active ? { background: COLORS.teal, boxShadow: `0 0 8px ${COLORS.teal}` } : {}}
                />
                {item}
              </button>
            );
          })}
        </nav>
        <hr className="my-5 border-white/15" />
        <div className="text-sm mb-2 opacity-90">เลือกเดือน</div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full rounded-lg bg-white/10 border border-white/25 px-3 py-2 text-sm text-white [&>option]:text-black"
        >
          <option value="ทั้งหมด">ทั้งหมด</option>
          {allMonths.map((m) => (
            <option key={m} value={m}>
              {MONTH_LABELS[m] ?? m}
            </option>
          ))}
        </select>

        <div className="mt-auto pt-4 flex flex-col gap-4">
          {visitStats?.configured && (
            <div className="rounded-xl bg-white/8 border border-white/15 px-4 py-3">
              <div className="text-[0.7rem] font-medium text-white/60 uppercase tracking-wide mb-2.5">
                สถิติเข้าใช้งาน
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "เดือนนี้", value: visitStats.monthly.at(-1)?.count ?? 0 },
                  { label: "ไตรมาสนี้", value: visitStats.quarterly.at(-1)?.count ?? 0 },
                  { label: "ปีนี้", value: visitStats.yearly.at(-1)?.count ?? 0 },
                ].map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <div className="text-sm font-bold" style={{ color: COLORS.teal }}>
                      {formatNumber(row.value)}
                    </div>
                    <div className="text-[0.65rem] text-white/55 leading-tight">{row.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session?.user?.email && (
            <div className="pt-3 border-t border-white/15">
              <div className="text-xs text-white/60 truncate">เข้าสู่ระบบ: {session.user.email}</div>
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-2 text-xs text-white/80 hover:text-white underline"
              >
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 self-start p-8 max-w-[1400px]">
        {isDemo && (
          <div className="mb-5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm px-4 py-3">
            ⚠️ ยังไม่พบไฟล์ข้อมูล (<code>web/public/data/records.json</code>) — แสดงผลด้วย
            <b> ข้อมูลตัวอย่าง (demo)</b> เพื่อพรีวิว UI เท่านั้น รัน{" "}
            <code>pipeline/aggregate_for_web.py</code> แล้ว deploy ใหม่เพื่อดูข้อมูลจริง
          </div>
        )}

        {/* Hero */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-[68px] h-[68px] rounded-[18px] bg-white p-2 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: "0 10px 22px -8px rgba(157,23,140,0.4)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.png" alt="PT Glory" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-[1.5rem] font-medium leading-[1.15] m-0 text-white">
                Dashboard สินค้าตีกลับ ปี 2569
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[0.85rem] text-white/50">
                <span>🕐 อัปเดตล่าสุด: {updatedAt}</span>
              </div>
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 text-[0.76rem] font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap ${
              isDemo ? "bg-amber-500/15 text-amber-300" : "bg-green-500/15 text-green-300"
            }`}
          >
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: "currentColor" }} />
            {isDemo ? "ข้อมูลตัวอย่าง (Demo)" : "ข้อมูลจริง"}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-5">
          <KpiCard
            label={`% ตีกลับ · ${kpis.curMonthLabel}`}
            value={rateCards ? formatPct(rateCards.returnRateUnits) : "-"}
            icon="⚠️"
            accent={COLORS.red}
            onClick={() => setActiveMenu("COD & ต้นทุน")}
            sub={
              rateCards ? (
                <span className="kpi-delta">{formatPct(rateCards.returnRateValue)} ตามมูลค่า</span>
              ) : (
                <span className="kpi-delta">กำลังโหลดข้อมูล...</span>
              )
            }
          />
          <KpiCard
            label={`ยอดตีกลับ · ${kpis.curMonthLabel}`}
            value={formatNumber(kpis.curCount)}
            icon="📦"
            accent={COLORS.teal}
            onClick={() => setKpiModal("count")}
            sub={
              kpis.isTotal ? (
                <span className="kpi-delta">รวม {kpis.nMonths} เดือนที่เลือก</span>
              ) : (
                <DeltaPill pct={kpis.countDeltaPct} badWhenUp note="จากเดือนก่อน" />
              )
            }
          />
          <KpiCard
            label={`มูลค่าตีกลับ · ${kpis.curMonthLabel}`}
            value={formatBaht(kpis.curValue)}
            icon="💰"
            accent={COLORS.blue}
            onClick={() => setKpiModal("value")}
            sub={
              kpis.isTotal ? (
                <span className="kpi-delta">รวม {kpis.nMonths} เดือนที่เลือก</span>
              ) : (
                <DeltaPill pct={kpis.valueDeltaPct} badWhenUp note="จากเดือนก่อน" />
              )
            }
          />
          <KpiCard
            label="เฉลี่ยต่อเดือน"
            value={formatNumber(Math.round(kpis.avgPerMonth))}
            icon="📊"
            accent={COLORS.orange}
            onClick={() => setKpiModal("avg")}
            sub={<span className="kpi-delta">รายการ/เดือน จาก {kpis.nMonths} เดือนที่เลือก</span>}
          />
          <KpiCard
            label="ช่องทางตีกลับสูงสุด"
            value={kpis.topChannel}
            icon="🎯"
            accent={COLORS.red}
            onClick={() => setKpiModal("channel")}
            sub={<span className="kpi-delta">{kpis.topChannelSharePct.toFixed(0)}% ของยอดตีกลับทั้งหมด</span>}
          />
        </div>

        {/* Overview tab */}
        {activeMenu === "ภาพรวม" && (
        <>
        <div className="grid grid-cols-3 gap-5 mt-5">
          <div className="col-span-2 panel">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-semibold text-[1rem] m-0">แนวโน้ม{TREND_METRIC_OPTIONS[trendMetric].label}รายเดือน</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
                  {selectedMonth === "ทั้งหมด"
                    ? `${TREND_METRIC_OPTIONS[trendMetric].label}ต่อเดือน`
                    : `ทุกเดือนที่มีข้อมูล จนถึง ${MONTH_LABELS[selectedMonth] ?? selectedMonth}`}
                </p>
              </div>
              <select
                value={trendMetric}
                onChange={(e) => setTrendMetric(e.target.value as TrendMetric)}
                className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0 [&>option]:bg-white [&>option]:text-black"
              >
                {(Object.keys(TREND_METRIC_OPTIONS) as TrendMetric[]).map((m) => (
                  <option key={m} value={m}>
                    {TREND_METRIC_OPTIONS[m].label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={trendWithRate}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TREND_METRIC_OPTIONS[trendMetric].color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={TREND_METRIC_OPTIONS[trendMetric].color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [TREND_METRIC_OPTIONS[trendMetric].format(Number(v)), ""]} {...TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey={TREND_METRIC_OPTIONS[trendMetric].dataKey}
                    stroke={TREND_METRIC_OPTIONS[trendMetric].color}
                    strokeWidth={3}
                    fill="url(#trendFill)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <h4 className="font-semibold text-[1rem] m-0">สัดส่วนช่องทางตีกลับ</h4>
            <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 4 ช่องทางขาย</p>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={channelCounts.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%">
                    {channelCounts.map((_, i) => (
                      <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-1">
              {channelCounts.map(([name, value], i) => {
                const pct = (value / totalForShare) * 100;
                const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
                return (
                  <div key={name} className="text-[0.8rem]">
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        {name}
                      </span>
                      <b>{pct.toFixed(0)}%</b>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px -1px ${color}aa` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity + table */}
        <div className="grid grid-cols-3 gap-5 mt-5">
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-[1rem] m-0">เปรียบเทียบยอดตีกลับ</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
                  Top {compareRows.length} เรียงตามยอดตีกลับ (มูลค่าต่อรายการแสดงท้ายแท่ง)
                </p>
              </div>
              <select
                value={compareDim}
                onChange={(e) => setCompareDim(e.target.value as Dimension)}
                className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0 [&>option]:bg-white [&>option]:text-black"
              >
                {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((d) => (
                  <option key={d} value={d}>
                    {DIMENSION_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="text-[0.7rem] text-white/50 hover:text-white underline mb-1"
            >
              ดูรายการทั้งหมด ({DIMENSION_LABELS[compareDim]}) →
            </button>
            <div style={{ width: "100%", height: 420 }}>
              <ResponsiveContainer>
                <BarChart data={compareRows} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v, key) =>
                      key === "count" ? [`${formatNumber(Number(v))} รายการ`, "ยอดตีกลับ"] : [formatBaht(Number(v)), "มูลค่า"]
                    }
                    {...TOOLTIP_STYLE}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {compareRows.map((_, i) => (
                      <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v) => formatBaht(Number(v))}
                      style={{ fontSize: 10, fill: "#8a8fa3" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-span-2 panel">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-semibold text-[1rem] m-0">ยอดสินค้าตีกลับตามจังหวัด</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">สีเข้ม = ยอดตีกลับสูง · ชี้ค้างที่แผนที่เพื่อดูรายละเอียด</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <select
                  value={mapChannel}
                  onChange={(e) => setMapChannel(e.target.value)}
                  className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 [&>option]:bg-white [&>option]:text-black"
                >
                  <option value="ทั้งหมด">ทุกช่องทาง</option>
                  {mapChannels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={mapSort}
                  onChange={(e) => setMapSort(e.target.value as "มากสุด" | "น้อยสุด")}
                  className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 [&>option]:bg-white [&>option]:text-black"
                >
                  <option value="มากสุด">เรียงมากสุด</option>
                  <option value="น้อยสุด">เรียงน้อยสุด</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-1">
              <div className="flex-1 flex justify-start min-w-0">
                <ThailandMap data={provinceRows} onSelectProvince={setProvinceModalGeo} />
              </div>
              <div className="w-[260px] flex-shrink-0 overflow-y-auto pr-1" style={{ maxHeight: 480 }}>
                {provinceRows.map((row, i) => (
                  <button
                    type="button"
                    key={row.geo}
                    onClick={() => setProvinceModalGeo(row.geo)}
                    className="w-full flex items-center justify-between gap-2 text-[0.8rem] py-1.5 border-b border-white/5 last:border-0 text-left hover:bg-white/5 rounded px-1 -mx-1"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-white/35 w-5 flex-shrink-0">{i + 1}</span>
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="font-semibold flex-shrink-0 text-right">{formatNumber(row.count)}</span>
                  </button>
                ))}
                {provinceRows.length === 0 && <p className="text-xs text-white/35 mt-4">ไม่มีข้อมูล</p>}
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Monthly tab */}
        {activeMenu === "รายเดือน" && selectedMonth === "ทั้งหมด" && (
          <div className="panel mt-5">
            <h4 className="font-semibold text-[1rem] m-0">สรุปยอด/มูลค่าตีกลับรายเดือน</h4>
            <p className="text-[0.78rem] text-white/50 mt-0.5 mb-3">เปรียบเทียบทุกเดือนที่มีข้อมูล เทียบกับเดือนก่อนหน้า</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">เดือน</th>
                    <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ (รายการ)</th>
                    <th className="py-2 pr-3 font-medium text-right">% เทียบเดือนก่อน</th>
                    <th className="py-2 pr-3 font-medium text-right">มูลค่าตีกลับ (บาท)</th>
                    <th className="py-2 font-medium text-right">% เทียบเดือนก่อน</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.month} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-3 font-medium">{row.label}</td>
                      <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                      <td className={`py-2 pr-3 text-right ${row.countDeltaPct == null ? "text-white/35" : row.countDeltaPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                        {row.countDeltaPct == null ? "-" : `${row.countDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(row.countDeltaPct).toFixed(1)}%`}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatBaht(row.value)}</td>
                      <td className={`py-2 text-right ${row.valueDeltaPct == null ? "text-white/35" : row.valueDeltaPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                        {row.valueDeltaPct == null ? "-" : `${row.valueDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(row.valueDeltaPct).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-[1rem] m-0">% เปลี่ยนแปลงยอดตีกลับ เทียบเดือนก่อน</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">สีแดง = เพิ่มขึ้น (แย่ลง) · สีเขียว = ลดลง (ดีขึ้น)</p>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={monthlyRows.filter((r) => r.countDeltaPct != null)} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "% เทียบเดือนก่อน"]} {...TOOLTIP_STYLE} />
                    <Bar dataKey="countDeltaPct" radius={[6, 6, 0, 0]}>
                      {monthlyRows
                        .filter((r) => r.countDeltaPct != null)
                        .map((r, i) => (
                          <Cell key={i} fill={(r.countDeltaPct ?? 0) >= 0 ? COLORS.red : COLORS.teal} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeMenu === "รายเดือน" && selectedMonth !== "ทั้งหมด" && (
          <div className="grid grid-cols-3 gap-5 mt-5">
            <div className="panel">
              <h4 className="font-semibold text-[1rem] m-0">สรุปเดือน {MONTH_LABELS[selectedMonth] ?? selectedMonth}</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-3">เทียบกับเดือนก่อนหน้า</p>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-[0.78rem] text-white/50">ยอดตีกลับ</div>
                  <div className="text-[1.6rem] font-bold" style={{ color: COLORS.teal }}>{formatNumber(kpis.curCount)}</div>
                  <DeltaPill pct={kpis.countDeltaPct} badWhenUp note="จากเดือนก่อน" />
                </div>
                <div>
                  <div className="text-[0.78rem] text-white/50">มูลค่าตีกลับ</div>
                  <div className="text-[1.6rem] font-bold" style={{ color: COLORS.blue }}>{formatBaht(kpis.curValue)}</div>
                  <DeltaPill pct={kpis.valueDeltaPct} badWhenUp note="จากเดือนก่อน" />
                </div>
              </div>
            </div>
            <div className="col-span-2 panel">
              <h4 className="font-semibold text-[1rem] m-0">แยกตามช่องทาง — {MONTH_LABELS[selectedMonth] ?? selectedMonth}</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">เรียงจากยอดตีกลับมากไปน้อย</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="py-2 pr-3 font-medium">ช่องทาง</th>
                      <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                      <th className="py-2 pr-3 font-medium text-right">สัดส่วน</th>
                      <th className="py-2 font-medium text-right">มูลค่า (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allChannels.map((row, i) => (
                      <tr key={row.name} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                          {row.name}
                        </td>
                        <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                        <td className="py-2 pr-3 text-right">{row.sharePct.toFixed(1)}%</td>
                        <td className="py-2 text-right">{formatBaht(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-span-3 panel">
              <h4 className="font-semibold text-[1rem] m-0">สินค้าที่ตีกลับมากสุด — {MONTH_LABELS[selectedMonth] ?? selectedMonth}</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 10 สินค้าของเดือนนี้</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="py-2 pr-3 font-medium w-10">#</th>
                      <th className="py-2 pr-3 font-medium">สินค้า</th>
                      <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                      <th className="py-2 font-medium text-right">มูลค่า (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsTop.slice(0, 10).map((row, i) => (
                      <tr key={row.name} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-3 text-white/35">{i + 1}</td>
                        <td className="py-2 pr-3">{row.name}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                        <td className="py-2 text-right">{formatBaht(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Channel tab */}
        {activeMenu === "ช่องทางขาย" && (
          <>
          <div className="panel mt-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h4 className="font-semibold text-[1rem] m-0">เลือกช่องทางเพื่อดูรายละเอียดเจาะจง</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5">เลือก &quot;ทั้งหมด&quot; เพื่อดูภาพรวมและกราฟเปรียบเทียบทุกช่องทาง</p>
              </div>
              <select
                value={channelTabSelected}
                onChange={(e) => setChannelTabSelected(e.target.value)}
                className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0 [&>option]:bg-white [&>option]:text-black"
              >
                <option value="ทั้งหมด">ทุกช่องทาง</option>
                {mapChannels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel mt-5">
            <h4 className="font-semibold text-[1rem] m-0">เปรียบเทียบแนวโน้มยอดตีกลับรายช่องทาง</h4>
            <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
              จำนวนยอดตีกลับต่อเดือน แยกตามช่องทาง (Top {channelComparisonTrend.channels.length} ช่องทางตามปริมาณ) — ดูได้ว่าช่องทางไหนดีขึ้นหรือแย่ลง
            </p>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={channelComparisonTrend.rows} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  {channelComparisonTrend.channels.map((ch, i) => (
                    <Line
                      key={ch}
                      type="monotone"
                      dataKey={ch}
                      stroke={DONUT_PALETTE[i % DONUT_PALETTE.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name={ch}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {channelComparisonTrend.channels.map((ch, i) => (
                <span key={ch} className="flex items-center gap-1.5 text-[0.75rem] text-white/60">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                  {ch}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5 mt-5">
            <div className="panel">
              <h4 className="font-semibold text-[1rem] m-0">สัดส่วนช่องทางตีกลับ</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
                ทุกช่องทาง ({selectedMonth === "ทั้งหมด" ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth})
              </p>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={allChannels} dataKey="count" nameKey="name" innerRadius="60%" outerRadius="95%">
                      {allChannels.map((_, i) => (
                        <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${formatNumber(Number(v))} รายการ`, String(name)]} {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {allChannels.map((row, i) => {
                  const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
                  return (
                    <div key={row.name} className="text-[0.78rem]">
                      <div className="flex justify-between mb-1">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                          {row.name}
                        </span>
                        <span>
                          <b>{row.sharePct.toFixed(1)}%</b>
                          <span className="text-white/40 ml-1.5">{formatNumber(row.count)} รายการ</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.sharePct}%`, background: color, boxShadow: `0 0 8px -1px ${color}aa` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2 panel">
              <h4 className="font-semibold text-[1rem] m-0">ยอด/มูลค่าตีกลับแยกตามช่องทาง</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">เรียงจากยอดตีกลับมากไปน้อย</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="py-2 pr-3 font-medium">ช่องทาง</th>
                      <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                      <th className="py-2 pr-3 font-medium text-right">สัดส่วน</th>
                      <th className="py-2 font-medium text-right">มูลค่า (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allChannels.map((row, i) => (
                      <tr
                        key={row.name}
                        onClick={() => setChannelTabSelected(row.name)}
                        className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5"
                      >
                        <td className="py-2 pr-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                          {row.name}
                        </td>
                        <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                        <td className="py-2 pr-3 text-right">{row.sharePct.toFixed(1)}%</td>
                        <td className="py-2 text-right">{formatBaht(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {channelTabSelected !== "ทั้งหมด" && (
            <div className="grid grid-cols-3 gap-5 mt-5">
              <div className="col-span-2 panel">
                <h4 className="font-semibold text-[1rem] m-0">แนวโน้มยอดตีกลับ — {channelTabSelected}</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">ทุกเดือนที่มีข้อมูล</p>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={channelTabTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${formatNumber(Number(v))} รายการ`, ""]} {...TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="count" stroke={COLORS.cyan} strokeWidth={3} fill={COLORS.cyan} fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="panel">
                <h4 className="font-semibold text-[1rem] m-0">สรุป — {channelTabSelected}</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
                  {selectedMonth === "ทั้งหมด" ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth}
                </p>
                <div className="text-[1.6rem] font-bold" style={{ color: COLORS.teal }}>{formatNumber(channelTabRecords.length)} รายการ</div>
                <div className="text-[0.85rem] text-white/60 mt-1">
                  มูลค่ารวม {formatBaht(channelTabRecords.reduce((s, r) => s + (r.v ?? 0), 0))}
                </div>
              </div>
              <div className="panel">
                <h4 className="font-semibold text-[1rem] m-0">สินค้าตีกลับสูงสุด</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 8 — {channelTabSelected}</p>
                <div className="flex flex-col gap-1.5">
                  {channelTabProducts.map((row, i) => (
                    <div key={row.name} className="flex justify-between text-[0.8rem]">
                      <span className="text-white/70 truncate">{i + 1}. {row.name}</span>
                      <b className="flex-shrink-0 ml-2">{formatNumber(row.count)}</b>
                    </div>
                  ))}
                  {channelTabProducts.length === 0 && <p className="text-xs text-white/35">ไม่มีข้อมูล</p>}
                </div>
              </div>
              <div className="col-span-2 panel">
                <h4 className="font-semibold text-[1rem] m-0">จังหวัดตีกลับสูงสุด</h4>
                <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 8 — {channelTabSelected}</p>
                <div className="flex flex-col gap-1.5">
                  {channelTabProvinces.map((row, i) => (
                    <div key={row.geo} className="flex justify-between text-[0.8rem]">
                      <span className="text-white/70 truncate">{i + 1}. {row.name}</span>
                      <b className="flex-shrink-0 ml-2">{formatNumber(row.count)} · {formatBaht(row.value)}</b>
                    </div>
                  ))}
                  {channelTabProvinces.length === 0 && <p className="text-xs text-white/35">ไม่มีข้อมูล</p>}
                </div>
              </div>
            </div>
          )}
          </>
        )}

        {/* Product tab */}
        {activeMenu === "สินค้า" && (
          <div className="grid grid-cols-3 gap-5 mt-5">
            <div className="panel">
              <h4 className="font-semibold text-[1rem] m-0">Top 15 สินค้าที่ถูกตีกลับ</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
                เรียง{productSortDir === "desc" ? "มากไปน้อย" : "น้อยไปมาก"}
              </p>
              <div style={{ width: "100%", height: 460 }}>
                <ResponsiveContainer>
                  <BarChart data={productsTop} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v, key) =>
                        key === "count" ? [`${formatNumber(Number(v))} รายการ`, "ยอดตีกลับ"] : [formatBaht(Number(v)), "มูลค่า"]
                      }
                      {...TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {productsTop.map((_, i) => (
                        <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                      ))}
                      <LabelList dataKey="value" position="right" formatter={(v) => formatBaht(Number(v))} style={{ fontSize: 9, fill: "#8a8fa3" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-span-2 panel">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="font-semibold text-[1rem] m-0">รายการสินค้าทั้งหมด</h4>
                  <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">ทั้งหมด {productsAll.length} รายการ · คลิกแถวเพื่อดูรายละเอียด</p>
                </div>
                <select
                  value={productSortDir}
                  onChange={(e) => setProductSortDir(e.target.value as "desc" | "asc")}
                  className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0 [&>option]:bg-white [&>option]:text-black"
                >
                  <option value="desc">ยอดตีกลับ: มากไปน้อย</option>
                  <option value="asc">ยอดตีกลับ: น้อยไปมาก</option>
                </select>
              </div>
              <div className="overflow-y-auto overflow-x-auto pr-2" style={{ maxHeight: 460 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="py-2 pr-3 font-medium w-10">#</th>
                      <th className="py-2 pr-3 font-medium">สินค้า</th>
                      <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                      <th className="py-2 pr-3 font-medium text-right">มูลค่า (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsAll.map((row, i) => (
                      <tr
                        key={row.name}
                        onClick={() => setProductModalName(row.name)}
                        className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5"
                      >
                        <td className="py-2 pr-3 text-white/35">{i + 1}</td>
                        <td className="py-2 pr-3">{row.name}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                        <td className="py-2 pr-3 text-right">{formatBaht(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COD & Cost tab */}
        {activeMenu === "COD & ต้นทุน" && (
          <>
            {!orderTotals ? (
              <div className="panel mt-5 text-sm text-white/50">กำลังโหลดข้อมูล...</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-5 mt-5">
                  <div className="panel">
                    <div className="text-[0.78rem] text-white/50">Return Rate (อัตราตีกลับ)</div>
                    <div className="text-[1.7rem] font-bold mt-1" style={{ color: COLORS.teal }}>
                      {formatPct(rateCards!.returnRateUnits)}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      ตามจำนวนออเดอร์ · {formatPct(rateCards!.returnRateValue)} ตามมูลค่า
                    </div>
                  </div>
                  <div className="panel">
                    <div className="text-[0.78rem] text-white/50">COD Rejection Rate</div>
                    <div className="text-[1.7rem] font-bold mt-1" style={{ color: COLORS.red }}>
                      {formatPct(rateCards!.codRejectionRate)}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      จากออเดอร์เก็บเงินปลายทาง {formatNumber(rateCards!.codOrders)} รายการ
                    </div>
                  </div>
                  <div className="panel">
                    <div className="text-[0.78rem] text-white/50">Financial Loss (มูลค่าสินค้าที่ตีกลับ)</div>
                    <div className="text-[1.7rem] font-bold mt-1" style={{ color: COLORS.purple }}>
                      {formatBaht(rateCards!.financialLoss)}
                    </div>
                    <div className="text-xs text-white/50 mt-1">เฉพาะมูลค่าสินค้า ยังไม่รวมค่าขนส่ง/โฆษณาที่เสียเปล่า</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 mt-5">
                  <div className="panel">
                    <h4 className="font-semibold text-[1rem] m-0">แนวโน้มอัตราตีกลับรายเดือน</h4>
                    <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">% ตีกลับ เทียบยอดสั่งซื้อทั้งหมดในเดือนนั้น</p>
                    <div style={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer>
                        <LineChart data={rateTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
                          <Tooltip formatter={(v) => [formatPct(Number(v)), "อัตราตีกลับ"]} {...TOOLTIP_STYLE} />
                          <Line type="monotone" dataKey="returnRatePct" stroke={COLORS.cyan} strokeWidth={3} dot={{ r: 3, fill: COLORS.cyan }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="panel">
                    <h4 className="font-semibold text-[1rem] m-0">Courier SLA Performance</h4>
                    <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">อัตราตีกลับแยกตามบริษัทขนส่ง (≥200 ออเดอร์)</p>
                    <div style={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={courierRanking} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                          <Tooltip
                            formatter={(v, key) =>
                              key === "returnRatePct" ? [formatPct(Number(v)), "อัตราตีกลับ"] : [formatNumber(Number(v)), "ออเดอร์"]
                            }
                            {...TOOLTIP_STYLE}
                          />
                          <Bar dataKey="returnRatePct" radius={[0, 6, 6, 0]}>
                            {courierRanking.map((_, i) => (
                              <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                            ))}
                            <LabelList dataKey="returnRatePct" position="right" formatter={(v) => formatPct(Number(v))} style={{ fontSize: 10, fill: "#8a8fa3" }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 mt-5">
                  <div className="panel">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="font-semibold text-[1rem] m-0">Sales Admin Comparison</h4>
                        <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 10 แอดมิน (≥300 ออเดอร์)</p>
                      </div>
                      <select
                        value={adminSortDir}
                        onChange={(e) => setAdminSortDir(e.target.value as "desc" | "asc")}
                        className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0 [&>option]:bg-white [&>option]:text-black"
                      >
                        <option value="desc">อัตราตีกลับ: มากไปน้อย</option>
                        <option value="asc">อัตราตีกลับ: น้อยไปมาก</option>
                      </select>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-white/50 border-b border-white/10">
                            <th className="py-2 pr-3 font-medium">แอดมิน</th>
                            <th className="py-2 pr-3 font-medium text-right">ออเดอร์</th>
                            <th className="py-2 font-medium text-right">อัตราตีกลับ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminRanking.map((row) => (
                            <tr key={row.key} className="border-b border-white/5 last:border-0">
                              <td className="py-2 pr-3">{row.label}</td>
                              <td className="py-2 pr-3 text-right">{formatNumber(row.orders)}</td>
                              <td className="py-2 text-right font-semibold" style={{ color: COLORS.orange }}>
                                {formatPct(row.returnRatePct)}
                              </td>
                            </tr>
                          ))}
                          {adminRanking.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-white/35 text-xs">
                                ไม่มีข้อมูลเพียงพอ
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="font-semibold text-[1rem] m-0">Return Rate by SKU</h4>
                        <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 10 สินค้า (≥100 ออเดอร์)</p>
                      </div>
                      <select
                        value={skuSortDir}
                        onChange={(e) => setSkuSortDir(e.target.value as "desc" | "asc")}
                        className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0 [&>option]:bg-white [&>option]:text-black"
                      >
                        <option value="desc">อัตราตีกลับ: มากไปน้อย</option>
                        <option value="asc">อัตราตีกลับ: น้อยไปมาก</option>
                      </select>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-white/50 border-b border-white/10">
                            <th className="py-2 pr-3 font-medium">สินค้า</th>
                            <th className="py-2 pr-3 font-medium text-right">ออเดอร์</th>
                            <th className="py-2 font-medium text-right">อัตราตีกลับ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skuRanking.map((row) => (
                            <tr key={row.key} className="border-b border-white/5 last:border-0">
                              <td className="py-2 pr-3">{row.label}</td>
                              <td className="py-2 pr-3 text-right">{formatNumber(row.orders)}</td>
                              <td className="py-2 text-right font-semibold" style={{ color: COLORS.orange }}>
                                {formatPct(row.returnRatePct)}
                              </td>
                            </tr>
                          ))}
                          {skuRanking.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-white/35 text-xs">
                                ไม่มีข้อมูลเพียงพอ
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Insight tab */}
        {activeMenu === "Insight" && (
          <InsightTab allRecords={allRecords} orderTotals={orderTotals} selectedMonth={selectedMonth} />
        )}

      </main>

      {kpiModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setKpiModal(null)}
        >
          <div
            className="bg-[#121a2e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg m-0">
                  {kpiModal === "count" && "รายละเอียดยอดตีกลับรายเดือน"}
                  {kpiModal === "value" && "รายละเอียดมูลค่าตีกลับรายเดือน"}
                  {kpiModal === "avg" && "รายละเอียดยอดตีกลับรายเดือน"}
                  {kpiModal === "channel" && "รายละเอียดยอดตีกลับแยกตามช่องทาง"}
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  {kpiModal === "channel"
                    ? `ตามช่วงที่เลือก (${selectedMonth === "ทั้งหมด" ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth})`
                    : "เทียบทุกเดือนที่มีข้อมูล"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKpiModal(null)}
                className="text-white/35 hover:text-white text-xl leading-none px-2"
              >
                ×
              </button>
            </div>

            {(kpiModal === "count" || kpiModal === "value" || kpiModal === "avg") && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">เดือน</th>
                    <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                    <th className="py-2 pr-3 font-medium text-right">% เทียบเดือนก่อน</th>
                    <th className="py-2 font-medium text-right">มูลค่า (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.month} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-3 font-medium">{row.label}</td>
                      <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                      <td className={`py-2 pr-3 text-right ${row.countDeltaPct == null ? "text-white/35" : row.countDeltaPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                        {row.countDeltaPct == null ? "-" : `${row.countDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(row.countDeltaPct).toFixed(1)}%`}
                      </td>
                      <td className="py-2 text-right">{formatBaht(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {kpiModal === "channel" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">ช่องทาง</th>
                    <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                    <th className="py-2 pr-3 font-medium text-right">สัดส่วน</th>
                    <th className="py-2 font-medium text-right">มูลค่า (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {allChannels.map((row, i) => (
                    <tr key={row.name} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                        {row.name}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                      <td className="py-2 pr-3 text-right">{row.sharePct.toFixed(1)}%</td>
                      <td className="py-2 text-right">{formatBaht(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {compareModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            className="bg-[#121a2e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg m-0">รายการทั้งหมด: {DIMENSION_LABELS[compareDim]}</h3>
                <p className="text-xs text-white/50 mt-1">ทั้งหมด {compareAllRows.length} รายการ เรียงตามยอดตีกลับมากไปน้อย</p>
              </div>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="text-white/35 hover:text-white text-xl leading-none px-2"
              >
                ×
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium w-10">#</th>
                  <th className="py-2 pr-3 font-medium">{DIMENSION_LABELS[compareDim]}</th>
                  <th className="py-2 pr-3 font-medium text-right">ยอดตีกลับ</th>
                  <th className="py-2 font-medium text-right">มูลค่า (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {compareAllRows.map((row, i) => (
                  <tr key={row.name} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3 text-white/35">{i + 1}</td>
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(row.count)}</td>
                    <td className="py-2 text-right">{formatBaht(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {provinceModalGeo && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setProvinceModalGeo(null)}
        >
          <div
            className="bg-[#121a2e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg m-0">{provinceModalName}</h3>
                <p className="text-xs text-white/50 mt-1">
                  {mapChannel === "ทั้งหมด" ? "ทุกช่องทาง" : mapChannel} ·{" "}
                  {selectedMonth === "ทั้งหมด" ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setProvinceModalGeo(null)}
                  className="text-[0.8rem] text-white/60 hover:text-white underline"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={() => setProvinceModalGeo(null)}
                  className="text-white/35 hover:text-white text-xl leading-none px-2"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="text-[0.72rem] text-white/50 uppercase">ยอดตีกลับ</div>
                <div className="text-2xl font-bold" style={{ color: COLORS.teal }}>{formatNumber(provinceModalRecords.length)} ออเดอร์</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="text-[0.72rem] text-white/50 uppercase">มูลค่ารวม</div>
                <div className="text-2xl font-bold" style={{ color: COLORS.purple }}>{formatBaht(provinceModalTotalValue)}</div>
              </div>
            </div>

            <h4 className="font-semibold text-[0.95rem] m-0 mb-2">แยกตามช่องทาง</h4>
            <table className="w-full text-sm mb-5">
              <tbody>
                {provinceModalChannels.map((row) => (
                  <tr key={row.name} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3 text-right">{formatNumber(row.count)} ออเดอร์</td>
                    <td className="py-1.5 text-right text-white/60">{formatBaht(row.value)}</td>
                  </tr>
                ))}
                {provinceModalChannels.length === 0 && (
                  <tr>
                    <td className="py-3 text-center text-white/35 text-xs">ไม่มีข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>

            <h4 className="font-semibold text-[0.95rem] m-0 mb-2">สินค้าที่ตีกลับมากสุด (Top 10)</h4>
            <table className="w-full text-sm">
              <tbody>
                {provinceModalProducts.map((row, i) => (
                  <tr key={row.name} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-2 text-white/35 w-6">{i + 1}</td>
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3 text-right">{formatNumber(row.count)}</td>
                    <td className="py-1.5 text-right text-white/60">{formatBaht(row.value)}</td>
                  </tr>
                ))}
                {provinceModalProducts.length === 0 && (
                  <tr>
                    <td className="py-3 text-center text-white/35 text-xs">ไม่มีข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {productModalName && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setProductModalName(null)}
        >
          <div
            className="bg-[#121a2e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg m-0">{productModalName}</h3>
                <p className="text-xs text-white/50 mt-1">
                  {selectedMonth === "ทั้งหมด" ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setProductModalName(null)}
                  className="text-[0.8rem] text-white/60 hover:text-white underline"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={() => setProductModalName(null)}
                  className="text-white/35 hover:text-white text-xl leading-none px-2"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="text-[0.72rem] text-white/50 uppercase">ยอดตีกลับ</div>
                <div className="text-2xl font-bold" style={{ color: COLORS.teal }}>{formatNumber(productModalRecords.length)} ออเดอร์</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="text-[0.72rem] text-white/50 uppercase">มูลค่ารวม</div>
                <div className="text-2xl font-bold" style={{ color: COLORS.purple }}>{formatBaht(productModalTotalValue)}</div>
              </div>
            </div>

            <h4 className="font-semibold text-[0.95rem] m-0 mb-2">แยกตามช่องทาง</h4>
            <table className="w-full text-sm mb-5">
              <tbody>
                {productModalChannels.map((row) => (
                  <tr key={row.name} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3 text-right">{formatNumber(row.count)} ออเดอร์</td>
                    <td className="py-1.5 text-right text-white/60">{formatBaht(row.value)}</td>
                  </tr>
                ))}
                {productModalChannels.length === 0 && (
                  <tr>
                    <td className="py-3 text-center text-white/35 text-xs">ไม่มีข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>

            <h4 className="font-semibold text-[0.95rem] m-0 mb-2">แยกตามจังหวัด (Top 8)</h4>
            <table className="w-full text-sm mb-5">
              <tbody>
                {productModalProvinces.map((row) => (
                  <tr key={row.geo} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3 text-right">{formatNumber(row.count)} ออเดอร์</td>
                    <td className="py-1.5 text-right text-white/60">{formatBaht(row.value)}</td>
                  </tr>
                ))}
                {productModalProvinces.length === 0 && (
                  <tr>
                    <td className="py-3 text-center text-white/35 text-xs">ไม่มีข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>

            <h4 className="font-semibold text-[0.95rem] m-0 mb-2">แยกตามแอดมินผู้ขาย (Top 8)</h4>
            <table className="w-full text-sm">
              <tbody>
                {productModalAdmins.map((row) => (
                  <tr key={row.name} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-3">{row.name}</td>
                    <td className="py-1.5 pr-3 text-right">{formatNumber(row.count)} ออเดอร์</td>
                    <td className="py-1.5 text-right text-white/60">{formatBaht(row.value)}</td>
                  </tr>
                ))}
                {productModalAdmins.length === 0 && (
                  <tr>
                    <td className="py-3 text-center text-white/35 text-xs">ไม่มีข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
