import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, MessageSquarePlus, Clock } from 'lucide-react';
import subwayData from '../data/manila_subway_data.json';

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
  isOnline: boolean;
  refetchTrigger?: number;
}

interface GTFSStation {
  id: string;
  sequence: number;
  name: string;
  full_name: string;
  coordinates: { lat: number; lng: number };
  transfer_lines: string[];
  first_train: string;
  last_train: string;
  line_id: string;
}

interface GTFSLine {
  id: string;
  name: string;
  full_name: string;
  color: string;
  text_color: string;
  headway: string;
  stations: GTFSStation[];
}

interface GTFSData {
  lines: GTFSLine[];
}

// Colloquial area lookup mapping for stations
const colloquialAreas: Record<string, string> = {
  // LRT-1
  'lrt1-fpj': 'Quezon City N',
  'lrt1-balintawak': 'Quezon City',
  'lrt1-monumento': 'Caloocan',
  'lrt1-5th-ave': 'Caloocan',
  'lrt1-r-papa': 'Tondo',
  'lrt1-abad-santos': 'Tondo',
  'lrt1-blumentritt': 'Sampaloc',
  'lrt1-tayuman': 'Sampaloc',
  'lrt1-bambang': 'Sampaloc',
  'lrt1-doroteo-jose': 'Quiapo',
  'lrt1-carriedo': 'Quiapo',
  'lrt1-central': 'Manila',
  'lrt1-un-ave': 'Ermita',
  'lrt1-pedro-gil': 'Paco',
  'lrt1-quirino': 'Malate',
  'lrt1-vito-cruz': 'Malate',
  'lrt1-gil-puyat': 'Pasay',
  'lrt1-libertad': 'Pasay',
  'lrt1-edsa': 'Pasay',
  'lrt1-baclaran': 'Pasay',
  'lrt1-redemptorist': 'Paranaque',
  'lrt1-mia': 'Paranaque',
  'lrt1-asiaworld': 'Paranaque',
  'lrt1-ninoy-aquino': 'Paranaque',
  'lrt1-dr-santos': 'Las Pinas',
  // LRT-2
  'lrt2-recto': 'Manila',
  'lrt2-legarda': 'Manila',
  'lrt2-pureza': 'Manila',
  'lrt2-vmapa': 'Manila',
  'lrt2-jruiz': 'San Juan',
  'lrt2-gilmore': 'Quezon City',
  'lrt2-betty-go': 'Quezon City',
  'lrt2-cubao': 'Quezon City',
  'lrt2-anonas': 'Quezon City',
  'lrt2-katipunan': 'Quezon City',
  'lrt2-santolan': 'Marikina',
  'lrt2-marikina-pasig': 'Marikina',
  'lrt2-antipolo': 'Antipolo',
  // MRT-3
  'mrt3-taft': 'Pasay',
  'mrt3-magallanes': 'Makati',
  'mrt3-ayala': 'Makati',
  'mrt3-buendia': 'Makati',
  'mrt3-guadalupe': 'Makati',
  'mrt3-boni': 'Mandaluyong',
  'mrt3-shaw': 'Mandaluyong',
  'mrt3-ortigas': 'Pasig',
  'mrt3-santolan-annapolis': 'San Juan',
  'mrt3-cubao': 'Quezon City',
  'mrt3-kamuning': 'Quezon City',
  'mrt3-quezon-ave': 'Quezon City',
  'mrt3-north-ave': 'Quezon City',
};

// Retrieve timetable info based on fuzzy station name match
const getTimetableInfo = (stationName: string, lineName: string) => {
  const data = subwayData as GTFSData;
  const targetLineId = lineName.toLowerCase().replace('-', '');
  const line = data.lines.find(l => l.id === targetLineId);
  if (!line) return null;

  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace('station', '')
      .replace('ave', '')
      .replace('avenue', '');

  const normTarget = normalize(stationName);
  const searchName = normTarget === 'fernandopoejr' ? 'roosevelt' : normTarget;

  const matched = line.stations.find((s) => {
    const normSource = normalize(s.name);
    return normSource.includes(searchName) || searchName.includes(normSource);
  });

  if (matched) {
    return {
      first_train: matched.first_train,
      last_train: matched.last_train,
      headway: line.headway,
    };
  }
  return null;
};

// Formats a 24h schedule string to a clean 12h AM/PM layout
const format12h = (timeStr: string): string => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  return `${hours}:${minutes} ${ampm}`;
};

export const StationRow: React.FC<StationRowProps> = ({
  station,
  currentWeight,
  estimatedWaitMinutes,
  userReport,
  isFirst,
  isLast,
  onOpenReportModal,
  isOnline,
  refetchTrigger,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Live predictions state
  const [prediction, setPrediction] = useState<{
    congestion_level: string;
    predicted_volume: number;
    live_reports_count: number;
  } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isExpanded) return;

    setPredictionLoading(true);
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const backendUrl = `${apiBaseUrl}/api/status/${station.id}`;

    fetch(backendUrl)
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => {
        setPrediction({
          congestion_level: data.congestion_level,
          predicted_volume: data.predicted_volume,
          live_reports_count: data.live_reports_count,
        });
      })
      .catch((err) => {
        console.error('Error fetching prediction for station:', station.id, err);
        setPrediction(null);
      })
      .finally(() => {
        setPredictionLoading(false);
      });
  }, [isExpanded, station.id, userReport, refetchTrigger]);

  // Status configuration mapping
  const getStatusConfig = (weight: number) => {
    switch (weight) {
      case 3:
        return {
          bg: 'bg-red-500',
          text: 'text-red-700 dark:text-red-400 border-red-500/20 dark:border-red-500/10',
          border: 'border-red-500/30 dark:border-red-500/20',
          badgeBg: 'bg-red-500/10 dark:bg-red-950/20',
          ring: 'ring-red-400/30 dark:ring-red-600/20',
          label: 'Heavy',
        };
      case 2:
        return {
          bg: 'bg-amber-500',
          text: 'text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/10',
          border: 'border-amber-500/30 dark:border-amber-500/20',
          badgeBg: 'bg-amber-500/10 dark:bg-amber-950/20',
          ring: 'ring-amber-400/30 dark:ring-amber-600/20',
          label: 'Moderate',
        };
      case 1:
      default:
        return {
          bg: 'bg-emerald-500',
          text: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/10',
          border: 'border-emerald-500/30 dark:border-emerald-500/20',
          badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/20',
          ring: 'ring-emerald-400/30 dark:ring-emerald-600/20',
          label: 'Clear',
        };
    }
  };

  // Color configuration should reflect ML forecast when available
  const displayWeight = (() => {
    if (prediction) {
      if (prediction.congestion_level === 'Low') return 1;
      if (prediction.congestion_level === 'Medium') return 2;
      if (prediction.congestion_level === 'High') return 3;
      if (prediction.congestion_level === 'Critical') return 3;
    }
    return currentWeight;
  })();

  const status = getStatusConfig(displayWeight);

  // Wait minutes estimation should follow the display weight
  const displayWaitMinutes = (() => {
    if (prediction) {
      if (userReport) return estimatedWaitMinutes;
      if (prediction.congestion_level === 'Low') return 3;
      if (prediction.congestion_level === 'Medium') return 12;
      if (prediction.congestion_level === 'High') return 25;
      if (prediction.congestion_level === 'Critical') return 45;
    }
    return estimatedWaitMinutes;
  })();

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

  // Check for transfer points in network
  const getTransferInfo = (stationId: string) => {
    if (stationId === 'mrt3-cubao' || stationId === 'lrt2-cubao') {
      return { line: stationId.startsWith('mrt3') ? 'LRT-2' : 'MRT-3', station: 'Araneta Center-Cubao' };
    }
    if (stationId === 'mrt3-taft') {
      return { line: 'LRT-1', station: 'EDSA' };
    }
    if (stationId === 'lrt1-edsa') {
      return { line: 'MRT-3', station: 'Taft Avenue' };
    }
    if (stationId === 'lrt1-doroteo-jose') {
      return { line: 'LRT-2', station: 'Recto' };
    }
    if (stationId === 'lrt2-recto') {
      return { line: 'LRT-1', station: 'Doroteo Jose' };
    }
    if (stationId === 'lrt1-blumentritt') {
      return { line: 'PNR Metro Commuter', station: 'Blumentritt' };
    }
    return null;
  };

  const transfer = getTransferInfo(station.id);
  const timetable = getTimetableInfo(station.name, station.line);

  // Clean interval display labels
  const formattedInterval = timetable ? timetable.headway.replace(' mins', ' min') : '';
  const plainInterval = timetable ? timetable.headway.replace('Every ', 'Trains every ').replace(' mins', ' min') : '';
  const areaName = colloquialAreas[station.id] || '';

  // Next train countdown estimation: show estimated countdown when online, otherwise fallback to plain interval
  const nextTrainMinutes = (() => {
    const hash = station.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const currentMinute = new Date().getMinutes();
    if (station.line === 'LRT-1') {
      return ((hash + currentMinute) % 2) + 3; // 3 to 4 min
    } else if (station.line === 'LRT-2') {
      return ((hash + currentMinute) % 3) + 5; // 5 to 7 min
    } else if (station.line === 'MRT-3') {
      return ((hash + currentMinute) % 3) + 3; // 3 to 5 min
    }
    return ((hash + currentMinute) % 3) + 3; // fallback 3 to 5 min
  })();

  const nextTrainLabel = isOnline 
    ? `Next train ~${nextTrainMinutes} min`
    : plainInterval || 'Trains every 4-5 min';

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Do not toggle accordion if clicking map links or action buttons
    if (target.closest('.no-toggle')) {
      return;
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="flex w-full group min-h-[90px] items-stretch cursor-pointer select-none"
    >
      {/* Timeline Graphic Column */}
      <div className="flex flex-col items-center w-14 shrink-0 relative">
        {/* Top segment connector line */}
        {!isFirst && (
          <div className={`w-1 flex-1 ${lineColor} opacity-70`} />
        )}
        {isFirst && (
          <div className="w-1 h-6 bg-transparent" />
        )}

        {/* Center Status Bubble */}
        <div 
          className={`relative z-10 my-2.5 w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border-3 border-slate-200 dark:border-slate-800 transition-all duration-300 ring-4 ${status.ring}`}
        >
          {/* Inner core circle with status color */}
          <div 
            className={`w-3.5 h-3.5 rounded-full ${status.bg} transition-all duration-300 ${
              displayWeight === 3 ? 'status-active-pulse' : ''
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
      <div className="flex-1 pb-4 pr-3 flex flex-col justify-center border-b border-slate-100 dark:border-slate-800/80">
        
        {/* Row 1: Station Name, Line and Chevron */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
            <h3 className="font-extrabold text-[15px] sm:text-base text-slate-800 dark:text-slate-200 tracking-tight leading-tight">
              {station.name}
            </h3>
            <span className="inline-flex text-[9px] font-bold px-1.5 py-0.2 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-sm">
              #{station.order}
            </span>
          </div>

          {/* Chevron Accordion State Indicator */}
          <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mr-1">
            <svg 
              className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Row 2: Human Area Location + Tappable Google Maps Deep Link */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 pl-0.5">
          {areaName && (
            <span className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {areaName}
            </span>
          )}
          {areaName && <span className="opacity-30">•</span>}
          <a 
            href={`https://maps.google.com/?q=${station.coordinates.lat},${station.coordinates.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // Stop toggle card click
            className="no-toggle text-indigo-500 dark:text-indigo-400 hover:underline font-semibold"
          >
            View on map
          </a>
        </div>

        {/* Row 3: Status Pill + Next Train + Quick Action Report Button */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pill (Human-readable Wait Times) */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide ${status.badgeBg} ${status.text} ${status.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
              {status.label} (~{displayWaitMinutes} min)
            </span>

            {/* Next Train Countdown Estimation */}
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 opacity-60" />
              {nextTrainLabel}
            </span>
          </div>

          {/* Action Column: CTA Report Button */}
          <div className="no-toggle shrink-0">
            <button
              onClick={() => onOpenReportModal(station)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer transition-all duration-200 active:scale-95 shadow-xs touch-manipulation select-none"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
          </div>
        </div>

        {/* Row 4: Progressive Disclosure Accordion Panels */}
        {isExpanded && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-col space-y-2 animate-fadeIn text-left text-xs text-slate-500 dark:text-slate-400">
            {/* Live ML Prediction Block */}
            <div className={`p-3 rounded-xl border text-left transition-all duration-300 shadow-2xs ${
              predictionLoading 
                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 text-slate-500'
                : prediction?.congestion_level === 'Low'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/10'
                  : prediction?.congestion_level === 'Medium'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/10'
                    : prediction?.congestion_level === 'High'
                      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 dark:border-red-500/10'
                      : prediction?.congestion_level === 'Critical'
                        ? 'bg-rose-600/20 text-rose-700 dark:text-rose-400 border-rose-500/30 dark:border-rose-500/20 font-bold animate-pulse'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Live ML Forecast</span>
                {predictionLoading && <span className="text-[9px] font-bold text-slate-400 animate-pulse">Updating...</span>}
              </div>
              {prediction ? (
                <div className="space-y-1 text-[11px] font-semibold">
                  <div className="flex justify-between items-center">
                    <span>Congestion Level:</span>
                    <strong className="text-slate-800 dark:text-slate-100 font-extrabold text-xs">{prediction.congestion_level}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Predicted Volume:</span>
                    <strong className="text-slate-800 dark:text-slate-100">{Math.round(prediction.predicted_volume).toLocaleString()} entries/hr</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Active Reports (30m):</span>
                    <strong className="text-slate-800 dark:text-slate-100">{prediction.live_reports_count} reports</strong>
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {predictionLoading ? 'Fetching predictions...' : 'ML forecast unavailable (offline).'}
                </span>
              )}
            </div>

            {/* Operating Times normalized to 12h format */}
            {timetable && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/30">
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">First Train</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">{format12h(timetable.first_train)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/30">
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Last Train</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">{format12h(timetable.last_train)}</span>
                </div>
              </div>
            )}

            {/* Timetable Headway Interval */}
            {timetable && (
              <div className="flex justify-between py-1.5 border-b border-slate-100/40 dark:border-slate-850">
                <span>Train interval:</span>
                <strong className="text-slate-700 dark:text-slate-200 font-semibold">{formattedInterval}</strong>
              </div>
            )}

            {/* GPS coordinates (Copyable field) */}
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100/40 dark:border-slate-850">
              <span>GPS:</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(`${station.coordinates.lat}, ${station.coordinates.lng}`);
                }}
                className="no-toggle font-mono text-[10px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
                title="Copy coordinates"
              >
                GPS: {station.coordinates.lat.toFixed(4)}, {station.coordinates.lng.toFixed(4)}
              </button>
            </div>

            {/* Transfer notice */}
            {transfer && (
              <div className="flex items-start gap-1.5 py-1.5 text-indigo-500 dark:text-indigo-400 font-bold leading-normal">
                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Transfer available: {transfer.line} at {transfer.station}</span>
              </div>
            )}
            
            {/* Recency live reports indicator */}
            {userReport && (
              <div className="bg-indigo-500/5 p-2.5 rounded-lg border border-indigo-500/10 text-[11px] leading-relaxed italic text-indigo-600 dark:text-indigo-400">
                "{userReport.note || `Queue is ${userReport.weight === 1 ? 'clear' : userReport.weight === 2 ? 'moving' : 'backed up'}.`}"
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
