import { it, expect, vi } from 'vitest'
import { watchedStorage } from './watched-storage.js'

const memory = () => {
  const saved = []
  return {
    list: async () => [...saved],
    add: async (annotation) => { saved.push(annotation) },
    remove: async (annotation) => { saved.splice(saved.indexOf(annotation), 1) }
  }
}

it('reports stickers as they are listed, added and removed', async () => {
  const onChange = vi.fn()
  const storage = watchedStorage(memory(), onChange)
  const a = { id: 'a' }
  const b = { id: 'b' }

  expect(await storage.list('page')).toEqual([])
  expect(onChange).toHaveBeenLastCalledWith([])

  await storage.add(a)
  await storage.add(b)
  expect(onChange).toHaveBeenLastCalledWith([a, b])

  await storage.remove(a)
  expect(onChange).toHaveBeenLastCalledWith([b])
})

it('does not report changes that failed to save', async () => {
  const onChange = vi.fn()
  const failing = { ...memory(), add: async () => { throw new Error('nope') } }
  const storage = watchedStorage(failing, onChange)
  await expect(storage.add({ id: 'a' })).rejects.toThrow('nope')
  expect(onChange).not.toHaveBeenCalled()
})
