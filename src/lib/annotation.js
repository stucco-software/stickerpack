const CONTEXT = 'http://www.w3.org/ns/anno.jsonld'
const MEDIA_FRAGMENTS = 'http://www.w3.org/TR/media-frags/'
const XYWH = /^xywh=percent:([^,]+),([^,]+),/

export const pageSource = (loc = location) => loc.origin + loc.pathname

export const altFromUrl = (src) => {
  const url = new URL(src)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  const segment = url.pathname.split('/').pop()
  let file
  try {
    file = decodeURIComponent(segment)
  } catch {
    file = segment
  }
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

// crypto.randomUUID is unavailable on insecure (plain http) origins, so fall back to
// building a v4 UUID by hand from crypto.getRandomValues.
const uuid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const createAnnotation = ({
  src,
  source,
  selectors,
  x,
  y,
  id = uuid(),
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

// Selector types this version understands and can read a position from. Unknown selector
// types (from a future version) are ignored rather than rejected, so stored data stays
// forward-compatible.
const isKnownSelector = (selector) =>
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
  value.target.selector.some(isKnownSelector)

export const position = (annotation) => {
  const known = annotation.target.selector.filter(isKnownSelector)
  const { x, y } = parseRefinement(known[0])
  const selectors = known.map(({ refinedBy, ...selector }) => selector)
  return { selectors, x, y }
}
