// Code samples shown on the docs page.

export const htmlQuickStart = `
<script type="module" src="https://stickerpack.stucco.software/stickerpack.js"></script>
<sticker-pack></sticker-pack>
`

export const htmlOptions = `
<sticker-pack stickers="/stickers/duck.png /stickers/cat.png" no-default-pack>
  <button slot="trigger">Stickers!</button>
</sticker-pack>
`

export const jsQuickStart = `
import StickerPack from 'stickerpack'

// Mount: adds the ✦ button and loads this page's stickers
const destroy = StickerPack()

// Unmount: removes the button and stickers, but keeps them saved
destroy()
`

export const jsOptions = `
import StickerPack, { localStorageAdapter } from 'stickerpack'

const destroy = StickerPack({
  stickers: ['/stickers/duck.png'],     // added to the default pack
  defaultPack: true,                    // false = only your stickers
  storage: localStorageAdapter(),       // where stickers are saved
  trigger: document.querySelector('#stickers'), // your own button, or 'none'
  resolveImage: (src) => src            // where sticker images load from
})
`

export const svelte = `
// In a Svelte component, onMount cleans up for you
onMount(() => StickerPack())
`

export const storageInterface = `
const storage = {
  // Every sticker saved for a page URL
  list: async (source) => [],
  // Save a new sticker
  add: async (annotation) => {},
  // Peel a sticker off
  remove: async (annotation) => {}
}

StickerPack({ storage })
`

export const exampleSticker = `
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "urn:uuid:5974d4a4-4b44-4c2d-a9f5-fbccc8da2760",
  "type": "Annotation",
  "motivation": "tagging",
  "created": "2026-09-16T18:04:00.000Z",
  "body": { "id": "https://stickerpack.stucco.software/stickers/eyes.svg", "type": "Image" },
  "target": {
    "source": "https://example.com/about",
    "selector": [
      {
        "type": "CssSelector",
        "value": "body > main:nth-child(1) > p:nth-child(3)",
        "refinedBy": {
          "type": "FragmentSelector",
          "conformsTo": "http://www.w3.org/TR/media-frags/",
          "value": "xywh=percent:42.5,61.25,0,0"
        }
      }
    ]
  }
}
`
