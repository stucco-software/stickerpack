import { defineConfig } from 'vite'

// Separate pass so the script-tag build is one self-contained file.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/lib/script.js',
      formats: ['es'],
      fileName: () => 'stickerpack.js'
    },
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
