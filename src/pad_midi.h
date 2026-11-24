#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>

namespace mpc::dust87 {

constexpr int kPadCount = 48;

enum class PadMidiRoutingMode : int
{
    PerVoiceChannel = 0,
    ComboByNote = 1
};

constexpr int defaultPadMidiNote(int pad)
{
    return pad >= 0 && pad < kPadCount ? 36 + pad : -1;
}

constexpr int defaultPadMidiChannel(int pad)
{
    return pad >= 0 && pad < kPadCount ? pad % 12 + 1 : 0;
}

inline int findPadForMidi(
    int note,
    int channel,
    PadMidiRoutingMode mode,
    const std::array<std::atomic<uint8_t>, kPadCount>& channels,
    const std::array<std::atomic<uint8_t>, kPadCount>& notes)
{
    if (note < 0 || note > 127 || channel < 1 || channel > 16)
        return -1;
    if (mode != PadMidiRoutingMode::PerVoiceChannel &&
        mode != PadMidiRoutingMode::ComboByNote)
        return -1;

    for (int pad = 0; pad < kPadCount; ++pad)
    {
        const auto index = static_cast<std::size_t>(pad);
        const int routedValue = mode == PadMidiRoutingMode::PerVoiceChannel
            ? channels[index].load(std::memory_order_relaxed)
            : notes[index].load(std::memory_order_relaxed);
        if (routedValue == (mode == PadMidiRoutingMode::PerVoiceChannel ? channel : note))
            return pad;
    }
    return -1;
}

} // namespace mpc::dust87
