#pragma once

#include <cmath>
#include <cstdint>

namespace mpc::dust87 {

constexpr int kSequenceStepsPerBar = 16;
constexpr int kSequenceBars = 4;
constexpr int kSequenceSteps = kSequenceStepsPerBar * kSequenceBars;

inline int64_t sequenceAbsoluteStepAtPpq(double ppq, double swing)
{
    if (!std::isfinite(ppq) || ppq < 0.0)
        return -1;

    constexpr double pairLength = 0.5;
    constexpr double straightStepLength = 0.25;
    const double boundedSwing = swing < 0.0 ? 0.0 : (swing > 0.4 ? 0.4 : swing);
    const double pairIndex = std::floor(ppq / pairLength);
    const double pairOffset = ppq - pairIndex * pairLength;
    const double firstStepLength = straightStepLength * (1.0 + 0.4 * boundedSwing);
    const int64_t absolutePair = static_cast<int64_t>(pairIndex);

    return absolutePair * 2 + (pairOffset >= firstStepLength ? 1 : 0);
}

inline bool sequenceIsStepBoundaryAtPpq(double ppq, double swing, double tolerance)
{
    if (!std::isfinite(ppq) || ppq < 0.0 || !std::isfinite(tolerance) || tolerance < 0.0)
        return false;

    constexpr double pairLength = 0.5;
    constexpr double straightStepLength = 0.25;
    const double boundedSwing = swing < 0.0 ? 0.0 : (swing > 0.4 ? 0.4 : swing);
    const double pairOffset = ppq - std::floor(ppq / pairLength) * pairLength;
    const double firstStepLength = straightStepLength * (1.0 + 0.4 * boundedSwing);

    return pairOffset <= tolerance ||
           std::abs(pairOffset - firstStepLength) <= tolerance ||
           pairLength - pairOffset <= tolerance;
}

inline int sequenceStepAtPpq(double ppq, double swing)
{
    const int64_t absoluteStep = sequenceAbsoluteStepAtPpq(ppq, swing);
    return absoluteStep < 0 ? -1 : static_cast<int>(absoluteStep % kSequenceSteps);
}

} // namespace mpc::dust87
