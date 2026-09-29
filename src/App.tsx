/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, Key, Flame, Calendar, RefreshCw, Radio, Clock, Bot, Sun, BarChart3, X, Filter, HelpCircle } from "lucide-react";
import MapComponent from "./components/MapComponent";
import Sidebar from "./components/Sidebar";
import PrintPreviewModal from "./components/PrintPreviewModal";
import AutoNotifyModal from "./components/AutoNotifyModal";
import { FdrsModal } from "./components/FdrsModal";
import HotspotAnalyticsModal from "./components/HotspotAnalyticsModal";
import HelpManualModal from "./components/HelpManualModal";
import { Hotspot, HotspotTimeRange, HotspotStatusFilter } from "./types";
import { fetchNasaHotspots, fetchDynamicIUPKBoundary } from "./data";
import { cn, getTimeRangeLabel, getTimeRangeDescription } from "./utils";
import { compileFdrsAssessment } from "./fdrsData";
import { StationWeatherData } from "./weatherData";

export default function App() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [timeRange, setTimeRange] = useState<HotspotTimeRange>(1);
  const [statusFilter, setStatusFilter] = useState<HotspotStatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [missingKey, setMissingKey] = useState(false);
  const [boundaryLoaded, setBoundaryLoaded] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showAutoNotifyModal, setShowAutoNotifyModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [autoNotifyStatus, setAutoNotifyStatus] = useState<any>(null);
  const [weatherStationsData, setWeatherStationsData] = useState<Record<string, StationWeatherData>>({});
  const [showFdrsModal, setShowFdrsModal] = useState(false);

  const displayedHotspots = useMemo(() => {
    if (statusFilter === "all") return hotspots;
    return hotspots.filter((h) => h.status === statusFilter);
  }, [hotspots, statusFilter]);

  const fdrsAssessment = useMemo(() => {
    return compileFdrsAssessment(weatherStationsData);
  }, [weatherStationsData]);

  const fetchAutoNotifyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auto-notify/status");
      if (res.ok) {
        const data = await res.json();
        setAutoNotifyStatus(data);
      }
    } catch {
      // ignore silent errors
    }
  }, []);

  useEffect(() => {
    fetchAutoNotifyStatus();
    const timer = setInterval(fetchAutoNotifyStatus, 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchAutoNotifyStatus]);

  const loadHotspots = useCallback(async (range: HotspotTimeRange = timeRange) => {
    setIsLoading(true);
    setErrorMsg("");
    setMissingKey(false);
    try {
      const fetchedHotspots = await fetchNasaHotspots(range);
      
      setHotspots(prev => {
        // Track previous acknowledged/resolved status by ID and coordinate
        const acknowledgedIds = new Set<string>();
        prev.forEach(p => {
          if (p.status !== "new") {
            acknowledgedIds.add(p.id);
          }
        });

        return fetchedHotspots.map(newH => {
          if (acknowledgedIds.has(newH.id)) {
            return { ...newH, status: "acknowledged" as const };
          }
          return newH;
        });
      });
    } catch (err: any) {
      if (err?.message?.includes("NASA_API_KEY")) {
        setMissingKey(true);
      } else {
        setErrorMsg(err?.message || "Failed to fetch data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  // Handle changing the time range (1 hari, 7 hari, 30 hari)
  const handleTimeRangeChange = (newRange: HotspotTimeRange) => {
    if (newRange === timeRange && !isLoading) return;
    setTimeRange(newRange);
    setSelectedHotspot(null);
    loadHotspots(newRange);
  };

  // Fetch real hotspots from NASA
  // Load boundary only once on mount
  useEffect(() => {
    let isMounted = true;
    const initBoundary = async () => {
      try {
        await fetchDynamicIUPKBoundary();
      } finally {
        if (isMounted) setBoundaryLoaded(true);
      }
    };
    initBoundary();
    return () => { isMounted = false; };
  }, []);

  // Load hotspots when timeRange changes
  useEffect(() => {
    loadHotspots(timeRange);
    
    // Refresh every 10 minutes
    const interval = setInterval(() => {
      loadHotspots(timeRange);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [timeRange, loadHotspots]);

  const acknowledgeHotspot = (id: string) => {
    setHotspots(prev => prev.map(h => 
      h.id === id ? { ...h, status: "acknowledged" } : h
    ));
    setSelectedHotspot(prev => prev && prev.id === id ? { ...prev, status: "acknowledged" } : prev);
  };

  const newHotspotCount = hotspots.filter(h => h.status === "new").length;

  if (missingKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 bg-orange-500/20 text-orange-500 rounded-full mb-6">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-100 mb-2">NASA FIRMS API Key Required</h1>
          <p className="text-slate-400 mb-6 text-sm">
            Please add your NASA FIRMS API Key to access real-time hotspot data. Get a MAP_KEY from firms.modaps.eosdis.nasa.gov/api/.
          </p>
          <div className="space-y-4">
            <p className="text-sm text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-700">
              Configure <strong>NASA_API_KEY</strong> in the AI Studio Secrets panel or your <code>.env</code> file, then restart the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#0f172a] text-slate-100 overflow-hidden font-sans print:h-auto print:overflow-visible print:bg-white print:text-black">
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-[#1e293b] border-b border-slate-700 shadow-md shrink-0 z-20 relative gap-2 print:hidden">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-600 rounded-xl flex items-center justify-center font-bold text-base sm:text-xl text-white shrink-0 shadow-sm">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold leading-tight tracking-tight uppercase truncate text-slate-100 flex items-center gap-1.5 sm:gap-2">
              <span className="text-orange-400 tracking-wide font-extrabold">PANTAU BUMI</span>
              <span className="text-slate-400 font-normal hidden sm:inline text-xs sm:text-sm tracking-normal normal-case">• Peta Sebaran Hotspot</span>
            </h1>
            <span className="text-[10px] sm:text-xs text-slate-400 font-mono truncate">
              IUPK PRODUKSI & WILAYAH PENUNJANG • TABALONG - BALANGAN - BARITO
            </span>
          </div>
        </div>

        {/* Center/Right Actions: Rentang Waktu (1, 7, 30 Hari) & Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Hotspot Time Range Selector (Desktop & Tablet) */}
          <div className="hidden sm:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700 shadow-inner">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold px-2 py-0.5 mr-0.5">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden md:inline">Periode:</span>
            </div>

            <button
              onClick={() => handleTimeRangeChange("now")}
              disabled={isLoading}
              className={cn(
                "px-2.5 md:px-3 py-1 text-xs font-bold rounded-lg transition-all min-h-[30px] flex items-center gap-1.5 touch-manipulation",
                timeRange === "now"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
              title="Deteksi Satelit Real-time / Saat Ini"
            >
              <Radio className={cn("w-3 h-3 shrink-0", timeRange === "now" ? "text-white animate-pulse" : "text-red-400")} />
              <span>Saat Ini</span>
              {timeRange === "now" && isLoading && (
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-white" />
              )}
            </button>

            <button
              onClick={() => handleTimeRangeChange("12h")}
              disabled={isLoading}
              className={cn(
                "px-2.5 md:px-3 py-1 text-xs font-bold rounded-lg transition-all min-h-[30px] flex items-center gap-1.5 touch-manipulation",
                timeRange === "12h"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
              title="Deteksi 12 Jam Terakhir"
            >
              <Clock className="w-3 h-3 text-orange-400 shrink-0" />
              <span>12 Jam</span>
              {timeRange === "12h" && isLoading && (
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-white" />
              )}
            </button>

            {([1, 7, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => handleTimeRangeChange(days)}
                disabled={isLoading}
                className={cn(
                  "px-2.5 md:px-3 py-1 text-xs font-bold rounded-lg transition-all min-h-[30px] flex items-center gap-1.5 touch-manipulation",
                  timeRange === days
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                )}
                title={`Lihat titik hotspot untuk ${days} hari yang lalu`}
              >
                <span>{days} Hari</span>
                {timeRange === days && isLoading && (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-white" />
                )}
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          <button
            onClick={() => loadHotspots(timeRange)}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-700/60 hidden sm:flex items-center justify-center min-h-[36px] min-w-[36px]"
            title="Refresh Data Hotspot"
            aria-label="Refresh Data Hotspot"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin text-orange-400")} />
          </button>

          {/* Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] sm:text-xs font-bold text-green-400 uppercase tracking-wider">
              Live Satelit
            </span>
          </div>

          {/* FDRS Fire Danger Rating Status Button */}
          <button
            onClick={() => setShowFdrsModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none min-h-[30px] ${
              fdrsAssessment.currentStatus === "Sangat Rawan / Ekstrem"
                ? "bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30"
                : fdrsAssessment.currentStatus === "Rawan"
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                : fdrsAssessment.currentStatus === "Waspada"
                ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25"
                : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
            }`}
            title="Klik untuk membuka Indeks Bahaya Karhutla Harian (FDRS)"
          >
            <Sun className={`w-3.5 h-3.5 shrink-0 ${
              fdrsAssessment.currentStatus === "Sangat Rawan / Ekstrem" || fdrsAssessment.currentStatus === "Rawan"
                ? "text-amber-400 animate-pulse"
                : "text-emerald-400"
            }`} />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">
              FDRS: {fdrsAssessment.currentStatus}
            </span>
            <span className="hidden xl:inline text-[10px] font-mono opacity-80">
              ({fdrsAssessment.highestRiskScore}/100)
            </span>
          </button>

          {/* Hotspot Analytics & Visual Statistics Button */}
          <button
            onClick={() => setShowAnalyticsModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-gradient-to-r from-orange-500/15 to-amber-500/15 hover:from-orange-500/25 hover:to-amber-500/25 active:scale-95 border border-orange-500/35 rounded-full transition-all text-orange-300 min-h-[30px] cursor-pointer shadow-xs select-none"
            title="Buka Panel Ringkasan & Visualisasi Statistik Hotspot (Grafik Recharts)"
          >
            <BarChart3 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">
              Statistik Hotspot
            </span>
          </button>

          {/* 24/7 Telegram Automation Status Button */}
          <button
            onClick={() => setShowAutoNotifyModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 border border-blue-500/30 rounded-full transition-all text-blue-300 min-h-[30px]"
            title="Status & Pengaturan Notifikasi Telegram Otomatis 24/7"
          >
            <Bot className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden xs:inline">
              Bot 24/7
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </button>

          {/* Mobile Hotspot Drawer Button */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 min-h-[42px] min-w-[42px] bg-slate-800 hover:bg-slate-700 active:bg-slate-650 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-colors shadow-sm touch-manipulation"
            aria-label="Open Hotspots List"
          >
            <Flame className={`w-4 h-4 shrink-0 ${newHotspotCount > 0 ? 'text-red-500 animate-pulse' : 'text-orange-400'}`} />
            <span className="text-xs">{getTimeRangeLabel(timeRange)}</span>
            {hotspots.length > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full text-white ${
                newHotspotCount > 0 ? 'bg-red-600' : 'bg-slate-700'
              }`}>
                {statusFilter === "all" ? hotspots.length : `${displayedHotspots.length}/${hotspots.length}`}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Subheader Toolbar on Mobile for Time Range quick access */}
      <div className="sm:hidden flex items-center justify-between px-2.5 py-1.5 bg-slate-900 border-b border-slate-800 shrink-0 z-10 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold shrink-0 mr-1">
          <Calendar className="w-3.5 h-3.5 text-orange-400" />
          <span>Periode:</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => handleTimeRangeChange("now")}
            disabled={isLoading}
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 min-h-[28px]",
              timeRange === "now" ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", timeRange === "now" ? "bg-white animate-pulse" : "bg-red-500")} />
            <span>Saat Ini</span>
          </button>
          <button
            onClick={() => handleTimeRangeChange("12h")}
            disabled={isLoading}
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all min-h-[28px]",
              timeRange === "12h" ? "bg-orange-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            )}
          >
            12 Jam
          </button>
          {([1, 7, 30] as const).map((days) => (
            <button
              key={days}
              onClick={() => handleTimeRangeChange(days)}
              disabled={isLoading}
              className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all min-h-[28px]",
                timeRange === days ? "bg-orange-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {days} Hari
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFdrsModal(true)}
          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 min-h-[28px] border ml-1 shrink-0 ${
            fdrsAssessment.currentStatus === "Sangat Rawan / Ekstrem"
              ? "bg-rose-950/80 border-rose-600 text-rose-300"
              : fdrsAssessment.currentStatus === "Rawan"
              ? "bg-amber-950/80 border-amber-600 text-amber-300"
              : "bg-slate-800 border-slate-700 text-slate-200"
          }`}
          title="Buka Status Indeks Kerawanan Karhutla (FDRS)"
        >
          <Sun className="w-3 h-3 text-amber-400 shrink-0" />
          <span>FDRS: {fdrsAssessment.currentStatus.split(" ")[0]}</span>
        </button>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden relative print:hidden">
        {/* Mobile Backdrop Overlay */}
        {isMobileSidebarOpen && (
          <div 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity animate-in fade-in duration-200"
            aria-hidden="true"
          />
        )}

        {/* Sidebar (Drawer on mobile, slim column on desktop for maximal map space) */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] transform transition-transform duration-300 ease-in-out md:static md:w-[290px] lg:w-[295px] md:translate-x-0 md:z-10 shrink-0
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar 
            hotspots={hotspots} 
            onAcknowledge={acknowledgeHotspot}
            selectedHotspotId={selectedHotspot?.id}
            onSelectHotspot={(hotspot) => {
              setSelectedHotspot(hotspot);
              setIsMobileSidebarOpen(false);
            }}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
            isLoading={isLoading}
            onOpenPrintPreview={() => setShowPrintPreview(true)}
            onOpenAnalytics={() => setShowAnalyticsModal(true)}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </aside>

        {/* Map View Area */}
        <div className="flex-1 relative bg-[#020617] h-full w-full">
          {/* Floating Filter Indicator on Map (Direct situational awareness & quick reset) */}
          {statusFilter !== "all" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-orange-500/50 shadow-2xl flex items-center gap-2 text-xs text-slate-100 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
              <span className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                statusFilter === "new" ? "bg-rose-500" : "bg-emerald-500"
              )} />
              <span className="font-semibold text-slate-200">
                Filter Peta: {statusFilter === "new" ? "Hanya Hotspot Baru" : "Hanya Hotspot Diakui"}
              </span>
              <span className="font-mono text-orange-400 font-bold">
                ({displayedHotspots.length} dari {hotspots.length})
              </span>
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-1 p-0.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tampilkan semua hotspot di peta"
                aria-label="Reset filter peta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
              <div className="bg-slate-800 text-white px-5 py-3 rounded-full flex items-center gap-3 border border-slate-700 shadow-xl text-xs sm:text-sm">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Mengambil data satelit NASA FIRMS ({getTimeRangeDescription(timeRange)})...</span>
              </div>
            </div>
          )}
          {errorMsg && (
            <div className="absolute top-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 bg-red-900/90 text-red-200 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl border border-red-700 shadow-xl flex items-center gap-2 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
          )}
          <MapComponent 
            hotspots={displayedHotspots} 
            boundaryLoaded={boundaryLoaded}
            selectedHotspot={selectedHotspot}
            onSelectHotspot={(hotspot) => setSelectedHotspot(hotspot)}
            onWeatherLoaded={setWeatherStationsData}
            onOpenFdrsModal={() => setShowFdrsModal(true)}
          />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="h-8 sm:h-9 bg-[#0f172a] border-t border-slate-800 flex items-center justify-between px-3 sm:px-6 text-[9px] sm:text-[10px] text-slate-500 font-mono shrink-0 z-10 relative select-none print:hidden">
        <div className="truncate">SUMBER: VIIRS / MODIS NASA ({getTimeRangeDescription(timeRange).toUpperCase()})</div>
        <div className="hidden md:block">STATUS: AKTIF TERPADU</div>
        <button
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 hover:bg-slate-750 active:scale-95 text-slate-300 hover:text-orange-400 border border-slate-700 hover:border-orange-500/50 rounded-md transition-all cursor-pointer font-sans text-[10px] font-bold tracking-normal shrink-0 shadow-xs"
          title="Buka Petunjuk Penggunaan Apps, Cara Kerja Sistem, Sumber Data, & Daftar Singkatan"
        >
          <HelpCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>Bantuan & Panduan Sistem (Help)</span>
        </button>
      </footer>

      {showPrintPreview && (
        <PrintPreviewModal 
          hotspots={hotspots}
          timeRange={timeRange}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      <AutoNotifyModal
        isOpen={showAutoNotifyModal}
        onClose={() => setShowAutoNotifyModal(false)}
        status={autoNotifyStatus}
        onRefreshStatus={fetchAutoNotifyStatus}
      />

      <FdrsModal
        isOpen={showFdrsModal}
        onClose={() => setShowFdrsModal(false)}
        fdrsData={fdrsAssessment}
      />

      {/* Hotspot Analytics & Visual Statistics Modal (Recharts) */}
      <HotspotAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        currentHotspots={hotspots}
        currentTimeRange={timeRange}
      />

      {/* Panduan Penggunaan, Cara Kerja, Sumber Data & Glosarium Modal */}
      <HelpManualModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
}

