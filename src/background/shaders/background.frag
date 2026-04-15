uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;

uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uSphereRadius;
uniform float uSphereSoftness;
uniform float uSphereOffsetX;
uniform float uSphereOffsetY;
uniform float uLightAngle;
uniform float uLightConcentration;
uniform sampler2D uGrainTexture;
uniform float uGrainDensity;
uniform float uGrainBrightness;
uniform float uGrainSpeed;
uniform float uMaxBrightness;
uniform float uBaseBrightness;

varying vec2 vUv;

void main() {
  vec2  uv     = vUv;
  float aspect = uResolution.x / uResolution.y;

  // --- sphere center with subtle mouse parallax ---
  vec2 center = vec2(0.5 + uSphereOffsetX + uMouse.x * 0.02,
                     0.5 + uSphereOffsetY - uMouse.y * 0.02);

  // --- aspect-corrected circle SDF ---
  vec2  diff = uv - center;
  diff.x *= aspect;
  float dist = length(diff);

  float circle = 1.0 - smoothstep(uSphereRadius - uSphereSoftness,
                                   uSphereRadius + uSphereSoftness, dist);

  // --- multi-octave simplex noise ---
  float scale = uNoiseScale;
  float speed = uNoiseSpeed;
  float n = 0.0;
  n += 0.500 * snoise(vec3(uv * scale * 3.0,  uTime * speed));
  n += 0.250 * snoise(vec3(uv * scale * 6.0,  uTime * speed * 2.0));
  n += 0.125 * snoise(vec3(uv * scale * 12.0, uTime * speed * 3.0));
  n = n * 0.5 + 0.5; // remap to ~[0,1]

  // --- offset radial light gradient ---
  vec2  lightOffset = vec2(cos(uLightAngle), sin(uLightAngle)) * 0.15;
  vec2  lightCenter = center + lightOffset;
  vec2  lightDiff   = uv - lightCenter;
  lightDiff.x *= aspect;
  float light = 1.0 - smoothstep(0.0, uSphereRadius * 1.8, length(lightDiff));
  light = pow(light, uLightConcentration);

  // --- sphere brightness (smooth base layer) ---
  float sphereBrightness = circle * n * light;
  float base = sphereBrightness * uMaxBrightness;

  // --- grain via texture (no sin-hash artifacts) ---
  // Quantize time so grain holds position, then jumps — like film frames
  float grainTime = floor(uTime * uGrainSpeed * 30.0) / 30.0;
  vec2 grainOffset = vec2(
    fract(sin(grainTime * 12.9898) * 43758.5453),
    fract(cos(grainTime * 78.233) * 43758.5453)
  );
  vec2 grainUV = gl_FragCoord.xy / 512.0 + grainOffset;
  float rand = texture2D(uGrainTexture, grainUV).r;

  float speck = step(1.0 - sphereBrightness * uGrainDensity * 0.3, rand);
  float grain = speck * uGrainBrightness * sphereBrightness;

  // --- final composite: smooth sphere + grain specks + ambient floor ---
  vec3 color = vec3(uBaseBrightness + base + grain);
  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
