import { useState, useEffect, useMemo } from "react";
import { Hotspot, HotspotTimeRange, HotspotStatusFilter } from "../types";
import { Flame, CheckCircle, ShieldAlert, X, MapPin, Calendar, Clock, RefreshCw, Radio, MessageCircle, Loader2, Send, Satellite, ShieldCheck, Wind, BarChart3, Filter, ScrollText, Phone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, getTimeRangeLabel, getTimeRangeDescription, formatHotspotRelativeTime, formatDateWITA, formatTimeWITA, fetchAddressFromCoordinates, maskPhoneNumber } from "../utils";
import { calculateSmokePlume } from "../smokePlume";
import PrintPreviewModal from "./PrintPreviewModal";

interface SidebarProps {
  hotspots: Hotspot[];
  onAcknowledge: (id: string) => void;
  onSelectHotspot?: (hotspot: Hotspot) => void;
  selectedHotspotId?: string | null;
  onCloseMobile?: () => void;
  timeRange: HotspotTimeRange;
  onTimeRangeChange: (range: HotspotTimeRange) => void;
  isLoading?: boolean;
  onOpenPrintPreview: () => void;
  onOpenAnalytics?: () => void;
  statusFilter: HotspotStatusFilter;
  onStatusFilterChange: (filter: HotspotStatusFilter) => void;
}

const SidebarAddress = ({ lat, lng, initialAddress }: { lat: number, lng: number, initialAddress?: string }) => {
  const [address, setAddress] = useState<string>(() => initialAddress || "Memuat lokasi...");
  
  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
      return;
    }
    let isMounted = true;
    fetchAddressFromCoordinates(lat, lng).then(res => {
      if (isMounted) setAddress(res);
    });
    return () => { isMounted = false; };
  }, [lat, lng, initialAddress]);

  return (
    <div className="text-[10px] text-slate-400 mt-1.5 p-1.5 bg-slate-900/60 rounded-md border border-slate-800 leading-tight">
      <span className="font-semibold text-slate-300">Lokasi:</span> {address}
    </div>
  );
};

export default function Sidebar({ 
  hotspots, 
  onAcknowledge,
  onSelectHotspot,
  selectedHotspotId,
  onCloseMobile,
  timeRange,
  onTimeRangeChange,
  isLoading,
  onOpenPrintPreview,
  onOpenAnalytics,
  statusFilter,
  onStatusFilterChange
}: SidebarProps) {
  const totalCount = hotspots.length;
  const newCount = useMemo(() => hotspots.filter(h => h.status === "new").length, [hotspots]);
  const ackCount = useMemo(() => hotspots.filter(h => h.status === "acknowledged" || h.status === "resolved").length, [hotspots]);

  const displayedHotspots = useMemo(() => {
    if (statusFilter === "all") return hotspots;
    return hotspots.filter(h => h.status === statusFilter);
  }, [hotspots, statusFilter]);

  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [sendingTgId, setSendingTgId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Manual WhatsApp Dialog states
  const [manualWaModalHotspot, setManualWaModalHotspot] = useState<Hotspot | null>(null);
  const [manualWaTarget, setManualWaTarget] = useState<string>("");
  const [defaultWaTarget, setDefaultWaTarget] = useState<string>("");
  const [isSendingManualWa, setIsSendingManualWa] = useState<boolean>(false);
  const [manualWaError, setManualWaError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifier-settings")
      .then(r => r.json())
      .then(d => {
        if (d && (d.maskedWhatsAppTarget || d.resolvedWhatsAppTarget)) {
          setDefaultWaTarget(d.maskedWhatsAppTarget || d.resolvedWhatsAppTarget);
        }
      })
      .catch(() => {});
  }, []);

  const handleSendTelegram = async (hotspot: Hotspot) => {
    setSendingTgId(hotspot.id);
    try {
      const address = await fetchAddressFromCoordinates(hotspot.location.lat, hotspot.location.lng);
      
      const response = await fetch('/api/notify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: hotspot.location.lat,
          lng: hotspot.location.lng,
          location: address,
          date: formatDateWITA(new Date(hotspot.detectedAt)) + ' ' + formatTimeWITA(new Date(hotspot.detectedAt)),
          id: hotspot.id,
          source: 'manual',
          hotspotSource: hotspot.source || 'Multi-Satelit Terintegrasi',
          confidence: hotspot.confidence,
          zone: hotspot.zone
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengirim pesan Telegram");
      }
      
      setToastMessage({
        text: `Peringatan Telegram untuk ${hotspot.id} berhasil dikirim!`,
        type: "success"
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (error: any) {
      setToastMessage({
        text: `Gagal mengirim Telegram: ${error.message}`,
        type: "error"
      });
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setSendingTgId(null);
    }
  };

  const handleExecuteSendWA = async () => {
    if (!manualWaModalHotspot) return;
    const hotspot = manualWaModalHotspot;
    const targetToSend = manualWaTarget.trim();

    setIsSendingManualWa(true);
    setManualWaError(null);
    setSendingWaId(hotspot.id);

    try {
      const address = await fetchAddressFromCoordinates(hotspot.location.lat, hotspot.location.lng);
      
      const response = await fetch('/api/notify-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetToSend,
          lat: hotspot.location.lat,
          lng: hotspot.location.lng,
          location: address,
          date: formatDateWITA(new Date(hotspot.detectedAt)) + ' ' + formatTimeWITA(new Date(hotspot.detectedAt)),
          id: hotspot.id,
          source: 'manual',
          hotspotSource: hotspot.source || 'Multi-Satelit Terintegrasi',
          confidence: hotspot.confidence,
          zone: hotspot.zone
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengirim pesan WhatsApp");
      }
      
      const maskedTarget = data.target ? ` ke ${data.target}` : "";
      setToastMessage({
        text: `Peringatan WhatsApp untuk ${hotspot.id} berhasil dikirim${maskedTarget}!`,
        type: "success"
      });
      setTimeout(() => setToastMessage(null), 5000);
      setManualWaModalHotspot(null);
    } catch (error: any) {
      setManualWaError(error.message);
      setToastMessage({
        text: `Gagal mengirim WhatsApp: ${error.message}`,
        type: "error"
      });
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setIsSendingManualWa(false);
      setSendingWaId(null);
    }
  };

  return (
    <>
    <div className="w-full h-full bg-[#111827] border-r border-slate-800 flex flex-col z-10 relative">
      {/* Toast Notification for Manual WhatsApp / Telegram Dispatch */}
      {toastMessage && (
        <div className={cn(
          "mx-2.5 my-2 p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 z-20 shrink-0",
          toastMessage.type === "success" 
            ? "bg-emerald-950/95 border-emerald-500/70 text-emerald-200" 
            : "bg-rose-950/95 border-rose-500/70 text-rose-200"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {toastMessage.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="leading-snug break-words">{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-1 rounded text-slate-400 hover:text-white shrink-0 cursor-pointer"
            title="Tutup pesan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sidebar Header - Slim & compact */}
      <div className="p-2.5 sm:p-3 border-b border-slate-800 bg-slate-900/70 shrink-0">
        <div className="flex items-center justify-between">
          <div className="w-full">
            <div className="flex items-center justify-between gap-1.5">
              <h2 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider truncate">
                Monitoring Titik Api ({statusFilter === "all" ? hotspots.length : `${displayedHotspots.length}/${hotspots.length}`})
              </h2>
              {newCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-600 text-white rounded-full animate-pulse shrink-0">
                  {newCount} Baru
                </span>
              )}
            </div>
            
            {/* Integrated Satellite badges - compact flex wrap */}
            <div className="mt-1.5 text-[10px] text-slate-400">
              <div className="flex items-center gap-1 text-[10px] text-slate-300 font-medium mb-1">
                <Satellite className="w-3 h-3 text-blue-400 shrink-0" />
                <span>Data: Himawari-9, SiPongi+, BRIN, BMKG, NASA</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-400/90 font-mono">
                <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                <span>Klaster Anti-Duplikasi 1.5 km</span>
              </div>
            </div>
          </div>

          {/* Mobile Close Button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1"
              aria-label="Tutup panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Rentang Waktu (Saat Ini, 12 Jam Lalu, 1 Hari, 7 Hari, 30 Hari) */}
        <div className="mt-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-orange-400" />
              <span>Rentang Waktu</span>
            </div>
            {isLoading && (
              <span className="text-[9px] text-orange-400 flex items-center gap-1">
                <RefreshCw className="w-2 h-2 animate-spin" />
                Memuat...
              </span>
            )}
          </div>
          
          <div className="space-y-1 bg-slate-950/90 p-1 rounded-lg border border-slate-800">
            {/* Real-time / Hourly row */}
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onTimeRangeChange("now")}
                disabled={isLoading}
                className={cn(
                  "py-1 px-1.5 text-[11px] font-bold rounded-md transition-all text-center flex items-center justify-center gap-1 select-none min-h-[28px]",
                  timeRange === "now"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                )}
                title="Deteksi Satelit Real-time / Saat Ini"
              >
                <Radio className={cn("w-2.5 h-2.5 shrink-0", timeRange === "now" ? "text-white animate-pulse" : "text-red-400")} />
                <span>Saat Ini</span>
                <span className="text-[8px] px-1 py-0.1 bg-red-950 text-red-200 rounded font-mono border border-red-500/30">LIVE</span>
              </button>

              <button
                onClick={() => onTimeRangeChange("12h")}
                disabled={isLoading}
                className={cn(
                  "py-1 px-1.5 text-[11px] font-bold rounded-md transition-all text-center flex items-center justify-center gap-1 select-none min-h-[28px]",
                  timeRange === "12h"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                )}
                title="Deteksi 12 Jam Terakhir"
              >
                <Clock className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                <span>12 Jam Lalu</span>
              </button>
            </div>

            {/* Daily row */}
            <div className="grid grid-cols-3 gap-1">
              {([1, 7, 30] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => onTimeRangeChange(days)}
                  disabled={isLoading}
                  className={cn(
                    "py-1 px-1 text-[10px] font-bold rounded-md transition-all text-center flex items-center justify-center gap-0.5 select-none min-h-[26px]",
                    timeRange === days
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                  )}
                >
                  <span>{days} Hari</span>
                  {days === 1 && <span className="text-[8px] opacity-75 font-normal">lalu</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Status Hotspot di Peta & Sidebar */}
        <div className="mt-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <div className="flex items-center gap-1">
              <Filter className="w-2.5 h-2.5 text-blue-400" />
              <span>Filter Status Peta</span>
            </div>
            {statusFilter !== "all" && (
              <button
                onClick={() => onStatusFilterChange("all")}
                className="text-[9px] text-orange-400 hover:text-orange-300 font-medium hover:underline cursor-pointer"
                title="Tampilkan semua status di peta"
              >
                Reset
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-800">
            {/* Tab: Semua */}
            <button
              onClick={() => onStatusFilterChange("all")}
              className={cn(
                "py-1 px-1 text-[10px] font-bold rounded-md transition-all text-center flex items-center justify-center gap-1 select-none min-h-[26px] cursor-pointer",
                statusFilter === "all"
                  ? "bg-slate-700 text-white shadow-sm border border-slate-600"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
              )}
              title="Tampilkan seluruh titik api di peta dan daftar"
            >
              <span>Semua</span>
              <span className={cn(
                "text-[9px] px-1 py-0.2 rounded-full font-mono font-bold",
                statusFilter === "all" ? "bg-slate-800 text-slate-200" : "bg-slate-900 text-slate-400"
              )}>
                {totalCount}
              </span>
            </button>

            {/* Tab: Baru (New) */}
            <button
              onClick={() => onStatusFilterChange("new")}
              className={cn(
                "py-1 px-1 text-[10px] font-bold rounded-md transition-all text-center flex items-center justify-center gap-1 select-none min-h-[26px] cursor-pointer",
                statusFilter === "new"
                  ? "bg-rose-600 text-white shadow-sm border border-rose-500"
                  : "text-slate-400 hover:text-rose-300 hover:bg-slate-800/70"
              )}
              title="Hanya tampilkan titik api status Baru di peta (kurangi kepadatan peta)"
            >
              <Flame className={cn("w-2.5 h-2.5 shrink-0", statusFilter === "new" ? "text-white" : "text-rose-400")} />
              <span>Baru</span>
              <span className={cn(
                "text-[9px] px-1 py-0.2 rounded-full font-mono font-bold",
                statusFilter === "new" ? "bg-rose-900 text-rose-200" : "bg-rose-950/80 text-rose-400 border border-rose-800/50"
              )}>
                {newCount}
              </span>
            </button>

            {/* Tab: Diakui (Acknowledged) */}
            <button
              onClick={() => onStatusFilterChange("acknowledged")}
              className={cn(
                "py-1 px-1 text-[10px] font-bold rounded-md transition-all text-center flex items-center justify-center gap-0.5 select-none min-h-[26px] cursor-pointer",
                statusFilter === "acknowledged"
                  ? "bg-emerald-600 text-white shadow-sm border border-emerald-500"
                  : "text-slate-400 hover:text-emerald-300 hover:bg-slate-800/70"
              )}
              title="Hanya tampilkan titik api yang sudah Diakui di peta"
            >
              <CheckCircle className={cn("w-2.5 h-2.5 shrink-0", statusFilter === "acknowledged" ? "text-white" : "text-emerald-400")} />
              <span>Diakui</span>
              <span className={cn(
                "text-[9px] px-1 py-0.2 rounded-full font-mono font-bold",
                statusFilter === "acknowledged" ? "bg-emerald-900 text-emerald-200" : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
              )}>
                {ackCount}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Hotspots List - Slim & Compact */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 overscroll-contain">
        {/* Active Filter Notice Banner */}
        {statusFilter !== "all" && hotspots.length > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-[10px] text-slate-300 mb-1">
            <div className="flex items-center gap-1.5 truncate">
              <Filter className="w-3 h-3 text-orange-400 shrink-0" />
              <span>Filter: <strong>{statusFilter === "new" ? "Hanya Baru (New)" : "Hanya Diakui"}</strong> ({displayedHotspots.length})</span>
            </div>
            <button
              onClick={() => onStatusFilterChange("all")}
              className="text-orange-400 hover:text-orange-300 font-bold ml-2 underline shrink-0 cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        <AnimatePresence>
          {hotspots.length === 0 ? (
            <div className="text-center py-10 px-3 text-slate-500">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-25" />
              <p className="text-xs font-medium text-slate-400">Tidak ada titik api</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Area konsesi IUPK dan koridor bebas dari anomali termal dalam rentang {getTimeRangeDescription(timeRange)}.
              </p>
            </div>
          ) : displayedHotspots.length === 0 ? (
            <div className="text-center py-8 px-3 text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80 my-2">
              <Filter className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="text-xs font-semibold text-slate-300">
                Nihil Titik Api Status "{statusFilter === 'new' ? 'Baru' : 'Diakui'}"
              </p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {statusFilter === 'new' 
                  ? "Seluruh titik api dalam rentang ini sudah diverifikasi/diakui oleh satgas."
                  : "Belum ada titik api yang diakui atau terkonfirmasi."}
              </p>
              <button
                onClick={() => onStatusFilterChange("all")}
                className="mt-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-orange-400 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-slate-700"
              >
                <span>Tampilkan Semua Titik Api ({hotspots.length})</span>
              </button>
            </div>
          ) : (
            displayedHotspots.map(hotspot => {
              const isSelected = selectedHotspotId === hotspot.id;
              const isNew = hotspot.status === "new";
              const isToday = hotspot.daysAgo === 0;

              return (
                <motion.div
                  key={hotspot.id}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onSelectHotspot?.(hotspot)}
                  className={cn(
                    "p-2.5 rounded-lg relative overflow-hidden transition-all cursor-pointer select-none",
                    isToday 
                      ? "bg-red-500/10 border border-red-500/30 hover:border-red-500/60" 
                      : "bg-orange-500/10 border border-orange-500/30 hover:border-orange-500/60 opacity-90",
                    isSelected && "ring-2 ring-blue-500 border-transparent shadow-md bg-slate-800/80"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded text-white uppercase tracking-wider",
                        isToday ? "bg-red-600" : "bg-orange-600"
                      )}>
                        {formatHotspotRelativeTime(hotspot.detectedAt, hotspot.daysAgo)}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[11px] font-mono font-semibold",
                      isToday ? "text-red-400" : "text-orange-400"
                    )}>
                      {hotspot.confidence}% Conf.
                    </span>
                  </div>

                  {/* Date & Time display */}
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 font-mono">
                    <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    <span>
                      {formatDateWITA(new Date(hotspot.detectedAt))} • {formatTimeWITA(new Date(hotspot.detectedAt))}
                    </span>
                  </div>

                  <div className="text-xs font-semibold mb-1 flex items-center gap-1 text-slate-100">
                    <Flame className={cn("w-3.5 h-3.5 shrink-0", isToday ? "text-red-500" : "text-orange-500")} />
                    <span className="truncate">ID: {hotspot.id.toUpperCase()}</span>
                  </div>

                  {/* Satellite Source Indicator */}
                  <div className="flex items-center gap-1 text-[10px] text-slate-300 mb-1.5 bg-slate-900/90 border border-slate-800 px-1.5 py-1 rounded">
                    <Satellite className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="text-slate-400 font-medium shrink-0">Sumber:</span>
                    <span className="text-slate-200 truncate" title={hotspot.source || "Multi-Satelit Terpadu"}>
                      {hotspot.source || "Multi-Satelit"}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono mt-1 flex items-center justify-between">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${hotspot.location.lat},${hotspot.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded transition-colors inline-block"
                      title="Buka di Google Maps"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hotspot.location.lat.toFixed(4)}, {hotspot.location.lng.toFixed(4)}
                    </a>
                    
                    <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 text-blue-400" />
                      Fokus
                    </span>
                  </div>

                  <SidebarAddress lat={hotspot.location.lat} lng={hotspot.location.lng} initialAddress={hotspot.address} />

                  {/* Smoke Plume Trajectory Info */}
                  {(() => {
                    const plume = calculateSmokePlume(hotspot);
                    const isCrit = plume.impacts.severity === "critical";
                    const isWarn = plume.impacts.severity === "warning";
                    return (
                      <div className={`mt-1.5 p-1.5 rounded-md border text-[10px] flex items-start gap-1.5 ${
                        isCrit
                          ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                          : isWarn
                          ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                          : "bg-slate-900/70 border-slate-800 text-slate-300"
                      }`}>
                        <Wind className={`w-3 h-3 shrink-0 mt-0.5 ${isCrit ? "text-rose-400" : isWarn ? "text-amber-400" : "text-slate-400"}`} />
                        <div className="leading-tight">
                          <span className="font-bold text-white">{plume.downwindCardinal}:</span>{" "}
                          <span>{plume.impacts.summaryText}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setManualWaModalHotspot(hotspot);
                          setManualWaTarget("");
                          setManualWaError(null);
                        }}
                        disabled={sendingWaId === hotspot.id}
                        className="py-1 px-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded text-[10px] font-bold transition-colors flex items-center justify-center text-green-400 disabled:opacity-50 min-h-[30px] cursor-pointer"
                      >
                        {sendingWaId === hotspot.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <MessageCircle className="w-3 h-3 mr-1" />
                        )}
                        <span>Kirim WA</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendTelegram(hotspot);
                        }}
                        disabled={sendingTgId === hotspot.id}
                        className="py-1 px-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-[10px] font-bold transition-colors flex items-center justify-center text-blue-400 disabled:opacity-50 min-h-[30px]"
                      >
                        {sendingTgId === hotspot.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        <span>Kirim TG</span>
                      </button>
                    </div>

                    {isNew && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcknowledge(hotspot.id);
                        }}
                        className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center text-slate-200 group min-h-[28px]"
                      >
                        <CheckCircle className="w-3 h-3 mr-1.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        Konfirmasi Ancaman
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
      
      {/* Sidebar Footer - Compact */}
      <div className="p-2 sm:p-2.5 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="text-[10px] text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Status Sistem ({getTimeRangeLabel(timeRange)})</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Terkoneksi
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button 
            onClick={onOpenAnalytics}
            className="w-full py-2 px-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 border border-orange-500/50 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all text-white flex items-center justify-center gap-1 min-h-[36px] shadow-sm cursor-pointer"
            title="Buka Panel Ringkasan & Visualisasi Statistik Hotspot"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="truncate">Statistik</span>
          </button>
          <button 
            onClick={onOpenPrintPreview}
            className="w-full py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-650 border border-slate-700 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors text-slate-200 flex items-center justify-center gap-1 min-h-[36px] cursor-pointer shadow-xs"
            title="Buka Log Sistem & Riwayat Notifikasi Otomatis (Audit Log)"
          >
            <ScrollText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Log</span>
          </button>
        </div>
      </div>
    </div>

    {/* Modal Dialog: Input Nomor WhatsApp Tujuan Manual */}
    {manualWaModalHotspot && (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={() => {
          if (!isSendingManualWa) setManualWaModalHotspot(null);
        }}
      >
        <div 
          className="bg-slate-900 border border-emerald-500/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Kirim Peringatan WhatsApp (Manual)</h3>
                <p className="text-[10px] text-slate-400">Penerusan koordinat & anomali api ke personel lapangan</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!isSendingManualWa) setManualWaModalHotspot(null);
              }}
              disabled={isSendingManualWa}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 space-y-3.5 text-xs">
            {/* Detail Hotspot yang akan dikirim */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-400 text-xs">{manualWaModalHotspot.id}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                  manualWaModalHotspot.zone === "iupk" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                )}>
                  {manualWaModalHotspot.zone === "iupk" ? "Area Inti IUPK" : "Buffer Zone"}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Koordinat: {manualWaModalHotspot.location.lat.toFixed(4)}, {manualWaModalHotspot.location.lng.toFixed(4)}</span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                <span>Waktu: {formatDateWITA(new Date(manualWaModalHotspot.detectedAt))} {formatTimeWITA(new Date(manualWaModalHotspot.detectedAt))} WITA</span>
              </div>
            </div>

            {/* Form Input Nomor Tujuan */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-200 flex items-center justify-between">
                <span>Nomor WhatsApp Tujuan:</span>
                <span className="text-[10px] font-normal text-slate-400">Nomor HP atau ID Grup</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={manualWaTarget}
                  onChange={(e) => {
                    setManualWaTarget(e.target.value);
                    setManualWaError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSendingManualWa) handleExecuteSendWA();
                  }}
                  placeholder="Contoh: 081234567890 atau 120363... @g.us"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  autoFocus
                />
              </div>

              {/* Quick button / badge: Use default system target */}
              {defaultWaTarget && (
                <div className="flex items-center justify-between text-[11px] pt-1 px-0.5">
                  <span className="text-slate-400">Nomor Utama Sistem:</span>
                  <button
                    type="button"
                    onClick={() => setManualWaTarget(defaultWaTarget)}
                    className="text-emerald-400 hover:text-emerald-300 font-mono text-[10px] underline cursor-pointer"
                    title="Gunakan nomor utama terdaftar"
                  >
                    Gunakan {maskPhoneNumber(defaultWaTarget)}
                  </button>
                </div>
              )}

              {manualWaError && (
                <div className="p-2 rounded-lg bg-rose-950/70 border border-rose-500/50 text-[11px] text-rose-300 leading-snug">
                  ⚠️ {manualWaError}
                </div>
              )}
            </div>

            {/* Catatan Integritas Notifikasi Otomatis */}
            <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-[10px] text-slate-300 leading-relaxed">
              ℹ️ <strong>Notifikasi Otomatis Tetap Berjalan:</strong> Sistem pemantau 24/7 tetap mengirimkan alert otomatis ke nomor terdaftar. Pengiriman manual ini hanya meneruskan titik api ini ke nomor yang Anda masukkan.
            </div>
          </div>

          {/* Modal Actions */}
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/70 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setManualWaModalHotspot(null)}
              disabled={isSendingManualWa}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteSendWA}
              disabled={isSendingManualWa || !manualWaTarget.trim()}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-emerald-950"
            >
              {isSendingManualWa ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
