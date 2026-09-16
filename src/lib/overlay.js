import { resolve } from './anchor.js'
import { position } from './annotation.js'

const ORPHAN_DEBOUNCE = 250

const STYLE = `
.layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: visible;
  z-index: 2147483646;
  pointer-events: none;
}
.sticker {
  position: absolute;
  box-sizing: border-box;
  width: 4rem;
  height: 4rem;
  max-width: none;
  margin: 0;
  padding: 0;
  border: 0;
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
  user-select: none;
}
.sticker[hidden] {
  display: none;
}
.peelable .sticker {
  pointer-events: auto;
  cursor: not-allowed;
}
`

export const createOverlay = () => {
  const host = document.createElement('div')
  host.setAttribute('data-stickerpack', '')
  host.style.cssText = 'all: initial; display: block;'
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLE
  const layer = document.createElement('div')
  layer.className = 'layer'
  root.append(style, layer)
  document.body.append(host)

  const entries = new Map()
  let clickHandler = null
  let frame = 0
  let timer = 0
  let destroyed = false

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null

  const attach = (entry) => {
    entry.element = resolve(entry.selectors)
    if (!entry.element) return
    layer.append(entry.img)
    resizeObserver?.observe(entry.element)
  }

  const detach = (entry) => {
    const element = entry.element
    entry.element = null
    entry.img.remove()
    if (!resizeObserver || !element) return
    for (const other of entries.values()) if (other.element === element) return
    resizeObserver.unobserve(element)
  }

  const reposition = () => {
    frame = 0
    if (destroyed) return
    const origin = layer.getBoundingClientRect()
    const placements = []
    for (const entry of entries.values()) {
      if (entry.element && !entry.element.isConnected) detach(entry)
      if (!entry.element) continue
      placements.push([entry, entry.element.getBoundingClientRect()])
    }
    for (const [entry, rect] of placements) {
      entry.img.style.left = `${rect.left - origin.left + rect.width * entry.x / 100}px`
      entry.img.style.top = `${rect.top - origin.top + rect.height * entry.y / 100}px`
    }
  }

  const schedule = () => {
    if (!frame && !destroyed) frame = requestAnimationFrame(reposition)
  }

  const resolveOrphans = () => {
    timer = 0
    if (destroyed) return
    for (const entry of entries.values()) if (!entry.element) attach(entry)
    schedule()
  }

  const mutationObserver = new MutationObserver((records) => {
    if (!destroyed && !host.isConnected) document.body.append(host)
    schedule()
    const hasOrphan = Array.from(entries.values()).some((entry) => !entry.element)
    const hasContentChange = records.some((record) => record.type === 'characterData' || record.addedNodes.length > 0)
    if (hasOrphan && hasContentChange) {
      clearTimeout(timer)
      timer = setTimeout(resolveOrphans, ORPHAN_DEBOUNCE)
    }
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
  resizeObserver?.observe(document.documentElement)
  resizeObserver?.observe(document.body)
  window.addEventListener('resize', schedule)
  document.addEventListener('load', schedule, true)
  document.fonts?.ready.then(schedule)

  return {
    root,
    host,

    render(annotation) {
      if (destroyed || entries.has(annotation.id)) return
      const img = document.createElement('img')
      img.className = 'sticker'
      img.alt = ''
      img.draggable = false
      img.addEventListener('error', () => { img.hidden = true })
      img.addEventListener('click', (event) => {
        if (!layer.classList.contains('peelable')) return
        event.preventDefault()
        event.stopPropagation()
        clickHandler?.(annotation)
      })
      img.src = annotation.body.id
      const entry = { annotation, img, element: null, ...position(annotation) }
      entries.set(annotation.id, entry)
      attach(entry)
      schedule()
    },

    unrender(id) {
      const entry = entries.get(id)
      if (!entry) return
      entries.delete(id)
      detach(entry)
    },

    setPeelable(peelable) {
      layer.classList.toggle('peelable', Boolean(peelable))
    },

    onStickerClick(handler) {
      clickHandler = handler
    },

    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', schedule)
      document.removeEventListener('load', schedule, true)
      entries.clear()
      host.remove()
    }
  }
}
