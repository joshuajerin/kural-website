"""Export the authoritative Kural Blender assembly as a browser-ready GLB.

Run through Blender so evaluated geometry, modifiers, object hierarchy, and
custom provenance fields are preserved:

    blender -b SOURCE.blend --python scripts/export_blender_assets.py -- \
      --output-root public/robot

The source .blend is opened read-only and is never saved by this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bpy


SOURCE_DEFAULT = Path(
    "/Users/joshuajerin/Documents/Codex/2026-09-12/se/outputs/"
    "XLeRobot_full_spine_arm_single_wheel.blend"
)
VERIFICATION_FILES = (
    "XLeRobot_full_spine_arm_verification.json",
    "XLeRobot_arm_single_wheel_verification.json",
    "XLeRobot_wheel_drives_verification.json",
    "XLeRobot_blue_on_green_verification.json",
)
ASSET_VERSION = "kural-assembly-v1"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_value(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if hasattr(value, "to_list"):
        return value.to_list()
    return str(value)


def matrix_rows(matrix: Any) -> list[list[float]]:
    return [[round(float(value), 9) for value in row] for row in matrix]


def object_record(obj: bpy.types.Object) -> dict[str, Any]:
    return {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "dimensionsM": [round(float(value), 9) for value in obj.dimensions],
        "worldMatrix": matrix_rows(obj.matrix_world),
        "customProperties": {
            key: json_value(value)
            for key, value in obj.items()
            if key != "_RNA_UI"
        },
    }


def args_after_separator() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE_DEFAULT)
    parser.add_argument("--output-root", type=Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def main() -> None:
    args = args_after_separator()
    source = args.source.expanduser().resolve()
    output_root = args.output_root.expanduser().resolve()
    assets_dir = output_root / "assets"
    provenance_dir = output_root / "provenance"
    assets_dir.mkdir(parents=True, exist_ok=True)
    provenance_dir.mkdir(parents=True, exist_ok=True)

    opened = Path(bpy.data.filepath).resolve()
    if opened != source:
        raise RuntimeError(f"Blender opened {opened}, expected {source}")
    if bpy.context.scene.unit_settings.system != "METRIC":
        raise RuntimeError("Authoritative scene is expected to use metric units")
    if abs(bpy.context.scene.unit_settings.scale_length - 1.0) > 1e-9:
        raise RuntimeError("Scene scale must remain 1.0; no mm-to-m conversion is applied")

    required = {
        "CTRL_Robot_Root",
        "CTRL_Lift_Carriage",
        "SO101_Mount",
        "Wheel_4in_LeKiwi_1",
        "Wheel_4in_LeKiwi_2",
        "Wheel_4in_LeKiwi_3",
        "SO101_Joint_shoulder_pan",
        "SO101_Joint_shoulder_lift",
        "SO101_Joint_elbow_flex",
        "SO101_Joint_wrist_flex",
        "SO101_Joint_wrist_roll",
        "SO101_Joint_gripper",
    }
    missing = sorted(required.difference(bpy.data.objects.keys()))
    if missing:
        raise RuntimeError(f"Required nodes are missing: {', '.join(missing)}")

    bpy.ops.object.select_all(action="DESELECT")
    exported_objects = []
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "CURVE", "EMPTY"} and not obj.hide_render:
            obj.hide_set(False)
            obj.select_set(True)
            exported_objects.append(obj)

    glb_path = assets_dir / f"{ASSET_VERSION}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_extras=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )

    source_dir = source.parent
    verification = []
    for filename in VERIFICATION_FILES:
        source_file = source_dir / filename
        if not source_file.exists():
            continue
        target = provenance_dir / filename
        shutil.copy2(source_file, target)
        verification.append(
            {
                "file": f"provenance/{filename}",
                "sourcePath": str(source_file),
                "sha256": sha256(source_file),
            }
        )

    root = bpy.data.objects["CTRL_Robot_Root"]
    wheels = [bpy.data.objects[f"Wheel_4in_LeKiwi_{index}"] for index in range(1, 4)]
    manifest = {
        "schemaVersion": 1,
        "assetVersion": ASSET_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generator": f"Blender {bpy.app.version_string}",
        "coordinateSystems": {
            "source": "Blender right-handed, Z up, metres",
            "glb": "glTF right-handed, Y up, metres",
            "mujoco": "right-handed, X forward, Y left, Z up, metres",
            "canonicalForward": "toward Wheel_4in_LeKiwi_2",
        },
        "source": {
            "path": str(source),
            "sha256": sha256(source),
            "sceneUnitSystem": bpy.context.scene.unit_settings.system,
            "sceneScaleLength": bpy.context.scene.unit_settings.scale_length,
            "physicalCalibration": root.get("Physical calibration", "UNVERIFIED"),
        },
        "visualAsset": {
            "file": f"assets/{glb_path.name}",
            "sha256": sha256(glb_path),
            "bytes": glb_path.stat().st_size,
            "objectCount": len(exported_objects),
        },
        "verification": verification,
        "dimensions": {
            "wheelNominalDiameterM": 0.1016,
            "wheelEvaluatedDiametersM": [
                round(max(float(w.dimensions.x), float(w.dimensions.z)), 9) for w in wheels
            ],
            "wheelWidthAuthoredM": 0.03,
            "railSectionM": [0.02, 0.04],
            "railExposedHeightM": 1.0,
            "liftTravelM": 0.86,
            "liftAuthoredPositionM": 0.43,
            "beltTravelPerRevolutionM": 0.04,
        },
        "stableNodes": {
            "root": "CTRL_Robot_Root",
            "lift": "CTRL_Lift_Carriage",
            "armMount": "SO101_Mount",
            "wheels": [f"Wheel_4in_LeKiwi_{i}" for i in range(1, 4)],
            "armJoints": [
                "SO101_Joint_shoulder_pan",
                "SO101_Joint_shoulder_lift",
                "SO101_Joint_elbow_flex",
                "SO101_Joint_wrist_flex",
                "SO101_Joint_wrist_roll",
                "SO101_Joint_gripper",
            ],
        },
        "parameterStatus": {
            "visualGeometry": "authored",
            "wheelDiameter": "manufacturer-specified",
            "liftTravel": "authored-unverified",
            "beltConversion": "authored-unverified",
            "massInertia": "estimated",
            "actuatorLimits": "estimated",
            "contactParameters": "estimated",
        },
        "knownLimitations": [
            "Belt and teeth intersect the unchanged blue/green plate openings.",
            "The seated spine has no validated structural clamp or mounting hardware.",
            "Dynamics and actuator parameters are not physically calibrated.",
        ],
        "objects": [object_record(obj) for obj in sorted(exported_objects, key=lambda o: o.name)],
    }
    manifest_path = output_root / "model-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(exported_objects)} objects to {glb_path}")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
