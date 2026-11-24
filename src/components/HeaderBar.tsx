import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import type { Dust87Preset, MidiRoutingMode } from '../shared/types.ts';

interface HeaderBarProps {
  preset: Dust87Preset;
  presetIndex: number;
  totalPresets: number;
  bpm: number;
  midiMode: MidiRoutingMode;
  midiDeviceCount: number;
  lastVelocity: number;
  onPrevPreset: () => void;
  onNextPreset: () => void;
  onChangeBpm: (bpm: number) => void;
  onOpenPresets: () => void;
  onOpenMenu: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  preset,
  presetIndex,
  totalPresets,
  bpm,
  midiMode,
  midiDeviceCount,
  lastVelocity,
  onPrevPreset,
  onNextPreset,
  onChangeBpm,
  onOpenPresets,
  onOpenMenu,
}) => {
  const srKhz = Math.round((preset.engine.sr[0] ?? 26000) / 100) / 10;
  const tapTimesRef = React.useRef<number[]>([]);

  const handleTapTempo = () => {
    const now = performance.now();
    const recent = tapTimesRef.current.filter((t) => now - t < 2000);
    recent.push(now);
    tapTimesRef.current = recent.slice(-4);
    if (recent.length >= 2) {
      let sum = 0;
      for (let i = 1; i < recent.length; i++) {
        sum += recent[i] - recent[i - 1];
      }
      const avgMs = sum / (recent.length - 1);
      const tappedBpm = Math.round(60000 / avgMs);
      if (tappedBpm >= 45 && tappedBpm <= 220) {
        onChangeBpm(tappedBpm);
      }
    }
  };

  return (
    <header className="border-b border-[#0E1218] bg-[#222732]">
      {/* Brushed Aluminum Top Nameplate Strip */}
      <div className="aluminum-rail px-3 sm:px-5 py-1 flex items-center justify-between text-[#0F172A]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#334155] shadow-inner" aria-hidden="true" />
          <span className="font-display text-[11px] font-bold tracking-[0.22em] uppercase">
            LUMINA.AEROSPACE // SERIES 1987
          </span>
        </div>
        <div className="text-[10px] font-mono-tabular font-bold tracking-wider uppercase hidden sm:block">
          12-BIT DIGITAL PERCUSSION SAMPLER · {preset.license}
        </div>
        <span className="w-2 h-2 rounded-full bg-[#334155] shadow-inner" aria-hidden="true" />
      </div>

      {/* Main Control & High-Contrast Recessed LCD Row */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 px-3 sm:px-5 py-2.5 bg-gradient-to-b from-[#2A303C] to-[#1D222B]">
        {/* Left: Brand Lockup */}
        <div className="flex items-center gap-3 min-w-0 sm:w-[215px] shrink-0">
          <div className="w-10 h-10 rounded-lg alu-button border border-[#4B5567] flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" fill="#F5A623" />
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" fill="#22D3EE" />
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" fill="#34D399" />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" fill="#FB7185" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="font-display text-lg sm:text-xl font-bold tracking-wider text-[#F8FAFC] whitespace-nowrap drop-shadow-xs">
                DUST &apos;87
              </h1>
              <span className="hidden md:inline text-[11px] font-mono-tabular text-[#94A3B8] whitespace-nowrap">
                {preset.version}
              </span>
            </div>
            <div className="text-[11px] font-mono-tabular text-[#CBD5E1] truncate">
              {midiMode === 'per_voice_channel' ? 'MIDI: Ch 1-12' : 'MIDI: Combo Ch 10'}
              {' · '}
              <span className={midiDeviceCount > 0 ? 'text-[#34D399]' : 'text-[#94A3B8]'}>
                {midiDeviceCount > 0 ? `${midiDeviceCount} In` : 'Touch Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: High-Contrast Backlit LCD Preset Window + Machined Aluminum Scroll Arrows */}
        <div className="flex items-center rounded-xl p-1 bg-[#141820] border border-[#475569]/60 shadow-inner w-full sm:w-[340px] lg:w-[380px] shrink-0">
          <button
            type="button"
            onClick={onPrevPreset}
            aria-label="Previous Kit"
            className="min-h-[48px] min-w-[48px] rounded-lg alu-button border border-[#475569] flex items-center justify-center text-[#F1F5F9] active:border-[#F5A623] active:text-[#F5A623] transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenPresets}
            className="lcd-screen min-h-[48px] mx-1 px-3 rounded-lg flex items-center justify-between gap-2 flex-1 min-w-0 active:ring-1 active:ring-[#F5A623] transition-all"
          >
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular leading-none mb-1">
                <span className="text-[#22D3EE] font-semibold tracking-wider uppercase truncate">
                  {String(presetIndex + 1).padStart(2, '0')}/{totalPresets} ·{' '}
                  {preset.bank_type === 'starter' ? 'STARTER' : preset.bank_type === 'user' ? 'USER' : 'FACTORY'}
                </span>
                <span className="text-[#34D399] hidden sm:inline whitespace-nowrap">
                  {preset.engine.bit}B/{srKhz}k
                </span>
              </div>
              <div className="font-mono-tabular text-sm sm:text-[15px] font-bold text-[#FFB938] truncate leading-tight tracking-wide">
                {preset.name}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#FFB938] shrink-0" />
          </button>

          <button
            type="button"
            onClick={onNextPreset}
            aria-label="Next Kit"
            className="min-h-[48px] min-w-[48px] rounded-lg alu-button border border-[#475569] flex items-center justify-center text-[#F1F5F9] active:border-[#F5A623] active:text-[#F5A623] transition-colors shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Tempo BPM LCD + Velocity Bar + Aluminum Menu Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-xl p-1 bg-[#141820] border border-[#475569]/70 shadow-inner">
            <button
              type="button"
              onClick={() => onChangeBpm(Math.max(45, bpm - 1))}
              aria-label="Decrease Tempo"
              className="min-h-[44px] min-w-[36px] rounded-lg alu-button border border-[#475569] text-sm font-mono-tabular font-bold text-[#F1F5F9] active:border-[#FFB938]"
            >
              -
            </button>
            <button
              type="button"
              onClick={handleTapTempo}
              aria-label="Tempo BPM (Tap for Tap Tempo)"
              title="Tap repeatedly for Tap Tempo"
              className="lcd-screen min-h-[44px] w-[76px] shrink-0 mx-1 px-2 rounded-lg flex flex-col items-center justify-center active:ring-1 active:ring-[#FFB938]"
            >
              <span className="text-[9px] font-mono-tabular text-[#22D3EE] leading-none tracking-wider">
                TEMPO
              </span>
              <span className="text-sm font-mono-tabular font-bold text-[#FFB938] leading-tight whitespace-nowrap">
                {bpm} <span className="text-[10px] text-[#94A3B8]">BPM</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChangeBpm(Math.min(220, bpm + 1))}
              aria-label="Increase Tempo"
              className="min-h-[44px] min-w-[36px] rounded-lg alu-button border border-[#475569] text-sm font-mono-tabular font-bold text-[#F1F5F9] active:border-[#FFB938]"
            >
              +
            </button>
          </div>

          <div className="hidden xl:flex flex-col items-end justify-center px-2.5 py-1.5 rounded-lg lcd-screen border border-[#334155] w-[104px] shrink-0">
            <div className="flex items-center justify-between w-full gap-2 text-[9px] font-mono-tabular text-[#94A3B8]">
              <span>TRIG VEL</span>
              <span className="text-[#22D3EE] font-bold">{lastVelocity}</span>
            </div>
            <div className="w-20 h-2 rounded-xs bg-[#05080F] border border-[#1E293B] overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-[#22D3EE] via-[#F5A623] to-[#FB7185] transition-all duration-75"
                style={{ width: `${Math.round((lastVelocity / 127) * 100)}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open System, MIDI & Workflow Menu"
            className="min-h-[48px] min-w-[48px] sm:w-[96px] shrink-0 px-3.5 rounded-lg alu-button border border-[#475569] active:border-[#F5A623] flex items-center justify-center gap-2 text-[#F8FAFC] transition-colors"
          >
            <Menu className="w-5 h-5 text-[#F5A623]" />
            <span className="hidden sm:inline text-xs font-mono-tabular font-semibold tracking-wider uppercase whitespace-nowrap">
              Menu
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
