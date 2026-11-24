# DUST '87

A native MPC SDK drum instrument by Lumina.Aerospace. It synthesizes 18 one-shot percussion voices from incoming MIDI, then applies selectable bit-depth and sample-rate reduction, drive, and a plate-style reverb. Notes 36-53 select the 18 voices; notes outside that range wrap through the same map.

The MPC's own sequencer and pads trigger the instrument. This plugin does not emit MIDI or provide a separate in-plugin step sequencer.

## Controls

Each drum has Tune, Decay, and Level controls. The MIX page provides Master, Bit Depth, Sample Rate, Drive, Plate Mix, and Plate Decay. Eight built-in programs cover the factory, tape, sub, lo-fi, dry, and plate starting points.

## Build and test

From the MPC Plugin SDK checkout:

```sh
python tools/build.py "C:/path/to/mpc-vst-Dust-87/plugins/Dust87"
```

The SDK build generates the native, ARM32, and ARM64 plugin files and touch skin. Test the native build with the SDK host simulator before installing it on hardware:

```sh
.sdk-tools/host_sim "C:/path/to/mpc-vst-Dust-87/plugins/Dust87/build/native/dust--87.so" test --wav "C:/path/to/dust87-test.wav"
```

The MPC OS target requires MPC OS 3.10.1 or later with **Enable Enhancements** and **External Plugin Support** enabled. No hardware test is claimed until the built plugin is installed and exercised on a device.

## Project files

- `plugin.json` - SDK manifest. Its `uid` must remain `LMD8` and match the C++ `uniqueId`.
- `src/DUST87.cpp` - SDK instrument, MIDI mapping, synthesis, and effects.
- `ui.json` - MPC touch-screen pages and Q-Link grouping.
- `build/` - generated native and ARM plugin builds.

The SDK framework is MIT-licensed. DUST '87's plugin code is GPL-3.0-only; see the repository `LICENSE`.
