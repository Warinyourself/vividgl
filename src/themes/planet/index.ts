import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const planet: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio:  { type: 'float', default: 0.8, min: 0.01, max: 1,  step: 0.01 },
    speed:    { type: 'speed', default: 5,   min: 0,    max: 15, step: 0.1  },
    position: { type: 'float', default: 3.9, min: 2.8,  max: 20, step: 0.01 },
  }
}
