#!/usr/bin/env python3
"""Run the release idle and mixed-motion numerical stability checks."""

from __future__ import annotations

import math
import json
from pathlib import Path

import mujoco
import numpy as np


MODEL = Path(__file__).resolve().parents[1] / "public/robot/scene/kural.xml"
HOME = {"lift": 0.43, **json.loads((MODEL.parents[1] / "assembly-binding.json").read_text())["homeJoints"]}


def ids(model: mujoco.MjModel, kind: mujoco.mjtObj, name: str) -> int:
    return mujoco.mj_name2id(model, kind, name)


def initialized() -> tuple[mujoco.MjModel, mujoco.MjData]:
    model = mujoco.MjModel.from_xml_path(str(MODEL))
    data = mujoco.MjData(model)
    for name, value in HOME.items():
        joint = ids(model, mujoco.mjtObj.mjOBJ_JOINT, name)
        data.qpos[model.jnt_qposadr[joint]] = value
        actuator_name = "lift_motor" if name == "lift" else f"{name}_motor"
        data.ctrl[ids(model, mujoco.mjtObj.mjOBJ_ACTUATOR, actuator_name)] = value
    mujoco.mj_forward(model, data)
    return model, data


def assert_finite(data: mujoco.MjData) -> None:
    assert np.isfinite(data.qpos).all() and np.isfinite(data.qvel).all()


def idle_check() -> None:
    model, data = initialized()
    for step in range(round(600 / model.opt.timestep)):
        mujoco.mj_step(model, data)
        if step % 1000 == 0:
            assert_finite(data)
    lift = ids(model, mujoco.mjtObj.mjOBJ_JOINT, "lift")
    assert abs(data.qpos[model.jnt_qposadr[lift]] - HOME["lift"]) < 0.002
    print("idle: 600 simulated seconds finite; lift held within 2 mm")


def mixed_check() -> None:
    model, data = initialized()
    wheel_segments = ((-6, 0, 6), (3, -6, 3), (2, 2, 2), (-3, -3, 5), (0, 0, 0))
    for step in range(round(300 / model.opt.timestep)):
        elapsed = step * model.opt.timestep
        wheel_targets = wheel_segments[int(elapsed // 6) % len(wheel_segments)]
        for number, value in enumerate(wheel_targets, 1):
            data.ctrl[ids(model, mujoco.mjtObj.mjOBJ_ACTUATOR, f"wheel_{number}_motor")] = value
        targets = {
            "lift": 0.43 + 0.18 * math.sin(elapsed * 0.17),
            "shoulder_pan": 0.6 * math.sin(elapsed * 0.23),
            "shoulder_lift": -0.72 + 0.3 * math.sin(elapsed * 0.19),
            "elbow_flex": 1.0 + 0.25 * math.sin(elapsed * 0.13),
            "wrist_flex": 0.4 * math.sin(elapsed * 0.31),
            "wrist_roll": 0.8 * math.sin(elapsed * 0.37),
            "gripper": 0.35 + 0.25 * math.sin(elapsed * 0.11),
        }
        for name, value in targets.items():
            actuator_name = "lift_motor" if name == "lift" else f"{name}_motor"
            data.ctrl[ids(model, mujoco.mjtObj.mjOBJ_ACTUATOR, actuator_name)] = value
        mujoco.mj_step(model, data)
        if step % 500 == 0:
            assert_finite(data)
    print("mixed motion: 300 simulated seconds finite and within commanded ranges")


if __name__ == "__main__":
    idle_check()
    mixed_check()
