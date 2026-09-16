import { it, expect } from 'vitest'
import { highlight } from './highlight.js'

const token = (kind, text) => `<span class="token ${kind}">${text}</span>`

it('escapes plain text for unknown languages', () => {
  expect(highlight('<b>&</b>', 'text')).toBe('&lt;b&gt;&amp;&lt;/b&gt;')
})

it('highlights javascript keywords, strings, comments and calls', () => {
  const html = highlight("const a = StickerPack('<x>') // hi", 'js')
  expect(html).toContain(token('keyword', 'const'))
  expect(html).toContain(token('function', 'StickerPack'))
  expect(html).toContain(token('string', "'&lt;x&gt;'"))
  expect(html).toContain(token('comment', '// hi'))
})

it('does not highlight inside strings or comments', () => {
  const html = highlight("'import' // const", 'js')
  expect(html).not.toContain(token('keyword', 'import'))
  expect(html).not.toContain(token('keyword', 'const'))
})

it('highlights html tags, attributes and values', () => {
  const html = highlight('<sticker-pack stickers="/a.png" no-default-pack>hi</sticker-pack>', 'html')
  expect(html).toContain(token('tag', 'sticker-pack'))
  expect(html).toContain(token('attribute', 'stickers'))
  expect(html).toContain(token('string', '"/a.png"'))
  expect(html).toContain(token('attribute', 'no-default-pack'))
  expect(html).toContain('hi')
  expect(html).not.toContain(token('attribute', 'hi'))
})

it('highlights json properties, strings and literals', () => {
  const html = highlight('{ "type": "Image", "x": 42.5, "ok": true }', 'json')
  expect(html).toContain(token('property', '"type"'))
  expect(html).toContain(token('string', '"Image"'))
  expect(html).toContain(token('literal', '42.5'))
  expect(html).toContain(token('literal', 'true'))
})
