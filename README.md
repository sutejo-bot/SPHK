# Pantau Bumi - Peta Sebaran Hotspot Konsesi & Hauling Road

**Pantau Bumi** adalah sistem pemantauan dan pemetaan sebaran hotspot (anomali termal) real-time di wilayah konsesi IUPK Produksi, Wilayah Penunjang, dan koridor Hauling Road (Tabalong - Balangan - Barito Selatan).

Sistem ini terintegrasi langsung dengan satelit **NASA FIRMS** (VIIRS & MODIS) serta **Geoportal ESDM** untuk visualisasi batas konsesi dan zona penyangga (buffer 1 km).

---

## 🚀 Panduan Memasukkan ke GitHub & Deploy ke Netlify

### Bagian 1: Upload / Push ke GitHub

1. **Buka Terminal / Command Prompt** di direktori proyek ini.
2. Pastikan Git sudah terinstal di komputer Anda.
3. Inisialisasi repositori Git lokal (jika belum):
   ```bash
   git init
   git branch -M main
   ```
4. Tambahkan seluruh file ke staging dan buat commit awal:
   ```bash
   git add .
   git commit -m "feat: initial commit peta hotspot adaro indonesia"
   ```
5. Buat repositori baru di [GitHub](https://github.com/new) (misalnya diberi nama `peta-hotspot-adaro`).
   - *Catatan: Biarkan opsi "Initialize this repository with a README" tidak tercentang agar tidak konflik.*
6. Hubungkan repositori lokal ke GitHub dan lakukan push:
   ```bash
   # Ganti USERNAME dan REPO_NAME sesuai akun Anda:
   git remote add origin https://github.com/USERNAME/peta-hotspot-adaro.git
   git push -u origin main
   ```

---

### Bagian 2: Deploy ke Netlify

Aplikasi ini sudah dilengkapi file konfigurasi **`netlify.toml`** dan **Netlify Functions** (`netlify/functions/hotspots.ts` & `netlify/functions/iupk.ts`), sehingga siap dideploy ke Netlify secara otomatis:

1. **Masuk ke Netlify**:
   - Buka [https://app.netlify.com](https://app.netlify.com) dan login (disarankan menggunakan akun GitHub).
2. **Import Repository**:
   - Klik tombol **"Add new site"** > pilih **"Import an existing project"**.
   - Pilih penyedia Git: **GitHub**.
   - Cari dan pilih repositori yang baru saja Anda push (`peta-hotspot-adaro`).
3. **Pengaturan Build (Otomatis Terdeteksi)**:
   - Netlify akan otomatis membaca file `netlify.toml`:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
     - **Functions directory**: `netlify/functions`
4. **Atur Environment Variable (PENTING)**:
   - Sebelum klik deploy, buka bagian **Environment variables** (atau setelah dibuat di menu *Site configuration* > *Environment variables*).
   - Tambahkan variabel:
     - **Key**: `NASA_API_KEY`
     - **Value**: Masukkan API key NASA FIRMS Anda (dapatkan dari [NASA FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/)).
5. **Deploy Site**:
   - Klik **"Deploy peta-hotspot-adaro"**.
   - Tunggu proses build selesai (biasanya sekitar 1–2 menit).
   - Netlify akan memberikan URL live (contoh: `https://peta-hotspot-adaro.netlify.app`).

Setiap kali Anda melakukan `git push` ke GitHub, Netlify akan otomatis melakukan build dan deploy versi terbaru (*Continuous Deployment*).

---

## 🛠️ Menjalankan Secara Lokal (Local Development)

### 1. Prasyarat
- Node.js versi 18 atau 20+
- NPM / Bun / Yarn

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment File
Salin `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Isi `NASA_API_KEY` dengan kunci API NASA FIRMS Anda:
```env
NASA_API_KEY="kunci_api_nasa_anda"
```

### 4. Menjalankan Server Development
```bash
npm run dev
```
Aplikasi dapat diakses melalui browser di `http://localhost:3000`.

### 5. Build Produksi
```bash
npm run build
```

---

## 📦 Struktur Utama Proyek

- `src/` : Kode sumber frontend (React + Tailwind CSS + Leaflet).
  - `src/components/MapComponent.tsx` : Komponen peta interaktif, layer batas IUPK, jalur hauling KM 0–73, pos sekuriti, dan titik hotspot.
  - `src/components/Sidebar.tsx` : Panel daftar hotspot, filter waktu, dan detail status anomali termal.
  - `src/data.ts` : Logika kalkulasi poligon Turf.js, buffer 1 km, dan pengolahan data satelit.
  - `src/adaroSecurityData.ts` : Data pos strategis operasional dan koordinat jalur hauling.
- `server.ts` : Backend Express untuk dev mode lokal & container deployment.
- `netlify.toml` : Konfigurasi build dan redirect URL untuk Netlify.
- `netlify/functions/` : Serverless function untuk environment Netlify:
  - `hotspots.ts` : Proxy serverless aman untuk mengambil data anomali termal NASA FIRMS.
  - `iupk.ts` : Proxy serverless untuk query batas IUPK ESDM Geoportal.
