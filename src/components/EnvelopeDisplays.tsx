import React from 'react';
import type { VoiceConfig } from '../shared/types.ts';
import { TactileKnob } from './TactileKnob.tsx';

interface EnvelopeDisplaysProps {
  voice: VoiceConfig;
  velocityImpulse: number;
  onUpdateVoice: (patch: Partial<VoiceConfig>) => void;
}

export const EnvelopeDisplays: React.FC<EnvelopeDisplaysProps> = ({
  voice,
  velocityImpulse,
  onUpdateVoice,
}) => {
  const { amp_env, pitch_env } = voice;

  const w = 220;
  const h = 70;
  const padX = 8;
  const padY = 8;
  const usableW = w - padX * 2;
  const usableH = h - padY * 2;

  const aNorm = Math.min(0.28, (amp_env.attack / 0.5) * 0.28 + 0.03);
  const dNorm = Math.min(0.38, (amp_env.decay / 2.5) * 0.36 + 0.08);
  const sHold = 0.16;
  const rNorm = Math.min(0.28, (amp_env.release / 1.8) * 0.25 + 0.05);
  const totalNorm = aNorm + dNorm + sHold + rNorm;

  const x0 = padX;
  const y0 = h - padY;
  const xA = padX + (aNorm / totalNorm) * usableW;
  const yA = padY;
  const xD = xA + (dNorm / totalNorm) * usableW;
  const yS = padY + (1 - amp_env.sustain) * usableH;
  const xS = xD + (sHold / totalNorm) * usableW;
  const xR = Math.min(w - padX, xS + (rNorm / totalNorm) * usableW);
  const yR = h - padY;

  const ampPath = `M ${x0} ${y0} L ${xA} ${yA} Q ${(xA + xD) * 0.48} ${yS * 0.65 + yA * 0.35} ${xD} ${yS} L ${xS} ${yS} Q ${(xS + xR) * 0.5} ${yS * 0.35 + yR * 0.65} ${xR} ${yR}`;
  const ampArea = `${ampPath} L ${x0} ${y0} Z`;

  const midY = h / 2;
  const depthNorm = pitch_env.depth / 24;
  const peakY = midY - depthNorm * (usableH * 0.44);
  const pDecayX = padX + 14 + Math.min(0.85, pitch_env.decay / 0.5) * (usableW - 24);
  const pitchPath = `M ${padX} ${midY} L ${padX + 12} ${peakY} Q ${padX + 12 + (pDecayX - padX - 12) * 0.35} ${midY} ${pDecayX} ${midY} L ${w - padX} ${midY}`;

  return (
    <section
      aria-label="Per-Voice Amp and Pitch Envelopes"
      className="mx-2 sm:mx-4 mt-2.5 grid grid-cols-1 lg:grid-cols-2 gap-2.5"
    >
      {/* Left: Steel-Teal VCA Envelope Module */}
      <div className="module-steel-teal rounded-xl border border-[#2C6B7E]/60 p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-[220px] shrink-0">
          <div className="flex items-center justify-between text-[11px] font-mono-tabular mb-1.5">
            <span className="text-[#FFB938] font-bold tracking-wider">
              AMP ENV · P{String(voice.pad).padStart(2, '0')}
            </span>
            <span className="text-[#E2E8F0] font-semibold truncate max-w-[115px]">{voice.name}</span>
          </div>
          <div className="lcd-screen rounded-lg border border-[#334155] overflow-hidden relative">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[70px] block">
              <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="#1E293B" strokeDasharray="3 3" />
              <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="#1E293B" strokeDasharray="3 3" />
              <path d={ampArea} fill="rgba(245, 166, 35, 0.22)" />
              <path
                d={ampPath}
                fill="none"
                stroke="#FFB938"
                strokeWidth={2.2 + velocityImpulse * 1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={xA}
                cy={yA}
                r={3.2 + velocityImpulse * 3.5}
                fill="#FFD166"
                opacity={0.8 + velocityImpulse * 0.2}
              />
              <circle cx={xD} cy={yS} r="3" fill="#F5A623" />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-around w-full gap-1 sm:gap-2">
          <TactileKnob
            label="ATK"
            value={amp_env.attack}
            min={0.001}
            max={0.4}
            defaultValue={0.002}
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(attack) => onUpdateVoice({ amp_env: { ...amp_env, attack } })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="amber"
          />
          <TactileKnob
            label="DECAY"
            value={amp_env.decay}
            min={0.03}
            max={2.4}
            defaultValue={0.35}
            formatValue={(v) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`)}
            onChange={(decay) => onUpdateVoice({ amp_env: { ...amp_env, decay } })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="amber"
          />
          <TactileKnob
            label="SUST"
            value={amp_env.sustain}
            min={0}
            max={1}
            defaultValue={0.08}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(sustain) => onUpdateVoice({ amp_env: { ...amp_env, sustain } })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="amber"
          />
          <TactileKnob
            label="REL"
            value={amp_env.release}
            min={0.02}
            max={1.6}
            defaultValue={0.15}
            formatValue={(v) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`)}
            onChange={(release) => onUpdateVoice({ amp_env: { ...amp_env, release } })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="amber"
          />
        </div>
      </div>

      {/* Right: Slate-Plum Pitch Envelope Module */}
      <div className="module-slate-plum rounded-xl border border-[#5B4B8A]/60 p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-[220px] shrink-0">
          <div className="flex items-center justify-between text-[11px] font-mono-tabular mb-1.5">
            <span className="text-[#22D3EE] font-bold tracking-wider">PITCH · TUNE</span>
            <span className="text-[#CBD5E1]">
              CH {voice.midi_channel} · N{voice.note}
              {voice.choke_group > 0 ? ` · C${voice.choke_group}` : ''}
            </span>
          </div>
          <div className="lcd-screen rounded-lg border border-[#334155] overflow-hidden relative">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[70px] block">
              <line x1={0} y1={midY} x2={w} y2={midY} stroke="#1E293B" strokeDasharray="3 3" />
              <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="#1E293B" strokeDasharray="3 3" />
              <path
                d={pitchPath}
                fill="none"
                stroke="#22D3EE"
                strokeWidth={2.2 + velocityImpulse * 1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={padX + 12}
                cy={peakY}
                r={3.2 + velocityImpulse * 3}
                fill="#67E8F9"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-around w-full gap-1 sm:gap-2">
          <TactileKnob
            label="TUNE"
            value={voice.tune}
            min={-24}
            max={24}
            defaultValue={0}
            formatValue={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}st`}
            onChange={(tune) => onUpdateVoice({ tune: Math.round(tune) })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="cyan"
          />
          <TactileKnob
            label="P.ENV"
            value={pitch_env.depth}
            min={-24}
            max={24}
            defaultValue={0}
            formatValue={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}st`}
            onChange={(depth) => onUpdateVoice({ pitch_env: { ...pitch_env, depth: Math.round(depth) } })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="cyan"
          />
          <TactileKnob
            label="P.DEC"
            value={pitch_env.decay}
            min={0.008}
            max={0.5}
            defaultValue={0.05}
            formatValue={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(decay) => onUpdateVoice({ pitch_env: { ...pitch_env, decay } })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="cyan"
          />
          <TactileKnob
            label="LEVEL"
            value={voice.level}
            min={0}
            max={1.2}
            defaultValue={0.9}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(level) => onUpdateVoice({ level })}
            velocityImpulse={velocityImpulse}
            size="sm"
            accent="emerald"
          />
        </div>
      </div>
    </section>
  );
};
