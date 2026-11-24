import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dust87Engine } from './audio/dust87Engine.ts';
import { midiManager, type MidiDeviceInfo } from './audio/midiManager.ts';
import { BottomSeqFxBar } from './components/BottomSeqFxBar.tsx';
import { EngineStrip } from './components/EngineStrip.tsx';
import { EnvelopeDisplays } from './components/EnvelopeDisplays.tsx';
import { HeaderBar } from './components/HeaderBar.tsx';
import { MidiGrooveModal } from './components/MidiGrooveModal.tsx';
import { PadContextSheet } from './components/PadContextSheet.tsx';
import { PadGrid } from './components/PadGrid.tsx';
import { PresetBrowserModal } from './components/PresetBrowserModal.tsx';
import { QLinksBar, type QLinkSlotState } from './components/QLinksBar.tsx';
import { StepSequencer64 } from './components/StepSequencer64.tsx';
import { SystemMenuModal } from './components/SystemMenuModal.tsx';
import { BUILTIN_PRESETS } from './shared/factoryPresets.ts';
import { generateRandomGroove } from './shared/grooveLibrary.ts';
import type {
  BitDepth,
  DrumSynthModel,
  Dust87Preset,
  FilterType,
  PlatformPathsReport,
  QLinkParamId,
  QuarantineRecord,
  ReverbType,
  SampleRateOption,
  UserSettings,
  VoiceConfig,
  WorkflowValidationReport,
} from './shared/types.ts';

const DEFAULT_SETTINGS: UserSettings = {
  activePresetId: BUILTIN_PRESETS[0].id || 'factory-01-dust-87-flagship',
  midiRoutingMode: 'per_voice_channel',
  velocityCurve: 'touch_y',
  qlinkCcMap: [74, 71, 75, 76],
  rollDivision: '1/16',
  simulatedVelocity: 112,
};

const QLINK_CYCLE_ORDER: QLinkParamId[] = [
  'filter_cutoff',
  'drive',
  'decay',
  'pitch',
  'filter_reso',
  'plate_mix',
  'plate_decay',
  'bit_depth',
];

const QLINK_LABELS: Record<QLinkParamId, string> = {
  filter_cutoff: 'FLT CUT',
  filter_reso: 'FLT RESO',
  drive: 'DRIVE',
  decay: 'V.DECAY',
  pitch: 'V.PITCH',
  plate_mix: 'PLATE MIX',
  plate_decay: 'PLATE DEC',
  bit_depth: 'BIT DEPTH',
};

function clonePreset(p: Dust87Preset): Dust87Preset {
  return JSON.parse(JSON.stringify(p)) as Dust87Preset;
}

export default function App() {
  const [factoryPresets, setFactoryPresets] = useState<Dust87Preset[]>(() =>
    BUILTIN_PRESETS.filter((p) => p.bank_type === 'factory')
  );
  const [starterPresets, setStarterPresets] = useState<Dust87Preset[]>(() =>
    BUILTIN_PRESETS.filter((p) => p.bank_type === 'starter')
  );
  const [userPresets, setUserPresets] = useState<Dust87Preset[]>([]);
  const [preset, setPreset] = useState<Dust87Preset>(() => clonePreset(BUILTIN_PRESETS[0]));
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const [activeBank, setActiveBank] = useState(0);
  const [selectedPad, setSelectedPad] = useState(1);
  const [padHits, setPadHits] = useState<Record<number, { velocity: number; ts: number }>>({});
  const [lastVelocity, setLastVelocity] = useState(112);
  const [velocityImpulse, setVelocityImpulse] = useState(0);
  const [masterDb, setMasterDb] = useState(0);

  const [armedLearnIndex, setArmedLearnIndex] = useState<number | null>(null);
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);

  const [seqVisible, setSeqVisible] = useState(false); // Sequencer OFF by default per spec
  const [seqPlaying, setSeqPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [rollActive, setRollActive] = useState(false);

  const [contextPad, setContextPad] = useState<number | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [systemModalOpen, setSystemModalOpen] = useState(false);
  const [grooveModalOpen, setGrooveModalOpen] = useState(false);
  const [activeGrooveName, setActiveGrooveName] = useState<string>('');

  const [pathsReport, setPathsReport] = useState<PlatformPathsReport | null>(null);
  const [quarantineRecords, setQuarantineRecords] = useState<QuarantineRecord[]>([]);
  const [workflowReport, setWorkflowReport] = useState<WorkflowValidationReport | null>(null);

  const presetRef = useRef(preset);
  presetRef.current = preset;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const selectedPadRef = useRef(selectedPad);
  selectedPadRef.current = selectedPad;
  const armedLearnRef = useRef(armedLearnIndex);
  armedLearnRef.current = armedLearnIndex;

  // Keep Web Audio Reverb & Master Out Gain synced
  useEffect(() => {
    dust87Engine.updatePlateSettings(
      preset.fx.plate.enabled,
      preset.fx.plate.mix,
      preset.fx.plate.decay,
      preset.fx.plate.type || 'plate'
    );
  }, [preset.fx.plate.enabled, preset.fx.plate.mix, preset.fx.plate.decay, preset.fx.plate.type]);

  useEffect(() => {
    dust87Engine.setMasterDb(masterDb);
  }, [masterDb]);

  // Clear pad flash states smoothly
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now();
      setPadHits((prev) => {
        let changed = false;
        const next: Record<number, { velocity: number; ts: number }> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 190) {
            next[Number(k)] = v;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 60);
    return () => window.clearInterval(timer);
  }, []);

  // Load persisted backend data on mount
  const refreshBackendState = useCallback(async () => {
    try {
      const [presetsRes, settingsRes, pathsRes, quarantineRes] = await Promise.all([
        fetch('/api/presets'),
        fetch('/api/settings'),
        fetch('/api/storage/paths'),
        fetch('/api/quarantine'),
      ]);

      if (presetsRes.ok) {
        const data = await presetsRes.json();
        if (Array.isArray(data.factory)) setFactoryPresets(data.factory);
        if (Array.isArray(data.starter)) setStarterPresets(data.starter);
        if (Array.isArray(data.user)) setUserPresets(data.user);

        if (settingsRes.ok) {
          const loadedSettings = (await settingsRes.json()) as UserSettings;
          setSettings(loadedSettings);
          const allPool = [...(data.user || []), ...(data.factory || []), ...(data.starter || [])];
          const found = allPool.find((p: Dust87Preset) => p.id === loadedSettings.activePresetId);
          if (found) setPreset(clonePreset(found));
        }
      }
      if (pathsRes.ok) setPathsReport(await pathsRes.json());
      if (quarantineRes.ok) {
        const qData = await quarantineRes.json();
        setQuarantineRecords(qData.records || []);
      }
    } catch {
      // Fallback safely to built-in 80 presets if backend unavailable
    }
  }, []);

  useEffect(() => {
    void refreshBackendState();
  }, [refreshBackendState]);

  const persistSettings = useCallback(async (next: UserSettings) => {
    setSettings(next);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch {
      // Non-fatal
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      void persistSettings(next);
    },
    [persistSettings]
  );

  const selectedVoice = useMemo(() => {
    return preset.voices.find((v) => v.pad === selectedPad) || preset.voices[0];
  }, [preset.voices, selectedPad]);

  const allPresets = useMemo(
    () => [...userPresets, ...factoryPresets, ...starterPresets],
    [userPresets, factoryPresets, starterPresets]
  );

  const currentPresetIndex = useMemo(() => {
    const idx = allPresets.findIndex((p) => p.id === preset.id || p.name === preset.name);
    return idx >= 0 ? idx : 0;
  }, [allPresets, preset.id, preset.name]);

  const stepPreset = useCallback(
    (delta: number) => {
      if (allPresets.length === 0) return;
      const nextIdx = (currentPresetIndex + delta + allPresets.length) % allPresets.length;
      const nextPreset = allPresets[nextIdx];
      setPreset(clonePreset(nextPreset));
      if (nextPreset.id) {
        updateSettings({ activePresetId: nextPreset.id });
      }
    },
    [allPresets, currentPresetIndex, updateSettings]
  );

  const triggerPad = useCallback((padNumber: number, velocity = 112, selectPad = true) => {
    const currentPreset = presetRef.current;
    const voice = currentPreset.voices.find((v) => v.pad === padNumber);
    if (!voice) return;

    if (selectPad) {
      selectedPadRef.current = padNumber;
      setSelectedPad(padNumber);
    }
    setLastVelocity(velocity);
    setVelocityImpulse(Math.max(0.15, Math.min(1, velocity / 127 + Math.random() * 0.001)));
    setPadHits((prev) => ({
      ...prev,
      [padNumber]: { velocity, ts: performance.now() },
    }));

    const anySolo = currentPreset.voices.some((v) => v.solo);
    try {
      dust87Engine.triggerVoice(voice, currentPreset, velocity, anySolo);
    } catch {
      // Never block pad selection or UI flash if audio hardware is unavailable
    }
  }, []);

  const updateVoice = useCallback((padNumber: number, patch: Partial<VoiceConfig>) => {
    setPreset((prev) => ({
      ...prev,
      voices: prev.voices.map((v) => (v.pad === padNumber ? { ...v, ...patch } : v)),
    }));
  }, []);

  const applyQLinkValue = useCallback((param: QLinkParamId, norm: number) => {
    const clamped = Math.min(1, Math.max(0, norm));
    setPreset((prev) => {
      const pad = selectedPadRef.current;
      switch (param) {
        case 'filter_cutoff': {
          const hz = Math.round(180 * Math.pow(18000 / 180, clamped));
          return { ...prev, engine: { ...prev.engine, filter_cutoff: hz } };
        }
        case 'filter_reso': {
          const q = Number((0.5 + clamped * 11.5).toFixed(2));
          return { ...prev, engine: { ...prev.engine, filter_reso: q } };
        }
        case 'drive': {
          return { ...prev, engine: { ...prev.engine, drive: Number(clamped.toFixed(2)) } };
        }
        case 'decay': {
          const decay = Number((0.03 + clamped * 2.37).toFixed(3));
          return {
            ...prev,
            voices: prev.voices.map((v) =>
              v.pad === pad ? { ...v, amp_env: { ...v.amp_env, decay } } : v
            ),
          };
        }
        case 'pitch': {
          const tune = Math.round(-24 + clamped * 48);
          return {
            ...prev,
            voices: prev.voices.map((v) => (v.pad === pad ? { ...v, tune } : v)),
          };
        }
        case 'plate_mix': {
          return {
            ...prev,
            fx: { ...prev.fx, plate: { ...prev.fx.plate, mix: Number(clamped.toFixed(2)) } },
          };
        }
        case 'plate_decay': {
          const decay = Number((0.3 + clamped * 5.2).toFixed(2));
          return {
            ...prev,
            fx: { ...prev.fx, plate: { ...prev.fx.plate, decay } },
          };
        }
        case 'bit_depth': {
          const bits: BitDepth[] = [8, 10, 12, 16];
          const idx = Math.min(3, Math.floor(clamped * 4));
          return { ...prev, engine: { ...prev.engine, bit: bits[idx] } };
        }
      }
    });
  }, []);

  // WebMIDI initialization & routing (Per-Voice Channel vs Combo Fallback + CC Learn)
  useEffect(() => {
    midiManager.setCallbacks(
      (evt) => {
        const curPreset = presetRef.current;
        const mode = settingsRef.current.midiRoutingMode;
        let matchedVoice: VoiceConfig | undefined;

        if (mode === 'per_voice_channel') {
          // Match Voice n -> Channel n (first match in active bank or full 48 voices)
          matchedVoice = curPreset.voices.find((v) => v.midi_channel === evt.channel);
        } else {
          // Combo Fallback: Ch 10 / Omni matches exact MIDI note
          matchedVoice = curPreset.voices.find((v) => v.note === evt.note);
        }

        if (matchedVoice) {
          const targetBank = Math.floor((matchedVoice.pad - 1) / 12);
          setActiveBank(targetBank);
          triggerPad(matchedVoice.pad, evt.velocity);
        }
      },
      (ccEvt) => {
        const armed = armedLearnRef.current;
        if (armed !== null) {
          const nextMap = [...settingsRef.current.qlinkCcMap] as [number, number, number, number];
          nextMap[armed] = ccEvt.cc;
          updateSettings({ qlinkCcMap: nextMap });
          setArmedLearnIndex(null);
          return;
        }
        const ccIndex = settingsRef.current.qlinkCcMap.indexOf(ccEvt.cc);
        if (ccIndex !== -1) {
          const param = presetRef.current.qlinks[ccIndex];
          applyQLinkValue(param, ccEvt.value / 127);
        }
      },
      (devices) => setMidiDevices(devices)
    );

    void midiManager.init().then(setMidiDevices);
  }, [applyQLinkValue, triggerPad, updateSettings]);

  // Computer Keyboard Pad Triggers (1-4, Q-R, A-F)
  useEffect(() => {
    const keyMap: Record<string, number> = {
      '1': 0, '2': 1, '3': 2, '4': 3,
      q: 4, w: 5, e: 6, r: 7,
      a: 8, s: 9, d: 10, f: 11,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k in keyMap) {
        const padNum = activeBank * 12 + keyMap[k] + 1;
        triggerPad(padNum, settingsRef.current.simulatedVelocity);
      } else if (k === ' ' && seqVisible) {
        e.preventDefault();
        setSeqPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBank, seqVisible, triggerPad]);

  // 64-Step Sequencer Clock
  useEffect(() => {
    if (!seqPlaying) {
      setCurrentStep(-1);
      return;
    }

    const bpm = preset.sequencer?.bpm ?? 96;
    const baseMs = (60 / bpm / 4) * 1000;
    let stepCursor = 0;
    let timeoutId: number;

    const tick = () => {
      const curPreset = presetRef.current;
      const stepsMap = curPreset.sequencer?.steps || {};
      const swing = curPreset.sequencer?.swing ?? 0;

      for (const voice of curPreset.voices) {
        const lane = stepsMap[voice.pad];
        if (lane && lane[stepCursor] > 0) {
          triggerPad(voice.pad, lane[stepCursor], false);
        }
      }

      setCurrentStep(stepCursor);
      const isOddStep = stepCursor % 2 === 1;
      const swingOffset = isOddStep ? -baseMs * swing * 0.4 : baseMs * swing * 0.4;
      stepCursor = (stepCursor + 1) % 64;
      timeoutId = window.setTimeout(tick, Math.max(35, baseMs + swingOffset));
    };

    tick();
    return () => window.clearTimeout(timeoutId);
  }, [seqPlaying, preset.sequencer?.bpm, triggerPad]);

  // ROLL Ratchet Engine
  useEffect(() => {
    if (!rollActive) return;
    const bpm = preset.sequencer?.bpm ?? 96;
    const divMap = { '1/8': 2, '1/16': 4, '1/32': 8 };
    const intervalMs = (60 / bpm / divMap[settings.rollDivision]) * 1000;

    triggerPad(selectedPadRef.current, settings.simulatedVelocity);
    const id = window.setInterval(() => {
      triggerPad(selectedPadRef.current, settings.simulatedVelocity);
    }, Math.max(30, intervalMs));

    return () => window.clearInterval(id);
  }, [rollActive, settings.rollDivision, settings.simulatedVelocity, preset.sequencer?.bpm, triggerPad]);

  // Build Q-Link Slot View Models
  const qlinkSlots: QLinkSlotState[] = useMemo(() => {
    return preset.qlinks.map((param, idx) => {
      let norm = 0.5;
      let displayValue = '';
      switch (param) {
        case 'filter_cutoff':
          norm = Math.log(preset.engine.filter_cutoff / 180) / Math.log(18000 / 180);
          displayValue =
            preset.engine.filter_cutoff >= 1000
              ? `${(preset.engine.filter_cutoff / 1000).toFixed(1)}kHz`
              : `${preset.engine.filter_cutoff}Hz`;
          break;
        case 'filter_reso':
          norm = (preset.engine.filter_reso - 0.5) / 11.5;
          displayValue = `${preset.engine.filter_reso.toFixed(1)}Q`;
          break;
        case 'drive':
          norm = preset.engine.drive;
          displayValue = `${Math.round(preset.engine.drive * 100)}%`;
          break;
        case 'decay':
          norm = (selectedVoice.amp_env.decay - 0.03) / 2.37;
          displayValue = `${Math.round(selectedVoice.amp_env.decay * 1000)}ms`;
          break;
        case 'pitch':
          norm = (selectedVoice.tune + 24) / 48;
          displayValue = `${selectedVoice.tune > 0 ? '+' : ''}${selectedVoice.tune}st`;
          break;
        case 'plate_mix':
          norm = preset.fx.plate.mix;
          displayValue = `${Math.round(preset.fx.plate.mix * 100)}%`;
          break;
        case 'plate_decay':
          norm = (preset.fx.plate.decay - 0.3) / 5.2;
          displayValue = `${preset.fx.plate.decay.toFixed(1)}s`;
          break;
        case 'bit_depth': {
          const bits: BitDepth[] = [8, 10, 12, 16];
          norm = (bits.indexOf(preset.engine.bit) + 0.5) / 4;
          displayValue = `${preset.engine.bit}-Bit`;
          break;
        }
      }
      return {
        index: idx,
        param,
        label: QLINK_LABELS[param],
        normalizedValue: Math.min(1, Math.max(0, norm)),
        displayValue,
        midiCc: settings.qlinkCcMap[idx] ?? 74 + idx,
      };
    });
  }, [preset, selectedVoice, settings.qlinkCcMap]);

  const handleRandomizeVoice = (padNum: number) => {
    const [pMin, pMax] = preset.randomizer.pitch;
    const [dMin, dMax] = preset.randomizer.drive;
    const tune = Math.round(pMin + Math.random() * (pMax - pMin));
    const drive = Number((dMin + Math.random() * (dMax - dMin)).toFixed(2));
    const decay = Number((0.08 + Math.random() * 0.75).toFixed(3));
    const cutoff = Math.round(1800 + Math.random() * 14000);

    updateVoice(padNum, {
      tune,
      drive,
      filter_cutoff: cutoff,
      amp_env: { ...selectedVoice.amp_env, decay },
    });
    triggerPad(padNum, 118);
  };

  const handleRandomizeKit = () => {
    const cur = presetRef.current;
    const [pMin, pMax] = cur.randomizer.pitch;
    const [dMin, dMax] = cur.randomizer.drive;

    const bits: BitDepth[] = [8, 10, 12, 16];
    const srs: SampleRateOption[] = [11025, 22050, 26000, 44100];
    const filters: FilterType[] = ['resonant-lp', 'resonant-bp', 'hp-clean'];
    const reverbTypes: ReverbType[] = ['plate', 'room', 'hall', 'spring'];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const synthPools: Record<DrumSynthModel, DrumSynthModel[]> = {
      kick_87: ['kick_87', 'kick_sub', 'zap_electro'],
      kick_sub: ['kick_sub', 'kick_87'],
      snare_87: ['snare_87', 'snare_crack', 'rim_87'],
      snare_crack: ['snare_crack', 'snare_87', 'rim_87'],
      rim_87: ['rim_87', 'clave_wood', 'snare_crack'],
      clap_87: ['clap_87', 'snare_crack', 'rim_87'],
      hat_closed: ['hat_closed', 'shaker_grit'],
      hat_open: ['hat_open', 'ride_12bit'],
      tom_low: ['tom_low', 'tom_mid', 'kick_sub'],
      tom_mid: ['tom_mid', 'tom_low', 'tom_high'],
      tom_high: ['tom_high', 'tom_mid', 'zap_electro'],
      crash_12bit: ['crash_12bit', 'ride_12bit', 'perc_metallic'],
      ride_12bit: ['ride_12bit', 'crash_12bit', 'cowbell_fm'],
      cowbell_fm: ['cowbell_fm', 'perc_metallic', 'clave_wood'],
      clave_wood: ['clave_wood', 'rim_87', 'cowbell_fm'],
      shaker_grit: ['shaker_grit', 'hat_closed', 'perc_metallic'],
      perc_metallic: ['perc_metallic', 'cowbell_fm', 'zap_electro'],
      zap_electro: ['zap_electro', 'perc_metallic', 'tom_high'],
    };

    const engDrive = Number((dMin + Math.random() * (dMax - dMin)).toFixed(2));
    const nextBit = pick(bits);
    const nextSr = pick(srs);
    const nextFilter = pick(filters);
    const nextCutoff = Math.round(2800 + Math.random() * 14200);
    const nextReso = Number((0.9 + Math.random() * 3.8).toFixed(2));

    const nextVoices = cur.voices.map((v) => {
      const pool = synthPools[v.synth_model] || [v.synth_model];
      const nextModel = pick(pool);
      const isKick = nextModel === 'kick_87' || nextModel === 'kick_sub';
      const tuneSpan = pMax - pMin;
      const tuneVal = Math.round(pMin + Math.random() * tuneSpan);
      const driveVal = Number((dMin + Math.random() * (dMax - dMin)).toFixed(2));

      return {
        ...v,
        synth_model: nextModel,
        tune: isKick ? Math.max(-10, Math.min(10, Math.round(tuneVal * 0.55))) : tuneVal,
        drive: driveVal,
        filter_cutoff: Math.round(1600 + Math.random() * 15000),
        filter_reso: Number((0.8 + Math.random() * 3.2).toFixed(2)),
        pan: isKick ? 0 : Number(((Math.random() - 0.5) * 0.85).toFixed(2)),
        amp_env: {
          ...v.amp_env,
          decay: Number(Math.max(0.04, Math.min(1.8, v.amp_env.decay * (0.5 + Math.random() * 1.05))).toFixed(3)),
          release: Number(Math.max(0.03, Math.min(1.2, v.amp_env.release * (0.6 + Math.random() * 0.9))).toFixed(3)),
        },
        pitch_env: {
          ...v.pitch_env,
          depth: Math.round(Math.max(-24, Math.min(24, v.pitch_env.depth + (Math.random() - 0.5) * 14))),
        },
      };
    });

    const nextPreset: Dust87Preset = {
      ...cur,
      engine: {
        ...cur.engine,
        bit: nextBit,
        sr: [nextSr, 44100],
        filter: nextFilter,
        filter_cutoff: nextCutoff,
        filter_reso: nextReso,
        drive: engDrive,
      },
      fx: {
        plate: {
          ...cur.fx.plate,
          type: cur.fx.plate.enabled ? pick(reverbTypes) : cur.fx.plate.type,
          mix: cur.fx.plate.enabled ? Number((0.12 + Math.random() * 0.42).toFixed(2)) : cur.fx.plate.mix,
          decay: cur.fx.plate.enabled ? Number((0.7 + Math.random() * 3.1).toFixed(2)) : cur.fx.plate.decay,
        },
      },
      voices: nextVoices,
    };

    // Update ref synchronously so immediate audition hits use the newly randomized kit
    presetRef.current = nextPreset;
    setPreset(nextPreset);

    // If sequencer isn't already running, play a quick multi-pad kit preview (Kick, Snare, Hat, Rim)
    if (!seqPlaying) {
      const bankOffset = activeBank * 12;
      const previewPads = [bankOffset + 1, bankOffset + 5, bankOffset + 2, bankOffset + 3];
      previewPads.forEach((padNum, i) => {
        window.setTimeout(() => {
          triggerPad(padNum, 108 + (i % 2) * 12, false);
        }, i * 80);
      });
    }
  };

  const handleRandomizeSequence = () => {
    const rndGroove = generateRandomGroove();
    setPreset((prev) => {
      const next: Dust87Preset = {
        ...prev,
        sequencer: {
          ...rndGroove.pattern,
          enabled: true,
        },
      };
      presetRef.current = next;
      return next;
    });
    setActiveGrooveName(rndGroove.name);
    setSeqVisible(true);
    setSeqPlaying(true);
  };

  const handleResetVoice = (padNum: number) => {
    const sourcePreset = BUILTIN_PRESETS.find((p) => p.id === preset.id) || BUILTIN_PRESETS[0];
    const orig = sourcePreset.voices.find((v) => v.pad === padNum);
    if (orig) {
      updateVoice(padNum, clonePreset({ ...sourcePreset, voices: [orig] }).voices[0]);
    }
  };

  const contextVoice = contextPad !== null ? preset.voices.find((v) => v.pad === contextPad) || null : null;

  return (
    <div className="min-h-screen w-full bg-[#090C12] text-[#EEF2F8] flex flex-col items-center justify-center p-0 sm:p-3 lg:p-5">
      {/* Main Brushed Aluminum & Multi-Colored Modular MPC Plugin Chassis */}
      <main className="w-full max-w-[1180px] min-h-screen sm:min-h-[780px] aluminum-chassis sm:rounded-2xl border-0 sm:border-2 border-[#64748B]/70 flex flex-col overflow-hidden">
        <HeaderBar
          preset={preset}
          presetIndex={currentPresetIndex}
          totalPresets={allPresets.length}
          bpm={preset.sequencer?.bpm ?? 96}
          midiMode={settings.midiRoutingMode}
          midiDeviceCount={midiDevices.length}
          lastVelocity={lastVelocity}
          onPrevPreset={() => stepPreset(-1)}
          onNextPreset={() => stepPreset(1)}
          onChangeBpm={(bpm) =>
            setPreset((prev) => ({
              ...prev,
              sequencer: { ...(prev.sequencer || { enabled: false, bpm: 96, swing: 0.12, steps: {} }), bpm },
            }))
          }
          onOpenPresets={() => setPresetModalOpen(true)}
          onOpenMenu={() => setSystemModalOpen(true)}
        />

        <EngineStrip
          preset={preset}
          velocityImpulse={velocityImpulse}
          onCycleBit={() => {
            const order: BitDepth[] = [12, 8, 10, 16];
            const next = order[(order.indexOf(preset.engine.bit) + 1) % order.length];
            setPreset((prev) => ({ ...prev, engine: { ...prev.engine, bit: next } }));
          }}
          onCycleSampleRate={() => {
            const order: SampleRateOption[] = [26000, 11025, 22050, 44100];
            const cur = (preset.engine.sr[0] ?? 26000) as SampleRateOption;
            const next = order[(order.indexOf(cur) + 1) % order.length];
            setPreset((prev) => ({ ...prev, engine: { ...prev.engine, sr: [next, 44100] } }));
          }}
          onCycleFilterMode={() => {
            const order: FilterType[] = ['resonant-lp', 'resonant-bp', 'hp-clean'];
            const next = order[(order.indexOf(preset.engine.filter) + 1) % order.length];
            setPreset((prev) => ({ ...prev, engine: { ...prev.engine, filter: next } }));
          }}
          onChangeCutoff={(hz) =>
            setPreset((prev) => ({ ...prev, engine: { ...prev.engine, filter_cutoff: Math.round(hz) } }))
          }
          onChangeReso={(q) =>
            setPreset((prev) => ({ ...prev, engine: { ...prev.engine, filter_reso: Number(q.toFixed(2)) } }))
          }
          onChangeDrive={(drive) =>
            setPreset((prev) => ({ ...prev, engine: { ...prev.engine, drive: Number(drive.toFixed(2)) } }))
          }
        />

        <EnvelopeDisplays
          voice={selectedVoice}
          velocityImpulse={velocityImpulse}
          onUpdateVoice={(patch) => updateVoice(selectedVoice.pad, patch)}
        />

        <QLinksBar
          slots={qlinkSlots}
          armedLearnIndex={armedLearnIndex}
          velocityImpulse={velocityImpulse}
          onDragSlot={(idx, nextNorm) => applyQLinkValue(preset.qlinks[idx], nextNorm)}
          onTapLearn={(idx) => setArmedLearnIndex((cur) => (cur === idx ? null : idx))}
          onCycleParam={(idx) => {
            setPreset((prev) => {
              const curParam = prev.qlinks[idx];
              const nextParam = QLINK_CYCLE_ORDER[(QLINK_CYCLE_ORDER.indexOf(curParam) + 1) % QLINK_CYCLE_ORDER.length];
              const nextQlinks = [...prev.qlinks] as [QLinkParamId, QLinkParamId, QLinkParamId, QLinkParamId];
              nextQlinks[idx] = nextParam;
              return { ...prev, qlinks: nextQlinks };
            });
          }}
        />

        <PadGrid
          voices={preset.voices}
          activeBank={activeBank}
          selectedPad={selectedPad}
          padHits={padHits}
          velocityCurve={settings.velocityCurve}
          simulatedVelocity={settings.simulatedVelocity}
          onChangeBank={setActiveBank}
          onTriggerPad={triggerPad}
          onOpenPadContext={(padNum) => setContextPad(padNum)}
        />

        {seqVisible && preset.sequencer && (
          <StepSequencer64
            sequencer={preset.sequencer}
            selectedVoice={selectedVoice}
            currentStep={currentStep}
            isPlaying={seqPlaying}
            onSelectPad={(padNum) => {
              selectedPadRef.current = padNum;
              setSelectedPad(padNum);
              setActiveBank(Math.floor((padNum - 1) / 12));
            }}
            onToggleStep={(padNum, stepIdx) => {
              setPreset((prev) => {
                const seq = prev.sequencer || { enabled: true, bpm: 96, swing: 0.12, steps: {} };
                const lane = [...(seq.steps[padNum] || new Array(64).fill(0))];
                lane[stepIdx] = lane[stepIdx] > 0 ? 0 : 112;
                return {
                  ...prev,
                  sequencer: {
                    ...seq,
                    steps: { ...seq.steps, [padNum]: lane },
                  },
                };
              });
            }}
            onChangeBpm={(bpm) =>
              setPreset((prev) => ({
                ...prev,
                sequencer: { ...(prev.sequencer || { enabled: true, bpm: 96, swing: 0.12, steps: {} }), bpm },
              }))
            }
            onChangeSwing={(swing) =>
              setPreset((prev) => ({
                ...prev,
                sequencer: { ...(prev.sequencer || { enabled: true, bpm: 96, swing: 0.12, steps: {} }), swing },
              }))
            }
            onClearPadPattern={(padNum) => {
              setPreset((prev) => {
                const seq = prev.sequencer || { enabled: true, bpm: 96, swing: 0.12, steps: {} };
                return {
                  ...prev,
                  sequencer: {
                    ...seq,
                    steps: { ...seq.steps, [padNum]: new Array(64).fill(0) },
                  },
                };
              });
            }}
            onOpenGrooves={() => setGrooveModalOpen(true)}
            onRandomizeSequence={handleRandomizeSequence}
          />
        )}

        <BottomSeqFxBar
          preset={preset}
          seqVisible={seqVisible}
          seqPlaying={seqPlaying}
          rollDivision={settings.rollDivision}
          rollActive={rollActive}
          masterDb={masterDb}
          velocityImpulse={velocityImpulse}
          onToggleSeqVisible={() => {
            setSeqVisible((v) => {
              if (v) setSeqPlaying(false);
              return !v;
            });
          }}
          onToggleSeqPlay={() => setSeqPlaying((p) => !p)}
          onRollDown={() => setRollActive(true)}
          onRollUp={() => setRollActive(false)}
          onCycleRollDivision={() => {
            const divs: Array<'1/8' | '1/16' | '1/32'> = ['1/8', '1/16', '1/32'];
            updateSettings({ rollDivision: divs[(divs.indexOf(settings.rollDivision) + 1) % divs.length] });
          }}
          onRandomizeKit={handleRandomizeKit}
          onRandomizeSequence={handleRandomizeSequence}
          onCycleReverb={() => {
            const types: ReverbType[] = ['plate', 'room', 'hall', 'spring'];
            setPreset((prev) => {
              const curEnabled = prev.fx.plate.enabled;
              const curType = prev.fx.plate.type || 'plate';
              if (!curEnabled) {
                return {
                  ...prev,
                  fx: { ...prev.fx, plate: { ...prev.fx.plate, enabled: true, type: 'plate' } },
                };
              }
              const idx = types.indexOf(curType);
              if (idx === types.length - 1) {
                return {
                  ...prev,
                  fx: { ...prev.fx, plate: { ...prev.fx.plate, enabled: false } },
                };
              }
              return {
                ...prev,
                fx: { ...prev.fx, plate: { ...prev.fx.plate, enabled: true, type: types[idx + 1] } },
              };
            });
          }}
          onChangePlateMix={(mix) =>
            setPreset((prev) => ({
              ...prev,
              fx: { ...prev.fx, plate: { ...prev.fx.plate, enabled: true, mix: Number(mix.toFixed(2)) } },
            }))
          }
          onChangePlateDecay={(decay) =>
            setPreset((prev) => ({
              ...prev,
              fx: { ...prev.fx, plate: { ...prev.fx.plate, decay: Number(decay.toFixed(2)) } },
            }))
          }
          onChangeMasterDb={(db) => setMasterDb(Number(db.toFixed(1)))}
        />
      </main>

      {/* Tap-Hold Pad Context Sheet */}
      {contextVoice && (
        <PadContextSheet
          voice={contextVoice}
          onClose={() => setContextPad(null)}
          onUpdateVoice={(patch) => updateVoice(contextVoice.pad, patch)}
          onRandomizeVoice={() => handleRandomizeVoice(contextVoice.pad)}
          onResetVoice={() => handleResetVoice(contextVoice.pad)}
          onPreviewVoice={() => triggerPad(contextVoice.pad, settings.simulatedVelocity)}
        />
      )}

      {/* Preset Library & User Bank Modal */}
      {presetModalOpen && (
        <PresetBrowserModal
          activePreset={preset}
          factoryPresets={factoryPresets}
          starterPresets={starterPresets}
          userPresets={userPresets}
          onSelectPreset={(selected) => {
            setPreset(clonePreset(selected));
            if (selected.id) updateSettings({ activePresetId: selected.id });
          }}
          onSaveUserPreset={async (name) => {
            const res = await fetch('/api/presets/user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...preset, id: undefined, name, bank_type: 'user' }),
            });
            if (res.ok) {
              const data = await res.json();
              await refreshBackendState();
              if (data.preset) {
                setPreset(clonePreset(data.preset));
                updateSettings({ activePresetId: data.preset.id });
              }
            }
          }}
          onDeleteUserPreset={async (id) => {
            await fetch(`/api/presets/user/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await refreshBackendState();
          }}
          onImportPresetJson={async (filename, rawJson) => {
            const res = await fetch('/api/presets/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename, rawJson }),
            });
            const data = await res.json();
            await refreshBackendState();
            return { ok: Boolean(data.ok), record: data.record };
          }}
          onClose={() => setPresetModalOpen(false)}
        />
      )}

      {/* System / MIDI / Q4 Storage / Open-MPC Validation Modal */}
      {systemModalOpen && (
        <SystemMenuModal
          preset={preset}
          settings={settings}
          midiDevices={midiDevices}
          pathsReport={pathsReport}
          quarantineRecords={quarantineRecords}
          workflowReport={workflowReport}
          onUpdateSettings={updateSettings}
          onUpdateRandomizerBounds={(pitch, drive) =>
            setPreset((prev) => ({ ...prev, randomizer: { pitch, drive } }))
          }
          onRandomizeKit={handleRandomizeKit}
          onRandomizeSequence={handleRandomizeSequence}
          onTestVelocityHit={(vel) => triggerPad(selectedPad, vel)}
          onSimulateCorruptFile={async () => {
            const res = await fetch('/api/quarantine/simulate-corrupt', { method: 'POST' });
            if (res.ok) {
              const data = await res.json();
              setQuarantineRecords(data.records || []);
            }
          }}
          onDeleteQuarantine={async (filename) => {
            const res = await fetch(`/api/quarantine/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (res.ok) {
              const data = await res.json();
              setQuarantineRecords(data.records || []);
            }
          }}
          onRunValidation={async () => {
            const res = await fetch('/api/workflow/validate');
            if (res.ok) {
              setWorkflowReport(await res.json());
            }
          }}
          onClose={() => setSystemModalOpen(false)}
        />
      )}

      {/* 80-Groove Selector & Local .MID Importer Modal */}
      {grooveModalOpen && (
        <MidiGrooveModal
          currentBpm={preset.sequencer?.bpm ?? 96}
          isPlaying={seqPlaying}
          activeGrooveName={activeGrooveName}
          onApplyGroove={(pattern, label, startPlayback) => {
            setPreset((prev) => ({
              ...prev,
              sequencer: pattern,
            }));
            setActiveGrooveName(label);
            setSeqVisible(true);
            if (startPlayback) {
              setSeqPlaying(true);
            }
          }}
          onTogglePlay={() => setSeqPlaying((p) => !p)}
          onClose={() => setGrooveModalOpen(false)}
        />
      )}
    </div>
  );
}
