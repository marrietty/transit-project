import React, { useState } from 'react';
import { StationRow } from './StationRow';
import type { Station, UserReport } from './StationRow';
import { Search, ArrowUpDown, Info } from 'lucide-react';

interface TimelineProps {
  stations: Station[];
  activeLine: string;
  activePeriod: 'morning_peak' | 'off_peak' | 'evening_peak';
  userReports: Record<string, UserReport>;
  onOpenReportModal: (station: Station) => void;
  isOnline: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  stations,
  activeLine,
  activePeriod,
  userReports,
  onOpenReportModal,
  isOnline,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isReversed, setIsReversed] = useState<boolean>(false);

  // Filter stations based on the selected line
  const lineStations = stations.filter((s) => s.line === activeLine);

  // Sort by order based on direct/reverse preference
  const sortedStations = [...lineStations].sort((a, b) => {
    return isReversed ? b.order - a.order : a.order - b.order;
  });

  // Filter based on search query
  const filteredStations = sortedStations.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get terminal names for direction labels
  const getDirectionLabel = () => {
    if (lineStations.length === 0) return '';
    const firstStationName = lineStations[0].name;
    const lastStationName = lineStations[lineStations.length - 1].name;

    if (isReversed) {
      return `${lastStationName} ➔ ${firstStationName}`;
    } else {
      return `${firstStationName} ➔ ${lastStationName}`;
    }
  };

  const getDirectionActionLabel = () => {
    if (activeLine === 'LRT-2') {
      return isReversed ? 'Westbound' : 'Eastbound';
    }
    return isReversed ? 'Northbound' : 'Southbound';
  };

  // Helper to determine queue weight for a station at the current period
  const getStationWeight = (station: Station) => {
    // If user reported something in the last 15 minutes, override baseline
    const report = userReports[station.id];
    if (report && (new Date().getTime() - report.timestamp.getTime()) < 15 * 60 * 1000) {
      return report.weight;
    }
    return station.historical_baseline[activePeriod];
  };

  const getStationWaitMinutes = (station: Station, currentWeight: number) => {
    const report = userReports[station.id];
    if (report && (new Date().getTime() - report.timestamp.getTime()) < 15 * 60 * 1000) {
      return report.minutes;
    }
    // Static weights fallback estimated waiting minutes:
    // Clear = 1-5 mins, Moderate = 10-15 mins, Heavy = 20-40 mins
    switch (currentWeight) {
      case 3: return 25;
      case 2: return 12;
      case 1:
      default:
        return 3;
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col px-4 pb-24">
      {/* Search & Filter Bar */}
      <div className=" top-[108px] z-20 bg-slate-900/5 dark:bg-slate-950/20 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 py-3 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-slate-500/20"
          />
        </div>

        <button
          onClick={() => setIsReversed(!isReversed)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer select-none"
          title="Toggle Line Direction"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Swap Route</span>
        </button>
      </div>

      {/* Direction & Status Summary Panel */}
      <div className="flex items-center justify-between px-2 mb-4">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Active Direction</span>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {getDirectionActionLabel()} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">({getDirectionLabel()})</span>
          </div>
        </div>
        
        {/* Statistics badge count - only shown when filter is active */}
        {searchQuery && (
          <span className="text-xs bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full border border-slate-200/30 dark:border-slate-800/30">
            Found {filteredStations.length} of {lineStations.length}
          </span>
        )}
      </div>

      {/* Vertical Timeline Wrapper */}
      {filteredStations.length > 0 ? (
        <div className="flex flex-col bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 p-3 sm:p-5 rounded-3xl shadow-xs">
          {filteredStations.map((station, index) => {
            const currentWeight = getStationWeight(station);
            const estMinutes = getStationWaitMinutes(station, currentWeight);
            const userReport = userReports[station.id] || null;
            const isReportRecent = userReport && (new Date().getTime() - userReport.timestamp.getTime()) < 15 * 60 * 1000;

            return (
              <StationRow
                key={station.id}
                station={station}
                currentWeight={currentWeight}
                estimatedWaitMinutes={estMinutes}
                userReport={isReportRecent ? userReport : null}
                isFirst={index === 0}
                isLast={index === filteredStations.length - 1}
                onOpenReportModal={onOpenReportModal}
                isOnline={isOnline}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/10">
          <Info className="w-8 h-8 text-slate-400 mb-2" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No stations match "{searchQuery}"</h4>
          <p className="text-xs text-slate-500 mt-1">Check spelling or select a different rail line.</p>
        </div>
      )}
    </div>
  );
};
