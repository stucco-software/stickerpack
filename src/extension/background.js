const POPUP = 'popup.html'
const CONTENT = 'content.js'

const pattern = (origin) => `${origin}/*`
const scriptId = (origin) => `sp:${origin}`
const originOfPattern = (value) => value.replace(/\/\*$/, '')

const originOf = (url) => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export const createBackground = (api) => {
  const granted = (origin) => api.permissions.contains({ origins: [pattern(origin)] })

  const setPopup = (tabId, popup) => api.action.setPopup({ tabId, popup }).catch(() => {})

  const tell = (tabId, message) => api.tabs.sendMessage(tabId, message).catch(() => {})

  const inject = (tabId) =>
    api.scripting.executeScript({ target: { tabId }, files: [CONTENT] }).catch(() => {})

  const register = async (origin) => {
    const script = {
      id: scriptId(origin),
      matches: [pattern(origin)],
      js: [CONTENT],
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true
    }
    try {
      const existing = await api.scripting
        .getRegisteredContentScripts({ ids: [script.id] })
        .catch(() => [])
      if (existing.length) await api.scripting.updateContentScripts([script])
      else await api.scripting.registerContentScripts([script])
    } catch (error) {
      console.warn('stickerpack: could not register', origin, error)
    }
  }

  const unregister = (origin) =>
    api.scripting.unregisterContentScripts({ ids: [scriptId(origin)] }).catch(() => {})

  // `activeTab` makes a tab's url readable on a toolbar click even for sites that were
  // never opted into, so readability is never treated as proof of a grant.
  const toggle = async (tab) => {
    if (!tab?.url) [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true })
    const origin = originOf(tab?.url)
    if (!origin || !(await granted(origin))) {
      await api.action.openPopup?.().catch?.(() => {})
      return
    }
    try {
      await api.tabs.sendMessage(tab.id, { type: 'toggle' })
    } catch {
      await inject(tab.id)
      await tell(tab.id, { type: 'toggle' })
    }
  }

  const refreshPopup = async (tabId, url) => {
    const origin = originOf(url)
    // Only a granted origin makes a tab's url readable outside a click.
    if (origin && (await granted(origin))) await setPopup(tabId, '')
    else await setPopup(tabId, POPUP)
  }

  const onAdded = async ({ origins = [] }) => {
    for (const value of origins) {
      const origin = originOfPattern(value)
      try {
        await register(origin)
        // onAdded carries no tab, and a grant can also come from the browser's own UI.
        const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true })
        if (!tab || originOf(tab.url) !== origin) continue
        await setPopup(tab.id, '')
        await inject(tab.id)
        await tell(tab.id, { type: 'toggle' })
      } catch (error) {
        console.warn('stickerpack: could not finish granting', origin, error)
      }
    }
  }

  const onRemoved = async ({ origins = [] }) => {
    for (const value of origins) {
      const origin = originOfPattern(value)
      await unregister(origin)
      // The grant is gone, so tab urls are unreadable: tell everyone and let each
      // content script decide. Tabs with nothing listening reject, and that's fine.
      const tabs = await api.tabs.query({}).catch(() => [])
      for (const tab of tabs) {
        await refreshPopup(tab.id, tab.url)
        await tell(tab.id, { type: 'teardown', origin })
      }
    }
  }

  const reconcile = async () => {
    // Registrations are cleared on extension update, and can drift from the grants.
    const { origins = [] } = await api.permissions.getAll()
    const wanted = origins.map(originOfPattern)
    const existing = await api.scripting.getRegisteredContentScripts().catch(() => [])
    const wantedIds = wanted.map(scriptId)
    const stale = existing.filter((script) => !wantedIds.includes(script.id)).map((script) => script.id)
    if (stale.length) await api.scripting.unregisterContentScripts({ ids: stale }).catch(() => {})
    for (const origin of wanted) await register(origin)
    // A restart can leave an already-open tab with the default popup even though it's granted.
    for (const tab of await api.tabs.query({}).catch(() => [])) await refreshPopup(tab.id, tab.url)
  }

  const onUpdated = (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' || changeInfo.url) refreshPopup(tabId, tab?.url ?? changeInfo.url)
    if (changeInfo.url) tell(tabId, { type: 'url-changed' })
  }

  const onActivated = async ({ tabId }) => {
    const tab = await api.tabs.get(tabId).catch(() => null)
    await refreshPopup(tabId, tab?.url)
  }

  // Synchronous and fire-and-forget: returning a promise here would tell the
  // extension platform to keep the channel open for a reply nobody sends.
  const onRuntimeMessage = (message) => {
    if (message?.type === 'toggle-tab') toggle({ id: message.tabId, url: message.url })
  }

  const start = () => {
    api.runtime.onInstalled.addListener(reconcile)
    api.runtime.onStartup.addListener(reconcile)
    api.permissions.onAdded.addListener(onAdded)
    api.permissions.onRemoved.addListener(onRemoved)
    api.action.onClicked.addListener(toggle)
    api.commands.onCommand.addListener((command, tab) => {
      if (command === 'toggle-tray') toggle(tab)
    })
    api.tabs.onUpdated.addListener(onUpdated)
    api.tabs.onActivated.addListener(onActivated)
    api.runtime.onMessage.addListener(onRuntimeMessage)
  }

  return { start, toggle, refreshPopup, onAdded, onRemoved, reconcile, onRuntimeMessage }
}
