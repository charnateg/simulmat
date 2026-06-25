export interface SimSnapshot {
  layout:       string
  materialId:   string
  color:        string
  gravity:      number
  windX:        number
  windZ:        number
  turbulence:   number
  damping:      number
  mass:         number
  iterations:   number
  bendStiffness: number
  stretchLimit: number
  tearThreshold: number
  ambientInt:   number
  keyInt:       number
}

const ORDER: (keyof SimSnapshot)[] = [
  'layout', 'materialId', 'color',
  'gravity', 'windX', 'windZ', 'turbulence',
  'damping', 'mass', 'iterations', 'bendStiffness',
  'stretchLimit', 'tearThreshold', 'ambientInt', 'keyInt',
]

export function encodeSnapshot(s: SimSnapshot): string {
  const arr = ORDER.map(k => s[k])
  return btoa(JSON.stringify(arr)).replace(/=+$/, '')
}

export function decodeSnapshot(hash: string): SimSnapshot | null {
  try {
    const padded = hash + '=='.slice((hash.length + 3) % 4)
    const arr: unknown[] = JSON.parse(atob(padded))
    if (!Array.isArray(arr) || arr.length < ORDER.length) return null
    const s = {} as SimSnapshot
    ORDER.forEach((k, i) => { (s as unknown as Record<string, unknown>)[k] = arr[i] })
    return s
  } catch {
    return null
  }
}

export function loadFromUrl(): SimSnapshot | null {
  const hash = location.hash.slice(1)
  if (!hash) return null
  return decodeSnapshot(hash)
}

export function saveToUrl(s: SimSnapshot): void {
  history.replaceState(null, '', '#' + encodeSnapshot(s))
}

export function copyShareUrl(s: SimSnapshot): void {
  const url = location.origin + location.pathname + '#' + encodeSnapshot(s)
  navigator.clipboard.writeText(url).catch(() => {})
}
