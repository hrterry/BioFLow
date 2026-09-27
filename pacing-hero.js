/* BioFlow hero renderer: PacingHero WebGL core and timing, adapted for this project page. */
(() => {
  const VERTEX = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FRAGMENT = String.raw`
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform float uSpread, uDensity, uDust, uAniso, uInt, uWarm, uExp;
uniform float uDir, uPosY, uDrift, uDustSize, uDustCount, uChroma, uHeight, uEdge, uAlbedo, uRay, uMulti, uAperture, uRays, uRings, uRipple, uHotW, uHotG, uSpill, uPosX, uAngle;

float hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.71,0.113,0.419)); p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y), f.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))))*43758.5453); }
// set once per fragment in main, shared by every scene() call
float gCosPit, gSinPit, gWob;
float gH;                      // active lamp's height, set before its calls
// round dust glints: nearest-point cellular field -> soft gaussian dots of varied size/brightness
// stretch > 0 motion-blurs each mote into a horizontal streak (energy-conserving: streaks dim)
float motes(vec2 p, float cell, float drift){
  vec2 g = floor(p/cell), f = fract(p/cell);
  float acc = 0.0;
  for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 h = hash2(g + o);
    vec2 c = o + h + vec2(sin(drift + h.y*6.2831)*0.35, cos(drift*0.8 + h.x*6.2831)*0.35) - f;
    float sz = (0.08 + 0.14*fract(h.x*7.31)) * uDustSize;
    float br = pow(fract(h.y*9.17), 3.0);
    float bok = step(0.955, fract(h.x*13.13 + h.y*3.7));
    sz *= mix(1.0, 3.4, bok); br *= mix(1.0, 0.16, bok);
    br *= 0.55 + 0.45*sin(drift*1.6 + h.x*37.0 + h.y*17.0);      // twinkle as motes tumble
    br *= step(fract(h.x*3.77), min(uDustCount, 1.0));
    acc += br * exp(-dot(c,c)/(sz*sz));
  }
  return acc; }

// full scene radiance for one colour channel, sampled at position p
// sprMul disperses the beam spread per channel (lens refracts blue more than red)
float scene(vec2 p, vec2 L, vec2 D, float sBase, float drift, float sprMul, float sig){
  float s = sBase * sprMul;
  vec2 v = p - L;
  float along = dot(v, D);
  float perp  = dot(v, vec2(-D.y, D.x));
  // lamp held uHeight above the plane: true 3D distance to any point on it
  float r = max(sqrt(dot(v,v) + gH*gH), 0.02);

  // angle of attack: pitch the beam axis down toward the plane. The axis leaves
  // the lamp at uHeight and dives at uAngle; distances along/off the axis are 3D
  float along3 = along*gCosPit + gH*gSinPit;
  float off2 = max(dot(v,v) + gH*gH - along3*along3, 0.0);
  along = along3;

  // finite aperture: the beam's half-width is aperture + spread*distance,
  // so it exits the lens flat and aperture-wide, then opens as a cone
  float a = uAperture;
  float mask = 0.0;
  if (along > 0.0) {
    float halfw = a + s * max(along, 0.0);
    // reflector rim ripples wobble the cutoff line (noise precomputed in main)
    halfw *= 1.0 + uRipple * 0.10 * (gWob - 0.5);
    float dw = sqrt(off2);
    // penumbra: edge blur grows with distance (extended source), plus uEdge roughness
    float soft = clamp(uEdge*0.7 + gH / max(along, 0.1) * 0.5 + 0.10, 0.0, 1.3);
    float ew = halfw * mix(0.04, 0.85, soft) + a * 0.35 * s * along / (a + along);
    mask = 1.0 - smoothstep(halfw - ew, halfw + ew, dw);
    // hotspot: the collimated core a parabolic reflector throws down the centre
    if (uHotG > 0.005) {
      float hw = halfw * max(uHotW, 0.05);
      mask *= 1.0 + uHotG * exp(-(dw*dw)/(hw*hw));
    }
    // spill: a second, wider, dimmer cone of stray light around the main beam
    if (uSpill > 0.005) {
      float sw = halfw * 2.4;
      mask += uSpill * 0.22 * (1.0 - smoothstep(sw*0.55, sw, dw)) * smoothstep(0.0, a*2.4, along);
    }
    // the lens is a glowing disc, not a wall: ease the light in over a couple of
    // aperture depths so no sharp vertical gradient shows at the lens plane
    float fin = smoothstep(0.0, a*2.4, along);
    mask *= fin * fin;
  }

  // geometric beam term only - dust density is folded in by the caller (it is
  // shared across all spectral bands and both lights, so we compute it once)
  // near field: an extended source is NOT a point - flux saturates at aperture scale
  return mask * exp(-sig * r) / (r*r + a*a*4.0) * sig;   // caller scales by that lamp's intensity
}

// dust field: broad haze + two scales of motes, drifting aimlessly like still air
// withMotes=false (outside the beam, where glints are invisible) skips the
// expensive cellular passes and returns haze only
float dustDens(vec2 p, float drift, bool withMotes){
  vec3 q = vec3(p, 0.0);
  float haze = vnoise(q*3.2 + vec3(-drift*0.4, -drift*0.15, drift*0.2))*0.6
             + vnoise(q*7.1 + vec3(drift*0.3, -drift*0.25, 1.7))*0.4;
  if (uDust < 0.005 || !withMotes) return 0.85 + 0.3*haze;
  float glint = motes(p + vec2(-drift*0.10, -drift*0.03), 0.055, drift*2.0)*3.4
              + motes(p*1.7 + vec2(drift*0.06, -drift*0.05) + 4.7, 0.10, drift*1.3)*1.6;
  float extra = clamp(uDustCount - 1.0, 0.0, 3.0);
  if (extra > 0.0) {
    glint += extra * (motes(p*1.13 + vec2(drift*0.08, -drift*0.04) + 13.7, 0.055, drift*1.7)*3.0
                    + motes(p*2.1 + vec2(-drift*0.05, drift*0.06) + 27.3, 0.10, drift*1.1)*1.4);
  }
  return 0.85 + 0.3*haze + uDust * glint;
}

uniform vec2 uLampPos[6];
uniform vec2 uLampDir[6];
uniform float uLampInt[6];
uniform float uLampPitch[6];   // per-lamp angle of attack (deg)
uniform float uLampSpr[6];     // per-lamp spread (deg)
uniform float uLampH[6];       // per-lamp height above the plane
uniform float uNLamps;
uniform float uBoost, uFlood;   // the handoff: the lamps turned up, then the light flooding to the page colour
uniform vec3 uGround;           // the page colour, display space
uniform vec3 uSkyLo, uSkyHi;     // the pale dawn sky: warm at the horizon, cool above
uniform float uDusk;            // a band of dusk colour low in the sky, pink at the foot with a pale lavender blue above it

bool litTest(vec2 p, vec2 L, vec2 D, float s){
  vec2 v = p - L;
  float al = dot(v, D)*gCosPit + gH*gSinPit;
  float off2 = dot(v,v) + gH*gH - al*al;
  float bound = (uAperture + s*2.7*max(al, 0.0)) * 2.6 + uAperture + 0.12;
  return al > 0.0 && off2 < bound*bound; }

// full radiance of one lamp at p (dust density and phase folded in by main)
vec3 beamCol(vec2 p, vec2 L1, vec2 D, float s, float drift, float ca){
  if (!litTest(p, L1, D, s)) return vec3(0.0);
  // reflector flaws in the cone's angular frame: azimuth rays + polar rings
  float streakMod = 1.0; gWob = 0.5;
  if (uRays > 0.005 || uRings > 0.005 || uRipple > 0.005) {
    vec3 A = vec3(D.x*gCosPit, D.y*gCosPit, -gSinPit);
    vec3 v3 = vec3(p - L1, -gH);
    float al = dot(v3, A);
    if (al > 0.001) {
      vec3 q3 = v3 - A*al;
      vec3 U1 = normalize(cross(A, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0));
      vec3 U2 = cross(A, U1);
      vec2 az = vec2(dot(q3, U1), dot(q3, U2)) / max(length(q3), 1e-5);
      float pol = length(q3) / max(al, 0.02) / max(s, 0.02);
      float mod = 0.0;
      if (uRays > 0.005) {
        float rays = vnoise(vec3(az*2.6 + 5.0, 3.9))*0.6 + vnoise(vec3(az*6.5 + 11.0, 7.2))*0.4;
        mod += uRays * 0.85 * (rays - 0.3);
      }
      if (uRings > 0.005) {
        float rings = vnoise(vec3(pol*9.0, 4.2, 9.1))*0.7 + vnoise(vec3(pol*21.0, 8.8, 2.3))*0.3;
        mod += uRings * 0.85 * (rings - 0.3);
      }
      streakMod = 1.0 - mod;
      if (uRipple > 0.005) gWob = vnoise(vec3(az*1.9 + 3.0, 8.3));
    }
  }
  vec3 sc = vec3(0.0);
  if (ca < 0.005 && uRay < 0.005) {
    sc = vec3(uInt * scene(p, L1, D, s, drift, 1.0, uDensity));
  } else {
    // spectral CA: per-band constants baked at authoring time
    for (int i = 0; i < 8; i++) {
      vec3 w; float t; float r4;
      if (i == 0)      { w = vec3(0.12, 0.00, 0.60); t = -0.943; r4 = 2.941; }
      else if (i == 1) { w = vec3(0.00, 0.09, 0.95); t = -0.673; r4 = 2.087; }
      else if (i == 2) { w = vec3(0.00, 0.35, 0.55); t = -0.442; r4 = 1.532; }
      else if (i == 3) { w = vec3(0.05, 0.75, 0.15); t = -0.242; r4 = 1.157; }
      else if (i == 4) { w = vec3(0.35, 0.90, 0.02); t = -0.068; r4 = 0.894; }
      else if (i == 5) { w = vec3(0.75, 0.60, 0.00); t =  0.085; r4 = 0.703; }
      else if (i == 6) { w = vec3(0.95, 0.18, 0.00); t =  0.220; r4 = 0.562; }
      else             { w = vec3(0.65, 0.03, 0.00); t =  0.341; r4 = 0.456; }
      float sprM = 1.0 + 0.055*ca*t;
      float relSig = mix(1.0, r4, uRay);
      sc += w * uInt * scene(p + (p - L1)*0.011*ca*t, L1, D, s, drift, sprM, uDensity*relSig);
    }
    sc /= vec3(2.87, 2.90, 2.27);
  }
  sc *= uAlbedo * streakMod;
  if (uMulti > 0.005) {
    float tau = uDensity * 1.6;
    float halo = uInt * scene(p, L1, D, s, drift, 2.6, uDensity*0.55);
    vec3 haloTint = mix(vec3(1.0), vec3(0.55, 0.75, 1.35), uRay);
    sc += halo * haloTint * uMulti * uAlbedo * uAlbedo * (1.0 - exp(-tau)) * 0.30;
  }
  return sc; }


void main(){
  // world: metres. Frame is ~3.6 m wide.
  vec2 p = (gl_FragCoord.xy / uRes - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.0;   // y in [-1,1]
  float s = tan(radians(uSpread));
  float drift = uDrift;   // pre-integrated phase, so speed changes don't jump
  float ca = uChroma;
  float g = uAniso;
  float phase = (1.0 - g*g) / pow(1.0 + g*g, 1.5);   // side-on view, HG at cos ~ 0 (4pi folded out)

  // one lamp per text block; each culled by a conservative cone bound so a
  // pixel usually pays for at most one lamp. Pitch and spread are per lamp -
  // they tween as each light fades in
  bool anyLit = false;
  for (int li = 0; li < 6; li++) {
    if (float(li) >= uNLamps) break;
    float pit = radians(uLampPitch[li]);
    gCosPit = cos(pit); gSinPit = sin(pit);
    gH = uLampH[li];
    if (litTest(p, uLampPos[li], uLampDir[li], tan(radians(uLampSpr[li])))) anyLit = true;
  }
  float dens = dustDens(p, drift, anyLit);
  vec3 sc = vec3(0.0);
  float near = 0.0;
  for (int li = 0; li < 6; li++) {
    if (float(li) >= uNLamps) break;
    if (uLampInt[li] < 0.01) continue;
    float pit = radians(uLampPitch[li]);
    gCosPit = cos(pit); gSinPit = sin(pit);
    gH = uLampH[li];
    sc += beamCol(p, uLampPos[li], uLampDir[li], tan(radians(uLampSpr[li])), drift, ca) * uLampInt[li];
    // how near the lamps are, whichever way they point: the flood's reach beside them
    vec2 toLamp = p - uLampPos[li];
    near += uLampInt[li] / (dot(toLamp, toLamp) + 0.1);
  }
  // the same light without its dust: what the flood below is keyed on, so a
  // mote never floods ahead of the air around it
  vec3 air = sc * phase;
  sc *= dens * phase;

  // faint ambient so the frame reads as a space, not a void (reuse the dust field)
  float amb = 0.0035 + 0.0035*clamp((dens - 0.85)/0.3, 0.0, 1.0);

  vec3 tint = vec3(0.88, 0.83, 0.76);
  vec3 ambient = vec3(0.72,0.78,0.92)*0.9;
  vec3 col = sc * tint * uExp + vec3(amb)*ambient;

  col *= uBoost;
  col = aces(col);
  col = pow(col, vec3(1.0/2.2));
  // the light screened over a pale dawn sky (and, with uDusk, a band of dusk colour low in it)
  { float yy = gl_FragCoord.y / uRes.y; vec3 sky = mix(uSkyLo, uSkyHi, smoothstep(0.0, 1.0, yy));
    if (uDusk > 0.0){ vec3 dsk = mix(vec3(0.97, 0.80, 0.84), vec3(0.86, 0.86, 0.94), smoothstep(0.08, 0.34, yy)); sky = mix(sky, mix(dsk, sky, smoothstep(0.26, 0.6, yy)), uDusk); }
    col = 1.0 - (1.0 - sky) * (1.0 - col); }
  // the flood comes AFTER gamma so its target is the exact display-space page
  // colour. It follows the light: where the air is brightest turns first, and
  // the dimmer air follows; the dither fades with it - flat paper carries no grain
  float wm = 0.0;
  if (uFlood > 0.0) {
    // keyed in stops, from the ambient floor (0) to the hot core (1): the front
    // moves through the light the way an exposure does
    float lum = dot(air * tint * uExp + vec3(0.0052)*ambient, vec3(0.299, 0.587, 0.114)) + near * 0.055;
    float key = clamp((log2(lum) + 8.1) / 9.1, 0.0, 1.0);
    wm = smoothstep(0.0, 1.0, uFlood * 3.0 - 2.0 * (1.0 - key));
  }
  col = mix(col, uGround, wm);
  col += (hash(vec3(gl_FragCoord.xy, uTime)) - 0.5) * 0.006 * (1.0 - wm);
  gl_FragColor = vec4(col, 1.0);
}`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const riseCurve = v => smooth(.1, .9, v);
  const rgb = hex => new Float32Array([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));

  const STATIC = {
    uSpread: 21, uDensity: 1.05, uDust: .24, uAniso: .43, uInt: 5.4,
    uWarm: .05, uExp: 1.2012, uDustSize: .22, uDustCount: 2.4,
    uChroma: 2.25, uHeight: 0, uEdge: 0, uAlbedo: .5, uRay: .14,
    uAperture: .035, uRays: .21, uRings: .21, uRipple: .21,
    uHotW: .42, uHotG: 2.5, uAngle: 0,
    uSkyLo: rgb('#efe5d3'), uSkyHi: rgb('#c6d2da')
  };
  const BEATS = [
    { in: .66, out: 1.66 },
    { in: 1.84, out: 2.84 },
    { in: 3.02, out: 4.12 }
  ];
  const TRACK = 5.42;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  window.createPacingHeroRenderer = function createPacingHeroRenderer(canvas, hero, handoff) {
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, failIfMajorPerformanceCaveat: true }); } catch (_) {}
    if (!gl) return null;
    const program = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    const uniforms = new Map();
    for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms.set(info.name.replace('[0]', ''), { location: gl.getUniformLocation(program, info.name), type: info.type });
    }
    const setUniforms = values => Object.entries(values).forEach(([name, value]) => {
      const u = uniforms.get(name); if (!u) return;
      if (typeof value === 'number') gl.uniform1f(u.location, value);
      else if (u.type === gl.FLOAT_VEC2) gl.uniform2fv(u.location, value);
      else if (u.type === gl.FLOAT_VEC3) gl.uniform3fv(u.location, value);
      else gl.uniform1fv(u.location, value);
    });
    setUniforms(STATIC);

    const lamps = {
      position: new Float32Array(12), direction: new Float32Array(12),
      intensity: new Float32Array(6), pitch: new Float32Array(6),
      spread: new Float32Array(6), height: new Float32Array(6), count: 0
    };
    let width = 2, height = 2, fit = 1, target = 0, current = 0, started = performance.now(), frame = 0;

    const resize = () => {
      width = Math.max(2, Math.round(canvas.clientWidth));
      height = Math.max(2, Math.round(canvas.clientHeight));
      fit = lerp(.45, 1.1, clamp(width / height));
      const scale = Math.min(1, Math.sqrt(3686400 / (width * height)));
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    };
    new ResizeObserver(resize).observe(canvas); resize();

    function configure(s, rise, seconds) {
      let count = 0;
      const add = (x, y, dx, dy, intensity, pitch, spread, lampHeight) => {
        if (count >= 6) return;
        lamps.position[2 * count] = x; lamps.position[2 * count + 1] = y;
        lamps.direction[2 * count] = dx; lamps.direction[2 * count + 1] = dy;
        lamps.intensity[count] = intensity; lamps.pitch[count] = pitch;
        lamps.spread[count] = spread; lamps.height[count] = lampHeight; count++;
      };
      const ignition = Math.max(smooth(.2, 1.8, seconds), rise);
      const aspect = width / height;
      const narrow = width < 760 || aspect < .9;
      const steer = .04;
      for (let index = 0; index < BEATS.length; index++) {
        const last = index === BEATS.length - 1;
        const layout = last ? lerp(fit, 1, riseCurve(rise)) : fit;
        const xScale = lerp(.4, 1, layout);
        const hScale = lerp(.55, 1, layout);
        const powerScale = lerp(.7, 1, layout);
        const phase = .5 + (Math.max(0, BEATS[index].in + .2 - s) - Math.max(0, s - (last ? Infinity : BEATS[index].out - .2))) / .8;
        if (phase < -.4 || phase > 1.4) continue;
        const edge = phase > .5 ? .78 : .48;
        const envelope = Math.max(0, 1 - Math.abs(phase - .5) / edge);
        const eased = envelope * envelope * (3 - 2 * envelope);
        if (eased < .01) continue;
        const decay = 1 - envelope;
        const intensity = (phase > .5 ? eased * eased * eased : eased) * .62 * lerp(.6, 1, index / (BEATS.length - 1)) * powerScale * ignition;
        const pitch = phase < .5 ? 21.5 * decay : 8 * decay;
        const spread = (phase < .5 ? .52 * decay : .1 * decay) + steer;
        const lampHeight = (21 + 9 * clamp(1 - phase)) * hScale + (last ? 30 * riseCurve(rise) : 0);
        for (const x of [.28, -.28]) add(x * xScale, -1.18, 0, 1, intensity, pitch, spread, lampHeight);
      }
      const layout = narrow ? 0 : smooth(.9, 1.6, aspect);
      const sidePower = lerp(.09, .34, layout) * ignition * (1 - smooth(.28, .8, s));
      if (sidePower > .004) {
        const wobble = .025 * Math.sin(.21 * seconds);
        for (const side of [-1, 1]) {
          const angle = lerp(.1, .24, layout) + wobble * side;
          const dx = -side * Math.sin(angle), dy = Math.cos(angle);
          for (const offset of [.09, -.09]) add(side * lerp(aspect + .12, .97 * aspect, layout) + offset * dy, -1.1 - offset * dx, dx, dy, sidePower, 4, 21 * lerp(.45, .8, layout), steer + .04);
        }
      }
      lamps.intensity.fill(0, count); lamps.count = count;
    }

    function render(now) {
      current += (target - current) * .14;
      const seconds = (now - started) / 1000;
      const s = current * TRACK;
      const rect = handoff.getBoundingClientRect();
      const rise = smooth(innerHeight * 1.25, innerHeight * .45, rect.top);
      configure(s, rise, seconds);
      const multiTarget = lerp(fit, 1, riseCurve(rise));
      gl.viewport(0, 0, canvas.width, canvas.height);
      setUniforms({
        uRes: new Float32Array([canvas.width, canvas.height]), uTime: seconds, uDrift: .45 * seconds,
        uBoost: 1 + rise * rise * 3, uFlood: rise, uGround: rgb('#faf9f5'), uDusk: 0,
        uMulti: .48 * lerp(.1, 1, multiTarget), uSpill: lerp(.3, 1, multiTarget),
        uNLamps: lamps.count, uLampPos: lamps.position, uLampDir: lamps.direction,
        uLampInt: lamps.intensity, uLampPitch: lamps.pitch, uLampSpr: lamps.spread, uLampH: lamps.height
      });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = requestAnimationFrame(render);
    }
    canvas.classList.add('ready');
    frame = requestAnimationFrame(render);
    return { setProgress(value) { target = clamp(value); }, destroy() { cancelAnimationFrame(frame); } };
  };
})();