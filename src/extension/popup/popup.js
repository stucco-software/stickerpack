import { api } from '../browser.js'
import { stickerable } from '../page.js'

const status = document.querySelector('#status')
const action = document.querySelector('#action')

const start = async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url

  if (!url || !stickerable(url)) {
    status.textContent = 'This page can’t take stickers.'
    return
  }

  const { hostname, origin } = new URL(url)
  const origins = [`${origin}/*`]

  if (await api.permissions.contains({ origins })) {
    // Granted tabs normally skip this popup, but a tab open since the browser started
    // still has it, so the popup has to be able to open the tray itself.
    status.textContent = `Stickers are on for ${hostname}. Turn the site off in the extension’s options.`
    action.hidden = false
    action.textContent = 'Open the sticker tray'
    action.addEventListener('click', () => {
      api.tabs.sendMessage(tab.id, { type: 'toggle' }).finally(() => window.close())
    })
    return
  }

  status.textContent = `Stick stickers on ${hostname}?`
  action.hidden = false
  action.addEventListener('click', () => {
    // First statement, before any await: the click doesn't survive one.
    api.permissions.request({ origins }).then(
      () => window.close(),
      () => { status.textContent = 'That didn’t work. Try again?' }
    )
  })
}

start()
