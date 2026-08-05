"""Build the optimized Project Toolpath 2D art pack from source PNGs."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "assets" / "manifests" / "toolpath-2d-art-pack-v1.json"

ASSETS = [
    ("contract.drive-plate", "assets-src/2d/contracts/emergency-drive-plate-v1.png", "public/assets/2d/contracts/emergency-drive-plate-v1.webp", (960, 640), 88),
    ("contract.orbital-rib", "assets-src/2d/contracts/orbital-structural-rib-v1.png", "public/assets/2d/contracts/orbital-structural-rib-v1.webp", (960, 640), 88),
    ("contract.sensor-bracket", "assets-src/2d/contracts/sensor-bracket-v1.png", "public/assets/2d/contracts/sensor-bracket-v1.webp", (960, 640), 88),
    ("environment.night-shift-vmc", "assets-src/2d/environment/night-shift-vmc-cell-v1.png", "public/assets/2d/environment/night-shift-vmc-cell-v1.webp", (1600, 900), 86),
    ("ui.achievement-atlas", "assets-src/2d/ui/achievement-emblem-atlas-v1.png", "public/assets/2d/ui/achievement-emblem-atlas-v1.webp", (1024, 1024), 90),
]


def build() -> list[dict[str, object]]:
    records = []
    for asset_id, source_name, output_name, max_size, quality in ASSETS:
        source = ROOT / source_name
        output = ROOT / output_name
        if not source.exists():
            raise FileNotFoundError(source)
        output.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            image.save(output, "WEBP", quality=quality, method=6)
            width, height = image.size
        payload = output.read_bytes()
        records.append({
            "id": asset_id,
            "source": source_name.replace("\\", "/"),
            "path": "/" + output_name.removeprefix("public/").replace("\\", "/"),
            "width": width,
            "height": height,
            "bytes": len(payload),
            "sha256": sha256(payload).hexdigest().upper(),
        })
    return records


records = build()
manifest = {
    "id": "toolpath.2d-art-pack.v1",
    "version": 1,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceType": "original AI-assisted visual development",
    "runtimeFormat": "WebP",
    "assets": records,
    "totalBytes": sum(int(record["bytes"]) for record in records),
}
MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
