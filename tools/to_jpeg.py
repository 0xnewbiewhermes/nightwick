"""Turn the captured PNG frames into the JPEG screenshots the entry ships.

The bounty caps each screenshot at 256 KiB, so a quality sweep picks the best quality under that
byte budget for every scene. Frames are captured into captures/ and the shipped files land in
screenshots/. Run from the repository root:

    node shots.mjs
    python tools/to_jpeg.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots"
CAPTURES = ROOT / "captures"
LIMIT = 262144
# The four frames the entry ships, in the order the judge reads them (first is the cover).
SHIP = ("1-play", "2-start", "3-gift", "4-dawn")


def main() -> None:
    SHOTS.mkdir(exist_ok=True)
    for stem in SHIP:
        png = CAPTURES / f"{stem}.png"
        if not png.exists():
            raise SystemExit(f"{png} is missing: run node shots.mjs first")
        img = Image.open(png).convert("RGB")
        out = SHOTS / f"{stem}.jpg"
        best = None
        for quality in (92, 88, 84, 80, 76, 72, 68, 64, 60):
            img.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
            if out.stat().st_size <= LIMIT - 2048:
                best = (quality, out.stat().st_size)
                break
        if best is None:
            raise SystemExit(f"{png.name} cannot be squeezed under {LIMIT} bytes")
        print(f"{png.name} -> {out.name}  quality={best[0]}  {best[1]} bytes")


if __name__ == "__main__":
    main()
