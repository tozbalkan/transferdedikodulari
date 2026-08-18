'use client';

export function Header() {
  return (
    <div className="pointer-events-auto hud-header-container bg-[hsla(231,36%,9%,0.88)] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center select-none">
      {/* Galatasaray Crest Emblem Badge */}
      <div className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-[hsl(44,100%,59%)] via-[hsl(350,85%,42%)] to-[hsl(350,90%,25%)] p-[2.5px] shadow-xl flex-shrink-0 flex items-center justify-center">
        <div className="w-full h-full rounded-full bg-[hsl(228,38%,5%)] flex items-center justify-center">
          <span className="font-black text-sm tracking-tighter text-[hsl(44,100%,59%)] font-mono">
            GS
          </span>
        </div>
      </div>

      <div className="flex flex-col">
        {/* Page Category Tag */}
        <span className="text-[11px] font-black tracking-widest text-[hsl(44,100%,59%)] uppercase font-mono leading-none mb-[5px]">
          GALATASARAY
        </span>

        {/* Main Brand Title */}
        <h1 className="text-xl font-black tracking-tight text-white leading-tight mb-[7px]">
          TRANSFER RADAR
        </h1>

        {/* Subtitle */}
        <p className="text-xs text-[hsl(226,16%,60%)] leading-relaxed mb-[9px] hidden sm:block">
          Gerçek haber akışlarından oluşturulan transfer gündemi
        </p>

        {/* Live Status Row */}
        <div className="flex items-center gap-[8px]">
          <span className="flex items-center gap-[6px] text-[11px] font-mono font-bold text-[hsl(0,84%,60%)]">
            <span className="w-2 h-2 rounded-full bg-[hsl(0,84%,60%)] animate-pulse" />
            CANLI VERİ
          </span>
          <span className="text-[11px] text-[hsl(226,16%,60%)] font-mono hidden sm:inline">
            • Son güncelleme: Az önce
          </span>
        </div>
      </div>
    </div>
  );
}
