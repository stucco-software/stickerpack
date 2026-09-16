import { it, expect, vi, afterEach } from 'vitest'
import { localStorageAdapter } from './local.js'
import { createAnnotation } from '../annotation.js'

const sticker = (source) => createAnnotation({
  src: 'https://stickers.stucco.software/eyes.png',
  source,
  selectors: [{ type: 'CssSelector', value: 'body' }],
  x: 10,
  y: 20
})

const fakeStorage = () => {
  const map = new Map()
  return {
    map,
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)) }
  }
}

afterEach(() => vi.restoreAllMocks())

it('adds and lists stickers per page', async () => {
  const storage = localStorageAdapter(fakeStorage())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/b')
  await storage.add(a)
  await storage.add(b)
  expect(await storage.list('https://example.com/a')).toEqual([a])
  expect(await storage.list('https://example.com/b')).toEqual([b])
})

it('stores each page under stickerpack:<source>', async () => {
  const backend = fakeStorage()
  const a = sticker('https://example.com/a')
  await localStorageAdapter(backend).add(a)
  expect(JSON.parse(backend.map.get('stickerpack:https://example.com/a'))).toEqual([a])
})

it('removes a sticker by id', async () => {
  const storage = localStorageAdapter(fakeStorage())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/a')
  await storage.add(a)
  await storage.add(b)
  await storage.remove(a)
  expect(await storage.list('https://example.com/a')).toEqual([b])
})

it('skips invalid stored entries', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const backend = fakeStorage()
  const a = sticker('s')
  backend.setItem('stickerpack:s', JSON.stringify([a, { nope: true }]))
  expect(await localStorageAdapter(backend).list('s')).toEqual([a])
  expect(warn).toHaveBeenCalled()
})

it('treats unreadable JSON as empty', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const backend = fakeStorage()
  backend.setItem('stickerpack:s', '{nope')
  expect(await localStorageAdapter(backend).list('s')).toEqual([])
  expect(warn).toHaveBeenCalled()
})

it('falls back to memory once when storage throws on read', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const broken = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') }
  }
  const storage = localStorageAdapter(broken)
  const a = sticker('s')
  await storage.add(a)
  expect(await storage.list('s')).toEqual([a])
  expect(warn).toHaveBeenCalledTimes(1)
})

it('rejects the write and does not fall back when only setItem throws', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const backend = {
    getItem: () => null,
    setItem: () => { throw new Error('quota exceeded') }
  }
  const storage = localStorageAdapter(backend)
  const a = sticker('s')
  await expect(storage.add(a)).rejects.toThrow()
  expect(warn).not.toHaveBeenCalled()
})

it('uses window.localStorage by default', async () => {
  localStorage.clear()
  const a = sticker('s')
  await localStorageAdapter().add(a)
  expect(JSON.parse(localStorage.getItem('stickerpack:s'))).toEqual([a])
})

it('preserves entries this version does not understand across writes', async () => {
  const backend = fakeStorage()
  const unknownShaped = { weird: true }
  const a = sticker('s')
  backend.setItem('stickerpack:s', JSON.stringify([unknownShaped, a]))
  const storage = localStorageAdapter(backend)
  const b = sticker('s')
  await storage.add(b)
  expect(JSON.parse(backend.map.get('stickerpack:s'))).toEqual([unknownShaped, a, b])
  await storage.remove(a)
  expect(JSON.parse(backend.map.get('stickerpack:s'))).toEqual([unknownShaped, b])
})

it('removes stickers even when null entries are stored', async () => {
  const backend = fakeStorage()
  const a = sticker('s')
  backend.setItem('stickerpack:s', JSON.stringify([null, a]))
  await localStorageAdapter(backend).remove(a)
  expect(JSON.parse(backend.map.get('stickerpack:s'))).toEqual([null])
})
