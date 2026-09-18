# Stickerpack Browser Extension — Design

**Date:** 2026-09-18
**Branch:** `anywhere`
**Status:** Approved in brainstorming, pending written review

## Context

Stickerpack layer 1 shipped: a dependency-free library that lets visitors place persistent stickers on a site that installs it. This spec covers **layer 3**, a browser extension that lets *you* put stickers on any website, saved for you rather than for the site.

Layer 2 (stickers shared between visitors to a site) is still undecided and out of scope. The extension must not block it: sticker identity and the annotation format stay exactly as layer 1 defined them.

Shipping order inside this spec: a private, local-first extension. Saving to a Solid pod through SolidState is the next step after it, and arrives as another storage adapter.

## Decisions

| Topic | Decision |
|---|---|
| First version | Private stickers stored by the extension. No accounts, no sync |
| Activation | Toolbar button and a keyboard shortcut. Saved stickers render with no interaction |
| Tray lifetime | Stays open for the tab until toggled off, Esc, or navigation |
| Page identity | `origin + pathname`, same rule as the library. Query strings do not make a new page |
| SPA navigation | Signal-driven remount. No polling |
| Storage | `api.storage.local`, one entry per page, via a new storage adapter |
| Browsers | Chromium (Chrome, Edge) and Firefox, from one codebase with two generated manifests, no dependencies |
| Permissions | No host access at install. Per-site opt-in through `optional_host_permissions` |
| Sticker images | Bundled in the extension; the canonical `https://` URL stays the sticker's identity |
| Frames | Top frame only |

## Architecture

### Files (`src/extension/`)

| File | Responsibility |
|---|---|
| `browser.js` | `export const api = globalThis.browser ?? globalThis.chrome`. The only place the two browsers meet |
| `page.js` | `stickerable(url)`; `watchUrl(onChange)` → `stop()`. Page identity comes from the library's `pageSource` |
| `storage.js` | `extensionStorage(area)` → StorageAdapter over `api.storage.local`, with serialized writes |
| `pack.js` | `stickerMap(pack)` → `Map(canonicalUrl → bundledUrl)` |
| `content.js` | Page-side entry: builds the map, mounts StickerPack, handles messages and URL changes |
| `background.js` | Toolbar clicks, shortcut, permission changes, content script registration, per-tab popup |
| `popup/popup.html`, `popup/popup.js` | Per-site opt-in and opt-out |
| `manifest.js` | `manifest(target)` → manifest object for `'chrome'` or `'firefox'` |

Each file is independently testable with a fake `api`. `content.js` mounts the library and `page.js` imports its `pageSource`; nothing else in the extension touches it. Only `background.js` touches permission changes and script registration.

### Interfaces

```js
// browser.js
export const api

// page.js
stickerable(url)            // → boolean; false for browser pages, stores, file:, view-source:
watchUrl(onChange)          // → stop(); calls onChange(newSource) when pageSource changes

// storage.js
extensionStorage(area = api.storage.local)  // → { list, add, remove }

// pack.js
stickerMap(pack)            // → Map<canonicalUrl, bundledUrl>

// content.js message handlers
{ type: 'toggle' }          // toolbar button or shortcut
{ type: 'teardown', origin } // that origin was revoked; the page tears down if it matches
{ type: 'url-changed' }     // background saw a history change in this tab
```

### Permissions, and why the toolbar works this way

The manifest requests **no host permissions**, only `optional_host_permissions: ['*://*/*']`, plus `storage`, `scripting` and `activeTab`.

A consequence drives the whole design: **without host permission for a tab, the extension cannot read that tab's URL.** `tab.url` and `changeInfo.url` are undefined. So "is this site granted?" and "is this page stickerable?" can only be answered for sites you have already opted into. That inverts neatly:

- The manifest sets `default_popup`, so by default clicking the toolbar button opens the popup.
- When the background *can* read a tab's URL during `tabs.onUpdated` or `tabs.onActivated`, that tab is on a granted origin, because only a granted origin makes the URL readable. It clears the popup for that tab (`action.setPopup({ tabId, popup: '' })`), so the button fires `action.onClicked` and toggles the tray directly with no popup.
- When a tab's URL is unreadable, or on any `loading` update, the popup is restored for that tab by setting it back to the manifest path (`popup: 'popup.html'`), since `''` and `null` don't mean the same thing in both engines.
- `activeTab` makes a tab's URL readable on a toolbar click or shortcut even for sites you never opted into, so that reading is **not** treated as proof of a grant. Anything that acts on a grant (injecting, toggling, retrying a message) checks `api.permissions.contains({ origins: ['<origin>/*'] })` first.
- Tabs already open when the browser starts keep the default popup until their next update, which costs one extra click at worst.

Clearing the popup is an optimisation, not a requirement: the popup handles the granted case too (see below), so if the optimisation doesn't apply, the behaviour is still correct, with a popup flash.

### Flows

**First visit to a site that has never been stickered**
1. No content script runs. The page is untouched.
2. The toolbar button opens the popup. The popup uses `activeTab` to read the current tab's URL.
3. `stickerable(url)` is false → the popup says this page can't be stickered, and stops.
4. Otherwise the popup shows "Stick stickers on this site". Its click handler calls `api.permissions.request({ origins: ['<origin>/*'] })` **as the first statement, before any `await`**, because the user gesture doesn't survive an await in either browser.
5. On approval the background (via `permissions.onAdded`, which carries the granted origins but no tab, so it resolves the tab with `tabs.query({ active: true, lastFocusedWindow: true })` and only injects when that tab's origin matches the grant — a grant made through the browser's own site-access UI can fire while another tab is active):
   - registers a content script for that origin with the deterministic id `sp:<origin>` (`api.scripting.registerContentScripts`, `persistAcrossSessions: true`, `runAt: 'document_idle'`, `allFrames: false`), so reconciliation can diff registrations against `permissions.getAll()`,
   - injects it into the current tab with `api.scripting.executeScript`, so nothing needs reloading,
   - clears the popup for tabs on that origin.
6. **The background opens the tray**, sending `{ type: 'toggle' }` right after `executeScript`. The popup can't do this: its document is destroyed when the permission prompt appears, so code after `await permissions.request(...)` may never run. The `permissions.onAdded` handler in the background always runs.

**Later visits**
1. The registered content script runs at `document_idle`.
2. It computes `pageSource`, builds the sticker map once, and mounts `StickerPack({ trigger: 'none', storage, resolveImage })`.
3. The library lists this page's stickers and draws them. No buttons, no other change to the page.

**Stickering**
1. Toolbar button → `action.onClicked` → background sends `{ type: 'toggle' }` → `handle.toggle()`.
2. The keyboard shortcut is a **named command** (`toggle-tray`) handled by `commands.onCommand`, which receives the tab. `_execute_action` is not used, because with a `default_popup` set it opens the popup and never reaches `onCommand`. The handler checks `permissions.contains` for the tab's origin: granted → toggle; not granted → `api.action.openPopup()` where available, otherwise nothing.
3. The tray stays open for as many stickers as you like. Toggling again, Esc, or leaving the page closes it.
4. Peeling works as in the library: with the tray open, click a sticker.

**Page changes without a reload**
- `content.js` remounts when `pageSource` changes: destroy, then mount again so the new page's stickers load. The sticker map is built once per content script lifetime and reused.
- Signals, in order of availability: the Navigation API's `navigatesuccess` event where it exists (Chromium 102+, Firefox 147+, Baseline since January 2026); `popstate` and `hashchange` always; and `{ type: 'url-changed' }` from the background, which watches `tabs.onUpdated` for granted tabs. No timers.
  The `navigate` event fires *before* the URL commits, so reading `location` there gives the old page; `navigatesuccess` fires after. (`event.destination.url` on `navigate` would work too, but the later event keeps one code path.)
- `tabs.onUpdated` reporting `changeInfo.url` on a `pushState` is real but undocumented, so it's a best-effort extra rather than the contract. The documented API for it, `webNavigation.onHistoryStateUpdated`, needs the `webNavigation` permission, which reads as "access your browsing activity" and costs more trust than this feature is worth. With the Navigation API now available in both target browsers, it isn't needed.
- A query-only change is the same `pageSource`, so nothing happens.

**Revoking a site**
- "Stop stickering this site" calls `api.permissions.remove`. The background reacts to `permissions.onRemoved` and unregisters that origin's content script.
- By then the grant is gone, so tab URLs are unreadable again and the background can't tell which tabs were on that site. It therefore **broadcasts** `{ type: 'teardown', origin }` to every tab id (`tabs.query({})` returns ids without any permission) and restores the popup on all of them. Each content script compares the origin with its own and ignores anything else; granted tabs get their popup cleared again on their next update.
- Most tabs have no content script listening, so most of those messages reject. Those rejections are swallowed where they happen and never reach the inject-and-retry path, which belongs to toggling, not teardown.
- `permissions.onAdded` and `permissions.onRemoved` are the source of truth, so grants and revokes made through the browser's own site-access UI are handled the same way.
- `runtime.onInstalled` and `runtime.onStartup` reconcile registered scripts against `permissions.getAll()`, because registrations are cleared on extension update.
- Stored stickers are kept. Granting again brings them back.

## Data

Unchanged from layer 1: one W3C Web Annotation per sticker.

- **Key:** `stickerpack:<origin + pathname>` in `api.storage.local`.
- **Value:** a JSON array of annotations.
- `list` returns only valid annotations, warning about the rest. `add` and `remove` operate on the raw stored array, so entries a future version adds are preserved by an older one.
- `remove` matches on `id`.
- **Writes are serialized per key.** `api.storage.local` is asynchronous, so a read-modify-write can lose a sticker when two are placed quickly. Each key holds a promise chain, and every `add`/`remove` runs after the previous write for that key settles. (Layer 1's localStorage adapter was safe only because localStorage is synchronous.)
- Storage errors warn and reject; they never throw into the page. The library already unrenders a sticker whose save failed and re-renders one whose removal failed.
- Cross-tab live updates (`storage.onChanged`) are out of scope. Two tabs on the same page won't see each other's stickers until reload.

## Sticker images

- `body.id` stays the canonical URL, e.g. `https://stickerpack.stucco.software/stickers/eyes.png`. A sticker therefore means the same thing in the extension, on a site, and in whatever layer 2 becomes.
- The extension bundles the pack files, copied from `static/stickers/` at build time, and declares them in `web_accessible_resources` with `matches: ['*://*/*']`. No `use_dynamic_url`: `runtime.getURL()` returns the static-id URL, so a dynamic URL would break the only image path we have.
- `stickerMap(pack)` reads each entry's `src` (pack entries are `{ src, alt }`) and maps that canonical URL to `api.runtime.getURL('stickers/<file>')`, where `<file>` is the last path segment. It is synchronous: no probing, no fetching.
- **CSP:** extension URLs are the one image source exempt from a page's CSP in both engines. Chromium treats content-script injections as belonging to the isolated world and exempts `chrome-extension:`; Firefox applies page CSP to most content-script DOM loads (Bugzilla 1267027) but exempts the `moz-extension:` scheme itself.
- **No blob or data fallback.** Firefox explicitly declined to exempt extension-origin blobs from CSP (Bugzilla 1294996, WONTFIX), and `blob:` is not covered by `img-src 'self'`, so a blob would be blocked exactly where an extension URL would be. If a sticker image somehow can't load, the library's existing `error` handler hides it and keeps the annotation.
- Injected sticker images must not use `loading="lazy"`: a deferred load loses its isolated-world attribution in Chromium and gets blocked by page CSP (crbug 40818701). The library sets no `loading` attribute today; a test guards it.
- Because `web_accessible_resources` matches `*://*/*` and the URL is static, any page can probe for the extension's id. That's the accepted trade: `matches` can't be narrowed at runtime, and a dynamic URL would break `runtime.getURL()`, which is the only CSP-exempt way to draw a sticker.
- If a canonical URL has no bundled file at all, it's left as-is and loads over the network. This can only happen if the bundled pack and `defaultPack` fall out of step, and the build copies both from the same place to prevent it.
- In the normal case nothing leaves the machine for sticker art, so the sticker host can't see which sites are being stickered, and it all works offline.

## Library changes (`src/lib/`)

All three are additive, and the documented `destroy()` API keeps working.

1. **`trigger: 'none'`** — mount with no floating button. `trigger` is used in three places in `tray.js` today, and all three need the branch, or a string trigger throws:
   - creation: `const floating = trigger ? null : …` and `const triggerElement = trigger ?? floating` — with `'none'`, create no floating button and no trigger element,
   - listeners: the `addEventListener` on creation and the `removeEventListener` in `destroy()` must be skipped,
   - `onCaptureClick`: `if (trigger && trigger.contains(element))` must not run on a string.
   Esc and the capture layer are unchanged. A `no-trigger` class on the tray moves it to `bottom: 1rem`, instead of leaving a gap where the button would be.
2. **Control API** — `tray.js` returns `{ destroy, open, close, toggle }`, and `index.js` attaches `open`, `close` and `toggle` to the returned `destroy` function. Semantics:
   - `close()` also **cancels placing**, so the capture layer and ghost never outlive the tray. Leaving them up would swallow every click on the page.
   - `open()` while placing cancels placing first, then opens the tray.
   - All three are no-ops after `destroy()`.
   - **The no-op `destroy` returned by the single-instance guard carries no-op `open`, `close` and `toggle` too**, so a second caller can't crash on `handle.toggle()`.
3. **`resolveImage(src) → src`** — optional, defaults to identity, passed through to `createOverlay({ resolveImage })` and `createTray({ resolveImage })`. Used at the three places an image is drawn: tray buttons, the placing ghost, and placed stickers. It never touches `body.id`, `describe`, or anything stored.

The showcase page documents the new options alongside the existing ones.

## Build and packaging

- `vite.extension.config.js` builds `content.js`, `background.js` and `popup.js` as self-contained classic scripts (`format: 'iife'`), with the library bundled in. Content scripts can't be modules, and a classic script works for both the Chromium service worker and Firefox's background scripts.
- A packaging step writes each target directory and copies `static/stickers/` into it:

```
dist/extension/chrome/    manifest.json, content.js, background.js, popup.html, popup.js, icons/, stickers/
dist/extension/firefox/   the same, with the Firefox manifest
```

- `manifest.js` differences, and nothing else:
  - Chromium: `background: { service_worker: 'background.js' }`
  - Firefox: `background: { scripts: ['background.js'] }`, plus `browser_specific_settings: { gecko: { id: 'stickerpack@stucco.software', strict_min_version: '128.0' } }` — 128 is where `optional_host_permissions` landed.
- Shared manifest: `manifest_version: 3`, no `host_permissions`, `optional_host_permissions: ['*://*/*']`, `permissions: ['storage', 'scripting', 'activeTab']`, an `action` with `default_popup` and icons, `web_accessible_resources` as above, and `commands` with `toggle-tray`, suggested as `Alt+Shift+S` by default and `MacCtrl+Shift+S` (Control+Shift+S) on Mac, because `Alt` is Option on Mac and Option combinations type characters. Both browsers let the user change it.
- No `unlimitedStorage`: annotations are tiny, and it's a permission for nothing.
- npm scripts: `build:extension`, and `dev:extension` for a watch build to load unpacked.

## Testing

Vitest with happy-dom and a fake `api` object.

- **`storage`:** per-page scoping; add, list and remove; invalid entries skipped; unknown entries preserved across writes; a rejected write rejects; **two concurrent `add`s both survive** (the serialization test).
- **`page`:** `stickerable` rejects browser pages, extension pages, stores, `file:` and `view-source:`; `watchUrl` fires on `popstate`, `hashchange`, a Navigation API event and a background message, doesn't fire when only the query changed, and `stop()` removes every listener.
- **`pack`:** canonical URLs map to extension URLs; a URL with no bundled file is left alone.
- **`content`:** mounts once even if injected twice; `toggle` reaches the library handle; `teardown` for its own origin destroys the overlay and one for another origin is ignored; a `pageSource` change remounts while a query-only change doesn't.
- **`background`:** a tab whose URL is unreadable keeps the popup, a granted one has it cleared; `permissions.onAdded` registers a script with id `sp:<origin>`, injects into the tab and opens the tray; `onRemoved` unregisters, broadcasts teardown and restores popups; `onInstalled` reconciles registrations from `permissions.getAll()`; a click or command on an ungranted origin never injects even though `activeTab` makes the URL readable.
- **`manifest`:** both targets include the required keys and differ only where intended.
- **Library additions:** `trigger: 'none'` renders no button and doesn't throw, including on a placement click and on destroy; `close()` while placing removes the capture layer; `toggle()` opens and closes and drives peel mode; the no-op handle from a second instance is safe to call; `resolveImage` changes the drawn `src` while the saved annotation keeps the canonical URL; drawn images carry no `loading` attribute.

**By hand**, since happy-dom has no extension runtime: load unpacked in Chrome and Firefox; opt in on a site; stick, reload, peel; navigate within an SPA; check a strict-CSP site in both browsers (github.com) to confirm sticker art still draws; revoke a site; confirm `chrome://` pages report cleanly.

## Error handling

- Storage failures warn; the page never sees an exception.
- A dismissed permission request leaves everything as it was.
- Double injection is caught by the library's `globalThis` single-instance guard, and by a flag in `content.js`.
- Unstickerable URLs, detected by scheme and host: `chrome:`, `about:`, `edge:`, `moz-extension:`, `chrome-extension:`, `file:`, `view-source:`, `data:`, `chromewebstore.google.com`, `addons.mozilla.org`. `file:` is not matched by `*://*/*` anyway, so it can never be granted.
- If `tabs.sendMessage` fails because no content script is there, the background injects one with `scripting.executeScript` and retries once — but only after `permissions.contains` confirms the origin is granted, so an `activeTab` click can never inject into a site you didn't opt into.

## Out of scope

- Accounts and syncing, including SolidState and Solid pods
- Sharing stickers with other people (layer 2)
- A list or search of everywhere you've stickered
- Live updates between two tabs on the same page
- Stickers inside iframes
- Adding your own sticker images
- Editing stickers beyond placing and peeling
- Publishing to the Chrome Web Store or AMO
