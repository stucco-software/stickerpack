// A tiny syntax highlighter for the docs: just enough for js, html and json.

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const span = (kind, text) => `<span class="token ${kind}">${escape(text)}</span>`

// Replace every match of `pattern` with `render(match)`, escaping the text in between.
const replaceMatches = (code, pattern, render) => {
  let html = ''
  let last = 0
  for (const match of code.matchAll(pattern)) {
    html += escape(code.slice(last, match.index)) + render(match)
    last = match.index + match[0].length
  }
  return html + escape(code.slice(last))
}

// Rules are [kind, regex source] pairs, tried in order. Sources must not use capture groups.
const tokenizer = (rules) => {
  const pattern = new RegExp(rules.map(([, source]) => `(${source})`).join('|'), 'g')
  return (code) => replaceMatches(code, pattern, (match) => {
    const index = match.slice(1).findIndex((group) => group !== undefined)
    return span(rules[index][0], match[0])
  })
}

const STRING = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|` + '`(?:[^`\\\\]|\\\\.)*`'

const js = tokenizer([
  ['comment', String.raw`\/\/[^\n]*`],
  ['string', STRING],
  ['keyword', String.raw`\b(?:import|from|export|default|const|let|async|await|return|new|function|if|else)\b`],
  ['literal', String.raw`\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b`],
  ['function', String.raw`\b[A-Za-z_$][\w$]*(?=\()`]
])

const json = tokenizer([
  ['property', String.raw`"(?:[^"\\\n]|\\.)*"(?=\s*:)`],
  ['string', String.raw`"(?:[^"\\\n]|\\.)*"`],
  ['literal', String.raw`\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b`]
])

const sh = tokenizer([
  ['comment', String.raw`#[^\n]*`],
  ['string', STRING],
  ['attribute', String.raw`(?<=\s)--?[\w-]+`],
  ['function', String.raw`(?<=^|\n)\s*[\w./-]+`]
])

const TAG = /<!--[\s\S]*?-->|<\/?[A-Za-z][\w-]*(?:\s[^<>]*?)?\/?>/g
const TAG_PARTS = /^(<\/?)([\w-]+)([\s\S]*?)(\/?>)$/
const ATTRIBUTE = /([\w-]+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g

const tag = ([text]) => {
  if (text.startsWith('<!--')) return span('comment', text)
  const [, open, name, attributes, close] = TAG_PARTS.exec(text)
  const renderedAttributes = replaceMatches(attributes, ATTRIBUTE, ([, attribute, value]) =>
    span('attribute', attribute) + (value ? span('punctuation', '=') + span('string', value) : '')
  )
  return span('punctuation', open) + span('tag', name) + renderedAttributes + span('punctuation', close)
}

const html = (code) => replaceMatches(code, TAG, tag)

const grammars = { js, json, html, sh }

export const highlight = (code, language) => (grammars[language] ?? escape)(code)
