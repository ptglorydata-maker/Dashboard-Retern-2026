"""Dashboard สินค้าตีกลับ ปี 2569 — PT Glory Interplus.

Run:
    streamlit run dashboard/app.py

Reads the combined dataset from the local DuckDB file produced by
pipeline/combine_returns.py (config.DUCKDB_PATH / config.DUCKDB_TABLE).
"""

import os
import re
import sys

import duckdb
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from config import DUCKDB_PATH, DUCKDB_TABLE  # noqa: E402

# --- CI PT Glory ---
PRIMARY = "#D34B82"       # ชมพู (สีหลัก)
DARK = "#492E18"          # น้ำตาลเข้ม (สีรอง)
LIGHT_PINK = "#F2C6DA"
MED_BROWN = "#8C5B3F"
BG = "#FFFBFC"
CARD_BG = "#FFFFFF"
CATEGORICAL = [PRIMARY, DARK, "#EFA0C1", MED_BROWN, "#F6D9E6", "#6E4A2E"]

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-01.png")

st.set_page_config(page_title="Dashboard สินค้าตีกลับ 2569 - PT Glory", page_icon="🎀", layout="wide")

st.markdown(
    f"""
    <style>
    .stApp {{ background-color: {BG}; }}
    [data-testid="stMetric"] {{
        background-color: {CARD_BG};
        border: 1px solid {LIGHT_PINK};
        border-radius: 10px;
        padding: 12px 16px;
    }}
    [data-testid="stMetricLabel"] {{ color: {DARK}; }}
    [data-testid="stMetricValue"] {{ color: {PRIMARY}; font-size: 1.6rem; }}
    h1, h2, h3 {{ color: {DARK}; }}
    section[data-testid="stSidebar"] {{ background-color: {CARD_BG}; }}
    </style>
    """,
    unsafe_allow_html=True,
)


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

total_orders = len(filtered)
total_returns = int(filtered["is_returned"].sum())
return_rate = (total_returns / total_orders * 100) if total_orders else 0.0
returned_value = filtered.loc[filtered["is_returned"], "product_price"].sum()

col1, col2, col3, col4 = st.columns(4)
col1.metric("ออเดอร์ทั้งหมด", f"{total_orders:,}")
col2.metric("ตีกลับ", f"{total_returns:,}")
col3.metric("% ตีกลับ", f"{return_rate:.2f}%")
col4.metric("มูลค่าสินค้าตีกลับ (ลบ.)", f"{returned_value / 1_000_000:,.2f}")

st.divider()

# --- แนวโน้มรายเดือน ---
monthly = (
    filtered.groupby("month")
    .agg(orders=("month", "size"), returns=("is_returned", "sum"))
    .reset_index()
    .sort_values("month")
)
monthly["rate"] = (monthly["returns"] / monthly["orders"] * 100).round(2)

fig_trend = go.Figure()
fig_trend.add_bar(x=monthly["month"], y=monthly["orders"], name="ออเดอร์ทั้งหมด", marker_color=LIGHT_PINK)
fig_trend.add_bar(x=monthly["month"], y=monthly["returns"], name="ตีกลับ", marker_color=PRIMARY)
fig_trend.add_trace(
    go.Scatter(
        x=monthly["month"], y=monthly["rate"], name="% ตีกลับ",
        mode="lines+markers", yaxis="y2", line=dict(color=DARK, width=3),
    )
)
fig_trend.update_layout(
    title="แนวโน้มออเดอร์ vs ตีกลับ รายเดือน",
    barmode="group",
    yaxis=dict(title="จำนวนออเดอร์"),
    yaxis2=dict(title="% ตีกลับ", overlaying="y", side="right", rangemode="tozero"),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    plot_bgcolor=CARD_BG, paper_bgcolor=CARD_BG,
)
st.plotly_chart(fig_trend, use_container_width=True)

col_a, col_b = st.columns(2)

with col_a:
    by_channel = (
        filtered.groupby("sales_channel")
        .agg(orders=("sales_channel", "size"), returns=("is_returned", "sum"))
        .reset_index()
    )
    by_channel["rate"] = (by_channel["returns"] / by_channel["orders"] * 100).round(2)
    by_channel = by_channel.sort_values("rate", ascending=False)
    fig_channel = px.bar(
        by_channel, x="sales_channel", y="rate", text="rate",
        title="% ตีกลับ ตามช่องทางขาย", color_discrete_sequence=[PRIMARY],
    )
    fig_channel.update_traces(texttemplate="%{text}%", textposition="outside")
    fig_channel.update_layout(yaxis_title="% ตีกลับ", xaxis_title="", plot_bgcolor=CARD_BG, paper_bgcolor=CARD_BG)
    st.plotly_chart(fig_channel, use_container_width=True)

with col_b:
    by_transport = (
        filtered.groupby("transport_company_group")
        .agg(orders=("transport_company_group", "size"), returns=("is_returned", "sum"))
        .reset_index()
    )
    by_transport["rate"] = (by_transport["returns"] / by_transport["orders"] * 100).round(2)
    by_transport = by_transport.sort_values("rate", ascending=False).head(10)
    fig_transport = px.bar(
        by_transport, x="transport_company_group", y="rate", text="rate",
        title="% ตีกลับ ตามบริษัทขนส่ง (Top 10)", color_discrete_sequence=[DARK],
    )
    fig_transport.update_traces(texttemplate="%{text}%", textposition="outside")
    fig_transport.update_layout(yaxis_title="% ตีกลับ", xaxis_title="", plot_bgcolor=CARD_BG, paper_bgcolor=CARD_BG)
    st.plotly_chart(fig_transport, use_container_width=True)

# --- สินค้าตีกลับสูงสุด ---
top_products = (
    filtered[filtered["is_returned"]]
    .groupby("product_name")
    .size()
    .sort_values(ascending=False)
    .head(10)
    .reset_index(name="returns")
)
fig_products = px.bar(
    top_products.sort_values("returns"), x="returns", y="product_name", orientation="h",
    title="สินค้าที่ถูกตีกลับมากที่สุด (Top 10)", color_discrete_sequence=[PRIMARY],
)
fig_products.update_layout(yaxis_title="", xaxis_title="จำนวนครั้งที่ตีกลับ", plot_bgcolor=CARD_BG, paper_bgcolor=CARD_BG)
st.plotly_chart(fig_products, use_container_width=True)

with st.expander("ดูข้อมูลดิบ (หลังกรอง)"):
    st.dataframe(filtered, use_container_width=True)
    st.download_button(
        "ดาวน์โหลด CSV (หลังกรอง)",
        filtered.to_csv(index=False).encode("utf-8-sig"),
        file_name="returns_2569_filtered.csv",
        mime="text/csv",
    )
