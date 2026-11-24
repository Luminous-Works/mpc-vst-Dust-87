#!/usr/bin/env python3
"""Add MIDI-beat pulse overlays to an SDK-generated MPC touch skin."""

import argparse
import copy
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UI_PATH = ROOT / "ui.json"


def _read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _pulse_index(params_path):
    params = _read_json(params_path).get("params", [])
    matches = [param for param in params if param.get("name") == "Beat Pulse"]
    if len(matches) != 1:
        raise ValueError("SDK parameter dump must contain exactly one Beat Pulse parameter")
    pulse = matches[0]
    if pulse.get("automatable") is not False:
        raise ValueError("Beat Pulse must be non-automatable")
    if not isinstance(pulse.get("index"), int):
        raise ValueError("Beat Pulse parameter index is missing or invalid")
    return pulse["index"]


def _pulse_component(filename):
    return {
        "version": 2,
        "componentData": {
            "version": 1,
            "name": "Beat pulse ring",
            "type": "Image",
            "data": {
                "version": 2,
                "imageType": "FilmStrip",
                "colour": "0",
                "image": filename,
                "numFrames": 127,
                "handleName": "Pulse",
            },
        },
        "handle remapping": {"version": 1, "map": []},
        "bounds": {
            "version": 1,
            "acceptsHWFocus": "No",
            "showWhenDataModelInvalid": "Show",
            "whenVisible": "Always",
            "boundsType": "Absolute",
            "bounds": "0 0 106 106",
        },
    }


def _ensure_mapping(instance, handle, parameter):
    remapping = instance.setdefault(
        "handle remapping", {"version": 1, "map": []}
    )
    mappings = remapping.setdefault("map", [])
    mappings[:] = [entry for entry in mappings if entry.get("key") != handle]
    mappings.append({"key": handle, "value": f"Parameter {parameter}"})


def prepare_skin(generated_dir, params_path, output_dir):
    generated_dir = Path(generated_dir)
    tui_path = generated_dir / "TUI.json"
    qlinks_path = generated_dir / "Q-Links.json"
    if not tui_path.is_file() or not qlinks_path.is_file():
        raise FileNotFoundError(
            "SDK-generated skin directory must contain TUI.json and Q-Links.json"
        )

    pulse_index = _pulse_index(params_path)
    ui = _read_json(UI_PATH)
    tui = _read_json(tui_path)
    page_data = tui["pageData"]
    tabs = page_data["tabs"]
    pages = ui["pages"]
    if len(tabs) != len(pages):
        raise ValueError(
            f"generated TUI has {len(tabs)} tabs but ui.json defines {len(pages)} pages"
        )

    definition_entries = page_data["componentDefinitions"]["localComponentDefinitions"]
    definitions = {entry["key"]: entry["value"] for entry in definition_entries}
    generated_definitions = set(definitions)

    for page, tab in zip(pages, tabs):
        page_name = page["name"].lower()
        components = tab["componentDefinition"]["componentsData"]
        for instance in components:
            component_data = instance.get("componentData", {})
            base_type = component_data.get("type")
            if base_type not in ("knobUni", "knobBi"):
                continue

            if base_type not in definitions:
                raise ValueError(f"generated TUI is missing the {base_type} definition")
            pulse_type = f"{base_type}Pulse_{page_name}"
            if pulse_type not in generated_definitions:
                definition = copy.deepcopy(definitions[base_type])
                definition["componentsData"].insert(
                    1,
                    _pulse_component(f"pulse_ring_{page_name}.png"),
                )
                definition_entries.append({"key": pulse_type, "value": definition})
                generated_definitions.add(pulse_type)

            component_data["type"] = pulse_type
            _ensure_mapping(instance, "Pulse", pulse_index)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "TUI.json").write_text(
        json.dumps(tui, indent=2) + "\n",
        encoding="utf-8",
    )
    shutil.copyfile(qlinks_path, output_dir / "Q-Links.json")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--generated",
        required=True,
        type=Path,
        help="directory containing SDK-generated TUI.json and Q-Links.json",
    )
    parser.add_argument(
        "--params",
        type=Path,
        default=ROOT / "build" / "params.json",
        help="SDK parameter dump used to locate the non-automatable Beat Pulse",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "skins",
        help="destination for the patched TUI.json and Q-Links.json",
    )
    args = parser.parse_args()
    prepare_skin(args.generated, args.params, args.output)


if __name__ == "__main__":
    main()
