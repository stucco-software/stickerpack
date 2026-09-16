import StickerPack from './index.js'

// Importing this module during SSR must not throw.
const Base = typeof HTMLElement === 'undefined' ? class {} : HTMLElement

export class StickerPackElement extends Base {
  connectedCallback() {
    // If defined before the parser reaches our children, wait so the trigger exists.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.connectedCallback(), { once: true })
      return
    }
    if (!this.isConnected || this.destroyStickerPack) return
    const stickers = (this.getAttribute('stickers') ?? '').split(/\s+/).filter(Boolean)
    this.destroyStickerPack = StickerPack({
      stickers,
      defaultPack: !this.hasAttribute('no-default-pack'),
      trigger: this.querySelector('[slot="trigger"]') ?? undefined
    })
  }

  disconnectedCallback() {
    this.destroyStickerPack?.()
    this.destroyStickerPack = undefined
  }
}

export const defineStickerPackElement = () => {
  if (!customElements.get('sticker-pack')) customElements.define('sticker-pack', StickerPackElement)
}
