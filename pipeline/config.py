"""Config for the returns (สินค้าตีกลับ) data pipeline. Edit values here — nowhere else."""

# --- Google auth ---
# Path to the service-account key JSON (glory-sheets-reader-456@...).
# Share every source spreadsheet below with that service account's email as Viewer.
CREDS_PATH = "service_account.json"

# --- Source spreadsheets, one per month ---
# schema: "A" = "Total-Data-ตีกลับ <เดือน>" master files (all orders, with return-flag columns)
#         "B" = "สรุปรายการสินค้าตีกลับเดือน <เดือน>" files (pre-filtered to returned orders only)
# Fill in new months as they get consolidated during the year.
SOURCE_SHEETS = [
    {"month": "2026-01", "label": "ม.ค.69", "spreadsheet_id": "1r_oz8FHT4QYe8W6evAjAx2QzmvPuQyRv2Xs5cPtPL6c", "schema": "A"},
    {"month": "2026-02", "label": "ก.พ.69", "spreadsheet_id": "1qyUUsGSrm6M3Mw6BPuo4aGbGjJJ7fqA-I_w085fDk-c", "schema": "A"},
    {"month": "2026-03", "label": "มี.ค.69", "spreadsheet_id": "1zi-GX6P37N351RR0X-96nPHY1Af44o5jjPQ6UrMoh_A", "schema": "A"},
    {"month": "2026-04", "label": "เม.ย.69", "spreadsheet_id": "1WWitrg5JbtF9tdw_oLc45USGtQLao1RqW6IbqFSHpoE", "schema": "A"},
    {"month": "2026-05", "label": "พ.ค.69", "spreadsheet_id": "1MlHoMACoJO4xieS-ctKkMt1KfilATfwNg4UZcJRE0H8", "schema": "A"},
    {"month": "2026-06", "label": "มิ.ย.69", "spreadsheet_id": "1DegHkVMAeYEMftJTRZ7VIZXHNQIbEtDgrNIIoWNC54w", "schema": "A"},
    {"month": "2026-07", "label": "ก.ค.69", "spreadsheet_id": "1EIKRt4EHeYKPoymw53F5UsxZZTYATPtUd0HCDIwLNtE", "schema": "B"},
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
