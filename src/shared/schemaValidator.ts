import type {
  BitDepth,
  DrumSynthModel,
  Dust87Preset,
  FilterType,
  QLinkParamId,
  ReverbType,
  ValidationResult,
  VoiceConfig,
} from './types.ts';

const VALID_BITS: BitDepth[] = [8, 10, 12, 16];
const VALID_FILTERS: FilterType[] = ['resonant-lp', 'resonant-bp', 'hp-clean'];
const VALID_REVERBS: ReverbType[] = ['plate', 'room', 'hall', 'spring'];
const VALID_QLINKS: QLinkParamId[] = [
  'filter_cutoff',
  'filter_reso',
  'drive',
  'decay',
  'pitch',
  'plate_mix',
  'plate_decay',
  'bit_depth',
];
const VALID_SYNTH_MODELS: DrumSynthModel[] = [
  'kick_87',
  'kick_sub',
  'snare_87',
  'snare_crack',
  'rim_87',
  'clap_87',
  'hat_closed',
  'hat_open',
  'tom_low',
  'tom_mid',
  'tom_high',
  'crash_12bit',
  'ride_12bit',
  'cowbell_fm',
  'clave_wood',
  'shaker_grit',
  'perc_metallic',
  'zap_electro',
];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function validateDust87Preset(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Root payload must be a JSON object.'] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.schema !== 'lumina.plugin/v1') {
    errors.push(`Invalid schema "${String(obj.schema)}": expected "lumina.plugin/v1".`);
  }

  if (typeof obj.name !== 'string' || obj.name.trim().length === 0 || obj.name.length > 64) {
    errors.push('Field "name" must be a non-empty string (<= 64 chars).');
  }

  if (typeof obj.version !== 'string' || !/^v?\d+\.\d+\.\d+/.test(obj.version)) {
    errors.push(`Invalid "version" "${String(obj.version)}": expected semver string (e.g. "v0.1.0").`);
  }

  if (obj.license !== 'GPL-3.0-only') {
    errors.push(`Invalid license "${String(obj.license)}": must be "GPL-3.0-only".`);
  }

  // Validate engine
  if (!obj.engine || typeof obj.engine !== 'object' || Array.isArray(obj.engine)) {
    errors.push('Missing or invalid "engine" object.');
  } else {
    const eng = obj.engine as Record<string, unknown>;
    if (!VALID_BITS.includes(eng.bit as BitDepth)) {
      errors.push(`Invalid engine.bit "${String(eng.bit)}": allowed values are 8, 10, 12, 16.`);
    }
    if (!Array.isArray(eng.sr) || eng.sr.length === 0 || !eng.sr.every((n) => isFiniteNumber(n) && n >= 8000 && n <= 96000)) {
      errors.push('Field "engine.sr" must be a non-empty array of sample rates between 8000 and 96000.');
    }
    if (!VALID_FILTERS.includes(eng.filter as FilterType)) {
      errors.push(`Invalid engine.filter "${String(eng.filter)}": allowed are resonant-lp, resonant-bp, hp-clean.`);
    }
    if (!isFiniteNumber(eng.drive) || eng.drive < 0 || eng.drive > 1) {
      errors.push('Field "engine.drive" must be a number in range [0, 1].');
    }
  }

  // Validate voices
  if (!Array.isArray(obj.voices) || obj.voices.length === 0 || obj.voices.length > 48) {
    errors.push('Field "voices" must be a non-empty array of 1..48 voice configurations.');
  } else {
    obj.voices.forEach((v, idx) => {
      if (!v || typeof v !== 'object') {
        errors.push(`voices[${idx}] must be an object.`);
        return;
      }
      const voice = v as Record<string, unknown>;
      if (!isFiniteNumber(voice.pad) || voice.pad < 1 || voice.pad > 48) {
        errors.push(`voices[${idx}].pad must be integer 1..48.`);
      }
      if (!isFiniteNumber(voice.note) || voice.note < 0 || voice.note > 127) {
        errors.push(`voices[${idx}].note must be MIDI note 0..127.`);
      }
      if (!isFiniteNumber(voice.midi_channel) || voice.midi_channel < 1 || voice.midi_channel > 16) {
        errors.push(`voices[${idx}].midi_channel must be 1..16.`);
      }
      if (voice.choke_group !== undefined && (!isFiniteNumber(voice.choke_group) || voice.choke_group < 0 || voice.choke_group > 8)) {
        errors.push(`voices[${idx}].choke_group must be 0..8.`);
      }
      if (!voice.amp_env || typeof voice.amp_env !== 'object') {
        errors.push(`voices[${idx}].amp_env must be an object.`);
      }
    });
  }

  // Validate FX
  if (!obj.fx || typeof obj.fx !== 'object') {
    errors.push('Missing "fx" object.');
  } else {
    const fx = obj.fx as Record<string, unknown>;
    if (!fx.plate || typeof fx.plate !== 'object') {
      errors.push('Missing "fx.plate" object.');
    } else {
      const plate = fx.plate as Record<string, unknown>;
      if (!isFiniteNumber(plate.mix) || plate.mix < 0 || plate.mix > 1) {
        errors.push('fx.plate.mix must be in [0, 1].');
      }
      if (!isFiniteNumber(plate.decay) || plate.decay < 0.1 || plate.decay > 10) {
        errors.push('fx.plate.decay must be in [0.1, 10].');
      }
    }
  }

  // Validate Q-Links
  if (!Array.isArray(obj.qlinks) || obj.qlinks.length !== 4 || !obj.qlinks.every((q) => VALID_QLINKS.includes(q as QLinkParamId))) {
    errors.push('Field "qlinks" must be an array of 4 valid Q-Link parameter IDs.');
  }

  // Validate randomizer
  if (!obj.randomizer || typeof obj.randomizer !== 'object') {
    errors.push('Missing "randomizer" object.');
  } else {
    const rnd = obj.randomizer as Record<string, unknown>;
    if (!Array.isArray(rnd.pitch) || rnd.pitch.length !== 2 || !rnd.pitch.every(isFiniteNumber)) {
      errors.push('randomizer.pitch must be a [min, max] numeric tuple.');
    }
    if (!Array.isArray(rnd.drive) || rnd.drive.length !== 2 || !rnd.drive.every(isFiniteNumber)) {
      errors.push('randomizer.drive must be a [min, max] numeric tuple.');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Normalize optional fields safely
  const eng = obj.engine as Record<string, unknown>;
  const fxPlate = (obj.fx as Record<string, unknown>).plate as Record<string, unknown>;

  const normalizedVoices: VoiceConfig[] = (obj.voices as Record<string, unknown>[]).map((v, i) => {
    const env = (v.amp_env ?? {}) as Record<string, unknown>;
    const pEnv = (v.pitch_env ?? {}) as Record<string, unknown>;
    const synthModel = VALID_SYNTH_MODELS.includes(v.synth_model as DrumSynthModel)
      ? (v.synth_model as DrumSynthModel)
      : VALID_SYNTH_MODELS[i % VALID_SYNTH_MODELS.length];

    return {
      pad: Math.round(v.pad as number),
      name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : `PAD ${String(i + 1).padStart(2, '0')}`,
      synth_model: synthModel,
      note: Math.round(v.note as number),
      midi_channel: Math.round(v.midi_channel as number),
      choke_group: isFiniteNumber(v.choke_group) ? Math.round(v.choke_group) : 0,
      mute: Boolean(v.mute),
      solo: Boolean(v.solo),
      tune: isFiniteNumber(v.tune) ? clamp(v.tune, -24, 24) : 0,
      level: isFiniteNumber(v.level) ? clamp(v.level, 0, 1.2) : 0.85,
      pan: isFiniteNumber(v.pan) ? clamp(v.pan, -1, 1) : 0,
      filter_cutoff: isFiniteNumber(v.filter_cutoff) ? clamp(v.filter_cutoff, 120, 18000) : 14000,
      filter_reso: isFiniteNumber(v.filter_reso) ? clamp(v.filter_reso, 0.1, 16) : 1.2,
      drive: isFiniteNumber(v.drive) ? clamp(v.drive, 0, 1) : 0.15,
      amp_env: {
        attack: isFiniteNumber(env.attack) ? clamp(env.attack, 0.001, 0.5) : 0.002,
        decay: isFiniteNumber(env.decay) ? clamp(env.decay, 0.02, 3.0) : 0.35,
        sustain: isFiniteNumber(env.sustain) ? clamp(env.sustain, 0, 1) : 0.15,
        release: isFiniteNumber(env.release) ? clamp(env.release, 0.01, 2.0) : 0.18,
      },
      pitch_env: {
        depth: isFiniteNumber(pEnv.depth) ? clamp(pEnv.depth, -24, 24) : 0,
        decay: isFiniteNumber(pEnv.decay) ? clamp(pEnv.decay, 0.005, 0.8) : 0.06,
      },
    };
  });

  const normalized: Dust87Preset = {
    schema: 'lumina.plugin/v1',
    id: typeof obj.id === 'string' && obj.id ? obj.id : `preset-${(obj.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: (obj.name as string).trim(),
    version: obj.version as string,
    license: 'GPL-3.0-only',
    category: typeof obj.category === 'string' ? obj.category : 'User Bank',
    bank_type: obj.bank_type === 'factory' || obj.bank_type === 'starter' || obj.bank_type === 'user' ? obj.bank_type : 'user',
    author: typeof obj.author === 'string' ? obj.author : 'Lumina.Aerospace',
    engine: {
      bit: eng.bit as BitDepth,
      sr: eng.sr as number[],
      filter: eng.filter as FilterType,
      filter_cutoff: isFiniteNumber(eng.filter_cutoff) ? clamp(eng.filter_cutoff, 120, 18000) : 11500,
      filter_reso: isFiniteNumber(eng.filter_reso) ? clamp(eng.filter_reso, 0.1, 16) : 1.4,
      drive: eng.drive as number,
    },
    voices: normalizedVoices,
    fx: {
      plate: {
        enabled: fxPlate.enabled !== undefined ? Boolean(fxPlate.enabled) : true,
        type: VALID_REVERBS.includes(fxPlate.type as ReverbType) ? (fxPlate.type as ReverbType) : 'plate',
        mix: fxPlate.mix as number,
        decay: fxPlate.decay as number,
      },
    },
    qlinks: obj.qlinks as [QLinkParamId, QLinkParamId, QLinkParamId, QLinkParamId],
    randomizer: {
      pitch: (obj.randomizer as { pitch: [number, number] }).pitch,
      drive: (obj.randomizer as { drive: [number, number] }).drive,
    },
    sequencer: obj.sequencer as Dust87Preset['sequencer'],
  };

  return { valid: true, errors: [], preset: normalized };
}
