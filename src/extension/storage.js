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
