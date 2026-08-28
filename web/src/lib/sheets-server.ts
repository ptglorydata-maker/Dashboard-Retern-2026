import { google } from "googleapis";

// Server-only — never import this from a client component. Uses the same
// service account already used by the Python pipeline, via a JSON string in
// the GOOGLE_SERVICE_ACCOUNT_JSON env var (set in Vercel, never committed).
export function sheetsClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const creds = JSON.parse(json);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export const VISIT_LOG_SPREADSHEET_ID = process.env.VISIT_LOG_SPREADSHEET_ID ?? "";
