// Serves the single-file script build, so sites can load it straight from here
// or folks can download it. `npm run build:lib` must run first (build and dev do).
import script from '../../../dist/stickerpack.js?raw'

export const GET = () => new Response(script, {
  headers: {
    'content-type': 'text/javascript; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=3600'
  }
})
