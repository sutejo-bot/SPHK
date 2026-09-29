import React, { useState, useEffect } from "react";
import { 
  X, 
  HelpCircle, 
  BookOpen, 
  Layers, 
  ShieldCheck, 
  Flame, 
  Satellite, 
  Info, 
  Search, 
  Wind, 
  CloudRain, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  Bot,
  ExternalLink,
  ChevronRight,
  Database,
  BarChart3,
  Filter,
  Activity
} from "lucide-react";

interface HelpManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "cara-kerja" | "petunjuk" | "sumber" | "glosarium";

export default function HelpManualModal({ isOpen, onClose }: HelpManualModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("cara-kerja");
  const [searchTerm, setSearchTerm] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const glossaryItems = [
    {
      term: "IUPK",
      expanded: "Izin Usaha Pertambangan Khusus",
      desc: "Wilayah izin pertambangan resmi yang mencakup konsesi penambangan batubara di Kabupaten Tabalong dan Balangan, Kalimantan Selatan.",
      category: "Wilayah Operasional"
    },
    {
      term: "FDRS",
      expanded: "Fire Danger Rating System",
      desc: "Sistem penilaian bahaya kebakaran hutan dan lahan berbasis data meteorologi (suhu udara, kelembapan, curah hujan, dan kecepatan angin) yang diadopsi BMKG & KLHK untuk mengukur kemudahan terjadinya kebakaran.",
      category: "Metode & Standar"
    },
    {
      term: "VIIRS",
      expanded: "Visible Infrared Imaging Radiometer Suite",
      desc: "Sensor radiometer inframerah multispektral beresolusi tinggi (375 meter) pada satelit Suomi-NPP dan NOAA-20/21. Sangat sensitif mendeteksi titik api kecil dan asap tipis.",
      category: "Satelit & Sensor"
    },
    {
      term: "MODIS",
      expanded: "Moderate Resolution Imaging Spectroradiometer",
      desc: "Sensor pendeteksi anomali termal pada satelit NASA Terra dan Aqua dengan resolusi spasial 1 km, memberikan data historis dan verifikasi komparatif sejak tahun 2000.",
      category: "Satelit & Sensor"
    },
    {
      term: "Himawari-9",
      expanded: "Satelit Geostasioner Badan Meteorologi Jepang (JMA)",
      desc: "Satelit cuaca orbit geostasioner yang memindai kepulauan Indonesia setiap 10-15 menit untuk deteksi anomali termal dan awan panas secara hampir waktu-nyata (near real-time).",
      category: "Satelit & Sensor"
    },
    {
      term: "SiPongi+",
      expanded: "Sistem Informasi Karhutla KLHK RI",
      desc: "Platform pemantauan karhutla terpadu Kementerian Lingkungan Hidup dan Kehutanan Republik Indonesia yang mengintegrasikan data satelit terverifikasi nasional.",
      category: "Sumber Data"
    },
    {
      term: "NASA FIRMS",
      expanded: "Fire Information for Resource Management System",
      desc: "Sistem distribusi global NASA yang memproses dan mendistribusikan data anomali termal satelit secara near real-time dalam hitungan 1-3 jam setelah overpass satelit.",
      category: "Sumber Data"
    },
    {
      term: "BRIN",
      expanded: "Badan Riset dan Inovasi Nasional",
      desc: "Lembaga riset pemerintah Indonesia yang mengoperasikan stasiun bumi penerima satelit polar (termasuk NOAA/Terra/Aqua) dan kalibrasi algoritma karhutla tropis.",
      category: "Sumber Data"
    },
    {
      term: "BMKG",
      expanded: "Badan Meteorologi, Klimatologi, dan Geofisika",
      desc: "Badan resmi pemerintah Indonesia untuk prakiraan cuaca, analisis indeks kekeringan, FDRS nasional, dan pemantauan iklim ekstrem (El Niño/IOD).",
      category: "Sumber Data"
    },
    {
      term: "WITA",
      expanded: "Waktu Indonesia Tengah (UTC+8)",
      desc: "Zona waktu lokal yang digunakan di seluruh aplikasi ini, sesuai dengan lokasi operasional tambang di Kalimantan Selatan dan Kalimantan Tengah.",
      category: "Umum"
    },
    {
      term: "Hauling Road",
      expanded: "Jalan Angkutan Khusus Batubara (Hauling Corridor)",
      desc: "Koridor jalan angkutan batubara beraspal/agregat dari area tambang Tabalong menuju terminal pelabuhan sungai di Kelanis.",
      category: "Wilayah Operasional"
    },
    {
      term: "Kelanis Port",
      expanded: "Terminal Pelabuhan Batubara Kelanis (Sungai Barito)",
      desc: "Fasilitas pelabuhan sungai dan transfer batubara utama yang terletak di Barito Selatan, Kalimantan Tengah.",
      category: "Wilayah Operasional"
    },
    {
      term: "Buffer Zone",
      expanded: "Zona Penyangga (1 km perimeter)",
      desc: "Perimeter pengawasan selebar 1 km di luar garis batas konsesi IUPK untuk mendeteksi dini api dari luar konsesi yang berpotensi merambat masuk.",
      category: "Wilayah Operasional"
    },
    {
      term: "Confidence (%)",
      expanded: "Tingkat Keyakinan Anomali Termal (0 - 100%)",
      desc: "Derajat kepastian algoritma bahwa anomali yang tertangkap sensor merupakan api/pembakaran riil dan bukan pantulan sinar matahari (sun glint) atau awan hangat.",
      category: "Metode & Standar"
    },
    {
      term: "Smoke Plume",
      expanded: "Prakiraan Sebaran Asap Karhutla",
      desc: "Simulasi proyeksi kerucut arah asap berdasarkan arah dan kecepatan angin real-time dari stasiun cuaca terdekat untuk memitigasi bahaya jarak pandang di jalan hauling dan pit.",
      category: "Metode & Standar"
    },
    {
      term: "dBZ",
      expanded: "Decibel relative to Z (Reflektivitas Radar)",
      desc: "Satuan kekuatan pantulan gelombang radar cuaca yang merefleksikan kerapatan butir air hujan. Nilai >30 dBZ mengindikasikan hujan sedang hingga lebat.",
      category: "Metode & Standar"
    }
  ];

  const filteredGlossary = glossaryItems.filter(item => 
    item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.expanded.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="help-modal-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Panduan & Info Sistem Monitoring Karhutla</span>
                <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full font-mono uppercase tracking-wider font-semibold">
                  v2.4 IUPK
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Petunjuk operasional, metodologi deteksi satelit, sumber data terpadu, dan daftar singkatan resmi.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Tutup panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 sm:px-5 gap-1 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("cara-kerja")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "cara-kerja"
                ? "border-orange-500 text-orange-400 bg-slate-900/40"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Cara Kerja Sistem</span>
          </button>

          <button
            onClick={() => setActiveTab("petunjuk")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "petunjuk"
                ? "border-orange-500 text-orange-400 bg-slate-900/40"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Petunjuk Fitur & Navigasi</span>
          </button>

          <button
            onClick={() => setActiveTab("sumber")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "sumber"
                ? "border-orange-500 text-orange-400 bg-slate-900/40"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Sumber Data & Satelit</span>
          </button>

          <button
            onClick={() => setActiveTab("glosarium")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "glosarium"
                ? "border-orange-500 text-orange-400 bg-slate-900/40"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Glosarium & Singkatan</span>
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-300 text-sm overscroll-contain">
          
          {/* TAB 1: CARA KERJA SISTEM */}
          {activeTab === "cara-kerja" && (
            <div className="space-y-6">
              {/* Intro Box */}
              <div className="p-4 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-slate-900 border border-orange-500/25 rounded-xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1.5">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Alur Intelegensi Deteksi Anomali Panas & Karhutla
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Aplikasi ini dirancang khusus untuk tim Satgas Karhutla. Sistem secara otomatis menarik, memfilter, mengklasterisasi, dan memvalidasi anomali termal dari konstelasi satelit penginderaan jauh internasional dan nasional, lalu memetakan posisinya terhadap batas konsesi IUPK dan koridor jalan hauling batubara.
                </p>
              </div>

              {/* Step by step pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-bold flex items-center justify-center border border-blue-500/40">1</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Deteksi Termal Satelit</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sensor inframerah (VIIRS 375m & MODIS 1km) menangkap pancaran energi radiasi panas permukaan bumi pada pita 4µm dan 11µm. Jika suhu piksel melebihi ambang batas latar belakang, titik tersebut dideteksi sebagai potensi hotspot.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center border border-emerald-500/40">2</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Klaster Anti-Duplikasi 1.5 km</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Satelit berbeda sering mendeteksi kebakaran yang sama pada selisih waktu beberapa menit. Sistem menerapkan algoritma spasial cerdas yang mengelompokkan titik berjarak ≤ 1.5 km menjadi satu insiden gabungan dengan tingkat keyakinan tertinggi agar operator tidak dibanjiri alarm duplikat.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center border border-amber-500/40">3</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Geofencing & Zonasi Risiko</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Setiap hotspot diklasifikasikan posisinya secara instan:
                    <br />• <strong>Ring 1 (Konsesi IUPK)</strong>: Prioritas Paling Kritis / Merah.
                    <br />• <strong>Ring 2 (Buffer Zone)</strong>: Zona Penyangga Waspada / Oranye.
                    <br />• <strong>Ring 3 (Hauling Road)</strong>: Jalur Angkutan Batubara ke Kelanis.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-mono text-xs font-bold flex items-center justify-center border border-rose-500/40">4</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Prakiraan Asap & Arah Angin</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mengintegrasikan model angin resolusi tinggi untuk membaca arah dan kecepatan angin lokal. Sistem memproyeksikan kerucut asap (<span className="text-amber-300 font-mono">smoke plume cone</span>) untuk mendeteksi apakah jalan hauling atau pit tambang terancam bahaya jarak pandang.
                  </p>
                </div>
              </div>

              {/* Automation Box */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Bot Telegram Otomatis 24/7 & Integrasi Lapangan</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Sistem dilengkapi modul daemon latar belakang yang terus memindai data satelit setiap interval terjadwal. Jika terdeteksi titik api baru di dalam wilayah konsesi IUPK atau koridor hauling, bot otomatis mengirimkan pesan darurat berformat terstruktur ke grup Telegram Satgas Karhutla (lengkap dengan koordinat, nama desa, jarak, dan tautan navigasi Google Maps).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PETUNJUK FITUR & NAVIGASI */}
          {activeTab === "petunjuk" && (
            <div className="space-y-4">
              <div className="space-y-3">
                
                {/* Fitur 1: Peta & Interaksi */}
                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-400" />
                    Peta Interaktif & Lapisan Visual
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong>Layer Dasar (Kanan Atas):</strong> Beralih antara Dark Canvas (kontras tinggi), Satelit Google Hybrid (citra riil bumi), dan Topografi ESRI.</li>
                    <li><strong>Garis Konsesi & Koridor:</strong> Garis merah menunjukkan batas IUPK Tambang, garis oranye putus-putus menunjukkan buffer zone, dan garis tebal biru/kuning menunjukkan Hauling Road menuju Pelabuhan Kelanis.</li>
                    <li><strong>Heatmap Klaster:</strong> Tombol toggle di kiri bawah peta untuk memvisualisasikan kepadatan hotspot dalam bentuk gradien panas.</li>
                    <li><strong>Radar Hujan Real-time:</strong> Menampilkan pergerakan awan presipitasi/hujan dari jaringan radar RainViewer di atas area konsesi.</li>
                  </ul>
                </div>

                {/* Fitur 2: Filter Status & Waktu */}
                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-400" />
                    Filter Status & Rentang Waktu
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong>Filter Status (Sidebar):</strong> Pilih antara <em>Semua</em>, <em>Baru (New)</em>, atau <em>Diakui (Acknowledged)</em> untuk menyembunyikan titik yang sudah tertangani dan mengurangi kepadatan visual pada peta.</li>
                    <li><strong>Lencana Filter Peta:</strong> Saat filter aktif, indikator mengambang di atas peta menginformasikan status aktif beserta tombol silang (✕) untuk mereset filter.</li>
                    <li><strong>Rentang Waktu:</strong> Pilih data deteksi <em>Saat Ini (LIVE)</em>, <em>12 Jam Lalu</em>, <em>1 Hari</em>, <em>7 Hari</em>, atau <em>30 Hari Terakhir</em>.</li>
                  </ul>
                </div>

                {/* Fitur 3: Verifikasi & Disposisi Lapangan */}
                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Aksi Verifikasi & Disposisi Cepat
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong>Tombol "Konfirmasi / Akui":</strong> Mengubah status hotspot dari <em>Baru</em> menjadi <em>Diakui</em> setelah regu pemadam diberangkatkan atau groundcheck dilakukan.</li>
                    <li><strong>Kirim WhatsApp / Telegram:</strong> Tombol di setiap kartu hotspot untuk meneruskan koordinat, arah angin, dan proyeksi asap langsung ke personel patroli terdekat via chat.</li>
                    <li><strong>Arahkan Peta:</strong> Mengklik kartu hotspot di Sidebar akan langsung mengarahkan kamera peta ke titik koordinat anomali.</li>
                  </ul>
                </div>

                {/* Fitur 4: Panel Statistik & Log Sistem */}
                <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    Statistik & Log Sistem (Audit Notifikasi)
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong>Panel Statistik Hotspot:</strong> Akses via tombol <em>Statistik Hotspot</em> di bilah atas atau tombol di Sidebar bawah untuk melihat grafik batang sebaran per hari, diagram status, dan proporsi zonasi konsesi.</li>
                    <li><strong>Log Sistem & Audit Notifikasi:</strong> Akses via tombol <em>Log</em> di Sidebar bawah untuk memantau waktu pengiriman notifikasi otomatis secara presisi, status notifikasi terkirim (WhatsApp & Telegram), catatan fusi klaster anti-spam, serta ekspor dokumen audit (CSV & PDF).</li>
                  </ul>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: SUMBER DATA & SATELIT */}
          {activeTab === "sumber" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sistem menggabungkan data dari 5 institusi antariksa dan meteorologi bereputasi global dan nasional untuk memastikan tidak ada anomali termal yang terlewat:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                  <Satellite className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">NASA FIRMS (Suomi-NPP, NOAA-20/21 & Terra/Aqua)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sensor VIIRS (375 meter) dan MODIS (1 km) orbit polar. Menyediakan data termal dengan akurasi koordinat tinggi dan kalibrasi global.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                  <Radio className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Himawari-9 (Badan Meteorologi Jepang - JMA)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Satelit geostasioner yang memonitor atmosfer Indonesia dengan frekuensi pemindaian setiap 10-15 menit untuk deteksi anomali termal paling terkini (real-time).
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">SiPongi+ (Kementerian Lingkungan Hidup dan Kehutanan RI)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sistem rujukan resmi karhutla Republik Indonesia yang telah melewati proses koreksi dan verifikasi spasial nasional.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                  <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">BRIN & BMKG RI</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Data satelit polar stasiun bumi lokal, FDRS nasional, serta parameter meteorologi permukaan Kalimantan Selatan.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                  <CloudRain className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">RainViewer Weather Radar Composite</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Jaringan radar cuaca komposit internasional untuk pemantauan sel awan hujan lebat dan pergerakan massa air secara real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GLOSARIUM & SINGKATAN */}
          {activeTab === "glosarium" && (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari istilah, singkatan, atau penjelasan (mis: IUPK, FDRS, VIIRS, Buffer)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {/* Glossary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredGlossary.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-orange-400 font-mono tracking-wider">
                        {item.term}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 font-medium">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200">
                      {item.expanded}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              {filteredGlossary.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  <p className="text-xs font-semibold text-slate-400">Tidak ada istilah yang cocok dengan "{searchTerm}"</p>
                  <p className="text-[11px] text-slate-500 mt-1">Coba kata kunci lain seperti IUPK, FDRS, VIIRS, atau BMKG.</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm text-center"
          >
            Mengerti & Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
