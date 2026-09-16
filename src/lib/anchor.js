const QUOTE_LENGTH = 32
const SKIP = new Set(['script', 'style', 'noscript', 'template'])

const collapse = (text) => text.replace(/\s+/g, ' ').trim()

export const normalizedText = (root, limit = Infinity) => {
  let text = ''
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        text += child.data
        if (limit !== Infinity && collapse(text).length > limit) return true
      } else if (child.nodeType === 1 && !SKIP.has(child.localName)) {
        if (walk(child)) return true
      }
    }
    return false
  }
  walk(root)
  return collapse(text).slice(0, limit)
}

export const cssPath = (element) => {
  const body = element.ownerDocument.body
  const steps = []
  for (let node = element; node !== body; node = node.parentElement) {
    const index = Array.prototype.indexOf.call(node.parentElement.children, node) + 1
    steps.unshift(`${node.localName}:nth-child(${index})`)
  }
  return ['body', ...steps].join(' > ')
}

const hasSize = (element) => {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

const anchorFor = (element) => {
  const body = element.ownerDocument.body
  let anchor = element !== body && body.contains(element) ? element : body
  while (anchor !== body && !hasSize(anchor)) anchor = anchor.parentElement
  return anchor
}

const percent = (offset, size) => size > 0 ? Math.round(offset / size * 10000) / 100 : 50

// The last path step's tag, e.g. 'section' from 'body > section:nth-child(1)', or 'body' from 'body'.
const CSS_TAIL_TAG = /([^\s>]+?)(?::nth-child\(\d+\))?$/
const tagFromCss = (value) => CSS_TAIL_TAG.exec(value)?.[1] ?? null

export const describe = (element, clientX, clientY) => {
  const anchor = anchorFor(element)
  const rect = anchor.getBoundingClientRect()
  const selectors = [{ type: 'CssSelector', value: cssPath(anchor) }]
  const body = anchor.ownerDocument.body
  if (anchor !== body) {
    const exact = normalizedText(anchor, QUOTE_LENGTH)
    if (exact) selectors.push({ type: 'TextQuoteSelector', exact })
  }
  return {
    selectors,
    x: percent(clientX - rect.left, rect.width),
    y: percent(clientY - rect.top, rect.height)
  }
}

const depth = (element) => {
  let count = 0
  for (let node = element; node.parentElement; node = node.parentElement) count++
  return count
}

export const resolve = (selectors, doc = document) => {
  const css = selectors.find((selector) => selector.type === 'CssSelector')
  const quote = selectors.find((selector) => selector.type === 'TextQuoteSelector')?.exact
  // A quote shorter than QUOTE_LENGTH is the element's whole text, not a truncated prefix,
  // so it must match a candidate's whole text rather than merely its first N characters.
  const matches = (element) => {
    if (!quote) return true
    return quote.length < QUOTE_LENGTH
      ? normalizedText(element, QUOTE_LENGTH) === quote
      : normalizedText(element, quote.length) === quote
  }

  if (css) {
    let element = null
    try {
      element = doc.querySelector(css.value)
    } catch {
      element = null
    }
    if (element && matches(element)) return element
  }

  if (!quote) return null

  const tag = css ? tagFromCss(css.value) : null

  const candidates = Array.from(doc.body.querySelectorAll('*'))
    .filter((element) => !SKIP.has(element.localName))
    .filter((element) => !tag || element.localName === tag)
    .map((element, order) => ({ element, order, depth: depth(element) }))
    .sort((a, b) => b.depth - a.depth || a.order - b.order)

  return candidates.find(({ element }) => matches(element))?.element ?? null
}
