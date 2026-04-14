import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ---------------------------------------------------------------------------
// GLSL — Simplex 3D noise (Stefan Gustavson / Ashima Arts, MIT)
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */`
vec3 _mod289v3(vec3 x){ return x - floor(x*(1./289.))*289.; }
vec4 _mod289v4(vec4 x){ return x - floor(x*(1./289.))*289.; }
vec4 _permute(vec4 x){ return _mod289v4(((x*34.)+1.)*x); }
vec4 _taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., 0.5, 1., 2.);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1. - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = _mod289v3(i);
  vec4 p = _permute(_permute(_permute(
    i.z + vec4(0., i1.z, i2.z, 1.))
  + i.y + vec4(0., i1.y, i2.y, 1.))
  + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = .142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7. * x_);
  vec4 x  = x_ *ns.x + ns.yyyy;
  vec4 y  = y_ *ns.x + ns.yyyy;
  vec4 h  = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.+1.;
  vec4 s1 = floor(b1)*2.+1.;
  vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = _taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.);
  m = m*m;
  return 42. * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// ---------------------------------------------------------------------------
// Sphere shaders
// ---------------------------------------------------------------------------
const sphereVert = /* glsl */`
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vWorldPos    = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const sphereFrag = /* glsl */`
${NOISE_GLSL}

uniform float uTime;
uniform vec3  uLightPos;
uniform float uLightIntensity;
uniform float uNoiseScale;
uniform float uNoiseSpeed;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  // --- multi-octave noise ---------------------------------------------
  float t = uTime * uNoiseSpeed;
  float n  = snoise(vWorldPos * uNoiseScale            + vec3(0., 0., t));
        n += .5  * snoise(vWorldPos * uNoiseScale*2.1  + vec3(0., 0., t*1.3));
        n += .25 * snoise(vWorldPos * uNoiseScale*4.3  + vec3(0., 0., t*1.7));
  n /= 1.75;
  n  = n * .5 + .5; // [0,1]

  // --- base color: near-black with faint warm undertone ---------------
  vec3 darkBase = vec3(0.040, 0.028, 0.016);  // ~#0a0704
  vec3 warmPeak = vec3(0.102, 0.071, 0.031);  // ~#1a1208
  vec3 baseColor = mix(darkBase, warmPeak, pow(n, 1.4));

  // --- diffuse + specular (Blinn-Phong) --------------------------------
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(L + V);

  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 48.0);

  vec3 lightColor = vec3(1.0, 0.92, 0.78); // slightly warm white
  vec3 lit = baseColor
    + diff * lightColor * 0.06 * uLightIntensity
    + spec * lightColor * 0.18 * uLightIntensity;

  // --- fresnel edge darkening (atmospheric falloff) --------------------
  float fresnel = 1.0 - abs(dot(N, V));
  fresnel = pow(fresnel, 2.0);
  lit *= 1.0 - fresnel * 0.75;

  gl_FragColor = vec4(lit, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Blur pass (simple 9-tap box, very subtle)
// ---------------------------------------------------------------------------
const blurShader = {
  uniforms: {
    tDiffuse:  { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBlurRadius: { value: 1.5 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2  uResolution;
    uniform float uBlurRadius;
    varying vec2 vUv;

    void main(){
      vec2 px = uBlurRadius / uResolution;
      vec4 col = vec4(0.);
      col += texture2D(tDiffuse, vUv + vec2(-px.x, -px.y));
      col += texture2D(tDiffuse, vUv + vec2(   0., -px.y));
      col += texture2D(tDiffuse, vUv + vec2( px.x, -px.y));
      col += texture2D(tDiffuse, vUv + vec2(-px.x,    0.));
      col += texture2D(tDiffuse, vUv + vec2(   0.,    0.));
      col += texture2D(tDiffuse, vUv + vec2( px.x,    0.));
      col += texture2D(tDiffuse, vUv + vec2(-px.x,  px.y));
      col += texture2D(tDiffuse, vUv + vec2(   0.,  px.y));
      col += texture2D(tDiffuse, vUv + vec2( px.x,  px.y));
      gl_FragColor = col / 9.;
    }
  `,
};

// ---------------------------------------------------------------------------
// Grain pass — per-frame animated grain, intensity modulated by luminance
// ---------------------------------------------------------------------------
const grainShader = {
  uniforms: {
    tDiffuse:       { value: null },
    uGrainIntensity: { value: 0.06 },
    uTime:          { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uGrainIntensity;
    uniform float uTime;
    varying vec2 vUv;

    // Hash — stable in screen space, animated by time
    float hash(vec2 p){
      vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main(){
      vec4 scene = texture2D(tDiffuse, vUv);

      // grain: new pattern each frame, screen-space (doesn't pan)
      float grain = hash(vUv * 1200. + fract(uTime * 1.7)) * 2. - 1.;

      // soft-light blend: bright areas reduce grain visibility
      float luma = dot(scene.rgb, vec3(.299, .587, .114));
      float weight = uGrainIntensity * (1. - luma * 0.6);

      // apply grain as additive, clamped
      vec3 col = scene.rgb + grain * weight;
      gl_FragColor = vec4(clamp(col, 0., 1.), scene.a);
    }
  `,
};

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------
export function initBackground(container) {
  // --- params (shared with Tweakpane) ------------------------------------
  const params = {
    noiseSpeed:    0.04,
    noiseScale:    0.55,
    sphereRadius:  2.8,
    sphereX:       0.0,
    sphereY:       0.05,
    lightIntensity: 1.4,
    lightX:        4.0,
    lightY:        2.5,
    lightZ:        4.5,
    blurRadius:    1.2,
    grainIntensity: 0.065,
    mouseStrength: 0.35,
  };

  // --- renderer -----------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0e0e0e, 1);
  container.appendChild(renderer.domElement);

  // --- scene / camera -----------------------------------------------------
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 4;

  // --- sphere -------------------------------------------------------------
  const geo = new THREE.SphereGeometry(params.sphereRadius, 128, 128);
  const mat = new THREE.ShaderMaterial({
    vertexShader:   sphereVert,
    fragmentShader: sphereFrag,
    uniforms: {
      uTime:          { value: 0 },
      uNoiseSpeed:    { value: params.noiseSpeed },
      uNoiseScale:    { value: params.noiseScale },
      uLightPos:      { value: new THREE.Vector3(params.lightX, params.lightY, params.lightZ) },
      uLightIntensity:{ value: params.lightIntensity },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(params.sphereX, params.sphereY, 0);
  scene.add(mesh);

  // --- post-processing ----------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const blurPass = new ShaderPass(blurShader);
  blurPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  blurPass.uniforms.uBlurRadius.value = params.blurRadius;
  composer.addPass(blurPass);

  const grainPass = new ShaderPass(grainShader);
  grainPass.uniforms.uGrainIntensity.value = params.grainIntensity;
  grainPass.renderToScreen = true;
  composer.addPass(grainPass);

  // --- mouse --------------------------------------------------------------
  const mouse    = new THREE.Vector2(0, 0);
  const mouseLerp = new THREE.Vector2(0, 0);

  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  window.addEventListener('mousemove', onMouseMove);

  // --- resize -------------------------------------------------------------
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    blurPass.uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', onResize);

  // --- animation loop -----------------------------------------------------
  const clock = new THREE.Clock();
  let rafId;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // lerp mouse position
    mouseLerp.x += (mouse.x - mouseLerp.x) * 0.04;
    mouseLerp.y += (mouse.y - mouseLerp.y) * 0.04;

    // shift light with mouse
    const s = params.mouseStrength;
    mat.uniforms.uLightPos.value.set(
      params.lightX + mouseLerp.x * s * 2,
      params.lightY - mouseLerp.y * s * 2,
      params.lightZ
    );

    // also nudge sphere position very slightly
    mesh.position.set(
      params.sphereX + mouseLerp.x * s * 0.06,
      params.sphereY - mouseLerp.y * s * 0.06,
      0
    );

    mat.uniforms.uTime.value      = elapsed;
    mat.uniforms.uNoiseSpeed.value = params.noiseSpeed;
    mat.uniforms.uNoiseScale.value = params.noiseScale;
    mat.uniforms.uLightIntensity.value = params.lightIntensity;

    grainPass.uniforms.uTime.value = elapsed;
    grainPass.uniforms.uGrainIntensity.value = params.grainIntensity;
    blurPass.uniforms.uBlurRadius.value = params.blurRadius;

    composer.render();
  }

  animate();

  // --- Tweakpane (dev only) -----------------------------------------------
  if (import.meta.env.DEV) {
    import('tweakpane').then(({ Pane }) => {
      const pane = new Pane({ title: 'Background' });

      const fNoise = pane.addFolder({ title: 'Noise', expanded: true });
      fNoise.addBinding(params, 'noiseSpeed',  { min: 0,    max: 0.3,  step: 0.001, label: 'speed' });
      fNoise.addBinding(params, 'noiseScale',  { min: 0.1,  max: 2.0,  step: 0.01,  label: 'scale' });

      const fSphere = pane.addFolder({ title: 'Sphere', expanded: true });
      fSphere.addBinding(params, 'sphereRadius', { min: 0.5, max: 6.0, step: 0.05, label: 'radius' })
        .on('change', ({ value }) => {
          mesh.geometry.dispose();
          mesh.geometry = new THREE.SphereGeometry(value, 128, 128);
        });
      fSphere.addBinding(params, 'sphereX', { min: -2, max: 2, step: 0.01, label: 'x' });
      fSphere.addBinding(params, 'sphereY', { min: -2, max: 2, step: 0.01, label: 'y' });

      const fLight = pane.addFolder({ title: 'Light', expanded: true });
      fLight.addBinding(params, 'lightIntensity', { min: 0,  max: 4,  step: 0.05, label: 'intensity' });
      fLight.addBinding(params, 'lightX',         { min: -8, max: 8,  step: 0.1,  label: 'x' });
      fLight.addBinding(params, 'lightY',         { min: -8, max: 8,  step: 0.1,  label: 'y' });
      fLight.addBinding(params, 'lightZ',         { min: 0,  max: 12, step: 0.1,  label: 'z' });

      const fPost = pane.addFolder({ title: 'Post FX', expanded: true });
      fPost.addBinding(params, 'blurRadius',    { min: 0, max: 5,    step: 0.1,   label: 'blur' });
      fPost.addBinding(params, 'grainIntensity',{ min: 0, max: 0.25, step: 0.005, label: 'grain' });

      const fMouse = pane.addFolder({ title: 'Mouse', expanded: true });
      fMouse.addBinding(params, 'mouseStrength', { min: 0, max: 1, step: 0.01, label: 'strength' });
    });
  }

  // --- cleanup ------------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    composer.dispose();
    geo.dispose();
    mat.dispose();
    container.removeChild(renderer.domElement);
  };
}
