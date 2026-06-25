import * as THREE from 'three'
import type { ParticleBuffer } from '../physics/types'
import type { ColliderDesc, SphereCollider, PlaneCollider, CapsuleCollider } from './ColliderTypes'

const SKIN = 0.01
const _ab = new THREE.Vector3()

export function solveColliders(buf: ParticleBuffer, colliders: ColliderDesc[]): void {
  for (const col of colliders) {
    if (col.type === 'sphere')  solveSphere(buf, col)
    if (col.type === 'plane')   solvePlane(buf, col)
    if (col.type === 'capsule') solveCapsule(buf, col)
  }
}

function solveSphere(buf: ParticleBuffer, col: SphereCollider): void {
  const { pos, pinned, alive, n } = buf
  const { center, radius } = col
  const minD = radius + SKIN
  for (let i = 0; i < n; i++) {
    if (pinned[i] || !alive[i]) continue
    const dx = pos[i*3] - center.x
    const dy = pos[i*3+1] - center.y
    const dz = pos[i*3+2] - center.z
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz)
    if (d < minD && d > 1e-7) {
      const f = minD / d
      pos[i*3]   = center.x + dx * f
      pos[i*3+1] = center.y + dy * f
      pos[i*3+2] = center.z + dz * f
    }
  }
}

function solvePlane(buf: ParticleBuffer, col: PlaneCollider): void {
  const { pos, pinned, alive, n } = buf
  const { normal, offset } = col
  const minD = offset + SKIN
  for (let i = 0; i < n; i++) {
    if (pinned[i] || !alive[i]) continue
    const d = pos[i*3]*normal.x + pos[i*3+1]*normal.y + pos[i*3+2]*normal.z
    if (d < minD) {
      const push = minD - d
      pos[i*3]   += push * normal.x
      pos[i*3+1] += push * normal.y
      pos[i*3+2] += push * normal.z
    }
  }
}

function solveCapsule(buf: ParticleBuffer, col: CapsuleCollider): void {
  const { pos, pinned, alive, n } = buf
  const { a, b, radius } = col
  _ab.subVectors(b, a)
  const ab2 = _ab.lengthSq()
  const minD = radius + SKIN

  for (let i = 0; i < n; i++) {
    if (pinned[i] || !alive[i]) continue
    const px = pos[i*3] - a.x
    const py = pos[i*3+1] - a.y
    const pz = pos[i*3+2] - a.z
    const t = Math.max(0, Math.min(1, (px*_ab.x + py*_ab.y + pz*_ab.z) / ab2))
    const cx = a.x + _ab.x * t
    const cy = a.y + _ab.y * t
    const cz = a.z + _ab.z * t
    const dx = pos[i*3] - cx, dy = pos[i*3+1] - cy, dz = pos[i*3+2] - cz
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz)
    if (d < minD && d > 1e-7) {
      const f = minD / d
      pos[i*3]   = cx + dx * f
      pos[i*3+1] = cy + dy * f
      pos[i*3+2] = cz + dz * f
    }
  }
}
