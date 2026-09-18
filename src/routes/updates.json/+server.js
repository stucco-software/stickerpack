// Firefox self-distribution: the signed XPI lives on this site, and Firefox checks
// this file for newer builds. See docs/publishing.md.
import { manifest } from '../../extension/manifest.js'

const { version, browser_specific_settings } = manifest('firefox')
const id = browser_specific_settings.gecko.id

export const GET = () => Response.json({
  addons: {
    [id]: {
      updates: [
        {
          version,
          update_link: `https://stickerpack.stucco.software/stickerpack-${version}.xpi`
        }
      ]
    }
  }
}, {
  headers: {
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=3600'
  }
})
