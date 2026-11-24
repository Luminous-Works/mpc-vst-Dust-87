#include "../src/sequencer_clock.h"

#include <cassert>

int main()
{
    using mpc::dust87::sequenceAbsoluteStepAtPpq;
    using mpc::dust87::sequenceIsStepBoundaryAtPpq;
    using mpc::dust87::sequenceStepAtPpq;

    assert(sequenceAbsoluteStepAtPpq(0.0, 0.0) == 0);
    assert(sequenceAbsoluteStepAtPpq(0.25, 0.0) == 1);
    assert(sequenceAbsoluteStepAtPpq(0.5, 0.0) == 2);
    assert(sequenceStepAtPpq(16.0, 0.0) == 0);
    assert(sequenceIsStepBoundaryAtPpq(0.0, 0.0, 0.000001));
    assert(!sequenceIsStepBoundaryAtPpq(0.125, 0.0, 0.000001));
    assert(sequenceIsStepBoundaryAtPpq(0.5, 0.0, 0.000001));

    const double swungSecondStep = 0.25 * (1.0 + 0.4 * 0.4);
    assert(sequenceAbsoluteStepAtPpq(swungSecondStep - 0.000001, 0.4) == 0);
    assert(sequenceAbsoluteStepAtPpq(swungSecondStep, 0.4) == 1);
    assert(sequenceAbsoluteStepAtPpq(0.5, 0.4) == 2);
    assert(sequenceIsStepBoundaryAtPpq(swungSecondStep, 0.4, 0.000001));
    assert(!sequenceIsStepBoundaryAtPpq(swungSecondStep + 0.01, 0.4, 0.000001));

    assert(sequenceAbsoluteStepAtPpq(-0.001, 0.0) == -1);
    return 0;
}
