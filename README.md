# DUST '87

**A native MPC SDK drum instrument by Lumina.Aerospace.** The instrument runs inside MPC as an SDK plugin; it is not the browser app retained in this repository's legacy prototype sources.

## Instrument

DUST '87 provides 18 procedural percussion voices with per-voice Tune, Decay, and Level controls. Global controls add selectable bit-depth and sample-rate reduction, drive, and plate-style reverb. Incoming MIDI notes 36–53 select the voices; notes outside that range wrap through the same map. Eight built-in programs provide starting points.

Pads and sequences are handled by MPC. DUST '87 does not emit MIDI or provide a separate in-plugin step sequencer.

## Build and host-test

Use the MPC Plugin Builder SDK checkout and Python version supported by that SDK:

```sh
python tools/build.py /path/to/mpc-vst-Dust-87/plugins/Dust87 --target all
```

The SDK generates native, ARM32, and ARM64 builds and validates the manifest and touch UI. Run the SDK host simulator against the native binary:

```sh
.sdk-tools/host_sim /path/to/mpc-vst-Dust-87/plugins/Dust87/build/native/dust--87.so test --wav /tmp/dust87-test.wav
```

The [Open-MPC release workflow](https://open-mpc.github.io/workflow.html) is configured to run the metadata checks, all SDK build targets, and host simulator. It is triggered manually for release packaging and defaults to `dry_run: true`; this produces build artifacts without creating a draft release.

## MPC install and release status

The SDK targets MPC OS 3.10.1 or later with **Enable Enhancements** and **External Plugin Support** enabled. Device compatibility is not confirmed until the built plugin is installed and exercised on MPC hardware.

No MPC hardware smoke test or device CPU benchmark has been performed. Before publishing, install the exact draft-release ZIP on the target device, verify load/play/save/reload/uninstall behavior, and run the SDK CPU benchmark on-device. The registry metadata at `catalog/plugins/dust87.json` is a local proposal; it is not a listing in the Open-MPC catalog.

## Project layout

- `plugins/Dust87/` — MPC SDK manifest, native C++ instrument, and touch-screen UI.
- `catalog/plugins/dust87.json` — proposed Open-MPC catalog registry entry.
- `.github/workflows/vst-release.yml` — pinned SDK build/test and manual release workflow.
- `scripts/test_release_readiness.py` — checks the manifest, UI, catalog metadata, and workflow contract.
- `src/`, `public/`, and `server.ts` — legacy browser prototype sources; not built or packaged by the MPC SDK release workflow.

The plugin code is GPL-3.0-only; see [LICENSE](LICENSE). The [MPC Plugin Builder SDK](https://github.com/inmusic-software/mpc-plugin-builder-sdk) is maintained separately by its upstream authors.
