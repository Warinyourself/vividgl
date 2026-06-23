import { VividGL } from './core/VividGL'
import { flow }        from './themes/flow'
import { plasma }      from './themes/plasma'
import { rings }       from './themes/rings'
import { tenderness }  from './themes/tenderness'
import { tunnel }      from './themes/tunnel'
import { sphere }      from './themes/sphere'
import { planet }      from './themes/planet'
import { destruction } from './themes/destruction'
import { random }      from './themes/random'
import { rings3d }     from './themes/rings3d'
import { zappy }       from './themes/zappy'
import { contour }     from './themes/contour'

// Register all built-in themes
VividGL.register('flow',        flow)
VividGL.register('plasma',      plasma)
VividGL.register('rings',       rings)
VividGL.register('tenderness',  tenderness)
VividGL.register('tunnel',      tunnel)
VividGL.register('sphere',      sphere)
VividGL.register('planet',      planet)
VividGL.register('destruction', destruction)
VividGL.register('random',      random)
VividGL.register('rings3d',     rings3d)
VividGL.register('zappy',       zappy)
VividGL.register('contour',     contour)

export { VividGL }
export type { ThemeDef, ParamDef, ParamType, ParamValues } from './core/types'
export const themes = { flow, plasma, rings, tenderness, tunnel, sphere, planet, destruction, random, rings3d, zappy, contour }
