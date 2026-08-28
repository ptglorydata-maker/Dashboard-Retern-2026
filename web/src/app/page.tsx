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
  topProducts,
  topByDimension,
  provinceBreakdown,
  pickTotals,
  computeRateCards,
  rateRanking,
  monthlyRateTrend,
  DIMENSION_LABELS,
  Dimension,
} from "@/lib/aggregate";
import { ThailandMap } from "@/components/ThailandMap";

const MENU_ITEMS = ["ภาพรวม", "รายเดือน", "ช่องทางขาย", "สินค้า", "COD & ต้นทุน"];
const DONUT_PALETTE = [COLORS.teal, COLORS.blue, COLORS.orange, COLORS.red, COLORS.purple, COLORS.cyan];
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
  const [compareDim, setCompareDim] = useState<Dimension>("n");
  const [mapChannel, setMapChannel] = useState<string>("ทั้งหมด");
  const [mapSort, setMapSort] = useState<"มากสุด" | "น้อยสุด">("มากสุด");
  const [kpiModal, setKpiModal] = useState<"count" | "value" | "avg" | "channel" | null>(null);
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
  const trend = useMemo(() => monthlyTrend(filtered), [filtered]);
  const channelCounts = useMemo(() => countBy(filtered, (r) => r.c ?? "ไม่ระบุ").slice(0, 4), [filtered]);
  const totalForShare = channelCounts.reduce((s, [, v]) => s + v, 0) || 1;

  const monthlyRows = useMemo(() => (allRecords ? monthlySummary(allRecords) : []), [allRecords]);
  const allChannels = useMemo(() => channelBreakdown(filtered), [filtered]);
  const products = useMemo(() => topProducts(filtered), [filtered]);

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
  const compareRows = useMemo(() => topByDimension(filtered, compareDim, 8), [filtered, compareDim]);

  const rateCards = useMemo(
    () => (orderTotals ? computeRateCards(pickTotals(orderTotals, selectedMonth)) : null),
    [orderTotals, selectedMonth]
  );
  const courierRanking = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.byCourier, 200, 10) : []),
    [orderTotals]
  );
  const adminRanking = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.byAdmin, 300, 10) : []),
    [orderTotals]
  );
  const skuRanking = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.bySku, 100, 10) : []),
    [orderTotals]
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
      <main className="flex-1 p-8 max-w-[1400px]">
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
              <p className="text-[2.6rem] font-semibold leading-[1.15] m-0 text-white">
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
        <div className="grid grid-cols-4 gap-5">
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
            <h4 className="font-semibold text-[1rem] m-0">แนวโน้มยอดตีกลับรายเดือน</h4>
            <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">จำนวนรายการตีกลับต่อเดือน</p>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${formatNumber(Number(v))} รายการ`, ""]} {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="count" stroke={COLORS.teal} strokeWidth={3} fill="url(#trendFill)" />
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
            <div className="flex flex-col gap-1.5 mt-1">
              {channelCounts.map(([name, value], i) => (
                <div key={name} className="flex justify-between text-[0.8rem]">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                    {name}
                  </span>
                  <b>{((value / totalForShare) * 100).toFixed(0)}%</b>
                </div>
              ))}
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
                className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5 flex-shrink-0"
              >
                {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((d) => (
                  <option key={d} value={d}>
                    {DIMENSION_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: "100%", height: 280 }}>
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
                  className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5"
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
                  className="text-xs border border-white/10 bg-white/5 text-white/80 rounded-lg px-2 py-1.5"
                >
                  <option value="มากสุด">เรียงมากสุด</option>
                  <option value="น้อยสุด">เรียงน้อยสุด</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-1">
              <div className="flex-1 flex justify-center">
                <ThailandMap data={provinceRows} />
              </div>
              <div className="w-56 flex-shrink-0 overflow-y-auto" style={{ maxHeight: 480 }}>
                {provinceRows.map((row, i) => (
                  <div key={row.geo} className="flex items-center justify-between text-[0.8rem] py-1.5 border-b border-white/5 last:border-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-white/35 w-5 flex-shrink-0">{i + 1}</span>
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="font-semibold flex-shrink-0 ml-2">{formatNumber(row.count)}</span>
                  </div>
                ))}
                {provinceRows.length === 0 && <p className="text-xs text-white/35 mt-4">ไม่มีข้อมูล</p>}
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Monthly tab */}
        {activeMenu === "รายเดือน" && (
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
          </div>
        )}

        {/* Channel tab */}
        {activeMenu === "ช่องทางขาย" && (
          <div className="grid grid-cols-3 gap-5 mt-5">
            <div className="panel">
              <h4 className="font-semibold text-[1rem] m-0">สัดส่วนช่องทางตีกลับ</h4>
              <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">
                ทุกช่องทาง ({selectedMonth === "ทั้งหมด" ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth})
              </p>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={allChannels} dataKey="count" nameKey="name" innerRadius="60%" outerRadius="95%">
                      {allChannels.map((_, i) => (
                        <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
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
          </div>
        )}

        {/* Product tab */}
        {activeMenu === "สินค้า" && (
          <div className="panel mt-5">
            <h4 className="font-semibold text-[1rem] m-0">สินค้าที่ถูกตีกลับมากที่สุด</h4>
            <p className="text-[0.78rem] text-white/50 mt-0.5 mb-3">Top {products.length} สินค้า เรียงตามยอดตีกลับ</p>
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
                  {products.map((row, i) => (
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
                    <h4 className="font-semibold text-[1rem] m-0">Sales Admin Comparison</h4>
                    <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 10 แอดมินที่มีอัตราตีกลับสูงสุด (≥300 ออเดอร์)</p>
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
                    <h4 className="font-semibold text-[1rem] m-0">Return Rate by SKU</h4>
                    <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">Top 10 สินค้าที่มีอัตราตีกลับสูงสุด (≥100 ออเดอร์)</p>
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
    </div>
  );
}
