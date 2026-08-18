'use client';

import type { RumorSourceInfo, SourceDistribution } from '@/types/transfer';

interface SourceListProps {
  distribution?: SourceDistribution;
  sources: RumorSourceInfo[];
}

export function SourceList({ sources }: SourceListProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[hsl(226,16%,60%)]">
        Haber Kaynakları ({sources.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src) => (
          <div
            key={src.name}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[hsl(230,35%,13%)] border border-white/5 text-[11px] font-mono text-[hsl(240,20%,93%)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(44,100%,59%)]" />
            <span className="font-semibold">{src.name}</span>
            <span className="text-[hsl(226,16%,60%)]">({src.articleCount})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
