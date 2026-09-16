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
