import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { build } from 'vite'
import { manifest } from '../src/extension/manifest.js'

const TARGETS = ['chrome', 'firefox']

const ENTRIES = [
  { entry: 'src/extension/content-entry.js', file: 'content.js' },
  { entry: 'src/extension/background-entry.js', file: 'background.js' },
  { entry: 'src/extension/popup/popup.js', file: 'popup.js' },
  { entry: 'src/extension/options/options.js', file: 'options.js' }
]

const COPIES = [
  { from: 'src/extension/popup/popup.html', to: 'popup.html' },
  { from: 'src/extension/options/options.html', to: 'options.html' },
  { from: 'src/extension/ui.css', to: 'ui.css' },
  { from: 'src/extension/icons', to: 'icons' },
  { from: 'static/stickers', to: 'stickers' }
]

// One IIFE bundle per entry: Rollup can't code-split into IIFE, and content scripts
// and a classic service worker both need a self-contained classic script.
const bundle = async ({ entry, file }, outDir, watch) => build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: false,
    watch: watch ? {} : null,
    lib: { entry, formats: ['iife'], name: 'stickerpack', fileName: () => file }
  }
})

const buildTarget = async (target, watch) => {
  // Not under dist/: the library build empties that directory, which would delete
  // an extension you have loaded unpacked in a browser. In watch mode, skip the
  // rm entirely too: a rebuild shouldn't make an already-loaded unpacked
  // extension disappear out from under the browser.
  const outDir = `dist-extension/${target}`
  if (!watch) await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  for (const item of ENTRIES) await bundle(item, outDir, watch)
  for (const { from, to } of COPIES) await cp(from, `${outDir}/${to}`, { recursive: true })

  await writeFile(`${outDir}/manifest.json`, `${JSON.stringify(manifest(target), null, 2)}\n`)
  console.log(`built ${outDir}`)
}

// Note: --watch rebuilds the JS bundles only. Changing the manifest, HTML, CSS or
// stickers needs a full `npm run build:extension`.
const watch = process.argv.includes('--watch')
for (const target of TARGETS) await buildTarget(target, watch)
