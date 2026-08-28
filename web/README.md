# Dashboard สินค้าตีกลับ 2569 — Next.js (Vercel)

Static Next.js port of the Streamlit dashboard, built to deploy on Vercel.

## Why static, not a live API

Vercel serverless functions have execution time limits (seconds), but reading
the 6 source Google Sheets (70,000+ rows each) takes over a minute even with
retries. So this app does **not** call the Sheets API at request time.
Instead, the data is pre-aggregated into one small JSON file
(`public/data/records.json`, only the ~18–19k *returned* orders, not every
order) that ships as a static asset. The page fetches it client-side and does
all filtering/aggregation in the browser — instant load, no timeouts, no
secrets needed on Vercel at all.

If `public/data/records.json` is missing or empty, the app falls back to
generated demo data with a yellow "ข้อมูลตัวอย่าง (Demo)" badge, same as the
Streamlit version.

## Refreshing the data

Whenever the source Sheets are updated, regenerate the JSON and redeploy:

```bash
python pipeline/combine_returns.py      # pulls Sheets -> pipeline/output/returns_2569_combined.csv
python pipeline/aggregate_for_web.py    # -> web/public/data/records.json
git add web/public/data/records.json
git commit -m "Refresh dashboard data"
git push                                 # Vercel auto-redeploys on push
```

## Local development

```bash
cd web
npm install
npm run dev
```

## Deploying on Vercel

1. Go to https://vercel.com/new, import this GitHub repo.
2. Set **Root Directory** to `web` (the Next.js app lives in this subfolder,
   not the repo root — the repo also contains the Python pipeline and the
   Streamlit app).
3. Framework preset: Next.js (auto-detected).
4. Set the environment variables below before deploying (Advanced → Environment
   Variables, or Project Settings → Environment Variables after the first deploy).
5. Deploy — you'll get a permanent `https://<project>.vercel.app` URL.

## Access control (Google login + email allowlist)

This dashboard has internal company numbers, so it is **never a public
site** — every route (pages, the data JSON, the map GeoJSON) is protected by
`src/proxy.ts`, which redirects anyone without a valid session to Google
sign-in. Sign-in only succeeds for emails in `ALLOWED_EMAILS`.

Set these in Vercel (copy `.env.example` for the full list):

| Variable | Where to get it |
|---|---|
| `AUTH_SECRET` | Any random 32+ byte string. Generate one: `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console → **APIs & Services → Credentials** → **Create Credentials → OAuth client ID** → Application type **Web application**. Add an **Authorized redirect URI**: `https://<your-vercel-domain>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` too if you want to test locally). Copy the generated Client ID / Client secret. |
| `ALLOWED_EMAILS` | Comma-separated list of the exact Google account emails allowed to sign in, e.g. `you@gmail.com,teammate@ptglory.com`. |

To add or remove someone's access later, just edit `ALLOWED_EMAILS` in
Vercel's Environment Variables and redeploy (or use Vercel's "Redeploy"
button — no code change needed).

## Visit tracking

The **สถิติเข้าใช้งาน** tab shows how many times the dashboard has been
opened, by month/quarter/year. It logs one row (timestamp, signed-in email,
path) per page load to a dedicated Google Sheet, using the same service
account the Python pipeline already uses.

Set these two additional env vars in Vercel:

| Variable | Where to get it |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The service account's key JSON, as one single-line string (same credentials used by `pipeline/combine_returns.py`). |
| `VISIT_LOG_SPREADSHEET_ID` | The ID of a Google Sheet the service account can write to (see below). |

**One-time setup for the visit-log sheet** — the service account couldn't
create its own spreadsheet in this session (Drive API isn't enabled on that
Google Cloud project). Either:
- Enable the Drive API for that project (Google Cloud Console → APIs &
  Services → Library → search "Google Drive API" → Enable), then ask Claude
  to create the sheet automatically next session, **or**
- Create a blank Google Sheet yourself, rename its first tab to `visits`,
  add a header row `timestamp | email | path` in `A1:C1`, share it as
  **Editor** with the service account's email (the same one already shared
  on the source data sheets — see the pipeline README), and give Claude the
  sheet's URL to set `VISIT_LOG_SPREADSHEET_ID`.

If these two vars are left unset, the dashboard still works fine — the
สถิติเข้าใช้งาน tab just shows "ยังไม่ได้ตั้งค่า" instead of numbers.
