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
3. Framework preset: Next.js (auto-detected). No environment variables or
   secrets are required for this static version.
4. Deploy — you'll get a permanent `https://<project>.vercel.app` URL.
