import * as THREE from 'three'
import type { MaterialPreset } from './presets'
import { generateTextureCanvas, canvasToTex, normalFromCanvas } from './TextureGen'

export class MaterialBuilder {
  private maxAniso: number

  constructor(renderer: THREE.WebGLRenderer) {
    this.maxAniso = renderer.capabilities.getMaxAnisotropy()
  }

  build(preset: MaterialPreset, color: string): THREE.MeshPhysicalMaterial {
    let map: THREE.Texture | undefined
    let normalMap: THREE.Texture | undefined

    if (!preset.overlay) {
      const cv = generateTextureCanvas(preset.textureGen, color)
      map = canvasToTex(cv, preset.textureRepeat, this.maxAniso)
      if (preset.normalScale > 0) {
        normalMap = normalFromCanvas(cv, preset.textureRepeat, this.maxAniso)
      }
    }

    const mat = new THREE.MeshPhysicalMaterial({
      side:          THREE.DoubleSide,
      vertexColors:  true,
      map,
      normalMap,
      normalScale:      new THREE.Vector2(preset.normalScale, preset.normalScale),
      roughness:        preset.roughness,
      metalness:        preset.metalness,
      transmission:     preset.transmission,
      ior:              preset.ior,
      iridescence:      preset.iridescence,
      iridescenceIOR:   preset.iridescenceIOR,
      sheen:            preset.sheen,
      sheenRoughness:   preset.sheenRoughness,
      sheenColor:       new THREE.Color(preset.sheenColor),
      clearcoat:        preset.clearcoat,
      clearcoatRoughness: preset.clearcoatRoughness,
      emissive:         new THREE.Color(preset.emissiveColor),
      emissiveIntensity: preset.emissiveIntensity,
    })

    if (!map) mat.color.set(color)

    return mat
  }
}
