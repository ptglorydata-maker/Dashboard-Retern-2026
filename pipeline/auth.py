"""Google auth for gspread — works both from a local CLI run and inside Streamlit Cloud.

Local (CLI / local Streamlit dev): reads the service-account key file at
config.CREDS_PATH (see README — never commit this file).

Streamlit Cloud: reads the same key from st.secrets["gcp_service_account"],
set via the app's Settings -> Secrets (paste the JSON key under that table
name). No local file needed on the deployed instance.
"""

import gspread
from google.oauth2.service_account import Credentials

from config import CREDS_PATH

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def get_gspread_client() -> gspread.Client:
    try:
        import streamlit as st
        if "gcp_service_account" in st.secrets:
            creds = Credentials.from_service_account_info(
                dict(st.secrets["gcp_service_account"]), scopes=SCOPES
            )
            return gspread.authorize(creds)
    except ModuleNotFoundError:
        pass  # streamlit not installed (plain CLI run) — fall through to the file below
    except Exception:
        pass  # not running under Streamlit, or no secrets.toml configured — use the local file

    return gspread.service_account(filename=CREDS_PATH)
