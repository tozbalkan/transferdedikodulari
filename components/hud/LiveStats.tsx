'use client';

import type { RumorsApiMeta } from '@/types/transfer';
import { formatNumber } from '@/lib/utils';
import { Globe, Users, Activity } from 'lucide-react';

interface LiveStatsProps {
  meta?: RumorsApiMeta;
  activeRumorsCount: number;
}

export function LiveStats({ meta, activeRumorsCount }: LiveStatsProps) {
  const totalArticles = meta?.totalArticles ?? 0;
  const totalPlayers = meta ? meta.totalPlayers : activeRumorsCount;
  const workingSources = meta?.sourceHealth?.filter((s) => s.success).length ?? 7;

  return (
    <div className="pointer-events-auto flex items-center gap-[10px]">
      {/* Articles Stat Card */}
      <div className="hud-stat-card bg-[hsla(231,36%,9%,0.88)] backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-xl">
        <Globe className="w-4 h-4 text-[hsl(44,100%,59%)] mb-[6px]" />
        <div className="text-lg font-black text-white font-mono leading-none">
          {formatNumber(totalArticles)}
        </div>
        <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider mt-[4px]">
          HABER
        </div>
      </div>

      {/* Players Stat Card */}
      <div className="hud-stat-card bg-[hsla(231,36%,9%,0.88)] backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-xl">
        <Users className="w-4 h-4 text-[hsl(44,100%,59%)] mb-[6px]" />
        <div className="text-lg font-black text-white font-mono leading-none">
          {formatNumber(totalPlayers)}
        </div>
        <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider mt-[4px]">
          OYUNCU
        </div>
      </div>

      {/* Sources Stat Card */}
      <div className="hud-stat-card bg-[hsla(231,36%,9%,0.88)] backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-xl hidden sm:flex">
        <Activity className="w-4 h-4 text-[hsl(44,100%,59%)] mb-[6px]" />
        <div className="text-lg font-black text-white font-mono leading-none">
          {workingSources}
        </div>
        <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider mt-[4px]">
          KAYNAK
        </div>
      </div>
    </div>
  );
}
