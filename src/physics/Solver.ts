import type { ParticleBuffer, Constraint, SolverParams } from './types'
import type { ColliderDesc } from '../colliders/ColliderTypes'
import { solveColliders } from '../colliders/ColliderSolver'

export interface ISolver {
  step(
    buf: ParticleBuffer,
    constraints: Constraint[],
    colliders: ColliderDesc[],
    params: SolverParams,
    dt: number
  ): void
}

export class CpuSolver implements ISolver {
  step(
    buf: ParticleBuffer,
    constraints: Constraint[],
    colliders: ColliderDesc[],
    params: SolverParams,
    dt: number
  ): void {
    const cdt = Math.min(dt, 0.033)
    this._applyForces(buf, params, cdt)
    this._verlet(buf, params, cdt)
    this._solveConstraints(buf, constraints, params)
    solveColliders(buf, colliders)
  }

  private _applyForces(buf: ParticleBuffer, p: SolverParams, dt: number): void {
    const { pos, accel, pinned, alive, burn, n } = buf
    const t = performance.now() * 0.001
    const m = Math.max(0.01, p.mass)

    for (let i = 0; i < n; i++) {
      if (pinned[i]) { accel[i*3] = accel[i*3+1] = accel[i*3+2] = 0; continue }
      if (!alive[i]) {
        accel[i*3]   = 0
        accel[i*3+1] = p.gravity + 5 * burn[i]   // thermal uplift
        accel[i*3+2] = 0
        continue
      }
      const px = pos[i*3], py = pos[i*3+1]
      const tx = Math.sin(py * 0.7 + t * 1.3) * p.turbulence
      const tz = Math.cos(px * 0.5 + t * 1.7) * p.turbulence
      accel[i*3]   = p.windX / m + tx
      accel[i*3+1] = p.gravity
      accel[i*3+2] = p.windZ / m + tz
    }
  }

  private _verlet(buf: ParticleBuffer, p: SolverParams, dt: number): void {
    const { pos, prev, accel, pinned, n } = buf
    const damp = 1 - Math.min(0.5, p.damping)
    const dt2 = dt * dt

    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue
      const i3 = i * 3
      const vx = (pos[i3]   - prev[i3])   * damp
      const vy = (pos[i3+1] - prev[i3+1]) * damp
      const vz = (pos[i3+2] - prev[i3+2]) * damp
      prev[i3]   = pos[i3];   pos[i3]   += vx + accel[i3]   * dt2
      prev[i3+1] = pos[i3+1]; pos[i3+1] += vy + accel[i3+1] * dt2
      prev[i3+2] = pos[i3+2]; pos[i3+2] += vz + accel[i3+2] * dt2
    }
  }

  private _solveConstraints(
    buf: ParticleBuffer,
    constraints: Constraint[],
    p: SolverParams,
  ): void {
    const { pos, pinned, alive } = buf
    const iters = Math.max(1, p.iterations)
    const tearLimit = isFinite(p.tearThreshold) ? p.tearThreshold : Infinity

    for (let it = 0; it < iters; it++) {
      for (const cn of constraints) {
        if (!cn.active) continue
        if (!alive[cn.a] && !alive[cn.b]) continue

        const ai = cn.a * 3, bi = cn.b * 3
        const dx = pos[bi] - pos[ai]
        const dy = pos[bi+1] - pos[ai+1]
        const dz = pos[bi+2] - pos[ai+2]
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-7

        // Tearing
        if (cn.type !== 'bend' && tearLimit !== Infinity && dist > cn.rest * tearLimit) {
          cn.active = false; continue
        }

        // Plastic deformation — rest length drifts toward current length
        if (p.plasticThreshold > 0 && cn.type === 'structural') {
          const strain = dist / cn.rest - 1
          if (strain > p.plasticThreshold) {
            cn.rest = dist / (1 + p.plasticThreshold * 0.5)
          }
        }

        const targetDist = cn.type === 'structural'
          ? cn.rest * p.stretchLimit
          : cn.rest

        const k = cn.type === 'bend' ? p.bendStiffness : cn.stiffness
        const half = ((dist - targetDist) / dist) * 0.5 * k
        const ox = dx * half, oy = dy * half, oz = dz * half

        const pinA = pinned[cn.a], pinB = pinned[cn.b]
        if (!pinA) { pos[ai]   += ox; pos[ai+1] += oy; pos[ai+2] += oz }
        if (!pinB) { pos[bi]   -= ox; pos[bi+1] -= oy; pos[bi+2] -= oz }
      }

      // Floor
      for (let i = 0; i < buf.n; i++) {
        if (pos[i*3+1] < -3) pos[i*3+1] = -3
      }
    }
  }
}
