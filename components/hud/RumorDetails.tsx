'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { TransferRumor } from '@/types/transfer';
import { formatDate } from '@/lib/utils';
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface RumorDetailsProps {
  rumor: TransferRumor | null;
  onClose: () => void;
}

export function RumorDetails({ rumor, onClose }: RumorDetailsProps) {
  return (
    <AnimatePresence>
      {rumor && (
        <motion.div
          key={rumor.player.id}
          initial={{ opacity: 0, x: 50, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.98 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 lg:bottom-7 lg:right-7 pointer-events-auto z-50 rumor-details-shell max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] flex flex-col bg-[hsla(231,36%,9%,0.96)] backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden select-none"
        >
          {/* Content Wrapper (24px 26px Guaranteed Padding) */}
          <div className="rumor-details-content flex flex-col flex-1 overflow-hidden relative">
            {/* ─── 1. Header (Name, Club/Position & Close Button) ─────────── */}
            <div className="pb-[18px] mb-[18px] border-b border-white/10 pr-[40px] relative flex-shrink-0">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase leading-tight truncate">
                {rumor.player.name}
              </h3>
              <div className="flex items-center gap-[8px] mt-[6px]">
                <span className="text-xs font-semibold text-[hsl(226,16%,60%)]">
                  {rumor.player.currentClub}
                </span>
                <span className="text-white/30">•</span>
                <span className="px-[8px] py-[2px] rounded-md text-[10px] font-black font-mono bg-[hsl(44,100%,59%)] text-[hsl(228,38%,5%)] tracking-wider">
                  {rumor.player.position}
                </span>
              </div>

              {/* Close Button with Safe Clearance */}
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-[hsl(226,16%,60%)] hover:text-white transition-colors cursor-pointer flex-shrink-0 absolute top-0 right-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ─── 2. Scrollable Body Content (Sections separated with 18px gaps) ─ */}
            <div className="space-y-[18px] overflow-y-auto custom-scrollbar flex-1 pr-[4px]">
              {/* ─── 2.1 KPI Section: Mentions & Trend (28px Column Gap) ─────── */}
              <div className="grid grid-cols-2 gap-[28px] py-[4px]">
                {/* Mentions */}
                <div>
                  <div className="text-3xl font-black font-mono text-white leading-none">
                    {rumor.mentionCount}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider mt-[4px]">
                    MENTIONS
                  </div>
                </div>

                {/* Trend */}
                <div>
                  <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider">
                    TREND
                  </div>
                  <div className="flex items-center gap-[6px] font-mono text-lg font-black mt-[4px]">
                    {rumor.trend === 'UP' && (
                      <span className="text-[hsl(160,84%,65%)] flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> +{rumor.trendPercentage}%
                      </span>
                    )}
                    {rumor.trend === 'DOWN' && (
                      <span className="text-[hsl(0,84%,65%)] flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" /> {rumor.trendPercentage}%
                      </span>
                    )}
                    {rumor.trend === 'NEUTRAL' && (
                      <span className="text-[hsl(226,16%,60%)] flex items-center gap-1">
                        <Minus className="w-4 h-4" /> Nötr
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[hsl(226,16%,60%)] font-mono mt-[4px]">Bu hafta</div>
                </div>
              </div>

              {/* ─── 2.2 Confidence Metric Section ───────────────────────────── */}
              <div className="pt-[16px] border-t border-white/10 flex items-center justify-between gap-[16px]">
                <div className="flex-1">
                  <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider">
                    CONFIDENCE
                  </div>
                  <div className="text-xs text-[hsl(226,16%,60%)] mt-[4px] leading-relaxed">
                    Haber güven skoru
                  </div>
                </div>

                <div className="relative flex items-center justify-center w-14 h-14 flex-shrink-0 mr-[4px]">
                  <svg className="w-14 h-14 transform -rotate-90">
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      className="text-white/10"
                      fill="transparent"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      className="text-[hsl(44,100%,59%)]"
                      fill="transparent"
                      strokeDasharray="138"
                      strokeDashoffset={138 - 138 * (rumor.confidenceScore ?? 0.86)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-mono font-black text-xs sm:text-sm text-white">
                    {Math.round((rumor.confidenceScore ?? 0.86) * 100)}%
                  </span>
                </div>
              </div>

              {/* ─── 2.3 Kaynak Dağılımı ─────────────────────────────────────── */}
              <div className="pt-[16px] border-t border-white/10 space-y-[10px]">
                <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider">
                  KAYNAK DAĞILIMI
                </div>
                <div className="grid grid-cols-2 gap-x-[24px] gap-y-[10px] text-xs font-mono">
                  <div className="flex items-center justify-between pr-[4px]">
                    <span className="flex items-center gap-[7px] text-white/90">
                      <span className="w-2 h-2 rounded-full bg-[hsl(44,100%,59%)] flex-shrink-0" />
                      RSS
                    </span>
                    <span className="font-bold text-white">
                      {rumor.sourceDistribution?.rss || rumor.sources.length || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-[7px] text-white/90">
                      <span className="w-2 h-2 rounded-full bg-[hsl(28,100%,50%)] flex-shrink-0" />
                      PRESS
                    </span>
                    <span className="font-bold text-white">
                      {rumor.sourceDistribution?.press || rumor.uniqueArticleCount || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pr-[4px]">
                    <span className="flex items-center gap-[7px] text-white/90">
                      <span className="w-2 h-2 rounded-full bg-[hsl(350,85%,42%)] flex-shrink-0" />X
                    </span>
                    <span className="font-bold text-white">{rumor.sourceDistribution?.x || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-[7px] text-white/90">
                      <span className="w-2 h-2 rounded-full bg-[hsl(217,91%,60%)] flex-shrink-0" />
                      DİĞER
                    </span>
                    <span className="font-bold text-white">
                      {rumor.sourceDistribution?.forum || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── 2.4 Son Haberler Akışı ──────────────────────────────────── */}
              {rumor.latestNews && rumor.latestNews.length > 0 && (
                <div className="pt-[16px] border-t border-white/10 space-y-[10px]">
                  <div className="text-[10px] font-mono font-bold text-[hsl(226,16%,60%)] uppercase tracking-wider">
                    SON HABERLER
                  </div>

                  <div className="space-y-[8px]">
                    {rumor.latestNews.slice(0, 4).map((news) => (
                      <a
                        key={news.id}
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-[10px] news-card-item bg-[hsla(230,35%,13%,0.6)] hover:bg-[hsl(230,35%,13%)] border border-white/5 hover:border-[hsla(44,100%,59%,0.4)] transition-all"
                      >
                        <div className="w-[32px] h-[32px] rounded-lg bg-[hsla(44,100%,59%,0.12)] border border-[hsla(44,100%,59%,0.25)] flex items-center justify-center flex-shrink-0 mt-[2px]">
                          <span className="text-[10px] font-black text-[hsl(44,100%,59%)] font-mono">
                            {news.source.slice(0, 2).toUpperCase()}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white/95 group-hover:text-[hsl(44,100%,59%)] line-clamp-2 transition-colors leading-[1.35]">
                            {news.title}
                          </h4>
                          <div className="flex items-center justify-between mt-[5px] text-[10px] font-mono text-[hsl(226,16%,60%)]">
                            <span>{news.source}</span>
                            <span>{formatDate(news.publishedAt)}</span>
                          </div>
                        </div>

                        <ExternalLink className="w-3.5 h-3.5 text-[hsl(226,16%,60%)] group-hover:text-[hsl(44,100%,59%)] flex-shrink-0 opacity-60 mt-[3px] ml-[6px]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
