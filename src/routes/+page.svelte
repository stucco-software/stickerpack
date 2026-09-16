<script>
  import { onMount } from 'svelte'
  import { dev } from '$app/environment'
  import StickerPack from '$lib/index.js'

  // The default pack is served from stickers.stucco.software. Until that
  // domain is live, use the local copy in dev so stickers render.
  const options = dev
    ? { defaultPack: false, stickers: ['/stickers/eyes.png'] }
    : {}

  onMount(() => StickerPack(options))
</script>

<main>

  <h1>
    Stickers, for Websites
  </h1>

  <p>
    Only the finest stickers, for your website. Just add HTML or use the JavaScript API to let folks stick stuff to your page.
  </p>

  <mark>Easy!</mark>

  <h2>
    Use Some HTML
  </h2>

  <p>Two lines of HTML to add the Sticker Pack Custom Element!</p>

  <pre><code>
    &lt;script type="module" src="stickerpack.js">&lt;/script>
    &lt;sticker-pack>&lt;/sticker-pack>
  </code></pre>

  <mark>Fun!</mark>

  <h2>
    Use Some JavaScripts
  </h2>

  <p>So you sling some code? Make stickers happen where, when, and how you want.</p>

  <pre><code>
    // import the library
    import StickerPack from "stickerpack"

    // mount to the DOM
    let destroyStickerPack = StickerPack()

    // remove from the DOM
    destroyStickerPack()
  </code></pre>

  <mark>Wow!</mark>

  <p>
    From <a href="https://stucco.software">Stucco Software</a>
  </p>
</main>

<style>
  main {
    max-width: 42rem;
    margin: auto;
  }
  h1,
  h2,
  p {
    padding-block: 1rem;
  }
</style>
