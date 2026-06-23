export type ParamType = 'float' | 'int' | 'color' | 'bool'
  | 'speed'   // special: maps to time increment (gl.time += value / 500)

export interface ParamDef {
  type: ParamType
  default: number | string | boolean
  min?: number
  max?: number
  step?: number
}

export interface BloomOptions {
  /** Bloom layer A — bright tight halo */
  passesA?: number;  radiusA?: number;  intensityA?: number;  stepMultA?: number
  /** Bloom layer B — wide dim scatter; set thresholdB > 0 to scatter only from bright pixels */
  passesB?: number;  radiusB?: number;  intensityB?: number;  stepMultB?: number
  thresholdB?: number
}

export interface ThemeDef {
  vertex: string
  fragment: string
  /** Declarative parameter schema — used for tooling/UI, not required at runtime */
  params?: Record<string, ParamDef>
  /** WebGL extensions required by this theme */
  extensions?: string[]
  /**
   * Optional CSS to apply to the canvas element based on current param values.
   * Use for effects like hue-rotate/brightness/invert that live outside GLSL.
   */
  styleEffect?: (params: ParamValues) => Partial<CSSStyleDeclaration>
  /** Dual-layer bloom post-processing applied after the main render */
  bloom?: BloomOptions
}

export type ParamValues = Record<string, number | string | boolean>
