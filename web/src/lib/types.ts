// Compact record shape written by pipeline/aggregate_for_web.py.
export interface RawRecord {
  m: string; // month, "2026-01"
  id: string | null; // internal_order_id
  c: string | null; // sales_channel
  p: string | null; // province (Thai display name)
  geo: string | null; // province name matching thailand-provinces.geojson, or null if unmatched
  n: string | null; // product_name
  v: number | null; // product_price
  t: string | null; // order_time, ISO
  a: string | null; // salesperson (admin)
}

// Written by pipeline/aggregate_for_web.py's dim_breakdown() — all-orders
// (not just returned) counts for a group, used for rate-based metrics
// (Return Rate, COD Rejection Rate, Courier SLA, Sales Admin comparison,
// Return Rate by SKU) that records.json alone can't answer.
export interface DimBreakdownRow {
  key: string;
  label: string;
  orders: number;
  value: number;
  returned: number;
  returned_value: number;
  cod_orders: number;
  cod_returned: number;
}

export interface OrderTotalsOverall {
  orders: number;
  value: number;
  returned: number;
  returned_value: number;
  cod_orders: number;
  cod_value: number;
  cod_returned: number;
  cod_returned_value: number;
}

export interface OrderTotals {
  overall: OrderTotalsOverall;
  byMonth: DimBreakdownRow[];
  byChannel: DimBreakdownRow[];
  byCourier: DimBreakdownRow[];
  byAdmin: DimBreakdownRow[];
  bySku: DimBreakdownRow[];
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
  purple: "#a78bfa",
  purpleDark: "#7c3aed",
  blue: "#38bdf8",
  blueDark: "#0ea5e9",
  orange: "#f5b301",
  orangeDark: "#d97706",
  teal: "#2dd4bf",
  tealDark: "#0d9488",
  red: "#fb4570",
  redDark: "#e11d48",
  cyan: "#22d3ee",
  cyanDark: "#06b6d4",
};
