"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { COLORS } from "@/lib/types";
import { INSIGHT_2026_07 } from "@/lib/insights";

const REASON_PALETTE = [COLORS.red, COLORS.orange, COLORS.blue, COLORS.teal, COLORS.purple];

function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function formatBaht(n: number) {
  return "฿" + formatNumber(n);
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#121a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#e5e7eb" },
};

export function InsightTab() {
  const d = INSIGHT_2026_07;

  return (
    <div className="mt-5 flex flex-col gap-5">
      <div className="panel">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-semibold text-[1.1rem] m-0">อินไซต์จากที่ประชุมสินค้าตีกลับ — {d.label}</h4>
            <p className="text-[0.78rem] text-white/50 mt-1">
              ประชุมวันที่ {d.meetingDate} · ผู้เข้าร่วม: {d.attendees}
            </p>
          </div>
          <div className="flex gap-4 text-right flex-shrink-0">
            <div>
              <div className="text-[0.7rem] text-white/50 uppercase">ยอดขายรวม</div>
              <div className="text-lg font-bold text-white">{formatBaht(d.totalSales)}</div>
            </div>
            <div>
              <div className="text-[0.7rem] text-white/50 uppercase">มูลค่าตีกลับ</div>
              <div className="text-lg font-bold" style={{ color: COLORS.red }}>{formatBaht(d.totalReturnValue)}</div>
            </div>
            <div>
              <div className="text-[0.7rem] text-white/50 uppercase">อัตราตีกลับ</div>
              <div className="text-lg font-bold" style={{ color: COLORS.orange }}>{d.returnRatePct.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3">
          <div className="text-[0.75rem] font-semibold text-amber-300 mb-1.5">เรื่องที่ต้องโฟกัส</div>
          <ul className="text-[0.8rem] text-white/80 flex flex-col gap-1 list-disc list-inside">
            {d.focusItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="panel">
          <h4 className="font-semibold text-[1rem] m-0">สัดส่วนเหตุผลตีกลับ</h4>
          <p className="text-[0.72rem] text-white/50 mt-0.5 mb-2">{d.returnReasonsNote}</p>
          <div style={{ width: "100%", height: 180 }}>
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
              <div key={r.reason} className="flex justify-between text-[0.75rem]">
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
          <h4 className="font-semibold text-[1rem] m-0">อัตราตีกลับรายฝ่าย เทียบ KPI</h4>
          <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">ตามรายงานที่แต่ละฝ่ายสรุปเอง</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                        className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full ${
                          dept.passedKpi ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {dept.passedKpi ? `ผ่าน (≤${dept.kpiTargetPct}%)` : `ไม่ผ่าน (>${dept.kpiTargetPct}%)`}
                      </span>
                    </td>
                    <td className="py-2 text-white/70 text-[0.78rem]">{dept.topReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <h4 className="font-semibold text-[1rem] m-0">ฝ่ายคลังสินค้า</h4>
        <p className="text-[0.78rem] text-white/50 mt-0.5 mb-3">สรุปออเดอร์ตีกลับที่รับเข้าคลังและออเดอร์ค้างส่ง</p>
        <div className="grid grid-cols-3 gap-5">
          <div>
            <div className="text-[0.72rem] text-white/50 mb-2">ออเดอร์ตีกลับตามช่องทาง</div>
            <div className="flex flex-col gap-1.5">
              {d.warehouse.byChannel.map((c) => (
                <div key={c.channel} className="flex justify-between text-[0.8rem]">
                  <span className="text-white/70">{c.channel}</span>
                  <b>{formatNumber(c.orders)} ออเดอร์</b>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[0.72rem] text-white/50 mb-2">รับคืนที่คลังจริง</div>
            <div className="text-2xl font-bold" style={{ color: COLORS.teal }}>
              {formatNumber(d.warehouse.receivedBack)} / {formatNumber(d.warehouse.receivedBackExpected)}
            </div>
            <div className="text-[0.75rem] text-white/50 mt-1">
              {((d.warehouse.receivedBack / d.warehouse.receivedBackExpected) * 100).toFixed(1)}% ตรงกับยอดตีกลับที่แจ้ง
            </div>
          </div>
          <div>
            <div className="text-[0.72rem] text-white/50 mb-2">จุดที่ต้องระวัง</div>
            <p className="text-[0.8rem] text-white/80 leading-relaxed">{d.warehouse.peakBacklogNote}</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <h4 className="font-semibold text-[1rem] m-0">แอดมินที่ต้องจับตา</h4>
        <p className="text-[0.78rem] text-white/50 mt-0.5 mb-2">อัตราตีกลับสูง หรือเกิน KPI ต่อเนื่องหลายเดือน</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
              {d.adminWatch
                .sort((a, b) => b.ratePctJul - a.ratePctJul)
                .map((row) => (
                  <tr key={`${row.name}-${row.unit}`} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3 font-medium">{row.name}</td>
                    <td className="py-2 pr-3 text-white/60">{row.unit} · {row.dept}</td>
                    <td className="py-2 pr-3 text-right text-white/60">{row.ratePctJun == null ? "-" : `${row.ratePctJun.toFixed(2)}%`}</td>
                    <td className="py-2 pr-3 text-right font-semibold" style={{ color: COLORS.red }}>{row.ratePctJul.toFixed(2)}%</td>
                    <td className="py-2 text-white/70 text-[0.78rem]">{row.note}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {d.recommendations.map((group) => (
          <div key={group.area} className="panel">
            <h4 className="font-semibold text-[0.95rem] m-0">{group.area}</h4>
            <ul className="text-[0.8rem] text-white/80 mt-2 flex flex-col gap-1.5 list-disc list-inside">
              {group.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4 className="font-semibold text-[1rem] m-0">ปัญหาที่พบเพิ่มเติม / ต้องจับตา</h4>
        <ul className="text-[0.8rem] text-white/80 mt-2 flex flex-col gap-1.5 list-disc list-inside">
          {d.emergingIssues.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-[0.78rem] text-white/60">
          ⚠️ {d.dataQualityNote}
        </div>
      </div>

      <div className="panel">
        <h4 className="font-semibold text-[0.9rem] m-0 text-white/70">แหล่งข้อมูล</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
          {d.sourceDocs.map((doc) => (
            <a
              key={doc.label}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.78rem] text-blue-300 hover:text-blue-200 underline"
            >
              {doc.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
