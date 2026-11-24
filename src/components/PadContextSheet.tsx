import React from 'react';
import { Dices, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import type { DrumSynthModel, VoiceConfig } from '../shared/types.ts';

interface PadContextSheetProps {
  voice: VoiceConfig;
  onClose: () => void;
  onUpdateVoice: (patch: Partial<VoiceConfig>) => void;
  onRandomizeVoice: () => void;
  onResetVoice: () => void;
  onPreviewVoice: () => void;
}

const SYNTH_MODELS: Array<{ id: DrumSynthModel; label: string }> = [
  { id: 'kick_87', label: "Kick '87" },
  { id: 'kick_sub', label: 'Sub Kick' },
  { id: 'snare_87', label: "Snare '87" },
  { id: 'snare_crack', label: 'Crack Snare' },
  { id: 'rim_87', label: 'Rimshot' },
  { id: 'clap_87', label: 'Clap 12B' },
  { id: 'hat_closed', label: 'Closed Hat' },
  { id: 'hat_open', label: 'Open Hat' },
  { id: 'tom_low', label: 'Low Tom' },
  { id: 'tom_mid', label: 'Mid Tom' },
  { id: 'tom_high', label: 'High Tom' },
  { id: 'crash_12bit', label: 'Crash 12-Bit' },
  { id: 'ride_12bit', label: 'Ride 87' },
  { id: 'cowbell_fm', label: 'FM Cowbell' },
  { id: 'clave_wood', label: 'Wood Clave' },
  { id: 'shaker_grit', label: 'Grit Shaker' },
  { id: 'perc_metallic', label: 'Metallic Perc' },
  { id: 'zap_electro', label: 'Electro Zap' },
];

export const PadContextSheet: React.FC<PadContextSheetProps> = ({
  voice,
  onClose,
  onUpdateVoice,
  onRandomizeVoice,
  onResetVoice,
  onPreviewVoice,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl chassis-surface border border-[#2C3342] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#242A35] bg-[#141821]">
          <div>
            <div className="text-[11px] font-mono-tabular text-[#F5A623] uppercase">
              Pad {String(voice.pad).padStart(2, '0')} Context Menu
            </div>
            <h2 className="font-display text-lg font-bold text-[#F2F5FA]">{voice.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPreviewVoice}
              className="min-h-[48px] px-3.5 rounded-lg bg-[#211A0E] border border-[#F5A623] text-[#F5A623] text-xs font-mono-tabular font-semibold flex items-center gap-1.5"
            >
              <Volume2 className="w-4 h-4" />
              <span>AUDITION</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Pad Context Menu"
              className="min-h-[48px] min-w-[48px] rounded-lg bg-[#1A1F29] border border-[#2B3240] flex items-center justify-center text-[#E6EAF2]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Mute / Solo Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onUpdateVoice({ mute: !voice.mute })}
              className={`min-h-[48px] rounded-lg border font-mono-tabular text-xs font-semibold flex items-center justify-center gap-2 ${
                voice.mute
                  ? 'bg-[#2C1417] border-[#EF4444] text-[#EF4444]'
                  : 'bg-[#141821] border-[#282F3D] text-[#E6EAF2]'
              }`}
            >
              <VolumeX className="w-4 h-4" />
              <span>{voice.mute ? 'MUTED' : 'MUTE VOICE'}</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateVoice({ solo: !voice.solo })}
              className={`min-h-[48px] rounded-lg border font-mono-tabular text-xs font-semibold flex items-center justify-center gap-2 ${
                voice.solo
                  ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                  : 'bg-[#141821] border-[#282F3D] text-[#E6EAF2]'
              }`}
            >
              <span>{voice.solo ? 'SOLO ACTIVE' : 'SOLO VOICE'}</span>
            </button>
          </div>

          {/* Choke Group */}
          <div>
            <div className="text-xs font-mono-tabular text-[#8C96A6] uppercase mb-1.5">
              Choke Group
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => onUpdateVoice({ choke_group: grp })}
                  className={`min-h-[48px] rounded-lg border font-mono-tabular text-xs font-semibold ${
                    voice.choke_group === grp
                      ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                      : 'bg-[#141821] border-[#282F3D] text-[#B8C0CE]'
                  }`}
                >
                  {grp === 0 ? 'OFF' : `GRP ${grp}`}
                </button>
              ))}
            </div>
          </div>

          {/* Per-Voice MIDI Channel & Note */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#0D1016] border border-[#232936]">
              <div className="text-[11px] font-mono-tabular text-[#8C96A6] uppercase mb-2">
                MIDI Channel
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateVoice({ midi_channel: Math.max(1, voice.midi_channel - 1) })}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#1A1F29] border border-[#2B3240] font-mono-tabular text-base text-[#E6EAF2]"
                >
                  -
                </button>
                <span className="font-mono-tabular text-base font-bold text-[#F5A623]">
                  CH {voice.midi_channel}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateVoice({ midi_channel: Math.min(16, voice.midi_channel + 1) })}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#1A1F29] border border-[#2B3240] font-mono-tabular text-base text-[#E6EAF2]"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0D1016] border border-[#232936]">
              <div className="text-[11px] font-mono-tabular text-[#8C96A6] uppercase mb-2">
                MIDI Note
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateVoice({ note: Math.max(0, voice.note - 1) })}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#1A1F29] border border-[#2B3240] font-mono-tabular text-base text-[#E6EAF2]"
                >
                  -
                </button>
                <span className="font-mono-tabular text-base font-bold text-[#E6EAF2]">
                  N{voice.note}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateVoice({ note: Math.min(127, voice.note + 1) })}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#1A1F29] border border-[#2B3240] font-mono-tabular text-base text-[#E6EAF2]"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Synth Engine Voice Model */}
          <div>
            <div className="text-xs font-mono-tabular text-[#8C96A6] uppercase mb-1.5">
              12-Bit Voice Source Model
            </div>
            <div className="grid grid-cols-3 gap-1.5 max-h-[168px] overflow-y-auto pr-1">
              {SYNTH_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateVoice({ synth_model: m.id, name: m.label.toUpperCase() })}
                  className={`min-h-[44px] px-2 rounded-lg border text-[11px] font-mono-tabular truncate ${
                    voice.synth_model === m.id
                      ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                      : 'bg-[#141821] border-[#252B37] text-[#B8C0CE]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Randomize & Reset Actions */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#242A35]">
            <button
              type="button"
              onClick={onRandomizeVoice}
              className="min-h-[48px] rounded-lg bg-[#161A23] border border-[#2B3240] active:border-[#F5A623] text-[#E6EAF2] font-mono-tabular text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Dices className="w-4 h-4 text-[#F5A623]" />
              <span>RANDOMIZE VOICE</span>
            </button>
            <button
              type="button"
              onClick={onResetVoice}
              className="min-h-[48px] rounded-lg bg-[#161A23] border border-[#2B3240] active:border-[#F5A623] text-[#B8C0CE] font-mono-tabular text-xs font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RESET VOICE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
