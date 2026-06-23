import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const flow: ThemeDef = {
  vertex,
  fragment,
  params: {
    speed: { type: 'speed',  default: 10, min: 0, max: 15, step: 0.1 },
    hue:   { type: 'float',  default: 0,  min: 0, max: 360, step: 1 },
    brightness: { type: 'float', default: 1,  min: 0, max: 2,   step: 0.01 },
    invert:     { type: 'bool',  default: false },
    size:  { type: 'float',  default: 1,  min: 0.2, max: 2.8, step: 0.01 },
  },
  styleEffect: ({ hue, brightness, invert }) =>
    ({ filter: `hue-rotate(${hue}deg) brightness(${brightness})${invert ? ' invert(1)' : ''}` })
}
