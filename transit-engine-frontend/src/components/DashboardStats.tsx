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
  // Filter stations for the current active line
  const lineStations = stations.filter((s) => s.line === activeLine);
  
  // Calculate distribution of statuses (Clear, Moderate, Heavy)
  let clearCount = 0;
  let moderateCount = 0;
  let heavyCount = 0;

  lineStations.forEach((station) => {
    // Determine the current weight (user override vs. historical baseline)
    const report = userReports[station.id];
    const isReportRecent = report && (new Date().getTime() - report.timestamp.getTime()) < 15 * 60 * 1000;
    const currentWeight = isReportRecent ? report.weight : station.historical_baseline[activePeriod];

    if (currentWeight === 3) heavyCount++;
    else if (currentWeight === 2) moderateCount++;
    else clearCount++;
  });

  const total = lineStations.length || 1;
  const clearPct = Math.round((clearCount / total) * 100);

  // Time periods descriptions
  const periodMeta = {
    morning_peak: {
      label: 'Morning Peak',
      hours: '6:00 AM - 9:00 AM',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      theme: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    },
    off_peak: {
      label: 'Off-Peak',
      hours: '9:00 AM - 5:00 PM',
      icon: <CloudSun className="w-4 h-4 text-emerald-500" />,
      theme: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    },
    evening_peak: {
      label: 'Evening Peak',
      hours: '5:00 PM - 9:00 PM',
      icon: <Sunset className="w-4 h-4 text-indigo-500" />,
      theme: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    },
  };

  return (
    <div className="w-full px-4 pt-6 pb-2 space-y-4">
      {/* Stats Cards Section */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Card 1: Flow Rate percentage */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-between text-left">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Line Flow Rate</span>
          <div className="my-1.5 flex items-baseline gap-1">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{clearPct}%</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Clear</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
            {clearCount} of {total} stations reporting green/clear status.
          </p>
        </div>

        {/* Card 2: Peak Period Info */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-between text-left">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Historical Timeframe</span>
          <div className={`my-1.5 flex items-center gap-1.5 self-start px-2 py-0.5 rounded-md border text-xs font-bold ${periodMeta[activePeriod].theme}`}>
            {periodMeta[activePeriod].icon}
            <span>{periodMeta[activePeriod].label}</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
            Baselines matching {periodMeta[activePeriod].hours} commutes.
          </p>
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
