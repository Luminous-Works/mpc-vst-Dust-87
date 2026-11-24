import type {
  BitDepth,
  DrumSynthModel,
  Dust87Preset,
  FilterType,
  ReverbType,
  VoiceConfig,
} from '../shared/types.ts';

interface ActiveVoiceNode {
  stopAt: (when: number) => void;
  chokeGroup: number;
}

class Dust87AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private plateConvolver: ConvolverNode | null = null;
  private plateWetGain: GainNode | null = null;
  private dryBus: GainNode | null = null;

  private masterDb = 0;
  private meterBufL = new Float32Array(256);
  private meterBufR = new Float32Array(256);

  private activeByChoke = new Map<number, Set<ActiveVoiceNode>>();
  private bufferCache = new Map<string, AudioBuffer>();
  private lastPlateDecay = -1;
  private lastReverbType: ReverbType = 'plate';
  private driveCurveCache = new Map<number, Float32Array<ArrayBuffer>>();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.dryBus = this.ctx.createGain();
      this.dryBus.gain.value = 1.0;

      this.plateConvolver = this.ctx.createConvolver();
      this.plateWetGain = this.ctx.createGain();
      this.plateWetGain.gain.value = 0.25;

      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -2.5;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 10;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.08;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.dbToGain(this.masterDb);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;

      const splitter = this.ctx.createChannelSplitter(2);
      this.analyserL = this.ctx.createAnalyser();
      this.analyserL.fftSize = 256;
      this.analyserR = this.ctx.createAnalyser();
      this.analyserR.fftSize = 256;

      this.dryBus.connect(this.limiter);
      this.plateConvolver.connect(this.plateWetGain);
      this.plateWetGain.connect(this.limiter);
      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.masterGain.connect(splitter);
      splitter.connect(this.analyserL, 0);
      splitter.connect(this.analyserR, 1);
      this.analyser.connect(this.ctx.destination);

      this.updatePlateImpulse(1.8);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private dbToGain(db: number): number {
    if (db <= -59.5) return 0;
    return Math.pow(10, db / 20);
  }

  public setMasterDb(db: number): void {
    this.masterDb = Math.max(-60, Math.min(6, db));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.dbToGain(this.masterDb), this.ctx.currentTime, 0.015);
    }
  }

  public getOutputMeterLevels(): { leftDb: number; rightDb: number; peakDb: number; clipping: boolean } {
    if (!this.analyserL || !this.analyserR || !this.ctx || this.ctx.state !== 'running') {
      return { leftDb: -60, rightDb: -60, peakDb: -60, clipping: false };
    }
    this.analyserL.getFloatTimeDomainData(this.meterBufL);
    this.analyserR.getFloatTimeDomainData(this.meterBufR);

    let peakL = 0;
    let peakR = 0;
    for (let i = 0; i < this.meterBufL.length; i++) {
      const al = Math.abs(this.meterBufL[i]);
      const ar = Math.abs(this.meterBufR[i]);
      if (al > peakL) peakL = al;
      if (ar > peakR) peakR = ar;
    }

    const toDb = (amp: number) => (amp < 0.0008 ? -60 : Math.max(-60, Math.min(3, 20 * Math.log10(amp))));
    const leftDb = toDb(peakL);
    const rightDb = toDb(peakR);
    const peakDb = Math.max(leftDb, rightDb);
    return {
      leftDb,
      rightDb,
      peakDb,
      clipping: peakDb >= -0.4,
    };
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public updatePlateSettings(
    enabled: boolean,
    mix: number,
    decay: number,
    reverbType: ReverbType = 'plate'
  ): void {
    const ctx = this.ensureContext();
    if (this.plateWetGain) {
      this.plateWetGain.gain.setTargetAtTime(enabled ? mix * 0.85 : 0, ctx.currentTime, 0.02);
    }
    if (Math.abs(decay - this.lastPlateDecay) > 0.15 || reverbType !== this.lastReverbType) {
      this.updatePlateImpulse(decay, reverbType);
    }
  }

  private updatePlateImpulse(decaySec: number, reverbType: ReverbType = 'plate'): void {
    if (!this.ctx || !this.plateConvolver) return;
    this.lastPlateDecay = decaySec;
    this.lastReverbType = reverbType;
    const sr = this.ctx.sampleRate;
    const effectiveDecay =
      reverbType === 'room'
        ? Math.max(0.2, decaySec * 0.45)
        : reverbType === 'hall'
        ? Math.min(6.5, decaySec * 1.35)
        : reverbType === 'spring'
        ? Math.max(0.35, decaySec * 0.78)
        : Math.max(0.25, Math.min(6.0, decaySec));
    const length = Math.floor(sr * effectiveDecay);
    const impulse = this.ctx.createBuffer(2, length, sr);

    const preDelaySamples =
      reverbType === 'hall' ? Math.floor(sr * 0.022) : reverbType === 'room' ? Math.floor(sr * 0.005) : 0;

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      let prev = 0;
      const springDelaySamples = Math.floor(sr * (ch === 0 ? 0.048 : 0.055));

      for (let i = 0; i < length; i++) {
        if (i < preDelaySamples) {
          data[i] = 0;
          continue;
        }
        const t = (i - preDelaySamples) / sr;
        const white = Math.random() * 2 - 1;

        if (reverbType === 'room') {
          // Tight studio room: crisp early reflections + rapid woody damping
          const env = Math.exp(-4.8 * (t / effectiveDecay));
          lp = lp * 0.56 + white * 0.44;
          const earlyTap =
            (i === Math.floor(sr * (ch === 0 ? 0.008 : 0.011)) ||
              i === Math.floor(sr * (ch === 0 ? 0.017 : 0.021)) ||
              i === Math.floor(sr * (ch === 0 ? 0.029 : 0.034)))
              ? 1.5
              : 1.0;
          data[i] = lp * env * earlyTap * 0.52;
        } else if (reverbType === 'hall') {
          // Deep concert hall: pre-delayed bloom + warm LP roll-off
          const bloom = Math.min(1, t / 0.035);
          const env = bloom * Math.exp(-2.9 * (t / effectiveDecay));
          lp = lp * 0.72 + white * 0.28;
          data[i] = lp * env * 0.58;
        } else if (reverbType === 'spring') {
          // Vintage spring tank: dispersive metallic chirp + bouncy tank echoes
          const env = Math.exp(-3.4 * (t / effectiveDecay));
          const chirp = Math.sin(2 * Math.PI * (620 - 260 * Math.exp(-t * 18)) * t) * Math.exp(-t * 14);
          lp = lp * 0.35 + white * 0.65;
          const hpSpring = lp - prev * 0.45;
          prev = lp;
          const bounce = i >= springDelaySamples ? data[i - springDelaySamples] * 0.38 : 0;
          data[i] = Math.max(-1, Math.min(1, (hpSpring * 0.48 + chirp * 0.28) * env + bounce));
        } else {
          // Classic dense stereo metallic plate
          const env = Math.exp(-3.6 * (t / effectiveDecay));
          lp = lp * 0.42 + white * 0.58;
          const earlyCluster = i < sr * 0.035 && i % (ch === 0 ? 131 : 149) === 0 ? 0.65 : 1.0;
          data[i] = lp * env * earlyCluster * 0.55;
        }
      }
    }
    this.plateConvolver.buffer = impulse;
  }

  private getDriveCurve(amount: number): Float32Array<ArrayBuffer> {
    const key = Math.round(amount * 50);
    const cached = this.driveCurveCache.get(key);
    if (cached) return cached;

    const samples = 1024;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    const k = 1 + amount * 18;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Warm asymmetric 80s analog clipping
      const shaped = ((1 + k * 0.4) * x) / (1 + k * Math.abs(x));
      curve[i] = Math.tanh(shaped * (1 + amount * 1.4));
    }
    this.driveCurveCache.set(key, curve);
    return curve;
  }

  /**
   * Generates an authentic 8/10/12/16-bit vintage drum PCM sample buffer
   * with sample-rate hold aliasing (11k / 22k / 26k / 44.1k Hz).
   */
  private getDrumBuffer(
    model: DrumSynthModel,
    bitDepth: BitDepth,
    targetSr: number,
    variant = 0
  ): AudioBuffer {
    const cacheKey = `${model}:${bitDepth}:${targetSr}:${variant}`;
    const existing = this.bufferCache.get(cacheKey);
    if (existing) return existing;

    const ctx = this.ensureContext();
    const ctxSr = ctx.sampleRate;
    const duration = model.startsWith('crash') ? 1.8 : model.startsWith('ride') || model.startsWith('hat_open') ? 1.2 : 0.85;
    const totalSamples = Math.floor(ctxSr * duration);
    const buffer = ctx.createBuffer(1, totalSamples, ctxSr);
    const out = buffer.getChannelData(0);

    const levels = Math.pow(2, bitDepth - 1);
    const holdSamples = Math.max(1, Math.round(ctxSr / Math.max(8000, targetSr)));

    let heldValue = 0;
    let lfsr = 0x55aa1234 ^ (variant * 0x9e3779b1);
    const nextNoise = () => {
      // Deterministic 12-bit era LFSR noise
      const bit = ((lfsr >> 0) ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
      lfsr = (lfsr >>> 1) | (bit << 30);
      return ((lfsr & 0xffff) / 32768) - 1;
    };

    let phase = 0;
    let phase2 = 0;
    let phase3 = 0;
    let phase4 = 0;
    let prevNoise = 0;
    for (let i = 0; i < totalSamples; i++) {
      if (i % holdSamples === 0) {
        const t = i / ctxSr;
        let sample = 0;

        switch (model) {
          case 'kick_87': {
            const f = 48 + 145 * Math.exp(-t * 38);
            phase += (2 * Math.PI * f) / ctxSr;
            const click = Math.exp(-t * 220) * nextNoise() * 0.35;
            const body = Math.sin(phase) * Math.exp(-t * 6.5);
            sample = Math.tanh((body * 1.4 + click) * 1.15);
            break;
          }
          case 'kick_sub': {
            const f = 38 + 92 * Math.exp(-t * 24);
            phase += (2 * Math.PI * f) / ctxSr;
            const thump = Math.sin(phase) * Math.exp(-t * 4.2);
            const transient = Math.exp(-t * 160) * 0.25;
            sample = Math.tanh((thump + transient) * 1.2);
            break;
          }
          case 'snare_87': {
            const f = 175 + 110 * Math.exp(-t * 55);
            phase += (2 * Math.PI * f) / ctxSr;
            const tone = Math.sin(phase) * Math.exp(-t * 16);
            const snareNoise = nextNoise() * Math.exp(-t * 11.5);
            sample = Math.tanh((tone * 0.65 + snareNoise * 0.85) * 1.1);
            break;
          }
          case 'snare_crack': {
            const f = 210 + 160 * Math.exp(-t * 75);
            phase += (2 * Math.PI * f) / ctxSr;
            const tone = Math.sin(phase) * Math.exp(-t * 22);
            const noise = nextNoise() * Math.exp(-t * 15);
            sample = Math.tanh((tone * 0.55 + noise * 1.05) * 1.25);
            break;
          }
          case 'rim_87': {
            // Authentic snare rimshot: batter head membrane modes + steel hoop crack + snare-wire sizzle
            const profiles = [
              { headFreq: 192, hoopFreq: 1180, ringDecay: 24, wireMix: 0.62, wireDecay: 16 }, // 14x5.5 Steel Snare
              { headFreq: 224, hoopFreq: 1420, ringDecay: 29, wireMix: 0.54, wireDecay: 20 }, // Piccolo Brass Rim
              { headFreq: 168, hoopFreq: 960, ringDecay: 19, wireMix: 0.72, wireDecay: 13 },  // Deep 6.5" Maple Hoop
              { headFreq: 206, hoopFreq: 1290, ringDecay: 34, wireMix: 0.45, wireDecay: 24 }, // Tight Dry Studio Rim
            ];
            const prof = profiles[variant % profiles.length];
            // Tensioned batter head pitch drop on stick impact
            const headF = prof.headFreq + 115 * Math.exp(-t * 140);
            phase += (2 * Math.PI * headF) / ctxSr;
            // Circular drumhead overtones (1.59x and 2.29x fundamental)
            phase2 += (2 * Math.PI * (headF * 1.59)) / ctxSr;
            phase3 += (2 * Math.PI * (headF * 2.29)) / ctxSr;
            // Steel hoop transient ring
            phase4 += (2 * Math.PI * prof.hoopFreq) / ctxSr;

            const shellBark =
              (Math.sin(phase) * 0.6 + Math.sin(phase2) * 0.28 + Math.sin(phase3) * 0.16) *
              Math.exp(-t * prof.ringDecay);
            const hoopCrack =
              (Math.sin(phase4) * 0.35 + Math.sin(phase4 * 1.73) * 0.22) *
              Math.exp(-t * 95);

            // Stick transient snap + high-passed snare wire buzz
            const rawNoise = nextNoise();
            const hpNoise = rawNoise - prevNoise * 0.74;
            prevNoise = rawNoise;

            const stickSnap = Math.exp(-t * 360) * rawNoise * 0.9;
            const snareWires = hpNoise * prof.wireMix * Math.exp(-t * prof.wireDecay);

            sample = Math.tanh((shellBark * 1.25 + hoopCrack + stickSnap + snareWires) * 1.35);
            break;
          }
          case 'clap_87': {
            // 3 tight micro-bursts + tail
            const burst =
              (t < 0.011 ? 1 : 0) +
              (t >= 0.013 && t < 0.024 ? 0.9 : 0) +
              (t >= 0.026 && t < 0.038 ? 0.85 : 0);
            const tail = t >= 0.035 ? Math.exp(-(t - 0.035) * 11) * 0.8 : 0;
            sample = nextNoise() * Math.min(1, burst + tail);
            break;
          }
          case 'hat_closed':
          case 'hat_open': {
            // Classic 6-oscillator metallic FM clang + noise
            const freqs = [205, 304, 369, 522, 540, 800];
            let metallic = 0;
            for (const f of freqs) {
              metallic += Math.sign(Math.sin(2 * Math.PI * f * t));
            }
            metallic /= freqs.length;
            const decayRate = model === 'hat_closed' ? 32 : 4.2;
            sample = (metallic * 0.55 + nextNoise() * 0.45) * Math.exp(-t * decayRate);
            break;
          }
          case 'tom_low':
          case 'tom_mid':
          case 'tom_high': {
            const base = model === 'tom_low' ? 78 : model === 'tom_mid' ? 112 : 158;
            const f = base + base * 0.85 * Math.exp(-t * 26);
            phase += (2 * Math.PI * f) / ctxSr;
            sample = Math.sin(phase) * Math.exp(-t * 6.8) + nextNoise() * Math.exp(-t * 95) * 0.2;
            break;
          }
          case 'crash_12bit':
          case 'ride_12bit': {
            const freqs = [312, 468, 634, 912, 1240];
            let clang = 0;
            for (const f of freqs) {
              clang += Math.sign(Math.sin(2 * Math.PI * f * t));
            }
            clang /= freqs.length;
            const rate = model === 'crash_12bit' ? 2.4 : 4.8;
            sample = (clang * 0.48 + nextNoise() * 0.52) * Math.exp(-t * rate);
            break;
          }
          case 'cowbell_fm': {
            phase += (2 * Math.PI * 540) / ctxSr;
            phase2 += (2 * Math.PI * 800) / ctxSr;
            sample = (Math.sign(Math.sin(phase)) * 0.5 + Math.sign(Math.sin(phase2)) * 0.5) * Math.exp(-t * 14);
            break;
          }
          case 'clave_wood': {
            phase += (2 * Math.PI * 2450) / ctxSr;
            sample = Math.sin(phase) * Math.exp(-t * 58);
            break;
          }
          case 'shaker_grit': {
            const env = Math.sin(Math.min(Math.PI, t * 28)) * Math.exp(-t * 18);
            sample = nextNoise() * env;
            break;
          }
          case 'perc_metallic': {
            phase += (2 * Math.PI * 330) / ctxSr;
            phase2 += (2 * Math.PI * 712) / ctxSr;
            sample = Math.sin(phase + Math.sin(phase2) * 2.2) * Math.exp(-t * 9);
            break;
          }
          case 'zap_electro': {
            const f = 60 + 980 * Math.exp(-t * 24);
            phase += (2 * Math.PI * f) / ctxSr;
            sample = Math.sin(phase) * Math.exp(-t * 10);
            break;
          }
        }

        // Quantize amplitude to exact bit depth (8/10/12/16-bit)
        heldValue = Math.round(Math.max(-1, Math.min(1, sample)) * levels) / levels;
      }
      out[i] = heldValue;
    }

    this.bufferCache.set(cacheKey, buffer);
    return buffer;
  }

  public triggerVoice(
    voice: VoiceConfig,
    preset: Dust87Preset,
    velocity = 110,
    anySolo = false
  ): void {
    if (voice.mute) return;
    if (anySolo && !voice.solo) return;

    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const velNorm = Math.max(0.05, Math.min(1.0, velocity / 127));

    // Choke group enforcement
    if (voice.choke_group > 0) {
      const groupSet = this.activeByChoke.get(voice.choke_group);
      if (groupSet) {
        for (const active of groupSet) {
          active.stopAt(now + 0.008);
        }
        groupSet.clear();
      }
    }

    const targetSr = preset.engine.sr[0] ?? 26000;
    const timbreVariant = Math.abs(
      Math.round(preset.engine.filter_cutoff / 950) +
      Math.round(preset.engine.drive * 10) +
      voice.pad
    ) % 4;
    const buffer = this.getDrumBuffer(voice.synth_model, preset.engine.bit, targetSr, timbreVariant);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Base pitch + Pitch Envelope (╱╲)
    const baseRate = Math.pow(2, voice.tune / 12);
    const peakRate = Math.pow(2, (voice.tune + voice.pitch_env.depth) / 12);
    source.playbackRate.setValueAtTime(Math.max(0.15, Math.min(4.0, peakRate)), now);
    source.playbackRate.exponentialRampToValueAtTime(
      Math.max(0.15, Math.min(4.0, baseRate)),
      now + Math.max(0.006, voice.pitch_env.decay)
    );

    // Per-voice Filter
    const filter = ctx.createBiquadFilter();
    const filterMap: Record<FilterType, BiquadFilterType> = {
      'resonant-lp': 'lowpass',
      'resonant-bp': 'bandpass',
      'hp-clean': 'highpass',
    };
    filter.type = filterMap[preset.engine.filter] || 'lowpass';
    // Combine global engine cutoff & voice cutoff with velocity brightness
    const combinedCutoff = Math.min(
      18500,
      Math.max(120, (voice.filter_cutoff * (preset.engine.filter_cutoff / 11500)) * (0.7 + velNorm * 0.45))
    );
    filter.frequency.setValueAtTime(combinedCutoff, now);
    filter.Q.setValueAtTime(Math.max(0.1, (voice.filter_reso + preset.engine.filter_reso) * 0.5), now);

    // Analog Drive
    const totalDrive = Math.min(1, voice.drive * 0.45 + preset.engine.drive * 0.7);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDriveCurve(totalDrive);
    shaper.oversample = '2x';

    // Amp Envelope (ADSR)
    const amp = ctx.createGain();
    const peakGain = voice.level * velNorm;
    const attack = Math.max(0.001, voice.amp_env.attack);
    const decay = Math.max(0.02, voice.amp_env.decay);
    const sustainLevel = Math.max(0.0001, peakGain * voice.amp_env.sustain * 0.4);
    const release = Math.max(0.015, voice.amp_env.release);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(peakGain, now + attack);
    amp.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + release);

    // Stereo Pan
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, voice.pan)), now);

    source.connect(filter);
    filter.connect(shaper);
    shaper.connect(amp);
    amp.connect(panner);

    if (this.dryBus) {
      panner.connect(this.dryBus);
    }
    if (this.plateConvolver && preset.fx.plate.enabled) {
      panner.connect(this.plateConvolver);
    }

    const totalEnd = now + attack + decay + release + 0.04;
    source.start(now);
    source.stop(totalEnd);

    const activeToken: ActiveVoiceNode = {
      chokeGroup: voice.choke_group,
      stopAt: (when: number) => {
        try {
          amp.gain.cancelScheduledValues(now);
          amp.gain.setValueAtTime(Math.max(0.0001, amp.gain.value), now);
          amp.gain.exponentialRampToValueAtTime(0.0001, when);
          source.stop(when + 0.005);
        } catch {
          // Node may already have stopped
        }
      },
    };

    if (voice.choke_group > 0) {
      let set = this.activeByChoke.get(voice.choke_group);
      if (!set) {
        set = new Set();
        this.activeByChoke.set(voice.choke_group, set);
      }
      set.add(activeToken);
      source.onended = () => {
        set?.delete(activeToken);
      };
    }
  }
}

export const dust87Engine = new Dust87AudioEngine();
