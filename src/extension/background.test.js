import { it, expect, vi, beforeEach } from 'vitest'
import { createBackground } from './background.js'

const GRANTED = 'https://granted.example'
const OTHER = 'https://other.example'

let api
let background

const event = () => {
  const listeners = []
  return { addListener: (listener) => listeners.push(listener), fire: (...args) => listeners.map((listener) => listener(...args)) }
}

beforeEach(() => {
  const grants = new Set([`${GRANTED}/*`])
  api = {
    grants,
    registered: [],
    permissions: {
      contains: vi.fn(async ({ origins }) => origins.every((origin) => grants.has(origin))),
      getAll: vi.fn(async () => ({ origins: [...grants] })),
      onAdded: event(),
      onRemoved: event()
    },
    scripting: {
      getRegisteredContentScripts: vi.fn(async ({ ids } = {}) =>
        api.registered.filter((script) => !ids || ids.includes(script.id))),
      registerContentScripts: vi.fn(async (scripts) => { api.registered.push(...scripts) }),
      updateContentScripts: vi.fn(async () => {}),
      unregisterContentScripts: vi.fn(async ({ ids }) => {
        api.registered = api.registered.filter((script) => !ids.includes(script.id))
      }),
      executeScript: vi.fn(async () => [])
    },
    tabs: {
      get: vi.fn(async () => ({ id: 1, url: `${GRANTED}/page` })),
      query: vi.fn(async () => [{ id: 1, url: `${GRANTED}/page` }, { id: 2 }]),
      sendMessage: vi.fn(async () => {}),
      onUpdated: event(),
      onActivated: event()
    },
    action: { setPopup: vi.fn(async () => {}), onClicked: event(), openPopup: vi.fn(async () => {}) },
    commands: { onCommand: event() },
    runtime: { onInstalled: event(), onStartup: event() }
  }
  background = createBackground(api)
})

it('toggles a granted tab', async () => {
  await background.toggle({ id: 1, url: `${GRANTED}/page` })
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'toggle' })
})

it('never injects into a site that was not granted', async () => {
  await background.toggle({ id: 2, url: `${OTHER}/page` })
  expect(api.scripting.executeScript).not.toHaveBeenCalled()
  expect(api.tabs.sendMessage).not.toHaveBeenCalled()
  expect(api.action.openPopup).toHaveBeenCalled()
})

it('injects and retries when nothing is listening yet', async () => {
  api.tabs.sendMessage.mockRejectedValueOnce(new Error('no receiver'))
  await background.toggle({ id: 1, url: `${GRANTED}/page` })
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['content.js'] })
  expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2)
})

it('registers, injects and opens the tray when a site is granted', async () => {
  api.tabs.query.mockResolvedValue([{ id: 3, url: `${OTHER}/page` }])
  await background.onAdded({ origins: [`${OTHER}/*`] })
  expect(api.registered.map((script) => script.id)).toEqual([`sp:${OTHER}`])
  expect(api.registered[0]).toMatchObject({ matches: [`${OTHER}/*`], js: ['content.js'], allFrames: false })
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: '' })
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 3 }, files: ['content.js'] })
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(3, { type: 'toggle' })
})

it('does not inject when the active tab is a different site', async () => {
  await background.onAdded({ origins: [`${OTHER}/*`] })
  expect(api.registered.map((script) => script.id)).toEqual([`sp:${OTHER}`])
  expect(api.scripting.executeScript).not.toHaveBeenCalled()
})

it('unregisters and tells every tab when a site is revoked', async () => {
  api.grants.delete(`${GRANTED}/*`)
  api.registered = [{ id: `sp:${GRANTED}` }]
  await background.onRemoved({ origins: [`${GRANTED}/*`] })
  expect(api.registered).toEqual([])
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'teardown', origin: GRANTED })
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'teardown', origin: GRANTED })
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'popup.html' })
})

it('swallows teardown messages that nothing receives', async () => {
  api.grants.delete(`${GRANTED}/*`)
  api.tabs.sendMessage.mockRejectedValue(new Error('no receiver'))
  await expect(background.onRemoved({ origins: [`${GRANTED}/*`] })).resolves.toBeUndefined()
  expect(api.scripting.executeScript).not.toHaveBeenCalled()
})

it('clears the popup only for tabs whose url it can read', async () => {
  await background.refreshPopup(1, `${GRANTED}/page`)
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: '' })
  await background.refreshPopup(2, undefined)
  expect(api.action.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: 'popup.html' })
})

it('reconciles registrations with the permissions it actually has', async () => {
  api.registered = [{ id: `sp:${OTHER}` }]
  await background.reconcile()
  expect(api.registered.map((script) => script.id)).toEqual([`sp:${GRANTED}`])
})
