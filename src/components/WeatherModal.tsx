import React, { useState } from "react";
import {
  X,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  Wind,
  Droplets,
  Thermometer,
  Flame,
  Satellite,
  MapPin,
  RefreshCw,
  Info,
  Navigation
} from "lucide-react";
import {
  StationWeatherData,
  WeatherStation,
  OPERATIONAL_WEATHER_STATIONS,
  parseWeatherCode
} from "../weatherData";

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationsData: Record<string, StationWeatherData>;
  selectedStationId: string;
  onSelectStation: (id: string) => void;
  onRefresh: () => void;
  onFlyToStation?: (station: WeatherStation) => void;
  loading?: boolean;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  isOpen,
  onClose,
  stationsData,
  selectedStationId,
  onSelectStation,
  onRefresh,
  onFlyToStation,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<"current" | "hourly" | "daily">("current");

  if (!isOpen) return null;

  const currentData = stationsData[selectedStationId] || Object.values(stationsData)[0];
  if (!currentData) return null;

  const { station, current, hourly, daily, source } = currentData;

  const getWeatherIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case "sun":
        return <Sun className={`${className} text-amber-400`} />;
      case "cloud-sun":
        return <CloudSun className={`${className} text-amber-300`} />;
      case "cloud":
        return <Cloud className={`${className} text-slate-300`} />;
      case "cloud-rain":
        return <CloudRain className={`${className} text-blue-400`} />;
      case "cloud-heavy-rain":
        return <CloudRain className={`${className} text-indigo-400`} />;
      case "cloud-lightning":
        return <CloudLightning className={`${className} text-yellow-400`} />;
      case "cloud-drizzle":
        return <CloudDrizzle className={`${className} text-cyan-400`} />;
      default:
        return <CloudSun className={`${className} text-amber-300`} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Prakiraan Cuaca BMKG & Satelit Himawari</span>
                <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                  Live WITA
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md">
                Stasiun Meteorologi Koridor • {station.district}, {station.province}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title="Perbarui data cuaca real-time"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Tutup modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Station Selector Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 sm:gap-2 overflow-x-auto shrink-0">
          {OPERATIONAL_WEATHER_STATIONS.map((stn) => {
            const isSelected = stn.id === selectedStationId;
            const stnData = stationsData[stn.id];
            return (
              <button
                key={stn.id}
                onClick={() => onSelectStation(stn.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20"
                    : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <MapPin className="w-3.5 h-3.5 opacity-75" />
                <span>{stn.shortName}</span>
                {stnData && (
                  <span className="font-mono text-[11px] opacity-90 pl-1 border-l border-white/20">
                    {stnData.current.temperature}°C
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Main Station Highlight Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/80 shadow-lg relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-400">
                    Koordinat: {station.lat.toFixed(4)}, {station.lng.toFixed(4)}
                  </span>
                  {onFlyToStation && (
                    <button
                      onClick={() => {
                        onFlyToStation(station);
                        onClose();
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold underline underline-offset-2 cursor-pointer"
                      title="Lihat stasiun ini di peta utama"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Fokuskan Peta</span>
                    </button>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-100">{station.name}</h3>
                <p className="text-xs text-slate-400">
                  Kecamatan {station.subDistrict}, Kabupaten {station.district}
                </p>
              </div>

              {/* Big Weather Reading */}
              <div className="flex items-center gap-4 bg-slate-950/40 p-3 rounded-xl border border-slate-700/60 self-start sm:self-auto">
                <div className="p-2 bg-slate-800 rounded-lg">
                  {getWeatherIcon(current.weatherIcon, "w-8 h-8")}
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-100 font-mono">
                      {current.temperature}°
                    </span>
                    <span className="text-xs text-slate-400">C</span>
                  </div>
                  <div className="text-xs font-semibold text-amber-300">
                    {current.weatherDescription}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Atmospheric Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-700/60">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Kelembaban (RH)</span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  {current.relativeHumidity}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {current.relativeHumidity < 55 ? "Udara Kering" : "Cukup Lembab"}
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Wind className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kecepatan Angin</span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  {current.windSpeed} km/j
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Arah: {current.windDirectionCardinal}
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                  <span>Suhu Terasa</span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  {current.apparentTemperature}°C
                </div>
                <div className="text-[10px] text-slate-400">
                  Tutupan Awan: {current.cloudCover}%
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                  <span>Presipitasi</span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  {current.precipitation} mm
                </div>
                <div className="text-[10px] text-slate-400">
                  {current.precipitation > 0 ? "Hujan Terdeteksi" : "Nihil Hujan"}
                </div>
              </div>
            </div>
          </div>

          {/* Fire Weather Index (FFMC Karhutla Risk Analysis) */}
          <div className={`p-4 rounded-2xl border ${current.fireVulnerability.bgColor} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900/60 flex items-center justify-center shrink-0 mt-0.5">
                <Flame className={`w-5 h-5 ${current.fireVulnerability.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Indeks Kerentanan Karhutla (FFMC)
                  </span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-md uppercase ${current.fireVulnerability.color} bg-slate-900/80 border border-current/30`}>
                    {current.fireVulnerability.level}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {current.fireVulnerability.description}
                </p>
              </div>
            </div>
            <div className="text-right sm:shrink-0 pl-12 sm:pl-0">
              <div className="text-2xl font-black font-mono text-slate-100">
                {current.fireVulnerability.index}<span className="text-xs text-slate-400">/100</span>
              </div>
              <span className="text-[10px] text-slate-400">Skala Risiko Gambut</span>
            </div>
          </div>

          {/* Sub-view switcher: 3-Day Forecast vs Hourly */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("current")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === "current"
                    ? "bg-slate-800 text-blue-400 border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Prakiraan 3 Hari (BMKG)
              </button>
              <button
                onClick={() => setActiveTab("hourly")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === "hourly"
                    ? "bg-slate-800 text-blue-400 border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tren Per Jam (24 Jam)
              </button>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Update: {current.updatedAt} WITA
            </span>
          </div>

          {/* Tab 1: 3-Day Daily Forecast Cards */}
          {activeTab === "current" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {daily.map((day, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200">{day.dayName}</span>
                    <span className="text-[10px] font-mono text-slate-400">{day.date.slice(5)}</span>
                  </div>

                  <div className="flex items-center gap-3 my-2">
                    <div className="p-2 bg-slate-900 rounded-lg shrink-0">
                      {getWeatherIcon(
                        parseWeatherCode(day.weatherCode).icon,
                        "w-6 h-6"
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {day.weatherDescription}
                      </div>
                      <div className="text-sm font-mono font-bold text-slate-100">
                        {day.tempMax}° / <span className="text-slate-400 text-xs">{day.tempMin}°C</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" />
                      {day.precipitationProbabilityMax}% Hujan
                    </span>
                    <span className={`font-semibold ${
                      day.fireRisk === "Sangat Mudah Terbakar"
                        ? "text-rose-400"
                        : day.fireRisk === "Rawan"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}>
                      {day.fireRisk}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Hourly Forecast Strip */}
          {activeTab === "hourly" && (
            <div className="overflow-x-auto pb-2">
              <div className="flex items-center gap-2 min-w-[680px]">
                {hourly.slice(0, 12).map((h, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex-1 text-center flex flex-col items-center gap-1.5 min-w-[70px]"
                  >
                    <span className="text-[11px] font-mono text-slate-400 font-semibold">
                      {h.hour}
                    </span>
                    <div className="p-1.5 bg-slate-900 rounded-lg">
                      {getWeatherIcon(
                        parseWeatherCode(h.weatherCode).icon,
                        "w-4 h-4"
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      {h.temperature}°
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-0.5">
                      <Droplets className="w-2.5 h-2.5" />
                      {h.precipitationProbability}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {h.windSpeed} km/j
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Source Disclaimer Footer */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">Integrasi Multi-Sumber BMKG & Satelit: </span>
              Data cuaca diolah otomatis dari radar meteorologi BMKG Kalimantan (Stasiun Syamsudin Noor & Gusti Syamsir Alam) dipadukan dengan citra satelit cuaca Himawari-9 (JMA) dan model resolusi tinggi GFS.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
