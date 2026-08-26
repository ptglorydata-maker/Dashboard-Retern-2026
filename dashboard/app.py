"""Dashboard สินค้าตีกลับ ปี 2569 — PT Glory Interplus.

Run:
    streamlit run dashboard/app.py

Reads the combined dataset from the local DuckDB file produced by
pipeline/combine_returns.py (config.DUCKDB_PATH / config.DUCKDB_TABLE) when
that file exists (local dev). Otherwise — e.g. on Streamlit Community
Cloud, where there's no local file — it pulls straight from Google Sheets
using the same pipeline code, authenticated via st.secrets (see
pipeline/auth.py and README's deployment section).
Dark theme lives in .streamlit/config.toml (native widget theming) plus
the CSS block below (custom KPI cards, chart chrome).
"""

import os
import sys

import duckdb
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from auth import get_gspread_client  # noqa: E402
from combine_returns import build_combined_dataframe  # noqa: E402
from config import DUCKDB_PATH, DUCKDB_TABLE  # noqa: E402

# --- ธีมมืด เน้นชมพู CI — validated with dataviz/scripts/validate_palette.js ---
# ปรับความสว่างของชมพูแบรนด์ (#D34B82) ให้สดขึ้นสำหรับพื้นหลังมืด (แนวทาง "dark mode
# คือคนละสเต็ปของเรมป์เดียวกัน" ไม่ใช่กลับสีอัตโนมัติ) แล้ว contrast-check กับพื้นมืดใหม่
APP_BG = "#241B26"
CARD_BG = "#2F2531"
CARD_BORDER = "#4E3E4B"
TEXT = "#F5EDF0"
TEXT_MUTED = "#C6B7C2"
PRIMARY = "#FF6FA5"       # ชมพูสดหลัก — ตัวเด่น/บวก
NEUTRAL = "#B9A7B0"       # เทาอมชมพู — บริบท/ปริมาณ (แทนน้ำตาล CI เดิมบนพื้นมืด)
NEGATIVE = "#F4407E"      # ชมพูเข้ม/แดง — ใช้เฉพาะตอนหมายถึง "แย่ลง" (ตีกลับเพิ่ม)
GRID = "#413240"
# แรมป์ชมพูโทนเดียว (light -> dark) สำหรับโดนัท/หลายหมวดหมู่ — ใส่ direct label กำกับ
# เสมอ เพราะ hue เดียวกันแยก identity ด้วยสีอย่างเดียวไม่ได้ (ตามคำขอ "ใช้สี CI ชมพูเป็นหลัก")
PINK_RAMP = ["#FFD1E3", "#FF9EC4", "#FF6FA5", "#E23F76", "#B23A67", "#7A2648"]

BADGE_COLORS = [PRIMARY, NEGATIVE, "#E37AA0", "#B23A67"]
KPI_ICONS = ["📦", "↩️", "📉", "💸"]

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-01.png")
MIN_ORDERS_FOR_RATE = 30  # ตัดจังหวัด/พนักงานขายที่ออเดอร์น้อยเกินไป (% ตีกลับ ผันผวนไม่มีนัยสำคัญ)
ALL_OPTION = "ทั้งหมด"

THAI_MONTHS_FULL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]
THAI_MONTHS_ABBR = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]


def thai_month(month_str: str, abbr: bool = False) -> str:
    """'2026-01' -> 'มกราคม 69' (พ.ศ. 2 หลัก) ใช้แสดงในตัวกรอง/แกนกราฟ/หัวข้อ"""
    year, mo = month_str.split("-")
    be_2digit = (int(year) + 543) % 100
    name = (THAI_MONTHS_ABBR if abbr else THAI_MONTHS_FULL)[int(mo) - 1]
    return f"{name} {be_2digit}"


st.set_page_config(page_title="Dashboard สินค้าตีกลับ 2569 - PT Glory", page_icon="🎀", layout="wide")

st.markdown(
    """
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <style>
    html, body, [class*="st-"], [class*="css-"], .stApp, .stApp * {{
        font-family: 'Kanit', sans-serif !important;
    }}
    .stApp {{ background-color: {APP_BG}; }}
    .block-container {{ padding-top: 1.2rem; max-width: 1450px; }}
    h1 {{ color: {TEXT}; font-weight: 700; }}
    h2, h3, h4 {{ color: {TEXT}; font-weight: 600; }}
    p, .stCaption, [data-testid="stCaptionContainer"] {{ color: {TEXT_MUTED}; }}
    section[data-testid="stSidebar"] {{ background-color: {CARD_BG}; border-right: 1px solid {CARD_BORDER}; }}
    div[data-baseweb="tab-highlight"] {{ background-color: {PRIMARY}; }}
    button[data-baseweb="tab"][aria-selected="true"] {{ color: {PRIMARY}; }}
    [data-testid="stDataFrame"] {{ border: 1px solid {CARD_BORDER}; border-radius: 10px; }}
    hr {{ border-color: {CARD_BORDER}; }}
    /* ตัวเลขใช้ Roboto ตามที่ขอ — ทับ Kanit เฉพาะจุดที่เป็นตัวเลขล้วน */
    .kpi-value, .kpi-delta, .num-font {{ font-family: 'Roboto', sans-serif !important; }}

    /* --- navbar บนสุด --- */
    .topbar {{
        display: flex; align-items: center; justify-content: space-between;
        background: linear-gradient(135deg, {CARD_BG} 0%, #3A2C3C 100%);
        border: 1px solid {CARD_BORDER};
        border-radius: 16px;
        padding: 14px 22px;
        margin-bottom: 18px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.25);
    }}
    .topbar-title {{ display: flex; align-items: center; gap: 12px; }}
    .topbar-title .emoji {{ font-size: 1.6rem; }}
    .topbar-title h1 {{ margin: 0; font-size: 1.3rem; }}
    .topbar-title .sub {{ color: {TEXT_MUTED}; font-size: 0.78rem; margin-top: 2px; }}
    .topbar-pill {{
        display: flex; align-items: center; gap: 6px;
        background: rgba(255,111,165,0.12);
        border: 1px solid rgba(255,111,165,0.35);
        color: {PRIMARY}; font-size: 0.78rem; font-weight: 500;
        padding: 6px 14px; border-radius: 999px;
    }}
    .topbar-pill .dot {{
        width: 7px; height: 7px; border-radius: 50%; background: #3DD68C;
        box-shadow: 0 0 6px #3DD68C;
    }}

    /* --- การ์ด KPI: เงา/glow ตามสีไอคอนของการ์ดนั้น + ทำให้กะทัดรัดขึ้น --- */
    .kpi-card {{
        background: linear-gradient(160deg, {CARD_BG} 0%, #382C38 100%);
        border: 1px solid {CARD_BORDER};
        border-radius: 14px;
        padding: 14px 16px 6px 16px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.22);
        transition: box-shadow 0.15s ease;
    }}
    .kpi-top {{ display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }}
    .kpi-icon {{
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px;
    }}
    .kpi-label {{ color: {TEXT_MUTED}; font-size: 0.8rem; }}
    .kpi-value {{ color: {TEXT}; font-size: 1.45rem; font-weight: 700; line-height: 1.15; }}
    .kpi-delta {{ font-size: 0.78rem; margin-top: 1px; }}
    .kpi-delta.up {{ color: #3DD68C; }}
    .kpi-delta.down {{ color: {NEGATIVE}; }}
    .kpi-sub {{ color: {TEXT_MUTED}; font-size: 0.7rem; margin-bottom: 4px; }}
    .kpi-spark {{ margin: 4px -2px -2px -2px; }}

    /* --- ห่อกราฟ Plotly ให้เป็นการ์ดมีเงา/ขอบ เหมือนการ์ด KPI --- */
    [data-testid="stPlotlyChart"] {{
        background: linear-gradient(160deg, {CARD_BG} 0%, #322732 100%);
        border: 1px solid {CARD_BORDER};
        border-radius: 14px;
        padding: 6px 10px 2px 10px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.22);
    }}
    </style>
    """,
    unsafe_allow_html=True,
)


def sparkline_svg(values: list[float], color: str, width: int = 220, height: int = 44) -> str:
    """แท่ง/เส้นเทรนด์เล็ก ๆ แบบ inline SVG ไม่ต้องพึ่ง component chart จะได้ต่อกับการ์ด HTML ได้สนิท"""
    if len(values) < 2 or max(values) == min(values):
        y = height / 2
        points = f"0,{y} {width},{y}"
    else:
        lo, hi = min(values), max(values)
        step = width / (len(values) - 1)
        points = " ".join(
            f"{i * step:.1f},{height - 4 - (v - lo) / (hi - lo) * (height - 8):.1f}"
            for i, v in enumerate(values)
        )
    area = f"0,{height} {points} {width},{height}"
    return f"""
    <svg width="100%" height="{height}" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
        <polygon points="{area}" fill="{color}" opacity="0.15"></polygon>
        <polyline points="{points}" fill="none" stroke="{color}" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
    """


def kpi_card(label: str, value: str, delta: float | None, delta_fmt: str, icon: str, badge: str, spark: list[float]) -> str:
    if delta is None:
        delta_html = '<div class="kpi-delta">&nbsp;</div>'
    else:
        cls = "up" if delta >= 0 else "down"
        arrow = "▲" if delta >= 0 else "▼"
        delta_html = f'<div class="kpi-delta {cls}">{arrow} {delta_fmt}</div>'
    return f"""
    <div class="kpi-card" style="border-top: 3px solid {badge}; box-shadow: 0 6px 20px rgba(0,0,0,0.22), 0 0 16px {badge}22;">
        <div class="kpi-top">
            <span class="kpi-icon" style="background:{badge}26; color:{badge}; box-shadow: 0 0 10px {badge}40;">{icon}</span>
            <span class="kpi-label">{label}</span>
        </div>
        <div class="kpi-value">{value}</div>
        {delta_html}
        <div class="kpi-spark">{sparkline_svg(spark, badge)}</div>
    </div>
    """


def chart_layout(fig: go.Figure, title: str, yaxis_title: str = "") -> go.Figure:
    fig.update_layout(
        title=dict(text=title, font=dict(color=TEXT, size=15, family="Kanit, sans-serif")),
        yaxis_title=yaxis_title,
        xaxis_title="",
        plot_bgcolor=CARD_BG,
        paper_bgcolor=CARD_BG,
        font=dict(color=TEXT_MUTED, family="Kanit, sans-serif"),
        hovermode="x unified",
        margin=dict(t=48, l=10, r=10, b=10),
        legend=dict(font=dict(color=TEXT_MUTED, family="Kanit, sans-serif")),
    )
    # แกนตัวเลข (ค่า/สัดส่วน) ใช้ Roboto ตามที่ขอ, แกนที่เป็นข้อความ (หมวดหมู่/เดือนไทย) ใช้ Kanit
    fig.update_xaxes(showgrid=False, color=TEXT_MUTED, tickfont=dict(family="Kanit, sans-serif"))
    fig.update_yaxes(
        showgrid=True, gridcolor=GRID, zeroline=False, color=TEXT_MUTED,
        tickfont=dict(family="Roboto, sans-serif"),
    )
    return fig


@st.cache_data(ttl=1800)  # 30 นาที — บน Cloud fallback คือดึงจาก Sheets ตรง ๆ ทุกครั้งที่หมดอายุ แคชนานหน่อยกันโหลดถี่เกิน
def load_data() -> pd.DataFrame:
    if os.path.exists(DUCKDB_PATH):
        # เครื่อง local ที่รัน pipeline/combine_returns.py ไว้แล้ว — อ่านจากไฟล์ที่มีอยู่ (เร็ว)
        con = duckdb.connect(DUCKDB_PATH, read_only=True)
        df = con.execute(f"SELECT * FROM {DUCKDB_TABLE}").df()
        con.close()
    else:
        # Streamlit Cloud (หรือเครื่องที่ยังไม่เคยรัน pipeline) — ไม่มีไฟล์ DuckDB ให้อ่าน
        # ดึงจาก Google Sheets ตรง ๆ แทน ใช้ credential จาก st.secrets (ดู pipeline/auth.py)
        gc = get_gspread_client()
        df = build_combined_dataframe(gc, verbose=False)
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


def sales_table(data: pd.DataFrame, group_col: str) -> pd.DataFrame:
    out = (
        data.groupby(group_col)
        .agg(orders=(group_col, "size"), revenue=("product_price", "sum"), returns=("is_returned", "sum"))
        .reset_index()
    )
    out["rate"] = (out["returns"] / out["orders"] * 100).round(2)
    return out.sort_values("revenue", ascending=False)


df = load_data()

with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, width=140)
    st.markdown("### ตัวกรอง")

    months = sorted(df["month"].dropna().unique())
    selected_month_opt = st.selectbox(
        "เดือน", [ALL_OPTION] + months,
        format_func=lambda m: "ทั้งหมด (ม.ค.-ก.ค. 69)" if m == ALL_OPTION else thai_month(m),
    )

    channels = sorted(df["sales_channel"].dropna().unique())
    selected_channel_opt = st.selectbox("ช่องทางขาย", [ALL_OPTION] + channels)

    transports = sorted(df["transport_company_group"].dropna().unique())
    selected_transport_opt = st.selectbox("บริษัทขนส่ง", [ALL_OPTION] + transports)

# กรองตามช่องทาง/ขนส่งก่อน (ไม่รวมเดือน) ไว้เป็นฐานสำหรับกราฟเทรนด์ + คำนวณ MoM
# ให้ยังเทียบกับเดือนก่อนหน้าได้ถูกต้อง แม้ตัวกรองเดือนจะเลือกแค่เดือนเดียว
base = df.copy()
if selected_channel_opt != ALL_OPTION:
    base = base[base["sales_channel"] == selected_channel_opt]
if selected_transport_opt != ALL_OPTION:
    base = base[base["transport_company_group"] == selected_transport_opt]

if selected_month_opt == ALL_OPTION:
    filtered = base
    cur_month = months[-1] if months else None
else:
    filtered = base[base["month"] == selected_month_opt]
    cur_month = selected_month_opt

month_idx = months.index(cur_month) if cur_month in months else -1
prev_month = months[month_idx - 1] if month_idx > 0 else None

_range_label = "ม.ค.-ก.ค. 69" if selected_month_opt == ALL_OPTION else thai_month(selected_month_opt)
st.markdown(
    f"""
    <div class="topbar">
        <div class="topbar-title">
            <span class="emoji">📊</span>
            <div>
                <h1>Dashboard สินค้าตีกลับ ปี 2569</h1>
                <div class="sub">PT Glory Interplus — ข้อมูลรวมจากชีต Google Sheets รายเดือน</div>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <span class="topbar-pill">🗓️ {_range_label}</span>
            <span class="topbar-pill"><span class="dot"></span> Live</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# --- ข้อมูลรายเดือนแบบเต็ม (ไม่ตัดตามตัวกรองเดือน) ใช้กับกราฟเทรนด์และ sparkline การ์ด KPI ---
monthly = rate_table(base, "month").sort_values("month")
monthly["value"] = (
    base[base["is_returned"]].groupby("month")["product_price"].sum().reindex(monthly["month"]).fillna(0).values
)
monthly["month_label"] = monthly["month"].apply(lambda m: thai_month(m, abbr=True))


def month_stats(month: str) -> dict:
    sub = base[base["month"] == month]
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
    st.caption(f"เทียบ MoM: {thai_month(cur_month)} vs {thai_month(prev_month)}")

kc1, kc2, kc3, kc4 = st.columns(4)
kc1.markdown(
    kpi_card(
        "ออเดอร์ทั้งหมด", f"{total_orders:,}",
        deltas["orders"], f"{deltas['orders']:+,}" if deltas["orders"] is not None else "",
        KPI_ICONS[0], BADGE_COLORS[0], monthly["orders"].tolist(),
    ),
    unsafe_allow_html=True,
)
kc2.markdown(
    kpi_card(
        "ตีกลับ", f"{total_returns:,}",
        -deltas["returns"] if deltas["returns"] is not None else None,  # เพิ่มขึ้น = แย่ลง กลับทิศลูกศร
        f"{deltas['returns']:+,}" if deltas["returns"] is not None else "",
        KPI_ICONS[1], BADGE_COLORS[1], monthly["returns"].tolist(),
    ),
    unsafe_allow_html=True,
)
kc3.markdown(
    kpi_card(
        "% ตีกลับ", f"{return_rate:.2f}%",
        -deltas["rate"] if deltas["rate"] is not None else None,
        f"{deltas['rate']:+.2f} จุด" if deltas["rate"] is not None else "",
        KPI_ICONS[2], BADGE_COLORS[2], monthly["rate"].tolist(),
    ),
    unsafe_allow_html=True,
)
kc4.markdown(
    kpi_card(
        "มูลค่าสินค้าตีกลับ (ลบ.)", f"{returned_value / 1_000_000:,.2f}",
        -deltas["value"] if deltas["value"] is not None else None,
        f"{deltas['value'] / 1_000_000:+,.2f}" if deltas["value"] is not None else "",
        KPI_ICONS[3], BADGE_COLORS[3], (monthly["value"] / 1_000_000).tolist(),
    ),
    unsafe_allow_html=True,
)

st.divider()

tab_overview, tab_channel, tab_geo, tab_table, tab_raw = st.tabs(
    ["ภาพรวม", "ช่องทาง & ขนส่ง", "พื้นที่ & พนักงานขาย", "ตารางสรุป", "ข้อมูลดิบ"]
)

with tab_overview:
    # --- กราฟหลัก: ออเดอร์ (พื้นที่ gradient) + ตีกลับ (เส้น) หน่วยเดียวกัน (จำนวนออเดอร์) แกนเดียว ---
    fig_hero = go.Figure()
    fig_hero.add_trace(
        go.Scatter(
            x=monthly["month_label"], y=monthly["orders"], name="ออเดอร์ทั้งหมด",
            mode="lines", line=dict(color=NEUTRAL, width=2),
            fill="tozeroy", fillcolor="rgba(185,167,176,0.12)",
        )
    )
    fig_hero.add_trace(
        go.Scatter(
            x=monthly["month_label"], y=monthly["returns"], name="ตีกลับ",
            mode="lines+markers", line=dict(color=PRIMARY, width=3),
            fill="tozeroy", fillcolor="rgba(255,111,165,0.18)",
            marker=dict(size=6),
        )
    )
    st.plotly_chart(
        chart_layout(fig_hero, "ออเดอร์ทั้งหมด vs ตีกลับ รายเดือน", "จำนวนออเดอร์"),
        use_container_width=True,
    )

    col_donut, col_products = st.columns([1, 1.4])
    with col_donut:
        by_channel_orders = filtered.groupby("sales_channel").size().reset_index(name="orders")
        by_channel_orders = by_channel_orders.sort_values("orders", ascending=False)
        fig_donut = px.pie(
            by_channel_orders, names="sales_channel", values="orders", hole=0.62,
            color_discrete_sequence=PINK_RAMP,
        )
        fig_donut.update_traces(textinfo="label+percent", textfont_color=TEXT)
        fig_donut.update_layout(
            title=dict(text="สัดส่วนออเดอร์ตามช่องทางขาย", font=dict(color=TEXT, size=15)),
            plot_bgcolor=CARD_BG, paper_bgcolor=CARD_BG,
            font_color=TEXT_MUTED, showlegend=False,
            margin=dict(t=48, l=10, r=10, b=10),
        )
        st.plotly_chart(fig_donut, use_container_width=True)

    with col_products:
        top_products = (
            filtered[filtered["is_returned"]]
            .groupby("product_name")
            .size()
            .sort_values(ascending=False)
            .head(8)
            .reset_index(name="returns")
            .sort_values("returns")
        )
        fig_products = px.bar(
            top_products, x="returns", y="product_name", orientation="h",
            color_discrete_sequence=[PRIMARY],
        )
        st.plotly_chart(
            chart_layout(fig_products, "สินค้าที่ถูกตีกลับมากที่สุด (Top 8)", "จำนวนครั้งที่ตีกลับ"),
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
        fig = px.bar(by_transport, x="transport_company_group", y="rate", text="rate", color_discrete_sequence=[NEUTRAL])
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
            color_discrete_sequence=[NEUTRAL],
        )
        fig.update_traces(texttemplate="%{text}%", textposition="outside")
        st.plotly_chart(
            chart_layout(fig, "% ตีกลับ ตามพนักงานขาย (Top 10)", "% ตีกลับ"), use_container_width=True
        )

    st.markdown("#### จัดอันดับพนักงานขาย ตามยอดขายรวม")
    st.caption(
        "เรียงตามยอดขายรวม (ไม่กรองด้วยเกณฑ์ใด ๆ) — ระวังชื่อที่มีคำว่า \"เทส\"/\"ทดสอบ\" "
        "หรือ shop = Venorra(สินค้าเทส) คือข้อมูลทดสอบระบบ ไม่ใช่ยอดขายจริง"
    )
    sales_rank = sales_table(filtered, "salesperson")
    sales_rank.insert(0, "อันดับ", range(1, len(sales_rank) + 1))
    sales_rank.columns = ["อันดับ", "พนักงานขาย", "ออเดอร์", "ยอดขายรวม (บาท)", "ตีกลับ", "% ตีกลับ"]
    st.dataframe(sales_rank, use_container_width=True, hide_index=True, height=400)

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
    pivot.index = pivot.index.map(thai_month)
    st.dataframe(pivot, use_container_width=True)

with tab_raw:
    st.dataframe(filtered, use_container_width=True)
    st.download_button(
        "ดาวน์โหลด CSV (หลังกรอง)",
        filtered.to_csv(index=False).encode("utf-8-sig"),
        file_name="returns_2569_filtered.csv",
        mime="text/csv",
    )
