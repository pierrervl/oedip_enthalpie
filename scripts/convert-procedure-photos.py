#!/usr/bin/env python3
"""Convertit les HEIC du dossier Photos procédures en JPEG pour OEDIP."""
import json
import re
import sys
from pathlib import Path

from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(r"C:\Users\Pierre Raveleau\OneDrive - ETAO\Documents\ENTHALPIE\Bureau d'études\Photos procédures")
OUT = ROOT / "img" / "procedures" / "geo"
MANIFEST = ROOT / "data" / "procedure-photos-manifest.json"

QUALITY = 88
MAX_SIDE = 1920


def convert_one(src: Path, dst: Path) -> bool:
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            w, h = im.size
            if max(w, h) > MAX_SIDE:
                scale = MAX_SIDE / max(w, h)
                im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            dst.parent.mkdir(parents=True, exist_ok=True)
            im.save(dst, "JPEG", quality=QUALITY, optimize=True)
        return True
    except Exception as e:
        print(f"ERR {src.name}: {e}", file=sys.stderr)
        return False


def main():
    if not SRC.is_dir():
        print(f"Dossier source introuvable: {SRC}", file=sys.stderr)
        sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for src in sorted(SRC.iterdir()):
        if src.suffix.lower() not in (".heic", ".heif", ".jpg", ".jpeg", ".png"):
            continue
        stem = src.stem
        dst = OUT / f"{stem}.jpg"
        if src.suffix.lower() in (".jpg", ".jpeg", ".png"):
            if not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime:
                with Image.open(src) as im:
                    im.convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True)
            ok = True
        else:
            ok = convert_one(src, dst)
        if ok:
            rel = f"img/procedures/geo/{stem}.jpg"
            manifest.append({"stem": stem, "path": rel, "bytes": dst.stat().st_size})
            print(f"OK {src.name} -> {dst.name}")
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{len(manifest)} image(s) -> {OUT}")
    print(f"Manifeste : {MANIFEST}")


if __name__ == "__main__":
    main()
