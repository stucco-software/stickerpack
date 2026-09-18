# Stickerpack, the browser extension

Put stickers on any website. They stay where you put them, they come back when you do,
and they're yours: nothing is sent anywhere, and no site can see them.

The extension isn't in any store yet, so installing means building it from this repo.
It takes about a minute.

## Build it

```sh
npm install
npm run build:extension
```

That writes two folders:

```
dist-extension/chrome/     Chrome, Edge, Brave, Arc, any Chromium browser
dist-extension/firefox/    Firefox
```

Nothing else is needed. The extension has no dependencies, no server and no account.

## Install it in Chrome, Edge or another Chromium browser

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**, top right.
3. Click **Load unpacked** and choose `dist-extension/chrome`.
4. The ✦ sticker icon appears in your toolbar. Pin it if you like.

It stays installed until you remove it. After rebuilding, press **Reload** on the
extension's card to pick up the new build.

## Install it in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Choose `dist-extension/firefox/manifest.json` (the file itself, not the folder).

**Firefox removes temporary add-ons when you quit**, so you'll load it again next time.
That's a Firefox rule for unsigned extensions, not something the extension can avoid.
Your stickers survive: they're stored per extension id, and the id is fixed
(`stickerpack@stucco.software`).

Firefox 128 or newer is required, because that's where per-site permissions landed.

## Use it

1. **Turn on a site.** On a site you want to sticker, click the toolbar button. It asks
   "Stick stickers on this site?" Say yes, and the browser asks you to confirm access to
   that one site.
2. **Stick something.** The tray opens. Pick a sticker, and it follows your cursor.
   Click anywhere on the page to stick it. Links won't fire while you're placing. Esc
   cancels.
3. **Come back later.** Your stickers are drawn as soon as the page loads. No buttons,
   nothing else changed on the page.
4. **Open the tray again** with the toolbar button, or the keyboard shortcut:
   `Alt+Shift+S`, or `Control+Shift+S` on a Mac. Both browsers let you change it
   (Chrome: `chrome://extensions/shortcuts`; Firefox: Add-ons → gear → Manage Extension
   Shortcuts).
5. **Peel one off.** With the tray open, click any sticker on the page to remove it.

## Turn a site back off

Right-click the toolbar icon and choose **Options** (Firefox: **Manage Extension**, then
Preferences). The page lists every site you've turned on, with a button to stop
stickering it. The stickers disappear from open tabs straight away.

Your stickers for that site are kept, so if you turn it back on later they come back.
Your browser's own "site access" settings work too.

## What it can and can't see

- It asks for **no access to any site** when you install it. Access is granted one site
  at a time, by you, at the moment you say yes.
- On sites you haven't turned on, none of its code runs at all.
- Stickers are saved in the extension's own storage, on your machine. There's no server,
  no account, and no network request: even the sticker pictures are bundled inside the
  extension.
- Sites can't see your stickers. They're drawn in a shadow layer that the page's own
  code and CSS never touch.

## Known limits

- **Stickers stick to the page's content.** If a site rewrites the part of the page you
  stuck a sticker to, the sticker waits, hidden, and reappears if that content comes
  back.
- **One tab at a time.** Two tabs open on the same page won't see each other's new
  stickers until you reload.
- **No sharing yet.** These stickers are yours alone. Shared stickers, and saving to your
  own account, are the next two pieces of work.
- **Stickers inside iframes** aren't supported.
- **A page can't be stickered** if the browser won't let extensions run there:
  `chrome://` and `about:` pages, the extension stores, PDFs and local files. The popup
  tells you so.

## For developers

```sh
npm run build:extension   # build both targets
npm run dev:extension     # rebuild the scripts on change
npm test                  # the whole suite, including the extension modules
```

`dev:extension` rebuilds the JavaScript only. If you change the manifest, the HTML, the
CSS or the stickers, run `build:extension` again. Either way, reload the extension in
your browser to pick up changes.

The source lives in `src/extension/`:

| File | What it does |
|---|---|
| `browser.js` | The one place `chrome` and `browser` are reconciled |
| `page.js` | Which pages can be stickered, and noticing when the page changes |
| `storage.js` | Saving stickers in extension storage, one entry per page |
| `pack.js` | Pointing canonical sticker URLs at the copies bundled here |
| `content.js` | Runs in the page: mounts the sticker library, handles messages |
| `background.js` | Permissions, registering content scripts, the toolbar and shortcut |
| `popup/` | Turning a site on |
| `options/` | The list of sites, and turning them off |
| `manifest.js` | The Chromium and Firefox manifests, from one definition |

The extension is a thin shell around the same library a website can install
(`src/lib/`), which is why a sticker means the same thing in both. Design notes are in
`docs/superpowers/specs/2026-09-18-stickerpack-extension-design.md`.
