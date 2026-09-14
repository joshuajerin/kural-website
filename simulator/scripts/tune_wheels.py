#!/usr/bin/env python3
"""Generate and evaluate the Kural omniwheel contact model.

This script intentionally writes a separate XML file. It derives wheel poses
from the exported Blender manifest, replaces each coarse six-roller wheel with
32 freely rotating ellipsoid rollers, and can run short native MuJoCo traces.
It never constrains or teleports the chassis.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET


WHEEL_RADIUS = 0.1016 / 2
ROLLER_RADIUS = 0.0058
ROLLER_RING_RADIUS = WHEEL_RADIUS - ROLLER_RADIUS
ROLLER_COUNT = 32


def vec2_from_manifest(record: dict) -> tuple[float, float]:
    matrix = record["worldMatrix"]
    return float(matrix[0][3]), float(matrix[1][3])


def canonical_wheel_poses(manifest: dict, geometry: dict | None = None) -> list[dict]:
    if geometry is None:
        geometry = json.loads((Path(__file__).resolve().parents[1] / 'public/robot/wheel-geometry.json').read_text())
    if geometry['sourceVisualSha256'] != manifest['visualAsset']['sha256']:
        raise RuntimeError('Wheel geometry was derived from a different visual asset')
    world = [wheel['centerSourceM'] for wheel in geometry['wheels']]
    center = (sum(p[0] for p in world) / 3, sum(p[1] for p in world) / 3)
    # The exact vector from the wheel centroid to authored wheel 2 defines +X.
    forward_raw = (world[1][0] - center[0], world[1][1] - center[1])
    length = math.hypot(*forward_raw)
    forward = (forward_raw[0] / length, forward_raw[1] / length)
    left = (-forward[1], forward[0])
    result = []
    for source_index, point in enumerate(world, 1):
        relative = (point[0] - center[0], point[1] - center[1])
        x = relative[0] * forward[0] + relative[1] * forward[1]
        y = relative[0] * left[0] + relative[1] * left[1]
        axle = geometry['wheels'][source_index - 1]['axleSource']
        theta = math.atan2(axle[0] * left[0] + axle[1] * left[1], axle[0] * forward[0] + axle[1] * forward[1])
        result.append({"sourceIndex": source_index, "x": x, "y": y, "theta": theta})
    return result


def quaternion_for_radial_axis(theta: float) -> str:
    # Rotate local +Z (wheel axle) onto the radial XY vector.
    scale = math.sqrt(0.5)
    values = (scale, -math.sin(theta) * scale, math.cos(theta) * scale, 0.0)
    return " ".join(f"{value:.9f}" for value in values)


def roller_body(wheel_index: int, index: int) -> ET.Element:
    theta = 2 * math.pi * index / ROLLER_COUNT
    body = ET.Element(
        "body",
        {
            "name": f"wheel_{wheel_index}_roller_{index:02d}",
            "pos": f"{ROLLER_RING_RADIUS * math.cos(theta):.9f} "
                   f"{ROLLER_RING_RADIUS * math.sin(theta):.9f} 0",
            "euler": f"0 0 {theta:.9f}",
        },
    )
    ET.SubElement(body, "joint", {"class": "roller", "axis": "0 1 0"})
    ET.SubElement(body, "geom", {"class": "roller"})
    return body


def tune_xml(source_xml: Path, manifest_path: Path, output_xml: Path) -> list[dict]:
    manifest = json.loads(manifest_path.read_text())
    poses = canonical_wheel_poses(manifest)
    tree = ET.parse(source_xml)
    root = tree.getroot()

    roller_default = root.find("./default/default[@class='roller']")
    if roller_default is None:
        raise RuntimeError("MJCF has no roller default")
    geom_default = roller_default.find("geom")
    if geom_default is None:
        raise RuntimeError("MJCF roller default has no geom")
    # A prolate ellipsoid is rotationally symmetric around local Y. The hinge
    # uses that same axis, so lateral wheel motion rolls the passive element.
    geom_default.attrib.pop("quat", None)
    geom_default.set("type", "ellipsoid")
    geom_default.set("size", f"{ROLLER_RADIUS:.6f} 0.012000 {ROLLER_RADIUS:.6f}")
    geom_default.set("friction", "1.15 0.001 0.0001")
    # Explicit roller hinges already model rolling. Six-dimensional contact
    # adds angular friction constraints that brake those hinges, making the
    # drive motors lift/rock the chassis. Use normal + two sliding directions.
    # Priority keeps the floor's condim=4 from overriding this contact model.
    geom_default.set("condim", "3")
    geom_default.set("priority", "1")
    # Rollers overlap slightly around the ring. Give them their own contact
    # type so they contact ordinary scene geometry without colliding together.
    geom_default.set("contype", "2")
    geom_default.set("conaffinity", "1")

    # Preserve source numbering: 1 rear-left, 2 front, 3 rear-right.
    target_to_source = {1: 1, 2: 2, 3: 3}
    for target_index, source_index in target_to_source.items():
        pose = poses[source_index - 1]
        body = root.find(f".//body[@name='wheel_{target_index}_body']")
        if body is None:
            raise RuntimeError(f"Missing wheel_{target_index}_body")
        body.set("pos", f"{pose['x']:.9f} {pose['y']:.9f} 0")
        body.set("quat", quaternion_for_radial_axis(pose["theta"]))
        for child in list(body.findall("body")):
            body.remove(child)
        for roller_index in range(ROLLER_COUNT):
            body.append(roller_body(target_index, roller_index))

    ET.indent(tree, space="  ")
    output_xml.parent.mkdir(parents=True, exist_ok=True)
    tree.write(output_xml, encoding="unicode", xml_declaration=False)
    return poses


def run_trace(xml_path: Path, poses: list[dict]) -> dict:
    import mujoco
    import numpy as np

    full_model = mujoco.MjModel.from_xml_path(str(xml_path))

    # Isolate the mobile base for wheel tuning. The full authored arm currently
    # starts in collision at qpos=0; that separate model issue otherwise masks
    # wheel response with a large contact impulse. This evaluation model keeps
    # the chassis free and retains the exact wheel bodies, rollers, and motors.
    tree = ET.parse(xml_path)
    root = tree.getroot()
    world = root.find("worldbody")
    chassis = root.find(".//body[@name='chassis']")
    if world is None or chassis is None:
        raise RuntimeError("Trace model is missing worldbody or chassis")
    for child in list(world):
        if child.tag == "body" and child is not chassis:
            world.remove(child)
    for child in list(chassis):
        if child.tag == "body" and not child.get("name", "").startswith("wheel_"):
            chassis.remove(child)
        if child.tag == "geom" and child.get("name", "").startswith(("rail_", "belt_", "lift_")):
            chassis.remove(child)
    contact = root.find("contact")
    if contact is not None:
        for exclude in list(contact):
            names = {exclude.get("body1"), exclude.get("body2")}
            if any(name and not name.startswith(("chassis", "wheel_")) for name in names):
                contact.remove(exclude)
    actuator = root.find("actuator")
    if actuator is not None:
        for item in list(actuator):
            if not item.get("name", "").startswith("wheel_"):
                actuator.remove(item)
    sensor = root.find("sensor")
    if sensor is not None:
        root.remove(sensor)
    trace_path = xml_path.with_name("kural-wheel-trace.xml")
    tree.write(trace_path, encoding="unicode")

    model = mujoco.MjModel.from_xml_path(str(trace_path))
    chassis_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "chassis")
    pose_by_source = {pose["sourceIndex"]: pose for pose in poses}
    actuator_by_source = {1: "wheel_1_motor", 2: "wheel_2_motor", 3: "wheel_3_motor"}

    def chassis_pose(data):
        position = data.xpos[chassis_id].copy()
        rotation = data.xmat[chassis_id].reshape(3, 3)
        return position, math.atan2(float(rotation[1, 0]), float(rotation[0, 0]))

    def wheel_controls(vx: float, vy: float, yaw_rate: float) -> dict[str, float]:
        result = {}
        for source_index, pose in pose_by_source.items():
            theta = pose["theta"]
            rolling = (-math.sin(theta), math.cos(theta))
            contact_velocity = (vx - yaw_rate * pose["y"], vy + yaw_rate * pose["x"])
            target = -(rolling[0] * contact_velocity[0] + rolling[1] * contact_velocity[1]) / WHEEL_RADIUS
            result[actuator_by_source[source_index]] = target
        return result

    scenarios = {
        "forward": (0.12, 0.0, 0.0),
        "left": (0.0, 0.12, 0.0),
        "counterclockwise": (0.0, 0.0, 0.55),
    }
    traces = {}
    for name, command in scenarios.items():
        data = mujoco.MjData(model)
        mujoco.mj_forward(model, data)
        # Settle onto the passive rollers before measuring the command response.
        for _ in range(500):
            mujoco.mj_step(model, data)
        start_pos, start_yaw = chassis_pose(data)
        controls = wheel_controls(*command)
        for actuator_name, target in controls.items():
            actuator_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR, actuator_name)
            data.ctrl[actuator_id] = target
        for _ in range(1000):
            mujoco.mj_step(model, data)
        end_pos, end_yaw = chassis_pose(data)
        delta = end_pos - start_pos
        yaw_delta = math.atan2(math.sin(end_yaw - start_yaw), math.cos(end_yaw - start_yaw))
        if not np.isfinite(data.qpos).all() or not np.isfinite(data.qvel).all():
            raise RuntimeError(f"Non-finite state during {name} trace")
        traces[name] = {
            "command": {"vx": command[0], "vy": command[1], "yawRate": command[2]},
            "wheelRadPerSec": controls,
            "durationSeconds": 2.0,
            "deltaPositionM": [round(float(value), 6) for value in delta],
            "deltaYawRad": round(float(yaw_delta), 6),
            "maxAbsVelocity": round(float(np.max(np.abs(data.qvel))), 6),
        }
    passed = (
        traces["forward"]["deltaPositionM"][0] > 0.1
        and abs(traces["forward"]["deltaPositionM"][1]) < 0.05
        and abs(traces["forward"]["deltaYawRad"]) < 0.25
        and traces["left"]["deltaPositionM"][1] > 0.1
        and abs(traces["left"]["deltaPositionM"][0]) < 0.05
        and abs(traces["left"]["deltaYawRad"]) < 0.35
        and traces["counterclockwise"]["deltaYawRad"] > 0.6
        and math.hypot(*traces["counterclockwise"]["deltaPositionM"][:2]) < 0.05
    )
    if not passed:
        raise RuntimeError("Directional wheel trace did not meet dominance and cross-coupling bounds")
    return {
        "mujocoVersion": mujoco.__version__,
        "fullModelCompiled": True,
        "fullModelCounts": {
            "bodies": full_model.nbody,
            "joints": full_model.njnt,
            "actuators": full_model.nu,
        },
        "evaluationModel": str(trace_path),
        "evaluationScope": "free chassis and exact tuned wheels; arm/spine omitted to isolate wheel contact response",
        "passed": passed,
        "modelCounts": {"bodies": model.nbody, "joints": model.njnt, "actuators": model.nu},
        "scenarios": traces,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("public/robot/scene/kural.xml"))
    parser.add_argument("--manifest", type=Path, default=Path("public/robot/model-manifest.json"))
    parser.add_argument("--output", type=Path, default=Path("tests/generated/kural-wheel-tuned.xml"))
    parser.add_argument("--report", type=Path, default=Path("tests/generated/wheel-tuning-report.json"))
    parser.add_argument("--trace", action="store_true")
    args = parser.parse_args()
    poses = tune_xml(args.input.resolve(), args.manifest.resolve(), args.output.resolve())
    report = {"wheelRadiusM": WHEEL_RADIUS, "rollerCount": ROLLER_COUNT, "wheelPoses": poses}
    if args.trace:
        report["traces"] = run_trace(args.output.resolve(), poses)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
