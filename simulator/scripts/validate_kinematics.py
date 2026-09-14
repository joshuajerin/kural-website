#!/usr/bin/env python3
"""Compare Kural's SO-101 tool frame with the official new-calibration URDF."""

from __future__ import annotations

import math
from pathlib import Path

import mujoco
import numpy as np
from scipy.spatial.transform import Rotation


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "public/robot/scene/kural.xml"
JOINTS = ("shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll")
ORIGINS = (
    ((0.0388353, -8.97657e-9, 0.0624), (math.pi, 0.0, -math.pi)),
    ((-0.0303992, -0.0182778, -0.0542), (-math.pi / 2, -math.pi / 2, 0.0)),
    ((-0.11257, -0.028, 0.0), (0.0, 0.0, math.pi / 2)),
    ((-0.1349, 0.0052, 0.0), (0.0, 0.0, -math.pi / 2)),
    ((0.0, -0.0611, 0.0181), (math.pi / 2, 0.0486795, math.pi)),
)
TOOL_ORIGIN = ((-0.0079, -0.000218121, -0.0981274), (0.0, math.pi, 0.0))
POSES = (
    (0.0, 0.0, 0.0, 0.0, 0.0),
    (0.5, -0.7, 1.0, 0.4, -0.8),
    (-1.1, 0.8, -0.6, -0.5, 1.2),
)


def transform(xyz: tuple[float, float, float], rpy: tuple[float, float, float]) -> np.ndarray:
    result = np.eye(4)
    result[:3, :3] = Rotation.from_euler("xyz", rpy).as_matrix()
    result[:3, 3] = xyz
    return result


def expected_tool_frame(joint_values: tuple[float, ...]) -> np.ndarray:
    result = np.eye(4)
    for origin, angle in zip(ORIGINS, joint_values):
        result = result @ transform(*origin)
        rotation = np.eye(4)
        rotation[:3, :3] = Rotation.from_rotvec((0.0, 0.0, angle)).as_matrix()
        result = result @ rotation
    return result @ transform(*TOOL_ORIGIN)


def main() -> None:
    model = mujoco.MjModel.from_xml_path(str(MODEL))
    data = mujoco.MjData(model)
    mount_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "arm_mount")
    tool_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE, "tool_frame")
    worst_position_mm = 0.0
    worst_angle_deg = 0.0

    for pose in POSES:
        for name, value in zip(JOINTS, pose):
            joint_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
            data.qpos[model.jnt_qposadr[joint_id]] = value
        mujoco.mj_forward(model, data)

        world_mount = np.eye(4)
        world_mount[:3, :3] = data.xmat[mount_id].reshape(3, 3)
        world_mount[:3, 3] = data.xpos[mount_id]
        world_tool = np.eye(4)
        world_tool[:3, :3] = data.site_xmat[tool_id].reshape(3, 3)
        world_tool[:3, 3] = data.site_xpos[tool_id]
        actual = np.linalg.inv(world_mount) @ world_tool
        expected = expected_tool_frame(pose)
        position_mm = float(np.linalg.norm(actual[:3, 3] - expected[:3, 3]) * 1000)
        angle_deg = math.degrees(
            Rotation.from_matrix(actual[:3, :3].T @ expected[:3, :3]).magnitude()
        )
        worst_position_mm = max(worst_position_mm, position_mm)
        worst_angle_deg = max(worst_angle_deg, angle_deg)

    assert worst_position_mm <= 1.0, worst_position_mm
    assert worst_angle_deg <= 0.5, worst_angle_deg
    print(
        f"SO-101 tool-frame agreement: {worst_position_mm:.6f} mm, "
        f"{worst_angle_deg:.6f} deg across {len(POSES)} poses"
    )


if __name__ == "__main__":
    main()
