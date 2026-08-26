"""Dashboard สินค้าตีกลับ ปี 2569 — PT Glory Interplus.

Run:
    streamlit run dashboard/app.py

Reads the combined dataset from the local DuckDB file produced by
pipeline/combine_returns.py (config.DUCKDB_PATH / config.DUCKDB_TABLE) when
that file exists (local dev). Otherwise — e.g. on Streamlit Community
Cloud, where there's no local file — it pulls straight from Google Sheets
using the same pipeline code, authenticated via st.secrets (see
pipeline/auth.py and README's deployment section).
Light "colorful modern SaaS" theme lives in .streamlit/config.toml (native
widget theming) plus the CSS block below (custom KPI cards, chart chrome).
"""

import math
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

# --- Colorful modern SaaS, light — validated with dataviz/scripts/validate_palette.js ---
# Base categorical hues are the dataviz skill's documented default palette
# (references/palette.md), which ships pre-validated for the CVD/contrast
# checks. PT Glory's brand pink is layered in as the one recurring "this is
# the return-rate story" accent (validated as a pair against blue below),
# not mixed into the general categorical rotation.
APP_BG = "#F5F6FA"
CARD_BG = "#FFFFFF"
CARD_BORDER = "#E7E9F0"
TEXT = "#161B22"
TEXT_MUTED = "#6B7280"
PRIMARY = "#D34B82"       # ชมพูแบรนด์ PT Glory — ใช้ซ้ำเฉพาะเรื่อง "ตีกลับ" ให้เป็นเส้นเรื่องเดียว
POSITIVE = "#1BAF7A"
NEGATIVE = "#E34948"
GRID = "#EEF0F5"

# บัตร KPI ทั้ง 4 ใบ: validated all-pairs (คนกวาดตาเห็นพร้อมกันทั้งแถว)
BADGE_COLORS = ["#2A78D6", "#EB6834", "#1BAF7A", "#4A3AA7"]
KPI_ICONS = ["📦", "↩️", "📉", "💸"]
# กราฟ bar เดี่ยว (นับเป็น 1 series ต่อกราฟ ไม่ต้องกัน CVD ระหว่างกราฟ) — ไล่สีให้แต่ละ
# มุมมองมีโทนของตัวเอง ส่วน "% ตีกลับ" ที่เป็นพระเอกของแดชบอร์ดนี้คงสีชมพูแบรนด์ไว้เสมอ
CHART_CHANNEL = PRIMARY
CHART_TRANSPORT = "#2A78D6"
CHART_PROVINCE = "#1BAF7A"
CHART_SALESPERSON = "#4A3AA7"
CHART_PRODUCTS = "#EB6834"
# โดนัท (วงกลม = ทุกชิ้นอยู่ติดกันหมด) จำกัด 3 สีตามที่ palette.md ระบุว่า all-pairs
# ผ่านเกณฑ์แค่ 3 สีแรก ส่วนที่เหลือพับเป็น "อื่นๆ" สีเทากลาง
DONUT_TOP3 = ["#2A78D6", "#EB6834", "#1BAF7A"]
DONUT_OTHER = "#9CA3AF"

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
        background: {CARD_BG};
        border: 1px solid {CARD_BORDER};
        border-radius: 16px;
        padding: 14px 22px;
        margin-bottom: 18px;
        box-shadow: 0 2px 14px rgba(22,27,34,0.06);
    }}
    .topbar-title {{ display: flex; align-items: center; gap: 12px; }}
    .topbar-title .emoji {{ font-size: 1.6rem; }}
    .topbar-title h1 {{ margin: 0; font-size: 1.3rem; }}
    .topbar-title .sub {{ color: {TEXT_MUTED}; font-size: 0.78rem; margin-top: 2px; }}
    .topbar-pill {{
        display: flex; align-items: center; gap: 6px;
        background: rgba(211,75,130,0.08);
        border: 1px solid rgba(211,75,130,0.25);
        color: {PRIMARY}; font-size: 0.78rem; font-weight: 500;
        padding: 6px 14px; border-radius: 999px;
    }}
    .topbar-pill .dot {{
        width: 7px; height: 7px; border-radius: 50%; background: {POSITIVE};
        box-shadow: 0 0 6px {POSITIVE};
    }}

    /* --- การ์ด KPI: สีต่างกันต่อใบตาม badge, เงานุ่มแบบ SaaS --- */
    .kpi-card {{
        background: {CARD_BG};
        border: 1px solid {CARD_BORDER};
        border-radius: 14px;
        padding: 14px 16px 6px 16px;
        box-shadow: 0 4px 16px rgba(22,27,34,0.06);
        transition: box-shadow 0.15s ease;
    }}
    .kpi-top {{ display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }}
    .kpi-icon {{
        width: 34px; height: 34px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
    }}
    .kpi-label {{ color: {TEXT_MUTED}; font-size: 0.8rem; }}
    .kpi-value {{ color: {TEXT}; font-size: 1.5rem; font-weight: 700; line-height: 1.15; }}
    .kpi-delta {{ font-size: 0.78rem; margin-top: 1px; }}
    .kpi-delta.up {{ color: {POSITIVE}; }}
    .kpi-delta.down {{ color: {NEGATIVE}; }}
    .kpi-sub {{ color: {TEXT_MUTED}; font-size: 0.7rem; margin-bottom: 4px; }}
    .kpi-spark {{ margin: 4px -2px -2px -2px; }}

    /* --- ห่อกราฟ Plotly ให้เป็นการ์ดสไตล์เดียวกับ KPI --- */
    [data-testid="stPlotlyChart"] {{
        background: {CARD_BG};
        border: 1px solid {CARD_BORDER};
        border-radius: 14px;
        padding: 6px 10px 2px 10px;
        box-shadow: 0 4px 16px rgba(22,27,34,0.06);
    }}

    /* --- การ์ด HTML กำหนดเอง: โดนัท+legend, ranked list --- */
    .chart-card {{
        background: {CARD_BG};
        border: 1px solid {CARD_BORDER};
        border-radius: 14px;
        padding: 16px 18px;
        box-shadow: 0 4px 16px rgba(22,27,34,0.06);
        height: 100%;
    }}
    .chart-card-title {{ font-size: 0.95rem; font-weight: 600; color: {TEXT}; margin-bottom: 14px; }}
    .rank-row {{ margin-bottom: 12px; }}
    .rank-row:last-child {{ margin-bottom: 0; }}
    .rank-row-top {{ display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px; }}
    .rank-row-label {{ color: {TEXT}; }}
    .rank-row-value {{ color: {TEXT_MUTED}; font-weight: 600; }}
    .rank-row-track {{ background: {GRID}; border-radius: 4px; height: 7px; overflow: hidden; }}
    .rank-row-fill {{ height: 100%; border-radius: 4px; }}
    .legend-row {{ display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }}
    .legend-row:last-child {{ margin-bottom: 0; }}
    .legend-dot {{ width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }}
    .legend-label {{ flex: 1; font-size: 0.82rem; color: {TEXT}; }}
    .legend-value {{ font-size: 0.82rem; color: {TEXT_MUTED}; }}
    </style>
    """,
    unsafe_allow_html=True,
)


def _flat(html: str) -> str:
    """เอา indent/บรรทัดใหม่ในสตริง HTML ที่มาจาก f-string ในโค้ดที่เยื้องหลายชั้นออก —
    ไม่งั้น Streamlit's markdown parser เห็นบรรทัดที่ขึ้นต้นด้วยช่องว่าง >= 4 ตัว
    แล้วตีความเป็น code block ทำให้ขึ้นเป็นข้อความ HTML ดิบแทนที่จะ render จริง"""
    return "".join(line.strip() for line in html.strip().splitlines())


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
    return _flat(f"""
    <svg width="100%" height="{height}" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
        <polygon points="{area}" fill="{color}" opacity="0.12"></polygon>
        <polyline points="{points}" fill="none" stroke="{color}" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
    """)


def donut_svg(segments: list[tuple[str, float, str]], center_label: str, center_sub: str, size: int = 150, stroke: int = 24) -> str:
    """โดนัทวาดเอง (stroke-dasharray) + ตัวเลขรวมตรงกลาง — คุมหน้าตาได้เป๊ะ ต่อกับ legend HTML ข้างๆ ได้"""
    r = (size - stroke) / 2
    cx = cy = size / 2
    circumference = 2 * math.pi * r
    total = sum(v for _, v, _ in segments) or 1
    arcs, offset = [], 0.0
    for _, value, color in segments:
        length = value / total * circumference
        arcs.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" stroke-width="{stroke}" '
            f'stroke-dasharray="{length:.2f} {circumference - length:.2f}" '
            f'stroke-dashoffset="{-offset:.2f}" transform="rotate(-90 {cx} {cy})"></circle>'
        )
        offset += length
    return _flat(f"""
    <svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">
        <circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{GRID}" stroke-width="{stroke}"></circle>
        {''.join(arcs)}
        <text x="{cx}" y="{cy - 4}" text-anchor="middle" font-size="20" font-weight="700"
              fill="{TEXT}" font-family="Roboto, sans-serif">{center_label}</text>
        <text x="{cx}" y="{cy + 16}" text-anchor="middle" font-size="10.5"
              fill="{TEXT_MUTED}" font-family="Kanit, sans-serif">{center_sub}</text>
    </svg>
    """)


def legend_rows_html(segments: list[tuple[str, float, str]]) -> str:
    total = sum(v for _, v, _ in segments) or 1
    rows = ""
    for label, value, color in segments:
        pct = value / total * 100
        rows += f"""
        <div class="legend-row">
            <span class="legend-dot" style="background:{color};"></span>
            <span class="legend-label">{label}</span>
            <span class="legend-value num-font">{value:,.0f} ({pct:.0f}%)</span>
        </div>
        """
    return rows


def donut_card(title: str, segments: list[tuple[str, float, str]], center_label: str, center_sub: str) -> str:
    return _flat(f"""
    <div class="chart-card">
        <div class="chart-card-title">{title}</div>
        <div style="display:flex; align-items:center; gap:22px;">
            <div style="flex-shrink:0;">{donut_svg(segments, center_label, center_sub)}</div>
            <div style="flex:1; min-width:0;">{legend_rows_html(segments)}</div>
        </div>
    </div>
    """)


def ranked_list_card(title: str, items: list[tuple[str, float, str]], color: str) -> str:
    """items = [(label, value_for_bar_width, display_text), ...] เรียงมาก่อนหลังตามที่จะแสดงจากบนลงล่าง"""
    max_v = max((v for _, v, _ in items), default=1) or 1
    rows = ""
    for label, value, display in items:
        width_pct = max(value / max_v * 100, 2)
        rows += f"""
        <div class="rank-row">
            <div class="rank-row-top">
                <span class="rank-row-label">{label}</span>
                <span class="rank-row-value num-font">{display}</span>
            </div>
            <div class="rank-row-track">
                <div class="rank-row-fill" style="width:{width_pct:.1f}%; background:{color};"></div>
            </div>
        </div>
        """
    return _flat(f"""
    <div class="chart-card">
        <div class="chart-card-title">{title}</div>
        {rows}
    </div>
    """)


def kpi_card(label: str, value: str, delta: float | None, delta_fmt: str, icon: str, badge: str, spark: list[float]) -> str:
    if delta is None:
        delta_html = '<div class="kpi-delta">&nbsp;</div>'
    else:
        cls = "up" if delta >= 0 else "down"
        arrow = "▲" if delta >= 0 else "▼"
        delta_html = f'<div class="kpi-delta {cls}">{arrow} {delta_fmt}</div>'
    return _flat(f"""
    <div class="kpi-card" style="border-top: 3px solid {badge};">
        <div class="kpi-top">
            <span class="kpi-icon" style="background:{badge}1A; color:{badge};">{icon}</span>
            <span class="kpi-label">{label}</span>
        </div>
        <div class="kpi-value">{value}</div>
        {delta_html}
        <div class="kpi-spark">{sparkline_svg(spark, badge)}</div>
    </div>
    """)


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
    # --- กราฟหลัก: ออเดอร์ (พื้นที่) + ตีกลับ (เส้นชมพูแบรนด์) หน่วยเดียวกัน แกนเดียว ---
    fig_hero = go.Figure()
    fig_hero.add_trace(
        go.Scatter(
            x=monthly["month_label"], y=monthly["orders"], name="ออเดอร์ทั้งหมด",
            mode="lines", line=dict(color=BADGE_COLORS[0], width=2),
            fill="tozeroy", fillcolor="rgba(42,120,214,0.08)",
        )
    )
    fig_hero.add_trace(
        go.Scatter(
            x=monthly["month_label"], y=monthly["returns"], name="ตีกลับ",
            mode="lines+markers", line=dict(color=PRIMARY, width=3),
            fill="tozeroy", fillcolor="rgba(211,75,130,0.14)",
            marker=dict(size=6),
        )
    )
    st.plotly_chart(
        chart_layout(fig_hero, "ออเดอร์ทั้งหมด vs ตีกลับ รายเดือน", "จำนวนออเดอร์"),
        use_container_width=True,
    )

    col1, col2, col3 = st.columns(3)
    with col1:
        by_channel_orders = filtered.groupby("sales_channel").size().reset_index(name="orders")
        by_channel_orders = by_channel_orders.sort_values("orders", ascending=False)
        # โดนัทวงกลม = ทุกชิ้นอยู่ติดกันหมด (all-pairs) — ใช้ได้แค่ 3 สีตาม palette.md แล้วพับ
        # หมวดที่เหลือเป็น "อื่นๆ" สีเทากลาง กันสีชนกันตอนมีมากกว่า 3 ช่องทาง
        top3 = by_channel_orders.head(3).copy()
        rest = by_channel_orders.iloc[3:]
        segments = [(row.sales_channel, row.orders, DONUT_TOP3[i]) for i, row in enumerate(top3.itertuples())]
        if not rest.empty:
            segments.append(("อื่นๆ", rest["orders"].sum(), DONUT_OTHER))
        st.markdown(
            donut_card(
                "สัดส่วนออเดอร์ตามช่องทางขาย", segments,
                f"{by_channel_orders['orders'].sum():,}", "ออเดอร์ทั้งหมด",
            ),
            unsafe_allow_html=True,
        )

    # แบ่ง Top 8 สินค้าตีกลับเป็น 2 คอลัมน์ (4+4) แทนลิสต์เดียวยาว ๆ — การ์ดเตี้ยลง หน้าตากว้างขึ้น
    top_products = (
        filtered[filtered["is_returned"]]
        .groupby("product_name")
        .size()
        .sort_values(ascending=False)
        .head(8)
        .reset_index(name="returns")
    )
    items = [(row.product_name, row.returns, f"{row.returns:,}") for row in top_products.itertuples()]
    with col2:
        st.markdown(
            ranked_list_card("สินค้าที่ถูกตีกลับมากที่สุด (1-4)", items[:4], CHART_PRODUCTS),
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            ranked_list_card("สินค้าที่ถูกตีกลับมากที่สุด (5-8)", items[4:8], CHART_PRODUCTS),
            unsafe_allow_html=True,
        )

with tab_channel:
    by_channel = rate_table(filtered, "sales_channel").sort_values("rate", ascending=False)
    by_transport = rate_table(filtered, "transport_company_group").sort_values("rate", ascending=False).head(10)
    transport_items = [(row.transport_company_group, row.rate, f"{row.rate:.2f}%") for row in by_transport.itertuples()]

    col1, col2, col3 = st.columns(3)
    with col1:
        items = [(row.sales_channel, row.rate, f"{row.rate:.2f}%") for row in by_channel.itertuples()]
        st.markdown(ranked_list_card("% ตีกลับ ตามช่องทางขาย", items, CHART_CHANNEL), unsafe_allow_html=True)
    with col2:
        st.markdown(
            ranked_list_card("% ตีกลับ ตามบริษัทขนส่ง (1-5)", transport_items[:5], CHART_TRANSPORT),
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            ranked_list_card("% ตีกลับ ตามบริษัทขนส่ง (6-10)", transport_items[5:10], CHART_TRANSPORT),
            unsafe_allow_html=True,
        )

with tab_geo:
    st.caption(f"แสดงเฉพาะกลุ่มที่มีออเดอร์ >= {MIN_ORDERS_FOR_RATE} รายการ ในช่วงที่กรองไว้ เพื่อลด noise จากฐานเล็กเกินไป")
    by_province = (
        rate_table(filtered, "province", MIN_ORDERS_FOR_RATE).sort_values("rate", ascending=False).head(10)
    )
    by_sales = (
        rate_table(filtered, "salesperson", MIN_ORDERS_FOR_RATE).sort_values("rate", ascending=False).head(10)
    )
    province_items = [(row.province, row.rate, f"{row.rate:.2f}%") for row in by_province.itertuples()]
    sales_items = [(row.salesperson, row.rate, f"{row.rate:.2f}%") for row in by_sales.itertuples()]

    # แบ่ง Top 10 ทั้งสองชุดเป็น 2 ครึ่งต่อชุด รวม 4 คอลัมน์ในแถวเดียว แทนลิสต์ยาว 2 คอลัมน์
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(ranked_list_card("% ตีกลับ ตามจังหวัด (1-5)", province_items[:5], CHART_PROVINCE), unsafe_allow_html=True)
    with col2:
        st.markdown(ranked_list_card("% ตีกลับ ตามจังหวัด (6-10)", province_items[5:10], CHART_PROVINCE), unsafe_allow_html=True)
    with col3:
        st.markdown(ranked_list_card("% ตีกลับ ตามพนักงานขาย (1-5)", sales_items[:5], CHART_SALESPERSON), unsafe_allow_html=True)
    with col4:
        st.markdown(ranked_list_card("% ตีกลับ ตามพนักงานขาย (6-10)", sales_items[5:10], CHART_SALESPERSON), unsafe_allow_html=True)

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
