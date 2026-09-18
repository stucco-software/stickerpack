import { it, expect } from 'vitest'
import { resolveImage, stickerMap } from './pack.js'
import { defaultPack } from '../lib/pack.js'

const getURL = (path) => `moz-extension://abc/${path}`

it('maps every canonical pack URL to a bundled file', () => {
  const map = stickerMap(defaultPack, getURL)
  expect(map.size).toBe(defaultPack.length)
  for (const { src } of defaultPack) {
    const file = new URL(src).pathname.split('/').pop()
    expect(map.get(src)).toBe(`moz-extension://abc/stickers/${file}`)
  }
})

it('resolves a canonical URL to its bundled copy', () => {
  const map = stickerMap(defaultPack, getURL)
  const { src } = defaultPack[0]
  expect(resolveImage(map)(src)).toBe(map.get(src))
})

it('leaves unknown sticker URLs alone', () => {
  const map = stickerMap(defaultPack, getURL)
  expect(resolveImage(map)('https://example.com/mine.png')).toBe('https://example.com/mine.png')
})
