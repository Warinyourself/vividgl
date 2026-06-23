import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const tunnel: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio:    { type: 'float', default: 0.8,  min: 0.01,  max: 1,    step: 0.01  },
    speed:      { type: 'speed', default: 5,    min: 0,     max: 15,   step: 0.1   },
    step:       { type: 'float', default: 0.07, min: 0.01,  max: 0.3,  step: 0.01  },
    frequency:  { type: 'float', default: 9,    min: 1,     max: 20,   step: 0.5   },
    amplitude:  { type: 'float', default: 1,    min: 0,     max: 3,    step: 0.1   },
    brightness: { type: 'float', default: 0.01, min: 0.001, max: 0.05, step: 0.001 },
  }
}
