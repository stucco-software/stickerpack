import { describe, it, expect, beforeEach } from 'vitest'
import { describe as describeTarget, resolve, cssPath, normalizedText } from './anchor.js'

const setRect = (element, left, top, width, height) => {
  element.getBoundingClientRect = () => ({
    left, top, width, height, x: left, y: top, right: left + width, bottom: top + height
  })
}

let main, h1, p, em, img, circle

beforeEach(() => {
  // document.body survives between tests, so drop any stubbed rect
  delete document.body.getBoundingClientRect
  document.body.innerHTML = `
    <main>
      <h1>Stickers, for Websites</h1>
      <p>Only the <em>finest</em>   stickers, for your website. <script>var ignored = 1</script>Enjoy.</p>
      <img alt="">
      <svg><circle r="1"></circle></svg>
    </main>`
  main = document.querySelector('main')
  h1 = document.querySelector('h1')
  p = document.querySelector('p')
  em = document.querySelector('em')
  img = document.querySelector('img')
  circle = document.querySelector('circle')
})

describe('normalizedText', () => {
  it('collapses whitespace and skips script text', () => {
    expect(normalizedText(p)).toBe('Only the finest stickers, for your website. Enjoy.')
  })

  it('truncates to a limit', () => {
    expect(normalizedText(p, 12)).toBe('Only the fin')
  })
})

describe('cssPath', () => {
  it('uses localName and nth-child from body', () => {
    expect(cssPath(p)).toBe('body > main:nth-child(1) > p:nth-child(2)')
    expect(cssPath(circle)).toBe('body > main:nth-child(1) > svg:nth-child(4) > circle:nth-child(1)')
    expect(cssPath(document.body)).toBe('body')
  })
})

describe('describe', () => {
  it('records a css path, a quote and a percentage position', () => {
    setRect(p, 100, 200, 400, 100)
    expect(describeTarget(p, 200, 250)).toEqual({
      selectors: [
        { type: 'CssSelector', value: 'body > main:nth-child(1) > p:nth-child(2)' },
        { type: 'TextQuoteSelector', exact: 'Only the finest stickers, for yo' }
      ],
      x: 25,
      y: 50
    })
  })

  it('rounds positions to two decimals', () => {
    setRect(p, 0, 0, 3, 3)
    const { x, y } = describeTarget(p, 1, 2)
    expect([x, y]).toEqual([33.33, 66.67])
  })

  it('omits the quote for elements without text', () => {
    setRect(img, 0, 0, 10, 10)
    expect(describeTarget(img, 5, 5).selectors).toEqual([
      { type: 'CssSelector', value: 'body > main:nth-child(1) > img:nth-child(3)' }
    ])
  })

  it('anchors clicks on <html> to <body> and omits a page-wide quote', () => {
    setRect(document.body, 0, 0, 800, 600)
    const result = describeTarget(document.documentElement, 400, 300)
    expect(result.selectors).toEqual([{ type: 'CssSelector', value: 'body' }])
    expect([result.x, result.y]).toEqual([50, 50])
  })

  it('walks up from zero-size elements', () => {
    setRect(main, 0, 0, 800, 400)
    expect(describeTarget(em, 400, 100).selectors[0].value).toBe('body > main:nth-child(1)')
  })

  it('does not divide by zero when nothing has size', () => {
    const { x, y } = describeTarget(em, 10, 10)
    expect([x, y]).toEqual([50, 50])
  })
})

describe('resolve', () => {
  it('round-trips describe', () => {
    setRect(p, 0, 0, 100, 100)
    expect(resolve(describeTarget(p, 1, 1).selectors)).toBe(p)
  })

  it('finds the element by quote after siblings are inserted', () => {
    setRect(p, 0, 0, 100, 100)
    const { selectors } = describeTarget(p, 1, 1)
    main.prepend(document.createElement('div'))
    expect(resolve(selectors)).toBe(p)
  })

  it('rejects a css match whose text changed and falls back to the quote', () => {
    setRect(p, 0, 0, 100, 100)
    const { selectors } = describeTarget(p, 1, 1)
    const impostor = document.createElement('p')
    impostor.textContent = 'Something else entirely'
    h1.replaceWith(impostor)
    main.prepend(h1)
    expect(document.querySelector(selectors[0].value)).toBe(impostor)
    expect(resolve(selectors)).toBe(p)
  })

  it('returns null when nothing matches', () => {
    setRect(p, 0, 0, 100, 100)
    const { selectors } = describeTarget(p, 1, 1)
    p.remove()
    expect(resolve(selectors)).toBe(null)
  })

  it('resolves text-less elements by css alone', () => {
    setRect(img, 0, 0, 10, 10)
    expect(resolve(describeTarget(img, 1, 1).selectors)).toBe(img)
  })

  it('prefers the deepest element whose text starts with the quote', () => {
    document.body.innerHTML = '<a href="#"><span>Hi there</span></a>'
    expect(resolve([{ type: 'TextQuoteSelector', exact: 'Hi there' }])).toBe(document.querySelector('span'))
  })

  it('treats an invalid css selector as no match', () => {
    expect(resolve([{ type: 'CssSelector', value: '<<' }])).toBe(null)
  })

  it('restricts the quote fallback to the anchor tag encoded in the css selector', () => {
    document.body.innerHTML = '<section><h1>A heading that is longer than thirty-two chars</h1><p>body</p></section>'
    const section = document.querySelector('section')
    setRect(section, 0, 0, 100, 100)
    const { selectors } = describeTarget(section, 1, 1)
    document.body.prepend(document.createElement('nav'))
    expect(resolve(selectors)).toBe(section)
  })

  it('requires a short quote to match an element whole, not merely as a prefix', () => {
    document.body.innerHTML = '<p>Hi</p><p>History</p>'
    const greeting = document.querySelector('p')
    setRect(greeting, 0, 0, 10, 10)
    const { selectors } = describeTarget(greeting, 1, 1)
    greeting.remove()
    expect(resolve(selectors)).toBe(null)
  })
})
