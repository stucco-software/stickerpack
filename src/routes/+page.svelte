<script>
  import { onMount } from 'svelte'
  import { mountStickerPack } from '$lib/stickerpack.js'

  onMount(() => {
    mountStickerPack()
  })
</script>

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
  &lt;script src="stickerpack.js">&lt;/script>
  &lt;sticker-pack />
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


<template id="eyesticker">
  <img
    style="position: absolute; width: 2rem; height: 2rem"
    class="eyes"
    src="/stickers/eyes.png">
</template>