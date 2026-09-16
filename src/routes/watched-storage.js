// Wraps any storage adapter and calls onChange with this page's stickers
// whenever they're loaded, added or removed.
export const watchedStorage = (adapter, onChange) => {
  let stickers = []

  const update = (next) => {
    stickers = next
    onChange(stickers)
  }

  return {
    async list(source) {
      const list = await adapter.list(source)
      update(list)
      return list
    },
    async add(annotation) {
      await adapter.add(annotation)
      update([...stickers, annotation])
    },
    async remove(annotation) {
      await adapter.remove(annotation)
      update(stickers.filter((sticker) => sticker.id !== annotation.id))
    }
  }
}
