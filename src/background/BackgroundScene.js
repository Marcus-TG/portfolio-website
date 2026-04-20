import * as THREE from 'three';
import noiseGlsl from './noise.glsl?raw';
import backgroundVert from './shaders/background.vert?raw';
import backgroundFrag from './shaders/background.frag?raw';

export class BackgroundScene {
  constructor(container) {
    this.container = container;

    this.params = {
      noiseScale:         0.7,
      noiseSpeed:         0.027,
      noiseDirection:     4.9,
      noiseWaveSpeed:     0.08,
      noiseWaveScale:     0.4,
      sphereRadius:       0.83,
      sphereSoftness:     0.05,
      sphereOffsetX:      -0.30,
      sphereOffsetY:      -0.30,
      lightAngle:         0.0,
      lightConcentration: 1.8,
      grainSpeed:         0.2,
      grainSize:          1.0,
      maxBrightness:      0.5,
      baseBrightness:     0.0, // matches #0e0e0e
      mouseStrength:      1.0,
    };

    this._mouse     = new THREE.Vector2(0, 0);
    this._mouseLerp = new THREE.Vector2(0, 0);

    this._initRenderer();
    this._initScene();
    this._initEvents();
    this._initTweakpane();
    this._animate();
  }

  // ---------------------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------------------
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
  }

  // ---------------------------------------------------------------------------
  // Scene — orthographic camera + full-screen plane
  // ---------------------------------------------------------------------------
  _initScene() {
    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const fragmentShader = noiseGlsl + '\n' + backgroundFrag;

    // 512×512 white noise texture — true Math.random(), zero spatial structure
    const grainSize = 512;
    const grainData = new Uint8Array(grainSize * grainSize);
    for (let i = 0; i < grainData.length; i++) {
      grainData[i] = Math.random() * 255;
    }
    this._grainTexture = new THREE.DataTexture(
      grainData, grainSize, grainSize, THREE.RedFormat
    );
    this._grainTexture.wrapS = THREE.RepeatWrapping;
    this._grainTexture.wrapT = THREE.RepeatWrapping;
    this._grainTexture.magFilter = THREE.NearestFilter;
    this._grainTexture.minFilter = THREE.NearestFilter;
    this._grainTexture.needsUpdate = true;

    this.uniforms = {
      uTime:              { value: 0 },
      uResolution:        { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse:             { value: new THREE.Vector2(0, 0) },
      uGrainTexture:      { value: this._grainTexture },
      uNoiseScale:        { value: this.params.noiseScale },
      uNoiseSpeed:        { value: this.params.noiseSpeed },
      uNoiseDirection:    { value: this.params.noiseDirection },
      uNoiseWaveSpeed:    { value: this.params.noiseWaveSpeed },
      uNoiseWaveScale:    { value: this.params.noiseWaveScale },
      uSphereRadius:      { value: this.params.sphereRadius },
      uSphereSoftness:    { value: this.params.sphereSoftness },
      uSphereOffsetX:     { value: this.params.sphereOffsetX },
      uSphereOffsetY:     { value: this.params.sphereOffsetY },
      uLightAngle:        { value: this.params.lightAngle },
      uLightConcentration:{ value: this.params.lightConcentration },
      uGrainSpeed:        { value: this.params.grainSpeed },
      uGrainSize:         { value: this.params.grainSize },
      uMaxBrightness:     { value: this.params.maxBrightness },
      uBaseBrightness:    { value: this.params.baseBrightness },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader:   backgroundVert,
      fragmentShader,
      uniforms:       this.uniforms,
      depthTest:      false,
      depthWrite:     false,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(this.mesh);
    this.clock = new THREE.Clock();
  }

  // ---------------------------------------------------------------------------
  // Events — mouse + resize
  // ---------------------------------------------------------------------------
  _initEvents() {
    this._onMouseMove = (e) => {
      this._mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      this._mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.uniforms.uResolution.value.set(w, h);
    };

    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('resize', this._onResize);
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------
  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());

    const elapsed = this.clock.getElapsedTime();
    const p = this.params;
    const s = p.mouseStrength;

    // smooth mouse follow
    this._mouseLerp.x += (this._mouse.x - this._mouseLerp.x) * 0.04;
    this._mouseLerp.y += (this._mouse.y - this._mouseLerp.y) * 0.04;

    // sync all uniforms from params
    this.uniforms.uTime.value              = elapsed;
    this.uniforms.uMouse.value.set(this._mouseLerp.x * s, this._mouseLerp.y * s);
    this.uniforms.uNoiseScale.value        = p.noiseScale;
    this.uniforms.uNoiseSpeed.value        = p.noiseSpeed;
    this.uniforms.uNoiseDirection.value    = p.noiseDirection;
    this.uniforms.uNoiseWaveSpeed.value    = p.noiseWaveSpeed;
    this.uniforms.uNoiseWaveScale.value    = p.noiseWaveScale;
    this.uniforms.uSphereRadius.value      = p.sphereRadius;
    this.uniforms.uSphereSoftness.value    = p.sphereSoftness;
    this.uniforms.uSphereOffsetX.value     = p.sphereOffsetX;
    this.uniforms.uSphereOffsetY.value     = p.sphereOffsetY;
    this.uniforms.uLightAngle.value        = p.lightAngle;
    this.uniforms.uLightConcentration.value= p.lightConcentration;
    this.uniforms.uGrainSpeed.value        = p.grainSpeed;
    this.uniforms.uGrainSize.value         = p.grainSize;
    this.uniforms.uMaxBrightness.value     = p.maxBrightness;
    this.uniforms.uBaseBrightness.value    = p.baseBrightness;

    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------------------
  // Tweakpane (dev only)
  // ---------------------------------------------------------------------------
  async _initTweakpane() {
    if (!import.meta.env.DEV) return;

    const { Pane } = await import('tweakpane');
    const pane = new Pane({ title: 'Background' });
    this._pane = pane;
    const p = this.params;

    const fNoise = pane.addFolder({ title: 'Noise' });
    fNoise.addBinding(p, 'noiseScale',     { min: 0.1,  max: 10.0,         step: 0.1,   label: 'scale' });
    fNoise.addBinding(p, 'noiseSpeed',     { min: 0.01, max: 0.2,          step: 0.001, label: 'speed' });
    fNoise.addBinding(p, 'noiseDirection', { min: 0,    max: Math.PI * 2,  step: 0.05,  label: 'direction' });
    fNoise.addBinding(p, 'noiseWaveSpeed', { min: 0.0,  max: 0.5,          step: 0.005, label: 'waveSpeed' });
    fNoise.addBinding(p, 'noiseWaveScale', { min: 0.1,  max: 5.0,          step: 0.1,   label: 'waveStretch' });

    const fSphere = pane.addFolder({ title: 'Sphere' });
    fSphere.addBinding(p, 'sphereRadius',   { min: 0.2,  max: 2.0, step: 0.01, label: 'radius' });
    fSphere.addBinding(p, 'sphereSoftness', { min: 0.05, max: 0.3, step: 0.01, label: 'softness' });
    fSphere.addBinding(p, 'sphereOffsetX',  { min: -0.3, max: 0.3, step: 0.01, label: 'offsetX' });
    fSphere.addBinding(p, 'sphereOffsetY',  { min: -0.3, max: 0.3, step: 0.01, label: 'offsetY' });

    const fLight = pane.addFolder({ title: 'Light' });
    fLight.addBinding(p, 'lightAngle',         { min: 0, max: Math.PI * 2, step: 0.01, label: 'angle' });
    fLight.addBinding(p, 'lightConcentration', { min: 1.0, max: 5.0,       step: 0.1,  label: 'concentration' });

    const fGrain = pane.addFolder({ title: 'Grain' });
    fGrain.addBinding(p, 'grainSpeed', { min: 0.01, max: 2.0, step: 0.01, label: 'speed' });
    fGrain.addBinding(p, 'grainSize',  { min: 1.0,  max: 8.0, step: 0.5,  label: 'size' });

    const fOutput = pane.addFolder({ title: 'Output' });
    fOutput.addBinding(p, 'maxBrightness',  { min: 0.1, max: 1.0, step: 0.01,  label: 'maxBrightness' });
    fOutput.addBinding(p, 'baseBrightness', { min: 0.0, max: 0.1, step: 0.005, label: 'baseBrightness' });

    const fMouse = pane.addFolder({ title: 'Mouse' });
    fMouse.addBinding(p, 'mouseStrength', { min: 0, max: 1, step: 0.01, label: 'strength' });
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('resize', this._onResize);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this._grainTexture.dispose();
    this.renderer.dispose();
    if (this._pane) this._pane.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
