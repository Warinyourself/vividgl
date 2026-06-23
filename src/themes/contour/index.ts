import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const contour: ThemeDef = {
  vertex, fragment,
  extensions: ['OES_standard_derivatives'],
  params: {
    pxratio:     { type: 'float', default: 1,    min: 0.01, max: 1,    step: 0.01 },
    speed:       { type: 'speed', default: 3,    min: 0,    max: 15,   step: 0.1  },
    scale:       { type: 'float', default: 3,    min: 1,    max: 8,    step: 0.1  },
    contour:     { type: 'float', default: 18,   min: 2,    max: 64,   step: 1    },
    maxLine:     { type: 'float', default: 0.2,  min: 0.01, max: 1,    step: 0.01 },
    colorActive: { type: 'color', default: '#ed2ce6' },
    colorSecond: { type: 'color', default: '#1360dd' },
    colorBg:     { type: 'color', default: '#06010e' },
  }
}
