import React, { useState } from "react";
import { Bot, Bell, CheckCircle2, AlertCircle, RefreshCw, Clock, ShieldCheck, X, Send, MapPin, ExternalLink } from "lucide-react";
import { cn } from "../utils";

interface AutoNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: any;
  onRefreshStatus: () => Promise<void>;
}

export default function AutoNotifyModal({
  isOpen,
  onClose,
  status,
  onRefreshStatus
}: AutoNotifyModalProps) {
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [manualMessageType, setManualMessageType] = useState<"success" | "error" | "info">("info");

  if (!isOpen) return null;

  const handleRunNow = async () => {
    setIsRunningManual(true);
    setManualMessage(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch("/api/auto-notify/run", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const text = await res.text();
      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        setManualMessageType("error");
        setManualMessage(
          data?.error || 
          `Server sedang memproses atau memulai ulang (HTTP ${res.status}). Silakan coba beberapa detik lagi.`
        );
        return;
      }

      if (data && data.success) {
        await onRefreshStatus();
        const count = data?.result?.newHotspots || 0;
        const totalChecked = data?.result?.checked || 0;
        setManualMessageType(count > 0 ? "success" : "info");
        setManualMessage(
          count > 0
            ? `Berhasil! Terdeteksi ${count} titik api baru dan peringatan darurat telah dikirim ke Telegram.`
            : `Pemeriksaan selesai (${totalChecked} hotspot aktif diverifikasi). Tidak ada anomali titik api baru di area konsesi saat ini.`
        );
      } else {
        setManualMessageType("error");
        setManualMessage(`Gagal: ${data?.error || "Gagal memproses respons dari server pemantau."}`);
      }
    } catch (err: any) {
      setManualMessageType("error");
      if (err?.name === "AbortError") {
        setManualMessage("Waktu pemeriksaan melebihi batas (timeout). Server sedang sibuk, silakan coba sesaat lagi.");
      } else {
        setManualMessage(`Koneksi terputus saat menghubungi server. Silakan coba kembali.`);
      }
    } finally {
      setIsRunningManual(false);
    }
  };

  const isTgReady = status?.telegramConfigured;
  const lastCheck = status?.lastRunTime
    ? new Date(status.lastRunTime).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }) + " WITA"
    : "Menunggu siklus pertama";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Otomatisasi Peringatan Telegram 24/7
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Aktif di Server
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pemeriksaan berjalan di latar belakang server tanpa perlu membuka aplikasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
              <div className="text-slate-400 text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Interval Pengecekan</span>
              </div>
              <div className="font-semibold text-slate-200 text-sm">
                Setiap {status?.intervalMinutes || 5} Menit Sekali
              </div>
              <div className="text-[11px] text-slate-400">
                Terakhir: <span className="text-slate-300 font-mono">{lastCheck}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
              <div className="text-slate-400 text-xs flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>Target Telegram</span>
              </div>
              <div className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                {isTgReady ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Bot Terhubung</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Belum Dikonfigurasi</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {isTgReady ? "Token & Chat ID tersimpan di server" : "Isi TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID"}
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/50 text-slate-300 space-y-1.5">
            <div className="font-semibold text-blue-300 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Sistem Otomatisasi & Anti-Duplikasi Hotspot
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              • <strong>Mandiri 24/7 di Server</strong>: Pengecekan satelit berjalan otomatis setiap {status?.intervalMinutes || 10} menit di latar belakang server tanpa perlu membuka web.<br />
              • <strong>Anti-Spam & Anti-Duplikasi</strong>: Menggunakan klaster spasial 1.2 KM & jendela waktu 24 jam. Titik api yang sama tidak akan dikirim berulang kali.<br />
              • <strong>Aman Saat Web Dibuka</strong>: Membuka atau mengakses aplikasi tidak akan memicu pengiriman notifikasi otomatis ulang.
            </p>
          </div>

          {/* Manual Trigger Section */}
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-200 text-xs sm:text-sm">Uji Pengecekan Manual</div>
              <div className="text-[11px] text-slate-400">
                Paksa server memeriksa satelit NASA dan deteksi titik api sekarang juga
              </div>
            </div>
            <button
              onClick={handleRunNow}
              disabled={isRunningManual}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm",
                isRunningManual
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white active:scale-95"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRunningManual && "animate-spin")} />
              <span>{isRunningManual ? "Memeriksa..." : "Cek Sekarang"}</span>
            </button>
          </div>

          {manualMessage && (
            <div className={cn(
              "p-3 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in transition-all",
              manualMessageType === "success" && "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
              manualMessageType === "error" && "bg-rose-950/40 border-rose-500/40 text-rose-300",
              manualMessageType === "info" && "bg-blue-950/40 border-blue-500/40 text-blue-300"
            )}>
              {manualMessageType === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              {manualMessageType === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
              {manualMessageType === "info" && <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}
              <div className="flex-1 leading-relaxed">{manualMessage}</div>
            </div>
          )}

          {/* Recent Automated History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
              <span>Riwayat Hotspot Terpantau ({status?.totalTrackedHotspots || 0})</span>
              <span className="text-[11px] text-slate-500">Maksimal 15 terakhir</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950/50">
              {(!status?.recentNotifications || status.recentNotifications.length === 0) ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Belum ada riwayat deteksi otomatis yang tercatat.
                </div>
              ) : (
                status.recentNotifications.map((n: any) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-200 truncate">{n.id}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded font-semibold",
                          n.zone === "iupk"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        )}>
                          {n.zone === "iupk" ? "IUPK" : "Buffer 1KM"}
                        </span>
                        {n.status === "notified" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Terkirim
                          </span>
                        )}
                        {n.status === "cluster_duplicate" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/40">
                            Klaster Aman
                          </span>
                        )}
                        {n.status === "initial_baseline" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Baseline
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px] truncate mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{n.location || `${n.lat}, ${n.lng}`}</span>
                      </div>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${n.lat},${n.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
                      title="Buka Peta"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-800/40 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
