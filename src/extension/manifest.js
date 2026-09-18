const shared = {
  manifest_version: 3,
  name: 'Stickerpack',
  version: '1.0.0',
  description: 'Put stickers on any website. They stay where you put them, and they stay yours.',
  permissions: ['storage', 'scripting', 'activeTab'],
  optional_host_permissions: ['*://*/*'],
  icons: { 16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  action: {
    default_title: 'Stickerpack',
    default_popup: 'popup.html',
    default_icon: { 16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' }
  },
  options_ui: { page: 'options.html', open_in_tab: false },
  web_accessible_resources: [{ resources: ['stickers/*'], matches: ['*://*/*'] }],
  commands: {
    'toggle-tray': {
      // Alt is Option on a Mac, and Option combinations type characters, so Mac gets Control.
      suggested_key: { default: 'Alt+Shift+S', mac: 'MacCtrl+Shift+S' },
      description: 'Open or close the sticker tray'
    }
  }
}

export const manifest = (target) => target === 'firefox'
  ? {
      ...shared,
      background: { scripts: ['background.js'] },
      browser_specific_settings: {
        // optional_host_permissions landed in Firefox 128.
        gecko: {
          id: 'stickerpack@stucco.software',
          strict_min_version: '128.0',
          // Self-hosted: Firefox checks here for new signed builds.
          update_url: 'https://stickerpack.stucco.software/updates.json'
        }
      }
    }
  : { ...shared, background: { service_worker: 'background.js' } }
