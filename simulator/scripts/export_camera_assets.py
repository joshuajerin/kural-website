"""Run in Blender with the saved fixed 18-inch assembly; never save that source."""
import bpy, json, hashlib, shutil, math, os
from pathlib import Path
from mathutils import Matrix, Vector
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ROBOT = ROOT / 'public/robot'
SOURCE = Path('/Users/joshuajerin/Desktop/jarvis/kural/camera_mount_18in_fixed')
WRIST = Path('/Users/joshuajerin/Downloads/Wrist_Cam_Mount_32x32_UVC_Module_SO101.stl')
ASSETS = ROBOT / 'assets'
def matrix(m): return [list(row) for row in m]
def pose(m):
    return dict(position=list(m.translation), quaternion=list(m.to_quaternion()))
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def color_material(name,color):
    material=bpy.data.materials.new(name)
    material.diffuse_color=(*color,1)
    material.use_nodes=True
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1)
    return material
def export(objects, parent, filename):
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for obj in objects:
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        mesh.transform(parent.inverted() @ obj.matrix_world)
        copy=bpy.data.objects.new(obj.name + '_camera_export', mesh)
        bpy.context.collection.objects.link(copy)
        copy.select_set(True)
        copies.append(copy)
    bpy.ops.export_scene.gltf(filepath=str(ASSETS / filename), export_format='GLB', use_selection=True)
    for obj in copies: bpy.data.objects.remove(obj, do_unlink=True)

lift=bpy.data.objects['CTRL_Lift_Carriage'].matrix_world.copy()
wrist=bpy.data.objects['SO101_Link_gripper_link'].matrix_world.copy()
follower=bpy.data.objects['SO101_gripper_link_wrist_roll_follower_so101_v1_02']
mount_world=follower.matrix_world.copy()
rig=bpy.data.objects['CAMERA_MOUNT_follows_arm_carriage']
mast_objects=[o for o in rig.children_recursive if o.type=='MESH']
mast_camera=bpy.data.objects['ARDUCAM_B0261_NAV_VIEW'].matrix_world.copy()
export(mast_objects,lift,'camera-mast-18in-v8.glb')

bpy.ops.wm.stl_import(filepath=str(WRIST))
mount=bpy.context.object
mount.name='SO101_32x32_integrated_wrist_camera_mount'
mount.data.transform(Matrix.Scale(.001,4))
mount.matrix_world=mount_world
material=color_material('Camera mount charcoal',(.06,.075,.08))
mount.data.materials.append(material)
# Measured in the STL's tilted plate frame: four M2 holes on a 27 mm square.
# The back plane is W=-37.261 mm; 3 mm spacers separate it from the PCB front.
plate_frame=mount_world @ Matrix.Rotation(math.radians(25),4,'X')
sensor_frame=plate_frame @ Matrix.Translation((.0025,.06377925,-.041061)) @ Matrix.Diagonal((-1,1,-1,1)) @ Matrix.Rotation(math.pi/2,4,'Z')
parts=[mount]
def box(name, size, position, color):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj=bpy.context.object; obj.name=name
    obj.data.transform(Matrix.Diagonal((*size,1)))
    obj.matrix_world=sensor_frame @ Matrix.Translation(position)
    mat=color_material(name,color)
    obj.data.materials.append(mat); parts.append(obj)
    return obj
def cylinder(name,radius,depth,z,color):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth)
    obj=bpy.context.object; obj.name=name
    obj.matrix_world=sensor_frame @ Matrix.Translation((0,0,z))
    mat=color_material(name,color)
    obj.data.materials.append(mat); parts.append(obj)
    return obj
def bore(obj,x,y,r,depth,z=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=depth)
    cutter=bpy.context.object; cutter.matrix_world=sensor_frame @ Matrix.Translation((x,y,z))
    modifier=obj.modifiers.new('Mounting hole','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
pcb=box('UVC_32x32_PCB_27mm_hole_pattern',(.032,.032,.0016),(0,0,0),(.02,.16,.07))
for x in [-.0135,.0135]:
    for y in [-.0135,.0135]:
        bore(pcb,x,y,.0011,.006)
        spacer=cylinder('UVC_3mm_spacer',.0021,.003,-.0023,(.2,.22,.24))
        spacer.matrix_world=sensor_frame @ Matrix.Translation((x,y,-.0023))
        bore(spacer,x,y,.00105,.008,-.0023)
        screw=cylinder('UVC_M2_screw',.0009,.0103,-.00435,(.35,.37,.4))
        screw.matrix_world=sensor_frame @ Matrix.Translation((x,y,-.00435))
        head=cylinder('UVC_M2_head',.0018,.0013,.00145,(.35,.37,.4))
        head.matrix_world=sensor_frame @ Matrix.Translation((x,y,.00145))
        nut=cylinder('UVC_M2_front_nut',.002,.0016,-.0086,(.35,.37,.4))
        nut.matrix_world=sensor_frame @ Matrix.Translation((x,y,-.0086))
        bore(nut,x,y,.001,.012,-.0086)
box('UVC_header',(.010,.0045,.004),(0,-.010,.0028),(.08,.08,.08))
cylinder('UVC_M12_barrel',.006,.018,-.011,(.018,.018,.018))
cylinder('UVC_lens_glass',.005,.001,-.0205,(.025,.08,.12))
cylinder('UVC_retainer',.007,.0044,-.003,(.05,.05,.05))
wrist_camera=sensor_frame @ Matrix.Translation((0,0,-.0212))
export(parts,wrist,'camera-wrist-so101-v9.glb')

contract={'revision':'camera-rig-v9', 'opticalConvention':'Blender/Three camera: -Z forward, +Y image up',
 'mast':{'parentBody':'lift_carriage','asset':'camera-mast-18in-v8.glb','opticalBody':'spine_camera_18in_optical',
         **pose(lift.inverted() @ mast_camera),'sourceWorldMatrix':matrix(mast_camera),'parentSourceWorldMatrix':matrix(lift),
         'lengthM':.4572,'pitchDownDegrees':65,'verticalFovDegrees':90,'sourceMeshCount':len(mast_objects)},
 'wrist':{'parentBody':'wrist_roll_link','asset':'camera-wrist-so101-v9.glb','opticalBody':'wrist_camera_optical',
          **pose(wrist.inverted() @ wrist_camera),'sourceWorldMatrix':matrix(wrist_camera),'parentSourceWorldMatrix':matrix(wrist),
          'replacesMesh':follower.name,'verticalFovDegrees':72,
          'sensorGeometry':'32x32 UVC PCB, measured 27 mm hole pattern, 25 degree tilted plate, 3 mm spacers; optics uncalibrated',
          'plateTiltDegrees':25,'pcbHolePitchM':.027,'spacerLengthM':.003,
          'plateCenterUVWm':[.0025,.06377925,-.037261], 'pcbCenterUVWm':[.0025,.06377925,-.041061]},
 'sources':[]}
for source in [SOURCE/'Camera_mast_18in_flat_holes.stl',WRIST,SOURCE/'Kural_camera_mount_18in_fixed.blend']:
    contract['sources'].append({'path':str(source),'sha256':digest(source)})
    if source.suffix=='.stl': shutil.copy2(source,ASSETS/source.name)
(ROBOT/'camera-rig.json').write_text(json.dumps(contract,indent=2)+'\n')
manifest=json.loads((ROBOT/'model-manifest.json').read_text())
manifest['cameraAssets']={'revision':contract['revision'],'manifestFile':'camera-rig.json',
 'wrist':{'visualFile':contract['wrist']['asset'],'sha256':digest(ASSETS/contract['wrist']['asset']),
          'mountFile':WRIST.name,'mountSha256':digest(WRIST),'parentBody':'wrist_roll_link',
          'status':contract['wrist']['sensorGeometry']},
 'mast':{'visualFile':contract['mast']['asset'],'sha256':digest(ASSETS/contract['mast']['asset']),
         'mountFile':'Camera_mast_18in_flat_holes.stl','mountSha256':digest(SOURCE/'Camera_mast_18in_flat_holes.stl'),
         'parentBody':'lift_carriage','overallLengthM':.4572,'pitchDownDegrees':65}}
(ROBOT/'model-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
tree=ET.parse(ROBOT/'scene/kural.xml')
for parent in tree.iter():
    for child in list(parent):
        if child.tag=='body' and child.get('name') in ['wrist_camera_mount','spine_camera_mount_18in','wrist_camera_optical','spine_camera_18in_optical']:
            parent.remove(child)
bodies={b.get('name'):b for b in tree.findall('.//body')}
for key in ['wrist','mast']:
    spec=contract[key]
    ET.SubElement(bodies[spec['parentBody']],'body',name=spec['opticalBody'],
      pos=' '.join(map(str,spec['position'])),quat=' '.join(map(str,spec['quaternion'])))
ET.indent(tree,space='  ')
tree.write(ROBOT/'scene/kural.xml',encoding='unicode')
if os.environ.get('KURAL_CAMERA_BLEND'):
    follower.hide_render=True;follower.hide_set(True)
    for obj in parts:
        world=obj.matrix_world.copy();obj.parent=bpy.data.objects['SO101_Link_gripper_link'];obj.matrix_world=world
    bpy.ops.object.camera_add()
    camera=bpy.context.object;camera.name='Camera_Wrist_Fitted_Lens';camera.matrix_world=wrist_camera
    world=camera.matrix_world.copy();camera.parent=bpy.data.objects['SO101_Link_gripper_link'];camera.matrix_world=world
    camera.data.clip_start=.001;camera.data.sensor_fit='VERTICAL';camera.data.angle=math.radians(72)
    bpy.ops.wm.save_as_mainfile(filepath=os.environ['KURAL_CAMERA_BLEND'])
print('CAMERA_EXPORT',json.dumps(contract))
