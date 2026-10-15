// Signed-distance glyph lighting and participating-medium transport. The live
// hero supplies the projected position, direction and depth of its wrist lamp;
// the previous video plate caller is also supported.
const vertex = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 viewport;
uniform vec2 emitter;
uniform vec2 aim;
uniform vec2 textureSize;
uniform vec4 glyphBounds;
uniform float aperture;
uniform float time;
uniform float power;
uniform float retreat;
uniform float mobile;
uniform sampler2D letters;
uniform sampler2D volumeTexture;
uniform float volumePass;
uniform float liveSource;
uniform float sourceDepth;
uniform vec3 sourceDirection;
const float HALF_DEPTH = 0.018;
const float BEVEL = 0.0025;
const float WALL = -0.075;
const float PI = 3.14159265;
float hash(vec3 p) {
  p=fract(p*0.1031); p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec4 glyph(vec2 p) {
  vec2 uv=p/viewport;
  if (uv.x<0.0 || uv.x>1.0 || uv.y<0.0 || uv.y>1.0) return vec4(1,0,0,0);
  return texture2D(letters,uv);
}
float outline(vec2 p) { return (glyph(p).r*255.0-128.0)*32.0/127.0/textureSize.y; }
// Signed distance to solid extruded, bevelled lettering. Units are hero heights.
float solid(vec3 p) {
  vec2 q=vec2(outline(p.xy)+BEVEL,abs(p.z)-HALF_DEPTH+BEVEL);
  return min(max(q.x,q.y),0.0)+length(max(q,0.0))-BEVEL;
}
vec3 normalAt(vec3 p) {
  const float e=0.0005;
  return normalize(vec3(solid(p+vec3(e,0,0))-solid(p-vec3(e,0,0)),
    solid(p+vec3(0,e,0))-solid(p-vec3(0,e,0)),
    solid(p+vec3(0,0,e))-solid(p-vec3(0,0,e))));
}
// Shadow rays intersect the actual solid, rather than offset copies of the text.
float visible(vec3 p,vec3 light) {
  vec3 delta=light-p;
  float distanceToLight=length(delta);
  vec3 direction=delta/distanceToLight;
  if (p.z>HALF_DEPTH+0.001 && direction.z>0.0) return 1.0;
  float enter=max(0.002,(-HALF_DEPTH-p.z)/direction.z);
  float leave=min(distanceToLight,(HALF_DEPTH-p.z)/direction.z);
  if (enter>leave) return 1.0;
  vec3 first=p+direction*enter;
  vec3 last=p+direction*leave;
  if (max(first.x,last.x)<glyphBounds.x || min(first.x,last.x)>glyphBounds.z ||
      max(first.y,last.y)<glyphBounds.y || min(first.y,last.y)>glyphBounds.w) return 1.0;
  float travel=enter;
  for (int i=0;i<32;i++) {
    vec3 samplePoint=p+direction*travel;
    float distanceToSolid=solid(samplePoint);
    if (distanceToSolid<0.00035) return 0.0;
    travel+=max(distanceToSolid*0.72,0.0004);
    if (travel>leave) return 1.0;
  }
  return 1.0;
}
float emission(vec3 p,vec3 light,vec3 axis) {
  vec3 delta=p-light;
  float axial=dot(delta,axis);
  float radius=length(delta-axis*axial);
  float spread=aperture+max(axial,0.0)*0.56;
  float cone=1.0-smoothstep(spread*0.66,spread,radius);
  return cone*smoothstep(-0.01,0.025,axial)/max(dot(delta,delta),0.025);
}
vec3 brdf(vec3 p,vec3 n,vec3 light,vec3 albedo,float roughness) {
  vec3 l=normalize(light-p), v=vec3(0,0,1), h=normalize(l+v);
  float nl=max(dot(n,l),0.0), nv=max(dot(n,v),0.001);
  float nh=max(dot(n,h),0.0), vh=max(dot(v,h),0.0);
  float a=roughness*roughness, a2=a*a;
  float denominator=nh*nh*(a2-1.0)+1.0;
  float distribution=a2/(PI*denominator*denominator);
  float k=(roughness+1.0)*(roughness+1.0)/8.0;
  float geometry=nl/(nl*(1.0-k)+k)*nv/(nv*(1.0-k)+k);
  vec3 fresnel=vec3(0.04)+(1.0-0.04)*pow(1.0-vh,5.0);
  vec3 specular=distribution*geometry*fresnel/max(4.0*nl*nv,0.001);
  return ((1.0-fresnel)*albedo/PI+specular)*nl;
}
vec4 integrateAir(vec2 xy,float endDepth,vec3 light,vec3 axis) {
  // Single-scattering transport through moving heterogeneous air.
  float transmission=1.0;
  vec3 scattering=vec3(0.0);
  float rayLength=0.62-endDepth;
  float stepSize=rayLength/16.0;
  float jitter=0.5;
  for (int i=0;i<16;i++) {
    vec3 q=vec3(xy,0.62-(float(i)+jitter)*stepSize);
    float density=0.055+0.095*noise(q*7.0+vec3(time*0.02,-time*0.012,0));
    float attenuation=exp(-density*stepSize);
    float cosTheta=dot(normalize(q-light),vec3(0,0,1));
    float phase=0.84/pow(1.16-0.8*cosTheta,1.5);
    // A finite extrusion blocks illumination in the volume as well as the wall.
    float shadow=1.0;
    if (q.z<-HALF_DEPTH) {
      vec3 delta=light-q;
      float t=(HALF_DEPTH-q.z)/delta.z;
      shadow=1.0-glyph(q.xy+delta.xy*t).a;
    }
    scattering+=transmission*(1.0-attenuation)*emission(q,light,axis)*shadow*phase*vec3(0.90,0.94,0.87)*power*0.34;
    transmission*=attenuation;
  }
  return vec4(scattering/(vec3(1.0)+scattering),transmission);
}
void main() {
  vec2 uv=vec2(gl_FragCoord.x/resolution.x,1.0-gl_FragCoord.y/resolution.y);
  vec2 xy=uv*viewport;
  vec3 light=vec3(emitter,mix(0.38,sourceDepth,liveSource));
  vec3 axis=normalize(mix(vec3(aim-emitter,-0.30),sourceDirection,liveSource));
  float coverage=glyph(xy).a;
  float d=outline(xy);
  float edge=max(d+BEVEL,0.0);
  float top=HALF_DEPTH-BEVEL+sqrt(max(BEVEL*BEVEL-edge*edge,0.0));
  vec3 p=vec3(xy,coverage>0.5 ? top : WALL);
  if (volumePass>0.5) {
    gl_FragColor=integrateAir(xy,p.z,light,axis);
    return;
  }
  vec3 n=coverage>0.5 ? normalAt(p) : vec3(0,0,1);
  // Chalk-white ceramic lettering and a rough charcoal receiving surface.
  vec3 albedo=mix(vec3(0.085,0.105,0.10),vec3(0.84,0.83,0.74),coverage);
  vec3 surface=vec3(0.0);
  float rotation=hash(vec3(floor(gl_FragCoord.xy),2.7))*2.0*PI;
  for (int i=0;i<6;i++) {
    float a=rotation+float(i)*2.399963;
    float r=sqrt((float(i)+0.5)/6.0)*aperture*0.42;
    vec3 sampleLight=light+vec3(0.0,cos(a)*r,sin(a)*r);
    float shadow=visible(p+n*0.001,sampleLight);
    surface+=brdf(p,n,sampleLight,albedo,mix(0.92,0.46,coverage))*
      emission(p,sampleLight,axis)*shadow/6.0;
  }
  surface*=power*4.0*vec3(1.0,0.93,0.79);
  vec4 air=texture2D(volumeTexture,vec2(uv.x,1.0-uv.y));
  vec3 scattering=air.rgb/max(vec3(0.001),vec3(1.0)-air.rgb);
  float transmission=air.a;
  float side=mix(smoothstep(glyphBounds.x-0.13,glyphBounds.x-0.025,xy.x),
    smoothstep(glyphBounds.y-0.13,glyphBounds.y-0.025,xy.y),mobile);
  float lightMask=mix(1.0,side,retreat);
  scattering*=lightMask;
  // Film grain perturbs radiance very slightly; geometry and shadows stay stable.
  float grain=(hash(vec3(floor(gl_FragCoord.xy),31.0))-0.5)*0.022;
  vec3 base=vec3(0.0027,0.0040,0.0046)*(1.0-liveSource);
  vec3 color=base+surface*transmission+scattering;
  color=max(vec3(0),color*(1.0+grain));
  color=vec3(1.0)-exp(-color*1.35);
  color=pow(color,vec3(1.0/2.2));
  // The receiving surface lives behind the copy; air blends over the video.
  float airAlpha=clamp(length(scattering)*2.0,0.0,0.28);
  float alpha=max(side,coverage);
  alpha=max(alpha,airAlpha);
  vec3 airColor=pow(vec3(1.0)-exp(-scattering/max(airAlpha,0.001)),vec3(1.0/2.2));
  color=mix(airColor,color,max(side,coverage));
  if (liveSource>0.5) {
    // The live robot stays on black. Only illuminated material and airborne
    // radiance contribute; there is no opaque rectangular backdrop.
    vec3 radiance=surface*transmission*side+scattering;
    radiance=max(vec3(0),radiance*(1.0+grain));
    vec3 mapped=pow(vec3(1.0)-exp(-radiance*1.35),vec3(1.0/2.2));
    float strength=max(mapped.r,max(mapped.g,mapped.b));
    alpha=max(coverage,clamp(strength*1.8,0.0,0.94));
    color=mapped/max(alpha,0.001);
  }
  gl_FragColor=vec4(color,alpha);
}
`;

// Two-pass chamfer distance transform for the glyph extrusion. The GPU samples
// this signed field to intersect rays with bevels and sidewalls.
function encodeSolid(mask: HTMLCanvasElement) {
  const ctx=mask.getContext("2d")!;
  const image=ctx.getImageData(0,0,mask.width,mask.height);
  const {width,height}=mask;
  const size=width*height;
  const inside=new Float32Array(size), outside=new Float32Array(size);
  for (let i=0;i<size;i++) {
    const filled=image.data[i*4+3]>127;
    inside[i]=filled ? 1e4 : 0;
    outside[i]=filled ? 0 : 1e4;
  }
  const sweep=(field: Float32Array) => {
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
      const i=y*width+x;
      if(x>0) field[i]=Math.min(field[i],field[i-1]+1);
      if(y>0) {
        field[i]=Math.min(field[i],field[i-width]+1);
        if(x>0) field[i]=Math.min(field[i],field[i-width-1]+1.4142);
        if(x+1<width) field[i]=Math.min(field[i],field[i-width+1]+1.4142);
      }
    }
    for (let y=height-1;y>=0;y--) for (let x=width-1;x>=0;x--) {
      const i=y*width+x;
      if(x+1<width) field[i]=Math.min(field[i],field[i+1]+1);
      if(y+1<height) {
        field[i]=Math.min(field[i],field[i+width]+1);
        if(x>0) field[i]=Math.min(field[i],field[i+width-1]+1.4142);
        if(x+1<width) field[i]=Math.min(field[i],field[i+width+1]+1.4142);
      }
    }
  };
  sweep(inside); sweep(outside);
  for(let i=0;i<size;i++) {
    const distance=outside[i]-inside[i];
    image.data[i*4]=Math.round(128+Math.max(-32,Math.min(32,distance))*127/32);
  }
  return image;
}

export function createHeroLightField(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Light shader failed");
    return shader;
  };
  const program = gl.createProgram()!;
  const buffer = gl.createBuffer()!;
  const texture = gl.createTexture()!;
  const airTexture = gl.createTexture()!;
  const airFramebuffer = gl.createFramebuffer()!;
  let airWidth=1, airHeight=1;
  const destroy = () => {
    gl.deleteFramebuffer(airFramebuffer); gl.deleteTexture(airTexture);
    gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
  };
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Light program failed");
  } catch { destroy(); return null; }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D,airTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D,texture);
  const locations = Object.fromEntries(["resolution","viewport","emitter","aim","aperture","time","power","retreat","mobile","letters","textureSize","glyphBounds","volumeTexture","volumePass","liveSource","sourceDepth","sourceDirection"].map(key => [key,gl.getUniformLocation(program,key)]));
  gl.uniform1i(locations.letters, 0);
  gl.uniform1i(locations.volumeTexture,1);
  return {
    measure(root: HTMLElement, video?: HTMLElement) {
      const bounds = root.getBoundingClientRect();
      const media = video?.getBoundingClientRect() || bounds;
      const copy = root.querySelector<HTMLElement>("[data-illuminated-copy]")!;
      const target = copy.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 820px)").matches;
      // Crisp type and material surfaces render independently of the softer air.
      const scale = Math.min(window.devicePixelRatio || 1,2,Math.sqrt(2100000/(bounds.width*bounds.height)));
      canvas.width = Math.max(1,Math.round(bounds.width*scale));
      canvas.height = Math.max(1,Math.round(bounds.height*scale));
      airWidth=Math.max(1,Math.round(canvas.width*0.45));
      airHeight=Math.max(1,Math.round(canvas.height*0.45));
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,airTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,airWidth,airHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,airFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,airTexture,0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.activeTexture(gl.TEXTURE0);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.uniform2f(locations.resolution,canvas.width,canvas.height);
      gl.uniform2f(locations.viewport,bounds.width/bounds.height,1);
      const fit = Math.min(media.width/750,media.height/900);
      gl.uniform2f(locations.emitter,
        (media.left-bounds.left+(mobile ? (media.width-750*fit)/2 : 0)+492*fit)/bounds.height,
        (media.top-bounds.top+(mobile ? 0 : (media.height-900*fit)/2)+462*fit)/bounds.height);
      gl.uniform2f(locations.aim,(target.left-bounds.left+target.width*0.58)/bounds.height,
        (target.top-bounds.top+target.height*0.48)/bounds.height);
      gl.uniform1f(locations.aperture,99*fit/bounds.height);
      gl.uniform1f(locations.mobile,mobile ? 1 : 0);

      // Rasterize the browser's real glyph positions, including responsive wraps.
      const mask = document.createElement("canvas");
      const typeScale=Math.min(window.devicePixelRatio || 1,2);
      mask.width=Math.ceil(bounds.width*typeScale); mask.height=Math.ceil(bounds.height*typeScale);
      gl.uniform2f(locations.textureSize,mask.width,mask.height);
      const ctx = mask.getContext("2d")!;
      ctx.scale(typeScale,typeScale);
      const heading = root.querySelector<HTMLElement>("[data-light-heading]")!;
      const font = getComputedStyle(heading);
      const headingBounds=heading.getBoundingClientRect();
      gl.uniform4f(locations.glyphBounds,(headingBounds.left-bounds.left)/bounds.height,
        (headingBounds.top-bounds.top)/bounds.height,(headingBounds.right-bounds.left)/bounds.height,
        (headingBounds.bottom-bounds.top)/bounds.height);
      ctx.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
      ctx.fillStyle = "white";
      ctx.textBaseline = "alphabetic";
      const walker = document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent || "";
        for (let index=0; index<text.length; index++) {
          const range = document.createRange();
          range.setStart(node,index); range.setEnd(node,index+1);
          const rect = range.getBoundingClientRect();
          const metrics = ctx.measureText(text[index]);
          const ascent = metrics.fontBoundingBoxAscent || parseFloat(font.fontSize)*0.8;
          const descent = metrics.fontBoundingBoxDescent || parseFloat(font.fontSize)*0.2;
          ctx.fillText(text[index],rect.left-bounds.left,
            rect.top-bounds.top+(rect.height-ascent-descent)/2+ascent);
        }
      }
      gl.bindTexture(gl.TEXTURE_2D,texture);
      const solid=encodeSolid(mask);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,solid.width,solid.height,0,gl.RGBA,gl.UNSIGNED_BYTE,solid.data);
      root.dataset.physicalType="ready";
    },
    setLight(x: number, y: number, depth: number, dx: number, dy: number, dz: number, radius: number) {
      gl.uniform1f(locations.liveSource,1);
      gl.uniform2f(locations.emitter,x,y);
      gl.uniform1f(locations.sourceDepth,depth);
      gl.uniform3f(locations.sourceDirection,dx,dy,dz);
      gl.uniform1f(locations.aperture,radius);
    },
    draw(time: number,power: number,retreat: number) {
      if (gl.isContextLost()) return;
      gl.uniform1f(locations.time,time);
      gl.uniform1f(locations.power,power);
      gl.uniform1f(locations.retreat,retreat);
      // No feedback loop: bind the glyph texture on unit 1 while writing air.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER,airFramebuffer);
      gl.viewport(0,0,airWidth,airHeight);
      gl.uniform2f(locations.resolution,airWidth,airHeight);
      gl.uniform1f(locations.volumePass,1);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.bindTexture(gl.TEXTURE_2D,airTexture);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.uniform2f(locations.resolution,canvas.width,canvas.height);
      gl.uniform1f(locations.volumePass,0);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.activeTexture(gl.TEXTURE0);
    },
    destroy,
  };
}
