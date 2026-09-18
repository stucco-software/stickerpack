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
