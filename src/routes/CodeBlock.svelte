<script>
  import { highlight } from './highlight.js'

  let { code, language = 'js', label = language, tape = 'var(--sun)' } = $props()

  let copied = $state(false)
  const html = $derived(highlight(code.trim(), language))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim())
      copied = true
      setTimeout(() => { copied = false }, 1500)
    } catch {
      copied = false
    }
  }
</script>

<figure class="code" style:--tape={tape}>
  <figcaption>
    <span class="label">{label}</span>
    <button type="button" onclick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
  </figcaption>
  <pre><code>{@html html}</code></pre>
</figure>

<style>
  .code {
    position: relative;
    margin: 2rem 0;
    background: var(--ink);
    color: #f4efe6;
    border-radius: 0.9rem;
    box-shadow: 6px 6px 0 var(--shadow);
  }

  /* A strip of washi tape holding the snippet to the page. */
  .code::before {
    content: '';
    position: absolute;
    top: -0.8rem;
    left: 50%;
    width: 7rem;
    height: 1.6rem;
    background: var(--tape);
    opacity: 0.85;
    transform: translateX(-50%) rotate(-3deg);
    clip-path: polygon(3% 0, 97% 4%, 100% 100%, 0 96%);
  }

  figcaption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem 0;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #a9a2b8;
  }

  button {
    padding: 0.2rem 0.7rem;
    border: 1.5px solid #4a4458;
    border-radius: 99rem;
    background: transparent;
    color: #f4efe6;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: var(--sun);
    border-color: var(--sun);
    color: var(--ink);
  }

  pre {
    margin: 0;
    padding: 0.75rem 1.25rem 1.25rem;
    overflow-x: auto;
    font: 0.9rem/1.6 ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    tab-size: 2;
  }

  pre :global(.token.comment) { color: #8b849b; font-style: italic; }
  pre :global(.token.string) { color: var(--sun); }
  pre :global(.token.keyword) { color: #ff8a6b; }
  pre :global(.token.literal) { color: var(--mint); }
  pre :global(.token.function),
  pre :global(.token.property),
  pre :global(.token.attribute) { color: #8fb8ff; }
  pre :global(.token.tag) { color: #ff8a6b; }
  pre :global(.token.punctuation) { color: #a9a2b8; }
</style>
