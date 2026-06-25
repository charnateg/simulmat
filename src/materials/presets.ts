export type TextureGenId =
  | 'fabric' | 'silk' | 'leather' | 'velvet'
  | 'rubber' | 'gel' | 'plate' | 'chainmail' | 'scales'

export interface MaterialPreset {
  id:    string
  label: string
  // Physics
  mass:             number
  damping:          number
  iterations:       number
  stretchLimit:     number
  bendStiffness:    number
  tearThreshold:    number
  plasticThreshold: number
  // PBR
  roughness:           number
  metalness:           number
  transmission:        number
  ior:                 number
  iridescence:         number
  iridescenceIOR:      number
  sheen:               number
  sheenRoughness:      number
  sheenColor:          string
  clearcoat:           number
  clearcoatRoughness:  number
  emissiveColor:       string
  emissiveIntensity:   number
  // Texture
  textureGen:    TextureGenId
  normalScale:   number
  textureRepeat: [number, number]
  // Instanced overlay
  overlay: 'chainmail' | 'scales' | null
}

function p(id: string, label: string, o: Partial<MaterialPreset>): MaterialPreset {
  return {
    id, label,
    mass: 0.2, damping: 0.02, iterations: 5, stretchLimit: 1.0,
    bendStiffness: 0.5, tearThreshold: Infinity, plasticThreshold: 0,
    roughness: 0.7, metalness: 0.05, transmission: 0, ior: 1.5,
    iridescence: 0, iridescenceIOR: 1.3,
    sheen: 0, sheenRoughness: 0.5, sheenColor: '#ffffff',
    clearcoat: 0, clearcoatRoughness: 0.5,
    emissiveColor: '#000000', emissiveIntensity: 0,
    textureGen: 'fabric', normalScale: 0.6, textureRepeat: [3, 4],
    overlay: null,
    ...o,
  }
}

export const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  fabric: p('fabric', 'Fabric', {
    mass: 0.2, damping: 0.02, iterations: 4, bendStiffness: 0.4,
    roughness: 0.75, metalness: 0.03,
    textureGen: 'fabric', normalScale: 0.6, textureRepeat: [3, 4],
  }),
  silk: p('silk', 'Silk', {
    mass: 0.1, damping: 0.01, iterations: 3, bendStiffness: 0.2,
    roughness: 0.22, metalness: 0.18,
    iridescence: 0.45, iridescenceIOR: 1.4,
    textureGen: 'silk', normalScale: 0.3, textureRepeat: [3, 4],
  }),
  leather: p('leather', 'Leather', {
    mass: 0.35, damping: 0.03, iterations: 5, bendStiffness: 0.6,
    roughness: 0.55, metalness: 0.08,
    clearcoat: 0.3, clearcoatRoughness: 0.4,
    textureGen: 'leather', normalScale: 1.2, textureRepeat: [2, 2],
  }),
  velvet: p('velvet', 'Velvet', {
    mass: 0.28, damping: 0.025, iterations: 4, bendStiffness: 0.5,
    roughness: 0.95, metalness: 0,
    sheen: 1.0, sheenRoughness: 0.28, sheenColor: '#9988ff',
    emissiveColor: '#221144', emissiveIntensity: 0.04,
    textureGen: 'velvet', normalScale: 0.9, textureRepeat: [3, 4],
  }),
  gel: p('gel', 'Gel', {
    mass: 0.12, damping: 0.004, iterations: 2, stretchLimit: 1.35,
    bendStiffness: 0.12,
    roughness: 0.08, metalness: 0, transmission: 0.88, ior: 1.45,
    emissiveColor: '#003366', emissiveIntensity: 0.08,
    textureGen: 'gel', normalScale: 0.15, textureRepeat: [2, 2],
  }),
  rubber: p('rubber', 'Rubber', {
    mass: 0.45, damping: 0.055, iterations: 3, stretchLimit: 1.65,
    bendStiffness: 0.32,
    roughness: 0.88, metalness: 0,
    textureGen: 'rubber', normalScale: 0.7, textureRepeat: [2, 3],
  }),
  metal: p('metal', 'Metal plate', {
    mass: 1.2, damping: 0.08, iterations: 7, bendStiffness: 0.05,
    plasticThreshold: 0.12,
    roughness: 0.25, metalness: 0.96,
    iridescence: 0.12, iridescenceIOR: 1.8,
    textureGen: 'plate', normalScale: 0.35, textureRepeat: [2, 2],
  }),
  chainmail: p('chainmail', 'Chainmail', {
    mass: 0.85, damping: 0.06, iterations: 6, bendStiffness: 0.7,
    roughness: 0.22, metalness: 0.97,
    textureGen: 'chainmail', normalScale: 0, textureRepeat: [1, 1],
    overlay: 'chainmail',
  }),
  scales: p('scales', 'Scale armor', {
    mass: 0.9, damping: 0.05, iterations: 6, bendStiffness: 0.6,
    roughness: 0.3, metalness: 0.9,
    iridescence: 0.32, iridescenceIOR: 1.6,
    textureGen: 'scales', normalScale: 0, textureRepeat: [1, 1],
    overlay: 'scales',
  }),
}

export const COLORS = [
  { name: 'cyan',     hex: '#00e5ff' },
  { name: 'violet',   hex: '#7c5cff' },
  { name: 'magenta',  hex: '#ff3ec8' },
  { name: 'lime',     hex: '#7cff5c' },
  { name: 'gold',     hex: '#ffc857' },
  { name: 'crimson',  hex: '#ff4757' },
  { name: 'white',    hex: '#e8eef9' },
  { name: 'graphite', hex: '#3a4256' },
  { name: 'steel',    hex: '#aab6cf' },
  { name: 'copper',   hex: '#c87f4a' },
]

export const PHYSICS_PRESETS: Record<string, Partial<MaterialPreset>> = {
  silk:   { mass: 0.10, iterations: 3, damping: 0.01, stretchLimit: 1.0, bendStiffness: 0.2, plasticThreshold: 0 },
  cotton: { mass: 0.25, iterations: 4, damping: 0.02, stretchLimit: 1.0, bendStiffness: 0.45, plasticThreshold: 0 },
  rubber: { mass: 0.45, iterations: 3, damping: 0.05, stretchLimit: 1.6, bendStiffness: 0.32, plasticThreshold: 0 },
  chain:  { mass: 0.80, iterations: 6, damping: 0.06, stretchLimit: 1.0, bendStiffness: 0.7, plasticThreshold: 0 },
  zerog:  { mass: 0.20, iterations: 3, damping: 0.02, stretchLimit: 1.0, bendStiffness: 0.5, plasticThreshold: 0 },
  armor:  { mass: 1.20, iterations: 7, damping: 0.06, stretchLimit: 1.0, bendStiffness: 0.05, plasticThreshold: 0 },
}
