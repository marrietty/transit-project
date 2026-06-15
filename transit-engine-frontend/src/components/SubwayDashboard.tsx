import React, { useState } from 'react';
import { 
  Train, 
  Clock, 
  MapPin, 
  ArrowRightLeft, 
  AlertCircle,
  Map,
  CalendarDays
} from 'lucide-react';

// Load parsed GTFS transit data
import subwayData from '../data/manila_subway_data.json';

interface Station {
  id: string;
  sequence: number;
  name: string;
  full_name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  transfer_lines: string[];
  first_train: string;
  last_train: string;
  line_id: string;
}

interface Line {
  id: string;
  name: string;
  full_name: string;
  color: string;
  text_color: string;
  headway: string;
  stations: Station[];
}

interface SubwayData {
  lines: Line[];
}

export const SubwayDashboard: React.FC = () => {
  const { lines } = subwayData as SubwayData;

  // Active state handlers
  const [activeLineId, setActiveLineId] = useState<string>(lines[0].id);
  const [activeStationId, setActiveStationId] = useState<string>(lines[0].stations[0].id);
  const [showHoursOverlay, setShowHoursOverlay] = useState<boolean>(false);

  // Find active line and station details
  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0];
  const activeStation = activeLine.stations.find((s) => s.id === activeStationId) || activeLine.stations[0];

  // Helper for line accent styling
  const getLineAccentColor = (lineName: string): string => {
    switch (lineName) {
      case 'MRT-3': return 'bg-blue-600 border-blue-500 text-blue-400';
      case 'LRT-1': return 'bg-yellow-500 border-yellow-400 text-yellow-400';
      case 'LRT-2': return 'bg-purple-600 border-purple-500 text-purple-400';
      default: return 'bg-zinc-600 border-zinc-500 text-zinc-400';
    }
  };

  const handleLineChange = (lineId: string): void => {
    setActiveLineId(lineId);
    const selectedLine = lines.find((l) => l.id === lineId) || lines[0];
    setActiveStationId(selectedLine.stations[0].id);
    setShowHoursOverlay(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-950 text-slate-100 rounded-3xl overflow-hidden border border-slate-900 shadow-2xl flex flex-col font-sans">
      
      {/* 1. LINE SELECTOR TABS */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-900 bg-slate-950/60 backdrop-blur-md flex gap-2">
        {lines.map((line) => (
          <button
            key={line.id}
            onClick={() => handleLineChange(line.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              activeLineId === line.id
                ? 'bg-slate-100 text-slate-950 scale-105 shadow-md shadow-slate-100/10'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
            }`}
          >
            {line.name}
          </button>
        ))}
      </div>

      {/* 2. STATION DROP-DOWN SELECTOR */}
      <div className="px-5 py-4 border-b border-slate-900/50 bg-slate-950/40 flex justify-between items-center gap-3">
        <label className="text-xs font-black text-slate-500 uppercase tracking-wider shrink-0">Select Station</label>
        <select
          value={activeStationId}
          onChange={(e) => {
            setActiveStationId(e.target.value);
            setShowHoursOverlay(false);
          }}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-700 transition cursor-pointer"
        >
          {activeLine.stations.map((stn) => (
            <option key={stn.id} value={stn.id}>
              {stn.name} (Stop #{stn.sequence})
            </option>
          ))}
        </select>
      </div>

      {/* 3. SUBWAY STATION HERO HEADER */}
      <div className="px-6 py-6 bg-gradient-to-br from-slate-950 to-slate-900 flex flex-col relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            
            {/* Route Full Name Badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              activeLineId === 'lrt1' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
              activeLineId === 'lrt2' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
              'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                activeLineId === 'lrt1' ? 'bg-yellow-400' : activeLineId === 'lrt2' ? 'bg-purple-500' : 'bg-blue-400'
              }`} />
              {activeLine.full_name}
            </span>

            {/* Station Title */}
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">{activeStation.name}</h1>
              <span className="text-xs font-semibold text-slate-500">Stop #{activeStation.sequence}</span>
            </div>

            {/* Coordinate Sublabel */}
            <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <Map className="w-3.5 h-3.5" /> Lat: {activeStation.coordinates.lat.toFixed(4)}, Lng: {activeStation.coordinates.lng.toFixed(4)}
            </p>
          </div>

          {/* Transfers Badge */}
          {activeStation.transfer_lines.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Transfer</span>
              <div className="flex gap-1.5">
                {activeStation.transfer_lines.map((lineName) => (
                  <span
                    key={lineName}
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-black shadow-md border ${
                      getLineAccentColor(lineName)
                    }`}
                  >
                    {lineName.split('-')[0] === 'LRT' ? 'L' + lineName.split('-')[1] : 'M3'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. CONTEXT OPTIONS BAR */}
      <div className="px-6 pb-6 flex flex-wrap gap-2.5">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-900 hover:border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300 font-bold text-xs transition cursor-pointer select-none">
          <MapPin className="w-3.5 h-3.5 text-slate-500" />
          <span>From</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-900 hover:border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300 font-bold text-xs transition cursor-pointer select-none">
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>To</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-900 hover:border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300 font-bold text-xs transition cursor-pointer select-none">
          <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
          <span>Timetable</span>
        </button>
        
        {/* Toggleable First/Last Train Button */}
        <button 
          onClick={() => setShowHoursOverlay(!showHoursOverlay)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer select-none ${
            showHoursOverlay 
              ? 'bg-slate-100 text-slate-950 border-slate-100 shadow-lg' 
              : 'border-slate-900 hover:border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>First/Last Train</span>
        </button>
      </div>

      {/* 5. TIMETABLE OPERATING HOURS OVERLAY */}
      {showHoursOverlay && (
        <div className="px-6 pb-6 animate-fadeIn">
          <div className="bg-slate-900/45 border border-slate-900 rounded-2xl p-4 flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Operating Schedules</span>
              <span className="text-[10px] text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded-md">
                INTERVALS: {activeLine.headway}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* First Train Panel */}
              <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">First Train</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{activeStation.first_train}</span>
                  <span className="text-xs font-bold text-slate-400">AM</span>
                </div>
                <span className="text-[9px] text-slate-600 mt-1">First Scheduled Departure</span>
              </div>
              
              {/* Last Train Panel */}
              <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Train</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{activeStation.last_train}</span>
                  <span className="text-xs font-bold text-slate-400">PM</span>
                </div>
                <span className="text-[9px] text-slate-600 mt-1">Final Scheduled Departure</span>
              </div>
            </div>

            {/* Disclaimer info banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/30 border border-slate-900/40 text-[10px] text-slate-500 leading-normal">
              <AlertCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <p>
                Service hours are extracted directly from the TUMI GTFS database schedule. Real-time delays may influence actual terminal arrival intervals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. BOTTOM SERVICE HEADWAY FOOTER */}
      <div className="px-6 py-4.5 bg-slate-900/20 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Train className="w-3.5 h-3.5 text-slate-600" />
          <span>Typical Headway: <strong className="text-slate-400 font-extrabold">{activeLine.headway}</strong></span>
        </span>
        <span>GTFS DATA SOURCE: TUMI MANILA</span>
      </div>

    </div>
  );
};
