"""Exports techniques uniquement : redimensionnement, PNG RGBA et WebP opaque.

Exécuter depuis n'importe où : uv run --with pillow python <ce fichier>.
Les dessins sont générés avec imagegen ; aucun dessin n'est synthétisé ici.
Les originaux et leur alpha sont conservés. Refuse d'écraser un export existant.
"""
from pathlib import Path
import json

from PIL import Image, ImageOps

source = Path(__file__).resolve().parent
root = source.parents[2]
public = root / "public"
jobs = [
    ("coin.face.classic", "coin-v2-original.png", "assets/coins/classic-face.png", (512, 512)),
    ("background.landscape", "landscape-original.png", "assets/backgrounds/arcade-landscape.webp", (1920, 1080)),
    ("background.portrait", "portrait-original.png", "assets/backgrounds/arcade-portrait.webp", (1080, 1920)),
]

report = []
for asset_id, original, relative, size in jobs:
    destination = public / relative
    if destination.exists():
        raise FileExistsError(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(source / original)
    if destination.suffix == ".png":
        assert image.mode == "RGBA", "La transparence doit provenir du générateur."
        image = image.resize(size, Image.Resampling.LANCZOS)
        # Réduction de palette pour tenir le budget PNG, alpha original préservé.
        alpha = image.getchannel("A")
        image = image.quantize(colors=128, method=Image.Quantize.FASTOCTREE).convert("RGBA")
        image.putalpha(alpha)
        image.save(destination, optimize=True)
    else:
        # L'écart de ratio de la sortie générée est minime ; fit garde les proportions.
        image = ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)
        image.save(destination, format="WEBP", quality=88, method=6)
    exported = Image.open(destination)
    entry = {
        "id": asset_id,
        "source": original,
        "path": relative,
        "width": exported.width,
        "height": exported.height,
        "mode": exported.mode,
        "bytes": destination.stat().st_size,
    }
    if "A" in exported.getbands():
        alpha = exported.getchannel("A")
        entry["alphaRange"] = list(alpha.getextrema())
        entry["alphaBoundingBox"] = list(alpha.getbbox())
        entry["cornerAlphas"] = [alpha.getpixel(p) for p in [(0, 0), (511, 0), (0, 511), (511, 511)]]
    report.append(entry)

(source / "export-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
