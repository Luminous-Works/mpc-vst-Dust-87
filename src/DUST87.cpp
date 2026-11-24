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

#include <array>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace {

using namespace mpc::dsp;

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

        if (numParams() != kNumParams) mpc::log("DUST '87: parameter count mismatch");
        addPrograms();
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
        for (DrumBank& bank : voices_)
            for (DrumVoice& voice : bank.voices) voice.kill();
        plate_.reset();
        master_.snap(dbToGain(get(kMaster)));
        heldLeft_ = heldRight_ = 0.0f;
        sampleHoldPhase_ = 1.0f;
        noteCounter_ = 0;
    }

    void process(mpc::ProcessContext& ctx) override
    {
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

        float tune[kNumDrums];
        float decay[kNumDrums];
        float level[kNumDrums];
        for (int drum = 0; drum < kNumDrums; ++drum)
        {
            tune[drum] = get(voiceParam(drum, kTune));
            decay[drum] = get(voiceParam(drum, kDecay)) * 0.01f;
            level[drum] = get(voiceParam(drum, kLevel)) * 0.01f;
        }

        int position = 0;
        for (int event = 0; event < ctx.numMidiEvents; ++event)
        {
            const int eventPosition = mpc::clamp(ctx.midi[event].sampleOffset, position, ctx.numFrames);
            render(ctx, position, eventPosition, holdRatio, bits, drive, driveNorm, plateMix);
            handleMidi(ctx.midi[event], tune, decay, level);
            position = eventPosition;
        }
        render(ctx, position, ctx.numFrames, holdRatio, bits, drive, driveNorm, plateMix);
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
            const int drum = ((event.note() - 36) % kNumDrums + kNumDrums) % kNumDrums;
            if (drum == kClosedHat)
                for (DrumVoice& voice : voices_[kOpenHat].voices) voice.kill();
            DrumVoice& voice = findVoice(drum);
            voice.trigger(tune[drum], decay[drum], static_cast<float>(event.velocity()) / 127.0f,
                          level[drum], ++noteCounter_);
        }
        else if (event.isAllNotesOff())
        {
            for (DrumBank& bank : voices_)
                for (DrumVoice& voice : bank.voices) voice.kill();
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
    float lastPlateDecay_ = 2.0f;
    uint32_t noteCounter_ = 0;
};

MPC_PLUGIN_ENTRY(DUST87)
