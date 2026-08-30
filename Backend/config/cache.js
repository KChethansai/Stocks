// tiny TTL in-memory cache for read-heavy endpoints whose data changes slowly.
const store = new Map()

export const cached = async (key, ttlMs, loader) => {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && now - hit.at < ttlMs) return hit.value

  const value = await loader()
  store.set(key, { at: now, value })
  return value
}

export const invalidateCache = (key) => store.delete(key)