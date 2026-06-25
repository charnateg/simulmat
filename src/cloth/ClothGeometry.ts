import * as THREE from 'three'
import type { ClothMesh } from './ClothMesh'
import { CLOTH_N } from './ClothMesh'
import type { ParticleBuffer } from '../physics/types'

export class ClothGeometry {
  geo: THREE.BufferGeometry
  private burnColors: Float32Array

  constructor(cloth: ClothMesh) {
    this.burnColors = new Float32Array(CLOTH_N * 3).fill(1)
    const geo = new THREE.BufferGeometry()
    geo.setIndex(cloth.indices)
    geo.setAttribute('position', new THREE.BufferAttribute(cloth.buf.pos, 3))
    geo.setAttribute('uv',       new THREE.BufferAttribute(cloth.uvs, 2))
    geo.setAttribute('color',    new THREE.BufferAttribute(this.burnColors, 3))
    geo.computeVertexNormals()
    this.geo = geo
  }

  update(buf: ParticleBuffer): void {
    const bc = this.burnColors
    for (let i = 0; i < buf.n; i++) {
      const b = buf.burn[i]
      if (b === 0) {
        bc[i*3] = bc[i*3+1] = bc[i*3+2] = 1
      } else if (b < 0.5) {
        const k = b / 0.5
        bc[i*3] = 1; bc[i*3+1] = 1 - k * 0.35; bc[i*3+2] = 1 - k * 0.9
      } else {
        const k = (b - 0.5) / 0.5
        bc[i*3] = 1 - k * 0.7; bc[i*3+1] = 0.65 * (1-k); bc[i*3+2] = 0.1 * (1-k)
      }
    }
    ;(this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.geo.attributes.color    as THREE.BufferAttribute).needsUpdate = true
    this.geo.computeVertexNormals()
  }
}
