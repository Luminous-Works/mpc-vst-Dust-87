import React from 'react';
import { Dices, Play, Repeat, Sparkles, Square } from 'lucide-react';
import type { Dust87Preset } from '../shared/types.ts';
import { MasterOutMeter } from './MasterOutMeter.tsx';
import { TactileKnob } from './TactileKnob.tsx';

interface BottomSeqFxBarProps {
  preset: Dust87Preset;
  seqVisible: boolean;
  seqPlaying: boolean;
  rollDivision: '1/8' | '1/16' | '1/32';
  rollActive: boolean;
  masterDb: number;
  velocityImpulse: number;
  onToggleSeqVisible: () => void;
  onToggleSeqPlay: () => void;
  onRollDown: () => void;
  onRollUp: () => void;
  onCycleRollDivision: () => void;
  onRandomizeKit: () => void;
  onRandomizeSequence: () => void;
  onCycleReverb: () => void;
  onChangePlateMix: (mix: number) => void;
  onChangePlateDecay: (decay: number) => void;
  onChangeMasterDb: (db: number) => void;
}

export const BottomSeqFxBar: React.FC<BottomSeqFxBarProps> = ({
  preset,
  seqVisible,
  seqPlaying,
  rollDivision,
  rollActive,
  masterDb,
  velocityImpulse,
  onToggleSeqVisible,
  onToggleSeqPlay,
  onRollDown,
  onRollUp,
  onCycleRollDivision,
  onRandomizeKit,
  onRandomizeSequence,
  onCycleReverb,
  onChangePlateMix,
  onChangePlateDecay,
  onChangeMasterDb,
}) => {
  const reverbType = preset.fx.plate.type || 'plate';
  const reverbLabel = preset.fx.plate.enabled ? reverbType.toUpperCase() : 'RVB OFF';
  return (
    <footer className="px-3 sm:px-5 py-2.5 border-t border-[#3B4454] bg-gradient-to-b from-[#252B36] to-[#1A1F28] flex flex-wrap items-center justify-between gap-3">
      {/* Left: SEQ 64 + Transport + ROLL + RND */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onToggleSeqVisible}
          className={`min-h-[48px] w-[108px] shrink-0 px-3 rounded-lg border font-mono-tabular text-xs font-bold tracking-wider flex items-center justify-between transition-colors whitespace-nowrap ${
            seqVisible
              ? 'lcd-screen border-[#22D3EE] text-[#22D3EE]'
              : 'alu-button border-[#475569] text-[#E2E8F0] active:border-[#22D3EE]'
          }`}
        >
          <span>SEQ 64</span>
          <span className="text-[10px] opacity-80 w-[26px] text-right">{seqVisible ? 'ON' : 'OFF'}</span>
        </button>

        {seqVisible && (
          <button
            type="button"
            onClick={onToggleSeqPlay}
            aria-label={seqPlaying ? 'Stop Sequencer' : 'Play Sequencer'}
            className={`min-h-[48px] w-[88px] shrink-0 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-mono-tabular text-xs font-bold transition-colors whitespace-nowrap ${
              seqPlaying
                ? 'bg-[#34D399] border-[#6EE7B7] text-[#05080F]'
                : 'alu-button border-[#475569] text-[#F8FAFC]'
            }`}
          >
            {seqPlaying ? <Square className="w-4 h-4 fill-current shrink-0" /> : <Play className="w-4 h-4 fill-current shrink-0" />}
            <span>{seqPlaying ? 'STOP' : 'PLAY'}</span>
          </button>
        )}

        <div className="flex items-center rounded-lg overflow-hidden border border-[#475569] alu-button shrink-0">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onRollDown();
            }}
            onPointerUp={onRollUp}
            onPointerLeave={onRollUp}
            onPointerCancel={onRollUp}
            className={`min-h-[48px] w-[82px] shrink-0 px-2.5 flex items-center justify-center gap-1.5 font-mono-tabular text-xs font-bold touch-none transition-colors whitespace-nowrap ${
              rollActive ? 'bg-[#F5A623] text-[#05080F]' : 'text-[#F8FAFC]'
            }`}
          >
            <Repeat className="w-4 h-4 text-[#F5A623] shrink-0" />
            <span>ROLL</span>
          </button>
          <button
            type="button"
            onClick={onCycleRollDivision}
            aria-label="Change Roll Rate"
            className="min-h-[48px] w-[54px] shrink-0 px-2 border-l border-[#475569] lcd-screen font-mono-tabular text-xs font-bold text-[#FFB938] flex items-center justify-center whitespace-nowrap"
          >
            {rollDivision}
          </button>
        </div>

        <div className="flex items-center rounded-lg overflow-hidden border border-[#475569] alu-button shrink-0">
          <button
            type="button"
            onClick={onRandomizeKit}
            className="min-h-[48px] w-[98px] shrink-0 px-2.5 flex items-center justify-center gap-1.5 font-mono-tabular text-xs font-bold text-[#F8FAFC] active:bg-[#FB7185] active:text-[#05080F] transition-colors whitespace-nowrap"
          >
            <Dices className="w-4 h-4 text-[#FB7185] shrink-0" />
            <span>RND KIT</span>
          </button>
          <button
            type="button"
            onClick={onRandomizeSequence}
            aria-label="Randomize 64-Step Sequence"
            className="min-h-[48px] w-[84px] shrink-0 px-2.5 border-l border-[#475569] lcd-screen font-mono-tabular text-xs font-bold text-[#38BDF8] active:bg-[#38BDF8] active:text-[#05080F] flex items-center justify-center transition-colors whitespace-nowrap"
          >
            RND SEQ
          </button>
        </div>
      </div>

      {/* Right: PLATE Reverb + Master Out with Real-Time Stereo dB Meter */}
      <div className="flex flex-wrap items-center gap-3 ml-auto">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl module-cobalt border border-[#3B69A8]/60">
          <button
            type="button"
            onClick={onCycleReverb}
            aria-label="Cycle Reverb Type (Plate, Room, Hall, Spring, Off)"
            className={`min-h-[48px] w-[108px] shrink-0 px-3 rounded-lg border font-mono-tabular text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              preset.fx.plate.enabled
                ? 'lcd-screen border-[#22D3EE] text-[#22D3EE]'
                : 'alu-button border-[#475569] text-[#94A3B8]'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{reverbLabel}</span>
          </button>

          <TactileKnob
            label="MIX"
            value={preset.fx.plate.mix}
            min={0}
            max={1}
            defaultValue={0.25}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={onChangePlateMix}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="cyan"
          />
          <TactileKnob
            label="DECAY"
            value={preset.fx.plate.decay}
            min={0.3}
            max={5.5}
            defaultValue={1.8}
            formatValue={(v) => `${v.toFixed(1)}s`}
            onChange={onChangePlateDecay}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="cyan"
          />
        </div>

        <MasterOutMeter
          masterDb={masterDb}
          velocityImpulse={velocityImpulse}
          onChangeMasterDb={onChangeMasterDb}
        />
      </div>
    </footer>
  );
};
