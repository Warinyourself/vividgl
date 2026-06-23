import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [glsl()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VividGL',
      fileName: 'vividgl',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      // No external deps — zero runtime dependencies
    }
  }
})
