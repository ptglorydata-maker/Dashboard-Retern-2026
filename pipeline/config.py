"""Config for the returns (สินค้าตีกลับ) data pipeline. Edit values here — nowhere else."""

# --- Google auth ---
# Path to the service-account key JSON (glory-sheets-reader-456@...).
# Share every source spreadsheet below with that service account's email as Viewer.
CREDS_PATH = "service_account.json"

# --- Source spreadsheets, one per month ---
# schema: "A" = "Total-Data-ตีกลับ <เดือน>" master files (all orders, with return-flag columns)
#         "B" = "สรุปรายการสินค้าตีกลับเดือน <เดือน>" files (pre-filtered to returned orders only —
#               has no order total to use as a denominator, so % rate metrics can't be computed from it alone)
#         "C" = a full order-level sheet ("Total_Order on Sell") that has every order for the
#               month but no return-status column of its own — is_returned is instead determined
#               by matching internal_order_id against a separate returns-only tab (`returns_gid`,
#               same spreadsheet) in the same shape as schema B.
# gid: the specific tab to read, from the sheet URL's #gid=... — the data tab is not
# always the first tab in the spreadsheet, so this must be set explicitly per file.
# Fill in new months as they get consolidated during the year.
SOURCE_SHEETS = [
    {"month": "2026-01", "label": "ม.ค.69", "spreadsheet_id": "1r_oz8FHT4QYe8W6evAjAx2QzmvPuQyRv2Xs5cPtPL6c", "gid": 1814183266, "schema": "A"},
    {"month": "2026-02", "label": "ก.พ.69", "spreadsheet_id": "1qyUUsGSrm6M3Mw6BPuo4aGbGjJJ7fqA-I_w085fDk-c", "gid": 245342036, "schema": "A"},
    {"month": "2026-03", "label": "มี.ค.69", "spreadsheet_id": "1zi-GX6P37N351RR0X-96nPHY1Af44o5jjPQ6UrMoh_A", "gid": 1908257606, "schema": "A"},
    {"month": "2026-04", "label": "เม.ย.69", "spreadsheet_id": "1WWitrg5JbtF9tdw_oLc45USGtQLao1RqW6IbqFSHpoE", "gid": 57782583, "schema": "A"},
    {"month": "2026-05", "label": "พ.ค.69", "spreadsheet_id": "1MlHoMACoJO4xieS-ctKkMt1KfilATfwNg4UZcJRE0H8", "gid": 1451873012, "schema": "A"},
    {"month": "2026-06", "label": "มิ.ย.69", "spreadsheet_id": "1DegHkVMAeYEMftJTRZ7VIZXHNQIbEtDgrNIIoWNC54w", "gid": 1885419356, "schema": "A"},
    {
        "month": "2026-07", "label": "ก.ค.69", "spreadsheet_id": "1EIKRt4EHeYKPoymw53F5UsxZZTYATPtUd0HCDIwLNtE",
        "gid": 477288052, "schema": "C", "returns_gid": 0,
        # gid 477288052 = "Total_Order on Sell" tab (93,100 order lines — the real July
        # denominator; the previously-used gid 0 "Discuse" tab is pre-filtered to returns
        # only, which made the July return rate compute as 100%). returns_gid = that same
        # "Discuse" tab, used only to mark which internal_order_id values are returns.
    },
    # 2026-08 (ส.ค.69) not consolidated into a single monthly file yet — add it here once it is.
]

# --- Output ---
# Local staging file, written every run so you can eyeball the combined result
# before it ever touches BigQuery.
LOCAL_OUTPUT_CSV = "output/returns_2569_combined.csv"

# Set to True once the BigQuery project/dataset below actually exist.
ENABLE_BQ_LOAD = False
BQ_PROJECT = "your-gcp-project-id"
BQ_DATASET = "chargeback_dashboard"
BQ_TABLE = "returns_2569"
# "replace" = full reload every run (simplest, fine for this data size); "append" = add only.
BQ_WRITE_MODE = "replace"
