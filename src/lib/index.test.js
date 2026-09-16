import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import StickerPack, { localStorageAdapter } from './index.js'
import { createAnnotation, pageSource } from './annotation.js'
import { defaultPack } from './pack.js'

const memory = (initial = []) => {
  const saved = [...initial]
  return {
    saved,
    list: vi.fn(async () => [...saved]),
    add: vi.fn(async (annotation) => { saved.push(annotation) }),
    remove: vi.fn(async (annotation) => {
      saved.splice(saved.findIndex((entry) => entry.id === annotation.id), 1)
    })
  }
}

const shadow = () => document.querySelector('[data-stickerpack]').shadowRoot
const stickers = () => shadow().querySelectorAll('.sticker')

let destroy = () => {}

beforeEach(() => {
  document.body.innerHTML = '<p>Hello sticker world</p>'
})

afterEach(() => {
  destroy()
  destroy = () => {}
  delete document.elementsFromPoint
  vi.restoreAllMocks()
})

it('re-exports the localStorage adapter', () => {
  expect(typeof localStorageAdapter).toBe('function')
})

it('mounts, loads this page’s stickers and unmounts', async () => {
  const saved = createAnnotation({
    src: 'https://stickers.stucco.software/eyes.png',
    source: pageSource(),
    selectors: [{ type: 'CssSelector', value: 'body > p:nth-child(1)' }],
    x: 50,
    y: 50
  })
  const storage = memory([saved])
  destroy = StickerPack({ storage })
  await vi.waitFor(() => expect(stickers()).toHaveLength(1))
  expect(storage.list).toHaveBeenCalledWith(pageSource())
  destroy()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})

it('offers the default pack plus owner stickers', () => {
  destroy = StickerPack({ storage: memory(), stickers: ['/stickers/duck.png'] })
  const images = shadow().querySelectorAll('.tray img')
  expect(images).toHaveLength(defaultPack.length + 1)
  expect(images[images.length - 1].getAttribute('src')).toBe(new URL('/stickers/duck.png', location.href).href)
})

it('can leave out the default pack', () => {
  destroy = StickerPack({ storage: memory(), defaultPack: false, stickers: ['/a.png'] })
  expect(shadow().querySelectorAll('.tray img')).toHaveLength(1)
})

it('skips invalid stickers from storage', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  destroy = StickerPack({ storage: memory([{ nope: true }]) })
  await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  expect(stickers()).toHaveLength(0)
})

it('places and saves a sticker', async () => {
  const storage = memory()
  destroy = StickerPack({ storage, defaultPack: false, stickers: ['/stickers/duck.png'] })
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20 })
  const host = document.querySelector('[data-stickerpack]')
  document.elementsFromPoint = () => [host, p, document.body]
  shadow().querySelector('.trigger').click()
  shadow().querySelector('.tray button').click()
  shadow().querySelector('.capture').dispatchEvent(new MouseEvent('click', { clientX: 25, clientY: 10, bubbles: true }))
  await vi.waitFor(() => expect(storage.add).toHaveBeenCalledTimes(1))
  const [annotation] = storage.add.mock.calls[0]
  expect(annotation.body.id).toBe(new URL('/stickers/duck.png', location.href).href)
  expect(annotation.target.source).toBe(pageSource())
  expect(annotation.target.selector[0]).toMatchObject({ type: 'CssSelector', value: 'body > p:nth-child(1)' })
  expect(annotation.target.selector[0].refinedBy.value).toBe('xywh=percent:25,50,0,0')
  expect(stickers()).toHaveLength(1)
})

it('unrenders a placed sticker when saving fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const storage = memory()
  storage.add.mockRejectedValue(new Error('nope'))
  destroy = StickerPack({ storage, defaultPack: false, stickers: ['/a.png'] })
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20 })
  const host = document.querySelector('[data-stickerpack]')
  document.elementsFromPoint = () => [host, p]
  shadow().querySelector('.trigger').click()
  shadow().querySelector('.tray button').click()
  shadow().querySelector('.capture').dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1, bubbles: true }))
  await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  expect(stickers()).toHaveLength(0)
})

it('peels a sticker while the tray is open', async () => {
  const saved = createAnnotation({
    src: 'https://stickers.stucco.software/eyes.png',
    source: pageSource(),
    selectors: [{ type: 'CssSelector', value: 'body > p:nth-child(1)' }],
    x: 50,
    y: 50
  })
  const storage = memory([saved])
  destroy = StickerPack({ storage })
  await vi.waitFor(() => expect(stickers()).toHaveLength(1))
  shadow().querySelector('.trigger').click()
  stickers()[0].click()
  expect(stickers()).toHaveLength(0)
  await vi.waitFor(() => expect(storage.remove).toHaveBeenCalledWith(saved))
})

it('warns and returns a no-op for a second instance', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  destroy = StickerPack({ storage: memory() })
  const second = StickerPack({ storage: memory() })
  expect(warn).toHaveBeenCalledTimes(1)
  second()
  expect(document.querySelectorAll('[data-stickerpack]')).toHaveLength(1)
  destroy()
  destroy = StickerPack({ storage: memory() })
  expect(document.querySelectorAll('[data-stickerpack]')).toHaveLength(1)
})

it('warns and returns a no-op when another bundle already has an active instance', () => {
  const ACTIVE = Symbol.for('stickerpack.active')
  globalThis[ACTIVE] = () => {}
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const result = StickerPack({ storage: memory() })
  expect(warn).toHaveBeenCalledTimes(1)
  result()
  expect(document.querySelectorAll('[data-stickerpack]')).toHaveLength(0)
  delete globalThis[ACTIVE]
})

it('warns and does not render when describing the placement throws', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const unhandled = vi.fn()
  window.addEventListener('unhandledrejection', unhandled)
  const storage = memory()
  destroy = StickerPack({ storage, defaultPack: false, stickers: ['/a.png'] })
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => { throw new Error('boom') }
  const host = document.querySelector('[data-stickerpack]')
  document.elementsFromPoint = () => [host, p]
  shadow().querySelector('.trigger').click()
  shadow().querySelector('.tray button').click()
  shadow().querySelector('.capture').dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1, bubbles: true }))
  await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('stickerpack: could not place sticker', expect.any(Error)))
  expect(stickers()).toHaveLength(0)
  expect(storage.add).not.toHaveBeenCalled()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(unhandled).not.toHaveBeenCalled()
  window.removeEventListener('unhandledrejection', unhandled)
})

it('skips owner sticker URLs that fail to parse', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  destroy = StickerPack({ storage: memory(), defaultPack: false, stickers: ['http://[', '/ok.png'] })
  expect(shadow().querySelectorAll('.tray img')).toHaveLength(1)
  expect(warn).toHaveBeenCalledWith('stickerpack: skipping invalid sticker URL', 'http://[')
})

it('re-renders a sticker when removing fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const saved = createAnnotation({
    src: 'https://stickers.stucco.software/eyes.png',
    source: pageSource(),
    selectors: [{ type: 'CssSelector', value: 'body > p:nth-child(1)' }],
    x: 50,
    y: 50
  })
  const storage = memory([saved])
  storage.remove.mockRejectedValue(new Error('nope'))
  destroy = StickerPack({ storage })
  await vi.waitFor(() => expect(stickers()).toHaveLength(1))
  shadow().querySelector('.trigger').click()
  stickers()[0].click()
  expect(stickers()).toHaveLength(0)
  await vi.waitFor(() => expect(warn).toHaveBeenCalled())
  await vi.waitFor(() => expect(stickers()).toHaveLength(1))
})

it('destroying immediately prevents a pending sticker list from rendering', async () => {
  let resolveList
  const storage = {
    list: vi.fn(() => new Promise((resolve) => { resolveList = resolve })),
    add: vi.fn(async () => {}),
    remove: vi.fn(async () => {})
  }
  const stop = StickerPack({ storage })
  expect(() => stop()).not.toThrow()
  await vi.waitFor(() => expect(storage.list).toHaveBeenCalled())
  resolveList([createAnnotation({
    src: 'https://stickers.stucco.software/eyes.png',
    source: pageSource(),
    selectors: [{ type: 'CssSelector', value: 'body > p:nth-child(1)' }],
    x: 50,
    y: 50
  })])
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})

it('cleans up the overlay when the trigger is not an element', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  expect(() => StickerPack({ storage: memory(), trigger: {} })).toThrow()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
  expect(globalThis[Symbol.for('stickerpack.active')]).toBeFalsy()
})

it('ignores a stickers option that is not an array', () => {
  destroy = StickerPack({ storage: memory(), defaultPack: false, stickers: '/a.png' })
  expect(shadow().querySelectorAll('.tray img')).toHaveLength(0)
})
