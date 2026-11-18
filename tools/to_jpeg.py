"""Turn the captured PNG frames into the JPEG screenshots the entry ships.

The bounty caps each screenshot at 256 KiB, so a quality sweep picks the best quality under that
byte budget for every scene. Run from the repository root:

    python tools/to_jpeg.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots"`nCAPTURES = ROOT / "captures"
LIMIT = 262144


def main() -> None:
    for png in sorted(CAPTURES.glob("*.png")):
        img = Image.open(png).convert("RGB")
        best = None
        for quality in (92, 88, 84, 80, 76, 72, 68, 64, 60):
            out = png.with_suffix(".jpg")
            img.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
            if out.stat().st_size <= LIMIT - 2048:
                best = (quality, out.stat().st_size)
                break
        if best is None:
            raise SystemExit(f"{png.name} cannot be squeezed under {LIMIT} bytes")
        print(f"{png.name} -> {out.name}  quality={best[0]}  {best[1]} bytes")


if __name__ == "__main__":
    main()
