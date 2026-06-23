import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const zappy: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio:    { type: 'float', default: 0.8, min: 0.01, max: 1,    step: 0.01 },
    speed:      { type: 'speed', default: 5,   min: 0,    max: 15,   step: 0.1  },
    zoom:       { type: 'float', default: 0.2, min: 0.05, max: 0.6,  step: 0.01 },
    colorShift: { type: 'float', default: 0,   min: 0,    max: 6.28, step: 0.05 },
  }
}
