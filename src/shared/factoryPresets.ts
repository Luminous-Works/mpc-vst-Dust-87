import type {
  BitDepth,
  DrumSynthModel,
  Dust87Preset,
  FilterType,
  QLinkParamId,
  SampleRateOption,
  VoiceConfig,
} from './types.ts';
import { generateGrooveForPreset } from './grooveLibrary.ts';

interface KitTemplateSpec {
  name: string;
  category: string;
  bit: BitDepth;
  sr: SampleRateOption;
  filter: FilterType;
  cutoff: number;
  reso: number;
  drive: number;
  plateMix: number;
  plateDecay: number;
  tuneOffset: number;
  decayScale: number;
  qlinks: [QLinkParamId, QLinkParamId, QLinkParamId, QLinkParamId];
}

interface BaseVoiceTemplate {
  name: string;
  model: DrumSynthModel;
  choke: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  pitchDepth: number;
  pitchDecay: number;
  cutoff: number;
  reso: number;
  drive: number;
  pan: number;
  level: number;
}

const BANK_A_TEMPLATES: BaseVoiceTemplate[] = [
  { name: "KICK '87", model: 'kick_87', choke: 0, attack: 0.002, decay: 0.38, sustain: 0.05, release: 0.14, pitchDepth: 18, pitchDecay: 0.055, cutoff: 4200, reso: 1.8, drive: 0.35, pan: 0, level: 0.96 },
  { name: "SNARE '87", model: 'snare_87', choke: 0, attack: 0.001, decay: 0.24, sustain: 0.08, release: 0.12, pitchDepth: 9, pitchDecay: 0.032, cutoff: 9600, reso: 1.4, drive: 0.28, pan: 0, level: 0.92 },
  { name: 'RIM SHOT', model: 'rim_87', choke: 0, attack: 0.001, decay: 0.16, sustain: 0.03, release: 0.09, pitchDepth: 11, pitchDecay: 0.018, cutoff: 11200, reso: 1.7, drive: 0.34, pan: -0.12, level: 0.9 },
  { name: 'CLAP 12B', model: 'clap_87', choke: 0, attack: 0.002, decay: 0.29, sustain: 0.04, release: 0.16, pitchDepth: 2, pitchDecay: 0.02, cutoff: 10200, reso: 1.6, drive: 0.3, pan: 0.1, level: 0.88 },
  { name: 'CH HAT', model: 'hat_closed', choke: 1, attack: 0.001, decay: 0.075, sustain: 0.0, release: 0.04, pitchDepth: 0, pitchDecay: 0.02, cutoff: 14500, reso: 1.5, drive: 0.15, pan: -0.22, level: 0.82 },
  { name: 'OP HAT', model: 'hat_open', choke: 1, attack: 0.002, decay: 0.48, sustain: 0.12, release: 0.26, pitchDepth: 0, pitchDecay: 0.03, cutoff: 15200, reso: 1.3, drive: 0.15, pan: -0.22, level: 0.8 },
  { name: 'LOW TOM', model: 'tom_low', choke: 0, attack: 0.002, decay: 0.34, sustain: 0.04, release: 0.15, pitchDepth: 11, pitchDecay: 0.08, cutoff: 3200, reso: 1.6, drive: 0.2, pan: -0.35, level: 0.86 },
  { name: 'MID TOM', model: 'tom_mid', choke: 0, attack: 0.002, decay: 0.28, sustain: 0.04, release: 0.14, pitchDepth: 10, pitchDecay: 0.065, cutoff: 4500, reso: 1.5, drive: 0.2, pan: 0.05, level: 0.85 },
  { name: 'HI TOM', model: 'tom_high', choke: 0, attack: 0.002, decay: 0.22, sustain: 0.04, release: 0.12, pitchDepth: 9, pitchDecay: 0.055, cutoff: 6200, reso: 1.5, drive: 0.18, pan: 0.35, level: 0.84 },
  { name: 'CRASH 12', model: 'crash_12bit', choke: 2, attack: 0.004, decay: 1.15, sustain: 0.08, release: 0.55, pitchDepth: 0, pitchDecay: 0.04, cutoff: 16000, reso: 1.2, drive: 0.22, pan: -0.3, level: 0.78 },
  { name: 'RIDE 87', model: 'ride_12bit', choke: 2, attack: 0.002, decay: 0.78, sustain: 0.1, release: 0.36, pitchDepth: 0, pitchDecay: 0.03, cutoff: 15000, reso: 1.8, drive: 0.14, pan: 0.28, level: 0.78 },
  { name: 'BELL FM', model: 'cowbell_fm', choke: 0, attack: 0.001, decay: 0.26, sustain: 0.05, release: 0.14, pitchDepth: 3, pitchDecay: 0.02, cutoff: 9200, reso: 2.1, drive: 0.25, pan: 0.18, level: 0.82 },
];

const BANK_B_TEMPLATES: BaseVoiceTemplate[] = [
  { name: 'SUB KICK', model: 'kick_sub', choke: 0, attack: 0.003, decay: 0.62, sustain: 0.08, release: 0.24, pitchDepth: 14, pitchDecay: 0.075, cutoff: 2600, reso: 2.0, drive: 0.42, pan: 0, level: 0.96 },
  { name: 'CRACK SN', model: 'snare_crack', choke: 0, attack: 0.001, decay: 0.19, sustain: 0.05, release: 0.11, pitchDepth: 14, pitchDecay: 0.024, cutoff: 11800, reso: 1.8, drive: 0.44, pan: 0.04, level: 0.92 },
  { name: 'CLAVE 87', model: 'clave_wood', choke: 0, attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.05, pitchDepth: 4, pitchDecay: 0.015, cutoff: 7800, reso: 2.5, drive: 0.15, pan: -0.18, level: 0.82 },
  { name: 'SHAKER', model: 'shaker_grit', choke: 3, attack: 0.012, decay: 0.13, sustain: 0.02, release: 0.07, pitchDepth: 0, pitchDecay: 0.02, cutoff: 13800, reso: 1.4, drive: 0.2, pan: 0.26, level: 0.78 },
  { name: 'MET PERC', model: 'perc_metallic', choke: 3, attack: 0.001, decay: 0.34, sustain: 0.04, release: 0.18, pitchDepth: -6, pitchDecay: 0.09, cutoff: 10800, reso: 3.1, drive: 0.32, pan: -0.24, level: 0.84 },
  { name: 'ZAP 87', model: 'zap_electro', choke: 0, attack: 0.001, decay: 0.22, sustain: 0.02, release: 0.1, pitchDepth: 24, pitchDecay: 0.11, cutoff: 8800, reso: 2.6, drive: 0.36, pan: 0.15, level: 0.86 },
  { name: 'TAPE KCK', model: 'kick_87', choke: 0, attack: 0.004, decay: 0.44, sustain: 0.04, release: 0.18, pitchDepth: 15, pitchDecay: 0.06, cutoff: 3100, reso: 1.5, drive: 0.55, pan: 0, level: 0.94 },
  { name: 'GATE SNR', model: 'snare_87', choke: 0, attack: 0.001, decay: 0.32, sustain: 0.25, release: 0.08, pitchDepth: 6, pitchDecay: 0.028, cutoff: 8600, reso: 1.7, drive: 0.38, pan: 0, level: 0.9 },
  { name: 'PEDL HAT', model: 'hat_closed', choke: 1, attack: 0.002, decay: 0.055, sustain: 0.0, release: 0.03, pitchDepth: 0, pitchDecay: 0.02, cutoff: 11200, reso: 1.6, drive: 0.2, pan: -0.18, level: 0.79 },
  { name: 'DRY CLAP', model: 'clap_87', choke: 0, attack: 0.001, decay: 0.16, sustain: 0.02, release: 0.09, pitchDepth: 4, pitchDecay: 0.015, cutoff: 9400, reso: 1.4, drive: 0.25, pan: 0.12, level: 0.85 },
  { name: 'DEEP TOM', model: 'tom_low', choke: 0, attack: 0.003, decay: 0.48, sustain: 0.06, release: 0.22, pitchDepth: 16, pitchDecay: 0.12, cutoff: 2400, reso: 1.9, drive: 0.32, pan: -0.25, level: 0.87 },
  { name: 'ANLG COW', model: 'cowbell_fm', choke: 0, attack: 0.001, decay: 0.19, sustain: 0.04, release: 0.1, pitchDepth: -2, pitchDecay: 0.025, cutoff: 7600, reso: 2.3, drive: 0.3, pan: 0.22, level: 0.82 },
];

function buildVoicesForKit(spec: KitTemplateSpec, seedIndex: number): VoiceConfig[] {
  const voices: VoiceConfig[] = [];
  const allTemplates = [
    ...BANK_A_TEMPLATES,
    ...BANK_B_TEMPLATES,
    ...BANK_A_TEMPLATES.map((t, i) => ({
      ...t,
      name: `${t.name.split(' ')[0]} C${i + 1}`,
      cutoff: Math.max(400, Math.min(16500, t.cutoff * 0.82)),
      drive: Math.min(0.95, t.drive + 0.18),
    })),
    ...BANK_B_TEMPLATES.map((t, i) => ({
      ...t,
      name: `${t.name.split(' ')[0]} D${i + 1}`,
      cutoff: Math.max(400, Math.min(16500, t.cutoff * 1.12)),
      pitchDepth: Math.max(-24, Math.min(24, t.pitchDepth * -0.5)),
    })),
  ];

  for (let i = 0; i < 48; i++) {
    const padNum = i + 1;
    const tpl = allTemplates[i];
    const bankIdx = Math.floor(i / 12); // 0..3
    const padInBank = i % 12; // 0..11
    const harmonicJitter = ((seedIndex * 7 + i * 13) % 9) - 4;
    const bankTuneShift = bankIdx === 2 ? -3 : bankIdx === 3 ? 4 : 0;

    voices.push({
      pad: padNum,
      name: tpl.name,
      synth_model: tpl.model,
      note: 36 + padInBank + bankIdx * 12,
      midi_channel: (padInBank % 12) + 1, // Voice n -> Channel n (1..12 per bank)
      choke_group: tpl.choke,
      mute: false,
      solo: false,
      tune: Math.max(-24, Math.min(24, Math.round(spec.tuneOffset + bankTuneShift + harmonicJitter * 0.25))),
      level: tpl.level,
      pan: tpl.pan,
      filter_cutoff: Math.max(250, Math.min(17500, Math.round(tpl.cutoff * (spec.cutoff / 11500)))),
      filter_reso: Number(Math.max(0.4, Math.min(12, tpl.reso * (spec.reso / 1.4))).toFixed(2)),
      drive: Number(Math.min(1, Math.max(0, tpl.drive * 0.6 + spec.drive * 0.5)).toFixed(2)),
      amp_env: {
        attack: tpl.attack,
        decay: Number(Math.max(0.03, Math.min(2.6, tpl.decay * spec.decayScale)).toFixed(3)),
        sustain: tpl.sustain,
        release: Number(Math.max(0.02, Math.min(1.8, tpl.release * spec.decayScale)).toFixed(3)),
      },
      pitch_env: {
        depth: tpl.pitchDepth,
        decay: tpl.pitchDecay,
      },
    });
  }

  return voices;
}

const FACTORY_CATEGORIES: Array<{
  category: string;
  names: string[];
  bit: BitDepth;
  sr: SampleRateOption;
  filter: FilterType;
  cutoff: number;
  reso: number;
  drive: number;
  plateMix: number;
  plateDecay: number;
}> = [
  {
    category: "E-mu '87 Classics",
    names: ['DUST 87 FLAGSHIP', 'SILICON PUNCH', 'CURTIS SNAP', 'SP-1200 GRIT', 'EMU STUDIO 86', 'ANALOG CLOCK', 'PAGING ROM', 'CHASSIS THUMP'],
    bit: 12,
    sr: 26000,
    filter: 'resonant-lp',
    cutoff: 11200,
    reso: 1.8,
    drive: 0.36,
    plateMix: 0.24,
    plateDecay: 1.7,
  },
  {
    category: 'Lo-Fi 12-Bit Crunch',
    names: ['MAGNETIC OXIDE', 'CRUSHED VINYL', '8-BIT ALLEY', 'ALIAS ENGINE', 'TAPE DROPOUT', 'RUSTED CLOCK', 'PHOSPHOR NOISE', 'DUSTY SAMPLER'],
    bit: 8,
    sr: 11025,
    filter: 'resonant-lp',
    cutoff: 6800,
    reso: 2.6,
    drive: 0.62,
    plateMix: 0.3,
    plateDecay: 2.1,
  },
  {
    category: 'Boom Bap Dust',
    names: ['QUEENSBRIDGE 94', 'CRATE DIGGER', 'MPC SWING KING', 'WAX & NEEDLE', 'SUBWAY CONCRETE', 'SP-GHOST KIT', 'GOLDEN ERA 12', 'BRONX BASEMENT'],
    bit: 12,
    sr: 22050,
    filter: 'resonant-lp',
    cutoff: 8900,
    reso: 1.5,
    drive: 0.45,
    plateMix: 0.18,
    plateDecay: 1.4,
  },
  {
    category: 'Electro & Acid',
    names: ['DETROIT CHASSIS', 'VECTOR 808', 'SUB-HARMONIC', 'ZAP TELEMETRY', 'MODULAR PULSE', 'CYBERNETIC 87', 'MOTOR CITY FM', 'LASER TRIGGER'],
    bit: 12,
    sr: 26000,
    filter: 'resonant-bp',
    cutoff: 13400,
    reso: 3.2,
    drive: 0.4,
    plateMix: 0.28,
    plateDecay: 2.4,
  },
  {
    category: 'Industrial Tape',
    names: ['TURBINE CLANG', 'FOUNDRY GATE', 'REEL SATURATE', 'IRON PLATE 87', 'DISTORTED BUS', 'SERVO IMPACT', 'CARBON FIBER', 'COLD STEEL'],
    bit: 10,
    sr: 22050,
    filter: 'resonant-lp',
    cutoff: 9500,
    reso: 2.8,
    drive: 0.78,
    plateMix: 0.42,
    plateDecay: 3.4,
  },
  {
    category: 'Dub & Sub',
    names: ['DUB CHAMBER', 'KINGSTON PLATE', 'SUBMARINE 12B', 'SPRING & DUST', 'BASSWEIGHT', 'ECHO TERMINAL', 'DEEP PRESSURE', 'ANALOG DUBPLATE'],
    bit: 12,
    sr: 26000,
    filter: 'resonant-lp',
    cutoff: 5400,
    reso: 2.2,
    drive: 0.34,
    plateMix: 0.48,
    plateDecay: 3.8,
  },
  {
    category: 'Percussion Labs',
    names: ['FM METALLURGY', 'WOOD & BRASS', 'SHAKER MATRIX', 'CLAVE ORBIT', 'POLY RHYTHM 87', 'KINETIC PERC', 'TIMBALE 12-BIT', 'FOLEY MACHINE'],
    bit: 12,
    sr: 44100,
    filter: 'hp-clean',
    cutoff: 14800,
    reso: 1.6,
    drive: 0.2,
    plateMix: 0.26,
    plateDecay: 1.9,
  },
  {
    category: 'Experimental',
    names: ['ATMOS COLLAPSE', 'BITROT STUDY', 'NYQUIST GHOST', 'QUANTIZED SKY', 'CLOCK DRIFT', 'RESONANT HULL', 'ZERO CROSSING', 'ORBITAL DEBRIS'],
    bit: 8,
    sr: 11025,
    filter: 'resonant-bp',
    cutoff: 7600,
    reso: 4.4,
    drive: 0.68,
    plateMix: 0.52,
    plateDecay: 4.5,
  },
];

const STARTER_NAMES: Array<{ name: string; category: string; bit: BitDepth; sr: SampleRateOption; drive: number; plateMix: number; cutoff: number }> = [
  { name: 'INIT DUST 87', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.25, plateMix: 0.2, cutoff: 12500 },
  { name: 'CLEAN 16-BIT REF', category: 'Starter Kits', bit: 16, sr: 44100, drive: 0.08, plateMix: 0.12, cutoff: 17000 },
  { name: 'TIGHT PUNCH KIT', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.38, plateMix: 0.14, cutoff: 11000 },
  { name: 'WARM LO-FI SKETCH', category: 'Starter Kits', bit: 12, sr: 22050, drive: 0.42, plateMix: 0.25, cutoff: 8200 },
  { name: 'DRY STUDIO 87', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.22, plateMix: 0.0, cutoff: 14200 },
  { name: 'CRUNCH 8-BIT PAD', category: 'Starter Kits', bit: 8, sr: 11025, drive: 0.55, plateMix: 0.22, cutoff: 7400 },
  { name: 'PLATE ARENA KIT', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.3, plateMix: 0.45, cutoff: 11800 },
  { name: 'SNAP & CLAP', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.34, plateMix: 0.26, cutoff: 12800 },
  { name: 'SUB BASS FOUNDATION', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.4, plateMix: 0.18, cutoff: 6400 },
  { name: 'BRIGHT ELECTRO', category: 'Starter Kits', bit: 12, sr: 44100, drive: 0.28, plateMix: 0.24, cutoff: 15600 },
  { name: 'PERC GROOVE BOX', category: 'Starter Kits', bit: 10, sr: 22050, drive: 0.32, plateMix: 0.28, cutoff: 12200 },
  { name: 'MINIMAL TECH 87', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.35, plateMix: 0.16, cutoff: 10200 },
  { name: 'VINYL BREAKS', category: 'Starter Kits', bit: 12, sr: 22050, drive: 0.48, plateMix: 0.19, cutoff: 8800 },
  { name: 'SNAPPY HOUSE 87', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.3, plateMix: 0.22, cutoff: 13200 },
  { name: 'HALF-TIME HEAVY', category: 'Starter Kits', bit: 10, sr: 22050, drive: 0.52, plateMix: 0.32, cutoff: 7900 },
  { name: 'BLANK TEMPLATE 12B', category: 'Starter Kits', bit: 12, sr: 26000, drive: 0.15, plateMix: 0.15, cutoff: 16000 },
];

export function generateFactoryAndStarterPresets(): Dust87Preset[] {
  const presets: Dust87Preset[] = [];

  // 64 Factory Presets (8 categories * 8 presets = 64)
  let factoryIndex = 0;
  for (const cat of FACTORY_CATEGORIES) {
    cat.names.forEach((name, idx) => {
      factoryIndex++;
      const spec: KitTemplateSpec = {
        name,
        category: cat.category,
        bit: cat.bit,
        sr: cat.sr,
        filter: cat.filter,
        cutoff: Math.max(2200, Math.min(17200, cat.cutoff + (idx - 3.5) * 450)),
        reso: Number(Math.max(0.8, Math.min(8, cat.reso + (idx % 3) * 0.35)).toFixed(2)),
        drive: Number(Math.min(0.95, Math.max(0.05, cat.drive + (idx - 3) * 0.04)).toFixed(2)),
        plateMix: Number(Math.min(0.75, Math.max(0.05, cat.plateMix + (idx % 4) * 0.04)).toFixed(2)),
        plateDecay: Number(Math.min(5.5, Math.max(0.6, cat.plateDecay + (idx % 3) * 0.3)).toFixed(2)),
        tuneOffset: ((idx % 5) - 2) * 1.5,
        decayScale: Number((0.82 + (idx % 5) * 0.12).toFixed(2)),
        qlinks: ['filter_cutoff', 'drive', 'decay', 'pitch'],
      };

      presets.push({
        schema: 'lumina.plugin/v1',
        id: `factory-${String(factoryIndex).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        version: 'v0.1.0',
        license: 'GPL-3.0-only',
        category: cat.category,
        bank_type: 'factory',
        author: 'Lumina.Aerospace',
        engine: {
          bit: spec.bit,
          sr: [spec.sr, 44100],
          filter: spec.filter,
          filter_cutoff: Math.round(spec.cutoff),
          filter_reso: spec.reso,
          drive: spec.drive,
        },
        voices: buildVoicesForKit(spec, factoryIndex),
        fx: {
          plate: {
            enabled: spec.plateMix > 0.02,
            mix: spec.plateMix,
            decay: spec.plateDecay,
          },
        },
        qlinks: spec.qlinks,
        randomizer: {
          pitch: [-12, 12],
          drive: [0, 1],
        },
        sequencer: generateGrooveForPreset(factoryIndex - 1, cat.category).pattern,
      });
    });
  }

  // 16 Starter Presets
  STARTER_NAMES.forEach((item, idx) => {
    const starterNum = idx + 1;
    const spec: KitTemplateSpec = {
      name: item.name,
      category: item.category,
      bit: item.bit,
      sr: item.sr,
      filter: 'resonant-lp',
      cutoff: item.cutoff,
      reso: 1.4,
      drive: item.drive,
      plateMix: item.plateMix,
      plateDecay: 1.8,
      tuneOffset: 0,
      decayScale: 1.0,
      qlinks: ['filter_cutoff', 'drive', 'decay', 'pitch'],
    };

    presets.push({
      schema: 'lumina.plugin/v1',
      id: `starter-${String(starterNum).padStart(2, '0')}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: item.name,
      version: 'v0.1.0',
      license: 'GPL-3.0-only',
      category: item.category,
      bank_type: 'starter',
      author: 'Lumina.Aerospace',
      engine: {
        bit: spec.bit,
        sr: [spec.sr, 44100],
        filter: spec.filter,
        filter_cutoff: spec.cutoff,
        filter_reso: spec.reso,
        drive: spec.drive,
      },
      voices: buildVoicesForKit(spec, 100 + starterNum),
      fx: {
        plate: {
          enabled: item.plateMix > 0.01,
          mix: item.plateMix,
          decay: 1.8,
        },
      },
      qlinks: ['filter_cutoff', 'drive', 'decay', 'pitch'],
      randomizer: {
        pitch: [-12, 12],
        drive: [0, 1],
      },
      sequencer: generateGrooveForPreset(64 + idx, item.category).pattern,
    });
  });

  return presets;
}

export const BUILTIN_PRESETS: Dust87Preset[] = generateFactoryAndStarterPresets();
