import { api } from '../browser.js'

const list = document.querySelector('#sites')
const empty = document.querySelector('#empty')

const render = async () => {
  const { origins = [] } = await api.permissions.getAll()
  list.replaceChildren()
  empty.hidden = origins.length > 0

  for (const value of origins) {
    const item = document.createElement('li')
    const name = document.createElement('span')
    name.textContent = value.replace(/\/\*$/, '')
    const stop = document.createElement('button')
    stop.type = 'button'
    stop.textContent = 'Stop stickering this site'
    stop.addEventListener('click', () => {
      api.permissions.remove({ origins: [value] }).then(render, render)
    })
    item.append(name, stop)
    list.append(item)
  }
}

render()
