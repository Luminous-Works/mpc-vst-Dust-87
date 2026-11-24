import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Dices, FileMusic, Trash2 } from 'lucide-react';
import type { SequencerPattern, VoiceConfig } from '../shared/types.ts';

interface StepSequencer64Props {
  sequencer: SequencerPattern;
  selectedVoice: VoiceConfig;
  currentStep: number; // 0..63 or -1
  isPlaying: boolean;
  onSelectPad: (pad: number) => void;
  onToggleStep: (pad: number, stepIndex: number) => void;
  onChangeBpm: (bpm: number) => void;
  onChangeSwing: (swing: number) => void;
  onClearPadPattern: (pad: number) => void;
  onOpenGrooves: () => void;
  onRandomizeSequence: () => void;
}

export const StepSequencer64: React.FC<StepSequencer64Props> = ({
  sequencer,
  selectedVoice,
  currentStep,
  isPlaying,
  onSelectPad,
  onToggleStep,
  onChangeBpm,
  onChangeSwing,
  onClearPadPattern,
  onOpenGrooves,
  onRandomizeSequence,
}) => {
  const [activeBar, setActiveBar] = useState(0); // 0..3 (16 steps per bar = 64 steps)
  const padSteps = sequencer.steps[selectedVoice.pad] ?? new Array(64).fill(0);
  const barOffset = activeBar * 16;

  return (
    <section
      aria-label="64-Step Drum Sequencer"
      className="px-3 sm:px-5 py-3 border-t border-[#222733] bg-[#0B0D12]"
    >
      {/* Top Bar: Voice Lane Label (fixed width so BAR buttons never shift), Bar Selector (1-64), BPM & Swing */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-[232px] shrink-0 p-1 rounded-lg bg-[#141821] border border-[#334155] flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectPad(((selectedVoice.pad - 2 + 48) % 48) + 1)}
              aria-label="Previous Voice Lane"
              className="w-[36px] h-[38px] shrink-0 rounded bg-[#1C222E] flex items-center justify-center text-[#E6EAF2] active:text-[#FFB938]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0 px-1.5 py-1 rounded lcd-screen flex items-center justify-center">
              <span className="text-xs font-mono-tabular font-semibold text-[#FFB938] truncate">
                P{String(selectedVoice.pad).padStart(2, '0')} · {selectedVoice.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectPad((selectedVoice.pad % 48) + 1)}
              aria-label="Next Voice Lane"
              className="w-[36px] h-[38px] shrink-0 rounded bg-[#1C222E] flex items-center justify-center text-[#E6EAF2] active:text-[#FFB938]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {[0, 1, 2, 3].map((bar) => {
              const barHasPlayhead = isPlaying && Math.floor(currentStep / 16) === bar;
              return (
                <button
                  key={bar}
                  type="button"
                  onClick={() => setActiveBar(bar)}
                  className={`min-h-[48px] min-w-[62px] px-3 rounded-lg border font-mono-tabular text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    activeBar === bar
                      ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                      : barHasPlayhead
                      ? 'bg-[#171B24] border-[#F5A623]/50 text-[#E6EAF2]'
                      : 'bg-[#141821] border-[#252B37] text-[#8C96A6]'
                  }`}
                >
                  BAR {bar + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#141821] border border-[#252B37] rounded-lg px-2 py-1 min-h-[48px] shrink-0">
            <button
              type="button"
              onClick={() => onChangeBpm(Math.max(50, sequencer.bpm - 2))}
              className="w-[36px] h-[36px] shrink-0 rounded bg-[#1C222E] text-sm font-mono-tabular text-[#E6EAF2]"
            >
              -
            </button>
            <span className="text-xs font-mono-tabular text-[#F5A623] w-[66px] text-center inline-block shrink-0 whitespace-nowrap">
              {sequencer.bpm} BPM
            </span>
            <button
              type="button"
              onClick={() => onChangeBpm(Math.min(200, sequencer.bpm + 2))}
              className="w-[36px] h-[36px] shrink-0 rounded bg-[#1C222E] text-sm font-mono-tabular text-[#E6EAF2]"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#141821] border border-[#252B37] rounded-lg px-3 min-h-[48px] shrink-0">
            <span className="text-[11px] font-mono-tabular text-[#8C96A6] shrink-0">SWING</span>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.02}
              value={sequencer.swing}
              onChange={(e) => onChangeSwing(parseFloat(e.target.value))}
              className="w-20 accent-[#F5A623]"
            />
            <span className="text-xs font-mono-tabular text-[#E6EAF2] w-10 text-right shrink-0">
              {Math.round(sequencer.swing * 100)}%
            </span>
          </div>

          <button
            type="button"
            onClick={onRandomizeSequence}
            aria-label="Randomize 64-Step Sequence"
            className="min-h-[48px] px-3.5 rounded-lg bg-[#211A0E] border border-[#F5A623]/70 active:border-[#F5A623] text-[#F5A623] flex items-center gap-1.5 text-xs font-mono-tabular font-semibold whitespace-nowrap"
          >
            <Dices className="w-4 h-4" />
            <span>RND SEQ</span>
          </button>

          <button
            type="button"
            onClick={onOpenGrooves}
            aria-label="Open Groove Browser and MIDI Importer"
            className="min-h-[48px] px-3.5 rounded-lg bg-[#10202C] border border-[#38BDF8]/70 active:border-[#38BDF8] text-[#38BDF8] flex items-center gap-1.5 text-xs font-mono-tabular font-semibold whitespace-nowrap"
          >
            <FileMusic className="w-4 h-4" />
            <span>GROOVES / .MID</span>
          </button>

          <button
            type="button"
            onClick={() => onClearPadPattern(selectedVoice.pad)}
            aria-label="Clear Voice Pattern"
            className="min-h-[48px] px-3 rounded-lg bg-[#141821] border border-[#252B37] active:border-[#EF4444] text-[#8C96A6] active:text-[#EF4444] flex items-center gap-1.5 text-xs font-mono-tabular"
          >
            <Trash2 className="w-4 h-4" />
            <span>CLEAR</span>
          </button>
        </div>
      </div>

      {/* 16 Steps for Active Bar (Touch-sized 48px+ targets) */}
      <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
        {Array.from({ length: 16 }).map((_, idx) => {
          const stepIdx = barOffset + idx;
          const vel = padSteps[stepIdx] ?? 0;
          const isActive = vel > 0;
          const isPlayhead = isPlaying && currentStep === stepIdx;
          const isBeatDown = idx % 4 === 0;

          return (
            <button
              key={stepIdx}
              type="button"
              onClick={() => onToggleStep(selectedVoice.pad, stepIdx)}
              className={`min-h-[52px] rounded-lg border flex flex-col items-center justify-between p-1.5 transition-colors ${
                isPlayhead
                  ? 'border-[#FFB938] bg-[#2D2210]'
                  : isActive
                  ? 'border-[#F5A623] bg-[#211A0E]'
                  : isBeatDown
                  ? 'border-[#2D3546] bg-[#161B25]'
                  : 'border-[#222834] bg-[#11151D]'
              }`}
            >
              <span className="text-[10px] font-mono-tabular text-[#7A8496]">
                {stepIdx + 1}
              </span>
              <div
                className={`w-full h-2.5 rounded-sm ${
                  isActive ? 'bg-[#F5A623]' : isPlayhead ? 'bg-[#FFB938]/50' : 'bg-[#202633]'
                }`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
};
