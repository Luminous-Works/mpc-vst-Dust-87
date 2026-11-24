#!/usr/bin/env python3
"""Generate the DUST '87 touch-screen skin assets used by the MPC SDK build."""

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PAGE_SIZE = (1280, 628)
SCALE = 3
ACCENTS = {
    "mix": ("#F5A623", "#22D3EE", "MASTER / OUTPUT"),
    "kick": ("#F5A623", "#34D399", "KICK / TRANSIENT"),
    "snare": ("#FB7185", "#F5A623", "SNARE / BODY"),
    "toms": ("#34D399", "#22D3EE", "TOMS / PITCH"),
    "perc": ("#22D3EE", "#A78BFA", "PERC / MOTION"),
    "more": ("#A78BFA", "#FB7185", "GLOBAL / ROUTING"),
}
SLOTS = [(23 + column * 320, 45 + row * 150) for row in range(4) for column in range(4)]
PARTICLE_COLORS = ("#ffb020", "#22d3ee", "#fb7185", "#4ade80", "#a78bfa")


def color(hex_color, alpha=255):
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def font(size, bold=False):
    candidates = (
        ["Arial Bold.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
        if bold else ["Arial.ttf", "arial.ttf", "DejaVuSans.ttf"]
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def vertical_gradient(size, top, bottom):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    for y in range(size[1]):
        amount = y / max(1, size[1] - 1)
        row = tuple(
            round(top[index] + (bottom[index] - top[index]) * amount)
            for index in range(4)
        )
        draw.line((0, y, size[0], y), fill=row)
    return image


def metallic_circle(radius):
    diameter = radius * 2
    stops = (
        (0.0, (248, 250, 252)),
        (0.28, (148, 163, 184)),
        (0.5, (226, 232, 240)),
        (0.76, (100, 116, 139)),
        (1.0, (203, 213, 225)),
    )
    metal = Image.new("RGBA", (diameter, diameter))
    pixels = metal.load()
    for y in range(diameter):
        for x in range(diameter):
            position = (x + y) / max(1, 2 * (diameter - 1))
            for index in range(len(stops) - 1):
                start, start_color = stops[index]
                end, end_color = stops[index + 1]
                if position <= end:
                    amount = (position - start) / (end - start)
                    rgb = tuple(
                        round(start_color[channel] + (end_color[channel] - start_color[channel]) * amount)
                        for channel in range(3)
                    )
                    pixels[x, y] = (*rgb, 255)
                    break
    mask = Image.new("L", metal.size)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    metal.putalpha(mask)
    return metal


def beveled_panel(image, box, radius=9):
    left, top, right, bottom = box
    width, height = right - left, bottom - top
    shadow = Image.new("RGBA", image.size)
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left, top + 3, right, bottom + 3),
        radius=radius,
        fill=(0, 0, 0, 160),
    )
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(3)))

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box,
        radius=radius,
        fill=(76, 88, 101, 255),
        outline=(163, 176, 189, 255),
        width=1,
    )
    inner = (left + 2, top + 2, right - 2, bottom - 2)
    fill = vertical_gradient(
        (width - 4, height - 4),
        (39, 49, 61, 255),
        (17, 23, 32, 255),
    )
    mask = Image.new("L", fill.size)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, fill.width - 1, fill.height - 1),
        radius=max(2, radius - 2),
        fill=255,
    )
    fill.putalpha(mask)
    image.alpha_composite(fill, (left + 2, top + 2))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(inner, radius=max(2, radius - 2), outline=(13, 18, 26, 255), width=1)
    draw.line((left + 9, top + 2, right - 9, top + 2), fill=(201, 211, 220, 190), width=1)
    draw.line((left + 9, bottom - 2, right - 9, bottom - 2), fill=(5, 9, 14, 220), width=1)


def save_knob(path, accent_hex, bipolar=False):
    size = 90
    canvas_size = size * SCALE
    accent = color(accent_hex)
    start = 135
    sweep = 270
    face_radius = 26 * SCALE
    face = metallic_circle(face_radius)
    strip = Image.new("RGBA", (size, size * 127))
    for frame in range(127):
        value = frame / 126
        image = Image.new("RGBA", (canvas_size, canvas_size))
        draw = ImageDraw.Draw(image)
        center = canvas_size // 2
        radius = 38 * SCALE
        draw.ellipse(
            (center - radius, center - radius + 3 * SCALE,
             center + radius, center + radius + 3 * SCALE),
            fill=(0, 0, 0, 95),
        )
        draw.ellipse(
            (center - radius, center - radius, center + radius, center + radius),
            fill=(28, 35, 44, 255),
            outline=(154, 168, 181, 255),
            width=2 * SCALE,
        )
        skirt_outer = 31 * SCALE
        skirt_inner = 28 * SCALE
        draw.ellipse(
            (center - skirt_outer, center - skirt_outer,
             center + skirt_outer, center + skirt_outer),
            fill=(15, 20, 27, 255),
            outline=(4, 7, 11, 255),
            width=SCALE,
        )
        for groove in range(32):
            angle = groove * 2 * math.pi / 32
            draw.line(
                (center + int(skirt_inner * math.cos(angle)),
                 center + int(skirt_inner * math.sin(angle)),
                 center + int(skirt_outer * math.cos(angle)),
                 center + int(skirt_outer * math.sin(angle))),
                fill=(92, 104, 118, 150),
                width=SCALE,
            )
        face_left = center - face_radius
        face_top = center - face_radius
        image.alpha_composite(face, (face_left, face_top))
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (face_left, face_top, center + face_radius, center + face_radius),
            outline=(241, 246, 250, 210),
            width=SCALE,
        )
        draw.arc(
            (face_left + 2 * SCALE, face_top + 2 * SCALE,
             center + face_radius - 2 * SCALE, center + face_radius - 2 * SCALE),
            195, 335, fill=(255, 255, 255, 120), width=SCALE,
        )

        track_radius = 42 * SCALE
        track_box = (
            center - track_radius, center - track_radius,
            center + track_radius, center + track_radius,
        )
        draw.arc(track_box, start, start + sweep, fill=(9, 13, 19, 255), width=3 * SCALE)
        ticks = ImageDraw.Draw(image)
        for tick in range(11):
            angle = math.radians(start + sweep * tick / 10)
            outer = 45 * SCALE
            inner_tick = 42 * SCALE
            ticks.line(
                (center + int(inner_tick * math.cos(angle)),
                 center + int(inner_tick * math.sin(angle)),
                 center + int(outer * math.cos(angle)),
                 center + int(outer * math.sin(angle))),
                fill=accent if tick <= round(value * 10) else (200, 211, 220, 150),
                width=2 * SCALE if tick in (0, 5, 10) else SCALE,
            )

        endpoint = start + sweep * value
        if bipolar:
            midpoint = start + sweep / 2
            arc_start, arc_end = sorted((midpoint, endpoint))
        else:
            arc_start, arc_end = start, endpoint
        if arc_end > arc_start:
            draw.arc(track_box, arc_start, arc_end, fill=accent, width=3 * SCALE)

        pointer_angle = math.radians(start + sweep * value)
        pointer_radius = 24 * SCALE
        pointer_end = (
            center + int(pointer_radius * math.cos(pointer_angle)),
            center + int(pointer_radius * math.sin(pointer_angle)),
        )
        draw = ImageDraw.Draw(image)
        pointer_start = (
            center + int(4 * SCALE * math.cos(pointer_angle)),
            center + int(4 * SCALE * math.sin(pointer_angle)),
        )
        draw.line((*pointer_start, *pointer_end), fill=(10, 15, 22, 255), width=3 * SCALE)
        draw.line((*pointer_start, *pointer_end), fill=accent, width=SCALE)
        frame_image = image.resize((size, size), Image.Resampling.LANCZOS)
        strip.paste(frame_image, (0, frame * size))
    strip.save(path, format="PNG", optimize=True)


def save_pulse_ring(path, accent_hex):
    size = 106
    strip = Image.new("RGBA", (size, size * 127))
    center = size * SCALE // 2
    for frame in range(127):
        strength = frame / 126
        image = Image.new("RGBA", (size * SCALE, size * SCALE))
        glow = Image.new("RGBA", image.size)
        glow_draw = ImageDraw.Draw(glow)
        radius = int((43 + strength * 3) * SCALE)
        box = (center - radius, center - radius, center + radius, center + radius)
        alpha = int(20 + 190 * strength)
        line_width = max(SCALE, int((1.1 + strength * 1.3) * SCALE))
        glow_draw.arc(box, 135, 405, fill=color(accent_hex, alpha), width=line_width)
        orbit_start = int((1 - strength) * 360)
        for offset in (0, 180):
            start_angle = (orbit_start + offset) % 360
            end_angle = start_angle + 70
            if end_angle <= 360:
                glow_draw.arc(box, start_angle, end_angle,
                              fill=color(accent_hex, min(255, alpha + 45)), width=line_width + SCALE)
            else:
                glow_draw.arc(box, start_angle, 360,
                              fill=color(accent_hex, min(255, alpha + 45)), width=line_width + SCALE)
                glow_draw.arc(box, 0, end_angle - 360,
                              fill=color(accent_hex, min(255, alpha + 45)), width=line_width + SCALE)

        inner_radius = int((40 + strength * 2) * SCALE)
        inner_box = (
            center - inner_radius, center - inner_radius,
            center + inner_radius, center + inner_radius,
        )
        glow_draw.arc(
            inner_box, 135, 405,
            fill=color(accent_hex, int(12 + 96 * strength)),
            width=max(SCALE, line_width - SCALE),
        )
        image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(3 * SCALE)))
        strip.paste(image.resize((size, size), Image.Resampling.LANCZOS), (0, frame * size))
    strip.save(path, format="PNG", optimize=True)


def save_fader(path, accent_hex):
    width, height = 248, 36
    accent = color(accent_hex)
    strip = Image.new("RGBA", (width, height * 127))
    for frame in range(127):
        value = frame / 126
        image = Image.new("RGBA", (width * SCALE, height * SCALE))
        draw = ImageDraw.Draw(image)
        center_y = height * SCALE // 2
        x_start, x_end = 10 * SCALE, (width - 10) * SCALE
        draw.rounded_rectangle(
            (x_start - SCALE, center_y - 7 * SCALE, x_end + SCALE, center_y + 7 * SCALE),
            radius=4 * SCALE,
            fill=(91, 103, 116, 255),
            outline=(177, 188, 198, 255),
            width=SCALE,
        )
        draw.rounded_rectangle(
            (x_start, center_y - 4 * SCALE, x_end, center_y + 4 * SCALE),
            radius=3 * SCALE,
            fill=(9, 14, 21, 255),
            outline=(21, 29, 39, 255),
            width=SCALE,
        )
        position = int(x_start + (x_end - x_start) * value)
        draw.rounded_rectangle(
            (x_start, center_y - 2 * SCALE, position, center_y + 2 * SCALE),
            radius=2 * SCALE,
            fill=accent,
        )
        metal_cap = vertical_gradient(
            (8 * SCALE, 22 * SCALE),
            (239, 244, 248, 255),
            (91, 105, 120, 255),
        )
        cap_mask = Image.new("L", metal_cap.size)
        ImageDraw.Draw(cap_mask).rounded_rectangle(
            (0, 0, metal_cap.width - 1, metal_cap.height - 1),
            radius=3 * SCALE,
            fill=255,
        )
        metal_cap.putalpha(cap_mask)
        image.alpha_composite(metal_cap, (position - 4 * SCALE, center_y - 11 * SCALE))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(
            (position - 4 * SCALE, center_y - 11 * SCALE,
             position + 4 * SCALE, center_y + 11 * SCALE),
            radius=3 * SCALE,
            outline=(239, 244, 248, 255),
            width=SCALE,
        )
        draw.line(
            (position - 2 * SCALE, center_y - 8 * SCALE,
             position + 2 * SCALE, center_y - 8 * SCALE),
            fill=(255, 255, 255, 230),
            width=SCALE,
        )
        strip.paste(image.resize((width, height), Image.Resampling.LANCZOS), (0, frame * height))
    strip.save(path, format="PNG", optimize=True)


def save_segments():
    for active, filename in ((False, "seg4_off.png"), (True, "seg4_on.png")):
        image = Image.new("RGBA", (58 * SCALE, 40 * SCALE))
        draw = ImageDraw.Draw(image)
        accent = color("#F5A623")
        draw.rounded_rectangle(
            (SCALE, SCALE, 57 * SCALE, 39 * SCALE),
            radius=6 * SCALE,
            fill=(48, 59, 71, 255) if not active else (87, 61, 21, 255),
            outline=(166, 179, 192, 255) if not active else (255, 202, 99, 255),
            width=SCALE,
        )
        fill = vertical_gradient(
            (54 * SCALE, 36 * SCALE),
            (61, 72, 84, 255) if not active else (122, 85, 25, 255),
            (24, 31, 40, 255) if not active else (65, 45, 17, 255),
        )
        mask = Image.new("L", fill.size)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, fill.width - 1, fill.height - 1),
            radius=5 * SCALE,
            fill=255,
        )
        fill.putalpha(mask)
        image.alpha_composite(fill, (2 * SCALE, 2 * SCALE))
        draw = ImageDraw.Draw(image)
        line_color = (194, 205, 215, 210) if not active else (255, 224, 167, 255)
        draw.line((9 * SCALE, 5 * SCALE, 49 * SCALE, 5 * SCALE), fill=line_color, width=SCALE)
        if active:
            glow = Image.new("RGBA", image.size)
            ImageDraw.Draw(glow).rounded_rectangle(
                (2 * SCALE, 2 * SCALE, 56 * SCALE, 38 * SCALE),
                radius=6 * SCALE,
                outline=color("#F5A623", 130),
                width=3 * SCALE,
            )
            image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(4 * SCALE)))
        image.resize((58, 40), Image.Resampling.LANCZOS).save(ASSETS / filename)


def save_background(name, primary_hex, secondary_hex, descriptor, active_slots):
    image = vertical_gradient(PAGE_SIZE, (115, 125, 135, 255), (41, 49, 58, 255))
    grain = Image.new("RGBA", PAGE_SIZE)
    grain_draw = ImageDraw.Draw(grain)
    rng = random.Random(name)
    for x in range(1, PAGE_SIZE[0], 3):
        shade = 7 if rng.random() > 0.5 else 3
        grain_draw.line((x, 0, x, PAGE_SIZE[1]), fill=(232, 239, 245, shade), width=1)
    image.alpha_composite(grain)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (1, 1, PAGE_SIZE[0] - 2, PAGE_SIZE[1] - 2),
        radius=13,
        outline=(220, 228, 235, 240),
        width=2,
    )
    draw.rounded_rectangle(
        (4, 4, PAGE_SIZE[0] - 5, PAGE_SIZE[1] - 5),
        radius=11,
        outline=(23, 30, 38, 255),
        width=2,
    )

    panel = vertical_gradient(
        (PAGE_SIZE[0] - 20, PAGE_SIZE[1] - 20),
        (33, 41, 52, 255),
        (18, 24, 33, 255),
    )
    panel_mask = Image.new("L", panel.size)
    ImageDraw.Draw(panel_mask).rounded_rectangle(
        (0, 0, panel.width - 1, panel.height - 1),
        radius=9,
        fill=255,
    )
    panel.putalpha(panel_mask)
    image.alpha_composite(panel, (10, 10))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (9, 9, PAGE_SIZE[0] - 10, PAGE_SIZE[1] - 10),
        radius=9,
        outline=(142, 155, 168, 220),
        width=1,
    )
    draw.line((22, 10, PAGE_SIZE[0] - 22, 10), fill=(242, 246, 249, 220), width=1)
    draw.line((10, 12, 10, PAGE_SIZE[1] - 12), fill=(187, 198, 208, 165), width=1)
    draw.line((12, PAGE_SIZE[1] - 10, PAGE_SIZE[0] - 12, PAGE_SIZE[1] - 10),
              fill=(5, 9, 14, 255), width=2)

    glow = Image.new("RGBA", PAGE_SIZE)
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-260, -260, 440, 440), fill=color(primary_hex, 34))
    glow_draw.ellipse((900, 330, 1510, 940), fill=color(secondary_hex, 26))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(95)))

    header = vertical_gradient(
        (PAGE_SIZE[0] - 24, 34),
        (66, 77, 89, 255),
        (34, 42, 52, 255),
    )
    header_mask = Image.new("L", header.size)
    ImageDraw.Draw(header_mask).rounded_rectangle(
        (0, 0, header.width - 1, header.height - 1),
        radius=5,
        fill=255,
    )
    header.putalpha(header_mask)
    image.alpha_composite(header, (12, 10))

    footer = vertical_gradient(
        (PAGE_SIZE[0] - 24, 17),
        (48, 57, 67, 255),
        (27, 34, 43, 255),
    )
    image.alpha_composite(footer, (12, PAGE_SIZE[1] - 28))

    draw = ImageDraw.Draw(image)
    for _ in range(115):
        x = rng.randrange(16, PAGE_SIZE[0] - 16)
        y = rng.randrange(42, PAGE_SIZE[1] - 30)
        radius = rng.choice((1, 1, 2))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius),
                     fill=color(rng.choice(PARTICLE_COLORS), rng.randrange(24, 76)))

    draw = ImageDraw.Draw(image)
    draw.line((22, 43, PAGE_SIZE[0] - 22, 43), fill=(145, 158, 170, 190), width=1)
    draw.line((22, 43, 142, 43), fill=color(primary_hex, 255), width=2)
    draw.text((24, 11), "DUST '87", font=font(19, bold=True), fill=(229, 236, 243, 255))
    draw.text((143, 16), "DRUM SYNTH  /  MPC INSTRUMENT", font=font(10, bold=True),
              fill=(119, 137, 154, 255))
    draw.text((PAGE_SIZE[0] - 300, 17), descriptor, font=font(11, bold=True),
              fill=color(primary_hex, 240))
    for x, y in active_slots:
        beveled_panel(image, (x, y, x + 278, y + 107))
        draw = ImageDraw.Draw(image)
        draw.line((x + 11, y + 8, x + 31, y + 8), fill=color(primary_hex, 195), width=2)

    draw.text((24, PAGE_SIZE[1] - 21), "DUST / 87     •     CUSTOM TOUCH-SCREEN SKIN",
              font=font(9, bold=True), fill=(100, 117, 134, 220))
    image.convert("RGB").save(ASSETS / f"{name}-bg.png", optimize=True)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    save_knob(ASSETS / "knob_uni.png", "#F5A623")
    save_knob(ASSETS / "knob_bi.png", "#22D3EE", bipolar=True)
    save_fader(ASSETS / "fader_h_uni.png", "#F5A623")
    save_segments()
    ui = json.loads((ROOT / "ui.json").read_text(encoding="utf-8"))
    for page in ui["pages"]:
        name = page["name"].lower()
        primary, secondary, descriptor = ACCENTS[name]
        save_pulse_ring(ASSETS / f"pulse_ring_{name}.png", primary)
        active_slots = [
            SLOTS[index]
            for index, control in enumerate(page["controls"])
            if control != "empty"
        ]
        save_background(name, primary, secondary, descriptor, active_slots)


if __name__ == "__main__":
    main()
