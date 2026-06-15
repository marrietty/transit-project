import React from 'react';
import { Sun, Sunset, CloudSun } from 'lucide-react';

interface Station {
  id: string;
  name: string;
  line: string;
  order: number;
  historical_baseline: {
    morning_peak: number;
    off_peak: number;
    evening_peak: number;
  };
}

interface UserReport {
  weight: number;
  timestamp: Date;
}

interface DashboardStatsProps {
  activeLine: string;
  stations: Station[];
  activePeriod: 'morning_peak' | 'off_peak' | 'evening_peak';
  onPeriodChange: (period: 'morning_peak' | 'off_peak' | 'evening_peak') => void;
  userReports: Record<string, UserReport>;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  activeLine,
  stations,
  activePeriod,
  onPeriodChange,
  userReports,
}) => {
  // Helper to calculate a line's general status dynamically
  const getLineStatus = (lineName: string): string => {
    const lineStns = stations.filter((s) => s.line === lineName);
    if (lineStns.length === 0) return 'Unknown';
    
    let totalWeight = 0;
    lineStns.forEach((s) => {
      const report = userReports[s.id];
      const isRecent = report && (new Date().getTime() - report.timestamp.getTime()) < 15 * 60 * 1000;
      totalWeight += isRecent ? report.weight : s.historical_baseline[activePeriod];
    });

    const average = totalWeight / lineStns.length;
    if (average >= 2.3) return 'High congestion';
    if (average >= 1.6) return 'Moderate';
    return 'Clear';
  };

  // Calculate dynamic status for LRT-1, LRT-2, and MRT-3
  const lrt1Status = getLineStatus('LRT-1');
  const lrt2Status = getLineStatus('LRT-2');
  const mrt3Status = getLineStatus('MRT-3');
  const lineStatusSummary = `LRT-1: ${lrt1Status} · LRT-2: ${lrt2Status} · MRT-3: ${mrt3Status}`;

  // Filter stations for the current active line to calculate the clear stations ratio
  const activeLineStations = stations.filter((s) => s.line === activeLine);
  let clearCount = 0;
  activeLineStations.forEach((s) => {
    const report = userReports[s.id];
    const isRecent = report && (new Date().getTime() - report.timestamp.getTime()) < 15 * 60 * 1000;
    const currentWeight = isRecent ? report.weight : s.historical_baseline[activePeriod];
    if (currentWeight === 1) {
      clearCount++;
    }
  });
  const totalStationsCount = activeLineStations.length || 1;

  // Time periods descriptions
  const periodMeta = {
    morning_peak: {
      label: 'Morning Peak',
      badgeText: 'Morning peak (6–9 AM baseline)',
      icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
      theme: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    },
    off_peak: {
      label: 'Off-Peak',
      badgeText: 'Off-peak (9 AM – 5 PM baseline)',
      icon: <CloudSun className="w-3.5 h-3.5 text-emerald-500" />,
      theme: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    },
    evening_peak: {
      label: 'Evening Peak',
      badgeText: 'Evening peak (5–9 PM baseline)',
      icon: <Sunset className="w-3.5 h-3.5 text-indigo-500" />,
      theme: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    },
  };

  return (
    <div className="w-full px-4 pt-6 pb-2 space-y-4">
      
      {/* collapsed top stats section - exactly 3 summary chunks in 1 card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col space-y-3.5 text-left shadow-xs">
        {/* Chunk 1: Line Status Summary */}
        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight leading-snug">
          {lineStatusSummary}
        </div>

        {/* Chunk 2: Time Context Badge */}
        <div className="flex items-center gap-1.5 self-start">
          <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-wide ${periodMeta[activePeriod].theme}`}>
            {periodMeta[activePeriod].icon}
            <span>{periodMeta[activePeriod].badgeText}</span>
          </span>
        </div>

        {/* Chunk 3: Clear Stations Ratio */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold pl-0.5">
          {clearCount} of {totalStationsCount} stations clear
        </div>
      </div>

      {/* Period Filter Toggles */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-left pl-1">
          Historical Baseline View
        </label>
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
          {(['morning_peak', 'off_peak', 'evening_peak'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onPeriodChange(period)}
              className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activePeriod === period
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs border-b border-slate-200/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {period === 'morning_peak' ? '6AM-9AM' : period === 'off_peak' ? '9AM-5PM' : '5PM-9PM'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
