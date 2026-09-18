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
  if (!document.body) return () => {}

  const open = () => mount({ trigger: 'none', storage, resolveImage: images })

  let handle = open()

  const watcher = watchUrl(() => {
    try {
      handle()
      handle = open()
    } catch (error) {
      console.warn('stickerpack: could not remount', error)
    }
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
