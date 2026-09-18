<script>
  const kept = [
    ['The sticker', 'Which sticker you picked, as the image’s address.'],
    ['The spot', 'Which element you stuck it to, and how far across and down that element you clicked.'],
    ['The page', 'The address of the page, without the query string or the part after the #.'],
    ['The time', 'When you stuck it.']
  ]

  const never = [
    'Your name, email address, or any account. There are no accounts.',
    'Anything you type, click, or read on a page.',
    'Which sites you visit, beyond the pages you chose to sticker.',
    'Analytics, telemetry, crash reports, or advertising identifiers.'
  ]
</script>

<svelte:head>
  <title>Stickerpack: privacy</title>
  <meta name="description" content="What the stickerpack extension stores, where it stores it, and what it never collects.">
</svelte:head>

<main>
  <p class="eyebrow"><a href="/">stickerpack</a> <span>privacy</span></p>
  <h1>Privacy</h1>

  <p class="lead">
    The stickerpack extension keeps your stickers on your own machine and sends nothing anywhere. There is no server to send them to.
  </p>

  <section>
    <h2>What it keeps</h2>
    <p>When you stick a sticker on a page, four things are written to your browser’s extension storage:</p>
    <dl class="reference">
      {#each kept as [name, description]}
        <div>
          <dt>{name}</dt>
          <dd>{description}</dd>
        </div>
      {/each}
    </dl>
    <p>
      That includes the addresses of pages you stickered, which is the reason this page exists: page addresses count as browsing information, even when they never leave your computer. They stay in the extension’s own storage, in your browser profile.
    </p>
  </section>

  <section>
    <h2>What it never collects</h2>
    <ul class="how">
      {#each never as line}
        <li>{line}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>What leaves your machine</h2>
    <p class="answer">Nothing.</p>
    <p>
      The sticker pictures are bundled inside the extension, so drawing a sticker doesn’t fetch anything. The extension has no server, makes no network requests, and contains no analytics or third-party code.
    </p>
  </section>

  <section>
    <h2>What it can reach</h2>
    <p>
      The extension asks for no access to any website when you install it. You grant one site at a time, when you click the toolbar button and say yes. On every other site, none of its code runs.
    </p>
    <p>
      Turning a site back off, from the extension’s options page, stops it running there immediately. Your stickers for that site are kept, so turning it on again brings them back. To delete them, remove the extension: uninstalling clears its storage.
    </p>
  </section>

  <section>
    <h2>The website</h2>
    <p>
      This website, stickerpack.stucco.software, sets no cookies and runs no analytics. Stickers you place on this site are saved in your browser’s local storage, for this site only, and are visible to nobody but you.
    </p>
  </section>

  <section>
    <h2>Changes and questions</h2>
    <p>
      If this ever changes, it changes here first, and the extension’s listing will say so. Questions go to <a href="https://stucco.software">Stucco Software</a>.
    </p>
    <p class="updated">Last updated 18 September 2026.</p>
  </section>

  <footer>
    <p>
      <a href="/">← Stickers for websites</a> · <a href="/extension">The extension</a>
    </p>
  </footer>
</main>

<style>
  main {
    max-width: 42rem;
    margin: auto;
    padding: 3rem 1.25rem 6rem;
  }

  section {
    padding-block: 2rem 0.5rem;
  }

  h1 {
    margin: 2rem 0 0;
    font-size: clamp(2.75rem, 9vw, 4rem);
    line-height: 0.95;
  }

  h2 {
    font-size: clamp(1.5rem, 4vw, 2rem);
  }

  p {
    font-size: 1.15rem;
  }

  .eyebrow {
    display: inline-block;
    margin: 0;
    padding: 0.2rem 0.8rem;
    border: 2px solid var(--ink);
    border-radius: 99rem;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .eyebrow a {
    text-decoration: none;
  }

  .eyebrow span {
    opacity: 0.6;
  }

  .lead {
    font-size: 1.4rem;
  }

  .answer {
    font-family: 'Basteleur', serif;
    font-size: clamp(2rem, 6vw, 3rem);
    margin: 0;
  }

  .reference {
    margin: 0;
    border-top: 2px solid var(--ink);
  }

  .reference div {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) 2fr;
    gap: 0.25rem 1.5rem;
    padding: 0.9rem 0;
    border-bottom: 1px solid var(--line);
  }

  @media (max-width: 36rem) {
    .reference div {
      grid-template-columns: 1fr;
    }
  }

  .reference dt {
    font-weight: 500;
  }

  .reference dd {
    margin: 0;
  }

  .how {
    display: grid;
    gap: 0.75rem;
    padding: 0;
    list-style: none;
    font-size: 1.15rem;
  }

  .how li {
    padding-left: 1rem;
    border-left: 4px solid var(--sun);
  }

  .updated {
    font-size: 1rem;
    opacity: 0.7;
  }

  footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 2px solid var(--ink);
  }

  footer p {
    font-size: 1rem;
  }
</style>
