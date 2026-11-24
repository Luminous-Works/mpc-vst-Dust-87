import type { SequencerPattern } from './types.ts';

export interface ParsedMidiGroove {
  name: string;
  bpm: number;
  bars: number;
  noteCount: number;
  pattern: SequencerPattern;
}

/**
 * Maps General MIDI Drum Note Numbers (35..81) to DUST '87 Pads (1..24).
 */
function gmNoteToDustPad(note: number): number {
  if (note === 35 || note === 36) return 1; // Kick
  if (note === 38 || note === 40) return 2; // Snare
  if (note === 37) return 3; // Rimshot / Side Stick
  if (note === 39) return 4; // Hand Clap
  if (note === 42 || note === 44) return 5; // Closed / Pedal Hi-Hat
  if (note === 46) return 6; // Open Hi-Hat
  if (note === 41 || note === 43) return 7; // Low Tom
  if (note === 45 || note === 47) return 8; // Mid Tom
  if (note === 48 || note === 50) return 9; // High Tom
  if (note === 49 || note === 52 || note === 55 || note === 57) return 10; // Crash / Splash / China
  if (note === 51 || note === 53 || note === 59) return 11; // Ride / Ride Bell
  if (note === 56) return 12; // Cowbell
  if (note === 54 || note === 69 || note === 70) return 16; // Tambourine / Shaker (Bank B)
  if (note === 75 || note === 76 || note === 77) return 15; // Clave / Woodblock (Bank B)
  if (note >= 60 && note <= 68) return 17; // Bongos / Congas / Timbales -> Metallic/Perc
  if (note >= 71 && note <= 81) return 18; // Misc Percussion
  // Fallback modulo across Bank A
  return ((note - 36 + 120) % 12) + 1;
}

export function isValidMidiFilename(filename: string): boolean {
  const base = filename.split('/').pop()?.split('\\').pop() || filename;
  // Ignore macOS AppleDouble resource-fork metadata files (e.g. ._07 8th Ride Multi.mid)
  if (base.startsWith('._') || filename.includes('__MACOSX')) return false;
  return /\.midi?$/i.test(base);
}

/**
 * Zero-dependency Standard MIDI File (SMF Format 0 & 1) binary parser.
 * Extracts tempo (BPM), note events, and quantizes 1-4 bars into 64 16th-note steps.
 */
export function parseMidiBufferToGroove(buffer: ArrayBuffer, filename: string): ParsedMidiGroove {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (bytes.length < 14) {
    throw new Error('File too small to be a valid Standard MIDI File.');
  }

  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'MThd') {
    throw new Error(`Invalid MIDI header "${magic}" (AppleDouble or non-SMF file).`);
  }

  const headerLen = view.getUint32(4, false);
  const numTracks = view.getUint16(10, false);
  const division = view.getUint16(12, false);

  if ((division & 0x8000) !== 0) {
    throw new Error('SMPTE timecode MIDI division is not supported.');
  }
  const ppq = Math.max(24, division);

  let offset = 8 + headerLen;
  let bpm = 110;
  const rawEvents: Array<{ tick: number; note: number; velocity: number }> = [];

  for (let trk = 0; trk < numTracks && offset + 8 <= bytes.length; trk++) {
    const trkMagic = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const trkLen = view.getUint32(offset + 4, false);
    offset += 8;
    const trkEnd = Math.min(bytes.length, offset + trkLen);

    if (trkMagic !== 'MTrk') {
      offset = trkEnd;
      continue;
    }

    let pos = offset;
    let absTick = 0;
    let runningStatus = 0;

    const readVarLen = (): number => {
      let value = 0;
      let count = 0;
      while (pos < trkEnd && count < 4) {
        const b = bytes[pos++];
        value = (value << 7) | (b & 0x7f);
        count++;
        if ((b & 0x80) === 0) break;
      }
      return value;
    };

    while (pos < trkEnd) {
      const delta = readVarLen();
      absTick += delta;
      if (pos >= trkEnd) break;

      let status = bytes[pos];
      if (status < 0x80) {
        status = runningStatus;
      } else {
        pos++;
        if (status < 0xf0) runningStatus = status;
      }

      if (status === 0xff) {
        if (pos >= trkEnd) break;
        const metaType = bytes[pos++];
        const metaLen = readVarLen();
        if (metaType === 0x51 && metaLen === 3 && pos + 3 <= trkEnd) {
          const microPerBeat = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
          if (microPerBeat > 0) {
            bpm = Math.max(45, Math.min(220, Math.round(60_000_000 / microPerBeat)));
          }
        }
        pos = Math.min(trkEnd, pos + metaLen);
      } else if (status === 0xf0 || status === 0xf7) {
        const sysLen = readVarLen();
        pos = Math.min(trkEnd, pos + sysLen);
      } else {
        const msgType = status & 0xf0;
        const d1 = pos < trkEnd ? bytes[pos++] : 0;
        const hasTwoBytes = msgType !== 0xc0 && msgType !== 0xd0;
        const d2 = hasTwoBytes && pos < trkEnd ? bytes[pos++] : 0;

        if (msgType === 0x90 && d2 > 0) {
          rawEvents.push({ tick: absTick, note: d1, velocity: d2 });
        }
      }
    }

    offset = trkEnd;
  }

  const steps: Record<number, number[]> = {};
  for (let p = 1; p <= 24; p++) {
    steps[p] = new Array(64).fill(0);
  }

  const stepTicks = ppq / 4; // 16th note resolution
  const maxTick = rawEvents.reduce((m, e) => Math.max(m, e.tick), 0);
  const rawBars = Math.max(1, Math.min(4, Math.ceil((maxTick + 1) / (ppq * 4))));
  const clipSteps = rawBars * 16;

  for (const evt of rawEvents) {
    const qStep = Math.round(evt.tick / stepTicks);
    const wrappedStep = qStep % clipSteps;
    const pad = gmNoteToDustPad(evt.note);
    if (!steps[pad]) steps[pad] = new Array(64).fill(0);

    // Tile shorter 1-bar or 2-bar MIDI grooves cleanly across all 64 steps (4 bars)
    for (let s = wrappedStep; s < 64; s += clipSteps) {
      steps[pad][s] = Math.max(steps[pad][s], evt.velocity);
    }
  }

  const cleanName = filename
    .split('/')
    .pop()!
    .split('\\')
    .pop()!
    .replace(/\.midi?$/i, '')
    .replace(/^_+/, '');

  return {
    name: cleanName || 'MIDI Groove',
    bpm,
    bars: rawBars,
    noteCount: rawEvents.length,
    pattern: {
      enabled: true,
      bpm,
      swing: 0.04,
      steps,
    },
  };
}
