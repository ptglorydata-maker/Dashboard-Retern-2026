"use client";

import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { COLORS, MONTH_LABELS, RawRecord, OrderTotals } from "@/lib/types";
import { channelBreakdown, topByDimension, pickTotals, computeRateCards, rateRanking } from "@/lib/aggregate";
import { INSIGHTS } from "@/lib/insights";

const REASON_PALETTE = [COLORS.red, COLORS.orange, COLORS.blue, COLORS.teal, COLORS.purple];
const DONUT_PALETTE = [COLORS.teal, COLORS.blue, COLORS.orange, COLORS.red, COLORS.purple, COLORS.cyan];

function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function formatBaht(n: number) {
  return "฿" + formatNumber(n);
}
function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#121a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#e5e7eb" },
};

export function InsightTab({
  allRecords,
  orderTotals,
  selectedMonth,
}: {
  allRecords: RawRecord[];
  orderTotals: OrderTotals | null;
  selectedMonth: string;
}) {
  const isAllMonths = selectedMonth === "ทั้งหมด";
  const d = isAllMonths ? undefined : INSIGHTS[selectedMonth];

  const monthRecords = useMemo(
    () => (isAllMonths ? allRecords : allRecords.filter((r) => r.m === selectedMonth)),
    [allRecords, selectedMonth, isAllMonths]
  );
  const liveChannels = useMemo(() => channelBreakdown(monthRecords), [monthRecords]);
  const liveProducts = useMemo(() => topByDimension(monthRecords, "n", 5), [monthRecords]);
  const liveTotals = useMemo(
    () => (orderTotals ? pickTotals(orderTotals, selectedMonth) : null),
    [orderTotals, selectedMonth]
  );
  const liveRateCards = useMemo(
    () => (liveTotals ? computeRateCards(liveTotals) : null),
    [liveTotals]
  );
  const liveCourierTop = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.byCourier, 100, 3) : []),
    [orderTotals]
  );
  const liveAdminTop = useMemo(
    () => (orderTotals ? rateRanking(orderTotals.byAdmin, 200, 5) : []),
    [orderTotals]
  );

  return (
    <div className="mt-5 flex flex-col gap-5">
      <div className="panel">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-semibold text-[1.3rem] m-0">Insight — สรุปเชิงลึกรายเดือน</h4>
            <p className="text-[0.88rem] text-white/50 mt-1">
              {d
                ? `จากที่ประชุมวันที่ ${d.meetingDate} · ผู้เข้าร่วม: ${d.attendees}`
                : isAllMonths
                ? "เลือกเดือนจากแถบด้านซ้ายเพื่อดูสรุปเชิงลึกของเดือนนั้น"
                : "ยังไม่มีสรุปที่ประชุมสำหรับเดือนนี้"}
            </p>
          </div>
          <span className="text-[0.8rem] border border-white/10 bg-white/5 text-white/70 rounded-lg px-3 py-1.5 flex-shrink-0">
            เดือนที่แสดง: {isAllMonths ? "ทั้งหมด" : MONTH_LABELS[selectedMonth] ?? selectedMonth}
          </span>
        </div>
      </div>

      {!d && (
        <div className="panel border border-amber-500/25 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🛠️</span>
            <div>
              <div className="font-semibold text-[1rem] text-amber-300">
                {isAllMonths ? "กรุณาเลือกเดือนที่ต้องการดูสรุปเชิงลึก" : "อยู่ระหว่างดำเนินการทำข้อมูล"}
              </div>
              <p className="text-[0.88rem] text-white/60 mt-1">
                {isAllMonths
                  ? "สรุปเชิงลึกจากที่ประชุมจะแสดงทีละเดือน — เลือกเดือนที่ต้องการจากแถบ \"เลือกเดือน\" ด้านซ้าย"
                  : `ยังไม่มีสรุปจากที่ประชุมสำหรับเดือน ${MONTH_LABELS[selectedMonth] ?? selectedMonth} — ด้านล่างนี้คือข้อมูลดิบจาก Dashboard ที่คำนวณได้ในระหว่างนี้`}
              </p>
            </div>
          </div>
        </div>
      )}

      {d ? (
        <>
          <div className="panel">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="text-[0.85rem] font-semibold text-amber-300">เรื่องที่ต้องโฟกัส</div>
              <div className="flex gap-8 text-right flex-shrink-0 pr-1">
                <div>
                  <div className="text-[0.78rem] text-white/50 uppercase">ยอดขายรวม</div>
                  <div className="text-[2rem] font-bold text-white leading-tight">
                    {formatBaht(liveTotals ? liveTotals.value : d.totalSales)}
                  </div>
                </div>
                <div>
                  <div className="text-[0.78rem] text-white/50 uppercase">มูลค่าตีกลับ</div>
                  <div className="text-[2rem] font-bold leading-tight" style={{ color: COLORS.red }}>
                    {formatBaht(liveRateCards ? liveRateCards.financialLoss : d.totalReturnValue)}
                  </div>
                </div>
                <div>
                  <div className="text-[0.78rem] text-white/50 uppercase">อัตราตีกลับ</div>
                  <div className="text-[2rem] font-bold leading-tight" style={{ color: COLORS.orange }}>
                    {(liveRateCards ? liveRateCards.returnRateUnits : d.returnRatePct).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
            <ul className="text-[0.92rem] text-white/80 mt-3 flex flex-col gap-1 list-disc list-inside">
              {d.focusItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-white/10 text-[0.78rem] text-white/45 leading-relaxed">
              {liveRateCards && (
                <p className="mb-1.5">
                  หมายเหตุ: ตัวเลขด้านบนคำนวณสดจากข้อมูลระบบทั้งหมด (ทุกช่องทาง รวม Laos) — ใช้สูตรเดียวกับหน้า
                  &quot;ภาพรวม&quot; และ &quot;COD &amp; ต้นทุน&quot; จึงตรงกันทุกหน้า ต่างจากตัวเลขที่สรุปในที่ประชุม (ไม่รวม Laos) ซึ่งอยู่ที่
                  ยอดขาย {formatBaht(d.totalSales)} / มูลค่าตีกลับ {formatBaht(d.totalReturnValue)} / อัตราตีกลับ {d.returnRatePct.toFixed(2)}%
                </p>
              )}
              <p>บริบทจากที่ประชุม: {d.totalsNote}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="panel">
              <h4 className="font-semibold text-[1.15rem] m-0">สัดส่วนเหตุผลตีกลับ</h4>
              <p className="text-[0.8rem] text-white/50 mt-0.5 mb-2">{d.returnReasonsNote}</p>
              <div style={{ width: "100%", height: 170 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={d.returnReasons} dataKey="pct" nameKey="reason" innerRadius="55%" outerRadius="95%">
                      {d.returnReasons.map((_, i) => (
                        <Cell key={i} fill={REASON_PALETTE[i % REASON_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${Number(v)}%`, String(name)]} {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {d.returnReasons.map((r, i) => (
                  <div key={r.reason} className="flex justify-between text-[0.85rem]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: REASON_PALETTE[i % REASON_PALETTE.length] }} />
                      <span className="truncate">{r.reason}</span>
                    </span>
                    <b className="flex-shrink-0 ml-2">{r.pct}%</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 panel">
              <h4 className="font-semibold text-[1.15rem] m-0">อัตราตีกลับรายฝ่าย เทียบ KPI</h4>
              <p className="text-[0.88rem] text-white/50 mt-0.5 mb-2">ตามรายงานที่แต่ละฝ่ายสรุปเอง</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-white/50 border-b border-white/10">
                      <th className="py-2 pr-3 font-medium">ฝ่าย</th>
                      <th className="py-2 pr-3 font-medium text-right">ยอดขาย</th>
                      <th className="py-2 pr-3 font-medium text-right">อัตราตีกลับ</th>
                      <th className="py-2 pr-3 font-medium text-right">เทียบเดือนก่อน</th>
                      <th className="py-2 pr-3 font-medium text-right">KPI</th>
                      <th className="py-2 font-medium">สาเหตุหลัก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.departments.map((dept) => (
                      <tr key={dept.name} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-3 font-medium">{dept.name}</td>
                        <td className="py-2 pr-3 text-right">{formatBaht(dept.salesValue)}</td>
                        <td className="py-2 pr-3 text-right font-semibold" style={{ color: dept.passedKpi ? "#4ade80" : "#fb7185" }}>
                          {dept.returnRatePct.toFixed(2)}%
                        </td>
                        <td className={`py-2 pr-3 text-right ${dept.momDeltaPct == null ? "text-white/35" : dept.momDeltaPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                          {dept.momDeltaPct == null ? "-" : `${dept.momDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(dept.momDeltaPct).toFixed(2)} จุด`}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <span
                            className={`text-[0.75rem] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              dept.passedKpi ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {dept.passedKpi ? `ผ่าน (≤${dept.kpiTargetPct}%)` : `ไม่ผ่าน (>${dept.kpiTargetPct}%)`}
                          </span>
                        </td>
                        <td className="py-2 text-white/70 text-[0.88rem]">{dept.topReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="panel">
              <h4 className="font-semibold text-[1.15rem] m-0">ยอดตีกลับที่ฝ่ายคลังได้รับ แยกตามช่องทาง</h4>
              <p className="text-[0.88rem] text-white/50 mt-0.5 mb-3">จำนวนพัสดุตีกลับที่คลังรับเข้าจริง เทียบยอดที่แจ้ง</p>
              <div className="flex flex-col gap-1.5">
                {d.warehouse.byChannel.map((c) => (
                  <div key={c.channel} className="flex justify-between text-[0.92rem]">
                    <span className="text-white/70">{c.channel}</span>
                    <b>{formatNumber(c.orders)} ออเดอร์</b>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline gap-3 mt-4 pt-3 border-t border-white/10">
                <div className="text-3xl font-bold" style={{ color: COLORS.teal }}>
                  {formatNumber(d.warehouse.receivedBack)} / {formatNumber(d.warehouse.receivedBackExpected)}
                </div>
                <div className="text-[0.85rem] text-white/50">
                  ({((d.warehouse.receivedBack / d.warehouse.receivedBackExpected) * 100).toFixed(1)}% ตรงกับยอดตีกลับที่แจ้ง)
                </div>
              </div>
            </div>
            <div className="panel">
              <h4 className="font-semibold text-[1.15rem] m-0 flex items-center gap-2">
                <span>📦</span> จุดที่ต้องระวัง — ฝ่ายคลังสินค้า
              </h4>
              <p className="text-[0.88rem] text-white/50 mt-0.5 mb-3">ออเดอร์ค้างจัดส่งสะสม (Backlog)</p>
              <p className="text-[0.95rem] text-white/80 leading-relaxed">{d.warehouse.peakBacklogNote}</p>
            </div>
          </div>

          <div className="panel">
            <h4 className="font-semibold text-[1.15rem] m-0">แอดมินที่ต้องจับตา</h4>
            <p className="text-[0.88rem] text-white/50 mt-0.5 mb-2">อัตราตีกลับสูง หรือเกิน KPI ต่อเนื่องหลายเดือน</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="text-left text-white/50 border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">แอดมิน</th>
                    <th className="py-2 pr-3 font-medium">Unit / ฝ่าย</th>
                    <th className="py-2 pr-3 font-medium text-right">มิ.ย.</th>
                    <th className="py-2 pr-3 font-medium text-right">ก.ค.</th>
                    <th className="py-2 font-medium">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...d.adminWatch]
                    .sort((a, b) => b.ratePctJul - a.ratePctJul)
                    .map((row) => (
                      <tr key={`${row.name}-${row.unit}`} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        <td className="py-2 pr-3 text-white/60">{row.unit} · {row.dept}</td>
                        <td className="py-2 pr-3 text-right text-white/60">{row.ratePctJun == null ? "-" : `${row.ratePctJun.toFixed(2)}%`}</td>
                        <td className="py-2 pr-3 text-right font-semibold" style={{ color: COLORS.red }}>{row.ratePctJul.toFixed(2)}%</td>
                        <td className="py-2 text-white/70 text-[0.88rem]">{row.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {d.recommendations.map((group) => (
              <div key={group.area} className="panel">
                <h4 className="font-semibold text-[1.05rem] m-0">{group.area}</h4>
                <ul className="text-[0.92rem] text-white/80 mt-2 flex flex-col gap-1.5 list-disc list-inside">
                  {group.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="panel">
            <h4 className="font-semibold text-[1.15rem] m-0">ปัญหาที่พบเพิ่มเติม / ต้องจับตา</h4>
            <div className="mt-2 flex flex-col gap-2.5">
              {d.emergingIssues.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-[0.92rem] text-white/80 leading-relaxed">
                  <span className="text-xl flex-shrink-0 leading-none mt-0.5">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-[0.88rem] text-white/60 flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0 leading-none">⚠️</span>
              <span>{d.dataQualityNote}</span>
            </div>
          </div>

          <div className="panel">
            <h4 className="font-semibold text-[1rem] m-0 text-white/70">แหล่งข้อมูล</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
              {d.sourceDocs.map((doc) => (
                <a
                  key={doc.label}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.88rem] text-blue-300 hover:text-blue-200 underline"
                >
                  {doc.label}
                </a>
              ))}
            </div>
          </div>
        </>
      ) : isAllMonths ? null : (
        <>
          <div className="grid grid-cols-3 gap-5">
            <div className="panel">
              <div className="text-[0.88rem] text-white/50">อัตราตีกลับ</div>
              <div className="text-[1.9rem] font-bold mt-1" style={{ color: COLORS.teal }}>
                {liveRateCards ? formatPct(liveRateCards.returnRateUnits) : "-"}
              </div>
              <div className="text-[0.8rem] text-white/50 mt-1">ตามจำนวนออเดอร์ · {liveRateCards ? formatPct(liveRateCards.returnRateValue) : "-"} ตามมูลค่า</div>
            </div>
            <div className="panel">
              <div className="text-[0.88rem] text-white/50">COD Rejection Rate</div>
              <div className="text-[1.9rem] font-bold mt-1" style={{ color: COLORS.red }}>
                {liveRateCards ? formatPct(liveRateCards.codRejectionRate) : "-"}
              </div>
              <div className="text-[0.8rem] text-white/50 mt-1">จากออเดอร์เก็บเงินปลายทาง</div>
            </div>
            <div className="panel">
              <div className="text-[0.88rem] text-white/50">มูลค่าตีกลับ (มูลค่าสินค้า)</div>
              <div className="text-[1.9rem] font-bold mt-1" style={{ color: COLORS.purple }}>
                {liveRateCards ? formatBaht(liveRateCards.financialLoss) : "-"}
              </div>
              <div className="text-[0.8rem] text-white/50 mt-1">ยังไม่รวมค่าขนส่ง/โฆษณาที่เสียเปล่า</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="panel">
              <h4 className="font-semibold text-[1.15rem] m-0">แยกตามช่องทาง</h4>
              <p className="text-[0.88rem] text-white/50 mt-0.5 mb-2">{MONTH_LABELS[selectedMonth] ?? selectedMonth}</p>
              <div className="flex flex-col gap-2">
                {liveChannels.map((row, i) => (
                  <div key={row.name} className="text-[0.92rem]">
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                        {row.name}
                      </span>
                      <span>
                        <b>{row.sharePct.toFixed(1)}%</b>
                        <span className="text-white/40 ml-1.5">{formatBaht(row.value)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${row.sharePct}%`, background: DONUT_PALETTE[i % DONUT_PALETTE.length] }}
                      />
                    </div>
                  </div>
                ))}
                {liveChannels.length === 0 && <p className="text-[0.8rem] text-white/35">ไม่มีข้อมูล</p>}
              </div>
            </div>
            <div className="panel">
              <h4 className="font-semibold text-[1.15rem] m-0">สินค้าตีกลับสูงสุด</h4>
              <p className="text-[0.88rem] text-white/50 mt-0.5 mb-2">Top 5 · {MONTH_LABELS[selectedMonth] ?? selectedMonth}</p>
              <table className="w-full text-sm">
                <tbody>
                  {liveProducts.map((row, i) => (
                    <tr key={row.name} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-2 text-white/35 w-6">{i + 1}</td>
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 text-right">{formatNumber(row.count)}</td>
                      <td className="py-2 pl-3 text-right text-white/60">{formatBaht(row.value)}</td>
                    </tr>
                  ))}
                  {liveProducts.length === 0 && (
                    <tr>
                      <td className="py-4 text-center text-white/35 text-[0.8rem]">ไม่มีข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(liveCourierTop.length > 0 || liveAdminTop.length > 0) && (
            <div className="grid grid-cols-2 gap-5">
              <div className="panel">
                <h4 className="font-semibold text-[1.15rem] m-0">Courier ที่มีอัตราตีกลับสูงสุด</h4>
                <p className="text-[0.88rem] text-white/50 mt-0.5 mb-2">≥100 ออเดอร์</p>
                <div className="flex flex-col gap-2">
                  {liveCourierTop.map((row) => (
                    <div key={row.key} className="flex justify-between text-[0.92rem]">
                      <span className="text-white/70">{row.label}</span>
                      <b style={{ color: COLORS.orange }}>{formatPct(row.returnRatePct)}</b>
                    </div>
                  ))}
                  {liveCourierTop.length === 0 && <p className="text-[0.8rem] text-white/35">ไม่มีข้อมูลเพียงพอ</p>}
                </div>
              </div>
              <div className="panel">
                <h4 className="font-semibold text-[1.15rem] m-0">แอดมินที่มีอัตราตีกลับสูงสุด</h4>
                <p className="text-[0.88rem] text-white/50 mt-0.5 mb-2">≥200 ออเดอร์</p>
                <div className="flex flex-col gap-2">
                  {liveAdminTop.map((row) => (
                    <div key={row.key} className="flex justify-between text-[0.92rem]">
                      <span className="text-white/70">{row.label}</span>
                      <b style={{ color: COLORS.orange }}>{formatPct(row.returnRatePct)}</b>
                    </div>
                  ))}
                  {liveAdminTop.length === 0 && <p className="text-[0.8rem] text-white/35">ไม่มีข้อมูลเพียงพอ</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
