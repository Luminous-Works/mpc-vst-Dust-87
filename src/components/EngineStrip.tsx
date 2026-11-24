import React from 'react';
import type { Dust87Preset, FilterType, SampleRateOption } from '../shared/types.ts';
import { TactileKnob } from './TactileKnob.tsx';

interface EngineStripProps {
  preset: Dust87Preset;
  velocityImpulse: number;
  onCycleBit: () => void;
  onCycleSampleRate: () => void;
  onCycleFilterMode: () => void;
  onChangeCutoff: (hz: number) => void;
  onChangeReso: (q: number) => void;
  onChangeDrive: (drive: number) => void;
}

const SR_LABELS: Record<SampleRateOption, string> = {
  11025: '11.0k',
  22050: '22.0k',
  26000: '26.0k',
  44100: '44.1k',
};

const FILTER_LABELS: Record<FilterType, string> = {
  'resonant-lp': 'LP 24dB',
  'resonant-bp': 'BP 12dB',
  'hp-clean': 'HP 12dB',
};

export const EngineStrip: React.FC<EngineStripProps> = ({
  preset,
  velocityImpulse,
  onCycleBit,
  onCycleSampleRate,
  onCycleFilterMode,
  onChangeCutoff,
  onChangeReso,
  onChangeDrive,
}) => {
  const currentSr = (preset.engine.sr[0] ?? 26000) as SampleRateOption;

  return (
    <section
      aria-label="12-Bit Engine Controls"
      className="mx-2 sm:mx-4 mt-2.5 rounded-xl module-cobalt border border-[#3B69A8]/60 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
    >
      {/* Left: High-Contrast LCD Selectors inside Cobalt Steel Bay */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={onCycleBit}
          className="min-h-[48px] w-[96px] shrink-0 px-3 rounded-lg lcd-screen border border-[#475569]/70 active:border-[#F5A623] flex flex-col justify-center items-start transition-colors"
        >
          <span className="text-[9px] font-mono-tabular text-[#94A3B8] uppercase leading-none mb-1 whitespace-nowrap">
            Quantizer
          </span>
          <span className="w-full flex items-center justify-between text-sm font-mono-tabular font-bold text-[#FFB938] leading-none whitespace-nowrap">
            <span>{preset.engine.bit}-BIT</span>
            <span>▾</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onCycleSampleRate}
          className="min-h-[48px] w-[104px] shrink-0 px-3 rounded-lg lcd-screen border border-[#475569]/70 active:border-[#22D3EE] flex flex-col justify-center items-start transition-colors"
        >
          <span className="text-[9px] font-mono-tabular text-[#94A3B8] uppercase leading-none mb-1 whitespace-nowrap">
            Sample Clock
          </span>
          <span className="w-full flex items-center justify-between text-sm font-mono-tabular font-bold text-[#22D3EE] leading-none whitespace-nowrap">
            <span>{SR_LABELS[currentSr] ?? `${Math.round(currentSr / 1000)}k`}</span>
            <span>▾</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onCycleFilterMode}
          className="min-h-[48px] w-[108px] shrink-0 px-3 rounded-lg lcd-screen border border-[#475569]/70 active:border-[#34D399] flex flex-col justify-center items-start transition-colors"
        >
          <span className="text-[9px] font-mono-tabular text-[#94A3B8] uppercase leading-none mb-1 whitespace-nowrap">
            Filter Slope
          </span>
          <span className="w-full flex items-center justify-between text-sm font-mono-tabular font-bold text-[#34D399] leading-none whitespace-nowrap">
            <span>{FILTER_LABELS[preset.engine.filter]}</span>
            <span>▾</span>
          </span>
        </button>
      </div>

      {/* Right: Brushed Aluminum Knobs with Color-Coded Value Arcs */}
      <div className="flex items-center gap-4 sm:gap-6 ml-auto">
        <TactileKnob
          label="FLT CUT"
          value={preset.engine.filter_cutoff}
          min={180}
          max={18000}
          defaultValue={11500}
          logarithmic
          formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}Hz`)}
          onChange={onChangeCutoff}
          velocityImpulse={velocityImpulse}
          size="sm"
          accent="cyan"
        />
        <TactileKnob
          label="RESO"
          value={preset.engine.filter_reso}
          min={0.5}
          max={12}
          defaultValue={1.4}
          formatValue={(v) => `${v.toFixed(1)}Q`}
          onChange={onChangeReso}
          velocityImpulse={velocityImpulse}
          size="sm"
          accent="emerald"
        />
        <TactileKnob
          label="DRIVE"
          value={preset.engine.drive}
          min={0}
          max={1}
          defaultValue={0.35}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={onChangeDrive}
          velocityImpulse={velocityImpulse}
          size="sm"
          accent="crimson"
        />
      </div>
    </section>
  );
};
