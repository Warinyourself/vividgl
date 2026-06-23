import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const tenderness: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio: { type: 'float', default: 0.8, min: 0.01, max: 1,  step: 0.01 },
    speed:   { type: 'speed', default: 10,  min: 0,    max: 15, step: 0.1  },
  }
}
