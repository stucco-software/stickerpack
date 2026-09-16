import { describe } from './anchor.js'
import { createAnnotation, isAnnotation, pageSource, toSticker } from './annotation.js'
import { createOverlay } from './overlay.js'
import { defaultPack } from './pack.js'
import { localStorageAdapter } from './storage/local.js'
import { createTray } from './tray.js'

export { localStorageAdapter }

// A Symbol.for key (rather than a module-level variable) so the single-instance guard
// still works when the page loads more than one bundled copy of this module, e.g. a
// script-tag build alongside an npm import.
const ACTIVE = Symbol.for('stickerpack.active')

const warn = (message, ...details) => console.warn(`stickerpack: ${message}`, ...details)

export default function StickerPack(options = {}) {
  if (globalThis[ACTIVE]) {
    warn('StickerPack() is already running, ignoring this call.')
    return () => {}
  }

  const { stickers = [], defaultPack: includeDefaultPack = true, trigger } = options
  const storage = options.storage ?? localStorageAdapter()
  const source = pageSource()
  const ownedStickers = (Array.isArray(stickers) ? stickers : []).flatMap((src) => {
    try {
      return [toSticker(src)]
    } catch {
      warn('skipping invalid sticker URL', src)
      return []
    }
  })
  const pack = [...(includeDefaultPack ? defaultPack : []), ...ownedStickers]
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

  let tray
  try {
    tray = createTray({
      root: overlay.root,
      host: overlay.host,
      stickers: pack,
      trigger,
      onOpen: () => overlay.setPeelable(true),
      onClose: () => overlay.setPeelable(false),
      onPlace: async ({ src, element, clientX, clientY }) => {
        let annotation
        try {
          const { selectors, x, y } = describe(element, clientX, clientY)
          annotation = createAnnotation({ src, source, selectors, x, y })
          overlay.render(annotation)
        } catch (error) {
          warn('could not place sticker', error)
          if (annotation) overlay.unrender(annotation.id)
          return
        }
        try {
          await storage.add(annotation)
        } catch (error) {
          warn('could not save sticker', error)
          overlay.unrender(annotation.id)
        }
      }
    })
  } catch (error) {
    overlay.destroy()
    throw error
  }

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
    if (globalThis[ACTIVE] === destroy) globalThis[ACTIVE] = null
  }

  globalThis[ACTIVE] = destroy
  return destroy
}
