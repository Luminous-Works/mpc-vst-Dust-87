import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, VolumeX } from 'lucide-react';
import type { DrumSynthModel, VelocityCurveMode, VoiceConfig } from '../shared/types.ts';

interface PadGridProps {
  voices: VoiceConfig[];
  activeBank: number; // 0..3 (A..D)
  selectedPad: number;
  padHits: Record<number, { velocity: number; ts: number }>;
  velocityCurve: VelocityCurveMode;
  simulatedVelocity: number;
  onChangeBank: (bank: number) => void;
  onTriggerPad: (padNumber: number, velocity: number) => void;
  onOpenPadContext: (padNumber: number) => void;
}

const BANK_NAMES = ['BANK A', 'BANK B', 'BANK C', 'BANK D'];
const KEY_HINTS = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];

function getPadCategoryAccent(model: DrumSynthModel): {
  main: string;
  glow: string;
  tintBg: string;
} {
  if (model.startsWith('kick')) {
    return { main: '#FB7185', glow: 'rgba(251, 113, 133, 0.45)', tintBg: 'rgba(251, 113, 133, 0.14)' };
  }
  if (model.startsWith('snare') || model === 'rim_87' || model === 'clap_87') {
    return { main: '#F5A623', glow: 'rgba(245, 166, 35, 0.45)', tintBg: 'rgba(245, 166, 35, 0.14)' };
  }
  if (model.startsWith('hat') || model.startsWith('crash') || model.startsWith('ride')) {
    return { main: '#22D3EE', glow: 'rgba(34, 211, 238, 0.45)', tintBg: 'rgba(34, 211, 238, 0.14)' };
  }
  if (model.startsWith('tom')) {
    return { main: '#34D399', glow: 'rgba(52, 211, 153, 0.45)', tintBg: 'rgba(52, 211, 153, 0.14)' };
  }
  return { main: '#A78BFA', glow: 'rgba(167, 139, 250, 0.45)', tintBg: 'rgba(167, 139, 250, 0.14)' };
}

export const PadGrid: React.FC<PadGridProps> = ({
  voices,
  activeBank,
  selectedPad,
  padHits,
  velocityCurve,
  simulatedVelocity,
  onChangeBank,
  onTriggerPad,
  onOpenPadContext,
}) => {
  const [holdingPad, setHoldingPad] = useState<number | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swiped = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const holdFired = useRef(false);
  const pointerTriggered = useRef(false);

  const bankStartPad = activeBank * 12 + 1;
  const bankVoices = voices.filter((v) => v.pad >= bankStartPad && v.pad < bankStartPad + 12);
  const anySolo = voices.some((v) => v.solo);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldingPad(null);
  };

  const computeVelocity = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (velocityCurve === 'fixed_127') return 127;
    if (e.pointerType === 'mouse' && velocityCurve === 'touch_y') {
      const rect = e.currentTarget.getBoundingClientRect();
      const relY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      return Math.round(48 + relY * 79);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    let raw = 42 + relY * 85;
    if (velocityCurve === 'soft_log') raw = Math.pow(raw / 127, 0.7) * 127;
    if (velocityCurve === 'hard_exp') raw = Math.pow(raw / 127, 1.35) * 127;
    return Math.max(24, Math.min(127, Math.round((raw + simulatedVelocity) * 0.5)));
  };

  return (
    <section
      aria-label="4x3 MPC Touch Pad Grid"
      className="mx-2 sm:mx-4 my-2.5 rounded-xl module-gunmetal border border-[#475569]/60 p-3 flex-1 flex flex-col justify-center"
    >
      {/* Bank Selector & Swipe Hint Strip */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {BANK_NAMES.map((bName, idx) => (
            <button
              key={bName}
              type="button"
              onClick={() => onChangeBank(idx)}
              className={`min-h-[48px] px-3 sm:px-4 rounded-lg text-xs font-mono-tabular font-bold tracking-wider border transition-colors whitespace-nowrap ${
                activeBank === idx
                  ? 'lcd-screen border-[#F5A623] text-[#FFB938]'
                  : 'alu-button border-[#475569] text-[#E2E8F0] active:border-[#F5A623]'
              }`}
            >
              {bName}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono-tabular text-[#CBD5E1]">
          <button
            type="button"
            onClick={() => onChangeBank((activeBank + 3) % 4)}
            aria-label="Previous Bank"
            className="min-h-[48px] min-w-[48px] rounded-lg alu-button border border-[#475569] flex items-center justify-center active:border-[#F5A623]"
          >
            <ChevronLeft className="w-4 h-4 text-[#F8FAFC]" />
          </button>
          <span className="whitespace-nowrap">Tap = Hit · Hold = Menu · Swipe = Bank</span>
          <button
            type="button"
            onClick={() => onChangeBank((activeBank + 1) % 4)}
            aria-label="Next Bank"
            className="min-h-[48px] min-w-[48px] rounded-lg alu-button border border-[#475569] flex items-center justify-center active:border-[#F5A623]"
          >
            <ChevronRight className="w-4 h-4 text-[#F8FAFC]" />
          </button>
        </div>
      </div>

      {/* 4x3 Classic Grid with Color-Coded Drum Category Rings */}
      <div
        onPointerDown={(e) => {
          swipeStartX.current = e.clientX;
          swipeStartY.current = e.clientY;
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          if (swipeStartX.current === null || swipeStartY.current === null) return;
          const dx = e.clientX - swipeStartX.current;
          const dy = e.clientY - swipeStartY.current;
          if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.4 && !swiped.current) {
            swiped.current = true;
            clearHold();
            if (dx < 0) {
              onChangeBank((activeBank + 1) % 4);
            } else {
              onChangeBank((activeBank + 3) % 4);
            }
          }
        }}
        onPointerUp={() => {
          swipeStartX.current = null;
          swipeStartY.current = null;
        }}
        className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3 touch-pan-y select-none"
      >
        {bankVoices.map((voice, idx) => {
          const isSelected = selectedPad === voice.pad;
          const hit = padHits[voice.pad];
          const isFlashing = Boolean(hit && performance.now() - hit.ts < 170);
          const isMuted = voice.mute || (anySolo && !voice.solo);
          const isHolding = holdingPad === voice.pad;
          const catColor = getPadCategoryAccent(voice.synth_model);

          return (
            <button
              key={voice.pad}
              type="button"
              onContextMenu={(e) => {
                e.preventDefault();
              }}
              onPointerDown={(e) => {
                holdFired.current = false;
                pointerTriggered.current = true;
                setHoldingPad(voice.pad);
                const vel = computeVelocity(e);

                if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
                holdTimer.current = window.setTimeout(() => {
                  holdFired.current = true;
                  setHoldingPad(null);
                  onOpenPadContext(voice.pad);
                }, 420);

                onTriggerPad(voice.pad, vel);
              }}
              onClick={() => {
                if (pointerTriggered.current) {
                  pointerTriggered.current = false;
                  return;
                }
                if (!holdFired.current) {
                  onTriggerPad(voice.pad, simulatedVelocity);
                }
              }}
              onPointerUp={() => {
                clearHold();
              }}
              onPointerLeave={() => {
                clearHold();
              }}
              onPointerCancel={() => {
                clearHold();
              }}
              style={{
                borderColor: isFlashing || isSelected ? catColor.main : '#3B4454',
                background: isFlashing
                  ? `linear-gradient(180deg, ${catColor.tintBg}, #181C26)`
                  : undefined,
                boxShadow: isFlashing
                  ? `0 0 18px ${catColor.glow}, inset 0 1px 0 rgba(255,255,255,0.22)`
                  : isSelected
                  ? `0 0 8px ${catColor.glow}`
                  : undefined,
              }}
              className={`relative min-h-[86px] sm:min-h-[100px] rounded-xl p-3 flex flex-col justify-between text-left border-2 hardware-pad transition-colors duration-75 ${
                isMuted ? 'opacity-50' : ''
              }`}
            >
              {/* Top Row: Category LED + Pad # + MIDI Channel / Note */}
              <div className="flex items-center justify-between gap-1 w-full">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: catColor.main,
                      boxShadow: `0 0 6px ${catColor.main}`,
                    }}
                  />
                  <span
                    className="text-xs font-mono-tabular font-bold"
                    style={{ color: isSelected || isFlashing ? catColor.main : '#CBD5E1' }}
                  >
                    P{String(voice.pad).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono-tabular text-[#94A3B8]">
                  {voice.mute && <VolumeX className="w-3.5 h-3.5 text-[#EF4444]" />}
                  {voice.solo && <span className="text-[#F5A623] font-bold">SOLO</span>}
                  {voice.choke_group > 0 && <span>C{voice.choke_group}</span>}
                  <span>CH{voice.midi_channel}</span>
                </div>
              </div>

              {/* Center: Voice Name */}
              <div className="my-1">
                <div className="font-display text-sm sm:text-base font-bold tracking-wide text-[#F8FAFC] truncate">
                  {voice.name}
                </div>
                <div className="text-[10px] font-mono-tabular text-[#94A3B8]">
                  N{voice.note} · Key {KEY_HINTS[idx]}
                </div>
              </div>

              {/* Bottom: Color-Coded Velocity Impact LED Strip */}
              <div className="w-full h-1.5 rounded-full bg-[#07090D] border border-[#1E293B] overflow-hidden">
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    backgroundColor: catColor.main,
                    width:
                      isFlashing && hit
                        ? `${Math.round((hit.velocity / 127) * 100)}%`
                        : isSelected
                        ? '35%'
                        : '12%',
                    opacity: isFlashing ? 1 : isSelected ? 0.8 : 0.35,
                  }}
                />
              </div>

              {isHolding && (
                <div
                  className="absolute inset-0 rounded-xl border-2 pointer-events-none animate-pulse"
                  style={{ borderColor: catColor.main }}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
