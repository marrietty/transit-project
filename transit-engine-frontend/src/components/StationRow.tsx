import { ArrowRightLeft, MessageSquarePlus, Clock } from 'lucide-react';

export interface Station {
  id: string;
  name: string;
  line: string;
  order: number;
  coordinates: { lat: number; lng: number };
  historical_baseline: {
    morning_peak: number;
    off_peak: number;
    evening_peak: number;
  };
}

export interface UserReport {
  weight: number;
  minutes: number;
  note: string;
  timestamp: Date;
}

interface StationRowProps {
  station: Station;
  currentWeight: number; // calculated based on active period OR user overrides
  estimatedWaitMinutes: number; // calculated wait time
  userReport: UserReport | null; // check if there is a recent user report
  isFirst: boolean;
  isLast: boolean;
  onOpenReportModal: (station: Station) => void;
}

export const StationRow: React.FC<StationRowProps> = ({
  station,
  currentWeight,
  estimatedWaitMinutes,
  userReport,
  isFirst,
  isLast,
  onOpenReportModal,
}) => {
  // Determine color coding & status label based on weight
  const getStatusConfig = (weight: number) => {
    switch (weight) {
      case 3:
        return {
          bg: 'bg-red-500',
          text: 'text-red-700 dark:text-red-400',
          border: 'border-red-500/30',
          badgeBg: 'bg-red-100 dark:bg-red-950/40',
          ring: 'ring-red-400/50 dark:ring-red-600/30',
          label: 'Heavy Queue',
          textColor: 'text-red-600 dark:text-red-400',
        };
      case 2:
        return {
          bg: 'bg-amber-500',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-500/30',
          badgeBg: 'bg-amber-100 dark:bg-amber-950/40',
          ring: 'ring-amber-400/50 dark:ring-amber-600/30',
          label: 'Moderate',
          textColor: 'text-amber-600 dark:text-amber-400',
        };
      case 1:
      default:
        return {
          bg: 'bg-emerald-500',
          text: 'text-emerald-700 dark:text-emerald-400',
          border: 'border-emerald-500/30',
          badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40',
          ring: 'ring-emerald-400/50 dark:ring-emerald-600/30',
          label: 'Clear',
          textColor: 'text-emerald-600 dark:text-emerald-400',
        };
    }
  };

  const status = getStatusConfig(currentWeight);

  // Line brand line-connector colors
  const getLineColorClass = (line: string) => {
    switch (line) {
      case 'LRT-1': return 'bg-lrt1';
      case 'LRT-2': return 'bg-lrt2';
      case 'MRT-3': return 'bg-mrt3';
      default: return 'bg-slate-400';
    }
  };

  const lineColor = getLineColorClass(station.line);

  // Check for key transfer points in Metro Manila transit network
  const getTransferInfo = (stationId: string) => {
    if (stationId === 'mrt3-cubao' || stationId === 'lrt2-cubao') {
      return { line: stationId.startsWith('mrt3') ? 'LRT-2' : 'MRT-3', station: 'Araneta Center-Cubao' };
    }
    if (stationId === 'mrt3-taft') {
      return { line: 'LRT-1', station: 'EDSA Station' };
    }
    if (stationId === 'lrt1-edsa') {
      return { line: 'MRT-3', station: 'Taft Avenue' };
    }
    if (stationId === 'lrt1-doroteo-jose') {
      return { line: 'LRT-2', station: 'Recto Station' };
    }
    if (stationId === 'lrt2-recto') {
      return { line: 'LRT-1', station: 'Doroteo Jose' };
    }
    if (stationId === 'lrt1-blumentritt') {
      return { line: 'PNR Metro Commuter', station: 'Blumentritt Station' };
    }
    return null;
  };

  const transfer = getTransferInfo(station.id);

  return (
    <div className="flex w-full group min-h-[85px] items-stretch">
      {/* Timeline Graphic Column */}
      <div className="flex flex-col items-center w-14 shrink-0 relative">
        {/* Top segment connector line */}
        {!isFirst && (
          <div className={`w-1 flex-1 ${lineColor} opacity-70`} />
        )}
        {isFirst && (
          <div className="w-1 h-6 bg-transparent" />
        )}

        {/* Center Station Bubble */}
        <div 
          className={`relative z-10 my-2 w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border-3 border-slate-200 dark:border-slate-800 transition-all duration-300 ring-4 ${status.ring}`}
        >
          {/* Inner core circle with status color */}
          <div 
            className={`w-3.5 h-3.5 rounded-full ${status.bg} transition-all duration-300 ${
              currentWeight === 3 ? 'status-active-pulse' : ''
            }`}
          />
        </div>

        {/* Bottom segment connector line */}
        {!isLast && (
          <div className={`w-1 flex-1 ${lineColor} opacity-70`} />
        )}
        {isLast && (
          <div className="w-1 h-6 bg-transparent" />
        )}
      </div>

      {/* Station Information Row Panel */}
      <div className="flex-1 pb-4 pr-4 flex items-center border-b border-slate-100 dark:border-slate-800/80 gap-3">
        <div className="flex-1 min-w-0 space-y-1 py-1">
          {/* Header Row: Station Name + Order Badge */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
            <h3 className="font-extrabold text-[15px] sm:text-base text-slate-800 dark:text-slate-200 tracking-tight leading-tight">
              {station.name}
            </h3>
            <span className="inline-flex text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-sm">
              #{station.order}
            </span>
            {userReport && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-sm border border-indigo-500/25">
                <Clock className="w-2.5 h-2.5" /> LIVE
              </span>
            )}
          </div>

          {/* Transfers, Baselines & User Reports */}
          <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            {/* Inter-line Transfer Badge */}
            {transfer && (
              <div className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                <ArrowRightLeft className="w-3 h-3 shrink-0" />
                <span>Transfer to {transfer.line} ({transfer.station})</span>
              </div>
            )}

            {/* Commuter report note */}
            {userReport ? (
              <div className="bg-slate-100 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50 mt-1 max-w-sm">
                <div className="flex justify-between items-center text-[10px] font-bold mb-0.5">
                  <span className="text-slate-600 dark:text-slate-300">Passenger Live Update:</span>
                  <span className="text-slate-400 font-medium">
                    {Math.round((new Date().getTime() - userReport.timestamp.getTime()) / 60000)}m ago
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 italic leading-snug">
                  "{userReport.note || `Queue is ${userReport.weight === 1 ? 'clear' : userReport.weight === 2 ? 'moving' : 'backed up'}.`}"
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Wait: ~{userReport.minutes} mins</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
                  {status.label} (~{estimatedWaitMinutes}m wait)
                </span>
                <span className="opacity-30">•</span>
                <span className="text-slate-400">
                  {station.coordinates.lat.toFixed(4)}, {station.coordinates.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Column: CTA Report Button */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <button
            onClick={() => onOpenReportModal(station)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer transition-all duration-200 active:scale-95 shadow-xs touch-manipulation select-none"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
