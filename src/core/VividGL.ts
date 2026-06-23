import { GL } from './GL'
import { register, get, list } from './registry'
import type { ThemeDef, ParamValues, ParamDef } from './types'

type EventMap = {
  frame: (time: number) => void
  start: () => void
  stop: () => void
  destroy: () => void
}

export class VividGL {
  // ─── Static registry API ──────────────────────────────────────────────────

  static register(name: string, def: ThemeDef): void {
    register(name, def)
  }

  static themes(): string[] {
    return list()
  }

  // ─── Instance ─────────────────────────────────────────────────────────────

  private _gl: GL
  private _canvas: HTMLCanvasElement
  private _def: ThemeDef
  private _params: ParamValues = {}
  private _timeScale = 1 / 500
  private _uniformSetters: Map<string, (value: number | string | boolean) => void> = new Map()
  private _events: Partial<{ [K in keyof EventMap]: EventMap[K][] }> = {}

  constructor(canvas: HTMLCanvasElement, theme: string, params: ParamValues = {}) {
    const def = get(theme)
    this._def = def
    this._canvas = canvas
    this._params = { ...params }

    // Set initial time scale from default speed param if defined
    const speedDef = Object.entries(def.params ?? {}).find(([, d]) => d.type === 'speed')
    if (speedDef) {
      const initSpeed = (params[speedDef[0]] ?? speedDef[1].default) as number
      this._timeScale = initSpeed / 500
    }

    this._gl = new GL(canvas, def.vertex, def.fragment, {
      extensions: def.extensions,
      externalTime: true,
      bloom: def.bloom,
      onFrame: (gl) => {
        gl.time += this._timeScale
        gl.ctx.uniform1f(gl.programInfo.uniforms.time!, gl.time)
        this._emit('frame', gl.time)
      }
    })

    // Clear any lingering CSS from a previous theme if this one doesn't use styleEffect
    if (!def.styleEffect) canvas.style.filter = ''

    this._buildSetters(def, params)
  }

  // ─── Uniform setters ──────────────────────────────────────────────────────

  private _buildSetters(def: ThemeDef, initial: ParamValues) {
    const gl = this._gl
    const ctx = gl.ctx

    for (const [name, schema] of Object.entries(def.params ?? {})) {
      // 'speed' is handled via _timeScale, not as a GLSL uniform
      if (schema.type === 'speed') {
        this._uniformSetters.set(name, (value) => {
          this._timeScale = (value as number) / 500
        })
        continue
      }

      const loc = ctx.getUniformLocation(gl.program!, this._uniformName(name))

      const setter = (value: number | string | boolean) => {
        ctx.useProgram(gl.program)
        if (schema.type === 'color' && typeof value === 'string') {
          const [r, g, b] = hexToRgb(value)
          ctx.uniform3f(loc!, r / 255, g / 255, b / 255)
        } else if (schema.type === 'bool') {
          ctx.uniform1i(loc!, value ? 1 : 0)
        } else if (loc) {
          ctx.uniform1f(loc, value as number)
        }
        // Re-apply CSS style effect when any param changes
        if (def.styleEffect) {
          const style = def.styleEffect({ ...this._params, [name]: value })
          Object.assign(this._canvas.style, style)
        }
      }

      this._uniformSetters.set(name, setter)
      setter(initial[name] ?? schema.default)
    }

    // Apply initial styleEffect
    if (def.styleEffect) {
      Object.assign(this._canvas.style, def.styleEffect(this._params))
    }
  }

  /** Maps param name to expected GLSL uniform name (override per-theme if needed) */
  private _uniformName(param: string): string {
    return 'u' + param.charAt(0).toUpperCase() + param.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  start(): this {
    this._gl.start()
    this._emit('start')
    return this
  }

  stop(): this {
    this._gl.stop()
    this._emit('stop')
    return this
  }

  setParam(key: string, value: number | string | boolean): this {
    this._params[key] = value
    this._uniformSetters.get(key)?.(value)
    return this
  }

  setParams(values: ParamValues): this {
    for (const [k, v] of Object.entries(values)) this.setParam(k, v)
    return this
  }

  getParam(key: string): number | string | boolean | undefined {
    return this._params[key]
  }

  get running(): boolean { return this._gl.running }

  set pixelSize(v: number) { this._gl.pixelSize = v }
  get pixelSize(): number  { return this._gl.pixelSize }

  set pxratio(v: number) { this._gl.pxratio = v }
  get pxratio(): number  { return this._gl.pxratio }

  destroy(): void {
    this._gl.destroy()
    // Reset any CSS style effects applied to the canvas
    this._canvas.style.filter = ''
    this._emit('destroy')
    this._events = {}
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  on<K extends keyof EventMap>(event: K, cb: EventMap[K]): this {
    ;(this._events[event] ??= [] as any).push(cb)
    return this
  }

  off<K extends keyof EventMap>(event: K, cb: EventMap[K]): this {
    const arr = this._events[event] as EventMap[K][] | undefined
    if (arr) this._events[event] = arr.filter(fn => fn !== cb) as any
    return this
  }

  private _emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
    ;(this._events[event] as ((...a: any[]) => void)[] | undefined)?.forEach(fn => fn(...args))
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}
