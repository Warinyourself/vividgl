import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const sphere: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio: { type: 'float', default: 0.8, min: 0.01, max: 1,   step: 0.01 },
    speed:   { type: 'speed', default: 5,   min: 0,    max: 15,  step: 0.1  },
    size:    { type: 'float', default: 2,   min: 1.4,  max: 3,   step: 0.01 },
  }
}
