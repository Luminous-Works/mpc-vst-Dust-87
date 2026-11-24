// DUST '87: a native MPC drum instrument by Lumina.Aerospace.
// SPDX-License-Identifier: GPL-3.0-only
//
// The audio path is procedural: MIDI notes select one of 18 one-shot drum
// voices, followed by shared sample-rate reduction, bit-depth quantisation,
// drive, plate-style reverb and a smoothed master output.

#include "mpc_plugin.h"
#include "dsp/math.h"
#include "dsp/noise.h"
#include "dsp/onepole.h"
#include "dsp/oscillator.h"
#include "dsp/smoother.h"
#include "dsp/svf.h"
#include "sequencer_clock.h"
#include "groove_library.h"

#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace {

using namespace mpc::dsp;
using namespace mpc::dust87;

enum DrumType
{
    kKick = 0, kSubKick, kSnare, kCrack, kRim, kClap, kClosedHat, kOpenHat,
    kLowTom, kMidTom, kHighTom, kCrash, kRide, kCowbell, kClave, kShaker,
    kMetal, kZap, kNumDrums
};

enum VoiceParam { kTune = 0, kDecay, kLevel, kParamsPerVoice };
enum GlobalParam
{
    kBitDepth = 1 + kNumDrums * kParamsPerVoice,
    kSampleRate,
    kDrive,
    kPlateMix,
    kPlateDecay,
    kNumParams
};
constexpr int kBeatPulse = kNumParams;
constexpr int kSeqEnable = kBeatPulse + 1;
constexpr int kSeqLane = kSeqEnable + 1;
constexpr int kSeqBar = kSeqLane + 1;
constexpr int kSeqSwing = kSeqBar + 1;
constexpr int kSeqRandomize = kSeqSwing + 1;
constexpr int kSeqClear = kSeqRandomize + 1;
constexpr int kSeqPosition = kSeqClear + 1;
constexpr int kSeqStepStart = kSeqPosition + 1;
constexpr int kGroovePreset = kSeqStepStart + kSequenceStepsPerBar;
constexpr int kGrooveLoad = kGroovePreset + 1;
constexpr int kPadBank = kGrooveLoad + 1;
constexpr int kPadActionStart = kPadBank + 1;
constexpr int kPadSelected = kPadActionStart + 12;
constexpr int kPadModel = kPadSelected + 1;
constexpr int kPadTune = kPadModel + 1;
constexpr int kPadDecay = kPadTune + 1;
constexpr int kPadLevel = kPadDecay + 1;
constexpr int kPadMute = kPadLevel + 1;
constexpr int kPadSolo = kPadMute + 1;
constexpr int kPadChoke = kPadSolo + 1;
constexpr int kPadRandomize = kPadChoke + 1;
constexpr int kPadReset = kPadRandomize + 1;
constexpr int kTotalParams = kPadReset + 1;
constexpr int kPadCount = 48;
constexpr uint8_t kDefaultStepVelocity = 112;
constexpr int kSequenceStateVersion = 2;

constexpr int kMaster = 0;
constexpr int kVoiceLayers = 2;
constexpr int kMaxDelay = 4096;
constexpr int kMaxAllpass = 1024;

const char* const kDrumIds[kNumDrums] = {
    "kick", "sub", "snare", "crack", "rim", "clap", "chat", "ohat",
    "lowtom", "midtom", "hitom", "crash", "ride", "cbell", "clave",
    "shaker", "metal", "zap"
};

const char* const kDrumLabels[kNumDrums] = {
    "Kick", "Sub", "Snare", "Crack", "Rim", "Clap", "CHat", "OHat",
    "LoTom", "MidTom", "HiTom", "Crash", "Ride", "CBell", "Clave",
    "Shaker", "Metal", "Zap"
};

const char* const kPadModelLabels[kNumDrums] = {
    "Kick '87", "Sub Kick", "Snare '87", "Crack Snare", "Rimshot", "Clap 12B",
    "Closed Hat", "Open Hat", "Low Tom", "Mid Tom", "High Tom", "Crash 12-Bit",
    "Ride 87", "FM Cowbell", "Wood Clave", "Grit Shaker", "Metallic Perc",
    "Electro Zap"
};

constexpr int kBankAModels[12] = {
    kKick, kSnare, kRim, kClap, kClosedHat, kOpenHat,
    kLowTom, kMidTom, kHighTom, kCrash, kRide, kCowbell
};
constexpr int kBankBModels[12] = {
    kSubKick, kCrack, kClave, kShaker, kMetal, kZap,
    kKick, kSnare, kClosedHat, kClap, kLowTom, kCowbell
};

int defaultPadModel(int pad)
{
    const int position = pad % 12;
    return pad / 12 == 1 || pad / 12 == 3
        ? kBankBModels[position]
        : kBankAModels[position];
}

int defaultPadChoke(int pad)
{
    const int bank = pad / 12;
    const int position = pad % 12;
    if (bank == 0 || bank == 2)
    {
        if (position == 4 || position == 5) return 1;
        if (position == 9 || position == 10) return 2;
    }
    else
    {
        if (position == 8) return 1;
        if (position == 3 || position == 4) return 3;
    }
    return 0;
}

int voiceParam(int drum, VoiceParam param)
{
    return 1 + drum * kParamsPerVoice + static_cast<int>(param);
}

float decayCoefficient(float milliseconds, float sampleRate)
{
    const float samples = std::fmax(1.0f, milliseconds * 0.001f * sampleRate);
    return std::exp(-6.9078f / samples);
}

struct Comb
{
    std::array<float, kMaxDelay> data{};
    int delay = 1;
    int position = 0;

    void configure(int samples)
    {
        delay = mpc::clamp(samples, 1, kMaxDelay);
        position = 0;
        data.fill(0.0f);
    }

    float process(float input, float feedback)
    {
        const float delayed = data[static_cast<size_t>(position)];
        data[static_cast<size_t>(position)] = input + delayed * feedback;
        if (++position >= delay) position = 0;
        return delayed;
    }
};

struct Allpass
{
    std::array<float, kMaxAllpass> data{};
    int delay = 1;
    int position = 0;

    void configure(int samples)
    {
        delay = mpc::clamp(samples, 1, kMaxAllpass);
        position = 0;
        data.fill(0.0f);
    }

    float process(float input)
    {
        const float delayed = data[static_cast<size_t>(position)];
        const float output = delayed - input;
        data[static_cast<size_t>(position)] = input + delayed * 0.5f;
        if (++position >= delay) position = 0;
        return output;
    }
};

struct PlateChannel
{
    Comb combs[4];
    Allpass allpasses[2];
    float feedback[4] = {0.5f, 0.5f, 0.5f, 0.5f};

    void prepare(float sampleRate, int offset)
    {
        const int base[4] = {1493, 1601, 1867, 1999};
        for (int i = 0; i < 4; ++i)
            combs[i].configure(static_cast<int>(base[i] * sampleRate / 44100.0f) + offset);
        allpasses[0].configure(static_cast<int>(225 * sampleRate / 44100.0f) + offset);
        allpasses[1].configure(static_cast<int>(556 * sampleRate / 44100.0f) + offset);
    }

    void setDecay(float seconds, float sampleRate)
    {
        const float safeDecay = mpc::clamp(seconds, 0.3f, 6.0f);
        for (int i = 0; i < 4; ++i)
            feedback[i] = std::pow(0.001f, static_cast<float>(combs[i].delay) / (sampleRate * safeDecay));
    }

    void reset()
    {
        for (Comb& comb : combs) comb.data.fill(0.0f);
        for (Allpass& allpass : allpasses) allpass.data.fill(0.0f);
    }

    float process(float input)
    {
        float sum = 0.0f;
        for (int i = 0; i < 4; ++i) sum += combs[i].process(input, feedback[i]);
        return allpasses[1].process(allpasses[0].process(sum * 0.25f));
    }
};

struct DrumVoice
{
    DrumType type = kKick;
    double sampleRate = 44100.0;
    bool active = false;
    int padIndex = -1;
    int chokeGroup = 0;
    uint32_t age = 0;
    float gain = 0.0f;
    float pan = 0.0f;
    float amp = 0.0f;
    float ampCoef = 0.0f;
    float noiseEnv = 0.0f;
    float noiseCoef = 0.0f;
    float pitchEnv = 0.0f;
    float pitchCoef = 0.0f;
    float baseHz = 50.0f;
    float phases[6] = {};
    float increments[6] = {};
    WavetableSine sine;
    WavetableSine sine2;
    WhiteNoise noise;
    SVF filter;
    OnePoleHP highpass;

    void prepare(DrumType drum, double sr, uint32_t seed)
    {
        type = drum;
        sampleRate = sr;
        sine.setSampleRate(sr);
        sine2.setSampleRate(sr);
        filter.setSampleRate(sr);
        noise.reseed(seed);
        static const float pans[kNumDrums] = {
            0.0f, 0.0f, 0.0f, 0.06f, -0.18f, 0.12f, -0.24f, -0.24f,
            -0.3f, 0.05f, 0.32f, -0.3f, 0.28f, 0.18f, -0.18f, 0.26f,
            -0.22f, 0.15f
        };
        pan = pans[drum];
        kill();
    }

    void kill()
    {
        active = false;
        padIndex = -1;
        chokeGroup = 0;
        amp = 0.0f;
        noiseEnv = 0.0f;
        filter.reset();
        highpass.reset();
    }

    void trigger(float tune, float decay, float velocity, float level, uint32_t order)
    {
        static const float baseHz[kNumDrums] = {
            48.0f, 34.0f, 185.0f, 210.0f, 820.0f, 1200.0f, 6500.0f, 6200.0f,
            95.0f, 125.0f, 165.0f, 5100.0f, 3900.0f, 560.0f, 2300.0f, 8000.0f,
            1800.0f, 900.0f
        };
        static const float minMs[kNumDrums] = {
            140, 220, 110, 75, 35, 100, 35, 220, 180, 160, 140, 350, 280, 100,
            35, 70, 180, 60
        };
        static const float maxMs[kNumDrums] = {
            1250, 1800, 560, 320, 220, 720, 260, 1450, 1050, 850, 700, 1800,
            1350, 520, 260, 480, 900, 420
        };

        const float ratio = semitonesToRatio(tune);
        const float amount = mpc::clamp(decay, 0.0f, 1.0f);
        this->baseHz = baseHz[type] * ratio;
        amp = 1.0f;
        pitchEnv = 1.0f;
        noiseEnv = (type == kKick || type == kSubKick || type == kSnare ||
                    type == kCrack || type == kClap || type == kLowTom ||
                    type == kMidTom || type == kHighTom || type == kCrash ||
                    type == kRide || type == kShaker || type == kMetal) ? 1.0f : 0.0f;
        gain = level * (0.18f + 0.82f * mpc::clamp(velocity, 0.0f, 1.0f));
        age = order;
        active = true;
        ampCoef = decayCoefficient(minMs[type] + (maxMs[type] - minMs[type]) * amount,
                                   static_cast<float>(sampleRate));
        noiseCoef = decayCoefficient(18.0f + (maxMs[type] - 18.0f) * amount,
                                     static_cast<float>(sampleRate));
        pitchCoef = decayCoefficient(type == kZap ? 120.0f : 80.0f,
                                     static_cast<float>(sampleRate));

        sine.setFrequency(this->baseHz);
        sine2.setFrequency(this->baseHz * 1.61f);
        sine.resetPhase();
        sine2.resetPhase();
        const float cutoff = (type == kClap || type == kRim || type == kCowbell ||
                              type == kClave || type == kMetal) ? 1500.0f : 7200.0f;
        filter.set(cutoff, 0.65f);
        highpass.setCutoff(type == kShaker ? 4800.0f : 1700.0f,
                           static_cast<float>(sampleRate));
        setMetal(this->baseHz);
        for (float& phase : phases) phase = 0.0f;
    }

    void setMetal(float base)
    {
        static const float ratios[6] = {2.0f, 3.0f, 4.16f, 5.43f, 6.79f, 8.21f};
        for (int i = 0; i < 6; ++i)
            increments[i] = mpc::clamp(base * ratios[i] / static_cast<float>(sampleRate), 0.0f, 0.49f);
    }

    float metal(int count)
    {
        float sum = 0.0f;
        for (int i = 0; i < count; ++i)
        {
            sum += phases[i] < 0.5f ? 1.0f : -1.0f;
            phases[i] += increments[i];
            if (phases[i] >= 1.0f) phases[i] -= 1.0f;
        }
        return sum / static_cast<float>(count);
    }

    float process()
    {
        float out = 0.0f;
        const float n = noise.process();
        switch (type)
        {
            case kKick:
            case kSubKick:
            case kLowTom:
            case kMidTom:
            case kHighTom:
            {
                const float sweep = (type == kKick || type == kSubKick) ? 7.0f : 1.2f;
                sine.setFrequency(baseHz * (1.0f + sweep * pitchEnv));
                out = fastTanh(sine.process() * 1.65f) * amp + n * noiseEnv * 0.25f;
                pitchEnv *= pitchCoef;
                noiseEnv *= noiseCoef;
                amp *= ampCoef;
                break;
            }
            case kSnare:
            case kCrack:
            {
                sine.setFrequency(baseHz * (1.0f + 0.7f * pitchEnv));
                const float body = (sine.process() * 0.7f + sine2.process() * 0.3f) * amp;
                out = body * 0.55f + highpass.process(n) * noiseEnv * 0.9f;
                pitchEnv *= pitchCoef;
                noiseEnv *= noiseCoef;
                amp *= ampCoef;
                break;
            }
            case kRim:
            case kClave:
            {
                const float tone = metal(2);
                out = fastTanh(filter.process(tone, SVF::Mode::Bandpass) * 2.8f) * amp;
                amp *= ampCoef;
                break;
            }
            case kClap:
            {
                out = filter.process(n, SVF::Mode::Bandpass) * 2.4f * amp;
                amp *= ampCoef;
                break;
            }
            case kClosedHat:
            case kOpenHat:
            case kCrash:
            case kRide:
            {
                const float metalTone = metal(6);
                const float noiseTone = highpass.process(n) * noiseEnv;
                const float metallic = highpass.process(filter.process(metalTone, SVF::Mode::Highpass));
                out = metallic * amp * 0.8f + noiseTone * (type == kCrash || type == kRide ? 0.65f : 0.2f);
                amp *= ampCoef;
                noiseEnv *= noiseCoef;
                break;
            }
            case kCowbell:
            case kMetal:
            {
                out = fastTanh(filter.process(metal(2), SVF::Mode::Bandpass) * 3.0f) * amp;
                noiseEnv *= noiseCoef;
                amp *= ampCoef;
                if (type == kMetal) out += n * noiseEnv * 0.45f;
                break;
            }
            case kShaker:
            {
                out = highpass.process(n) * noiseEnv * amp;
                noiseEnv *= noiseCoef;
                amp *= ampCoef;
                break;
            }
            case kZap:
            default:
            {
                sine.setFrequency(baseHz * (0.25f + 5.0f * pitchEnv));
                out = fastTanh(sine.process() * 2.4f) * amp;
                pitchEnv *= pitchCoef;
                amp *= ampCoef;
                break;
            }
        }

        if (amp < 0.0008f && noiseEnv < 0.0008f) active = false;
        return out * gain;
    }
};

struct DrumBank
{
    DrumVoice voices[kVoiceLayers];
};

struct Plate
{
    PlateChannel left;
    PlateChannel right;

    void prepare(float sampleRate)
    {
        left.prepare(sampleRate, 0);
        right.prepare(sampleRate, 23);
        setDecay(2.0f, sampleRate);
    }

    void setDecay(float seconds, float sampleRate)
    {
        left.setDecay(seconds, sampleRate);
        right.setDecay(seconds, sampleRate);
    }

    void reset()
    {
        left.reset();
        right.reset();
    }
};

} // namespace

class DUST87 : public mpc::Plugin
{
public:
    DUST87() : mpc::Plugin(makeInfo())
    {
        addParam(mpc::floatParam("master", "Master", -36.0f, 6.0f, -6.0f, "dB", 1));
        for (int drum = 0; drum < kNumDrums; ++drum)
        {
            const std::string prefix = kDrumIds[drum];
            const std::string label = kDrumLabels[drum];
            addParam(mpc::floatParam((prefix + "_tune").c_str(), (label + " Tune").c_str(),
                                     -24.0f, 24.0f, 0.0f, "st", 1));
            addParam(mpc::floatParam((prefix + "_decay").c_str(), (label + " Decay").c_str(),
                                     0.0f, 100.0f, 55.0f, "%", 0));
            addParam(mpc::floatParam((prefix + "_level").c_str(), (label + " Level").c_str(),
                                     0.0f, 100.0f, 80.0f, "%", 0));
        }
        addParam(mpc::choiceParam("bit_depth", "Bit Depth", {"8-bit", "10-bit", "12-bit", "16-bit"}, 2));
        addParam(mpc::choiceParam("sample_rate", "Sample Rate", {"11k", "22k", "26k", "44k"}, 2));
        addParam(mpc::floatParam("drive", "Drive", 0.0f, 100.0f, 18.0f, "%", 0));
        addParam(mpc::floatParam("plate_mix", "Plate Mix", 0.0f, 100.0f, 22.0f, "%", 0));
        addParam(mpc::floatParam("plate_decay", "Plate Decay", 0.3f, 6.0f, 2.0f, "s", 1));
        mpc::Param beatPulseParam = mpc::floatParam("beat_pulse", "Beat Pulse", 0.0f, 1.0f, 0.0f, "", 3);
        beatPulseParam.automatable = false;
        addParam(beatPulseParam);

        mpc::Param sequenceEnable = mpc::boolParam("seq_enable", "Seq", false);
        addParam(sequenceEnable);
        mpc::Param sequenceLane = mpc::choiceParam(
            "seq_lane", "Lane",
            {"Kick", "Sub", "Snare", "Crack", "Rim", "Clap", "CHat", "OHat",
             "LoTom", "MidTom", "HiTom", "Crash", "Ride", "CBell", "Clave",
             "Shaker", "Metal", "Zap"});
        sequenceLane.automatable = false;
        addParam(sequenceLane);
        mpc::Param sequenceBar = mpc::choiceParam(
            "seq_bar", "Bar", {"BAR 1", "BAR 2", "BAR 3", "BAR 4"});
        sequenceBar.automatable = false;
        addParam(sequenceBar);
        mpc::Param sequenceSwing = mpc::floatParam("seq_swing", "Swing", 0.0f, 40.0f, 12.0f, "%", 0);
        addParam(sequenceSwing);
        mpc::Param randomizeSequence = mpc::boolParam("seq_randomize", "Rnd Seq", false);
        randomizeSequence.automatable = false;
        addParam(randomizeSequence);
        mpc::Param clearSequence = mpc::boolParam("seq_clear", "Clear", false);
        clearSequence.automatable = false;
        addParam(clearSequence);
        std::vector<std::string> sequencePositions;
        for (int step = 1; step <= kSequenceStepsPerBar; ++step)
            sequencePositions.push_back("STEP " + std::to_string(step));
        sequencePositions.push_back("STOP");
        mpc::Param sequencePosition = mpc::choiceParam(
            "seq_position", "Playhead", std::move(sequencePositions), kSequenceStepsPerBar);
        sequencePosition.automatable = false;
        addParam(sequencePosition);
        for (int step = 0; step < kSequenceStepsPerBar; ++step)
        {
            const std::string id = "seq_step_" + std::to_string(step + 1);
            const std::string label = "Step " + (step + 1 < 10 ? std::string("0") : std::string()) +
                                      std::to_string(step + 1);
            mpc::Param sequenceStep = mpc::boolParam(id.c_str(), label.c_str(), false);
            sequenceStep.automatable = false;
            addParam(sequenceStep);
        }

        std::vector<std::string> grooveChoices;
        grooveChoices.reserve(kBuiltinGrooveCount);
        for (size_t presetIndex = 0; presetIndex < kBuiltinGrooveCount; ++presetIndex)
        {
            BuiltinGroove groove;
            if (!getBuiltinGroove(presetIndex, groove))
                continue;
            grooveChoices.push_back(
                (presetIndex < 9 ? "0" : "") + std::to_string(presetIndex + 1) + " | " +
                groove.name + " | " + groove.genre + " | " + std::to_string(groove.bpm) +
                " BPM | " +
                std::to_string(static_cast<int>(std::lround(groove.swing * 100.0f))) + "%");
        }
        mpc::Param groovePreset = mpc::choiceParam(
            "groove_preset", "Groove", std::move(grooveChoices));
        groovePreset.automatable = false;
        addParam(groovePreset);
        mpc::Param loadGroove = mpc::boolParam("groove_load", "Load Groove", false);
        loadGroove.automatable = false;
        addParam(loadGroove);

        mpc::Param padBank = mpc::choiceParam(
            "pad_bank", "Bank", {"BANK A", "BANK B", "BANK C", "BANK D"});
        padBank.automatable = false;
        addParam(padBank);
        for (int pad = 0; pad < 12; ++pad)
        {
            const std::string id = "pad_hit_" + std::to_string(pad + 1);
            const std::string label = "Pad " +
                (pad + 1 < 10 ? std::string("0") : std::string()) +
                std::to_string(pad + 1);
            mpc::Param padHit = mpc::boolParam(id.c_str(), label.c_str(), false);
            padHit.automatable = false;
            addParam(padHit);
        }

        std::vector<std::string> selectedPads;
        selectedPads.reserve(kPadCount);
        for (int pad = 0; pad < kPadCount; ++pad)
        {
            const std::string label = "PAD " +
                (pad + 1 < 10 ? std::string("0") : std::string()) +
                std::to_string(pad + 1);
            selectedPads.push_back(label);
        }
        mpc::Param selectedPad = mpc::choiceParam(
            "pad_selected", "Selected Pad", std::move(selectedPads));
        selectedPad.automatable = false;
        addParam(selectedPad);
        std::vector<std::string> modelChoices;
        modelChoices.reserve(kNumDrums);
        for (const char* label : kPadModelLabels)
            modelChoices.emplace_back(label);
        mpc::Param padModel = mpc::choiceParam(
            "pad_model", "Voice Model", std::move(modelChoices));
        padModel.automatable = false;
        addParam(padModel);
        addParam(mpc::floatParam("pad_tune", "Pad Tune", -24.0f, 24.0f, 0.0f, "st", 1));
        addParam(mpc::floatParam("pad_decay", "Pad Decay", 0.0f, 100.0f, 55.0f, "%", 0));
        addParam(mpc::floatParam("pad_level", "Pad Level", 0.0f, 100.0f, 80.0f, "%", 0));
        mpc::Param padMute = mpc::boolParam("pad_mute", "Mute Voice", false);
        padMute.automatable = false;
        addParam(padMute);
        mpc::Param padSolo = mpc::boolParam("pad_solo", "Solo Voice", false);
        padSolo.automatable = false;
        addParam(padSolo);
        mpc::Param padChoke = mpc::choiceParam(
            "pad_choke", "Choke Group", {"OFF", "GRP 1", "GRP 2", "GRP 3", "GRP 4"});
        padChoke.automatable = false;
        addParam(padChoke);
        mpc::Param randomizePad = mpc::boolParam(
            "pad_randomize", "Randomize Voice", false);
        randomizePad.automatable = false;
        addParam(randomizePad);
        mpc::Param resetPad = mpc::boolParam("pad_reset", "Reset Voice", false);
        resetPad.automatable = false;
        addParam(resetPad);

        for (int drum = 0; drum < kNumDrums; ++drum)
            for (int step = 0; step < kSequenceSteps; ++step)
            {
                sequencePattern_[drum][step].store(0, std::memory_order_relaxed);
                stagedSequencePattern_[drum][step].store(0, std::memory_order_relaxed);
            }
        for (int pad = 0; pad < kPadCount; ++pad)
        {
            padModels_[pad].store(defaultPadModel(pad), std::memory_order_relaxed);
            padTunes_[pad].store(0.0f, std::memory_order_relaxed);
            padDecays_[pad].store(55.0f, std::memory_order_relaxed);
            padLevels_[pad].store(80.0f, std::memory_order_relaxed);
            padMutes_[pad].store(false, std::memory_order_relaxed);
            padSolos_[pad].store(false, std::memory_order_relaxed);
            padChokes_[pad].store(defaultPadChoke(pad), std::memory_order_relaxed);
        }
        syncPadEditor();

        if (numParams() != kTotalParams) mpc::log("DUST '87: parameter count mismatch");
        addPrograms();
    }

    void parameterChanged(int index, float plainValue) override
    {
        if (index == kSeqLane || index == kSeqBar)
        {
            syncSequenceSteps();
            return;
        }

        if (index == kPadSelected)
        {
            const int pad = mpc::clamp(
                static_cast<int>(std::lround(plainValue)), 0, kPadCount - 1);
            selectedPad_.store(pad, std::memory_order_relaxed);
            syncPadEditor();
            return;
        }

        if (index >= kPadActionStart && index < kPadSelected && plainValue >= 0.5f)
        {
            const int bank = mpc::clamp(getInt(kPadBank), 0, 3);
            const int pad = bank * 12 + index - kPadActionStart;
            selectedPad_.store(pad, std::memory_order_relaxed);
            pendingPadIndices_[static_cast<size_t>(index - kPadActionStart)].store(
                pad, std::memory_order_relaxed);
            set(kPadSelected, static_cast<float>(pad));
            syncPadEditor();
            pendingPadHits_[static_cast<size_t>(pad)].store(true, std::memory_order_release);
            return;
        }

        const int selectedPad = mpc::clamp(
            selectedPad_.load(std::memory_order_relaxed), 0, kPadCount - 1);
        if (index == kPadModel)
        {
            padModels_[static_cast<size_t>(selectedPad)].store(
                mpc::clamp(static_cast<int>(std::lround(plainValue)), 0, kNumDrums - 1),
                std::memory_order_relaxed);
            return;
        }
        if (index == kPadTune)
        {
            padTunes_[static_cast<size_t>(selectedPad)].store(
                mpc::clamp(plainValue, -24.0f, 24.0f), std::memory_order_relaxed);
            return;
        }
        if (index == kPadDecay)
        {
            padDecays_[static_cast<size_t>(selectedPad)].store(
                mpc::clamp(plainValue, 0.0f, 100.0f), std::memory_order_relaxed);
            return;
        }
        if (index == kPadLevel)
        {
            padLevels_[static_cast<size_t>(selectedPad)].store(
                mpc::clamp(plainValue, 0.0f, 100.0f), std::memory_order_relaxed);
            return;
        }
        if (index == kPadMute)
        {
            padMutes_[static_cast<size_t>(selectedPad)].store(
                plainValue >= 0.5f, std::memory_order_relaxed);
            return;
        }
        if (index == kPadSolo)
        {
            padSolos_[static_cast<size_t>(selectedPad)].store(
                plainValue >= 0.5f, std::memory_order_relaxed);
            return;
        }
        if (index == kPadChoke)
        {
            padChokes_[static_cast<size_t>(selectedPad)].store(
                mpc::clamp(static_cast<int>(std::lround(plainValue)), 0, 4),
                std::memory_order_relaxed);
            return;
        }
        if (index == kPadRandomize && plainValue >= 0.5f)
        {
            randomizeSelectedPad();
            return;
        }
        if (index == kPadReset && plainValue >= 0.5f)
        {
            resetSelectedPad();
            return;
        }

        if (index >= kSeqStepStart &&
            index < kSeqStepStart + kSequenceStepsPerBar)
        {
            const int lane = mpc::clamp(getInt(kSeqLane), 0, kNumDrums - 1);
            const int bar = mpc::clamp(getInt(kSeqBar), 0, kSequenceBars - 1);
            const int step = bar * kSequenceStepsPerBar + index - kSeqStepStart;
            sequencePattern_[lane][step].store(
                plainValue >= 0.5f ? kDefaultStepVelocity : 0,
                std::memory_order_relaxed);
            return;
        }

    }

    void prepare(double sampleRate, int /*maxBlockSize*/) override
    {
        sampleRate_ = static_cast<float>(sampleRate);
        for (int drum = 0; drum < kNumDrums; ++drum)
            for (int layer = 0; layer < kVoiceLayers; ++layer)
                voices_[drum].voices[layer].prepare(static_cast<DrumType>(drum),
                                                    sampleRate, static_cast<uint32_t>(drum * 101 + layer + 1));
        plate_.prepare(sampleRate_);
        master_.setTime(12.0f, sampleRate_);
        reset();
    }

    void reset() override
    {
        if (sequenceStatePending_.exchange(false, std::memory_order_acquire))
        {
            for (int drum = 0; drum < kNumDrums; ++drum)
                for (int step = 0; step < kSequenceSteps; ++step)
                    sequencePattern_[drum][step].store(
                        stagedSequencePattern_[drum][step].load(std::memory_order_relaxed),
                        std::memory_order_relaxed);
            if (stagedPadStatePresent_.exchange(false, std::memory_order_acquire))
            {
                for (int pad = 0; pad < kPadCount; ++pad)
                {
                    const auto& staged = stagedPadState_[static_cast<size_t>(pad)];
                    padModels_[static_cast<size_t>(pad)].store(
                        mpc::clamp(static_cast<int>(staged[0].load(std::memory_order_relaxed)),
                                   0, kNumDrums - 1),
                        std::memory_order_relaxed);
                    padTunes_[static_cast<size_t>(pad)].store(
                        mpc::clamp(static_cast<float>(static_cast<int8_t>(
                                       staged[1].load(std::memory_order_relaxed))),
                                   -24.0f, 24.0f),
                        std::memory_order_relaxed);
                    padDecays_[static_cast<size_t>(pad)].store(
                        mpc::clamp(static_cast<float>(
                                       staged[2].load(std::memory_order_relaxed)),
                                   0.0f, 100.0f),
                        std::memory_order_relaxed);
                    padLevels_[static_cast<size_t>(pad)].store(
                        mpc::clamp(static_cast<float>(
                                       staged[3].load(std::memory_order_relaxed)),
                                   0.0f, 100.0f),
                        std::memory_order_relaxed);
                    padMutes_[static_cast<size_t>(pad)].store(
                        staged[4].load(std::memory_order_relaxed) != 0,
                        std::memory_order_relaxed);
                    padSolos_[static_cast<size_t>(pad)].store(
                        staged[5].load(std::memory_order_relaxed) != 0,
                        std::memory_order_relaxed);
                    padChokes_[static_cast<size_t>(pad)].store(
                        mpc::clamp(static_cast<int>(
                                       staged[6].load(std::memory_order_relaxed)),
                                   0, 4),
                        std::memory_order_relaxed);
                }
                syncPadEditor();
            }
        }
        for (DrumBank& bank : voices_)
            for (DrumVoice& voice : bank.voices) voice.kill();
        plate_.reset();
        master_.snap(dbToGain(get(kMaster)));
        heldLeft_ = heldRight_ = 0.0f;
        sampleHoldPhase_ = 1.0f;
        noteCounter_ = 0;
        beatPulse_ = 0.0f;
        lastSequenceAbsoluteStep_ = -1;
        set(kBeatPulse, beatPulse_);
        set(kSeqRandomize, 0.0f);
        set(kSeqClear, 0.0f);
        set(kGrooveLoad, 0.0f);
        set(kPadRandomize, 0.0f);
        set(kPadReset, 0.0f);
        set(kSeqPosition, kSequenceStepsPerBar);
        syncSequenceSteps();
    }

    void saveExtraState(std::vector<uint8_t>& out) override
    {
        out.clear();
        out.reserve(1 + kNumDrums * kSequenceSteps + kPadCount * 7);
        out.push_back(kSequenceStateVersion);
        for (int drum = 0; drum < kNumDrums; ++drum)
            for (int step = 0; step < kSequenceSteps; ++step)
                out.push_back(sequencePattern_[drum][step].load(std::memory_order_relaxed));
        for (int pad = 0; pad < kPadCount; ++pad)
        {
            const size_t index = static_cast<size_t>(pad);
            out.push_back(static_cast<uint8_t>(padModels_[index].load(std::memory_order_relaxed)));
            out.push_back(static_cast<uint8_t>(
                static_cast<int8_t>(std::lround(padTunes_[index].load(std::memory_order_relaxed)))));
            out.push_back(static_cast<uint8_t>(
                std::lround(padDecays_[index].load(std::memory_order_relaxed))));
            out.push_back(static_cast<uint8_t>(
                std::lround(padLevels_[index].load(std::memory_order_relaxed))));
            out.push_back(padMutes_[index].load(std::memory_order_relaxed) ? 1 : 0);
            out.push_back(padSolos_[index].load(std::memory_order_relaxed) ? 1 : 0);
            out.push_back(static_cast<uint8_t>(padChokes_[index].load(std::memory_order_relaxed)));
        }
        // The beat ring is transient UI state; clear it when a project is saved.
        set(kBeatPulse, 0.0f);
    }

    void loadExtraState(const uint8_t* data, size_t size) override
    {
        const size_t sequenceStateSize = 1 + kNumDrums * kSequenceSteps;
        const size_t currentStateSize = sequenceStateSize + kPadCount * 7;
        if (data == nullptr)
        {
            mpc::log("DUST '87: unsupported plug-in state; keeping current patterns and pads");
            return;
        }
        const bool legacyState = size == sequenceStateSize && data[0] == 1;
        const bool currentState = size == currentStateSize &&
                                  data[0] == kSequenceStateVersion;
        if (!legacyState && !currentState)
        {
            mpc::log("DUST '87: unsupported plug-in state; keeping current patterns and pads");
            return;
        }

        size_t offset = 1;
        for (int drum = 0; drum < kNumDrums; ++drum)
            for (int step = 0; step < kSequenceSteps; ++step)
                stagedSequencePattern_[drum][step].store(data[offset++], std::memory_order_relaxed);
        if (currentState)
            for (int pad = 0; pad < kPadCount; ++pad)
            {
                auto& staged = stagedPadState_[static_cast<size_t>(pad)];
                for (auto& value : staged)
                    value.store(data[offset++], std::memory_order_relaxed);
            }
        stagedPadStatePresent_.store(currentState, std::memory_order_relaxed);
        sequenceStatePending_.store(true, std::memory_order_release);
    }

    void process(mpc::ProcessContext& ctx) override
    {
        const float pulseDecay = std::pow(
            0.86f,
            static_cast<float>(ctx.numFrames) * 60.0f / sampleRate_);
        beatPulse_ *= pulseDecay;

        const int bitIndex = mpc::clamp(getInt(kBitDepth), 0, 3);
        const int rateIndex = mpc::clamp(getInt(kSampleRate), 0, 3);
        static const int bitDepths[4] = {8, 10, 12, 16};
        static const float sampleRates[4] = {11025.0f, 22050.0f, 26000.0f, 44100.0f};
        const int bits = bitDepths[bitIndex];
        const float holdRatio = sampleRates[rateIndex] / sampleRate_;
        const float drive = 1.0f + get(kDrive) * 0.09f;
        const float driveNorm = fastTanh(drive);
        const float plateMix = get(kPlateMix) * 0.01f;
        const float plateDecay = get(kPlateDecay);
        if (std::fabs(plateDecay - lastPlateDecay_) > 0.01f)
        {
            plate_.setDecay(plateDecay, sampleRate_);
            lastPlateDecay_ = plateDecay;
        }
        master_.setTarget(dbToGain(get(kMaster)));
        processSequenceCommands();
        processPadCommands();

        float tune[kNumDrums];
        float decay[kNumDrums];
        float level[kNumDrums];
        for (int drum = 0; drum < kNumDrums; ++drum)
        {
            tune[drum] = get(voiceParam(drum, kTune));
            decay[drum] = get(voiceParam(drum, kDecay)) * 0.01f;
            level[drum] = get(voiceParam(drum, kLevel)) * 0.01f;
        }

        const bool sequenceRunning = getBool(kSeqEnable) && ctx.transport.playing &&
                                     ctx.transport.ppqValid && ctx.numFrames > 0;
        if (sequenceRunning)
        {
            processWithSequence(ctx, tune, decay, level, holdRatio, bits, drive, driveNorm, plateMix);
        }
        else
        {
            lastSequenceAbsoluteStep_ = -1;
            if (getInt(kSeqPosition) != kSequenceStepsPerBar)
                set(kSeqPosition, kSequenceStepsPerBar);

            int position = 0;
            for (int event = 0; event < ctx.numMidiEvents; ++event)
            {
                const int eventPosition = mpc::clamp(
                    ctx.midi[event].sampleOffset, position, ctx.numFrames);
                render(ctx, position, eventPosition, holdRatio, bits, drive, driveNorm, plateMix);
                handleMidi(ctx.midi[event], tune, decay, level);
                position = eventPosition;
            }
            render(ctx, position, ctx.numFrames, holdRatio, bits, drive, driveNorm, plateMix);
        }
        set(kBeatPulse, beatPulse_);
    }

private:
    static mpc::PluginInfo makeInfo()
    {
        mpc::PluginInfo info;
        info.name = "DUST '87";
        info.vendor = "Lumina.Aerospace";
        info.uniqueId = MPC_FOURCC('L', 'M', 'D', '8');
        info.version = 100;
        info.isInstrument = true;
        info.numInputs = 0;
        info.numOutputs = 2;
        info.tailSamples = 0;
        return info;
    }

    static float dbToGain(float db) { return std::pow(10.0f, db / 20.0f); }

    static float quantize(float sample, int bits)
    {
        const float levels = static_cast<float>((1u << (bits - 1)) - 1u);
        return std::round(mpc::clamp(sample, -1.0f, 1.0f) * levels) / levels;
    }

    void syncPadEditor()
    {
        const size_t pad = static_cast<size_t>(mpc::clamp(
            selectedPad_.load(std::memory_order_relaxed), 0, kPadCount - 1));
        set(kPadModel, static_cast<float>(padModels_[pad].load(std::memory_order_relaxed)));
        set(kPadTune, padTunes_[pad].load(std::memory_order_relaxed));
        set(kPadDecay, padDecays_[pad].load(std::memory_order_relaxed));
        set(kPadLevel, padLevels_[pad].load(std::memory_order_relaxed));
        set(kPadMute, padMutes_[pad].load(std::memory_order_relaxed) ? 1.0f : 0.0f);
        set(kPadSolo, padSolos_[pad].load(std::memory_order_relaxed) ? 1.0f : 0.0f);
        set(kPadChoke, static_cast<float>(padChokes_[pad].load(std::memory_order_relaxed)));
    }

    void randomizeSelectedPad()
    {
        const size_t pad = static_cast<size_t>(mpc::clamp(
            selectedPad_.load(std::memory_order_relaxed), 0, kPadCount - 1));
        uint32_t randomState = 0x87d057u ^
            static_cast<uint32_t>(pad * 0x9e3779b9u) ^
            padRandomCounter_.fetch_add(1, std::memory_order_relaxed);
        if (randomState == 0)
            randomState = 0x9e3779b9u;
        padModels_[pad].store(
            static_cast<int>(nextGrooveRandom(randomState) % kNumDrums),
            std::memory_order_relaxed);
        padTunes_[pad].store(
            static_cast<float>(static_cast<int>(nextGrooveRandom(randomState) % 49) - 24),
            std::memory_order_relaxed);
        padDecays_[pad].store(
            static_cast<float>(20 + nextGrooveRandom(randomState) % 81),
            std::memory_order_relaxed);
        padLevels_[pad].store(
            static_cast<float>(50 + nextGrooveRandom(randomState) % 51),
            std::memory_order_relaxed);
        syncPadEditor();
    }

    void resetSelectedPad()
    {
        const int pad = mpc::clamp(
            selectedPad_.load(std::memory_order_relaxed), 0, kPadCount - 1);
        const size_t index = static_cast<size_t>(pad);
        padModels_[index].store(defaultPadModel(pad), std::memory_order_relaxed);
        padTunes_[index].store(0.0f, std::memory_order_relaxed);
        padDecays_[index].store(55.0f, std::memory_order_relaxed);
        padLevels_[index].store(80.0f, std::memory_order_relaxed);
        padMutes_[index].store(false, std::memory_order_relaxed);
        padSolos_[index].store(false, std::memory_order_relaxed);
        padChokes_[index].store(defaultPadChoke(pad), std::memory_order_relaxed);
        syncPadEditor();
    }

    void applyBuiltinGroove()
    {
        BuiltinGroove groove;
        const int preset = mpc::clamp(
            getInt(kGroovePreset), 0, static_cast<int>(kBuiltinGrooveCount) - 1);
        if (!getBuiltinGroove(static_cast<size_t>(preset), groove))
        {
            mpc::log("DUST '87: selected built-in groove could not be loaded");
            return;
        }

        for (int drum = 0; drum < kNumDrums; ++drum)
            for (int step = 0; step < kSequenceSteps; ++step)
                sequencePattern_[drum][step].store(
                    groove.pattern[static_cast<size_t>(drum)][static_cast<size_t>(step)],
                    std::memory_order_relaxed);
        set(kSeqSwing, groove.swing * 100.0f);
        set(kSeqEnable, 1.0f);
        syncSequenceSteps();
    }

    void addPrograms()
    {
        std::vector<float> values(static_cast<size_t>(numParams()));
        for (int i = 0; i < numParams(); ++i) values[static_cast<size_t>(i)] = param(i).def;
        addProgram("Factory 87", values);

        values[static_cast<size_t>(voiceParam(kKick, kTune))] = -3.0f;
        values[static_cast<size_t>(voiceParam(kKick, kDecay))] = 76.0f;
        values[static_cast<size_t>(voiceParam(kSnare, kDecay))] = 48.0f;
        addProgram("Tape Dust", values);

        values[static_cast<size_t>(voiceParam(kSubKick, kTune))] = -5.0f;
        values[static_cast<size_t>(voiceParam(kSubKick, kDecay))] = 84.0f;
        addProgram("Sub Heavy", values);

        values[static_cast<size_t>(voiceParam(kClosedHat, kDecay))] = 28.0f;
        values[static_cast<size_t>(voiceParam(kOpenHat, kDecay))] = 68.0f;
        values[static_cast<size_t>(kDrive)] = 28.0f;
        addProgram("Lo-Fi Break", values);

        values[static_cast<size_t>(voiceParam(kCrack, kLevel))] = 92.0f;
        values[static_cast<size_t>(voiceParam(kRim, kTune))] = 4.0f;
        addProgram("Crate Snare", values);

        values[static_cast<size_t>(kBitDepth)] = 3.0f;
        values[static_cast<size_t>(kSampleRate)] = 3.0f;
        values[static_cast<size_t>(kDrive)] = 8.0f;
        values[static_cast<size_t>(kPlateMix)] = 8.0f;
        addProgram("Dry Machine", values);

        values[static_cast<size_t>(kBitDepth)] = 1.0f;
        values[static_cast<size_t>(kSampleRate)] = 1.0f;
        values[static_cast<size_t>(kDrive)] = 38.0f;
        values[static_cast<size_t>(kPlateMix)] = 44.0f;
        values[static_cast<size_t>(kPlateDecay)] = 3.8f;
        addProgram("Dark Plate", values);

        values[static_cast<size_t>(kBitDepth)] = 2.0f;
        values[static_cast<size_t>(kSampleRate)] = 2.0f;
        values[static_cast<size_t>(kDrive)] = 16.0f;
        values[static_cast<size_t>(kPlateMix)] = 16.0f;
        values[static_cast<size_t>(kPlateDecay)] = 1.2f;
        addProgram("Bright 12", values);
    }

    void handleMidi(const mpc::MidiEvent& event, const float* tune,
                    const float* decay, const float* level)
    {
        if (event.isNoteOn())
        {
            if (event.note() >= 36 && event.note() < 36 + kPadCount)
                triggerPad(event.note() - 36, event.velocity());
            else
            {
                const int drum = ((event.note() - 36) % kNumDrums + kNumDrums) % kNumDrums;
                triggerDrum(drum, event.velocity(), tune, decay, level);
            }
        }
        else if (event.isAllNotesOff())
        {
            for (DrumBank& bank : voices_)
                for (DrumVoice& voice : bank.voices) voice.kill();
        }
    }

    void triggerDrum(int drum, int velocity, const float* tune,
                     const float* decay, const float* level)
    {
        triggerDrum(drum, velocity, tune[drum], decay[drum], level[drum]);
    }

    void triggerDrum(int drum, int velocity, float tune, float decay, float level,
                     int pad = -1, int chokeGroup = 0)
    {
        beatPulse_ = std::fmax(
            beatPulse_,
            mpc::clamp(static_cast<float>(velocity) / 127.0f, 0.15f, 1.0f));
        if (drum == kClosedHat)
            for (DrumVoice& voice : voices_[kOpenHat].voices) voice.kill();
        DrumVoice& voice = findVoice(drum);
        voice.trigger(tune, decay, static_cast<float>(velocity) / 127.0f,
                      level, ++noteCounter_);
        voice.padIndex = pad;
        voice.chokeGroup = chokeGroup;
    }

    void triggerPad(int pad, int velocity)
    {
        if (pad < 0 || pad >= kPadCount)
            return;

        const size_t index = static_cast<size_t>(pad);
        const bool solo = padSolos_[index].load(std::memory_order_relaxed);
        if (padMutes_[index].load(std::memory_order_relaxed))
            return;
        bool anySolo = false;
        for (const auto& soloState : padSolos_)
            anySolo = anySolo || soloState.load(std::memory_order_relaxed);
        if (anySolo && !solo)
            return;

        const int chokeGroup = padChokes_[index].load(std::memory_order_relaxed);
        if (chokeGroup > 0)
            for (DrumBank& bank : voices_)
                for (DrumVoice& voice : bank.voices)
                    if (voice.active && voice.padIndex != pad &&
                        voice.chokeGroup == chokeGroup)
                        voice.kill();

        const int model = mpc::clamp(
            padModels_[index].load(std::memory_order_relaxed), 0, kNumDrums - 1);
        triggerDrum(
            model, velocity,
            padTunes_[index].load(std::memory_order_relaxed),
            padDecays_[index].load(std::memory_order_relaxed) * 0.01f,
            padLevels_[index].load(std::memory_order_relaxed) * 0.01f,
            pad, chokeGroup);
    }

    void processWithSequence(mpc::ProcessContext& ctx, const float* tune,
                             const float* decay, const float* level,
                             float holdRatio, int bits, float drive,
                             float driveNorm, float plateMix)
    {
        const double bpm = ctx.transport.tempoValid && ctx.transport.bpm > 0.0
            ? ctx.transport.bpm
            : 120.0;
        const double ppqPerSample = bpm / (60.0 * ctx.sampleRate);
        const double swing = get(kSeqSwing) * 0.01;
        int position = 0;
        int event = 0;

        for (int frame = 0; frame < ctx.numFrames; ++frame)
        {
            const bool midiDue = event < ctx.numMidiEvents &&
                mpc::clamp(ctx.midi[event].sampleOffset, 0, ctx.numFrames) <= frame;
            const double ppq = ctx.transport.ppqPos + frame * ppqPerSample;
            const int64_t absoluteStep = mpc::dust87::sequenceAbsoluteStepAtPpq(
                ppq, swing);
            const bool sequenceStepDue = absoluteStep >= 0 &&
                                         absoluteStep != lastSequenceAbsoluteStep_;
            const bool transportDiscontinuity = lastSequenceAbsoluteStep_ < 0 ||
                absoluteStep != lastSequenceAbsoluteStep_ + 1;
            const bool skipCurrentStep = sequenceStepDue && transportDiscontinuity &&
                !mpc::dust87::sequenceIsStepBoundaryAtPpq(ppq, swing, ppqPerSample);
            if (!midiDue && !sequenceStepDue)
                continue;

            render(ctx, position, frame, holdRatio, bits, drive, driveNorm, plateMix);
            while (event < ctx.numMidiEvents &&
                   mpc::clamp(ctx.midi[event].sampleOffset, 0, ctx.numFrames) <= frame)
            {
                handleMidi(ctx.midi[event], tune, decay, level);
                ++event;
            }

            if (sequenceStepDue)
            {
                lastSequenceAbsoluteStep_ = absoluteStep;
                const int patternStep = static_cast<int>(absoluteStep % kSequenceSteps);
                const int bar = patternStep / kSequenceStepsPerBar;
                const int barStep = patternStep % kSequenceStepsPerBar;
                const int selectedBar = mpc::clamp(getInt(kSeqBar), 0, kSequenceBars - 1);
                const int playhead = bar == selectedBar ? barStep : kSequenceStepsPerBar;
                if (getInt(kSeqPosition) != playhead)
                    set(kSeqPosition, playhead);

                if (!skipCurrentStep)
                    for (int drum = 0; drum < kNumDrums; ++drum)
                    {
                        const int velocity = sequencePattern_[drum][patternStep].load(
                            std::memory_order_relaxed);
                        if (velocity > 0)
                            triggerDrum(drum, velocity, tune, decay, level);
                    }
            }
            position = frame;
        }

        render(ctx, position, ctx.numFrames, holdRatio, bits, drive, driveNorm, plateMix);
        while (event < ctx.numMidiEvents)
        {
            handleMidi(ctx.midi[event], tune, decay, level);
            ++event;
        }
    }

    void processSequenceCommands()
    {
        if (getBool(kGrooveLoad))
        {
            applyBuiltinGroove();
            set(kGrooveLoad, 0.0f);
        }
        if (getBool(kSeqClear))
        {
            const int lane = mpc::clamp(getInt(kSeqLane), 0, kNumDrums - 1);
            for (int step = 0; step < kSequenceSteps; ++step)
                sequencePattern_[lane][step].store(0, std::memory_order_relaxed);
            syncSequenceSteps();
            set(kSeqClear, 0.0f);
        }
        if (getBool(kSeqRandomize))
        {
            randomizeSequence();
            set(kSeqEnable, 1.0f);
            syncSequenceSteps();
            set(kSeqRandomize, 0.0f);
        }
    }

    void processPadCommands()
    {
        for (int pad = 0; pad < 12; ++pad)
            if (pendingPadHits_[static_cast<size_t>(pad)].exchange(
                    false, std::memory_order_acquire))
            {
                const int padIndex = pendingPadIndices_[static_cast<size_t>(pad)].load(
                    std::memory_order_relaxed);
                triggerPad(padIndex, 100);
                set(kPadActionStart + pad, 0.0f);
            }
        if (getBool(kPadRandomize)) set(kPadRandomize, 0.0f);
        if (getBool(kPadReset)) set(kPadReset, 0.0f);
    }

    void randomizeSequence()
    {
        mpc::dust87::GroovePattern pattern{};
        const float swing = mpc::dust87::generateRandomGroove(
            pattern, sequenceRandomState_);
        for (int drum = 0; drum < kNumDrums; ++drum)
            for (int step = 0; step < kSequenceSteps; ++step)
                sequencePattern_[drum][step].store(
                    pattern[static_cast<size_t>(drum)][static_cast<size_t>(step)],
                    std::memory_order_relaxed);
        set(kSeqSwing, swing * 100.0f);
    }

    void syncSequenceSteps()
    {
        const int lane = mpc::clamp(getInt(kSeqLane), 0, kNumDrums - 1);
        const int bar = mpc::clamp(getInt(kSeqBar), 0, kSequenceBars - 1);
        const int firstStep = bar * kSequenceStepsPerBar;
        for (int step = 0; step < kSequenceStepsPerBar; ++step)
        {
            const bool active = sequencePattern_[lane][firstStep + step].load(
                std::memory_order_relaxed) > 0;
            set(kSeqStepStart + step, active ? 1.0f : 0.0f);
        }
    }

    DrumVoice& findVoice(int drum)
    {
        DrumVoice* oldest = &voices_[drum].voices[0];
        for (DrumVoice& voice : voices_[drum].voices)
        {
            if (!voice.active) return voice;
            if (voice.age < oldest->age) oldest = &voice;
        }
        return *oldest;
    }

    void render(mpc::ProcessContext& ctx, int from, int to, float holdRatio,
                int bits, float drive, float driveNorm, float plateMix)
    {
        float* outLeft = ctx.outputs[0];
        float* outRight = ctx.numOutputs > 1 ? ctx.outputs[1] : nullptr;

        for (int frame = from; frame < to; ++frame)
        {
            float left = 0.0f;
            float right = 0.0f;
            for (DrumBank& bank : voices_)
            {
                for (DrumVoice& voice : bank.voices)
                {
                    if (!voice.active) continue;
                    float gainLeft, gainRight;
                    equalPowerPan(voice.pan, gainLeft, gainRight);
                    const float sample = voice.process();
                    left += sample * gainLeft;
                    right += sample * gainRight;
                }
            }

            const float wetLeft = plate_.left.process(left);
            const float wetRight = plate_.right.process(right);
            left += (wetLeft - left) * plateMix;
            right += (wetRight - right) * plateMix;
            left = fastTanh(left * drive) / driveNorm;
            right = fastTanh(right * drive) / driveNorm;

            sampleHoldPhase_ += holdRatio;
            if (sampleHoldPhase_ >= 1.0f)
            {
                sampleHoldPhase_ -= 1.0f;
                const float masterGain = master_.process();
                heldLeft_ = quantize(left * masterGain, bits);
                heldRight_ = quantize(right * masterGain, bits);
            }

            outLeft[frame] = heldLeft_;
            if (outRight) outRight[frame] = heldRight_;
        }
    }

    DrumBank voices_[kNumDrums];
    Plate plate_;
    Smoother master_;
    float sampleRate_ = 44100.0f;
    float sampleHoldPhase_ = 1.0f;
    float heldLeft_ = 0.0f;
    float heldRight_ = 0.0f;
    float beatPulse_ = 0.0f;
    float lastPlateDecay_ = 2.0f;
    uint32_t noteCounter_ = 0;
    std::array<std::array<std::atomic<uint8_t>, kSequenceSteps>, kNumDrums> sequencePattern_{};
    std::array<std::array<std::atomic<uint8_t>, kSequenceSteps>, kNumDrums> stagedSequencePattern_{};
    std::atomic<bool> sequenceStatePending_{false};
    std::array<std::atomic<int>, kPadCount> padModels_{};
    std::array<std::atomic<float>, kPadCount> padTunes_{};
    std::array<std::atomic<float>, kPadCount> padDecays_{};
    std::array<std::atomic<float>, kPadCount> padLevels_{};
    std::array<std::atomic<bool>, kPadCount> padMutes_{};
    std::array<std::atomic<bool>, kPadCount> padSolos_{};
    std::array<std::atomic<int>, kPadCount> padChokes_{};
    std::array<std::array<std::atomic<uint8_t>, 7>, kPadCount> stagedPadState_{};
    std::atomic<bool> stagedPadStatePresent_{false};
    std::array<std::atomic<bool>, 12> pendingPadHits_{};
    std::array<std::atomic<int>, 12> pendingPadIndices_{};
    std::atomic<int> selectedPad_{0};
    std::atomic<uint32_t> padRandomCounter_{1};
    uint32_t sequenceRandomState_ = 0x87d057u;
    int64_t lastSequenceAbsoluteStep_ = -1;
};

MPC_PLUGIN_ENTRY(DUST87)
