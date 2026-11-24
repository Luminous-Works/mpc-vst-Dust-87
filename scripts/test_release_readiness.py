import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT
DRUM_LABELS = [
    "Kick", "Sub", "Snare", "Crack", "Rim", "Clap", "CHat", "OHat",
    "LoTom", "MidTom", "HiTom", "Crash", "Ride", "CBell", "Clave",
    "Shaker", "Metal", "Zap",
]


class ReleaseReadinessTests(unittest.TestCase):
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

        referenced = set()
        for page in ui["pages"]:
            self.assertLessEqual(len(page["controls"]), 16)
            for control in page["controls"]:
                if isinstance(control, dict):
                    referenced.add(control["param"])

        self.assertEqual(referenced, expected)
        self.assertEqual(ui["qlinkGroups"], "rows")

    def test_readme_shows_generated_ui_and_states_device_capture_status(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/screenshots/contact-sheet.png", readme)
        self.assertIn("docs/screenshots/mix-layout.png", readme)
        self.assertIn("not screenshots captured from MPC hardware", readme)
        self.assertTrue((ROOT / "docs" / "screenshots" / "contact-sheet.png").is_file())
        self.assertTrue((ROOT / "docs" / "screenshots" / "mix-layout.png").is_file())

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
