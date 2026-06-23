import type { BloomOptions } from './types'

export interface GLOptions {
  extensions?: string[]
  onFrame?: (gl: GL) => void
  externalTime?: boolean
  pixelSize?: number
  bloom?: BloomOptions
}

interface RenderTarget { fbo: WebGLFramebuffer; texture: WebGLTexture }

// ─── Bloom pass shaders ───────────────────────────────────────────────────────

const BLOOM_VERT = `#version 300 es
in vec2 p; out vec2 v;
void main() { v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uDir; uniform float uR; uniform float uSM;
in vec2 v; out vec4 fc;
void main() {
  vec2 s = uDir / uRes * uSM; vec4 c = vec4(0.0); float t = 0.0;
  for (float i = -8.0; i <= 8.0; i++) {
    float w = exp(-i*i/(2.0*uR*uR));
    c += texture(uTex, v + s*i)*w; t += w;
  }
  fc = c/t;
}`

const EXTRACT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uThresh;
in vec2 v; out vec4 fc;
void main() {
  vec4 c = texture(uTex, v);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float b = max(0.0, lum - uThresh) / max(1.0 - uThresh, 0.001);
  fc = vec4(c.rgb * b, 1.0);
}`

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uBase; uniform sampler2D uB1; uniform sampler2D uB2;
uniform float uI1; uniform float uI2;
in vec2 v; out vec4 fc;
void main() {
  fc = clamp(texture(uBase,v) + texture(uB1,v)*uI1 + texture(uB2,v)*uI2, 0.0, 1.0);
}`

const QUAD_VERTS = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1])

// ─── GL class ────────────────────────────────────────────────────────────────

export class GL {
  ctx: WebGL2RenderingContext
  program: WebGLProgram | null = null
  programInfo: { attribs: Record<string, number>; uniforms: Record<string, WebGLUniformLocation | null> } = {
    attribs: {}, uniforms: {}
  }

  width = 0
  height = 0
  time = 0
  pixelSize = 1

  protected _el: HTMLCanvasElement
  private _vertSrc: string
  private _fragSrc: string
  private _vertShader!: WebGLShader
  private _fragShader!: WebGLShader
  private _positions!: number[]
  private _positionBuffer!: WebGLBuffer | null
  private _running = false
  private _startTime = Date.now()
  private _options: GLOptions
  private _listeners: (() => void)[] = []

  // ─── Pixelation ───────────────────────────────────────────────────────────
  private _pxFbo: WebGLFramebuffer | null = null
  private _pxTex: WebGLTexture | null = null
  private _pxProg: WebGLProgram | null = null
  private _pxQuad: WebGLBuffer | null = null

  // ─── Bloom ────────────────────────────────────────────────────────────────
  private _bloom: Required<BloomOptions> | null = null
  private _bloomMain!: RenderTarget
  private _bloomPing!: RenderTarget
  private _bloomPong!: RenderTarget
  private _bloomExtra!: RenderTarget
  private _bloomExtract!: RenderTarget
  private _bloomQuad!: WebGLBuffer
  private _blurProg!: WebGLProgram
  private _extractProg!: WebGLProgram
  private _compositeProg!: WebGLProgram
  private _bloomReady = false

  private _innerPxratio = 1

  get pxratio() { return this._innerPxratio }
  set pxratio(v: number) {
    if (v !== this._innerPxratio) { this._innerPxratio = v; this._resize() }
  }

  constructor(canvas: HTMLCanvasElement, vertexSrc: string, fragmentSrc: string, options: GLOptions = {}) {
    this._el = canvas
    this._vertSrc = vertexSrc
    this._fragSrc = fragmentSrc
    this._options = options
    this.pixelSize = options.pixelSize ?? 1

    const ctx = canvas.getContext('webgl2')
    if (!ctx) throw new Error('[VividGL] WebGL 2 is not supported')
    this.ctx = ctx

    options.extensions?.forEach(ext => ctx.getExtension(ext))

    this._compile()
    this._initBuffers()

    if (options.bloom) {
      this._bloom = {
        passesA: 1, radiusA: 5,   intensityA: 1.2, stepMultA: 1,
        passesB: 1, radiusB: 0.5, intensityB: 1.2, stepMultB: 1, thresholdB: 0,
        ...options.bloom
      }
      this._initBloom()
    }

    this._bindResizeListener()
    this._resize()
  }

  // ─── Compilation ──────────────────────────────────────────────────────────

  private _compileShader(type: number, src: string): WebGLShader {
    const gl = this.ctx
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error('[VividGL] Shader error: ' + gl.getShaderInfoLog(s))
    return s
  }

  private _compileProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.ctx
    const prog = gl.createProgram()!
    gl.attachShader(prog, this._compileShader(gl.VERTEX_SHADER, vert))
    gl.attachShader(prog, this._compileShader(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog)
    return prog
  }

  private _compile() {
    const gl = this.ctx
    this._vertShader = this._compileShader(gl.VERTEX_SHADER, this._vertSrc)
    this._fragShader = this._compileShader(gl.FRAGMENT_SHADER, this._fragSrc)
    this.program = gl.createProgram()!
    gl.attachShader(this.program, this._vertShader)
    gl.attachShader(this.program, this._fragShader)
    gl.linkProgram(this.program)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error('[VividGL] Link error: ' + gl.getProgramInfoLog(this.program))
    gl.useProgram(this.program)
    this.programInfo = {
      attribs:  { vertexPosition: gl.getAttribLocation(this.program, 'aVertexPosition') },
      uniforms: { time: gl.getUniformLocation(this.program, 'uTime'), resolution: gl.getUniformLocation(this.program, 'uResolution') }
    }
  }

  // ─── Buffers ──────────────────────────────────────────────────────────────

  private _initBuffers() {
    this._positions = [-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]
    this._rebuildBuffers()
  }

  private _rebuildBuffers() {
    const gl = this.ctx
    this._positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._positions), gl.STATIC_DRAW)
    const loc = this.programInfo.attribs.vertexPosition
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }

  // ─── Resize ───────────────────────────────────────────────────────────────

  private _bindResizeListener() {
    const h = () => this._resize()
    window.addEventListener('resize', h)
    this._listeners.push(() => window.removeEventListener('resize', h))
  }

  private _resize() {
    const w = window.innerWidth, h = window.innerHeight
    this.width = w; this.height = h
    this._el.width  = w * this._innerPxratio
    this._el.height = h * this._innerPxratio
    this._el.style.width = w + 'px'; this._el.style.height = h + 'px'
    this.ctx.viewport(0, 0, this._el.width, this._el.height)
    this.ctx.uniform2fv(this.programInfo.uniforms.resolution!, [this._el.width, this._el.height])
    this._rebuildBuffers()
    if (this._pxTex) {
      this.ctx.bindTexture(this.ctx.TEXTURE_2D, this._pxTex)
      this.ctx.texImage2D(this.ctx.TEXTURE_2D, 0, this.ctx.RGBA, this._el.width, this._el.height, 0, this.ctx.RGBA, this.ctx.UNSIGNED_BYTE, null)
      this.ctx.bindTexture(this.ctx.TEXTURE_2D, null)
    }
    if (this._bloomReady) this._resizeBloom()
  }

  // ─── Pixelation ───────────────────────────────────────────────────────────

  private _initPixelate() {
    const gl = this.ctx, w = this._el.width, h = this._el.height
    this._pxTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this._pxTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this._pxFbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._pxFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._pxTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null)
    this._pxProg = this._compileProgram(
      `#version 300 es\nin vec2 p;out vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}`,
      `#version 300 es\nprecision highp float;\nuniform sampler2D t;uniform vec2 r;uniform float s;\nin vec2 v;out vec4 c;\nvoid main(){vec2 b=floor(gl_FragCoord.xy/s)*s+s*.5;c=texture(t,b/r);}`
    )
    this._pxQuad = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this._pxQuad)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW)
  }

  // ─── Bloom ────────────────────────────────────────────────────────────────

  private _createTarget(w: number, h: number): RenderTarget {
    const gl = this.ctx
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null)
    return { fbo, texture }
  }

  private _initBloom() {
    const w = this._el.width, h = this._el.height
    this._bloomMain    = this._createTarget(w, h)
    this._bloomPing    = this._createTarget(w, h)
    this._bloomPong    = this._createTarget(w, h)
    this._bloomExtra   = this._createTarget(w, h)
    this._bloomExtract = this._createTarget(w, h)
    this._blurProg      = this._compileProgram(BLOOM_VERT, BLUR_FRAG)
    this._extractProg   = this._compileProgram(BLOOM_VERT, EXTRACT_FRAG)
    this._compositeProg = this._compileProgram(BLOOM_VERT, COMPOSITE_FRAG)
    this._bloomQuad = this.ctx.createBuffer()!
    this.ctx.bindBuffer(this.ctx.ARRAY_BUFFER, this._bloomQuad)
    this.ctx.bufferData(this.ctx.ARRAY_BUFFER, QUAD_VERTS, this.ctx.STATIC_DRAW)
    this._bloomReady = true
  }

  private _resizeBloom() {
    const w = this._el.width, h = this._el.height
    for (const t of [this._bloomMain, this._bloomPing, this._bloomPong, this._bloomExtra, this._bloomExtract]) {
      this.ctx.bindTexture(this.ctx.TEXTURE_2D, t.texture)
      this.ctx.texImage2D(this.ctx.TEXTURE_2D, 0, this.ctx.RGBA, w, h, 0, this.ctx.RGBA, this.ctx.UNSIGNED_BYTE, null)
    }
    this.ctx.bindTexture(this.ctx.TEXTURE_2D, null)
  }

  private _bindQuad(prog: WebGLProgram) {
    const gl = this.ctx
    gl.bindBuffer(gl.ARRAY_BUFFER, this._bloomQuad)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }

  private _blurPass(src: RenderTarget, dst: RenderTarget, dir: [number, number], radius: number, stepMult: number) {
    const gl = this.ctx
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
    gl.useProgram(this._blurProg)
    this._bindQuad(this._blurProg)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.texture)
    gl.uniform1i(gl.getUniformLocation(this._blurProg, 'uTex'), 0)
    gl.uniform2f(gl.getUniformLocation(this._blurProg, 'uRes'), this._el.width, this._el.height)
    gl.uniform2f(gl.getUniformLocation(this._blurProg, 'uDir'), dir[0], dir[1])
    gl.uniform1f(gl.getUniformLocation(this._blurProg, 'uR'), radius)
    gl.uniform1f(gl.getUniformLocation(this._blurProg, 'uSM'), stepMult)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private _runBlur(src: RenderTarget, passes: number, radius: number, useExtra: boolean, stepMult: number): RenderTarget {
    const a = this._bloomPing, b = useExtra ? this._bloomExtra : this._bloomPong
    let cur = src; let scratch: [RenderTarget, RenderTarget] = [a, b]; let idx = 0
    for (let i = 0; i < passes; i++) {
      const d0 = scratch[idx % 2]!, d1 = scratch[(idx + 1) % 2]!
      this._blurPass(cur, d0, [1, 0], radius, stepMult)
      this._blurPass(d0,  d1, [0, 1], radius, stepMult)
      cur = d1; idx += 2
    }
    return cur
  }

  private _renderBloom() {
    const gl = this.ctx, b = this._bloom!
    const { passesA, radiusA, intensityA, stepMultA, passesB, radiusB, intensityB, stepMultB, thresholdB } = b

    const bloomA = this._runBlur(this._bloomMain, passesA, radiusA, false, stepMultA)

    let bloomBSrc = this._bloomMain
    if (thresholdB > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._bloomExtract.fbo)
      gl.useProgram(this._extractProg)
      this._bindQuad(this._extractProg)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._bloomMain.texture)
      gl.uniform1i(gl.getUniformLocation(this._extractProg, 'uTex'), 0)
      gl.uniform1f(gl.getUniformLocation(this._extractProg, 'uThresh'), thresholdB)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      bloomBSrc = this._bloomExtract
    }
    const bloomB = this._runBlur(bloomBSrc, passesB, radiusB, true, stepMultB)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.useProgram(this._compositeProg)
    this._bindQuad(this._compositeProg)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._bloomMain.texture)
    gl.uniform1i(gl.getUniformLocation(this._compositeProg, 'uBase'), 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA.texture)
    gl.uniform1i(gl.getUniformLocation(this._compositeProg, 'uB1'), 1)
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, bloomB.texture)
    gl.uniform1i(gl.getUniformLocation(this._compositeProg, 'uB2'), 2)
    gl.uniform1f(gl.getUniformLocation(this._compositeProg, 'uI1'), intensityA)
    gl.uniform1f(gl.getUniformLocation(this._compositeProg, 'uI2'), intensityB)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // ─── Render loop ──────────────────────────────────────────────────────────

  private _frame = () => {
    if (!this._running) return
    requestAnimationFrame(this._frame)
    const gl = this.ctx
    const usePixelate = this.pixelSize > 1
    const useBloom = this._bloomReady

    // Determine render target for main pass
    if (useBloom) {
      gl.useProgram(this.program); gl.bindFramebuffer(gl.FRAMEBUFFER, this._bloomMain.fbo)
    } else if (usePixelate) {
      if (!this._pxFbo) this._initPixelate()
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._pxFbo)
    }

    if (!this._options.externalTime) {
      this.time = (Date.now() - this._startTime) / 1000
      gl.useProgram(this.program)
      gl.uniform1f(this.programInfo.uniforms.time!, this.time)
    }

    this._options.onFrame?.(this)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    if (useBloom) {
      this._renderBloom()
      gl.useProgram(this.program)
      this._rebuildBuffers()
    } else if (usePixelate) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.useProgram(this._pxProg)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._pxQuad)
      const loc = gl.getAttribLocation(this._pxProg!, 'p')
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._pxTex)
      gl.uniform1i(gl.getUniformLocation(this._pxProg!, 't'), 0)
      gl.uniform2f(gl.getUniformLocation(this._pxProg!, 'r'), this._el.width, this._el.height)
      gl.uniform1f(gl.getUniformLocation(this._pxProg!, 's'), this.pixelSize)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      gl.useProgram(this.program); this._rebuildBuffers()
    }
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  start() {
    if (this._running) return this
    this._running = true
    this._startTime = Date.now() - this.time * 1000
    requestAnimationFrame(this._frame)
    return this
  }

  stop() { this._running = false; return this }

  get running() { return this._running }

  destroy() {
    this._running = false
    this._listeners.forEach(fn => fn())
    const gl = this.ctx
    if (this.program) gl.deleteProgram(this.program)
    gl.deleteShader(this._vertShader); gl.deleteShader(this._fragShader)
    if (this._positionBuffer) gl.deleteBuffer(this._positionBuffer)
    if (this._pxFbo) gl.deleteFramebuffer(this._pxFbo)
    if (this._pxTex) gl.deleteTexture(this._pxTex)
    if (this._pxProg) gl.deleteProgram(this._pxProg)
    if (this._pxQuad) gl.deleteBuffer(this._pxQuad)
  }
}
