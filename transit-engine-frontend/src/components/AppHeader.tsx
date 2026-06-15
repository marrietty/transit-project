// AppHeader.tsx
// Top app bar: wordmark, live PHT clock, and time-period label.

import { useTimeOfDay } from "../hooks/useTimeOfDay";

export default function AppHeader() {
  const { currentTime } = useTimeOfDay();

  const timeStr = currentTime.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <header className="px-4 pt-5 pb-2 flex items-center justify-between">
      {/* Wordmark */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-white font-black text-xl tracking-tight leading-none">
            Transpec
          </span>
        </div>
        <p className="text-white/30 text-[10px] font-mono mt-0.5 uppercase tracking-widest">
          Metro Manila Rail · Live Queue
        </p>
      </div>

      {/* Live time */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-white font-mono font-bold text-base leading-none">
          {timeStr}
        </span>
        <span className="text-white/30 text-[9px] font-mono uppercase tracking-wider leading-none">
          PHT
        </span>
      </div>
    </header>
  );
}