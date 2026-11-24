#include "../src/groove_library.h"

#include <cassert>
#include <cstdint>
#include <set>
#include <string>

int main()
{
    using mpc::dust87::GroovePattern;
    using mpc::dust87::generateRandomGroove;

    GroovePattern first{};
    GroovePattern repeat{};
    GroovePattern different{};
    uint32_t firstSeed = 0x87d057u;
    uint32_t repeatSeed = firstSeed;
    uint32_t differentSeed = 0x1987u;

    const float firstSwing = generateRandomGroove(first, firstSeed);
    const float repeatSwing = generateRandomGroove(repeat, repeatSeed);
    generateRandomGroove(different, differentSeed);

    assert(first == repeat);
    assert(firstSwing == repeatSwing);
    assert(first != different);
    assert(firstSwing >= 0.0f && firstSwing <= 0.34f);

    int activeSteps = 0;
    for (const auto& lane : first)
    {
        for (uint8_t velocity : lane)
        {
            assert(velocity <= 127);
            activeSteps += velocity > 0;
        }
    }
    assert(activeSteps > 0);

    mpc::dust87::BuiltinGroove firstPreset;
    assert(mpc::dust87::getBuiltinGroove(0, firstPreset));
    assert(firstPreset.name == "60s Jazz Ride Swing #1");
    assert(std::string(firstPreset.genre) == "Jazz");
    assert(firstPreset.bpm == 129);
    assert(firstPreset.swing == 0.28f);
    assert(firstPreset.pattern[0][0] == 62);
    assert(firstPreset.pattern[0][5] == 66);

    mpc::dust87::BuiltinGroove loFiPreset;
    assert(mpc::dust87::getBuiltinGroove(8, loFiPreset));
    assert(loFiPreset.name == "Drunk MPC Bounce #1");
    assert(loFiPreset.bpm == 86);
    assert(loFiPreset.swing > 0.299f && loFiPreset.swing < 0.301f);

    std::set<uint64_t> presetPatterns;
    for (size_t presetIndex = 0; presetIndex < mpc::dust87::kBuiltinGrooveCount; ++presetIndex)
    {
        mpc::dust87::BuiltinGroove preset;
        assert(mpc::dust87::getBuiltinGroove(presetIndex, preset));

        uint64_t hash = 1469598103934665603ull;
        for (const auto& lane : preset.pattern)
            for (uint8_t velocity : lane)
            {
                assert(velocity <= 127);
                hash = (hash ^ velocity) * 1099511628211ull;
            }
        assert(presetPatterns.insert(hash).second);
    }

    assert(presetPatterns.size() == 80);
    assert(!mpc::dust87::getBuiltinGroove(mpc::dust87::kBuiltinGrooveCount, firstPreset));
    return 0;
}
