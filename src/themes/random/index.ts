import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const random: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio:   { type: 'float', default: 0.8, min: 0.01, max: 1,   step: 0.01 },
    speed:     { type: 'speed', default: 5,   min: 0,    max: 15,  step: 0.1  },
    symmetry:  { type: 'float', default: 0.1, min: 0.01, max: 2,   step: 0.01 },
    thickness: { type: 'float', default: 0.1, min: 0.01, max: 0.7, step: 0.01 },
  },
  styleEffect: ({ hue, brightness, invert }) =>
    ({ filter: `hue-rotate(${hue ?? 0}deg) brightness(${brightness ?? 1})${invert ? ' invert(1)' : ''}` })
}
