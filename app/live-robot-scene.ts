import * as THREE from "three";
import { createHeroLightField } from "./hero-light-field";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

type JointSpec = { node: string; current_rotation_rad: number; source_limits: { lower: number; upper: number }; local_rotation_axis_three: number[]; neutral_base_quaternion_three_xyzw: number[] };
type Joint = { object: THREE.Object3D; axis: THREE.Vector3; base: THREE.Quaternion; angle: number; target: number; home: number; min: number; max: number };
const MODEL = "/models/kural-lamp.glb";
const META = "/models/kural-lamp.metadata.json";
// An open presentation posture. Keep the elbow extended and do most aiming at
// the wrist; the source's full mechanical range is not a useful cursor workspace.
const OPEN_POSE: Record<string, [number, number]> = {
  SO101_Joint_shoulder_pan: [1.3343, 3.4],
  SO101_Joint_shoulder_lift: [-1.0730, .14],
  SO101_Joint_elbow_flex: [-.4757, .20],
  SO101_Joint_wrist_flex: [-.4225, 2.2],
};

// A single-scattering approximation, integrated along the view ray. The cone is
// attached to the physical lamp marker; its density falls off with distance and
// aperture angle. Surface lighting/occlusion uses the actual shadow-mapped lamp.
function makeBeam() {
  const length = 3.2;
  const geometry = new THREE.CylinderGeometry(Math.tan(.42) * length, .023, length, 64, 1, false);
  geometry.translate(0, length / 2, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { source: { value: new THREE.Vector3() }, direction: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, power: { value: 0 } },
    vertexShader: `varying vec3 world; void main() { world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(world,1.); }`,
    fragmentShader: `
      varying vec3 world;
      uniform vec3 source, direction;
      uniform float time, power;
      float hash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      void main() {
        vec3 ray=normalize(world-cameraPosition);
        float farT=length(world-cameraPosition), sum=0.;
        float stepSize=farT/40.;
        float jitter=hash(vec3(gl_FragCoord.xy, floor(time*12.)));
        for(int i=0;i<40;i++) {
          vec3 p=cameraPosition+ray*((float(i)+jitter)*stepSize)-source;
          float axial=dot(p,direction);
          float radius=length(p-direction*axial);
          float aperture=max(.023,axial*.43);
          float cone=1.-smoothstep(aperture*.32,aperture,radius);
          float bounds=smoothstep(.005,.045,axial)*(1.-smoothstep(1.8,3.2,axial));
          float falloff=1./(1.+axial*axial*3.);
          float dust=.91+.09*sin(dot(p,vec3(99.,131.,71.))+time*.22);
          sum+=cone*bounds*falloff*dust*stepSize;
        }
        float phase=.7+.3*pow(max(0.,dot(ray,-direction)),3.);
        vec3 color=vec3(1.,.91,.73)*sum*.105*phase*power;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

export function mountRobotScene(root: HTMLElement, canvas: HTMLCanvasElement, lightCanvas: HTMLCanvasElement | null) {
  let disposed = false, frame = 0, active = true, loaded = false;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" }); }
  catch { root.dataset.scene = "unavailable"; return () => {}; }
  const lightField = lightCanvas ? createHeroLightField(lightCanvas) : null;
  let lastLightDraw = 0;
  let lightFailed = false;
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = null;
  renderer.autoClear = false;
  const camera = new THREE.PerspectiveCamera(34, 1, .025, 20);
  camera.position.set(0, .73, 3.1);
  camera.lookAt(0, .73, 0);
  camera.layers.enable(1);
  const rig = new THREE.Group();
  scene.add(rig);
  const ambient = new THREE.HemisphereLight(0xe8efff, 0x353024, .65);
  ambient.layers.set(1); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xf4f4f0, 3.5);
  key.position.set(-2, 3, 3); key.layers.set(1); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb3c5e0, 4);
  rim.position.set(1, 2, -2); rim.layers.set(1); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe6d8bd, .8);
  fill.position.set(3, .8, 2); fill.layers.set(1); scene.add(fill);
  const lamp = new THREE.SpotLight(0xffebc3, 9, 5, .43, .65, 2);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.camera.near = .015; lamp.shadow.camera.far = 5;
  lamp.shadow.normalBias = .001; lamp.shadow.bias = -.00015;
  lamp.layers.enable(1);
  scene.add(lamp, lamp.target);
  const beam = makeBeam(); beam.visible = !lightField; scene.add(beam);
  let robot: THREE.Group | undefined, anchor: THREE.Object3D | undefined;
  let title: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | undefined;
  let textTexture: THREE.CanvasTexture | undefined;
  const joints: Joint[] = [];
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const textPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), .25);
  const desired = new THREE.Vector3(.6, .85, -.25);
  const aim = desired.clone();
  const homeTarget = desired.clone();
  const position = new THREE.Vector3(), direction = new THREE.Vector3();
  const toward = new THREE.Vector3();
  const projectedOrigin = new THREE.Vector3(), projectedEnd = new THREE.Vector3(), projectedTarget = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const localForward = new THREE.Vector3(0, -1, 0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mobile = false, entered = false, last = 0, elapsed = 0, lastReport = 0;
  let diffuser: THREE.MeshStandardMaterial | undefined;
  let targetDirty = true;
  let lastSolveTime = -1;
  const localTip = new THREE.Vector3();

  function pointAt(x: number, y: number) {
    const rect = root.getBoundingClientRect();
    pointer.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.ray.intersectPlane(textPlane, new THREE.Vector3());
    if (hit) {
      desired.copy(hit);
      targetDirty = true;
    }
  }
  function onMove(event: PointerEvent) { if (mobile || reduced.matches) return; entered = true; pointAt(event.clientX, event.clientY); }
  root.addEventListener("pointermove", onMove, { passive: true });

  function drawTitle() {
    const heading = root.querySelector<HTMLElement>("h1");
    if (!heading) return;
    const bounds = root.getBoundingClientRect(), rect = heading.getBoundingClientRect();
    const font = getComputedStyle(heading);
    const text = document.createElement("canvas");
    const scale = Math.min(window.devicePixelRatio, 2);
    text.width = Math.ceil(rect.width * scale); text.height = Math.ceil(rect.height * scale);
    const ctx = text.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    ctx.letterSpacing = font.letterSpacing;
    ctx.textBaseline = "middle";
    ctx.textAlign = mobile ? "center" : "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(heading.textContent || "Meet Kural", mobile ? rect.width / 2 : 0, rect.height * .49);
    textTexture?.dispose();
    textTexture = new THREE.CanvasTexture(text);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    if (!title) {
      title = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({
        map: textTexture, transparent: true, alphaTest: .01, roughness: .58, metalness: .05,
        emissive: new THREE.Color(0xffffff), emissiveMap: textTexture, emissiveIntensity: .075,
        side: THREE.DoubleSide,
      }));
      title.receiveShadow = true; scene.add(title);
    } else { title.material.map = textTexture; title.material.emissiveMap = textTexture; title.material.needsUpdate = true; }
    const worldAt = (px: number, py: number) => {
      raycaster.setFromCamera(new THREE.Vector2(px / bounds.width * 2 - 1, 1 - py / bounds.height * 2), camera);
      return raycaster.ray.intersectPlane(textPlane, new THREE.Vector3())!;
    };
    const topLeft = worldAt(rect.left - bounds.left, rect.top - bounds.top);
    const bottomRight = worldAt(rect.right - bounds.left, rect.bottom - bounds.top);
    title.position.copy(topLeft).add(bottomRight).multiplyScalar(.5);
    title.scale.set(bottomRight.x - topLeft.x, topLeft.y - bottomRight.y, 1);
    title.visible = !lightField || lightFailed;
    lightField?.measure(root);
    homeTarget.copy(title.position);
    if (!entered) { desired.copy(homeTarget); targetDirty = true; }
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    const previousMobile = mobile;
    mobile = rect.width < 640;
    textPlane.constant = mobile ? 1.35 : .25;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = mobile ? 38 : 34;
    camera.position.set(0, mobile ? .68 : .73, mobile ? 3.05 : 2.85);
    camera.lookAt(0, mobile ? .68 : .73, 0);
    camera.updateProjectionMatrix();
    rig.position.set(mobile ? -.08 : -.72, mobile ? .65 : .06, 0);
    rig.scale.setScalar(mobile ? .70 : 1.14);
    rig.rotation.y = -.28;
    drawTitle();
    if (loaded && previousMobile !== mobile) {
      entered = false;
      desired.copy(homeTarget);
      targetDirty = true;
    }
    if (loaded) sync();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(root);
  void document.fonts.ready.then(() => { if (!disposed) drawTitle(); });

  function lampPose() {
    if (!anchor) return;
    anchor.getWorldPosition(position);
    anchor.getWorldQuaternion(quaternion);
    direction.copy(localForward).applyQuaternion(quaternion).normalize();
  }
  function applyJoint(joint: Joint, angle: number) {
    joint.object.quaternion.copy(joint.base).multiply(quaternion.setFromAxisAngle(joint.axis, angle));
    joint.object.updateWorldMatrix(false, true);
  }
  function aimCost() {
    lampPose();
    localTip.copy(position); rig.worldToLocal(localTip);
    // Keep the lamp outside the mast clearance radius while allowing it to swing left or right.
    if (Math.hypot(localTip.x, localTip.z) < .24) return Infinity;
    const posture = joints.reduce((sum, joint) => sum + Math.pow(joint.target - joint.home, 2), 0);
    const pointing = 1 - direction.dot(toward.copy(desired).sub(position).normalize());
    // The mobile lamp faces down; its fixed typography lighting is composed
    // separately below so aiming the model cannot black out the headline.
    if (mobile) return 1 + direction.y + posture * .0001;
    projectedOrigin.copy(position).project(camera);
    projectedEnd.copy(position).addScaledVector(direction, .25).project(camera);
    projectedTarget.copy(desired).project(camera);
    const dx = (projectedEnd.x - projectedOrigin.x) * camera.aspect;
    const dy = projectedEnd.y - projectedOrigin.y;
    const tx = (projectedTarget.x - projectedOrigin.x) * camera.aspect;
    const ty = projectedTarget.y - projectedOrigin.y;
    const lengths = Math.hypot(dx, dy) * Math.hypot(tx, ty);
    const screenError = lengths > .00001 ? 1 - (dx * tx + dy * ty) / lengths : 2;
    // What the visitor sees is the lamp's projected ray. Prefer that ray pointing
    // at the cursor, with depth alignment and open posture as secondary costs.
    return screenError + pointing * .08 + posture * .005;
  }
  function solveTarget() {
    for (const joint of joints) { joint.target = joint.home; applyJoint(joint, joint.home); }
    // Search the two aiming axes first. A single local descent could get stuck
    // facing upward when the cursor crossed from the right side to the left.
    const pan = joints[0], wrist = joints[joints.length - 1];
    let best = aimCost(), bestPan = pan.home, bestWrist = wrist.home;
    for (let p = 0; p <= 6; p++) {
      pan.target = THREE.MathUtils.lerp(pan.min, pan.max, p / 6);
      applyJoint(pan, pan.target);
      for (let w = 0; w <= 8; w++) {
        wrist.target = THREE.MathUtils.lerp(wrist.min, wrist.max, w / 8);
        applyJoint(wrist, wrist.target);
        const cost = aimCost();
        if (cost < best) { best = cost; bestPan = pan.target; bestWrist = wrist.target; }
      }
    }
    pan.target = bestPan; wrist.target = bestWrist;
    applyJoint(pan, bestPan); applyJoint(wrist, bestWrist);
    for (const step of [.18, .09, .045, .02, .01]) {
      for (let i = joints.length - 1; i >= 0; i--) {
        const joint = joints[i], previous = joint.target;
        let chosen = previous, cost = aimCost();
        for (const sign of [-1, 1]) {
          joint.target = THREE.MathUtils.clamp(previous + step * sign, joint.min, joint.max);
          applyJoint(joint, joint.target);
          const candidate = aimCost();
          if (candidate < cost) { cost = candidate; chosen = joint.target; }
        }
        joint.target = chosen; applyJoint(joint, chosen);
      }
    }

    // The solve is invisible. Render only the smoothly interpolated posture.
    for (const joint of joints) applyJoint(joint, joint.angle);
    targetDirty = false;
    aim.copy(desired);
  }
  function solve(dt: number) {
    if (!anchor) return;
    if (targetDirty && elapsed - lastSolveTime >= 1 / 30) { solveTarget(); lastSolveTime = elapsed; }
    for (const joint of joints) {
      const delta = (joint.target - joint.angle) * (1 - Math.exp(-dt * 16));
      joint.angle += THREE.MathUtils.clamp(delta, -dt * 3.5, dt * 3.5);
      applyJoint(joint, joint.angle);
    }
  }

  function tick(now: number) {
    const needsFirstFrame = loaded && root.dataset.scene === "loading";
    if (disposed || (!active && !needsFirstFrame) || document.hidden) { frame = 0; return; }
    const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60;
    last = now; elapsed += dt;
    if (loaded) {
      if (!reduced.matches) solve(dt);
      lampPose();
      if (process.env.NODE_ENV === "development" && now - lastReport > 500) {
        root.dataset.aimError = THREE.MathUtils.radToDeg(direction.angleTo(aim.clone().sub(position))).toFixed(1);
        lastReport = now;
      }
      lamp.position.copy(position).addScaledVector(direction, .014);
      lamp.target.position.copy(position).addScaledVector(direction, 3);
      const power = mobile || reduced.matches ? 1 : THREE.MathUtils.smoothstep(elapsed, .15, 1.6);
      lamp.intensity = 8 * power;
      if (diffuser) diffuser.emissiveIntensity = 2.5 * power;
      beam.position.copy(lamp.position);
      beam.quaternion.setFromUnitVectors(up, direction);
      beam.material.uniforms.source.value.copy(lamp.position);
      beam.material.uniforms.direction.value.copy(direction);
      beam.material.uniforms.time.value = mobile || reduced.matches ? 0 : elapsed;
      beam.material.uniforms.power.value = power;
      renderer.clear();
      camera.layers.set(1);
      lamp.shadow.autoUpdate = true;
      renderer.render(scene, camera);
      // Retain the physical robot shadow map while lighting the typography with
      // only the lamp. Studio fill lights must never wash out its response.
      lamp.shadow.autoUpdate = false;
      camera.layers.set(0);
      renderer.render(scene, camera);
      if (lightField && !lightFailed && (now - lastLightDraw >= 1000 / 30 || reduced.matches)) {
        const rect = root.getBoundingClientRect();
        const projected = lamp.position.clone().project(camera);
        const next = lamp.position.clone().addScaledVector(direction, .4).project(camera);
        const aspect = rect.width / rect.height;
        const heightAtText = 2 * (camera.position.z + textPlane.constant) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        if (mobile) {
          // Keep the supplied mobile composition: centered illuminated letters
          // and downward shadows, independent of the static model's wrist aim.
          const heading = homeTarget.clone().project(camera);
          const centerX = (heading.x + 1) * .5 * aspect;
          const centerY = (1 - heading.y) * .5;
          const sourceY = Math.min((1 - projected.y) * .5, centerY - .24);
          const depth = Math.max(.22, (lamp.position.z + textPlane.constant) / heightAtText);
          lightField.setLight(centerX, sourceY, depth, 0, centerY - sourceY, -depth, .048 * rig.scale.x / heightAtText);
        } else lightField.setLight(
          (projected.x + 1) * .5 * aspect, (1 - projected.y) * .5,
          Math.max(.035, (lamp.position.z + textPlane.constant) / heightAtText),
          (next.x - projected.x) * .5 * aspect, (projected.y - next.y) * .5,
          direction.z * .4 / heightAtText, .048 * rig.scale.x / heightAtText,
        );
        lightField.draw(mobile || reduced.matches ? 0 : elapsed, power * .8, 0);
        lastLightDraw = now;
      }
      // Release the page loader only after the model and lighting have rendered.
      if (root.dataset.scene === "loading") root.dataset.scene = "ready";
    }
    frame = reduced.matches && loaded ? 0 : requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); last = 0;
    if ((active || (loaded && root.dataset.scene === "loading")) && !document.hidden && !disposed) frame = requestAnimationFrame(tick);
  }
  const intersection = new IntersectionObserver(([entry]) => { active = entry.isIntersecting; sync(); }, { threshold: .02 });
  intersection.observe(root);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  const onLost = (event: Event) => { event.preventDefault(); root.dataset.scene = "unavailable"; cancelAnimationFrame(frame); };
  canvas.addEventListener("webglcontextlost", onLost);
  const onRestored = () => { if (!disposed) { root.dataset.scene = "loading"; sync(); } };
  canvas.addEventListener("webglcontextrestored", onRestored);
  const onLightLost = (event: Event) => {
    event.preventDefault();
    lightFailed = true;
    beam.visible = true;
    if (title) title.visible = true;
    if (lightCanvas) lightCanvas.style.opacity = "0";
    sync();
  };
  lightCanvas?.addEventListener("webglcontextlost", onLightLost);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const abort = new AbortController();
  void Promise.all([
    loader.loadAsync(MODEL),
    fetch(META, { signal: abort.signal }).then(response => { if (!response.ok) throw new Error("Missing robot metadata"); return response.json(); }),
  ]).then(async ([gltf, metadata]: [Awaited<ReturnType<typeof loader.loadAsync>>, { joints: JointSpec[] }]) => {
    await document.fonts.ready;
    if (disposed) { disposeObject(gltf.scene); return; }
    robot = gltf.scene;
    robot.traverse(object => {
      if ((object as THREE.Light).isLight || (object as THREE.Camera).isCamera) { object.visible = false; return; }
      if (!(object instanceof THREE.Mesh)) return;
      object.layers.set(1); object.castShadow = true; object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.max(material.roughness, .4);
          if (/diffuser/i.test(object.name)) {
            diffuser = material;
            if (material instanceof THREE.MeshPhysicalMaterial) material.transmission = 0;
            material.color.set(0xfff7df); material.emissive.set(0xffe2a1); material.emissiveIntensity = 2;
            object.castShadow = false;
          }
        }
      }
    });
    rig.add(robot);
    anchor = robot.getObjectByName("KuralLampLightAnchor");
    if (!anchor) throw new Error("The lamp attachment marker is missing");
    for (const spec of metadata.joints) {
      if (spec.node.endsWith("wrist_roll")) continue;
      const object = robot.getObjectByName(spec.node);
      if (!object) continue;
      const axis = new THREE.Vector3().fromArray(spec.local_rotation_axis_three);
      const base = new THREE.Quaternion().fromArray(spec.neutral_base_quaternion_three_xyzw);
      const [home, range] = OPEN_POSE[spec.node];
      joints.push({ object, axis, base, angle: home, target: home, home,
        min: Math.max(spec.source_limits.lower, home - range),
        max: Math.min(spec.source_limits.upper, home + range) });
    }
    resize(); rig.updateWorldMatrix(true, true);
    aim.copy(homeTarget);
    // Establish the initial composition before the canvas fades into view.
    solveTarget();
    for (const joint of joints) { joint.angle = joint.target; applyJoint(joint, joint.angle); }
    loaded = true; elapsed = 0;
    sync();
  }).catch(error => {
    if (!disposed) { root.dataset.scene = "unavailable"; console.error("Kural live scene:", error); }
  });
  resize();
  return () => {
    disposed = true; abort.abort(); cancelAnimationFrame(frame);
    resizeObserver.disconnect(); intersection.disconnect();
    root.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", sync);
    reduced.removeEventListener("change", sync);
    canvas.removeEventListener("webglcontextlost", onLost); canvas.removeEventListener("webglcontextrestored", onRestored);
    lightCanvas?.removeEventListener("webglcontextlost", onLightLost);
    lightField?.destroy(); disposeObject(scene); textTexture?.dispose(); lamp.shadow.map?.dispose(); renderer.dispose();
  };
}

function disposeObject(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
}
