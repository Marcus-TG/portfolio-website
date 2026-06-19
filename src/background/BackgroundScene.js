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

    this._mouse     = { x: 0, y: 0 };
    this._mouseLerp = { x: 0, y: 0 };

    // Desktop defaults for mobile-responsive overrides
    this._desktopDefaults = {
      sphereRadius:   this.params.sphereRadius,
      sphereOffsetX:  this.params.sphereOffsetX,
      sphereOffsetY:  this.params.sphereOffsetY,
      sphereSoftness: this.params.sphereSoftness,
      noiseWaveScale: this.params.noiseWaveScale,
    };

    this._paused   = false;
    this._running  = false;
    this._elapsed  = 0;
    this._last     = performance.now();
    this._lastDraw = 0;
    // Cap the loop to ~30fps. An ambient noise field doesn't need 60, and
    // halving the draw rate halves the per-second main-thread cost — which
    // matters most where WebGL falls back to software rasterization.
    this._frameInterval = 1000 / 30;

    this._initRenderer();
    this._initScene();
    this._applyViewportScale();
    this._initEvents();
    // Paint a single static frame so the background is present immediately;
    // the animation loop only begins once start() is called (post-reveal).
    this._renderFrame();
  }

  // ---------------------------------------------------------------------------
  // Renderer — raw WebGL context on a sized canvas
  // ---------------------------------------------------------------------------
  _initRenderer() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl', {
      antialias: false,
      depth:     false,
      stencil:   false,
      alpha:     false,
    });
    if (!this.gl) {
      throw new Error('WebGL unavailable — background disabled');
    }
    this._pixelRatio = this._targetPixelRatio();
    this._setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.canvas);
  }

  // Render at native pixels on desktop (capped at 2×), but force 1× on phones:
  // a full-screen fragment shader at 2× DPR is 4× the pixel work for a
  // backdrop nobody scrutinizes pixel-for-pixel.
  _targetPixelRatio() {
    const isMobile = window.innerWidth < 768;
    return isMobile ? 1 : Math.min(window.devicePixelRatio, 2);
  }

  _setSize(w, h) {
    this.canvas.width  = Math.floor(w * this._pixelRatio);
    this.canvas.height = Math.floor(h * this._pixelRatio);
    this.canvas.style.width  = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  // ---------------------------------------------------------------------------
  // Scene — shader program + fullscreen triangle
  // ---------------------------------------------------------------------------
  _initScene() {
    const gl = this.gl;

    const fragmentShader =
      'precision highp float;\n' + noiseGlsl + '\n' + backgroundFrag;
    this._program = this._createProgram(backgroundVert, fragmentShader);
    gl.useProgram(this._program);

    // Fullscreen triangle — covers the viewport with no seam; vUv is derived
    // from clip-space position so off-screen overshoot is harmless
    this._positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const positionLoc = gl.getAttribLocation(this._program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // 512×512 white noise texture — true Math.random(), zero spatial structure
    const grainSize = 512;
    const grainData = new Uint8Array(grainSize * grainSize);
    for (let i = 0; i < grainData.length; i++) {
      grainData[i] = Math.random() * 255;
    }
    this._grainTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._grainTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      grainSize, grainSize, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, grainData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    const uniformNames = [
      'uTime', 'uResolution', 'uMouse', 'uGrainTexture',
      'uNoiseScale', 'uNoiseSpeed', 'uNoiseDirection',
      'uNoiseWaveSpeed', 'uNoiseWaveScale', 'uNoiseContrast',
      'uSphereRadius', 'uSphereSoftness', 'uSphereOffsetX', 'uSphereOffsetY',
      'uLightAngle', 'uLightConcentration',
      'uGrainSpeed', 'uGrainSize',
      'uMaxBrightness', 'uBaseBrightness', 'uKnee',
    ];
    this._u = {};
    for (const name of uniformNames) {
      this._u[name] = gl.getUniformLocation(this._program, name);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._grainTexture);
    gl.uniform1i(this._u.uGrainTexture, 0);
    gl.uniform2f(this._u.uResolution, window.innerWidth, window.innerHeight);
  }

  _createProgram(vertSource, fragSource) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, this._compileShader(gl.VERTEX_SHADER, vertSource));
    gl.attachShader(program, this._compileShader(gl.FRAGMENT_SHADER, fragSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
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
      this._pixelRatio = this._targetPixelRatio();
      this._setSize(w, h);
      this.gl.uniform2f(this._u.uResolution, w, h);
      this._applyViewportScale();
      // Repaint immediately so a paused/static background tracks the new size.
      this._renderFrame();
    };

    // Pause rAF when tab hidden — saves battery / GPU on mobile and laptops.
    // Also reset the time base on resume so uTime doesn't jump forward.
    // Guarded by _running so a static (reduced-motion) background never
    // silently starts animating on tab focus.
    this._onVisibilityChange = () => {
      if (document.hidden) {
        if (this._running) {
          this._paused = true;
          cancelAnimationFrame(this._rafId);
        }
      } else if (this._paused) {
        this._paused = false;
        this._last = performance.now();
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
  // Begin the animation loop. Deferred until after the preloader reveals the
  // site — running the (potentially software-rasterized) shader while it's
  // hidden behind the opaque preloader only burns main-thread time during the
  // page-load window, tanking Total Blocking Time for zero visual gain.
  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._animate();
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());

    // Throttle draws to the target frame rate; rAF still fires at display rate
    // but the expensive work runs only when enough time has elapsed.
    const now = performance.now();
    if (now - this._lastDraw < this._frameInterval) return;
    this._lastDraw = now;

    this._renderFrame(now);
  }

  // Sync uniforms and draw one frame. Called both by the loop and directly for
  // single static frames (initial paint, resize, reduced-motion).
  _renderFrame(now = performance.now()) {
    this._elapsed += (now - this._last) / 1000;
    this._last = now;

    const gl = this.gl;
    const u  = this._u;
    const p  = this.params;
    const s  = p.mouseStrength;

    // smooth mouse follow
    this._mouseLerp.x += (this._mouse.x - this._mouseLerp.x) * 0.04;
    this._mouseLerp.y += (this._mouse.y - this._mouseLerp.y) * 0.04;

    // sync all uniforms from params
    gl.uniform1f(u.uTime,               this._elapsed);
    gl.uniform2f(u.uMouse,              this._mouseLerp.x * s, this._mouseLerp.y * s);
    gl.uniform1f(u.uNoiseScale,         p.noiseScale);
    gl.uniform1f(u.uNoiseSpeed,         p.noiseSpeed);
    gl.uniform1f(u.uNoiseDirection,     p.noiseDirection);
    gl.uniform1f(u.uNoiseWaveSpeed,     p.noiseWaveSpeed);
    gl.uniform1f(u.uNoiseWaveScale,     p.noiseWaveScale);
    gl.uniform1f(u.uNoiseContrast,      p.noiseContrast);
    gl.uniform1f(u.uSphereRadius,       p.sphereRadius);
    gl.uniform1f(u.uSphereSoftness,     p.sphereSoftness);
    gl.uniform1f(u.uSphereOffsetX,      p.sphereOffsetX);
    gl.uniform1f(u.uSphereOffsetY,      p.sphereOffsetY);
    gl.uniform1f(u.uLightAngle,         p.lightAngle);
    gl.uniform1f(u.uLightConcentration, p.lightConcentration);
    gl.uniform1f(u.uGrainSpeed,         p.grainSpeed);
    gl.uniform1f(u.uGrainSize,          p.grainSize);
    gl.uniform1f(u.uMaxBrightness,      p.maxBrightness);
    gl.uniform1f(u.uBaseBrightness,     p.baseBrightness);
    gl.uniform1f(u.uKnee,               p.knee);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    const gl = this.gl;
    gl.deleteBuffer(this._positionBuffer);
    gl.deleteTexture(this._grainTexture);
    gl.deleteProgram(this._program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    this.container.removeChild(this.canvas);
  }
}
