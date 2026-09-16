# Stickerpack Layer 1 — Design

**Date:** 2026-09-16
**Status:** Approved in brainstorming, pending written review

## Context

Stickerpack lets visitors put persistent stickers on a website. It is planned in three layers:

1. **Layer 1 (this spec):** an installable library. Visitors place stickers on a site; stickers persist.
2. **Layer 2 (future):** stickers shared across all visitors to a site. The approach is undecided and deliberately out of scope here.
3. **Layer 3 (future):** a browser extension backed by SolidState that lets a user sticker any website and save to their Solid account.

Layer 1 must not block layers 2 and 3. Two decisions carry that weight:

- **A sticker's image URL is its identity.** Every sticker kind is an absolute, stable image URL, so it can become an Octothorpes target later.
- **Every placed sticker is a W3C Web Annotation** (JSON-LD), so it can be stored in a Solid pod or an RDF store without translation.

## Decisions

| Topic | Decision |
|---|---|
| Sticker sources | Default pack hosted at stable URLs, plus owner-supplied image URLs |
| Default pack host | Dedicated domain, `stickers.stucco.software` (placeholder, confirm before launch) |
| Persistence | Pluggable storage adapter; localStorage adapter is the default |
| Placing | Floating pack button → tray → sticker follows pointer → click to stick |
| After placing | Visitors can peel off their own stickers. No move, rotate or resize |
| Packaging | Dependency-free vanilla JS core plus a `<sticker-pack>` custom element |
| Anchoring | Web Annotation selector alternatives: `CssSelector`, then `TextQuoteSelector`. No page-coordinate fallback |
| Unresolvable stickers | Orphaned: kept in storage, not rendered |
| Page identity | `location.origin + location.pathname`, always. No override |
| Rendering | Single overlay layer in Shadow DOM. Host DOM and CSS are never modified |

## Architecture

### Modules (`src/lib/`)

Each module is usable and testable on its own. Modules communicate through the interfaces below and never reach into each other's DOM. `overlay.js` uses `anchor` and `annotation`; `index.js` is the only module that wires overlay, tray and storage together.

#### `pack.js`

```js
export const PACK_ORIGIN = 'https://stickers.stucco.software'
export const defaultPack // → [{ src: `${PACK_ORIGIN}/eyes.png`, alt: 'Googly eyes' }, …]
```

#### `annotation.js`

```js
pageSource(location)                      → string  // origin + pathname
toSticker(src)                            → { src, alt }  // src absolute via new URL(src, location.href); alt from filename
createAnnotation({ src, source, selectors }) → Annotation
isAnnotation(value)                       → boolean
position(annotation)                      → { selectors, x, y }  // parse xywh refinement
```

- **Alt text from a filename:** take the last path segment, strip the extension, and replace `-` and `_` with spaces. `/stickers/big-duck.png` becomes `big duck`.
- **`isAnnotation`** checks that `id` is a string, `body.id` is an absolute URL string, `target.source` is a string, and `target.selector` is a non-empty array whose entries are `CssSelector` or `TextQuoteSelector` with a parseable `xywh=percent:` refinement.

#### `anchor.js`

```js
describe(element, clientX, clientY) → { selectors: Selector[], x, y }
resolve(selectors)                  → { element, x, y } | null
```

See [Anchoring](#anchoring).

#### `storage/local.js`

```js
localStorageAdapter() → StorageAdapter
```

See [Storage](#storage).

#### `overlay.js`

```js
createOverlay() → {
  root,                          // ShadowRoot; tray.js renders into it
  host,                          // the host <div> appended to <body>
  render(annotation),            // resolve + draw; orphaned if unresolved
  unrender(id),
  setPeelable(boolean),          // stickers accept pointer events + cursor: not-allowed
  onStickerClick(fn),            // fn(annotation), fired only while peelable
  destroy()
}
```

It owns rendering, positioning, observers and orphan re-resolution.

#### `tray.js`

```js
createTray({ root, host, stickers, trigger, onOpen, onClose, onPlace }) → { destroy() }
```

- `root` and `host` come from the overlay. The floating button, tray, ghost and capture layer all render inside `root`.
- `trigger` is an optional owner element. If it's absent, the floating button is rendered.
- `onOpen()` and `onClose()` are called when the tray opens and closes.
- `onPlace({ src, element, clientX, clientY })` fires when a placement click lands on a page element.

#### `index.js`

```js
export default function StickerPack(options) → destroy
export { localStorageAdapter }
```

`index.js` wires the modules together:
- tray `onOpen`/`onClose` → `overlay.setPeelable(true/false)`
- `overlay.onStickerClick` → `overlay.unrender`, then `storage.remove` (optimistic, like placing)
- tray `onPlace` → `anchor.describe` → `createAnnotation` → `overlay.render` → `storage.add`

On start it calls `storage.list(source)` and renders each valid annotation.

#### `element.js`

```js
export class StickerPackElement extends HTMLElement
export function defineStickerPackElement() // customElements.define('sticker-pack', …) if not already defined
```

- The element has **no shadow root**. On `connectedCallback` it reads its attributes, finds a child with `slot="trigger"` via `querySelector`, and calls `StickerPack`.
- On `disconnectedCallback` it calls the `destroy` it received, but only if its own call created the active instance.
- Attributes are read once on connect. Later attribute changes are not observed.
- The module guards `typeof HTMLElement !== 'undefined'` so importing it during SSR is safe.

### JS API

```js
import StickerPack, { localStorageAdapter } from 'stickerpack'

const destroy = StickerPack({
  stickers: ['/stickers/duck.png'], // appended to default pack; resolved to absolute URLs
  defaultPack: true,                // false = only owner stickers
  storage: localStorageAdapter(),   // default; any StorageAdapter
  trigger: myButton                 // optional; replaces the floating button
})

destroy() // removes listeners, observers, overlay and tray. Stored stickers remain.
```

**Single instance:** calling `StickerPack()` while an instance is active logs a warning and returns a no-op `destroy`. Only the first caller can tear the instance down. The same applies to a second `<sticker-pack>` element.

### HTML API

```html
<script type="module" src="https://…/stickerpack.js"></script>
<sticker-pack stickers="/stickers/duck.png /stickers/cat.png" no-default-pack>
  <button slot="trigger">Stickers!</button> <!-- optional -->
</sticker-pack>
```

- `stickers`: space-separated image URLs.
- `no-default-pack`: boolean attribute; equivalent to `defaultPack: false`.
- `slot="trigger"`: marks an owner-provided trigger child.

### Packaging and build

Replace the Svelte library packaging with plain JS packaging:

- **Remove:** `svelte-package`, `publint` from `prepack`, the `svelte` export condition and the `svelte` peer dependency.
- **Add** `vite.lib.config.js`: Vite library mode building from `src/lib/`.
  - `dist/index.js` (ESM): exports `StickerPack` and `localStorageAdapter`. No side effects.
  - `dist/element.js` (ESM): exports `StickerPackElement` and `defineStickerPackElement`. No side effects.
  - `dist/stickerpack.js` (ESM, single file, everything bundled): calls `defineStickerPackElement()` on load. This is the `<script>` build. Because a multi-entry build emits shared chunks, this file is produced by a second build pass (`vite.script.config.js`, entry `src/lib/script.js`, `inlineDynamicImports`), writing into the same `dist/` without emptying it.
- **`package.json`:**
  - `exports`: `"."` → `./dist/index.js`, `"./element"` → `./dist/element.js`, `"./stickerpack.js"` → `./dist/stickerpack.js`
  - `"sideEffects": ["./dist/stickerpack.js"]`
  - `files`: `["dist"]`; `static/` is never published
  - Remove the top-level `svelte` and `types` fields and any `types` export condition; v1 ships no `.d.ts`
  - Scripts: `build:lib` runs `vite build -c vite.lib.config.js && vite build -c vite.script.config.js`; `prepack` runs `build:lib`; `build` runs `vite build` only (showcase)
- **Showcase:** the SvelteKit app keeps `vite.config.js` and `adapter-vercel`. It imports the library through `$lib/index.js` inside `onMount`, so nothing touches the DOM during SSR.

### Sticker size

Fixed 4rem square, `object-fit: contain`. Size is not stored.

## Data Model

A placed sticker is a Web Annotation:

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "urn:uuid:5974d4a4-4b44-4c2d-a9f5-fbccc8da2760",
  "type": "Annotation",
  "motivation": "tagging",
  "created": "2026-09-16T18:04:00Z",
  "body": { "id": "https://stickers.stucco.software/eyes.png", "type": "Image" },
  "target": {
    "source": "https://example.com/about",
    "selector": [
      {
        "type": "CssSelector",
        "value": "body > main:nth-child(1) > p:nth-child(3)",
        "refinedBy": {
          "type": "FragmentSelector",
          "conformsTo": "http://www.w3.org/TR/media-frags/",
          "value": "xywh=percent:42.50,61.25,0,0"
        }
      },
      {
        "type": "TextQuoteSelector",
        "exact": "Only the finest stickers, for you",
        "refinedBy": {
          "type": "FragmentSelector",
          "conformsTo": "http://www.w3.org/TR/media-frags/",
          "value": "xywh=percent:42.50,61.25,0,0"
        }
      }
    ]
  }
}
```

- `id`: `urn:uuid:` + `crypto.randomUUID()`.
- `created`: `new Date().toISOString()`.
- `body.id`: the sticker image URL, always absolute.
- `target.source`: `location.origin + location.pathname`.
- `target.selector`: an array of alternatives, in priority order. Both carry the same position refinement.
- Position: the sticker's center, as percentages of the anchor element's bounding rect, to two decimal places.
- The `TextQuoteSelector` is omitted when the anchor element has no text.

**Known stretch:** Media Fragments `xywh` is defined for media resources, not DOM elements. We use it anyway to stay within standard Web Annotation vocabulary instead of adding a custom property.

## Anchoring

### Normalized text

An element's normalized text is its text content with `<script>`, `<style>`, `<noscript>` and `<template>` descendants removed, whitespace runs collapsed to a single space, and the result trimmed.

### `describe(element, clientX, clientY)`

- **Choosing the anchor:**
  - If `element` is `<html>`, use `<body>`.
  - If the element's rect has zero width or zero height, walk up to the nearest ancestor with a non-zero rect. `<body>` is the last resort.
- **CSS path:** `body`, then for each descendant step down to the anchor, `localName:nth-child(n)`, joined with ` > `. No ids or classes, so framework-generated hashed class names (e.g. `svelte-xyz`) cannot break it. `localName` keeps SVG element names in the right case. If the anchor is `<body>`, the path is just `body`.
- **Quote:** the first 32 characters of the anchor's normalized text. Omitted if empty.
- **Position:** `(clientX - rect.left) / rect.width * 100` and `(clientY - rect.top) / rect.height * 100`, rounded to two decimals.

### `resolve(selectors)`

1. If the `CssSelector` matches an element, and either there is no quote or that element's normalized text starts with the quote, use it.
2. Otherwise, if a quote exists, search elements under `body` in order of greatest tree depth first (ties in document order) for one whose normalized text starts with the quote. Use the first match. A short quote can resolve to a descendant of the original anchor (e.g. a `<span>` inside an `<a>`). That is accepted.
3. Otherwise, return `null`: the sticker is orphaned.

The quote check in step 1 prevents a sticker from attaching to a different element that now occupies the same structural position.

## Storage

### Adapter interface

```js
{
  list(source)       → Promise<Annotation[]>,
  add(annotation)    → Promise<void>,
  remove(annotation) → Promise<void>
}
```

`remove` receives the whole annotation, so adapters can locate it by `id` and `target.source`. Layers 2 and 3 are expected to arrive as additional adapters.

### localStorage adapter

- One key per page: `stickerpack:<source>`, holding a JSON array of annotations.
- `list` parses the key. Entries that fail `isAnnotation` are skipped with a `console.warn`. Unparseable JSON is treated as an empty list with a `console.warn`.
- All locally stored stickers belong to the current visitor, so all are peelable.
- If localStorage is unavailable or throws (blocked, quota), the adapter switches to an in-memory store for the rest of the page's life and logs one `console.warn`. Stickers work for the visit but do not persist.

## Interaction

### States

1. **Idle (default).** Only the trigger is interactive. Rendered stickers have `pointer-events: none`; the host page behaves normally.
2. **Tray open.**
   - The tray shows one `<button>` per sticker, each containing an `<img>` with `alt` text.
   - Rendered stickers accept pointer events and show `cursor: not-allowed` on hover, with no other hover styling. Clicking one peels it: `overlay.unrender`, then `storage.remove`. The tray stays open, so several stickers can be peeled in a row.
   - Esc or activating the trigger closes the tray and returns to idle.
3. **Placing.**
   - After choosing a sticker, the tray closes and the stickers become non-interactive again.
   - A ghost of the chosen sticker follows the pointer at reduced opacity.
   - A transparent, viewport-sized capture layer inside the overlay shadow root intercepts the next click, so host links and buttons never activate.
   - On click, `document.elementsFromPoint(clientX, clientY)` is read. The overlay host is skipped; shadow content is retargeted to the host, so skipping the host skips the capture layer, ghost, stickers, tray and floating button.
   - **Cancel:** if the first remaining element is the owner trigger or one of its descendants, placing is cancelled. Otherwise `onPlace` fires with that element.
   - Esc also cancels.
   - Placing always ends after one click and returns to idle.

The floating button is rendered above the capture layer inside the shadow root, so it receives clicks directly; its own click handler cancels placing. An owner trigger sits beneath the capture layer and is detected through the capture click as described above.

### Touch

Tap a sticker in the tray, then tap the page. There is no following ghost.

## Rendering (Overlay)

- **Structure:** a host `<div>` appended to `<body>`. Its shadow root contains:
  - a layer with `position: absolute; top: 0; left: 0; width: 100%; height: 0; overflow-x: clip; overflow-y: visible` and a very high `z-index`, holding the stickers. Horizontal clipping stops stickers near the right edge from widening the page.
  - the floating button and tray (`position: fixed`)
  - the ghost and the capture layer while placing
- **Position:** `anchorRect.left - layerRect.left + anchorRect.width * x / 100`, and the same for top and height, with the sticker centered on that point. Measuring against the layer's own rect absorbs body margins, positioned ancestors and translate transforms, with no separate scroll math.
- **Repositioning** is batched into a single `requestAnimationFrame` (reads batched before writes), triggered by:
  - window `resize`
  - `document.fonts.ready`
  - a `ResizeObserver` on `document.documentElement`, on `document.body` and on each anchor element
  - a capture-phase `load` listener on `document` (catches lazy images/iframes finishing load anywhere on the page after render; capture phase is required because `load` does not bubble)
- **Removed anchors:** on each reposition pass, a rendered sticker whose anchor is no longer connected (`!element.isConnected`) is unrendered and becomes orphaned. An entry counts as orphaned as soon as its anchor is missing or disconnected — not only once the reposition pass has detached it — so a framework that replaces an anchor with an equivalent node within a single mutation batch is still detected as orphaned immediately, before that anchor reference is nulled out.
- **Late content:** a `MutationObserver` on `body` (subtree, childList, characterData) always schedules a reposition, but only re-runs `resolve` for orphaned stickers (debounced to 250ms) when there is at least one orphan (anchor missing or disconnected) and a mutation record adds nodes or changes character data; removal-only mutations reschedule a reposition but skip the orphan scan. It ignores mutations inside the overlay host.
- **Removed host:** the same `MutationObserver` callback re-appends the overlay host to `body` if something else removes it from the page.

## Error Handling

- Storage errors are caught and `console.warn`ed; they never throw into the host page.
- A newly placed sticker is rendered before `storage.add` resolves. If `add` rejects, the sticker is unrendered.
- If `storage.remove` rejects during a peel, the sticker is rendered again.
- Sticker images that fail to load are hidden on `error`. The annotation stays in storage.
- Invalid annotations returned by any adapter's `list` are skipped by `index.js` with a `console.warn`.

## Testing

- **Setup:** add `happy-dom` as a dev dependency. In `vite.config.js`, rename the Vitest project from `server` to `lib` and change its environment from `node` to `happy-dom`.
- There is no layout engine, so tests stub `getBoundingClientRect` and `document.elementsFromPoint`.

**Cases:**

- **`anchor`:**
  - `describe` → `resolve` round-trip.
  - Inserting a sibling before the target still resolves via the quote.
  - A CSS match whose text no longer matches the quote falls through to the quote search.
  - Nothing matches → `null`.
  - An element without text produces no quote and resolves by CSS alone.
  - `<html>` hit → anchors to `body`.
  - A zero-size element → nearest sized ancestor.
  - An SVG child uses `localName`.
  - `<script>` text is excluded from the quote.
- **`annotation`:**
  - Shape matches the example.
  - Relative sticker URLs become absolute.
  - `pageSource` removes query and hash.
  - Alt text is derived from the filename.
  - `isAnnotation` accepts valid annotations and rejects malformed ones.
  - `position` parses the refinement.
- **`storage/local`:**
  - list, add and remove are scoped per source.
  - Invalid and unparseable entries are skipped.
  - A throwing `localStorage` falls back to memory.
- **`index`:** a second `StickerPack()` call warns and returns a no-op `destroy`.
- **Overlay and tray:** manual verification on the showcase site for v1.

## Default Pack Assets

- Sticker images live in this repo under `static/stickers/`. `eyes.png` is the first; more art is added over time.
- `stickers.stucco.software` must serve those files at stable paths (e.g. as an additional domain on the showcase deployment) before launch.
- Until then, `PACK_ORIGIN` is the only thing to change, and the showcase will show broken default stickers if the domain isn't live.

## Cleanup Included

- Delete `src/lib/helpers.js` (and its uninstalled `unique-selector` import).
- Replace the prototype in `src/lib/stickerpack.js` with the modules above, and delete the file.
- Delete placeholder `src/demo.spec.js`.
- Showcase page: remove `<template id="eyesticker">` and `* { position: relative }`, fix the `h2 p` selector typo, and update the code samples to the real API.
- Remove the `/var.css` link from `src/app.html`.

## Out of Scope (v1)

- Sharing stickers across visitors (layer 2)
- Identity and ownership beyond "this browser"
- SolidState adapter and browser extension (layer 3)
- Moving, rotating or resizing stickers
- Keyboard placement of stickers
- Correct positioning inside independently scrolling containers
- Correct positioning on `position: fixed` or `sticky` anchors (no scroll listener)
- Scale or rotate transforms on ancestors of the overlay host
- Observing `<sticker-pack>` attribute changes after connect
