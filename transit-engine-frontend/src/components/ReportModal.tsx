import React, { useState } from 'react';
import { X, Check, Clock, AlertCircle } from 'lucide-react';

interface Station {
  id: string;
  name: string;
  line: string;
  order: number;
}

interface ReportModalProps {
  station: Station | null;
  onClose: () => void;
  onSubmitReport: (stationId: string, weight: number, minutes: number, note: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  station,
  onClose,
  onSubmitReport,
}) => {
  if (!station) return null;

  const [weight, setWeight] = useState<number>(1); // Default to clear
  const [minutes, setMinutes] = useState<number>(5);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API delay for micro-animation
    setTimeout(() => {
      onSubmitReport(station.id, weight, minutes, note);
      setIsSubmitting(false);
      onClose();
    }, 800);
  };

  const getLineColorClass = (line: string) => {
    switch (line) {
      case 'LRT-1': return 'bg-lrt1';
      case 'LRT-2': return 'bg-lrt2';
      case 'MRT-3': return 'bg-mrt3';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300">
      {/* Background click overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div 
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden transform transition-all duration-300 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Drag Bar for Mobile Look */}
        <div className="flex sm:hidden justify-center py-2">
          <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header content */}
        <div className="flex justify-between items-center px-5 pt-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className={`w-3.5 h-3.5 rounded-full ${getLineColorClass(station.line)}`} />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{station.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{station.line} • Station #{station.order}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Queue Weight Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Queue Congestion</label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Option 1: Clear */}
              <button
                type="button"
                onClick={() => { setWeight(1); setMinutes(5); }}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  weight === 1
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 mb-2" />
                <span className="text-sm">Clear</span>
                <span className="text-[10px] mt-0.5 opacity-75">No line</span>
              </button>

              {/* Option 2: Moderate */}
              <button
                type="button"
                onClick={() => { setWeight(2); setMinutes(15); }}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  weight === 2
                    ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 mb-2" />
                <span className="text-sm">Moderate</span>
                <span className="text-[10px] mt-0.5 opacity-75">5-20 mins</span>
              </button>

              {/* Option 3: Heavy */}
              <button
                type="button"
                onClick={() => { setWeight(3); setMinutes(35); }}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  weight === 3
                    ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 mb-2 status-active-pulse" />
                <span className="text-sm">Heavy</span>
                <span className="text-[10px] mt-0.5 opacity-75">20+ mins</span>
              </button>
            </div>
          </div>

          {/* Wait Time Range */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Est. Waiting Time</label>
              <span className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {minutes} mins
              </span>
            </div>
            <input
              type="range"
              min="2"
              max={weight === 1 ? "10" : weight === 2 ? "30" : "60"}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-800 dark:accent-slate-200"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>Short wait</span>
              <span>Long wait</span>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Station Remarks (Optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Ticket machine offline, escalator broken, queue extends to road level..."
              className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 transition-all placeholder-slate-400 dark:placeholder-slate-600 resize-none"
            />
          </div>

          {/* Humanitarian Disclaimer */}
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
            <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <p>Your report helps thousands of fellow commuters avoid heavy congestion. Please report honestly.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-50 dark:hover:bg-slate-200 dark:text-slate-950 transition-all duration-200 cursor-pointer shadow-md select-none"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Submit Live Report
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
