import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { stickerable, watchUrl } from './page.js'

let watcher

beforeEach(() => {
  history.replaceState(null, '', '/one')
})

afterEach(() => {
  watcher?.stop()
  watcher = null
})

it('accepts ordinary web pages', () => {
  expect(stickerable('https://example.com/about')).toBe(true)
  expect(stickerable('http://localhost:3000/')).toBe(true)
})

it('rejects pages an extension cannot touch', () => {
  for (const url of [
    'chrome://extensions',
    'about:addons',
    'edge://settings',
    'moz-extension://abc/popup.html',
    'chrome-extension://abc/popup.html',
    'file:///Users/nk/notes.html',
    'view-source:https://example.com/',
    'data:text/html,hi',
    'https://chromewebstore.google.com/detail/abc',
    'https://addons.mozilla.org/en-US/firefox/',
    'not a url'
  ]) expect(stickerable(url)).toBe(false)
})

it('reports a new page when the path changes', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  history.pushState(null, '', '/two')
  watcher.check()
  expect(onChange).toHaveBeenCalledWith(`${location.origin}/two`)
})

it('says nothing when only the query or hash changed', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  history.pushState(null, '', '/one?utm=1#top')
  watcher.check()
  expect(onChange).not.toHaveBeenCalled()
})

it('checks on popstate and hashchange', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  history.pushState(null, '', '/three')
  window.dispatchEvent(new Event('popstate'))
  expect(onChange).toHaveBeenCalledTimes(1)
  history.pushState(null, '', '/four')
  window.dispatchEvent(new Event('hashchange'))
  expect(onChange).toHaveBeenCalledTimes(2)
})

it('listens to the Navigation API when there is one', () => {
  const navigation = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  globalThis.navigation = navigation
  watcher = watchUrl(vi.fn())
  expect(navigation.addEventListener).toHaveBeenCalledWith('navigatesuccess', expect.any(Function))
  watcher.stop()
  expect(navigation.removeEventListener).toHaveBeenCalledWith('navigatesuccess', expect.any(Function))
  delete globalThis.navigation
})

it('stops listening', () => {
  const onChange = vi.fn()
  watcher = watchUrl(onChange)
  watcher.stop()
  history.pushState(null, '', '/five')
  window.dispatchEvent(new Event('popstate'))
  expect(onChange).not.toHaveBeenCalled()
})
