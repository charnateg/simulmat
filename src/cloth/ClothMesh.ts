import * as THREE from 'three'
import { createParticleBuffer } from '../physics/types'
import type { ParticleBuffer, Constraint } from '../physics/types'

export type LayoutName = 'curtain' | 'flag' | 'cape' | 'banner' | 'tablecloth' | 'hammock'

export const COLS = 50
export const ROWS = 60
export const REST = 0.16
export const CLOTH_N = COLS * ROWS

export function idx(c: number, r: number): number { return r * COLS + c }

export class ClothMesh {
  buf: ParticleBuffer
  constraints: Constraint[] = []
  indices: number[]
  uvs: Float32Array

  constructor() {
    this.buf = createParticleBuffer(CLOTH_N)
    this.indices = this._buildIndices()
    this.uvs = this._buildUVs()
  }

  build(layout: LayoutName): void {
    this._initPositions(layout)
    this._buildConstraints()
    this._applyPinning(layout)
  }

  reset(layout: LayoutName): void {
    this.buf.burn.fill(0)
    this.buf.alive.fill(1)
    this._initPositions(layout)
    this._applyPinning(layout)
    for (const cn of this.constraints) cn.active = true
  }

  spreadFire(dt: number, burnRate: number): void {
    const { alive, burn } = this.buf
    const step = burnRate * dt
    const threshold = 0.45
    const spreadChance = 0.065

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = idx(c, r)
        if (!alive[i]) continue

        // Advance burn progress
        if (burn[i] > 0 && burn[i] < 1) {
          burn[i] = Math.min(1, burn[i] + step)
          if (burn[i] >= 1) alive[i] = 0
        }

        // Spread to neighbors
        if (burn[i] < threshold || burn[i] >= 1) continue
        const nb = [
          c > 0       ? idx(c-1, r) : -1,
          c < COLS-1  ? idx(c+1, r) : -1,
          r > 0       ? idx(c, r-1) : -1,
          r < ROWS-1  ? idx(c, r+1) : -1,
        ]
        for (const ni of nb) {
          if (ni >= 0 && alive[ni] && burn[ni] === 0 && Math.random() < spreadChance)
            burn[ni] = 0.04
        }
      }
    }
  }

  igniteAt(point: THREE.Vector3, radius: number): void {
    const { pos, alive, burn } = this.buf
    const r2 = radius * radius
    for (let i = 0; i < CLOTH_N; i++) {
      if (!alive[i] || burn[i] > 0) continue
      const dx = pos[i*3]-point.x, dy = pos[i*3+1]-point.y, dz = pos[i*3+2]-point.z
      if (dx*dx + dy*dy + dz*dz < r2) burn[i] = 0.04
    }
  }

  cutAt(point: THREE.Vector3, radius: number): void {
    const r2 = radius * radius
    const { pos } = this.buf
    for (const cn of this.constraints) {
      if (!cn.active) continue
      const ai = cn.a*3, bi = cn.b*3
      const mx = (pos[ai]+pos[bi])*0.5, my = (pos[ai+1]+pos[bi+1])*0.5, mz = (pos[ai+2]+pos[bi+2])*0.5
      const dx = mx-point.x, dy = my-point.y, dz = mz-point.z
      if (dx*dx + dy*dy + dz*dz < r2) cn.active = false
    }
  }

  releasePins(): void { this.buf.pinned.fill(0) }

  private _initPositions(layout: LayoutName): void {
    const { pos, prev } = this.buf
    const W = (COLS-1) * REST
    const H = (ROWS-1) * REST

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = idx(c, r)
        let x: number, y: number, z: number
        switch (layout) {
          case 'flag':
            x = -W*0.1 + c * REST; y = 4 - r * REST; z = 0; break
          case 'banner':
            x = -W/2 + c * REST; y = 4 - r * REST * 0.5; z = (r * REST * 0.8); break
          case 'tablecloth':
            x = -W/2 + c * REST; y = 1.2; z = -H/2 + r * REST; break
          case 'hammock':
            x = -W/2 + c * REST; y = 1.5; z = -H/2 + r * REST; break
          case 'cape':
            x = -W/2 + c * REST; y = 4 - r * REST * 0.8; z = r * REST * 0.5 * Math.sin((c/(COLS-1))*Math.PI); break
          default: // curtain
            x = -W/2 + c * REST; y = 4 - r * REST; z = 0
        }
        pos[i*3] = prev[i*3] = x
        pos[i*3+1] = prev[i*3+1] = y
        pos[i*3+2] = prev[i*3+2] = z
        this.buf.burn[i] = 0
        this.buf.alive[i] = 1
      }
    }
  }

  private _buildConstraints(): void {
    this.constraints = []
    const { pos } = this.buf

    const add = (a: number, b: number, type: Constraint['type']) => {
      const ai = a*3, bi = b*3
      const dx = pos[bi]-pos[ai], dy = pos[bi+1]-pos[ai+1], dz = pos[bi+2]-pos[ai+2]
      this.constraints.push({
        a, b, rest: Math.sqrt(dx*dx+dy*dy+dz*dz),
        stiffness: 1, type, active: true,
      })
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Structural
        if (c < COLS-1) add(idx(c,r), idx(c+1,r), 'structural')
        if (r < ROWS-1) add(idx(c,r), idx(c,r+1), 'structural')
        // Shear
        if (c < COLS-1 && r < ROWS-1) {
          add(idx(c,r), idx(c+1,r+1), 'shear')
          add(idx(c+1,r), idx(c,r+1), 'shear')
        }
        // Bending (2-hop) — resists folding without full dihedral math
        if (c+2 < COLS) add(idx(c,r), idx(c+2,r), 'bend')
        if (r+2 < ROWS) add(idx(c,r), idx(c,r+2), 'bend')
        if (c+2 < COLS && r+2 < ROWS) add(idx(c,r), idx(c+2,r+2), 'bend')
        if (c+2 < COLS && r-2 >= 0)   add(idx(c,r), idx(c+2,r-2), 'bend')
      }
    }
  }

  private _applyPinning(layout: LayoutName): void {
    const { pinned } = this.buf
    pinned.fill(0)
    switch (layout) {
      case 'curtain':
        for (let c = 0; c < COLS; c++) pinned[idx(c, 0)] = 1
        break
      case 'flag':
        for (let r = 0; r < ROWS; r++) pinned[idx(0, r)] = 1
        break
      case 'cape':
        for (let c = 0; c < COLS; c++) pinned[idx(c, 0)] = 1
        break
      case 'banner':
        pinned[idx(Math.floor(COLS/2), 0)] = 1
        pinned[idx(Math.floor(COLS/4), 0)] = 1
        pinned[idx(Math.floor(3*COLS/4), 0)] = 1
        break
      case 'tablecloth':
        pinned[idx(0,0)] = 1; pinned[idx(COLS-1,0)] = 1
        pinned[idx(0,ROWS-1)] = 1; pinned[idx(COLS-1,ROWS-1)] = 1
        break
      case 'hammock':
        for (let r = 0; r < ROWS; r++) {
          pinned[idx(0, r)] = 1
          pinned[idx(COLS-1, r)] = 1
        }
        break
    }
  }

  private _buildIndices(): number[] {
    const out: number[] = []
    for (let r = 0; r < ROWS-1; r++)
      for (let c = 0; c < COLS-1; c++) {
        const a = idx(c,r), b = idx(c+1,r), d = idx(c,r+1), e = idx(c+1,r+1)
        out.push(a, d, b, b, d, e)
      }
    return out
  }

  private _buildUVs(): Float32Array {
    const uv = new Float32Array(CLOTH_N * 2)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        uv[idx(c,r)*2]   = c / (COLS-1)
        uv[idx(c,r)*2+1] = 1 - r / (ROWS-1)
      }
    return uv
  }
}
