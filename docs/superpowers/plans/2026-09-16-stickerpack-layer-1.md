# Stickerpack Layer 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the click-to-sticker prototype with a dependency-free JS library (`StickerPack()` plus `<sticker-pack>`) that lets visitors place, persist and peel stickers stored as W3C Web Annotations.

**Architecture:** Small single-purpose modules in `src/lib/`:
- `annotation`: the data model
- `anchor`: selectors
- `storage/local`: persistence
- `overlay`: Shadow DOM rendering
- `tray`: UI and placing
- `index`: wiring
- `element`: custom element

A separate Vite library build produces `dist/`. The SvelteKit app stays as the showcase.

**Tech Stack:** Vanilla ES modules, Vite 7 (library mode), Vitest 3 + happy-dom, SvelteKit 2 / Svelte 5 (showcase only).

**Spec:** `docs/superpowers/specs/2026-09-16-stickerpack-layer-1-design.md`

---

## Ground rules for every task

- **Trunk-based:** commit directly to `main` and `git push` after every commit. No branches, no PRs. Every commit must leave `npm test` and `npm run build` passing.
- End every commit message with a blank line and then:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Code style follows the repo: 2-space indent, no semicolons, single quotes, arrow functions.
- Tests live next to their module as `*.test.js` and run in happy-dom. happy-dom has **no layout engine** (every `getBoundingClientRect()` returns zeros), **no `document.elementsFromPoint`** and **no `document.fonts`**. Tests stub these where needed.
- Vitest is configured with `requireAssertions: true`: every test must call `expect`.

## Interface refinements (vs. spec)

These keep the spec's intent but make the interfaces precise:
- `describe(element, clientX, clientY)` returns `{ selectors, x, y }`, where `selectors` are **bare** (no `refinedBy`). `createAnnotation({ src, source, selectors, x, y })` attaches the refinement.
- `resolve(selectors)` returns an `Element | null`. Positions come from `position(annotation)`.
- `toSticker(src, base)`, `createAnnotation({ …, x, y, id, now })` and `localStorageAdapter(storage)` take extra optional arguments so tests can inject values.
- Positions are written without trailing zeros (`42.5`, not `42.50`).
- The Vitest config drops the template's `*.svelte.test` exclude; there are no Svelte component tests.
- The overlay host carries the attribute `data-stickerpack`.
- The showcase imports `$lib/index.js` at the top level rather than inside `onMount`. This is safe because no library module touches the DOM on import, and Task 7 checks it with an SSR smoke test.
- The MutationObserver needs no "ignore overlay host" filter. Shadow-root mutations are never reported to observers on `body`, and the host is appended before observation starts.

## File map

| File | Status | Responsibility |
|---|---|---|
| `vite.config.js` | modify | Vitest project `lib` in happy-dom |
| `package.json` | modify | deps, scripts, exports |
| `src/demo.spec.js` | delete | placeholder test |
| `src/lib/annotation.js` (+ test) | create | page source, sticker normalization, annotation build/validate/parse |
| `src/lib/anchor.js` (+ test) | create | normalized text, CSS path, `describe`, `resolve` |
| `src/lib/storage/local.js` (+ test) | create | localStorage adapter with memory fallback |
| `src/lib/overlay.js` (+ test) | create | shadow host, render/position/orphans, peel clicks |
| `src/lib/tray.js` (+ test) | create | trigger, tray, placing, Esc |
| `src/lib/pack.js` | create | default pack |
| `src/lib/index.js` (+ test) | replace | `StickerPack()` wiring, single instance |
| `src/lib/element.js` (+ test) | create | `<sticker-pack>` |
| `src/lib/script.js` | create | script-tag entry that defines the element |
| `vite.lib.config.js`, `vite.script.config.js` | create | library builds |
| `src/lib/helpers.js`, `src/lib/stickerpack.js` | delete | prototype |
| `src/routes/+page.svelte` | modify | use real API, fix CSS |
| `src/app.html` | modify | drop missing `/var.css` |

> **Note on uncommitted work:** `src/lib/stickerpack.js` and `src/routes/+page.svelte` have uncommitted prototype edits. Task 7 deletes the former and rewrites the latter. The rewrite keeps the `<main>` wrapper and layout styles from those edits. Do not `git stash` or `git checkout` them away before Task 7, and do not commit them separately.

---

## Chunk 1: Foundations (tooling, data model, anchoring, storage)

### Task 1: Test tooling and `annotation.js`

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json` (via npm)
- Delete: `src/demo.spec.js`
- Create: `src/lib/annotation.js`
- Test: `src/lib/annotation.test.js`

- [ ] **Step 1: Install happy-dom**

Run: `npm install -D happy-dom@^20`
Expected: `package.json` devDependencies gains `happy-dom`.

- [ ] **Step 2: Point Vitest at happy-dom**

Replace the `test` block in `vite.config.js` so the file reads:

```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'lib',
					environment: 'happy-dom',
					include: ['src/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
```

- [ ] **Step 3: Delete the placeholder test**

Run: `git rm -q src/demo.spec.js` (this stages the deletion, so the Step 9 commit includes it)

- [ ] **Step 4: Write the failing tests**

Create `src/lib/annotation.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  pageSource,
  altFromUrl,
  toSticker,
  createAnnotation,
  isAnnotation,
  position
} from './annotation.js'

const selectors = [
  { type: 'CssSelector', value: 'body > p:nth-child(1)' },
  { type: 'TextQuoteSelector', exact: 'Hello world' }
]

const refinedBy = {
  type: 'FragmentSelector',
  conformsTo: 'http://www.w3.org/TR/media-frags/',
  value: 'xywh=percent:42.5,61.25,0,0'
}

const make = (overrides = {}) => createAnnotation({
  src: 'https://stickers.stucco.software/eyes.png',
  source: 'https://example.com/about',
  selectors,
  x: 42.5,
  y: 61.25,
  id: '5974d4a4-4b44-4c2d-a9f5-fbccc8da2760',
  now: new Date('2026-09-16T18:04:00Z'),
  ...overrides
})

describe('pageSource', () => {
  it('keeps only origin and pathname', () => {
    expect(pageSource(new URL('https://example.com/about/?utm=1#top'))).toBe('https://example.com/about/')
  })
})

describe('altFromUrl', () => {
  it('derives alt text from the file name', () => {
    expect(altFromUrl('https://example.com/stickers/big-duck_face.png')).toBe('big duck face')
  })
})

describe('toSticker', () => {
  it('resolves relative URLs against the page', () => {
    expect(toSticker('/stickers/duck.png', 'https://example.com/a/b')).toEqual({
      src: 'https://example.com/stickers/duck.png',
      alt: 'duck'
    })
  })
})

describe('createAnnotation', () => {
  it('builds a Web Annotation', () => {
    expect(make()).toEqual({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: 'urn:uuid:5974d4a4-4b44-4c2d-a9f5-fbccc8da2760',
      type: 'Annotation',
      motivation: 'tagging',
      created: '2026-09-16T18:04:00.000Z',
      body: { id: 'https://stickers.stucco.software/eyes.png', type: 'Image' },
      target: {
        source: 'https://example.com/about',
        selector: [
          { ...selectors[0], refinedBy },
          { ...selectors[1], refinedBy }
        ]
      }
    })
  })

  it('generates a uuid by default', () => {
    const annotation = createAnnotation({ src: 'https://x.test/a.png', source: 's', selectors, x: 1, y: 2 })
    expect(annotation.id).toMatch(/^urn:uuid:[0-9a-f-]{36}$/)
  })
})

describe('isAnnotation', () => {
  it('accepts a built annotation', () => {
    expect(isAnnotation(make())).toBe(true)
  })

  it('accepts one that survived JSON', () => {
    expect(isAnnotation(JSON.parse(JSON.stringify(make())))).toBe(true)
  })

  it('rejects malformed values', () => {
    const valid = make()
    expect(isAnnotation(null)).toBe(false)
    expect(isAnnotation({})).toBe(false)
    expect(isAnnotation({ ...valid, body: { id: '/relative.png', type: 'Image' } })).toBe(false)
    expect(isAnnotation({ ...valid, target: { ...valid.target, selector: [] } })).toBe(false)
    expect(isAnnotation({ ...valid, target: { ...valid.target, selector: [{ type: 'CssSelector', value: 'body' }] } })).toBe(false)
    expect(isAnnotation({ ...valid, target: { ...valid.target, selector: [{ type: 'XPathSelector', value: '/', refinedBy }] } })).toBe(false)
  })
})

describe('position', () => {
  it('returns bare selectors and the position', () => {
    expect(position(make())).toEqual({ selectors, x: 42.5, y: 61.25 })
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/lib/annotation.test.js`
Expected: FAIL. The import of `./annotation.js` cannot be resolved.

- [ ] **Step 6: Implement `annotation.js`**

Create `src/lib/annotation.js`:

```js
const CONTEXT = 'http://www.w3.org/ns/anno.jsonld'
const MEDIA_FRAGMENTS = 'http://www.w3.org/TR/media-frags/'
const XYWH = /^xywh=percent:([^,]+),([^,]+),/

export const pageSource = (loc = location) => loc.origin + loc.pathname

export const altFromUrl = (src) => {
  const file = decodeURIComponent(new URL(src).pathname.split('/').pop() ?? '')
  return file.replace(/\.[^.]*$/, '').replace(/[-_]/g, ' ')
}

export const toSticker = (src, base = location.href) => {
  const absolute = new URL(src, base).href
  return { src: absolute, alt: altFromUrl(absolute) }
}

const refinement = (x, y) => ({
  type: 'FragmentSelector',
  conformsTo: MEDIA_FRAGMENTS,
  value: `xywh=percent:${x},${y},0,0`
})

export const createAnnotation = ({
  src,
  source,
  selectors,
  x,
  y,
  id = crypto.randomUUID(),
  now = new Date()
}) => ({
  '@context': CONTEXT,
  id: `urn:uuid:${id}`,
  type: 'Annotation',
  motivation: 'tagging',
  created: now.toISOString(),
  body: { id: src, type: 'Image' },
  target: {
    source,
    selector: selectors.map((selector) => ({ ...selector, refinedBy: refinement(x, y) }))
  }
})

const parseRefinement = (selector) => {
  const refinedBy = selector?.refinedBy
  if (refinedBy?.type !== 'FragmentSelector' || typeof refinedBy.value !== 'string') return null
  const match = XYWH.exec(refinedBy.value)
  if (!match) return null
  const x = Number(match[1])
  const y = Number(match[2])
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

const isAbsoluteUrl = (value) => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const isSelector = (selector) =>
  ((selector?.type === 'CssSelector' && typeof selector.value === 'string') ||
    (selector?.type === 'TextQuoteSelector' && typeof selector.exact === 'string')) &&
  parseRefinement(selector) !== null

export const isAnnotation = (value) =>
  !!value &&
  typeof value.id === 'string' &&
  typeof value.body?.id === 'string' &&
  isAbsoluteUrl(value.body.id) &&
  typeof value.target?.source === 'string' &&
  Array.isArray(value.target.selector) &&
  value.target.selector.length > 0 &&
  value.target.selector.every(isSelector)

export const position = (annotation) => {
  const { x, y } = parseRefinement(annotation.target.selector[0])
  const selectors = annotation.target.selector.map(({ refinedBy, ...selector }) => selector)
  return { selectors, x, y }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 9 tests in `src/lib/annotation.test.js`. If Vitest fails to start because of the SvelteKit plugin in happy-dom, run `npx svelte-kit sync` first and retry.

- [ ] **Step 8: Verify the showcase still builds**

Run: `npm run build`
Expected: exits 0. The existing `prepack` still runs `svelte-package` and `publint`, which is fine for now.

- [ ] **Step 9: Commit and push**

```bash
git add vite.config.js package.json package-lock.json src/lib/annotation.js src/lib/annotation.test.js
git commit -m "sticker annotation model

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 2: `anchor.js`

**Files:**
- Create: `src/lib/anchor.js`
- Test: `src/lib/anchor.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/anchor.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { describe as describeTarget, resolve, cssPath, normalizedText } from './anchor.js'

const setRect = (element, left, top, width, height) => {
  element.getBoundingClientRect = () => ({
    left, top, width, height, x: left, y: top, right: left + width, bottom: top + height
  })
}

let main, h1, p, em, img, circle

beforeEach(() => {
  // document.body survives between tests, so drop any stubbed rect
  delete document.body.getBoundingClientRect
  document.body.innerHTML = `
    <main>
      <h1>Stickers, for Websites</h1>
      <p>Only the <em>finest</em>   stickers, for your website. <script>var ignored = 1</script>Enjoy.</p>
      <img alt="">
      <svg><circle r="1"></circle></svg>
    </main>`
  main = document.querySelector('main')
  h1 = document.querySelector('h1')
  p = document.querySelector('p')
  em = document.querySelector('em')
  img = document.querySelector('img')
  circle = document.querySelector('circle')
})

describe('normalizedText', () => {
  it('collapses whitespace and skips script text', () => {
    expect(normalizedText(p)).toBe('Only the finest stickers, for your website. Enjoy.')
  })

  it('truncates to a limit', () => {
    expect(normalizedText(p, 12)).toBe('Only the fin')
  })
})

describe('cssPath', () => {
  it('uses localName and nth-child from body', () => {
    expect(cssPath(p)).toBe('body > main:nth-child(1) > p:nth-child(2)')
    expect(cssPath(circle)).toBe('body > main:nth-child(1) > svg:nth-child(4) > circle:nth-child(1)')
    expect(cssPath(document.body)).toBe('body')
  })
})

describe('describe', () => {
  it('records a css path, a quote and a percentage position', () => {
    setRect(p, 100, 200, 400, 100)
    expect(describeTarget(p, 200, 250)).toEqual({
      selectors: [
        { type: 'CssSelector', value: 'body > main:nth-child(1) > p:nth-child(2)' },
        { type: 'TextQuoteSelector', exact: 'Only the finest stickers, for yo' }
      ],
      x: 25,
      y: 50
    })
  })

  it('rounds positions to two decimals', () => {
    setRect(p, 0, 0, 3, 3)
    const { x, y } = describeTarget(p, 1, 2)
    expect([x, y]).toEqual([33.33, 66.67])
  })

  it('omits the quote for elements without text', () => {
    setRect(img, 0, 0, 10, 10)
    expect(describeTarget(img, 5, 5).selectors).toEqual([
      { type: 'CssSelector', value: 'body > main:nth-child(1) > img:nth-child(3)' }
    ])
  })

  it('anchors clicks on <html> to <body>', () => {
    setRect(document.body, 0, 0, 800, 600)
    const result = describeTarget(document.documentElement, 400, 300)
    expect(result.selectors[0]).toEqual({ type: 'CssSelector', value: 'body' })
    expect([result.x, result.y]).toEqual([50, 50])
  })

  it('walks up from zero-size elements', () => {
    setRect(main, 0, 0, 800, 400)
    expect(describeTarget(em, 400, 100).selectors[0].value).toBe('body > main:nth-child(1)')
  })

  it('does not divide by zero when nothing has size', () => {
    const { x, y } = describeTarget(em, 10, 10)
    expect([x, y]).toEqual([50, 50])
  })
})

describe('resolve', () => {
  it('round-trips describe', () => {
    setRect(p, 0, 0, 100, 100)
    expect(resolve(describeTarget(p, 1, 1).selectors)).toBe(p)
  })

  it('finds the element by quote after siblings are inserted', () => {
    setRect(p, 0, 0, 100, 100)
    const { selectors } = describeTarget(p, 1, 1)
    main.prepend(document.createElement('div'))
    expect(resolve(selectors)).toBe(p)
  })

  it('rejects a css match whose text changed and falls back to the quote', () => {
    setRect(p, 0, 0, 100, 100)
    const { selectors } = describeTarget(p, 1, 1)
    const impostor = document.createElement('p')
    impostor.textContent = 'Something else entirely'
    h1.replaceWith(impostor)
    main.prepend(h1)
    expect(document.querySelector(selectors[0].value)).toBe(impostor)
    expect(resolve(selectors)).toBe(p)
  })

  it('returns null when nothing matches', () => {
    setRect(p, 0, 0, 100, 100)
    const { selectors } = describeTarget(p, 1, 1)
    p.remove()
    expect(resolve(selectors)).toBe(null)
  })

  it('resolves text-less elements by css alone', () => {
    setRect(img, 0, 0, 10, 10)
    expect(resolve(describeTarget(img, 1, 1).selectors)).toBe(img)
  })

  it('prefers the deepest element whose text starts with the quote', () => {
    document.body.innerHTML = '<a href="#"><span>Hi there</span></a>'
    expect(resolve([{ type: 'TextQuoteSelector', exact: 'Hi there' }])).toBe(document.querySelector('span'))
  })

  it('treats an invalid css selector as no match', () => {
    expect(resolve([{ type: 'CssSelector', value: '<<' }])).toBe(null)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/anchor.test.js`
Expected: FAIL. `./anchor.js` cannot be resolved.

- [ ] **Step 3: Implement `anchor.js`**

Create `src/lib/anchor.js`:

```js
const QUOTE_LENGTH = 32
const SKIP = new Set(['script', 'style', 'noscript', 'template'])

const collapse = (text) => text.replace(/\s+/g, ' ').trim()

export const normalizedText = (root, limit = Infinity) => {
  let text = ''
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        text += child.data
        if (limit !== Infinity && collapse(text).length > limit) return true
      } else if (child.nodeType === 1 && !SKIP.has(child.localName)) {
        if (walk(child)) return true
      }
    }
    return false
  }
  walk(root)
  return collapse(text).slice(0, limit)
}

export const cssPath = (element) => {
  const body = element.ownerDocument.body
  const steps = []
  for (let node = element; node !== body; node = node.parentElement) {
    const index = Array.prototype.indexOf.call(node.parentElement.children, node) + 1
    steps.unshift(`${node.localName}:nth-child(${index})`)
  }
  return ['body', ...steps].join(' > ')
}

const hasSize = (element) => {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

const anchorFor = (element) => {
  const body = element.ownerDocument.body
  let anchor = element !== body && body.contains(element) ? element : body
  while (anchor !== body && !hasSize(anchor)) anchor = anchor.parentElement
  return anchor
}

const percent = (offset, size) => size > 0 ? Math.round(offset / size * 10000) / 100 : 50

export const describe = (element, clientX, clientY) => {
  const anchor = anchorFor(element)
  const rect = anchor.getBoundingClientRect()
  const selectors = [{ type: 'CssSelector', value: cssPath(anchor) }]
  const exact = normalizedText(anchor, QUOTE_LENGTH)
  if (exact) selectors.push({ type: 'TextQuoteSelector', exact })
  return {
    selectors,
    x: percent(clientX - rect.left, rect.width),
    y: percent(clientY - rect.top, rect.height)
  }
}

const depth = (element) => {
  let count = 0
  for (let node = element; node.parentElement; node = node.parentElement) count++
  return count
}

export const resolve = (selectors, doc = document) => {
  const css = selectors.find((selector) => selector.type === 'CssSelector')
  const quote = selectors.find((selector) => selector.type === 'TextQuoteSelector')?.exact
  const matches = (element) => !quote || normalizedText(element, quote.length) === quote

  if (css) {
    let element = null
    try {
      element = doc.querySelector(css.value)
    } catch {
      element = null
    }
    if (element && matches(element)) return element
  }

  if (!quote) return null

  const candidates = Array.from(doc.body.querySelectorAll('*'))
    .filter((element) => !SKIP.has(element.localName))
    .map((element, order) => ({ element, order, depth: depth(element) }))
    .sort((a, b) => b.depth - a.depth || a.order - b.order)

  return candidates.find(({ element }) => matches(element))?.element ?? null
}
```

Notes:
- `anchorFor` treats `<html>`, and anything outside `<body>`, as `<body>`.
- `percent` returns 50 for zero-size anchors so nothing is ever `NaN`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 16 tests in `anchor.test.js`, 25 total.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/anchor.js src/lib/anchor.test.js
git commit -m "sticker anchoring with css and text quote selectors

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 3: `storage/local.js`

**Files:**
- Create: `src/lib/storage/local.js`
- Test: `src/lib/storage/local.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/storage/local.test.js`:

```js
import { it, expect, vi, afterEach } from 'vitest'
import { localStorageAdapter } from './local.js'
import { createAnnotation } from '../annotation.js'

const sticker = (source) => createAnnotation({
  src: 'https://stickers.stucco.software/eyes.png',
  source,
  selectors: [{ type: 'CssSelector', value: 'body' }],
  x: 10,
  y: 20
})

const fakeStorage = () => {
  const map = new Map()
  return {
    map,
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)) }
  }
}

afterEach(() => vi.restoreAllMocks())

it('adds and lists stickers per page', async () => {
  const storage = localStorageAdapter(fakeStorage())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/b')
  await storage.add(a)
  await storage.add(b)
  expect(await storage.list('https://example.com/a')).toEqual([a])
  expect(await storage.list('https://example.com/b')).toEqual([b])
})

it('stores each page under stickerpack:<source>', async () => {
  const backend = fakeStorage()
  const a = sticker('https://example.com/a')
  await localStorageAdapter(backend).add(a)
  expect(JSON.parse(backend.map.get('stickerpack:https://example.com/a'))).toEqual([a])
})

it('removes a sticker by id', async () => {
  const storage = localStorageAdapter(fakeStorage())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/a')
  await storage.add(a)
  await storage.add(b)
  await storage.remove(a)
  expect(await storage.list('https://example.com/a')).toEqual([b])
})

it('skips invalid stored entries', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const backend = fakeStorage()
  const a = sticker('s')
  backend.setItem('stickerpack:s', JSON.stringify([a, { nope: true }]))
  expect(await localStorageAdapter(backend).list('s')).toEqual([a])
  expect(warn).toHaveBeenCalled()
})

it('treats unreadable JSON as empty', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const backend = fakeStorage()
  backend.setItem('stickerpack:s', '{nope')
  expect(await localStorageAdapter(backend).list('s')).toEqual([])
  expect(warn).toHaveBeenCalled()
})

it('falls back to memory once when storage throws', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const broken = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') }
  }
  const storage = localStorageAdapter(broken)
  const a = sticker('s')
  await storage.add(a)
  expect(await storage.list('s')).toEqual([a])
  expect(warn).toHaveBeenCalledTimes(1)
})

it('uses window.localStorage by default', async () => {
  localStorage.clear()
  const a = sticker('s')
  await localStorageAdapter().add(a)
  expect(JSON.parse(localStorage.getItem('stickerpack:s'))).toEqual([a])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/storage/local.test.js`
Expected: FAIL. `./local.js` cannot be resolved.

- [ ] **Step 3: Implement the adapter**

Create `src/lib/storage/local.js`:

```js
import { isAnnotation } from '../annotation.js'

const PREFIX = 'stickerpack:'

const memoryStorage = () => {
  const map = new Map()
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)) }
  }
}

export const localStorageAdapter = (storage) => {
  let backend = null
  let inMemory = false

  const fallBack = (error) => {
    console.warn('stickerpack: localStorage is unavailable, stickers will not persist.', error)
    backend = memoryStorage()
    inMemory = true
  }

  try {
    backend = storage ?? globalThis.localStorage ?? null
  } catch (error) {
    backend = null
  }
  if (!backend) fallBack()

  const attempt = (operation) => {
    try {
      return operation(backend)
    } catch (error) {
      if (inMemory) throw error
      fallBack(error)
      return operation(backend)
    }
  }

  const read = (source) => {
    const raw = attempt((store) => store.getItem(PREFIX + source))
    if (raw == null) return []
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      console.warn('stickerpack: ignoring unreadable stickers for', source, error)
      return []
    }
    if (!Array.isArray(parsed)) {
      console.warn('stickerpack: ignoring unreadable stickers for', source)
      return []
    }
    return parsed.filter((entry) => {
      if (isAnnotation(entry)) return true
      console.warn('stickerpack: skipping invalid stored sticker', entry)
      return false
    })
  }

  const write = (source, annotations) =>
    attempt((store) => store.setItem(PREFIX + source, JSON.stringify(annotations)))

  return {
    async list(source) {
      return read(source)
    },
    async add(annotation) {
      const source = annotation.target.source
      write(source, [...read(source), annotation])
    },
    async remove(annotation) {
      const source = annotation.target.source
      write(source, read(source).filter((entry) => entry.id !== annotation.id))
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 7 tests in `local.test.js`, 32 total.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/storage/local.js src/lib/storage/local.test.js
git commit -m "localStorage sticker adapter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

## Chunk 2: Rendering, UI, wiring, packaging

### Task 4: `overlay.js`

**Files:**
- Create: `src/lib/overlay.js`
- Test: `src/lib/overlay.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overlay.test.js`:

```js
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOverlay } from './overlay.js'
import { createAnnotation } from './annotation.js'

const SRC = 'https://stickers.stucco.software/eyes.png'

const annotationAt = (value) => createAnnotation({
  src: SRC,
  source: 's',
  selectors: [{ type: 'CssSelector', value }],
  x: 50,
  y: 50
})

const nextFrame = () => new Promise((done) => requestAnimationFrame(() => done()))
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

let overlay
const stickers = () => overlay.root.querySelectorAll('.sticker')

beforeEach(() => {
  document.body.innerHTML = '<p>Hello sticker world</p>'
  overlay = createOverlay()
})

afterEach(() => overlay.destroy())

it('mounts a shadow host at the end of body', () => {
  expect(document.body.lastElementChild).toBe(overlay.host)
  expect(overlay.host.hasAttribute('data-stickerpack')).toBe(true)
  expect(overlay.host.shadowRoot).toBe(overlay.root)
})

it('renders stickers whose anchor resolves', () => {
  overlay.render(annotationAt('body > p:nth-child(1)'))
  expect(stickers()).toHaveLength(1)
  expect(stickers()[0].getAttribute('src')).toBe(SRC)
})

it('does not render the same annotation twice', () => {
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  overlay.render(annotation)
  expect(stickers()).toHaveLength(1)
})

it('keeps unresolvable stickers orphaned', () => {
  overlay.render(annotationAt('body > section:nth-child(9)'))
  expect(stickers()).toHaveLength(0)
})

it('unrenders stickers', () => {
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  overlay.unrender(annotation.id)
  expect(stickers()).toHaveLength(0)
})

it('reports clicks only while peelable', () => {
  const onClick = vi.fn()
  overlay.onStickerClick(onClick)
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  stickers()[0].click()
  expect(onClick).not.toHaveBeenCalled()
  overlay.setPeelable(true)
  stickers()[0].click()
  expect(onClick).toHaveBeenCalledWith(annotation)
})

it('positions stickers relative to the layer', async () => {
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 40 })
  overlay.root.querySelector('.layer').getBoundingClientRect = () => ({ left: 10, top: -30, width: 0, height: 0 })
  overlay.render(annotationAt('body > p:nth-child(1)'))
  await nextFrame()
  await nextFrame()
  expect(stickers()[0].style.left).toBe('190px')
  expect(stickers()[0].style.top).toBe('100px')
})

it('renders orphans once their content appears', async () => {
  overlay.render(annotationAt('body > section:nth-child(2)'))
  expect(stickers()).toHaveLength(0)
  document.body.insertBefore(document.createElement('section'), overlay.host)
  await wait(400)
  expect(stickers()).toHaveLength(1)
})

it('orphans stickers whose anchor is removed', async () => {
  overlay.render(annotationAt('body > p:nth-child(1)'))
  document.querySelector('p').remove()
  await wait(50)
  await nextFrame()
  expect(stickers()).toHaveLength(0)
})

it('destroy removes the host', () => {
  overlay.destroy()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/overlay.test.js`
Expected: FAIL. `./overlay.js` cannot be resolved.

- [ ] **Step 3: Implement the overlay**

Create `src/lib/overlay.js`:

```js
import { resolve } from './anchor.js'
import { position } from './annotation.js'

const ORPHAN_DEBOUNCE = 250

const STYLE = `
.layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: visible;
  z-index: 2147483646;
  pointer-events: none;
}
.sticker {
  position: absolute;
  box-sizing: border-box;
  width: 4rem;
  height: 4rem;
  max-width: none;
  margin: 0;
  padding: 0;
  border: 0;
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
  user-select: none;
}
.sticker[hidden] {
  display: none;
}
.peelable .sticker {
  pointer-events: auto;
  cursor: not-allowed;
}
`

export const createOverlay = () => {
  const host = document.createElement('div')
  host.setAttribute('data-stickerpack', '')
  host.style.cssText = 'all: initial; display: block;'
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLE
  const layer = document.createElement('div')
  layer.className = 'layer'
  root.append(style, layer)
  document.body.append(host)

  const entries = new Map()
  let clickHandler = null
  let frame = 0
  let timer = 0
  let destroyed = false

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null

  const attach = (entry) => {
    entry.element = resolve(entry.selectors)
    if (!entry.element) return
    layer.append(entry.img)
    resizeObserver?.observe(entry.element)
  }

  const detach = (entry) => {
    const element = entry.element
    entry.element = null
    entry.img.remove()
    if (!resizeObserver || !element) return
    for (const other of entries.values()) if (other.element === element) return
    resizeObserver.unobserve(element)
  }

  const reposition = () => {
    frame = 0
    if (destroyed) return
    const origin = layer.getBoundingClientRect()
    for (const entry of entries.values()) {
      if (entry.element && !entry.element.isConnected) detach(entry)
      if (!entry.element) continue
      const rect = entry.element.getBoundingClientRect()
      entry.img.style.left = `${rect.left - origin.left + rect.width * entry.x / 100}px`
      entry.img.style.top = `${rect.top - origin.top + rect.height * entry.y / 100}px`
    }
  }

  const schedule = () => {
    if (!frame && !destroyed) frame = requestAnimationFrame(reposition)
  }

  const resolveOrphans = () => {
    timer = 0
    if (destroyed) return
    for (const entry of entries.values()) if (!entry.element) attach(entry)
    schedule()
  }

  const mutationObserver = new MutationObserver(() => {
    schedule()
    clearTimeout(timer)
    timer = setTimeout(resolveOrphans, ORPHAN_DEBOUNCE)
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
  resizeObserver?.observe(document.documentElement)
  window.addEventListener('resize', schedule)
  document.fonts?.ready.then(schedule)

  return {
    root,
    host,

    render(annotation) {
      if (destroyed || entries.has(annotation.id)) return
      const img = document.createElement('img')
      img.className = 'sticker'
      img.alt = ''
      img.draggable = false
      img.addEventListener('error', () => { img.hidden = true })
      img.addEventListener('click', (event) => {
        if (!layer.classList.contains('peelable')) return
        event.preventDefault()
        event.stopPropagation()
        clickHandler?.(annotation)
      })
      img.src = annotation.body.id
      const entry = { annotation, img, element: null, ...position(annotation) }
      entries.set(annotation.id, entry)
      attach(entry)
      schedule()
    },

    unrender(id) {
      const entry = entries.get(id)
      if (!entry) return
      entries.delete(id)
      detach(entry)
    },

    setPeelable(peelable) {
      layer.classList.toggle('peelable', Boolean(peelable))
    },

    onStickerClick(handler) {
      clickHandler = handler
    },

    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', schedule)
      entries.clear()
      host.remove()
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run build`
Expected: PASS, 10 tests in `overlay.test.js`, 42 total; build exits 0. If a timing-based test is flaky under happy-dom, raise its `wait` and do not change the implementation's timing.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/overlay.js src/lib/overlay.test.js
git commit -m "shadow dom sticker overlay

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 5: `tray.js`

**Files:**
- Create: `src/lib/tray.js`
- Test: `src/lib/tray.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tray.test.js`:

```js
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTray } from './tray.js'

const stickers = [{ src: 'https://stickers.stucco.software/eyes.png', alt: 'Googly eyes' }]

let host, root, tray, calls

const $ = (selector) => root.querySelector(selector)
const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
const clickCapture = (clientX, clientY) =>
  $('.capture').dispatchEvent(new MouseEvent('click', { clientX, clientY, bubbles: true }))

const setup = (options = {}) => {
  host = document.createElement('div')
  document.body.append(host)
  root = host.attachShadow({ mode: 'open' })
  calls = { onOpen: vi.fn(), onClose: vi.fn(), onPlace: vi.fn() }
  tray = createTray({ root, host, stickers, ...calls, ...options })
}

beforeEach(() => {
  document.body.innerHTML = '<a href="#elsewhere">a link</a>'
})

afterEach(() => {
  tray.destroy()
  delete document.elementsFromPoint
})

it('renders a floating trigger and a hidden tray of stickers', () => {
  setup()
  expect($('.trigger')).not.toBe(null)
  expect($('.tray').hidden).toBe(true)
  expect($('.tray button img').getAttribute('alt')).toBe('Googly eyes')
})

it('toggles the tray with the trigger', () => {
  setup()
  $('.trigger').click()
  expect($('.tray').hidden).toBe(false)
  expect(calls.onOpen).toHaveBeenCalledTimes(1)
  $('.trigger').click()
  expect($('.tray').hidden).toBe(true)
  expect(calls.onClose).toHaveBeenCalledTimes(1)
})

it('closes the tray on Escape', () => {
  setup()
  $('.trigger').click()
  escape()
  expect($('.tray').hidden).toBe(true)
  expect(calls.onClose).toHaveBeenCalledTimes(1)
})

it('places a sticker on the page element under the click', () => {
  setup()
  const link = document.querySelector('a')
  document.elementsFromPoint = vi.fn(() => [host, link, document.body, document.documentElement])
  $('.trigger').click()
  $('.tray button').click()
  expect(calls.onClose).toHaveBeenCalledTimes(1)
  expect($('.capture').hidden).toBe(false)
  clickCapture(10, 20)
  expect(document.elementsFromPoint).toHaveBeenCalledWith(10, 20)
  expect(calls.onPlace).toHaveBeenCalledWith({ src: stickers[0].src, element: link, clientX: 10, clientY: 20 })
  expect($('.capture').hidden).toBe(true)
})

it('cancels placing with Escape', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  escape()
  expect($('.capture').hidden).toBe(true)
  expect(calls.onPlace).not.toHaveBeenCalled()
})

it('cancels placing with the floating trigger without reopening the tray', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  $('.trigger').click()
  expect($('.capture').hidden).toBe(true)
  expect($('.tray').hidden).toBe(true)
  expect(calls.onOpen).toHaveBeenCalledTimes(1)
})

it('uses an owner trigger instead of the floating one', () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  setup({ trigger })
  expect($('.trigger')).toBe(null)
  trigger.click()
  expect($('.tray').hidden).toBe(false)
})

it('cancels placing when the owner trigger is under the click', () => {
  const trigger = document.createElement('button')
  trigger.innerHTML = '<span>Stickers</span>'
  document.body.append(trigger)
  setup({ trigger })
  document.elementsFromPoint = vi.fn(() => [host, trigger.firstChild, trigger, document.body])
  trigger.click()
  $('.tray button').click()
  clickCapture(1, 1)
  expect(calls.onPlace).not.toHaveBeenCalled()
  expect($('.capture').hidden).toBe(true)
})

it('destroy removes its elements and listeners', () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  setup({ trigger })
  tray.destroy()
  trigger.click()
  expect(calls.onOpen).not.toHaveBeenCalled()
  expect(root.querySelector('.tray')).toBe(null)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tray.test.js`
Expected: FAIL. `./tray.js` cannot be resolved.

- [ ] **Step 3: Implement the tray**

Create `src/lib/tray.js`:

```js
const STYLE = `
.trigger {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 2147483647;
  width: 3rem;
  height: 3rem;
  border: 0;
  border-radius: 50%;
  background: #111;
  color: #fff;
  font: 1.25rem/1 system-ui, sans-serif;
  cursor: pointer;
}
.tray {
  position: fixed;
  right: 1rem;
  bottom: 4.5rem;
  z-index: 2147483647;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  max-width: min(24rem, calc(100vw - 2rem));
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 0.75rem;
}
.tray button {
  width: 3rem;
  height: 3rem;
  padding: 0.25rem;
  border: 0;
  background: none;
  cursor: pointer;
}
.tray img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.capture {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  cursor: crosshair;
}
.ghost {
  position: fixed;
  z-index: 2147483647;
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  opacity: 0.6;
  pointer-events: none;
  transform: translate(-50%, -50%);
}
[hidden] {
  display: none !important;
}
`

export const createTray = ({ root, host, stickers, trigger, onOpen, onClose, onPlace }) => {
  let state = 'idle'
  let chosen = null
  let destroyed = false

  const style = document.createElement('style')
  style.textContent = STYLE

  const floating = trigger ? null : document.createElement('button')
  if (floating) {
    floating.className = 'trigger'
    floating.type = 'button'
    floating.textContent = '✦'
    floating.setAttribute('aria-label', 'Stickers')
    floating.setAttribute('aria-expanded', 'false')
  }
  const triggerElement = trigger ?? floating

  const tray = document.createElement('div')
  tray.className = 'tray'
  tray.hidden = true

  const capture = document.createElement('div')
  capture.className = 'capture'
  capture.hidden = true

  const ghost = document.createElement('img')
  ghost.className = 'ghost'
  ghost.alt = ''
  ghost.hidden = true

  const open = () => {
    state = 'open'
    tray.hidden = false
    floating?.setAttribute('aria-expanded', 'true')
    onOpen?.()
  }

  const close = () => {
    state = 'idle'
    tray.hidden = true
    floating?.setAttribute('aria-expanded', 'false')
    onClose?.()
  }

  const stopPlacing = () => {
    state = 'idle'
    chosen = null
    capture.hidden = true
    ghost.hidden = true
  }

  const choose = (sticker) => {
    close()
    state = 'placing'
    chosen = sticker
    ghost.src = sticker.src
    capture.hidden = false
  }

  for (const sticker of stickers) {
    const button = document.createElement('button')
    button.type = 'button'
    const img = document.createElement('img')
    img.src = sticker.src
    img.alt = sticker.alt
    img.draggable = false
    button.append(img)
    button.addEventListener('click', () => choose(sticker))
    tray.append(button)
  }

  const toggle = () => {
    if (state === 'idle') open()
    else if (state === 'open') close()
    else stopPlacing()
  }

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return
    ghost.hidden = false
    ghost.style.left = `${event.clientX}px`
    ghost.style.top = `${event.clientY}px`
  }

  const onCaptureClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const sticker = chosen
    const element = document.elementsFromPoint(event.clientX, event.clientY)
      .find((candidate) => candidate !== host && candidate.getRootNode() === document)
    stopPlacing()
    if (!sticker || !element) return
    if (trigger && trigger.contains(element)) return
    onPlace?.({ src: sticker.src, element, clientX: event.clientX, clientY: event.clientY })
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return
    if (state === 'open') close()
    else if (state === 'placing') stopPlacing()
  }

  root.append(style, capture, ghost, tray, ...(floating ? [floating] : []))
  triggerElement.addEventListener('click', toggle)
  capture.addEventListener('pointermove', onPointerMove)
  capture.addEventListener('click', onCaptureClick)
  document.addEventListener('keydown', onKeyDown)

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      triggerElement.removeEventListener('click', toggle)
      document.removeEventListener('keydown', onKeyDown)
      for (const element of [style, capture, ghost, tray, floating]) element?.remove()
    }
  }
}
```

Note on stacking: the capture layer (`z-index: 2147483646`) is appended after the overlay's sticker layer (same z-index), so it sits above stickers. The ghost, tray and floating trigger (`2147483647`) sit above the capture layer, which is why the floating trigger stays clickable while placing.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run build`
Expected: PASS, 9 tests in `tray.test.js`, 51 total; build exits 0.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/tray.js src/lib/tray.test.js
git commit -m "sticker tray and placing mode

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 6: `pack.js` and `index.js`

**Files:**
- Create: `src/lib/pack.js`
- Replace: `src/lib/index.js`
- Test: `src/lib/index.test.js`

- [ ] **Step 1: Create the default pack**

Create `src/lib/pack.js`:

```js
// Sticker image URLs are sticker identities. Never change a published URL.
export const PACK_ORIGIN = 'https://stickers.stucco.software'

export const defaultPack = [
  { src: `${PACK_ORIGIN}/eyes.png`, alt: 'Googly eyes' }
]
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/index.test.js`:

```js
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import StickerPack, { localStorageAdapter } from './index.js'
import { createAnnotation, pageSource } from './annotation.js'
import { defaultPack } from './pack.js'

const memory = (initial = []) => {
  const saved = [...initial]
  return {
    saved,
    list: vi.fn(async () => [...saved]),
    add: vi.fn(async (annotation) => { saved.push(annotation) }),
    remove: vi.fn(async (annotation) => {
      saved.splice(saved.findIndex((entry) => entry.id === annotation.id), 1)
    })
  }
}

const shadow = () => document.querySelector('[data-stickerpack]').shadowRoot
const stickers = () => shadow().querySelectorAll('.sticker')

let destroy = () => {}

beforeEach(() => {
  document.body.innerHTML = '<p>Hello sticker world</p>'
})

afterEach(() => {
  destroy()
  destroy = () => {}
  delete document.elementsFromPoint
  vi.restoreAllMocks()
})

it('re-exports the localStorage adapter', () => {
  expect(typeof localStorageAdapter).toBe('function')
})

it('mounts, loads this page’s stickers and unmounts', async () => {
  const saved = createAnnotation({
    src: 'https://stickers.stucco.software/eyes.png',
    source: pageSource(),
    selectors: [{ type: 'CssSelector', value: 'body > p:nth-child(1)' }],
    x: 50,
    y: 50
  })
  const storage = memory([saved])
  destroy = StickerPack({ storage })
  await vi.waitFor(() => expect(stickers()).toHaveLength(1))
  expect(storage.list).toHaveBeenCalledWith(pageSource())
  destroy()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})

it('offers the default pack plus owner stickers', () => {
  destroy = StickerPack({ storage: memory(), stickers: ['/stickers/duck.png'] })
  const images = shadow().querySelectorAll('.tray img')
  expect(images).toHaveLength(defaultPack.length + 1)
  expect(images[images.length - 1].getAttribute('src')).toBe(new URL('/stickers/duck.png', location.href).href)
})

it('can leave out the default pack', () => {
  destroy = StickerPack({ storage: memory(), defaultPack: false, stickers: ['/a.png'] })
  expect(shadow().querySelectorAll('.tray img')).toHaveLength(1)
})

it('skips invalid stickers from storage', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  destroy = StickerPack({ storage: memory([{ nope: true }]) })
  await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  expect(stickers()).toHaveLength(0)
})

it('places and saves a sticker', async () => {
  const storage = memory()
  destroy = StickerPack({ storage, defaultPack: false, stickers: ['/stickers/duck.png'] })
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20 })
  const host = document.querySelector('[data-stickerpack]')
  document.elementsFromPoint = () => [host, p, document.body]
  shadow().querySelector('.trigger').click()
  shadow().querySelector('.tray button').click()
  shadow().querySelector('.capture').dispatchEvent(new MouseEvent('click', { clientX: 25, clientY: 10, bubbles: true }))
  await vi.waitFor(() => expect(storage.add).toHaveBeenCalledTimes(1))
  const [annotation] = storage.add.mock.calls[0]
  expect(annotation.body.id).toBe(new URL('/stickers/duck.png', location.href).href)
  expect(annotation.target.source).toBe(pageSource())
  expect(annotation.target.selector[0]).toMatchObject({ type: 'CssSelector', value: 'body > p:nth-child(1)' })
  expect(annotation.target.selector[0].refinedBy.value).toBe('xywh=percent:25,50,0,0')
  expect(stickers()).toHaveLength(1)
})

it('unrenders a placed sticker when saving fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const storage = memory()
  storage.add.mockRejectedValue(new Error('nope'))
  destroy = StickerPack({ storage, defaultPack: false, stickers: ['/a.png'] })
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20 })
  const host = document.querySelector('[data-stickerpack]')
  document.elementsFromPoint = () => [host, p]
  shadow().querySelector('.trigger').click()
  shadow().querySelector('.tray button').click()
  shadow().querySelector('.capture').dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1, bubbles: true }))
  await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  expect(stickers()).toHaveLength(0)
})

it('peels a sticker while the tray is open', async () => {
  const saved = createAnnotation({
    src: 'https://stickers.stucco.software/eyes.png',
    source: pageSource(),
    selectors: [{ type: 'CssSelector', value: 'body > p:nth-child(1)' }],
    x: 50,
    y: 50
  })
  const storage = memory([saved])
  destroy = StickerPack({ storage })
  await vi.waitFor(() => expect(stickers()).toHaveLength(1))
  shadow().querySelector('.trigger').click()
  stickers()[0].click()
  expect(stickers()).toHaveLength(0)
  await vi.waitFor(() => expect(storage.remove).toHaveBeenCalledWith(saved))
})

it('warns and returns a no-op for a second instance', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  destroy = StickerPack({ storage: memory() })
  const second = StickerPack({ storage: memory() })
  expect(warn).toHaveBeenCalledTimes(1)
  second()
  expect(document.querySelectorAll('[data-stickerpack]')).toHaveLength(1)
  destroy()
  destroy = StickerPack({ storage: memory() })
  expect(document.querySelectorAll('[data-stickerpack]')).toHaveLength(1)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/index.test.js`
Expected: FAIL. `StickerPack` is not a function, because `index.js` is still the template comment.

- [ ] **Step 4: Implement `index.js`**

Replace the contents of `src/lib/index.js` with:

```js
import { describe } from './anchor.js'
import { createAnnotation, isAnnotation, pageSource, toSticker } from './annotation.js'
import { createOverlay } from './overlay.js'
import { defaultPack } from './pack.js'
import { localStorageAdapter } from './storage/local.js'
import { createTray } from './tray.js'

export { localStorageAdapter }

let active = null

const warn = (message, detail) => console.warn(`stickerpack: ${message}`, detail)

export default function StickerPack(options = {}) {
  if (active) {
    warn('StickerPack() is already running, ignoring this call.')
    return () => {}
  }

  const { stickers = [], defaultPack: includeDefaultPack = true, trigger } = options
  const storage = options.storage ?? localStorageAdapter()
  const source = pageSource()
  const pack = [
    ...(includeDefaultPack ? defaultPack : []),
    ...stickers.map((src) => toSticker(src))
  ]
  let destroyed = false

  const overlay = createOverlay()

  overlay.onStickerClick(async (annotation) => {
    overlay.unrender(annotation.id)
    try {
      await storage.remove(annotation)
    } catch (error) {
      warn('could not remove sticker', error)
      if (!destroyed) overlay.render(annotation)
    }
  })

  const tray = createTray({
    root: overlay.root,
    host: overlay.host,
    stickers: pack,
    trigger,
    onOpen: () => overlay.setPeelable(true),
    onClose: () => overlay.setPeelable(false),
    onPlace: async ({ src, element, clientX, clientY }) => {
      const { selectors, x, y } = describe(element, clientX, clientY)
      const annotation = createAnnotation({ src, source, selectors, x, y })
      overlay.render(annotation)
      try {
        await storage.add(annotation)
      } catch (error) {
        warn('could not save sticker', error)
        overlay.unrender(annotation.id)
      }
    }
  })

  Promise.resolve()
    .then(() => storage.list(source))
    .then((annotations) => {
      if (destroyed) return
      for (const annotation of annotations) {
        if (isAnnotation(annotation)) overlay.render(annotation)
        else warn('skipping invalid sticker', annotation)
      }
    })
    .catch((error) => warn('could not load stickers', error))

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    tray.destroy()
    overlay.destroy()
    if (active === destroy) active = null
  }

  active = destroy
  return destroy
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 9 tests in `index.test.js`, 60 total.

- [ ] **Step 6: Verify the showcase still builds**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 7: Commit and push**

```bash
git add src/lib/pack.js src/lib/index.js src/lib/index.test.js
git commit -m "StickerPack() wires overlay, tray and storage

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 7: Showcase switches to the real API; prototype removed

**Files:**
- Modify: `src/routes/+page.svelte` (full rewrite, keeps the uncommitted `<main>` layout)
- Modify: `src/app.html`
- Delete: `src/lib/stickerpack.js`, `src/lib/helpers.js`

- [ ] **Step 1: Rewrite the showcase page**

Replace `src/routes/+page.svelte` with:

```svelte
<script>
  import { onMount } from 'svelte'
  import { dev } from '$app/environment'
  import StickerPack from '$lib/index.js'

  // The default pack is served from stickers.stucco.software. Until that
  // domain is live, use the local copy in dev so stickers render.
  const options = dev
    ? { defaultPack: false, stickers: ['/stickers/eyes.png'] }
    : {}

  onMount(() => StickerPack(options))
</script>

<main>

  <h1>
    Stickers, for Websites
  </h1>

  <p>
    Only the finest stickers, for your website. Just add HTML or use the JavaScript API to let folks stick stuff to your page.
  </p>

  <mark>Easy!</mark>

  <h2>
    Use Some HTML
  </h2>

  <p>Two lines of HTML to add the Sticker Pack Custom Element!</p>

  <pre><code>
    &lt;script type="module" src="stickerpack.js">&lt;/script>
    &lt;sticker-pack>&lt;/sticker-pack>
  </code></pre>

  <mark>Fun!</mark>

  <h2>
    Use Some JavaScripts
  </h2>

  <p>So you sling some code? Make stickers happen where, when, and how you want.</p>

  <pre><code>
    // import the library
    import StickerPack from "stickerpack"

    // mount to the DOM
    let destroyStickerPack = StickerPack()

    // remove from the DOM
    destroyStickerPack()
  </code></pre>

  <mark>Wow!</mark>

  <p>
    From <a href="https://stucco.software">Stucco Software</a>
  </p>
</main>

<style>
  main {
    max-width: 42rem;
    margin: auto;
  }
  h1,
  h2,
  p {
    padding-block: 1rem;
  }
</style>
```

- [ ] **Step 2: Remove the missing stylesheet link**

In `src/app.html`, delete this line:

```html
		<link rel="stylesheet" type="text/css" href="/var.css">
```

- [ ] **Step 3: Delete the prototype**

Run: `git rm -q --force src/lib/stickerpack.js src/lib/helpers.js`
(`--force` is needed because `stickerpack.js` has uncommitted edits; the new modules supersede it.)

Then confirm nothing references the deleted files:
Run: `grep -rn "stickerpack.js\|helpers.js\|unique-selector" src || echo clean`
Expected: `clean`, or only the `stickerpack.js` text inside the page's HTML code sample.

- [ ] **Step 4: Verify tests and build**

Run: `npm test && npm run build`
Expected: tests PASS; build exits 0.

- [ ] **Step 5: Smoke-check SSR output**

Run:

```bash
(npx vite preview --port 4317 --strictPort > /tmp/stickerpack-preview.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:4317/ > /dev/null && break; sleep 0.5; done
curl -s http://localhost:4317/ | grep -c "Stickers, for Websites"
pkill -f "vite preview --port 4317"
```

Expected: prints `1` or more, which means the page server-renders without touching the DOM. If preview fails to start (check `/tmp/stickerpack-preview.log`), use `npx vite dev --port 4317 --strictPort` in the same pattern, with `pkill -f "vite dev --port 4317"`.

- [ ] **Step 6: Commit and push**

```bash
git add -A src/routes/+page.svelte src/app.html src/lib/stickerpack.js src/lib/helpers.js
git commit -m "showcase uses StickerPack, remove prototype

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 8: `<sticker-pack>` element and library packaging

**Files:**
- Create: `src/lib/element.js`, `src/lib/script.js`
- Test: `src/lib/element.test.js`
- Create: `vite.lib.config.js`, `vite.script.config.js`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/element.test.js`:

```js
import { it, expect, beforeEach } from 'vitest'
import { StickerPackElement, defineStickerPackElement } from './element.js'

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

it('defines <sticker-pack> once', () => {
  defineStickerPackElement()
  defineStickerPackElement()
  expect(customElements.get('sticker-pack')).toBe(StickerPackElement)
})

it('mounts from attributes on connect and unmounts on disconnect', () => {
  defineStickerPackElement()
  const element = document.createElement('sticker-pack')
  element.setAttribute('stickers', '/a.png   /b.png')
  element.setAttribute('no-default-pack', '')
  element.innerHTML = '<button slot="trigger">Stickers!</button>'
  document.body.append(element)

  const root = document.querySelector('[data-stickerpack]').shadowRoot
  expect(root.querySelector('.trigger')).toBe(null)
  expect(root.querySelectorAll('.tray img')).toHaveLength(2)

  element.querySelector('button').click()
  expect(root.querySelector('.tray').hidden).toBe(false)

  element.remove()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/element.test.js`
Expected: FAIL. `./element.js` cannot be resolved.

- [ ] **Step 3: Implement the element and the script entry**

Create `src/lib/element.js`:

```js
import StickerPack from './index.js'

// Importing this module during SSR must not throw.
const Base = typeof HTMLElement === 'undefined' ? class {} : HTMLElement

export class StickerPackElement extends Base {
  connectedCallback() {
    // If defined before the parser reaches our children, wait so the trigger exists.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.connectedCallback(), { once: true })
      return
    }
    if (!this.isConnected || this.destroyStickerPack) return
    const stickers = (this.getAttribute('stickers') ?? '').split(/\s+/).filter(Boolean)
    this.destroyStickerPack = StickerPack({
      stickers,
      defaultPack: !this.hasAttribute('no-default-pack'),
      trigger: this.querySelector('[slot="trigger"]') ?? undefined
    })
  }

  disconnectedCallback() {
    this.destroyStickerPack?.()
    this.destroyStickerPack = undefined
  }
}

export const defineStickerPackElement = () => {
  if (!customElements.get('sticker-pack')) customElements.define('sticker-pack', StickerPackElement)
}
```

A second `<sticker-pack>` gets the no-op `destroy` from `StickerPack`, so disconnecting it never tears down the first one.

Create `src/lib/script.js`:

```js
import { defineStickerPackElement } from './element.js'

export { default, localStorageAdapter } from './index.js'
export { StickerPackElement, defineStickerPackElement } from './element.js'

defineStickerPackElement()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS for all test files.

- [ ] **Step 5: Add the library build configs**

Create `vite.lib.config.js`:

```js
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
```

Create `vite.script.config.js`:

```js
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
```

- [ ] **Step 6: Update `package.json`**

Run: `npm uninstall @sveltejs/package publint`

Then run this script to rewrite the packaging fields:

```bash
node -e '
const fs = require("fs")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
delete pkg.svelte
delete pkg.types
delete pkg.peerDependencies
pkg.scripts = {
  dev: "vite dev",
  build: "vite build",
  "build:lib": "vite build -c vite.lib.config.js && vite build -c vite.script.config.js",
  preview: "vite preview",
  prepare: "svelte-kit sync || echo \"\"",
  prepack: "npm run build:lib",
  "test:unit": "vitest",
  test: "npm run test:unit -- --run"
}
pkg.files = ["dist"]
pkg.sideEffects = ["./dist/stickerpack.js"]
pkg.exports = {
  ".": "./dist/index.js",
  "./element": "./dist/element.js",
  "./stickerpack.js": "./dist/stickerpack.js"
}
pkg.keywords = ["stickers", "web-annotation", "custom-element"]
fs.writeFileSync("package.json", JSON.stringify(pkg, null, "\t") + "\n")
'
```

- [ ] **Step 7: Build the library and inspect the output**

Run: `npm run build:lib && ls dist`
Expected: `element.js  index.js  stickerpack.js`, plus possibly one shared chunk file from the first pass. No `.svelte` or test files.

Run: `grep -c "customElements.define" dist/stickerpack.js && ! grep -q "^import" dist/stickerpack.js && echo self-contained`
Expected: a count of at least `1`, then `self-contained`.

Run: `node -e "import('./dist/index.js').then(m => console.log(typeof m.default, typeof m.localStorageAdapter))"`
Expected: `function function`. This shows the ES entry imports cleanly without a DOM.

Run: `npm pack --dry-run 2>&1 | grep -E "dist/|package.json"`
Expected: only `dist/*` files and `package.json`, with no `src/` or `static/`.

- [ ] **Step 8: Verify tests and showcase build**

Run: `npm test && npm run build`
Expected: PASS, 62 total; exits 0.

- [ ] **Step 9: Commit and push**

```bash
git add src/lib/element.js src/lib/element.test.js src/lib/script.js vite.lib.config.js vite.script.config.js package.json package-lock.json
git commit -m "sticker-pack custom element and library build

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 9: Final verification

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Full check**

Run: `npm test && npm run build && npm run build:lib`
Expected: all pass. Paste the test summary line (files and tests passed) into the task report.

- [ ] **Step 2: Manual checklist for the user**

happy-dom cannot verify these, so list them in the final report for the user to check in a real browser with `npm run dev`:
1. The ✦ button appears bottom-right, and the page's links work normally.
2. ✦ opens the tray showing the eyes sticker.
3. Picking the sticker shows a ghost following the cursor. Clicking a paragraph sticks it there, and the link underneath does not navigate.
4. Esc and ✦ both cancel placing.
5. Reloading keeps the sticker in place. Resizing the window keeps it on its paragraph.
6. With the tray open, hovering a sticker shows `not-allowed`, and clicking removes it (also after reload).
7. Closed tray: stickers don't block clicks on the content under them.
8. Placing a sticker near the right edge doesn't add a horizontal scrollbar. If it does, report it as a follow-up.
