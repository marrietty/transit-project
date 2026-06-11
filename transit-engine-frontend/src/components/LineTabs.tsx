import React from 'react';
import { Train } from 'lucide-react';

export type RailLine = 'MRT-3' | 'LRT-1' | 'LRT-2';

interface LineTabsProps {
  activeLine: RailLine;
  onChangeLine: (line: RailLine) => void;
  stationCounts: Record<RailLine, number>;
  lineCongestions: Record<RailLine, { label: string; colorClass: string }>;
}

export const LineTabs: React.FC<LineTabsProps> = ({
  activeLine,
  onChangeLine,
  stationCounts,
  lineCongestions,
}) => {
  const tabs: { name: RailLine; label: string; color: string; border: string; text: string; bgActive: string }[] = [
    {
      name: 'LRT-1',
      label: 'LRT-1 Green Line',
      color: 'bg-lrt1',
      border: 'border-lrt1',
      text: 'text-lrt1',
      bgActive: 'bg-lrt1/10 dark:bg-lrt1/20 text-emerald-600 dark:text-emerald-400 border-emerald-500',
    },
    {
      name: 'LRT-2',
      label: 'LRT-2 Purple Line',
      color: 'bg-lrt2',
      border: 'border-lrt2',
      text: 'text-lrt2',
      bgActive: 'bg-lrt2/10 dark:bg-lrt2/20 text-violet-600 dark:text-violet-400 border-violet-500',
    },
    {
      name: 'MRT-3',
      label: 'MRT-3 Yellow Line',
      color: 'bg-mrt3',
      border: 'border-mrt3',
      text: 'text-mrt3',
      bgActive: 'bg-mrt3/10 dark:bg-mrt3/20 text-amber-600 dark:text-amber-400 border-amber-500',
    },
  ];

  return (
    <div className="w-full px-4 mb-4">
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
        {tabs.map((tab) => {
          const isActive = activeLine === tab.name;
          const status = lineCongestions[tab.name];

          return (
            <button
              key={tab.name}
              onClick={() => onChangeLine(tab.name)}
              className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all duration-300 outline-none cursor-pointer border ${
                isActive
                  ? `${tab.bgActive} shadow-xs font-semibold`
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Train className={`w-4 h-4 ${isActive ? '' : 'text-slate-400'}`} />
                <span className="text-sm tracking-wide font-bold">{tab.name}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] opacity-90">
                <span>{stationCounts[tab.name]} Stns</span>
                <span className="opacity-40">•</span>
                <span className={`font-semibold ${status.colorClass}`}>{status.label}</span>
              </div>
              {isActive && (
                <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${tab.color}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
