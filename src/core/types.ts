export type ParamType = 'float' | 'int' | 'color' | 'bool'
  | 'speed'   // special: maps to time increment (gl.time += value / 500)

export interface ParamDef {
  type: ParamType
  default: number | string | boolean
  min?: number
  max?: number
  step?: number
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
}

export type ParamValues = Record<string, number | string | boolean>
