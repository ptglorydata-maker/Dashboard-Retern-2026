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

import pandas as pd

HERE = os.path.dirname(__file__)
COMBINED_CSV = os.path.join(HERE, "output", "returns_2569_combined.csv")
OUTPUT_JSON = os.path.join(HERE, "..", "web", "public", "data", "records.json")

# Same mapping as dashboard/app.py's CHANNEL_DISPLAY_MAP.
CHANNEL_DISPLAY_MAP = {"MiniShop": "Facebook", "shopss": "CRM"}


def main() -> None:
    if not os.path.exists(COMBINED_CSV):
        raise SystemExit(f"Not found: {COMBINED_CSV} — run pipeline/combine_returns.py first.")

    df = pd.read_csv(COMBINED_CSV, low_memory=False)
    df["order_time"] = pd.to_datetime(df["order_time"], errors="coerce")
    df = df[df["is_returned"] == True]  # noqa: E712
    df["sales_channel"] = df["sales_channel"].replace(CHANNEL_DISPLAY_MAP)

    records = []
    for row in df.itertuples(index=False):
        records.append({
            "m": row.month,
            "id": None if pd.isna(row.internal_order_id) else str(row.internal_order_id),
            "c": None if pd.isna(row.sales_channel) else str(row.sales_channel),
            "p": None if pd.isna(row.province) else str(row.province),
            "n": None if pd.isna(row.product_name) else str(row.product_name),
            "v": None if pd.isna(row.product_price) else float(row.product_price),
            "t": None if pd.isna(row.order_time) else row.order_time.isoformat(),
        })

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {len(records)} return records to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
