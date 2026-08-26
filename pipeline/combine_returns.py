"""Combine every monthly returns (สินค้าตีกลับ) sheet into one clean dataset for 2569.

Usage:
    pip install -r requirements.txt
    # 1. share every sheet in config.SOURCE_SHEETS with the service account (Viewer)
    # 2. put the service account key at config.CREDS_PATH
    python pipeline/combine_returns.py

Writes a combined CSV to config.LOCAL_OUTPUT_CSV, and — once config.ENABLE_DUCKDB_LOAD
is turned on — loads the same data into a local DuckDB file (config.DUCKDB_PATH).
"""

import os
import sys
import time

import gspread
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from config import (
    CREDS_PATH, SOURCE_SHEETS, LOCAL_OUTPUT_CSV,
    ENABLE_DUCKDB_LOAD, DUCKDB_PATH, DUCKDB_TABLE, DUCKDB_WRITE_MODE,
)
from normalize import normalize


_INVISIBLE_CHARS = str.maketrans("", "", "\u200b\u200c\u200d\ufeff")


def _dedupe_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for h in headers:
        h = h.translate(_INVISIBLE_CHARS).strip()
        if h in seen:
            seen[h] += 1
            out.append(f"{h}__{seen[h]}")
        else:
            seen[h] = 0
            out.append(h)
    return out


def _with_retry(fn, attempts=5, base_delay=5):
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except gspread.exceptions.APIError as e:
            if attempt == attempts:
                raise
            delay = base_delay * (2 ** (attempt - 1))
            print(f"  API error ({e}), retrying in {delay}s ({attempt}/{attempts}) ...")
            time.sleep(delay)


def read_sheet_raw(gc: gspread.Client, spreadsheet_id: str, gid: int) -> pd.DataFrame:
    ws = _with_retry(lambda: gc.open_by_key(spreadsheet_id).get_worksheet_by_id(gid))
    values = _with_retry(ws.get_all_values)
    if not values:
        return pd.DataFrame()
    header, rows = _dedupe_headers(values[0]), values[1:]
    df = pd.DataFrame(rows, columns=header)
    return df.dropna(how="all")


def load_duckdb(df: pd.DataFrame) -> None:
    import duckdb

    os.makedirs(os.path.dirname(DUCKDB_PATH), exist_ok=True)
    con = duckdb.connect(DUCKDB_PATH)
    try:
        if DUCKDB_WRITE_MODE == "replace" or not con.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = ?", [DUCKDB_TABLE]
        ).fetchone()[0]:
            con.execute(f"CREATE OR REPLACE TABLE {DUCKDB_TABLE} AS SELECT * FROM df")
        else:
            con.execute(f"INSERT INTO {DUCKDB_TABLE} SELECT * FROM df")
    finally:
        con.close()
    print(f"Loaded {len(df)} rows into {DUCKDB_PATH}::{DUCKDB_TABLE} ({DUCKDB_WRITE_MODE}).")


def main() -> None:
    gc = gspread.service_account(filename=CREDS_PATH)

    frames = []
    for src in SOURCE_SHEETS:
        print(f"Reading {src['label']} ({src['schema']}) ...")
        raw = read_sheet_raw(gc, src["spreadsheet_id"], src["gid"])
        if raw.empty:
            print(f"  WARNING: {src['label']} came back empty, skipping.")
            continue
        frames.append(normalize(raw, src["schema"], src["month"]))
        print(f"  {len(raw)} rows")

    if not frames:
        raise SystemExit("No data read from any source sheet — check CREDS_PATH and sharing.")

    combined = pd.concat(frames, ignore_index=True)
    print(f"\nCombined: {len(combined)} rows across {len(frames)} months.")
    print(combined.groupby("month", dropna=False).size())

    os.makedirs(os.path.dirname(LOCAL_OUTPUT_CSV), exist_ok=True)
    combined.to_csv(LOCAL_OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"\nWrote {LOCAL_OUTPUT_CSV}")

    if ENABLE_DUCKDB_LOAD:
        load_duckdb(combined)
    else:
        print("ENABLE_DUCKDB_LOAD is False — skipped DuckDB load.")


if __name__ == "__main__":
    main()
