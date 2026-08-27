"""Dashboard สินค้าตีกลับ ปี 2569 — Streamlit app.

Data source, in priority order:
1. The pipeline's combined CSV (pipeline/output/returns_2569_combined.csv),
   when running locally after `python pipeline/combine_returns.py`.
2. A live pull straight from the source Google Sheets, using service-account
   credentials from st.secrets["gcp_service_account"] — this is what runs on
   Streamlit Community Cloud, which doesn't have the local pipeline output.
3. Generated demo data, so the UI can still be previewed with neither of the
   above — a yellow banner makes that state obvious so nobody mistakes the
   demo numbers for real ones.

Run locally:
    streamlit run dashboard/app.py
"""

import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
COMBINED_CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "pipeline", "output", "returns_2569_combined.csv")
CACHE_TTL_SECONDS = 300

COLORS = {
    "pink": "#ec4899",
    "pink_dark": "#db2777",
    "purple": "#8b5cf6",
    "purple_dark": "#7c3aed",
    "blue": "#3b82f6",
    "blue_dark": "#2563eb",
    "orange": "#f97316",
    "orange_dark": "#ea580c",
    "ink": "#1f2430",
    "muted": "#8a8fa3",
}

# Schema A's `sales_channel` (from the "แพลตฟอร์ม" column) stores the internal
# sales-system name rather than the team that runs it — map those raw values to
# the team name for display, confirmed by the user against the source data.
CHANNEL_DISPLAY_MAP = {
    "MiniShop": "Facebook",
    "shopss": "CRM",
}

MONTH_LABELS = {
    "2026-01": "ม.ค.69", "2026-02": "ก.พ.69", "2026-03": "มี.ค.69",
    "2026-04": "เม.ย.69", "2026-05": "พ.ค.69", "2026-06": "มิ.ย.69",
    "2026-07": "ก.ค.69", "2026-08": "ส.ค.69", "2026-09": "ก.ย.69",
    "2026-10": "ต.ค.69", "2026-11": "พ.ย.69", "2026-12": "ธ.ค.69",
}

st.set_page_config(page_title="Dashboard สินค้าตีกลับ 2569", page_icon="📦", layout="wide")


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
@st.cache_data(ttl=CACHE_TTL_SECONDS)
def load_data() -> tuple[pd.DataFrame, bool]:
    """Returns (dataframe, is_demo)."""
    if os.path.exists(COMBINED_CSV_PATH):
        df = pd.read_csv(COMBINED_CSV_PATH, low_memory=False)
        df = _finalize(df)
        return _apply_channel_labels(df), False
    if _has_sheets_secret():
        df = _load_live_from_sheets()
        df = _finalize(df)
        return _apply_channel_labels(df), False
    return _apply_channel_labels(_demo_data()), True


def _finalize(df: pd.DataFrame) -> pd.DataFrame:
    # read_csv's parse_dates can silently no-op depending on the pandas
    # string-dtype backend in use, so parse explicitly instead of relying on it.
    for col in ("order_time", "ship_date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    # Schema A months carry every order (returned or not) with an is_returned
    # flag — this dashboard is about returns only, so filter down to those.
    return df[df["is_returned"] == True]  # noqa: E712


def _has_sheets_secret() -> bool:
    try:
        return "gcp_service_account" in st.secrets
    except Exception:
        return False


@st.cache_data(ttl=CACHE_TTL_SECONDS)
def _load_live_from_sheets() -> pd.DataFrame:
    import gspread

    from combine_returns import read_sheet_raw
    from config import SOURCE_SHEETS
    from normalize import normalize

    gc = gspread.service_account_from_dict(dict(st.secrets["gcp_service_account"]))
    frames = []
    for src in SOURCE_SHEETS:
        raw = read_sheet_raw(gc, src["spreadsheet_id"], src["gid"])
        if raw.empty:
            continue
        frames.append(normalize(raw, src["schema"], src["month"]))
    if not frames:
        raise RuntimeError("No data read from any source sheet.")
    return pd.concat(frames, ignore_index=True)


def _apply_channel_labels(df: pd.DataFrame) -> pd.DataFrame:
    if "sales_channel" in df.columns:
        df["sales_channel"] = df["sales_channel"].replace(CHANNEL_DISPLAY_MAP)
    return df


def _demo_data() -> pd.DataFrame:
    rng = np.random.default_rng(seed=69)
    months = list(MONTH_LABELS.keys())[:8]
    channels = ["MiniShop", "shopss", "Shopee", "Lazada", "TikTok"]
    provinces = ["กรุงเทพฯ", "เชียงใหม่", "ขอนแก่น", "ชลบุรี", "สงขลา", "นครราชสีมา"]
    rows = []
    for month in months:
        n = int(rng.integers(180, 420))
        for i in range(n):
            order_time = pd.Timestamp(month + "-01") + pd.to_timedelta(int(rng.integers(0, 27)), unit="D")
            rows.append({
                "month": month,
                "internal_order_id": f"DEMO-{month}-{i:04d}",
                "sales_channel": rng.choice(channels),
                "province": rng.choice(provinces),
                "product_name": rng.choice(["วิตามินซี", "คอลลาเจน", "โปรตีน", "น้ำมันปลา", "โพรไบโอติก"]),
                "product_price": float(rng.integers(190, 1590)),
                "order_time": order_time,
                "is_returned": True,
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Style — pink/purple gradient admin-dashboard look
# ---------------------------------------------------------------------------
def inject_css():
    st.markdown(f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&display=swap');

    html, body, [class*="css"] {{ font-family: 'Kanit', sans-serif; }}

    :root {{
        --ink: {COLORS['ink']};
        --muted: {COLORS['muted']};
    }}

    [data-testid="stAppViewContainer"] {{ background: #f4f5fa; }}
    [data-testid="stHeader"] {{ background: transparent; }}
    .block-container {{ padding-top: 1.5rem; max-width: 1400px; }}

    /* Sidebar */
    [data-testid="stSidebar"] {{
        background: linear-gradient(180deg, #2b1a4a 0%, #4a1f5c 55%, #6d2568 100%);
    }}
    [data-testid="stSidebar"] * {{ color: #f1e9ff !important; }}
    [data-testid="stSidebar"] .stRadio label {{
        padding: 0.35rem 0.6rem; border-radius: 10px; margin-bottom: 2px;
    }}
    [data-testid="stSidebar"] hr {{ border-color: rgba(255,255,255,0.15); }}

    .brand {{
        display:flex; align-items:center; gap:10px; padding: 4px 0 18px 0;
    }}
    .brand-badge {{
        width:36px; height:36px; border-radius:10px;
        background: linear-gradient(135deg, {COLORS['pink']}, {COLORS['purple']});
        display:flex; align-items:center; justify-content:center; font-size:18px;
    }}
    .brand-title {{ font-weight:700; font-size:1.05rem; color:#fff !important; }}
    .brand-sub {{ font-size:0.7rem; color:#cbb8ee !important; }}

    /* KPI gradient cards */
    .kpi-card {{
        border-radius: 20px; padding: 22px 24px; color: white;
        height: 168px; position: relative; overflow: hidden;
        display: flex; flex-direction: column; justify-content: space-between;
        border: 1px solid rgba(255,255,255,0.25);
        transition: transform 0.18s ease, box-shadow 0.18s ease;
    }}
    .kpi-card:hover {{ transform: translateY(-3px); }}
    .kpi-card::before {{
        content: ""; position: absolute; top: -35px; right: -35px;
        width: 120px; height: 120px; border-radius: 50%;
        background: rgba(255,255,255,0.14); pointer-events: none;
    }}
    .kpi-card::after {{
        content: ""; position: absolute; bottom: -50px; left: -20px;
        width: 100px; height: 100px; border-radius: 50%;
        background: rgba(255,255,255,0.08); pointer-events: none;
    }}
    .kpi-card .kpi-top {{ display: flex; align-items: flex-start; justify-content: space-between; }}
    .kpi-card .kpi-label {{
        font-size: 0.76rem; font-weight: 500; opacity: 0.9;
        text-transform: uppercase; letter-spacing: 0.04em;
        position: relative; z-index: 1;
    }}
    .kpi-card .kpi-icon {{
        width: 34px; height: 34px; border-radius: 11px; flex-shrink: 0;
        background: rgba(255,255,255,0.22); backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.05rem; position: relative; z-index: 1;
    }}
    .kpi-card .kpi-value {{
        font-size: 2.35rem; font-weight: 700; line-height: 1.05;
        letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
        text-shadow: 0 2px 10px rgba(0,0,0,0.15);
        white-space: nowrap; overflow: hidden;
        position: relative; z-index: 1;
    }}
    .kpi-card .kpi-value.kpi-value-long {{ font-size: 1.65rem; }}
    .kpi-card .kpi-value.kpi-value-xlong {{ font-size: 1.3rem; }}
    .kpi-card .kpi-delta {{
        display: inline-flex; align-items: center; gap: 5px; align-self: flex-start;
        font-size: 0.76rem; font-weight: 500;
        background: rgba(255,255,255,0.18); padding: 4px 10px; border-radius: 999px;
        position: relative; z-index: 1; white-space: nowrap;
        max-width: 100%; overflow: hidden; text-overflow: ellipsis;
    }}
    .kpi-card .delta-arrow {{ font-weight: 700; }}
    .kpi-pink {{
        background: linear-gradient(135deg, {COLORS['pink']}, {COLORS['pink_dark']});
        box-shadow: 0 14px 28px -10px rgba(219,39,119,0.55);
    }}
    .kpi-purple {{
        background: linear-gradient(135deg, {COLORS['purple']}, {COLORS['purple_dark']});
        box-shadow: 0 14px 28px -10px rgba(124,58,237,0.55);
    }}
    .kpi-blue {{
        background: linear-gradient(135deg, {COLORS['blue']}, {COLORS['blue_dark']});
        box-shadow: 0 14px 28px -10px rgba(37,99,235,0.55);
    }}
    .kpi-orange {{
        background: linear-gradient(135deg, {COLORS['orange']}, {COLORS['orange_dark']});
        box-shadow: 0 14px 28px -10px rgba(234,88,12,0.55);
    }}
    .kpi-pink:hover   {{ box-shadow: 0 18px 34px -8px rgba(219,39,119,0.65); }}
    .kpi-purple:hover {{ box-shadow: 0 18px 34px -8px rgba(124,58,237,0.65); }}
    .kpi-blue:hover   {{ box-shadow: 0 18px 34px -8px rgba(37,99,235,0.65); }}
    .kpi-orange:hover {{ box-shadow: 0 18px 34px -8px rgba(234,88,12,0.65); }}

    /* Hero header */
    .hero {{
        display: flex; align-items: center; justify-content: space-between;
        gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
    }}
    .hero-left {{ display: flex; align-items: center; gap: 14px; }}
    .hero-icon {{
        width: 68px; height: 68px; border-radius: 18px; flex-shrink: 0;
        background: linear-gradient(135deg, {COLORS['pink']}, {COLORS['purple']});
        display: flex; align-items: center; justify-content: center;
        font-size: 2.1rem; box-shadow: 0 10px 22px -8px rgba(157,23,140,0.5);
    }}
    .hero-title {{
        font-size: 2.6rem; font-weight: 800; line-height: 1.15; margin: 0;
        background: linear-gradient(135deg, {COLORS['pink_dark']}, {COLORS['purple_dark']});
        -webkit-background-clip: text; background-clip: text; color: transparent;
    }}
    .hero-sub {{
        display: flex; align-items: center; gap: 6px; margin-top: 6px;
        font-size: 0.85rem; color: var(--muted);
    }}
    .status-pill {{
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 0.76rem; font-weight: 600; padding: 6px 14px; border-radius: 999px;
        white-space: nowrap;
    }}
    .status-pill.live {{ background: #dcfce7; color: #15803d; }}
    .status-pill.live .status-dot {{ box-shadow: 0 0 0 3px #15803d33; }}
    .status-pill.demo {{ background: #fef3c7; color: #b45309; }}
    .status-pill.demo .status-dot {{ box-shadow: 0 0 0 3px #b4530933; }}
    .status-dot {{ width: 7px; height: 7px; border-radius: 50%; background: currentColor; }}

    /* Panel cards */
    .panel {{
        background: white; border-radius: 18px; padding: 20px 22px;
        box-shadow: 0 6px 20px -12px rgba(31,36,48,0.15);
        height: 100%;
    }}
    .panel h4 {{ margin: 0 0 2px 0; color: var(--ink); font-size: 1rem; }}
    .panel .panel-sub {{ color: var(--muted); font-size: 0.78rem; margin-bottom: 10px; }}

    .badge {{
        padding: 3px 12px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
        color: white; display:inline-block;
    }}
    .badge-pink {{ background: {COLORS['pink']}; }}
    .badge-purple {{ background: {COLORS['purple']}; }}
    .badge-blue {{ background: {COLORS['blue']}; }}
    .badge-orange {{ background: {COLORS['orange']}; }}
    .badge-gray {{ background: #9aa0ae; }}

    .activity-row {{ display:flex; gap:12px; align-items:flex-start; padding: 9px 0; border-bottom: 1px solid #f0f1f6; }}
    .activity-dot {{ width:10px; height:10px; border-radius:50%; margin-top:6px; flex-shrink:0; }}
    .activity-title {{ font-size:0.85rem; color: var(--ink); font-weight:600; }}
    .activity-sub {{ font-size:0.75rem; color: var(--muted); }}
    .activity-time {{ font-size:0.7rem; color: var(--muted); margin-left:auto; white-space:nowrap; }}

    div[data-testid="stDataFrame"] {{ border-radius: 12px; overflow: hidden; }}
    </style>
    """, unsafe_allow_html=True)


def delta_html(delta_pct: float | None, bad_when_up: bool = True, note: str = "จากเดือนก่อน") -> str:
    """Pill showing MoM change, color-coded by whether an increase is good or bad
    for this metric (returns going up is bad; a drop is good)."""
    if delta_pct is None:
        return f'<span class="kpi-delta">ไม่มีข้อมูลเดือนก่อนหน้า</span>'
    is_up = delta_pct >= 0
    arrow = "▲" if is_up else "▼"
    is_bad = is_up if bad_when_up else not is_up
    arrow_color = "#ffd2d2" if is_bad else "#c9ffe0"
    return (
        f'<span class="kpi-delta"><span class="delta-arrow" style="color:{arrow_color}">'
        f'{arrow} {abs(delta_pct):.1f}%</span> {note}</span>'
    )


def kpi_card(label: str, value: str, sub_html: str, css_class: str, icon: str = "📊"):
    # Long values (millions-range ฿ amounts, etc.) need a smaller font to stay
    # on one line instead of wrapping inside the fixed-height card.
    length = len(value)
    size_class = "kpi-value-xlong" if length > 11 else "kpi-value-long" if length > 7 else ""
    st.markdown(f"""
    <div class="kpi-card {css_class}">
        <div class="kpi-top">
            <div class="kpi-label">{label}</div>
            <div class="kpi-icon">{icon}</div>
        </div>
        <div class="kpi-value {size_class}">{value}</div>
        {sub_html}
    </div>
    """, unsafe_allow_html=True)


def panel_start(title: str, subtitle: str = ""):
    sub_html = f'<div class="panel-sub">{subtitle}</div>' if subtitle else ""
    st.markdown(f'<div class="panel"><h4>{title}</h4>{sub_html}', unsafe_allow_html=True)


def panel_end():
    st.markdown("</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Charts
# ---------------------------------------------------------------------------
def trend_chart(df: pd.DataFrame) -> go.Figure:
    monthly = df.groupby("month").size().reindex(sorted(df["month"].unique()))
    labels = [MONTH_LABELS.get(m, m) for m in monthly.index]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=labels, y=monthly.values, mode="lines", fill="tozeroy",
        line=dict(color=COLORS["pink"], width=3, shape="spline"),
        fillcolor="rgba(236,72,153,0.15)",
        hovertemplate="%{x}: %{y:,} รายการ<extra></extra>",
    ))
    fig.update_layout(
        margin=dict(l=10, r=10, t=10, b=10), height=280,
        plot_bgcolor="white", paper_bgcolor="white",
        xaxis=dict(showgrid=False),
        yaxis=dict(showgrid=True, gridcolor="#f0f1f6"),
        showlegend=False,
    )
    return fig


def donut_chart(df: pd.DataFrame) -> go.Figure:
    counts = df["sales_channel"].fillna("ไม่ระบุ").value_counts().head(4)
    palette = [COLORS["pink"], COLORS["purple"], COLORS["blue"], COLORS["orange"]]
    fig = go.Figure(data=[go.Pie(
        labels=counts.index, values=counts.values, hole=0.68,
        marker=dict(colors=palette[:len(counts)]),
        textinfo="none",
    )])
    fig.update_layout(
        margin=dict(l=0, r=0, t=0, b=0), height=220,
        showlegend=False, paper_bgcolor="white",
    )
    return fig, counts, palette


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
def main():
    inject_css()
    df, is_demo = load_data()

    with st.sidebar:
        st.markdown("""
        <div class="brand">
            <div class="brand-badge">📦</div>
            <div>
                <div class="brand-title">PT Glory</div>
                <div class="brand-sub">Returns Dashboard 2569</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        page = st.radio("เมนู", ["ภาพรวม", "รายเดือน", "ช่องทางขาย", "สินค้า"], label_visibility="collapsed")
        st.markdown("<hr/>", unsafe_allow_html=True)
        all_months = sorted(df["month"].dropna().unique())
        selected_month = st.selectbox(
            "เลือกเดือน", ["ทั้งหมด"] + all_months,
            index=0,
            format_func=lambda m: "ทั้งหมด" if m == "ทั้งหมด" else MONTH_LABELS.get(m, m),
        )

    full_df = df
    df = full_df if selected_month == "ทั้งหมด" else full_df[full_df["month"] == selected_month]

    if is_demo:
        st.warning(
            "⚠️ ยังไม่พบไฟล์ข้อมูลรวมจาก pipeline (`pipeline/output/returns_2569_combined.csv`) "
            "— แสดงผลด้วย **ข้อมูลตัวอย่าง (demo)** เพื่อพรีวิว UI เท่านั้น รันสคริปต์ `combine_returns.py` "
            "แล้วรีเฟรชหน้านี้เพื่อดูข้อมูลจริง",
            icon="⚠️",
        )

    status_class = "demo" if is_demo else "live"
    status_label = "ข้อมูลตัวอย่าง (Demo)" if is_demo else "ข้อมูลจริง"
    st.markdown(f"""
    <div class="hero">
        <div class="hero-left">
            <div class="hero-icon">📦</div>
            <div>
                <p class="hero-title">Dashboard สินค้าตีกลับ ปี 2569</p>
                <div class="hero-sub">
                    <span>🕐 อัปเดตล่าสุด: {datetime.now().strftime('%d %b %Y %H:%M')}</span>
                </div>
            </div>
        </div>
        <div class="status-pill {status_class}">
            <span class="status-dot"></span>{status_label}
        </div>
    </div>
    """, unsafe_allow_html=True)

    total_returns = len(df)
    total_value = df["product_price"].fillna(0).sum() if "product_price" in df else 0
    n_months = max(df["month"].nunique(), 1)
    avg_per_month = total_returns / n_months

    # Month-over-month comparison always looks at the true calendar-previous
    # month from the full dataset — so the delta stays meaningful even when
    # a single month is picked from the dropdown (no "previous month" inside
    # a one-month selection to compare against otherwise).
    cur_month = selected_month if selected_month != "ทั้งหมด" else (all_months[-1] if all_months else None)
    cur_idx = all_months.index(cur_month) if cur_month in all_months else None
    prev_month = all_months[cur_idx - 1] if cur_idx is not None and cur_idx > 0 else None

    cur_df = full_df[full_df["month"] == cur_month] if cur_month else full_df.iloc[0:0]
    prev_df = full_df[full_df["month"] == prev_month] if prev_month else None

    cur_count = len(cur_df)
    cur_value = cur_df["product_price"].fillna(0).sum() if "product_price" in cur_df else 0

    count_delta_pct = value_delta_pct = None
    if prev_df is not None and len(prev_df):
        prev_count = len(prev_df)
        prev_value = prev_df["product_price"].fillna(0).sum() if "product_price" in prev_df else 0
        count_delta_pct = (cur_count - prev_count) / prev_count * 100
        value_delta_pct = (cur_value - prev_value) / prev_value * 100 if prev_value else None

    top_channel_counts = df["sales_channel"].fillna("ไม่ระบุ").value_counts() if "sales_channel" in df else pd.Series(dtype=int)
    top_channel = top_channel_counts.index[0] if len(top_channel_counts) else "-"
    top_channel_share = (top_channel_counts.iloc[0] / total_returns * 100) if total_returns and len(top_channel_counts) else 0

    cur_month_label = MONTH_LABELS.get(cur_month, cur_month) if cur_month else "-"

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        kpi_card(
            f"ยอดตีกลับ · {cur_month_label}", f"{cur_count:,}",
            delta_html(count_delta_pct, bad_when_up=True), "kpi-pink", icon="📦",
        )
    with c2:
        kpi_card(
            f"มูลค่าตีกลับ · {cur_month_label}", f"฿{cur_value:,.0f}",
            delta_html(value_delta_pct, bad_when_up=True), "kpi-purple", icon="💰",
        )
    with c3:
        kpi_card(
            "เฉลี่ยต่อเดือน", f"{avg_per_month:,.0f}",
            f'<span class="kpi-delta">รายการ/เดือน จาก {n_months} เดือนที่เลือก</span>', "kpi-blue", icon="📊",
        )
    with c4:
        kpi_card(
            "ช่องทางตีกลับสูงสุด", top_channel,
            f'<span class="kpi-delta">{top_channel_share:.0f}% ของยอดตีกลับทั้งหมด</span>', "kpi-orange", icon="🎯",
        )

    st.write("")
    col_main, col_side = st.columns([2, 1])

    with col_main:
        panel_start("แนวโน้มยอดตีกลับรายเดือน", "จำนวนรายการตีกลับต่อเดือน")
        st.plotly_chart(trend_chart(df), use_container_width=True, config={"displayModeBar": False})
        panel_end()

    with col_side:
        panel_start("สัดส่วนช่องทางตีกลับ", "Top 4 ช่องทางขาย")
        fig, counts, palette = donut_chart(df)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        legend_html = ""
        total = counts.sum() or 1
        for (name, val), color in zip(counts.items(), palette):
            pct = val / total * 100
            legend_html += (
                f'<div style="display:flex;justify-content:space-between;font-size:0.8rem;'
                f'margin-bottom:6px;"><span><span style="display:inline-block;width:8px;height:8px;'
                f'border-radius:50%;background:{color};margin-right:8px;"></span>{name}</span>'
                f'<b>{pct:.0f}%</b></div>'
            )
        st.markdown(legend_html, unsafe_allow_html=True)
        panel_end()

    st.write("")
    col_a, col_b = st.columns([1, 2])

    with col_a:
        panel_start("กิจกรรมล่าสุด", "รายการตีกลับที่เพิ่มเข้ามาล่าสุด")
        recent = df.sort_values("order_time", ascending=False).head(6) if "order_time" in df else df.head(6)
        dot_colors = [COLORS["pink"], COLORS["purple"], COLORS["blue"], COLORS["orange"]]
        for i, (_, row) in enumerate(recent.iterrows()):
            when = row["order_time"].strftime("%d %b") if pd.notna(row.get("order_time")) else "-"
            st.markdown(f"""
            <div class="activity-row">
                <div class="activity-dot" style="background:{dot_colors[i % 4]}"></div>
                <div>
                    <div class="activity-title">{row.get('product_name', 'สินค้า')}</div>
                    <div class="activity-sub">{row.get('sales_channel', '-')} · {row.get('province', '-')}</div>
                </div>
                <div class="activity-time">{when}</div>
            </div>
            """, unsafe_allow_html=True)
        panel_end()

    with col_b:
        panel_start("รายการตีกลับ", "ตารางรายการล่าสุด")
        table_cols = [c for c in [
            "internal_order_id", "sales_channel", "province",
            "product_name", "product_price", "order_time",
        ] if c in df.columns]
        display_df = df.sort_values("order_time", ascending=False)[table_cols].head(20).rename(columns={
            "internal_order_id": "เลขออเดอร์",
            "sales_channel": "ช่องทาง",
            "province": "จังหวัด",
            "product_name": "สินค้า",
            "product_price": "ราคา (บาท)",
            "order_time": "วันที่สั่งซื้อ",
        })
        st.dataframe(display_df, use_container_width=True, hide_index=True, height=320)
        panel_end()


if __name__ == "__main__":
    main()
