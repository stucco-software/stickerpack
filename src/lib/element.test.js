import { it, expect, beforeEach } from 'vitest'
import { StickerPackElement, defineStickerPackElement } from './element.js'

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

it('defines <sticker-pack> once', () => {
  defineStickerPackElement()
  defineStickerPackElement()
  expect(customElements.get('sticker-pack')).toBe(StickerPackElement)
})

it('mounts from attributes on connect and unmounts on disconnect', () => {
  defineStickerPackElement()
  const element = document.createElement('sticker-pack')
  element.setAttribute('stickers', '/a.png   /b.png')
  element.setAttribute('no-default-pack', '')
  element.innerHTML = '<button slot="trigger">Stickers!</button>'
  document.body.append(element)

  const root = document.querySelector('[data-stickerpack]').shadowRoot
  expect(root.querySelector('.trigger')).toBe(null)
  expect(root.querySelectorAll('.tray img')).toHaveLength(2)

  element.querySelector('button').click()
  expect(root.querySelector('.tray').hidden).toBe(false)

  element.remove()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})
