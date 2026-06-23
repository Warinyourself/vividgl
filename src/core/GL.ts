export interface GLOptions {
  /** Extensions to request before shader compilation */
  extensions?: string[]
  /** Called every frame before drawArrays — set uniforms here */
  onFrame?: (gl: GL) => void
  /** When true, uTime is not auto-updated; caller sets gl.time manually */
  externalTime?: boolean
  /** Initial pixel-art block size (1 = off) */
  pixelSize?: number
}

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

  private _el: HTMLCanvasElement
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

  // Pixelation resources
  private _pxFbo: WebGLFramebuffer | null = null
  private _pxTex: WebGLTexture | null = null
  private _pxProg: WebGLProgram | null = null
  private _pxQuad: WebGLBuffer | null = null

  private _innerPxratio = 1

  get pxratio() { return this._innerPxratio }
  set pxratio(v: number) {
    if (v !== this._innerPxratio) { this._innerPxratio = v; this._resize() }
  }

  constructor(
    canvas: HTMLCanvasElement,
    vertexSrc: string,
    fragmentSrc: string,
    options: GLOptions = {}
  ) {
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
    this._bindResizeListener()
    this._resize()
  }

  // ─── Compilation ──────────────────────────────────────────────────────────

  private _compileShader(type: number, src: string): WebGLShader {
    const gl = this.ctx
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error('[VividGL] Shader error: ' + gl.getShaderInfoLog(shader))
    return shader
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
    const handler = () => this._resize()
    window.addEventListener('resize', handler)
    this._listeners.push(() => window.removeEventListener('resize', handler))
  }

  private _resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.width = w
    this.height = h
    this._el.width  = w * this._innerPxratio
    this._el.height = h * this._innerPxratio
    this._el.style.width  = w + 'px'
    this._el.style.height = h + 'px'
    this.ctx.viewport(0, 0, this._el.width, this._el.height)
    this.ctx.uniform2fv(this.programInfo.uniforms.resolution!, [this._el.width, this._el.height])
    this._rebuildBuffers()
    if (this._pxTex) {
      this.ctx.bindTexture(this.ctx.TEXTURE_2D, this._pxTex)
      this.ctx.texImage2D(this.ctx.TEXTURE_2D, 0, this.ctx.RGBA, this._el.width, this._el.height, 0, this.ctx.RGBA, this.ctx.UNSIGNED_BYTE, null)
      this.ctx.bindTexture(this.ctx.TEXTURE_2D, null)
    }
  }

  // ─── Pixelation ───────────────────────────────────────────────────────────

  private _initPixelate() {
    const gl = this.ctx
    const w = this._el.width, h = this._el.height

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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s
    }
    this._pxProg = gl.createProgram()!
    gl.attachShader(this._pxProg, compile(gl.VERTEX_SHADER,
      `#version 300 es\nin vec2 p;out vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}`))
    gl.attachShader(this._pxProg, compile(gl.FRAGMENT_SHADER,
      `#version 300 es\nprecision highp float;\nuniform sampler2D t;uniform vec2 r;uniform float s;\nin vec2 v;out vec4 c;\nvoid main(){vec2 b=floor(gl_FragCoord.xy/s)*s+s*.5;c=texture(t,b/r);}`))
    gl.linkProgram(this._pxProg)

    this._pxQuad = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this._pxQuad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
  }

  // ─── Render loop ──────────────────────────────────────────────────────────

  private _frame = () => {
    if (!this._running) return
    requestAnimationFrame(this._frame)

    const gl = this.ctx
    const usePixelate = this.pixelSize > 1

    if (usePixelate) {
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

    if (usePixelate) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.useProgram(this._pxProg)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._pxQuad)
      const loc = gl.getAttribLocation(this._pxProg!, 'p')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this._pxTex)
      gl.uniform1i(gl.getUniformLocation(this._pxProg!, 't'), 0)
      gl.uniform2f(gl.getUniformLocation(this._pxProg!, 'r'), this._el.width, this._el.height)
      gl.uniform1f(gl.getUniformLocation(this._pxProg!, 's'), this.pixelSize)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      gl.useProgram(this.program)
      this._rebuildBuffers()
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

  stop() {
    this._running = false
    return this
  }

  get running() { return this._running }

  destroy() {
    this._running = false
    this._listeners.forEach(fn => fn())
    const gl = this.ctx
    if (this.program) gl.deleteProgram(this.program)
    gl.deleteShader(this._vertShader)
    gl.deleteShader(this._fragShader)
    if (this._positionBuffer) gl.deleteBuffer(this._positionBuffer)
    if (this._pxFbo) gl.deleteFramebuffer(this._pxFbo)
    if (this._pxTex) gl.deleteTexture(this._pxTex)
    if (this._pxProg) gl.deleteProgram(this._pxProg)
    if (this._pxQuad) gl.deleteBuffer(this._pxQuad)
  }
}
