# Dashboard สินค้าตีกลับ ปี 2569

รวมข้อมูลสินค้าตีกลับจากไฟล์ Google Sheets รายเดือน (70,000+ แถว/เดือน) ให้เป็นชุดข้อมูลเดียว
สะอาด พร้อมใช้งาน สำหรับต่อยอดเป็น dashboard เปรียบเทียบ/ลดยอดตีกลับ

## สถานะปัจจุบัน

ขั้นตอนแรก (ที่ทำในรอบนี้): สคริปต์รวม + ทำความสะอาดข้อมูลทุกเดือน (`pipeline/`)
ขั้นตอนถัดไป (ยังไม่ทำ): โหลดเข้า BigQuery จริง + สร้าง Streamlit dashboard

## โครงสร้างข้อมูลต้นทาง

พบไฟล์ 2 รูปแบบใน Drive:

- **Schema A** — ไฟล์ `Total-Data-ตีกลับ <เดือน>` (ม.ค.-มิ.ย. 69): มีทุกออเดอร์ในเดือนนั้น
  พร้อมคอลัมน์บอกว่าตีกลับหรือไม่ (`จำนวนสินค้าตีกลับ`, `สถานะขนส่ง`)
- **Schema B** — ไฟล์ `สรุปรายการสินค้าตีกลับเดือน <เดือน>` (ก.ค. 69 เป็นต้นไป): กรองมาแล้วเฉพาะ
  ออเดอร์ที่ตีกลับ คอลัมน์คนละชุดกับ Schema A

สคริปต์ map ทั้งสอง schema ไปยังคอลัมน์กลางชุดเดียวกัน (ดู `pipeline/normalize.py`) —
คอลัมน์ไหนไม่มีในไฟล์ต้นทางจะเป็นค่าว่าง ไม่มีการเดา/ยัดข้อมูลปลอม

**เดือน ส.ค. 69 ยังไม่มีไฟล์รวมแบบ Schema A/B** — มีแต่ไฟล์ดิบแยกตามขนส่ง/ทีมย่อย
ต้องรวมเป็นไฟล์เดียวก่อน (แบบเดือนอื่น ๆ) แล้วเพิ่มเข้า `pipeline/config.py`

## วิธีรัน (ไม่ใช้ terminal — แนะนำสำหรับตอนนี้)

ใช้ **Google Colab** รันในเบราว์เซอร์ล้วน ไม่ต้องติดตั้งอะไรในเครื่อง:

1. เตรียม service account key (ไฟล์ `.json`) ของ `glory-sheets-reader-456@ptglory-dashboard-sales-fb.iam.gserviceaccount.com`
   ถ้ายังไม่มี: Google Cloud Console → IAM & Admin → Service Accounts → เลือก account นี้ →
   แท็บ Keys → Add Key → Create new key → JSON → Create (ไฟล์จะดาวน์โหลดมาเอง)
2. เปิด [colab.research.google.com](https://colab.research.google.com) → File → Upload notebook →
   เลือกไฟล์ `pipeline/combine_returns_colab.ipynb` จาก repo นี้
3. รันทีละเซลล์จากบนลงล่าง (กด ▶ หรือ `Shift+Enter`) — เซลล์ที่ 2 จะมีปุ่มให้อัปโหลด service account key
4. รอจนถึงขั้นตอนอ่านข้อมูล (1-3 นาที เพราะแต่ละไฟล์มี 70,000+ แถว) จะเห็นสรุปจำนวนแถวต่อเดือน
   + ตัวอย่างข้อมูล 20 แถวแรกในหน้า Colab เลย
5. เซลล์สุดท้ายของขั้นตอนที่ 7 จะดาวน์โหลดไฟล์ CSV รวมทุกเดือนกลับเครื่องให้อัตโนมัติ

ไฟล์ key ที่อัปโหลดเข้า Colab จะอยู่แค่ใน session นั้น หายไปเมื่อปิดแท็บ ไม่ถูกบันทึกถาวรที่ไหน

## วิธีรันแบบ terminal (ทางเลือก เมื่อสะดวกแล้ว)

```bash
pip install -r requirements.txt
```

1. สร้าง/ใช้ service account ที่มีอีเมล `glory-sheets-reader-456@ptglory-dashboard-sales-fb.iam.gserviceaccount.com`
   เปิด Google Sheets API + Drive API ให้ project นั้น
2. แชร์ไฟล์ทุกเดือนใน `pipeline/config.py` (`SOURCE_SHEETS`) ให้อีเมลนี้เป็น **Viewer**
   (ยืนยันแล้วว่าทุกไฟล์แชร์ให้ `glory-sheets-reader-456@ptglory-dashboard-sales-fb.iam.gserviceaccount.com` ไว้แล้ว)
3. ดาวน์โหลด key JSON ของ service account มาไว้ที่ path ตาม `CREDS_PATH` ใน `pipeline/config.py`
   (ห้าม commit ไฟล์นี้เข้า git — อยู่ใน `.gitignore` แล้ว)
4. รัน:

   ```bash
   python pipeline/combine_returns.py
   ```

   จะได้ไฟล์ `output/returns_2569_combined.csv` ไว้เช็คข้อมูลก่อนเสมอ

## ต่อ DuckDB

ค่าเริ่มต้นเปิดไว้แล้ว (`ENABLE_DUCKDB_LOAD = True` ใน `pipeline/config.py`) ทุกครั้งที่รัน
`python pipeline/combine_returns.py` ข้อมูลรวมจะถูกโหลดเข้าไฟล์ DuckDB เดียว (ไม่ต้องตั้ง server ใด ๆ)
ที่ `output/returns_2569.duckdb` ตาราง `returns_2569` ด้วย (แก้ path/ชื่อตารางได้ที่ `DUCKDB_PATH`, `DUCKDB_TABLE`)

รันสคริปต์ซ้ำจะโหลดข้อมูลทับทั้งหมด (`DUCKDB_WRITE_MODE = "replace"`) — เหมาะกับขนาดข้อมูลระดับนี้
ไม่ต้องทำ incremental load

เปิดดู/query ไฟล์นี้ได้ตรง ๆ ด้วย DuckDB CLI หรือ Python:

```bash
python -c "import duckdb; print(duckdb.connect('output/returns_2569.duckdb').sql('SELECT * FROM returns_2569 LIMIT 10'))"
```

## สิ่งที่ต้องตรวจสอบก่อนเชื่อผลลัพธ์ 100%

- คอลัมน์ `unit` ของ Schema A ถูกดึงจากรหัสสินค้า (regex หา `U<เลข>`) เพราะไฟล์ไม่มีคอลัมน์ Unit ตรง ๆ
  ควรสุ่มเช็คกับ `พนักงานขาย` ว่า unit ตรงกันจริง
- คอลัมน์ `sales_channel` มาจาก `แพลตฟอร์ม` (Schema A) กับ `ฝ่ายที่ขาย` (Schema B) ซึ่งความหมายไม่ตรงกันเป๊ะ
  (A เป็นชื่อระบบขาย เช่น MiniShop/shopss, B เป็นฝ่าย เช่น FB/CRM/Marketplace) ใช้เปรียบเทียบภายใน schema
  เดียวกันไปก่อน ยังไม่ควรใช้ compare ข้าม schema ตรง ๆ
- ยังไม่ได้รวมไฟล์ มี.ค./ส.ค. เข้าเทียบกับไฟล์อื่นแบบ end-to-end run จริง (รันแค่ตรวจ schema จาก snippet)
  ควรรันสคริปต์เต็มแล้ว sanity-check จำนวนแถวต่อเดือนกับตัวเลขที่ทีมรายงานในที่ประชุม
