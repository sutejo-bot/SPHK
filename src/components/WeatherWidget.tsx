import React from "react";
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  Wind,
  Droplets,
  ChevronRight,
  Flame
} from "lucide-react";
import {
  StationWeatherData,
  OPERATIONAL_WEATHER_STATIONS,
} from "../weatherData";

interface WeatherWidgetProps {
  stationsData: Record<string, StationWeatherData>;
  selectedStationId: string;
  onSelectStation: (id: string) => void;
  onOpenModal: () => void;
  className?: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  stationsData,
  selectedStationId,
  onSelectStation,
  onOpenModal,
  className = "",
}) => {
  const currentData = stationsData[selectedStationId] || Object.values(stationsData)[0];

  if (!currentData) return null;

  const { station, current } = currentData;

  const getWeatherIcon = (iconName: string, className = "w-4 h-4") => {
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
    <div
      className={`bg-slate-900/90 hover:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl transition-all duration-200 select-none ${className}`}
    >
      {/* Top Station Selector Tab */}
      <div className="flex items-center p-1 bg-slate-950/60 rounded-t-2xl border-b border-slate-800/80 gap-1 overflow-x-auto">
        {OPERATIONAL_WEATHER_STATIONS.map((stn) => {
          const isSelected = stn.id === selectedStationId;
          return (
            <button
              key={stn.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectStation(stn.id);
              }}
              className={`px-2 py-1 rounded-xl text-[10px] font-bold tracking-tight transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                isSelected
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span>{stn.shortName}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Weather Card */}
      <div
        onClick={onOpenModal}
        className="p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer group"
        title="Klik untuk melihat prakiraan cuaca lengkap BMKG & Satelit Himawari-9"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center shrink-0">
            {getWeatherIcon(current.weatherIcon, "w-4 h-4")}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-black font-mono text-slate-100 leading-none">
                {current.temperature}°C
              </span>
              <span className="text-[11px] font-semibold text-amber-300 truncate max-w-[90px] sm:max-w-none">
                {current.weatherDescription}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
              <span className="flex items-center gap-0.5">
                <Droplets className="w-3 h-3 text-cyan-400" />
                {current.relativeHumidity}%
              </span>
              <span>•</span>
              <span className="flex items-center gap-0.5">
                <Wind className="w-3 h-3 text-emerald-400" />
                {current.windSpeed} km/j {current.windDirectionCardinal.split(" ")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Karhutla Risk Badge & Detail Arrow */}
        <div className="flex items-center gap-2 shrink-0 pl-1 border-l border-slate-800">
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Risiko Lahan</span>
            <span className={`text-[10px] font-extrabold flex items-center gap-1 ${current.fireVulnerability.color}`}>
              <Flame className="w-2.5 h-2.5" />
              {current.fireVulnerability.level}
            </span>
          </div>

          <div className="w-6 h-6 rounded-lg bg-slate-800 group-hover:bg-blue-600 text-slate-400 group-hover:text-white transition-colors flex items-center justify-center">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
