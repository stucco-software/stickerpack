const STYLE = `
.trigger {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 2147483647;
  width: 3rem;
  height: 3rem;
  border: 0;
  border-radius: 50%;
  background: #111;
  color: #fff;
  font: 1.25rem/1 system-ui, sans-serif;
  cursor: pointer;
}
.tray {
  position: fixed;
  right: 1rem;
  bottom: 4.5rem;
  z-index: 2147483647;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  max-width: min(24rem, calc(100vw - 2rem));
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 0.75rem;
}
.tray.no-trigger {
  bottom: 1rem;
}
.tray button {
  width: 3rem;
  height: 3rem;
  padding: 0.25rem;
  border: 0;
  background: none;
  cursor: pointer;
}
.tray img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.capture {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  cursor: crosshair;
}
.ghost {
  position: fixed;
  z-index: 2147483647;
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  opacity: 0.6;
  pointer-events: none;
  transform: translate(-50%, -50%);
}
[hidden] {
  display: none !important;
}
`

export const createTray = ({
  root,
  host,
  stickers,
  trigger,
  onOpen,
  onClose,
  onPlace,
  resolveImage = (src) => src
}) => {
  let state = 'idle'
  let chosen = null
  let destroyed = false

  const style = document.createElement('style')
  style.textContent = STYLE

  // trigger: 'none' means the host drives the tray itself (the browser extension does).
  const ownerTrigger = trigger && trigger !== 'none' ? trigger : null
  const floating = trigger ? null : document.createElement('button')
  if (floating) {
    floating.className = 'trigger'
    floating.type = 'button'
    floating.textContent = '✦'
    floating.setAttribute('aria-label', 'Stickers')
    floating.setAttribute('aria-expanded', 'false')
  }
  const triggerElement = ownerTrigger ?? floating

  const tray = document.createElement('div')
  tray.className = trigger === 'none' ? 'tray no-trigger' : 'tray'
  tray.hidden = true

  const capture = document.createElement('div')
  capture.className = 'capture'
  capture.hidden = true

  const ghost = document.createElement('img')
  ghost.className = 'ghost'
  ghost.alt = ''
  ghost.hidden = true

  const openTray = () => {
    if (state === 'placing') stopPlacing()
    state = 'open'
    tray.hidden = false
    floating?.setAttribute('aria-expanded', 'true')
    onOpen?.()
  }

  const closeTray = () => {
    if (state === 'placing') stopPlacing()
    state = 'idle'
    tray.hidden = true
    floating?.setAttribute('aria-expanded', 'false')
    onClose?.()
  }

  const stopPlacing = () => {
    state = 'idle'
    chosen = null
    capture.hidden = true
    ghost.hidden = true
  }

  const choose = (sticker) => {
    closeTray()
    state = 'placing'
    chosen = sticker
    ghost.src = resolveImage(sticker.src)
    capture.hidden = false
  }

  for (const sticker of stickers) {
    const button = document.createElement('button')
    button.type = 'button'
    const img = document.createElement('img')
    img.src = resolveImage(sticker.src)
    img.alt = sticker.alt
    img.draggable = false
    button.append(img)
    button.addEventListener('click', () => choose(sticker))
    tray.append(button)
  }

  const toggleTray = () => {
    if (state === 'idle') openTray()
    else if (state === 'open') closeTray()
    else stopPlacing()
  }

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return
    ghost.hidden = false
    ghost.style.left = `${event.clientX}px`
    ghost.style.top = `${event.clientY}px`
  }

  const onCaptureClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const sticker = chosen
    const element = document.elementsFromPoint(event.clientX, event.clientY)
      .find((candidate) => candidate !== host && candidate.getRootNode() === document)
    stopPlacing()
    if (!sticker || !element) return
    if (ownerTrigger && ownerTrigger.contains(element)) return
    onPlace?.({ src: sticker.src, element, clientX: event.clientX, clientY: event.clientY })
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return
    if (state === 'open') closeTray()
    else if (state === 'placing') stopPlacing()
  }

  root.append(style, capture, ghost, ...(floating ? [floating] : []), tray)
  triggerElement?.addEventListener('click', toggleTray)
  capture.addEventListener('pointermove', onPointerMove)
  capture.addEventListener('click', onCaptureClick)
  document.addEventListener('keydown', onKeyDown)

  return {
    open: () => { if (!destroyed) openTray() },
    close: () => { if (!destroyed) closeTray() },
    toggle: () => { if (!destroyed) toggleTray() },
    destroy() {
      if (destroyed) return
      destroyed = true
      triggerElement?.removeEventListener('click', toggleTray)
      document.removeEventListener('keydown', onKeyDown)
      for (const element of [style, capture, ghost, tray, floating]) element?.remove()
    }
  }
}
