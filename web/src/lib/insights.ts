// Hand-curated from the monthly return-meeting documents (Google Docs/Slides/PDF
// shared by each department + the secretary's consolidated meeting summary).
// This is NOT derived from records.json/order_totals.json — it's the narrative
// context (return reasons, department commentary, action items) those files
// can't capture on their own.
//
// To refresh for a new month: send Claude the new month's document links (same
// departments — Sales FB, CRM HQ, CRM Branch, Branding, Warehouse, Secretary
// summary) and ask it to update this file.

export interface DeptSummary {
  name: string;
  kpiTargetPct: number;
  salesValue: number;
  returnValue: number;
  returnOrders: number;
  returnRatePct: number;
  momDeltaPct: number | null;
  topReason: string;
  passedKpi: boolean;
}

export interface ReturnReasonSlice {
  reason: string;
  pct: number;
}

export interface AdminWatchRow {
  name: string;
  unit: string;
  dept: string;
  ratePctJun: number | null;
  ratePctJul: number;
  note: string;
}

export interface RecommendationGroup {
  area: string;
  items: string[];
}

export interface InsightMonth {
  month: string;
  label: string;
  meetingDate: string;
  attendees: string;
  totalSales: number;
  totalReturnValue: number;
  totalReturnOrders: number;
  totalOrders: number;
  returnRatePct: number;
  focusItems: string[];
  returnReasons: ReturnReasonSlice[];
  returnReasonsNote: string;
  departments: DeptSummary[];
  warehouse: {
    byChannel: { channel: string; orders: number }[];
    receivedBack: number;
    receivedBackExpected: number;
    peakBacklogNote: string;
  };
  adminWatch: AdminWatchRow[];
  recommendations: RecommendationGroup[];
  emergingIssues: { icon: string; text: string }[];
  dataQualityNote: string;
  sourceDocs: { label: string; url: string }[];
}

// Keyed by month ("YYYY-MM") — the Insight tab's month dropdown only ever
// offers months present here (curated meeting docs), while its live-data
// sections fall back to computing straight from records.json/order_totals.json
// for any other month so the tab isn't blocked just because no meeting
// summary has been curated for it yet. Add next month's entry here once its
// documents are read.
export const INSIGHT_2026_07: InsightMonth = {
  month: "2026-07",
  label: "กรกฎาคม 2569",
  meetingDate: "24 สิงหาคม 2569",
  attendees: "ผู้บริหาร / เลขา / แอดมิน / CRM / Line OA / Data Analytics / คลังสินค้า",
  totalSales: 51678013.77,
  totalReturnValue: 1468839,
  totalReturnOrders: 2834,
  totalOrders: 91082,
  returnRatePct: 3.11,
  focusItems: [
    "ติดตามการตรวจสอบแอดมินทุกวัน (15:30 น.) พร้อมบทลงโทษ และกำหนดประเมินผลภายในวันที่ 6 ของเดือนถัดไป",
    "ผลักดันการใช้ระบบ \"Pancake\" เป็นมาตรฐานบันทึกนัดหมาย/ติดตามพัสดุทุกทีม",
    "ติดตามการจัดการมิจฉาชีพแอบอ้างชื่อบริษัทส่งพัสดุปลอมแบบ COD เพื่อป้องกันผลกระทบภาพลักษณ์บริษัท",
  ],
  returnReasons: [
    { reason: "ลูกค้าไม่รับสาย / ติดต่อไม่ได้", pct: 48 },
    { reason: "ลูกค้าปฏิเสธรับสินค้า / เปลี่ยนใจ", pct: 42 },
    { reason: "อยู่ต่างจังหวัด / ไม่สะดวกรับ", pct: 8 },
    { reason: "ป่วย / เหตุสุดวิสัย", pct: 2 },
  ],
  returnReasonsNote:
    "อ้างอิงจากตัวอย่างที่ฝ่าย CRM สำนักงานใหญ่วิเคราะห์สาเหตุราย 50/118 ออเดอร์ — ใกล้เคียงกับภาพรวมทั้งบริษัทที่สรุปในที่ประชุม (พฤติกรรมลูกค้าเป็นสาเหตุ ~90% ของการตีกลับ)",
  departments: [
    {
      name: "Facebook",
      kpiTargetPct: 3,
      salesValue: 30646972,
      returnValue: 896765,
      returnOrders: 1787,
      returnRatePct: 3.12,
      momDeltaPct: 0.14,
      topReason: "สินค้าค้างส่ง U9 คิดเป็น 9.33% ของยอดขาย U9",
      passedKpi: false,
    },
    {
      name: "CRM สำนักงานใหญ่",
      kpiTargetPct: 2.5,
      salesValue: 5271956,
      returnValue: 76616,
      returnOrders: 118,
      returnRatePct: 1.45,
      momDeltaPct: -1.05,
      topReason: "ลูกค้าไม่รับสาย/ติดต่อไม่ได้ (48%) และปฏิเสธรับสินค้า (42%)",
      passedKpi: true,
    },
    {
      name: "CRM สาขา 1",
      kpiTargetPct: 2.5,
      salesValue: 2339709,
      returnValue: 36620,
      returnOrders: 58,
      returnRatePct: 1.56,
      momDeltaPct: -1.34,
      topReason: "ลูกค้าปฏิเสธรับ/แจ้งว่าไม่ได้สั่ง (51.5%)",
      passedKpi: true,
    },
    {
      name: "Branding",
      kpiTargetPct: 3,
      salesValue: 600142,
      returnValue: 19310,
      returnOrders: 38,
      returnRatePct: 3.46,
      momDeltaPct: -1.17,
      topReason: "ปฏิเสธรับออเดอร์ค้างส่ง (40%) และปฏิเสธรับออเดอร์ปกติ (27%)",
      passedKpi: false,
    },
  ],
  warehouse: {
    byChannel: [
      { channel: "Facebook", orders: 1787 },
      { channel: "CRM", orders: 176 },
      { channel: "TikTok", orders: 66 },
      { channel: "Shopee", orders: 50 },
      { channel: "LineOA", orders: 38 },
      { channel: "Lazada", orders: 27 },
    ],
    receivedBack: 3408,
    receivedBackExpected: 3420,
    peakBacklogNote:
      "ช่วงปลายเดือน (27–31 กรกฎาคม) มีคำสั่งซื้อค้างจัดส่งสะสมสูงสุดกว่า 1,000 ออเดอร์ต่อวัน โดยเฉพาะสินค้ากลุ่ม U5 และ U15 ที่ค้างส่งรวมเกือบ 2,000 ออเดอร์ภายใน 5 วัน ถือเป็นสาเหตุหลักที่ทำให้อัตราตีกลับสูงขึ้นต่อเนื่องตั้งแต่เดือนมิถุนายนถึงกรกฎาคม",
  },
  adminWatch: [
    { name: "คิม", unit: "U23", dept: "Facebook", ratePctJun: null, ratePctJul: 8.95, note: "แอดมินตามล่าช้า, ตามตีกลับล่าช้า week3-4" },
    { name: "มาร์ค", unit: "U18", dept: "Facebook", ratePctJun: 5.83, ratePctJul: 7.53, note: "ลูกค้าตีกลับพัสดุ 100%, ออเดอร์ทบจาก มิ.ย. 6%" },
    { name: "บิว", unit: "U8", dept: "Facebook", ratePctJun: 6.19, ratePctJul: 7.54, note: "แอดมินไม่ตามตีกลับเลย ตามล่าช้า week1-4" },
    { name: "ส้ม (ฝึกงาน)", unit: "U11", dept: "CRM สนญ.", ratePctJun: null, ratePctJul: 7.07, note: "ไม่รับสาย 4 ออเดอร์, ปฏิเสธรับ 3 ออเดอร์" },
    { name: "ใบพลู", unit: "U11", dept: "Facebook", ratePctJun: 4.1, ratePctJul: 5.88, note: "ไม่รับสายขนส่ง 35%, ตีกลับพัสดุ 65%" },
    { name: "กิ๊ฟ", unit: "U13", dept: "Facebook", ratePctJun: null, ratePctJul: 6.03, note: "แอดมินตาม/ประสานงานล่าช้า week3-4" },
    { name: "ก้อย", unit: "U16", dept: "CRM สาขา 1", ratePctJun: 3.12, ratePctJul: 3.61, note: "เกิน KPI ต่อเนื่อง 2 เดือน — สถานะพัสดุไม่อัปเดต/ลูกค้าไม่พร้อมชำระ" },
    { name: "ตอง", unit: "U7", dept: "CRM สาขา 1", ratePctJun: 2.89, ratePctJul: 3.45, note: "เกิน KPI ต่อเนื่อง 2 เดือน — ไม่รับสาย/แจ้งว่าไม่ได้สั่ง" },
    { name: "สตางค์", unit: "U7", dept: "CRM สาขา 1", ratePctJun: 3.78, ratePctJul: 3.33, note: "เกิน KPI ต่อเนื่อง 2 เดือน แต่ดีขึ้นจากเดือนก่อน" },
    { name: "แป้ง", unit: "U11", dept: "Facebook", ratePctJun: 5.41, ratePctJul: 5.57, note: "ลูกค้าไม่รับสายขนส่ง 46%, ตีกลับพัสดุ 54%" },
  ],
  recommendations: [
    {
      area: "ฝ่ายขายและบริการลูกค้า (Sales & CS)",
      items: [
        "ใช้ระบบติดตามออเดอร์ 3 วันผ่าน Pancake: วันที่ 1 แจ้งจัดส่ง → วันที่ 2 ย้ำเตรียมรับ → วันที่ 3 ยืนยันผลรับสินค้า",
        "ยืนยันสินค้า/ราคา/ที่อยู่/วันพร้อมรับให้ครบก่อนเปิดบิลทุกครั้ง โดยเฉพาะลูกค้า Inbound ใหม่และลูกค้าที่เคยตีกลับ",
        "หัวหน้าทีมตรวจ Feedback แอดมินทุกวัน 15:30 น. พร้อมพิจารณาบทลงโทษหากไม่ดีขึ้นภายในวันที่ 6 ของเดือนถัดไป",
      ],
    },
    {
      area: "ฝ่ายคลังสินค้าและแพ็คเกจจิ้ง (Fulfillment & QA)",
      items: [
        "เร่งระบายสินค้าค้างส่ง (Backlog) — เป็นสาเหตุหลักที่ทำให้ %ตีกลับพุ่งขึ้นในมิ.ย.–ก.ค. เพราะลูกค้ารอนานจนปฏิเสธรับ",
        "ตรวจสอบความถูกต้องออเดอร์ก่อนแพ็ค พบเคสคีย์ยอดโอนเป็นเก็บเงินปลายทาง (COD) และส่งผิดแบรนด์",
        "ประสานโรงงานผลิตล่วงหน้าช่วงยอดสั่งซื้อพุ่งจากโปรโมชัน เพื่อลดการค้างส่งสะสม",
      ],
    },
    {
      area: "ฝ่ายการตลาด (Marketing)",
      items: [
        "เฝ้าระวัง/แจ้งเตือนลูกค้าเรื่องมิจฉาชีพก็อปปีคอนเทนต์แอบอ้างชื่อบริษัทส่งพัสดุปลอมแบบ COD หลอกเก็บเงิน",
        "ตรวจสอบแคมเปญ/โปรโมชันที่ซ้อนกันหลายรายการพร้อมกัน ซึ่งทำให้แอดมินคีย์ข้อมูลผิดพลาดได้ง่าย",
      ],
    },
    {
      area: "ฝ่ายบริหารการขนส่ง (Logistics)",
      items: [
        "ติดตามผลกระทบน้ำท่วมในพื้นที่ลาว (8 เขตที่ได้รับผลกระทบ) — ช่องทาง Laos มีอัตราตีกลับสูงสุดทุกช่องทางที่ 14.63%",
        "พิจารณาปรับแผนขนส่ง/สื่อสารลูกค้าล่วงหน้าในพื้นที่เสี่ยงภัยพิบัติแทนการหยุดยิงแอดกว้าง ๆ",
      ],
    },
  ],
  emergingIssues: [
    { icon: "🏭", text: "โรงงานผลิตสินค้าไม่ทันตามยอดสั่งซื้อที่เพิ่มขึ้นจากทุกช่องทาง ส่งผลให้เกิดยอดค้างจัดส่งสะสม" },
    { icon: "🚨", text: "พบมิจฉาชีพก็อปปีคอนเทนต์และแอบอ้างชื่อบริษัท ส่งพัสดุปลอมแบบเก็บเงินปลายทางเพื่อหลอกเก็บเงินลูกค้า กระทบความเชื่อมั่นและภาพลักษณ์บริษัทโดยตรง" },
    { icon: "📊", text: "ตัวเลขยอดตีกลับระหว่างทีมขาย ทีมคลังสินค้า และทีมบัญชียังไม่ตรงกัน จำเป็นต้องเร่งตรวจสอบและปรับให้สอดคล้องกันก่อนการประชุมครั้งถัดไป" },
  ],
  dataQualityNote:
    "ตัวเลขบางส่วนในรายงานของแต่ละฝ่ายยังไม่ตรงกับสรุปภาพรวม 100% เช่น ฝ่าย CRM สำนักงานใหญ่รายงานอัตราตีกลับของตนเองที่ 1.45% ในขณะที่สรุปภาพรวมระบุ 1.61% ซึ่งเลขาที่ประชุมได้ระบุไว้ว่ายังพบความคลาดเคลื่อนของตัวเลขระหว่างทีมงาน จึงควรยึดตัวเลขจาก Dashboard นี้ ซึ่งคำนวณจากข้อมูลดิบโดยตรง เป็นค่าอ้างอิงหลัก",
  sourceDocs: [
    { label: "ฝ่ายบัญชี", url: "https://docs.google.com/document/d/1sV5T-u5hcf9B2iN00ukgoTtldB_iHeI4Ki1mSBru2Sw/edit" },
    { label: "ฝ่ายขาย Facebook", url: "https://docs.google.com/document/d/10RlRq9ThSsN65-HCeM4DAlkOz2FLjUpjcWD_i1wwu08/edit" },
    { label: "ฝ่าย CRM สำนักงานใหญ่", url: "https://docs.google.com/document/d/1NAu3z00MOWefErTcEw515R8cLTo6wZFR25wFL-4iDXI/edit" },
    { label: "ฝ่าย CRM สาขา", url: "https://docs.google.com/document/d/1L7qVHBSUPn1yCAbhUKgb3elB3sLMGifPgNqTfkCGALQ/edit" },
    { label: "ฝ่าย Branding", url: "https://docs.google.com/document/d/1WYZg4zGvQsa3x_2GR3XnrkjLAbTwcKjxTtxAG3CaIFQ/edit" },
    { label: "ฝ่ายคลังสินค้า", url: "https://docs.google.com/presentation/d/11E_fX5USinr5dveP57kEGyoMsacmFZGLjvqtP1s0PZw/edit" },
    { label: "สรุปการประชุม (เลขา)", url: "https://drive.google.com/file/d/1Cv59njZCrX173uDzQbgiUZ5H8zqQgDk6/view" },
  ],
};

export const INSIGHTS: Record<string, InsightMonth> = {
  "2026-07": INSIGHT_2026_07,
};
