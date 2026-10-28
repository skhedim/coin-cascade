"""Conditionnement des dessins imagegen : taille, placement UV, compression PNG.

uv run --with pillow python assets/source/ART-002-decal-mur-et-piece-doree/export-assets.py
Ne dessine aucun motif. Préserve l'alpha du générateur et refuse les exports existants.
"""
from pathlib import Path
import hashlib
import json
import math

from PIL import Image

source = Path(__file__).resolve().parent
root = source.parents[2]
manifest = json.loads((root / "assets/manifest.json").read_text())
jobs = [
    ("cabinet.front-decal", "decal-v3-original.png"),
    ("coin.face.gold", "gold-original.png"),
]
reports = []
for asset_id, original in jobs:
    asset = next(a for a in manifest["assets"] if a["id"] == asset_id)
    target = root / "public" / asset["path"]
    if target.exists():
        raise FileExistsError(target)
    image = Image.open(source / original)
    assert image.mode == "RGBA", "Alpha réel du générateur requis."
    if asset_id == "cabinet.front-decal":
        # Réduction uniforme de 3,125 % pour placer les pointes dans la zone sûre.
        scaled = image.resize((1984, 744), Image.Resampling.LANCZOS)
        image = Image.new("RGBA", (2048, 768), (0, 0, 0, 0))
        image.paste(scaled, (32, 0))  # copie RGBA, sans double multiplication d'alpha
    else:
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
    alpha = image.getchannel("A")
    # Comme ART-001, réduction de palette tout en conservant l'alpha séparément.
    image = image.quantize(colors=128, method=Image.Quantize.FASTOCTREE).convert("RGBA")
    image.putalpha(alpha)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, optimize=True)
    assert target.stat().st_size <= asset["maxBytes"], "Budget PNG dépassé"
    record = {
        "id": asset_id,
        "source": original,
        "path": str(target.relative_to(root)),
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "bytes": target.stat().st_size,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "alphaRange": list(alpha.getextrema()),
        "visibleAlphaBoundingBox": list(alpha.point(lambda a: 255 if a >= 6 else 0).getbbox()),
        "cornerAlphas": [alpha.getpixel(p) for p in [(0, 0), (image.width-1, 0), (0, image.height-1), (image.width-1, image.height-1)]],
    }
    if asset_id == "cabinet.front-decal":
        record["bottom15PercentAlphaRange"] = list(alpha.crop((0, 652, 2048, 768)).getextrema())
        record["belowSafeZoneAlphaRange"] = list(alpha.crop((0, 460, 2048, 768)).getextrema())
    else:
        samples = [alpha.getpixel((round(255.5+225*math.cos(i*math.pi/180)), round(255.5+225*math.sin(i*math.pi/180)))) for i in range(360)]
        record["uvBoundaryAlphaMin"] = min(samples)
    reports.append(record)

(source / "export-report.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(reports, ensure_ascii=False, indent=2))
