import { describe, it, expect } from 'vitest'
import {
  pageSource,
  altFromUrl,
  toSticker,
  createAnnotation,
  isAnnotation,
  position
} from './annotation.js'

const selectors = [
  { type: 'CssSelector', value: 'body > p:nth-child(1)' },
  { type: 'TextQuoteSelector', exact: 'Hello world' }
]

const refinedBy = {
  type: 'FragmentSelector',
  conformsTo: 'http://www.w3.org/TR/media-frags/',
  value: 'xywh=percent:42.5,61.25,0,0'
}

const make = (overrides = {}) => createAnnotation({
  src: 'https://stickers.stucco.software/eyes.png',
  source: 'https://example.com/about',
  selectors,
  x: 42.5,
  y: 61.25,
  id: '5974d4a4-4b44-4c2d-a9f5-fbccc8da2760',
  now: new Date('2026-09-16T18:04:00Z'),
  ...overrides
})

describe('pageSource', () => {
  it('keeps only origin and pathname', () => {
    expect(pageSource(new URL('https://example.com/about/?utm=1#top'))).toBe('https://example.com/about/')
  })
})

describe('altFromUrl', () => {
  it('derives alt text from the file name', () => {
    expect(altFromUrl('https://example.com/stickers/big-duck_face.png')).toBe('big duck face')
  })
})

describe('toSticker', () => {
  it('resolves relative URLs against the page', () => {
    expect(toSticker('/stickers/duck.png', 'https://example.com/a/b')).toEqual({
      src: 'https://example.com/stickers/duck.png',
      alt: 'duck'
    })
  })
})

describe('createAnnotation', () => {
  it('builds a Web Annotation', () => {
    expect(make()).toEqual({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: 'urn:uuid:5974d4a4-4b44-4c2d-a9f5-fbccc8da2760',
      type: 'Annotation',
      motivation: 'tagging',
      created: '2026-09-16T18:04:00.000Z',
      body: { id: 'https://stickers.stucco.software/eyes.png', type: 'Image' },
      target: {
        source: 'https://example.com/about',
        selector: [
          { ...selectors[0], refinedBy },
          { ...selectors[1], refinedBy }
        ]
      }
    })
  })

  it('generates a uuid by default', () => {
    const annotation = createAnnotation({ src: 'https://x.test/a.png', source: 's', selectors, x: 1, y: 2 })
    expect(annotation.id).toMatch(/^urn:uuid:[0-9a-f-]{36}$/)
  })
})

describe('isAnnotation', () => {
  it('accepts a built annotation', () => {
    expect(isAnnotation(make())).toBe(true)
  })

  it('accepts one that survived JSON', () => {
    expect(isAnnotation(JSON.parse(JSON.stringify(make())))).toBe(true)
  })

  it('rejects malformed values', () => {
    const valid = make()
    expect(isAnnotation(null)).toBe(false)
    expect(isAnnotation({})).toBe(false)
    expect(isAnnotation({ ...valid, body: { id: '/relative.png', type: 'Image' } })).toBe(false)
    expect(isAnnotation({ ...valid, target: { ...valid.target, selector: [] } })).toBe(false)
    expect(isAnnotation({ ...valid, target: { ...valid.target, selector: [{ type: 'CssSelector', value: 'body' }] } })).toBe(false)
    expect(isAnnotation({ ...valid, target: { ...valid.target, selector: [{ type: 'XPathSelector', value: '/', refinedBy }] } })).toBe(false)
  })
})

describe('position', () => {
  it('returns bare selectors and the position', () => {
    expect(position(make())).toEqual({ selectors, x: 42.5, y: 61.25 })
  })
})
