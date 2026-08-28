"""Aggregate the combined returns CSV into a small static JSON for the
Next.js/Vercel dashboard (web/public/data/records.json).

Unlike the Streamlit app (which reads the full CSV/live Sheets at runtime),
the Next.js app on Vercel is static: reading 6 large Sheets live inside a
serverless function would blow past Vercel's execution time limits. Instead
we ship one small JSON file of just the returned-orders rows (not all
orders), refreshed by re-running the pipeline + this script + a redeploy.

Usage:
    python pipeline/combine_returns.py        # produces the combined CSV
    python pipeline/aggregate_for_web.py      # produces web/public/data/records.json
"""

import json
import os
import re

import pandas as pd

HERE = os.path.dirname(__file__)
COMBINED_CSV = os.path.join(HERE, "output", "returns_2569_combined.csv")
OUTPUT_JSON = os.path.join(HERE, "..", "web", "public", "data", "records.json")
TOTALS_JSON = os.path.join(HERE, "..", "web", "public", "data", "order_totals.json")

# Same mapping as dashboard/app.py's CHANNEL_DISPLAY_MAP.
CHANNEL_DISPLAY_MAP = {"MiniShop": "Facebook", "shopss": "CRM"}

# Canonical Thai province name -> the English name used by the province
# GeoJSON (web/public/data/thailand-provinces.geojson, source: apisit/thailand.json),
# so the map on the dashboard can join return counts to province shapes.
THAI_TO_GEO_NAME = {
    "อำนาจเจริญ": "Amnat Charoen", "อ่างทอง": "Ang Thong", "กรุงเทพมหานคร": "Bangkok Metropolis",
    "บึงกาฬ": "Bueng Kan", "บุรีรัมย์": "Buri Ram", "ฉะเชิงเทรา": "Chachoengsao",
    "ชัยนาท": "Chai Nat", "ชัยภูมิ": "Chaiyaphum", "จันทบุรี": "Chanthaburi",
    "เชียงใหม่": "Chiang Mai", "เชียงราย": "Chiang Rai", "ชลบุรี": "Chon Buri",
    "ชุมพร": "Chumphon", "กาฬสินธุ์": "Kalasin", "กำแพงเพชร": "Kamphaeng Phet",
    "กาญจนบุรี": "Kanchanaburi", "ขอนแก่น": "Khon Kaen", "กระบี่": "Krabi",
    "ลำปาง": "Lampang", "ลำพูน": "Lamphun", "เลย": "Loei", "ลพบุรี": "Lop Buri",
    "แม่ฮ่องสอน": "Mae Hong Son", "มหาสารคาม": "Maha Sarakham", "มุกดาหาร": "Mukdahan",
    "นครนายก": "Nakhon Nayok", "นครปฐม": "Nakhon Pathom", "นครพนม": "Nakhon Phanom",
    "นครราชสีมา": "Nakhon Ratchasima", "นครสวรรค์": "Nakhon Sawan",
    "นครศรีธรรมราช": "Nakhon Si Thammarat", "น่าน": "Nan", "นราธิวาส": "Narathiwat",
    "หนองบัวลำภู": "Nong Bua Lam Phu", "หนองคาย": "Nong Khai", "นนทบุรี": "Nonthaburi",
    "ปทุมธานี": "Pathum Thani", "ปัตตานี": "Pattani", "พังงา": "Phangnga",
    "พัทลุง": "Phatthalung", "พะเยา": "Phayao", "เพชรบูรณ์": "Phetchabun",
    "เพชรบุรี": "Phetchaburi", "พิจิตร": "Phichit", "พิษณุโลก": "Phitsanulok",
    "พระนครศรีอยุธยา": "Phra Nakhon Si Ayutthaya", "แพร่": "Phrae", "ภูเก็ต": "Phuket",
    "ปราจีนบุรี": "Prachin Buri", "ประจวบคีรีขันธ์": "Prachuap Khiri Khan",
    "ระนอง": "Ranong", "ราชบุรี": "Ratchaburi", "ระยอง": "Rayong", "ร้อยเอ็ด": "Roi Et",
    "สระแก้ว": "Sa Kaeo", "สกลนคร": "Sakon Nakhon", "สมุทรปราการ": "Samut Prakan",
    "สมุทรสาคร": "Samut Sakhon", "สมุทรสงคราม": "Samut Songkhram", "สระบุรี": "Saraburi",
    "สตูล": "Satun", "ศรีสะเกษ": "Si Sa Ket", "สิงห์บุรี": "Sing Buri",
    "สงขลา": "Songkhla", "สุโขทัย": "Sukhothai", "สุพรรณบุรี": "Suphan Buri",
    "สุราษฎร์ธานี": "Surat Thani", "สุรินทร์": "Surin", "ตาก": "Tak", "ตรัง": "Trang",
    "ตราด": "Trat", "อุบลราชธานี": "Ubon Ratchathani", "อุดรธานี": "Udon Thani",
    "อุทัยธานี": "Uthai Thani", "อุตรดิตถ์": "Uttaradit", "ยะลา": "Yala", "ยโสธร": "Yasothon",
}

# Raw values seen in the source sheets that don't already match a
# THAI_TO_GEO_NAME key as-is — inconsistent "จังหวัด..." prefixing, English
# names, a couple of stray non-Thai/garbled entries, and one typo.
PROVINCE_ALIASES = {
    "กรุงเทพ": "กรุงเทพมหานคร", "กรุงเทพฯ": "กรุงเทพมหานคร", "Bangkok": "กรุงเทพมหานคร",
    "Chiang Mai": "เชียงใหม่", "Chon Buri": "ชลบุรี", "Mae Hong Son": "แม่ฮ่องสอน",
    "Nonthaburi": "นนทบุรี", "นนทบุรีี": "นนทบุรี", "Pathum Thani": "ปทุมธานี",
    "Phuket": "ภูเก็ต", "Saraburi": "สระบุรี", "Tỉnh Krabi": "กระบี่",
    "Ubon Ratchathani": "อุบลราชธานี", "Changwat Narathiwat": "นราธิวาส",
}


def normalize_province(raw: str) -> tuple[str, str | None]:
    """Returns (display_name, geo_name). geo_name is None when the raw value
    can't be confidently matched to a province (garbled entries, etc.) — the
    record still keeps its original province text for tables, just excluded
    from the map."""
    name = raw.strip()
    if name.startswith("จังหวัด"):
        name = name[len("จังหวัด"):]
    if name.startswith("ตำบล"):
        name = name[len("ตำบล"):].strip()
    name = PROVINCE_ALIASES.get(name, name)
    geo_name = THAI_TO_GEO_NAME.get(name)
    # Use the cleaned-up canonical name for display whenever we recognized it
    # (collapses "จังหวัดกาญจนบุรี" / "กาญจนบุรี" / etc. into one consistent value).
    return (name if geo_name else raw.strip()), geo_name


def normalize_courier(raw) -> str | None:
    """Collapses per-branch courier codes (e.g. 'Flash Express TH_14',
    'Flash Express TH_8') into one name per real courier company, so SLA
    comparisons aren't split across dozens of near-duplicate categories."""
    if pd.isna(raw):
        return None
    name = re.sub(r"_\d+$", "", str(raw).strip())
    if name.startswith("Flash Express"):
        name = "Flash Express"
    return name


def is_cod(payment_method) -> bool:
    return not pd.isna(payment_method) and "cod" in str(payment_method).lower()


def dim_breakdown(df: pd.DataFrame, col: str, label_col: str | None = None) -> list[dict]:
    """Orders/returned counts + value, grouped by `col` (already normalized).
    Rows with a null group value are skipped — 'unassigned' isn't a
    meaningful comparison bucket for courier/admin SLA tables."""
    out = []
    for key, g in df.groupby(col, dropna=True):
        label = g[label_col].mode().iat[0] if label_col else key
        returned = g[g["is_returned"] == True]  # noqa: E712
        cod = g[g["is_cod"]]
        cod_returned = cod[cod["is_returned"] == True]  # noqa: E712
        out.append({
            "key": str(key),
            "label": str(label),
            "orders": int(len(g)),
            "value": float(g["product_price"].sum(skipna=True)),
            "returned": int(len(returned)),
            "returned_value": float(returned["product_price"].sum(skipna=True)),
            "cod_orders": int(len(cod)),
            "cod_returned": int(len(cod_returned)),
        })
    return sorted(out, key=lambda r: r["orders"], reverse=True)


def main() -> None:
    if not os.path.exists(COMBINED_CSV):
        raise SystemExit(f"Not found: {COMBINED_CSV} — run pipeline/combine_returns.py first.")

    df = pd.read_csv(COMBINED_CSV, low_memory=False)
    df["order_time"] = pd.to_datetime(df["order_time"], errors="coerce")
    df["sales_channel"] = df["sales_channel"].replace(CHANNEL_DISPLAY_MAP)

    returned_df = df[df["is_returned"] == True].copy()  # noqa: E712

    records = []
    for row in returned_df.itertuples(index=False):
        province, geo = (None, None) if pd.isna(row.province) else normalize_province(str(row.province))
        records.append({
            "m": row.month,
            "id": None if pd.isna(row.internal_order_id) else str(row.internal_order_id),
            "c": None if pd.isna(row.sales_channel) else str(row.sales_channel),
            "p": province,
            "geo": geo,
            "n": None if pd.isna(row.product_name) else str(row.product_name),
            "v": None if pd.isna(row.product_price) else float(row.product_price),
            "t": None if pd.isna(row.order_time) else row.order_time.isoformat(),
        })

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(records)} return records to {OUTPUT_JSON}")

    # --- order_totals.json: all-orders denominators for rate-based metrics
    # (Return Rate, COD Rejection Rate, Courier SLA, Sales Admin comparison,
    # Return Rate by SKU) that can't be computed from the returned-only
    # records.json above.
    df["is_cod"] = df["payment_method"].apply(is_cod)
    df["courier_norm"] = df["transport_company"].apply(normalize_courier)
    cod_df = df[df["is_cod"]]
    returned = df[df["is_returned"] == True]  # noqa: E712
    cod_returned = cod_df[cod_df["is_returned"] == True]  # noqa: E712

    overall = {
        "orders": int(len(df)),
        "value": float(df["product_price"].sum(skipna=True)),
        "returned": int(len(returned)),
        "returned_value": float(returned["product_price"].sum(skipna=True)),
        "cod_orders": int(len(cod_df)),
        "cod_value": float(cod_df["product_price"].sum(skipna=True)),
        "cod_returned": int(len(cod_returned)),
        "cod_returned_value": float(cod_returned["product_price"].sum(skipna=True)),
    }

    by_month = dim_breakdown(df, "month")
    by_channel = dim_breakdown(df, "sales_channel")
    by_courier = dim_breakdown(df, "courier_norm")

    # Some source sheets have broken formulas in the salesperson column
    # (e.g. "#REF!" in the July sheet) — exclude those from the admin
    # comparison rather than showing a spreadsheet error as if it were a
    # real admin. Revisit once the source sheet is fixed.
    admin_df = df[~df["salesperson"].astype(str).str.startswith("#", na=False)]
    by_admin = dim_breakdown(admin_df, "salesperson")

    # SKU breakdown: only products that had at least one return — a rate
    # table for all 888 SKUs (most with zero returns) isn't useful and
    # would bloat the file.
    returned_codes = set(returned["product_code"].dropna().unique())
    sku_df = df[df["product_code"].isin(returned_codes)]
    by_sku = dim_breakdown(sku_df, "product_code", label_col="product_name")

    totals = {
        "overall": overall,
        "byMonth": by_month,
        "byChannel": by_channel,
        "byCourier": by_courier,
        "byAdmin": by_admin,
        "bySku": by_sku,
    }
    os.makedirs(os.path.dirname(TOTALS_JSON), exist_ok=True)
    with open(TOTALS_JSON, "w", encoding="utf-8") as f:
        json.dump(totals, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote order totals ({overall['orders']} orders) to {TOTALS_JSON}")


if __name__ == "__main__":
    main()
