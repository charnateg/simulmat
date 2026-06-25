export interface ParticleBuffer {
  pos:    Float32Array   // x,y,z interleaved, n*3
  prev:   Float32Array
  accel:  Float32Array
  pinned: Uint8Array
  alive:  Uint8Array
  burn:   Float32Array   // 0..1
  n:      number
}

export type ConstraintType = 'structural' | 'shear' | 'bend'

export interface Constraint {
  a:         number
  b:         number
  rest:      number
  stiffness: number       // 0..1, correction strength per iteration
  type:      ConstraintType
  active:    boolean
}

export interface SolverParams {
  gravity:          number
  windX:            number
  windZ:            number
  turbulence:       number
  damping:          number
  mass:             number
  stretchLimit:     number
  iterations:       number
  tearThreshold:    number   // Infinity = no tear
  burnRate:         number
  bendStiffness:    number   // 0..1
  plasticThreshold: number   // 0 = no plastic deformation (metal)
}

export const DEFAULT_PARAMS: SolverParams = {
  gravity: -9.8, windX: 0, windZ: 0, turbulence: 0.4,
  damping: 0.02, mass: 0.2, stretchLimit: 1.0,
  iterations: 5, tearThreshold: Infinity, burnRate: 1.0,
  bendStiffness: 0.5, plasticThreshold: 0,
}

export function createParticleBuffer(n: number): ParticleBuffer {
  return {
    pos:    new Float32Array(n * 3),
    prev:   new Float32Array(n * 3),
    accel:  new Float32Array(n * 3),
    pinned: new Uint8Array(n),
    alive:  new Uint8Array(n),
    burn:   new Float32Array(n),
    n,
  }
}
