/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Flame, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ShieldAlert, 
  Activity, 
  RefreshCw,
  Layers,
  ArrowUpRight,
  Filter
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { Hotspot, HotspotTimeRange } from "../types";
import { fetchNasaHotspots } from "../data";
import { formatDateWITA } from "../utils";

interface HotspotAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHotspots: Hotspot[];
  currentTimeRange: HotspotTimeRange;
}

// Colors for status charts
const STATUS_COLORS = {
  new: "#ef4444",         // Red-500
  acknowledged: "#10b981", // Emerald-500
  resolved: "#3b82f6",     // Blue-500
};

// Colors for zone charts
const ZONE_COLORS = {
  iupk: "#f97316",         // Orange-500 (Tambang)
  buffer: "#eab308",       // Yellow-500 (Buffer Zone)
  outside: "#64748b",      // Slate-500 (Area Sekitar)
};

// Colors for confidence tiers
const CONFIDENCE_COLORS = {
  high: "#dc2626",         // Red-600 (High >= 80%)
  medium: "#f59e0b",       // Amber-500 (Medium 50-79%)
  low: "#3b82f6",          // Blue-500 (Low < 50%)
};

export default function HotspotAnalyticsModal({
  isOpen,
  onClose,
  currentHotspots,
  currentTimeRange
}: HotspotAnalyticsModalProps) {
  // Period filter inside modal: "30" (default 30 days), "7" (7 days), "1" (24 hours), or "current" (use current map data)
  const [period, setPeriod] = useState<"30" | "7" | "1" | "current">("30");
  const [dataset30, setDataset30] = useState<Hotspot[] | null>(null);
  const [isLoading30, setIsLoading30] = useState(false);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "daily" | "status" | "zones">("overview");

  // Fetch full 30-day dataset when modal opens if not already loaded
  useEffect(() => {
    if (!isOpen) return;

    // If current time range is already 30 days and has data, use it as initial cache
    if (currentTimeRange === 30 && currentHotspots.length > 0 && !dataset30) {
      setDataset30(currentHotspots);
      return;
    }

    if (!dataset30 && !isLoading30) {
      setIsLoading30(true);
      setErrorLoading(null);
      fetchNasaHotspots(30)
        .then((data) => {
          setDataset30(data);
        })
        .catch((err) => {
          console.error("Gagal memuat data statistik 30 hari:", err);
          setErrorLoading(err?.message || "Gagal memuat data 30 hari.");
        })
        .finally(() => {
          setIsLoading30(false);
        });
    }
  }, [isOpen, currentTimeRange, currentHotspots, dataset30, isLoading30]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Active hotspots pool based on period selection
  const activeHotspots = useMemo<Hotspot[]>(() => {
    if (period === "current") {
      return currentHotspots;
    }
    
    // If we have dataset30, filter it
    const sourceData = dataset30 || currentHotspots;
    const nowMs = Date.now();

    if (period === "1") {
      const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
      return sourceData.filter(h => h.detectedAt.getTime() >= oneDayAgo);
    }

    if (period === "7") {
      const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
      return sourceData.filter(h => h.detectedAt.getTime() >= sevenDaysAgo);
    }

    // Default 30 days
    return sourceData;
  }, [period, dataset30, currentHotspots]);

  // 1. Daily Bar Chart Data (Sebaran Hotspot per Hari dalam 30 hari terakhir)
  const dailyDistributionData = useMemo(() => {
    // Generate dates list for the requested period
    const daysCount = period === "1" ? 1 : period === "7" ? 7 : 30;
    const now = new Date();
    const result: Array<{
      dateKey: string;
      label: string;
      fullDate: string;
      baru: number;
      diakui: number;
      total: number;
      avgConfidence: number;
    }> = [];

    // Helper map for day lookups
    const dayMap = new Map<string, { baru: number; diakui: number; total: number; confidences: number[] }>();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const label = `${dd}/${mm}`;
      const fullDate = formatDateWITA(d);

      dayMap.set(dateKey, { baru: 0, diakui: 0, total: 0, confidences: [] });
      result.push({
        dateKey,
        label,
        fullDate,
        baru: 0,
        diakui: 0,
        total: 0,
        avgConfidence: 0
      });
    }

    // Populate counts from active hotspots
    activeHotspots.forEach((h) => {
      let dateKey = h.acqDate;
      if (!dateKey) {
        const d = new Date(h.detectedAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dateKey = `${yyyy}-${mm}-${dd}`;
      }

      if (dayMap.has(dateKey)) {
        const entry = dayMap.get(dateKey)!;
        entry.total += 1;
        if (h.status === "new") {
          entry.baru += 1;
        } else {
          entry.diakui += 1;
        }
        entry.confidences.push(h.confidence);
      }
    });

    // Write back into result array
    result.forEach((item) => {
      const data = dayMap.get(item.dateKey);
      if (data) {
        item.baru = data.baru;
        item.diakui = data.diakui;
        item.total = data.total;
        item.avgConfidence = data.confidences.length > 0 
          ? Math.round(data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length) 
          : 0;
      }
    });

    return result;
  }, [activeHotspots, period]);

  // 2. Status Distribution (Baru vs Diakui)
  const statusDistributionData = useMemo(() => {
    let newCount = 0;
    let acknowledgedCount = 0;

    activeHotspots.forEach((h) => {
      if (h.status === "new") newCount++;
      else acknowledgedCount++;
    });

    const total = activeHotspots.length || 1;

    return [
      {
        name: "Baru (Perlu Penanganan)",
        value: newCount,
        percentage: Math.round((newCount / total) * 100),
        color: STATUS_COLORS.new
      },
      {
        name: "Diakui / Terkonfirmasi",
        value: acknowledgedCount,
        percentage: Math.round((acknowledgedCount / total) * 100),
        color: STATUS_COLORS.acknowledged
      }
    ];
  }, [activeHotspots]);

  // 3. Zone Distribution (IUPK vs Buffer vs Sekitar)
  const zoneDistributionData = useMemo(() => {
    let iupkCount = 0;
    let bufferCount = 0;
    let outsideCount = 0;

    activeHotspots.forEach((h) => {
      if (h.zone === "iupk") iupkCount++;
      else if (h.zone === "buffer") bufferCount++;
      else outsideCount++;
    });

    const total = activeHotspots.length || 1;

    return [
      {
        name: "Konsesi IUPK",
        value: iupkCount,
        percentage: Math.round((iupkCount / total) * 100),
        color: ZONE_COLORS.iupk
      },
      {
        name: "Buffer Zone",
        value: bufferCount,
        percentage: Math.round((bufferCount / total) * 100),
        color: ZONE_COLORS.buffer
      },
      {
        name: "Area Sekitar Koridor",
        value: outsideCount,
        percentage: Math.round((outsideCount / total) * 100),
        color: ZONE_COLORS.outside
      }
    ].filter(item => item.value > 0);
  }, [activeHotspots]);

  // 4. Confidence Distribution (Tinggi, Sedang, Rendah)
  const confidenceDistributionData = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    activeHotspots.forEach((h) => {
      if (h.confidence >= 80) high++;
      else if (h.confidence >= 50) medium++;
      else low++;
    });

    return [
      { name: "Tinggi (≥80%)", value: high, color: CONFIDENCE_COLORS.high },
      { name: "Sedang (50-79%)", value: medium, color: CONFIDENCE_COLORS.medium },
      { name: "Rendah (<50%)", value: low, color: CONFIDENCE_COLORS.low }
    ];
  }, [activeHotspots]);

  // Peak Day & Top Village
  const summaryStats = useMemo(() => {
    const total = activeHotspots.length;
    const newCount = activeHotspots.filter(h => h.status === "new").length;
    const ackCount = total - newCount;
    const avgConfidence = total > 0 
      ? Math.round(activeHotspots.reduce((acc, h) => acc + h.confidence, 0) / total) 
      : 0;

    // Find peak day
    let peakDay = { date: "-", count: 0 };
    dailyDistributionData.forEach(d => {
      if (d.total > peakDay.count) {
        peakDay = { date: d.fullDate, count: d.total };
      }
    });

    // Top Village/Location
    const locationCounts: Record<string, number> = {};
    activeHotspots.forEach(h => {
      const loc = h.address || "Area Konsesi Terbuka";
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    let topLocation = "-";
    let topCount = 0;
    Object.entries(locationCounts).forEach(([loc, cnt]) => {
      if (cnt > topCount) {
        topLocation = loc;
        topCount = cnt;
      }
    });

    return {
      total,
      newCount,
      ackCount,
      avgConfidence,
      peakDay,
      topLocation,
      topCount
    };
  }, [activeHotspots, dailyDistributionData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-modal-title"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="analytics-modal-title" className="text-sm sm:text-base font-black text-slate-100 uppercase tracking-wider">
                  Panel Statistik & Visualisasi Hotspot
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-orange-500/20 border border-orange-500/40 text-orange-300 rounded-full font-mono">
                  Recharts Engine
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Analisis anomali termal berbasis satelit VIIRS, MODIS, SiPongi+, dan BRIN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoading30 && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-orange-400 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sinkronisasi Data 30 Hari...</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Tutup Panel Statistik"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar & Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Period Selector Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold px-2 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-orange-400" />
              <span className="hidden xs:inline">Periode:</span>
            </span>
            {[
              { id: "30", label: "30 Hari Terakhir" },
              { id: "7", label: "7 Hari" },
              { id: "1", label: "24 Jam" },
              { id: "current", label: "Data Peta Aktif" }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  period === p.id 
                    ? "bg-orange-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "overview" 
                  ? "bg-slate-800 text-orange-400 border border-slate-700" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ringkasan Lengkap
            </button>
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "daily" 
                  ? "bg-slate-800 text-orange-400 border border-slate-700" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Grafik Harian
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "status" 
                  ? "bg-slate-800 text-orange-400 border border-slate-700" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Status & Validasi
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-850/80 border border-slate-800 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Total Hotspot</span>
                <Flame className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summaryStats.total}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <span>Periode:</span>
                <span className="font-bold text-orange-400">
                  {period === "30" ? "30 Hari" : period === "7" ? "7 Hari" : period === "1" ? "24 Jam" : "Peta"}
                </span>
              </div>
            </div>

            <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-bold text-rose-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Status Baru</span>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
                {summaryStats.newCount}
              </div>
              <div className="text-[10px] text-rose-300/80 mt-1">
                {summaryStats.total > 0 
                  ? `${Math.round((summaryStats.newCount / summaryStats.total) * 100)}% butuh penanganan` 
                  : "Nihil hotspot baru"}
              </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Terkonfirmasi (Diakui)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {summaryStats.ackCount}
              </div>
              <div className="text-[10px] text-emerald-300/80 mt-1">
                {summaryStats.total > 0 
                  ? `${Math.round((summaryStats.ackCount / summaryStats.total) * 100)}% telah divalidasi` 
                  : "Nihil anomali"}
              </div>
            </div>

            <div className="bg-slate-850/80 border border-slate-800 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Rata-Rata Confidence</span>
                <Activity className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
                {summaryStats.avgConfidence}%
              </div>
              <div className="text-[10px] text-slate-400 mt-1 truncate">
                Puncak: {summaryStats.peakDay.count} titik ({summaryStats.peakDay.date})
              </div>
            </div>
          </div>

          {/* MAIN CHART 1: Grafik Batang Sebaran Hotspot per Hari (30 Hari Terakhir) */}
          <div className="bg-slate-850/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                  <span>Grafik Batang Sebaran Hotspot per Hari ({period === "30" ? "30 Hari Terakhir" : `${period} Hari Terakhir`})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Visualisasi frekuensi kejadian titik api harian dengan pemisahan status baru vs diakui
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
                  <span className="text-slate-300 font-medium">Baru</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                  <span className="text-slate-300 font-medium">Diakui</span>
                </div>
              </div>
            </div>

            <div className="h-[260px] sm:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyDistributionData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false}
                    interval={period === "30" ? 2 : 0}
                    angle={-35}
                    textAnchor="end"
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={<CustomBarTooltip />}
                    cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                  />
                  <Bar 
                    dataKey="baru" 
                    name="Status Baru" 
                    stackId="a" 
                    fill="#ef4444" 
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="diakui" 
                    name="Status Diakui" 
                    stackId="a" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECONDARY CHARTS ROW: Distribusi Status & Distribusi Zonasi Konsesi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* CHART 2: Distribusi Berdasarkan Status (Baru vs Diakui) */}
            <div className="bg-slate-850/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 mb-1">
                  <PieChartIcon className="w-4 h-4 text-emerald-400" />
                  <span>Distribusi Berdasarkan Status Operasional</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Proporsi verifikasi lapangan antara status baru dan status diakui tim siaga
                </p>
              </div>

              <div className="h-[210px] w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                {statusDistributionData.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-slate-400 truncate font-semibold">{item.name}</div>
                      <div className="text-sm font-bold text-white font-mono">
                        {item.value} <span className="text-[10px] text-slate-400 font-normal">({item.percentage}%)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CHART 3: Distribusi Berdasarkan Zonasi Konsesi & Jalur Hauling */}
            <div className="bg-slate-850/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Distribusi Zonasi Konsesi & Ring Proteksi</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Lokasi titik api terhadap batas konsesi IUPK, koridor hauling, dan zona penyangga
                </p>
              </div>

              <div className="h-[210px] w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={zoneDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {zoneDistributionData.map((entry, index) => (
                        <Cell key={`cell-zone-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                {zoneDistributionData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0 ml-2">
                      {item.value} <span className="text-slate-400 text-[10px]">({item.percentage}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* INSIGHTS & HOTSPOT CONCENTRATION */}
          <div className="bg-slate-850/40 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400 mb-3">
              <TrendingUp className="w-4 h-4" />
              <span>Analisis Intelegensi Lapangan & Titik Kerapatan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Konsentrasi Wilayah Terbanyak
                </div>
                <div className="text-sm font-bold text-slate-100 truncate">
                  {summaryStats.topLocation}
                </div>
                <div className="text-[11px] text-orange-400 mt-1 font-mono">
                  {summaryStats.topCount} titik hotspot terdeteksi
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Hari dengan Frekuensi Tertinggi
                </div>
                <div className="text-sm font-bold text-slate-100">
                  {summaryStats.peakDay.date}
                </div>
                <div className="text-[11px] text-red-400 mt-1 font-mono">
                  {summaryStats.peakDay.count} titik dalam 1 hari
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Kualitas Deteksi Satelit
                </div>
                <div className="text-sm font-bold text-slate-100">
                  {confidenceDistributionData[0].value} Akurasi Tinggi
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 font-mono">
                  {confidenceDistributionData[1].value} Sedang, {confidenceDistributionData[2].value} Rendah
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Visualisasi Real-time D3 / Recharts Engine</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-white rounded-lg font-bold transition-all cursor-pointer"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip for Daily Bar Chart
function CustomBarTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-2xl text-xs font-sans text-slate-100 backdrop-blur-md">
        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between gap-3">
          <span>{data.fullDate || label}</span>
          <span className="font-mono text-orange-400 font-bold">{data.total} Hotspot</span>
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-3 text-rose-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Status Baru:</span>
            </span>
            <span className="font-mono font-bold">{data.baru}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Status Diakui:</span>
            </span>
            <span className="font-mono font-bold">{data.diakui}</span>
          </div>
          {data.avgConfidence > 0 && (
            <div className="flex items-center justify-between gap-3 text-slate-400 pt-1 border-t border-slate-800 text-[10px]">
              <span>Rata-rata Keyakinan:</span>
              <span className="font-mono text-blue-300 font-bold">{data.avgConfidence}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

// Custom Tooltip for Pie Charts
function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 px-3 py-2 rounded-xl shadow-2xl text-xs font-sans text-slate-100 backdrop-blur-md">
        <div className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.color }} />
          <span>{item.name}</span>
        </div>
        <div className="font-mono text-sm font-black text-white">
          {item.value} <span className="text-xs text-slate-400 font-normal">({item.payload.percentage || 0}%)</span>
        </div>
      </div>
    );
  }
  return null;
}
