#include "../src/groove_library.h"

#include <cassert>
#include <cstdint>

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
    return 0;
}
