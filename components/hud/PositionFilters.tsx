'use client';

import type { Position } from '@/types/transfer';

interface PositionFiltersProps {
  activePosition: Position | null;
  onPositionChange: (position: Position | null) => void;
  counts?: Record<string, number>;
}

interface FilterTab {
  label: string;
  value: Position | null;
}

const TABS: FilterTab[] = [
  { label: 'TÜMÜ', value: null },
  { label: 'FORVET', value: 'FORWARD' },
  { label: 'ORTA SAHA', value: 'MIDFIELDER' },
  { label: 'DEFANS', value: 'DEFENDER' },
  { label: 'KALECİ', value: 'GOALKEEPER' },
];

export function PositionFilters({ activePosition, onPositionChange }: PositionFiltersProps) {
  return (
    <div className="pointer-events-auto hud-filter-bar flex items-center bg-[hsla(231,36%,9%,0.88)] backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-x-auto max-w-full">
      {TABS.map((tab) => {
        const isActive = activePosition === tab.value;

        return (
          <button
            key={tab.label}
            onClick={() => onPositionChange(tab.value)}
            className={`hud-filter-btn rounded-full text-xs font-black font-mono tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer flex items-center justify-center ${
              isActive
                ? 'bg-[hsl(44,100%,59%)] text-[hsl(228,38%,5%)] shadow-md shadow-[hsla(44,100%,59%,0.25)] scale-100'
                : 'text-[hsl(226,16%,60%)] hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
