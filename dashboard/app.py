"""Dashboard สินค้าตีกลับ ปี 2569 — PT Glory Interplus.

Run:
    streamlit run dashboard/app.py

Reads the combined dataset from the local DuckDB file produced by
pipeline/combine_returns.py (config.DUCKDB_PATH / config.DUCKDB_TABLE).
"""

import os
import sys

import duckdb
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from config import DUCKDB_PATH, DUCKDB_TABLE  # noqa: E402

# --- CI PT Glory — validated with dataviz/scripts/validate_palette.js ---
# "#D34B82,#9C5A2E" passes all six categorical checks (light mode).
PRIMARY = "#D34B82"       # ชมพู (สีหลัก) — ใช้กับเมตริก/กราฟที่เป็นตัวเด่น (% ตีกลับ)
SECONDARY = "#9C5A2E"     # น้ำตาล (ปรับจาก CI #492E18 ให้ผ่านเกณฑ์ contrast/chroma) — ใช้กับปริมาณ/บริบท
DARK_TEXT = "#492E18"     # สี CI ต้นฉบับ ใช้เป็นสีตัวอักษร/หัวข้อเท่านั้น (ไม่ใช่สีข้อมูลในกราฟ)
BG = "#FFFBFC"
CARD_BG = "#FFFFFF"
GRID = "#EFE3E8"

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-01.png")
MIN_ORDERS_FOR_RATE = 30  # ตัดจังหวัด/พนักงานขายที่ออเดอร์น้อยเกินไป (% ตีกลับ ผันผวนไม่มีนัยสำคัญ)

st.set_page_config(page_title="Dashboard สินค้าตีกลับ 2569 - PT Glory", page_icon="🎀", layout="wide")

st.markdown(
    f"""
    <style>
    .stApp {{ background-color: {BG}; }}
    [data-testid="stMetric"] {{
        background-color: {CARD_BG};
        border: 1px solid {GRID};
        border-radius: 10px;
        padding: 12px 16px;
    }}
    [data-testid="stMetricLabel"] {{ color: {DARK_TEXT}; }}
    [data-testid="stMetricValue"] {{ color: {PRIMARY}; font-size: 1.5rem; }}
    h1, h2, h3 {{ color: {DARK_TEXT}; }}
    section[data-testid="stSidebar"] {{ background-color: {CARD_BG}; }}
    </style>
    """,
    unsafe_allow_html=True,
)


def chart_layout(fig: go.Figure, title: str, yaxis_title: str = "") -> go.Figure:
    fig.update_layout(
        title=title,
        yaxis_title=yaxis_title,
        xaxis_title="",
        plot_bgcolor=CARD_BG,
        paper_bgcolor=CARD_BG,
        font_color=DARK_TEXT,
        hovermode="x unified",
        margin=dict(t=48, l=10, r=10, b=10),
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor=GRID, zeroline=False)
    return fig


@st.cache_data(ttl=300)
def load_data() -> pd.DataFrame:
    con = duckdb.connect(DUCKDB_PATH, read_only=True)
    df = con.execute(f"SELECT * FROM {DUCKDB_TABLE}").df()
    con.close()
    df["order_time"] = pd.to_datetime(df["order_time"], errors="coerce")
    # collapse "Flash Express TH_13" / "Flash Express Thailand" -> "Flash Express"
    df["transport_company_group"] = (
        df["transport_company"].fillna("ไม่ระบุ").str.replace(r"\s*(TH_?\d+|Thailand)$", "", regex=True).str.strip()
    )
    df.loc[df["transport_company_group"] == "", "transport_company_group"] = "ไม่ระบุ"
    return df


def rate_table(data: pd.DataFrame, group_col: str, min_orders: int = 0) -> pd.DataFrame:
    out = (
        data.groupby(group_col)
        .agg(orders=(group_col, "size"), returns=("is_returned", "sum"))
        .reset_index()
    )
    out["rate"] = (out["returns"] / out["orders"] * 100).round(2)
    return out[out["orders"] >= min_orders]


df = load_data()

with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, width=140)
    st.markdown("### ตัวกรอง")

    months = sorted(df["month"].dropna().unique())
    selected_months = st.multiselect("เดือน", months, default=months)

    channels = sorted(df["sales_channel"].dropna().unique())
    selected_channels = st.multiselect("ช่องทางขาย", channels, default=channels)

    transports = sorted(df["transport_company_group"].dropna().unique())
    selected_transports = st.multiselect("บริษัทขนส่ง", transports, default=transports)

filtered = df[df["month"].isin(selected_months)]
if selected_channels:
    filtered = filtered[filtered["sales_channel"].isin(selected_channels) | filtered["sales_channel"].isna()]
if selected_transports:
    filtered = filtered[filtered["transport_company_group"].isin(selected_transports)]

st.title("📊 Dashboard สินค้าตีกลับ ปี 2569")
st.caption("PT Glory Interplus — ข้อมูลรวมจากชีต Google Sheets รายเดือน")

# --- KPI + MoM (เทียบเดือนล่าสุดที่เลือก กับเดือนก่อนหน้าในตัวกรอง) ---
selected_sorted = sorted(selected_months)
cur_month = selected_sorted[-1] if selected_sorted else None
prev_month = selected_sorted[-2] if len(selected_sorted) >= 2 else None

def month_stats(month: str) -> dict:
    sub = filtered[filtered["month"] == month]
    orders = len(sub)
    returns = int(sub["is_returned"].sum())
    rate = (returns / orders * 100) if orders else 0.0
    value = sub.loc[sub["is_returned"], "product_price"].sum()
    return {"orders": orders, "returns": returns, "rate": rate, "value": value}

total_orders = len(filtered)
total_returns = int(filtered["is_returned"].sum())
return_rate = (total_returns / total_orders * 100) if total_orders else 0.0
returned_value = filtered.loc[filtered["is_returned"], "product_price"].sum()

deltas = {"orders": None, "returns": None, "rate": None, "value": None}
if prev_month:
    cur = month_stats(cur_month)
    prev = month_stats(prev_month)
    deltas = {
        "orders": cur["orders"] - prev["orders"],
        "returns": cur["returns"] - prev["returns"],
        "rate": round(cur["rate"] - prev["rate"], 2),
        "value": cur["value"] - prev["value"],
    }
    st.caption(f"เทียบ MoM: {cur_month} vs {prev_month}")

col1, col2, col3, col4 = st.columns(4)
col1.metric("ออเดอร์ทั้งหมด", f"{total_orders:,}", None if deltas["orders"] is None else f"{deltas['orders']:+,}")
col2.metric(
    "ตีกลับ", f"{total_returns:,}",
    None if deltas["returns"] is None else f"{deltas['returns']:+,}",
    delta_color="inverse",
)
col3.metric(
    "% ตีกลับ", f"{return_rate:.2f}%",
    None if deltas["rate"] is None else f"{deltas['rate']:+.2f} จุด",
    delta_color="inverse",
)
col4.metric(
    "มูลค่าสินค้าตีกลับ (ลบ.)", f"{returned_value / 1_000_000:,.2f}",
    None if deltas["value"] is None else f"{deltas['value'] / 1_000_000:+,.2f}",
    delta_color="inverse",
)

st.divider()

tab_overview, tab_channel, tab_geo, tab_table, tab_raw = st.tabs(
    ["ภาพรวม", "ช่องทาง & ขนส่ง", "พื้นที่ & พนักงานขาย", "ตารางสรุป", "ข้อมูลดิบ"]
)

monthly = rate_table(filtered, "month").sort_values("month")

with tab_overview:
    c1, c2, c3 = st.columns(3)
    with c1:
        fig = px.bar(monthly, x="month", y="orders", color_discrete_sequence=[SECONDARY])
        st.plotly_chart(chart_layout(fig, "ออเดอร์ทั้งหมด รายเดือน", "จำนวนออเดอร์"), use_container_width=True)
    with c2:
        fig = px.bar(monthly, x="month", y="returns", color_discrete_sequence=[PRIMARY])
        st.plotly_chart(chart_layout(fig, "ตีกลับ รายเดือน", "จำนวนตีกลับ"), use_container_width=True)
    with c3:
        fig = px.line(monthly, x="month", y="rate", markers=True, text="rate", color_discrete_sequence=[PRIMARY])
        fig.update_traces(texttemplate="%{text}%", textposition="top center")
        st.plotly_chart(chart_layout(fig, "% ตีกลับ รายเดือน", "% ตีกลับ"), use_container_width=True)

    top_products = (
        filtered[filtered["is_returned"]]
        .groupby("product_name")
        .size()
        .sort_values(ascending=False)
        .head(10)
        .reset_index(name="returns")
        .sort_values("returns")
    )
    fig_products = px.bar(
        top_products, x="returns", y="product_name", orientation="h",
        color_discrete_sequence=[PRIMARY],
    )
    st.plotly_chart(
        chart_layout(fig_products, "สินค้าที่ถูกตีกลับมากที่สุด (Top 10)", "จำนวนครั้งที่ตีกลับ"),
        use_container_width=True,
    )

with tab_channel:
    col_a, col_b = st.columns(2)
    with col_a:
        by_channel = rate_table(filtered, "sales_channel").sort_values("rate", ascending=False)
        fig = px.bar(by_channel, x="sales_channel", y="rate", text="rate", color_discrete_sequence=[PRIMARY])
        fig.update_traces(texttemplate="%{text}%", textposition="outside")
        st.plotly_chart(chart_layout(fig, "% ตีกลับ ตามช่องทางขาย", "% ตีกลับ"), use_container_width=True)
    with col_b:
        by_transport = (
            rate_table(filtered, "transport_company_group").sort_values("rate", ascending=False).head(10)
        )
        fig = px.bar(by_transport, x="transport_company_group", y="rate", text="rate", color_discrete_sequence=[SECONDARY])
        fig.update_traces(texttemplate="%{text}%", textposition="outside")
        st.plotly_chart(
            chart_layout(fig, "% ตีกลับ ตามบริษัทขนส่ง (Top 10)", "% ตีกลับ"), use_container_width=True
        )

with tab_geo:
    st.caption(f"แสดงเฉพาะกลุ่มที่มีออเดอร์ >= {MIN_ORDERS_FOR_RATE} รายการ ในช่วงที่กรองไว้ เพื่อลด noise จากฐานเล็กเกินไป")
    col_a, col_b = st.columns(2)
    with col_a:
        by_province = (
            rate_table(filtered, "province", MIN_ORDERS_FOR_RATE).sort_values("rate", ascending=False).head(10)
        )
        fig = px.bar(
            by_province.sort_values("rate"), x="rate", y="province", orientation="h", text="rate",
            color_discrete_sequence=[PRIMARY],
        )
        fig.update_traces(texttemplate="%{text}%", textposition="outside")
        st.plotly_chart(chart_layout(fig, "% ตีกลับ ตามจังหวัด (Top 10)", "% ตีกลับ"), use_container_width=True)
    with col_b:
        by_sales = (
            rate_table(filtered, "salesperson", MIN_ORDERS_FOR_RATE).sort_values("rate", ascending=False).head(10)
        )
        fig = px.bar(
            by_sales.sort_values("rate"), x="rate", y="salesperson", orientation="h", text="rate",
            color_discrete_sequence=[SECONDARY],
        )
        fig.update_traces(texttemplate="%{text}%", textposition="outside")
        st.plotly_chart(
            chart_layout(fig, "% ตีกลับ ตามพนักงานขาย (Top 10)", "% ตีกลับ"), use_container_width=True
        )

with tab_table:
    st.markdown("#### สรุปตามร้านค้า")
    shop_summary = rate_table(filtered, "shop").sort_values("orders", ascending=False)
    shop_summary.columns = ["ร้านค้า", "ออเดอร์", "ตีกลับ", "% ตีกลับ"]
    st.dataframe(shop_summary, use_container_width=True, hide_index=True)

    st.markdown("#### สรุปตามวิธีการชำระเงิน")
    pay_summary = rate_table(filtered, "payment_method").sort_values("orders", ascending=False)
    pay_summary.columns = ["วิธีการชำระเงิน", "ออเดอร์", "ตีกลับ", "% ตีกลับ"]
    st.dataframe(pay_summary, use_container_width=True, hide_index=True)

    st.markdown("#### สรุปตามเดือน x ช่องทางขาย (% ตีกลับ)")
    pivot = filtered.pivot_table(
        index="month", columns="sales_channel", values="is_returned", aggfunc="mean"
    ).mul(100).round(2)
    st.dataframe(pivot, use_container_width=True)

with tab_raw:
    st.dataframe(filtered, use_container_width=True)
    st.download_button(
        "ดาวน์โหลด CSV (หลังกรอง)",
        filtered.to_csv(index=False).encode("utf-8-sig"),
        file_name="returns_2569_filtered.csv",
        mime="text/csv",
    )
