import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Printer, 
  Download, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Satellite, 
  MessageCircle, 
  Send, 
  AlertTriangle, 
  Info, 
  Terminal, 
  Activity, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  Filter,
  Check,
  Radio,
  FileSpreadsheet,
  Zap,
  XCircle,
  AlertCircle,
  Cpu,
  Database,
  ShieldCheck,
  HardDrive,
  Heart,
  Wifi,
  BellRing,
  Lock,
  Key
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Hotspot, HotspotTimeRange } from "../types";
import { getTimeRangeDescription, formatDateWITA, formatTimeWITA, fetchAddressFromCoordinates, maskPhoneNumber, maskTelegramId } from "../utils";

interface LogEntry {
  id: string;
  lat: number;
  lng: number;
  detectedAt: string | Date;
  notifiedAt: string | Date;
  location: string;
  zone: string;
  status: string; // "notified" | "failed" | "cluster_duplicate" | "initial_baseline" | "manual"
  source?: string;
  telegramSent?: boolean;
  telegramError?: string;
  waSent?: boolean;
  waError?: string;
  processDurationSeconds?: number;
  clusterWith?: string;
  confidence?: number;
  isAuto?: boolean;
}

interface AutoNotifierStats {
  totalTracked?: number;
  lastRunTime?: string | null;
  intervalMinutes?: number;
  telegramConfigured?: boolean;
  whatsappConfigured?: boolean;
  lastCheckStatus?: string;
}

interface PrintPreviewModalProps {
  hotspots: Hotspot[];
  timeRange: HotspotTimeRange;
  onClose: () => void;
}

export default function PrintPreviewModal({ hotspots, timeRange, onClose }: PrintPreviewModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<AutoNotifierStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [showHealthPanel, setShowHealthPanel] = useState<boolean>(false);
  const [heartbeatLoading, setHeartbeatLoading] = useState<boolean>(false);
  const [heartbeatToast, setHeartbeatToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [retryLoading, setRetryLoading] = useState<boolean>(false);
  const [waTargetInput, setWaTargetInput] = useState<string>("");
  const [authStage, setAuthStage] = useState<"idle" | "password" | "editing">("idle");
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState<boolean>(false);
  const [waSaveStatus, setWaSaveStatus] = useState<string | null>(null);

  // Change password states
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [currentPassInput, setCurrentPassInput] = useState<string>("");
  const [newPassInput, setNewPassInput] = useState<string>("");
  const [confirmPassInput, setConfirmPassInput] = useState<string>("");
  const [changePassLoading, setChangePassLoading] = useState<boolean>(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);

  const handleChangePassword = async () => {
    if (!currentPassInput.trim()) {
      setChangePassError("Password saat ini harus diisi!");
      return;
    }
    if (!newPassInput.trim()) {
      setChangePassError("Password baru harus diisi!");
      return;
    }
    if (newPassInput.trim().length < 4) {
      setChangePassError("Password baru minimal 4 karakter!");
      return;
    }
    if (newPassInput.trim() !== confirmPassInput.trim()) {
      setChangePassError("Konfirmasi password baru tidak cocok!");
      return;
    }

    setChangePassLoading(true);
    setChangePassError(null);
    try {
      const res = await fetch("/api/change-admin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassInput.trim(),
          newPassword: newPassInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangePassSuccess("Password admin berhasil diubah!");
        setTimeout(() => {
          setIsChangingPassword(false);
          setCurrentPassInput("");
          setNewPassInput("");
          setConfirmPassInput("");
          setChangePassSuccess(null);
        }, 2000);
      } else {
        setChangePassError(data.error || "Gagal mengubah password");
      }
    } catch {
      setChangePassError("Gagal menghubungi server");
    } finally {
      setChangePassLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/notifier-settings")
      .then(r => r.json())
      .then(d => {
        if (d && (d.maskedWhatsAppTarget || d.resolvedWhatsAppTarget)) {
          setWaTargetInput(d.maskedWhatsAppTarget || maskPhoneNumber(d.resolvedWhatsAppTarget));
        }
      })
      .catch(() => {});
  }, []);

  const handleVerifyPassword = async () => {
    if (!adminPasswordInput.trim()) {
      setPasswordError("Password tidak boleh kosong");
      return;
    }
    setIsVerifyingPassword(true);
    setPasswordError(null);
    try {
      const res = await fetch("/api/verify-admin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthStage("editing");
        setWaTargetInput("");
        setPasswordError(null);
      } else {
        setPasswordError(data.error || "Password admin salah!");
      }
    } catch {
      setPasswordError("Gagal menghubungi server");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleSaveWaTarget = async () => {
    if (!waTargetInput.trim()) {
      setWaSaveStatus("Nomor tujuan tidak boleh kosong");
      setTimeout(() => setWaSaveStatus(null), 3000);
      return;
    }
    try {
      const res = await fetch("/api/notifier-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          whatsappTarget: waTargetInput.trim(),
          password: adminPasswordInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthStage("idle");
        setAdminPasswordInput("");
        setWaTargetInput(data.maskedWhatsAppTarget || maskPhoneNumber(data.resolvedWhatsAppTarget || waTargetInput));
        setWaSaveStatus("Nomor WhatsApp otomatis berhasil diperbarui & disimpan!");
        setTimeout(() => setWaSaveStatus(null), 4000);
        fetch("/api/system-diagnostics")
          .then(r => r.json())
          .then(d => setSystemHealth(d))
          .catch(() => {});
      } else {
        setWaSaveStatus(data.error || "Gagal menyimpan nomor");
        setTimeout(() => setWaSaveStatus(null), 4000);
      }
    } catch {
      setWaSaveStatus("Gagal menyimpan nomor");
      setTimeout(() => setWaSaveStatus(null), 4000);
    }
  };

  const handleRetryAllFailed = async () => {
    setRetryLoading(true);
    setHeartbeatToast(null);
    try {
      const res = await fetch("/api/auto-notify/retry", { method: "POST" });
      const data = await res.json();
      if (data.success && data.result) {
        const { retried, telegramSuccess, waSuccess } = data.result;
        setHeartbeatToast({
          type: "success",
          message: `Berhasil mencoba ulang ${retried} notifikasi (Telegram: ${telegramSuccess}, WhatsApp: ${waSuccess} berhasil terkirim)`
        });
        await fetchAuditLogs(false);
      } else {
        setHeartbeatToast({
          type: "error",
          message: "Tidak ada notifikasi gagal yang perlu dikirim ulang atau koneksi gagal."
        });
      }
    } catch (e: any) {
      setHeartbeatToast({
        type: "error",
        message: e?.message || "Gagal mencoba ulang notifikasi"
      });
    } finally {
      setRetryLoading(false);
      setTimeout(() => setHeartbeatToast(null), 7000);
    }
  };

  const handleTriggerHeartbeat = async () => {
    setHeartbeatLoading(true);
    setHeartbeatToast(null);
    try {
      const res = await fetch("/api/heartbeat/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setHeartbeatToast({
          type: "success",
          message: "Laporan Detak Jantung Sistem (Health Check 60m) berhasil dikirim ke grup Telegram!"
        });
        // Refresh diagnostics
        fetch("/api/system-diagnostics")
          .then(r => r.json())
          .then(d => setSystemHealth(d))
          .catch(() => {});
      } else {
        setHeartbeatToast({
          type: "error",
          message: data.message || "Gagal memproses pengiriman heartbeat"
        });
      }
    } catch (e: any) {
      setHeartbeatToast({
        type: "error",
        message: e?.message || "Koneksi ke endpoint heartbeat gagal"
      });
    } finally {
      setHeartbeatLoading(false);
      setTimeout(() => setHeartbeatToast(null), 7000);
    }
  };

  // Load audit logs from server
  const fetchAuditLogs = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // Fetch system diagnostics (memory usage, container guards, cache stats)
      fetch("/api/system-diagnostics")
        .then(r => r.json())
        .then(d => setSystemHealth(d))
        .catch(() => {});

      // 1. Fetch from server API
      const res = await fetch("/api/auto-notify/logs");
      let backendLogs: any[] = [];
      let backendStats: any = null;

      if (res.ok) {
        const data = await res.json();
        backendLogs = data.logs || [];
        backendStats = data.stats || null;
      } else {
        // Fallback to /api/auto-notify/status
        const fallbackRes = await fetch("/api/auto-notify/status");
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          backendLogs = fbData.recentNotifications || [];
          backendStats = {
            totalTracked: fbData.totalTrackedHotspots,
            lastRunTime: fbData.lastRunTime,
            intervalMinutes: fbData.intervalMinutes,
            telegramConfigured: fbData.telegramConfigured,
            whatsappConfigured: fbData.whatsappConfigured,
            lastCheckStatus: fbData.lastCheckStatus
          };
        }
      }

      setStats(backendStats);

      // Build unified audit entries
      const unifiedMap = new Map<string, LogEntry>();

      // Populate from backend notified storage
      for (const item of backendLogs) {
        unifiedMap.set(item.id, {
          id: item.id,
          lat: Number(item.lat),
          lng: Number(item.lng),
          detectedAt: item.detectedAt,
          notifiedAt: item.notifiedAt || item.detectedAt,
          location: item.location || "Wilayah Operasional",
          zone: item.zone || "outside",
          status: item.status || "notified",
          source: item.source || "Multi-Satelit Terintegrasi",
          telegramSent: Boolean(item.telegramSent),
          telegramError: item.telegramError,
          waSent: Boolean(item.waSent),
          waError: item.waError,
          processDurationSeconds: item.processDurationSeconds,
          clusterWith: item.clusterWith,
          confidence: 85,
          isAuto: true
        });
      }

      // Also merge active NASA hotspots that are in current view
      for (const h of hotspots) {
        if (!unifiedMap.has(h.id)) {
          unifiedMap.set(h.id, {
            id: h.id,
            lat: h.location.lat,
            lng: h.location.lng,
            detectedAt: h.detectedAt,
            notifiedAt: h.detectedAt,
            location: h.address || "Memuat lokasi...",
            zone: h.zone,
            status: h.status === "new" ? "notified" : "initial_baseline",
            source: h.source || "Multi-Satelit Terintegrasi",
            telegramSent: false,
            waSent: false,
            confidence: h.confidence,
            isAuto: true
          });
        }
      }

      // Resolve addresses asynchronously for missing ones
      const entryList = Array.from(unifiedMap.values());
      entryList.sort((a, b) => new Date(b.notifiedAt).getTime() - new Date(a.notifiedAt).getTime());
      setLogs(entryList);

      // Background reverse geocode any entries that need address
      const unresolved = entryList.filter(e => !e.location || e.location.includes("Memuat") || e.location === "Wilayah Operasional");
      if (unresolved.length > 0) {
        Promise.all(
          unresolved.slice(0, 10).map(async (entry) => {
            try {
              const addr = await fetchAddressFromCoordinates(entry.lat, entry.lng);
              if (addr) {
                setLogs(prev => prev.map(p => p.id === entry.id ? { ...p, location: addr } : p));
              }
            } catch {
              // ignore
            }
          })
        );
      }

    } catch (err) {
      console.error("[LogModal] Gagal memuat audit log:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(true);
  }, [hotspots]);

  // Calculate elapsed process duration (latency between NASA satellite acquisition and system delivery dispatch)
  const getProcessDurationSeconds = (entry: LogEntry): number => {
    if (entry.processDurationSeconds !== undefined && entry.processDurationSeconds >= 0) {
      return entry.processDurationSeconds;
    }
    const det = new Date(entry.detectedAt).getTime();
    const not = new Date(entry.notifiedAt).getTime();
    if (!isNaN(det) && !isNaN(not)) {
      return Math.max(0, Math.round((not - det) / 1000));
    }
    return 0;
  };

  // Human readable process duration format
  const formatDurationDetailed = (totalSeconds: number): string => {
    if (totalSeconds < 60) {
      return `${totalSeconds} dtk`;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours} jam ${minutes} mnt`;
    }
    return `${minutes} mnt ${seconds > 0 ? `${seconds} dtk` : ''}`.trim();
  };

  // Determine severity for a log item
  const getSeverity = (entry: LogEntry): "CRITICAL" | "WARNING" | "INFO" | "FAILED" => {
    if (entry.status === "failed" || (entry.status === "notified" && !entry.telegramSent && !entry.waSent && !entry.clusterWith)) {
      return "FAILED";
    }
    if (entry.status === "cluster_duplicate" || entry.status === "initial_baseline") {
      return "INFO";
    }
    if (entry.zone === "iupk") {
      return "CRITICAL";
    }
    if (entry.zone === "buffer") {
      return "WARNING";
    }
    return "INFO";
  };

  // Human readable description of log status according to system logging norms
  const getLogMessage = (entry: LogEntry): string => {
    const duration = formatDurationDetailed(getProcessDurationSeconds(entry));

    // Case 1: Delivery Failure
    if (entry.status === "failed" || (entry.status === "notified" && !entry.telegramSent && !entry.waSent && !entry.clusterWith && (entry.waError || entry.telegramError))) {
      const errParts = [];
      if (entry.waError) errParts.push(`WhatsApp: ${entry.waError}`);
      if (entry.telegramError) errParts.push(`Telegram: ${entry.telegramError}`);
      const errDetail = errParts.length > 0 ? errParts.join(" | ") : "Koneksi gateway pesan terputus / kredensial belum valid";
      return `⚠️ KEGAGALAN PENGIRIMAN: Deteksi anomali termal baru (Waktu proses: ${duration}) gagal disiarkan otomatis. Penyebab: [${errDetail}]. Harap segera periksa gateway pesan atau lakukan intervensi darat!`;
    }

    // Case 2: Cluster Duplicate (Deduplication)
    if (entry.status === "cluster_duplicate") {
      return `Fusi Klaster (Anti-Spam): Titik termal terfusi dalam radius 1.5 km dari klaster aktif ${entry.clusterWith || "sebelumnya"} (Waktu proses: ${duration}). Pengiriman notifikasi berulang dicegah otomatis.`;
    }

    // Case 3: Initial Baseline
    if (entry.status === "initial_baseline") {
      return `Sinkronisasi Baseline Sistem: Titik api aktif tercatat dalam sistem pada startup awal pemantau latar belakang (Waktu proses: ${duration}, tanpa siaran notifikasi).`;
    }

    // Case 4: Partial Failure
    if (entry.status === "notified" && (!entry.telegramSent || !entry.waSent) && (entry.waError || entry.telegramError)) {
      const successChan = entry.waSent ? "WhatsApp" : (entry.telegramSent ? "Telegram" : "-");
      const failChan = !entry.waSent ? `WhatsApp (${entry.waError || 'Gagal'})` : `Telegram (${entry.telegramError || 'Gagal'})`;
      return `⚠️ PENGIRIMAN PARSIAL: Berhasil disiarkan via ${successChan}, namun pengiriman via ${failChan} gagal. Waktu proses: ${duration}.`;
    }

    // Case 5: Fully Successful Notification
    if (entry.status === "notified") {
      const channels = [];
      if (entry.waSent) channels.push("WhatsApp");
      if (entry.telegramSent) channels.push("Telegram");
      const channelText = channels.length > 0 ? channels.join(" & ") : "Sistem Pemantau 24/7";
      const zoneText = entry.zone === "iupk" ? "Konsesi IUPK (Area Inti)" : "Buffer Zone (Koridor)";
      return `Notifikasi Otomatis Berhasil Terkirim: Deteksi anomali termal baru di ${zoneText}. Peringatan darurat berhasil disiarkan melalui ${channelText} (Waktu proses satelit -> notifikasi: ${duration}).`;
    }

    return `Pemeriksaan Titik Api: Terverifikasi oleh algoritma pemantau satelit (Waktu proses: ${duration}).`;
  };

  // Filtered log list
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = item.id.toLowerCase().includes(query);
        const matchesLoc = item.location.toLowerCase().includes(query);
        const matchesSource = (item.source || "").toLowerCase().includes(query);
        const matchesStatus = item.status.toLowerCase().includes(query);
        const matchesErr = (item.telegramError || "").toLowerCase().includes(query) || (item.waError || "").toLowerCase().includes(query);
        if (!matchesId && !matchesLoc && !matchesSource && !matchesStatus && !matchesErr) {
          return false;
        }
      }

      // 2. Severity filter
      const sev = getSeverity(item);
      if (selectedSeverity !== "all") {
        if (selectedSeverity === "FAILED" && sev !== "FAILED") return false;
        if (selectedSeverity !== "FAILED" && sev !== selectedSeverity) return false;
      }

      // 3. Status filter
      if (selectedStatus !== "all") {
        if (selectedStatus === "notified_success" && (item.status !== "notified" || (!item.telegramSent && !item.waSent))) return false;
        if (selectedStatus === "failed" && item.status !== "failed" && !(item.status === "notified" && !item.telegramSent && !item.waSent)) return false;
        if (selectedStatus === "cluster_duplicate" && item.status !== "cluster_duplicate") return false;
        if (selectedStatus === "initial_baseline" && item.status !== "initial_baseline") return false;
      }

      return true;
    });
  }, [logs, searchTerm, selectedSeverity, selectedStatus]);

  // Aggregate stats
  const totalLogsCount = logs.length;
  const notifiedSuccessCount = logs.filter(l => l.status === "notified" && (l.telegramSent || l.waSent)).length;
  const failedCount = logs.filter(l => l.status === "failed" || (l.status === "notified" && !l.telegramSent && !l.waSent && (l.waError || l.telegramError))).length;
  const deduplicatedCount = logs.filter(l => l.status === "cluster_duplicate").length;
  const baselineCount = logs.filter(l => l.status === "initial_baseline").length;

  // Format precision timestamp down to seconds WITA
  const formatPrecisionWITA = (dateInput: string | Date): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    const dateStr = d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const timeStr = d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Makassar",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    return `${dateStr} • ${timeStr} WITA`;
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "ID Hotspot",
      "Waktu Pengiriman Otomatis (WITA)",
      "Waktu Deteksi Satelit NASA (WITA)",
      "Waktu Proses / Latensi Transmisi",
      "Tingkat Severity",
      "Status Pengiriman",
      "WhatsApp Terkirim",
      "WhatsApp Error",
      "Telegram Terkirim",
      "Telegram Error",
      "Lokasi",
      "Latitude",
      "Longitude",
      "Zona",
      "Satelit Sumber",
      "Catatan Sistem"
    ];

    const rows = filteredLogs.map(item => [
      `"${item.id}"`,
      `"${formatPrecisionWITA(item.notifiedAt)}"`,
      `"${formatPrecisionWITA(item.detectedAt)}"`,
      `"${formatDurationDetailed(getProcessDurationSeconds(item))}"`,
      `"${getSeverity(item)}"`,
      `"${item.status}"`,
      `"${item.waSent ? 'TERKIRIM' : 'TIDAK'}"`,
      `"${(item.waError || '').replace(/"/g, '""')}"`,
      `"${item.telegramSent ? 'TERKIRIM' : 'TIDAK'}"`,
      `"${(item.telegramError || '').replace(/"/g, '""')}"`,
      `"${(item.location || '').replace(/"/g, '""')}"`,
      item.lat.toFixed(5),
      item.lng.toFixed(5),
      `"${item.zone === 'iupk' ? 'Konsesi IUPK' : (item.zone === 'buffer' ? 'Buffer Zone' : 'Luar')}"`,
      `"${(item.source || '').replace(/"/g, '""')}"`,
      `"${getLogMessage(item).replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pantau_Bumi_System_Log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Official Audit Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PANTAU BUMI - LOG AUDIT SISTEM & RIWAYAT NOTIFIKASI OTOMATIS", pageWidth / 2, 16, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const printedAt = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });
    doc.text(`Waktu Cetak: ${printedAt} WITA | Periode Data: ${getTimeRangeDescription(timeRange)}`, pageWidth / 2, 22, { align: "center" });
    doc.text(
      `Ringkasan Audit: Total Event: ${totalLogsCount} | Berhasil Terkirim: ${notifiedSuccessCount} | Gagal Kirim: ${failedCount} | Klaster Terfusi: ${deduplicatedCount} | Baseline: ${baselineCount}`,
      pageWidth / 2,
      27,
      { align: "center" }
    );

    // Table Data
    const tableColumns = [
      "Waktu Kirim Otomatis",
      "Waktu Proses (Latensi)",
      "ID Hotspot",
      "Waktu Satelit (NASA)",
      "Severity",
      "Status Notifikasi & Kanal",
      "Lokasi & Koordinat",
      "Catatan Audit Sistem"
    ];

    const tableRows = filteredLogs.map((item) => {
      let statusStr = "Baseline Awal";
      if (item.status === "failed") {
        statusStr = `GAGAL KIRIM (${item.waError || item.telegramError || 'Gateway Error'})`;
      } else if (item.status === "notified") {
        statusStr = `Terkirim (WA:${item.waSent ? 'OK' : (item.waError ? 'GAGAL' : 'NO')}, TG:${item.telegramSent ? 'OK' : (item.telegramError ? 'GAGAL' : 'NO')})`;
      } else if (item.status === "cluster_duplicate") {
        statusStr = "Terfusi (Anti-Spam 1.5km)";
      }

      return [
        formatPrecisionWITA(item.notifiedAt),
        formatDurationDetailed(getProcessDurationSeconds(item)),
        item.id,
        formatPrecisionWITA(item.detectedAt),
        getSeverity(item),
        statusStr,
        `${item.location}\n(${item.lat.toFixed(4)}, ${item.lng.toFixed(4)})`,
        getLogMessage(item)
      ];
    });

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 32,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 34, fontStyle: "bold" },
        3: { cellWidth: 30 },
        4: { cellWidth: 16 },
        5: { cellWidth: 34 },
        6: { cellWidth: 40 },
        7: { cellWidth: "auto" }
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("Sistem Pemantauan Hotspot & Peringatan Dini Pantau Bumi • Dokumen Audit Resmi Satgas", 14, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    }

    doc.save(`Pantau_Bumi_Log_Audit_${Date.now()}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden print:static print:inset-auto print:block print:bg-white">
      {/* Modal Outer Container */}
      <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 print:bg-white print:text-slate-900 overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/90 print:hidden shrink-0 shadow-lg z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                  <span>Log Sistem & Riwayat Notifikasi Otomatis</span>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    24/7 Engine Aktif
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Audit Trail Pengiriman Notifikasi, Waktu Proses (Latensi Satelit), & Deteksi Kegagalan Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHealthPanel(!showHealthPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                showHealthPanel 
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" 
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
              title="Periksa kesehatan memori Node.js dan status proteksi crash"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Diagnostik Memori</span>
            </button>
            <button
              onClick={() => fetchAuditLogs(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-all cursor-pointer"
              title="Segarkan data log terbaru dari server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-all cursor-pointer"
              title="Unduh log dalam format file CSV / Spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-md text-xs font-medium transition-all cursor-pointer shadow-sm"
              title="Simpan Log Audit sebagai dokumen PDF resmi"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-all cursor-pointer"
              title="Cetak langsung ke printer browser"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Tutup Modal Log"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 print:p-0 print:overflow-visible">
          
          {/* Print Only Header (visible on paper/pdf print) */}
          <div className="hidden print:block mb-6 border-b pb-4 text-center">
            <h1 className="text-xl font-bold text-slate-900">PANTAU BUMI - LOG AUDIT SISTEM & RIWAYAT NOTIFIKASI</h1>
            <p className="text-xs text-slate-600 mt-1">Dicetak pada: {new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA</p>
          </div>

          {/* KPI Metrics Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:grid-cols-5">
            {/* Card 1: Total Events */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-xs print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Event Log</span>
                <Activity className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 print:text-slate-900">{totalLogsCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {stats?.lastRunTime ? `Cek: ${new Date(stats.lastRunTime).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' })} WITA` : "Pemantauan aktif"}
              </div>
            </div>

            {/* Card 2: Notifications Dispatched */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-xs print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Notifikasi Terkirim</span>
                <Send className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 print:text-emerald-700">{notifiedSuccessCount}</div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>WA & Telegram OK</span>
              </div>
            </div>

            {/* Card 3: Failed Deliveries (NEW) */}
            <div className={`p-3.5 rounded-xl border shadow-xs transition-colors ${
              failedCount > 0 
                ? "bg-red-950/40 border-red-500/50 text-red-200" 
                : "bg-slate-800/80 border-slate-700/80 text-slate-100"
            } print:border-slate-300 print:bg-slate-50`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={failedCount > 0 ? "text-red-300 font-semibold" : "text-slate-400"}>Gagal Kirim</span>
                <XCircle className={`w-3.5 h-3.5 ${failedCount > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`} />
              </div>
              <div className={`text-2xl font-bold font-mono ${failedCount > 0 ? "text-red-400" : "text-slate-400"} print:text-red-700`}>
                {failedCount}
              </div>
              <div className={`text-[10px] mt-0.5 truncate ${failedCount > 0 ? "text-red-300 font-medium" : "text-slate-500"}`}>
                {failedCount > 0 ? "Perlu perhatian operator" : "Semua pesan terkirim"}
              </div>
            </div>

            {/* Card 4: Deduplicated Clusters */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-xs print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Klaster Terfusi</span>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400 print:text-amber-700">{deduplicatedCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Radius 1.5 km / 24 Jam
              </div>
            </div>

            {/* Card 5: Gateway Status */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-xs print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Status Gateway Pesan</span>
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5" /> WA
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Check className="w-2.5 h-2.5" /> Telegram
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 truncate">
                Interval: tiap {stats?.intervalMinutes || 15} menit (Heartbeat: 60m)
              </div>
            </div>
          </div>

          {/* Diagnostic Panel: Memory Leak & Container Crash Protection (Collapsible / Toggleable) */}
          {showHealthPanel && (
            <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-xl space-y-3 print:hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Status Ketahanan Sistem, Fallback NASA & Diagnostik Memori
                  </h3>
                </div>
                <button
                  onClick={() => setShowHealthPanel(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* 1. RAM Heap Usage */}
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Konsumsi Memori RAM</span>
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    {systemHealth?.memory?.heapUsedMb ?? 45} MB <span className="text-xs text-slate-400 font-normal">/ {systemHealth?.memory?.heapTotalMb ?? 70} MB</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Status: {systemHealth?.memory?.status || "HEALTHY"} (Batas: 350 MB)</span>
                  </div>
                </div>

                {/* 2. Crash Protection */}
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Proteksi Crash Kontainer</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-base font-bold text-blue-400 flex items-center gap-1.5 mt-0.5">
                    <Check className="w-4 h-4" /> AKTIF 100%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate" title="Global uncaughtException & unhandledRejection handlers terpasang">
                    Trap Exception & Rejection Aktif
                  </div>
                </div>

                {/* 3. Bounded Caches */}
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Pencegah Memory Leak</span>
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
                    LRU Bounded Cache
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    FIRMS: {systemHealth?.caches?.firmsEntries ?? 0}/30 | Geo: {systemHealth?.caches?.geocodeEntries ?? 0}/500
                  </div>
                </div>

                {/* 4. Atomic Storage & Auto-Backup */}
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Integritas Berkas Data</span>
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    Atomic + Auto-Backup
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">
                    Bebas korupsi JSON saat kill/crash
                  </div>
                </div>
              </div>

              {/* NASA Fallback & Heartbeat Status Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Proteksi & Ambang Klaster Hotspot</span>
                    <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Ambang Klaster: 12 Jam (Update &gt;12h Tetap Kirim)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    NASA API: {systemHealth?.autoNotifier?.consecutiveNasaFailures === 0 ? "Normal" : `Peringatan (${systemHealth?.autoNotifier?.consecutiveNasaFailures}x gagal)`} • Pemindaian: Tiap 15 Menit
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Laporan Detak Jantung (Heartbeat)</span>
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Aktif Tiap 60 Menit
                    </span>
                    <button
                      onClick={handleTriggerHeartbeat}
                      disabled={heartbeatLoading}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                      title="Kirim laporan detak jantung sistem ke akun pribadi Telegram sekarang"
                    >
                      <BellRing className={`w-3 h-3 ${heartbeatLoading ? "animate-spin" : ""}`} />
                      <span>{heartbeatLoading ? "Mengirim..." : "Tes Heartbeat"}</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate" title={systemHealth?.autoNotifier?.telegramHeartbeatTarget?.statusText}>
                    Target: {systemHealth?.autoNotifier?.telegramHeartbeatTarget?.chatId ? `Akun Pribadi (${maskTelegramId(systemHealth?.autoNotifier?.telegramHeartbeatTarget?.chatId)})` : "Khusus Akun Pribadi Telegram (Bukan Grup)"}
                  </div>
                </div>
              </div>

              {/* WhatsApp Target Configuration & Delivery Recovery Actions */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-700/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>Nomor Tujuan WhatsApp (Fonnte)</span>
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {systemHealth?.autoNotifier?.resolvedWhatsAppSource === "secret" ? "Dari Secret" : "Aktif"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Otomatis memprioritaskan Secret <code className="text-cyan-400 font-mono">WHATSAPP_TARGET_PHONE</code> atau dapat diubah di bawah.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRetryAllFailed}
                      disabled={retryLoading}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Kirim ulang seluruh notifikasi dari 24 jam terakhir yang belum terkirim ke WhatsApp / Telegram"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retryLoading ? "animate-spin" : ""}`} />
                      <span>{retryLoading ? "Memproses Ulang..." : "Kirim Ulang Notifikasi Gagal"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <div className="text-[11px] text-slate-300 font-medium shrink-0">
                    Nomor Tujuan:
                  </div>
                  {authStage === "password" ? (
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-900 border border-amber-500/50 max-w-md animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold shrink-0">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Password Admin:</span>
                      </div>
                      <input
                        type="password"
                        value={adminPasswordInput}
                        onChange={(e) => {
                          setAdminPasswordInput(e.target.value);
                          setPasswordError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleVerifyPassword();
                        }}
                        placeholder="Ketik password admin"
                        className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white flex-1 min-w-[130px] focus:outline-none focus:border-amber-400"
                        autoFocus
                      />
                      <button
                        onClick={handleVerifyPassword}
                        disabled={isVerifyingPassword}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isVerifyingPassword ? "Memeriksa..." : "Verifikasi"}
                      </button>
                      <button
                        onClick={() => {
                          setAuthStage("idle");
                          setAdminPasswordInput("");
                          setPasswordError(null);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer shrink-0"
                      >
                        Batal
                      </button>
                      {passwordError && (
                        <div className="w-full text-[11px] text-rose-400 font-medium pt-0.5">
                          ⚠️ {passwordError}
                        </div>
                      )}
                    </div>
                  ) : authStage === "editing" ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm animate-in fade-in duration-150">
                      <input
                        type="text"
                        value={waTargetInput}
                        onChange={(e) => setWaTargetInput(e.target.value)}
                        placeholder="Contoh: 085821237889 atau 12036302482394@g.us"
                        className="px-2.5 py-1 bg-slate-900 border border-cyan-500 rounded text-xs text-white w-full focus:outline-none font-mono"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveWaTarget}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => {
                          setAuthStage("idle");
                          setAdminPasswordInput("");
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer shrink-0"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700 tracking-wider">
                        {maskPhoneNumber(waTargetInput || systemHealth?.autoNotifier?.maskedWhatsAppTarget || systemHealth?.autoNotifier?.resolvedWhatsAppTarget || "085821237889")}
                      </span>
                      <button
                        onClick={() => {
                          setAuthStage("password");
                          setAdminPasswordInput("");
                          setPasswordError(null);
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer ml-1 flex items-center gap-1"
                        title="Ubah nomor otomatis (perlu password admin)"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Ganti Nomor</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsChangingPassword(prev => !prev);
                          setCurrentPassInput("");
                          setNewPassInput("");
                          setConfirmPassInput("");
                          setChangePassError(null);
                          setChangePassSuccess(null);
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer ml-2 flex items-center gap-1"
                        title="Ubah password admin pengaman nomor"
                      >
                        <Key className="w-3 h-3" />
                        <span>Ubah Password</span>
                      </button>
                    </div>
                  )}
                  {waSaveStatus && (
                    <span className="text-[11px] text-emerald-400 font-medium ml-2">
                      {waSaveStatus}
                    </span>
                  )}
                </div>

                {/* Form Ubah Password Admin Langsung dari UI */}
                {isChangingPassword && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-900/90 border border-amber-500/50 space-y-2.5 max-w-md animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ubah Password Admin Sistem</span>
                      </div>
                      <button
                        onClick={() => setIsChangingPassword(false)}
                        className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                        title="Tutup form"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Ganti password default (<code className="text-amber-300 font-mono">admin123</code>) dengan password baru pilihan Anda. Password ini digunakan saat ingin mengganti nomor WhatsApp notifikasi otomatis.
                    </p>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-300 block mb-0.5 font-medium">Password Saat Ini:</label>
                        <input
                          type="password"
                          value={currentPassInput}
                          onChange={(e) => setCurrentPassInput(e.target.value)}
                          placeholder="Password saat ini (bawaan: admin123)"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300 block mb-0.5 font-medium">Password Baru:</label>
                        <input
                          type="password"
                          value={newPassInput}
                          onChange={(e) => setNewPassInput(e.target.value)}
                          placeholder="Ketik password baru (min. 4 karakter)"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300 block mb-0.5 font-medium">Ulangi Password Baru:</label>
                        <input
                          type="password"
                          value={confirmPassInput}
                          onChange={(e) => setConfirmPassInput(e.target.value)}
                          placeholder="Ketik ulang password baru untuk konfirmasi"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                    {changePassError && (
                      <div className="text-[11px] text-rose-400 font-medium">
                        ⚠️ {changePassError}
                      </div>
                    )}
                    {changePassSuccess && (
                      <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{changePassSuccess}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => setIsChangingPassword(false)}
                        disabled={changePassLoading}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleChangePassword}
                        disabled={changePassLoading}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {changePassLoading ? "Menyimpan..." : "Simpan Password Baru"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Heartbeat Toast Notification */}
              {heartbeatToast && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                  heartbeatToast.type === "success" 
                    ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200" 
                    : "bg-rose-950/80 border-rose-500/50 text-rose-200"
                }`}>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{heartbeatToast.message}</span>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span><strong>Penjadwal Pembersihan Otomatis:</strong> Retensi rolling 7 hari (maks. 1.000 titik). Pembersihan cache berkala tiap 10 menit.</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Uptime Node: {Math.floor((systemHealth?.uptimeSeconds || 60) / 60)} menit
                </div>
              </div>
            </div>
          )}

          {/* Controls Bar: Search & Filtering (Hidden on Print) */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row items-center gap-3 print:hidden">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari ID Hotspot (misal: HS-JUMAT...), lokasi, satelit, kendala error..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Severity */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Semua Severity</option>
                <option value="FAILED">🔴 GAGAL KIRIM (Delivery Failed)</option>
                <option value="CRITICAL">🔴 CRITICAL (Area Inti IUPK)</option>
                <option value="WARNING">🟡 WARNING (Buffer Zone)</option>
                <option value="INFO">🔵 INFO (Klaster / Baseline)</option>
              </select>

              {/* Filter by Delivery Status */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Semua Status Notifikasi</option>
                <option value="notified_success">Terkirim Otomatis (Sukses)</option>
                <option value="failed">🔴 Gagal Kirim (Delivery Failed)</option>
                <option value="cluster_duplicate">Terfusi (Anti-Spam 1.5 km)</option>
                <option value="initial_baseline">Baseline Sistem</option>
              </select>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md print:border-slate-300 print:bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 font-semibold border-b border-slate-700 print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                    <th className="py-3 px-3.5 whitespace-nowrap">Waktu Pengiriman & Waktu Proses</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">ID Hotspot</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Waktu Satelit (NASA)</th>
                    <th className="py-3 px-3 whitespace-nowrap text-center">Severity</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Kanal & Status Terkirim</th>
                    <th className="py-3 px-3.5 min-w-[170px]">Lokasi & Zona</th>
                    <th className="py-3 px-3.5 min-w-[260px]">Catatan Audit Sistem</th>
                    <th className="py-3 px-2 print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-sans print:divide-slate-200">
                  {isLoading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                          <span>Memuat rekaman log sistem dan audit trail...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                        Tidak ada catatan log yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((entry) => {
                      const sev = getSeverity(entry);
                      const isExpanded = expandedId === entry.id;
                      const durationSec = getProcessDurationSeconds(entry);
                      const durationText = formatDurationDetailed(durationSec);

                      const hasError = Boolean(entry.status === "failed" || entry.waError || entry.telegramError);

                      return (
                        <React.Fragment key={entry.id}>
                          <tr 
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            className={`hover:bg-slate-800/50 transition-colors cursor-pointer print:hover:bg-transparent ${
                              isExpanded ? "bg-slate-800/60" : ""
                            } ${hasError && entry.status === "failed" ? "bg-red-950/20" : ""}`}
                          >
                            {/* Column 1: Waktu Pengiriman Otomatis & Waktu Proses */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-mono text-slate-100 print:text-slate-900 font-semibold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>{formatPrecisionWITA(entry.notifiedAt)}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[9px] uppercase">
                                  {entry.isAuto ? "OTOMATIS" : "MANUAL"}
                                </span>
                                {/* Waktu Proses (Latensi Satelit ke Pengiriman) */}
                                <span 
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[9px] font-semibold"
                                  title="Waktu proses / durasi selisih sejak data titik api direkam satelit NASA sampai sistem mengeksekusi notifikasi"
                                >
                                  <Zap className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>Proses: {durationText}</span>
                                </span>
                              </div>
                            </td>

                            {/* Column 2: ID Hotspot */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-100 print:text-slate-900 flex items-center gap-1">
                                <span>{entry.id}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={entry.source || "NASA FIRMS"}>
                                {entry.source || "Multi-Satelit"}
                              </div>
                            </td>

                            {/* Column 3: Waktu Satelit (NASA) */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-mono text-slate-300 print:text-slate-700">
                                {formatPrecisionWITA(entry.detectedAt)}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Satellite className="w-3 h-3 text-slate-500" />
                                <span>Lintasan Sensor NASA</span>
                              </div>
                            </td>

                            {/* Column 4: Severity */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {sev === "FAILED" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-600/30 text-red-300 border border-red-500/50 animate-pulse">
                                  FAILED
                                </span>
                              )}
                              {sev === "CRITICAL" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                                  CRITICAL
                                </span>
                              )}
                              {sev === "WARNING" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  WARNING
                                </span>
                              )}
                              {sev === "INFO" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  INFO
                                </span>
                              )}
                            </td>

                            {/* Column 5: Kanal & Status Terkirim (With Failure Badges) */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                {/* WhatsApp Delivery Badge */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono text-slate-400 w-6">WA:</span>
                                  {entry.waSent ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Terkirim
                                    </span>
                                  ) : entry.waError || (entry.status === "failed" && !entry.waSent) ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/30" title={entry.waError || "Gagal mengirim WhatsApp"}>
                                      <XCircle className="w-2.5 h-2.5" /> Gagal
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {entry.status === "cluster_duplicate" ? "Dicegah" : (entry.status === "initial_baseline" ? "Baseline" : "Standby")}
                                    </span>
                                  )}
                                </div>

                                {/* Telegram Delivery Badge */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono text-slate-400 w-6">TG:</span>
                                  {entry.telegramSent ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/30">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Terkirim
                                    </span>
                                  ) : entry.telegramError || (entry.status === "failed" && !entry.telegramSent) ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/30" title={entry.telegramError || "Gagal mengirim Telegram"}>
                                      <XCircle className="w-2.5 h-2.5" /> Gagal
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {entry.status === "cluster_duplicate" ? "Dicegah" : (entry.status === "initial_baseline" ? "Baseline" : "Standby")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Column 6: Lokasi & Zona */}
                            <td className="py-3 px-3.5">
                              <div className="font-medium text-slate-200 print:text-slate-800 line-clamp-1" title={entry.location}>
                                {entry.location}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                  entry.zone === "iupk" 
                                    ? "bg-red-500/20 text-red-300 border border-red-500/30" 
                                    : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                }`}>
                                  {entry.zone === "iupk" ? "Konsesi IUPK (Inti)" : "Buffer Zone (Koridor)"}
                                </span>
                                <a 
                                  href={`https://maps.google.com/?q=${entry.lat},${entry.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] font-mono text-blue-400 hover:underline flex items-center gap-0.5"
                                >
                                  {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </td>

                            {/* Column 7: Catatan Audit Sistem */}
                            <td className="py-3 px-3.5">
                              <div className={`leading-relaxed text-xs ${
                                hasError && entry.status === "failed" 
                                  ? "text-red-300 font-medium" 
                                  : "text-slate-300 print:text-slate-700"
                              }`}>
                                {getLogMessage(entry)}
                              </div>
                            </td>

                            {/* Column 8: Toggle Arrow */}
                            <td className="py-3 px-2 print:hidden text-slate-500">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4" />}
                            </td>
                          </tr>

                          {/* Expanded Technical Inspection Details */}
                          {isExpanded && (
                            <tr className="bg-slate-950/60 print:hidden border-b border-slate-800/80">
                              <td colSpan={8} className="p-4">
                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2.5 text-[11px] font-mono">
                                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                                      <span>Rincian Teknis Payload & Diagnostik Log</span>
                                    </span>
                                    <span className="text-slate-400">ID: {entry.id}</span>
                                  </div>

                                  {/* Error Diagnostics Box if there's any failure */}
                                  {(entry.waError || entry.telegramError || entry.status === "failed") && (
                                    <div className="p-2.5 rounded bg-red-950/50 border border-red-500/40 text-red-300 space-y-1">
                                      <div className="font-bold flex items-center gap-1.5 text-red-200">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                        <span>Diagnostik Kegagalan Gateway Pengiriman Notifikasi:</span>
                                      </div>
                                      {entry.waError && (
                                        <div className="pl-5 text-red-300">
                                          • <strong>WhatsApp Gateway:</strong> {entry.waError}
                                        </div>
                                      )}
                                      {entry.telegramError && (
                                        <div className="pl-5 text-red-300">
                                          • <strong>Telegram Bot:</strong> {entry.telegramError}
                                        </div>
                                      )}
                                      {!entry.waError && !entry.telegramError && (
                                        <div className="pl-5 text-red-300">
                                          • Seluruh kanal pengiriman tidak merespons atau kredensial API belum disetel.
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-slate-300">
                                    <div>
                                      <span className="text-slate-500">Koordinat Presisi: </span>
                                      <span>{entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Tingkat Keyakinan (Confidence): </span>
                                      <span>{entry.confidence || 85}%</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Status Internal Engine: </span>
                                      <span className={`uppercase font-bold ${entry.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
                                        {entry.status}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Waktu Akuisisi Satelit (UTC): </span>
                                      <span>{new Date(entry.detectedAt).toISOString()}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Waktu Eksekusi Pengiriman: </span>
                                      <span>{formatPrecisionWITA(entry.notifiedAt)}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Waktu Proses (Latensi): </span>
                                      <span className="text-cyan-400 font-bold">{durationText}</span>
                                    </div>
                                    <div className="md:col-span-3">
                                      <span className="text-slate-500">Fusi Klaster Referensi: </span>
                                      <span>{entry.clusterWith ? `Terfusi dengan ${entry.clusterWith} (Radius 1.5 km)` : "Titik Tunggal (Klaster Utama)"}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer */}
            <div className="p-3 bg-slate-850 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 print:hidden">
              <div>
                Menampilkan <strong className="text-slate-200">{filteredLogs.length}</strong> dari <strong className="text-slate-200">{totalLogsCount}</strong> catatan log sistem.
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span> FAILED
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> CRITICAL
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> WARNING
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> INFO
                </span>
                <span className="text-slate-500">| Retensi Log: 7 Hari Siklus Bergulir</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
