import type { SequencerPattern } from './types.ts';

export interface NamedGroovePreset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  swing: number;
  pattern: SequencerPattern;
}

type PadHitSpec = Array<[number, number]>; // [step (0..63), velocity (1..127)]

function emptySteps(): Record<number, number[]> {
  const steps: Record<number, number[]> = {};
  for (let p = 1; p <= 12; p++) {
    steps[p] = new Array(64).fill(0);
  }
  return steps;
}

function makePattern(
  bpm: number,
  swing: number,
  lanes: Partial<Record<number, PadHitSpec>>
): SequencerPattern {
  const steps = emptySteps();
  for (const [padStr, hits] of Object.entries(lanes)) {
    const pad = Number(padStr);
    if (!steps[pad]) steps[pad] = new Array(64).fill(0);
    if (!hits) continue;
    for (const [step, vel] of hits) {
      if (step >= 0 && step < 64) {
        steps[pad][step] = Math.max(1, Math.min(127, Math.round(vel)));
      }
    }
  }
  return { enabled: false, bpm, swing, steps };
}

function repeat16(
  bar1: number[],
  vel = 105,
  bar2Override?: number[],
  bar4Fill?: number[]
): PadHitSpec {
  const out: PadHitSpec = [];
  for (let bar = 0; bar < 4; bar++) {
    const src =
      bar === 3 && bar4Fill
        ? bar4Fill
        : bar === 1 && bar2Override
        ? bar2Override
        : bar1;
    for (let s = 0; s < 16; s++) {
      const v = src[s] ?? 0;
      if (v > 0) {
        out.push([bar * 16 + s, v === 1 ? vel : v]);
      }
    }
  }
  return out;
}

interface GrooveBlueprint {
  name: string;
  genre: string;
  bpm: number;
  swing: number;
  kick: number[];
  kickB2?: number[];
  kickB4?: number[];
  snare?: number[];
  snareB2?: number[];
  snareB4?: number[];
  rim?: number[];
  rimB4?: number[];
  clap?: number[];
  hatC?: number[];
  hatO?: number[];
  ride?: number[];
  tomL?: number[];
  tomM?: number[];
  tomH?: number[];
  crash?: number[];
  bell?: number[];
}

const GROOVE_BLUEPRINTS: GrooveBlueprint[] = [
  // 0: 60s Jazz Ride Triplets (inspired by Early Kit 03 Jazz / 134BPM Triplets)
  {
    name: '60s Jazz Ride Swing',
    genre: 'Jazz',
    bpm: 134,
    swing: 0.32,
    kick: [62, 0, 0, 0, 0, 0, 56, 0, 58, 0, 0, 0, 0, 0, 0, 52],
    snare: [0, 0, 0, 54, 0, 0, 0, 0, 0, 0, 62, 0, 0, 58, 0, 0],
    snareB4: [0, 0, 0, 64, 0, 74, 0, 0, 82, 0, 88, 0, 96, 0, 108, 92],
    rim: [0, 0, 0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 0, 0, 82, 0],
    hatC: [0, 0, 0, 0, 94, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0],
    ride: [112, 0, 0, 78, 106, 0, 0, 84, 110, 0, 0, 76, 106, 0, 0, 86],
    tomM: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // 1: Clyde Funky Break
  {
    name: 'Funky Breakbeat 16',
    genre: 'Funk',
    bpm: 102,
    swing: 0.14,
    kick: [122, 0, 96, 0, 0, 0, 88, 0, 0, 0, 114, 0, 0, 82, 0, 0],
    kickB4: [122, 0, 96, 0, 0, 0, 104, 0, 0, 94, 0, 0, 116, 0, 0, 92],
    snare: [0, 0, 0, 0, 118, 0, 0, 56, 0, 62, 0, 0, 116, 0, 0, 64],
    snareB4: [0, 0, 0, 0, 118, 0, 58, 0, 78, 0, 92, 0, 116, 86, 104, 112],
    hatC: [108, 64, 92, 58, 106, 62, 88, 60, 108, 66, 90, 58, 104, 0, 92, 68],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0],
  },
  // 2: Purdie Half-Time Shuffle
  {
    name: 'Half-Time Shuffle',
    genre: 'Shuffle',
    bpm: 94,
    swing: 0.34,
    kick: [120, 0, 0, 0, 0, 0, 86, 0, 0, 0, 108, 0, 0, 0, 0, 74],
    snare: [0, 0, 0, 52, 0, 0, 0, 0, 122, 0, 0, 54, 0, 0, 0, 58],
    snareB4: [0, 0, 0, 56, 0, 0, 68, 0, 122, 0, 78, 0, 94, 0, 112, 84],
    hatC: [106, 0, 62, 84, 104, 0, 64, 82, 108, 0, 62, 84, 104, 0, 68, 0],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96],
  },
  // 3: Detroit Electro 808 Sync
  {
    name: 'Detroit Electro Pulse',
    genre: 'Electro',
    bpm: 126,
    swing: 0.02,
    kick: [126, 0, 0, 108, 0, 0, 116, 0, 0, 0, 104, 0, 0, 114, 0, 0],
    snare: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 82],
    clap: [0, 0, 0, 0, 106, 0, 0, 0, 0, 0, 0, 0, 112, 0, 96, 0],
    hatC: [98, 72, 92, 70, 102, 74, 88, 68, 98, 72, 92, 0, 104, 76, 94, 72],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0, 0, 0, 0],
    bell: [100, 0, 0, 88, 0, 0, 96, 0, 0, 92, 0, 0, 98, 0, 0, 0],
  },
  // 4: Queensbridge Boom-Bap Stagger
  {
    name: 'Queensbridge 94 Swing',
    genre: 'Boom Bap',
    bpm: 89,
    swing: 0.24,
    kick: [124, 0, 0, 92, 0, 0, 0, 84, 0, 0, 116, 0, 0, 0, 94, 0],
    kickB2: [124, 0, 0, 0, 0, 0, 0, 96, 112, 0, 118, 0, 0, 0, 0, 82],
    snare: [0, 0, 0, 0, 120, 0, 0, 0, 0, 0, 0, 0, 122, 0, 0, 62],
    rim: [0, 0, 74, 0, 0, 0, 0, 0, 0, 78, 0, 0, 0, 0, 0, 0],
    hatC: [96, 0, 74, 0, 98, 0, 76, 0, 94, 0, 72, 0, 98, 0, 0, 0],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92, 0],
  },
  // 5: Reggae One-Drop Kingston
  {
    name: 'Kingston One-Drop',
    genre: 'Dub / Reggae',
    bpm: 78,
    swing: 0.16,
    kick: [0, 0, 0, 0, 0, 0, 0, 0, 124, 0, 0, 0, 0, 0, 0, 0],
    kickB4: [0, 0, 0, 0, 0, 0, 0, 0, 124, 0, 102, 0, 0, 0, 0, 0],
    rim: [0, 0, 0, 0, 96, 0, 0, 82, 118, 0, 0, 0, 0, 86, 0, 0],
    snareB4: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92, 100, 108, 0, 114, 0],
    hatC: [88, 56, 78, 62, 92, 54, 80, 60, 88, 56, 78, 62, 92, 54, 0, 66],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 88, 0],
  },
  // 6: Bossa Nova / 3-2 Son Clave
  {
    name: 'Bossa 3-2 Clave',
    genre: 'Latin / Jazz',
    bpm: 118,
    swing: 0.04,
    kick: [112, 0, 0, 94, 108, 0, 0, 92, 112, 0, 0, 94, 108, 0, 0, 92],
    rim: [114, 0, 0, 110, 0, 0, 108, 0, 0, 0, 106, 0, 110, 0, 0, 0],
    hatC: [86, 72, 84, 72, 88, 72, 84, 72, 86, 72, 84, 72, 88, 72, 84, 72],
    tomL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 86, 0],
    tomH: [0, 0, 0, 0, 0, 0, 0, 82, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // 7: UK Garage 2-Step Skippy
  {
    name: 'UKG 2-Step Skip',
    genre: '2-Step',
    bpm: 132,
    swing: 0.22,
    kick: [122, 0, 0, 0, 0, 0, 0, 96, 0, 0, 112, 0, 0, 0, 0, 0],
    kickB2: [122, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 98, 0, 0],
    snare: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 116, 0, 0, 68],
    rim: [0, 0, 0, 84, 0, 0, 0, 0, 0, 88, 0, 0, 0, 0, 92, 0],
    hatC: [0, 0, 98, 64, 0, 0, 94, 0, 0, 0, 98, 64, 0, 0, 92, 68],
    hatO: [0, 0, 0, 0, 0, 0, 0, 92, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // 8: Jungle Amen Chop
  {
    name: 'Amen Chop 164',
    genre: 'Breakbeat',
    bpm: 164,
    swing: 0.04,
    kick: [126, 0, 110, 0, 0, 0, 0, 0, 0, 0, 118, 102, 0, 0, 0, 0],
    kickB4: [126, 0, 0, 0, 0, 0, 108, 0, 0, 0, 118, 0, 0, 0, 104, 0],
    snare: [0, 0, 0, 0, 122, 0, 0, 74, 0, 86, 0, 0, 120, 0, 76, 0],
    snareB4: [0, 0, 0, 0, 122, 0, 74, 0, 0, 94, 0, 112, 0, 88, 118, 106],
    ride: [104, 0, 96, 0, 106, 0, 94, 0, 104, 0, 96, 0, 106, 0, 98, 0],
    crash: [112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // 9: Industrial 4/4 Anvil
  {
    name: 'Industrial Turbine 4/4',
    genre: 'Industrial',
    bpm: 128,
    swing: 0.0,
    kick: [127, 0, 0, 0, 124, 0, 0, 0, 127, 0, 0, 0, 124, 0, 0, 96],
    snare: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0],
    clap: [0, 0, 0, 0, 110, 0, 0, 76, 0, 0, 0, 0, 114, 0, 92, 0],
    hatC: [78, 86, 98, 84, 78, 88, 102, 84, 78, 86, 98, 84, 78, 88, 104, 88],
    hatO: [0, 0, 106, 0, 0, 0, 106, 0, 0, 0, 106, 0, 0, 0, 108, 0],
    bell: [104, 0, 0, 92, 0, 0, 98, 0, 104, 0, 0, 92, 0, 108, 0, 0],
  },
  // 10: Afrobeat Tony Allen Drive
  {
    name: 'Lagos Afrobeat Pocket',
    genre: 'Afrobeat',
    bpm: 112,
    swing: 0.1,
    kick: [118, 0, 0, 92, 0, 0, 104, 0, 116, 0, 0, 0, 0, 96, 0, 0],
    snare: [0, 0, 0, 0, 96, 0, 0, 108, 0, 0, 76, 0, 112, 0, 88, 0],
    rim: [108, 0, 0, 102, 0, 0, 106, 0, 0, 0, 104, 0, 108, 0, 0, 0],
    hatC: [98, 72, 92, 76, 96, 70, 90, 74, 98, 72, 92, 76, 96, 70, 94, 0],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 98],
    tomL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0, 84],
  },
  // 11: Dub Steppers Militant
  {
    name: 'Dub Steppers Militant',
    genre: 'Dub',
    bpm: 136,
    swing: 0.08,
    kick: [126, 0, 0, 0, 120, 0, 0, 0, 124, 0, 0, 0, 120, 0, 96, 0],
    rim: [0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0, 0, 88],
    clap: [0, 0, 0, 0, 104, 0, 0, 0, 0, 0, 0, 0, 108, 0, 0, 0],
    hatC: [94, 68, 86, 72, 94, 68, 86, 72, 94, 68, 86, 72, 94, 68, 86, 72],
    bell: [0, 0, 92, 0, 0, 0, 88, 0, 0, 0, 92, 0, 0, 0, 0, 0],
  },
  // 12: Motorik Krautrock 8th
  {
    name: 'Motorik Autobahn 8th',
    genre: 'Motorik',
    bpm: 138,
    swing: 0.0,
    kick: [122, 0, 98, 0, 118, 0, 98, 0, 122, 0, 98, 0, 118, 0, 104, 0],
    snare: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0],
    snareB4: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 92, 0, 120, 0, 108, 0],
    hatC: [108, 0, 94, 0, 108, 0, 94, 0, 108, 0, 94, 0, 108, 0, 94, 0],
    ride: [0, 74, 0, 74, 0, 74, 0, 74, 0, 74, 0, 74, 0, 74, 0, 74],
  },
  // 13: J-Dilla Unquantized Bounce
  {
    name: 'Drunk MPC Bounce',
    genre: 'Neo-Soul',
    bpm: 84,
    swing: 0.28,
    kick: [122, 0, 0, 0, 0, 0, 96, 0, 0, 108, 0, 0, 0, 0, 88, 0],
    kickB2: [122, 0, 0, 88, 0, 0, 0, 0, 0, 114, 0, 0, 0, 92, 0, 0],
    snare: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 56, 120, 0, 0, 0],
    rim: [0, 0, 0, 0, 0, 0, 0, 78, 0, 0, 0, 0, 0, 0, 0, 84],
    hatC: [94, 0, 68, 0, 96, 0, 64, 0, 92, 0, 70, 0, 96, 0, 68, 0],
  },
  // 14: Samba Partido Alto
  {
    name: 'Samba Partido Alto',
    genre: 'Brazilian',
    bpm: 108,
    swing: 0.08,
    kick: [120, 0, 0, 104, 114, 0, 0, 96, 120, 0, 0, 104, 114, 0, 0, 96],
    rim: [110, 0, 98, 0, 0, 106, 0, 96, 0, 104, 0, 0, 108, 0, 96, 0],
    hatC: [92, 76, 86, 74, 92, 76, 86, 74, 92, 76, 86, 74, 92, 76, 86, 74],
    tomH: [0, 0, 0, 0, 0, 0, 94, 0, 0, 0, 0, 0, 0, 0, 98, 0],
    tomL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92, 0, 0, 0, 96],
  },
  // 15: Half-Time Trap / Sub 808
  {
    name: 'Sub-808 Half-Time',
    genre: 'Half-Time',
    bpm: 72,
    swing: 0.05,
    kick: [127, 0, 0, 0, 0, 0, 108, 0, 0, 0, 116, 0, 0, 0, 0, 94],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 122, 0, 0, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 114, 0, 0, 0, 0, 0, 96, 0],
    hatC: [98, 72, 92, 76, 98, 92, 96, 84, 98, 74, 90, 74, 98, 96, 96, 92],
    hatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0],
  },
  // 16: Euclidean 5/16 Polyrhythm
  {
    name: 'Euclidean 5/16 Orbit',
    genre: 'Polyrhythm',
    bpm: 116,
    swing: 0.0,
    kick: [122, 0, 0, 108, 0, 0, 116, 0, 0, 0, 112, 0, 0, 104, 0, 0],
    rim: [0, 0, 102, 0, 0, 106, 0, 0, 104, 0, 0, 108, 0, 0, 100, 0],
    snare: [0, 0, 0, 0, 116, 0, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0],
    hatC: [96, 0, 82, 0, 96, 0, 82, 0, 96, 0, 82, 0, 96, 0, 82, 0],
    bell: [104, 0, 0, 0, 0, 96, 0, 0, 0, 0, 102, 0, 0, 0, 0, 0],
  },
  // 17: Motown Four-on-the-Floor
  {
    name: 'Motown Backbeat',
    genre: 'Soul',
    bpm: 120,
    swing: 0.1,
    kick: [118, 0, 0, 0, 112, 0, 0, 0, 118, 0, 0, 0, 112, 0, 0, 0],
    snare: [0, 0, 0, 0, 120, 0, 0, 0, 0, 0, 0, 0, 122, 0, 0, 74],
    clap: [0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0],
    hatC: [98, 0, 88, 0, 98, 0, 88, 0, 98, 0, 88, 0, 98, 0, 88, 0],
    ride: [104, 0, 92, 0, 104, 0, 92, 0, 104, 0, 92, 0, 104, 0, 92, 0],
  },
  // 18: Miami Bass 808 Bounce
  {
    name: 'Miami Bass Sync',
    genre: 'Electro Bass',
    bpm: 129,
    swing: 0.0,
    kick: [127, 0, 0, 112, 0, 0, 118, 0, 0, 114, 0, 0, 120, 0, 0, 0],
    clap: [0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0],
    hatC: [96, 84, 96, 84, 96, 84, 96, 84, 96, 84, 96, 84, 96, 84, 96, 84],
    bell: [106, 0, 94, 0, 0, 96, 0, 98, 106, 0, 94, 0, 0, 96, 0, 0],
    tomH: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0],
    tomL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 106],
  },
  // 19: Chicago Acid House
  {
    name: 'Chicago Jack 87',
    genre: 'House',
    bpm: 122,
    swing: 0.06,
    kick: [124, 0, 0, 0, 122, 0, 0, 0, 124, 0, 0, 0, 122, 0, 0, 0],
    clap: [0, 0, 0, 0, 116, 0, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0],
    rim: [0, 0, 0, 92, 0, 0, 96, 0, 0, 0, 92, 0, 0, 0, 98, 0],
    hatC: [78, 0, 0, 0, 78, 0, 0, 0, 78, 0, 0, 0, 78, 0, 0, 0],
    hatO: [0, 0, 112, 0, 0, 0, 112, 0, 0, 0, 112, 0, 0, 0, 112, 0],
  },
];

function mutateHitArray(base: number[], seed: number, laneSalt: number): number[] {
  const out = [...base];
  // Deterministically vary accents, ghost notes, and syncopations per kit index so all 80 grooves are distinct
  const shiftSlot = (seed * 3 + laneSalt * 5) % 16;
  const ghostSlot = (seed * 7 + laneSalt * 11 + 3) % 16;
  if (out[shiftSlot] === 0 && shiftSlot % 4 !== 0) {
    out[shiftSlot] = 66 + ((seed * 13) % 32);
  }
  if (out[ghostSlot] > 0 && ghostSlot !== 0 && ghostSlot !== 4 && ghostSlot !== 12) {
    out[ghostSlot] = Math.max(48, Math.min(124, out[ghostSlot] + (((seed + laneSalt) % 3) - 1) * 14));
  }
  return out;
}

export function generateGrooveForPreset(presetIndex: number, category: string): NamedGroovePreset {
  // Match category bias first, then cycle across all 20 blueprints with unique per-preset variations
  const catLower = category.toLowerCase();
  let preferredPool = GROOVE_BLUEPRINTS.map((_, i) => i);

  if (catLower.includes('boom bap')) {
    preferredPool = [4, 1, 2, 13, 15, 0, 7, 17];
  } else if (catLower.includes('electro')) {
    preferredPool = [3, 18, 19, 9, 12, 8, 16, 11];
  } else if (catLower.includes('industrial')) {
    preferredPool = [9, 12, 16, 3, 8, 11, 18, 19];
  } else if (catLower.includes('dub')) {
    preferredPool = [5, 11, 15, 2, 10, 6, 13, 16];
  } else if (catLower.includes('percussion')) {
    preferredPool = [6, 10, 14, 16, 0, 2, 17, 7];
  } else if (catLower.includes('experimental')) {
    preferredPool = [16, 8, 9, 0, 12, 13, 15, 7];
  } else if (catLower.includes('lo-fi')) {
    preferredPool = [13, 4, 2, 1, 5, 0, 15, 7];
  }

  const bpIdx = preferredPool[presetIndex % preferredPool.length];
  const bp = GROOVE_BLUEPRINTS[bpIdx];

  // Ensure unique BPM, swing, and per-bar ghost/tom fill variation across all 80 kits
  const bpmJitter = ((presetIndex * 5) % 11) - 5;
  const bpm = Math.max(66, Math.min(170, bp.bpm + bpmJitter));
  const swing = Number(Math.max(0, Math.min(0.36, bp.swing + (((presetIndex % 5) - 2) * 0.02))).toFixed(2));

  const kickB1 = mutateHitArray(bp.kick, presetIndex, 1);
  const kickB2 = mutateHitArray(bp.kickB2 || bp.kick, presetIndex + 1, 2);
  const kickB4 = mutateHitArray(bp.kickB4 || bp.kick, presetIndex + 3, 3);
  const empty16 = new Array(16).fill(0);
  const snareB1 = bp.snare ? mutateHitArray(bp.snare, presetIndex, 4) : empty16;
  const snareB2 = bp.snare || bp.snareB2 ? mutateHitArray(bp.snareB2 || bp.snare || empty16, presetIndex + 2, 5) : empty16;
  const snareB4 =
    bp.snareB4 || bp.snare ? mutateHitArray(bp.snareB4 || bp.snare || empty16, presetIndex + 4, 6) : empty16;

  // Add distinct bar-4 tom/percussion turnarounds depending on presetIndex
  const tomFillHigh = new Array(16).fill(0);
  const tomFillMid = new Array(16).fill(0);
  const tomFillLow = new Array(16).fill(0);
  if (presetIndex % 3 === 0) {
    tomFillHigh[11] = 96;
    tomFillMid[13] = 104;
    tomFillLow[15] = 112;
  } else if (presetIndex % 3 === 1) {
    tomFillHigh[12] = 94;
    tomFillMid[14] = 102;
    tomFillLow[15] = 108;
  } else {
    tomFillMid[10] = 92;
    tomFillLow[12] = 102;
    tomFillLow[14] = 110;
  }

  const lanes: Partial<Record<number, PadHitSpec>> = {
    1: repeat16(kickB1, 120, kickB2, kickB4),
    7: repeat16(bp.tomL || empty16, 102, undefined, tomFillLow),
    8: repeat16(bp.tomM || empty16, 100, undefined, tomFillMid),
    9: repeat16(bp.tomH || empty16, 98, undefined, tomFillHigh),
  };

  if (bp.snare || bp.snareB2 || bp.snareB4) {
    lanes[2] = repeat16(snareB1, 114, snareB2, snareB4);
  }

  if (bp.rim) lanes[3] = repeat16(mutateHitArray(bp.rim, presetIndex, 7), 104, undefined, bp.rimB4);
  if (bp.clap) lanes[4] = repeat16(mutateHitArray(bp.clap, presetIndex, 8), 108);
  if (bp.hatC) lanes[5] = repeat16(mutateHitArray(bp.hatC, presetIndex, 9), 92);
  if (bp.hatO) lanes[6] = repeat16(bp.hatO, 98);
  if (bp.crash) lanes[10] = [[0, 108]];
  if (bp.ride) lanes[11] = repeat16(mutateHitArray(bp.ride, presetIndex, 10), 102);
  if (bp.bell) lanes[12] = repeat16(mutateHitArray(bp.bell, presetIndex, 11), 98);

  return {
    id: `groove-${String(presetIndex + 1).padStart(2, '0')}`,
    name: `${bp.name} #${(presetIndex % 8) + 1}`,
    genre: bp.genre,
    bpm,
    swing,
    pattern: makePattern(bpm, swing, lanes),
  };
}

export const BUILTIN_GROOVES: NamedGroovePreset[] = Array.from({ length: 80 }).map((_, idx) =>
  generateGrooveForPreset(idx, idx < 8 ? 'E-mu' : idx < 16 ? 'Lo-Fi' : idx < 24 ? 'Boom Bap' : idx < 32 ? 'Electro' : idx < 40 ? 'Industrial' : idx < 48 ? 'Dub' : idx < 56 ? 'Percussion' : idx < 64 ? 'Experimental' : 'Starter')
);

export function generateRandomGroove(preserveBpm?: number): NamedGroovePreset {
  const bpIdx = Math.floor(Math.random() * GROOVE_BLUEPRINTS.length);
  const bp = GROOVE_BLUEPRINTS[bpIdx];
  const seed = Math.floor(Math.random() * 10000);
  const empty16 = new Array(16).fill(0);

  const randomizeLane = (base: number[] | undefined, probAdd: number, probDrop: number): number[] => {
    const src = base ? [...base] : [...empty16];
    for (let s = 0; s < 16; s++) {
      if (src[s] > 0) {
        if (s !== 0 && s !== 4 && s !== 12 && Math.random() < probDrop) {
          src[s] = 0;
        } else {
          src[s] = Math.max(45, Math.min(127, Math.round(src[s] + (Math.random() - 0.5) * 24)));
        }
      } else if (Math.random() < probAdd) {
        src[s] = Math.round(62 + Math.random() * 48);
      }
    }
    return src;
  };

  const kickB1 = randomizeLane(bp.kick, 0.14, 0.12);
  const kickB2 = randomizeLane(bp.kickB2 || kickB1, 0.18, 0.14);
  const kickB4 = randomizeLane(bp.kickB4 || kickB1, 0.22, 0.14);

  const hasSnare = Boolean(bp.snare || Math.random() > 0.3);
  const snareBase = bp.snare || [0, 0, 0, 0, 114, 0, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0];
  const snareB1 = hasSnare ? randomizeLane(snareBase, 0.12, 0.08) : empty16;
  const snareB2 = hasSnare ? randomizeLane(bp.snareB2 || snareB1, 0.16, 0.08) : empty16;
  const snareB4 = hasSnare ? randomizeLane(bp.snareB4 || snareB1, 0.28, 0.05) : empty16;

  // Randomized bar-4 tom turnaround
  const tomFillH = [...empty16];
  const tomFillM = [...empty16];
  const tomFillL = [...empty16];
  for (let s = 10; s < 16; s++) {
    const roll = Math.random();
    if (roll < 0.28) tomFillH[s] = Math.round(85 + Math.random() * 32);
    else if (roll < 0.52) tomFillM[s] = Math.round(88 + Math.random() * 32);
    else if (roll < 0.72) tomFillL[s] = Math.round(92 + Math.random() * 32);
  }

  const bpm = preserveBpm ?? Math.max(70, Math.min(168, bp.bpm + Math.round((Math.random() - 0.5) * 14)));
  const swing = Number(Math.max(0, Math.min(0.34, bp.swing + (Math.random() - 0.5) * 0.12)).toFixed(2));

  const lanes: Partial<Record<number, PadHitSpec>> = {
    1: repeat16(kickB1, 120, kickB2, kickB4),
    2: repeat16(snareB1, 114, snareB2, snareB4),
    5: repeat16(randomizeLane(bp.hatC, 0.18, 0.16), 92),
    7: repeat16(bp.tomL || empty16, 102, undefined, tomFillL),
    8: repeat16(bp.tomM || empty16, 100, undefined, tomFillM),
    9: repeat16(bp.tomH || empty16, 98, undefined, tomFillH),
  };

  if (bp.rim || Math.random() > 0.45) {
    lanes[3] = repeat16(randomizeLane(bp.rim, 0.16, 0.15), 102, undefined, bp.rimB4);
  }
  if (bp.clap || Math.random() > 0.5) {
    lanes[4] = repeat16(randomizeLane(bp.clap || [0, 0, 0, 0, 102, 0, 0, 0, 0, 0, 0, 0, 106, 0, 0, 0], 0.08, 0.15), 106);
  }
  if (bp.hatO || Math.random() > 0.35) {
    lanes[6] = repeat16(randomizeLane(bp.hatO || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0], 0.12, 0.15), 96);
  }
  if (bp.crash || Math.random() > 0.65) {
    lanes[10] = [[0, 108]];
  }
  if (bp.ride || Math.random() > 0.6) {
    lanes[11] = repeat16(randomizeLane(bp.ride, 0.15, 0.15), 98);
  }
  if (bp.bell || Math.random() > 0.55) {
    lanes[12] = repeat16(randomizeLane(bp.bell, 0.14, 0.2), 96);
  }

  return {
    id: `rnd-seq-${seed}`,
    name: `RND ${bp.genre} #${(seed % 99) + 1}`,
    genre: bp.genre,
    bpm,
    swing,
    pattern: makePattern(bpm, swing, lanes),
  };
}
