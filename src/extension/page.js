import { pageSource } from '../lib/annotation.js'

const BLOCKED_HOSTS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org'
])

export { pageSource }

export const stickerable = (url) => {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  // Only http(s) can be granted at all, which rules out chrome:, about:, file:,
  // view-source:, data: and both extension schemes in one check.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  return !BLOCKED_HOSTS.has(parsed.hostname)
}

// Signals only, no polling: pushState and friends are reported by the Navigation API
// where it exists, and by the background script's tab watcher where it doesn't.
export const watchUrl = (onChange) => {
  let current = pageSource()
  const offs = []

  const check = () => {
    const next = pageSource()
    if (next === current) return
    current = next
    onChange(next)
  }

  const on = (target, type) => {
    target.addEventListener(type, check)
    offs.push(() => target.removeEventListener(type, check))
  }

  on(window, 'popstate')
  on(window, 'hashchange')
  if (globalThis.navigation) on(globalThis.navigation, 'navigatesuccess')

  return {
    check,
    stop() {
      for (const off of offs) off()
      offs.length = 0
    }
  }
}
