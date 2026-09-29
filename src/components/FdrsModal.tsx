import { 
  Flame, 
  X, 
  Sun, 
  Droplets, 
  Wind, 
  Calendar, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Info
} from "lucide-react";
import { FdrsOverallAssessment } from "../fdrsData";

interface FdrsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fdrsData: FdrsOverallAssessment | null;
  onOpenWeatherDetail?: () => void;
}

export function FdrsModal({
  isOpen,
  onClose,
  fdrsData,
  onOpenWeatherDetail
}: FdrsModalProps) {
  if (!isOpen || !fdrsData) return null;

  const isExtreme = fdrsData.currentStatus === "Sangat Rawan / Ekstrem";
  const isHigh = fdrsData.currentStatus === "Rawan";
  const isModerate = fdrsData.currentStatus === "Waspada";

  const statusBg = isExtreme
    ? "bg-rose-950/80 border-rose-500/60 text-rose-200"
    : isHigh
    ? "bg-amber-950/80 border-amber-500/60 text-amber-200"
    : isModerate
    ? "bg-yellow-950/80 border-yellow-500/50 text-yellow-200"
    : "bg-emerald-950/80 border-emerald-500/50 text-emerald-200";

  const statusBadge = isExtreme
    ? "bg-rose-600 text-white"
    : isHigh
    ? "bg-amber-600 text-white"
    : isModerate
    ? "bg-yellow-600 text-white"
    : "bg-emerald-600 text-white";

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div 
        className="relative w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-850 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${statusBadge}`}>
              <Sun className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                  Indeks Kerawanan Karhutla Harian (FDRS)
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  BMKG & FWI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Fire Danger Rating System • Wilayah Operasional (Tabalong - Balangan - Barito)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Main Status Hero Card */}
          <div className={`p-4 rounded-2xl border shadow-lg ${statusBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${statusBadge}`}>
                    {fdrsData.currentStatus}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Update: {fdrsData.updatedAt}</span>
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {fdrsData.title}
                </h3>
                <p className="text-xs opacity-90 leading-relaxed">
                  {fdrsData.subtitle}
                </p>
              </div>

              {/* FWI Score Dial */}
              <div className="sm:self-center shrink-0 flex items-center gap-3 bg-black/30 p-2.5 rounded-xl border border-white/10">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider font-mono opacity-80">Skor FWI Maks</div>
                  <div className="text-2xl font-black font-mono leading-none text-white">
                    {fdrsData.highestRiskScore}
                    <span className="text-xs font-normal opacity-70">/100</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Quick FWI Interpretation */}
            <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] opacity-70">Kemudahan Terbakar</div>
                <div className="font-bold text-white mt-0.5">
                  {isExtreme ? "Sangat Cepat" : isHigh ? "Mudah Terbakar" : isModerate ? "Moderat" : "Sulit Terbakar"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] opacity-70">Perambatan Api</div>
                <div className="font-bold text-white mt-0.5">
                  {isExtreme ? "Sangat Cepat (Angin)" : isHigh ? "Cepat (Semak)" : "Perlahan / Terkendali"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] opacity-70">Risiko Batubara ROM</div>
                <div className="font-bold text-white mt-0.5">
                  {isExtreme || isHigh ? "Swabakar Tinggi" : "Normal / Terpantau"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-black/20">
                <div className="text-[10px] opacity-70">Status ERT / WT</div>
                <div className="font-bold text-white mt-0.5">
                  {isExtreme ? "Siaga 1 Penuh" : isHigh ? "Siaga 2 Terpadu" : "Patroli Rutin"}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: 3-Zone Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>Rincian Tingkat Risiko Per Wilayah Operasional</span>
              </h4>
              {onOpenWeatherDetail && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenWeatherDetail();
                  }}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <span>Lihat Stasiun Cuaca BMKG</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {fdrsData.zones.map((zone) => (
                <div
                  key={zone.zoneId}
                  className={`p-3 rounded-xl border bg-slate-800/60 ${zone.borderColor} flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-slate-100 text-xs truncate" title={zone.zoneName}>
                        {zone.zoneName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${zone.badgeBg} ${zone.badgeColor}`}>
                        {zone.riskLevel}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mb-2 truncate">
                      {zone.locationLabel}
                    </div>

                    <div className="space-y-1.5 bg-slate-900/60 p-2 rounded-lg text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Sun className="w-3 h-3 text-amber-400" />
                          <span>Suhu Udara</span>
                        </span>
                        <span className="font-bold text-slate-200">{zone.temperature}°C</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-blue-400" />
                          <span>Kelembaban (RH)</span>
                        </span>
                        <span className="font-bold text-slate-200">{zone.relativeHumidity}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Wind className="w-3 h-3 text-emerald-400" />
                          <span>Kecepatan Angin</span>
                        </span>
                        <span className="font-bold text-slate-200">{zone.windSpeed} km/j</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-orange-400" />
                          <span>Hari Tanpa Hujan</span>
                        </span>
                        <span className="font-bold text-amber-400">~{zone.daysWithoutRain} Hari</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Skor FWI:</span>
                    <span className="font-mono font-black text-xs text-white">
                      {zone.fwiScore} <span className="font-normal text-slate-400">/ 100</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: 3-Day Forecast Trend */}
          {fdrsData.forecastTrend.length > 0 && (
            <div className="bg-slate-850/70 border border-slate-700/70 rounded-xl p-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Prediksi Tren Kerawanan 3 Hari ke Depan</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Sumber: GFS Open-Meteo & BMKG</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {fdrsData.forecastTrend.map((trend, i) => (
                  <div key={i} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <div className="font-bold text-slate-200 text-xs">{trend.day}</div>
                    <div className="text-[10px] font-mono text-slate-400 mb-1">{trend.date}</div>
                    <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mb-1 bg-slate-800 border border-slate-700 text-orange-300">
                      {trend.status}
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono">
                      Maks: <span className="font-bold text-white">{trend.tempMax}°C</span>
                    </div>
                    <div className="text-[9px] text-blue-300 font-mono">
                      Hujan: {trend.rainProb}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-850 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Indeks Bahaya Karhutla (FDRS) • Model BMKG & CFFDRS</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-lg transition-all text-xs cursor-pointer shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
