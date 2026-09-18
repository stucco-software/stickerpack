import { it, expect, vi, afterEach } from 'vitest'
import { extensionStorage } from './storage.js'
import { createAnnotation } from '../lib/annotation.js'

const sticker = (source) => createAnnotation({
  src: 'https://stickerpack.stucco.software/stickers/eyes.svg',
  source,
  selectors: [{ type: 'CssSelector', value: 'body' }],
  x: 10,
  y: 20
})

const fakeArea = () => {
  const data = {}
  return {
    data,
    get: vi.fn(async (key) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (entries) => Object.assign(data, entries))
  }
}

afterEach(() => vi.restoreAllMocks())

it('adds and lists stickers per page', async () => {
  const storage = extensionStorage(fakeArea())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/b')
  await storage.add(a)
  await storage.add(b)
  expect(await storage.list('https://example.com/a')).toEqual([a])
  expect(await storage.list('https://example.com/b')).toEqual([b])
})

it('stores each page under stickerpack:<source>', async () => {
  const area = fakeArea()
  const a = sticker('https://example.com/a')
  await extensionStorage(area).add(a)
  expect(area.data['stickerpack:https://example.com/a']).toEqual([a])
})

it('removes a sticker by id', async () => {
  const storage = extensionStorage(fakeArea())
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/a')
  await storage.add(a)
  await storage.add(b)
  await storage.remove(a)
  expect(await storage.list('https://example.com/a')).toEqual([b])
})

it('keeps both stickers when two are placed at once', async () => {
  const area = fakeArea()
  const storage = extensionStorage(area)
  const a = sticker('https://example.com/a')
  const b = sticker('https://example.com/a')
  await Promise.all([storage.add(a), storage.add(b)])
  expect(await storage.list('https://example.com/a')).toEqual([a, b])
})

it('skips invalid stored entries but keeps them on write', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const area = fakeArea()
  const a = sticker('https://example.com/a')
  area.data['stickerpack:https://example.com/a'] = [{ nope: true }, a]
  const storage = extensionStorage(area)
  expect(await storage.list('https://example.com/a')).toEqual([a])
  expect(warn).toHaveBeenCalled()
  const b = sticker('https://example.com/a')
  await storage.add(b)
  expect(area.data['stickerpack:https://example.com/a']).toEqual([{ nope: true }, a, b])
})

it('treats a missing or broken entry as empty', async () => {
  const area = fakeArea()
  area.data['stickerpack:https://example.com/a'] = 'not an array'
  const storage = extensionStorage(area)
  expect(await storage.list('https://example.com/a')).toEqual([])
  expect(await storage.list('https://example.com/nothing')).toEqual([])
})

it('rejects when the write fails', async () => {
  const area = fakeArea()
  area.set = vi.fn(async () => { throw new Error('quota') })
  await expect(extensionStorage(area).add(sticker('s'))).rejects.toThrow('quota')
})
