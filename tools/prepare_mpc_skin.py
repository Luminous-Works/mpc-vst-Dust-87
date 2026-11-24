#!/usr/bin/env python3
"""Add DUST '87 backgrounds and MIDI-beat pulse overlays to the MPC touch skin."""

import argparse
import copy
import json
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


def _parameter_index(params_path, name):
    params = _read_json(params_path).get("params", [])
    matches = [param for param in params if param.get("name") == name]
    if len(matches) != 1:
        raise ValueError(f"SDK parameter dump must contain exactly one {name} parameter")
    parameter = matches[0]
    if parameter.get("automatable") is not False:
        raise ValueError(f"{name} must be non-automatable")
    if not isinstance(parameter.get("index"), int):
        raise ValueError(f"{name} parameter index is missing or invalid")
    return parameter["index"]


def _background_component(filename):
    return {
        "version": 2,
        "componentData": {
            "version": 1,
            "name": "DUST '87 aluminum background",
            "type": "Image",
            "data": {
                "version": 2,
                "imageType": "Regular",
                "colour": "0",
                "image": filename,
            },
        },
        "handle remapping": {"version": 1, "map": []},
        "bounds": {
            "version": 1,
            "acceptsHWFocus": "No",
            "showWhenDataModelInvalid": "Show",
            "whenVisible": "Always",
            "boundsType": "Absolute",
            "bounds": "0 0 1280 628",
        },
    }


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


def _component_bounds(component, value):
    component["bounds"]["bounds"] = value


def _sequence_step_definition(toggle_definition):
    definition = copy.deepcopy(toggle_definition)
    children = []
    for child in definition["componentsData"]:
        kind = child["componentData"]["type"]
        if kind == "Focus":
            _component_bounds(child, "0 0 72 100")
            children.append(child)
        elif kind == "Label" and child["componentData"]["name"] == "name":
            child["componentData"]["data"]["textStyle"]["font"]["height"] = 12.0
            child["componentData"]["data"]["textStyle"]["justification"] = "horizontallyCentred"
            _component_bounds(child, "3 5 66 20")
            children.append(child)
        elif kind == "Button":
            button = child["componentData"]["data"]
            button["onImage"] = "seq_step_on.png"
            button["offImage"] = "seq_step_off.png"
            button["buttonId"] = 1
            button["numButtonsInGroup"] = 1
            _component_bounds(child, "9 36 54 52")
            children.append(child)
    definition["componentsData"] = children
    return definition


def _sequence_control_definition(toggle_definition, action=False):
    definition = copy.deepcopy(toggle_definition)
    children = []
    for child in definition["componentsData"]:
        kind = child["componentData"]["type"]
        if kind == "Focus":
            _component_bounds(child, "0 0 100 105")
            children.append(child)
        elif kind == "Label" and child["componentData"]["name"] == "name":
            child["componentData"]["data"]["textStyle"]["font"]["height"] = 13.0
            child["componentData"]["data"]["textStyle"]["justification"] = "horizontallyCentred"
            _component_bounds(child, "4 8 92 23")
            children.append(child)
        elif kind == "Label" and not action:
            child["componentData"]["data"]["textStyle"]["font"]["height"] = 12.0
            child["componentData"]["data"]["textStyle"]["justification"] = "horizontallyCentred"
            _component_bounds(child, "4 31 92 17")
            children.append(child)
        elif kind == "Button":
            button = child["componentData"]["data"]
            button["onImage"] = "seq_step_on.png" if action else "seq_toggle_on.png"
            button["offImage"] = "seq_step_off.png" if action else "seq_toggle_off.png"
            button["buttonId"] = 1
            button["numButtonsInGroup"] = 1
            _component_bounds(child, "23 53 54 36" if not action else "23 48 54 52")
            children.append(child)
    definition["componentsData"] = children
    return definition


def _sequence_lane_definition(knob_definition):
    definition = copy.deepcopy(knob_definition)
    for child in definition["componentsData"]:
        kind = child["componentData"]["type"]
        if kind == "Focus":
            _component_bounds(child, "0 0 194 105")
        elif kind == "Knob":
            _component_bounds(child, "1 7 90 90")
        elif kind == "Label" and child["componentData"]["name"] == "name":
            child["componentData"]["data"]["textStyle"]["font"]["height"] = 13.0
            _component_bounds(child, "96 20 94 25")
        elif kind == "Label":
            child["componentData"]["data"]["textStyle"]["font"]["height"] = 16.0
            _component_bounds(child, "96 48 94 34")
    return definition


def _pad_action_definition(toggle_definition):
    definition = copy.deepcopy(toggle_definition)
    for child in definition["componentsData"]:
        kind = child["componentData"]["type"]
        if kind == "Focus":
            _component_bounds(child, "0 0 298 115")
        elif kind == "Label" and child["componentData"]["name"] == "name":
            child["componentData"]["data"]["textStyle"]["font"]["height"] = 13.0
            child["componentData"]["data"]["textStyle"]["justification"] = "horizontallyCentred"
            _component_bounds(child, "4 3 290 21")
        elif kind == "Label":
            continue
        elif kind == "Button":
            button = child["componentData"]["data"]
            button["onImage"] = "pad_button_on.png"
            button["offImage"] = "pad_button_off.png"
            button["buttonId"] = 1
            button["numButtonsInGroup"] = 1
            _component_bounds(child, "10 27 278 80")
    return definition


def _playhead_component(parameter_index):
    return {
        "version": 2,
        "componentData": {
            "version": 1,
            "name": "Sequencer playhead",
            "type": "Image",
            "data": {
                "version": 2,
                "imageType": "FilmStrip",
                "colour": "0",
                "image": "seq_playhead.png",
                "numFrames": 17,
                "handleName": "Playhead",
            },
        },
        "handle remapping": {
            "version": 1,
            "map": [{"key": "Playhead", "value": f"Parameter {parameter_index}"}],
        },
        "bounds": {
            "version": 1,
            "acceptsHWFocus": "No",
            "showWhenDataModelInvalid": "Show",
            "whenVisible": "Always",
            "boundsType": "Absolute",
            "bounds": "26 280 1227 100",
        },
    }


def _disable_sequence_qlinks(qlinks, sequence_tab, controls_tab):
    mappings = qlinks.get("Screen Mode Q-Links", {}).get("map", [])
    for item in mappings[:]:
        if item.get("Tab") == controls_tab:
            mappings.remove(item)
        elif item.get("Tab") == sequence_tab:
            item["Q-Links"] = {name: -1 for name in item.get("Q-Links", {})}


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
    playhead_index = _parameter_index(params_path, "Playhead")
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
        components.insert(0, _background_component(f"{page_name}-bg.png"))
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

    page_indices = {page["name"]: index for index, page in enumerate(pages)}
    if "SEQ" not in page_indices or "SEQCTL" not in page_indices:
        raise ValueError("ui.json must define both SEQ and SEQCTL pages")
    sequence_index = page_indices["SEQ"]
    controls_index = page_indices["SEQCTL"]
    sequence_tab = tabs[sequence_index]
    controls_tab = tabs[controls_index]
    sequence_tab["qlinkBoundsData"] = []
    sequence_components = sequence_tab["componentDefinition"]["componentsData"]
    controls_components = controls_tab["componentDefinition"]["componentsData"]

    required_definitions = ("toggle", "knobUniMenu")
    for name in required_definitions:
        if name not in definitions:
            raise ValueError(f"generated TUI is missing the {name} definition")

    sequence_step_type = "sequenceStep"
    sequence_toggle_type = "sequenceToggle"
    sequence_action_type = "sequenceAction"
    sequence_lane_type = "sequenceLane"
    pad_action_type = "padAction"
    for name, definition in (
        (sequence_step_type, _sequence_step_definition(definitions["toggle"])),
        (sequence_toggle_type, _sequence_control_definition(definitions["toggle"])),
        (sequence_action_type, _sequence_control_definition(definitions["toggle"], action=True)),
        (sequence_lane_type, _sequence_lane_definition(definitions["knobUniMenu"])),
        (pad_action_type, _pad_action_definition(definitions["toggle"])),
    ):
        if name not in generated_definitions:
            definition_entries.append({"key": name, "value": definition})
            generated_definitions.add(name)

    step_index = 0
    for instance in sequence_components:
        component_data = instance.get("componentData", {})
        if component_data.get("name", "").startswith("Step "):
            component_data["type"] = sequence_step_type
            _component_bounds(instance, f"{26 + step_index * 77} 280 72 100")
            step_index += 1

    control_bounds = {
        "Lane": ("sequenceLane", "24 72 194 105"),
        "Bar": ("radio4", "228 72 248 105"),
        "Seq": (sequence_toggle_type, "486 72 100 105"),
        "Swing": ("faderUni", "596 72 248 105"),
        "Rnd Seq": (sequence_action_type, "854 72 110 105"),
        "Clear": (sequence_action_type, "974 72 110 105"),
    }
    for instance in controls_components:
        name = instance.get("componentData", {}).get("name")
        if isinstance(name, str) and name.startswith("Bar seg "):
            segment = int(name.rsplit(" ", 1)[1])
            _component_bounds(instance, f"{243 + segment * 58} 122 58 26")
            sequence_components.append(instance)
            continue
        if name not in control_bounds:
            continue
        component_type, bounds = control_bounds[name]
        instance["componentData"]["type"] = component_type
        _component_bounds(instance, bounds)
        sequence_components.append(instance)

    if "DRUMS" not in page_indices:
        raise ValueError("ui.json must define a DRUMS page")
    drum_components = tabs[page_indices["DRUMS"]]["componentDefinition"]["componentsData"]
    for instance in drum_components:
        component_data = instance.get("componentData", {})
        name = component_data.get("name")
        if name == "Bank":
            _component_bounds(instance, "24 58 208 92")
        elif isinstance(name, str) and name.startswith("Pad "):
            try:
                pad = int(name.rsplit(" ", 1)[1]) - 1
            except ValueError as error:
                raise ValueError(f"invalid DRUMS pad control name: {name}") from error
            if not 0 <= pad < 12:
                raise ValueError(f"invalid DRUMS pad control name: {name}")
            component_data["type"] = pad_action_type
            column, row = pad % 4, pad // 4
            _component_bounds(
                instance,
                f"{24 + column * 307} {160 + row * 140} 298 115",
            )

    sequence_components.append(_playhead_component(playhead_index))
    definition_entries[:] = [
        entry for entry in definition_entries if entry.get("key") != "toggle"
    ]
    qlinks = _read_json(qlinks_path)
    _disable_sequence_qlinks(qlinks, sequence_index + 1, controls_index + 1)
    tabs.pop(controls_index)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "TUI.json").write_text(
        json.dumps(tui, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "Q-Links.json").write_text(
        json.dumps(qlinks, indent=2) + "\n",
        encoding="utf-8",
    )


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
