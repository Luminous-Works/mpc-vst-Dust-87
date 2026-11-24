#!/usr/bin/env python3
"""Render documentation-only MPC UI layout previews from ui.json."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
UI_PATH = ROOT / "ui.json"
OUTPUT = ROOT / "docs" / "screenshots"
WIDTH = 1440
HEIGHT = 810


def color_from_argb(value, fallback):
    if not isinstance(value, str) or len(value) != 8:
        return fallback
    return "#" + value[-6:]


def font(size, bold=False):
    candidates = (
        ["C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold
        else ["C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def draw_control(draw, box, control, accent, text, muted, line):
    left, top, right, bottom = box
    draw.rounded_rectangle(box, radius=12, fill="#222326", outline=line, width=2)
    label = control["param"]
    draw.text((left + 18, top + 14), label, fill=text, font=font(20, bold=True))
    widget = control.get("widget", "knob")
    center_x = (left + right) // 2
    center_y = top + 75

    if widget == "fader":
        draw.line((center_x, center_y - 20, center_x, bottom - 18), fill=muted, width=5)
        draw.rounded_rectangle(
            (center_x - 22, center_y + 1, center_x + 22, center_y + 15),
            radius=6,
            fill=accent,
        )
    elif widget == "switch":
        draw.rounded_rectangle(
            (left + 30, center_y - 15, right - 30, center_y + 22),
            radius=12,
            fill="#141517",
            outline=muted,
            width=2,
        )
        draw.rounded_rectangle(
            (center_x - 24, center_y - 11, center_x + 24, center_y + 18),
            radius=10,
            fill=accent,
        )
    else:
        radius = 24
        draw.ellipse(
            (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
            fill="#17181a",
            outline=muted,
            width=4,
        )
        draw.arc(
            (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
            start=210,
            end=330,
            fill=accent,
            width=4,
        )
        draw.line((center_x, center_y, center_x + 16, center_y - 14), fill=accent, width=3)
        draw.ellipse((center_x - 4, center_y - 4, center_x + 4, center_y + 4), fill=text)


def render_page(page, style):
    background = color_from_argb(style.get("background"), "#1e1d1e")
    accent = color_from_argb(style.get("accent"), "#d31145")
    text = color_from_argb(style.get("text"), "#ffffff")
    muted = color_from_argb(style.get("muted"), "#77777a")
    line = "#393a3d"
    image = Image.new("RGB", (WIDTH, HEIGHT), "#111214")
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, WIDTH, 66), fill="#17181a")
    draw.text((48, 19), "DUST '87   /   MPC TOUCH UI PREVIEW", fill=text, font=font(20, bold=True))
    draw.text((WIDTH - 420, 22), "GENERATED FROM ui.json - NOT A DEVICE CAPTURE", fill=muted, font=font(13))

    page_names = [page["name"] for page in UI["pages"]]
    tab_width = (WIDTH - 96) // len(page_names)
    for index, name in enumerate(page_names):
        x = 48 + index * tab_width
        fill = accent if name == page["name"] else "#242528"
        draw.rounded_rectangle((x, 84, x + tab_width - 8, 130), radius=8, fill=fill)
        draw.text((x + 18, 98), name, fill=text, font=font(17, bold=name == page["name"]))

    draw.text((48, 160), page["name"] + " PAGE", fill=text, font=font(32, bold=True))
    draw.text(
        (48, 207),
        "Illustrative control layout; final rendering depends on MPC OS and the generated SDK skin.",
        fill=muted,
        font=font(16),
    )

    margin_x = 48
    margin_y = 250
    gap_x = 16
    gap_y = 14
    columns = 4
    rows = 4
    cell_width = (WIDTH - 2 * margin_x - gap_x * (columns - 1)) // columns
    cell_height = 118

    for index, control in enumerate(page["controls"]):
        if control == "empty":
            continue
        row, column = divmod(index, columns)
        left = margin_x + column * (cell_width + gap_x)
        top = margin_y + row * (cell_height + gap_y)
        draw_control(
            draw,
            (left, top, left + cell_width, top + cell_height),
            control,
            accent,
            text,
            muted,
            line,
        )

    draw.line((48, HEIGHT - 45, WIDTH - 48, HEIGHT - 45), fill=line, width=2)
    draw.text(
        (48, HEIGHT - 34),
        "DUST '87 by Lumina.Aerospace  |  Documentation preview, not tested on MPC hardware",
        fill=muted,
        font=font(13),
    )
    return image


def main():
    global UI
    UI = json.loads(UI_PATH.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rendered = []

    for page in UI["pages"]:
        image = render_page(page, UI.get("style", {}))
        filename = page["name"].lower() + "-layout.png"
        image.save(OUTPUT / filename, optimize=True)
        rendered.append((page["name"], image.copy()))

    thumb_width = 560
    thumb_height = round(HEIGHT * thumb_width / WIDTH)
    gap = 20
    columns = 3
    rows = (len(rendered) + columns - 1) // columns
    contact = Image.new(
        "RGB",
        (columns * thumb_width + (columns + 1) * gap, rows * (thumb_height + 34) + (rows + 1) * gap),
        "#101113",
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
    print(f"Rendered {len(rendered)} page previews to {OUTPUT}")


if __name__ == "__main__":
    main()
