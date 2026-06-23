import { VividGL } from './core/VividGL'
import { flow } from './themes/flow'

// Register built-in themes
VividGL.register('flow', flow)

export { VividGL }
export type { ThemeDef, ParamDef, ParamType, ParamValues } from './core/types'

// Export theme defs for consumers who want to extend or inspect them
export const themes = { flow }
