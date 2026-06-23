import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const rings: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio: { type: 'float', default: 0.8, min: 0.01, max: 1,   step: 0.01 },
    speed:   { type: 'speed', default: 5,   min: 0,    max: 15,  step: 0.1  },
    hue:     { type: 'float', default: 0,   min: -0.5, max: 0.5, step: 0.01 },
    zoom:    { type: 'float', default: 32,  min: 2,    max: 100, step: 1    },
  }
}
