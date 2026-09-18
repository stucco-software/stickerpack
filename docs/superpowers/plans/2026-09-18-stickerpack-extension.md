# Stickerpack Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chromium and Firefox extension that lets you put stickers on any website, saved privately in the extension, with per-site opt-in.

**Architecture:** Three small additions to the existing library (`trigger: 'none'`, an `open`/`close`/`toggle` handle, and a `resolveImage` hook), then a new `src/extension/` built on it: a content script that mounts the library with an extension-storage adapter, a background script that owns per-site permission and script registration, a popup for opting in, and an options page for opting out. Two generated manifests, one codebase, no dependencies.

**Tech Stack:** Vanilla ES modules, Vite (library + IIFE extension builds), Vitest + happy-dom, MV3 extension APIs.

**Spec:** `docs/superpowers/specs/2026-09-18-stickerpack-extension-design.md`

---

## Ground rules for every task

- **Branch `anywhere`.** Commit directly to it and `git push` after every commit. Do not open a PR.
- End every commit message with a blank line and then:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Style follows the repo: 2-space indent, no semicolons, single quotes, arrow functions, small focused modules.
- Tests live next to their module as `*.test.js` and run in happy-dom (`npm test`). Vitest is configured with `requireAssertions: true`.
- The starting test count is **92**. Each task states the expected new total.
- `npm test` and `npm run build` must pass after every commit.
- Extension code never imports from `src/routes/`. The library is imported with relative paths (`../lib/…`), not `$lib`, because the extension is built outside SvelteKit.

## Interface refinements (vs. the spec)

The spec's shapes hold, with these details pinned down:

- `watchUrl(onChange)` returns `{ check, stop }`. `check()` exists so the background's `url-changed` message can reuse the same comparison instead of duplicating it.
- `pack.js` also exports `resolveImage(map)` → `(src) => map.get(src) ?? src`, the exact shape the library option wants.
- `background.js` and `content.js` export factories (`createBackground(api)`, `startContent({ api, … })`) with no side effects, so they're testable. Tiny `*-entry.js` files are the real extension entry points and do nothing but call them.
- `extensionStorage()` takes the storage area, so tests pass a fake; `stickerMap()` takes `getURL`, for the same reason.
- The build is `scripts/build-extension.js` rather than the spec's `vite.extension.config.js`: Rollup can't code-split into IIFE, so each entry needs its own build, which a script drives more clearly than a config file.
- `startContent` owns the "already running in this page" flag, so a revoke clears it and a re-grant can mount again.
- The extension builds into `dist-extension/<target>/`, not `dist/`: `vite.lib.config.js` sets `emptyOutDir: true` on `dist`, so a library or site build would otherwise delete the extension you have loaded unpacked in a browser.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/tray.js` | modify | `trigger: 'none'`, `resolveImage`, return `{ destroy, open, close, toggle }` |
| `src/lib/overlay.js` | modify | accept `{ resolveImage }` |
| `src/lib/index.js` | modify | pass both through; attach `open`/`close`/`toggle` to the handle |
| `src/routes/+page.svelte` | modify | document the new options |
| `src/extension/browser.js` | create | `api` = `browser` or `chrome` |
| `src/extension/page.js` | create | `stickerable`, `pageSource` re-export, `watchUrl` |
| `src/extension/storage.js` | create | storage adapter over `api.storage.local`, serialized writes |
| `src/extension/pack.js` | create | canonical → bundled sticker URLs |
| `src/extension/content.js` (+ `content-entry.js`) | create | mounts the library, handles messages and URL changes |
| `src/extension/background.js` (+ `background-entry.js`) | create | permissions, registration, toolbar, shortcut |
| `src/extension/popup/popup.{html,js}` | create | opt in to a site |
| `src/extension/options/options.{html,js}` | create | list granted sites, opt out |
| `src/extension/manifest.js` | create | per-target manifest |
| `src/extension/icons/` | create | 48px and 128px icons |
| `scripts/build-extension.js` | create | four IIFE builds, copy assets, write manifests, into `dist-extension/` |
| `.gitignore` | modify | ignore `dist-extension/` |
| `package.json` | modify | `build:extension`, `dev:extension` |

---

## Chunk 1: Library additions

### Task 1: `trigger: 'none'` and the tray control API

**Files:**
- Modify: `src/lib/tray.js`
- Test: `src/lib/tray.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/tray.test.js`:

```js
it('renders no trigger at all with trigger: none', () => {
  setup({ trigger: 'none' })
  expect($('.trigger')).toBe(null)
  expect($('.tray').hidden).toBe(true)
  expect($('.tray').classList.contains('no-trigger')).toBe(true)
})

it('opens, closes and toggles without a trigger', () => {
  setup({ trigger: 'none' })
  tray.open()
  expect($('.tray').hidden).toBe(false)
  expect(calls.onOpen).toHaveBeenCalledTimes(1)
  tray.toggle()
  expect($('.tray').hidden).toBe(true)
  tray.toggle()
  expect($('.tray').hidden).toBe(false)
  tray.close()
  expect($('.tray').hidden).toBe(true)
})

it('places a sticker with no trigger and does not throw', () => {
  setup({ trigger: 'none' })
  const link = document.querySelector('a')
  document.elementsFromPoint = vi.fn(() => [host, link, document.body])
  tray.open()
  $('.tray button').click()
  clickCapture(5, 6)
  expect(calls.onPlace).toHaveBeenCalledWith({ src: stickers[0].src, element: link, clientX: 5, clientY: 6 })
})

it('close() also cancels placing', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  expect($('.capture').hidden).toBe(false)
  tray.close()
  expect($('.capture').hidden).toBe(true)
  expect($('.ghost').hidden).toBe(true)
})

it('open() while placing cancels placing first', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  tray.open()
  expect($('.capture').hidden).toBe(true)
  expect($('.tray').hidden).toBe(false)
})

it('ignores open, close and toggle after destroy', () => {
  setup({ trigger: 'none' })
  tray.destroy()
  tray.open()
  tray.toggle()
  expect(root.querySelector('.tray')).toBe(null)
})

it('draws tray images through resolveImage without loading=lazy', () => {
  setup({ resolveImage: (src) => `${src}?local` })
  const img = $('.tray button img')
  expect(img.getAttribute('src')).toBe(`${stickers[0].src}?local`)
  expect(img.hasAttribute('loading')).toBe(false)
})

it('draws the ghost through resolveImage too', () => {
  setup({ resolveImage: (src) => `${src}?local` })
  $('.trigger').click()
  $('.tray button').click()
  expect($('.ghost').getAttribute('src')).toBe(`${stickers[0].src}?local`)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tray.test.js`
Expected: FAIL. `tray.open is not a function`, and the `trigger: 'none'` cases throw `triggerElement.addEventListener is not a function`.

- [ ] **Step 3: Implement in `src/lib/tray.js`**

Add to the `STYLE` string, after the `.tray { … }` rule:

```css
.tray.no-trigger {
  bottom: 1rem;
}
```

Replace the signature and trigger setup (currently lines 64–84, from `export const createTray` through `tray.hidden = true`):

```js
export const createTray = ({
  root,
  host,
  stickers,
  trigger,
  onOpen,
  onClose,
  onPlace,
  resolveImage = (src) => src
}) => {
  let state = 'idle'
  let chosen = null
  let destroyed = false

  const style = document.createElement('style')
  style.textContent = STYLE

  // trigger: 'none' means the host drives the tray itself (the browser extension does).
  const ownerTrigger = trigger && trigger !== 'none' ? trigger : null
  const floating = trigger ? null : document.createElement('button')
  if (floating) {
    floating.className = 'trigger'
    floating.type = 'button'
    floating.textContent = '✦'
    floating.setAttribute('aria-label', 'Stickers')
    floating.setAttribute('aria-expanded', 'false')
  }
  const triggerElement = ownerTrigger ?? floating

  const tray = document.createElement('div')
  tray.className = trigger === 'none' ? 'tray no-trigger' : 'tray'
  tray.hidden = true
```

Rename the internal `open`/`close`/`toggle` to `openTray`/`closeTray`/`toggleTray`, and make `closeTray` cancel placing:

```js
  const openTray = () => {
    if (state === 'placing') stopPlacing()
    state = 'open'
    tray.hidden = false
    floating?.setAttribute('aria-expanded', 'true')
    onOpen?.()
  }

  const closeTray = () => {
    if (state === 'placing') stopPlacing()
    state = 'idle'
    tray.hidden = true
    floating?.setAttribute('aria-expanded', 'false')
    onClose?.()
  }
```

`choose` and `toggleTray` keep their behaviour with the new names:

```js
  const choose = (sticker) => {
    closeTray()
    state = 'placing'
    chosen = sticker
    ghost.src = resolveImage(sticker.src)
    capture.hidden = false
  }

  const toggleTray = () => {
    if (state === 'idle') openTray()
    else if (state === 'open') closeTray()
    else stopPlacing()
  }
```

Draw tray images through the hook (in the `for (const sticker of stickers)` loop):

```js
    img.src = resolveImage(sticker.src)
```

Guard the owner-trigger check in `onCaptureClick`:

```js
    if (ownerTrigger && ownerTrigger.contains(element)) return
```

Make listener wiring and teardown tolerate a missing trigger, and return the control API:

```js
  root.append(style, capture, ghost, ...(floating ? [floating] : []), tray)
  triggerElement?.addEventListener('click', toggleTray)
  capture.addEventListener('pointermove', onPointerMove)
  capture.addEventListener('click', onCaptureClick)
  document.addEventListener('keydown', onKeyDown)

  return {
    open: () => { if (!destroyed) openTray() },
    close: () => { if (!destroyed) closeTray() },
    toggle: () => { if (!destroyed) toggleTray() },
    destroy() {
      if (destroyed) return
      destroyed = true
      triggerElement?.removeEventListener('click', toggleTray)
      document.removeEventListener('keydown', onKeyDown)
      for (const element of [style, capture, ghost, tray, floating]) element?.remove()
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 100 total (92 + 8).

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/tray.js src/lib/tray.test.js
git commit -m "tray can run without its own button

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 2: `resolveImage` in the overlay, and the handle in `index.js`

**Files:**
- Modify: `src/lib/overlay.js`, `src/lib/index.js`
- Test: `src/lib/overlay.test.js`, `src/lib/index.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/overlay.test.js`:

```js
it('draws stickers through resolveImage without changing the annotation', () => {
  overlay.destroy()
  overlay = createOverlay({ resolveImage: (src) => `${src}?local` })
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  expect(stickers()[0].getAttribute('src')).toBe(`${SRC}?local`)
  expect(stickers()[0].hasAttribute('loading')).toBe(false)
  expect(annotation.body.id).toBe(SRC)
})
```

Append to `src/lib/index.test.js`:

```js
it('exposes open, close and toggle on the handle', () => {
  destroy = StickerPack({ storage: memory() })
  const tray = () => shadow().querySelector('.tray')
  expect(tray().hidden).toBe(true)
  destroy.open()
  expect(tray().hidden).toBe(false)
  destroy.toggle()
  expect(tray().hidden).toBe(true)
  destroy.toggle()
  expect(tray().hidden).toBe(false)
  destroy.close()
  expect(tray().hidden).toBe(true)
})

it('gives a second instance a safe no-op handle', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  destroy = StickerPack({ storage: memory() })
  const second = StickerPack({ storage: memory() })
  expect(() => {
    second.open()
    second.toggle()
    second.close()
    second()
  }).not.toThrow()
  expect(shadow().querySelector('.tray').hidden).toBe(true)
})

it('passes resolveImage through to the tray and overlay', () => {
  destroy = StickerPack({
    storage: memory(),
    defaultPack: false,
    stickers: ['/stickers/duck.png'],
    resolveImage: (src) => `${src}?local`
  })
  const img = shadow().querySelector('.tray button img')
  expect(img.getAttribute('src')).toBe(`${new URL('/stickers/duck.png', location.href).href}?local`)
})

it('mounts with no trigger when asked', () => {
  destroy = StickerPack({ storage: memory(), trigger: 'none' })
  expect(shadow().querySelector('.trigger')).toBe(null)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/overlay.test.js src/lib/index.test.js`
Expected: FAIL. `destroy.open is not a function`, and the overlay still draws the canonical URL.

- [ ] **Step 3: Implement**

In `src/lib/overlay.js`, take the option and use it where the image is drawn:

```js
export const createOverlay = ({ resolveImage = (src) => src } = {}) => {
```

```js
      img.src = resolveImage(annotation.body.id)
```

In `src/lib/index.js`, return a handle with controls from the guard branch:

```js
  if (globalThis[ACTIVE]) {
    warn('StickerPack() is already running, ignoring this call.')
    const noop = () => {}
    noop.open = () => {}
    noop.close = () => {}
    noop.toggle = () => {}
    return noop
  }
```

Read the option, pass it to both, and attach the controls:

```js
  const { stickers = [], defaultPack: includeDefaultPack = true, trigger } = options
  const resolveImage = typeof options.resolveImage === 'function' ? options.resolveImage : (src) => src
```

```js
  const overlay = createOverlay({ resolveImage })
```

```js
    tray = createTray({
      root: overlay.root,
      host: overlay.host,
      stickers: pack,
      trigger,
      resolveImage,
```

```js
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    tray.destroy()
    overlay.destroy()
    if (globalThis[ACTIVE] === destroy) globalThis[ACTIVE] = null
  }

  destroy.open = () => tray.open()
  destroy.close = () => tray.close()
  destroy.toggle = () => tray.toggle()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run build`
Expected: PASS, 105 total (100 + 5); build exits 0.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/overlay.js src/lib/index.js src/lib/overlay.test.js src/lib/index.test.js
git commit -m "control the tray from outside, and redirect sticker images

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 3: Document the new options on the showcase

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add the options to the reference list**

Replace the `trigger` row (currently the last entry, with no trailing comma) with both rows:

```js
    ['trigger', 'Element | "none"', 'the ✦ button', 'Your own button to open the tray, or "none" to show no button.'],
    ['resolveImage', 'function', 'src => src', 'Change where a sticker image loads from, without changing what the sticker is.']
```

- [ ] **Step 1b: Add it to the "all the options" snippet**

In `src/routes/snippets.js`, in `jsOptions`, add the option to the object so the snippet matches the reference list:

```js
  trigger: document.querySelector('#stickers'), // your own button, or 'none'
  resolveImage: (src) => src            // where sticker images load from
```

- [ ] **Step 2: Document the handle**

Replace the `.note` paragraph in the JavaScript section with:

```svelte
    <p class="note">
      One sticker pack per page. Don't get greedy! The handle you get back is a function that unmounts,
      and it carries <code>open()</code>, <code>close()</code> and <code>toggle()</code> so your own UI can drive the tray.
    </p>
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build`
Expected: PASS, 105 total; build exits 0.

- [ ] **Step 4: Commit and push**

```bash
git add src/routes/+page.svelte
git commit -m "document the tray handle and resolveImage

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

## Chunk 2: Extension modules

### Task 4: `browser.js`, `page.js`

**Files:**
- Create: `src/extension/browser.js`, `src/extension/page.js`
- Test: `src/extension/page.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/page.test.js`:

```js
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { stickerable, watchUrl } from './page.js'

let watcher

beforeEach(() => {
  history.replaceState(null, '', '/one')
})

afterEach(() => {
  watcher?.stop()
  watcher = null
})

it('accepts ordinary web pages', () => {
  expect(stickerable('https://example.com/about')).toBe(true)
  expect(stickerable('http://localhost:3000/')).toBe(true)
})

it('rejects pages an extension cannot touch', () => {
  for (const url of [
    'chrome://extensions',
    'about:addons',
    'edge://settings',
    'moz-extension://abc/popup.html',
    'chrome-extension://abc/popup.html',
    'file:///Users/nk/notes.html',
    'view-source:https://example.com/',
    'data:text/html,hi',
    'https://chromewebstore.google.com/detail/abc',
    'https://addons.mozilla.org/en-US/firefox/',
    'not a url'
  ]) expect(stickerable(url)).toBe(false)
})

it('reports a new page when the path changes', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  history.pushState(null, '', '/two')
  watcher.check()
  expect(onChange).toHaveBeenCalledWith(`${location.origin}/two`)
})

it('says nothing when only the query or hash changed', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  history.pushState(null, '', '/one?utm=1#top')
  watcher.check()
  expect(onChange).not.toHaveBeenCalled()
})

it('checks on popstate and hashchange', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  history.pushState(null, '', '/three')
  window.dispatchEvent(new Event('popstate'))
  expect(onChange).toHaveBeenCalledTimes(1)
  history.pushState(null, '', '/four')
  window.dispatchEvent(new Event('hashchange'))
  expect(onChange).toHaveBeenCalledTimes(2)
})

it('listens to the Navigation API when there is one', () => {
  const navigation = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  globalThis.navigation = navigation
  watcher = watchUrl(vi.fn())
  expect(navigation.addEventListener).toHaveBeenCalledWith('navigatesuccess', expect.any(Function))
  watcher.stop()
  expect(navigation.removeEventListener).toHaveBeenCalledWith('navigatesuccess', expect.any(Function))
  delete globalThis.navigation
})

it('stops listening', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  watcher.stop()
  history.pushState(null, '', '/five')
  window.dispatchEvent(new Event('popstate'))
  expect(onChange).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/extension/page.test.js`
Expected: FAIL. `./page.js` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/extension/browser.js`:

```js
// Firefox exposes `browser` with promises; Chromium exposes `chrome`, which also
// returns promises for the MV3 APIs used here. This is the only place they meet.
export const api = globalThis.browser ?? globalThis.chrome
```

Create `src/extension/page.js`:

```js
import { pageSource } from '../lib/annotation.js'

const BLOCKED_HOSTS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org'
])

export { pageSource }

export const stickerable = (url) => {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  // Only http(s) can be granted at all, which rules out chrome:, about:, file:,
  // view-source:, data: and both extension schemes in one check.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  return !BLOCKED_HOSTS.has(parsed.hostname)
}

// Signals only, no polling: pushState and friends are reported by the Navigation API
// where it exists, and by the background script's tab watcher where it doesn't.
export const watchUrl = (onChange) => {
  let current = pageSource()
  const offs = []

  const check = () => {
    const next = pageSource()
    if (next === current) return
    current = next
    onChange(next)
  }

  const on = (target, type) => {
    target.addEventListener(type, check)
    offs.push(() => target.removeEventListener(type, check))
  }

  on(window, 'popstate')
  on(window, 'hashchange')
  if (globalThis.navigation) on(globalThis.navigation, 'navigatesuccess')

  return {
    check,
    stop() {
      for (const off of offs) off()
      offs.length = 0
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 112 total (105 + 7).

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/browser.js src/extension/page.js src/extension/page.test.js
git commit -m "extension page identity and url watching

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 5: `storage.js`

**Files:**
- Create: `src/extension/storage.js`
- Test: `src/extension/storage.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/storage.test.js`:

```js
import { it, expect, vi, afterEach } from 'vitest'
import { extensionStorage } from './storage.js'
import { createAnnotation } from '../lib/annotation.js'

const sticker = (source) => createAnnotation({
  src: 'https://stickerpack.stucco.software/stickers/eyes.png',
  source,
  selectors: [{ type: 'CssSelector', value: 'body' }],
  x: 10,
  y: 20
})

const fakeArea = () => {
  const data = {}
  return {
    data,
    get: vi.fn(async (key) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (entries) => Object.assign(data, entries))
  }
}

afterEach(() => vi.restoreAllMocks())

it('adds and lists stickers per page', async () => {
  const storage = extensionStorage(fakeArea())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/b')
  await storage.add(a)
  await storage.add(b)
  expect(await storage.list('https://example.com/a')).toEqual([a])
  expect(await storage.list('https://example.com/b')).toEqual([b])
})

it('stores each page under stickerpack:<source>', async () => {
  const area = fakeArea()
  const a = sticker('https://example.com/a')
  await extensionStorage(area).add(a)
  expect(area.data['stickerpack:https://example.com/a']).toEqual([a])
})

it('removes a sticker by id', async () => {
  const storage = extensionStorage(fakeArea())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/a')
  await storage.add(a)
  await storage.add(b)
  await storage.remove(a)
  expect(await storage.list('https://example.com/a')).toEqual([b])
})

it('keeps both stickers when two are placed at once', async () => {
  const area = fakeArea()
  const storage = extensionStorage(area)
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/a')
  await Promise.all([storage.add(a), storage.add(b)])
  expect(await storage.list('https://example.com/a')).toEqual([a, b])
})

it('skips invalid stored entries but keeps them on write', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const area = fakeArea()
  const a = sticker('https://example.com/a')
  area.data['stickerpack:https://example.com/a'] = [{ nope: true }, a]
  const storage = extensionStorage(area)
  expect(await storage.list('https://example.com/a')).toEqual([a])
  expect(warn).toHaveBeenCalled()
  const b = sticker('https://example.com/a')
  await storage.add(b)
  expect(area.data['stickerpack:https://example.com/a']).toEqual([{ nope: true }, a, b])
})

it('treats a missing or broken entry as empty', async () => {
  const area = fakeArea()
  area.data['stickerpack:https://example.com/a'] = 'not an array'
  const storage = extensionStorage(area)
  expect(await storage.list('https://example.com/a')).toEqual([])
  expect(await storage.list('https://example.com/nothing')).toEqual([])
})

it('rejects when the write fails', async () => {
  const area = fakeArea()
  area.set = vi.fn(async () => { throw new Error('quota') })
  await expect(extensionStorage(area).add(sticker('s'))).rejects.toThrow('quota')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/extension/storage.test.js`
Expected: FAIL. `./storage.js` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/extension/storage.js`:

```js
import { isAnnotation } from '../lib/annotation.js'
import { api } from './browser.js'

const PREFIX = 'stickerpack:'

export const extensionStorage = (area = api.storage.local) => {
  // Extension storage is asynchronous, so two quick placements could both read the
  // old array and the second write would drop the first. One promise chain per key.
  const queues = new Map()

  const serialize = (key, work) => {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(work)
    queues.set(key, next)
    return next
  }

  const read = async (key) => {
    const stored = await area.get(key)
    const value = stored?.[key]
    return Array.isArray(value) ? value : []
  }

  return {
    async list(source) {
      const stored = await read(PREFIX + source)
      return stored.filter((entry) => {
        if (isAnnotation(entry)) return true
        console.warn('stickerpack: skipping invalid stored sticker', entry)
        return false
      })
    },

    add(annotation) {
      const key = PREFIX + annotation.target.source
      return serialize(key, async () => {
        const stored = await read(key)
        await area.set({ [key]: [...stored, annotation] })
      })
    },

    remove(annotation) {
      const key = PREFIX + annotation.target.source
      return serialize(key, async () => {
        const stored = await read(key)
        await area.set({ [key]: stored.filter((entry) => entry?.id !== annotation.id) })
      })
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 119 total (112 + 7).

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/storage.js src/extension/storage.test.js
git commit -m "extension storage adapter with serialized writes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 6: `pack.js`

**Files:**
- Create: `src/extension/pack.js`
- Test: `src/extension/pack.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/pack.test.js`:

```js
import { it, expect } from 'vitest'
import { resolveImage, stickerMap } from './pack.js'
import { defaultPack } from '../lib/pack.js'

const getURL = (path) => `moz-extension://abc/${path}`

it('maps every canonical pack URL to a bundled file', () => {
  const map = stickerMap(defaultPack, getURL)
  expect(map.size).toBe(defaultPack.length)
  for (const { src } of defaultPack) {
    const file = new URL(src).pathname.split('/').pop()
    expect(map.get(src)).toBe(`moz-extension://abc/stickers/${file}`)
  }
})

it('resolves a canonical URL to its bundled copy', () => {
  const map = stickerMap(defaultPack, getURL)
  const { src } = defaultPack[0]
  expect(resolveImage(map)(src)).toBe(map.get(src))
})

it('leaves unknown sticker URLs alone', () => {
  const map = stickerMap(defaultPack, getURL)
  expect(resolveImage(map)('https://example.com/mine.png')).toBe('https://example.com/mine.png')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/extension/pack.test.js`
Expected: FAIL. `./pack.js` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/extension/pack.js`:

```js
import { defaultPack } from '../lib/pack.js'
import { api } from './browser.js'

// A sticker's identity stays its canonical https URL. Only the picture comes from
// the copy bundled in the extension: no network, works offline, and extension URLs
// are the one image source exempt from a page's CSP in both browsers.
export const stickerMap = (pack = defaultPack, getURL = (path) => api.runtime.getURL(path)) => new Map(
  pack.map(({ src }) => {
    const file = new URL(src).pathname.split('/').pop()
    return [src, file ? getURL(`stickers/${file}`) : src]
  })
)

export const resolveImage = (map) => (src) => map.get(src) ?? src
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 122 total (119 + 3).

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/pack.js src/extension/pack.test.js
git commit -m "bundled sticker art, canonical identity

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 7: `content.js`

**Files:**
- Create: `src/extension/content.js`, `src/extension/content-entry.js`
- Test: `src/extension/content.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/content.test.js`:

```js
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startContent } from './content.js'

const fakeApi = () => {
  const listeners = []
  return {
    listeners,
    send: (message) => listeners.map((listener) => listener(message)),
    runtime: {
      onMessage: {
        addListener: (listener) => listeners.push(listener),
        removeListener: (listener) => listeners.splice(listeners.indexOf(listener), 1)
      }
    }
  }
}

const fakeHandle = () => {
  const handle = vi.fn()
  handle.toggle = vi.fn()
  handle.open = vi.fn()
  handle.close = vi.fn()
  return handle
}

let api
let handles
let mount
let stop

beforeEach(() => {
  globalThis.__stickerpackContentStarted = null
  history.replaceState(null, '', '/one')
  api = fakeApi()
  handles = []
  mount = vi.fn(() => {
    const handle = fakeHandle()
    handles.push(handle)
    return handle
  })
})

afterEach(() => {
  stop?.()
  stop = null
})

const start = () => {
  stop = startContent({ api, mount, storage: { list: async () => [] }, images: (src) => src })
  return stop
}

it('mounts the library with no trigger', () => {
  start()
  expect(mount).toHaveBeenCalledTimes(1)
  expect(mount.mock.calls[0][0]).toMatchObject({ trigger: 'none' })
})

it('mounts once even if the script runs twice in the same page', () => {
  start()
  start()
  expect(mount).toHaveBeenCalledTimes(1)
  expect(api.listeners).toHaveLength(1)
})

it('can mount again after a teardown', () => {
  start()
  api.send({ type: 'teardown', origin: location.origin })
  start()
  expect(mount).toHaveBeenCalledTimes(2)
})

it('toggles the tray on a toggle message', () => {
  start()
  api.send({ type: 'toggle' })
  expect(handles[0].toggle).toHaveBeenCalledTimes(1)
})

it('remounts when the path changes', () => {
  start()
  history.pushState(null, '', '/two')
  api.send({ type: 'url-changed' })
  expect(handles[0]).toHaveBeenCalledTimes(1)
  expect(mount).toHaveBeenCalledTimes(2)
})

it('does nothing when only the query changed', () => {
  start()
  history.pushState(null, '', '/one?x=1')
  api.send({ type: 'url-changed' })
  expect(mount).toHaveBeenCalledTimes(1)
})

it('tears down when its own origin is revoked', () => {
  start()
  api.send({ type: 'teardown', origin: location.origin })
  expect(handles[0]).toHaveBeenCalledTimes(1)
  expect(api.listeners).toHaveLength(0)
})

it('ignores a teardown for another origin', () => {
  start()
  api.send({ type: 'teardown', origin: 'https://elsewhere.example' })
  expect(handles[0]).not.toHaveBeenCalled()
  expect(api.listeners).toHaveLength(1)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/extension/content.test.js`
Expected: FAIL. `./content.js` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/extension/content.js`:

```js
import StickerPack from '../lib/index.js'
import { resolveImage, stickerMap } from './pack.js'
import { watchUrl } from './page.js'
import { extensionStorage } from './storage.js'

// The background may inject this script into a page that already has it, e.g. right
// after you grant a site. Isolated-world globals persist, so one flag is enough — and
// it lives here, not in the entry, so a teardown clears it and a re-grant can mount again.
const STARTED = '__stickerpackContentStarted'

export const startContent = ({
  api,
  mount = StickerPack,
  storage = extensionStorage(),
  images = resolveImage(stickerMap())
} = {}) => {
  if (globalThis[STARTED]) return globalThis[STARTED]

  const open = () => mount({ trigger: 'none', storage, resolveImage: images })

  let handle = open()

  const watcher = watchUrl(() => {
    handle()
    handle = open()
  })

  const stop = () => {
    api.runtime.onMessage.removeListener(onMessage)
    watcher.stop()
    handle()
    globalThis[STARTED] = null
  }

  function onMessage(message) {
    if (message?.type === 'toggle') handle.toggle()
    if (message?.type === 'url-changed') watcher.check()
    if (message?.type === 'teardown' && message.origin === location.origin) stop()
  }

  api.runtime.onMessage.addListener(onMessage)
  globalThis[STARTED] = stop
  return stop
}
```

Create `src/extension/content-entry.js`:

```js
import { api } from './browser.js'
import { startContent } from './content.js'

startContent({ api })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 130 total (122 + 8).

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/content.js src/extension/content-entry.js src/extension/content.test.js
git commit -m "content script mounts stickers on any granted page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 8: `background.js`

**Files:**
- Create: `src/extension/background.js`, `src/extension/background-entry.js`
- Test: `src/extension/background.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/background.test.js`:

```js
import { it, expect, vi, beforeEach } from 'vitest'
import { createBackground } from './background.js'

const GRANTED = 'https://granted.example'
const OTHER = 'https://other.example'

let api
let background

const event = () => {
  const listeners = []
  return { addListener: (listener) => listeners.push(listener), fire: (...args) => listeners.map((listener) => listener(...args)) }
}

beforeEach(() => {
  const grants = new Set([`${GRANTED}/*`])
  api = {
    grants,
    registered: [],
    permissions: {
      contains: vi.fn(async ({ origins }) => origins.every((origin) => grants.has(origin))),
      getAll: vi.fn(async () => ({ origins: [...grants] })),
      onAdded: event(),
      onRemoved: event()
    },
    scripting: {
      getRegisteredContentScripts: vi.fn(async ({ ids } = {}) =>
        api.registered.filter((script) => !ids || ids.includes(script.id))),
      registerContentScripts: vi.fn(async (scripts) => { api.registered.push(...scripts) }),
      updateContentScripts: vi.fn(async () => {}),
      unregisterContentScripts: vi.fn(async ({ ids }) => {
        api.registered = api.registered.filter((script) => !ids.includes(script.id))
      }),
      executeScript: vi.fn(async () => [])
    },
    tabs: {
      get: vi.fn(async () => ({ id: 1, url: `${GRANTED}/page` })),
      query: vi.fn(async () => [{ id: 1, url: `${GRANTED}/page` }, { id: 2 }]),
      sendMessage: vi.fn(async () => {}),
      onUpdated: event(),
      onActivated: event()
    },
    action: { setPopup: vi.fn(async () => {}), onClicked: event(), openPopup: vi.fn(async () => {}) },
    commands: { onCommand: event() },
    runtime: { onInstalled: event(), onStartup: event() }
  }
  background = createBackground(api)
})

it('toggles a granted tab', async () => {
  await background.toggle({ id: 1, url: `${GRANTED}/page` })
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'toggle' })
})

it('never injects into a site that was not granted', async () => {
  await background.toggle({ id: 2, url: `${OTHER}/page` })
  expect(api.scripting.executeScript).not.toHaveBeenCalled()
  expect(api.tabs.sendMessage).not.toHaveBeenCalled()
  expect(api.action.openPopup).toHaveBeenCalled()
})

it('injects and retries when nothing is listening yet', async () => {
  api.tabs.sendMessage.mockRejectedValueOnce(new Error('no receiver'))
  await background.toggle({ id: 1, url: `${GRANTED}/page` })
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['content.js'] })
  expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2)
})

it('registers, injects and opens the tray when a site is granted', async () => {
  api.tabs.query.mockResolvedValue([{ id: 3, url: `${OTHER}/page` }])
  await background.onAdded({ origins: [`${OTHER}/*`] })
  expect(api.registered.map((script) => script.id)).toEqual([`sp:${OTHER}`])
  expect(api.registered[0]).toMatchObject({ matches: [`${OTHER}/*`], js: ['content.js'], allFrames: false })
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: '' })
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 3 }, files: ['content.js'] })
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(3, { type: 'toggle' })
})

it('does not inject when the active tab is a different site', async () => {
  await background.onAdded({ origins: [`${OTHER}/*`] })
  expect(api.registered.map((script) => script.id)).toEqual([`sp:${OTHER}`])
  expect(api.scripting.executeScript).not.toHaveBeenCalled()
})

it('unregisters and tells every tab when a site is revoked', async () => {
  api.grants.delete(`${GRANTED}/*`)
  api.registered = [{ id: `sp:${GRANTED}` }]
  await background.onRemoved({ origins: [`${GRANTED}/*`] })
  expect(api.registered).toEqual([])
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'teardown', origin: GRANTED })
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'teardown', origin: GRANTED })
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'popup.html' })
})

it('swallows teardown messages that nothing receives', async () => {
  api.grants.delete(`${GRANTED}/*`)
  api.tabs.sendMessage.mockRejectedValue(new Error('no receiver'))
  await expect(background.onRemoved({ origins: [`${GRANTED}/*`] })).resolves.toBeUndefined()
  expect(api.scripting.executeScript).not.toHaveBeenCalled()
})

it('clears the popup only for tabs whose url it can read', async () => {
  await background.refreshPopup(1, `${GRANTED}/page`)
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: '' })
  await background.refreshPopup(2, undefined)
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: 'popup.html' })
})

it('reconciles registrations with the permissions it actually has', async () => {
  api.registered = [{ id: `sp:${OTHER}` }]
  await background.reconcile()
  expect(api.registered.map((script) => script.id)).toEqual([`sp:${GRANTED}`])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/extension/background.test.js`
Expected: FAIL. `./background.js` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/extension/background.js`:

```js
const POPUP = 'popup.html'
const CONTENT = 'content.js'

const pattern = (origin) => `${origin}/*`
const scriptId = (origin) => `sp:${origin}`
const originOfPattern = (value) => value.replace(/\/\*$/, '')

const originOf = (url) => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export const createBackground = (api) => {
  const granted = (origin) => api.permissions.contains({ origins: [pattern(origin)] })

  const setPopup = (tabId, popup) => api.action.setPopup({ tabId, popup }).catch(() => {})

  const tell = (tabId, message) => api.tabs.sendMessage(tabId, message).catch(() => {})

  const inject = (tabId) =>
    api.scripting.executeScript({ target: { tabId }, files: [CONTENT] }).catch(() => {})

  const register = async (origin) => {
    const script = {
      id: scriptId(origin),
      matches: [pattern(origin)],
      js: [CONTENT],
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true
    }
    const existing = await api.scripting
      .getRegisteredContentScripts({ ids: [script.id] })
      .catch(() => [])
    if (existing.length) await api.scripting.updateContentScripts([script])
    else await api.scripting.registerContentScripts([script])
  }

  const unregister = (origin) =>
    api.scripting.unregisterContentScripts({ ids: [scriptId(origin)] }).catch(() => {})

  // `activeTab` makes a tab's url readable on a toolbar click even for sites that were
  // never opted into, so readability is never treated as proof of a grant.
  const toggle = async (tab) => {
    const origin = originOf(tab?.url)
    if (!origin || !(await granted(origin))) {
      await api.action.openPopup?.().catch?.(() => {})
      return
    }
    try {
      await api.tabs.sendMessage(tab.id, { type: 'toggle' })
    } catch {
      await inject(tab.id)
      await tell(tab.id, { type: 'toggle' })
    }
  }

  const refreshPopup = async (tabId, url) => {
    const origin = originOf(url)
    // Only a granted origin makes a tab's url readable outside a click.
    if (origin && (await granted(origin))) await setPopup(tabId, '')
    else await setPopup(tabId, POPUP)
  }

  const onAdded = async ({ origins = [] }) => {
    for (const value of origins) {
      const origin = originOfPattern(value)
      await register(origin)
      // onAdded carries no tab, and a grant can also come from the browser's own UI.
      const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true })
      if (!tab || originOf(tab.url) !== origin) continue
      await setPopup(tab.id, '')
      await inject(tab.id)
      await tell(tab.id, { type: 'toggle' })
    }
  }

  const onRemoved = async ({ origins = [] }) => {
    for (const value of origins) {
      const origin = originOfPattern(value)
      await unregister(origin)
      // The grant is gone, so tab urls are unreadable: tell everyone and let each
      // content script decide. Tabs with nothing listening reject, and that's fine.
      const tabs = await api.tabs.query({}).catch(() => [])
      for (const tab of tabs) {
        await setPopup(tab.id, POPUP)
        await tell(tab.id, { type: 'teardown', origin })
      }
    }
  }

  const reconcile = async () => {
    // Registrations are cleared on extension update, and can drift from the grants.
    const { origins = [] } = await api.permissions.getAll()
    const wanted = origins.map(originOfPattern)
    const existing = await api.scripting.getRegisteredContentScripts().catch(() => [])
    const wantedIds = wanted.map(scriptId)
    const stale = existing.filter((script) => !wantedIds.includes(script.id)).map((script) => script.id)
    if (stale.length) await api.scripting.unregisterContentScripts({ ids: stale }).catch(() => {})
    for (const origin of wanted) await register(origin)
  }

  const onUpdated = (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' || changeInfo.url) refreshPopup(tabId, tab?.url ?? changeInfo.url)
    if (changeInfo.url) tell(tabId, { type: 'url-changed' })
  }

  const onActivated = async ({ tabId }) => {
    const tab = await api.tabs.get(tabId).catch(() => null)
    await refreshPopup(tabId, tab?.url)
  }

  const start = () => {
    api.runtime.onInstalled.addListener(reconcile)
    api.runtime.onStartup.addListener(reconcile)
    api.permissions.onAdded.addListener(onAdded)
    api.permissions.onRemoved.addListener(onRemoved)
    api.action.onClicked.addListener(toggle)
    api.commands.onCommand.addListener((command, tab) => {
      if (command === 'toggle-tray') toggle(tab)
    })
    api.tabs.onUpdated.addListener(onUpdated)
    api.tabs.onActivated.addListener(onActivated)
  }

  return { start, toggle, refreshPopup, onAdded, onRemoved, reconcile }
}
```

Create `src/extension/background-entry.js`:

```js
import { createBackground } from './background.js'
import { api } from './browser.js'

createBackground(api).start()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 139 total (130 + 9).

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/background.js src/extension/background-entry.js src/extension/background.test.js
git commit -m "background owns per-site permission and registration

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 9: Popup and options page

**Files:**
- Create: `src/extension/popup/popup.html`, `src/extension/popup/popup.js`
- Create: `src/extension/options/options.html`, `src/extension/options/options.js`
- Create: `src/extension/ui.css`

- [ ] **Step 1: Shared styles**

Create `src/extension/ui.css`:

```css
:root {
  color-scheme: light dark;
  --ink: #221e2b;
  --paper: #fbf5e9;
  --tomato: #ff5a36;
}

body {
  width: 17rem;
  margin: 0;
  padding: 1rem;
  background: var(--paper);
  color: var(--ink);
  font: 14px/1.4 system-ui, sans-serif;
}

body.options {
  width: auto;
  min-width: 22rem;
}

h1 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

p {
  margin: 0 0 0.75rem;
}

button {
  padding: 0.5rem 0.9rem;
  border: 0;
  border-radius: 99rem;
  background: var(--ink);
  color: var(--paper);
  font: inherit;
  cursor: pointer;
}

button:hover {
  background: var(--tomato);
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-top: 1px solid #0002;
}
```

- [ ] **Step 2: The popup**

Create `src/extension/popup/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="ui.css">
  </head>
  <body>
    <h1>Stickerpack</h1>
    <p id="status">…</p>
    <button id="action" type="button" hidden>Stick stickers on this site</button>
    <script src="popup.js"></script>
  </body>
</html>
```

Create `src/extension/popup/popup.js`:

```js
import { api } from '../browser.js'
import { stickerable } from '../page.js'

const status = document.querySelector('#status')
const action = document.querySelector('#action')

const start = async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url

  if (!url || !stickerable(url)) {
    status.textContent = 'This page can’t take stickers.'
    return
  }

  const { hostname, origin } = new URL(url)
  const origins = [`${origin}/*`]

  if (await api.permissions.contains({ origins })) {
    // Granted tabs normally skip this popup, but a tab open since the browser started
    // still has it, so the popup has to be able to open the tray itself.
    status.textContent = `Stickers are on for ${hostname}. Turn the site off in the extension’s options.`
    action.hidden = false
    action.textContent = 'Open the sticker tray'
    action.addEventListener('click', () => {
      api.tabs.sendMessage(tab.id, { type: 'toggle' }).finally(() => window.close())
    })
    return
  }

  status.textContent = `Stick stickers on ${hostname}?`
  action.hidden = false
  action.addEventListener('click', () => {
    // First statement, before any await: the click doesn't survive one.
    api.permissions.request({ origins }).then(
      () => window.close(),
      () => { status.textContent = 'That didn’t work. Try again?' }
    )
  })
}

start()
```

- [ ] **Step 3: The options page**

Create `src/extension/options/options.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="ui.css">
  </head>
  <body class="options">
    <h1>Sites you’ve stickered</h1>
    <p id="empty" hidden>None yet. Visit a site, hit the toolbar button, and say yes.</p>
    <ul id="sites"></ul>
    <script src="options.js"></script>
  </body>
</html>
```

Create `src/extension/options/options.js`:

```js
import { api } from '../browser.js'

const list = document.querySelector('#sites')
const empty = document.querySelector('#empty')

const render = async () => {
  const { origins = [] } = await api.permissions.getAll()
  list.replaceChildren()
  empty.hidden = origins.length > 0

  for (const value of origins) {
    const item = document.createElement('li')
    const name = document.createElement('span')
    name.textContent = value.replace(/\/\*$/, '')
    const stop = document.createElement('button')
    stop.type = 'button'
    stop.textContent = 'Stop stickering this site'
    stop.addEventListener('click', () => {
      api.permissions.remove({ origins: [value] }).then(render, render)
    })
    item.append(name, stop)
    list.append(item)
  }
}

render()
```

- [ ] **Step 4: Verify nothing broke**

Run: `npm test`
Expected: PASS, 139 total. These files have no unit tests; they're covered by the manual checklist in Task 12.

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/ui.css src/extension/popup src/extension/options
git commit -m "opt in from the popup, opt out from the options page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

## Chunk 3: Manifests, build, verification

### Task 10: `manifest.js`

**Files:**
- Create: `src/extension/manifest.js`
- Test: `src/extension/manifest.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/manifest.test.js`:

```js
import { it, expect } from 'vitest'
import { manifest } from './manifest.js'

it('asks for no host permissions up front', () => {
  for (const target of ['chrome', 'firefox']) {
    const built = manifest(target)
    expect(built.host_permissions).toBeUndefined()
    expect(built.optional_host_permissions).toEqual(['*://*/*'])
    expect(built.permissions).toEqual(['storage', 'scripting', 'activeTab'])
    expect(built.manifest_version).toBe(3)
  }
})

it('ships the pieces the extension needs', () => {
  const built = manifest('chrome')
  expect(built.action.default_popup).toBe('popup.html')
  expect(built.options_ui.page).toBe('options.html')
  expect(built.web_accessible_resources).toEqual([{ resources: ['stickers/*'], matches: ['*://*/*'] }])
  expect(built.commands['toggle-tray'].suggested_key).toEqual({
    default: 'Alt+Shift+S',
    mac: 'MacCtrl+Shift+S'
  })
})

it('differs only in how the background runs, plus the Firefox id', () => {
  const chrome = manifest('chrome')
  const firefox = manifest('firefox')
  expect(chrome.background).toEqual({ service_worker: 'background.js' })
  expect(firefox.background).toEqual({ scripts: ['background.js'] })
  expect(firefox.browser_specific_settings.gecko).toEqual({
    id: 'stickerpack@stucco.software',
    strict_min_version: '128.0'
  })
  expect(chrome.browser_specific_settings).toBeUndefined()

  const { background: _c, ...restChrome } = chrome
  const { background: _f, browser_specific_settings: _g, ...restFirefox } = firefox
  expect(restChrome).toEqual(restFirefox)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/extension/manifest.test.js`
Expected: FAIL. `./manifest.js` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/extension/manifest.js`:

```js
const shared = {
  manifest_version: 3,
  name: 'Stickerpack',
  version: '0.0.1',
  description: 'Put stickers on any website. They stay where you put them, and they stay yours.',
  permissions: ['storage', 'scripting', 'activeTab'],
  optional_host_permissions: ['*://*/*'],
  icons: { 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  action: {
    default_title: 'Stickerpack',
    default_popup: 'popup.html',
    default_icon: { 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' }
  },
  options_ui: { page: 'options.html', open_in_tab: false },
  web_accessible_resources: [{ resources: ['stickers/*'], matches: ['*://*/*'] }],
  commands: {
    'toggle-tray': {
      // Alt is Option on a Mac, and Option combinations type characters, so Mac gets Control.
      suggested_key: { default: 'Alt+Shift+S', mac: 'MacCtrl+Shift+S' },
      description: 'Open or close the sticker tray'
    }
  }
}

export const manifest = (target) => target === 'firefox'
  ? {
      ...shared,
      background: { scripts: ['background.js'] },
      browser_specific_settings: {
        // optional_host_permissions landed in Firefox 128.
        gecko: { id: 'stickerpack@stucco.software', strict_min_version: '128.0' }
      }
    }
  : { ...shared, background: { service_worker: 'background.js' } }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 142 total (139 + 3).

- [ ] **Step 5: Commit and push**

```bash
git add src/extension/manifest.js src/extension/manifest.test.js
git commit -m "per-browser manifests from one definition

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 11: Build the extension

**Files:**
- Create: `scripts/build-extension.js`
- Create: `src/extension/icons/icon-48.png`, `src/extension/icons/icon-128.png`
- Modify: `package.json`

- [ ] **Step 1: Make the icons**

The repo has no extension icons. Generate them from the eyes sticker (macOS `sips`; on Linux use `convert`):

```bash
mkdir -p src/extension/icons
sips -z 48 48 static/stickers/eyes.png --out src/extension/icons/icon-48.png
sips -z 128 128 static/stickers/eyes.png --out src/extension/icons/icon-128.png
```

Expected: two PNG files. Check with `file src/extension/icons/*.png` that they're 48×48 and 128×128.

- [ ] **Step 2: Write the build script**

Create `scripts/build-extension.js`:

```js
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
  // an extension you have loaded unpacked in a browser.
  const outDir = `dist-extension/${target}`
  await rm(outDir, { recursive: true, force: true })
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
```

- [ ] **Step 2b: Ignore the build output**

Run: `printf '\n# built extension\n/dist-extension\n' >> .gitignore`

- [ ] **Step 3: Add the npm scripts**

Run:

```bash
node -e '
const fs = require("fs")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
pkg.scripts["build:extension"] = "node scripts/build-extension.js"
pkg.scripts["dev:extension"] = "node scripts/build-extension.js --watch"
fs.writeFileSync("package.json", JSON.stringify(pkg, null, "\t") + "\n")
'
```

- [ ] **Step 4: Build and inspect**

Run: `npm run build:extension && ls dist-extension/chrome dist-extension/firefox`
Expected: each directory holds `manifest.json`, `background.js`, `content.js`, `popup.js`, `popup.html`, `options.js`, `options.html`, `ui.css`, `icons/`, `stickers/`.

Run: `node -e "const m=require('./dist-extension/firefox/manifest.json'); console.log(m.background, m.browser_specific_settings.gecko.id)"`
Expected: `{ scripts: [ 'background.js' ] } stickerpack@stucco.software`

Run: `grep -qE "^(import|export) " dist-extension/chrome/content.js && echo "NOT self-contained" || echo "self-contained"`
Expected: `self-contained` (an IIFE has no top-level imports or exports).

Run: `node --check dist-extension/chrome/background.js && node --check dist-extension/chrome/content.js && echo "parses"`
Expected: `parses`.

- [ ] **Step 5: Verify the site build leaves the extension alone**

Run: `npm run build && ls dist-extension/chrome/manifest.json`
Expected: the manifest is still there. (Before this task's `dist-extension` choice, a site build emptied `dist/` and took the extension with it.)

Run: `npm test && npm run build`
Expected: PASS, 142 total; build exits 0.

- [ ] **Step 6: Commit and push**

```bash
git add scripts/build-extension.js src/extension/icons package.json .gitignore
git commit -m "build the extension for chrome and firefox

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 12: Final verification

**Files:** none, unless a defect turns up.

- [ ] **Step 1: Full check**

Run: `npm test && npm run build && npm run build:lib && npm run build:extension`
Expected: all pass. Put the test summary line in the report.

- [ ] **Step 2: Confirm no build output is committed**

Run: `git status --short`
Expected: nothing but this plan file, if you've been ticking its checkboxes. `dist/` and `dist-extension/` are both ignored.

- [ ] **Step 3: Write the manual checklist into the final report**

happy-dom has no extension runtime, so these have to be done by hand. List them for the user:

**Chrome/Edge:** `chrome://extensions` → Developer mode → Load unpacked → `dist-extension/chrome`.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist-extension/firefox/manifest.json`.

1. On a fresh site, the toolbar button opens the popup offering to sticker the site.
2. Saying yes prompts for permission, and the tray opens without reloading.
3. Stick a few stickers. They land where you click and links don't fire.
4. Reload: the stickers are there, with no tray and no button.
5. The toolbar button toggles the tray; Esc closes it; peeling works with the tray open.
6. The keyboard shortcut (`Alt+Shift+S`, or `⌃⇧S` on Mac) does the same.
7. Navigate inside an SPA (e.g. github.com): stickers follow the page, not the route you started on.
8. On a strict-CSP site (github.com), sticker art still draws in both browsers.
9. A `chrome://` or `about:` page says it can't be stickered.
10. The options page lists the site; "Stop stickering this site" makes the stickers disappear without a reload.
11. Grant it again: the stickers come back.
12. A site you never granted has no content script (check the console, and that the toolbar shows the popup).
