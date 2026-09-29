import React from "react";

interface CompassRoseProps {
  onResetOrientation?: () => void;
  className?: string;
}

export const CompassRose: React.FC<CompassRoseProps> = ({ onResetOrientation, className = "" }) => {
  return (
    <div
      className={`select-none flex flex-col items-center group pointer-events-auto ${className}`}
      title="Kompas Arah Mata Angin (Utara Sejati). Klik untuk memusatkan kembali peta."
    >
      <button
        onClick={onResetOrientation}
        className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl bg-slate-900/95 hover:bg-slate-800 active:bg-slate-700 backdrop-blur-md border-2 border-slate-600 hover:border-red-500 shadow-2xl flex flex-col items-center justify-center p-1 transition-all duration-200 active:scale-95 cursor-pointer"
        aria-label="Kompas Arah Utara - Klik untuk Reset Tampilan Peta"
      >
        <svg
          viewBox="0 0 100 100"
          className="w-9 h-9 transform transition-transform duration-300 group-hover:scale-105"
        >
          {/* Outer dial ring */}
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="#090d16"
            stroke="#cbd5e1"
            strokeWidth="2.5"
          />
          <circle
            cx="50"
            cy="50"
            r="39"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="3, 3"
          />

          {/* Cardinal tick marks */}
          <line x1="50" y1="4" x2="50" y2="13" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          <line x1="96" y1="50" x2="87" y2="50" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="96" x2="50" y2="87" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="4" y1="50" x2="13" y2="50" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />

          {/* West needle */}
          <polygon points="50,50 18,50 50,54" fill="#94a3b8" />
          <polygon points="50,50 18,50 50,46" fill="#475569" />

          {/* East needle */}
          <polygon points="50,50 82,50 50,46" fill="#94a3b8" />
          <polygon points="50,50 82,50 50,54" fill="#475569" />

          {/* South needle */}
          <polygon points="50,50 50,82 46,50" fill="#94a3b8" />
          <polygon points="50,50 50,82 54,50" fill="#475569" />

          {/* North needle - bold red pointer */}
          <polygon points="50,50 50,11 42,50" fill="#dc2626" />
          <polygon points="50,50 50,11 58,50" fill="#ef4444" />

          {/* Center Hub */}
          <circle cx="50" cy="50" r="5.5" fill="#f8fafc" stroke="#dc2626" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="2" fill="#0f172a" />

          {/* U (Utara) */}
          <text
            x="50"
            y="25"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
          >
            U
          </text>
        </svg>

        {/* Small label indicator under the compass */}
        <span className="text-[8px] font-mono font-extrabold text-red-400 tracking-wider leading-none mt-0.5">
          UTARA
        </span>
      </button>

      {/* Degree badge */}
      <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-900/95 backdrop-blur-sm border border-slate-700 shadow-md text-[8px] font-mono font-bold text-slate-200 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse"></span>
        <span>0° U</span>
      </div>
    </div>
  );
};
