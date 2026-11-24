#include "../src/pad_midi.h"

#include <array>
#include <cassert>
#include <cstdint>

int main()
{
    using mpc::dust87::PadMidiRoutingMode;
    using mpc::dust87::findPadForMidi;
    using mpc::dust87::kPadCount;
    using mpc::dust87::defaultPadMidiChannel;
    using mpc::dust87::defaultPadMidiNote;

    std::array<std::atomic<uint8_t>, kPadCount> channels{};
    std::array<std::atomic<uint8_t>, kPadCount> notes{};
    for (int pad = 0; pad < kPadCount; ++pad)
    {
        channels[static_cast<size_t>(pad)].store(
            static_cast<uint8_t>(defaultPadMidiChannel(pad)));
        notes[static_cast<size_t>(pad)].store(
            static_cast<uint8_t>(defaultPadMidiNote(pad)));
    }

    assert(defaultPadMidiNote(0) == 36);
    assert(defaultPadMidiNote(11) == 47);
    assert(defaultPadMidiNote(12) == 48);
    assert(defaultPadMidiNote(47) == 83);
    assert(defaultPadMidiChannel(0) == 1);
    assert(defaultPadMidiChannel(11) == 12);
    assert(defaultPadMidiChannel(12) == 1);
    assert(defaultPadMidiChannel(47) == 12);
    assert(defaultPadMidiNote(-1) == -1);
    assert(defaultPadMidiChannel(kPadCount) == 0);

    assert(findPadForMidi(
               84, 1, PadMidiRoutingMode::PerVoiceChannel, channels, notes) == 0);
    assert(findPadForMidi(
               0, 12, PadMidiRoutingMode::PerVoiceChannel, channels, notes) == 11);
    assert(findPadForMidi(
               83, 16, PadMidiRoutingMode::ComboByNote, channels, notes) == 47);
    assert(findPadForMidi(
               36, 16, PadMidiRoutingMode::ComboByNote, channels, notes) == 0);

    assert(findPadForMidi(
               60, 0, PadMidiRoutingMode::PerVoiceChannel, channels, notes) == -1);
    assert(findPadForMidi(
               60, 17, PadMidiRoutingMode::PerVoiceChannel, channels, notes) == -1);
    assert(findPadForMidi(
               -1, 10, PadMidiRoutingMode::ComboByNote, channels, notes) == -1);
    assert(findPadForMidi(
               128, 10, PadMidiRoutingMode::ComboByNote, channels, notes) == -1);
    assert(findPadForMidi(
               60, 10, static_cast<PadMidiRoutingMode>(99), channels, notes) == -1);

    channels[0].store(16);
    notes[0].store(127);
    assert(findPadForMidi(
               60, 16, PadMidiRoutingMode::PerVoiceChannel, channels, notes) == 0);
    assert(findPadForMidi(
               127, 1, PadMidiRoutingMode::ComboByNote, channels, notes) == 0);
    assert(findPadForMidi(
               36, 1, PadMidiRoutingMode::ComboByNote, channels, notes) == -1);

    return 0;
}
