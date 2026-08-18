'use client';

import { MousePointer, ZoomIn, Hand, RotateCcw } from 'lucide-react';

export function ControlsHelp() {
  return (
    <div className="pointer-events-auto hud-controls-panel bg-[hsla(231,36%,9%,0.88)] backdrop-blur-xl border border-white/10 rounded-2xl space-y-[9px] shadow-2xl text-xs font-mono text-[hsl(226,16%,60%)] select-none max-w-[230px] hidden sm:block">
      <div className="flex items-center gap-[9px]">
        <Hand className="w-4 h-4 text-[hsl(44,100%,59%)] flex-shrink-0" />
        <span className="text-white/90 leading-tight">Fare ile döndür</span>
      </div>
      <div className="flex items-center gap-[9px]">
        <ZoomIn className="w-4 h-4 text-[hsl(44,100%,59%)] flex-shrink-0" />
        <span className="text-white/90 leading-tight">Yakınlaş / Uzaklaş</span>
      </div>
      <div className="flex items-center gap-[9px]">
        <MousePointer className="w-4 h-4 text-[hsl(44,100%,59%)] flex-shrink-0" />
        <span className="text-white/90 leading-tight">Oyuncuya tıkla</span>
      </div>
      <div className="flex items-center gap-[9px] pt-[8px] border-t border-white/10 text-[10px] text-[hsl(226,16%,60%)]">
        <RotateCcw className="w-3.5 h-3.5 text-[hsl(226,16%,60%)] flex-shrink-0" />
        <span className="leading-tight">Boş alan: Seçimi kaldır</span>
      </div>
    </div>
  );
}
