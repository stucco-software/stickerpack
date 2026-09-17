<script>
  import { onMount } from 'svelte'
  import { dev } from '$app/environment'
  import StickerPack, { localStorageAdapter } from '$lib/index.js'
  import { defaultPack } from '$lib/pack.js'
  import CodeBlock from './CodeBlock.svelte'
  import { watchedStorage } from './watched-storage.js'
  import watchedStorageSource from './watched-storage.js?raw'
  import * as snippets from './snippets.js'

  let stickers = $state([])
  let mounted = $state(false)

  const latest = $derived(stickers.at(-1))
  const count = $derived(`${stickers.length} ${stickers.length === 1 ? 'sticker' : 'stickers'}`)

  onMount(() => {
    mounted = true
    return StickerPack({
      // The default pack lives in static/stickers/ on this site. In dev, serve
      // it from the dev server instead of stickerpack.stucco.software.
      ...(dev ? { defaultPack: false, stickers: defaultPack.map(({ src }) => new URL(src).pathname) } : {}),
      storage: watchedStorage(localStorageAdapter(), (list) => { stickers = list })
    })
  })

  const htmlAttributes = [
    ['stickers', 'Space-separated image URLs to add to the pack. Relative URLs are resolved against the page.'],
    ['no-default-pack', 'Only offer your own stickers.'],
    ['slot="trigger"', 'Put this on a child element to use it instead of the ✦ button.']
  ]

  const jsOptions = [
    ['stickers', 'string[]', '[]', 'Image URLs to add to the pack.'],
    ['defaultPack', 'boolean', 'true', 'Include the Stucco default pack.'],
    ['storage', 'adapter', 'localStorageAdapter()', 'Where stickers are saved. See below.'],
    ['trigger', 'Element', 'the ✦ button', 'Your own button to open the tray.']
  ]

  const steps = [
    ['Open', 'Hit the ✦ button to open the sticker tray.'],
    ['Pick', 'Choose a sticker. It follows your cursor.'],
    ['Stick', 'Click anywhere on the page. Links won’t fire. Esc cancels.'],
    ['Peel', 'With the tray open, click a sticker to peel it off.']
  ]
</script>

<svelte:head>
  <title>Stickerpack: stickers, for websites</title>
  <meta name="description" content="Let visitors put stickers on your website. Two lines of HTML or one function call.">
</svelte:head>

<main>
  <header class="hero">
    <p class="eyebrow">stickerpack <span>v0.0.1</span></p>
    <div class="title">
      <h1>Stickers for Websites</h1>
      <ul class="badges" aria-hidden="true">
        <li class="badge tomato">Easy!</li>
        <li class="badge sun">Fun!</li>
        <li class="badge sky">Wow!</li>
      </ul>
    </div>

    <p class="lead">
      Only the finest stickers, for your website. Add two lines of HTML or call one function, and folks can stick stuff all over your pages. The stickers stay put when they come back.
    </p>

    <p class="download">
      <a href="/stickerpack.js" download>Download stickerpack.js</a>
    </p>

    <aside class="try">
      <strong>Go on, try it.</strong>
      Hit <span class="key">✦</span> in the corner, pick a sticker and stick it anywhere on this page. Then reload.
      {#if mounted}
        <span class="count">{count} stuck here so far.</span>
      {/if}
    </aside>

    <nav aria-label="Contents">
      <ul>
        <li><a href="#html">HTML</a></li>
        <li><a href="#javascript">JavaScript</a></li>
        <li><a href="#sticking">Sticking</a></li>
        <!-- <li><a href="#storage">Storage</a></li>
        <li><a href="#stickers">Sticker data</a></li>
        <li><a href="#anchoring">How it sticks</a></li> -->
      </ul>
    </nav>
  </header>

  <section id="html">
    <h2>Use some HTML</h2>
    <p>Two lines. Load the script and drop in the custom element.</p>
    <CodeBlock code={snippets.htmlQuickStart} language="html" label="index.html" />
    <p class="aside">
      Rather host it yourself? <a href="/stickerpack.js" download>Download stickerpack.js</a> and point the <code>src</code> at your copy.
    </p>

    <h3>Attributes</h3>
    <dl class="reference">
      {#each htmlAttributes as [name, description]}
        <div>
          <dt><code>{name}</code></dt>
          <dd>{description}</dd>
        </div>
      {/each}
    </dl>
    <CodeBlock code={snippets.htmlOptions} language="html" label="with options" />
  </section>

  <section id="javascript">
    <h2>Use some JavaScripts</h2>
    <p>So you sling some code? Make stickers happen where, when, and how you want.</p>
    <CodeBlock code={snippets.jsQuickStart} label="main.js" />

    <h3>Options</h3>
    <dl class="reference">
      {#each jsOptions as [name, type, fallback, description]}
        <div>
          <dt><code>{name}</code> <span class="type">{type}</span></dt>
          <dd>{description} <span class="default">Default: <code>{fallback}</code></span></dd>
        </div>
      {/each}
    </dl>
    <CodeBlock code={snippets.jsOptions} label="all the options" />

    <p class="note">
      One sticker pack per page. Don't get greedy!
    </p>
    <CodeBlock code={snippets.svelte} label="svelte" />
  </section>

  <section id="sticking">
    <h2>Stick stuff</h2>
    <p>What your visitors do:</p>
    <ol class="steps">
      {#each steps as [title, description], index}
        <li style:--turn={`${index % 2 ? 2 : -2}deg`}>
          <strong>{title}</strong>
          <span>{description}</span>
        </li>
      {/each}
    </ol>
  </section>

  <!-- <section id="storage">
    <h2>Keep them somewhere</h2>
    <p>
      By default stickers live in the visitor’s browser, in <code>localStorage</code> under <code>stickerpack:&lt;page URL&gt;</code>. Want them somewhere else? Pass any object with these three methods.
    </p>
    <CodeBlock code={snippets.storageInterface} label="storage adapter" />
    <p>
      This very page wraps the default adapter so it can show you your stickers below. Here’s the whole thing:
    </p>
    <CodeBlock code={watchedStorageSource} label="watched-storage.js (running on this page)" />
  </section>

  <section id="stickers">
    <h2>What a sticker is</h2>
    <p>
      Every sticker is a <a href="https://www.w3.org/TR/annotation-model/">W3C Web Annotation</a>. The <code>body</code> is the sticker image URL. The <code>target</code> says which page it’s on and where.
    </p>
    {#if latest}
      <p class="live"><span class="dot"></span> Live: the last of the {count} you’ve stuck on this page.</p>
      <CodeBlock code={JSON.stringify(latest, null, 2)} language="json" label="your sticker" />
    {:else}
      <p class="live idle">Stick something and it shows up here. Until then, here’s an example:</p>
      <CodeBlock code={snippets.exampleSticker} language="json" label="example sticker" />
    {/if}
  </section>

  <section id="anchoring">
    <h2>How it sticks</h2>
    <ul class="how">
      <li>
        <strong>Where you clicked.</strong>
        A CSS path to the element under your cursor, and how far across and down it you clicked, in percent. Resize the window and stickers stay on their element.
      </li>
      <li>
        <strong>What it says.</strong>
        The first few words of that element’s text. If the page changes and the path breaks, the sticker finds its text again.
      </li>
      <li>
        <strong>Patience.</strong>
        If neither matches, the sticker waits in storage and comes back when its content does.
      </li>
      <li>
        <strong>Hands off.</strong>
        Stickers draw in their own Shadow DOM layer. Your markup and CSS are never touched.
      </li>
    </ul>
  </section> -->

  <footer>
    <p>
      Made with specially formulated HTML adhesives by <a href="https://stucco.software">Stucco Software</a>.
    </p>
  </footer>
</main>

{#if mounted && stickers.length === 0}
  <p class="nudge" aria-hidden="true">stick something <span>→</span></p>
{/if}

<style>
  main {
    max-width: 46rem;
    margin: auto;
    padding: 3rem 1.25rem 6rem;
  }

  section {
    padding-block: 3rem 1rem;
  }

  .title {
    position: relative;
    margin: 2.5rem 0 3rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(3.5rem, 12vw, 6rem);
    font-weight: 600;
    line-height: 0.95;
    letter-spacing: -0.01em;
  }

  h1 em {
    font-style: normal;
    color: var(--tomato);
  }

  h2 {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    font-size: clamp(2rem, 6vw, 2.75rem);
  }

  h3 {
    margin-top: 2.5rem;
    font-family: 'Degular', sans-serif;
    font-weight: 500;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  p {
    font-size: 1.2rem;
  }

  code {
    padding: 0.05em 0.35em;
    border-radius: 0.3em;
    background: var(--paper-dark);
    font: 0.85em ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }

  .eyebrow {
    display: inline-block;
    margin: 0 0 1rem;
    padding: 0.2rem 0.8rem;
    border: 2px solid var(--ink);
    border-radius: 99rem;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .eyebrow span {
    opacity: 0.6;
  }

  .lead {
    max-width: 36rem;
    font-size: 1.4rem;
  }

  .badges {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .badge {
    position: absolute;
    z-index: 1;
    padding: 0.9rem 1.2rem;
    border-radius: 50%;
    font-family: 'Basteleur', serif;
    font-weight: 600;
    font-size: clamp(1.1rem, 3.2vw, 1.6rem);
    box-shadow: 0 0 0 5px #fff, 4px 6px 0 5px var(--shadow);
    transform: rotate(var(--turn));
  }

  .badge:nth-child(1) { --turn: -14deg; top: -2.6rem; left: clamp(-2.5rem, -3vw, -0.5rem); }
  .badge:nth-child(2) { --turn: 9deg; top: 38%; right: clamp(-1.5rem, -2vw, 0rem); }
  .badge:nth-child(3) { --turn: -6deg; bottom: -2.25rem; left: 42%; }

  .tomato { background: var(--tomato); color: #fff; }
  .sun { background: var(--sun); color: var(--ink); }
  .sky { background: var(--sky); color: #fff; }

  @media (prefers-reduced-motion: no-preference) {
    .badge {
      transition: transform 0.2s cubic-bezier(0.3, 1.8, 0.6, 1);
    }
    .badge:hover {
      transform: rotate(0deg) scale(1.1);
    }
  }

  .download {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin: 2rem 0 0;
  }

  .download a {
    padding: 0.7rem 1.4rem;
    border-radius: 99rem;
    background: var(--ink);
    color: var(--paper);
    font-weight: 500;
    text-decoration: none;
    box-shadow: 4px 4px 0 var(--tomato);
  }

  .download a:hover,
  .download a:focus-visible {
    background: var(--tomato);
    box-shadow: 4px 4px 0 var(--ink);
  }

  .download span {
    font-size: 1rem;
    opacity: 0.75;
  }

  .aside {
    font-size: 1.05rem;
  }

  .try {
    margin: 2.5rem 0 2rem;
    padding: 1.25rem 1.5rem;
    border: 2px dashed var(--ink);
    border-radius: 1rem;
    background: #fff8;
    font-size: 1.15rem;
  }

  .try strong {
    display: block;
    font-family: 'Basteleur', serif;
    font-size: 1.5rem;
  }

  .key {
    display: inline-grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    background: #111;
    color: #fff;
    font-size: 0.9rem;
    vertical-align: middle;
  }

  .count {
    display: block;
    margin-top: 0.5rem;
    font-style: italic;
  }

  nav ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    padding: 0;
    list-style: none;
  }

  nav a {
    display: block;
    padding: 0.35rem 0.9rem;
    border: 2px solid var(--ink);
    border-radius: 99rem;
    background: var(--paper);
    font-weight: 500;
    text-decoration: none;
  }

  nav a:hover,
  nav a:focus-visible {
    background: var(--ink);
    color: var(--paper);
  }

  .number {
    font-family: 'Degular', sans-serif;
    font-weight: 500;
    font-size: 1rem;
    color: var(--tomato);
  }

  .reference {
    margin: 0;
    border-top: 2px solid var(--ink);
  }

  .reference div {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) 2fr;
    gap: 0.25rem 1.5rem;
    padding: 0.9rem 0;
    border-bottom: 1px solid var(--line);
  }

  @media (max-width: 36rem) {
    .reference div {
      grid-template-columns: 1fr;
    }
  }

  .reference dd {
    margin: 0;
  }

  .type,
  .default {
    display: block;
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .note {
    padding-left: 1rem;
    border-left: 4px solid var(--sun);
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 1.25rem;
    padding: 0;
    list-style: none;
    counter-reset: step;
  }

  .steps li {
    padding: 1.25rem;
    border: 2px solid var(--ink);
    border-radius: 1rem;
    background: #fff;
    box-shadow: 4px 4px 0 var(--shadow);
    transform: rotate(var(--turn));
    counter-increment: step;
  }

  .steps strong {
    display: block;
    font-family: 'Basteleur', serif;
    font-size: 1.6rem;
  }

  .steps strong::before {
    content: counter(step) '. ';
    color: var(--tomato);
  }

  .how {
    display: grid;
    gap: 1.25rem;
    padding: 0;
    list-style: none;
    font-size: 1.15rem;
  }

  .how strong {
    display: block;
    font-weight: 500;
  }

  .live {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 500;
  }

  .live.idle {
    font-weight: 300;
  }

  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    background: var(--mint);
    box-shadow: 0 0 0 4px #5fd39a44;
  }

  footer {
    margin-top: 4rem;
    padding-top: 1.5rem;
    border-top: 2px solid var(--ink);
  }

  footer p {
    font-size: 1rem;
  }

  .nudge {
    position: fixed;
    right: 4.75rem;
    bottom: 1.6rem;
    margin: 0;
    padding: 0.3rem 0.8rem;
    border-radius: 99rem;
    background: var(--sun);
    font-family: 'Basteleur', serif;
    font-size: 1rem;
    box-shadow: 3px 3px 0 var(--shadow);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .nudge span {
      display: inline-block;
      animation: poke 1s ease-in-out infinite;
    }
  }

  @keyframes poke {
    50% { transform: translateX(0.3rem); }
  }
</style>
