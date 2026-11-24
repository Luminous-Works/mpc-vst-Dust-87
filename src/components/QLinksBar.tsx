import React, { useRef, useState } from 'react';
import type { QLinkParamId } from '../shared/types.ts';

export interface QLinkSlotState {
  index: number;
  param: QLinkParamId;
  label: string;
  normalizedValue: number; // 0..1
  displayValue: string;
  midiCc: number;
}

interface QLinksBarProps {
  slots: QLinkSlotState[];
  armedLearnIndex: number | null;
  velocityImpulse: number;
  onDragSlot: (index: number, nextNormalized: number) => void;
  onTapLearn: (index: number) => void;
  onCycleParam: (index: number) => void;
}

const QLINK_COLORS = [
  { hex: '#F5A623', bright: '#FFD166', bg: 'rgba(245, 166, 35, 0.24)' },
  { hex: '#22D3EE', bright: '#67E8F9', bg: 'rgba(34, 211, 238, 0.24)' },
  { hex: '#34D399', bright: '#6EE7B7', bg: 'rgba(52, 211, 153, 0.24)' },
  { hex: '#FB7185', bright: '#FDA4AF', bg: 'rgba(251, 113, 133, 0.24)' },
];

export const QLinksBar: React.FC<QLinksBarProps> = ({
  slots,
  armedLearnIndex,
  velocityImpulse,
  onDragSlot,
  onTapLearn,
  onCycleParam,
}) => {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const startX = useRef(0);
  const startVal = useRef(0);
  const moved = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const holdTriggered = useRef(false);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  return (
    <section
      aria-label="Q-Link Touch Faders"
      className="mx-2 sm:mx-4 mt-2.5 rounded-xl module-gunmetal border border-[#475569]/60 p-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2"
    >
      {slots.map((slot) => {
        const isArmed = armedLearnIndex === slot.index;
        const isDragging = draggingIdx === slot.index;
        const pct = Math.round(slot.normalizedValue * 100);
        const reactiveWidth = Math.min(100, pct + velocityImpulse * 12);
        const color = QLINK_COLORS[slot.index % QLINK_COLORS.length];

        return (
          <div
            key={slot.index}
            role="slider"
            aria-label={`Q${slot.index + 1} ${slot.label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              startX.current = e.clientX;
              startVal.current = slot.normalizedValue;
              moved.current = false;
              holdTriggered.current = false;
              setDraggingIdx(slot.index);

              clearHold();
              holdTimer.current = window.setTimeout(() => {
                if (!moved.current) {
                  holdTriggered.current = true;
                  onCycleParam(slot.index);
                }
              }, 460);
            }}
            onPointerMove={(e) => {
              if (draggingIdx !== slot.index) return;
              const dx = e.clientX - startX.current;
              if (Math.abs(dx) > 6) {
                moved.current = true;
                clearHold();
                const next = Math.min(1, Math.max(0, startVal.current + dx / 130));
                onDragSlot(slot.index, next);
              }
            }}
            onPointerUp={(e) => {
              clearHold();
              if (draggingIdx === slot.index) {
                try {
                  (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
                setDraggingIdx(null);
              }
              if (!moved.current && !holdTriggered.current) {
                onTapLearn(slot.index);
              }
            }}
            onPointerCancel={() => {
              clearHold();
              setDraggingIdx(null);
            }}
            className="min-h-[52px] rounded-lg px-3 py-2 lcd-screen border touch-none cursor-ew-resize select-none relative overflow-hidden flex flex-col justify-between transition-colors"
            style={{
              borderColor: isArmed || isDragging ? color.bright : '#334155',
            }}
          >
            {/* Reactive Fill Bar */}
            <div
              className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-75"
              style={{
                width: `${reactiveWidth}%`,
                background: `linear-gradient(90deg, rgba(255,255,255,0.03), ${color.bg})`,
              }}
            />

            <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
              <span className="font-bold whitespace-nowrap" style={{ color: color.bright }}>
                Q{slot.index + 1} · {slot.label}
              </span>
              <span className="text-[#94A3B8] whitespace-nowrap">
                {isArmed ? 'TAP CC…' : `CC ${slot.midiCc}`}
              </span>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-[#04060A] border border-[#1E293B] overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{ width: `${pct}%`, backgroundColor: color.hex }}
                />
              </div>
              <span className="text-xs font-mono-tabular font-bold text-[#F8FAFC] whitespace-nowrap">
                {slot.displayValue}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
};
