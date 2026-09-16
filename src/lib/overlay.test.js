import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOverlay } from './overlay.js'
import { createAnnotation } from './annotation.js'

const SRC = 'https://stickers.stucco.software/eyes.png'

const annotationAt = (value) => createAnnotation({
  src: SRC,
  source: 's',
  selectors: [{ type: 'CssSelector', value }],
  x: 50,
  y: 50
})

const nextFrame = () => new Promise((done) => requestAnimationFrame(() => done()))
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

let overlay
const stickers = () => overlay.root.querySelectorAll('.sticker')

beforeEach(() => {
  document.body.innerHTML = '<p>Hello sticker world</p>'
  overlay = createOverlay()
})

afterEach(() => overlay.destroy())

it('mounts a shadow host at the end of body', () => {
  expect(document.body.lastElementChild).toBe(overlay.host)
  expect(overlay.host.hasAttribute('data-stickerpack')).toBe(true)
  expect(overlay.host.shadowRoot).toBe(overlay.root)
})

it('renders stickers whose anchor resolves', () => {
  overlay.render(annotationAt('body > p:nth-child(1)'))
  expect(stickers()).toHaveLength(1)
  expect(stickers()[0].getAttribute('src')).toBe(SRC)
})

it('does not render the same annotation twice', () => {
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  overlay.render(annotation)
  expect(stickers()).toHaveLength(1)
})

it('keeps unresolvable stickers orphaned', () => {
  overlay.render(annotationAt('body > section:nth-child(9)'))
  expect(stickers()).toHaveLength(0)
})

it('unrenders stickers', () => {
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  overlay.unrender(annotation.id)
  expect(stickers()).toHaveLength(0)
})

it('reports clicks only while peelable', () => {
  const onClick = vi.fn()
  overlay.onStickerClick(onClick)
  const annotation = annotationAt('body > p:nth-child(1)')
  overlay.render(annotation)
  stickers()[0].click()
  expect(onClick).not.toHaveBeenCalled()
  overlay.setPeelable(true)
  stickers()[0].click()
  expect(onClick).toHaveBeenCalledWith(annotation)
})

it('positions stickers relative to the layer', async () => {
  const p = document.querySelector('p')
  p.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 40 })
  overlay.root.querySelector('.layer').getBoundingClientRect = () => ({ left: 10, top: -30, width: 0, height: 0 })
  overlay.render(annotationAt('body > p:nth-child(1)'))
  await nextFrame()
  await nextFrame()
  expect(stickers()[0].style.left).toBe('190px')
  expect(stickers()[0].style.top).toBe('100px')
})

it('renders orphans once their content appears', async () => {
  overlay.render(annotationAt('body > section:nth-child(2)'))
  expect(stickers()).toHaveLength(0)
  document.body.insertBefore(document.createElement('section'), overlay.host)
  await wait(400)
  expect(stickers()).toHaveLength(1)
})

it('orphans stickers whose anchor is removed', async () => {
  overlay.render(annotationAt('body > p:nth-child(1)'))
  document.querySelector('p').remove()
  await wait(50)
  await nextFrame()
  expect(stickers()).toHaveLength(0)
})

it('destroy removes the host', () => {
  overlay.destroy()
  expect(document.querySelector('[data-stickerpack]')).toBe(null)
})
