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

  // Falling back to memory only makes sense for reads: if the backend is unusable we can't
  // read what was there before anyway. A write failure (e.g. a full quota) shouldn't silently
  // switch future reads/writes to memory - it should just reject that one operation.
  const attemptRead = (operation) => {
    try {
      return operation(backend)
    } catch (error) {
      if (inMemory) throw error
      fallBack(error)
      return operation(backend)
    }
  }

  // The raw, unfiltered array for a source: unknown/invalid entries are kept as-is so a
  // future version's data isn't discarded when this version writes back to the same key.
  const readRaw = (source) => {
    const raw = attemptRead((store) => store.getItem(PREFIX + source))
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
    return parsed
  }

  const readValid = (source) =>
    readRaw(source).filter((entry) => {
      if (isAnnotation(entry)) return true
      console.warn('stickerpack: skipping invalid stored sticker', entry)
      return false
    })

  const write = (source, entries) =>
    backend.setItem(PREFIX + source, JSON.stringify(entries))

  return {
    async list(source) {
      return readValid(source)
    },
    async add(annotation) {
      const source = annotation.target.source
      write(source, [...readRaw(source), annotation])
    },
    async remove(annotation) {
      const source = annotation.target.source
      write(source, readRaw(source).filter((entry) => entry?.id !== annotation.id))
    }
  }
}
