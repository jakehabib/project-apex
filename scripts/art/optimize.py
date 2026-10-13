"""Downscale generated viewer art to the resolution the game can actually show (smaller browser download).
Usage: python3 scripts/art/optimize.py   (idempotent; only shrinks images larger than the target)."""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'src/renderer/assets/generated'
TARGET = {'textures': 512, 'sprites': 512, 'icons': 384}

for folder, size in TARGET.items():
    for p in sorted((ROOT / folder).glob('*.webp')):
        im = Image.open(p)
        if max(im.size) <= size:
            continue
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(p, 'WEBP', quality=90, method=6)
        print(f'{folder}/{p.name} -> {im.size[0]}x{im.size[1]}')
