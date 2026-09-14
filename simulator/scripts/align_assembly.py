"""Derive fixed mounts and renderer bindings from the evaluated Blender manifest.

Never edits the Blender source. Run after changing the MJCF or exporting visuals.
"""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
import mujoco
from scipy.spatial.transform import Rotation
from tune_wheels import tune_xml

ROOT = Path(__file__).resolve().parents[1]
ROBOT = ROOT / 'public/robot'
manifest = json.loads((ROBOT / 'model-manifest.json').read_text())
objects = {o['name']: o for o in manifest['objects']}

def matrix(name):
    return np.array(objects[name]['worldMatrix'])

def rigid(m):
    result = m.copy()
    result[:3, :3] = Rotation.from_matrix(m[:3, :3]).as_matrix()
    return result

def text(values):
    return ' '.join(f'{v:.12g}' for v in values)

tune_xml(ROBOT / 'scene/kural.xml', ROBOT / 'model-manifest.json', ROBOT / 'scene/kural.xml')
tree = ET.parse(ROBOT / 'scene/kural.xml')
xml = tree.getroot()
bodies = {b.get('name'): b for b in xml.findall('.//body') if b.get('name')}
geometry = json.loads((ROBOT / 'wheel-geometry.json').read_text())
centers = [np.array(wheel['centerSourceM']) for wheel in geometry['wheels']]
center = np.mean(centers, axis=0)
forward = centers[1] - center
angle = -np.arctan2(forward[1], forward[0])
conversion = np.eye(4)
conversion[:3, :3] = Rotation.from_euler('z', angle).as_matrix()
conversion[:3, 3] = -conversion[:3, :3] @ center + [0, 0, 0.0508]

def set_pose(body, pose):
    body.set('pos', text(pose[:3, 3]))
    q = Rotation.from_matrix(pose[:3, :3]).as_quat()
    body.set('quat', text(q[[3, 0, 1, 2]]))

chassis = np.eye(4)
chassis[:3, 3] = [0, 0, 0.0508]
set_pose(bodies['chassis'], chassis)
lift_world = conversion @ rigid(matrix('CTRL_Lift_Carriage'))
lift_zero = lift_world.copy()
lift_zero[2, 3] -= 0.43
set_pose(bodies['lift_carriage'], np.linalg.inv(chassis) @ lift_zero)
# The authored carriage is upside-down in its local frame. Positive travel is
# world +Z, transformed into that body's local joint coordinates.
bodies['lift_carriage'].find('joint').set('axis', text(lift_world[:3, :3].T @ [0, 0, 1]))
set_pose(bodies['arm_mount'], np.linalg.inv(rigid(matrix('CTRL_Lift_Carriage'))) @ rigid(matrix('SO101_Mount')))

joint_bodies = {
    'shoulder_pan': 'shoulder_pan_link', 'shoulder_lift': 'shoulder_lift_link',
    'elbow_flex': 'elbow_link', 'wrist_flex': 'wrist_flex_link',
    'wrist_roll': 'wrist_roll_link', 'gripper': 'gripper_link',
}
home = {}
for joint, body_name in joint_bodies.items():
    frame = f'SO101_JointFrame_{joint}'
    parent = objects[frame]['parent']
    set_pose(bodies[body_name], np.linalg.inv(rigid(matrix(parent))) @ rigid(matrix(frame)))
    delta = np.linalg.inv(rigid(matrix(frame))) @ rigid(matrix(f'SO101_Joint_{joint}'))
    home[joint] = float(Rotation.from_matrix(delta[:3, :3]).as_rotvec()[2])

# The spine's collision frame follows the authored rail, rigidly on the chassis.
for geom in bodies['chassis'].findall('geom'):
    if geom.get('name') in ('spine_collision', 'rail_collision', 'rail_1_collision', 'rail_2_collision'):
        bodies['chassis'].remove(geom)
for index in (1, 2):
    rail = rigid(matrix(f'Kural_2040_Segment_{index}_500mm'))
    pose = np.linalg.inv(chassis) @ conversion @ rail
    geom = ET.SubElement(bodies['chassis'], 'geom', name=f'rail_{index}_collision',
        type='box', size='0.01 0.02 0.25', contype='2', conaffinity='1',
        rgba='0.2 0.7 0.9 0.15', group='3', mass='0')
    set_pose(geom, pose)

ET.indent(tree, space='  ')
tree.write(ROBOT / 'scene/kural.xml', encoding='unicode')
model = mujoco.MjModel.from_xml_path(str(ROBOT / 'scene/kural.xml'))
data = mujoco.MjData(model)
for joint, value in {**home, 'lift': 0.43}.items():
    jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, joint)
    data.qpos[model.jnt_qposadr[jid]] = value
mujoco.mj_forward(model, data)
reference = []
for index in range(model.nbody):
    name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, index)
    if name:
        reference.append(dict(name=name, position=data.xpos[index].tolist(), quaternion=data.xquat[index].tolist()))
binding = dict(schemaVersion=2, revision='kural-assembly-binding-v4',
    sourceToSimulation=conversion.tolist(), homeJoints=home, referenceBodies=reference,
    wheelCenters={str(i+1): (conversion @ np.r_[c, 1])[:3].tolist() for i,c in enumerate(centers)})
(ROBOT / 'assembly-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
print('Aligned mounts and immutable visual binding; authored joint positions:', home)
