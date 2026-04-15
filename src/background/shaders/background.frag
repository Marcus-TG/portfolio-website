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

  // --- sphere brightness envelope ---
  float sphereBrightness = circle * n * light;

  // --- continuous grain with smooth transitions ---
  float grainRate = uGrainSpeed * 2.0;
  float grainPhase = uTime * grainRate;
  float grainMix = fract(grainPhase);
  float grainStep = floor(grainPhase);

  vec2 offsetA = vec2(
    fract(sin(grainStep * 12.9898) * 43758.5453),
    fract(cos(grainStep * 78.233) * 43758.5453)
  );
  vec2 offsetB = vec2(
    fract(sin((grainStep + 1.0) * 12.9898) * 43758.5453),
    fract(cos((grainStep + 1.0) * 78.233) * 43758.5453)
  );

  float randA = texture2D(uGrainTexture, gl_FragCoord.xy / 512.0 + offsetA).r;
  float randB = texture2D(uGrainTexture, gl_FragCoord.xy / 512.0 + offsetB).r;

  float rand = mix(randA, randB, smoothstep(0.0, 1.0, grainMix));

  // Grain IS the rendering — random texture modulates the brightness envelope
  float grain = rand * sphereBrightness;

  // --- final composite ---
  vec3 color = vec3(uBaseBrightness + grain * uMaxBrightness);
  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
