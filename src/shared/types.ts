export type BitDepth = 8 | 10 | 12 | 16;
export type SampleRateOption = 11025 | 22050 | 26000 | 44100;
export type FilterType = 'resonant-lp' | 'resonant-bp' | 'hp-clean';
export type ReverbType = 'plate' | 'room' | 'hall' | 'spring';
export type DrumSynthModel =
  | 'kick_87'
  | 'kick_sub'
  | 'snare_87'
  | 'snare_crack'
  | 'rim_87'
  | 'clap_87'
  | 'hat_closed'
  | 'hat_open'
  | 'tom_low'
  | 'tom_mid'
  | 'tom_high'
  | 'crash_12bit'
  | 'ride_12bit'
  | 'cowbell_fm'
  | 'clave_wood'
  | 'shaker_grit'
  | 'perc_metallic'
  | 'zap_electro';

export type QLinkParamId =
  | 'filter_cutoff'
  | 'filter_reso'
  | 'drive'
  | 'decay'
  | 'pitch'
  | 'plate_mix'
  | 'plate_decay'
  | 'bit_depth';

export type MidiRoutingMode = 'per_voice_channel' | 'combo_ch10';
export type VelocityCurveMode = 'touch_y' | 'fixed_127' | 'soft_log' | 'hard_exp';

export interface AmpEnvelope {
  attack: number;   // 0.001 .. 0.5 sec
  decay: number;    // 0.02 .. 3.0 sec
  sustain: number;  // 0.0 .. 1.0
  release: number;  // 0.01 .. 2.0 sec
}

export interface PitchEnvelope {
  depth: number;    // -24 .. +24 semitones
  decay: number;    // 0.005 .. 0.8 sec
}

export interface VoiceConfig {
  pad: number;           // 1 .. 48 (Banks A-D, 12 pads each)
  name: string;          // Short pad label e.g. "KICK '87"
  synth_model: DrumSynthModel;
  note: number;          // 0 .. 127
  midi_channel: number;  // 1 .. 16
  choke_group: number;   // 0 (off) .. 4
  mute: boolean;
  solo: boolean;
  tune: number;          // -24 .. +24 semitones
  level: number;         // 0 .. 1.2
  pan: number;           // -1 .. +1
  filter_cutoff: number; // 120 .. 18000 Hz
  filter_reso: number;   // 0.1 .. 16 Q
  drive: number;         // 0 .. 1
  amp_env: AmpEnvelope;
  pitch_env: PitchEnvelope;
}

export interface SequencerPattern {
  enabled: boolean;
  bpm: number;
  swing: number; // 0 .. 0.5
  steps: Record<number, number[]>; // pad (1..48) -> 64-element velocity array (0..127)
}

export interface Dust87Preset {
  schema: 'lumina.plugin/v1';
  id?: string;
  name: string;
  version: string;
  license: 'GPL-3.0-only';
  category?: string;
  bank_type?: 'factory' | 'starter' | 'user';
  author?: string;
  engine: {
    bit: BitDepth;
    sr: [number, number] | number[];
    filter: FilterType;
    filter_cutoff: number;
    filter_reso: number;
    drive: number;
  };
  voices: VoiceConfig[];
  fx: {
    plate: {
      enabled: boolean;
      type?: ReverbType;
      mix: number;   // 0 .. 1
      decay: number; // 0.3 .. 6.0 sec
    };
  };
  qlinks: [QLinkParamId, QLinkParamId, QLinkParamId, QLinkParamId];
  randomizer: {
    pitch: [number, number];
    drive: [number, number];
  };
  sequencer?: SequencerPattern;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  preset?: Dust87Preset;
}

export interface QuarantineRecord {
  filename: string;
  quarantinedAt: string;
  originalPath: string;
  quarantinePath: string;
  errors: string[];
  rawSnippet: string;
}

export interface PlatformPathsReport {
  activePlatform: string;
  activeRootDir: string;
  settingsFile: string;
  userPresetsDir: string;
  quarantineDir: string;
  factoryCacheDir: string;
  matrix: {
    linux_mpc: {
      dataDir: string;
      mpcExternalDir: string;
      configDir: string;
    };
    macos: {
      appSupportDir: string;
      presetsDir: string;
      quarantineDir: string;
    };
    windows: {
      roamingDir: string;
      localCacheDir: string;
      quarantineDir: string;
    };
  };
}

export interface UserSettings {
  activePresetId: string;
  midiRoutingMode: MidiRoutingMode;
  velocityCurve: VelocityCurveMode;
  qlinkCcMap: [number, number, number, number];
  rollDivision: '1/8' | '1/16' | '1/32';
  simulatedVelocity: number;
}

export interface WorkflowCheckItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

export interface WorkflowValidationReport {
  pluginName: string;
  version: string;
  license: string;
  timestamp: string;
  passed: boolean;
  summary: {
    totalChecks: number;
    passedChecks: number;
    factoryPresetsVerified: number;
    starterPresetsVerified: number;
    userPresetsVerified: number;
    quarantinedFilesCount: number;
  };
  checks: WorkflowCheckItem[];
}
