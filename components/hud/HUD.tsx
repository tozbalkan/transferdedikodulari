'use client';

import { useMemo } from 'react';
import type { Position, TransferRumor, RumorsApiMeta } from '@/types/transfer';
import { Header } from './Header';
import { LiveStats } from './LiveStats';
import { PositionFilters } from './PositionFilters';
import { RumorDetails } from './RumorDetails';
import { ControlsHelp } from './ControlsHelp';
import { AlertCircle, RefreshCw, Radio } from 'lucide-react';

interface HUDProps {
  meta?: RumorsApiMeta;
  rumors: TransferRumor[];
  selectedRumor: TransferRumor | null;
  activePositionFilter: Position | null;
  onPositionChange: (pos: Position | null) => void;
  onSelectRumor: (rumor: TransferRumor | null) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function HUD({
  meta,
  rumors,
  selectedRumor,
  activePositionFilter,
  onPositionChange,
  onSelectRumor,
  isLoading = false,
  error = null,
  onRetry,
}: HUDProps) {
  // Count rumors per position for filter tab badges
  const countsByPosition = useMemo(() => {
    const counts: Record<string, number> = {
      FORWARD: 0,
      MIDFIELDER: 0,
      DEFENDER: 0,
      GOALKEEPER: 0,
    };
    rumors.forEach((r) => {
      if (r.player.position && counts[r.player.position] !== undefined) {
        counts[r.player.position]++;
      }
    });
    return counts;
  }, [rumors]);

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-5 sm:p-6 lg:p-7 select-none">
      {/* ─── Layer 30: Top HUD Navigation Bar ──────────────────────────────── */}
      <div className="z-30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 w-full">
        {/* Left: Branding Header */}
        <Header />

        {/* Center: Position Filter Tabs */}
        <div className="self-center md:self-auto my-1 md:my-0">
          <PositionFilters
            activePosition={activePositionFilter}
            onPositionChange={onPositionChange}
            counts={countsByPosition}
          />
        </div>

        {/* Right: Live Metrics Cards */}
        <LiveStats meta={meta} activeRumorsCount={rumors.length} />
      </div>

      {/* ─── Layer 40: Center Overlays (Loading / Empty / Error) ───────────── */}
      {isLoading ? (
        <div className="z-40 self-center my-auto pointer-events-auto bg-[hsla(231,36%,9%,0.85)] backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3.5 flex items-center gap-3.5 shadow-2xl animate-pulse">
          <RefreshCw className="w-4 h-4 text-[hsl(44,100%,59%)] animate-spin" />
          <div className="text-xs font-bold text-white font-mono tracking-wider">
            CANLI RADAR YÜKLENİYOR...
          </div>
        </div>
      ) : error ? (
        <div className="z-40 self-center my-auto pointer-events-auto bg-[hsla(231,36%,9%,0.95)] backdrop-blur-lg border border-[hsla(350,85%,42%,0.4)] rounded-2xl p-6 max-w-sm text-center space-y-3 shadow-2xl">
          <div className="w-9 h-9 rounded-full bg-[hsla(350,85%,42%,0.15)] border border-[hsla(350,85%,42%,0.3)] text-[hsl(350,85%,42%)] flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold font-mono text-white tracking-wide">CANLI VERİ ALINAMADI</h3>
          <p className="text-[11px] text-[hsl(226,16%,60%)] leading-relaxed">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-[hsl(44,100%,59%)] text-[hsl(228,38%,5%)] font-mono text-xs font-bold hover:bg-[hsla(44,100%,59%,0.9)] transition-all cursor-pointer shadow-lg inline-flex items-center gap-2 mt-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tekrar Dene
            </button>
          )}
        </div>
      ) : rumors.length === 0 ? (
        <div className="z-40 absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none bg-[hsla(222,29%,7%,0.85)] backdrop-blur-md border border-white/10 rounded-full px-5 py-2 flex items-center gap-3 shadow-xl">
          <Radio className="w-3.5 h-3.5 text-[hsl(44,100%,59%)] animate-pulse flex-shrink-0" />
          <span className="text-xs font-mono text-white/90 tracking-wide">
            {meta?.squadStatus && meta.squadStatus !== 'VERIFIED'
              ? 'OYUNCU VERİSİ GEÇİCİ OLARAK DOĞRULANAMIYOR'
              : 'CANLI RADAR AKTİF • Sinyaller taranıyor...'}
          </span>
        </div>
      ) : null}


      {/* ─── Layer 30: Bottom Bar (Controls Help Left) ─────────────────────── */}
      <div className="flex items-end justify-between w-full mt-auto">
        <div className="z-30">
          <ControlsHelp />
        </div>
      </div>

      {/* ─── Layer 50: Floating Detail Drawer (Decoupled & Unclipped) ──────── */}
      <RumorDetails rumor={selectedRumor} onClose={() => onSelectRumor(null)} />
    </div>
  );
}
