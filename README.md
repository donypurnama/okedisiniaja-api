# OkeIniAja REST API Backend

Backend REST API untuk portal klien dan sistem retainer **OkeIniAja.com**. Dibangun dengan **Node.js + Express + TypeScript** dan terhubung ke database **SQLite** (`app.sqlite`).

---

## 🚀 Cara Menjalankan

### 1. Masuk ke direktori
```bash
cd /Users/donypee/Sites/okeiniaja-api
```

### 2. Jalankan Mode Development (Hot-Reload)
```bash
npm run dev
```
Server akan berjalan di **`http://localhost:5001`**.

### 3. Kompilasi Build & Start Production
```bash
npm run build
npm start
```

---

## 🗄️ Database & Schema
* File database: `database/app.sqlite` (menggunakan driver berkinerja tinggi `better-sqlite3` dengan WAL mode).
* File skema SQL: `database/schema.sql`.
* Upload berkas bukti bayar: `uploads/proofs/` (dapat diakses publik melalui `/uploads/...`).

---

## 🔑 Akun Default (Seed Data)

| Role | Email / WhatsApp | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@okeiniaja.com` / `6281291311218` | `admin123` | Akses penuh verifikasi & kelola pekerjaan |
| **Klien Demo** | `klien@okeiniaja.com` / `6281291311219` | `klien123` | Usaha: Kopi Senja Nusantara |

---

## 📡 Daftar Endpoint API

### 1. Autentikasi (`/api/auth`)
* `POST /api/auth/login`: Masuk via Email atau WhatsApp + Password (menghasilkan JWT token).
* `POST /api/auth/register`: Pendaftaran akun klien baru.
* `GET /api/auth/me`: Mengambil data pengguna login saat ini (Header `Authorization: Bearer <token>`).
* `PUT /api/auth/profile`: Memperbarui data profil bisnis/kontak.
* `PUT /api/auth/change-password`: Mengubah password akun.

### 2. Fitur Klien (`/api/client`)
* `GET /api/client/overview`: Ringkasan kuota (artikel SEO, foto, postingan medsos, backup).
* `GET /api/client/activities`: Daftar riwayat pekerjaan & status tayang.
* `GET /api/client/orders`: Riwayat pesanan paket.
* `POST /api/client/orders`: Membuat pesanan paket baru / addon.
* `POST /api/client/payments`: Konfirmasi transfer bank + upload berkas bukti transfer (Multipart form).
* `GET /api/client/notifications`: Daftar notifikasi klien.
* `PUT /api/client/notifications/:id/read`: Tandai notifikasi dibaca.
* `PUT /api/client/notifications/read-all`: Tandai seluruh notifikasi dibaca.

### 3. Fitur Administrator (`/api/admin`)
* `GET /api/admin/clients`: Daftar seluruh klien terdaftar.
* `GET /api/admin/clients/:id`: Detail profil klien, riwayat order, pekerjaan, dan leads.
* `PUT /api/admin/clients/:id/password`: Reset password klien oleh admin.
* `GET /api/admin/payments`: Daftar seluruh bukti transfer pembayaran yang masuk.
* `POST /api/admin/payments/:id/verify`: Verifikasi (`verified`), refund, atau tolak (`rejected`) pembayaran klien.
* `GET /api/admin/activities`: Daftar seluruh penugasan pekerjaan.
* `POST /api/admin/activities`: Input pekerjaan baru (artikel, foto, medsos, backup).
* `PUT /api/admin/activities/:id`: Perbarui progres checklist & URL pekerjaan.
* `DELETE /api/admin/activities/:id`: Hapus pekerjaan.
* `GET /api/admin/invoices`: Rekap seluruh invoice klien.
