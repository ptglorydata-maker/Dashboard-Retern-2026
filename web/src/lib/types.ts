// Compact record shape written by pipeline/aggregate_for_web.py.
export interface RawRecord {
  m: string; // month, "2026-01"
  id: string | null; // internal_order_id
  c: string | null; // sales_channel
  p: string | null; // province
  n: string | null; // product_name
  v: number | null; // product_price
  t: string | null; // order_time, ISO
}

export const MONTH_LABELS: Record<string, string> = {
  "2026-01": "ม.ค.69",
  "2026-02": "ก.พ.69",
  "2026-03": "มี.ค.69",
  "2026-04": "เม.ย.69",
  "2026-05": "พ.ค.69",
  "2026-06": "มิ.ย.69",
  "2026-07": "ก.ค.69",
  "2026-08": "ส.ค.69",
  "2026-09": "ก.ย.69",
  "2026-10": "ต.ค.69",
  "2026-11": "พ.ย.69",
  "2026-12": "ธ.ค.69",
};

export const COLORS = {
  pink: "#ec4899",
  pinkDark: "#db2777",
  purple: "#8b5cf6",
  purpleDark: "#7c3aed",
  blue: "#3b82f6",
  blueDark: "#2563eb",
  orange: "#f97316",
  orangeDark: "#ea580c",
};
