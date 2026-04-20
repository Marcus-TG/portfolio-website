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
uniform float uGrainSize;
uniform float uMaxBrightness;
uniform float uBaseBrightness;
uniform float uNoiseDirection;
uniform float uNoiseWaveSpeed;
uniform float uNoiseWaveScale;

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

  // --- directional wave noise ---
  vec2 waveDir = vec2(cos(uNoiseDirection), sin(uNoiseDirection));

  // Scroll UVs in wave direction over time
  vec2 scrolledUV = uv + waveDir * uTime * uNoiseWaveSpeed;

  // Stretch noise perpendicular to wave direction for banded/wave look
  vec2 perpDir = vec2(-waveDir.y, waveDir.x);
  float alongWave = dot(scrolledUV, waveDir);
  float perpWave = dot(scrolledUV, perpDir);
  vec2 noiseUV = waveDir * alongWave + perpDir * perpWave * uNoiseWaveScale;

  float scale = uNoiseScale;
  float n = 0.0;
  n += 0.500 * snoise(vec3(noiseUV * scale * 3.0,  uTime * uNoiseSpeed));
  n += 0.250 * snoise(vec3(noiseUV * scale * 6.0,  uTime * uNoiseSpeed * 2.0));
  n += 0.125 * snoise(vec3(noiseUV * scale * 12.0, uTime * uNoiseSpeed * 3.0));
  n = n * 0.5 + 0.5;

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

  vec2 grainCoord = floor(gl_FragCoord.xy / uGrainSize) * uGrainSize / 512.0;
  float randA = texture2D(uGrainTexture, grainCoord + offsetA).r;
  float randB = texture2D(uGrainTexture, grainCoord + offsetB).r;

  float rand = mix(randA, randB, smoothstep(0.0, 1.0, grainMix));

  // Grain IS the rendering — random texture modulates the brightness envelope
  float grain = rand * sphereBrightness;

  // --- final composite ---
  vec3 color = vec3(uBaseBrightness + grain * uMaxBrightness);
  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
