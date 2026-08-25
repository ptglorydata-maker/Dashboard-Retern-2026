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

## วิธีรัน

```bash
pip install -r requirements.txt
```

1. สร้าง/ใช้ service account ที่มีอีเมล `glory-sheets-reader-456@ptglory-dashboard-sales-fb.iam.gserviceaccount.com`
   เปิด Google Sheets API + Drive API ให้ project นั้น
2. แชร์ไฟล์ทุกเดือนใน `pipeline/config.py` (`SOURCE_SHEETS`) ให้อีเมลนี้เป็น **Viewer**
3. ดาวน์โหลด key JSON ของ service account มาไว้ที่ path ตาม `CREDS_PATH` ใน `pipeline/config.py`
   (ห้าม commit ไฟล์นี้เข้า git — อยู่ใน `.gitignore` แล้ว)
4. รัน:

   ```bash
   python pipeline/combine_returns.py
   ```

   จะได้ไฟล์ `output/returns_2569_combined.csv` ไว้เช็คข้อมูลก่อนเสมอ

## ต่อ BigQuery

แก้ `pipeline/config.py`:

```python
ENABLE_BQ_LOAD = True
BQ_PROJECT = "<project id จริง>"
BQ_DATASET = "chargeback_dashboard"
```

ต้องสร้าง dataset ใน BigQuery ก่อน (ครั้งเดียว) แล้ว service account ต้องมีสิทธิ์
`BigQuery Data Editor` + `BigQuery Job User` บน project นั้น รันสคริปต์ซ้ำจะโหลดข้อมูลทับ
ทั้งหมด (`BQ_WRITE_MODE = "replace"`) — เหมาะกับขนาดข้อมูลระดับนี้ ไม่ต้องทำ incremental load

## สิ่งที่ต้องตรวจสอบก่อนเชื่อผลลัพธ์ 100%

- คอลัมน์ `unit` ของ Schema A ถูกดึงจากรหัสสินค้า (regex หา `U<เลข>`) เพราะไฟล์ไม่มีคอลัมน์ Unit ตรง ๆ
  ควรสุ่มเช็คกับ `พนักงานขาย` ว่า unit ตรงกันจริง
- คอลัมน์ `sales_channel` มาจาก `แพลตฟอร์ม` (Schema A) กับ `ฝ่ายที่ขาย` (Schema B) ซึ่งความหมายไม่ตรงกันเป๊ะ
  (A เป็นชื่อระบบขาย เช่น MiniShop/shopss, B เป็นฝ่าย เช่น FB/CRM/Marketplace) ใช้เปรียบเทียบภายใน schema
  เดียวกันไปก่อน ยังไม่ควรใช้ compare ข้าม schema ตรง ๆ
- ยังไม่ได้รวมไฟล์ มี.ค./ส.ค. เข้าเทียบกับไฟล์อื่นแบบ end-to-end run จริง (รันแค่ตรวจ schema จาก snippet)
  ควรรันสคริปต์เต็มแล้ว sanity-check จำนวนแถวต่อเดือนกับตัวเลขที่ทีมรายงานในที่ประชุม
