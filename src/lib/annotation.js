const CONTEXT = 'http://www.w3.org/ns/anno.jsonld'
const MEDIA_FRAGMENTS = 'http://www.w3.org/TR/media-frags/'
const XYWH = /^xywh=percent:([^,]+),([^,]+),/

export const pageSource = (loc = location) => loc.origin + loc.pathname

export const altFromUrl = (src) => {
  const file = decodeURIComponent(new URL(src).pathname.split('/').pop() ?? '')
  return file.replace(/\.[^.]*$/, '').replace(/[-_]/g, ' ')
}

export const toSticker = (src, base = location.href) => {
  const absolute = new URL(src, base).href
  return { src: absolute, alt: altFromUrl(absolute) }
}

const refinement = (x, y) => ({
  type: 'FragmentSelector',
  conformsTo: MEDIA_FRAGMENTS,
  value: `xywh=percent:${x},${y},0,0`
})

export const createAnnotation = ({
  src,
  source,
  selectors,
  x,
  y,
  id = crypto.randomUUID(),
  now = new Date()
}) => ({
  '@context': CONTEXT,
  id: `urn:uuid:${id}`,
  type: 'Annotation',
  motivation: 'tagging',
  created: now.toISOString(),
  body: { id: src, type: 'Image' },
  target: {
    source,
    selector: selectors.map((selector) => ({ ...selector, refinedBy: refinement(x, y) }))
  }
})

const parseRefinement = (selector) => {
  const refinedBy = selector?.refinedBy
  if (refinedBy?.type !== 'FragmentSelector' || typeof refinedBy.value !== 'string') return null
  const match = XYWH.exec(refinedBy.value)
  if (!match) return null
  const x = Number(match[1])
  const y = Number(match[2])
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

const isAbsoluteUrl = (value) => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const isSelector = (selector) =>
  ((selector?.type === 'CssSelector' && typeof selector.value === 'string') ||
    (selector?.type === 'TextQuoteSelector' && typeof selector.exact === 'string')) &&
  parseRefinement(selector) !== null

export const isAnnotation = (value) =>
  !!value &&
  typeof value.id === 'string' &&
  typeof value.body?.id === 'string' &&
  isAbsoluteUrl(value.body.id) &&
  typeof value.target?.source === 'string' &&
  Array.isArray(value.target.selector) &&
  value.target.selector.length > 0 &&
  value.target.selector.every(isSelector)

export const position = (annotation) => {
  const { x, y } = parseRefinement(annotation.target.selector[0])
  const selectors = annotation.target.selector.map(({ refinedBy, ...selector }) => selector)
  return { selectors, x, y }
}
