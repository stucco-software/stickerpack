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

  const attempt = (operation) => {
    try {
      return operation(backend)
    } catch (error) {
      if (inMemory) throw error
      fallBack(error)
      return operation(backend)
    }
  }

  const read = (source) => {
    const raw = attempt((store) => store.getItem(PREFIX + source))
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
    return parsed.filter((entry) => {
      if (isAnnotation(entry)) return true
      console.warn('stickerpack: skipping invalid stored sticker', entry)
      return false
    })
  }

  const write = (source, annotations) =>
    attempt((store) => store.setItem(PREFIX + source, JSON.stringify(annotations)))

  return {
    async list(source) {
      return read(source)
    },
    async add(annotation) {
      const source = annotation.target.source
      write(source, [...read(source), annotation])
    },
    async remove(annotation) {
      const source = annotation.target.source
      write(source, read(source).filter((entry) => entry.id !== annotation.id))
    }
  }
}
