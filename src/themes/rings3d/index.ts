import type { ThemeDef } from '../../core/types'
import vertex from './vertex.glsl'
import fragment from './fragment.glsl'

export const rings3d: ThemeDef = {
  vertex, fragment,
  params: {
    pxratio:       { type: 'float', default: 0.8,  min: 0.01, max: 1,    step: 0.01 },
    speed:         { type: 'speed', default: 5,    min: 0,    max: 15,   step: 0.1  },
    tubeSize:      { type: 'float', default: 0.2,  min: 0.02, max: 0.6,  step: 0.01 },
    bubbleSize:    { type: 'float', default: 1.85, min: 0.5,  max: 3.5,  step: 0.05 },
    fogDensity:    { type: 'float', default: 0.8,  min: 0.2,  max: 1.0,  step: 0.01 },
    spectrumSpeed: { type: 'float', default: 6.0,  min: 1.0,  max: 12.0, step: 0.5  },
    glowColor:     { type: 'color', default: '#AAFFCE' },
    fogColor:      { type: 'color', default: '#9940B3' },
  }
}
