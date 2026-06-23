export type ParamType = 'float' | 'int' | 'color' | 'bool'

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
}

export type ParamValues = Record<string, number | string | boolean>
