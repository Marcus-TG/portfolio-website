import * as THREE from 'three';
import noiseGlsl from './noise.glsl?raw';
import backgroundVert from './shaders/background.vert?raw';
import backgroundFrag from './shaders/background.frag?raw';

export class BackgroundScene {
  constructor(container) {
    this.container = container;

    this.params = {
      noiseScale:         0.4,
      noiseSpeed:         0.027,
      noiseDirection:     4.9,
      noiseWaveSpeed:     0.25,
      noiseWaveScale:     0.4,
      noiseContrast:      3.0,
      sphereRadius:       0.83,
      sphereSoftness:     0.05,
      sphereOffsetX:      -0.30,
      sphereOffsetY:      -0.08,
      lightAngle:         0.0,
      lightConcentration: 1.8,
      grainSpeed:         0.2,
      grainSize:          1.0,
      maxBrightness:      3.0,
      baseBrightness:     0.0,
      knee:               0.55,
      mouseStrength:      1.0,
    };

    this._mouse     = new THREE.Vector2(0, 0);
    this._mouseLerp = new THREE.Vector2(0, 0);

    // Desktop defaults for mobile-responsive overrides
    this._desktopDefaults = {
      sphereRadius:   this.params.sphereRadius,
      sphereOffsetX:  this.params.sphereOffsetX,
      sphereOffsetY:  this.params.sphereOffsetY,
      sphereSoftness: this.params.sphereSoftness,
      noiseWaveScale: this.params.noiseWaveScale,
    };

    this._paused = false;

    this._initRenderer();
    this._initScene();
    this._applyViewportScale();
    this._initEvents();
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
      uNoiseContrast:     { value: this.params.noiseContrast },
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
      uKnee:              { value: this.params.knee },
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
  // Mobile viewport scaling — adjust sphere for portrait screens
  // ---------------------------------------------------------------------------
  _applyViewportScale() {
    const isMobile = window.innerWidth < 768;
    const d = this._desktopDefaults;

    if (isMobile) {
      this.params.sphereRadius   = 0.58;
      this.params.sphereOffsetX  = -0.30;
      this.params.sphereOffsetY  = -0.20;
      this.params.sphereSoftness = 0.023;
      this.params.noiseWaveScale = 0.1;
    } else {
      this.params.sphereRadius   = d.sphereRadius;
      this.params.sphereOffsetX  = d.sphereOffsetX;
      this.params.sphereOffsetY  = d.sphereOffsetY;
      this.params.sphereSoftness = d.sphereSoftness;
      this.params.noiseWaveScale = d.noiseWaveScale;
    }
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
      this._applyViewportScale();
    };

    // Pause rAF when tab hidden — saves battery / GPU on mobile and laptops.
    // Also reset clock delta on resume so uTime doesn't jump forward.
    this._onVisibilityChange = () => {
      if (document.hidden) {
        this._paused = true;
        cancelAnimationFrame(this._rafId);
      } else if (this._paused) {
        this._paused = false;
        this.clock.getDelta();
        this._animate();
      }
    };

    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
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
    this.uniforms.uNoiseContrast.value     = p.noiseContrast;
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
    this.uniforms.uKnee.value              = p.knee;

    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this._grainTexture.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
