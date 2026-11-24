import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT
sys.path.insert(0, str(ROOT))

from tools.prepare_mpc_skin import prepare_skin


DRUM_LABELS = [
    "Kick", "Sub", "Snare", "Crack", "Rim", "Clap", "CHat", "OHat",
    "LoTom", "MidTom", "HiTom", "Crash", "Ride", "CBell", "Clave",
    "Shaker", "Metal", "Zap",
]


class ReleaseReadinessTests(unittest.TestCase):
    def png_dimensions(self, path):
        image = path.read_bytes()
        self.assertEqual(image[:8], b"\x89PNG\r\n\x1a\n")
        return struct.unpack(">II", image[16:24])

    def test_native_sequence_is_transport_synced_and_has_64_steps(self):
        source = (PROJECT / "src" / "DUST87.cpp").read_text(encoding="utf-8")
        ui = json.loads((PROJECT / "ui.json").read_text(encoding="utf-8"))
        sequence_page = next(page for page in ui["pages"] if page["name"] == "SEQ")
        controls_page = next(page for page in ui["pages"] if page["name"] == "SEQCTL")

        self.assertIn("ctx.transport.playing", source)
        self.assertIn("ctx.transport.ppqValid", source)
        self.assertIn("saveExtraState(std::vector<uint8_t>& out) override", source)
        self.assertIn("loadExtraState(const uint8_t* data, size_t size) override", source)
        self.assertEqual(
            [control["param"] for control in sequence_page["controls"]],
            [f"Step {step:02d}" for step in range(1, 17)],
        )
        self.assertEqual(
            {
                control["param"]
                for control in controls_page["controls"]
                if isinstance(control, dict)
            },
            {"Lane", "Bar", "Seq", "Swing", "Rnd Seq", "Clear"},
        )

    def test_native_sequence_clock_respects_swing_and_four_bar_loop(self):
        compiler = shutil.which("g++")
        if compiler is None:
            self.skipTest("g++ is not installed")
        with tempfile.TemporaryDirectory() as temp_dir:
            executable = Path(temp_dir) / "sequencer-clock-test.exe"
            subprocess.run(
                [
                    compiler,
                    "-std=c++17",
                    str(ROOT / "tests" / "sequencer_clock_test.cpp"),
                    "-o",
                    str(executable),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run([str(executable)], check=True, capture_output=True, text=True)

    def test_native_randomizer_matches_the_original_groove_generator_shape(self):
        compiler = shutil.which("g++")
        if compiler is None:
            self.skipTest("g++ is not installed")
        with tempfile.TemporaryDirectory() as temp_dir:
            executable = Path(temp_dir) / "groove-library-test.exe"
            subprocess.run(
                [
                    compiler,
                    "-std=c++17",
                    str(ROOT / "tests" / "groove_library_test.cpp"),
                    "-o",
                    str(executable),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run([str(executable)], check=True, capture_output=True, text=True)

    def test_native_sdk_manifest_and_binary_identity(self):
        manifest = json.loads((PROJECT / "plugin.json").read_text(encoding="utf-8"))
        source = (PROJECT / "src" / "DUST87.cpp").read_text(encoding="utf-8")

        self.assertEqual(manifest["name"], "DUST '87")
        self.assertEqual(manifest["manufacturer"], "Lumina.Aerospace")
        self.assertEqual(manifest["version"], "0.1.0")
        self.assertEqual(manifest["kind"], "instrument")
        self.assertEqual(manifest["uid"], "LMD8")
        self.assertEqual(manifest["license"], "GPL-3.0-only")
        self.assertEqual(manifest["numInputs"], 0)
        self.assertEqual(manifest["numOutputs"], 2)
        self.assertIn("MPC_FOURCC('L', 'M', 'D', '8')", source)
        self.assertIn("MPC_PLUGIN_ENTRY(DUST87)", source)

    def test_touch_ui_covers_every_native_parameter(self):
        ui = json.loads((PROJECT / "ui.json").read_text(encoding="utf-8"))
        expected = {"Master", "Bit Depth", "Sample Rate", "Drive", "Plate Mix", "Plate Decay"}
        for label in DRUM_LABELS:
            expected.update({f"{label} Tune", f"{label} Decay", f"{label} Level"})
        expected.update({f"Step {step:02d}" for step in range(1, 17)})
        expected.update({"Lane", "Bar", "Seq", "Swing", "Rnd Seq", "Clear"})

        referenced = set()
        for page in ui["pages"]:
            self.assertLessEqual(len(page["controls"]), 16)
            for control in page["controls"]:
                if isinstance(control, dict):
                    referenced.add(control["param"])

        self.assertEqual(referenced, expected)
        self.assertNotIn("Playhead", referenced)
        self.assertEqual(ui["qlinkGroups"], "rows")

    def test_native_ui_uses_custom_brand_skin_assets(self):
        ui = json.loads((PROJECT / "ui.json").read_text(encoding="utf-8"))
        self.assertEqual(ui["kit"], "amber")
        self.assertEqual(ui["style"]["accent"], "ffffb020")

        backgrounds = []
        for page in ui["pages"]:
            background = page.get("background")
            self.assertTrue(background, f"{page['name']} page is missing its designed background")
            backgrounds.append(background)
            self.assertEqual(self.png_dimensions(ROOT / "assets" / background), (1280, 628))

        self.assertEqual(len(set(backgrounds)), len(ui["pages"]))
        expected_assets = {
            "knob_uni.png": (90, 90 * 127),
            "knob_bi.png": (90, 90 * 127),
            "fader_h_uni.png": (248, 36 * 127),
            "seg4_on.png": (58, 40),
            "seg4_off.png": (58, 40),
            "seq_step_on.png": (54, 52),
            "seq_step_off.png": (54, 52),
            "seq_toggle_on.png": (52, 36),
            "seq_toggle_off.png": (52, 36),
            "seq_playhead.png": (1227, 100 * 17),
        }
        for filename, dimensions in expected_assets.items():
            with self.subTest(asset=filename):
                self.assertEqual(self.png_dimensions(ROOT / "assets" / filename), dimensions)

    def test_native_knob_rings_follow_the_midi_velocity_pulse(self):
        source = (PROJECT / "src" / "DUST87.cpp").read_text(encoding="utf-8")
        self.assertIn('"beat_pulse"', source)
        self.assertIn("beatPulseParam.automatable = false", source)
        self.assertIn("void saveExtraState(std::vector<uint8_t>& out) override", source)

        ui = json.loads((ROOT / "ui.json").read_text(encoding="utf-8"))
        tui = json.loads((ROOT / "skins" / "TUI.json").read_text(encoding="utf-8"))
        page_data = tui["pageData"]
        definitions = {
            entry["key"]: entry["value"]
            for entry in page_data["componentDefinitions"]["localComponentDefinitions"]
        }
        pulse_images = set()
        for page_index, tab in enumerate(page_data["tabs"]):
            knobs = [
                child
                for child in tab["componentDefinition"]["componentsData"]
                if child["componentData"]["type"].startswith(("knobUniPulse_", "knobBiPulse_"))
            ]
            expected_knobs = sum(
                control.get("widget") == "knob"
                for control in ui["pages"][page_index]["controls"]
                if isinstance(control, dict)
            )
            self.assertEqual(len(knobs), expected_knobs)
            for knob in knobs:
                remaps = {
                    item["key"]: item["value"]
                    for item in knob["handle remapping"]["map"]
                }
                self.assertEqual(remaps["Pulse"], "Parameter 60")
                definition = definitions[knob["componentData"]["type"]]
                pulse = next(
                    child for child in definition["componentsData"]
                    if child["componentData"]["type"] == "Image"
                )
                image_data = pulse["componentData"]["data"]
                self.assertEqual(image_data["imageType"], "FilmStrip")
                self.assertEqual(image_data["handleName"], "Pulse")
                self.assertEqual(image_data["numFrames"], 127)
                pulse_images.add(image_data["image"])

        self.assertTrue(pulse_images)
        for filename in pulse_images:
            with self.subTest(asset=filename):
                self.assertEqual(
                    self.png_dimensions(ROOT / "assets" / filename),
                    (106, 106 * 127),
                )

    def test_skin_preparation_adds_page_specific_pulse_overlays(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            generated = temp / "generated"
            generated.mkdir()
            output = temp / "skins"
            params_path = temp / "params.json"
            base_knob = {
                "componentsData": [
                    {"componentData": {"type": "Focus"}, "bounds": {"bounds": "0 0 278 107"}},
                    {"componentData": {"type": "Knob"}, "bounds": {"bounds": "15 15 90 90"}},
                    {
                        "componentData": {
                            "type": "Label",
                            "name": "name",
                            "data": {"textStyle": {"font": {"height": 26.0}}},
                        },
                        "bounds": {"bounds": "110 12 150 36"},
                    },
                    {
                        "componentData": {
                            "type": "Label",
                            "name": "value",
                            "data": {"textStyle": {"font": {"height": 30.0}}},
                        },
                        "bounds": {"bounds": "110 52 150 42"},
                    },
                ]
            }
            base_toggle = {
                "componentsData": [
                    {"componentData": {"type": "Focus"}, "bounds": {"bounds": "0 0 278 107"}},
                    {
                        "componentData": {
                            "type": "Label",
                            "name": "name",
                            "data": {"textStyle": {"font": {"height": 26.0}}},
                        },
                        "bounds": {"bounds": "15 12 170 36"},
                    },
                    {
                        "componentData": {
                            "type": "Label",
                            "name": "value",
                            "data": {"textStyle": {"font": {"height": 30.0}}},
                        },
                        "bounds": {"bounds": "15 52 170 42"},
                    },
                    {
                        "componentData": {
                            "type": "Button",
                            "data": {
                                "onImage": "toggle_on.png",
                                "offImage": "toggle_off.png",
                            },
                        },
                        "bounds": {"bounds": "186 20 84 68"},
                    },
                ]
            }

            def control(name, component_type):
                return {
                    "componentData": {"name": name, "type": component_type},
                    "handle remapping": {
                        "version": 1,
                        "map": [{"key": "Data", "value": "Parameter 3"}],
                    },
                    "bounds": {"bounds": "0 0 278 107"},
                }

            tabs = []
            pages = json.loads((ROOT / "ui.json").read_text(encoding="utf-8"))["pages"]
            for page in pages:
                if page["name"] == "SEQ":
                    components = [
                        control(f"Step {step:02d}", "toggle")
                        for step in range(1, 17)
                    ]
                elif page["name"] == "SEQCTL":
                    components = [
                        control("Lane", "knobUniMenu"),
                        control("Bar", "radio4"),
                        control("Seq", "toggle"),
                        control("Swing", "faderUni"),
                        control("Rnd Seq", "toggle"),
                        control("Clear", "toggle"),
                    ]
                    components.extend(
                        {
                            "componentData": {"name": f"Bar seg {step}", "type": "Label"},
                            "bounds": {"bounds": "0 0 58 26"},
                        }
                        for step in range(4)
                    )
                else:
                    components = []
                    for spec in page["controls"]:
                        if not isinstance(spec, dict):
                            continue
                        widget = spec.get("widget")
                        component_type = {
                            "knob": "knobUni",
                            "fader": "faderUni",
                            "switch": "radio4",
                        }[widget]
                        components.append(control(spec["param"], component_type))
                tabs.append({
                    "tabName": page["name"],
                    "componentDefinition": {
                        "componentsData": components
                    }
                })
            tabs[5]["qlinkBoundsData"] = ["0 0 640 314", "640 314 640 314"]
            tui = {
                "pageData": {
                    "componentDefinitions": {
                        "localComponentDefinitions": [
                            {"key": "knobUni", "value": base_knob},
                            {"key": "knobBi", "value": base_knob},
                            {"key": "knobUniMenu", "value": base_knob},
                            {"key": "toggle", "value": base_toggle},
                        ]
                    },
                    "tabs": tabs,
                }
            }
            (generated / "TUI.json").write_text(json.dumps(tui), encoding="utf-8")
            (generated / "Q-Links.json").write_text(json.dumps({
                "Screen Mode Q-Links": {
                    "map": [
                        {"Tab": index, "Q-Links": {"Q-Link 1": index}}
                        for index in range(1, len(pages) + 1)
                    ]
                }
            }), encoding="utf-8")
            params_path.write_text(json.dumps({
                "params": [
                    {"index": 60, "name": "Beat Pulse", "automatable": False},
                    {"index": 67, "name": "Playhead", "automatable": False},
                ]
            }), encoding="utf-8")

            prepare_skin(generated, params_path, output)

            result = json.loads((output / "TUI.json").read_text(encoding="utf-8"))
            page_data = result["pageData"]
            definitions = {
                entry["key"]: entry["value"]
                for entry in page_data["componentDefinitions"]["localComponentDefinitions"]
            }
            self.assertEqual(len(page_data["tabs"]), 6)
            self.assertNotIn("toggle", definitions)
            for page, tab in zip(pages[:6], page_data["tabs"]):
                components = tab["componentDefinition"]["componentsData"]
                knobs = [
                    instance for instance in components
                    if instance["componentData"]["type"].startswith(("knobUniPulse_", "knobBiPulse_"))
                ]
                expected_knobs = sum(
                    control.get("widget") == "knob"
                    for control in page["controls"]
                    if isinstance(control, dict)
                )
                self.assertEqual(len(knobs), expected_knobs)
                for instance in knobs:
                    page_key = instance["componentData"]["type"]
                    self.assertIn(
                        {"key": "Pulse", "value": "Parameter 60"},
                        instance["handle remapping"]["map"],
                    )
                    pulse = next(
                        child for child in definitions[page_key]["componentsData"]
                        if child["componentData"]["type"] == "Image"
                    )
                    self.assertEqual(
                        pulse["componentData"]["data"]["image"],
                        f"pulse_ring_{page['name'].lower()}.png",
                    )

            sequence_components = page_data["tabs"][5]["componentDefinition"]["componentsData"]
            self.assertEqual(
                sum(component["componentData"]["type"] == "sequenceStep"
                    for component in sequence_components),
                16,
            )
            self.assertEqual(page_data["tabs"][5]["qlinkBoundsData"], [])
            for entry in page_data["componentDefinitions"]["localComponentDefinitions"]:
                for image_name in self.referenced_images(entry["value"]):
                    self.assertTrue(
                        (ROOT / "assets" / image_name).is_file(),
                        f"TUI references missing skin image {image_name}",
                    )
            qlinks = json.loads((output / "Q-Links.json").read_text(encoding="utf-8"))
            qlink_tabs = qlinks["Screen Mode Q-Links"]["map"]
            self.assertEqual([item["Tab"] for item in qlink_tabs], list(range(1, 7)))
            self.assertEqual(qlink_tabs[5]["Q-Links"], {"Q-Link 1": -1})

    def referenced_images(self, value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in {"image", "onImage", "offImage"} and isinstance(child, str):
                    yield child
                yield from self.referenced_images(child)
        elif isinstance(value, list):
            for child in value:
                yield from self.referenced_images(child)

    def test_skin_preparation_rejects_an_automatable_pulse_parameter(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            generated = temp / "generated"
            generated.mkdir()
            (generated / "TUI.json").write_text('{"pageData": {}}', encoding="utf-8")
            (generated / "Q-Links.json").write_text("{}", encoding="utf-8")
            params_path = temp / "params.json"
            params_path.write_text(json.dumps({
                "params": [
                    {"index": 60, "name": "Beat Pulse", "automatable": True}
                ]
            }), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "must be non-automatable"):
                prepare_skin(generated, params_path, temp / "skins")

    def test_readme_shows_generated_ui_and_states_device_capture_status(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/screenshots/contact-sheet.png", readme)
        self.assertIn("docs/screenshots/mix-layout.png", readme)
        self.assertIn("not screenshots captured from MPC hardware", readme)
        self.assertTrue((ROOT / "docs" / "screenshots" / "contact-sheet.png").is_file())
        self.assertTrue((ROOT / "docs" / "screenshots" / "mix-layout.png").is_file())
        self.assertTrue((ROOT / "docs" / "screenshots" / "seq-layout.png").is_file())

    def test_readme_lists_all_factory_programs_and_explains_sequencer_capture(self):
        source = (PROJECT / "src" / "DUST87.cpp").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        programs = re.findall(r'addProgram\("([^"]+)"', source)

        self.assertEqual(len(programs), 8)
        self.assertIn("8 built-in factory programs", readme)
        for program in programs:
            with self.subTest(program=program):
                self.assertIn(program, readme)
        self.assertIn("64-step sequencer", readme)
        self.assertIn("18 drum lanes", readme)
        self.assertIn("MPC transport", readme)
        self.assertIn("not screenshots captured from MPC hardware", readme)

    def test_catalog_entry_uses_registry_schema_and_sdk_identity(self):
        manifest = json.loads((PROJECT / "plugin.json").read_text(encoding="utf-8"))
        entry = json.loads((ROOT / "catalog" / "plugins" / "dust87.json").read_text(encoding="utf-8"))

        self.assertEqual(entry["id"], "dust87")
        self.assertEqual(entry["repo"], "Luminous-Works/mpc-vst-Dust-87")
        self.assertEqual(entry["name"], manifest["name"])
        self.assertEqual(entry["kind"], manifest["kind"])
        self.assertEqual(entry["license"], manifest["license"])
        self.assertTrue(entry["summary"])
        self.assertNotIn("version", entry)
        self.assertNotIn("compatibility", entry)

    def test_release_workflow_is_sdk_based_pinned_and_nonpublishing_by_default(self):
        workflow = (ROOT / ".github" / "workflows" / "vst-release.yml").read_text(encoding="utf-8")
        uses = re.search(
            r"uses:\s*open-mpc/mpc-vst-plugins/\.github/workflows/vst-release\.yml@([0-9a-f]{40})",
            workflow,
        )
        tools_ref = re.search(r"tools_ref:\s*([0-9a-f]{40})", workflow)

        self.assertIsNotNone(uses)
        self.assertIsNotNone(tools_ref)
        self.assertEqual(uses.group(1), tools_ref.group(1))
        self.assertIn("sdk_project: .", workflow)
        self.assertIn("tools/build.py . --target all", workflow)
        self.assertIn("tag:", workflow)
        self.assertIn("version:", workflow)
        self.assertIn("dry_run:", workflow)
        self.assertRegex(workflow, r"dry_run:\s*\n\s+description:.*\n\s+type: boolean\n\s+default: true")
        self.assertNotRegex(workflow, r"(?m)^\s+push:")


if __name__ == "__main__":
    unittest.main()
