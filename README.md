# vividgl

Zero-dependency WebGL animated backgrounds for any framework.

## Install

```bash
npm install vividgl
```

## Usage

```ts
import { VividGL } from 'vividgl'

const canvas = document.getElementById('bg') as HTMLCanvasElement
const bg = new VividGL(canvas, 'contour', { scale: 3, colorActive: '#ed2ce6' })

bg.start()

// Update params at runtime
bg.setParam('scale', 5)
bg.setParams({ scale: 5, contour: 20 })

// Events
bg.on('frame', (time) => console.log(time))

// Cleanup
bg.destroy()
```

## Built-in themes

| Name          | Description                        |
|---------------|------------------------------------|
| `contour`     | Animated noise contour lines       |
| `flow`        | Fractal Brownian Motion fluid      |
| `plasma`      | Classic plasma effect              |
| `rings`       | Concentric animated rings          |
| `rings3d`     | 3D Clifford torus (ray marching)   |
| `sphere`      | Ray-marched sine-egg sphere        |
| `planet`      | Ray-marched planet surface         |
| `destruction` | 4D rotating structure              |
| `tenderness`  | Soft noise animation               |
| `tunnel`      | Colorful fractal tunnel            |
| `random`      | Random fractal kaleidoscope        |
| `zappy`       | Electric zap effect                |

## Custom theme

```ts
VividGL.register('my-shader', {
  vertex: myVertGLSL,
  fragment: myFragGLSL,
  params: {
    speed:  { type: 'speed', default: 5, min: 0, max: 15 },
    color1: { type: 'color', default: '#ff0000' },
    invert: { type: 'bool',  default: false },
  }
})

const bg = new VividGL(canvas, 'my-shader', { color1: '#00ff00' })
bg.start()
```

## API

### `new VividGL(canvas, theme, params?)`

| Param    | Type                  | Description              |
|----------|-----------------------|--------------------------|
| `canvas` | `HTMLCanvasElement`   | Target canvas element    |
| `theme`  | `string`              | Registered theme name    |
| `params` | `Record<string, any>` | Initial parameter values |

### Instance methods

| Method                          | Description                    |
|---------------------------------|--------------------------------|
| `start()`                       | Start render loop              |
| `stop()`                        | Pause render loop              |
| `setParam(key, value)`          | Update a single parameter      |
| `setParams(values)`             | Update multiple parameters     |
| `on(event, callback)`           | Subscribe to events            |
| `destroy()`                     | Stop and release GPU resources |

### Static methods

| Method                          | Description              |
|---------------------------------|--------------------------|
| `VividGL.register(name, def)`   | Register a custom theme  |
| `VividGL.themes()`              | List registered themes   |

## License

MIT
