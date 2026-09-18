<script>
  import CodeBlock from '../CodeBlock.svelte'

  const build = `
npm install
npm run build:extension
`

  const output = `
dist-extension/chrome/     Chrome, Edge, Brave, Arc, any Chromium browser
dist-extension/firefox/    Firefox
`

  const dev = `
npm run build:extension   # build both browsers
npm run dev:extension     # rebuild the scripts on change
npm test                  # the whole suite, extension included
`

  const chrome = [
    ['Open', 'Go to chrome://extensions (Edge: edge://extensions).'],
    ['Allow', 'Turn on Developer mode, top right.'],
    ['Load', 'Click Load unpacked and choose dist-extension/chrome.'],
    ['Pin', 'The ✦ icon lands in your toolbar. Pin it if you like.']
  ]

  const firefox = [
    ['Open', 'Go to about:debugging#/runtime/this-firefox.'],
    ['Load', 'Click Load Temporary Add-on…'],
    ['Pick', 'Choose dist-extension/firefox/manifest.json, the file itself.'],
    ['Again', 'Firefox drops temporary add-ons when you quit, so you’ll do this next time too.']
  ]

  const using = [
    ['Turn on a site', 'Click the toolbar button on a site you want to sticker, and say yes. The browser asks about that one site.'],
    ['Stick something', 'Pick a sticker, it follows your cursor, click to stick it. Links won’t fire. Esc cancels.'],
    ['Come back', 'Your stickers are there as soon as the page loads. No buttons, nothing else touched.'],
    ['Peel', 'Open the tray again and click a sticker to take it off.']
  ]

  const privacy = [
    ['Nothing on install.', 'It asks for no access to any website. You grant one site at a time, when you say yes.'],
    ['Nothing running.', 'On sites you haven’t turned on, none of its code runs at all.'],
    ['Nothing sent.', 'Stickers live in the extension’s storage on your machine. No server, no account, and the sticker pictures ship inside the extension.'],
    ['Nothing shown.', 'Sites can’t see your stickers. They’re drawn in a layer the page’s own code and CSS never touch.']
  ]

  const limits = [
    'Stickers stick to content. If a site rewrites the part you stuck one to, the sticker waits, hidden, and comes back when that content does.',
    'Two tabs on the same page won’t see each other’s new stickers until you reload.',
    'No sharing yet. These are yours alone. Shared stickers, and saving to your own account, are next.',
    'Stickers inside iframes aren’t supported.',
    'Pages the browser won’t let extensions touch — chrome://, about:, the extension stores, PDFs, local files — say so in the popup.'
  ]
</script>

<svelte:head>
  <title>Stickerpack: stickers, for every website</title>
  <meta name="description" content="A browser extension that lets you put stickers on any website. Private, per-site, no account.">
</svelte:head>

<main>
  <header class="hero">
    <p class="eyebrow"><a href="/">stickerpack</a> <span>extension</span></p>
    <div class="title">
      <h1>Stickers for Everywhere Else</h1>
      <ul class="badges" aria-hidden="true">
        <li class="badge grape">Yours!</li>
        <li class="badge mint">Private!</li>
      </ul>
    </div>

    <p class="lead">
      The other half: put stickers on <em>anyone’s</em> website. They come back when you do, they’re saved on your machine, and the site never knows. Chrome, Edge and Firefox.
    </p>

    <aside class="try">
      <strong>It isn’t in the stores yet.</strong>
      So installing means building it from the repo. That takes about a minute, and you need nothing but this project.
    </aside>

    <nav aria-label="Contents">
      <ul>
        <li><a href="#build">Build it</a></li>
        <li><a href="#chromium">Chrome &amp; Edge</a></li>
        <li><a href="#firefox">Firefox</a></li>
        <li><a href="#using">Using it</a></li>
        <li><a href="#privacy">What it sees</a></li>
      </ul>
    </nav>
  </header>

  <section id="build">
    <h2>Build it</h2>
    <CodeBlock code={build} language="sh" label="in the stickerpack repo" />
    <p>That writes one folder per browser. Nothing else is needed: no dependencies, no server, no account.</p>
    <CodeBlock code={output} language="sh" label="what you get" />
  </section>

  <section id="chromium">
    <h2>Install: Chrome, Edge, Brave</h2>
    <ol class="steps">
      {#each chrome as [title, description], index}
        <li style:--turn={`${index % 2 ? 2 : -2}deg`}>
          <strong>{title}</strong>
          <span>{description}</span>
        </li>
      {/each}
    </ol>
    <p class="aside">
      It stays installed until you remove it. After rebuilding, hit <strong>Reload</strong> on its card to pick up the new build.
    </p>
  </section>

  <section id="firefox">
    <h2>Install: Firefox</h2>
    <ol class="steps">
      {#each firefox as [title, description], index}
        <li style:--turn={`${index % 2 ? -2 : 2}deg`}>
          <strong>{title}</strong>
          <span>{description}</span>
        </li>
      {/each}
    </ol>
    <p class="aside">
      Firefox only keeps unsigned add-ons until you quit. That’s Firefox’s rule, not ours. Your stickers survive it, because the add-on’s id never changes. You’ll want Firefox 128 or newer, which is where per-site permissions landed.
    </p>
  </section>

  <section id="using">
    <h2>Using it</h2>
    <dl class="reference">
      {#each using as [name, description]}
        <div>
          <dt>{name}</dt>
          <dd>{description}</dd>
        </div>
      {/each}
    </dl>
    <p>
      The tray also opens with a keyboard shortcut: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>, or <kbd>Control</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> on a Mac. Both browsers let you change it.
    </p>
    <p>
      Had enough of a site? Right-click the toolbar icon and open its options. Every site you’ve turned on is listed there, with a button to stop. The stickers vanish from open tabs at once, and your stickers are kept in case you turn it back on.
    </p>
  </section>

  <section id="privacy">
    <h2>What it sees</h2>
    <ul class="how">
      {#each privacy as [title, description]}
        <li>
          <strong>{title}</strong>
          {description}
        </li>
      {/each}
    </ul>

    <h3>Known limits</h3>
    <ul class="limits">
      {#each limits as limit}
        <li>{limit}</li>
      {/each}
    </ul>
  </section>

  <section id="developers">
    <h2>For developers</h2>
    <CodeBlock code={dev} language="sh" label="scripts" />
    <p>
      The extension is a thin shell around the same library a website can install, which is why a sticker means the same thing in both. The source is in <code>src/extension/</code>, and there are fuller notes in <code>docs/extension.md</code>.
    </p>
  </section>

  <footer>
    <p>
      <a href="/">← Stickers for websites</a> · Made with specially formulated HTML adhesives by <a href="https://stucco.software">Stucco Software</a>.
    </p>
  </footer>
</main>

<style>
  main {
    max-width: 46rem;
    margin: auto;
    padding: 3rem 1.25rem 6rem;
  }

  section {
    padding-block: 3rem 1rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(2.5rem, 7.6vw, 4rem);
    line-height: 0.95;
    letter-spacing: -0.01em;
  }

  h2 {
    font-size: clamp(1.75rem, 5vw, 2.5rem);
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

  kbd {
    padding: 0.1em 0.45em;
    border: 2px solid var(--ink);
    border-radius: 0.4em;
    background: #fff;
    font: 0.8em ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
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

  .eyebrow a {
    text-decoration: none;
  }

  .eyebrow span {
    opacity: 0.6;
  }

  .title {
    position: relative;
    margin: 2.5rem 0 3rem;
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
    font-size: clamp(1rem, 3vw, 1.4rem);
    box-shadow: 0 0 0 5px #fff, 4px 6px 0 5px var(--shadow);
    transform: rotate(var(--turn));
  }

  .badge:nth-child(1) { --turn: -12deg; top: -2.2rem; left: clamp(-2rem, -2vw, -0.5rem); }
  .badge:nth-child(2) { --turn: 8deg; bottom: -2rem; right: clamp(-1rem, -1vw, 0rem); }

  .grape { background: var(--grape); color: #fff; }
  .mint { background: var(--mint); color: var(--ink); }

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

  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 1.25rem;
    padding: 0;
    list-style: none;
    counter-reset: step;
  }

  .steps li {
    padding: 1.25rem;
    overflow-wrap: anywhere;
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
    font-size: 1.5rem;
  }

  .steps strong::before {
    content: counter(step) '. ';
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

  .reference dt {
    font-weight: 500;
  }

  .reference dd {
    margin: 0;
  }

  .how,
  .limits {
    display: grid;
    gap: 1rem;
    padding: 0;
    list-style: none;
    font-size: 1.15rem;
  }

  .how strong {
    font-weight: 500;
  }

  .limits li {
    padding-left: 1rem;
    border-left: 4px solid var(--sun);
  }

  .aside {
    font-size: 1.05rem;
  }

  footer {
    margin-top: 4rem;
    padding-top: 1.5rem;
    border-top: 2px solid var(--ink);
  }

  footer p {
    font-size: 1rem;
  }
</style>
