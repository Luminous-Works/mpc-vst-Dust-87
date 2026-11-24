#pragma once

#include <array>
#include <cmath>
#include <cstdint>
#include <string>

namespace mpc::dust87 {

constexpr int kGrooveLaneCount = 18;
constexpr int kGrooveStepsPerBar = 16;
constexpr int kGrooveBarCount = 4;
constexpr int kGrooveStepCount = kGrooveStepsPerBar * kGrooveBarCount;

using GrooveBar = std::array<uint8_t, kGrooveStepsPerBar>;
using GroovePattern = std::array<std::array<uint8_t, kGrooveStepCount>, kGrooveLaneCount>;

struct GrooveBlueprint
{
    const char* name;
    const char* genre;
    int bpm;
    float swing;
    GrooveBar kick;
    GrooveBar kickB2{};
    GrooveBar kickB4{};
    GrooveBar snare{};
    GrooveBar snareB2{};
    GrooveBar snareB4{};
    GrooveBar rim{};
    GrooveBar rimB4{};
    GrooveBar clap{};
    GrooveBar hatC{};
    GrooveBar hatO{};
    GrooveBar ride{};
    GrooveBar tomL{};
    GrooveBar tomM{};
    GrooveBar tomH{};
    GrooveBar crash{};
    GrooveBar bell{};
    bool hasKickB2 = false;
    bool hasKickB4 = false;
    bool hasSnare = false;
    bool hasSnareB2 = false;
    bool hasSnareB4 = false;
    bool hasRim = false;
    bool hasRimB4 = false;
    bool hasClap = false;
    bool hasHatC = false;
    bool hasHatO = false;
    bool hasRide = false;
    bool hasTomL = false;
    bool hasTomM = false;
    bool hasTomH = false;
    bool hasCrash = false;
    bool hasBell = false;

    constexpr GrooveBlueprint(const char* grooveName, const char* grooveGenre,
                              int grooveBpm, float grooveSwing, GrooveBar grooveKick)
        : name(grooveName), genre(grooveGenre), bpm(grooveBpm), swing(grooveSwing),
          kick(grooveKick)
    {
    }

    constexpr GrooveBlueprint withKickB2(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.kickB2 = value;
        result.hasKickB2 = true;
        return result;
    }
    constexpr GrooveBlueprint withKickB4(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.kickB4 = value;
        result.hasKickB4 = true;
        return result;
    }
    constexpr GrooveBlueprint withSnare(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.snare = value;
        result.hasSnare = true;
        return result;
    }
    constexpr GrooveBlueprint withSnareB2(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.snareB2 = value;
        result.hasSnareB2 = true;
        return result;
    }
    constexpr GrooveBlueprint withSnareB4(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.snareB4 = value;
        result.hasSnareB4 = true;
        return result;
    }
    constexpr GrooveBlueprint withRim(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.rim = value;
        result.hasRim = true;
        return result;
    }
    constexpr GrooveBlueprint withRimB4(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.rimB4 = value;
        result.hasRimB4 = true;
        return result;
    }
    constexpr GrooveBlueprint withClap(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.clap = value;
        result.hasClap = true;
        return result;
    }
    constexpr GrooveBlueprint withHatC(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.hatC = value;
        result.hasHatC = true;
        return result;
    }
    constexpr GrooveBlueprint withHatO(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.hatO = value;
        result.hasHatO = true;
        return result;
    }
    constexpr GrooveBlueprint withRide(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.ride = value;
        result.hasRide = true;
        return result;
    }
    constexpr GrooveBlueprint withTomL(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.tomL = value;
        result.hasTomL = true;
        return result;
    }
    constexpr GrooveBlueprint withTomM(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.tomM = value;
        result.hasTomM = true;
        return result;
    }
    constexpr GrooveBlueprint withTomH(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.tomH = value;
        result.hasTomH = true;
        return result;
    }
    constexpr GrooveBlueprint withCrash(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.crash = value;
        result.hasCrash = true;
        return result;
    }
    constexpr GrooveBlueprint withBell(GrooveBar value) const
    {
        GrooveBlueprint result = *this;
        result.bell = value;
        result.hasBell = true;
        return result;
    }
};

inline constexpr GrooveBlueprint kGrooveBlueprints[] = {
    GrooveBlueprint("60s Jazz Ride Swing", "Jazz", 134, 0.32f,
                    {62, 0, 0, 0, 0, 0, 56, 0, 58, 0, 0, 0, 0, 0, 0, 52})
        .withSnare({0, 0, 0, 54, 0, 0, 0, 0, 0, 0, 62, 0, 0, 58, 0, 0})
        .withSnareB4({0, 0, 0, 64, 0, 74, 0, 0, 82, 0, 88, 0, 96, 0, 108, 92})
        .withRim({0, 0, 0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 0, 0, 82, 0})
        .withHatC({0, 0, 0, 0, 94, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0})
        .withRide({112, 0, 0, 78, 106, 0, 0, 84, 110, 0, 0, 76, 106, 0, 0, 86})
        .withTomM({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}),
    GrooveBlueprint("Funky Breakbeat 16", "Funk", 102, 0.14f,
                    {122, 0, 96, 0, 0, 0, 88, 0, 0, 0, 114, 0, 0, 82, 0, 0})
        .withKickB4({122, 0, 96, 0, 0, 0, 104, 0, 0, 94, 0, 0, 116, 0, 0, 92})
        .withSnare({0, 0, 0, 0, 118, 0, 0, 56, 0, 62, 0, 0, 116, 0, 0, 64})
        .withSnareB4({0, 0, 0, 0, 118, 0, 58, 0, 78, 0, 92, 0, 116, 86, 104, 112})
        .withHatC({108, 64, 92, 58, 106, 62, 88, 60, 108, 66, 90, 58, 104, 0, 92, 68})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0}),
    GrooveBlueprint("Half-Time Shuffle", "Shuffle", 94, 0.34f,
                    {120, 0, 0, 0, 0, 0, 86, 0, 0, 0, 108, 0, 0, 0, 0, 74})
        .withSnare({0, 0, 0, 52, 0, 0, 0, 0, 122, 0, 0, 54, 0, 0, 0, 58})
        .withSnareB4({0, 0, 0, 56, 0, 0, 68, 0, 122, 0, 78, 0, 94, 0, 112, 84})
        .withHatC({106, 0, 62, 84, 104, 0, 64, 82, 108, 0, 62, 84, 104, 0, 68, 0})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96}),
    GrooveBlueprint("Detroit Electro Pulse", "Electro", 126, 0.02f,
                    {126, 0, 0, 108, 0, 0, 116, 0, 0, 0, 104, 0, 0, 114, 0, 0})
        .withSnare({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 82})
        .withClap({0, 0, 0, 0, 106, 0, 0, 0, 0, 0, 0, 0, 112, 0, 96, 0})
        .withHatC({98, 72, 92, 70, 102, 74, 88, 68, 98, 72, 92, 0, 104, 76, 94, 72})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0, 0, 0, 0})
        .withBell({100, 0, 0, 88, 0, 0, 96, 0, 0, 92, 0, 0, 98, 0, 0, 0}),
    GrooveBlueprint("Queensbridge 94 Swing", "Boom Bap", 89, 0.24f,
                    {124, 0, 0, 92, 0, 0, 0, 84, 0, 0, 116, 0, 0, 0, 94, 0})
        .withKickB2({124, 0, 0, 0, 0, 0, 0, 96, 112, 0, 118, 0, 0, 0, 0, 82})
        .withSnare({0, 0, 0, 0, 120, 0, 0, 0, 0, 0, 0, 0, 122, 0, 0, 62})
        .withRim({0, 0, 74, 0, 0, 0, 0, 0, 0, 78, 0, 0, 0, 0, 0, 0})
        .withHatC({96, 0, 74, 0, 98, 0, 76, 0, 94, 0, 72, 0, 98, 0, 0, 0})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92, 0}),
    GrooveBlueprint("Kingston One-Drop", "Dub / Reggae", 78, 0.16f,
                    {0, 0, 0, 0, 0, 0, 0, 0, 124, 0, 0, 0, 0, 0, 0, 0})
        .withKickB4({0, 0, 0, 0, 0, 0, 0, 0, 124, 0, 102, 0, 0, 0, 0, 0})
        .withRim({0, 0, 0, 0, 96, 0, 0, 82, 118, 0, 0, 0, 0, 86, 0, 0})
        .withSnareB4({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92, 100, 108, 0, 114, 0})
        .withHatC({88, 56, 78, 62, 92, 54, 80, 60, 88, 56, 78, 62, 92, 54, 0, 66})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 88, 0}),
    GrooveBlueprint("Bossa 3-2 Clave", "Latin / Jazz", 118, 0.04f,
                    {112, 0, 0, 94, 108, 0, 0, 92, 112, 0, 0, 94, 108, 0, 0, 92})
        .withRim({114, 0, 0, 110, 0, 0, 108, 0, 0, 0, 106, 0, 110, 0, 0, 0})
        .withHatC({86, 72, 84, 72, 88, 72, 84, 72, 86, 72, 84, 72, 88, 72, 84, 72})
        .withTomL({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 86, 0})
        .withTomH({0, 0, 0, 0, 0, 0, 0, 82, 0, 0, 0, 0, 0, 0, 0, 0}),
    GrooveBlueprint("UKG 2-Step Skip", "2-Step", 132, 0.22f,
                    {122, 0, 0, 0, 0, 0, 0, 96, 0, 0, 112, 0, 0, 0, 0, 0})
        .withKickB2({122, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 98, 0, 0})
        .withSnare({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 116, 0, 0, 68})
        .withRim({0, 0, 0, 84, 0, 0, 0, 0, 0, 88, 0, 0, 0, 0, 92, 0})
        .withHatC({0, 0, 98, 64, 0, 0, 94, 0, 0, 0, 98, 64, 0, 0, 92, 68})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 92, 0, 0, 0, 0, 0, 0, 0, 0}),
    GrooveBlueprint("Amen Chop 164", "Breakbeat", 164, 0.04f,
                    {126, 0, 110, 0, 0, 0, 0, 0, 0, 0, 118, 102, 0, 0, 0, 0})
        .withKickB4({126, 0, 0, 0, 0, 0, 108, 0, 0, 0, 118, 0, 0, 0, 104, 0})
        .withSnare({0, 0, 0, 0, 122, 0, 0, 74, 0, 86, 0, 0, 120, 0, 76, 0})
        .withSnareB4({0, 0, 0, 0, 122, 0, 74, 0, 0, 94, 0, 112, 0, 88, 118, 106})
        .withRide({104, 0, 96, 0, 106, 0, 94, 0, 104, 0, 96, 0, 106, 0, 98, 0})
        .withCrash({112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}),
    GrooveBlueprint("Industrial Turbine 4/4", "Industrial", 128, 0.0f,
                    {127, 0, 0, 0, 124, 0, 0, 0, 127, 0, 0, 0, 124, 0, 0, 96})
        .withSnare({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0})
        .withClap({0, 0, 0, 0, 110, 0, 0, 76, 0, 0, 0, 0, 114, 0, 92, 0})
        .withHatC({78, 86, 98, 84, 78, 88, 102, 84, 78, 86, 98, 84, 78, 88, 104, 88})
        .withHatO({0, 0, 106, 0, 0, 0, 106, 0, 0, 0, 106, 0, 0, 0, 108, 0})
        .withBell({104, 0, 0, 92, 0, 0, 98, 0, 104, 0, 0, 92, 0, 108, 0, 0}),
    GrooveBlueprint("Lagos Afrobeat Pocket", "Afrobeat", 112, 0.10f,
                    {118, 0, 0, 92, 0, 0, 104, 0, 116, 0, 0, 0, 0, 96, 0, 0})
        .withSnare({0, 0, 0, 0, 96, 0, 0, 108, 0, 0, 76, 0, 112, 0, 88, 0})
        .withRim({108, 0, 0, 102, 0, 0, 106, 0, 0, 0, 104, 0, 108, 0, 0, 0})
        .withHatC({98, 72, 92, 76, 96, 70, 90, 74, 98, 72, 92, 76, 96, 70, 94, 0})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 98})
        .withTomL({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0, 84}),
    GrooveBlueprint("Dub Steppers Militant", "Dub", 136, 0.08f,
                    {126, 0, 0, 0, 120, 0, 0, 0, 124, 0, 0, 0, 120, 0, 96, 0})
        .withRim({0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0, 0, 88})
        .withClap({0, 0, 0, 0, 104, 0, 0, 0, 0, 0, 0, 0, 108, 0, 0, 0})
        .withHatC({94, 68, 86, 72, 94, 68, 86, 72, 94, 68, 86, 72, 94, 68, 86, 72})
        .withBell({0, 0, 92, 0, 0, 0, 88, 0, 0, 0, 92, 0, 0, 0, 0, 0}),
    GrooveBlueprint("Motorik Autobahn 8th", "Motorik", 138, 0.0f,
                    {122, 0, 98, 0, 118, 0, 98, 0, 122, 0, 98, 0, 118, 0, 104, 0})
        .withSnare({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0})
        .withSnareB4({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 92, 0, 120, 0, 108, 0})
        .withHatC({108, 0, 94, 0, 108, 0, 94, 0, 108, 0, 94, 0, 108, 0, 94, 0})
        .withRide({0, 74, 0, 74, 0, 74, 0, 74, 0, 74, 0, 74, 0, 74, 0, 74}),
    GrooveBlueprint("Drunk MPC Bounce", "Neo-Soul", 84, 0.28f,
                    {122, 0, 0, 0, 0, 0, 96, 0, 0, 108, 0, 0, 0, 0, 88, 0})
        .withKickB2({122, 0, 0, 88, 0, 0, 0, 0, 0, 114, 0, 0, 0, 92, 0, 0})
        .withSnare({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 56, 120, 0, 0, 0})
        .withRim({0, 0, 0, 0, 0, 0, 0, 78, 0, 0, 0, 0, 0, 0, 0, 84})
        .withHatC({94, 0, 68, 0, 96, 0, 64, 0, 92, 0, 70, 0, 96, 0, 68, 0}),
    GrooveBlueprint("Samba Partido Alto", "Brazilian", 108, 0.08f,
                    {120, 0, 0, 104, 114, 0, 0, 96, 120, 0, 0, 104, 114, 0, 0, 96})
        .withRim({110, 0, 98, 0, 0, 106, 0, 96, 0, 104, 0, 0, 108, 0, 96, 0})
        .withHatC({92, 76, 86, 74, 92, 76, 86, 74, 92, 76, 86, 74, 92, 76, 86, 74})
        .withTomH({0, 0, 0, 0, 0, 0, 94, 0, 0, 0, 0, 0, 0, 0, 98, 0})
        .withTomL({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92, 0, 0, 0, 96}),
    GrooveBlueprint("Sub-808 Half-Time", "Half-Time", 72, 0.05f,
                    {127, 0, 0, 0, 0, 0, 108, 0, 0, 0, 116, 0, 0, 0, 0, 94})
        .withSnare({0, 0, 0, 0, 0, 0, 0, 0, 122, 0, 0, 0, 0, 0, 0, 0})
        .withClap({0, 0, 0, 0, 0, 0, 0, 0, 114, 0, 0, 0, 0, 0, 96, 0})
        .withHatC({98, 72, 92, 76, 98, 92, 96, 84, 98, 74, 90, 74, 98, 96, 96, 92})
        .withHatO({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0}),
    GrooveBlueprint("Euclidean 5/16 Orbit", "Polyrhythm", 116, 0.0f,
                    {122, 0, 0, 108, 0, 0, 116, 0, 0, 0, 112, 0, 0, 104, 0, 0})
        .withRim({0, 0, 102, 0, 0, 106, 0, 0, 104, 0, 0, 108, 0, 0, 100, 0})
        .withSnare({0, 0, 0, 0, 116, 0, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0})
        .withHatC({96, 0, 82, 0, 96, 0, 82, 0, 96, 0, 82, 0, 96, 0, 82, 0})
        .withBell({104, 0, 0, 0, 0, 96, 0, 0, 0, 0, 102, 0, 0, 0, 0, 0}),
    GrooveBlueprint("Motown Backbeat", "Soul", 120, 0.10f,
                    {118, 0, 0, 0, 112, 0, 0, 0, 118, 0, 0, 0, 112, 0, 0, 0})
        .withSnare({0, 0, 0, 0, 120, 0, 0, 0, 0, 0, 0, 0, 122, 0, 0, 74})
        .withClap({0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 0, 0, 96, 0, 0, 0})
        .withHatC({98, 0, 88, 0, 98, 0, 88, 0, 98, 0, 88, 0, 98, 0, 88, 0})
        .withRide({104, 0, 92, 0, 104, 0, 92, 0, 104, 0, 92, 0, 104, 0, 92, 0}),
    GrooveBlueprint("Miami Bass Sync", "Electro Bass", 129, 0.0f,
                    {127, 0, 0, 112, 0, 0, 118, 0, 0, 114, 0, 0, 120, 0, 0, 0})
        .withClap({0, 0, 0, 0, 118, 0, 0, 0, 0, 0, 0, 0, 120, 0, 0, 0})
        .withHatC({96, 84, 96, 84, 96, 84, 96, 84, 96, 84, 96, 84, 96, 84, 96, 84})
        .withBell({106, 0, 94, 0, 0, 96, 0, 98, 106, 0, 94, 0, 0, 96, 0, 0})
        .withTomH({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0})
        .withTomL({0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 106}),
    GrooveBlueprint("Chicago Jack 87", "House", 122, 0.06f,
                    {124, 0, 0, 0, 122, 0, 0, 0, 124, 0, 0, 0, 122, 0, 0, 0})
        .withClap({0, 0, 0, 0, 116, 0, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0})
        .withRim({0, 0, 0, 92, 0, 0, 96, 0, 0, 0, 92, 0, 0, 0, 98, 0})
        .withHatC({78, 0, 0, 0, 78, 0, 0, 0, 78, 0, 0, 0, 78, 0, 0, 0})
        .withHatO({0, 0, 112, 0, 0, 0, 112, 0, 0, 0, 112, 0, 0, 0, 112, 0}),
};

inline uint32_t nextGrooveRandom(uint32_t& state)
{
    uint32_t value = state;
    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;
    state = value == 0 ? 0x9e3779b9u : value;
    return state;
}

inline double nextGrooveUnit(uint32_t& state)
{
    return static_cast<double>(nextGrooveRandom(state)) / 4294967296.0;
}

inline GrooveBar randomizeGrooveLane(const GrooveBar* base, double probabilityAdd,
                                     double probabilityDrop, uint32_t& state)
{
    GrooveBar result = base == nullptr ? GrooveBar{} : *base;
    for (int step = 0; step < kGrooveStepsPerBar; ++step)
    {
        uint8_t& velocity = result[static_cast<size_t>(step)];
        if (velocity > 0)
        {
            if (step != 0 && step != 4 && step != 12 &&
                nextGrooveUnit(state) < probabilityDrop)
            {
                velocity = 0;
            }
            else
            {
                const double change = (nextGrooveUnit(state) - 0.5) * 24.0;
                const int varied = static_cast<int>(std::lround(velocity + change));
                velocity = static_cast<uint8_t>(varied < 45 ? 45 : (varied > 127 ? 127 : varied));
            }
        }
        else if (nextGrooveUnit(state) < probabilityAdd)
        {
            velocity = static_cast<uint8_t>(std::lround(62.0 + nextGrooveUnit(state) * 48.0));
        }
    }
    return result;
}

inline void repeatGrooveBar(GroovePattern& pattern, int lane, const GrooveBar& firstBar,
                            uint8_t defaultVelocity, const GrooveBar* secondBar = nullptr,
                            const GrooveBar* fourthBar = nullptr)
{
    for (int bar = 0; bar < kGrooveBarCount; ++bar)
    {
        const GrooveBar* source = &firstBar;
        if (bar == 3 && fourthBar != nullptr)
            source = fourthBar;
        else if (bar == 1 && secondBar != nullptr)
            source = secondBar;
        for (int step = 0; step < kGrooveStepsPerBar; ++step)
        {
            const uint8_t velocity = (*source)[static_cast<size_t>(step)];
            if (velocity > 0)
                pattern[static_cast<size_t>(lane)]
                       [static_cast<size_t>(bar * kGrooveStepsPerBar + step)] =
                    velocity == 1 ? defaultVelocity : velocity;
        }
    }
}

inline float generateRandomGroove(GroovePattern& pattern, uint32_t& state)
{
    const uint32_t selected = static_cast<uint32_t>(
        (static_cast<uint64_t>(nextGrooveRandom(state)) *
         (sizeof(kGrooveBlueprints) / sizeof(kGrooveBlueprints[0]))) >> 32);
    const GrooveBlueprint& blueprint = kGrooveBlueprints[selected];
    nextGrooveRandom(state); // The browser uses this seed for its generated groove name.
    const GrooveBar empty{};

    GrooveBar kickB1 = randomizeGrooveLane(&blueprint.kick, 0.14, 0.12, state);
    GrooveBar kickB2 = randomizeGrooveLane(
        blueprint.hasKickB2 ? &blueprint.kickB2 : &kickB1, 0.18, 0.14, state);
    GrooveBar kickB4 = randomizeGrooveLane(
        blueprint.hasKickB4 ? &blueprint.kickB4 : &kickB1, 0.22, 0.14, state);

    const bool hasSnare = blueprint.hasSnare || nextGrooveUnit(state) > 0.3;
    const GrooveBar defaultSnare{0, 0, 0, 0, 114, 0, 0, 0, 0, 0, 0, 0, 118, 0, 0, 0};
    const GrooveBar* snareBase = blueprint.hasSnare ? &blueprint.snare : &defaultSnare;
    const GrooveBar snareB1 = hasSnare
        ? randomizeGrooveLane(snareBase, 0.12, 0.08, state)
        : empty;
    const GrooveBar snareB2 = hasSnare
        ? randomizeGrooveLane(
              blueprint.hasSnareB2 ? &blueprint.snareB2 : &snareB1, 0.16, 0.08, state)
        : empty;
    const GrooveBar snareB4 = hasSnare
        ? randomizeGrooveLane(
              blueprint.hasSnareB4 ? &blueprint.snareB4 : &snareB1, 0.28, 0.05, state)
        : empty;

    GrooveBar tomFillH{};
    GrooveBar tomFillM{};
    GrooveBar tomFillL{};
    for (int step = 10; step < kGrooveStepsPerBar; ++step)
    {
        const double roll = nextGrooveUnit(state);
        if (roll < 0.28)
            tomFillH[static_cast<size_t>(step)] = static_cast<uint8_t>(
                std::lround(85.0 + nextGrooveUnit(state) * 32.0));
        else if (roll < 0.52)
            tomFillM[static_cast<size_t>(step)] = static_cast<uint8_t>(
                std::lround(88.0 + nextGrooveUnit(state) * 32.0));
        else if (roll < 0.72)
            tomFillL[static_cast<size_t>(step)] = static_cast<uint8_t>(
                std::lround(92.0 + nextGrooveUnit(state) * 32.0));
    }

    pattern = {};
    repeatGrooveBar(pattern, 0, kickB1, 120, &kickB2, &kickB4);
    repeatGrooveBar(pattern, 2, snareB1, 114, &snareB2, &snareB4);
    const GrooveBar closedHat = randomizeGrooveLane(
        blueprint.hasHatC ? &blueprint.hatC : nullptr, 0.18, 0.16, state);
    repeatGrooveBar(pattern, 6, closedHat, 92);
    repeatGrooveBar(pattern, 8, blueprint.hasTomL ? blueprint.tomL : empty, 102,
                    nullptr, &tomFillL);
    repeatGrooveBar(pattern, 9, blueprint.hasTomM ? blueprint.tomM : empty, 100,
                    nullptr, &tomFillM);
    repeatGrooveBar(pattern, 10, blueprint.hasTomH ? blueprint.tomH : empty, 98,
                    nullptr, &tomFillH);

    if (blueprint.hasRim || nextGrooveUnit(state) > 0.45)
    {
        const GrooveBar rim = randomizeGrooveLane(
            blueprint.hasRim ? &blueprint.rim : nullptr, 0.16, 0.15, state);
        repeatGrooveBar(pattern, 4, rim, 102, nullptr,
                        blueprint.hasRimB4 ? &blueprint.rimB4 : nullptr);
    }
    if (blueprint.hasClap || nextGrooveUnit(state) > 0.5)
    {
        const GrooveBar defaultClap{0, 0, 0, 0, 102, 0, 0, 0, 0, 0, 0, 0, 106, 0, 0, 0};
        const GrooveBar clap = randomizeGrooveLane(
            blueprint.hasClap ? &blueprint.clap : &defaultClap, 0.08, 0.15, state);
        repeatGrooveBar(pattern, 5, clap, 106);
    }
    if (blueprint.hasHatO || nextGrooveUnit(state) > 0.35)
    {
        const GrooveBar defaultOpenHat{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 0};
        const GrooveBar openHat = randomizeGrooveLane(
            blueprint.hasHatO ? &blueprint.hatO : &defaultOpenHat, 0.12, 0.15, state);
        repeatGrooveBar(pattern, 7, openHat, 96);
    }
    if (blueprint.hasCrash || nextGrooveUnit(state) > 0.65)
        pattern[11][0] = 108;
    if (blueprint.hasRide || nextGrooveUnit(state) > 0.6)
    {
        const GrooveBar ride = randomizeGrooveLane(
            blueprint.hasRide ? &blueprint.ride : nullptr, 0.15, 0.15, state);
        repeatGrooveBar(pattern, 12, ride, 98);
    }
    if (blueprint.hasBell || nextGrooveUnit(state) > 0.55)
    {
        const GrooveBar bell = randomizeGrooveLane(
            blueprint.hasBell ? &blueprint.bell : nullptr, 0.14, 0.2, state);
        repeatGrooveBar(pattern, 13, bell, 96);
    }

    const double swing = blueprint.swing + (nextGrooveUnit(state) - 0.5) * 0.12;
    const double boundedSwing = swing < 0.0 ? 0.0 : (swing > 0.34 ? 0.34 : swing);
    return static_cast<float>(std::round(boundedSwing * 100.0) / 100.0);
}

constexpr size_t kBuiltinGrooveCount = 80;

struct BuiltinGroove
{
    std::string name;
    const char* genre = "";
    int bpm = 120;
    float swing = 0.0f;
    GroovePattern pattern{};
};

inline int builtinGrooveBlueprintIndex(size_t presetIndex)
{
    static constexpr int kLoFiPool[] = {13, 4, 2, 1, 5, 0, 15, 7};
    static constexpr int kBoomBapPool[] = {4, 1, 2, 13, 15, 0, 7, 17};
    static constexpr int kElectroPool[] = {3, 18, 19, 9, 12, 8, 16, 11};
    static constexpr int kIndustrialPool[] = {9, 12, 16, 3, 8, 11, 18, 19};
    static constexpr int kDubPool[] = {5, 11, 15, 2, 10, 6, 13, 16};
    static constexpr int kPercussionPool[] = {6, 10, 14, 16, 0, 2, 17, 7};
    static constexpr int kExperimentalPool[] = {16, 8, 9, 0, 12, 13, 15, 7};
    const size_t category = presetIndex / 8;
    const size_t position = presetIndex % 8;
    if (category == 1) return kLoFiPool[position];
    if (category == 2) return kBoomBapPool[position];
    if (category == 3) return kElectroPool[position];
    if (category == 4) return kIndustrialPool[position];
    if (category == 5) return kDubPool[position];
    if (category == 6) return kPercussionPool[position];
    if (category == 7) return kExperimentalPool[position];
    return static_cast<int>(presetIndex % (sizeof(kGrooveBlueprints) / sizeof(kGrooveBlueprints[0])));
}

inline GrooveBar mutatePresetHitArray(const GrooveBar& base, int seed, int laneSalt)
{
    GrooveBar result = base;
    const int shiftSlot = (seed * 3 + laneSalt * 5) % kGrooveStepsPerBar;
    const int ghostSlot = (seed * 7 + laneSalt * 11 + 3) % kGrooveStepsPerBar;
    if (result[static_cast<size_t>(shiftSlot)] == 0 && shiftSlot % 4 != 0)
        result[static_cast<size_t>(shiftSlot)] =
            static_cast<uint8_t>(66 + ((seed * 13) % 32));
    uint8_t& ghost = result[static_cast<size_t>(ghostSlot)];
    if (ghost > 0 && ghostSlot != 0 && ghostSlot != 4 && ghostSlot != 12)
    {
        const int adjustment = ((seed + laneSalt) % 3 - 1) * 14;
        const int varied = static_cast<int>(ghost) + adjustment;
        ghost = static_cast<uint8_t>(varied < 48 ? 48 : (varied > 124 ? 124 : varied));
    }
    return result;
}

inline bool getBuiltinGroove(size_t presetIndex, BuiltinGroove& result)
{
    if (presetIndex >= kBuiltinGrooveCount)
        return false;

    const int blueprintIndex = builtinGrooveBlueprintIndex(presetIndex);
    const GrooveBlueprint& blueprint = kGrooveBlueprints[static_cast<size_t>(blueprintIndex)];
    const int bpmJitter = static_cast<int>((presetIndex * 5) % 11) - 5;
    const int bpm = blueprint.bpm + bpmJitter;
    const int swingCents = static_cast<int>(std::lround(blueprint.swing * 100.0f)) +
                           (static_cast<int>(presetIndex % 5) - 2) * 2;

    result.name = std::string(blueprint.name) + " #" +
                  std::to_string((presetIndex % 8) + 1);
    result.genre = blueprint.genre;
    result.bpm = bpm < 66 ? 66 : (bpm > 170 ? 170 : bpm);
    result.swing = static_cast<float>(swingCents < 0 ? 0 :
        (swingCents > 36 ? 36 : swingCents)) * 0.01f;
    result.pattern = {};

    const GrooveBar kickB1 = mutatePresetHitArray(blueprint.kick, static_cast<int>(presetIndex), 1);
    const GrooveBar kickB2 = mutatePresetHitArray(
        blueprint.hasKickB2 ? blueprint.kickB2 : blueprint.kick,
        static_cast<int>(presetIndex + 1), 2);
    const GrooveBar kickB4 = mutatePresetHitArray(
        blueprint.hasKickB4 ? blueprint.kickB4 : blueprint.kick,
        static_cast<int>(presetIndex + 3), 3);
    repeatGrooveBar(result.pattern, 0, kickB1, 120, &kickB2, &kickB4);

    const GrooveBar empty{};
    const GrooveBar snareB1 = blueprint.hasSnare
        ? mutatePresetHitArray(blueprint.snare, static_cast<int>(presetIndex), 4)
        : empty;
    const GrooveBar snareB2 = (blueprint.hasSnare || blueprint.hasSnareB2)
        ? mutatePresetHitArray(blueprint.hasSnareB2 ? blueprint.snareB2 : blueprint.snare,
                               static_cast<int>(presetIndex + 2), 5)
        : empty;
    const GrooveBar snareB4 = (blueprint.hasSnareB4 || blueprint.hasSnare)
        ? mutatePresetHitArray(blueprint.hasSnareB4 ? blueprint.snareB4 : blueprint.snare,
                               static_cast<int>(presetIndex + 4), 6)
        : empty;
    if (blueprint.hasSnare || blueprint.hasSnareB2 || blueprint.hasSnareB4)
        repeatGrooveBar(result.pattern, 2, snareB1, 114, &snareB2, &snareB4);

    GrooveBar tomFillH{};
    GrooveBar tomFillM{};
    GrooveBar tomFillL{};
    if (presetIndex % 3 == 0)
    {
        tomFillH[11] = 96;
        tomFillM[13] = 104;
        tomFillL[15] = 112;
    }
    else if (presetIndex % 3 == 1)
    {
        tomFillH[12] = 94;
        tomFillM[14] = 102;
        tomFillL[15] = 108;
    }
    else
    {
        tomFillM[10] = 92;
        tomFillL[12] = 102;
        tomFillL[14] = 110;
    }

    repeatGrooveBar(result.pattern, 8, blueprint.hasTomL ? blueprint.tomL : empty,
                    102, nullptr, &tomFillL);
    repeatGrooveBar(result.pattern, 9, blueprint.hasTomM ? blueprint.tomM : empty,
                    100, nullptr, &tomFillM);
    repeatGrooveBar(result.pattern, 10, blueprint.hasTomH ? blueprint.tomH : empty,
                    98, nullptr, &tomFillH);

    if (blueprint.hasRim)
    {
        const GrooveBar rim = mutatePresetHitArray(
            blueprint.rim, static_cast<int>(presetIndex), 7);
        repeatGrooveBar(result.pattern, 4, rim, 104, nullptr,
                        blueprint.hasRimB4 ? &blueprint.rimB4 : nullptr);
    }
    if (blueprint.hasClap)
        repeatGrooveBar(result.pattern, 5,
                        mutatePresetHitArray(blueprint.clap, static_cast<int>(presetIndex), 8),
                        108);
    if (blueprint.hasHatC)
        repeatGrooveBar(result.pattern, 6,
                        mutatePresetHitArray(blueprint.hatC, static_cast<int>(presetIndex), 9),
                        92);
    if (blueprint.hasHatO)
        repeatGrooveBar(result.pattern, 7, blueprint.hatO, 98);
    if (blueprint.hasCrash)
        result.pattern[11][0] = 108;
    if (blueprint.hasRide)
        repeatGrooveBar(result.pattern, 12,
                        mutatePresetHitArray(blueprint.ride, static_cast<int>(presetIndex), 10),
                        102);
    if (blueprint.hasBell)
        repeatGrooveBar(result.pattern, 13,
                        mutatePresetHitArray(blueprint.bell, static_cast<int>(presetIndex), 11),
                        98);

    return true;
}

} // namespace mpc::dust87
