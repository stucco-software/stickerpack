# Stickerpack

Stickers, for websites. Two lines of HTML let visitors stick stickers on your pages, and
a browser extension lets you stick them on anyone else's. Stickers stay where you put
them and come back when you do.

No dependencies, no server, no accounts.

- **The library** — `src/lib/`, a dependency-free ES module plus a `<sticker-pack>`
  custom element.
- **The extension** — `src/extension/`, a Chromium and Firefox extension built on the
  same library. See [docs/extension.md](docs/extension.md).
- **The website** — `src/routes/`, a SvelteKit app that is both the showcase and the
  docs, at [stickerpack.stucco.software](https://stickerpack.stucco.software).

## Requirements

- Node 24 or newer (developed on 22, and the Firefox reviewers' environment is 24)
- npm 10 or newer

## Everything you can run

```sh
npm install              # install dev dependencies

npm run dev              # the website, at localhost:5173
npm test                 # the whole suite (library, extension, site)
npm run build            # build the website

npm run build:lib        # build the library into dist/
npm run build:extension  # build the extension into dist-extension/<browser>/
npm run package:extension # build, then zip for the stores
```

`npm run dev` and `npm run build` build the library first, because the site serves
`dist/stickerpack.js` at `/stickerpack.js` for people to download or link.

## Building the extension from source

This is the reproducible build that Mozilla's reviewers run:

```sh
npm ci
npm run build:extension
```

It writes `dist-extension/chrome/` and `dist-extension/firefox/`, each a complete
unpacked extension. The only difference between them is the manifest: Chromium wants a
`background.service_worker`, Firefox wants `background.scripts` and an add-on id.

`scripts/build-extension.js` drives it: four Vite builds per browser, each producing a
self-contained IIFE (a content script can't be a module, and a classic script works as a
service worker too), then it copies the HTML, CSS, icons and stickers and writes the
manifest from `src/extension/manifest.js`.

To load the result in a browser, see [docs/extension.md](docs/extension.md).

## Using the library on your own site

```html
<script type="module" src="https://stickerpack.stucco.software/stickerpack.js"></script>
<sticker-pack></sticker-pack>
```

or

```js
import StickerPack from 'stickerpack'

const destroy = StickerPack()
```

Full options are documented at
[stickerpack.stucco.software](https://stickerpack.stucco.software).

## How a sticker is stored

Every sticker is a [W3C Web Annotation](https://www.w3.org/TR/annotation-model/). Its
body is the sticker image's URL, and its target says which page it's on and where, as a
CSS selector plus a quote of the text it was stuck to. That means a sticker means the
same thing on a website, in the extension, and in whatever comes next.

## Licence and credits

Sticker art comes from [Twemoji](https://github.com/jdecked/twemoji) under CC BY 4.0.
See [static/stickers/ATTRIBUTION.md](static/stickers/ATTRIBUTION.md).

Made by [Stucco Software](https://stucco.software).
