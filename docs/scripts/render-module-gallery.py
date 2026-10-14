"""Render website stills from retained visual assets; never edits robot source.
Run with Blender --background --python docs/scripts/render-module-gallery.py.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
ROOT = Path(__file__).resolve().parents[2]
LOCAL = Path('/Users/joshuajerin/Desktop/jarvis/kural')
LAMP = Path('/Users/joshuajerin/.codex/visualizations/2026/10/12/kural-live-hero/robot-lamp.glb')
ASSEMBLY = LOCAL / 'kural_description/assets/source/kural-assembly-v1.glb'
PUMP = LOCAL / 'mac/cad/so101-suction-cup/motor-drive/GLB/suction_visual.glb'
GRIPPER = LOCAL / 'accessories/so101-parallel-gripper/assembly.glb'
META = json.loads((ROOT / 'public/models/kural-lamp.metadata.json').read_text())
OUT = ROOT / 'public/media/modules'
OUT.mkdir(parents=True, exist_ok=True)
POSE = {'shoulder_pan': 1.3343, 'shoulder_lift': -1.073, 'elbow_flex': -.4757, 'wrist_flex': -.4225, 'wrist_roll': -.633}
def branch(obj, ancestor):
 while obj:
  if obj == ancestor: return True
  obj = obj.parent
 return False

def area(name, location, power, size, target):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj);obj.location=location
 obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()

for kind in ['lamp','gripper','pump']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(LAMP))
 if kind == 'gripper':
  # The lamp derivative preserves the articulated arm but omits the stock
  # fingers. Replace the lamp with the custom Kural R1 gripper at the same wrist.
  for obj in list(bpy.context.scene.objects):
   if 'KuralLamp' in obj.name: bpy.data.objects.remove(obj,do_unlink=True)
  wrist=bpy.data.objects['SO101_Joint_wrist_roll']
  before=set(bpy.context.scene.objects)
  bpy.ops.import_scene.gltf(filepath=str(GRIPPER))
  for obj in set(bpy.context.scene.objects)-before:
   if obj.type != 'MESH': continue
   obj.data=obj.data.copy()
   obj.parent=wrist;obj.matrix_parent_inverse=Matrix.Identity(4)
   # SO-101 tool axis points outward along wrist-local -Z. The CAD mounting
   # datum is Z=-45.45 mm, so rotate the forward (+Z) jaws toward -Z and
   # place the mounting face on the wrist datum.
   obj.location=(0,0,-.04545);obj.rotation_mode='XYZ'
   obj.rotation_euler=(math.pi,0,0);obj.scale=(1,1,1)
   obj.name='KuralPalmGripperR1_'+obj.name
 if kind == 'pump':
  for obj in list(bpy.context.scene.objects):
   if 'KuralLamp' in obj.name: bpy.data.objects.remove(obj,do_unlink=True)
  wrist=bpy.data.objects['SO101_Joint_wrist_roll']
  before=set(bpy.context.scene.objects)
  bpy.ops.import_scene.gltf(filepath=str(PUMP))
  for obj in set(bpy.context.scene.objects)-before:
   if obj.type != 'MESH': continue
   # CAD GLB uses metres, Y-up. Blender imports it back to CAD Z-up.
   # The horn seat is Z=0; module extends along +Z. Match the lamp's
   # outward wrist convention (-Z), without modifying either source.
   obj.data=obj.data.copy(); world=obj.matrix_world.copy()
   for vert in obj.data.vertices:
    p=world @ vert.co;vert.co=(-p.x,p.y,-p.z)
   obj.parent=wrist;obj.matrix_parent_inverse=Matrix.Identity(4)
   obj.location=(0,0,0);obj.rotation_mode='XYZ';obj.rotation_euler=(0,0,0);obj.scale=(1,1,1)
   obj.name='WebsitePump_'+obj.name
 shoulder=bpy.data.objects['SO101_Joint_shoulder_pan']
 # Keep the full articulated arm and attachment, rather than isolated tools.
 for obj in list(bpy.context.scene.objects):
  if obj.type=='MESH' and not branch(obj,shoulder): bpy.data.objects.remove(obj,do_unlink=True)
 for spec in META['joints']:
  name=spec['source_joint'];obj=bpy.data.objects[spec['node']]
  base=Quaternion(spec['neutral_base_quaternion_blender_wxyz'])
  obj.rotation_mode='QUATERNION';obj.rotation_quaternion=base @ Quaternion((0,0,1),POSE[name])
 bpy.context.view_layer.update()
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 points=[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
 hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
 target=(lo+hi)/2
 camera_data=bpy.data.cameras.new('GalleryCamera');camera=bpy.data.objects.new('GalleryCamera',camera_data)
 bpy.context.scene.collection.objects.link(camera)
 camera.location=target+Vector((.68,-.95,.56))
 camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
 camera_data.type='ORTHO'
 bpy.context.view_layer.update();inv=camera.matrix_world.inverted()
 coords=[inv @ p for p in points]
 width=max(p.x for p in coords)-min(p.x for p in coords)
 height=max(p.y for p in coords)-min(p.y for p in coords)
 camera_data.ortho_scale=max(width,height*1.25)*1.30
 scene=bpy.context.scene;scene.camera=camera
 scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
 scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
 scene.world=bpy.data.worlds.new('GalleryWorld');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.86,.88,.83,1)
 scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
 area('Large softbox',target+Vector((.3,-.7,1.1)),85,.75,target)
 area('Rim softbox',target+Vector((-.65,.3,.65)),65,.6,target)
 area('Front fill',target+Vector((.7,.3,.2)),30,.5,target)
 scene.view_settings.view_transform='AgX'
 scene.render.film_transparent=True
 filename = 'gripper-r1-arm.png' if kind == 'gripper' else kind+'-arm.png'
 scene.render.filepath=str(OUT / filename)
 print('GALLERY',kind,'bounds',list(lo),list(hi),flush=True)
 bpy.ops.render.render(write_still=True)
