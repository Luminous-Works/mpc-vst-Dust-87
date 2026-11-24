import React, { useEffect, useRef, useState } from 'react';
import { dust87Engine } from '../audio/dust87Engine.ts';
import { TactileKnob } from './TactileKnob.tsx';

interface MasterOutMeterProps {
  masterDb: number;
  velocityImpulse: number;
  onChangeMasterDb: (db: number) => void;
}

const SEGMENTS = 14;

export const MasterOutMeter: React.FC<MasterOutMeterProps> = ({
  masterDb,
  velocityImpulse,
  onChangeMasterDb,
}) => {
  const [levels, setLevels] = useState({ leftDb: -60, rightDb: -60, peakDb: -60, clipping: false });
  const [peakHoldDb, setPeakHoldDb] = useState(-60);
  const peakHoldTimer = useRef(0);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      const next = dust87Engine.getOutputMeterLevels();
      setLevels(next);

      const now = performance.now();
      setPeakHoldDb((prev) => {
        if (next.peakDb >= prev) {
          peakHoldTimer.current = now;
          return next.peakDb;
        }
        if (now - peakHoldTimer.current > 1100) {
          return Math.max(next.peakDb, prev - 0.9);
        }
        return prev;
      });

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const dbToActiveSegments = (db: number) => {
    if (db <= -54) return 0;
    const norm = Math.min(1, Math.max(0, (db + 54) / 57)); // -54 dB .. +3 dB
    return Math.round(norm * SEGMENTS);
  };

  const leftActive = dbToActiveSegments(levels.leftDb);
  const rightActive = dbToActiveSegments(levels.rightDb);
  const holdSeg = dbToActiveSegments(peakHoldDb);

  const renderChannelBar = (activeCount: number, channelLabel: string) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono-tabular font-bold text-[#94A3B8] w-2.5">{channelLabel}</span>
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const lit = i < activeCount;
          const isHold = holdSeg > 0 && i === holdSeg - 1;
          const color =
            i >= 12
              ? lit || isHold
                ? '#EF4444'
                : '#2E1619'
              : i >= 9
              ? lit || isHold
                ? '#F5A623'
                : '#2C2210'
              : lit || isHold
              ? '#22C55E'
              : '#10241A';

          return (
            <div
              key={i}
              className="w-[7px] sm:w-[9px] h-3 rounded-[1.5px] transition-colors duration-75"
              style={{
                backgroundColor: color,
                boxShadow: lit || isHold ? `0 0 6px ${color}` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="lcd-screen rounded-xl border border-[#364154] px-3 py-1.5 flex items-center gap-3">
      <TactileKnob
        label="MASTER"
        value={masterDb}
        min={-48}
        max={6}
        defaultValue={0}
        formatValue={(v) => (v <= -47.5 ? '-INF' : `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`)}
        onChange={onChangeMasterDb}
        velocityImpulse={velocityImpulse}
        size="sm"
        accent="emerald"
      />

      <div className="flex flex-col justify-between gap-1.5 w-[152px] shrink-0">
        <div className="flex items-center justify-between text-[10px] font-mono-tabular">
          <span className="text-[#94A3B8] tracking-wider uppercase">Out Meter</span>
          <span
            className={`font-bold ${
              levels.clipping ? 'text-[#EF4444]' : peakHoldDb > -6 ? 'text-[#F5A623]' : 'text-[#34D399]'
            }`}
          >
            {peakHoldDb <= -54 ? '-INF dB' : `${peakHoldDb > 0 ? '+' : ''}${peakHoldDb.toFixed(1)} dB`}
          </span>
        </div>

        <div className="space-y-1">
          {renderChannelBar(leftActive, 'L')}
          {renderChannelBar(rightActive, 'R')}
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono-tabular text-[#64748B]">
          <span>-48</span>
          <span>-18</span>
          <span>-6</span>
          <span className="text-[#EF4444]">0dB</span>
        </div>
      </div>
    </div>
  );
};
