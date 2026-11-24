#!/usr/bin/env python3
"""Compose documentation previews from the native MPC layout and skin assets."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
UI_PATH = ROOT / "ui.json"
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "docs" / "screenshots"
WIDTH = 1280
HEIGHT = 628
FRAME = 82


def font(size, bold=False):
    candidates = (
        ["C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold else ["C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def argb(value, fallback):
    if not isinstance(value, str) or len(value) != 8:
        return fallback
    return "#" + value[-6:]


def frame_image(filename, frame, frame_height):
    with Image.open(ASSETS / filename) as strip:
        top = min(frame, strip.height // frame_height - 1) * frame_height
        return strip.crop((0, top, strip.width, top + frame_height)).convert("RGBA")


def render_control(image, control, index, style, page_name):
    if control == "empty":
        return

    column, row = index % 4, index // 4
    left, top = 23 + column * 320, 45 + row * 150
    draw = ImageDraw.Draw(image)
    label = control["param"]
    widget = control.get("widget", "knob")
    text = argb(style.get("text"), "#ffffff")
    muted = argb(style.get("muted"), "#8290a1")

    if widget == "knob":
        filename = "knob_bi.png" if label.endswith("Tune") else "knob_uni.png"
        image.alpha_composite(
            frame_image(f"pulse_ring_{page_name}.png", FRAME, 106),
            (left, top),
        )
        image.alpha_composite(frame_image(filename, FRAME, 90), (left + 8, top + 8))
        draw.text((left + 110, top + 15), label, fill=text, font=font(15, bold=True))
        draw.text((left + 110, top + 54), "PARAMETER", fill=muted, font=font(10, bold=True))
    elif widget == "fader":
        draw.text((left + 15, top + 8), label, fill=text, font=font(15, bold=True))
        draw.text((left + 208, top + 17), "62%", fill=muted, font=font(10, bold=True))
        image.alpha_composite(frame_image("fader_h_uni.png", FRAME, 36), (left + 15, top + 54))
    elif widget == "switch":
        draw.text((left + 15, top + 8), label, fill=text, font=font(15, bold=True))
        for segment in range(4):
            filename = "seg4_on.png" if segment == 0 else "seg4_off.png"
            with Image.open(ASSETS / filename) as segment_image:
                image.alpha_composite(
                    segment_image.convert("RGBA"),
                    (left + 15 + segment * 62, top + 54),
                )


def render_page(page, ui):
    background = Image.open(ASSETS / page["background"]).convert("RGBA")
    for index, control in enumerate(page["controls"]):
        render_control(
            background,
            control,
            index,
            ui.get("style", {}),
            page["name"].lower(),
        )

    draw = ImageDraw.Draw(background)
    draw.text((WIDTH - 264, HEIGHT - 20), "GENERATED PREVIEW / NOT A DEVICE CAPTURE",
              fill=(128, 145, 161, 230), font=font(9, bold=True))
    return background.convert("RGB")


def main():
    ui = json.loads(UI_PATH.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rendered = []

    for page in ui["pages"]:
        image = render_page(page, ui)
        image.save(OUTPUT / f"{page['name'].lower()}-layout.png", optimize=True)
        rendered.append((page["name"], image.copy()))

    thumb_width = 560
    thumb_height = round(HEIGHT * thumb_width / WIDTH)
    gap = 20
    columns = 3
    rows = (len(rendered) + columns - 1) // columns
    contact = Image.new(
        "RGB",
        (columns * thumb_width + (columns + 1) * gap,
         rows * (thumb_height + 34) + (rows + 1) * gap),
        "#10151c",
    )
    draw = ImageDraw.Draw(contact)
    for index, (name, image) in enumerate(rendered):
        row, column = divmod(index, columns)
        x = gap + column * (thumb_width + gap)
        y = gap + row * (thumb_height + 34 + gap)
        thumb = image.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        contact.paste(thumb, (x, y))
        draw.text((x, y + thumb_height + 8), name, fill="#ffffff", font=font(18, bold=True))

    contact.save(OUTPUT / "contact-sheet.png", optimize=True)
    print(f"Rendered {len(rendered)} native-skin page previews to {OUTPUT}")


if __name__ == "__main__":
    main()
