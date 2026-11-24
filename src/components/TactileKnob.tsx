import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export type KnobAccent = 'amber' | 'cyan' | 'emerald' | 'crimson';

interface TactileKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  /** 0..1 incoming MIDI/pad strike velocity impulse for fluid reactive animation */
  velocityImpulse?: number;
  size?: 'sm' | 'md';
  logarithmic?: boolean;
  accent?: KnobAccent;
}

const ACCENT_HEX: Record<KnobAccent, { main: string; bright: string; glow: string }> = {
  amber: { main: '#F5A623', bright: '#FFD166', glow: 'rgba(245, 166, 35, 0.65)' },
  cyan: { main: '#22D3EE', bright: '#67E8F9', glow: 'rgba(34, 211, 238, 0.65)' },
  emerald: { main: '#34D399', bright: '#6EE7B7', glow: 'rgba(52, 211, 153, 0.65)' },
  crimson: { main: '#FB7185', bright: '#FDA4AF', glow: 'rgba(251, 113, 133, 0.65)' },
};

export const TactileKnob: React.FC<TactileKnobProps> = ({
  label,
  value,
  min,
  max,
  defaultValue,
  unit = '',
  formatValue,
  onChange,
  velocityImpulse = 0,
  size = 'md',
  logarithmic = false,
  accent = 'amber',
}) => {
  const uid = useId().replace(/:/g, '');
  const [dragging, setDragging] = useState(false);
  const [reactiveBoost, setReactiveBoost] = useState(0);
  const dragStartY = useRef(0);
  const dragStartNorm = useRef(0);
  const lastTapTime = useRef(0);
  const animFrame = useRef<number | null>(null);
  const boostRef = useRef(0);

  const toNorm = useCallback(
    (v: number) => {
      const clamped = Math.min(max, Math.max(min, v));
      if (logarithmic && min > 0) {
        return (Math.log(clamped) - Math.log(min)) / (Math.log(max) - Math.log(min));
      }
      return (clamped - min) / (max - min);
    },
    [min, max, logarithmic]
  );

  const fromNorm = useCallback(
    (norm: number) => {
      const n = Math.min(1, Math.max(0, norm));
      if (logarithmic && min > 0) {
        return Math.exp(Math.log(min) + n * (Math.log(max) - Math.log(min)));
      }
      return min + n * (max - min);
    },
    [min, max, logarithmic]
  );

  useEffect(() => {
    if (velocityImpulse <= 0.01) return;
    boostRef.current = Math.max(boostRef.current, velocityImpulse);

    const tick = () => {
      boostRef.current *= 0.86;
      if (boostRef.current < 0.015) {
        boostRef.current = 0;
        setReactiveBoost(0);
        animFrame.current = null;
        return;
      }
      setReactiveBoost(boostRef.current);
      animFrame.current = requestAnimationFrame(tick);
    };

    if (!animFrame.current) {
      animFrame.current = requestAnimationFrame(tick);
    }
  }, [velocityImpulse]);

  useEffect(() => {
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, []);

  const norm = toNorm(value);
  const visualNorm = Math.min(1, norm + reactiveBoost * 0.14 * (1 - norm * 0.4));
  const startAngle = -135;
  const endAngle = 135;
  const angle = startAngle + visualNorm * (endAngle - startAngle);

  const dim = size === 'sm' ? 54 : 64;
  const cx = dim / 2;
  const cy = dim / 2;
  const arcRadius = size === 'sm' ? 23 : 27;
  const capRadius = size === 'sm' ? 16 : 19;
  const palette = ACCENT_HEX[accent];

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad),
    };
  };

  const describeArc = (x: number, y: number, radius: number, startDeg: number, endDeg: number) => {
    const start = polarToCartesian(x, y, radius, endDeg);
    const end = polarToCartesian(x, y, radius, startDeg);
    const largeArcFlag = endDeg - startDeg <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const now = performance.now();
    if (defaultValue !== undefined && now - lastTapTime.current < 280) {
      onChange(defaultValue);
      lastTapTime.current = 0;
      return;
    }
    lastTapTime.current = now;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartNorm.current = norm;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dy = dragStartY.current - e.clientY;
    const nextNorm = Math.min(1, Math.max(0, dragStartNorm.current + dy / 140));
    onChange(fromNorm(nextNorm));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    setDragging(false);
  };

  const formatted = formatValue
    ? formatValue(value)
    : `${Number.isInteger(value) ? value : value.toFixed(2)}${unit}`;

  const arcTrack = describeArc(cx, cy, arcRadius, startAngle, endAngle);
  const arcActive = visualNorm > 0.005 ? describeArc(cx, cy, arcRadius, startAngle, angle) : '';
  const needleEnd = polarToCartesian(cx, cy, capRadius - 2, angle);
  const needleStart = polarToCartesian(cx, cy, 4, angle);

  // 11 machined bezel ticks around knob
  const ticks = Array.from({ length: 11 }).map((_, idx) => {
    const tickAngle = startAngle + (idx / 10) * (endAngle - startAngle);
    const outer = polarToCartesian(cx, cy, arcRadius + 3.5, tickAngle);
    const inner = polarToCartesian(cx, cy, arcRadius + 1, tickAngle);
    return { outer, inner, isActive: tickAngle <= angle + 1 };
  });

  return (
    <div className="flex flex-col items-center select-none w-[68px] shrink-0">
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(e) => {
          const delta =
            (e.shiftKey ? 0.1 : 0.03) *
            (e.key === 'ArrowUp' || e.key === 'ArrowRight'
              ? 1
              : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
              ? -1
              : 0);
          if (delta !== 0) {
            e.preventDefault();
            onChange(fromNorm(norm + delta));
          }
        }}
        className="relative flex items-center justify-center touch-none cursor-ns-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A623] rounded-full"
        style={{ width: `${dim}px`, height: `${dim}px` }}
      >
        {/* Velocity-reactive tactile glow */}
        <div
          className="absolute inset-1 rounded-full pointer-events-none transition-opacity duration-75"
          style={{
            opacity: dragging ? 0.65 : reactiveBoost * 0.85,
            boxShadow: `0 0 ${12 + reactiveBoost * 16}px ${palette.glow}`,
          }}
        />
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="overflow-visible">
          <defs>
            {/* Conical brushed-aluminum face gradient (Evil Tuner / Audity style) */}
            <linearGradient id={`aluFace-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="28%" stopColor="#94A3B8" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="76%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <radialGradient id={`aluBevel-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#94A3B8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.65" />
            </radialGradient>
          </defs>

          {/* Calibrated Bezel Ticks */}
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.inner.x}
              y1={t.inner.y}
              x2={t.outer.x}
              y2={t.outer.y}
              stroke={t.isActive ? palette.main : 'rgba(255,255,255,0.28)'}
              strokeWidth={idx === 0 || idx === 5 || idx === 10 ? '1.6' : '1'}
              strokeLinecap="round"
            />
          ))}

          {/* Value Track Arc */}
          <path d={arcTrack} fill="none" stroke="rgba(10, 14, 22, 0.8)" strokeWidth="2.8" strokeLinecap="round" />
          {arcActive && (
            <path
              d={arcActive}
              fill="none"
              stroke={dragging || reactiveBoost > 0.25 ? palette.bright : palette.main}
              strokeWidth={dragging || reactiveBoost > 0.15 ? '3.4' : '2.8'}
              strokeLinecap="round"
            />
          )}

          {/* Dark Knurled Outer Skirt */}
          <circle
            cx={cx}
            cy={cy}
            r={capRadius + 2.5}
            fill="#141820"
            stroke="#090C11"
            strokeWidth="1.5"
          />

          {/* Brushed Aluminum Knob Body */}
          <circle
            cx={cx}
            cy={cy}
            r={capRadius}
            fill={`url(#aluFace-${uid})`}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="0.9"
          />
          <circle
            cx={cx}
            cy={cy}
            r={capRadius - 1.5}
            fill={`url(#aluBevel-${uid})`}
          />

          {/* Machined Pointer Notch */}
          <line
            x1={needleStart.x}
            y1={needleStart.y}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="#0B0F17"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <line
            x1={needleStart.x}
            y1={needleStart.y}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke={palette.main}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="mt-0.5 text-[10px] font-mono-tabular font-semibold tracking-wider text-[#CBD5E1] uppercase whitespace-nowrap">
        {label}
      </span>
      <span
        className="text-[11px] font-mono-tabular font-bold whitespace-nowrap"
        style={{ color: palette.bright }}
      >
        {formatted}
      </span>
    </div>
  );
};
