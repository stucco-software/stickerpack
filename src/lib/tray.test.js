import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTray } from './tray.js'

const stickers = [{ src: 'https://stickerpack.stucco.software/stickers/eyes.svg', alt: 'Googly eyes' }]

let host, root, tray, calls

const $ = (selector) => root.querySelector(selector)
const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
const clickCapture = (clientX, clientY) =>
  $('.capture').dispatchEvent(new MouseEvent('click', { clientX, clientY, bubbles: true }))

const setup = (options = {}) => {
  host = document.createElement('div')
  document.body.append(host)
  root = host.attachShadow({ mode: 'open' })
  calls = { onOpen: vi.fn(), onClose: vi.fn(), onPlace: vi.fn() }
  tray = createTray({ root, host, stickers, ...calls, ...options })
}

beforeEach(() => {
  document.body.innerHTML = '<a href="#elsewhere">a link</a>'
})

afterEach(() => {
  tray.destroy()
  delete document.elementsFromPoint
})

it('renders a floating trigger and a hidden tray of stickers', () => {
  setup()
  expect($('.trigger')).not.toBe(null)
  expect($('.tray').hidden).toBe(true)
  expect($('.tray button img').getAttribute('alt')).toBe('Googly eyes')
})

it('toggles the tray with the trigger', () => {
  setup()
  $('.trigger').click()
  expect($('.tray').hidden).toBe(false)
  expect(calls.onOpen).toHaveBeenCalledTimes(1)
  $('.trigger').click()
  expect($('.tray').hidden).toBe(true)
  expect(calls.onClose).toHaveBeenCalledTimes(1)
})

it('closes the tray on Escape', () => {
  setup()
  $('.trigger').click()
  escape()
  expect($('.tray').hidden).toBe(true)
  expect(calls.onClose).toHaveBeenCalledTimes(1)
})

it('places a sticker on the page element under the click', () => {
  setup()
  const link = document.querySelector('a')
  document.elementsFromPoint = vi.fn(() => [host, link, document.body, document.documentElement])
  $('.trigger').click()
  $('.tray button').click()
  expect(calls.onClose).toHaveBeenCalledTimes(1)
  expect($('.capture').hidden).toBe(false)
  clickCapture(10, 20)
  expect(document.elementsFromPoint).toHaveBeenCalledWith(10, 20)
  expect(calls.onPlace).toHaveBeenCalledWith({ src: stickers[0].src, element: link, clientX: 10, clientY: 20 })
  expect($('.capture').hidden).toBe(true)
})

it('cancels placing with Escape', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  escape()
  expect($('.capture').hidden).toBe(true)
  expect(calls.onPlace).not.toHaveBeenCalled()
})

it('cancels placing with the floating trigger without reopening the tray', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  $('.trigger').click()
  expect($('.capture').hidden).toBe(true)
  expect($('.tray').hidden).toBe(true)
  expect(calls.onOpen).toHaveBeenCalledTimes(1)
})

it('uses an owner trigger instead of the floating one', () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  setup({ trigger })
  expect($('.trigger')).toBe(null)
  trigger.click()
  expect($('.tray').hidden).toBe(false)
})

it('cancels placing when the owner trigger is under the click', () => {
  const trigger = document.createElement('button')
  trigger.innerHTML = '<span>Stickers</span>'
  document.body.append(trigger)
  setup({ trigger })
  document.elementsFromPoint = vi.fn(() => [host, trigger.firstChild, trigger, document.body])
  trigger.click()
  $('.tray button').click()
  clickCapture(1, 1)
  expect(calls.onPlace).not.toHaveBeenCalled()
  expect($('.capture').hidden).toBe(true)
})

it('destroy removes its elements and listeners', () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  setup({ trigger })
  tray.destroy()
  trigger.click()
  expect(calls.onOpen).not.toHaveBeenCalled()
  expect(root.querySelector('.tray')).toBe(null)
})

it('renders no trigger at all with trigger: none', () => {
  setup({ trigger: 'none' })
  expect($('.trigger')).toBe(null)
  expect($('.tray').hidden).toBe(true)
  expect($('.tray').classList.contains('no-trigger')).toBe(true)
})

it('opens, closes and toggles without a trigger', () => {
  setup({ trigger: 'none' })
  tray.open()
  expect($('.tray').hidden).toBe(false)
  expect(calls.onOpen).toHaveBeenCalledTimes(1)
  tray.toggle()
  expect($('.tray').hidden).toBe(true)
  tray.toggle()
  expect($('.tray').hidden).toBe(false)
  tray.close()
  expect($('.tray').hidden).toBe(true)
})

it('places a sticker with no trigger and does not throw', () => {
  setup({ trigger: 'none' })
  const link = document.querySelector('a')
  document.elementsFromPoint = vi.fn(() => [host, link, document.body])
  tray.open()
  $('.tray button').click()
  clickCapture(5, 6)
  expect(calls.onPlace).toHaveBeenCalledWith({ src: stickers[0].src, element: link, clientX: 5, clientY: 6 })
})

it('close() also cancels placing', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  expect($('.capture').hidden).toBe(false)
  tray.close()
  expect($('.capture').hidden).toBe(true)
  expect($('.ghost').hidden).toBe(true)
})

it('open() while placing cancels placing first', () => {
  setup()
  $('.trigger').click()
  $('.tray button').click()
  tray.open()
  expect($('.capture').hidden).toBe(true)
  expect($('.tray').hidden).toBe(false)
})

it('ignores open, close and toggle after destroy', () => {
  setup({ trigger: 'none' })
  tray.destroy()
  tray.open()
  tray.toggle()
  expect(root.querySelector('.tray')).toBe(null)
})

it('draws tray images through resolveImage without loading=lazy', () => {
  setup({ resolveImage: (src) => `${src}?local` })
  const img = $('.tray button img')
  expect(img.getAttribute('src')).toBe(`${stickers[0].src}?local`)
  expect(img.hasAttribute('loading')).toBe(false)
})

it('draws the ghost through resolveImage too', () => {
  setup({ resolveImage: (src) => `${src}?local` })
  $('.trigger').click()
  $('.tray button').click()
  expect($('.ghost').getAttribute('src')).toBe(`${stickers[0].src}?local`)
})
