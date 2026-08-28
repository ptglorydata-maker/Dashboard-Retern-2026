"""Schema mapping + cleaning for the two source formats found in Drive.

Schema A ("Total-Data-ตีกลับ <เดือน>"): every order for the month, with
return-status/return-qty columns. Most months use this format.

Schema B ("สรุปรายการสินค้าตีกลับเดือน <เดือน>"): pre-filtered to already-
returned orders only, with a different column layout (no order-status /
return-qty columns, since every row here is a return).

Both get mapped onto one STANDARD_COLUMNS shape so they can be concatenated.
Fields that don't exist in a given schema are left null (not guessed).
"""

import re
import pandas as pd

STANDARD_COLUMNS = [
    "month", "source_schema", "unit",
    "internal_order_id", "online_order_id", "order_status",
    "shop", "sales_channel", "salesperson",
    "transport_company", "tracking_no", "shipping_status",
    "order_time", "ship_date",
    "province",
    "product_code", "product_name", "product_price",
    "payment_method", "return_qty", "is_returned",
    "phone",
]

# target_column -> source_column, per schema
SCHEMA_A_MAP = {
    "internal_order_id": "หมายเลขออเดอร์ภายใน",
    "online_order_id": "หมายเลขคำสั่งซื้อออนไลน์",
    "order_status": "สถานะคำสั่งซื้อ",
    "transport_company": "บริษัทขนส่ง",
    "tracking_no": "เลขพัสดุ",
    "shipping_status": "สถานะขนส่ง",
    "order_time": "เวลาสั่งซื้อ",
    "shop": "ร้านค้า",
    "province": "จังหวัด",
    "salesperson": "พนักงานขาย",
    "ship_date": "วันที่จัดส่ง",
    "sales_channel": "แพลตฟอร์ม",
    "payment_method": "วิธีการชำระเงิน",
    "phone": "เบอร์โทร",
    "return_qty": "จํานวนสินค้าตีกลับ",
    "product_code": "รหัสสินค้า",
    "product_name": "ชื่อสินค้า",
    "product_price": "ราคาสินค้าทั้งหมด",
}

SCHEMA_B_MAP = {
    "online_order_id": "หมายเลขคำสั่งซื้อออนไลน์",
    "internal_order_id": "หมายเลขออเดอร์ภายใน",
    "order_time": "วันสั่งซื้อ",
    "shop": "ชื่อร้าน",
    "sales_channel": "ฝ่ายที่ขาย",
    "product_code": "รหัสสินค้า",
    "product_name": "ชื่อสินค้า",
    "product_price": "ราคาสินค้า",
    "unit": "Unit",
    "payment_method": "วิธีการชำระเงิน",
    "tracking_no": "หมายเลขพัสดุ",
    "ship_date": "วันที่จัดส่ง",
    "province": "จังหวัด",
    "transport_company": "บริษัทขนส่ง",
    "shipping_status": "สถานะขนส่ง",
    "salesperson": "พนักงานขาย",
}

UNIT_RE = re.compile(r"U(\d+)", re.IGNORECASE)


def _clean_str_cols(df: pd.DataFrame) -> pd.DataFrame:
    obj_cols = df.select_dtypes("object").columns
    df[obj_cols] = df[obj_cols].apply(lambda s: s.str.strip())
    return df


def _parse_date(series: pd.Series) -> pd.Series:
    # Schema A dates are ISO (unambiguous); Schema B dates are dd/mm/yyyy (Thai convention).
    # dayfirst=True is safe for both — it only affects ambiguous dd/mm vs mm/dd inputs.
    return pd.to_datetime(series, errors="coerce", dayfirst=True)


def _parse_amount(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.replace("บาท", "", regex=False),
        errors="coerce",
    )


def _extract_unit(product_code: pd.Series) -> pd.Series:
    return product_code.astype(str).str.extract(UNIT_RE, expand=False).apply(
        lambda v: f"U{v}" if pd.notna(v) else None
    )


def normalize_schema_a(raw: pd.DataFrame, month: str) -> pd.DataFrame:
    out = pd.DataFrame(index=raw.index)
    for target, source in SCHEMA_A_MAP.items():
        out[target] = raw[source] if source in raw.columns else None

    out["month"] = month
    out["source_schema"] = "A"
    out["unit"] = _extract_unit(out["product_code"])
    out["order_time"] = _parse_date(out["order_time"])
    out["ship_date"] = _parse_date(out["ship_date"])
    out["product_price"] = _parse_amount(out["product_price"])
    out["return_qty"] = pd.to_numeric(out["return_qty"], errors="coerce").fillna(0)
    out["is_returned"] = (out["return_qty"] > 0) | out["shipping_status"].astype(str).str.contains("ตีกลับ", na=False)

    return out.reindex(columns=STANDARD_COLUMNS)


def normalize_schema_c(raw: pd.DataFrame, month: str, returned_ids: set[str]) -> pd.DataFrame:
    """Full order-level sheet ("Total_Order on Sell") with no return-status
    column of its own. Reuses schema A's column mapping (the headers match),
    but is_returned/return_qty come from membership in `returned_ids` — the
    internal_order_id set pulled from a separate returns-only tab — instead
    of a return_qty/shipping_status column that doesn't exist here."""
    out = pd.DataFrame(index=raw.index)
    for target, source in SCHEMA_A_MAP.items():
        if target == "return_qty":
            continue
        out[target] = raw[source] if source in raw.columns else None

    out["month"] = month
    out["source_schema"] = "C"
    out["unit"] = _extract_unit(out["product_code"])
    out["order_time"] = _parse_date(out["order_time"])
    out["ship_date"] = _parse_date(out["ship_date"])
    out["product_price"] = _parse_amount(out["product_price"])
    ids = out["internal_order_id"].astype(str).str.strip()
    out["is_returned"] = ids.isin(returned_ids)
    out["return_qty"] = out["is_returned"].astype(int)

    return out.reindex(columns=STANDARD_COLUMNS)


def normalize_schema_b(raw: pd.DataFrame, month: str) -> pd.DataFrame:
    out = pd.DataFrame(index=raw.index)
    for target, source in SCHEMA_B_MAP.items():
        out[target] = raw[source] if source in raw.columns else None

    out["month"] = month
    out["source_schema"] = "B"
    out["order_time"] = _parse_date(out["order_time"])
    out["ship_date"] = _parse_date(out["ship_date"])
    out["product_price"] = _parse_amount(out["product_price"])
    # this file is pre-filtered to returns only — every row here is a return.
    out["return_qty"] = 1
    out["is_returned"] = True

    return out.reindex(columns=STANDARD_COLUMNS)


NORMALIZERS = {"A": normalize_schema_a, "B": normalize_schema_b}


def normalize(raw: pd.DataFrame, schema: str, month: str, **kwargs) -> pd.DataFrame:
    raw = _clean_str_cols(raw.copy())
    if schema == "C":
        return normalize_schema_c(raw, month, kwargs["returned_ids"])
    return NORMALIZERS[schema](raw, month)
