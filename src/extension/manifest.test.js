import { it, expect } from 'vitest'
import { manifest } from './manifest.js'

it('asks for no host permissions up front', () => {
  for (const target of ['chrome', 'firefox']) {
    const built = manifest(target)
    expect(built.host_permissions).toBeUndefined()
    expect(built.optional_host_permissions).toEqual(['*://*/*'])
    expect(built.permissions).toEqual(['storage', 'scripting', 'activeTab'])
    expect(built.manifest_version).toBe(3)
  }
})

it('ships the pieces the extension needs', () => {
  const built = manifest('chrome')
  expect(built.action.default_popup).toBe('popup.html')
  expect(built.options_ui.page).toBe('options.html')
  expect(built.web_accessible_resources).toEqual([{ resources: ['stickers/*'], matches: ['*://*/*'] }])
  expect(built.commands['toggle-tray'].suggested_key).toEqual({
    default: 'Alt+Shift+S',
    mac: 'MacCtrl+Shift+S'
  })
})

it('differs only in how the background runs, plus the Firefox id', () => {
  const chrome = manifest('chrome')
  const firefox = manifest('firefox')
  expect(chrome.background).toEqual({ service_worker: 'background.js' })
  expect(firefox.background).toEqual({ scripts: ['background.js'] })
  expect(firefox.browser_specific_settings.gecko).toEqual({
    id: 'stickerpack@stucco.software',
    strict_min_version: '128.0'
  })
  expect(chrome.browser_specific_settings).toBeUndefined()

  const { background: _c, ...restChrome } = chrome
  const { background: _f, browser_specific_settings: _g, ...restFirefox } = firefox
  expect(restChrome).toEqual(restFirefox)
})
