"""Small dependency-free validation for generated robot assets and MJCF."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


EXPECTED_JOINTS = {
    "wheel_1",
    "wheel_2",
    "wheel_3",
    "lift",
    "shoulder_pan",
    "shoulder_lift",
    "elbow_flex",
    "wrist_flex",
    "wrist_roll",
    "gripper",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("public/robot"))
    args = parser.parse_args()
    root = args.root.resolve()

    manifest = json.loads((root / "model-manifest.json").read_text())
    glb = root / manifest["visualAsset"]["file"]
    assert glb.exists() and glb.stat().st_size > 100_000, "GLB is missing or unexpectedly small"
    assert len(manifest["stableNodes"]["wheels"]) == 3
    assert len(manifest["stableNodes"]["armJoints"]) == 6
    assert manifest["source"]["sceneScaleLength"] == 1.0

    tree = ET.parse(root / "scene" / "kural.xml")
    joints = {node.get("name") for node in tree.findall(".//joint") if node.get("name")}
    missing = EXPECTED_JOINTS - joints
    assert not missing, f"MJCF joints missing: {sorted(missing)}"

    actuator_joints = {
        node.get("joint")
        for node in tree.findall(".//actuator/*")
        if node.get("joint")
    }
    missing_actuators = EXPECTED_JOINTS - actuator_joints
    assert not missing_actuators, f"MJCF actuators missing: {sorted(missing_actuators)}"
    print(
        f"validated {glb.name} ({glb.stat().st_size:,} bytes), "
        f"{len(joints)} joints, {len(actuator_joints)} actuators"
    )


if __name__ == "__main__":
    main()
