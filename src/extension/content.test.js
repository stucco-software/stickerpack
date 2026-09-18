import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startContent } from './content.js'

const fakeApi = () => {
  const listeners = []
  return {
    listeners,
    send: (message) => listeners.map((listener) => listener(message)),
    runtime: {
      onMessage: {
        addListener: (listener) => listeners.push(listener),
        removeListener: (listener) => listeners.splice(listeners.indexOf(listener), 1)
      }
    }
  }
}

const fakeHandle = () => {
  const handle = vi.fn()
  handle.toggle = vi.fn()
  handle.open = vi.fn()
  handle.close = vi.fn()
  return handle
}

let api
let handles
let mount
let stop

beforeEach(() => {
  globalThis.__stickerpackContentStarted = null
  history.replaceState(null, '', '/one')
  api = fakeApi()
  handles = []
  mount = vi.fn(() => {
    const handle = fakeHandle()
    handles.push(handle)
    return handle
  })
})

afterEach(() => {
  stop?.()
  stop = null
})

const start = () => {
  stop = startContent({ api, mount, storage: { list: async () => [] }, images: (src) => src })
  return stop
}

it('mounts the library with no trigger', () => {
  start()
  expect(mount).toHaveBeenCalledTimes(1)
  expect(mount.mock.calls[0][0]).toMatchObject({ trigger: 'none' })
})

it('mounts once even if the script runs twice in the same page', () => {
  start()
  start()
  expect(mount).toHaveBeenCalledTimes(1)
  expect(api.listeners).toHaveLength(1)
})

it('can mount again after a teardown', () => {
  start()
  api.send({ type: 'teardown', origin: location.origin })
  start()
  expect(mount).toHaveBeenCalledTimes(2)
})

it('toggles the tray on a toggle message', () => {
  start()
  api.send({ type: 'toggle' })
  expect(handles[0].toggle).toHaveBeenCalledTimes(1)
})

it('remounts when the path changes', () => {
  start()
  history.pushState(null, '', '/two')
  api.send({ type: 'url-changed' })
  expect(handles[0]).toHaveBeenCalledTimes(1)
  expect(mount).toHaveBeenCalledTimes(2)
})

it('does nothing when only the query changed', () => {
  start()
  history.pushState(null, '', '/one?x=1')
  api.send({ type: 'url-changed' })
  expect(mount).toHaveBeenCalledTimes(1)
})

it('tears down when its own origin is revoked', () => {
  start()
  api.send({ type: 'teardown', origin: location.origin })
  expect(handles[0]).toHaveBeenCalledTimes(1)
  expect(api.listeners).toHaveLength(0)
})

it('ignores a teardown for another origin', () => {
  start()
  api.send({ type: 'teardown', origin: 'https://elsewhere.example' })
  expect(handles[0]).not.toHaveBeenCalled()
  expect(api.listeners).toHaveLength(1)
})
