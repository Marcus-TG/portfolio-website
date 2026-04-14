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
uniform float uGrainIntensity;
uniform float uGrainPixelSize;
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

  // --- directional light gradient ---
  vec2  lightDir = normalize(vec2(cos(uLightAngle), sin(uLightAngle)));
  float light    = length(diff) > 0.001
                     ? dot(normalize(diff), lightDir)
                     : 0.0;
  light = light * 0.5 + 0.5;
  light = pow(light, uLightConcentration);

  // --- compose brightness ---
  float brightness = circle * n * light;
  brightness = brightness * uMaxBrightness + uBaseBrightness;

  // --- film grain (blocky / pixelated) ---
  vec2  grainUV = floor(uv * uResolution.xy / uGrainPixelSize)
                / (uResolution.xy / uGrainPixelSize);
  float grain   = fract(sin(dot(grainUV * uResolution.xy + uTime * 100.0,
                                vec2(12.9898, 78.233))) * 43758.5453);
  grain = (grain - 0.5) * uGrainIntensity;

  // --- final output ---
  vec3 color = vec3(brightness) + grain;
  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
