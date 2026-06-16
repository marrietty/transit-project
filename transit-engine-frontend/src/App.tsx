import { useState, useEffect } from 'react';
import stationsData from './data/stations.json';
import { LineTabs } from './components/LineTabs';
import type { RailLine } from './components/LineTabs';
import { DashboardStats } from './components/DashboardStats';
import { Timeline } from './components/Timeline';
import { ReportModal } from './components/ReportModal';
import type { Station, UserReport } from './components/StationRow';
import { Info, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import AppHeader from "./components/AppHeader";


export default function App() {
  const [activeLine, setActiveLine] = useState<RailLine>('MRT-3');
  const [activePeriod, setActivePeriod] = useState<'morning_peak' | 'off_peak' | 'evening_peak'>('morning_peak');
  const [userReports, setUserReports] = useState<Record<string, UserReport>>({});
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Real-time crowd forecasting states fed from FastAPI model
  const [prediction, setPrediction] = useState<{
    congestion_level: string;
    predicted_volume: number;
    live_reports_count: number;
  } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState<boolean>(false);

  // Monitor network status for PWA UX
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for period based on real local time if appropriate
    const currentHour = new Date().getHours();
    if (currentHour >= 6 && currentHour < 9) {
      setActivePeriod('morning_peak');
    } else if (currentHour >= 17 && currentHour < 21) {
      setActivePeriod('evening_peak');
    } else {
      setActivePeriod('off_peak');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch real-time predictions from the FastAPI regression model when selectedStation changes
  useEffect(() => {
    if (!selectedStation) {
      setPrediction(null);
      return;
    }

    setPredictionLoading(true);
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const backendUrl = `${apiBaseUrl}/api/status/${selectedStation.id}`;

    fetch(backendUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Backend error or model not loaded.');
        }
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
        console.error('Error fetching prediction:', err);
        showToast('Offline or ML backend unreachable.');
      })
      .finally(() => {
        setPredictionLoading(false);
      });
  }, [selectedStation]);

  // Show status toasts
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Handle report submission
  const handleSubmitReport = (stationId: string, weight: number, minutes: number, note: string) => {
    const stationName = stationsData.find((s) => s.id === stationId)?.name || 'Station';
    
    setUserReports((prev) => ({
      ...prev,
      [stationId]: {
        weight,
        minutes,
        note,
        timestamp: new Date(),
      },
    }));

    const statusLabel = weight === 3 ? 'Heavy' : weight === 2 ? 'Moderate' : 'Clear';
    showToast(`Submitted: ${stationName} is currently ${statusLabel} (${minutes}m wait)`);
  };

  // Station counts per line
  const stationCounts: Record<RailLine, number> = {
    'LRT-1': stationsData.filter((s) => s.line === 'LRT-1').length,
    'LRT-2': stationsData.filter((s) => s.line === 'LRT-2').length,
    'MRT-3': stationsData.filter((s) => s.line === 'MRT-3').length,
  };

  // Get active line average congestion
  const getLineCongestionStatus = (line: RailLine) => {
    const lineStns = stationsData.filter((s) => s.line === line);
    let totalWeight = 0;

    lineStns.forEach((stn) => {
      const report = userReports[stn.id];
      const isRecent = report && (new Date().getTime() - report.timestamp.getTime()) < 15 * 60 * 1000;
      totalWeight += isRecent ? report.weight : stn.historical_baseline[activePeriod];
    });

    const average = totalWeight / (lineStns.length || 1);

    if (average >= 2.3) {
      return { label: 'High Congest', colorClass: 'text-red-500 font-bold' };
    } else if (average >= 1.6) {
      return { label: 'Moderate', colorClass: 'text-amber-500 font-semibold' };
    } else {
      return { label: 'Clear Flow', colorClass: 'text-emerald-500 font-semibold' };
    }
  };

  const lineCongestions: Record<RailLine, { label: string; colorClass: string }> = {
    'LRT-1': getLineCongestionStatus('LRT-1'),
    'LRT-2': getLineCongestionStatus('LRT-2'),
    'MRT-3': getLineCongestionStatus('MRT-3'),
  };

  // Setup mock data refresh to simulate other commuters submitting reports
  const handleSimulateCrowdsourcing = () => {
    // Pick 3 random stations on active line and submit a moderate or heavy report
    const lineStns = stationsData.filter((s) => s.line === activeLine);
    const shuffled = [...lineStns].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);

    setSelectedStation(null); // Close modal if open

    setSelectedStation(null);
    setUserReports((prev) => {
      const updated = { ...prev };
      selected.forEach((stn) => {
        const weight = Math.random() > 0.45 ? 3 : 2;
        const minutes = weight === 3 ? 30 : 15;
        updated[stn.id] = {
          weight,
          minutes,
          note: weight === 3 ? 'Crowd packing the stairs, slow boarding' : 'Average crowd on platform',
          timestamp: new Date(),
        };
      });
      return updated;
    });

    showToast('Loaded crowdsourced commuter updates on ' + activeLine);
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      
      {/* Top Banner: Connection status & Crowdsource simulation button */}
      <div className="w-full bg-slate-900 text-slate-100 text-xs px-4 py-2 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-1.5 font-semibold">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi className="w-3.5 h-3.5" />
              <span>Connected (PWA Live)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>Offline Mode (Cached Baselines)</span>
            </span>
          )}
        </div>
        
        <button
          onClick={handleSimulateCrowdsourcing}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Simulate Commuter Feeds</span>
        </button>
      </div>

      {/* Main app boundary */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-white dark:bg-[#0b101c] shadow-xl relative min-h-full border-x border-slate-100 dark:border-slate-900">
        
        {/* Top App Header */}
        <AppHeader />
        
        {/* Dynamic header cards */}
        <DashboardStats
          activeLine={activeLine}
          stations={stationsData}
          activePeriod={activePeriod}
          onPeriodChange={setActivePeriod}
          userReports={userReports}
        />

        {/* Brand tab selector */}
        <LineTabs
          activeLine={activeLine}
          onChangeLine={setActiveLine}
          stationCounts={stationCounts}
          lineCongestions={lineCongestions}
        />

        {/* Dynamic ML Prediction Card */}
        {selectedStation && (
          <div className="px-4 py-2">
            <div className={`p-4 rounded-2xl border text-left transition-all duration-300 shadow-xs ${
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
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">ML Crowd Forecasting Model</span>
                  <h4 className="font-extrabold text-base tracking-tight text-slate-800 dark:text-slate-200">
                    {selectedStation.name} Status
                  </h4>
                </div>
                <button 
                  onClick={() => setSelectedStation(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Clear
                </button>
              </div>

              {predictionLoading ? (
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium animate-pulse">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Updating crowd predictions...</span>
                </div>
              ) : prediction ? (
                <div className="mt-3.5 space-y-2 text-xs font-semibold">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/50 dark:border-slate-800/30">
                    <span className="opacity-80">Congestion Level:</span>
                    <span className="font-extrabold text-sm">{prediction.congestion_level}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/50 dark:border-slate-800/30">
                    <span className="opacity-80">Predicted Passenger Flow:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {Math.round(prediction.predicted_volume).toLocaleString()} entries/hr
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="opacity-80">Live Crowd Reports (past 30m):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {prediction.live_reports_count} reports
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-red-500 font-medium">
                  Failed to fetch status prediction.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rails Vertical Timeline */}
        <Timeline
          stations={stationsData}
          activeLine={activeLine}
          activePeriod={activePeriod}
          userReports={userReports}
          onOpenReportModal={setSelectedStation}
          isOnline={isOnline}
        />

        {/* Bottom PWA Info Panel */}
        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/5 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-3 flex items-start gap-2.5">
          <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-left">
            <span className="font-bold text-slate-700 dark:text-slate-200">Lightweight Offline Support:</span> This app uses client-cached baselines. You can view lines, search stations, and formulate reports even without internet access.
          </div>
        </div>

      </div>

      {/* Crowdsource Reporting Drawer/Modal */}
      <ReportModal
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
        onSubmitReport={handleSubmitReport}
      />

      {/* Global Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold border border-slate-800 dark:border-slate-200 animate-bounce">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
