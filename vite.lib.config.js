import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/lib/index.js',
        element: 'src/lib/element.js'
      },
      formats: ['es'],
      fileName: (format, name) => `${name}.js`
    }
  }
})
